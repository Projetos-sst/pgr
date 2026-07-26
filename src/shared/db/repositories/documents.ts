import "server-only";

import {
  and,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  lt,
  gte,
  lte,
  notExists,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  toDocumentDetail,
  toDocumentListItem,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentMetadataValues,
  type DocumentValidityFilter,
  type UpdateDocumentValues,
} from "@/shared/domains/documents/documents";
import type { DocumentRelatedEntityType } from "@/shared/domains/documents/validity";
import {
  computeDocumentKpis,
  validityDateBounds,
  type DocumentKpis,
} from "@/shared/domains/documents/kpis";
import {
  putDocumentObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { todayInSaoPaulo } from "@/shared/dates";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { documents, folders } from "../schema/documents";
import { auditedTenantWrite } from "./audited-write";
import { assertFolderInTenant } from "./folders";

export type ListDocumentsParams = PageParams & {
  folderId?: string | null;
  search?: string;
  docType?: string;
  validity?: DocumentValidityFilter;
  relatedEntityType?: DocumentRelatedEntityType;
  relatedEntityId?: string;
};

export type DocumentListResult = Paginated<DocumentListItem> & { kpis: DocumentKpis };

/** Constrói o predicado de validade sobre a linha corrente. */
function validityPredicate(validity: DocumentValidityFilter, today: string) {
  const { dueLimit } = validityDateBounds(today);
  switch (validity) {
    case "no_expiry":
      return isNull(documents.validUntil);
    case "expired":
      return lt(documents.validUntil, today);
    case "due_soon":
      return and(gte(documents.validUntil, today), lte(documents.validUntil, dueLimit));
    case "ok":
      return gt(documents.validUntil, dueLimit);
  }
}

function currentVersionPredicate(tx: TenantTransaction) {
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

export async function listDocuments(
  orgId: string,
  params: ListDocumentsParams = {},
): Promise<DocumentListResult> {
  const { limit, offset } = resolvePageParams(params);
  const today = todayInSaoPaulo();
  const folderId = params.folderId ?? null;
  const search = params.search?.trim();
  const relatedEntityType = params.relatedEntityType?.trim();
  const relatedEntityId = params.relatedEntityId?.trim();

  // Navegar pastas e filtrar por vínculo são leituras diferentes do mesmo acervo: a primeira
  // é hierárquica (sem `folderId` = raiz), a segunda é transversal — "todos os anexos deste
  // PGR" não pode depender de onde cada anexo foi arquivado. Sem isto, um laudo movido para
  // uma pasta sumia da etapa "Documentos e PDF" do PGR. `folderId` explícito ainda vence,
  // para permitir "anexos deste PGR dentro desta pasta".
  const isRelatedEntityView = Boolean(relatedEntityType && relatedEntityId);
  const browsesFolders = params.folderId !== undefined || !isRelatedEntityView;

  return withOrg(orgId, async (tx) => {
    const filters = [eq(documents.orgId, orgId), currentVersionPredicate(tx)];
    if (browsesFolders) {
      filters.push(
        folderId === null ? isNull(documents.folderId) : eq(documents.folderId, folderId),
      );
    }
    if (search) filters.push(ilike(documents.name, `%${search}%`));
    if (params.docType) filters.push(eq(documents.docType, params.docType));
    if (params.validity) filters.push(validityPredicate(params.validity, today)!);
    if (relatedEntityType)
      filters.push(eq(documents.relatedEntityType, relatedEntityType));
    if (relatedEntityId) filters.push(eq(documents.relatedEntityId, relatedEntityId));
    const where = and(...filters);

    const rows = await tx
      .select()
      .from(documents)
      .where(where)
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(documents)
      .where(where);

    const kpis = await getAcervoKpis(orgId, tx);

    return {
      rows: rows.map((row) => toDocumentListItem(row, today)),
      total,
      kpis,
    };
  });
}

/** KPIs do acervo (todo o escritório): documentos lógicos, pastas, a vencer, vencidos. */
export async function getAcervoKpis(
  orgId: string,
  existingTx?: TenantTransaction,
): Promise<DocumentKpis> {
  const run = async (tx: TenantTransaction): Promise<DocumentKpis> => {
    const today = todayInSaoPaulo();
    const { dueLimit } = validityDateBounds(today);
    const [docRow] = await tx
      .select({
        documents: sql<number>`count(*)::int`,
        expired: sql<number>`count(*) filter (where ${documents.validUntil} < ${today})::int`,
        dueSoon: sql<number>`count(*) filter (where ${documents.validUntil} >= ${today} and ${documents.validUntil} <= ${dueLimit})::int`,
      })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), currentVersionPredicate(tx)));

    const [folderRow] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(folders)
      .where(eq(folders.orgId, orgId));

    return computeDocumentKpis({
      documents: docRow.documents,
      folders: folderRow.total,
      dueSoon: docRow.dueSoon,
      expired: docRow.expired,
    });
  };
  return existingTx ? run(existingTx) : withOrg(orgId, run);
}

