import { PedidoAnalise } from "@guardiao/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { ErroHttp, exigirPapel, exigirSessao, validar } from "../autenticacao.js";
import { analisar, type DependenciasMotor } from "../motor/index.js";
import { acionarPrimeiroGuardiao } from "../servicos/alertas.js";
import { resultadoDaAnalise } from "../servicos/analises.js";
import type { Notificador } from "../tempo-real/notificador.js";

interface Deps {
  prisma: PrismaClient;
  motor: DependenciasMotor;
  notificador: Notificador;
}

/** Por enquanto só texto (mensagem colada, link ou Pix copia e cola); print e áudio entram com OCR e transcrição. */
export const rotasAnalises =
  ({ prisma, motor, notificador }: Deps): FastifyPluginAsync =>
  async (app) => {
    const sessao = exigirSessao(prisma);

    app.post(
      "/analises",
      // 10 por minuto por sessão (a plateia do pitch divide o mesmo IP).
      { preHandler: sessao, config: { rateLimit: { max: 10, timeWindow: "1 minute", keyGenerator: (req) => req.headers.authorization ?? req.ip } } },
      async (req, res) => {
        exigirPapel(req, "protegido");
        const pedido = validar(PedidoAnalise, req.body, "Envie o texto da mensagem (até 5000 caracteres).");
        const { latencia_ms, falha_llm, valor, ...r } = await analisar(pedido, motor);

        // Grava só o resultado e os sinais; o texto da mensagem não vai para o banco.
        const analise = await prisma.analise.create({
          data: {
            familiaId: req.membro.familiaId,
            protegidoId: req.membro.id,
            tipoEntrada: pedido.tipo_entrada,
            risco: r.risco,
            tipoGolpe: r.tipo_golpe,
            titulo: r.titulo,
            valor,
            sinais: r.sinais,
            acao: r.acao,
            confianca: r.confianca,
            parcial: r.parcial,
            pix: r.pix ?? Prisma.JsonNull,
            latenciaMs: latencia_ms,
          },
        });
        const acionado = r.risco === "verde" ? null : await acionarPrimeiroGuardiao(prisma, notificador, analise, req.membro);
        req.log.info({ risco: r.risco, parcial: r.parcial, falha_llm, latencia_ms, alerta: acionado !== null }, "analise concluida");
        return res.send(resultadoDaAnalise(analise, acionado ? { ...acionado.alerta, membro: acionado.guardiao } : null));
      },
    );

    app.get<{ Params: { id: string } }>("/analises/:id", { preHandler: sessao }, async (req) => {
      const analise = await prisma.analise.findUnique({
        where: { id: req.params.id },
        include: { alertas: { orderBy: { criadoEm: "desc" }, take: 1, include: { membro: true } } },
      });
      if (!analise || analise.familiaId !== req.membro.familiaId) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
      return resultadoDaAnalise(analise, analise.alertas[0] ?? null);
    });
  };
