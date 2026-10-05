import { createHash } from "node:crypto";
import { AlertaDetalhe, DadosSessao, ResultadoAnalise, type SaidaLLM } from "@guardiao/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { emissorPitchMudo } from "./rotas/pitch.js";
import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";
import { escalarAlertasParados } from "./servicos/alertas.js";
import { chamar, config, criarFamilia, GOLPE, limparBanco, montar, notificadorEspiao, prisma } from "./teste/apoio.js";
import { notificadorMudo } from "./tempo-real/notificador.js";
import { criarPush } from "./tempo-real/push.js";

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

describe("GET /api/v1/saude", () => {
  it("responde 200 quando o banco está de pé", async () => {
    const { app } = await montar();
    const r = await chamar(app, "GET", "/saude");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, banco: "ok" });
  });

  it("responde 503 quando o banco não responde", async () => {
    const semBanco = { $queryRaw: () => Promise.reject(new Error("fora")) } as unknown as PrismaClient;
    const app = await criarApp({ config, prisma: semBanco, motor: { llm: null, timeoutLlmMs: 50 }, notificador: notificadorMudo, pitch: emissorPitchMudo });
    const r = await chamar(app, "GET", "/saude");
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ ok: false, banco: "erro" });
  });
});

describe("lerConfig", () => {
  it("falha sem DATABASE_URL", () => {
    expect(() => lerConfig({})).toThrow(/DATABASE_URL/);
  });
});

describe("família, sessão e convites", () => {
  it("criar a família devolve o token uma vez e guarda só o SHA-256 dele", async () => {
    const { app } = await montar();
    const { ana } = await criarFamilia(app);
    expect(ana.membro).toMatchObject({ nome: "Ana", papel: "guardiao", ordem: 1 });
    const sessoes = await prisma.sessao.findMany({ where: { membroId: ana.membro.id } });
    expect(sessoes.map((s) => s.tokenHash)).toEqual([sha256(ana.token)]);
    expect(JSON.stringify(sessoes)).not.toContain(ana.token);
  });

  it("a sessão devolve a família com os membros na ordem de aviso", async () => {
    const { app } = await montar();
    const { cida } = await criarFamilia(app, { segundoGuardiao: true });
    const sessao = DadosSessao.parse((await chamar(app, "GET", "/sessao", cida.token)).json());
    expect(sessao.membro).toMatchObject({ nome: "Dona Cida", papel: "protegido" });
    expect(sessao.familia.membros.filter((m) => m.papel === "guardiao").map((m) => [m.nome, m.ordem])).toEqual([["Ana", 1], ["Pedro", 2]]);
  });

  it("sem token ou com token inventado a resposta é 401", async () => {
    const { app } = await montar();
    expect((await chamar(app, "GET", "/sessao")).statusCode).toBe(401);
    expect((await chamar(app, "GET", "/sessao", "token-inventado")).statusCode).toBe(401);
    expect((await chamar(app, "POST", "/analises", "token-inventado", { texto: "oi" })).json()).toMatchObject({ erro: { codigo: "sessao_invalida" } });
  });

  it("o convite é guardado como hash, vale uma vez só e vence em 24 h", async () => {
    const { app } = await montar();
    const { ana, familiaId } = await criarFamilia(app);
    const convite = (await chamar(app, "POST", `/familias/${familiaId}/convites`, ana.token, { papel: "guardiao" })).json() as { token: string; expira_em: string };
    const gravado = await prisma.convite.findUniqueOrThrow({ where: { tokenHash: sha256(convite.token) } });
    expect(new Date(convite.expira_em).getTime() - Date.now()).toBeGreaterThan(23.9 * 3_600_000);

    expect((await chamar(app, "POST", `/convites/${convite.token}/aceitar`, undefined, { nome: "Pedro" })).statusCode).toBe(201);
    const deNovo = await chamar(app, "POST", `/convites/${convite.token}/aceitar`, undefined, { nome: "Intruso" });
    expect(deNovo.statusCode).toBe(410);
    expect(deNovo.json()).toMatchObject({ erro: { codigo: "convite_invalido" } });

    const vencido = (await chamar(app, "POST", `/familias/${familiaId}/convites`, ana.token, { papel: "guardiao" })).json() as { token: string };
    await prisma.convite.update({ where: { tokenHash: sha256(vencido.token) }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await chamar(app, "POST", `/convites/${vencido.token}/aceitar`, undefined, { nome: "Atrasado" })).statusCode).toBe(410);
    expect(gravado.usadoEm).toBeNull();
  });

  it("só guardião convida, e a família tem no máximo 1 protegido", async () => {
    const { app } = await montar();
    const { ana, cida, familiaId } = await criarFamilia(app);
    expect((await chamar(app, "POST", `/familias/${familiaId}/convites`, cida.token, { papel: "guardiao" })).statusCode).toBe(403);
    const segundo = await chamar(app, "POST", `/familias/${familiaId}/convites`, ana.token, { papel: "protegido" });
    expect(segundo.statusCode).toBe(409);
  });

  it("a palavra-senha é guardada com argon2id e nunca volta em nenhuma resposta", async () => {
    const { app } = await montar();
    const { ana, cida, familiaId } = await criarFamilia(app);
    expect((await chamar(app, "PUT", `/familias/${familiaId}/palavra-senha`, cida.token, { palavra: "goiabada" })).statusCode).toBe(403);
    expect((await chamar(app, "PUT", `/familias/${familiaId}/palavra-senha`, ana.token, { palavra: "goiabada" })).statusCode).toBe(204);
    const familia = await prisma.familia.findUniqueOrThrow({ where: { id: familiaId } });
    expect(familia.palavraSenhaHash).toMatch(/^\$argon2id\$/);
    const sessao = (await chamar(app, "GET", "/sessao", cida.token)).body;
    expect(sessao).toContain('"tem_palavra_senha":true');
    expect(sessao).not.toContain("goiabada");
    expect(sessao).not.toContain("argon2");
  });

  it("uma família não enxerga nada da outra", async () => {
    const { app } = await montar();
    const a = await criarFamilia(app);
    const b = await criarFamilia(app);
    const analise = (await chamar(app, "POST", "/analises", a.cida.token, { texto: GOLPE })).json() as ResultadoAnalise;
    expect((await chamar(app, "GET", `/analises/${analise.id}`, b.cida.token)).statusCode).toBe(404);
    expect((await chamar(app, "GET", `/familias/${a.familiaId}/historico`, b.ana.token)).statusCode).toBe(404);
    expect((await chamar(app, "GET", `/alertas/${analise.alerta?.id}`, b.ana.token)).statusCode).toBe(404);
    expect((await chamar(app, "POST", `/familias/${a.familiaId}/convites`, b.ana.token, { papel: "guardiao" })).statusCode).toBe(404);
  });
});

