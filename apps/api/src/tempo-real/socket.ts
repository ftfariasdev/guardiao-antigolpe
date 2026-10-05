import type { Server as ServidorHttp } from "node:http";
import type { EventosFamilia, EventosPitch } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import { membroDoToken } from "../autenticacao.js";
import { contarPitch, type EmissorPitch } from "../rotas/pitch.js";
import type { Notificador } from "./notificador.js";
import type { EnviarPush } from "./push.js";

/**
 * Socket.IO: o servidor só emite; toda ação do usuário entra pela API REST.
 * Namespace /familia, autenticado pelo token da sessão, com salas familia:{id} e membro:{id}.
 */
export function criarTempoReal(http: ServidorHttp, prisma: PrismaClient, origens: string[], push: EnviarPush): { notificador: Notificador; pitch: EmissorPitch; fechar: () => Promise<void> } {
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
    treinoNovo(protegidoId, dados) {
      ns.to(`membro:${protegidoId}`).emit("treino:novo", dados);
    },
  };
  /* ---------- /pitch: público, uma sala por sessão ---------- */
  const nsPitch = io.of("/pitch") as unknown as import("socket.io").Namespace<Record<string, never>, EventosPitch>;
  const LOTE_MS = 250;
  const pendentes = new Map<string, NodeJS.Timeout>();

  nsPitch.on("connection", async (socket) => {
    // A sessão vem em `auth`, que é de cada conexão. A query é da conexão física, que o cliente
    // divide entre namespaces: num app que abre /pitch e /familia juntos ela se perderia.
    const informada = socket.handshake.auth.sessao ?? socket.handshake.query.sessao;
    const sessaoId = typeof informada === "string" ? informada : "";
    if (!/^[0-9a-f-]{36}$/i.test(sessaoId)) return socket.disconnect(true);
    await socket.join(`pitch:${sessaoId}`);
    // Quem chega depois já recebe o placar e, se for o caso, a revelação.
    const sessao = await prisma.pitchSessao.findUnique({ where: { id: sessaoId } }).catch(() => null);
    if (!sessao) return socket.disconnect(true);
    socket.emit("pitch:contador", await contarPitch(prisma, sessaoId));
    if (sessao.status === "revelada") socket.emit("pitch:revelar");
  });

  const pitch: EmissorPitch = {
    // Agrupa em lotes de 250 ms: 300 toques quase juntos viram poucas atualizações do painel.
    contador(sessaoId) {
      if (pendentes.has(sessaoId)) return;
      pendentes.set(
        sessaoId,
        setTimeout(async () => {
          pendentes.delete(sessaoId);
          const placar = await contarPitch(prisma, sessaoId).catch(() => null);
          if (placar) nsPitch.to(`pitch:${sessaoId}`).emit("pitch:contador", placar);
        }, LOTE_MS),
      );
    },
    revelar(sessaoId) {
      nsPitch.to(`pitch:${sessaoId}`).emit("pitch:revelar");
    },
    reset(sessaoId) {
      nsPitch.to(`pitch:${sessaoId}`).emit("pitch:reset");
      nsPitch.to(`pitch:${sessaoId}`).emit("pitch:contador", { acessaram: 0, confirmaram: 0 });
    },
  };

  return {
    notificador,
    pitch,
    fechar: async () => {
      pendentes.forEach((relogio) => clearTimeout(relogio));
      await io.close();
    },
  };
}
