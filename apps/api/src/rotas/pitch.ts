import { timingSafeEqual } from "node:crypto";
import { EventoPitch, type SessaoPitch } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { ErroHttp, validar } from "../autenticacao.js";

/** O que as rotas do pitch mandam para os celulares e para o painel (namespace /pitch). */
export interface EmissorPitch {
  contador(sessaoId: string): void;
  revelar(sessaoId: string): void;
  reset(sessaoId: string): void;
}

export const emissorPitchMudo: EmissorPitch = { contador: () => {}, revelar: () => {}, reset: () => {} };

export async function contarPitch(prisma: PrismaClient, sessaoId: string): Promise<{ acessaram: number; confirmaram: number }> {
  const grupos = await prisma.pitchEvento.groupBy({ by: ["tipo"], where: { sessaoId }, _count: { _all: true } });
  const de = (tipo: "acessou" | "confirmou") => grupos.find((g) => g.tipo === tipo)?._count._all ?? 0;
  return { acessaram: de("acessou"), confirmaram: de("confirmou") };
}

/**
 * Golpe simulado do pitch. As rotas públicas não recebem nenhum dado pessoal: só um
 * identificador aleatório do visitante e se ele acessou ou confirmou.
 */
export const rotasPitch =
  (prisma: PrismaClient, emissor: EmissorPitch, tokenAdmin: string): FastifyPluginAsync =>
  async (app) => {
    function exigirAdmin(req: FastifyRequest) {
      const recebido = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const a = Buffer.from(recebido);
      const b = Buffer.from(tokenAdmin);
      // Sem ADMIN_TOKEN configurado, ninguém é admin.
      if (!tokenAdmin || a.length !== b.length || !timingSafeEqual(a, b)) throw new ErroHttp(401, "sem_permissao", "Só o apresentador pode fazer isso.");
    }

    async function resumo(id: string): Promise<SessaoPitch> {
      const sessao = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.pitchSessao.findUnique({ where: { id } }) : null;
      if (!sessao) throw new ErroHttp(404, "nao_encontrado", "Sessão não encontrada.");
      return { id: sessao.id, status: sessao.status, ...(await contarPitch(prisma, sessao.id)) };
    }

    app.post("/pitch/sessoes", async (req, res) => {
      exigirAdmin(req);
      const sessao = await prisma.pitchSessao.create({ data: {} });
      return res.status(201).send(await resumo(sessao.id));
    });

    /** Sessão mais recente: é o que deixa o link lido em voz alta ser curto (…/#pitch). */
    app.get("/pitch/sessoes/atual", async () => {
      const sessao = await prisma.pitchSessao.findFirst({ where: { status: { not: "encerrada" } }, orderBy: { criadoEm: "desc" } });
      if (!sessao) throw new ErroHttp(404, "nao_encontrado", "Nenhuma sessão aberta.");
      return resumo(sessao.id);
    });

    app.get<{ Params: { id: string } }>("/pitch/sessoes/:id", async (req) => resumo(req.params.id));

    app.post<{ Params: { id: string } }>(
      "/pitch/sessoes/:id/eventos",
      {
        config: {
          // 5 por minuto por visitante; a plateia inteira divide o mesmo IP, então o IP não serve de chave.
          rateLimit: {
            // preHandler: a chave vem do corpo, que só existe depois de lido.
            hook: "preHandler",
            max: 5,
            timeWindow: "1 minute",
            keyGenerator: (req) => `pitch:${String((req.body as { visitante_id?: unknown } | null)?.visitante_id ?? req.ip).slice(0, 64)}`,
          },
        },
      },
      async (req, res) => {
        const evento = validar(EventoPitch, req.body, "Evento inválido.");
        const sessao = await resumo(req.params.id);
        if (sessao.status !== "aberta") return res.status(202).send({ registrado: false });
        // Cada visitante conta uma vez por tipo; repetir o toque não infla o painel.
        const { count } = await prisma.pitchEvento.createMany({
          data: [{ sessaoId: sessao.id, visitanteId: evento.visitante_id, tipo: evento.tipo }],
          skipDuplicates: true,
        });
        if (count > 0) emissor.contador(sessao.id);
        return res.status(202).send({ registrado: count > 0 });
      },
    );

    app.post<{ Params: { id: string } }>("/pitch/sessoes/:id/revelar", async (req) => {
      exigirAdmin(req);
      await resumo(req.params.id);
      await prisma.pitchSessao.update({ where: { id: req.params.id }, data: { status: "revelada" } });
      emissor.revelar(req.params.id);
      return resumo(req.params.id);
    });

    app.post<{ Params: { id: string } }>("/pitch/sessoes/:id/reset", async (req) => {
      exigirAdmin(req);
      await resumo(req.params.id);
      await prisma.$transaction([
        prisma.pitchEvento.deleteMany({ where: { sessaoId: req.params.id } }),
        prisma.pitchSessao.update({ where: { id: req.params.id }, data: { status: "aberta" } }),
      ]);
      emissor.reset(req.params.id);
      return resumo(req.params.id);
    });
  };
