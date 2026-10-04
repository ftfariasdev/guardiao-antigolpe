import type { NivelRisco, TipoGolpe } from "@guardiao/shared";
import type { SinalRegra } from "./tipos.js";

/** Sinais que, sozinhos, já são vermelho. */
const VERMELHO_SOZINHO = new Set(["conta_segura", "portador_cartao", "pix_chave_denunciada"]);

/**
 * Risco das regras, sem pesos nem pontuação, para que qualquer pessoa entenda o porquê.
 * Verde aqui não é verde no resultado: quem confirma o verde é o LLM.
 */
export function riscoDasRegras(sinais: SinalRegra[]): NivelRisco {
  const gatilho = sinais.some((s) => s.forca === "gatilho");
  const fortes = sinais.filter((s) => s.forca === "forte").length;
  const fracos = sinais.filter((s) => s.forca === "fraco").length;

  if ((gatilho && fortes >= 1) || fortes >= 2 || sinais.some((s) => VERMELHO_SOZINHO.has(s.codigo))) return "vermelho";
  if (fortes === 1 || (gatilho && fracos >= 2) || fracos >= 3) return "amarelo";
  return "verde";
}

/** Ordem de prioridade: o primeiro sinal presente define o tipo quando o LLM não respondeu. */
const TIPO_POR_SINAL: [codigo: string | RegExp, tipo: TipoGolpe][] = [
  ["portador_cartao", "falso_motoboy"],
  ["conta_segura", "falsa_central"],
  ["falsa_central", "falsa_central"],
  ["instalar_app", "falsa_central"],
  ["troca_numero", "falso_parente"],
  [/^pix_/, "falso_boleto"],
  ["link_suspeito", "link_falso"],
  ["taxa_liberacao", "falso_emprego"],
  ["ganho_irreal", "falso_investimento"],
];

export function tipoPelasRegras(sinais: SinalRegra[]): TipoGolpe {
  // Sem risco pelas regras não há golpe a nomear (um "oi mãe" sozinho não é golpe).
  if (riscoDasRegras(sinais) === "verde") return "nenhum";
  for (const [codigo, tipo] of TIPO_POR_SINAL) {
    if (sinais.some((s) => (typeof codigo === "string" ? s.codigo === codigo : codigo.test(s.codigo)))) return tipo;
  }
  return "outro";
}
