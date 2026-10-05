import type { AddressInfo } from "node:net";
import type { AlertaNovo, ResultadoAnalise } from "@guardiao/shared";
import { io as conectar, type Socket } from "socket.io-client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../app.js";
import { chamar, config, criarFamilia, GOLPE, limparBanco, prisma } from "../teste/apoio.js";
import { emissorPitchMudo, type EmissorPitch } from "../rotas/pitch.js";
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
    treinoNovo: (p, d) => tempoReal.treinoNovo(p, d),
  };
  let pitchAoVivo: EmissorPitch = emissorPitchMudo;
  const repassePitch: EmissorPitch = { contador: (id) => pitchAoVivo.contador(id), revelar: (id) => pitchAoVivo.revelar(id), reset: (id) => pitchAoVivo.reset(id) };
  const app = await criarApp({ config, prisma, motor: { llm: null, timeoutLlmMs: 50 }, notificador: repasse, pitch: repassePitch });
  const socket = criarTempoReal(app.server, prisma, ["http://localhost:5173"], async () => {});
  tempoReal = socket.notificador;
  pitchAoVivo = socket.pitch;
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const url = `${base}/familia`;
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
  const entrarNoPitch = (sessao: string) =>
    new Promise<Socket>((resolver, rejeitar) => {
      const s = conectar(`${base}/pitch`, { auth: { sessao }, transports: ["websocket"], reconnection: false });
      abertos.push(s);
      s.once("connect", () => resolver(s));
      s.once("connect_error", rejeitar);
    });
  return { app, entrar, entrarNoPitch, fechar };
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

describe("golpe simulado do pitch (/pitch)", () => {
  const ADMIN = { authorization: "Bearer segredo-do-palco" };
  const evento = (app: Awaited<ReturnType<typeof subir>>["app"], sessao: string, visitante_id: string, tipo: string) =>
    app.inject({ method: "POST", url: `/api/v1/pitch/sessoes/${sessao}/eventos`, payload: { visitante_id, tipo } });

  it("só o apresentador abre, revela e zera a sessão", async () => {
    const { app, fechar } = await subir();
    expect((await app.inject({ method: "POST", url: "/api/v1/pitch/sessoes" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/v1/pitch/sessoes", headers: { authorization: "Bearer errado" } })).statusCode).toBe(401);
    const sessao = (await app.inject({ method: "POST", url: "/api/v1/pitch/sessoes", headers: ADMIN })).json() as { id: string };
    expect((await app.inject({ method: "POST", url: `/api/v1/pitch/sessoes/${sessao.id}/revelar` })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `/api/v1/pitch/sessoes/${sessao.id}/reset` })).statusCode).toBe(401);
    await fechar();
  });

  it("conta cada visitante uma vez, avisa o painel ao vivo e revela em todos os celulares", async () => {
    const { app, entrarNoPitch, fechar } = await subir();
    const sessao = (await app.inject({ method: "POST", url: "/api/v1/pitch/sessoes", headers: ADMIN })).json() as { id: string };
    const painel = await entrarNoPitch(sessao.id);
    const celular = await entrarNoPitch(sessao.id);
    const placares: { acessaram: number; confirmaram: number }[] = [];
    painel.on("pitch:contador", (p) => placares.push(p));

    // O link curto do slide 1 (…/#pitch) descobre a sessão por aqui.
    expect((await app.inject({ method: "GET", url: "/api/v1/pitch/sessoes/atual" })).json()).toMatchObject({ id: sessao.id, status: "aberta" });
    expect((await evento(app, sessao.id, "visitante-0001", "acessou")).json()).toEqual({ registrado: true });
    expect((await evento(app, sessao.id, "visitante-0001", "acessou")).json()).toEqual({ registrado: false });
    await evento(app, sessao.id, "visitante-0002", "acessou");
    await evento(app, sessao.id, "visitante-0002", "confirmou");
    await new Promise((r) => setTimeout(r, 400));
    expect(placares.at(-1)).toEqual({ acessaram: 2, confirmaram: 1 });

    // Nada além do identificador aleatório e do tipo é aceito ou guardado.
    expect((await evento(app, sessao.id, "João da Silva", "acessou")).statusCode).toBe(400);
    expect((await evento(app, sessao.id, "visitante-0003", "digitou_cpf")).statusCode).toBe(400);
    const gravado = await prisma.pitchEvento.findFirstOrThrow({ where: { sessaoId: sessao.id } });
    expect(Object.keys(gravado).sort()).toEqual(["criadoEm", "id", "sessaoId", "tipo", "visitanteId"]);

    const revelou = proximo(celular, "pitch:revelar");
    await app.inject({ method: "POST", url: `/api/v1/pitch/sessoes/${sessao.id}/revelar`, headers: ADMIN });
    await revelou;
    // Depois da revelação o placar congela, e quem chega atrasado já vê a revelação.
    expect((await evento(app, sessao.id, "visitante-0009", "acessou")).json()).toEqual({ registrado: false });
    const atrasado = await entrarNoPitch(sessao.id);
    await proximo(atrasado, "pitch:revelar");

    const zerou = proximo(celular, "pitch:reset");
    const zerado = await app.inject({ method: "POST", url: `/api/v1/pitch/sessoes/${sessao.id}/reset`, headers: ADMIN });
    await zerou;
    expect(zerado.json()).toMatchObject({ status: "aberta", acessaram: 0, confirmaram: 0 });
    await fechar();
  });

  it("limita a 5 eventos por minuto por visitante, sem travar os outros", async () => {
    const { app, fechar } = await subir();
    const sessao = (await app.inject({ method: "POST", url: "/api/v1/pitch/sessoes", headers: ADMIN })).json() as { id: string };
    const status: number[] = [];
    for (let i = 0; i < 6; i++) status.push((await evento(app, sessao.id, "visitante-insistente", "acessou")).statusCode);
    expect(status).toEqual([202, 202, 202, 202, 202, 429]);
    expect((await evento(app, sessao.id, "visitante-tranquilo", "acessou")).statusCode).toBe(202);
    await fechar();
  });
});
