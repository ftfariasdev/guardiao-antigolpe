/**
 * Roteiro da demo do pitch (doc "Apresentação programada e roteiro da demo").
 * As mesmas mensagens aparecem na conversa simulada do app, no cache do DEMO_MODE da API
 * e no slide 7. Tudo é fictício: nomes, valores e CNPJ.
 */

/** Passo 1: a mensagem de falso parente que chega para a Dona Cida. */
export const DEMO_MENSAGEM_FALSO_PARENTE =
  "Oi mãe, mudei de número, salva esse. Tô precisando de um favor urgente: pode fazer um Pix de R$ 1.800 pra eu pagar um boleto hoje? Te devolvo amanhã.";

/** Passo 6: o Pix da loja, que sai amarelo com o nome a conferir. */
export const DEMO_PIX_LOJA_TEXTO = "Bela Casa Móveis de Curitiba: segue o Pix do seu sofá, com desconto só hoje.";
export const DEMO_PIX_LOJA_CODIGO =
  "00020126360014br.gov.bcb.pix01144455566600017752040000530398654071249.005802BR5921BELA CASA MOVEIS LTDA6006MANAUS62070503***6304EEE6";
export const DEMO_PIX_LOJA = `${DEMO_PIX_LOJA_TEXTO}\n${DEMO_PIX_LOJA_CODIGO}`;

/** CNPJ fictício da loja da demo, respondido pelo cache quando o DEMO_MODE está ligado. */
export const DEMO_CNPJ_LOJA = {
  cnpj: "44555666000177",
  razao_social: "BELA CASA MOVEIS LTDA",
  data_abertura: "2015-04-10",
  situacao: "ATIVA",
  municipio: "MANAUS",
} as const;
