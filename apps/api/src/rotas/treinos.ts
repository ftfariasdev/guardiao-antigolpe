import { EnviarTreino, RegistrarResultadoTreino, type TreinoDetalhe } from "@guardiao/shared";
import type { Membro, PrismaClient, Treino } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { ErroHttp, exigirPapel, exigirSessao, validar } from "../autenticacao.js";
import type { Notificador } from "../tempo-real/notificador.js";
import { modeloPorId, MODELOS_TREINO, PONTOS_POR_ENCAMINHAR } from "../treinos/modelos.js";

function detalhar(treino: Treino & { enviadoPor: Membro }): TreinoDetalhe {
  const modelo = modeloPorId(treino.modelo);
  return {
    id: treino.id,
    modelo: treino.modelo,
    titulo: modelo?.titulo ?? "Treino",
    conteudo: modelo?.conteudo ?? "",
    licao: modelo?.licao ?? "",
    resultado: treino.resultado,
    pontos: treino.pontos,
    enviado_por: treino.enviadoPor.nome,
    criado_em: treino.criadoEm.toISOString(),
  };
}

/** Treino ("vacina"): golpes simulados só dentro do app, nunca por SMS ou WhatsApp reais. */
export const rotasTreinos =
  (prisma: PrismaClient, notificador: Notificador): FastifyPluginAsync =>
  async (app) => {
    const sessao = { preHandler: exigirSessao(prisma) };

    app.get("/treinos/modelos", sessao, async (req) => {
      exigirPapel(req, "guardiao");
      return { itens: MODELOS_TREINO };
    });

    app.post("/treinos", sessao, async (req, res) => {
      exigirPapel(req, "guardiao");
      const { modelo } = validar(EnviarTreino, req.body, "Escolha um treino.");
      if (!modeloPorId(modelo)) throw new ErroHttp(400, "requisicao_invalida", "Esse treino não existe.");
      const protegido = await prisma.membro.findFirst({ where: { familiaId: req.membro.familiaId, papel: "protegido" } });
      if (!protegido) throw new ErroHttp(409, "sem_protegido", "Convide a pessoa protegida antes de enviar um treino.");
      const treino = await prisma.treino.create({
        data: { familiaId: req.membro.familiaId, enviadoPorId: req.membro.id, modelo },
        include: { enviadoPor: true },
      });
      const detalhe = detalhar(treino);
      notificador.treinoNovo(protegido.id, { treino_id: treino.id, conteudo: detalhe.conteudo });
      return res.status(201).send(detalhe);
    });

    /** Últimos treinos da família; o protegido usa para achar o que está pendente. */
    app.get("/treinos", sessao, async (req) => {
      const treinos = await prisma.treino.findMany({
        where: { familiaId: req.membro.familiaId },
        orderBy: { criadoEm: "desc" },
        take: 10,
        include: { enviadoPor: true },
      });
      return { itens: treinos.map(detalhar) };
    });

    app.post<{ Params: { id: string } }>("/treinos/:id/resultado", sessao, async (req) => {
      exigirPapel(req, "protegido");
      const { resultado } = validar(RegistrarResultadoTreino, req.body, "Informe encaminhou, caiu ou ignorou.");
      const treino = await prisma.treino.findUnique({ where: { id: req.params.id } });
      if (!treino || treino.familiaId !== req.membro.familiaId) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
      // Cada treino vale uma vez: só registra se ainda estiver pendente.
      const { count } = await prisma.treino.updateMany({
        where: { id: treino.id, resultado: "pendente" },
        data: { resultado, pontos: resultado === "encaminhou" ? PONTOS_POR_ENCAMINHAR : 0 },
      });
      if (count === 0) throw new ErroHttp(409, "ja_registrado", "Este treino já foi respondido.");
      return detalhar(await prisma.treino.findUniqueOrThrow({ where: { id: treino.id }, include: { enviadoPor: true } }));
    });
  };
