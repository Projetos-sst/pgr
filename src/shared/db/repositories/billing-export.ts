import "server-only";
import { sql } from "drizzle-orm";
import { ForbiddenError } from "@/shared/auth/errors";
import { isBillingSimulationEnabled } from "@/shared/domains/billing/contracts";
export function commercialSimulationOn() {
  return isBillingSimulationEnabled({
    APP_ENV: process.env.APP_ENV,
    BILLING_MODE: process.env.BILLING_MODE,
    BILLING_MOCK_ENABLED: process.env.BILLING_MOCK_ENABLED,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
  });
}
/** Boolean lookup also works after trial expiry hides the PGR through RLS. */
export async function pgrBillingExportAllowed(
  orgId: string,
  pgrId: string,
): Promise<boolean> {
  if (!commercialSimulationOn()) return true;
  const { withOrg } = await import("../with-org");
  const result = await withOrg(orgId, (tx) =>
    tx.execute<{ allowed: boolean }>(
      sql`select public.billing_pgr_export_allowed(${orgId},${pgrId}::uuid) as allowed`,
    ),
  );
  return result[0]?.allowed === true;
}
export async function assertPgrBillingExportAllowed(orgId: string, pgrId: string) {
  if (!(await pgrBillingExportAllowed(orgId, pgrId)))
    throw new ForbiddenError(
      "Impressão e exportação indisponíveis durante o teste. Contrate o serviço para emitir documentos.",
    );
}

/** SEG-28: downloads during an active trial are demonstrations, never issuance. */
export async function pgrBillingPreviewMode(
  orgId: string,
  pgrId: string,
): Promise<"full" | "demonstration" | "blocked"> {
  if (await pgrBillingExportAllowed(orgId, pgrId)) return "full";
  const { withOrg } = await import("../with-org");
  const rows = await withOrg(orgId, (tx) =>
    tx.execute<{ allowed: boolean }>(sql`
    select exists(select 1 from public.pgr p
      join public.billing_trials t on t.company_id=p.company_id and t.org_id=p.org_id
      where p.org_id=${orgId} and p.id=${pgrId}::uuid and t.ends_at>now()
      and public.billing_trial_identity_matches(${orgId},p.company_id,t.id)) as allowed
  `),
  );
  return rows[0]?.allowed === true ? "demonstration" : "blocked";
}

export async function requirePgrBillingPreview(orgId: string, pgrId: string) {
  const mode = await pgrBillingPreviewMode(orgId, pgrId);
  if (mode === "blocked")
    throw new ForbiddenError(
      "Download indisponível. Consulte a situação do serviço contratado.",
    );
  return mode;
}
export async function companyBillingExportAllowed(
  orgId: string,
  companyId: string,
  product: "pgr" | "medicine",
) {
  if (!commercialSimulationOn()) return true;
  const { withOrg } = await import("../with-org");
  const rows = await withOrg(orgId, (tx) =>
    tx.execute<{ allowed: boolean }>(
      sql`select public.billing_company_export_allowed(${orgId},${companyId}::uuid,${product}) as allowed`,
    ),
  );
  return rows[0]?.allowed === true;
}
/** Reusable gate for the future PCMSO/ASO emitters; it never replaces technical authorization. */
export async function assertCompanyBillingExportAllowed(
  orgId: string,
  companyId: string,
  product: "pgr" | "medicine",
) {
  if (!(await companyBillingExportAllowed(orgId, companyId, product)))
    throw new ForbiddenError(
      "Impressão e exportação indisponíveis durante o teste. Contrate o serviço para emitir documentos.",
    );
}
