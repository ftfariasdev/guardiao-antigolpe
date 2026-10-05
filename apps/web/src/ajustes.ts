import { ajustesPadrao, type AjustesAcessibilidade } from "@guardiao/brand";
import { useCallback, useEffect, useState } from "react";
import { chaveDoPerfil } from "./perfil";

const CHAVE = chaveDoPerfil("guardiao:acessibilidade");

function ler(): AjustesAcessibilidade {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? { ...ajustesPadrao, ...(JSON.parse(salvo) as Partial<AjustesAcessibilidade>) } : ajustesPadrao;
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue com o padrão.
    return ajustesPadrao;
  }
}

/** Os ajustes viram atributos data-* no <html>; quem muda as cores e tamanhos é o tokens.css. */
function aplicar(a: AjustesAcessibilidade) {
  const raiz = document.documentElement.dataset;
  raiz.texto = String(a.texto);
  raiz.contraste = a.contraste;
  raiz.espaco = a.espaco;
  raiz.movimento = a.movimento;
}

export function useAjustes() {
  const [ajustes, setAjustes] = useState<AjustesAcessibilidade>(ler);

  useEffect(() => {
    aplicar(ajustes);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(ajustes));
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, [ajustes]);

  const mudar = useCallback((mudanca: Partial<AjustesAcessibilidade>) => setAjustes((atual) => ({ ...atual, ...mudanca })), []);
  const restaurar = useCallback(() => setAjustes(ajustesPadrao), []);
  return { ajustes, mudar, restaurar };
}
