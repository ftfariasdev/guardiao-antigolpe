import type { AlertaNovo, SessaoCriada } from "@guardiao/shared";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { emissorPitchMudo } from "../rotas/pitch.js";
import { criarApp } from "../app.js";
import { lerConfig } from "../config.js";
import type { DependenciasMotor } from "../motor/index.js";
import type { Notificador } from "../tempo-real/notificador.js";
import { URL_BANCO_TESTE } from "./preparar-banco.js";

export const prisma = new PrismaClient({ datasources: { db: { url: URL_BANCO_TESTE } } });
export const config = lerConfig({ NODE_ENV: "test", DATABASE_URL: URL_BANCO_TESTE, ADMIN_TOKEN: "segredo-do-palco" });

export async function limparBanco() {
  await prisma.$executeRawUnsafe('TRUNCATE "familias", "pitch_sessoes" CASCADE');
}

/** Notificador que só anota o que seria enviado. */
export function notificadorEspiao() {
  const novos: { guardiaoId: string; dados: AlertaNovo }[] = [];
  const respondidos: { familiaId: string; dados: Parameters<Notificador["alertaRespondido"]>[1] }[] = [];
  const escalados: { familiaId: string; dados: Parameters<Notificador["alertaEscalado"]>[1] }[] = [];
  const treinos: { protegidoId: string; dados: { treino_id: string; conteudo: string } }[] = [];
  const notificador: Notificador = {
    alertaNovo: async (guardiaoId, dados) => void novos.push({ guardiaoId, dados }),
    alertaRespondido: (familiaId, dados) => void respondidos.push({ familiaId, dados }),
    alertaEscalado: (familiaId, dados) => void escalados.push({ familiaId, dados }),
    treinoNovo: (protegidoId, dados) => void treinos.push({ protegidoId, dados }),
  };
  return { notificador, novos, respondidos, escalados, treinos };
}

export async function montar(motor: DependenciasMotor = { llm: null, timeoutLlmMs: 50 }) {
  const espiao = notificadorEspiao();
  const app = await criarApp({ config, prisma, motor, notificador: espiao.notificador, pitch: emissorPitchMudo });
  return { app, ...espiao };
}

export function chamar(app: FastifyInstance, metodo: "GET" | "POST" | "PUT" | "PATCH", url: string, token?: string, payload?: object) {
  return app.inject({ method: metodo, url: `/api/v1${url}`, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
}

/** Família pronta: Ana (guardiã), Dona Cida (protegida) e, se pedido, Pedro (2º guardião). */
export async function criarFamilia(app: FastifyInstance, { segundoGuardiao = false } = {}) {
  const ana = (await chamar(app, "POST", "/familias", undefined, { nome_familia: "Família Silva", nome: "Ana", parentesco: "filha" })).json() as SessaoCriada;
  const entrar = async (papel: "protegido" | "guardiao", nome: string, parentesco: string) => {
    const convite = (await chamar(app, "POST", `/familias/${ana.familia.id}/convites`, ana.token, { papel })).json() as { token: string };
    return (await chamar(app, "POST", `/convites/${convite.token}/aceitar`, undefined, { nome, parentesco })).json() as SessaoCriada;
  };
  const cida = await entrar("protegido", "Dona Cida", "mãe");
  const pedro = segundoGuardiao ? await entrar("guardiao", "Pedro", "neto") : null;
  return { ana, cida, pedro, familiaId: ana.familia.id };
}

export const GOLPE = "Oi mãe, mudei de número. Faz um Pix de R$ 1.800 pra mim hoje? Não conta pro pai.";
