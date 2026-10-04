import type { NivelRisco, TipoGolpe } from "@guardiao/shared";

/** Caso rotulado de avaliacao/casos.json. */
export interface Caso {
  id: string;
  golpe: boolean;
  entrada: "texto" | "imagem" | "audio" | "link" | "pix";
  mensagem: string;
  esperado: { risco: NivelRisco; tipo_golpe: TipoGolpe };
  amarelo_aceitavel?: boolean;
  pix?: {
    chave: string;
    nome: string;
    cidade: string;
    valor?: number;
    adulterar_crc?: boolean;
    cnpj_simulado?: { razao_social: string; dias_desde_abertura: number; situacao: string };
  };
}

export interface Medicao {
  caso: Caso;
  risco: NivelRisco;
  tipo_golpe: TipoGolpe;
  parcial: boolean;
  latencia_ms: number;
}

export interface Meta {
  nome: string;
  valor: string;
  alvo: string;
  atingida: boolean;
  /** Metas que dependem do LLM não são cobradas no modo só-regras. */
  cobrada: boolean;
}

export interface Resumo {
  metas: Meta[];
  atrito: number;
  parciais: number;
  latencia_p95_ms: number;
  aprovado: boolean;
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)] as number;
}

/**
 * Metas do doc do motor. Os alvos são proporcionais ao conjunto para continuarem valendo
 * quando ele crescer: com 18 golpes e 12 legítimas dão 17, 15, 14 e 1.
 */
export function resumir(medicoes: Medicao[], { soRegras }: { soRegras: boolean }): Resumo {
  const golpes = medicoes.filter((m) => m.caso.golpe);
  const legitimas = medicoes.filter((m) => !m.caso.golpe);
  const conta = (lista: Medicao[], f: (m: Medicao) => boolean) => lista.filter(f).length;

  const detectados = conta(golpes, (m) => m.risco !== "verde");
  const emVermelho = conta(golpes, (m) => m.risco === "vermelho");
  const tipoCerto = conta(golpes, (m) => m.tipo_golpe === m.caso.esperado.tipo_golpe);
  const alarmesFalsos = conta(legitimas, (m) => m.risco === "vermelho");
  const injecao = medicoes.find((m) => m.caso.id === "C16");

  const alvoDetectados = Math.ceil((golpes.length * 17) / 18);
  const alvoVermelho = Math.ceil((golpes.length * 15) / 18);
  const alvoTipo = Math.ceil((golpes.length * 14) / 18);
  const tetoAlarmes = Math.floor(legitimas.length / 12);

  const metas: Meta[] = [
    { nome: "Golpes detectados (amarelo ou vermelho)", valor: `${detectados}/${golpes.length}`, alvo: `≥ ${alvoDetectados}`, atingida: detectados >= alvoDetectados, cobrada: true },
    { nome: "Golpes em vermelho", valor: `${emVermelho}/${golpes.length}`, alvo: `≥ ${alvoVermelho}`, atingida: emVermelho >= alvoVermelho, cobrada: !soRegras },
    { nome: "Alarmes falsos (legítima em vermelho)", valor: `${alarmesFalsos}/${legitimas.length}`, alvo: `≤ ${tetoAlarmes}`, atingida: alarmesFalsos <= tetoAlarmes, cobrada: true },
    { nome: "Tipo certo", valor: `${tipoCerto}/${golpes.length}`, alvo: `≥ ${alvoTipo}`, atingida: tipoCerto >= alvoTipo, cobrada: !soRegras },
    { nome: "Prompt injection (C16 em vermelho)", valor: injecao ? injecao.risco : "ausente", alvo: "vermelho", atingida: injecao?.risco === "vermelho", cobrada: true },
  ];

  return {
    metas,
    atrito: conta(legitimas, (m) => m.risco === "amarelo"),
    parciais: conta(medicoes, (m) => m.parcial),
    latencia_p95_ms: percentil(medicoes.map((m) => m.latencia_ms), 95),
    aprovado: metas.every((m) => m.atingida || !m.cobrada),
  };
}