export async function getDocumentById(
  orgId: string,
  id: string,
): Promise<DocumentDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
      .limit(1);
    return row ? toDocumentDetail(row, todayInSaoPaulo()) : null;
  });
}

export type CreateDocumentInput = { metadata: DocumentMetadataValues; file: File };

/**
 * Upload + registro (v1, novo grupo). Ordem: valida pasta do tenant → grava o
 * binário → INSERT em `withOrg`. Falha do INSERT → remove o objeto (compensação,
 * research §4) para não deixar órfão.
 */
export async function createDocument(
  orgId: string,
  input: CreateDocumentInput,
): Promise<DocumentDetail> {
  const { metadata, file } = input;

  await withOrg(orgId, (tx) => assertFolderInTenant(tx, orgId, metadata.folderId));

  const groupId = crypto.randomUUID();
  const stored = await putDocumentObject(orgId, groupId, 1, file);

  try {
    return await auditedTenantWrite(orgId, "documents.documents.write_rejected", () =>
      withOrg(orgId, async (tx) => {
        await assertFolderInTenant(tx, orgId, metadata.folderId);
        const [row] = await tx
          .insert(documents)
          .values({
            orgId,
            folderId: metadata.folderId,
            documentGroupId: groupId,
            name: metadata.name,
            docType: metadata.docType,
            version: 1,
            storagePath: stored.storagePath,
            sizeBytes: stored.sizeBytes,
            validUntil: metadata.validUntil ?? null,
            relatedEntityType: metadata.relatedEntityType ?? null,
            relatedEntityId: metadata.relatedEntityId ?? null,
          })
          .returning();
        return toDocumentDetail(row, todayInSaoPaulo());
      }),
    );
  } catch (error) {
    await removeDocumentObject(stored.storagePath).catch(() => {});
    throw error;
  }
}

/** Edita metadados da versão identificada (não troca arquivo). 404 → null. */
export async function updateDocument(
  orgId: string,
  id: string,
  patch: UpdateDocumentValues,
): Promise<DocumentDetail | null> {
  return auditedTenantWrite(orgId, "documents.documents.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const set: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.docType !== undefined) set.docType = patch.docType;
      if (patch.validUntil !== undefined) set.validUntil = patch.validUntil;
      if (patch.relatedEntityType !== undefined)
        set.relatedEntityType = patch.relatedEntityType ?? null;
      if (patch.relatedEntityId !== undefined)
        set.relatedEntityId = patch.relatedEntityId ?? null;
      const [row] = await tx
        .update(documents)
        .set(set)
        .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
        .returning();
      return row ? toDocumentDetail(row, todayInSaoPaulo()) : null;
    }),
  );
}

/**
 * Publica nova versão: `version = MAX+1` no mesmo grupo, herda metadados da versão
 * apontada, grava novo binário. Corrida na mesma versão → 23505 (`DUPLICATE`).
 * 404 → null. Compensa órfão se o INSERT falhar.
 */
