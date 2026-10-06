import type { EventosPitch, SessaoPitch } from "@guardiao/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ADMIN_TOKEN, API_URL } from "../config";

export interface EstadoPitch {
  sessao: string | null;
  acessaram: number;
  confirmaram: number;
  revelado: boolean;
  /** "ensaio": sem backend, o slide segue com os últimos números conhecidos. */
  conexao: "conectando" | "ao_vivo" | "ensaio";
  aviso: string;
}

const CHAVE = "guardiao:pitch:sessao";
const ULTIMO = "guardiao:pitch:ultimo-placar";

async function admin(caminho: string): Promise<SessaoPitch> {
  const r = await fetch(`${API_URL}/api/v1${caminho}`, { method: "POST", headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as SessaoPitch;
}

/**
 * Sessão do golpe simulado: cria (ou reaproveita) ao abrir, entra na sala e recebe o placar.
 * Se a rede cair, a tela principal mantém o último número; o aviso vai só para o apresentador.
 */
export function usePitch(ativo: boolean) {
  const salvo = (() => {
    try {
      return JSON.parse(localStorage.getItem(ULTIMO) ?? "null") as { acessaram: number; confirmaram: number } | null;
    } catch {
      return null;
    }
  })();
  const [estado, setEstado] = useState<EstadoPitch>({ sessao: null, acessaram: salvo?.acessaram ?? 0, confirmaram: salvo?.confirmaram ?? 0, revelado: false, conexao: "conectando", aviso: "" });
  const socket = useRef<Socket<EventosPitch> | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    (async () => {
      try {
        const buscar = (caminho: string) => fetch(`${API_URL}/api/v1/pitch/sessoes/${caminho}`).then((r) => (r.ok ? (r.json() as Promise<SessaoPitch>) : null));
        let id = localStorage.getItem(CHAVE);
        let sessao: SessaoPitch | null;
        if (ADMIN_TOKEN) {
          sessao = (id ? await buscar(id) : null) ?? (await admin("/pitch/sessoes"));
        } else {
          // Sem o token (pitch publicado) não dá para criar sessão: acompanha a que estiver aberta,
          // a mesma do link curto "/#pitch". Revelar e zerar continuam só com o token.
          sessao = await buscar("atual");
          if (!sessao) throw new Error("nenhuma sessão aberta");
        }
        id = sessao.id;
        localStorage.setItem(CHAVE, id);
        if (!vivo) return;
        setEstado((e) => ({ ...e, sessao: id, acessaram: sessao.acessaram, confirmaram: sessao.confirmaram, revelado: sessao.status === "revelada" }));
        const s: Socket<EventosPitch> = io(`${API_URL}/pitch`, { auth: { sessao: id } });
        socket.current = s;
        s.on("connect", () => setEstado((e) => ({ ...e, conexao: "ao_vivo", aviso: "" })));
        s.on("disconnect", () => setEstado((e) => ({ ...e, conexao: "ensaio", aviso: "Socket.IO caiu: a tela mantém o último número." })));
        s.on("pitch:contador", (placar) => {
          localStorage.setItem(ULTIMO, JSON.stringify(placar));
          setEstado((e) => ({ ...e, ...placar }));
        });
        s.on("pitch:revelar", () => setEstado((e) => ({ ...e, revelado: true })));
        s.on("pitch:reset", () => setEstado((e) => ({ ...e, revelado: false })));
      } catch (erro) {
        const motivo = ADMIN_TOKEN ? `API fora do ar (${(erro as Error).message})` : `sem VITE_ADMIN_TOKEN e ${(erro as Error).message}`;
        if (vivo) setEstado((e) => ({ ...e, conexao: "ensaio", aviso: `Sem sessão ao vivo: ${motivo}. Mostrando os dados do ensaio.` }));
      }
    })();
    return () => {
      vivo = false;
      socket.current?.close();
    };
  }, [ativo]);

  const revelar = useCallback(async () => {
    // A tela do palco revela na hora; os celulares, quando o servidor confirmar.
    setEstado((e) => ({ ...e, revelado: true }));
    if (estado.sessao) await admin(`/pitch/sessoes/${estado.sessao}/revelar`).catch(() => setEstado((e) => ({ ...e, aviso: ADMIN_TOKEN ? "Não consegui revelar nos celulares." : "Sem VITE_ADMIN_TOKEN: a revelação ficou só nesta tela." })));
  }, [estado.sessao]);

  const zerar = useCallback(async () => {
    localStorage.removeItem(ULTIMO);
    setEstado((e) => ({ ...e, acessaram: 0, confirmaram: 0, revelado: false }));
    if (estado.sessao) await admin(`/pitch/sessoes/${estado.sessao}/reset`).catch(() => setEstado((e) => ({ ...e, aviso: "Não consegui zerar no servidor." })));
  }, [estado.sessao]);

  return { estado, revelar, zerar };
}
