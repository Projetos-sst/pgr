import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as s from "../../schema/billing";
import { scope, billingTransaction, company, audit } from "./shared";
export function registerBillingCustomer(ctx: TenantContext, companyId: string) {
  return billingTransaction(ctx, async (tx) => {
    const target = await company(tx, ctx, companyId);
    const [previous] = await tx
      .select()
      .from(s.billingCustomers)
      .where(
        and(
          scope(s.billingCustomers, ctx.tenantId),
          eq(s.billingCustomers.companyId, companyId),
        ),
      );
    if (previous) {
      // Financial identity follows the company registry; changing it never rewrites a contract snapshot.
      if (previous.name !== target.razaoSocial) {
        await tx
          .update(s.billingCustomers)
          .set({ name: target.razaoSocial })
          .where(eq(s.billingCustomers.id, previous.id));
        await audit(
          tx,
          ctx,
          previous.id,
          "customer.updated",
          "Identificação atualizada a partir do cadastro da empresa.",
        );
      }
      return { id: previous.id, companyId, name: target.razaoSocial };
    }
    const [row] = await tx
      .insert(s.billingCustomers)
      .values({
        orgId: ctx.tenantId,
        companyId,
        name: target.razaoSocial,
        providerCustomerId: `mock_${randomUUID()}`,
        createdBy: ctx.userId,
      })
      .returning();
    await audit(
      tx,
      ctx,
      row.id,
      "customer.created",
      "Cliente comercial vinculado à empresa-cliente.",
    );
    return { id: row.id, companyId, name: row.name };
  });
}
export function listBillingCustomers(ctx: TenantContext, page: number) {
  return billingTransaction(ctx, (tx) =>
    tx
      .select({
        id: s.billingCustomers.id,
        companyId: s.billingCustomers.companyId,
        name: s.billingCustomers.name,
      })
      .from(s.billingCustomers)
      .where(scope(s.billingCustomers, ctx.tenantId))
      .orderBy(s.billingCustomers.name, s.billingCustomers.id)
      .limit(50)
      .offset((page - 1) * 50),
  );
}
