import { maiorRisco, SaidaLLM, type NivelRisco, type Sinal, type TipoGolpe } from "@guardiao/shared";
import { simplificar, TAMANHO_MAXIMO_TRECHO } from "./normalizacao/texto.js";
import { riscoDasRegras, tipoPelasRegras } from "./regras/risco.js";
import type { SinalRegra } from "./regras/tipos.js";

/**
 * Fusão entre regras e LLM. É aqui que mora o fail-safe: sem o LLM as regras ainda
 * respondem, e a resposta nunca é verde.
 */

export interface ResultadoFusao {
  risco: NivelRisco;
  tipo_golpe: TipoGolpe;
  titulo: string;
  sinais: Sinal[];
  acao: string;
  sugerir_palavra_senha: boolean;
  confianca: number;
  parcial: boolean;
}

const TITULOS: Record<TipoGolpe, string> = {
  falso_parente: "Isso parece o golpe do falso parente",
  falsa_central: "Isso parece o golpe da falsa central",
  falso_boleto: "Essa cobrança parece falsa",
  falso_emprego: "Isso parece o golpe do falso emprego",
  falso_motoboy: "Isso parece o golpe do falso motoboy",
  link_falso: "Esse link parece falso",
  falso_investimento: "Isso parece golpe de investimento",
  compra_falsa: "Essa oferta parece compra falsa",
  outro: "Isso tem sinais de golpe",
  nenhum: "Não encontrei sinais de golpe",
};

/** Ação pronta por tipo, usada quando o LLM não respondeu ou a frase dele não serve. */
const ACOES: Record<TipoGolpe, string> = {
  falso_parente: "Não pague. Ligue para o número antigo do seu parente ou pergunte a palavra-senha da família.",
  falsa_central: "Não passe senha nem código e não transfira nada. Ligue para o banco pelo número do verso do cartão.",
  falso_boleto: "Não pague por esta mensagem. Confira a cobrança no aplicativo ou no site oficial da empresa.",
  falso_emprego: "Não envie dinheiro. Emprego de verdade não cobra taxa. Bloqueie o contato.",
  falso_motoboy: "Não entregue o cartão a ninguém e não corte o cartão. Ligue para o banco pelo número do verso do cartão.",
  link_falso: "Não clique no link. Se quiser conferir, abra o aplicativo ou o site oficial você mesma.",
  falso_investimento: "Não envie dinheiro. Lucro garantido não existe. Converse antes com seu guardião.",
  compra_falsa: "Não pague por esta mensagem. Procure a loja pelo site oficial e fale antes com seu guardião.",
  outro: "Não pague nem passe dados. Fale antes com seu guardião.",
  nenhum: "Espere um pouco e fale com seu guardião antes de fazer qualquer coisa que a mensagem pede.",
};

const ACAO_VERDE = "Pode ficar tranquila. Se depois pedirem dinheiro, senha ou código, mostre para mim de novo.";
const ACAO_AMARELA = "Não faça nada com pressa. Confira com seu guardião antes de pagar ou passar qualquer dado.";

const NEGACAO = "(?<!\\b(?:nao|nunca|jamais|sem|evite|antes de|para de|deixe de) (?:\\w+ ){0,2})";
const MANDA_PAGAR = new RegExp(
  `${NEGACAO}\\b(?:pague|pode pagar|pode transferir|pode fazer o pix|pode seguir com o pagamento|transfira|deposite|efetue|realize o pagamento|` +
    `faca o (?:pix|pagamento|deposito)|envie o (?:dinheiro|pix|valor|codigo)|(?:informe|passe|envie|digite) (?:a |sua )?senha|(?:informe|passe) o codigo)\\b`,
);

/** RN: o app nunca instrui a pagar, transferir ou passar dados. */
export function mandaPagar(frase: string): boolean {
  return MANDA_PAGAR.test(simplificar(frase));
}

function cortar(texto: string, max: number): string {
  const limpo = texto.trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Ajusta o que é só tamanho ou formato antes do schema, para um título longo demais
 * não derrubar uma análise que acertou. O que não é objeto segue adiante e o schema recusa.
 */
function sanear(bruto: unknown): unknown {
  if (typeof bruto !== "object" || bruto === null) return bruto;
  const b = bruto as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? cortar(v, max) : v);
  const sinais = Array.isArray(b.sinais)
    ? b.sinais.slice(0, 8).map((s) => {
        if (typeof s !== "object" || s === null) return s;
        const sinal = s as Record<string, unknown>;
        const codigo = typeof sinal.codigo === "string" ? simplificar(sinal.codigo).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : sinal.codigo;
        return { codigo, trecho: texto(sinal.trecho, TAMANHO_MAXIMO_TRECHO), explicacao: texto(sinal.explicacao, 300) };
      })
    : b.sinais;
  const confianca = typeof b.confianca === "number" ? Math.min(1, Math.max(0, b.confianca)) : b.confianca;
  return { risco: b.risco, tipo_golpe: b.tipo_golpe, titulo: texto(b.titulo, 60), sinais, acao: texto(b.acao, 200), confianca };
}

