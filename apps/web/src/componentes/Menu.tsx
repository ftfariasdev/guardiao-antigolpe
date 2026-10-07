import { useId, useState, type ReactNode } from "react";
import { IconeMenu } from "./Icones";

export interface ItemMenu {
  id: string;
  rotulo: string;
  icone: ReactNode;
  /** A tela aberta agora. */
  atual?: boolean;
  aoEscolher: () => void;
}

/**
 * Menu de acesso rápido. No celular é um botão "Menu" que abre a lista; no computador a lista
 * fica sempre à vista, em linha. `largo` acompanha as telas de duas colunas.
 */
export function Menu({ itens, largo = false }: { itens: ItemMenu[]; largo?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const idLista = useId();
  return (
    <nav className={`menu${largo ? " menu--largo" : ""}${aberto ? " menu--aberto" : ""}`} aria-label="Menu">
      <button type="button" className="menu__abrir" aria-expanded={aberto} aria-controls={idLista} onClick={() => setAberto((a) => !a)}>
        <IconeMenu tamanho={24} />
        {aberto ? "Fechar menu" : "Menu"}
      </button>
      <ul id={idLista} className="menu__lista">
        {itens.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="menu__item"
              aria-current={item.atual ? "page" : undefined}
              onClick={() => {
                setAberto(false);
                item.aoEscolher();
              }}
            >
              {item.icone}
              {item.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
