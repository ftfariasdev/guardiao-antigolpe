/**
 * Números do slide 10, copiados do resumo de `pnpm avaliar`.
 *
 * Hoje valem os da medição só com as regras (`pnpm avaliar --so-regras`). Nesse modo toda análise
 * sai no mínimo amarela, então "detectados" não diz nada: o número que vale é o de golpes em vermelho.
 * Quando a medição com o LLM rodar, troque o modo para "completo" e copie o resumo de novo.
 */
export interface MedicaoDoMotor {
  modo: "regras" | "completo";
  golpes: number;
  legitimas: number;
  /** Golpes em amarelo ou vermelho. Só aparece no modo "completo". */
  golpesDetectados: number;
  golpesEmVermelho: number;
  /** Mensagens legítimas em vermelho. */
  alarmesFalsos: number;
}

export const medicao: MedicaoDoMotor | null = {
  modo: "regras",
  golpes: 36,
  legitimas: 24,
  golpesDetectados: 36,
  golpesEmVermelho: 28,
  alarmesFalsos: 0,
};