/** Valida a resposta do LLM. Devolve null se ela não servir (a análise sai como parcial). */
export function validarSaidaLLM(bruto: unknown): SaidaLLM | null {
  const r = SaidaLLM.safeParse(sanear(bruto));
  return r.success ? r.data : null;
}

export interface EntradaFusao {
  sinaisRegras: SinalRegra[];
  /** null quando o LLM falhou, estourou o tempo ou respondeu fora do schema. */
  saidaLLM: SaidaLLM | null;
  /** Texto que o LLM recebeu (mascarado, sem o código Pix): é nele que os trechos precisam existir. */
  texto: string;
  /** Instrução de conferir o nome no app do banco, quando há Pix. */
  instrucaoPix: string | null;
}

export function fundir({ sinaisRegras, saidaLLM, texto, instrucaoPix }: EntradaFusao): ResultadoFusao {
  const riscoRegras = riscoDasRegras(sinaisRegras);
  const parcial = saidaLLM === null;
  const risco = maiorRisco(riscoRegras, saidaLLM?.risco ?? "amarelo");

  // Sinais: união sem repetir código; os do LLM só entram se o trecho existir no texto.
  const referencia = simplificar(texto);
  const codigos = new Set(sinaisRegras.map((s) => s.codigo));
  const sinais: Sinal[] = sinaisRegras.map(({ codigo, origem, trecho, explicacao }) => ({ codigo, origem, trecho, explicacao }));
  for (const s of saidaLLM?.sinais ?? []) {
    const trecho = simplificar(s.trecho);
    if (codigos.has(s.codigo) || trecho === "" || !referencia.includes(trecho)) continue;
    codigos.add(s.codigo);
    sinais.push({ ...s, origem: "llm" });
  }

  // Tipo: vem do LLM; as regras assumem quando ele falhou ou disse "nenhum" para algo que não ficou verde.
  let tipo_golpe: TipoGolpe = saidaLLM?.tipo_golpe ?? tipoPelasRegras(sinaisRegras);
  if (risco === "verde") tipo_golpe = "nenhum";
  else if (tipo_golpe === "nenhum" && sinaisRegras.length > 0) tipo_golpe = tipoPelasRegras(sinaisRegras);

  // O texto do LLM só serve se ele chegou ao mesmo risco e não manda pagar.
  const llmConcorda = saidaLLM !== null && saidaLLM.risco === risco;
  let titulo: string;
  let acao: string;
  if (llmConcorda && !mandaPagar(saidaLLM.acao) && !mandaPagar(saidaLLM.titulo)) {
    titulo = saidaLLM.titulo;
    acao = saidaLLM.acao;
  } else if (risco === "verde") {
    titulo = TITULOS.nenhum;
    acao = ACAO_VERDE;
  } else if (risco === "amarelo") {
    titulo = parcial ? "Não consegui conferir tudo. Tenha cuidado" : "Atenção: vale conferir antes";
    acao = tipo_golpe === "nenhum" ? ACOES.nenhum : ACAO_AMARELA;
  } else {
    titulo = TITULOS[tipo_golpe === "nenhum" ? "outro" : tipo_golpe];
    acao = ACOES[tipo_golpe === "nenhum" ? "outro" : tipo_golpe];
  }
  // Pix que não ficou vermelho termina com a instrução de conferir o nome no app do banco.
  if (instrucaoPix && risco !== "vermelho") acao = cortar(instrucaoPix, 200);

  const confiancaRegras = risco === "vermelho" ? 0.8 : 0.5;
  return {
    risco,
    tipo_golpe,
    titulo: cortar(titulo, 60),
    sinais,
    acao: cortar(acao, 200),
    sugerir_palavra_senha: tipo_golpe === "falso_parente" || codigos.has("troca_numero"),
    confianca: llmConcorda ? saidaLLM.confianca : confiancaRegras,
    parcial,
  };
}
