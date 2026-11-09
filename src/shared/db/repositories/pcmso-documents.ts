import "server-only";

import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { planRiskIds } from "@/shared/domains/medicine/exam-plan";
import {
  previewCoordinator,
  PREVIEW_NAMES_OTHER_COORDINATOR_MESSAGE,
  previewRisks,
  RISK_BASIS_PROBLEM_MESSAGES,
  riskBasisProblems,
  snapshotSources,
  type PcmsoSignedInput,
  type RiskBasisProblem,
} from "@/shared/domains/medicine/pcmso-signed";
import {
  compareProfessionalRegistration,
  registeredNotCanonicalMessage,
} from "@/shared/domains/pgr/medicos";
import {
  SIGNED_CURRENT_AMBIGUOUS_MESSAGE,
  signedCurrentRows,
} from "@/shared/domains/medicine/aso-signed";
import { DuplicateError } from "@/shared/errors/duplicate-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { signedCurrentConflict } from "./signed-current";
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
import { medicos } from "../schema/medicos";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";
import { liveMedicalRiskBasisTx } from "./medical-risk-basis";
import { lockMedicalRiskBasisTx } from "./medical-risk-sources";
import { assignmentInForceTodayTx } from "./pcmso-coordinator-in-force";
import { dateInSaoPaulo } from "@/shared/dates";

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
  riskBasisDigest: docs.riskBasisDigest,
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
            riskBasisDigest: sql`public.medical_risk_basis_digest(${ctx.tenantId}, ${companyId}::uuid)`,
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

/**
 * Coordenador da empresa com designação em vigor hoje e única (America/Sao_Paulo; NOB-109), com
 * CRM/UF do cadastro. Sem designação vigente ou com sobreposição → `null` (quem usa nega).
 */
async function currentCoordinatorTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
) {
  const assignment = await assignmentInForceTodayTx(tx, orgId, companyId);
  if (!assignment) return null;
  const [medico] = await tx
    .select({ crm: medicos.crm, uf: medicos.registrationUf })
    .from(medicos)
    .where(and(eq(medicos.orgId, orgId), eq(medicos.id, assignment.medicoId)))
    .limit(1);
  return medico
    ? {
        medicoId: assignment.medicoId,
        startsOn: assignment.startsOn,
        crm: medico.crm,
        uf: medico.uf,
      }
    : null;
}

/**
 * Confere a base de riscos do documento contra a vigente, na transação (NR-7 7.5.1, 7.5.5;
 * SEG-21). Fontes vigentes = não substituídas; fonte interna só conta se o PGR de origem ainda
 * tem a mesma impressão digital (recalculada aqui); riscos utilizáveis = validados em fonte
 * conferível. Com `lock`, toma a trava da base de riscos da empresa (a mesma do registro de fonte e
 * da revisão técnica), para nenhuma mudança concorrente passar entre a conferência e a gravação.
 */
