import type { AlertaNovo, NivelRisco, TipoGolpe } from "@guardiao/shared";
import type { Alerta, Analise, Membro, PrismaClient } from "@prisma/client";
import type { Notificador } from "../tempo-real/notificador.js";
import { guardioesEmOrdem } from "./familia.js";

const NOMES_DO_GOLPE: Record<TipoGolpe, string> = {
  falso_parente: "falso parente",
  falsa_central: "falsa central",
  falso_boleto: "cobrança falsa",
  falso_emprego: "falso emprego",
  falso_motoboy: "falso motoboy",
  link_falso: "link falso",
  falso_investimento: "falso investimento",
  compra_falsa: "compra falsa",
  outro: "possível golpe",
  nenhum: "mensagem suspeita",
};

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Frase curta do alerta. Não leva trecho da mensagem: só o tipo do golpe e o valor. */
export function resumoDoAlerta(protegido: string, risco: NivelRisco, tipo: TipoGolpe, valor: number | null): string {
  const oQue = risco === "vermelho" ? `um provável golpe de ${NOMES_DO_GOLPE[tipo]}` : "uma mensagem que merece conferência";
  return `${protegido} recebeu ${oQue}${valor ? ` de ${MOEDA.format(valor).replace(/\u00a0/g, " ")}` : ""}.`;
}

function eventoDoAlerta(alerta: Alerta, analise: Analise, protegido: Membro): AlertaNovo {
  return {
    alerta_id: alerta.id,
    risco: analise.risco,
    tipo_golpe: analise.tipoGolpe,
    resumo: resumoDoAlerta(protegido.nome, analise.risco, analise.tipoGolpe, analise.valor),
    valor: analise.valor,
    protegido: protegido.nome,
  };
}

/** Aciona o primeiro guardião para uma análise amarela ou vermelha. */
export async function acionarPrimeiroGuardiao(
  prisma: PrismaClient,
  notificador: Notificador,
  analise: Analise,
  protegido: Membro,
): Promise<{ alerta: Alerta; guardiao: Membro } | null> {
  const [guardiao] = await guardioesEmOrdem(prisma, analise.familiaId);
  if (!guardiao) return null;
  const alerta = await prisma.alerta.create({ data: { analiseId: analise.id, membroId: guardiao.id, nivel: 1 } });
  await notificador.alertaNovo(guardiao.id, eventoDoAlerta(alerta, analise, protegido));
  return { alerta, guardiao };
}

/**
 * Escala os alertas sem resposta: quem ficou `enviado` por mais de `minutos` expira e o
 * próximo guardião da ordem é acionado. Consulta o banco, então sobrevive a um reinício da API.
 */
export async function escalarAlertasParados(prisma: PrismaClient, notificador: Notificador, minutos: number, agora = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - minutos * 60_000);
  const parados = await prisma.alerta.findMany({
    where: { status: "enviado", criadoEm: { lt: limite } },
    include: { analise: { include: { protegido: true } } },
  });
  let escalados = 0;
  for (const parado of parados) {
    const guardioes = await guardioesEmOrdem(prisma, parado.analise.familiaId);
    const jaAcionados = new Set((await prisma.alerta.findMany({ where: { analiseId: parado.analiseId }, select: { membroId: true } })).map((a) => a.membroId));
    const proximo = guardioes.find((g) => !jaAcionados.has(g.id));
    // Sem próximo guardião o alerta continua aberto com quem já foi avisado.
    if (!proximo) continue;
    // A troca de status é condicional: se o guardião respondeu neste meio-tempo, não escala.
    const { count } = await prisma.alerta.updateMany({ where: { id: parado.id, status: "enviado" }, data: { status: "expirado" } });
    if (count === 0) continue;
    const novo = await prisma.alerta.create({ data: { analiseId: parado.analiseId, membroId: proximo.id, nivel: parado.nivel + 1 } });
    notificador.alertaEscalado(parado.analise.familiaId, { alerta_id: novo.id, proximo_guardiao: proximo.nome });
    await notificador.alertaNovo(proximo.id, eventoDoAlerta(novo, parado.analise, parado.analise.protegido));
    escalados++;
  }
  return escalados;
}
