import { describe, expect, it } from "vitest";
import { normalizar } from "../normalizacao/texto.js";
import { aplicarRegrasTexto, REGRAS_TEXTO } from "./texto.js";

const codigos = (mensagem: string) => aplicarRegrasTexto(normalizar(mensagem)).map((s) => s.codigo);
const sinal = (mensagem: string, codigo: string) => aplicarRegrasTexto(normalizar(mensagem)).find((s) => s.codigo === codigo);

/** Para cada regra: uma mensagem que dispara (com o trecho esperado) e uma parecida que não dispara. */
const CASOS: Record<string, { dispara: string; trecho: string; naoDispara: string }> = {
  pedido_dinheiro: { dispara: "Filha, faz um pix de 1.500 pra mim?", trecho: "faz um pix", naoDispara: "Compra aprovada no cartão: R$ 89,90" },
  pedido_dados: { dispara: "Me passa o código que chegou aí", trecho: "passa o código", naoDispara: "Seu código de verificação é 123456. Não compartilhe." },
  troca_numero: { dispara: "Mãe, mudei de número, anota aí", trecho: "mudei de número", naoDispara: "Qual é o número da casa da tia?" },
  urgencia_dinheiro: { dispara: "Preciso pagar hoje até as 16h, faz um pix de 300", trecho: "até as 16h", naoDispara: "A reunião é hoje até as 16h" },
  falsa_central: { dispara: "Identificamos uma compra suspeita no seu cartão", trecho: "Identificamos uma compra suspeita", naoDispara: "Compra aprovada. Se não reconhece, use o app do banco." },
  conta_segura: { dispara: "Transfira para a conta de segurança do banco", trecho: "conta de segurança", naoDispara: "Sua conta está segura com a gente" },
  portador_cartao: { dispara: "Um portador vai retirar seu cartão hoje", trecho: "portador vai retirar", naoDispara: "Seu cartão novo chega pelos Correios em 5 dias" },
  instalar_app: { dispara: "Baixe o app de segurança pelo link", trecho: "Baixe o app de segurança", naoDispara: "Acompanhe pelo app dos Correios" },
  sigilo: { dispara: "Não conta pro pai, depois eu explico", trecho: "Não conta pro pai", naoDispara: "Conta pro seu pai que eu passo aí domingo" },
  conta_terceiro: { dispara: "Manda na conta do meu amigo", trecho: "conta do meu amigo", naoDispara: "Abri uma conta no banco novo" },
  link_suspeito: { dispara: "Rastreie em correios-entrega.online/rastreio", trecho: "correios-entrega.online/rastreio", naoDispara: "Rastreie em www.correios.com.br" },
  taxa_liberacao: { dispara: "Pague a taxa de R$ 49 para liberar o saque", trecho: "taxa de R$ 49 para liberar", naoDispara: "A taxa de entrega é grátis neste mês" },
  ganho_irreal: { dispara: "Ganhe R$ 300 por dia curtindo vídeos", trecho: "Ganhe R$ 300 por dia", naoDispara: "Ganhei um bolo da vizinha" },
  saudacao_generica: { dispara: "Prezado cliente, seu cadastro foi atualizado", trecho: "Prezado cliente", naoDispara: "Dona Maria, seu cadastro foi atualizado" },
  premio: { dispara: "Seus pontos expiram hoje", trecho: "pontos expiram", naoDispara: "O jogo terminou dois a um" },
  ameaca: { dispara: "Sua conta será bloqueada em 24h", trecho: "será bloqueada", naoDispara: "A rua vai ficar fechada amanhã" },
  desconto_hoje: { dispara: "Quitação com 90% de desconto só hoje", trecho: "desconto só hoje", naoDispara: "Desconto de 10% para aposentados" },
  apelo_emocional: { dispara: "Tô desesperado, me ajuda", trecho: "desesperado", naoDispara: "Obrigado pela ajuda de ontem" },
  parente_generico: { dispara: "Oi mãe, tudo bem?", trecho: "Oi mãe", naoDispara: "A mãe da Júlia ligou" },
};

describe("catálogo de regras de texto", () => {
  it("tem 2 gatilhos, 11 sinais fortes e 6 fracos, todos com caso de teste", () => {
    const porForca = (f: string) => REGRAS_TEXTO.filter((r) => r.forca === f).length;
    expect([porForca("gatilho"), porForca("forte"), porForca("fraco")]).toEqual([2, 11, 6]);
    expect(Object.keys(CASOS).sort()).toEqual(REGRAS_TEXTO.map((r) => r.codigo).sort());
  });

  for (const [codigo, caso] of Object.entries(CASOS)) {
    it(`${codigo}: dispara e devolve o trecho como foi escrito`, () => {
      const s = sinal(caso.dispara, codigo);
      expect(s, `"${caso.dispara}" deveria disparar ${codigo}`).toBeDefined();
      expect(s?.trecho).toContain(caso.trecho);
      expect(caso.dispara).toContain(s?.trecho);
      expect(s?.origem).toBe("regra");
    });
    it(`${codigo}: não dispara em mensagem parecida e inofensiva`, () => {
      expect(codigos(caso.naoDispara)).not.toContain(codigo);
    });
  }

  it("urgência só conta junto de pedido de dinheiro", () => {
    expect(codigos("Promoção só hoje, venha conferir")).not.toContain("urgencia_dinheiro");
  });

  it("valores em reais e horários não são confundidos com links", () => {
    expect(codigos("Compra de R$ 2.349,90 às 19h. Sra. Maria, ok?")).not.toContain("link_suspeito");
  });

  it("encurtador e IP são links suspeitos", () => {
    expect(codigos("Resgate agora: bit.ly/pontos")).toContain("link_suspeito");
    expect(codigos("Acesse http://185.20.14.7/login")).toContain("link_suspeito");
  });
});