describe("análise e alerta", () => {
  it("golpe: grava só resultado e sinais, aciona o 1º guardião e devolve quem foi avisado", async () => {
    const { app, novos } = await montar();
    const { ana, cida } = await criarFamilia(app, { segundoGuardiao: true });
    const r = await chamar(app, "POST", "/analises", cida.token, { texto: GOLPE });
    expect(r.statusCode).toBe(200);
    const corpo = ResultadoAnalise.parse(r.json());
    expect(corpo).toMatchObject({ risco: "vermelho", tipo_golpe: "falso_parente", alerta: { status: "enviado", guardiao: "Ana", resposta: null } });

    const gravada = await prisma.analise.findUniqueOrThrow({ where: { id: corpo.id } });
    expect(gravada).toMatchObject({ risco: "vermelho", valor: 1800, titulo: corpo.titulo });
    // O texto inteiro da mensagem não existe em nenhuma coluna; só os trechos dos sinais.
    expect(JSON.stringify(gravada)).not.toContain(GOLPE);

    expect(novos).toHaveLength(1);
    expect(novos[0]).toMatchObject({ guardiaoId: ana.membro.id, dados: { risco: "vermelho", protegido: "Dona Cida", valor: 1800 } });
    expect(novos[0]?.dados.resumo).toBe("Dona Cida recebeu um provável golpe de falso parente de R$ 1.800.");
  });

  it("sem LLM, mensagem inofensiva sai amarela (nunca verde) e também avisa o guardião", async () => {
    const { app, novos } = await montar();
    const { cida } = await criarFamilia(app);
    const corpo = (await chamar(app, "POST", "/analises", cida.token, { texto: "Lembrete: sua consulta é amanhã às 9h." })).json();
    expect(corpo).toMatchObject({ risco: "amarelo", parcial: true, alerta: { guardiao: "Ana" } });
    expect(novos).toHaveLength(1);
  });

  it("verde não gera alerta", async () => {
    const verde: SaidaLLM = { risco: "verde", tipo_golpe: "nenhum", titulo: "Não encontrei sinais de golpe", sinais: [], acao: "Pode ficar tranquila.", confianca: 0.9 };
    const { app, novos } = await montar({ llm: { analisar: async () => verde }, timeoutLlmMs: 500 });
    const { cida } = await criarFamilia(app);
    const corpo = (await chamar(app, "POST", "/analises", cida.token, { texto: "Lembrete: sua consulta é amanhã às 9h." })).json();
    expect(corpo).toMatchObject({ risco: "verde", alerta: null });
    expect(novos).toHaveLength(0);
    expect(await prisma.alerta.count()).toBe(0);
  });

  it("só a pessoa protegida envia análise, e o corpo precisa de texto", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app);
    expect((await chamar(app, "POST", "/analises", ana.token, { texto: GOLPE })).statusCode).toBe(403);
    const vazio = await chamar(app, "POST", "/analises", cida.token, { texto: "   " });
    expect(vazio.statusCode).toBe(400);
    expect(vazio.json()).toMatchObject({ erro: { codigo: "requisicao_invalida" } });
  });

  it("limita a 10 análises por minuto por sessão", async () => {
    const { app } = await montar();
    const { cida } = await criarFamilia(app);
    const status: number[] = [];
    for (let i = 0; i < 11; i++) status.push((await chamar(app, "POST", "/analises", cida.token, { texto: "oi" })).statusCode);
    expect(status.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(status[10]).toBe(429);
  });

  it("o guardião vê, marca como visto e responde; a tela do protegido destrava", async () => {
    const { app, respondidos } = await montar();
    const { ana, cida, pedro, familiaId } = await criarFamilia(app, { segundoGuardiao: true });
    const analise = (await chamar(app, "POST", "/analises", cida.token, { texto: GOLPE })).json() as ResultadoAnalise;
    const alertaId = analise.alerta?.id as string;

    const pendentes = (await chamar(app, "GET", "/alertas/pendentes", ana.token)).json() as { itens: unknown[] };
    const detalhe = AlertaDetalhe.parse(pendentes.itens[0]);
    expect(detalhe).toMatchObject({ id: alertaId, status: "enviado", protegido: { nome: "Dona Cida" }, proximo_guardiao: "Pedro", valor: 1800 });
    // Pedro ainda não foi acionado: o alerta não é dele.
    expect((await chamar(app, "GET", `/alertas/${alertaId}`, pedro?.token)).statusCode).toBe(404);
    expect((await chamar(app, "GET", `/alertas/${alertaId}`, cida.token)).statusCode).toBe(403);

    expect((await chamar(app, "POST", `/alertas/${alertaId}/visto`, ana.token)).json()).toMatchObject({ status: "visto" });
    const resposta = await chamar(app, "POST", `/alertas/${alertaId}/responder`, ana.token, { resposta: "era_golpe" });
    expect(resposta.json()).toMatchObject({ status: "respondido", resposta: "era_golpe" });
    expect(respondidos).toEqual([{ familiaId, dados: { alerta_id: alertaId, resposta: "era_golpe", guardiao: "Ana" } }]);

    expect((await chamar(app, "GET", `/analises/${analise.id}`, cida.token)).json()).toMatchObject({ alerta: { status: "respondido", resposta: "era_golpe", guardiao: "Ana" } });
    expect((await chamar(app, "POST", `/alertas/${alertaId}/responder`, ana.token, { resposta: "pode_seguir" })).statusCode).toBe(409);
    expect((await chamar(app, "POST", `/alertas/${alertaId}/visto`, ana.token)).json()).toMatchObject({ status: "respondido" });

    const historico = (await chamar(app, "GET", `/familias/${familiaId}/historico`, pedro?.token)).json() as { itens: unknown[] };
    expect(historico.itens).toMatchObject([{ id: analise.id, risco: "vermelho", alerta: { status: "respondido", resposta: "era_golpe", guardiao: "Ana" } }]);
  });
});