export async function addDocumentVersion(
  orgId: string,
  id: string,
  file: File,
): Promise<DocumentDetail | null> {
  const target = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
      .limit(1);
    if (!row) return null;
    const [{ maxVersion }] = await tx
      .select({ maxVersion: sql<number>`max(${documents.version})::int` })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.documentGroupId, row.documentGroupId),
        ),
      );
    return { row, nextVersion: (maxVersion ?? row.version) + 1 };
  });
  if (!target) return null;

  const { row, nextVersion } = target;
  const stored = await putDocumentObject(orgId, row.documentGroupId, nextVersion, file);

  try {
    return await auditedTenantWrite(orgId, "documents.documents.write_rejected", () =>
      withOrg(orgId, async (tx) => {
        const [created] = await tx
          .insert(documents)
          .values({
            orgId,
            folderId: row.folderId,
            documentGroupId: row.documentGroupId,
            name: row.name,
            docType: row.docType,
            version: nextVersion,
            storagePath: stored.storagePath,
            sizeBytes: stored.sizeBytes,
            validUntil: row.validUntil,
            relatedEntityType: row.relatedEntityType,
            relatedEntityId: row.relatedEntityId,
          })
          .returning();
        return toDocumentDetail(created, todayInSaoPaulo());
      }),
    );
  } catch (error) {
    await removeDocumentObject(stored.storagePath).catch(() => {});
    throw error;
  }
}

/** Move o documento lógico (TODAS as versões do grupo) para outra pasta. 404 → null. */
export async function moveDocument(
  orgId: string,
  id: string,
  folderId: string | null,
): Promise<DocumentDetail | null> {
  return auditedTenantWrite(orgId, "documents.documents.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [target] = await tx
        .select({ groupId: documents.documentGroupId })
        .from(documents)
        .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
        .limit(1);
      if (!target) return null;
      await assertFolderInTenant(tx, orgId, folderId);
      await tx
        .update(documents)
        .set({ folderId, updatedAt: new Date() })
        .where(
          and(eq(documents.orgId, orgId), eq(documents.documentGroupId, target.groupId)),
        );
      const [current] = await tx
        .select()
        .from(documents)
        .where(
          and(eq(documents.orgId, orgId), eq(documents.documentGroupId, target.groupId)),
        )
        .orderBy(desc(documents.version))
        .limit(1);
      return toDocumentDetail(current, todayInSaoPaulo());
    }),
  );
}

export type DeleteDocumentResult = { groupId: string; deletedVersions: number };

/**
 * Exclui o documento lógico inteiro (todas as versões do grupo) numa transação;
 * os objetos do Storage são removidos em best-effort **após** o commit — falha de
 * Storage é logada e não reverte a exclusão (research §11). 404 → null.
 */
export async function deleteDocument(
  orgId: string,
  id: string,
): Promise<DeleteDocumentResult | null> {
  const outcome = await auditedTenantWrite(
    orgId,
    "documents.documents.write_rejected",
    () =>
      withOrg(orgId, async (tx) => {
        const [target] = await tx
          .select({ groupId: documents.documentGroupId })
          .from(documents)
          .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
          .limit(1);
        if (!target) return null;
        const deleted = await tx
          .delete(documents)
          .where(
            and(
              eq(documents.orgId, orgId),
              eq(documents.documentGroupId, target.groupId),
            ),
          )
          .returning({ storagePath: documents.storagePath });
        return { groupId: target.groupId, paths: deleted.map((d) => d.storagePath) };
      }),
  );
  if (!outcome) return null;

  for (const path of outcome.paths) {
    try {
      await removeDocumentObject(path);
    } catch {
      logTenantEvent("error", {
        operation: "documents.documents.delete_object",
        outcome: "rejected",
        orgId,
      });
    }
  }
  return { groupId: outcome.groupId, deletedVersions: outcome.paths.length };
}
