/**
 * Teste de carga do golpe simulado do pitch (RNF03: 300 conexões simultâneas).
 *
 *   pnpm carga                      300 visitantes contra http://localhost:3000
 *   pnpm carga --url=https://… --visitantes=300 --janela=10
 *
 * Cada visitante abre o Socket.IO em /pitch, registra "acessou" e metade registra "confirmou",
 * espalhados numa janela de segundos. No fim o apresentador revela e o script mede em quanto
 * tempo todos os celulares recebem. Precisa de ADMIN_TOKEN no ambiente.
 */
import { randomBytes } from "node:crypto";
import { io, type Socket } from "socket.io-client";

const arg = (nome: string, padrao: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1] ?? padrao;
const BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const VISITANTES = Number(arg("visitantes", "300"));
const JANELA_S = Number(arg("janela", "10"));
const ADMIN = process.env.ADMIN_TOKEN ?? "";

if (!ADMIN) {
  console.error("Falta ADMIN_TOKEN no ambiente (o mesmo configurado na API).");
  process.exit(2);
}

const p95 = (valores: number[]) => [...valores].sort((a, b) => a - b)[Math.max(0, Math.ceil(valores.length * 0.95) - 1)] ?? 0;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function admin(caminho: string) {
  const r = await fetch(`${BASE}/api/v1${caminho}`, { method: "POST", headers: { authorization: `Bearer ${ADMIN}` } });
  if (!r.ok) throw new Error(`admin ${caminho}: HTTP ${r.status}`);
  return (await r.json()) as { id: string; acessaram: number; confirmaram: number };
}

const sessao = await admin("/pitch/sessoes");
console.log(`Sessão ${sessao.id} em ${BASE}: ${VISITANTES} visitantes em ${JANELA_S} s\n`);

const latenciasConexao: number[] = [];
const latenciasEvento: number[] = [];
const erros = new Map<string, number>();
const anotarErro = (motivo: string) => erros.set(motivo, (erros.get(motivo) ?? 0) + 1);
const sockets: Socket[] = [];
let revelados = 0;
let ultimoPlacar = { acessaram: 0, confirmaram: 0 };
let instanteRevelar = 0;
const temposRevelar: number[] = [];

async function evento(visitante: string, tipo: "acessou" | "confirmou") {
  const inicio = performance.now();
  try {
    const r = await fetch(`${BASE}/api/v1/pitch/sessoes/${sessao.id}/eventos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitante_id: visitante, tipo }),
    });
    if (r.status !== 202) return anotarErro(`evento HTTP ${r.status}`);
    latenciasEvento.push(performance.now() - inicio);
  } catch (e) {
    anotarErro(`evento: ${(e as Error).message}`);
  }
}

async function visitante(i: number) {
  await esperar(Math.random() * JANELA_S * 1000);
  const id = randomBytes(12).toString("base64url");
  const inicio = performance.now();
  const socket = io(`${BASE}/pitch`, { query: { sessao: sessao.id }, transports: ["websocket"], reconnection: false, timeout: 10_000 });
  sockets.push(socket);
  socket.on("pitch:contador", (p) => (ultimoPlacar = p));
  socket.on("pitch:revelar", () => {
    revelados++;
    temposRevelar.push(performance.now() - instanteRevelar);
  });
  await new Promise<void>((resolver) => {
    socket.once("connect", () => {
      latenciasConexao.push(performance.now() - inicio);
      resolver();
    });
    socket.once("connect_error", (e) => {
      anotarErro(`conexão: ${e.message}`);
      resolver();
    });
  });
  await evento(id, "acessou");
  if (i % 2 === 0) {
    await esperar(500 + Math.random() * 2000);
    await evento(id, "confirmou");
  }
}

const inicioGeral = performance.now();
await Promise.all(Array.from({ length: VISITANTES }, (_, i) => visitante(i)));
await esperar(1000);
const conectados = sockets.filter((s) => s.connected).length;
const esperado = { acessaram: VISITANTES, confirmaram: Math.ceil(VISITANTES / 2) };

instanteRevelar = performance.now();
await admin(`/pitch/sessoes/${sessao.id}/revelar`);
for (let i = 0; i < 50 && revelados < conectados; i++) await esperar(100);

console.log(`Conexões abertas ao mesmo tempo: ${conectados}/${VISITANTES} (p95 para conectar: ${Math.round(p95(latenciasConexao))} ms)`);
console.log(`Eventos aceitos: ${latenciasEvento.length}/${esperado.acessaram + esperado.confirmaram} (p95: ${Math.round(p95(latenciasEvento))} ms)`);
console.log(`Placar no painel: ${ultimoPlacar.acessaram} acessaram, ${ultimoPlacar.confirmaram} confirmaram (esperado ${esperado.acessaram} e ${esperado.confirmaram})`);
console.log(`Revelação recebida por ${revelados}/${conectados} celulares (o mais lento em ${Math.round(Math.max(0, ...temposRevelar))} ms)`);
console.log(`Duração total: ${((performance.now() - inicioGeral) / 1000).toFixed(1)} s`);
for (const [motivo, vezes] of erros) console.log(`  ! ${vezes}x ${motivo}`);

sockets.forEach((s) => s.close());
await admin(`/pitch/sessoes/${sessao.id}/reset`);

const aprovado =
  conectados === VISITANTES &&
  erros.size === 0 &&
  ultimoPlacar.acessaram === esperado.acessaram &&
  ultimoPlacar.confirmaram === esperado.confirmaram &&
  revelados === conectados &&
  Math.max(0, ...temposRevelar) <= 3000;
console.log(aprovado ? "\nCarga aprovada." : "\nCarga REPROVADA.");
process.exit(aprovado ? 0 : 1);
