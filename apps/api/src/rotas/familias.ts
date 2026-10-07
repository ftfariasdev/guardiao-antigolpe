import { hash, verify } from "@node-rs/argon2";
import { AceitarConvite, AtualizarMembro, MudarPapel, CriarConta, CriarConvite, CriarFamilia, DefinirConta, DefinirPalavraSenha, Entrar, type ConviteCriado, type ItemHistorico, type SessaoAberta, type SessaoAtual, type SessaoCriada } from "@guardiao/shared";
import { Prisma, type Conta, type Membro, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { donoDoToken, ErroHttp, exigirFamilia, exigirPapel, exigirSessao, tokenDoPedido, validar } from "../autenticacao.js";
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
      return { token, ...(await dadosDaSessao(prisma, criada.membro as Membro)) };
    }

    /** A família da pessoa, ou só a conta quando ela ainda não tem família. */
    const situacao = async (conta: Conta, membro: Membro | null): Promise<SessaoAtual> =>
      membro ? dadosDaSessao(prisma, membro) : { sem_familia: true, conta: { nome: conta.nome } };

    async function abrirSessaoDaConta(conta: Conta): Promise<SessaoAberta> {
      const token = gerarToken();
      await prisma.sessao.create({ data: { contaId: conta.id, tokenHash: hashToken(token) } });
      const membro = conta.membroId ? await prisma.membro.findUnique({ where: { id: conta.membroId } }) : null;
      return { token, ...(await situacao(conta, membro)) };
    }

    /**
     * Quando o pedido vem de quem fez login e ainda não tem família, devolve a conta,
     * para a família criada (ou o convite aceito) ficar ligada a ela. Sem sessão, devolve null.
     */
    async function contaSemFamilia(req: FastifyRequest): Promise<{ conta: Conta; token: string } | null> {
      const token = tokenDoPedido(req);
      if (!token) return null;
      const dono = await donoDoToken(prisma, token);
      if (!dono) throw new ErroHttp(401, "sessao_invalida", "Entre de novo com a sua conta.");
      if (dono.membro || !dono.conta) throw new ErroHttp(409, "ja_tem_familia", "Você já está em uma família.");
      return { conta: dono.conta, token };
    }

    /** Criar a conta não exige família: a pessoa cria ou entra em uma depois. */
    app.post("/contas", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, res) => {
      const dados = validar(CriarConta, req.body, "Informe o seu nome, um e-mail válido e uma senha com pelo menos 8 letras ou números.");
      const conta = await prisma.conta.create({ data: { nome: dados.nome, email: dados.email, senhaHash: await hash(dados.senha) } }).catch((erro: unknown) => {
        throw emailJaUsado(erro) ? ERRO_EMAIL_EM_USO : erro;
      });
      return res.status(201).send(await abrirSessaoDaConta(conta));
    });

    app.post("/familias", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, res) => {
      const dados = validar(CriarFamilia, req.body, "Informe o nome da família e o seu nome.");
      const livre = await contaSemFamilia(req);
      const familia = await prisma.familia.create({
        data: {
          nome: dados.nome_familia,
          membros: { create: { nome: dados.nome, parentesco: dados.parentesco ?? null, papel: "guardiao", ordem: 1, ...(livre ? { conta: { connect: { id: livre.conta.id } } } : {}) } },
        },
        include: { membros: true },
      });
      const membro = familia.membros[0] as Membro;
      // Quem já fez login continua com a mesma sessão; sem login, a sessão é só deste aparelho.
      if (livre) return res.status(201).send({ token: livre.token, ...(await dadosDaSessao(prisma, membro)) } satisfies SessaoCriada);
      return res.status(201).send(await abrirSessao(membro.id));
    });

    /** Entrar com e-mail e senha: abre uma sessão nova neste aparelho. A resposta de erro é sempre a mesma. */
    app.post("/sessoes", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, res) => {
      const invalido = new ErroHttp(401, "credenciais_invalidas", "E-mail ou senha incorretos.");
      const lido = Entrar.safeParse(req.body);
      if (!lido.success) throw invalido;
      const conta = await prisma.conta.findUnique({ where: { email: lido.data.email } });
      const confere = await verify(conta?.senhaHash ?? (await HASH_DE_NINGUEM), lido.data.senha).catch(() => false);
      if (!conta || !confere) throw invalido;
      return res.status(201).send(await abrirSessaoDaConta(conta));
    });

    /** Sair: apaga só a sessão deste aparelho. */
    app.delete("/sessao", async (req, res) => {
      const token = tokenDoPedido(req);
      if (!token) throw new ErroHttp(401, "sessao_invalida", "Sem sessão para encerrar.");
      await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
      return res.status(204).send();
    });

    /** Cria o login de quem está na família sem conta (entrou por convite). Trocar a senha fica fora do MVP. */
    app.put("/conta", { ...sessao, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
      exigirPapel(req, "guardiao");
      const dados = validar(DefinirConta, req.body, "Informe um e-mail válido e uma senha com pelo menos 8 letras ou números.");
      if (await prisma.conta.count({ where: { membroId: req.membro.id } })) throw new ErroHttp(409, "ja_tem_conta", "Você já tem e-mail e senha.");
      await prisma.conta.create({ data: { nome: req.membro.nome, email: dados.email, senhaHash: await hash(dados.senha), membroId: req.membro.id } }).catch((erro: unknown) => {
        throw emailJaUsado(erro) ? ERRO_EMAIL_EM_USO : erro;
      });
      return dadosDaSessao(prisma, req.membro);
    });

    app.get("/sessao", async (req) => {
      const token = tokenDoPedido(req);
      const dono = token ? await donoDoToken(prisma, token) : null;
      if (!dono) throw new ErroHttp(401, "sessao_invalida", "Entre de novo com a sua conta ou pelo convite da família.");
      return dono.membro ? dadosDaSessao(prisma, dono.membro) : situacao(dono.conta as Conta, null);
    });

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
      const livre = await contaSemFamilia(req);
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
          data: {
            familiaId: convite.familiaId,
            nome: dados.nome,
            parentesco: dados.parentesco ?? null,
            papel: convite.papel,
            ordem: convite.papel === "guardiao" ? quantos + 1 : 1,
            ...(livre ? { conta: { connect: { id: livre.conta.id } } } : {}),
          },
        });
      });
      if (livre) return res.status(201).send({ token: livre.token, ...(await dadosDaSessao(prisma, membro)) } satisfies SessaoCriada);
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

    const emOrdem = { orderBy: [{ ordem: "asc" as const }, { criadoEm: "asc" as const }] };

    /** Grava a fila de avisos como 1, 2, 3, na ordem recebida. */
    async function gravarFila(tx: Prisma.TransactionClient, fila: Membro[]) {
      for (const [i, g] of fila.entries()) await tx.membro.update({ where: { id: g.id }, data: { ordem: i + 1 } });
    }

    /** Alertas ainda sem resposta de quem deixa de ser guardião passam para o primeiro da fila que ficou. */
    async function repassarAlertasAbertos(tx: Prisma.TransactionClient, deId: string, fila: Membro[]) {
      const herdeiro = fila[0];
      if (herdeiro) await tx.alerta.updateMany({ where: { membroId: deId, status: { in: ["enviado", "visto"] } }, data: { membroId: herdeiro.id, status: "enviado" } });
    }

    /**
     * Um guardião tira alguém da família, ou sai dela. O histórico de análises e alertas da pessoa
     * é apagado junto; a conta dela, se houver, continua e volta a ficar sem família.
     */
    app.delete<{ Params: { id: string } }>("/membros/:id", sessao, async (req, res) => {
      exigirPapel(req, "guardiao");
      await prisma.$transaction(async (tx) => {
        const membros = await tx.membro.findMany({ where: { familiaId: req.membro.familiaId }, ...emOrdem });
        const alvo = membros.find((m) => m.id === req.params.id);
        if (!alvo) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
        const fila = membros.filter((m) => m.papel === "guardiao" && m.id !== alvo.id);
        if (fila.length === 0) throw new ErroHttp(409, "ultimo_guardiao", "A família precisa de pelo menos um guardião. Convide outro antes de sair.");
        if (alvo.papel === "guardiao") await repassarAlertasAbertos(tx, alvo.id, fila);
        await tx.membro.delete({ where: { id: alvo.id } });
        await gravarFila(tx, fila);
      });
      return res.status(204).send();
    });

    /**
     * Um guardião muda o papel de alguém da família (inclusive o próprio).
     * A família nunca fica sem guardião, e os limites do MVP continuam: 1 protegido e até 3 guardiões.
     */
    app.put<{ Params: { id: string } }>("/membros/:id/papel", sessao, async (req) => {
      exigirPapel(req, "guardiao");
      const { papel } = validar(MudarPapel, req.body, "Diga se a pessoa passa a ser protegida ou guardiã.");
      const familiaId = req.membro.familiaId;
      await prisma.$transaction(async (tx) => {
        const membros = await tx.membro.findMany({ where: { familiaId }, ...emOrdem });
        const alvo = membros.find((m) => m.id === req.params.id);
        if (!alvo) throw new ErroHttp(404, "nao_encontrado", "Não encontrado.");
        if (alvo.papel === papel) return;
        const guardioes = membros.filter((m) => m.papel === "guardiao");
        if (papel === "protegido") {
          if (guardioes.length < 2) throw new ErroHttp(409, "ultimo_guardiao", "A família precisa de pelo menos um guardião. Convide outro antes de mudar.");
          if (membros.some((m) => m.papel === "protegido")) throw new ErroHttp(409, "familia_cheia", "A família já tem uma pessoa protegida. Mude ela para guardiã antes.");
        } else if (guardioes.length >= MAXIMO_GUARDIOES) {
          throw new ErroHttp(409, "familia_cheia", `A família já tem ${MAXIMO_GUARDIOES} guardiões.`);
        }
        await tx.membro.update({ where: { id: alvo.id }, data: { papel, ordem: 1 } });
        // Quem vira guardião entra no fim da fila de avisos; a fila fica sempre 1, 2, 3.
        const fila = [...guardioes.filter((g) => g.id !== alvo.id), ...(papel === "guardiao" ? [alvo] : [])];
        if (papel === "protegido") await repassarAlertasAbertos(tx, alvo.id, fila);
        await gravarFila(tx, fila);
      });
      return dadosDaSessao(prisma, await prisma.membro.findUniqueOrThrow({ where: { id: req.membro.id } }));
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
      if (dados.ordem !== undefined) {
        // Mudar a ordem move a pessoa na fila de avisos e renumera os outros guardiões.
        const posicao = dados.ordem;
        if (alvo.papel !== "guardiao") throw new ErroHttp(400, "requisicao_invalida", "Só guardiões têm ordem de aviso.");
        await prisma.$transaction(async (tx) => {
          const outros = (await tx.membro.findMany({ where: { familiaId: alvo.familiaId, papel: "guardiao" }, ...emOrdem })).filter((g) => g.id !== alvo.id);
          outros.splice(Math.min(posicao - 1, outros.length), 0, alvo);
          await gravarFila(tx, outros);
        });
      }
      const atualizado = await prisma.membro.update({
        where: { id: alvo.id },
        data: {
          ...(dados.push_subscription !== undefined ? { pushSubscription: (dados.push_subscription ?? null) as Prisma.InputJsonValue } : {}),
          ...(dados.acessibilidade !== undefined ? { acessibilidade: dados.acessibilidade as Prisma.InputJsonValue } : {}),
        },
      });
      return dadosDaSessao(prisma, atualizado.id === req.membro.id ? atualizado : await prisma.membro.findUniqueOrThrow({ where: { id: req.membro.id } }));
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
