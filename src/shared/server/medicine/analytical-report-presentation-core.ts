import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/pcmso-analytical-reports";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  occurredOnProblem,
  reportEventInputSchema,
  reportEventVoidSchema,
  summarizeReportPresentation,
} from "@/shared/domains/medicine/analytical-report-presentation";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const uuid = (label: string) => (id: string) =>
  requiredUuid(`${label} inválido.`).parse(id);

/**
 * Finalização, apresentação e discussão do relatório analítico (NOB-168): eventos de todas as
 * versões, a versão vigente e a situação dela (derivada, nunca presumida).
 */
export async function listReportPresentation(ctx: TenantContext, companyId: string) {
  const { current, events } = await repo.listReportEvents(
    ctx,
    uuid("Empresa")(companyId),
  );
  return {
    current,
    summary: summarizeReportPresentation(events, current?.id ?? null),
    events,
  };
}

/** Registra finalização (médico responsável), apresentação ou discussão da versão vigente. */
export async function registerReportEvent(
  ctx: TenantContext,
  reportId: string,
  input: unknown,
) {
  const values = reportEventInputSchema.parse(input);
  const today = todayInSaoPaulo();
  return repo.insertReportEvent(
    ctx,
    uuid("Relatório")(reportId),
    values,
    (generatedOn) =>
      values.kind === "finalized"
        ? null
        : occurredOnProblem(values.occurredOn, generatedOn, today),
  );
}

/** Corrige um registro com motivo; o original fica no histórico. */
export async function voidReportEvent(
  ctx: TenantContext,
  eventId: string,
  input: unknown,
) {
  const { reason } = reportEventVoidSchema.parse(input);
  return repo.voidReportEvent(ctx, uuid("Registro")(eventId), reason);
}
