import "server-only";
import { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";
export { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  medicalSourceInputSchema,
  medicalSourceWarnings,
  canUseMedicalRisk,
  type SourceFreshness,
} from "@/shared/domains/medicine/risk-sources";
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
  return repo.registerMedicalSource(
    ctx.tenantId,
    id,
    ctx.userId,
    {
      kind: "external",
      title: data.title,
      version: data.version,
      reference: data.reference,
      fingerprint: medicalSourceFingerprint({
        kind: data.kind,
        reference: data.reference,
        version: data.version,
        risks: data.risks,
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
    );
    return {
      ...source,
      freshness,
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
