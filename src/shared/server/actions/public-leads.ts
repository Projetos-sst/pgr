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
    throw error;
  }
}
