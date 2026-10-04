/**
 * Texto pronto para as regras: minúsculas, sem acentos e com espaços simples,
 * guardando de onde cada caractere veio para devolver o trecho como a pessoa escreveu.
 */
export interface TextoNormalizado {
  original: string;
  normalizado: string;
  /** mapa[i] é o índice, em `original`, do caractere i de `normalizado`. */
  mapa: number[];
}

const MARCAS = /[̀-ͯ]/g;

/** Mesma transformação de `normalizar`, sem o mapa. Serve para comparar trechos. */
export function simplificar(texto: string): string {
  return normalizar(texto).normalizado.trim();
}

export function normalizar(original: string): TextoNormalizado {
  let normalizado = "";
  const mapa: number[] = [];
  let ultimoFoiEspaco = false;
  for (let i = 0; i < original.length; i++) {
    const caractere = original[i] as string;
    if (/\s/.test(caractere)) {
      if (!ultimoFoiEspaco) {
        normalizado += " ";
        mapa.push(i);
      }
      ultimoFoiEspaco = true;
      continue;
    }
    ultimoFoiEspaco = false;
    for (const c of caractere.normalize("NFD").replace(MARCAS, "").toLowerCase()) {
      normalizado += c;
      mapa.push(i);
    }
  }
  return { original, normalizado, mapa };
}

export const TAMANHO_MAXIMO_TRECHO = 200;

/** Trecho do texto original que corresponde a [inicio, fim) do texto normalizado. */
export function trechoOriginal(texto: TextoNormalizado, inicio: number, fim: number): string {
  const de = texto.mapa[inicio];
  const ate = texto.mapa[fim - 1];
  if (de === undefined || ate === undefined) return "";
  return texto.original.slice(de, ate + 1).trim().slice(0, TAMANHO_MAXIMO_TRECHO);
}
