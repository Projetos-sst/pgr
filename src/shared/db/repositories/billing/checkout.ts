import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { mockCustomerIdentity } from "@/shared/integrations/billing/mock-gateway";
import {
  scope,
  conflict,
  billingTransaction,
  audit,
  contract,
  offer,
  company,
} from "./shared";
export function createCheckout(
  ctx: TenantContext,
  input: {
    companyId: string;
    priceId: string;
    key: string;
  },
) {
  return billingTransaction(ctx, async (tx) => {
    const requestHash = createHash("sha256")
      .update(JSON.stringify([input.companyId, input.priceId]))
      .digest("hex");
    const [previous] = await tx
      .select()
      .from(s.billingOperations)
      .where(
        and(
          scope(s.billingOperations, ctx.tenantId),
          eq(s.billingOperations.key, input.key),
        ),
      );
    if (previous) {
      if (previous.kind !== "checkout" || previous.requestHash !== requestHash)
        conflict("Chave já utilizada com outra operação ou conteúdo.");
      const row = await contract(tx, ctx, previous.resultId);
      return {
        sessionId: previous.id,
        contractId: row.id,
        customerId: row.customerId,
        expiresAt: previous.expiresAt.toISOString(),
        snapshot: row.snapshot,
      };
    }
    const target = await company(tx, ctx, input.companyId);
    const selected = await offer(tx, ctx, input.priceId);
    if (
      selected.data.interval === "one_time" &&
      selected.data.items.some((i) => i.product === "pro")
    )
      conflict("Selecione uma oferta avulsa somente de PGR ou Medicina.");
    const [latest] = await tx
      .select({ id: s.billingOffers.id })
      .from(s.billingOffers)
      .where(
        and(
          scope(s.billingOffers, ctx.tenantId),
          eq(s.billingOffers.code, selected.code),
        ),
      )
      .orderBy(desc(s.billingOffers.version))
      .limit(1);
    if (latest.id !== selected.id)
      conflict("O preço foi atualizado. Consulte a oferta atual antes de contratar.");
    let [customer] = await tx
      .select()
      .from(s.billingCustomers)
      .where(
        and(
          scope(s.billingCustomers, ctx.tenantId),
          eq(s.billingCustomers.companyId, target.id),
        ),
      );
    if (!customer) {
      const customerId = randomUUID();
      [customer] = await tx
        .insert(s.billingCustomers)
        .values({
          id: customerId,
          orgId: ctx.tenantId,
          companyId: target.id,
          name: target.razaoSocial,
          providerCustomerId: mockCustomerIdentity(ctx.tenantId, customerId),
          createdBy: ctx.userId,
        })
        .returning();
    }
    if (selected.data.interval !== "one_time") {
      const existing = await tx
        .select()
        .from(s.billingContracts)
        .where(
          and(
            scope(s.billingContracts, ctx.tenantId),
            eq(s.billingContracts.customerId, customer.id),
          ),
        );
      for (const previous of existing) {
        if (
          previous.snapshot.interval !== "one_time" &&
          (previous.status === "unpaid" ||
            (previous.cancelAtPeriodEnd &&
              previous.periodEnd &&
              previous.periodEnd <= new Date()))
        ) {
          await tx
            .update(s.billingContracts)
            .set({
              status: "canceled",
              cancelAtPeriodEnd: false,
              revision: previous.revision + 1,
            })
            .where(eq(s.billingContracts.id, previous.id));
          await tx
            .update(s.billingEntitlements)
            .set({ active: false })
            .where(
              and(
                scope(s.billingEntitlements, ctx.tenantId),
                eq(s.billingEntitlements.contractId, previous.id),
              ),
            );
          await audit(
            tx,
            ctx,
            previous.id,
            "checkout.superseded",
            "Tentativa encerrada antes de iniciar nova contratação simulada.",
          );
          previous.status = "canceled";
        }
      }
      if (
        existing.some(
          (c) =>
            c.snapshot.interval !== "one_time" &&
            !["canceled", "expired", "unpaid"].includes(c.status),
        )
      )
        conflict(
          "A empresa já possui uma assinatura em andamento. Use a alteração de plano.",
        );
    }
    const id = randomUUID(),
      sessionId = randomUUID(),
      expiresAt = new Date(Date.now() + 30 * 60000);
    await tx.insert(s.billingContracts).values({
      id,
      orgId: ctx.tenantId,
      customerId: customer.id,
      offerId: selected.id,
      snapshot: selected.data,
      providerSubscriptionId: `mock_${id}`,
      createdBy: ctx.userId,
    });
    await tx.insert(s.billingOperations).values({
      id: sessionId,
      orgId: ctx.tenantId,
      key: input.key,
      kind: "checkout",
      requestHash,
      resultId: id,
      expiresAt,
      createdBy: ctx.userId,
    });
    await audit(
      tx,
      ctx,
      id,
      "checkout.created",
      "Checkout simulado; nenhuma cobrança real.",
    );
    return {
      sessionId,
      contractId: id,
      customerId: customer.id,
      expiresAt: expiresAt.toISOString(),
      snapshot: selected.data,
    };
  });
}
export function bindMockCustomer(
  ctx: TenantContext,
  id: string,
  providerCustomerId: string,
) {
  return billingTransaction(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(s.billingCustomers)
      .where(and(scope(s.billingCustomers, ctx.tenantId), eq(s.billingCustomers.id, id)));
    if (!row) conflict("Cliente comercial indisponível.");
    if (providerCustomerId !== mockCustomerIdentity(ctx.tenantId, id))
      conflict("Identificador do provedor inconsistente.");
    if (row.providerCustomerId !== providerCustomerId) {
      await tx
        .update(s.billingCustomers)
        .set({ providerCustomerId })
        .where(eq(s.billingCustomers.id, id));
      await audit(
        tx,
        ctx,
        id,
        "customer.provider_linked",
        "Vínculo idempotente ao provedor simulado.",
      );
    }
  });
}
