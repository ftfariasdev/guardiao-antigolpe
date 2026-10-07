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

describe("conta com e-mail e senha", () => {
  type App = Parameters<typeof chamar>[0];
  const CONTA = { nome: "Ana", email: "Ana@Exemplo.com.br", senha: "senha-da-ana-1" };
  const FAMILIA = { nome_familia: "Família Silva", nome: "Ana", parentesco: "filha" };
  const criarConta = (app: App, conta: object = CONTA) => chamar(app, "POST", "/contas", undefined, conta);
  const entrar = (app: App, email: string, senha: string) => chamar(app, "POST", "/sessoes", undefined, { email, senha });

  it("a conta nasce sem família; a senha fica só como argon2id e o e-mail não volta na resposta", async () => {
    const { app } = await montar();
    const r = await criarConta(app);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ sem_familia: true, conta: { nome: "Ana" } });
    expect(r.body).not.toContain("exemplo.com.br");
    const conta = await prisma.conta.findFirstOrThrow();
    expect(conta).toMatchObject({ email: "ana@exemplo.com.br", membroId: null });
    expect(conta.senhaHash).toMatch(/^\$argon2id\$/);
    expect(conta.senhaHash).not.toContain(CONTA.senha);
    expect(await prisma.familia.count()).toBe(0);
  });

  it("sem família, a sessão diz isso e as rotas da família respondem 403", async () => {
    const { app } = await montar();
    const { token } = (await criarConta(app)).json() as { token: string };
    expect((await chamar(app, "GET", "/sessao", token)).json()).toEqual({ sem_familia: true, conta: { nome: "Ana" } });
    const r = await chamar(app, "POST", "/analises", token, { tipo_entrada: "texto", texto: GOLPE });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ erro: { codigo: "sem_familia" } });
  });

  it("quem tem conta cria a família depois, com a mesma sessão, e vira guardião", async () => {
    const { app } = await montar();
    const { token } = (await criarConta(app)).json() as { token: string };
    const r = await chamar(app, "POST", "/familias", token, FAMILIA);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ token, tem_conta: true, membro: { papel: "guardiao" }, familia: { nome: "Família Silva" } });
    expect(DadosSessao.parse((await chamar(app, "GET", "/sessao", token)).json()).tem_conta).toBe(true);
    expect(await prisma.sessao.count()).toBe(1);
    // Uma conta fica em uma família só.
    expect((await chamar(app, "POST", "/familias", token, FAMILIA)).statusCode).toBe(409);
  });

  it("quem tem conta entra em uma família pelo convite, e depois entra de outro aparelho", async () => {
    const { app } = await montar();
    const { ana, familiaId } = await criarFamilia(app);
    const pedro = { nome: "Pedro", email: "pedro@exemplo.com.br", senha: "senha-do-pedro-1" };
    const { token } = (await criarConta(app, pedro)).json() as { token: string };
    const convite = (await chamar(app, "POST", `/familias/${familiaId}/convites`, ana.token, { papel: "guardiao" })).json() as { token: string };
    const r = await chamar(app, "POST", `/convites/${convite.token}/aceitar`, token, { nome: "Pedro", parentesco: "neto" });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ token, tem_conta: true, membro: { nome: "Pedro", papel: "guardiao", ordem: 2 }, familia: { id: familiaId } });
    const outro = await entrar(app, pedro.email, pedro.senha);
    expect(outro.statusCode).toBe(201);
    expect(outro.json()).toMatchObject({ membro: { nome: "Pedro" }, familia: { id: familiaId } });
  });

  it("entrar abre uma sessão nova, com o e-mail em qualquer caixa", async () => {
    const { app } = await montar();
    const criada = (await criarConta(app)).json() as { token: string };
    const r = await entrar(app, "ANA@exemplo.com.br", CONTA.senha);
    expect(r.statusCode).toBe(201);
    const sessao = r.json() as { token: string };
    expect(sessao.token).not.toBe(criada.token);
    expect((await chamar(app, "GET", "/sessao", sessao.token)).statusCode).toBe(200);
    const sessoes = await prisma.sessao.findMany();
    expect(sessoes.map((s) => s.tokenHash).sort()).toEqual([sha256(criada.token), sha256(sessao.token)].sort());
  });

  it("senha errada, e-mail desconhecido e corpo inválido dão o mesmo 401", async () => {
    const { app } = await montar();
    await criarConta(app);
    const respostas = [await entrar(app, CONTA.email, "senha-errada-1"), await entrar(app, "ninguem@exemplo.com.br", CONTA.senha), await entrar(app, "isso não é e-mail", "")];
    expect(respostas.map((r) => r.statusCode)).toEqual([401, 401, 401]);
    expect(new Set(respostas.map((r) => r.body)).size).toBe(1);
  });

  it("o mesmo e-mail não cria duas contas, e senha curta é recusada", async () => {
    const { app } = await montar();
    await criarConta(app);
    const repetida = await criarConta(app, { ...CONTA, email: "ana@exemplo.com.br" });
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json()).toMatchObject({ erro: { codigo: "email_em_uso" } });
    expect((await criarConta(app, { ...CONTA, email: "outra@exemplo.com.br", senha: "curta" })).statusCode).toBe(400);
    expect(await prisma.conta.count()).toBe(1);
  });

  it("sair apaga só a sessão deste aparelho", async () => {
    const { app } = await montar();
    const primeira = (await criarConta(app)).json() as { token: string };
    const segunda = (await entrar(app, CONTA.email, CONTA.senha)).json() as { token: string };
    expect((await chamar(app, "DELETE", "/sessao", segunda.token)).statusCode).toBe(204);
    expect((await chamar(app, "GET", "/sessao", segunda.token)).statusCode).toBe(401);
    expect((await chamar(app, "GET", "/sessao", primeira.token)).statusCode).toBe(200);
  });

  it("o navegador de outro domínio pode chamar o Sair (DELETE liberado no CORS)", async () => {
    const { app } = await montar();
    const r = await app.inject({ method: "OPTIONS", url: "/api/v1/sessao", headers: { origin: config.CORS_ORIGINS[0] ?? "http://localhost:5173", "access-control-request-method": "DELETE" } });
    expect(String(r.headers["access-control-allow-methods"])).toContain("DELETE");
  });

  it("o guardião que entrou sem senha cria o login depois; a pessoa protegida não", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app);
    expect(ana.tem_conta).toBe(false);
    const conta = { email: "ana@exemplo.com.br", senha: "senha-da-ana-1" };
    expect((await chamar(app, "PUT", "/conta", cida.token, conta)).statusCode).toBe(403);
    const r = await chamar(app, "PUT", "/conta", ana.token, conta);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ tem_conta: true });
    expect((await entrar(app, conta.email, conta.senha)).json()).toMatchObject({ membro: { nome: "Ana" } });
    expect((await chamar(app, "PUT", "/conta", ana.token, { ...conta, senha: "outra-senha-22" })).statusCode).toBe(409);
  });

  it("se a família é apagada, a conta continua e volta a ficar sem família", async () => {
    const { app } = await montar();
    const { token } = (await criarConta(app)).json() as { token: string };
    await chamar(app, "POST", "/familias", token, FAMILIA);
    await prisma.familia.deleteMany();
    expect((await chamar(app, "GET", "/sessao", token)).json()).toEqual({ sem_familia: true, conta: { nome: "Ana" } });
  });
});

