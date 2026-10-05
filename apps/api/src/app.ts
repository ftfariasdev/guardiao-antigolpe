import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "./config.js";
import type { DependenciasMotor } from "./motor/index.js";
import { rotasAlertas } from "./rotas/alertas.js";
import { rotasAnalises } from "./rotas/analises.js";
import { rotasFamilias } from "./rotas/familias.js";
import { rotasPitch, type EmissorPitch } from "./rotas/pitch.js";
import { rotasSaude } from "./rotas/saude.js";
import { rotasTreinos } from "./rotas/treinos.js";
import type { Notificador } from "./tempo-real/notificador.js";

export interface Dependencias {
  config: Config;
  prisma: PrismaClient;
  motor: DependenciasMotor;
  notificador: Notificador;
  pitch: EmissorPitch;
}

export async function criarApp({ config, prisma, motor, notificador, pitch }: Dependencias): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      // Nunca registrar tokens, textos de mensagens nem dados pessoais.
      redact: ["req.headers.authorization", "req.body", "res.body"],
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS, methods: ["GET", "POST", "PUT", "PATCH"] });
  // Limite global generoso: a plateia do pitch divide o mesmo IP do Wi-Fi.
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });

  app.setErrorHandler<FastifyError>((erro, req, res) => {
    const status = erro.statusCode ?? 500;
    if (status >= 500) req.log.error({ erro: erro.message }, "erro interno");
    res.status(status).send({
      erro: {
        codigo: erro.code ?? (status >= 500 ? "erro_interno" : "requisicao_invalida"),
        mensagem: status >= 500 ? "Algo deu errado do nosso lado." : erro.message,
      },
    });
  });

  const verificarBanco = async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  };

  const v1 = { prefix: "/api/v1" };
  await app.register(rotasSaude(verificarBanco), v1);
  await app.register(rotasFamilias(prisma), v1);
  await app.register(rotasAnalises({ prisma, motor, notificador }), v1);
  await app.register(rotasAlertas(prisma, notificador), v1);
  await app.register(rotasTreinos(prisma, notificador), v1);
  await app.register(rotasPitch(prisma, pitch, config.ADMIN_TOKEN), v1);
  // Chave pública do Web Push: o app precisa dela para pedir a inscrição ao navegador.
  app.get("/api/v1/push/chave-publica", async () => ({ chave: config.VAPID_PUBLIC_KEY || null }));
  return app;
}
