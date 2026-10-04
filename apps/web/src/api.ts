import { ResultadoAnalise } from "@guardiao/shared";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** A tela mostra o resultado ou um aviso de cautela; nunca um verde que a API não deu. */
export async function analisarMensagem(texto: string, sinal: AbortSignal): Promise<ResultadoAnalise> {
  const resposta = await fetch(`${BASE}/api/v1/analises`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tipo_entrada: "texto", texto }),
    signal: sinal,
  });
  if (!resposta.ok) throw new Error(`api_${resposta.status}`);
  return ResultadoAnalise.parse(await resposta.json());
}
