import { vibracao } from "@guardiao/brand";
import type { ResultadoAnalise } from "@guardiao/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAjustes } from "./ajustes";
import { analisarMensagem } from "./api";
import { Acessibilidade } from "./telas/protegido/Acessibilidade";
import { Analisando } from "./telas/protegido/Analisando";
import { Escrever } from "./telas/protegido/Escrever";
import { FALA_FALHA, Falha } from "./telas/protegido/Falha";
import { Inicio } from "./telas/protegido/Inicio";
import { Resultado, resumoFalado } from "./telas/protegido/Resultado";
import { calar, falar } from "./voz";

type Tela = "inicio" | "escrever" | "analisando" | "resultado" | "falha" | "acessibilidade";

/** Telas que o botão Voltar do celular alcança; análise e resultado não entram no histórico. */
const NAVEGAVEIS: Tela[] = ["inicio", "escrever", "acessibilidade"];

function telaDoEndereco(): Tela {
  const tela = window.location.hash.slice(1) as Tela;
  return NAVEGAVEIS.includes(tela) ? tela : "inicio";
}

export function App() {
  const { ajustes, mudar, restaurar } = useAjustes();
  const [tela, setTela] = useState<Tela>(telaDoEndereco);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const pedido = useRef<AbortController | null>(null);
  /** Tela para onde a Acessibilidade volta quando foi aberta a partir de um resultado. */
  const retorno = useRef<Tela | null>(null);

  const ouvir = useCallback((fala: string) => falar(fala, ajustes.vozLenta), [ajustes.vozLenta]);

  // O botão Voltar do celular navega entre as telas em vez de fechar o app.
  useEffect(() => {
    const aoVoltar = () => {
      pedido.current?.abort();
      calar();
      const destino = telaDoEndereco();
      setTela(destino === "inicio" && retorno.current ? retorno.current : destino);
      retorno.current = null;
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  // A cada troca de tela o foco vai para o título, para o leitor de tela começar do lugar certo.
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [tela]);

  const ir = useCallback((destino: Tela) => {
    calar();
    if (NAVEGAVEIS.includes(destino) && destino !== "inicio") window.history.pushState(null, "", `#${destino}`);
    else if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setTela(destino);
  }, []);

  const analisar = useCallback(
    async (mensagem: string) => {
      setTexto(mensagem);
      window.history.replaceState(null, "", window.location.pathname);
      setTela("analisando");
      setAnuncio("Analisando a mensagem. Não pague nada enquanto isso.");
      const controle = new AbortController();
      pedido.current = controle;
      try {
        const r = await analisarMensagem(mensagem, controle.signal);
        setResultado(r);
        setTela("resultado");
        setAnuncio(resumoFalado(r));
        if (ajustes.vozAutomatica) falar(resumoFalado(r), ajustes.vozLenta);
        if (ajustes.vibrarNoRisco && vibracao[r.risco].length) navigator.vibrate?.(vibracao[r.risco]);
      } catch {
        if (controle.signal.aborted) return;
        setTela("falha");
        setAnuncio(FALA_FALHA);
        if (ajustes.vozAutomatica) falar(FALA_FALHA, ajustes.vozLenta);
      }
    },
    [ajustes.vozAutomatica, ajustes.vozLenta, ajustes.vibrarNoRisco],
  );

  const cancelar = useCallback(() => {
    pedido.current?.abort();
    setAnuncio("Análise cancelada.");
    ir("escrever");
  }, [ir]);

  const recomecar = useCallback(() => {
    setTexto("");
    setResultado(null);
    ir("inicio");
  }, [ir]);

  const abrirAcessibilidade = useCallback(() => {
    retorno.current = tela === "resultado" || tela === "falha" ? tela : null;
    ir("acessibilidade");
  }, [ir, tela]);

  return (
    <>
      {tela === "inicio" && <Inicio aoColar={() => ir("escrever")} aoAbrirAcessibilidade={abrirAcessibilidade} aoOuvir={ouvir} />}
      {tela === "escrever" && <Escrever textoInicial={texto} aoAnalisar={analisar} aoVoltar={() => window.history.back()} />}
      {tela === "analisando" && <Analisando aoCancelar={cancelar} />}
      {tela === "resultado" && resultado && (
        <Resultado resultado={resultado} ajustes={ajustes} aoVoltar={recomecar} aoOuvir={ouvir} aoAbrirAcessibilidade={abrirAcessibilidade} />
      )}
      {tela === "falha" && <Falha aoTentarDeNovo={() => analisar(texto)} aoVoltar={recomecar} aoAbrirAcessibilidade={abrirAcessibilidade} />}
      {tela === "acessibilidade" && <Acessibilidade ajustes={ajustes} mudar={mudar} restaurar={restaurar} aoVoltar={() => window.history.back()} />}
      {/* Região viva única: o leitor de tela anuncia o resultado assim que ele chega. */}
      <p className="so-leitor" role="status" aria-live="assertive" aria-atomic="true">{anuncio}</p>
    </>
  );
}
