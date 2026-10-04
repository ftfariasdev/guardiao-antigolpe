/** Leitura em voz alta pelo próprio navegador (Web Speech API), sem enviar nada para fora. */
export const temVoz = typeof window !== "undefined" && "speechSynthesis" in window;

export function falar(texto: string, lenta: boolean) {
  if (!temVoz) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = lenta ? 0.75 : 1;
  window.speechSynthesis.speak(fala);
}

export function calar() {
  if (temVoz) window.speechSynthesis.cancel();
}
