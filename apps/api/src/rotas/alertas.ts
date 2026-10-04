import { ResponderAlerta, type AlertaDetalhe } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { ErroHttp, exigirPapel, exigirSessao, validar } from "../autenticacao.js";
import { resultadoDaAnalise } from "../servicos/analises.js";
import { guardioesEmOrdem } from "../servicos/familia.js";
import type { Notificador } from "../tempo-real/notificador.js";

export const rotasAlertas =
  (prisma: PrismaClient, notificador: Notificador): FastifyPluginAsync =>
  async (app) => {
    const sessao = { preHandler: exigirSessao(prisma) };

    /** O alerta precisa ser do guardião que está chamando. */
    async function meuAlerta(req: FastifyRequest<{ Params: { id: string } }>) {
      exigirPapel(req, "guardiao");
      const alerta = await prisma.alerta.findUnique({
        where: { id: req.params.id },
        include: { membro: true, analise: { include: { protegido: true } } },
      });
      if (!alerta || alerta.membroId !== req.membro.id) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
      return alerta;
    }

    async function detalhar(alerta: Awaited<ReturnType<typeof meuAlerta>>): Promise<AlertaDetalhe> {
      const guardioes = await guardioesEmOrdem(prisma, alerta.analise.familiaId);
      const acionados = new Set((await prisma.alerta.findMany({ where: { analiseId: alerta.analiseId }, select: { membroId: true } })).map((a) => a.membroId));
      return {
        id: alerta.id,
        status: alerta.status,
        resposta: alerta.resposta,
        nivel: alerta.nivel,
        criado_em: alerta.criadoEm.toISOString(),
        protegido: { nome: alerta.analise.protegido.nome, parentesco: alerta.analise.protegido.parentesco },
        proximo_guardiao: guardioes.find((g) => !acionados.has(g.id))?.nome ?? null,
        valor: alerta.analise.valor,
        analise: resultadoDaAnalise(alerta.analise, alerta),
      };
    }

    /** Alertas deste guardião que ainda esperam resposta. */
    app.get("/alertas/pendentes", sessao, async (req) => {
      exigirPapel(req, "guardiao");
      const alertas = await prisma.alerta.findMany({
        where: { membroId: req.membro.id, status: { in: ["enviado", "visto"] } },
        orderBy: { criadoEm: "desc" },
        include: { membro: true, analise: { include: { protegido: true } } },
      });
      return { itens: await Promise.all(alertas.map(detalhar)) };
    });

    app.get<{ Params: { id: string } }>("/alertas/:id", sessao, async (req) => detalhar(await meuAlerta(req)));

    app.post<{ Params: { id: string } }>("/alertas/:id/visto", sessao, async (req) => {
      const alerta = await meuAlerta(req);
      // Só sai de "enviado"; visto não desfaz uma resposta nem ressuscita um alerta expirado.
      await prisma.alerta.updateMany({ where: { id: alerta.id, status: "enviado" }, data: { status: "visto" } });
      return detalhar(await meuAlerta(req));
    });

    app.post<{ Params: { id: string } }>("/alertas/:id/responder", sessao, async (req) => {
      const alerta = await meuAlerta(req);
      const { resposta } = validar(ResponderAlerta, req.body, "Responda era_golpe ou pode_seguir.");
      const { count } = await prisma.alerta.updateMany({
        where: { id: alerta.id, status: { not: "respondido" } },
        data: { status: "respondido", resposta, respondidoEm: new Date() },
      });
      if (count === 0) throw new ErroHttp(409, "ja_respondido", "Este alerta já foi respondido.");
      // Quem mais foi avisado da mesma análise não precisa mais responder.
      await prisma.alerta.updateMany({
        where: { analiseId: alerta.analiseId, id: { not: alerta.id }, status: { in: ["enviado", "visto"] } },
        data: { status: "expirado" },
      });
      notificador.alertaRespondido(alerta.analise.familiaId, { alerta_id: alerta.id, resposta, guardiao: req.membro.nome });
      return detalhar(await meuAlerta(req));
    });
  };
