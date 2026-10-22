import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, desc, like } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as s from "../../schema/billing";
import { scope, billingTransaction, audit, conflict } from "./shared";
export function createBillingPortal(
  ctx: TenantContext,
  input: { customerId: string; key: string },
) {
  return billingTransaction(ctx, async (tx) => {
    const [customer] = await tx
      .select()
      .from(s.billingCustomers)
      .where(
        and(
          scope(s.billingCustomers, ctx.tenantId),
          eq(s.billingCustomers.id, input.customerId),
        ),
      );
    if (!customer) throw new NotFoundError();
    const hash = createHash("sha256").update(input.customerId).digest("hex");
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
      if (
        previous.kind !== "portal" ||
        previous.requestHash !== hash ||
        previous.createdBy !== ctx.userId
      )
        conflict("Chave já utilizada com outra sessão ou cliente.");
      if (previous.expiresAt <= new Date())
        conflict("A sessão expirou. Solicite um novo portal.");
      return {
        sessionId: previous.id,
        customerId: customer.providerCustomerId,
        expiresAt: previous.expiresAt.toISOString(),
      };
    }
    const sessionId = randomUUID(),
      expiresAt = new Date(Date.now() + 10 * 60000);
    await tx.insert(s.billingOperations).values({
      id: sessionId,
      orgId: ctx.tenantId,
      key: input.key,
      kind: "portal",
      requestHash: hash,
      resultId: customer.id,
      expiresAt,
      createdBy: ctx.userId,
    });
    await audit(
      tx,
      ctx,
      customer.id,
      "portal.created",
      "Sessão temporária privada do portal simulado.",
    );
    return {
      sessionId,
      customerId: customer.providerCustomerId,
      expiresAt: expiresAt.toISOString(),
    };
  });
}
export function validateBillingPortal(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    const [row] = await tx
      .select({
        id: s.billingOperations.id,
        expiresAt: s.billingOperations.expiresAt,
        companyId: s.billingCustomers.companyId,
        companyName: s.billingCustomers.name,
      })
      .from(s.billingOperations)
      .innerJoin(
        s.billingCustomers,
        and(
          eq(s.billingCustomers.id, s.billingOperations.resultId),
          eq(s.billingCustomers.orgId, s.billingOperations.orgId),
        ),
      )
      .where(
        and(
          scope(s.billingOperations, ctx.tenantId),
          eq(s.billingOperations.id, id),
          eq(s.billingOperations.kind, "portal"),
          eq(s.billingOperations.createdBy, ctx.userId),
        ),
      );
    if (!row || row.expiresAt <= new Date())
      throw new NotFoundError("Portal inválido ou expirado. Solicite outra sessão.");
    return { ...row, expiresAt: row.expiresAt.toISOString(), simulated: true };
  });
}
export function getBillingPaymentProfile(ctx: TenantContext, customerId: string) {
  return billingTransaction(ctx, async (tx) => {
    const [row] = await tx
      .select({ id: s.billingCustomers.id })
      .from(s.billingCustomers)
      .where(
        and(
          scope(s.billingCustomers, ctx.tenantId),
          eq(s.billingCustomers.id, customerId),
        ),
      );
    if (!row) throw new NotFoundError();
    return {
      customerId: row.id,
      provider: "mock" as const,
      simulated: true,
      paymentMethod:
        (
          await tx
            .select({ at: s.billingOperations.createdAt })
            .from(s.billingOperations)
            .where(
              and(
                scope(s.billingOperations, ctx.tenantId),
                eq(s.billingOperations.resultId, customerId),
                like(s.billingOperations.kind, "payment_profile:%"),
              ),
            )
            .orderBy(desc(s.billingOperations.createdAt), desc(s.billingOperations.id))
            .limit(1)
        )
          .map((method) => ({
            brand: "Visa (teste)",
            last4: "4242",
            synchronizedAt: method.at.toISOString(),
          }))
          .at(0) ?? null,
      portalAvailable: true,
    };
  });
}
export async function updateMockPaymentProfile(ctx: TenantContext, sessionId: string) {
  // Session validation and write share the tenant lock: no check/write race.
  return billingTransaction(ctx, async (tx) => {
    const [session] = await tx
      .select()
      .from(s.billingOperations)
      .where(
        and(
          scope(s.billingOperations, ctx.tenantId),
          eq(s.billingOperations.id, sessionId),
          eq(s.billingOperations.kind, "portal"),
          eq(s.billingOperations.createdBy, ctx.userId),
        ),
      );
    if (!session || session.expiresAt <= new Date())
      throw new NotFoundError("Portal inválido ou expirado.");
    const key = `payment-profile:${sessionId}`;
    const [previous] = await tx
      .select({ id: s.billingOperations.id })
      .from(s.billingOperations)
      .where(
        and(scope(s.billingOperations, ctx.tenantId), eq(s.billingOperations.key, key)),
      );
    if (!previous) {
      await tx.insert(s.billingOperations).values({
        orgId: ctx.tenantId,
        key,
        kind: "payment_profile:visa_4242",
        requestHash: "predefined-synthetic-visa-4242",
        resultId: session.resultId,
        expiresAt: session.expiresAt,
        createdBy: ctx.userId,
      });
      await audit(
        tx,
        ctx,
        session.resultId,
        "payment_profile.synchronized",
        "Método de teste predefinido sincronizado pelo portal simulado; nenhum cartão real recebido.",
      );
    }
    return { simulated: true, synchronized: true };
  });
}
