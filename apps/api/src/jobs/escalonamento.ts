import type { PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import { escalarAlertasParados } from "../servicos/alertas.js";
import type { Notificador } from "../tempo-real/notificador.js";

const INTERVALO_MS = 30_000;

/** Verificador que roda a cada 30 s. Devolve a função que o desliga. */
export function iniciarEscalonamento(prisma: PrismaClient, notificador: Notificador, minutos: number, log: FastifyBaseLogger): () => void {
  let rodando = false;
  const relogio = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const escalados = await escalarAlertasParados(prisma, notificador, minutos);
      if (escalados > 0) log.info({ escalados }, "alertas escalados");
    } catch (erro) {
      log.error({ erro: (erro as Error).message }, "falha no escalonamento");
    } finally {
      rodando = false;
    }
  }, INTERVALO_MS);
  relogio.unref();
  return () => clearInterval(relogio);
}
