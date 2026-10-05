/**
 * Perfil de demonstração. Com `?perfil=cida` ou `?perfil=ana` no endereço, o app guarda a sessão
 * e os ajustes numa gaveta separada. É o que deixa o slide 7 do pitch mostrar a Dona Cida e a Ana
 * lado a lado no mesmo navegador. Sem o parâmetro, nada muda.
 */
const bruto = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("perfil");
export const PERFIL = bruto && /^[a-z0-9]{1,20}$/.test(bruto) ? bruto : null;

export function chaveDoPerfil(base: string): string {
  return PERFIL ? `${base}:${PERFIL}` : base;
}

/**
 * Dentro da moldura do pitch, as teclas de passar slide voltam para a apresentação.
 * Sem isso, depois de clicar na moldura o passador de slides ficaria preso nela.
 */
export function repassarTeclasAoPitch() {
  if (!PERFIL || window.parent === window) return;
  window.addEventListener("keydown", (e) => {
    const digitando = e.target instanceof HTMLElement && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT");
    if (digitando || !["ArrowRight", "ArrowLeft", "PageDown", "PageUp"].includes(e.key)) return;
    e.preventDefault();
    window.parent.postMessage({ tipo: "guardiao-pitch-tecla", tecla: e.key }, "*");
  });
}
