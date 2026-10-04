import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // O .env fica na raiz do monorepo.
  envDir: "../..",
  server: { port: 5173 },
});
