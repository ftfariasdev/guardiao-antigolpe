import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { IconeVoltar } from "../../componentes/Icones";

interface Props {
  aoLer: (conteudo: string) => void;
  aoVoltar: () => void;
  aoColarNoLugar: () => void;
}

/**
 * Lê o QR Code pela câmera. A imagem não sai do celular: o código é decodificado aqui
 * e só o conteúdo dele vai para a análise.
 */
export function LerQr({ aoLer, aoVoltar, aoColarNoLugar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"abrindo" | "lendo" | "sem_camera">("abrindo");

  useEffect(() => {
    let vivo = true;
    let fluxo: MediaStream | null = null;
    let quadro = 0;
    const tela = document.createElement("canvas");
    const pincel = tela.getContext("2d", { willReadFrequently: true });

    const procurar = () => {
      const v = video.current;
      if (!vivo || !v || !pincel) return;
      if (v.readyState >= v.HAVE_CURRENT_DATA && v.videoWidth > 0) {
        // Metade da resolução basta para o QR e poupa bateria.
        tela.width = Math.round(v.videoWidth / 2);
        tela.height = Math.round(v.videoHeight / 2);
        pincel.drawImage(v, 0, 0, tela.width, tela.height);
        const achado = jsQR(pincel.getImageData(0, 0, tela.width, tela.height).data, tela.width, tela.height, { inversionAttempts: "dontInvert" });
        if (achado?.data.trim()) {
          navigator.vibrate?.(100);
          aoLer(achado.data.trim());
          return;
        }
      }
      quadro = requestAnimationFrame(procurar);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado("sem_camera");
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then(async (s) => {
          if (!vivo) return s.getTracks().forEach((t) => t.stop());
          fluxo = s;
          if (video.current) {
            video.current.srcObject = s;
            await video.current.play().catch(() => {});
          }
          setEstado("lendo");
          quadro = requestAnimationFrame(procurar);
        })
        .catch(() => vivo && setEstado("sem_camera"));
    }
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
    // A câmera abre uma vez por visita a esta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Ler QR Code do Pix</h1>
      </header>
      {estado === "sem_camera" ? (
        <>
          <p role="alert">Não consegui abrir a câmera. Libere a câmera para o Guardião ou cole o código do Pix.</p>
          <button type="button" className="botao botao--principal botao--grande" onClick={aoColarNoLugar}>Colar o código do Pix</button>
        </>
      ) : (
        <>
          <p className="apoio" role="status">{estado === "abrindo" ? "Abrindo a câmera…" : "Aponte a câmera para o QR Code. Eu leio sozinho."}</p>
          <div className="camera">
            <video ref={video} className="camera__video" muted playsInline aria-label="Imagem da câmera" />
          </div>
          <p className="apoio">Não pague pelo aplicativo do banco antes de ver o resultado aqui.</p>
        </>
      )}
    </main>
  );
}
