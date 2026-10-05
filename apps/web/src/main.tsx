import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@guardiao/brand/tokens.css";
import "./estilos.css";
import { App } from "./App";
import { repassarTeclasAoPitch } from "./perfil";

repassarTeclasAoPitch();

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
