import type { AlertaNovo } from "@guardiao/shared";
import { InscricaoPush } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import webpush from "web-push";

export interface ChavesVapid {
  publica: string;
  privada: string;
  assunto: string;
}

/** Validade do push: depois de 5 min o alerta já escalou. */
const VALIDADE_S = 300;

export type EnviarPush = (guardiaoId: string, dados: AlertaNovo) => Promise<void>;

/**
 * Web Push com VAPID. Sem chaves configuradas devolve um envio que não faz nada,
 * e o alerta segue só pelo Socket.IO.
 */
export function criarPush(prisma: PrismaClient, chaves: ChavesVapid | null, enviar = webpush.sendNotification.bind(webpush)): EnviarPush {
  if (!chaves) return async () => {};
  const opcoes = { vapidDetails: { subject: chaves.assunto, publicKey: chaves.publica, privateKey: chaves.privada }, TTL: VALIDADE_S, urgency: "high" as const };

  return async (guardiaoId, dados) => {
    const membro = await prisma.membro.findUnique({ where: { id: guardiaoId }, select: { pushSubscription: true } });
    const inscricao = InscricaoPush.safeParse(membro?.pushSubscription);
    if (!inscricao.success) return;
    // Texto curto, sem trecho da mensagem; o toque abre o alerta.
    const corpo = JSON.stringify({ titulo: "Alerta da família", corpo: dados.resumo, url: `/#alerta=${dados.alerta_id}`, alerta_id: dados.alerta_id });
    try {
      await enviar(inscricao.data, corpo, opcoes);
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      // Inscrição expirada ou cancelada: apaga, e o alerta segue só pelo Socket.IO.
      if (status === 404 || status === 410) {
        await prisma.membro.update({ where: { id: guardiaoId }, data: { pushSubscription: Prisma.DbNull } });
      }
    }
  };
}
