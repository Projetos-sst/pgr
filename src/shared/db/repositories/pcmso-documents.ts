import "server-only";

import { and, desc, eq, max, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { pcmsoDocuments as docs, type PcmsoDocument } from "../schema/pcmso-documents";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";

export type PcmsoDocumentSummary = Omit<PcmsoDocument, "content">;

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

async function assertCompany(tx: TenantTransaction, orgId: string, companyId: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!company) throw new NotFoundError();
  await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
}

const summary = {
  id: docs.id,
  orgId: docs.orgId,
  companyId: docs.companyId,
  version: docs.version,
  status: docs.status,
  cycleStart: docs.cycleStart,
  cycleEnd: docs.cycleEnd,
  examPlanId: docs.examPlanId,
  contentSha256: docs.contentSha256,
  generatedBy: docs.generatedBy,
  generatedAt: docs.generatedAt,
};

/** Versões arquivadas do PCMSO da empresa, da mais recente à mais antiga (sem o conteúdo). */
export async function listPcmsoDocuments(
  ctx: TenantContext,
  companyId: string,
): Promise<PcmsoDocumentSummary[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    return tx
      .select(summary)
      .from(docs)
      .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.companyId, companyId)))
      .orderBy(desc(docs.version));
  });
}

export async function getPcmsoDocument(
  ctx: TenantContext,
  id: string,
): Promise<PcmsoDocument> {
  return actorTx(ctx, async (tx) => {
    const [doc] = await tx
      .select()
      .from(docs)
      .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.id, id)))
      .limit(1);
    if (!doc) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, doc.companyId, "medicine");
    return doc;
  });
}

/** Arquiva uma nova versão (imutável). A RLS exige plano aprovado da mesma empresa. */
export async function insertPcmsoDocument(
  ctx: TenantContext,
  companyId: string,
  input: {
    examPlanId: string;
    cycleStart: string;
    cycleEnd: string;
    content: unknown;
    contentSha256: string;
  },
): Promise<PcmsoDocumentSummary> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.pcmso_documents.generate_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        await assertCompany(tx, ctx.tenantId, companyId);
        const [{ last }] = await tx
          .select({ last: max(docs.version) })
          .from(docs)
          .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.companyId, companyId)));
        const [created] = await tx
          .insert(docs)
          .values({
            orgId: ctx.tenantId,
            companyId,
            version: (last ?? 0) + 1,
            examPlanId: input.examPlanId,
            cycleStart: input.cycleStart,
            cycleEnd: input.cycleEnd,
            content: input.content,
            contentSha256: input.contentSha256,
            generatedBy: ctx.userId,
          })
          .returning(summary);
        return created;
      }),
  );
}
