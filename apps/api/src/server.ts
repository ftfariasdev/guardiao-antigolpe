import { PrismaClient } from "@prisma/client";
import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";
import { iniciarEscalonamento } from "./jobs/escalonamento.js";
import { criarProvedorAnthropic } from "./motor/llm/anthropic.js";
import { notificadorMudo, type Notificador } from "./tempo-real/notificador.js";
import { criarPush } from "./tempo-real/push.js";
import { criarTempoReal } from "./tempo-real/socket.js";

const config = lerConfig();
const prisma = new PrismaClient();

// Sem chave, o motor responde só com as regras e toda análise sai como parcial (nunca verde).
const llm = config.ANTHROPIC_API_KEY
  ? criarProvedorAnthropic({ apiKey: config.ANTHROPIC_API_KEY, modelo: config.LLM_MODEL, timeoutMs: config.LLM_TIMEOUT_MS })
  : null;

// O Socket.IO precisa do servidor HTTP, que só existe depois do app; até lá as rotas falam com este repasse.
let tempoReal: Notificador = notificadorMudo;
const notificador: Notificador = {
  alertaNovo: (guardiaoId, dados) => tempoReal.alertaNovo(guardiaoId, dados),
  alertaRespondido: (familiaId, dados) => tempoReal.alertaRespondido(familiaId, dados),
  alertaEscalado: (familiaId, dados) => tempoReal.alertaEscalado(familiaId, dados),
};

const app = await criarApp({ config, prisma, motor: { llm, timeoutLlmMs: config.LLM_TIMEOUT_MS }, notificador });

const vapid =
  config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY
    ? { publica: config.VAPID_PUBLIC_KEY, privada: config.VAPID_PRIVATE_KEY, assunto: config.VAPID_SUBJECT }
    : null;
const socket = criarTempoReal(app.server, prisma, config.CORS_ORIGINS, criarPush(prisma, vapid));
tempoReal = socket.notificador;
const pararEscalonamento = iniciarEscalonamento(prisma, notificador, config.ESCALONAMENTO_MIN, app.log);

await app.listen({ port: config.PORT, host: "0.0.0.0" });

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    pararEscalonamento();
    await socket.fechar();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
