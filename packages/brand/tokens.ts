/**
 * Guardião Antigolpe — design tokens (paleta Escudo).
 * Espelho de tokens.css para uso em JS/TS: Three.js / React Three Fiber (apps/pitch),
 * gráficos do painel e lógica do semáforo.
 */
export const cores = {
  tinta: "#0E1A3D",
  azul: "#2D5BE3",
  ciano: "#46E3F2", // só sobre fundo escuro
  ardosia: "#4A5573",
  nevoa: "#EEF2FB",
  branco: "#FFFFFF",
} as const;

export type NivelRisco = "verde" | "amarelo" | "vermelho";

/** Semáforo — reservado; nunca usar na marca. Sempre com ícone + rótulo. */
export const semaforo: Record<NivelRisco, { texto: string; fundo: string; icone: "check" | "alerta" | "x"; rotulo: string }> = {
  verde: { texto: "#136C35", fundo: "#E3F5E9", icone: "check", rotulo: "Pode seguir" },
  amarelo: { texto: "#8A5100", fundo: "#FFF1D6", icone: "alerta", rotulo: "Atenção" },
  vermelho: { texto: "#B42318", fundo: "#FDE7E5", icone: "x", rotulo: "Não pague ainda" },
};

export const fontes = {
  texto: '"Atkinson Hyperlegible", system-ui, sans-serif',
  titulo: '"Sora", "Atkinson Hyperlegible", system-ui, sans-serif',
  codigo: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const tamanhos = {
  app: { corpo: 20, resultado: 28, titulo: 32, alvoToque: 48 },
  pitch: { titulo: 64, numero: 120, codigo: 18 },
} as const;

export const temas = {
  app: { fundo: cores.nevoa, superficie: cores.branco, texto: cores.tinta, textoSecundario: cores.ardosia, acento: cores.azul },
  pitch: { fundo: cores.tinta, superficie: "#16244F", texto: cores.branco, textoSecundario: "#B9C3DD", acento: cores.ciano },
} as const;

export const movimento = {
  curta: 150,
  media: 300,
  curva: [0.2, 0, 0, 1] as const,
} as const;

/** Geometria do símbolo (viewBox 8 2 84 102) para extrudar no 3D do pitch. */
export const simbolo = {
  viewBox: "8 2 84 102",
  escudo:
    "M50 6Q52 6 54 7L83 17Q88 19 88 24V48C88 71 72 86 52 92L31 100Q28 101 29 98L33 87C20 79 12 65 12 48V24Q12 19 17 17L46 7Q48 6 50 6Z",
  pontos: [
    { cx: 34, cy: 48, r: 6.5 },
    { cx: 50, cy: 48, r: 6.5 },
    { cx: 66, cy: 48, r: 6.5 }, // o terceiro é ciano e pulsa durante a análise
  ],
} as const;

/** Ajustes de acessibilidade — aplicados como atributos data-* no <html>. */
export type AjustesAcessibilidade = {
  texto: 100 | 125 | 150 | 175;
  contraste: "normal" | "alto";
  vozAutomatica: boolean;
  vozLenta: boolean;
  libras: boolean;
  movimento: "normal" | "reduzido";
  vibrarNoRisco: boolean;
  modoSimples: boolean;
  espaco: "normal" | "amplo";
};

export const ajustesPadrao: AjustesAcessibilidade = {
  texto: 100,
  contraste: "normal",
  vozAutomatica: true,
  vozLenta: false,
  libras: false,
  movimento: "normal",
  vibrarNoRisco: true,
  modoSimples: false,
  espaco: "normal",
};

/** Padrões de vibração (ms) por nível de risco — navigator.vibrate no Android. */
export const vibracao: Record<NivelRisco, number[]> = {
  verde: [],
  amarelo: [200, 100, 200],
  vermelho: [600, 150, 600, 150, 600],
};

/** Alto contraste: cores do semáforo sobre fundo preto. */
export const altoContraste = {
  fundo: "#000000",
  texto: "#FFFFFF",
  acento: "#FFE600",
  risco: { verde: "#7CF29A", amarelo: "#FFD54A", vermelho: "#FF8A80" },
} as const;
