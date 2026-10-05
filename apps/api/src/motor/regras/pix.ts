import type { DadosBRCode } from "@guardiao/brcode";
import { simplificar } from "../normalizacao/texto.js";
import type { SinalRegra } from "./tipos.js";

/**
 * Regras do Pix. O nome dentro do BR Code é escrito por quem gerou o código e pode ser
 * inventado, então as regras procuram contradições no que dá para ver antes do pagamento.
 */

/** Dados do CNPJ vindos da consulta (BrasilAPI no D5; simulados na avaliação). */
export interface InfoCnpj {
  razao_social: string;
  /** Data ISO (aaaa-mm-dd). */
  data_abertura: string;
  situacao: string;
  municipio?: string | null;
}

export interface ContextoPix {
  dados: DadosBRCode;
  /** Texto da mensagem já normalizado (minúsculas, sem acentos), sem o código Pix. */
  mensagem: string;
  cnpj: InfoCnpj | null;
  agora: Date;
  chavesDenunciadas: ReadonlySet<string>;
}

const DIAS_CNPJ_RECENTE = 90;

/** Lista fictícia no MVP (doc do motor); a chave é a usada na demonstração. */
export const CHAVES_DENUNCIADAS_DEMO: ReadonlySet<string> = new Set(["golpe@exemplo.com.br", "00000000000191"]);

/** Ramo citado na mensagem → palavras que o nome do recebedor deveria ter. */
const RAMOS: { rotulo: string; citacao: RegExp; esperado: RegExp }[] = [
  {
    rotulo: "da empresa de energia",
    citacao: /\b(?:conta de luz|energia|eletricidade)\b/,
    esperado: /energ|eletr|light|enel|cemig|copel|cpfl|equatorial|coelba|celesc|distribuidora|forca e luz/,
  },
  {
    rotulo: "da empresa de água",
    citacao: /\b(?:conta de agua|saneamento)\b/,
    esperado: /agua|saneamento|sabesp|sanepar|copasa|cedae|embasa|caesb|casan/,
  },
  { rotulo: "da escola", citacao: /\b(?:escola|colegio|mensalidade escolar|faculdade)\b/, esperado: /escola|colegio|educa|ensino|faculdade|universidade/ },
  { rotulo: "do condomínio", citacao: /\bcondominio\b/, esperado: /condominio|cond\b|administradora|imobiliaria/ },
  {
    rotulo: "da operadora",
    citacao: /\b(?:conta de (?:telefone|celular|internet)|operadora|plano de (?:celular|internet))\b/,
    esperado: /telecom|telefon|claro|vivo|tim\b|\boi\b|net\b|internet/,
  },
  { rotulo: "dos Correios", citacao: /\bcorreios\b/, esperado: /correios|empresa brasileira de correios/ },
  { rotulo: "do banco", citacao: /\b(?:banco|fatura do cartao)\b/, esperado: /banco|bank|financeira|pagamentos|caixa|itau|bradesco|santander|nubank|nu pagamentos/ },
  { rotulo: "do órgão público", citacao: /\b(?:inss|receita federal|detran|prefeitura|iptu|ipva)\b/, esperado: /inss|receita|detran|prefeitura|municipio|secretaria|tesouro|estado d/ },
];

const CITA_EMPRESA =
  /\b(?:banco|loja|fatura|boleto|conta de (?:luz|agua|telefone|celular|internet|gas)|energia|mensalidade|divida|renegociacao|condominio|prefeitura|detran|receita|inss|operadora|empresa|financeira|cartorio|correios|seguro|plano)\b/;

const NOME_DE_EMPRESA =
  /\b(?:ltda|s\.?a\.?|me|mei|eireli|epp|cia|comercio|servicos|distribuidora|energia|banco|escola|colegio|condominio|associacao|instituto|pagamentos|industria|mercado|loja|farmacia|clinica|prefeitura)\b/;

function diasEntre(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000);
}

function ramoCitado(mensagem: string) {
  return RAMOS.find((r) => r.citacao.test(mensagem)) ?? null;
}

export function aplicarRegrasPix({ dados, mensagem, cnpj, agora, chavesDenunciadas }: ContextoPix): SinalRegra[] {
  const sinais: SinalRegra[] = [];
  const trecho = (dados.nome_declarado ?? "código Pix").slice(0, 200);
  const sinal = (codigo: string, forca: SinalRegra["forca"], explicacao: string) =>
    sinais.push({ codigo, origem: "regra", forca, trecho, explicacao });

  const nome = simplificar(dados.nome_declarado ?? "");
  const razao = simplificar(cnpj?.razao_social ?? "");

  if (!dados.crc_valido) {
    sinal("pix_crc_invalido", "forte", "Este código Pix foi alterado ou copiado errado. Código verdadeiro não vem assim.");
  }
  if (cnpj) {
    const dias = diasEntre(new Date(cnpj.data_abertura), agora);
    if (dias >= 0 && dias < DIAS_CNPJ_RECENTE) {
      sinal("pix_cnpj_recente", "forte", `A empresa que vai receber foi aberta há só ${dias} dias. Golpistas abrem empresas novas para receber Pix.`);
    }
    if (!/^ativa$/.test(simplificar(cnpj.situacao))) {
      sinal("pix_cnpj_inativo", "forte", "A empresa que vai receber não está ativa na Receita Federal.");
    }
  }
  const pessoaFisica = dados.tipo_chave !== "cnpj" && nome !== "" && !NOME_DE_EMPRESA.test(nome);
  if (CITA_EMPRESA.test(mensagem) && pessoaFisica) {
    sinal("pix_pessoa_cobrando_empresa", "forte", "A mensagem fala de uma empresa, mas o Pix vai para uma pessoa. Empresa de verdade recebe no próprio nome.");
  }
  const ramo = ramoCitado(mensagem);
  if (ramo && nome !== "" && !ramo.esperado.test(nome) && !ramo.esperado.test(razao)) {
    sinal("pix_nome_divergente", "forte", "O nome de quem vai receber não é o da empresa citada na mensagem.");
  }
  if (dados.chave && chavesDenunciadas.has(dados.chave.toLowerCase())) {
    sinal("pix_chave_denunciada", "forte", "Esta chave Pix já foi denunciada por outras pessoas.");
  }
  // A cidade no BR Code tem no máximo 15 letras, então a comparação é pelo começo do nome.
  const cidadePix = simplificar(dados.cidade ?? "");
  if (cnpj?.municipio && cidadePix && !simplificar(cnpj.municipio).startsWith(cidadePix)) {
    sinal("pix_cidade_divergente", "fraco", "A cidade do recebedor no código é diferente da cidade da empresa.");
  }
  return sinais;
}

/** Instrução que fecha toda análise de Pix: conferir o nome que aparece no app do banco. */
export function instrucaoConferirNome(mensagem: string, dados: DadosBRCode, cnpj: InfoCnpj | null): string {
  const nome = cnpj?.razao_social ?? (ramoCitado(mensagem) ? null : dados.nome_declarado);
  const esperado = nome ? `o nome ${nome.slice(0, 50)}` : `o nome ${ramoCitado(mensagem)?.rotulo ?? "de quem você espera pagar"}`;
  return `Quando abrir o app do banco, confira se aparece ${esperado}. Se aparecer outro nome, ou nome de pessoa, não pague.`;
}
