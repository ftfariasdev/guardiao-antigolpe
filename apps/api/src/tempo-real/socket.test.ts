import type { AddressInfo } from "node:net";
import type { AlertaNovo, ResultadoAnalise } from "@guardiao/shared";
import { io as conectar, type Socket } from "socket.io-client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../app.js";
import { chamar, config, criarFamilia, GOLPE, limparBanco, prisma } from "../teste/apoio.js";
import { notificadorMudo, type Notificador } from "./notificador.js";
import { criarTempoReal } from "./socket.js";

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

/** Sobe a API de verdade numa porta livre, com o Socket.IO ligado como em produção. */
async function subir() {
  let tempoReal: Notificador = notificadorMudo;
  const repasse: Notificador = {
    alertaNovo: (g, d) => tempoReal.alertaNovo(g, d),
    alertaRespondido: (f, d) => tempoReal.alertaRespondido(f, d),
    alertaEscalado: (f, d) => tempoReal.alertaEscalado(f, d),
  };
  const app = await criarApp({ config, prisma, motor: { llm: null, timeoutLlmMs: 50 }, notificador: repasse });
  const socket = criarTempoReal(app.server, prisma, ["http://localhost:5173"], async () => {});
  tempoReal = socket.notificador;
  await app.listen({ port: 0, host: "127.0.0.1" });
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/familia`;
  const abertos: Socket[] = [];
  const entrar = (token: string) =>
    new Promise<Socket>((resolver, rejeitar) => {
      const s = conectar(url, { auth: { token }, transports: ["websocket"], reconnection: false });
      abertos.push(s);
      s.once("connect", () => resolver(s));
      s.once("connect_error", rejeitar);
    });
  const fechar = async () => {
    abertos.forEach((s) => s.close());
    await socket.fechar();
    await app.close();
  };
  return { app, entrar, fechar };
}

const proximo = <T>(socket: Socket, evento: string) => new Promise<T>((resolver) => socket.once(evento, resolver));

describe("tempo real (/familia)", () => {
  it("recusa conexão sem token de sessão válido", async () => {
    const { entrar, fechar } = await subir();
    await expect(entrar("token-inventado")).rejects.toThrow(/sessao_invalida/);
    await fechar();
  });

  it("o guardião recebe alerta:novo e o protegido recebe alerta:respondido", async () => {
    const { app, entrar, fechar } = await subir();
    const { ana, cida, pedro } = await criarFamilia(app, { segundoGuardiao: true });
    const [socketAna, socketCida, socketPedro] = await Promise.all([entrar(ana.token), entrar(cida.token), entrar(pedro?.token as string)]);
    let pedroRecebeu = false;
    socketPedro.on("alerta:novo", () => (pedroRecebeu = true));

    const chegou = proximo<AlertaNovo>(socketAna, "alerta:novo");
    const analise = (await chamar(app, "POST", "/analises", cida.token, { texto: GOLPE })).json() as ResultadoAnalise;
    expect(await chegou).toMatchObject({ alerta_id: analise.alerta?.id, risco: "vermelho", protegido: "Dona Cida" });

    const destravou = proximo<{ resposta: string; guardiao: string }>(socketCida, "alerta:respondido");
    await chamar(app, "POST", `/alertas/${analise.alerta?.id}/responder`, ana.token, { resposta: "pode_seguir" });
    expect(await destravou).toMatchObject({ alerta_id: analise.alerta?.id, resposta: "pode_seguir", guardiao: "Ana" });
    // O alerta novo vai só para a sala do guardião acionado.
    expect(pedroRecebeu).toBe(false);
    await fechar();
  });
});