describe("escalonamento", () => {
  const envelhecer = (alertaId: string, minutos: number) => prisma.alerta.update({ where: { id: alertaId }, data: { criadoEm: new Date(Date.now() - minutos * 60_000) } });

  it("5 min sem resposta: o alerta expira e o próximo guardião é acionado", async () => {
    const { app } = await montar();
    const { cida, pedro, familiaId } = await criarFamilia(app, { segundoGuardiao: true });
    const analise = (await chamar(app, "POST", "/analises", cida.token, { texto: GOLPE })).json() as ResultadoAnalise;
    const espiao = notificadorEspiao();

    expect(await escalarAlertasParados(prisma, espiao.notificador, 5)).toBe(0);
    await envelhecer(analise.alerta?.id as string, 6);
    expect(await escalarAlertasParados(prisma, espiao.notificador, 5)).toBe(1);

    const alertas = await prisma.alerta.findMany({ where: { analiseId: analise.id }, orderBy: { nivel: "asc" } });
    expect(alertas.map((a) => [a.status, a.nivel, a.membroId === pedro?.membro.id])).toEqual([["expirado", 1, false], ["enviado", 2, true]]);
    expect(espiao.escalados).toEqual([{ familiaId, dados: { alerta_id: alertas[1]?.id, proximo_guardiao: "Pedro" } }]);
    expect(espiao.novos).toMatchObject([{ guardiaoId: pedro?.membro.id, dados: { alerta_id: alertas[1]?.id, protegido: "Dona Cida" } }]);
    // O protegido passa a ver quem está com o alerta agora.
    expect((await chamar(app, "GET", `/analises/${analise.id}`, cida.token)).json()).toMatchObject({ alerta: { status: "enviado", guardiao: "Pedro" } });
    // Pedro era o último: não há para quem escalar de novo.
    await envelhecer(alertas[1]?.id as string, 6);
    expect(await escalarAlertasParados(prisma, espiao.notificador, 5)).toBe(0);
    expect(await prisma.alerta.count({ where: { analiseId: analise.id, status: "enviado" } })).toBe(1);
  });

  it("alerta visto ou respondido não escala", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app, { segundoGuardiao: true });
    const analise = (await chamar(app, "POST", "/analises", cida.token, { texto: GOLPE })).json() as ResultadoAnalise;
    await chamar(app, "POST", `/alertas/${analise.alerta?.id}/visto`, ana.token);
    await envelhecer(analise.alerta?.id as string, 30);
    expect(await escalarAlertasParados(prisma, notificadorMudo, 5)).toBe(0);
  });
});

