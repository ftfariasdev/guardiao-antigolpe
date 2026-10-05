/** Configuração do notebook do palco (apps/pitch/.env.local, fora do Git). */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Endereço do app (PWA): alvo do QR da plateia e conteúdo das molduras da demo. */
export const APP_URL = (import.meta.env.VITE_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
/** Token do apresentador. Só existe no build local do palco; este build nunca vai para a internet. */
export const ADMIN_TOKEN: string = import.meta.env.VITE_ADMIN_TOKEN ?? "";
export const REPO_URL = "https://github.com/ftfariasdev/guardiao-antigolpe";
