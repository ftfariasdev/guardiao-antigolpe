import { useEffect, useState } from "react";
import { roteiro } from "./roteiro";

/** Esqueleto do D6: navegação por teclado sobre o roteiro. Cenas 3D entram no D7. */
export function App() {
  const [indice, setIndice] = useState(0);
  const slide = roteiro[indice]!;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) setIndice((i) => Math.min(i + 1, roteiro.length - 1));
      if (["ArrowLeft", "PageUp"].includes(e.key)) setIndice((i) => Math.max(i - 1, 0));
      if (e.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <main
      aria-live="polite"
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--cor-fundo)",
        color: "var(--cor-texto)",
        fontFamily: "var(--fonte-titulo)",
        textAlign: "center",
        padding: "0 8vw",
      }}
    >
      <h1 style={{ fontSize: "var(--texto-titulo)", margin: 0 }}>{slide.titulo}</h1>
      <p style={{ position: "fixed", bottom: 24, right: 32, color: "var(--cor-texto-secundario)" }}>
        {indice + 1} / {roteiro.length}
      </p>
    </main>
  );
}
