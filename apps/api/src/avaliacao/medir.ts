/**
 * Mede o acerto do motor nos casos rotulados de avaliacao/casos.json.
 *
 *   pnpm avaliar               motor completo (precisa de ANTHROPIC_API_KEY)
 *   pnpm avaliar --so-regras   só as regras, sem chamar o LLM
 *
 * Imprime uma linha por caso e um resumo; sai com código 1 se alguma meta não for atingida.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarBRCode } from "@guardiao/brcode";
import { analisar, type DependenciasMotor, type InfoCnpj } from "../motor/index.js";
import { criarProvedorAnthropic } from "../motor/llm/anthropic.js";
import { resumir, type Caso, type Medicao } from "./metricas.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const ARQUIVO_CASOS = resolve(aqui, "../../../../avaliacao/casos.json");
const SIMULTANEOS = 4;

function montarTexto(caso: Caso): string {
  if (!caso.pix) return caso.mensagem;
  let codigo = gerarBRCode(caso.pix);
  if (caso.pix.adulterar_crc) {
    const ultimo = codigo.slice(-1);
    codigo = codigo.slice(0, -1) + (ultimo === "0" ? "1" : "0");
  }
  return `${caso.mensagem}\n${codigo}`;
}

function cnpjSimulado(casos: Caso[], agora: Date): DependenciasMotor["consultarCnpj"] {
  const porChave = new Map<string, InfoCnpj>();
  for (const { pix } of casos) {
    if (!pix?.cnpj_simulado) continue;
    const abertura = new Date(agora.getTime() - pix.cnpj_simulado.dias_desde_abertura * 86_400_000);
    porChave.set(pix.chave, {
      razao_social: pix.cnpj_simulado.razao_social,
      data_abertura: abertura.toISOString().slice(0, 10),
      situacao: pix.cnpj_simulado.situacao,
    });
  }
  return async (cnpj) => porChave.get(cnpj) ?? null;
}

async function emLotes<T, R>(itens: T[], tamanho: number, f: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(f))));
  }
  return saida;
}

const soRegras = process.argv.includes("--so-regras");
const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
if (!soRegras && !apiKey) {
  console.error("Falta ANTHROPIC_API_KEY no .env. Para medir só as regras, use: pnpm avaliar --so-regras");
  process.exit(2);
}

const { casos } = JSON.parse(readFileSync(ARQUIVO_CASOS, "utf8")) as { casos: Caso[] };
const agora = new Date();
const modelo = process.env.LLM_MODEL || "claude-opus-5-5";
const timeoutLlmMs = Number(process.env.LLM_TIMEOUT_MS) || 8000;
const deps: DependenciasMotor = {
  llm: soRegras ? null : criarProvedorAnthropic({ apiKey, modelo, timeoutMs: timeoutLlmMs }),
  timeoutLlmMs,
  consultarCnpj: cnpjSimulado(casos, agora),
  agora: () => agora,
};

console.log(soRegras ? "Modo: só regras (sem LLM)\n" : `Modo: motor completo (${modelo}, timeout ${timeoutLlmMs} ms)\n`);

const medicoes: Medicao[] = await emLotes(casos, SIMULTANEOS, async (caso) => {
  const r = await analisar({ tipo_entrada: caso.entrada, texto: montarTexto(caso) }, deps);
  return { caso, risco: r.risco, tipo_golpe: r.tipo_golpe, parcial: r.parcial, latencia_ms: r.latencia_ms };
});

for (const m of medicoes) {
  const riscoOk = m.caso.golpe
    ? m.risco === m.caso.esperado.risco
    : m.risco === "verde" || (m.risco === "amarelo" && m.caso.amarelo_aceitavel === true);
  const tipoOk = m.tipo_golpe === m.caso.esperado.tipo_golpe;
  console.log(
    [
      m.caso.id,
      m.caso.golpe ? "golpe   " : "legítima",
      `${riscoOk ? "✓" : "✗"} ${m.risco.padEnd(8)} (esperado ${m.caso.esperado.risco})`.padEnd(32),
      `${tipoOk ? "✓" : "✗"} ${m.tipo_golpe}`.padEnd(22),
      m.parcial ? "parcial" : "       ",
      `${m.latencia_ms} ms`,
    ].join("  "),
  );
}

const resumo = resumir(medicoes, { soRegras });
console.log("\nResumo");
for (const meta of resumo.metas) {
  const marca = meta.atingida ? "✓" : meta.cobrada ? "✗" : "–";
  console.log(`  ${marca} ${meta.nome}: ${meta.valor} (meta ${meta.alvo})${meta.cobrada ? "" : "  [não cobrada sem o LLM]"}`);
}
console.log(`  · Atrito (legítima em amarelo): ${resumo.atrito}`);
console.log(`  · Análises parciais: ${resumo.parciais}/${medicoes.length}`);
console.log(`  · Latência p95: ${resumo.latencia_p95_ms} ms`);
console.log(resumo.aprovado ? "\nMetas atingidas." : "\nMetas NÃO atingidas.");
process.exit(resumo.aprovado ? 0 : 1);
