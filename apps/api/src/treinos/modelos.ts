import { ModeloTreino } from "@guardiao/shared";
import { z } from "zod";
import brutos from "./modelos.json" with { type: "json" };

/** Golpes simulados do treino: ficam no repositório, versionados, e são validados ao subir a API. */
export const MODELOS_TREINO: ModeloTreino[] = z.array(ModeloTreino).min(1).parse(brutos);

export function modeloPorId(id: string): ModeloTreino | undefined {
  return MODELOS_TREINO.find((m) => m.id === id);
}

/** Pontos de escudo: só ganha quem mostra a mensagem ao Guardião em vez de pagar. */
export const PONTOS_POR_ENCAMINHAR = 10;
