import { Sinal, type DadosPix, type ResultadoAnalise } from "@guardiao/shared";
import type { Alerta, Analise, Membro } from "@prisma/client";
import { z } from "zod";

/** Reconstrói o contrato ResultadoAnalise a partir do que ficou gravado (resultado e sinais, nunca a mensagem). */
export function resultadoDaAnalise(analise: Analise, alerta: (Alerta & { membro: Membro }) | null): ResultadoAnalise {
  const sinais = z.array(Sinal).catch([]).parse(analise.sinais);
  return {
    id: analise.id,
    risco: analise.risco,
    tipo_golpe: analise.tipoGolpe,
    titulo: analise.titulo,
    sinais,
    acao: analise.acao,
    sugerir_palavra_senha: analise.tipoGolpe === "falso_parente" || sinais.some((s) => s.codigo === "troca_numero"),
    confianca: analise.confianca,
    parcial: analise.parcial,
    pix: (analise.pix as DadosPix | null) ?? null,
    alerta: alerta ? { id: alerta.id, status: alerta.status, guardiao: alerta.membro.nome, resposta: alerta.resposta } : null,
  };
}
