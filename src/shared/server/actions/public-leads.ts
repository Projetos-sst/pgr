"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { toActionError } from "@/shared/server/action-error";
import { fail, ok, type ActionResult } from "@/shared/server/result";
import { leadInputSchema, type LeadInput } from "@/shared/domains/platform/leads";
import * as repo from "@/shared/db/repositories/platform-leads";

/**
 * Superfície pública (SEM gate de sessão): registrar um pedido de orçamento.
 *
 * Três barreiras contra abuso, em ordem:
 *
 * 1. **Validação no servidor** pelo mesmo schema Zod do formulário. O cliente
 *    não é confiável: tudo é reparseado aqui.
 * 2. **Janela por origem** (abaixo): limite por IP hasheado, em memória. É
 *    best-effort e por instância — um deploy com várias instâncias dilui o
 *    limite. Está documentado como tal em `PORTAL-AUDIT.md`; a barreira que não
 *    depende de instância é a próxima.
 * 3. **Índice único no banco**: `(lower(email), submitted_on)` impede o mesmo
 *    e-mail de gravar dois pedidos no mesmo dia, independentemente de quantos
 *    processos existam.
 *
 * O IP **nunca** é persistido, nem em claro nem hasheado: ele só existe como
 * chave de um mapa em memória, com expiração.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const MAX_TRACKED_ORIGINS = 5000;

const attempts = new Map<string, number[]>();

function originKey(forwardedFor: string | null, realIp: string | null): string {
  // `x-forwarded-for` pode vir com a cadeia de proxies; o cliente é o primeiro.
  const raw = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function withinRateLimit(key: string, now: number): boolean {
  // Poda preguiçosa: sem isto o mapa cresceria indefinidamente num processo longo.
  if (attempts.size > MAX_TRACKED_ORIGINS) attempts.clear();

  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

const FALHAS_DE_CONEXAO = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "CONNECTION_CLOSED",
  "CONNECT_TIMEOUT",
]);

/** `true` quando o erro é de conectividade com o banco, não de dados. */
function isBancoIndisponivel(error: unknown): boolean {
  let atual: unknown = error;
  for (let i = 0; i < 5 && atual; i += 1) {
    if (typeof atual === "object" && "code" in atual) {
      const code = (atual as { code: unknown }).code;
      if (typeof code === "string" && FALHAS_DE_CONEXAO.has(code)) return true;
    }
    atual = (atual as { cause?: unknown }).cause;
  }
  return false;
}

/** `true` quando o erro é a violação do índice único de deduplicação. */
function isDuplicateSubmission(error: unknown): boolean {
  const mapped = toActionError(error);
  return mapped?.code === "DUPLICATE";
}

export async function submitPlatformLead(
  input: LeadInput,
): Promise<ActionResult<{ received: true }>> {
  try {
    const data = leadInputSchema.parse(input);

    const headerBag = await headers();
    const key = originKey(headerBag.get("x-forwarded-for"), headerBag.get("x-real-ip"));
    if (!withinRateLimit(key, Date.now())) {
      return fail(
        "RATE_LIMITED",
        "Recebemos várias solicitações deste acesso. Tente novamente em alguns minutos.",
      );
    }

    await repo.createLead(data);
    return ok({ received: true });
  } catch (error) {
    if (isDuplicateSubmission(error)) {
      // Não é erro do visitante: o pedido dele do dia já está registrado.
      return ok({ received: true });
    }
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    if (isBancoIndisponivel(error)) {
      /*
       * Banco fora do ar. Rethrow aqui viraria uma tela de erro 500 para quem
       * só queria pedir um orçamento — e o design já tem o estado de erro do
       * formulário para isso. O erro continua visível no log do servidor.
       */
      console.error("[public-leads] banco indisponível ao gravar pedido", error);
      return fail(
        "UNAVAILABLE",
        "Não foi possível registrar sua solicitação agora. Tente novamente em alguns minutos.",
      );
    }
    throw error;
  }
}
