import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { roteiro } from "../roteiro";
import { SLIDES, type PropsSlide } from "./index";

const pitch = { sessao: "a3f1c9e2-0000-4000-8000-000000000000", acessaram: 120, confirmaram: 80, revelado: false, conexao: "ao_vivo" as const, aviso: "" };
const base: PropsSlide = { passo: 0, pitch, demo: { contas: null, alertaChegando: false, video: false, erro: "" } };

/** Teste mínimo do doc: percorre os 11 slides e falha se algum der erro. */
describe("slides do pitch", () => {
  it("o roteiro tem 11 slides em ordem de tempo, e cada um tem o seu componente", () => {
    expect(roteiro).toHaveLength(11);
    expect(roteiro.map((s) => s.id).filter((id) => !SLIDES[id])).toEqual([]);
    const segundos = roteiro.map((s) => { const [m, seg] = s.inicio.split(":").map(Number); return (m ?? 0) * 60 + (seg ?? 0); });
    expect([...segundos].sort((a, b) => a - b)).toEqual(segundos);
    expect(segundos.at(-1)).toBeLessThan(300);
  });

  for (const [modo, props] of [["no palco", base], ["no modo leve", { ...base, leve: true }], ["em todos os passos", { ...base, passo: 9 }], ["na impressão", { ...base, passo: 99, estatico: true }]] as const) {
    it(`todos os slides renderizam ${modo} sem erro nem aviso no console`, () => {
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      for (const slide of roteiro) {
        const Conteudo = SLIDES[slide.id]!;
        expect(renderToString(<Conteudo {...props} />).length, slide.id).toBeGreaterThan(50);
      }
      expect(erro).not.toHaveBeenCalled();
      erro.mockRestore();
    });
  }

  it("o primeiro slide não mostra a marca do Guardião: precisa parecer um aviso comum", () => {
    const html = renderToString(SLIDES.brinde!(base));
    expect(html).not.toMatch(/Guardi[ãa]o/);
  });
});
