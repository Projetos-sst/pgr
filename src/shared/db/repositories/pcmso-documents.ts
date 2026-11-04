import "server-only";

import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import type { PcmsoSignedInput } from "@/shared/domains/medicine/pcmso-signed";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import {
  pcmsoDocuments as docs,
  pcmsoSignedDocuments as signed,
  type PcmsoDocument,
  type PcmsoSignedDocument,
} from "../schema/pcmso-documents";
import { medicalExamPlans as plans } from "../schema/medical-exam-plans";
import { medicos, pcmsoCoordinatorAssignments as assignments } from "../schema/medicos";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";

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

// ── PCMSO assinado arquivado (NOB-166) ───────────────────────────────────────

export type PcmsoSignedItem = Omit<
  PcmsoSignedDocument,
  "storagePath" | "registeredAt"
> & {
  registeredAt: string;
  previewVersion: number;
  cycleStart: string;
  cycleEnd: string;
  replacedById: string | null;
};

async function signedOfCompanyTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
) {
  const rows = await tx
    .select({
      row: signed,
      previewVersion: docs.version,
      cycleStart: docs.cycleStart,
      cycleEnd: docs.cycleEnd,
    })
    .from(signed)
    .innerJoin(docs, eq(docs.id, signed.previewDocumentId))
    .where(and(eq(signed.orgId, orgId), eq(signed.companyId, companyId)))
    .orderBy(asc(signed.registeredAt));
  return rows;
}

function toSignedItems(
  rows: Awaited<ReturnType<typeof signedOfCompanyTx>>,
): PcmsoSignedItem[] {
  return rows.map(({ row, previewVersion, cycleStart, cycleEnd }) => {
    const { storagePath, ...rest } = row;
    void storagePath;
    return {
      ...rest,
      registeredAt: row.registeredAt.toISOString(),
      previewVersion,
      cycleStart,
      cycleEnd,
      replacedById: rows.find((other) => other.row.replacesId === row.id)?.row.id ?? null,
    };
  });
}

/** Coordenador designado vigente da empresa, com CRM/UF do cadastro. */
async function currentCoordinatorTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
) {
  const [row] = await tx
    .select({
      medicoId: assignments.medicoId,
      startsOn: assignments.startsOn,
      crm: medicos.crm,
      uf: medicos.registrationUf,
    })
    .from(assignments)
    .innerJoin(
      medicos,
      and(eq(medicos.id, assignments.medicoId), eq(medicos.orgId, assignments.orgId)),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.companyId, companyId),
        isNull(assignments.endsOn),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** PCMSOs assinados da empresa e o contexto para os alertas de desatualização. */
export async function listSignedPcmsos(ctx: TenantContext, companyId: string) {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    const rows = await signedOfCompanyTx(tx, ctx.tenantId, companyId);
    const [{ last }] = await tx
      .select({ last: max(docs.version) })
      .from(docs)
      .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.companyId, companyId)));
    const [approved] = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(
        and(
          eq(plans.orgId, ctx.tenantId),
          eq(plans.companyId, companyId),
          eq(plans.status, "approved"),
        ),
      )
      .limit(1);
    const coordinator = await currentCoordinatorTx(tx, ctx.tenantId, companyId);
    return {
      items: toSignedItems(rows),
      latestPreviewVersion: last ?? null,
      approvedPlanId: approved?.id ?? null,
      coordinator: coordinator ? { crm: coordinator.crm, uf: coordinator.uf } : null,
    };
  });
}

export async function getSignedPcmso(
  ctx: TenantContext,
  id: string,
): Promise<PcmsoSignedDocument> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(signed)
      .where(and(eq(signed.orgId, ctx.tenantId), eq(signed.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, row.companyId, "medicine");
    return row;
  });
}

export type SignedPcmsoFile = {
  id: string;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
};

/**
 * Registra o PCMSO assinado já gravado no storage. Confere no servidor (e a RLS de novo):
 * - prévia da empresa, a mais recente, com o plano aprovado vigente;
 * - signatário = coordenador designado vigente (CRM/UF do cadastro);
 * - fluxo do coordenador: só a conta vinculada e verificada dele; fluxo do escritório: equipe;
 * - datas coerentes; um PCMSO assinado vigente por empresa (novo = substituição, com motivo).
 */
