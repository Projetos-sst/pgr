"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { pgrSignatureRequestSchema } from "@/shared/domains/pgr/pgr-signature";
import type { PgrSignatureView } from "@/shared/domains/pgr/pgr-signature";
import {
  createPgrSignature,
  getPgrSignatureView,
  type CreatePgrSignatureResult,
} from "@/shared/server/pgr/pgr-signature-core";

/**
 * Cria a solicitação de assinatura do PGR (office staff). Casca fina: valida `ttlSeconds` com Zod
 * e delega ao core (que monta o payload no servidor e aplica a cota). Audita a criação sem o token.
 */
export async function createPgrSignatureRequestAction(input: {
  pgrId: string;
  ttlSeconds?: number;
}): Promise<ActionResult<CreatePgrSignatureResult>> {
  return officeAction(
    "pgr.signature.create",
    async (ctx) => {
      const { pgrId, ...rest } = input;
      const opts = pgrSignatureRequestSchema.parse(rest);
      const result = await createPgrSignature(ctx, pgrId, opts);
      revalidatePath(`/pgr/${pgrId}`);
      return result;
    },
    { audit: true },
  );
}

/** Estado derivado da assinatura do PGR (leitura, sem audit; nunca devolve token/URL). */
export async function getPgrSignatureViewAction(input: {
  pgrId: string;
}): Promise<ActionResult<PgrSignatureView>> {
  return officeAction("pgr.signature.get", (ctx) =>
    getPgrSignatureView(ctx, input.pgrId),
  );
}
