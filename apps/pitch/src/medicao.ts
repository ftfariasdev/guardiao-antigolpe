/**
 * Números do slide 10, copiados do resumo de `pnpm avaliar` (motor completo, com o LLM).
 * Enquanto a medição com o LLM não rodar, ficam nulos e o slide mostra um traço:
 * número de medição só-regras não vale aqui, porque sem o LLM tudo sai no mínimo amarelo.
 */
export const medicao: { golpesDetectados: number; golpes: number; legitimas: number; alarmesFalsos: number } | null = null;
