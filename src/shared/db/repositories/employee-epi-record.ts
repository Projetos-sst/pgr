import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { signatureStatusLabel } from "@/shared/domains/pgr/epi-deliveries";
import {
  returnedFilterFor,
  type EpiRecordQuery,
  type EpiRecordRow,
} from "@/shared/domains/pgr/epi-record";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { epiCatalog, epiDeliveries, epiDeliveryItems } from "../schema/epis";
import { employees } from "../schema/employees";

/**
 * Ficha de EPI do funcionário (US5): read model sem tabela nova — join
 * `epi_deliveries × epi_delivery_items × epi_catalog` escopado por tenant
 * (`withOrg`) e filtrado por funcionário. Ordem `delivery_date DESC`.
 * Funcionário inexistente/cross-tenant → `NotFoundError`.
 */
export async function getEmployeeEpiRecord(
  orgId: string,
  employeeId: string,
  query: EpiRecordQuery,
): Promise<Paginated<EpiRecordRow>> {
  const { limit, offset } = resolvePageParams(query);

  const filters = [
    eq(epiDeliveries.orgId, orgId),
    eq(epiDeliveries.employeeId, employeeId),
  ];
  const returned = returnedFilterFor(query.status);
  if (returned === true) filters.push(isNotNull(epiDeliveryItems.returnedAt));
  if (returned === false) filters.push(isNull(epiDeliveryItems.returnedAt));
  if (query.from) filters.push(gte(epiDeliveries.deliveryDate, query.from));
  if (query.to) filters.push(lte(epiDeliveries.deliveryDate, query.to));
  const where = and(...filters);

  const itemJoin = and(
    eq(epiDeliveryItems.deliveryId, epiDeliveries.id),
    eq(epiDeliveryItems.orgId, orgId),
  );
  const catalogJoin = and(
    eq(epiCatalog.id, epiDeliveryItems.catalogId),
    eq(epiCatalog.orgId, orgId),
  );

  return withOrg(orgId, async (tx) => {
    const [employee] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
      .limit(1);
    if (!employee) throw new NotFoundError();

    const rows = await tx
      .select({
        itemId: epiDeliveryItems.id,
        deliveryId: epiDeliveries.id,
        ca: epiCatalog.ca,
        epiName: epiCatalog.name,
        size: epiCatalog.size,
        quantity: epiDeliveryItems.quantity,
        deliveryDate: epiDeliveries.deliveryDate,
        returnedAt: epiDeliveryItems.returnedAt,
        signatureStatus: epiDeliveries.signatureStatus,
      })
      .from(epiDeliveries)
      .innerJoin(epiDeliveryItems, itemJoin)
      .innerJoin(epiCatalog, catalogJoin)
      .where(where)
      .orderBy(desc(epiDeliveries.deliveryDate), desc(epiDeliveryItems.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(epiDeliveries)
      .innerJoin(epiDeliveryItems, itemJoin)
      .innerJoin(epiCatalog, catalogJoin)
      .where(where);

    return {
      rows: rows.map((row) => ({
        ...row,
        signatureLabel: signatureStatusLabel(row.signatureStatus),
      })),
      total,
    };
  });
}
