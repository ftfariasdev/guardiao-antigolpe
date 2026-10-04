import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "./config.js";
import { rotasSaude, type VerificarBanco } from "./rotas/saude.js";

export interface Dependencias {
  config: Config;
  verificarBanco: VerificarBanco;
}

export async function criarApp({ config, verificarBanco }: Dependencias): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      // Nunca registrar tokens, textos de mensagens nem dados pessoais.
      redact: ["req.headers.authorization", "req.body", "res.body"],
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS });
  // Limite global generoso: a plateia do pitch divide o mesmo IP do Wi-Fi.
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });

  app.setErrorHandler<FastifyError>((erro, _req, res) => {
    const status = erro.statusCode ?? 500;
    res.status(status).send({
      erro: {
        codigo: erro.code ?? (status >= 500 ? "erro_interno" : "requisicao_invalida"),
        mensagem: status >= 500 ? "Algo deu errado do nosso lado." : erro.message,
      },
    });
  });

  await app.register(rotasSaude(verificarBanco), { prefix: "/api/v1" });
  return app;
}
