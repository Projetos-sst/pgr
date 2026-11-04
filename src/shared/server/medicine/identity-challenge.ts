import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Desafio de controle da conta (NOB-158): código de 6 dígitos, derivado por HMAC do pedido, da conta
 * e de uma janela de 5 minutos, exibido só na sessão autenticada do profissional. O operador pede o
 * código ao vivo e o sistema confere (janela atual ou anterior): um código vale no máximo ~10 minutos,
 * o que limita o uso de um código copiado de uma sessão depois revogada (NOB-164). Sem `IDENTITY_CHALLENGE_SECRET`, o
 * desafio fica indisponível e a verificação não pode ser concluída.
 */
export const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;
const WINDOW_MS = CHALLENGE_WINDOW_MS;

function secret(): string | null {
  return process.env.IDENTITY_CHALLENGE_SECRET || null;
}

export function challengeAvailable(): boolean {
  return Boolean(secret());
}

function codeFor(key: string, requestId: string, userId: string, window: number): string {
  const digest = createHmac("sha256", key)
    .update(`${requestId}|${userId}|${window}`)
    .digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** Código atual para o profissional autenticado exibir ao operador (ou null sem segredo). */
export function currentChallengeCode(
  requestId: string,
  userId: string,
  now = Date.now(),
): string | null {
  const key = secret();
  return key ? codeFor(key, requestId, userId, Math.floor(now / WINDOW_MS)) : null;
}

/** Confere o código informado pelo operador (janela atual ou anterior). */
export function challengeMatches(
  requestId: string,
  userId: string,
  code: string,
  now = Date.now(),
): boolean {
  const key = secret();
  if (!key || !/^\d{6}$/.test(code)) return false;
  const window = Math.floor(now / WINDOW_MS);
  return [window, window - 1].some((w) => {
    const expected = Buffer.from(codeFor(key, requestId, userId, w));
    return timingSafeEqual(expected, Buffer.from(code));
  });
}
