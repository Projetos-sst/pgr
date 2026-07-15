import "server-only";

import { and, asc, eq, lt, sql } from "drizzle-orm";

import { todayInSaoPaulo } from "@/shared/dates";

import type { PendingItemGroups } from "@/shared/domains/platform/pending-items";

import { companies, controlMeasures, epiCatalog, epiStock, pgr, risks } from "../schema";
import { withOrg } from "../with-org";

const CAP = 5;

/**
 * Listas curtas (top 5) das pendências que NÃO têm página dedicada — PGRs vencidos,
 * controles em atraso e EPIs abaixo do mínimo — cada item com link para a origem.
 * Treinamentos e devoluções de EPI já têm telas próprias (linkadas na página).
 * Tudo escopado ao tenant (filtro `org_id` explícito + RLS via `withOrg`).
 */
export async function getPendingItems(orgId: string): Promise<PendingItemGroups> {
  const today = todayInSaoPaulo();

  return withOrg(orgId, async (tx) => {
    const pgrsExpired = await tx
      .select({
        id: pgr.id,
        company: companies.razaoSocial,
        validUntil: pgr.validUntil,
      })
      .from(pgr)
      .innerJoin(
        companies,
        and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)),
      )
      .where(and(eq(pgr.orgId, orgId), lt(pgr.validUntil, today)))
      .orderBy(asc(pgr.validUntil))
      .limit(CAP);

    const controlsOverdue = await tx
      .select({
        id: controlMeasures.id,
        riskId: controlMeasures.riskId,
        description: risks.description,
        deadline: controlMeasures.actionDeadline,
      })
      .from(controlMeasures)
      .innerJoin(risks, and(eq(risks.id, controlMeasures.riskId), eq(risks.orgId, orgId)))
      .where(
        and(
          eq(controlMeasures.orgId, orgId),
          eq(controlMeasures.applicable, true),
          lt(controlMeasures.actionDeadline, today),
        ),
      )
      .orderBy(asc(controlMeasures.actionDeadline))
      .limit(CAP);

    const episLowStock = await tx
      .select({
        id: epiStock.id,
        name: epiCatalog.name,
        balance: epiStock.balance,
        minQuantity: epiStock.minQuantity,
      })
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(and(eq(epiStock.orgId, orgId), lt(epiStock.balance, epiStock.minQuantity)))
      .orderBy(sql`${epiStock.balance} asc`)
      .limit(CAP);

    return {
      pgrsExpired: pgrsExpired.map((r) => ({
        id: r.id,
        primary: r.company ?? "PGR",
        secondary: `Venceu em ${r.validUntil ?? "—"}`,
        href: `/pgr/${r.id}`,
      })),
      controlsOverdue: controlsOverdue.map((r) => ({
        id: r.id,
        primary: r.description,
        secondary: `Prazo ${r.deadline ?? "—"}`,
        href: `/risks/${r.riskId}`,
      })),
      episLowStock: episLowStock.map((r) => ({
        id: r.id,
        primary: r.name,
        secondary: `Saldo ${r.balance} (mínimo ${r.minQuantity})`,
        href: "/epi-stock",
      })),
    };
  });
}
