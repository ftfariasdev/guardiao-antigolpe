import type { Conta, Membro, PrismaClient } from "@prisma/client";
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

export function tokenDoPedido(req: FastifyRequest): string {
  const cabecalho = req.headers.authorization ?? "";
  return cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
}

/**
 * De quem é a sessão. A de convite aponta para o membro; a de login aponta para a conta,
 * e o membro é o da conta naquele momento (vazio enquanto ela não tem família).
 */
export async function donoDoToken(prisma: PrismaClient, token: string): Promise<{ membro: Membro | null; conta: Conta | null } | null> {
  const sessao = await prisma.sessao.findUnique({ where: { tokenHash: hashToken(token) }, include: { membro: true, conta: { include: { membro: true } } } });
  if (!sessao || (!sessao.membro && !sessao.conta)) return null;
  // Atualiza o último acesso sem segurar a resposta.
  void prisma.sessao.update({ where: { id: sessao.id }, data: { ultimoAcesso: new Date() } }).catch(() => {});
  return { membro: sessao.membro ?? sessao.conta?.membro ?? null, conta: sessao.conta };
}

export async function membroDoToken(prisma: PrismaClient, token: string): Promise<Membro | null> {
  return (await donoDoToken(prisma, token))?.membro ?? null;
}

/** preHandler: exige `Authorization: Bearer <token da sessão>`. */
export function exigirSessao(prisma: PrismaClient) {
  return async (req: FastifyRequest, _res: FastifyReply) => {
    const token = tokenDoPedido(req);
    const dono = token ? await donoDoToken(prisma, token) : null;
    if (!dono) throw new ErroHttp(401, "sessao_invalida", "Entre de novo com a sua conta ou pelo convite da família.");
    if (!dono.membro) throw new ErroHttp(403, "sem_familia", "Crie uma família ou entre em uma para continuar.");
    req.membro = dono.membro;
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
