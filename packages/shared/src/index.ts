import { z } from "zod";

/* ---------- Domínio ---------- */

export const NivelRisco = z.enum(["verde", "amarelo", "vermelho"]);
export type NivelRisco = z.infer<typeof NivelRisco>;

export const TipoGolpe = z.enum([
  "falso_parente",
  "falsa_central",
  "falso_boleto",
  "falso_emprego",
  "falso_motoboy",
  "link_falso",
  "falso_investimento",
  "compra_falsa",
  "outro",
  "nenhum",
]);
export type TipoGolpe = z.infer<typeof TipoGolpe>;

export const TipoEntrada = z.enum(["texto", "imagem", "audio", "link", "pix"]);
export type TipoEntrada = z.infer<typeof TipoEntrada>;

export const Papel = z.enum(["protegido", "guardiao"]);
export type Papel = z.infer<typeof Papel>;

export const RespostaAlerta = z.enum(["era_golpe", "pode_seguir"]);
export type RespostaAlerta = z.infer<typeof RespostaAlerta>;

const ordemRisco: Record<NivelRisco, number> = { verde: 0, amarelo: 1, vermelho: 2 };
/** Maior risco entre dois níveis (regra de fusão RN01). */
export function maiorRisco(a: NivelRisco, b: NivelRisco): NivelRisco {
  return ordemRisco[a] >= ordemRisco[b] ? a : b;
}

/* ---------- Análise ---------- */

export const Sinal = z.object({
  codigo: z.string().regex(/^[a-z0-9_]+$/),
  origem: z.enum(["regra", "llm"]),
  /** Trecho exato da mensagem que disparou o sinal. */
  trecho: z.string().min(1).max(200),
  explicacao: z.string().min(1).max(300),
});
export type Sinal = z.infer<typeof Sinal>;

export const DadosPix = z.object({
  chave: z.string().nullable(),
  tipo_chave: z.enum(["cpf", "cnpj", "telefone", "email", "aleatoria", "desconhecida"]),
  nome_declarado: z.string().nullable(),
  cidade: z.string().nullable(),
  valor: z.number().nullable(),
  crc_valido: z.boolean(),
  cnpj: z
    .object({
      razao_social: z.string(),
      data_abertura: z.string(),
      situacao: z.string(),
    })
    .nullable(),
});
export type DadosPix = z.infer<typeof DadosPix>;

export const ResultadoAnalise = z.object({
  id: z.string().uuid(),
  risco: NivelRisco,
  tipo_golpe: TipoGolpe,
  titulo: z.string().max(60),
  sinais: z.array(Sinal),
  acao: z.string().max(200),
  sugerir_palavra_senha: z.boolean(),
  confianca: z.number().min(0).max(1),
  parcial: z.boolean(),
  pix: DadosPix.nullable(),
  alerta: z
    .object({
      id: z.string().uuid(),
      status: z.enum(["enviado", "visto", "respondido", "expirado"]),
      guardiao: z.string(),
    })
    .nullable(),
});
export type ResultadoAnalise = z.infer<typeof ResultadoAnalise>;

/** Entrada da ferramenta registrar_analise que o LLM chama. */
export const SaidaLLM = z.object({
  risco: NivelRisco,
  tipo_golpe: TipoGolpe,
  titulo: z.string().max(60),
  sinais: z.array(Sinal.omit({ origem: true })).max(8),
  acao: z.string().max(200),
  confianca: z.number().min(0).max(1),
});
export type SaidaLLM = z.infer<typeof SaidaLLM>;

/* ---------- Erros da API ---------- */

export const ErroApi = z.object({
  erro: z.object({ codigo: z.string(), mensagem: z.string() }),
});
export type ErroApi = z.infer<typeof ErroApi>;

/* ---------- Tempo real (Socket.IO) ---------- */

export interface AlertaNovo {
  alerta_id: string;
  risco: NivelRisco;
  tipo_golpe: TipoGolpe;
  resumo: string;
  valor: number | null;
  protegido: string;
}

/** Namespace /familia — o servidor só emite; ações entram pela API REST. */
export interface EventosFamilia {
  "alerta:novo": (dados: AlertaNovo) => void;
  "alerta:respondido": (dados: { alerta_id: string; resposta: RespostaAlerta; guardiao: string }) => void;
  "alerta:escalado": (dados: { alerta_id: string; proximo_guardiao: string }) => void;
  "treino:novo": (dados: { treino_id: string; conteudo: string }) => void;
}

/** Namespace /pitch. */
export interface EventosPitch {
  "pitch:contador": (dados: { acessaram: number; confirmaram: number }) => void;
  "pitch:revelar": () => void;
  "pitch:reset": () => void;
}
