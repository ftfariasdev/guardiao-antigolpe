import type { DadosSessao, EventosFamilia, SessaoAberta, SessaoAtual } from "@guardiao/shared";
import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, BASE_API, ErroApi } from "./api";
import { chaveDoPerfil, PERFIL } from "./perfil";

const CHAVE = chaveDoPerfil("guardiao:sessao");

export interface Sessao extends DadosSessao {
  token: string;
}

function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CHAVE, token);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a sessão vale só nesta visita */
  }
}

/**
 * Só nos perfis de demonstração: `#sessao=<token>` entrega a sessão pronta à moldura do pitch.
 * O perfil comum ignora o fragmento, para um link malicioso não trocar a sessão de ninguém.
 */
function adotarSessaoDaDemo() {
  const hash = window.location.hash.slice(1);
  if (!PERFIL || !hash.startsWith("sessao=")) return;
  guardarToken(hash.slice(7));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/** "sem_familia": a pessoa fez login, mas ainda não criou nem entrou em uma família. */
type Estado = { fase: "carregando" } | { fase: "fora" } | { fase: "sem_familia"; token: string; nome: string } | { fase: "dentro"; sessao: Sessao } | { fase: "sem_rede" };

const estadoDe = (token: string, dados: SessaoAtual): Estado =>
  "sem_familia" in dados ? { fase: "sem_familia", token, nome: dados.conta.nome } : { fase: "dentro", sessao: { ...dados, token } };

/** O token da sessão fica só neste aparelho. Ele vem de criar a família, aceitar um convite ou entrar com e-mail e senha. */
export function useSessao() {
  const [estado, setEstado] = useState<Estado>(() => {
    adotarSessaoDaDemo();
    return lerToken() ? { fase: "carregando" } : { fase: "fora" };
  });

  const carregar = useCallback(async () => {
    const token = lerToken();
    if (!token) return setEstado({ fase: "fora" });
    try {
      setEstado(estadoDe(token, await api.sessao(token)));
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        guardarToken(null);
        setEstado({ fase: "fora" });
      } else {
        setEstado({ fase: "sem_rede" });
      }
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const entrar = useCallback((aberta: SessaoAberta) => {
    guardarToken(aberta.token);
    setEstado(estadoDe(aberta.token, aberta));
  }, []);

  /** Apaga a sessão no servidor (se der) e neste aparelho. */
  const sair = useCallback(async () => {
    const token = lerToken();
    if (token) await api.sair(token).catch(() => {});
    guardarToken(null);
    setEstado({ fase: "fora" });
  }, []);

  return { estado, entrar, sair, recarregar: carregar };
}

export type SocketFamilia = Socket<EventosFamilia, Record<string, never>>;

/** Conexão com o namespace /familia. O servidor só emite; as ações vão pela API REST. */
export function useSocketFamilia(token: string, ouvir: (socket: SocketFamilia) => void) {
  useEffect(() => {
    const socket: SocketFamilia = io(`${BASE_API}/familia`, { auth: { token } });
    ouvir(socket);
    return () => {
      socket.close();
    };
    // `ouvir` registra os ouvintes uma vez por conexão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
