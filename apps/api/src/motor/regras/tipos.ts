import type { Sinal } from "@guardiao/shared";

export type Forca = "gatilho" | "forte" | "fraco";

/** Sinal encontrado por uma regra, com a força que entra na conta do semáforo. */
export interface SinalRegra extends Sinal {
  origem: "regra";
  forca: Forca;
}
