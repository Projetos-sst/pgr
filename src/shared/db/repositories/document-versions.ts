import "server-only";

import { and, eq, gt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { todayInSaoPaulo } from "@/shared/dates";
import {
  toDocumentVersionHistory,
  type DocumentVersionItem,
} from "@/shared/domains/documents/versions";

import { withOrg, type TenantTransaction } from "../with-org";
import { documents, type Document } from "../schema/documents";

/**
 * **Único ponto** que define qual versão de um documento lógico é a vigente (#56).
 *
 * Regra atual: a maior `version` do `document_group_id`. Quando existir aprovação (#54), a
 * regra muda para "maior versão aprovada/publicada" **somente neste arquivo** — listagem,
 * KPIs, histórico e a trava de somente leitura derivam daqui.
 */

/** Predicado SQL: a linha de `documents` em escopo é a vigente do seu grupo. */
export function currentVersionPredicate(tx: TenantTransaction) {
  const newer = alias(documents, "newer_version");
  return notExists(
    tx
      .select({ one: sql`1` })
      .from(newer)
      .where(
        and(
          eq(newer.orgId, documents.orgId),
          eq(newer.documentGroupId, documents.documentGroupId),
          gt(newer.version, documents.version),
        ),
      ),
  );
}

/** Linha vigente de um grupo, dentro da transação do chamador. `null` se o grupo não existe. */
export async function getCurrentVersionTx(
  tx: TenantTransaction,
  orgId: string,
  documentGroupId: string,
): Promise<Document | null> {
  const [row] = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.documentGroupId, documentGroupId),
        currentVersionPredicate(tx),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Histórico completo do documento lógico a que `documentId` pertence — qualquer versão serve
 * de ponto de entrada. Mais nova primeiro, exatamente uma marcada como vigente. Id inexistente
 * ou de outro escritório → `null` (a camada de cima responde 404, nunca vaza).
 */
export async function listDocumentVersions(
  orgId: string,
  documentId: string,
): Promise<DocumentVersionItem[] | null> {
  return withOrg(orgId, async (tx) => {
    const [target] = await tx
      .select({ groupId: documents.documentGroupId })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.id, documentId)))
      .limit(1);
    if (!target) return null;

    const rows = await tx
      .select()
      .from(documents)
      .where(
        and(eq(documents.orgId, orgId), eq(documents.documentGroupId, target.groupId)),
      );
    const current = await getCurrentVersionTx(tx, orgId, target.groupId);
    if (!current) return null;

    return toDocumentVersionHistory(rows, current.version, todayInSaoPaulo());
  });
}