export async function insertSignedPcmso(
  ctx: TenantContext,
  companyId: string,
  input: PcmsoSignedInput,
  file: SignedPcmsoFile,
  checkDates: (facts: {
    previewGeneratedOn: string;
    coordinatorStartsOn: string;
    cycleEnd: string;
  }) => string | null,
): Promise<PcmsoSignedItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.pcmso_signed.register_rejected", () =>
    actorTx(ctx, async (tx) => {
      await assertCompany(tx, ctx.tenantId, companyId);
      // Serializa registros concorrentes da mesma empresa (a cadeia de substituição é única).
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`pcmso-signed:${ctx.tenantId}:${companyId}`}, 0))`,
      );
      const [preview] = await tx
        .select()
        .from(docs)
        .where(
          and(
            eq(docs.orgId, ctx.tenantId),
            eq(docs.companyId, companyId),
            eq(docs.id, input.previewDocumentId),
          ),
        )
        .limit(1);
      if (!preview) throw new ValidationError("A prévia informada não é desta empresa.");
      const [{ last }] = await tx
        .select({ last: max(docs.version) })
        .from(docs)
        .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.companyId, companyId)));
      if (preview.version !== last)
        throw new ValidationError(
          "Registre a assinatura da prévia mais recente: uma versão antiga não vira o PCMSO vigente.",
        );
      const [approved] = await tx
        .select({ id: plans.id })
        .from(plans)
        .where(
          and(
            eq(plans.orgId, ctx.tenantId),
            eq(plans.companyId, companyId),
            eq(plans.status, "approved"),
          ),
        )
        .limit(1);
      if (!approved || approved.id !== preview.examPlanId)
        throw new ValidationError(
          "O plano de exames da prévia não é o plano aprovado vigente: gere uma nova prévia.",
        );
      const coordinator = await currentCoordinatorTx(tx, ctx.tenantId, companyId);
      if (
        !coordinator ||
        coordinator.crm !== input.signerRegistration ||
        coordinator.uf !== input.signerUf
      )
        throw new ValidationError(
          "O signatário não é o médico responsável designado para a empresa (CRM/UF do cadastro).",
        );
      if (input.origin === "coordinator") {
        const allowed = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
        if (!allowed.includes(coordinator.medicoId))
          throw new ForbiddenError(
            "Só o médico responsável designado, pela conta vinculada e com identidade verificada, registra o PCMSO assinado por ele.",
          );
      }
      const dateProblem = checkDates({
        previewGeneratedOn: new Date(preview.generatedAt.getTime() - 3 * 3600 * 1000)
          .toISOString()
          .slice(0, 10),
        coordinatorStartsOn: coordinator.startsOn,
        cycleEnd: preview.cycleEnd,
      });
      if (dateProblem) throw new ValidationError(dateProblem);

      const existing = await signedOfCompanyTx(tx, ctx.tenantId, companyId);
      const replaced = new Set(existing.map((r) => r.row.replacesId).filter(Boolean));
      const current = existing.find((r) => !replaced.has(r.row.id))?.row ?? null;
      if (current && input.replacesId !== current.id)
        throw new ValidationError(
          "A empresa já tem PCMSO assinado vigente. Registre a nova versão como substituição do vigente, com tipo de mudança e motivo.",
        );
      if (!current && input.replacesId)
        throw new ValidationError(
          "O documento a substituir não é o PCMSO assinado vigente.",
        );

      try {
        await tx.insert(signed).values({
          id: file.id,
          orgId: ctx.tenantId,
          companyId,
          previewDocumentId: preview.id,
          previewSha256: preview.contentSha256,
          examPlanId: preview.examPlanId,
          origin: input.origin,
          signatureMethod: input.signatureMethod,
          signerName: input.signerName,
          signerRegistration: input.signerRegistration,
          signerUf: input.signerUf,
          signedOn: input.signedOn,
          verificationReference: input.verificationReference,
          storagePath: file.storagePath,
          fileSha256: file.sha256,
          sizeBytes: file.sizeBytes,
          replacesId: input.replacesId,
          changeKind: input.changeKind,
          replaceReason: input.replaceReason,
          registeredBy: ctx.userId,
        });
      } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (code === "42501")
          throw new ForbiddenError(
            "Registro recusado pelo banco: confira se você é o médico responsável verificado (fluxo do coordenador) ou da equipe do escritório.",
          );
        if (code === "23505")
          throw new ValidationError("Este documento já foi substituído.");
        throw error;
      }
      const after = await signedOfCompanyTx(tx, ctx.tenantId, companyId);
      return toSignedItems(after).find((item) => item.id === file.id)!;
    }),
  );
}