describe("web push", () => {
  const chaves = { publica: "p", privada: "s", assunto: "mailto:teste@exemplo.com.br" };
  const inscricao = { endpoint: "https://push.exemplo.com.br/abc", keys: { p256dh: "chave", auth: "segredo" } };
  const alerta = { alerta_id: "a3f1c9e2-0000-4000-8000-000000000000", risco: "vermelho" as const, tipo_golpe: "falso_parente" as const, resumo: "Dona Cida recebeu um provável golpe.", valor: null, protegido: "Dona Cida" };

  it("cada pessoa inscreve só o próprio aparelho; o push sai curto, urgente e com validade de 5 min", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app);
    expect((await chamar(app, "PATCH", `/membros/${ana.membro.id}`, cida.token, { push_subscription: inscricao })).statusCode).toBe(403);
    expect((await chamar(app, "PATCH", `/membros/${ana.membro.id}`, ana.token, { push_subscription: inscricao })).statusCode).toBe(200);

    const envios: { corpo: string; opcoes: { TTL?: number; urgency?: string } }[] = [];
    const push = criarPush(prisma, chaves, (async (_i: unknown, corpo: string, opcoes: object) => void envios.push({ corpo, opcoes })) as never);
    await push(ana.membro.id, alerta);
    expect(envios).toHaveLength(1);
    expect(JSON.parse(envios[0]?.corpo as string)).toEqual({ titulo: "Alerta da família", corpo: alerta.resumo, url: `/#alerta=${alerta.alerta_id}`, alerta_id: alerta.alerta_id });
    expect(envios[0]?.opcoes).toMatchObject({ TTL: 300, urgency: "high" });
  });

  it("inscrição expirada é apagada e não derruba o alerta", async () => {
    const { app } = await montar();
    const { ana } = await criarFamilia(app);
    await chamar(app, "PATCH", `/membros/${ana.membro.id}`, ana.token, { push_subscription: inscricao });
    const push = criarPush(prisma, chaves, (async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); }) as never);
    await expect(push(ana.membro.id, alerta)).resolves.toBeUndefined();
    expect((await prisma.membro.findUniqueOrThrow({ where: { id: ana.membro.id } })).pushSubscription).toBeNull();
  });

  it("sem chaves VAPID o envio não faz nada", async () => {
    await expect(criarPush(prisma, null)("qualquer", alerta)).resolves.toBeUndefined();
  });
});

