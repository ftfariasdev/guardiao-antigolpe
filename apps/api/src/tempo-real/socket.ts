import type { Server as ServidorHttp } from "node:http";
import type { EventosFamilia } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import { membroDoToken } from "../autenticacao.js";
import type { Notificador } from "./notificador.js";
import type { EnviarPush } from "./push.js";

/**
 * Socket.IO: o servidor só emite; toda ação do usuário entra pela API REST.
 * Namespace /familia, autenticado pelo token da sessão, com salas familia:{id} e membro:{id}.
 */
export function criarTempoReal(http: ServidorHttp, prisma: PrismaClient, origens: string[], push: EnviarPush): { notificador: Notificador; fechar: () => Promise<void> } {
  const io = new Server<Record<string, never>, EventosFamilia>(http, { cors: { origin: origens } });
  const ns = io.of("/familia");

  ns.use(async (socket, proximo) => {
    const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
    const membro = token ? await membroDoToken(prisma, token).catch(() => null) : null;
    if (!membro) return proximo(new Error("sessao_invalida"));
    await socket.join([`familia:${membro.familiaId}`, `membro:${membro.id}`]);
    proximo();
  });

  const notificador: Notificador = {
    async alertaNovo(guardiaoId, dados) {
      ns.to(`membro:${guardiaoId}`).emit("alerta:novo", dados);
      await push(guardiaoId, dados);
    },
    alertaRespondido(familiaId, dados) {
      ns.to(`familia:${familiaId}`).emit("alerta:respondido", dados);
    },
    alertaEscalado(familiaId, dados) {
      ns.to(`familia:${familiaId}`).emit("alerta:escalado", dados);
    },
  };
  return { notificador, fechar: () => io.close() };
}
