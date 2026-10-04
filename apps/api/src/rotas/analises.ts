import { randomUUID } from "node:crypto";
import { PedidoAnalise, type ResultadoAnalise } from "@guardiao/shared";
import type { FastifyPluginAsync } from "fastify";
import { analisar, type DependenciasMotor } from "../motor/index.js";

/**
 * POST /analises. Versão do D3: só texto, sem sessão e sem gravar no banco.
 * Família, alerta ao guardião e histórico entram no D4; print e áudio, com OCR e transcrição.
 */
export const rotasAnalises =
  (motor: DependenciasMotor): FastifyPluginAsync =>
  async (app) => {
    app.post("/analises", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, res) => {
      const pedido = PedidoAnalise.safeParse(req.body);
      if (!pedido.success) {
        return res.status(400).send({ erro: { codigo: "requisicao_invalida", mensagem: "Envie o texto da mensagem (até 5000 caracteres)." } });
      }
      const { latencia_ms, falha_llm, ...resultado } = await analisar(pedido.data, motor);
      // Só métricas no log; o conteúdo da mensagem nunca é registrado.
      req.log.info({ risco: resultado.risco, parcial: resultado.parcial, falha_llm, latencia_ms }, "analise concluida");
      const corpo: ResultadoAnalise = { id: randomUUID(), ...resultado, alerta: null };
      return res.send(corpo);
    });
  };
