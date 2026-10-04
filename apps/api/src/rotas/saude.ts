import type { FastifyPluginAsync } from "fastify";

export type VerificarBanco = () => Promise<boolean>;

export const rotasSaude =
  (verificarBanco: VerificarBanco): FastifyPluginAsync =>
  async (app) => {
    app.get("/saude", async (_req, res) => {
      const banco = await verificarBanco().catch(() => false);
      res.status(banco ? 200 : 503).send({
        ok: banco,
        banco: banco ? "ok" : "erro",
        horario: new Date().toISOString(),
      });
    });
  };