describe("treino antigolpe", () => {
  it("o guardião envia, o protegido recebe dentro do app e ganha escudos se encaminhar", async () => {
    const { app, treinos } = await montar();
    const { ana, cida } = await criarFamilia(app);
    const modelos = (await chamar(app, "GET", "/treinos/modelos", ana.token)).json() as { itens: { id: string; conteudo: string }[] };
    expect(modelos.itens.length).toBeGreaterThanOrEqual(4);
    expect((await chamar(app, "POST", "/treinos", cida.token, { modelo: modelos.itens[0]?.id })).statusCode).toBe(403);

    const enviado = await chamar(app, "POST", "/treinos", ana.token, { modelo: modelos.itens[0]?.id });
    expect(enviado.statusCode).toBe(201);
    const treino = enviado.json() as { id: string };
    expect(treinos).toEqual([{ protegidoId: cida.membro.id, dados: { treino_id: treino.id, conteudo: modelos.itens[0]?.conteudo } }]);

    const pendentes = (await chamar(app, "GET", "/treinos", cida.token)).json() as { itens: { resultado: string; enviado_por: string }[] };
    expect(pendentes.itens).toMatchObject([{ resultado: "pendente", enviado_por: "Ana" }]);

    expect((await chamar(app, "POST", `/treinos/${treino.id}/resultado`, ana.token, { resultado: "encaminhou" })).statusCode).toBe(403);
    const feito = await chamar(app, "POST", `/treinos/${treino.id}/resultado`, cida.token, { resultado: "encaminhou" });
    expect(feito.json()).toMatchObject({ resultado: "encaminhou", pontos: 10 });
    // Vale uma vez só: não dá para somar pontos repetindo.
    expect((await chamar(app, "POST", `/treinos/${treino.id}/resultado`, cida.token, { resultado: "encaminhou" })).statusCode).toBe(409);
    expect((await chamar(app, "GET", "/sessao", ana.token)).json()).toMatchObject({ familia: { escudos: 10 } });
  });

  it("cair no treino não dá pontos, e treino inexistente ou de outra família é recusado", async () => {
    const { app } = await montar();
    const a = await criarFamilia(app);
    const b = await criarFamilia(app);
    expect((await chamar(app, "POST", "/treinos", a.ana.token, { modelo: "nao_existe" })).statusCode).toBe(400);
    const treino = (await chamar(app, "POST", "/treinos", a.ana.token, { modelo: "falsa_central_compra" })).json() as { id: string };
    expect((await chamar(app, "POST", `/treinos/${treino.id}/resultado`, b.cida.token, { resultado: "caiu" })).statusCode).toBe(404);
    expect((await chamar(app, "POST", `/treinos/${treino.id}/resultado`, a.cida.token, { resultado: "caiu" })).json()).toMatchObject({ resultado: "caiu", pontos: 0 });
    expect((await chamar(app, "GET", "/sessao", a.ana.token)).json()).toMatchObject({ familia: { escudos: 0 } });
  });

  it("os golpes simulados do treino são reconhecidos pelo próprio motor", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app);
    const { itens } = (await chamar(app, "GET", "/treinos/modelos", ana.token)).json() as { itens: { id: string; conteudo: string }[] };
    for (const modelo of itens) {
      const r = (await chamar(app, "POST", "/analises", cida.token, { texto: modelo.conteudo })).json() as ResultadoAnalise;
      expect(r.risco, modelo.id).toBe("vermelho");
    }
  });
});
