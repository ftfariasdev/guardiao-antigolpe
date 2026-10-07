import { hash, verify } from "@node-rs/argon2";
import { AceitarConvite, AtualizarMembro, CriarConvite, CriarFamilia, DefinirConta, DefinirPalavraSenha, Entrar, type ConviteCriado, type ItemHistorico, type SessaoCriada } from "@guardiao/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { ErroHttp, exigirFamilia, exigirPapel, exigirSessao, validar } from "../autenticacao.js";
import { gerarToken, hashToken } from "../seguranca.js";
import { dadosDaSessao, MAXIMO_GUARDIOES } from "../servicos/familia.js";

const VALIDADE_CONVITE_MS = 24 * 60 * 60 * 1000;

/** Hash de uma senha que ninguém tem: o login gasta o mesmo tempo quando o e-mail não existe. */
const HASH_DE_NINGUEM = hash("senha-que-ninguem-tem");

const emailJaUsado = (erro: unknown) => erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
const ERRO_EMAIL_EM_USO = new ErroHttp(409, "email_em_uso", "Este e-mail já tem conta. Use Entrar.");

export const rotasFamilias =
  (prisma: PrismaClient): FastifyPluginAsync =>
  async (app) => {
    const sessao = { preHandler: exigirSessao(prisma) };

    async function abrirSessao(membroId: string): Promise<SessaoCriada> {
      const token = gerarToken();
      const criada = await prisma.sessao.create({ data: { membroId, tokenHash: hashToken(token) }, include: { membro: true } });
      return { token, ...(await dadosDaSessao(prisma, criada.membro)) };
    }

    app.post("/familias", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, res) => {
      const dados = validar(CriarFamilia, req.body, "Informe o nome da família e o seu nome. A senha precisa ter pelo menos 8 letras ou números.");
      const conta = dados.email && dados.senha ? { email: dados.email, senhaHash: await hash(dados.senha) } : {};
      const familia = await prisma.familia
        .create({
          data: { nome: dados.nome_familia, membros: { create: { nome: dados.nome, parentesco: dados.parentesco ?? null, papel: "guardiao", ordem: 1, ...conta } } },
          include: { membros: true },
        })
        .catch((erro: unknown) => {
          throw emailJaUsado(erro) ? ERRO_EMAIL_EM_USO : erro;
        });
      return res.status(201).send(await abrirSessao((familia.membros[0] as { id: string }).id));
    });

    /** Entrar com e-mail e senha: abre uma sessão nova neste aparelho. A resposta de erro é sempre a mesma. */
    app.post("/sessoes", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, res) => {
      const invalido = new ErroHttp(401, "credenciais_invalidas", "E-mail ou senha incorretos.");
      const lido = Entrar.safeParse(req.body);
      if (!lido.success) throw invalido;
      const membro = await prisma.membro.findUnique({ where: { email: lido.data.email } });
      const confere = await verify(membro?.senhaHash ?? (await HASH_DE_NINGUEM), lido.data.senha).catch(() => false);
      if (!membro?.senhaHash || !confere) throw invalido;
      return res.status(201).send(await abrirSessao(membro.id));
    });

    /** Sair: apaga só a sessão deste aparelho. */
    app.delete("/sessao", sessao, async (req, res) => {
      const token = (req.headers.authorization ?? "").slice(7).trim();
      await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
      return res.status(204).send();
    });

    /** Cria o login de quem entrou por convite ou criou a família sem e-mail. Trocar a senha fica fora do MVP. */
    app.put("/conta", { ...sessao, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
      exigirPapel(req, "guardiao");
      const dados = validar(DefinirConta, req.body, "Informe um e-mail válido e uma senha com pelo menos 8 letras ou números.");
      if (req.membro.senhaHash) throw new ErroHttp(409, "ja_tem_conta", "Você já tem e-mail e senha.");
      const membro = await prisma.membro
        .update({ where: { id: req.membro.id }, data: { email: dados.email, senhaHash: await hash(dados.senha) } })
        .catch((erro: unknown) => {
          throw emailJaUsado(erro) ? ERRO_EMAIL_EM_USO : erro;
        });
      return dadosDaSessao(prisma, membro);
    });

    app.get("/sessao", sessao, async (req) => dadosDaSessao(prisma, req.membro));

    app.post<{ Params: { id: string } }>("/familias/:id/convites", sessao, async (req, res) => {
      exigirFamilia(req, req.params.id);
      exigirPapel(req, "guardiao");
      const { papel } = validar(CriarConvite, req.body, "Diga se o convite é para protegido ou guardião.");
      await conferirVaga(req.params.id, papel);
      const token = gerarToken();
      const convite = await prisma.convite.create({
        data: { familiaId: req.params.id, papel, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) },
      });
      const corpo: ConviteCriado = { token, papel, expira_em: convite.expiraEm.toISOString() };
      return res.status(201).send(corpo);
    });

    /** No MVP: 1 protegido e até 3 guardiões por família. */
    async function conferirVaga(familiaId: string, papel: "protegido" | "guardiao", tx: Prisma.TransactionClient | PrismaClient = prisma) {
      const quantos = await tx.membro.count({ where: { familiaId, papel } });
      if (papel === "protegido" && quantos >= 1) throw new ErroHttp(409, "familia_cheia", "Esta família já tem uma pessoa protegida.");
      if (papel === "guardiao" && quantos >= MAXIMO_GUARDIOES) throw new ErroHttp(409, "familia_cheia", `A família já tem ${MAXIMO_GUARDIOES} guardiões.`);
      return quantos;
    }

    app.post<{ Params: { token: string } }>("/convites/:token/aceitar", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, res) => {
      const dados = validar(AceitarConvite, req.body, "Informe o seu nome.");
      const membro = await prisma.$transaction(async (tx) => {
        // Uso único: só marca como usado se ainda não foi e não venceu.
        const convite = await tx.convite.findUnique({ where: { tokenHash: hashToken(req.params.token) } });
        if (!convite || convite.usadoEm || convite.expiraEm < new Date()) {
          throw new ErroHttp(410, "convite_invalido", "Este convite já foi usado ou venceu. Peça um novo ao guardião.");
        }
        const quantos = await conferirVaga(convite.familiaId, convite.papel, tx);
        const { count } = await tx.convite.updateMany({ where: { id: convite.id, usadoEm: null }, data: { usadoEm: new Date() } });
        if (count === 0) throw new ErroHttp(410, "convite_invalido", "Este convite já foi usado. Peça um novo ao guardião.");
        return tx.membro.create({
          data: { familiaId: convite.familiaId, nome: dados.nome, parentesco: dados.parentesco ?? null, papel: convite.papel, ordem: convite.papel === "guardiao" ? quantos + 1 : 1 },
        });
      });
      return res.status(201).send(await abrirSessao(membro.id));
    });

    app.put<{ Params: { id: string } }>("/familias/:id/palavra-senha", sessao, async (req, res) => {
      exigirFamilia(req, req.params.id);
      exigirPapel(req, "guardiao");
      const { palavra } = validar(DefinirPalavraSenha, req.body, "A palavra-senha precisa ter de 3 a 60 letras.");
      // argon2id (padrão da biblioteca); só escrita, nunca leitura.
      await prisma.familia.update({ where: { id: req.params.id }, data: { palavraSenhaHash: await hash(palavra.toLowerCase()) } });
      return res.status(204).send();
    });

    app.patch<{ Params: { id: string } }>("/membros/:id", sessao, async (req) => {
      const dados = validar(AtualizarMembro, req.body, "Dados do membro inválidos.");
      const alvo = await prisma.membro.findUnique({ where: { id: req.params.id } });
      if (!alvo || alvo.familiaId !== req.membro.familiaId) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
      const eEu = alvo.id === req.membro.id;
      const souGuardiao = req.membro.papel === "guardiao";
      // Push é de cada aparelho; ordem é decisão dos guardiões; acessibilidade, da própria pessoa ou de um guardião.
      if (dados.push_subscription !== undefined && !eEu) throw new ErroHttp(403, "sem_permissao", "Cada pessoa ativa os avisos no próprio aparelho.");
      if (dados.ordem !== undefined && !souGuardiao) throw new ErroHttp(403, "sem_permissao", "Só um guardião muda a ordem dos avisos.");
      if (dados.acessibilidade !== undefined && !eEu && !souGuardiao) throw new ErroHttp(403, "sem_permissao", "Sem permissão.");
      const atualizado = await prisma.membro.update({
        where: { id: alvo.id },
        data: {
          ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}),
          ...(dados.push_subscription !== undefined ? { pushSubscription: (dados.push_subscription ?? null) as Prisma.InputJsonValue } : {}),
          ...(dados.acessibilidade !== undefined ? { acessibilidade: dados.acessibilidade as Prisma.InputJsonValue } : {}),
        },
      });
      return dadosDaSessao(prisma, atualizado.id === req.membro.id ? atualizado : req.membro);
    });

    app.get<{ Params: { id: string }; Querystring: { limite?: string; antes_de?: string } }>("/familias/:id/historico", sessao, async (req) => {
      exigirFamilia(req, req.params.id);
      const limite = Math.min(50, Math.max(1, Number(req.query.limite) || 20));
      const antes = req.query.antes_de ? new Date(req.query.antes_de) : null;
      const analises = await prisma.analise.findMany({
        where: { familiaId: req.params.id, ...(antes && !Number.isNaN(antes.getTime()) ? { criadoEm: { lt: antes } } : {}) },
        orderBy: { criadoEm: "desc" },
        take: limite,
        include: { alertas: { orderBy: { criadoEm: "desc" }, take: 1, include: { membro: true } } },
      });
      const itens: ItemHistorico[] = analises.map((a) => {
        const alerta = a.alertas[0];
        return {
          id: a.id,
          criado_em: a.criadoEm.toISOString(),
          risco: a.risco,
          tipo_golpe: a.tipoGolpe,
          titulo: a.titulo,
          alerta: alerta ? { id: alerta.id, status: alerta.status, resposta: alerta.resposta, guardiao: alerta.membro.nome } : null,
        };
      });
      return { itens, proximo: itens.length === limite ? (itens[itens.length - 1] as ItemHistorico).criado_em : null };
    });
  };
