import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { isValidCnpj } from "@/shared/domains/pgr/cnpj";
import { ValidationError } from "@/shared/errors/validation-error";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { scope, billingTransaction, audit, company } from "./shared";
export function startBillingTrial(ctx: TenantContext, companyId: string) {
  return billingTransaction(ctx, async (tx) => {
    const selected = await company(tx, ctx, companyId);
    const [previous] = await tx
      .select()
      .from(s.billingTrials)
      .where(
        and(
          scope(s.billingTrials, ctx.tenantId),
          eq(s.billingTrials.companyId, companyId),
        ),
      );
    if (previous) {
      const rows = await tx.execute<{ matches: boolean }>(
        sql`select public.billing_trial_identity_matches(${ctx.tenantId},${companyId}::uuid,${previous.id}::uuid) as matches`,
      );
      if (rows[0]?.matches !== true)
        throw new ValidationError(
          "O CNPJ mudou desde o início do teste. O teste original não pode ser transferido ou reiniciado.",
        );
      return previous;
    }
    if (!selected.cnpj || !isValidCnpj(selected.cnpj))
      throw new ValidationError(
        "Informe um CNPJ válido antes de iniciar o teste grátis.",
      );
    const startedAt = new Date(),
      endsAt = new Date(startedAt.getTime() + 15 * 86400000);
    const [row] = await tx
      .insert(s.billingTrials)
      .values({
        orgId: ctx.tenantId,
        companyId,
        startedAt,
        endsAt,
        createdBy: ctx.userId,
      })
      .returning();
    await tx.execute(
      sql`select public.claim_billing_trial(${ctx.tenantId},${companyId}::uuid,${row.id}::uuid)`,
    );
    await audit(
      tx,
      ctx,
      row.id,
      "trial.started",
      "Teste simulado de 15 dias; downloads de demonstração com marca, sem emissão ou assinatura.",
    );
    return row;
  });
}
export function getBillingTrial(ctx: TenantContext, companyId: string) {
  return billingTransaction(ctx, async (tx) => {
    await company(tx, ctx, companyId);
    const [row] = await tx
      .select()
      .from(s.billingTrials)
      .where(
        and(
          scope(s.billingTrials, ctx.tenantId),
          eq(s.billingTrials.companyId, companyId),
        ),
      );
    return row ?? null;
  });
}
