import "server-only";
import { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";
export { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  medicalSourceInputSchema,
  medicalSourceStatus,
  medicalSourceWarnings,
  canUseMedicalRisk,
  type SourceFreshness,
} from "@/shared/domains/medicine/risk-sources";
import { todayInSaoPaulo } from "@/shared/dates";
import { ValidationError } from "@/shared/errors/validation-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import type { PageParams } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/medical-risk-sources";
import { canReviewCompanyRisks } from "@/shared/db/repositories/risk-authorizations";

export async function registerMedicalRiskSource(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const data = medicalSourceInputSchema.parse(input);
  if (data.kind === "internal") {
    const snapshot = await repo.getInternalMedicalSource(ctx.tenantId, id, data.pgrId);
    if (!snapshot) throw new NotFoundError();
    return repo.registerMedicalSource(
      ctx.tenantId,
      id,
      ctx.userId,
      {
        kind: "internal",
        title: "PGR da plataforma",
        version:
          snapshot.revisionNumber == null
            ? "Sem revisão registrada"
            : `Revisão ${snapshot.revisionNumber}`,
        reference: `PGR:${snapshot.pgrId}`,
        originPgrId: snapshot.pgrId,
        originRevision: snapshot.revisionNumber,
        fingerprint: medicalSourceFingerprint(snapshot),
        supersedesSourceId: data.supersedesSourceId,
      },
      snapshot.risks,
    );
  }
  if (data.documentDate && data.documentDate > todayInSaoPaulo())
    throw new ValidationError("A data do documento externo não pode ser futura.");
  // Campos ausentes ficam fora da impressão digital: fontes antigas mantêm o mesmo valor.
  const provenance = {
    ...(data.documentDate ? { documentDate: data.documentDate } : {}),
    ...(data.preparedBy ? { preparedBy: data.preparedBy } : {}),
    ...(data.reviewDueOn ? { reviewDueOn: data.reviewDueOn } : {}),
  };
  return repo.registerMedicalSource(
    ctx.tenantId,
    id,
    ctx.userId,
    {
      kind: "external",
      title: data.title,
      version: data.version,
      reference: data.reference,
      documentDate: data.documentDate ?? null,
      preparedBy: data.preparedBy ?? null,
      reviewDueOn: data.reviewDueOn ?? null,
      fingerprint: medicalSourceFingerprint({
        kind: data.kind,
        reference: data.reference,
        version: data.version,
        risks: data.risks,
        ...provenance,
      }),
      supersedesSourceId: data.supersedesSourceId,
    },
    data.risks,
  );
}

export async function getMedicalRiskInventory(
  ctx: TenantContext,
  companyId: string,
  params: PageParams = {},
) {
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const result = await repo.listMedicalSources(ctx.tenantId, id, params);
  const originIds = [
    ...new Set(
      result.rows
        .filter((source) => !source.superseded && source.originPgrId)
        .map((source) => source.originPgrId!),
    ),
  ];
  const currentSources = await repo.getInternalMedicalSources(
    ctx.tenantId,
    id,
    originIds,
  );
  const rows = result.rows.map((source) => {
    let freshness: SourceFreshness =
      source.kind === "external" ? "external_reference" : "unavailable";
    if (source.superseded) freshness = "superseded";
    else if (source.originPgrId) {
      const current = currentSources.find((row) => row.pgrId === source.originPgrId);
      if (current)
        freshness =
          medicalSourceFingerprint(current) === source.fingerprint
            ? "current"
            : "changed";
    }
    const warnings = medicalSourceWarnings(
      source.risks.length,
      source.risks.filter((r) => r.status === "pending").length,
      freshness,
      source.kind === "external"
        ? {
            documentDate: source.documentDate,
            reviewDueOn: source.reviewDueOn,
            today: todayInSaoPaulo(),
          }
        : undefined,
    );
    return {
      ...source,
      freshness,
      status: medicalSourceStatus(
        source.risks.map((r) => r.status),
        freshness,
      ),
      warnings,
      risks: source.risks.map((risk) => ({
        ...risk,
        usableForPcmso: canUseMedicalRisk(risk.status, freshness),
      })),
    };
  });
  return {
    rows,
    total: result.total,
    validationAvailable: await canReviewCompanyRisks(ctx, id),
    validationNotice:
      "A empresa-cliente indica o autorizador; somente profissionais com autorização ativa nesta empresa podem validar ou rejeitar riscos. Nenhum risco é aprovado automaticamente.",
  };
}
