import { vibracao } from "@guardiao/brand";
import type { ResultadoAnalise, TipoEntrada, TreinoDetalhe } from "@guardiao/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAjustes } from "../../ajustes";
import { api } from "../../api";
import { useSocketFamilia, type Sessao } from "../../sessao";
import { Acessibilidade } from "./Acessibilidade";
import { Analisando } from "./Analisando";
import { Escrever } from "./Escrever";
import { FALA_FALHA, Falha } from "./Falha";
import { PERFIL } from "../../perfil";
import { ConversaDemo } from "./ConversaDemo";
import { Inicio } from "./Inicio";
import { JaPaguei } from "./JaPaguei";
import { LerQr } from "./LerQr";
import { Treino } from "./Treino";
import { falaDaResposta, Resultado, resumoFalado } from "./Resultado";
import { calar, falar } from "../../voz";

type Tela = "inicio" | "escrever" | "qr" | "analisando" | "resultado" | "falha" | "acessibilidade" | "ja-paguei" | "treino" | "conversa";

/** Telas que o botão Voltar do celular alcança; análise e resultado não entram no histórico. */
const NAVEGAVEIS: Tela[] = ["inicio", "escrever", "qr", "acessibilidade", "ja-paguei", "conversa"];

function telaDoEndereco(): Tela {
  const tela = window.location.hash.slice(1) as Tela;
  return NAVEGAVEIS.includes(tela) ? tela : "inicio";
}

export function AppProtegido({ sessao }: { sessao: Sessao }) {
  const { ajustes, mudar, restaurar } = useAjustes();
  const [tela, setTela] = useState<Tela>(telaDoEndereco);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [tipo, setTipo] = useState<TipoEntrada>("texto");
  const [treino, setTreino] = useState<TreinoDetalhe | null>(null);
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
    async (mensagem: string, entrada: TipoEntrada = "texto") => {
      setTexto(mensagem);
      setTipo(entrada);
      window.history.replaceState(null, "", window.location.pathname);
      setTela("analisando");
      setAnuncio("Analisando a mensagem. Não pague nada enquanto isso.");
      const controle = new AbortController();
      pedido.current = controle;
      try {
        const r = await api.analisar(sessao.token, mensagem, entrada, controle.signal);
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
    [ajustes.vozAutomatica, ajustes.vozLenta, ajustes.vibrarNoRisco, sessao.token],
  );

  // Treino pendente: aparece no início e chega ao vivo quando o guardião envia.
  const buscarTreino = useCallback(async () => {
    const lista = await api.treinos(sessao.token).catch(() => null);
    if (lista) setTreino(lista.itens.find((t) => t.resultado === "pendente") ?? null);
  }, [sessao.token]);
  useEffect(() => {
    void buscarTreino();
  }, [buscarTreino]);

  // Resposta do guardião ou escalonamento: busca o estado novo do alerta e anuncia.
  const idAnalise = useRef<string | null>(null);
  idAnalise.current = resultado?.id ?? null;
  useSocketFamilia(sessao.token, (socket) => {
    const atualizar = async (anunciar: (r: ResultadoAnalise) => string) => {
      if (!idAnalise.current) return;
      const r = await api.analise(sessao.token, idAnalise.current).catch(() => null);
      if (!r) return;
      setResultado(r);
      setAnuncio(anunciar(r));
    };
    socket.on("alerta:respondido", () =>
      void atualizar((r) => {
        const fala = falaDaResposta(r);
        if (fala && ajustes.vozAutomatica) falar(fala, ajustes.vozLenta);
        if (r.alerta?.resposta === "era_golpe" && ajustes.vibrarNoRisco) navigator.vibrate?.(vibracao.vermelho);
        return fala;
      }),
    );
    socket.on("alerta:escalado", (dados) => void atualizar(() => `${dados.proximo_guardiao} foi avisado.`));
    socket.on("treino:novo", () => {
      setAnuncio("Você recebeu um treino antigolpe.");
      void buscarTreino();
    });
  });

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

  const abrirJaPaguei = useCallback(() => {
    retorno.current = tela === "resultado" ? tela : null;
    ir("ja-paguei");
  }, [ir, tela]);

  const guardiaoPrincipal = sessao.familia.membros.find((m) => m.papel === "guardiao")?.nome ?? null;

  return (
    <>
      {tela === "inicio" && <Inicio sessao={sessao} treino={treino} aoColar={() => ir("escrever")} aoLerQr={() => ir("qr")} aoAbrirConversa={PERFIL ? () => ir("conversa") : undefined} aoAbrirTreino={() => ir("treino")} aoAbrirAcessibilidade={abrirAcessibilidade} aoOuvir={ouvir} />}
      {tela === "qr" && <LerQr aoLer={(codigo) => analisar(codigo, codigo.includes("000201") ? "pix" : "link")} aoVoltar={() => window.history.back()} aoColarNoLugar={() => ir("escrever")} />}
      {tela === "conversa" && <ConversaDemo aoCompartilhar={analisar} aoVoltar={() => window.history.back()} />}
      {tela === "ja-paguei" && <JaPaguei guardiao={guardiaoPrincipal} aoVoltar={() => window.history.back()} />}
      {tela === "treino" && treino && <Treino sessao={sessao} treino={treino} aoTerminar={() => { setTreino(null); ir("inicio"); }} />}
      {tela === "escrever" && <Escrever textoInicial={texto} aoAnalisar={analisar} aoVoltar={() => window.history.back()} />}
      {tela === "analisando" && <Analisando aoCancelar={cancelar} />}
      {tela === "resultado" && resultado && (
        <Resultado resultado={resultado} ajustes={ajustes} aoVoltar={recomecar} aoOuvir={ouvir} aoJaPaguei={abrirJaPaguei} aoAbrirAcessibilidade={abrirAcessibilidade} />
      )}
      {tela === "falha" && <Falha aoTentarDeNovo={() => analisar(texto, tipo)} aoVoltar={recomecar} aoAbrirAcessibilidade={abrirAcessibilidade} />}
      {tela === "acessibilidade" && <Acessibilidade ajustes={ajustes} mudar={mudar} restaurar={restaurar} aoVoltar={() => window.history.back()} />}
      {/* Região viva única: o leitor de tela anuncia o resultado assim que ele chega. */}
      <p className="so-leitor" role="status" aria-live="assertive" aria-atomic="true">{anuncio}</p>
    </>
  );
}
