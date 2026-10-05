import { useEffect, useState } from "react";
import { useAjustes } from "./ajustes";
import { api } from "./api";
import { registrarServiceWorker } from "./push";
import { useSessao } from "./sessao";
import { Entrada } from "./telas/Entrada";
import { Simulador } from "./telas/pitch/Simulador";
import { AppGuardiao } from "./telas/guardiao/AppGuardiao";
import { AppProtegido } from "./telas/protegido/AppProtegido";

/** Token de convite no endereço (#convite=…). O fragmento não é enviado a nenhum servidor. */
function conviteDoEndereco(): string | null {
  const hash = window.location.hash.slice(1);
  return hash.startsWith("convite=") && hash.length > 8 ? hash.slice(8) : null;
}

/**
 * Golpe simulado do pitch: `#pitch=<sessão>` (QR) ou só `#pitch` (link curto, lido em voz alta).
 * É público e não usa a sessão da família.
 */
function pitchDoEndereco(): string | "atual" | null {
  const hash = window.location.hash.slice(1);
  if (hash === "pitch") return "atual";
  return /^pitch=[0-9a-f-]{36}$/i.test(hash) ? hash.slice(6) : null;
}

export function App() {
  const [pitch, setPitch] = useState(pitchDoEndereco);
  useEffect(() => {
    if (pitch === "atual") void api.sessaoPitchAtual().then((s) => setPitch(s.id)).catch(() => setPitch(null));
  }, [pitch]);
  if (pitch === "atual") return <main className="tela"><p role="status">Abrindo…</p></main>;
  return pitch ? <Simulador sessaoId={pitch} /> : <AppDaFamilia />;
}

function AppDaFamilia() {
  // Aplica os ajustes de acessibilidade salvos antes de qualquer tela.
  useAjustes();
  const { estado, entrar, recarregar } = useSessao();
  const [convite] = useState(conviteDoEndereco);

  useEffect(() => {
    void registrarServiceWorker();
  }, []);

  if (estado.fase === "carregando") {
    return <main className="tela"><p role="status">Abrindo o Guardião…</p></main>;
  }
  if (estado.fase === "sem_rede") {
    return (
      <main className="tela">
        <h1 className="titulo" tabIndex={-1}>Sem conexão</h1>
        <p>Não consegui falar com o Guardião. Confira a internet. Enquanto isso, não pague nada que pedirem por mensagem.</p>
        <button type="button" className="botao botao--principal botao--grande" onClick={recarregar}>Tentar de novo</button>
      </main>
    );
  }
  if (estado.fase === "fora") {
    return (
      <Entrada
        convite={convite}
        aoEntrar={(sessao) => {
          // Tira o token do convite do endereço antes de mostrar o app.
          window.history.replaceState(null, "", window.location.pathname);
          entrar(sessao);
        }}
      />
    );
  }
  return estado.sessao.membro.papel === "protegido" ? <AppProtegido sessao={estado.sessao} /> : <AppGuardiao sessao={estado.sessao} aoMudarFamilia={recarregar} />;
}
