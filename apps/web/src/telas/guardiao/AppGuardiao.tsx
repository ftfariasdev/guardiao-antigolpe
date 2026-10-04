import type { AlertaDetalhe, ItemHistorico, Papel } from "@guardiao/shared";
import { useCallback, useEffect, useState } from "react";
import { useAjustes } from "../../ajustes";
import { api } from "../../api";
import { useSocketFamilia, type Sessao } from "../../sessao";
import { Acessibilidade } from "../protegido/Acessibilidade";
import { AlertaGuardiao } from "./AlertaGuardiao";
import { Convite } from "./Convite";
import { Familia } from "./Familia";

type Tela = { nome: "familia" } | { nome: "convite"; papel: Papel } | { nome: "alerta"; id: string } | { nome: "acessibilidade" };

function telaDoEndereco(): Tela {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("alerta=")) return { nome: "alerta", id: hash.slice(7) };
  if (hash === "convite-protegido") return { nome: "convite", papel: "protegido" };
  if (hash === "convite-guardiao") return { nome: "convite", papel: "guardiao" };
  if (hash === "acessibilidade") return { nome: "acessibilidade" };
  return { nome: "familia" };
}

export function AppGuardiao({ sessao, aoMudarFamilia }: { sessao: Sessao; aoMudarFamilia: () => void }) {
  const { ajustes, mudar, restaurar } = useAjustes();
  const [tela, setTela] = useState<Tela>(telaDoEndereco);
  const [pendentes, setPendentes] = useState<AlertaDetalhe[]>([]);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);
  const [anuncio, setAnuncio] = useState("");

  const atualizar = useCallback(async () => {
    const [p, h] = await Promise.all([api.alertasPendentes(sessao.token).catch(() => null), api.historico(sessao.token, sessao.familia.id).catch(() => null)]);
    if (p) setPendentes(p.itens);
    if (h) setHistorico(h.itens);
  }, [sessao.token, sessao.familia.id]);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  // Ao voltar para o app (ou tocar na notificação), busca o que mudou enquanto ele estava em segundo plano.
  useEffect(() => {
    const aoVoltarParaOApp = () => {
      if (document.visibilityState !== "visible") return;
      void atualizar();
      aoMudarFamilia();
    };
    document.addEventListener("visibilitychange", aoVoltarParaOApp);
    return () => document.removeEventListener("visibilitychange", aoVoltarParaOApp);
  }, [atualizar, aoMudarFamilia]);

  // O endereço guarda a tela: o botão Voltar do celular e o toque na notificação funcionam.
  useEffect(() => {
    const aoMudar = () => setTela(telaDoEndereco());
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    if (tela.nome === "familia") {
      void atualizar();
      aoMudarFamilia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela.nome]);

  useSocketFamilia(sessao.token, (socket) => {
    socket.on("alerta:novo", (dados) => {
      setAnuncio(`Alerta novo. ${dados.resumo}`);
      navigator.vibrate?.([600, 150, 600]);
      void atualizar();
      // Um alerta pode vir de alguém que acabou de entrar na família.
      aoMudarFamilia();
    });
    socket.on("alerta:respondido", () => void atualizar());
    socket.on("alerta:escalado", () => void atualizar());
  });

  const ir = (hash: string) => {
    window.location.hash = hash;
  };
  const voltar = () => ir("");

  return (
    <>
      {tela.nome === "familia" && (
        <Familia
          sessao={sessao}
          pendentes={pendentes}
          historico={historico}
          aoConvidar={(papel) => ir(`convite-${papel}`)}
          aoAbrirAlerta={(id) => ir(`alerta=${id}`)}
          aoAbrirAcessibilidade={() => ir("acessibilidade")}
          aoMudarFamilia={aoMudarFamilia}
        />
      )}
      {tela.nome === "convite" && <Convite sessao={sessao} papel={tela.papel} aoVoltar={voltar} />}
      {tela.nome === "alerta" && <AlertaGuardiao sessao={sessao} alertaId={tela.id} aoVoltar={voltar} aoResponder={atualizar} />}
      {tela.nome === "acessibilidade" && <Acessibilidade ajustes={ajustes} mudar={mudar} restaurar={restaurar} aoVoltar={voltar} />}
      <p className="so-leitor" role="status" aria-live="assertive" aria-atomic="true">{anuncio}</p>
    </>
  );
}