async function riskBasisProblemsTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  basis: { previewContent: unknown; planBasedOn: unknown; previewDigest: string | null },
  { lock = false } = {},
): Promise<RiskBasisProblem[]> {
  if (lock) await lockMedicalRiskBasisTx(tx, orgId, companyId);
  const live = await liveMedicalRiskBasisTx(tx, orgId, companyId);
  const [digest] = (await tx.execute(
    sql`select public.medical_risk_basis_digest(${orgId}, ${companyId}::uuid) as digest`,
  )) as unknown as { digest: string | null }[];
  return riskBasisProblems({
    previewDigest: basis.previewDigest,
    currentDigest: digest?.digest ?? null,
    live: live.sources,
    liveFresh: live.fresh,
    liveRisks: live.risks,
    liveRiskIds: live.riskIds,
    previewSources: snapshotSources(
      (basis.previewContent as { riskBasis?: { sources?: unknown } })?.riskBasis?.sources,
    ),
    planSources: snapshotSources((basis.planBasedOn as { sources?: unknown })?.sources),
    planRiskIds: planRiskIds(basis.planBasedOn),
    previewRisks: previewRisks(basis.previewContent),
  });
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
    const items = toSignedItems(rows);
    const currentItem = items.find((item) => item.replacedById === null) ?? null;
    let riskBasisChanged = false;
    let currentPreviewCoordinator: ReturnType<typeof previewCoordinator> = null;
    if (currentItem) {
      const [preview] = await tx
        .select({ content: docs.content, riskBasisDigest: docs.riskBasisDigest })
        .from(docs)
        .where(
          and(eq(docs.orgId, ctx.tenantId), eq(docs.id, currentItem.previewDocumentId)),
        )
        .limit(1);
      currentPreviewCoordinator = previewCoordinator(preview?.content);
      const [plan] = await tx
        .select({ basedOn: plans.basedOn })
        .from(plans)
        .where(and(eq(plans.orgId, ctx.tenantId), eq(plans.id, currentItem.examPlanId)))
        .limit(1);
      riskBasisChanged =
        (
          await riskBasisProblemsTx(tx, ctx.tenantId, companyId, {
            previewContent: preview?.content,
            planBasedOn: plan?.basedOn,
            previewDigest: preview?.riskBasisDigest ?? null,
          })
        ).length > 0;
    }
    return {
      riskBasisChanged,
      currentPreviewCoordinator,
      items,
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
 * - signatário = coordenador com designação em vigor hoje e única (CRM/UF do cadastro; NOB-109);
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
      const [planRow] = await tx
        .select({ basedOn: plans.basedOn })
        .from(plans)
        .where(and(eq(plans.orgId, ctx.tenantId), eq(plans.id, approved.id)))
        .limit(1);
      const problems = await riskBasisProblemsTx(
        tx,
        ctx.tenantId,
        companyId,
        {
          previewContent: preview.content,
          planBasedOn: planRow?.basedOn,
          previewDigest: preview.riskBasisDigest,
        },
        { lock: true },
      );
      if (problems.length)
        throw new ValidationError(
          problems.map((code) => RISK_BASIS_PROBLEM_MESSAGES[code]).join(" "),
        );
      // Signatário e autoria = coordenador em vigor HOJE (NOB-109), não a designação "aberta".
      const coordinator = await currentCoordinatorTx(tx, ctx.tenantId, companyId);
      if (!coordinator)
        throw new ValidationError(
          "A empresa não tem médico responsável pelo PCMSO em vigor hoje (designação futura, encerrada ou sobreposta): o PCMSO assinado não pode ser registrado.",
        );
      // Conferência de consistência, tolerante só à formatação do número (NOB-110); no fluxo do
      // coordenador, quem registra continua decidido pelo vínculo verificado logo abaixo.
      const match = compareProfessionalRegistration(coordinator, {
        registration: input.signerRegistration,
        uf: input.signerUf,
      });
      if (match === "registered_not_canonical")
        throw new ValidationError(
          registeredNotCanonicalMessage(
            "do médico responsável designado",
            coordinator.crm,
          ),
        );
      if (match !== "match")
        throw new ValidationError(
          "O signatário não é o médico responsável designado para a empresa (CRM/UF do cadastro).",
        );
      // A prévia assinada tem de nomear o MESMO médico que assina (o coordenador em vigor hoje):
      // depois de uma troca, a prévia antiga imprime o coordenador anterior como responsável e não
      // vira o PCMSO vigente assinado por outro (NR-7 7.4.1 c; MED-12). Mesma conferência tolerante
      // só à formatação do número (NOB-110); a RLS repete a regra.
      const named = previewCoordinator(preview.content);
      if (
        !named ||
        compareProfessionalRegistration(coordinator, {
          registration: named.crm,
          uf: named.registrationUf ?? "",
        }) !== "match"
      )
        throw new ValidationError(PREVIEW_NAMES_OTHER_COORDINATOR_MESSAGE);
      if (input.origin === "coordinator") {
        const allowed = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
        if (!allowed.includes(coordinator.medicoId))
          throw new ForbiddenError(
            "Só o médico responsável designado, pela conta vinculada e com identidade verificada, registra o PCMSO assinado por ele.",
          );
      }
      // Início da designação: a do médico nomeado na prévia e a vigente hoje (o mesmo médico, mas
      // pode ser outra designação dele); vale a mais recente, para a assinatura nunca anteceder
      // nenhuma das duas.
      const startsOn = [coordinator.startsOn, named.startsOn ?? ""].sort().at(-1)!;
      const dateProblem = checkDates({
        previewGeneratedOn: dateInSaoPaulo(preview.generatedAt) ?? "",
        coordinatorStartsOn: startsOn,
        cycleEnd: preview.cycleEnd,
      });
      if (dateProblem) throw new ValidationError(dateProblem);

      const existing = await signedOfCompanyTx(tx, ctx.tenantId, companyId);
      const currents = signedCurrentRows(existing.map((r) => r.row));
      if (currents.length > 1) throw new DuplicateError(SIGNED_CURRENT_AMBIGUOUS_MESSAGE);
      const current = currents[0] ?? null;
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
          // Signatário como está no cadastro do coordenador (o que a prévia imprime e o que a RLS
          // confere, por igualdade exata, contra `medicos`).
          signerRegistration: coordinator.crm,
          signerUf: coordinator.uf ?? input.signerUf,
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
        const currentConflict = signedCurrentConflict(
          error,
          "pcmso_signed_current_unique",
        );
        if (currentConflict) throw currentConflict;
        if (code === "23505")
          throw new ValidationError("Este documento já foi substituído.");
        throw error;
      }
      const after = await signedOfCompanyTx(tx, ctx.tenantId, companyId);
      return toSignedItems(after).find((item) => item.id === file.id)!;
    }),
  );
}
