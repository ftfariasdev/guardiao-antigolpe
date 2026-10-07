import {
  AlertaDetalhe,
  ConviteCriado,
  DadosSessao,
  ItemHistorico,
  ModeloTreino,
  ResultadoAnalise,
  SessaoAberta,
  SessaoAtual,
  SessaoCriada,
  SessaoPitch,
  TreinoDetalhe,
  type AceitarConvite,
  type CriarConta,
  type CriarFamilia,
  type DefinirConta,
  type Entrar,
  type InscricaoPush,
  type Papel,
  type RespostaAlerta,
  type TipoEntrada,
} from "@guardiao/shared";
import { z } from "zod";

export const BASE_API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

interface Opcoes {
  token?: string;
  corpo?: object;
  sinal?: AbortSignal;
}

async function pedir<T>(metodo: string, caminho: string, esquema: z.ZodType<T, z.ZodTypeDef, unknown> | null, { token, corpo, sinal }: Opcoes = {}): Promise<T> {
  const resposta = await fetch(`${BASE_API}/api/v1${caminho}`, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: sinal,
  });
  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => null)) as { erro?: { codigo?: string; mensagem?: string } } | null;
    throw new ErroApi(resposta.status, erro?.erro?.codigo ?? "erro", erro?.erro?.mensagem ?? "Algo deu errado. Tente de novo.");
  }
  if (!esquema) return undefined as T;
  return esquema.parse(await resposta.json());
}

export const api = {
  criarConta: (dados: CriarConta) => pedir("POST", "/contas", SessaoAberta, { corpo: dados }),
  /** Com `token` (quem já fez login), a família ou o convite ficam ligados à conta. */
  criarFamilia: (dados: CriarFamilia, token?: string) => pedir("POST", "/familias", SessaoCriada, { corpo: dados, token }),
  aceitarConvite: (convite: string, dados: AceitarConvite, token?: string) => pedir("POST", `/convites/${encodeURIComponent(convite)}/aceitar`, SessaoCriada, { corpo: dados, token }),
  sessao: (token: string) => pedir("GET", "/sessao", SessaoAtual, { token }),
  entrar: (dados: Entrar) => pedir("POST", "/sessoes", SessaoAberta, { corpo: dados }),
  sair: (token: string) => pedir("DELETE", "/sessao", null, { token }),
  definirConta: (token: string, dados: DefinirConta) => pedir("PUT", "/conta", DadosSessao, { token, corpo: dados }),
  criarConvite: (token: string, familiaId: string, papel: Papel) => pedir("POST", `/familias/${familiaId}/convites`, ConviteCriado, { token, corpo: { papel } }),
  definirPalavraSenha: (token: string, familiaId: string, palavra: string) => pedir("PUT", `/familias/${familiaId}/palavra-senha`, null, { token, corpo: { palavra } }),
  inscreverPush: (token: string, membroId: string, inscricao: InscricaoPush | null) => pedir("PATCH", `/membros/${membroId}`, DadosSessao, { token, corpo: { push_subscription: inscricao } }),
  chavePush: () => pedir("GET", "/push/chave-publica", z.object({ chave: z.string().nullable() })),
  /** A tela mostra o resultado ou um aviso de cautela; nunca um verde que a API não deu. */
  analisar: (token: string, texto: string, tipo: TipoEntrada, sinal: AbortSignal) => pedir("POST", "/analises", ResultadoAnalise, { token, corpo: { tipo_entrada: tipo, texto }, sinal }),
  sessaoPitchAtual: () => pedir("GET", "/pitch/sessoes/atual", SessaoPitch),
  sessaoPitch: (id: string) => pedir("GET", `/pitch/sessoes/${id}`, SessaoPitch),
  eventoPitch: (id: string, visitante_id: string, tipo: "acessou" | "confirmou") => pedir("POST", `/pitch/sessoes/${id}/eventos`, null, { corpo: { visitante_id, tipo } }),
  modelosDeTreino: (token: string) => pedir("GET", "/treinos/modelos", z.object({ itens: z.array(ModeloTreino) }), { token }),
  enviarTreino: (token: string, modelo: string) => pedir("POST", "/treinos", TreinoDetalhe, { token, corpo: { modelo } }),
  treinos: (token: string) => pedir("GET", "/treinos", z.object({ itens: z.array(TreinoDetalhe) }), { token }),
  responderTreino: (token: string, id: string, resultado: "encaminhou" | "caiu" | "ignorou") => pedir("POST", `/treinos/${id}/resultado`, TreinoDetalhe, { token, corpo: { resultado } }),
  analise: (token: string, id: string) => pedir("GET", `/analises/${id}`, ResultadoAnalise, { token }),
  historico: (token: string, familiaId: string) => pedir("GET", `/familias/${familiaId}/historico?limite=5`, z.object({ itens: z.array(ItemHistorico) }), { token }),
  alertasPendentes: (token: string) => pedir("GET", "/alertas/pendentes", z.object({ itens: z.array(AlertaDetalhe) }), { token }),
  alerta: (token: string, id: string) => pedir("GET", `/alertas/${id}`, AlertaDetalhe, { token }),
  marcarVisto: (token: string, id: string) => pedir("POST", `/alertas/${id}/visto`, AlertaDetalhe, { token }),
  responder: (token: string, id: string, resposta: RespostaAlerta) => pedir("POST", `/alertas/${id}/responder`, AlertaDetalhe, { token, corpo: { resposta } }),
};
