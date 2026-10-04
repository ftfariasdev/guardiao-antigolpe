import { useEffect, useState } from "react";

type Saude = "verificando" | "ok" | "fora";

/** Tela provisória do D1: confirma que app, marca e API estão conectados. */
export function App() {
  const [saude, setSaude] = useState<Saude>("verificando");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/v1/saude`)
      .then((r) => setSaude(r.ok ? "ok" : "fora"))
      .catch(() => setSaude("fora"));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--espaco-4)" }}>
      <h1 style={{ fontFamily: "var(--fonte-titulo)" }}>Olá, Dona Cida</h1>
      <p style={{ color: "var(--cor-texto-secundario)" }}>
        Recebeu algo estranho? Mostre para o Guardião antes de pagar.
      </p>
      <p role="status" aria-live="polite">
        API: {saude === "verificando" ? "verificando…" : saude === "ok" ? "conectada" : "fora do ar"}
      </p>
    </main>
  );
}
