import type { DadosSessao, EventosFamilia, SessaoCriada } from "@guardiao/shared";
import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, BASE_API, ErroApi } from "./api";

const CHAVE = "guardiao:sessao";

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

type Estado = { fase: "carregando" } | { fase: "fora" } | { fase: "dentro"; sessao: Sessao } | { fase: "sem_rede" };

/** Autenticação sem senha: o token da sessão fica só neste aparelho. */
export function useSessao() {
  const [estado, setEstado] = useState<Estado>(() => (lerToken() ? { fase: "carregando" } : { fase: "fora" }));

  const carregar = useCallback(async () => {
    const token = lerToken();
    if (!token) return setEstado({ fase: "fora" });
    try {
      setEstado({ fase: "dentro", sessao: { token, ...(await api.sessao(token)) } });
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

  const entrar = useCallback((criada: SessaoCriada) => {
    guardarToken(criada.token);
    setEstado({ fase: "dentro", sessao: criada });
  }, []);

  return { estado, entrar, recarregar: carregar };
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
