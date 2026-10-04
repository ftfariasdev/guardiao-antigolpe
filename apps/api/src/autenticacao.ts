import type { Membro, PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { hashToken } from "./seguranca.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Preenchido por `exigirSessao`. */
    membro: Membro;
  }
}

export class ErroHttp extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function membroDoToken(prisma: PrismaClient, token: string): Promise<Membro | null> {
  const sessao = await prisma.sessao.findUnique({ where: { tokenHash: hashToken(token) }, include: { membro: true } });
  if (!sessao) return null;
  // Atualiza o último acesso sem segurar a resposta.
  void prisma.sessao.update({ where: { id: sessao.id }, data: { ultimoAcesso: new Date() } }).catch(() => {});
  return sessao.membro;
}

/** preHandler: exige `Authorization: Bearer <token da sessão>`. */
export function exigirSessao(prisma: PrismaClient) {
  return async (req: FastifyRequest, _res: FastifyReply) => {
    const cabecalho = req.headers.authorization ?? "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    const membro = token ? await membroDoToken(prisma, token) : null;
    if (!membro) throw new ErroHttp(401, "sessao_invalida", "Entre de novo pelo convite da família.");
    req.membro = membro;
  };
}

export function exigirPapel(req: FastifyRequest, papel: Membro["papel"]) {
  if (req.membro.papel !== papel) {
    throw new ErroHttp(403, "sem_permissao", papel === "guardiao" ? "Só um guardião pode fazer isso." : "Só a pessoa protegida pode fazer isso.");
  }
}

export function exigirFamilia(req: FastifyRequest, familiaId: string) {
  if (req.membro.familiaId !== familiaId) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
}

/** Valida com Zod e devolve 400 no formato de erro da API. */
export function validar<T>(esquema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, valor: unknown, mensagem: string): T {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new ErroHttp(400, "requisicao_invalida", mensagem);
  return r.data;
}
