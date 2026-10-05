import { z } from "zod";
import type { InfoCnpj } from "../motor/index.js";

const RespostaBrasilApi = z.object({
  razao_social: z.string().min(1),
  data_inicio_atividade: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  descricao_situacao_cadastral: z.string().min(1),
  municipio: z.string().nullish(),
});

const TEMPO_LIMITE_MS = 3000;
const VALIDADE_CACHE_MS = 60 * 60 * 1000;
// A BrasilAPI recusa (403) pedidos sem um User-Agent que identifique o cliente.
const CABECALHOS = { accept: "application/json", "user-agent": "GuardiaoAntigolpe/0.1 (+https://guardiao-antigolpe.vercel.app)" };

type Buscar = (url: string, opcoes: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Consulta pública de CNPJ na BrasilAPI (gratuita, sem chave). Se a API cair, demorar ou
 * responder algo inesperado, devolve null: a análise segue sem esse sinal e avisa que
 * não deu para conferir a empresa.
 */
export function criarConsultaCnpj(buscar: Buscar = fetch, agora: () => number = Date.now) {
  const cache = new Map<string, { info: InfoCnpj; ate: number }>();

  return async (cnpj: string): Promise<InfoCnpj | null> => {
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) return null;
    const guardado = cache.get(digitos);
    if (guardado && guardado.ate > agora()) return guardado.info;
    try {
      const resposta = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), headers: CABECALHOS });
      if (!resposta.ok) return null;
      const dados = RespostaBrasilApi.parse(await resposta.json());
      const info: InfoCnpj = {
        razao_social: dados.razao_social,
        data_abertura: dados.data_inicio_atividade.slice(0, 10),
        situacao: dados.descricao_situacao_cadastral,
        municipio: dados.municipio ?? null,
      };
      cache.set(digitos, { info, ate: agora() + VALIDADE_CACHE_MS });
      return info;
    } catch {
      return null;
    }
  };
}
