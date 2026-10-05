import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@guardiao/brand/tokens.css";
import "./pitch.css";
import { App } from "./App";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
