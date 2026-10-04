import { createHash, randomBytes } from "node:crypto";

/** Token de sessão ou de convite: 32 bytes aleatórios. O valor só existe no aparelho. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** No banco fica só o SHA-256 do token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
