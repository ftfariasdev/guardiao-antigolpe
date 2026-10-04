import type { ConviteCriado, Papel } from "@guardiao/shared";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api, ErroApi } from "../../api";
import { IconeVoltar } from "../../componentes/Icones";
import type { Sessao } from "../../sessao";

interface Props {
  sessao: Sessao;
  papel: Papel;
  aoVoltar: () => void;
}

/** O token vai no fragmento do link (#convite=…), que o navegador não envia a nenhum servidor. */
export function linkDoConvite(token: string): string {
  return `${window.location.origin}/#convite=${token}`;
}

export function Convite({ sessao, papel, aoVoltar }: Props) {
  const [convite, setConvite] = useState<ConviteCriado | null>(null);
  const [qr, setQr] = useState("");
  const [recado, setRecado] = useState("");
  const quem = papel === "protegido" ? "a pessoa protegida" : "o novo guardião";

  useEffect(() => {
    let vivo = true;
    api
      .criarConvite(sessao.token, sessao.familia.id, papel)
      .then(async (c) => {
        const svg = await QRCode.toString(linkDoConvite(c.token), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        if (vivo) {
          setConvite(c);
          setQr(svg);
        }
      })
      .catch((e) => vivo && setRecado(e instanceof ErroApi ? e.message : "Não consegui criar o convite. Tente de novo."));
    return () => {
      vivo = false;
    };
  }, [sessao.token, sessao.familia.id, papel]);

  async function compartilhar() {
    if (!convite) return;
    const url = linkDoConvite(convite.token);
    try {
      if (navigator.share) await navigator.share({ title: "Convite do Guardião", text: `Entre na ${sessao.familia.nome} no Guardião Antigolpe:`, url });
      else {
        await navigator.clipboard.writeText(url);
        setRecado("Link copiado. Cole na conversa com a pessoa.");
      }
    } catch {
      /* a pessoa fechou o compartilhamento */
    }
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Convidar {papel === "protegido" ? "protegido" : "guardião"}</h1>
      </header>
      <p className="apoio">Peça para {quem} apontar a câmera do celular para o código, ou mande o link.</p>
      <div className="cartao qr">
        {qr ? (
          <div className="qr__codigo" role="img" aria-label={`QR Code do convite para ${quem}`} dangerouslySetInnerHTML={{ __html: qr }} />
        ) : (
          <p className="apoio">{recado ? "" : "Gerando o convite…"}</p>
        )}
      </div>
      <p role="status" aria-live="polite">{recado}</p>
      <p className="apoio">O convite vale por 24 horas e só pode ser usado uma vez.</p>
      <button type="button" className="botao botao--principal botao--grande botao--fim" disabled={!convite} onClick={compartilhar}>Mandar o link</button>
    </main>
  );
}
