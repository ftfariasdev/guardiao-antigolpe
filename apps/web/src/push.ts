import { InscricaoPush } from "@guardiao/shared";
import { api } from "./api";

export const temPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function chaveEmBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const texto = atob(base64);
  const saida = new Uint8Array(new ArrayBuffer(texto.length));
  for (let i = 0; i < texto.length; i++) saida[i] = texto.charCodeAt(i);
  return saida;
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export type ResultadoPush = "ativado" | "negado" | "indisponivel";

/** Pede permissão, inscreve este aparelho e manda a inscrição para a API. Precisa de um toque do usuário. */
export async function ativarAvisos(token: string, membroId: string): Promise<ResultadoPush> {
  if (!temPush) return "indisponivel";
  const { chave } = await api.chavePush();
  const registro = await registrarServiceWorker();
  if (!chave || !registro) return "indisponivel";
  if ((await Notification.requestPermission()) !== "granted") return "negado";
  const inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) });
  await api.inscreverPush(token, membroId, InscricaoPush.parse(inscricao.toJSON()));
  return "ativado";
}

export async function avisosAtivos(): Promise<boolean> {
  if (!temPush || Notification.permission !== "granted") return false;
  const registro = await navigator.serviceWorker.getRegistration();
  return Boolean(await registro?.pushManager.getSubscription());
}
