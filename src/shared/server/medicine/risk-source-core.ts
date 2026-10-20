import "server-only";
import { createHash } from "node:crypto";
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

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function medicalSourceFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

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
    validationAvailable: false as const,
    validationNotice:
      "A autorização de profissionais para validação técnica ainda precisa ser definida. Nenhum risco é aprovado automaticamente.",
  };
}
