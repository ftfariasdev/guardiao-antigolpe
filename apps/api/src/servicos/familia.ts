import type { DadosSessao, FamiliaResumo, MembroResumo } from "@guardiao/shared";
import type { Membro, PrismaClient } from "@prisma/client";

export const MAXIMO_GUARDIOES = 3;

export function resumoDoMembro(m: Membro): MembroResumo {
  return { id: m.id, nome: m.nome, parentesco: m.parentesco, papel: m.papel, ordem: m.ordem };
}

export async function resumoDaFamilia(prisma: PrismaClient, familiaId: string): Promise<FamiliaResumo> {
  const familia = await prisma.familia.findUniqueOrThrow({
    where: { id: familiaId },
    include: { membros: { orderBy: [{ papel: "asc" }, { ordem: "asc" }, { criadoEm: "asc" }] } },
  });
  const { _sum } = await prisma.treino.aggregate({ where: { familiaId }, _sum: { pontos: true } });
  return {
    id: familia.id,
    nome: familia.nome,
    tem_palavra_senha: familia.palavraSenhaHash !== null,
    escudos: _sum.pontos ?? 0,
    membros: familia.membros.map(resumoDoMembro),
  };
}

export async function dadosDaSessao(prisma: PrismaClient, membro: Membro): Promise<DadosSessao> {
  return { membro: resumoDoMembro(membro), familia: await resumoDaFamilia(prisma, membro.familiaId) };
}

/** Guardiões na ordem em que são acionados. */
export function guardioesEmOrdem(prisma: PrismaClient, familiaId: string): Promise<Membro[]> {
  return prisma.membro.findMany({ where: { familiaId, papel: "guardiao" }, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] });
}
