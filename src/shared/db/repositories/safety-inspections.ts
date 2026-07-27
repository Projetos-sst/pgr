import "server-only";

import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type {
  OccurrencesValues,
  SafetyInspectionDetail,
  SafetyInspectionHeaderValues,
  SafetyInspectionListItem,
} from "@/shared/domains/inspections/safety-inspections";
import { toSafetyInspectionListItem } from "@/shared/domains/inspections/safety-inspections";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { companies } from "../schema";
import {
  inspectionCategory,
  inspectionOccurrences,
  inspectionStatus,
  inspections,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.safety.write_rejected";
const countExpr = sql<number>`count(*)::int`;

const occurrenceCountExpr = sql<number>`(
  select count(*)::int from inspection_occurrences io where io.inspection_id = "inspections"."id"
)`;

export type ListSafetyInspectionsParams = PageParams & {
  status?: string;
  category?: string;
  companyId?: string;
  /** Busca livre por área/setor (case-insensitive). */
  search?: string;
};

type InspectionStatusValue = (typeof inspectionStatus.enumValues)[number];
type InspectionCategoryValue = (typeof inspectionCategory.enumValues)[number];

/*
 * `status` e `category` chegam de query string. Comparar direto com as colunas
 * faria o Postgres abortar a consulta inteira num valor fora do enum (22P02) —
 * o que a tela leria como "nenhum registro". Valor desconhecido é tratado como
 * ausência de filtro.
 */
function toEnumValue<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export async function listSafetyInspections(
  orgId: string,
  params: ListSafetyInspectionsParams = {},
): Promise<Paginated<SafetyInspectionListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(inspections.orgId, orgId), eq(inspections.type, "safety")];
  const status = toEnumValue<InspectionStatusValue>(
    inspectionStatus.enumValues,
    params.status,
  );
  if (status) filters.push(eq(inspections.status, status));
  const category = toEnumValue<InspectionCategoryValue>(
    inspectionCategory.enumValues,
    params.category,
  );
  if (category) filters.push(eq(inspections.category, category));
  if (params.companyId) filters.push(eq(inspections.companyId, params.companyId));
  const search = params.search?.trim();
  if (search) filters.push(ilike(inspections.area, `%${search}%`));
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: inspections.id,
        inspectedAt: inspections.inspectedAt,
        status: inspections.status,
        category: inspections.category,
        area: inspections.area,
        companyName: companies.razaoSocial,
        occurrenceCount: occurrenceCountExpr,
      })
      .from(inspections)
      .leftJoin(companies, eq(companies.id, inspections.companyId))
      .where(where)
      .orderBy(desc(inspections.inspectedAt), desc(inspections.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(inspections)
      .where(where);
    return { rows: rows.map(toSafetyInspectionListItem), total };
  });
}

export async function getSafetyInspection(
  orgId: string,
  id: string,
): Promise<SafetyInspectionDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [inspection] = await tx
      .select()
      .from(inspections)
      .where(
        and(
          eq(inspections.orgId, orgId),
          eq(inspections.id, id),
          eq(inspections.type, "safety"),
        ),
      )
      .limit(1);
    if (!inspection) return null;

    const [company] = inspection.companyId
      ? await tx
          .select({ id: companies.id, razaoSocial: companies.razaoSocial })
          .from(companies)
          .where(eq(companies.id, inspection.companyId))
          .limit(1)
      : [];

    const occurrences = await tx
      .select()
      .from(inspectionOccurrences)
      .where(
        and(
          eq(inspectionOccurrences.orgId, orgId),
          eq(inspectionOccurrences.inspectionId, id),
        ),
      )
      .orderBy(asc(inspectionOccurrences.createdAt));

    return { inspection, company: company ?? null, occurrences };
  });
}

async function assertCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string | null | undefined,
): Promise<boolean> {
  if (!companyId) return true; // empresa é opcional
  const [c] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  return !!c;
}

export async function createSafetyInspection(
  orgId: string,
  input: SafetyInspectionHeaderValues,
): Promise<{ id: string } | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      if (!(await assertCompany(tx, orgId, input.companyId))) return null;
      const [row] = await tx
        .insert(inspections)
        .values({
          orgId,
          type: "safety",
          status: "in_progress",
          inspectedAt: input.inspectedAt,
          category: input.category,
          planned: input.planned,
          area: input.area ?? null,
          companyId: input.companyId ?? null,
          responsible: input.responsible ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: inspections.id });
      return { id: row.id };
    }),
  );
}

export async function updateSafetyInspectionHeader(
  orgId: string,
  id: string,
  input: SafetyInspectionHeaderValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      if (!(await assertCompany(tx, orgId, input.companyId))) return false;
      const [row] = await tx
        .update(inspections)
        .set({
          inspectedAt: input.inspectedAt,
          category: input.category,
          planned: input.planned,
          area: input.area ?? null,
          companyId: input.companyId ?? null,
          responsible: input.responsible ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "safety"),
          ),
        )
        .returning({ id: inspections.id });
      return !!row;
    }),
  );
}

/**
 * Salva as ocorrências (substitui todas) e conclui a inspeção (`completed`).
 */
export async function saveOccurrences(
  orgId: string,
  id: string,
  input: OccurrencesValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [inspection] = await tx
        .select({ id: inspections.id })
        .from(inspections)
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "safety"),
          ),
        )
        .limit(1);
      if (!inspection) return false;

      await tx
        .delete(inspectionOccurrences)
        .where(
          and(
            eq(inspectionOccurrences.orgId, orgId),
            eq(inspectionOccurrences.inspectionId, id),
          ),
        );

      const rows = input.occurrences.map((o) => ({
        orgId,
        inspectionId: id,
        description: o.description,
        severity: o.severity,
      }));
      if (rows.length > 0) await tx.insert(inspectionOccurrences).values(rows);

      await tx
        .update(inspections)
        .set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(inspections.orgId, orgId), eq(inspections.id, id)));
      return true;
    }),
  );
}

export async function deleteSafetyInspection(
  orgId: string,
  id: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(inspections)
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "safety"),
          ),
        )
        .returning({ id: inspections.id });
      return rows.length > 0;
    }),
  );
}
