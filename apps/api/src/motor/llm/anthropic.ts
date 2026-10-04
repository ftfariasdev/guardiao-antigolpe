import Anthropic from "@anthropic-ai/sdk";
import { FERRAMENTA, NOME_FERRAMENTA, montarMensagemUsuario, sistemaComExemplos } from "./prompt.js";
import type { PedidoLLM, ProvedorLLM } from "./provedor.js";

export interface OpcoesAnthropic {
  apiKey: string;
  modelo: string;
  timeoutMs: number;
}

/** Só o Haiku 4.5 ainda aceita temperatura; nos modelos novos o parâmetro é recusado. */
const aceitaTemperatura = (modelo: string) => modelo.startsWith("claude-haiku");

/** Modelos com classificadores de segurança que aceitam o fallback automático do servidor. */
const aceitaFallback = (modelo: string) => /^claude-(opus-5|sonnet-5-5|fable-5)/.test(modelo);

export function criarProvedorAnthropic({ apiKey, modelo, timeoutMs }: OpcoesAnthropic): ProvedorLLM {
  // Sem novas tentativas: o motor tem 8 s no total e, se falhar, as regras respondem.
  const cliente = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  const sistema = sistemaComExemplos();

  return {
    async analisar(pedido: PedidoLLM, sinal: AbortSignal): Promise<unknown> {
      const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (pedido.imagem) {
        conteudo.push({ type: "image", source: { type: "base64", media_type: pedido.imagem.media_type, data: pedido.imagem.base64 } });
      }
      conteudo.push({ type: "text", text: montarMensagemUsuario(pedido) });

      const resposta = await cliente.beta.messages.create(
        {
          model: modelo,
          // No Haiku vale o limite do doc (800). Nos modelos com raciocínio sempre ligado,
          // o raciocínio entra na conta, então o teto precisa de folga.
          max_tokens: aceitaTemperatura(modelo) ? 800 : 4096,
          ...(aceitaTemperatura(modelo) ? { temperature: 0 } : { output_config: { effort: "low" as const } }),
          ...(aceitaFallback(modelo) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
          system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
          tools: [FERRAMENTA],
          // Forçar a ferramenta é recusado nos modelos novos; o prompt manda chamá-la
          // e `strict` garante o formato dos argumentos.
          tool_choice: { type: "auto", disable_parallel_tool_use: true },
          messages: [{ role: "user", content: conteudo }],
        },
        { signal: sinal },
      );

      if (resposta.stop_reason === "refusal") throw new Error("llm_recusou");
      const chamada = resposta.content.find((bloco) => bloco.type === "tool_use" && bloco.name === NOME_FERRAMENTA);
      if (!chamada || chamada.type !== "tool_use") throw new Error("llm_sem_ferramenta");
      return chamada.input;
    },
  };
}
