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
      resposta: RespostaAlerta.nullable().default(null),
    })
    .nullable(),
});
export type ResultadoAnalise = z.infer<typeof ResultadoAnalise>;

/**
 * Corpo de POST /analises enquanto a rota só recebe texto (mensagem colada, link ou Pix copia e cola).
 * Print e áudio entram como multipart junto com OCR e transcrição.
 */
export const PedidoAnalise = z.object({
  tipo_entrada: TipoEntrada.default("texto"),
  texto: z.string().trim().min(1).max(5000),
});
export type PedidoAnalise = z.infer<typeof PedidoAnalise>;

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

/* ---------- Família, sessão e convites ---------- */

const Nome = z.string().trim().min(1).max(60);
const Parentesco = z.string().trim().min(1).max(30);

export const MembroResumo = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  parentesco: z.string().nullable(),
  papel: Papel,
  /** Ordem de acionamento dos guardiões (1 = primeiro). */
  ordem: z.number().int(),
});
export type MembroResumo = z.infer<typeof MembroResumo>;

export const FamiliaResumo = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  /** A palavra-senha nunca é devolvida; só se sabe se existe. */
  tem_palavra_senha: z.boolean(),
  /** Pontos de escudo somados nos treinos. */
  escudos: z.number().int().default(0),
  membros: z.array(MembroResumo),
});
export type FamiliaResumo = z.infer<typeof FamiliaResumo>;

/** `tem_conta`: a pessoa já tem e-mail e senha e consegue entrar em outro aparelho. */
export const DadosSessao = z.object({ membro: MembroResumo, familia: FamiliaResumo, tem_conta: z.boolean() });
export type DadosSessao = z.infer<typeof DadosSessao>;

/** Resposta de criar família e de aceitar convite: o token só aparece aqui, uma vez. */
export const SessaoCriada = DadosSessao.extend({ token: z.string().min(32) });
export type SessaoCriada = z.infer<typeof SessaoCriada>;

/** Login do guardião. O e-mail é guardado em minúsculas; a senha, só como hash argon2id. */
export const Email = z.string().trim().toLowerCase().email().max(120);
export const Senha = z.string().min(8).max(100);

/** E-mail e senha vêm juntos ou não vêm: sem eles a sessão vale só no aparelho que criou a família. */
export const CriarFamilia = z
  .object({ nome_familia: Nome, nome: Nome, parentesco: Parentesco.optional(), email: Email.optional(), senha: Senha.optional() })
  .refine((d) => (d.email === undefined) === (d.senha === undefined), { message: "Informe e-mail e senha juntos." });
export type CriarFamilia = z.infer<typeof CriarFamilia>;

export const Entrar = z.object({ email: Email, senha: z.string().min(1).max(100) });
export type Entrar = z.infer<typeof Entrar>;

export const DefinirConta = z.object({ email: Email, senha: Senha });
export type DefinirConta = z.infer<typeof DefinirConta>;

export const CriarConvite = z.object({ papel: Papel });
export const ConviteCriado = z.object({ token: z.string().min(32), papel: Papel, expira_em: z.string() });
export type ConviteCriado = z.infer<typeof ConviteCriado>;

export const AceitarConvite = z.object({ nome: Nome, parentesco: Parentesco.optional() });
export type AceitarConvite = z.infer<typeof AceitarConvite>;

export const DefinirPalavraSenha = z.object({ palavra: z.string().trim().min(3).max(60) });

export const InscricaoPush = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type InscricaoPush = z.infer<typeof InscricaoPush>;

export const AtualizarMembro = z
  .object({
    ordem: z.number().int().min(1).max(3),
    push_subscription: InscricaoPush.nullable(),
    acessibilidade: z.record(z.unknown()),
  })
  .partial();
export type AtualizarMembro = z.infer<typeof AtualizarMembro>;

/* ---------- Alertas ---------- */

export const StatusAlerta = z.enum(["enviado", "visto", "respondido", "expirado"]);
export type StatusAlerta = z.infer<typeof StatusAlerta>;

export const ResponderAlerta = z.object({ resposta: RespostaAlerta });

/** O que o guardião vê ao abrir um alerta. */
export const AlertaDetalhe = z.object({
  id: z.string().uuid(),
  status: StatusAlerta,
  resposta: RespostaAlerta.nullable(),
  nivel: z.number().int(),
  criado_em: z.string(),
  protegido: z.object({ nome: z.string(), parentesco: z.string().nullable() }),
  /** Quem será avisado se este guardião não responder; null se não houver. */
  proximo_guardiao: z.string().nullable(),
  valor: z.number().nullable(),
  analise: ResultadoAnalise,
});
export type AlertaDetalhe = z.infer<typeof AlertaDetalhe>;

export const ItemHistorico = z.object({
  id: z.string().uuid(),
  criado_em: z.string(),
  risco: NivelRisco,
  tipo_golpe: TipoGolpe,
  titulo: z.string(),
  alerta: z.object({ id: z.string().uuid(), status: StatusAlerta, resposta: RespostaAlerta.nullable(), guardiao: z.string() }).nullable(),
});
export type ItemHistorico = z.infer<typeof ItemHistorico>;

/* ---------- Treino ("vacina") ---------- */

export const ResultadoTreino = z.enum(["pendente", "encaminhou", "caiu", "ignorou"]);
export type ResultadoTreino = z.infer<typeof ResultadoTreino>;

/** Modelo de golpe simulado, do JSON versionado no repositório. */
export const ModeloTreino = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  titulo: z.string(),
  tipo_golpe: TipoGolpe,
  /** Mensagem simulada mostrada dentro do app, nunca por SMS ou WhatsApp. */
  conteudo: z.string(),
  /** O que a pessoa aprende, mostrado depois da escolha. */
  licao: z.string(),
});
export type ModeloTreino = z.infer<typeof ModeloTreino>;

export const EnviarTreino = z.object({ modelo: z.string().min(1) });
export const RegistrarResultadoTreino = z.object({ resultado: z.enum(["encaminhou", "caiu", "ignorou"]) });

export const TreinoDetalhe = z.object({
  id: z.string().uuid(),
  modelo: z.string(),
  titulo: z.string(),
  conteudo: z.string(),
  licao: z.string(),
  resultado: ResultadoTreino,
  pontos: z.number().int(),
  enviado_por: z.string(),
  criado_em: z.string(),
});
export type TreinoDetalhe = z.infer<typeof TreinoDetalhe>;

/* ---------- Golpe simulado do pitch ---------- */

export const StatusPitch = z.enum(["aberta", "revelada", "encerrada"]);
export const TipoEventoPitch = z.enum(["acessou", "confirmou"]);

/** Nenhum dado pessoal: só um identificador aleatório gerado no navegador e o tipo do evento. */
export const EventoPitch = z.object({
  visitante_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  tipo: TipoEventoPitch,
});
export type EventoPitch = z.infer<typeof EventoPitch>;

export const SessaoPitch = z.object({
  id: z.string().uuid(),
  status: StatusPitch,
  acessaram: z.number().int(),
  confirmaram: z.number().int(),
});
export type SessaoPitch = z.infer<typeof SessaoPitch>;

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
export * from "./demo.js";