describe("gerenciar a família: quem é guardião e quem é protegido", () => {
  const mudar = (app: Parameters<typeof chamar>[0], token: string, id: string, papel: "protegido" | "guardiao") => chamar(app, "PUT", `/membros/${id}/papel`, token, { papel });
  const papeis = async () => (await prisma.membro.findMany({ orderBy: { criadoEm: "asc" } })).map((m) => `${m.nome}:${m.papel}:${m.ordem}`);

  it("o guardião troca os papéis: a protegida vira guardiã e outro guardião vira protegido", async () => {
    const { app } = await montar();
    const { ana, cida, pedro } = await criarFamilia(app, { segundoGuardiao: true });
    const r = await mudar(app, ana.token, cida.membro.id, "guardiao");
    expect(r.statusCode).toBe(200);
    expect(DadosSessao.parse(r.json()).familia.membros.find((m) => m.nome === "Dona Cida")).toMatchObject({ papel: "guardiao", ordem: 3 });
    expect((await mudar(app, ana.token, (pedro as { membro: { id: string } }).membro.id, "protegido")).statusCode).toBe(200);
    expect(await papeis()).toEqual(["Ana:guardiao:1", "Dona Cida:guardiao:2", "Pedro:protegido:1"]);
    // Cada um passa a enxergar o app do novo papel.
    expect(DadosSessao.parse((await chamar(app, "GET", "/sessao", cida.token)).json()).membro.papel).toBe("guardiao");
  });

  it("a família nunca fica sem guardião nem com duas pessoas protegidas", async () => {
    const { app } = await montar();
    const { ana, pedro } = await criarFamilia(app, { segundoGuardiao: true });
    const comProtegida = await mudar(app, ana.token, (pedro as { membro: { id: string } }).membro.id, "protegido");
    expect(comProtegida.statusCode).toBe(409);
    expect(comProtegida.json()).toMatchObject({ erro: { codigo: "familia_cheia" } });
    const sozinha = await montar();
    const so = (await chamar(sozinha.app, "POST", "/familias", undefined, { nome_familia: "Família Souza", nome: "Bia" })).json() as { token: string; membro: { id: string } };
    const ultimo = await mudar(sozinha.app, so.token, so.membro.id, "protegido");
    expect(ultimo.statusCode).toBe(409);
    expect(ultimo.json()).toMatchObject({ erro: { codigo: "ultimo_guardiao" } });
  });

  it("o guardião pode virar a pessoa protegida se sobrar outro guardião", async () => {
    const { app } = await montar();
    const { ana, cida } = await criarFamilia(app, { segundoGuardiao: true });
    await mudar(app, ana.token, cida.membro.id, "guardiao");
    const r = await mudar(app, ana.token, ana.membro.id, "protegido");
    expect(r.statusCode).toBe(200);
    expect(DadosSessao.parse(r.json()).membro.papel).toBe("protegido");
    expect(await papeis()).toEqual(["Ana:protegido:1", "Dona Cida:guardiao:2", "Pedro:guardiao:1"]);
    // Já como protegida, Ana não muda mais o papel de ninguém.
    expect((await mudar(app, ana.token, cida.membro.id, "protegido")).statusCode).toBe(403);
  });

  it("só guardião muda papéis, só na própria família, e no máximo 3 guardiões", async () => {
    const { app } = await montar();
    const { ana, cida, familiaId } = await criarFamilia(app, { segundoGuardiao: true });
    expect((await mudar(app, cida.token, cida.membro.id, "guardiao")).statusCode).toBe(403);
    const outra = (await chamar(app, "POST", "/familias", undefined, { nome_familia: "Família Souza", nome: "Bia" })).json() as { token: string };
    expect((await mudar(app, outra.token, cida.membro.id, "guardiao")).statusCode).toBe(404);
    const convite = (await chamar(app, "POST", `/familias/${familiaId}/convites`, ana.token, { papel: "guardiao" })).json() as { token: string };
    await chamar(app, "POST", `/convites/${convite.token}/aceitar`, undefined, { nome: "Lia" });
    const cheia = await mudar(app, ana.token, cida.membro.id, "guardiao");
    expect(cheia.statusCode).toBe(409);
    expect((await mudar(app, ana.token, cida.membro.id, "banana" as "guardiao")).statusCode).toBe(400);
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
