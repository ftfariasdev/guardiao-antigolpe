import type { EventosFamilia, SessaoCriada } from "@guardiao/shared";
import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "../config";

const CHAVE = "guardiao:pitch:demo";

export interface ContasDemo {
  /** Token da sessão da Dona Cida (protegida) e da Ana (guardiã), só no notebook do palco. */
  cida: string;
  ana: string;
}

async function pedir<T>(caminho: string, corpo: object, token?: string): Promise<T> {
  const r = await fetch(`${API_URL}/api/v1${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Cria a família de demonstração: Ana (filha, guardiã) e Dona Cida (protegida). */
async function criarContas(): Promise<ContasDemo> {
  const ana = await pedir<SessaoCriada>("/familias", { nome_familia: "Família da demonstração", nome: "Ana", parentesco: "filha" });
  const convite = await pedir<{ token: string }>(`/familias/${ana.familia.id}/convites`, { papel: "protegido" }, ana.token);
  const cida = await pedir<SessaoCriada>(`/convites/${convite.token}/aceitar`, { nome: "Dona Cida", parentesco: "mãe" });
  return { ana: ana.token, cida: cida.token };
}

/** Contas da demo do slide 7 e o aviso de quando o alerta chega para a Ana. */
export function useDemo(ativo: boolean, aoChegarAlerta: () => void) {
  const [contas, setContas] = useState<ContasDemo | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) ?? "null") as ContasDemo | null;
    } catch {
      return null;
    }
  });
  const [erro, setErro] = useState("");

  const preparar = useCallback(async () => {
    try {
      const novas = await criarContas();
      localStorage.setItem(CHAVE, JSON.stringify(novas));
      setContas(novas);
      setErro("");
    } catch (e) {
      setErro(`Não consegui criar as contas de demonstração (${(e as Error).message}).`);
    }
  }, []);

  useEffect(() => {
    if (!ativo || !contas) return;
    const socket: Socket<EventosFamilia> = io(`${API_URL}/familia`, { auth: { token: contas.ana } });
    socket.on("alerta:novo", aoChegarAlerta);
    // Sessão que não vale mais (banco zerado, por exemplo): pede para preparar de novo.
    socket.on("connect_error", (e) => e.message === "sessao_invalida" && setErro("As contas de demonstração venceram. Prepare de novo."));
    return () => {
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, contas]);

  return { contas, preparar, erro };
}
