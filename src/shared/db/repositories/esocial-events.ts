import "server-only";

import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import type {
  EsocialDashboard,
  EventListItem,
  ListFilters,
} from "@/shared/domains/esocial/events";
import {
  EVENT_TYPES,
  computeConformityPercent,
  esocialReferenceKind,
  eventStatusLabel,
  eventTypeDescription,
  toEventListItem,
} from "@/shared/domains/esocial/events";
import { generateToken } from "@/shared/domains/signatures/token";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import {
  employees,
  esocialBatches,
  esocialEvents,
  risks,
  type EsocialBatch,
  type EsocialEvent,
  type EsocialEventType,
} from "../schema";
import { withOrg } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "esocial.write_rejected";
const countExpr = sql<number>`count(*)::int`;

// ── Eventos ─────────────────────────────────────────────────────────────────

export type ListEventsParams = PageParams & ListFilters;

export async function listEvents(
  orgId: string,
  params: ListEventsParams = {},
): Promise<Paginated<EventListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(esocialEvents.orgId, orgId)];
  if (params.status) filters.push(eq(esocialEvents.status, params.status));
  if (params.eventType) filters.push(eq(esocialEvents.eventType, params.eventType));
  if (params.dateFrom)
    filters.push(gte(esocialEvents.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) {
    // inclui o dia inteiro do dateTo
    filters.push(
      lte(esocialEvents.createdAt, new Date(`${params.dateTo}T23:59:59.999Z`)),
    );
  }
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    // Ambos os JOINs são many-to-one (evento → 1 lote; reference_id → 1
    // funcionário), então NÃO multiplicam a linha do evento. O join de
    // funcionário é escopado ao tenant; o `reference_id` é polimórfico, então o
    // domínio decide se o nome se aplica ao tipo (S-2240 aponta para risco).
    const rows = await tx
      .select({
        id: esocialEvents.id,
        eventType: esocialEvents.eventType,
        status: esocialEvents.status,
        referenceId: esocialEvents.referenceId,
        batchId: esocialEvents.batchId,
        createdAt: esocialEvents.createdAt,
        employeeName: employees.fullName,
        sentAt: esocialBatches.sentAt,
        protocolNumber: esocialBatches.protocolNumber,
      })
      .from(esocialEvents)
      .leftJoin(
        employees,
        and(
          eq(employees.id, esocialEvents.referenceId),
          eq(employees.orgId, esocialEvents.orgId),
        ),
      )
      .leftJoin(
        esocialBatches,
        and(
          eq(esocialBatches.id, esocialEvents.batchId),
          eq(esocialBatches.orgId, esocialEvents.orgId),
        ),
      )
      .where(where)
      .orderBy(desc(esocialEvents.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(esocialEvents)
      .where(where);
    return { rows: rows.map(toEventListItem), total };
  });
}

/**
 * Todos os eventos do tenant para o relatório consolidado (#83) — sem paginação,
 * org-scopado (`withOrg` + RLS). O isolamento do download vem daqui: nunca
 * retorna evento de outro escritório.
 */
export async function listEsocialEventsForReport(
  orgId: string,
): Promise<EventListItem[]> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: esocialEvents.id,
        eventType: esocialEvents.eventType,
        status: esocialEvents.status,
        referenceId: esocialEvents.referenceId,
        batchId: esocialEvents.batchId,
        createdAt: esocialEvents.createdAt,
      })
      .from(esocialEvents)
      .where(eq(esocialEvents.orgId, orgId))
      .orderBy(desc(esocialEvents.createdAt));
    return rows.map(toEventListItem);
  });
}

/**
 * Painel do eSocial (#218) — KPIs, contagem por tipo e feed recente, TUDO
 * derivado de `esocial_events` por agregação (nenhuma coluna/КPI persistido).
 * Três queries escopadas por `withOrg` (+ RLS), sem N+1.
 */
export async function getEsocialDashboard(orgId: string): Promise<EsocialDashboard> {
  const scope = eq(esocialEvents.orgId, orgId);
  return withOrg(orgId, async (tx) => {
    const [agg] = await tx
      .select({
        total: countExpr,
        transmitted: sql<number>`count(*) filter (where ${esocialEvents.status} in ('sent','accepted'))::int`,
        pending: sql<number>`count(*) filter (where ${esocialEvents.status} in ('draft','pending'))::int`,
        failed: sql<number>`count(*) filter (where ${esocialEvents.status} in ('rejected','error'))::int`,
        accepted: sql<number>`count(*) filter (where ${esocialEvents.status} = 'accepted')::int`,
        rejected: sql<number>`count(*) filter (where ${esocialEvents.status} = 'rejected')::int`,
        errored: sql<number>`count(*) filter (where ${esocialEvents.status} = 'error')::int`,
      })
      .from(esocialEvents)
      .where(scope);

    const typeRows = await tx
      .select({ eventType: esocialEvents.eventType, count: countExpr })
      .from(esocialEvents)
      .where(scope)
      .groupBy(esocialEvents.eventType);

    const recentRows = await tx
      .select({
        id: esocialEvents.id,
        eventType: esocialEvents.eventType,
        status: esocialEvents.status,
        createdAt: esocialEvents.createdAt,
        employeeName: employees.fullName,
      })
      .from(esocialEvents)
      .leftJoin(
        employees,
        and(
          eq(employees.id, esocialEvents.referenceId),
          eq(employees.orgId, esocialEvents.orgId),
        ),
      )
      .where(scope)
      .orderBy(desc(esocialEvents.createdAt))
      .limit(6);

    const byTypeMap = new Map(typeRows.map((r) => [r.eventType, r.count]));
    return {
      total: agg?.total ?? 0,
      transmitted: agg?.transmitted ?? 0,
      pending: agg?.pending ?? 0,
      failed: agg?.failed ?? 0,
      conformityPercent: computeConformityPercent({
        accepted: agg?.accepted ?? 0,
        rejected: agg?.rejected ?? 0,
        error: agg?.errored ?? 0,
      }),
      // Ordem canônica do catálogo (tipos sem evento aparecem com 0) — o mockup
      // mostra uma lista fixa; aqui a lista é a REAL do enum do sistema.
      byType: EVENT_TYPES.map((t) => ({
        eventType: t,
        description: eventTypeDescription(t),
        count: byTypeMap.get(t) ?? 0,
      })),
      recent: recentRows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        description: eventTypeDescription(r.eventType),
        status: r.status,
        statusLabel: eventStatusLabel(r.status),
        employeeName:
          esocialReferenceKind(r.eventType) === "employee"
            ? (r.employeeName ?? null)
            : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}

export async function getEvent(orgId: string, id: string): Promise<EsocialEvent | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(esocialEvents)
      .where(and(eq(esocialEvents.orgId, orgId), eq(esocialEvents.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createEvent(
  orgId: string,
  input: { eventType: EsocialEventType; payload: string; referenceId?: string | null },
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(esocialEvents)
        .values({
          orgId,
          eventType: input.eventType,
          payload: input.payload,
          referenceId: input.referenceId ?? null,
          status: "pending",
        })
        .returning({ id: esocialEvents.id });
      return { id: row.id };
    }),
  );
}

// Origem para geração a partir de entidades existentes (no tenant).
export async function getEmployeeSource(
  orgId: string,
  employeeId: string,
): Promise<{
  cpf: string;
  fullName: string;
  birthDate: string | null;
  admissionDate: string | null;
} | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        cpf: employees.cpf,
        fullName: employees.fullName,
        birthDate: employees.birthDate,
        admissionDate: employees.admissionDate,
      })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
      .limit(1);
    return row ?? null;
  });
}

export async function getRiskSource(
  orgId: string,
  riskId: string,
): Promise<{
  noxiousAgentCode: string | null;
  measurementUnit: string | null;
  description: string;
} | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        noxiousAgentCode: risks.noxiousAgentCode,
        measurementUnit: risks.measurementUnit,
        description: risks.description,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
      .limit(1);
    return row ?? null;
  });
}

// ── Lote de envio (simulado — sem transmissão externa real) ─────────────────

export async function listBatches(orgId: string): Promise<EsocialBatch[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select()
      .from(esocialBatches)
      .where(eq(esocialBatches.orgId, orgId))
      .orderBy(desc(esocialBatches.createdAt)),
  );
}

export type SendBatchResult = { batchId: string; protocolNumber: string; count: number };

/**
 * Agrupa os eventos `pending` do tenant num lote e os marca `sent`, numa única
 * transação. Ignora ids que não pertençam ao tenant ou que não estejam
 * `pending` (defesa contra ids forjados/cross-tenant). Retorna null se nenhum
 * evento elegível.
 */
export async function sendBatch(
  orgId: string,
  eventIds: string[],
): Promise<SendBatchResult | null> {
  if (eventIds.length === 0) return null;
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const eligible = await tx
        .select({ id: esocialEvents.id })
        .from(esocialEvents)
        .where(
          and(
            eq(esocialEvents.orgId, orgId),
            eq(esocialEvents.status, "pending"),
            inArray(esocialEvents.id, eventIds),
          ),
        );
      if (eligible.length === 0) return null;
      const ids = eligible.map((e) => e.id);
      const protocolNumber = `PROT-${generateToken().slice(0, 16)}`;
      const now = new Date();
      const [batch] = await tx
        .insert(esocialBatches)
        .values({ orgId, protocolNumber, status: "sent", sentAt: now })
        .returning({ id: esocialBatches.id });
      await tx
        .update(esocialEvents)
        .set({ status: "sent", batchId: batch.id, updatedAt: now })
        .where(and(eq(esocialEvents.orgId, orgId), inArray(esocialEvents.id, ids)));
      return { batchId: batch.id, protocolNumber, count: ids.length };
    }),
  );
}

/**
 * Consulta (simulada) o retorno do lote: marca os eventos `sent` do lote como
 * `accepted` e o lote como `processed`. Numa integração real, o status viria da
 * resposta do governo por evento.
 */
export async function queryBatchReturn(
  orgId: string,
  batchId: string,
): Promise<{ updated: number } | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [batch] = await tx
        .select({ id: esocialBatches.id })
        .from(esocialBatches)
        .where(and(eq(esocialBatches.orgId, orgId), eq(esocialBatches.id, batchId)))
        .limit(1);
      if (!batch) return null;
      const now = new Date();
      const updated = await tx
        .update(esocialEvents)
        .set({
          status: "accepted",
          governmentResponse: "Evento aceito pelo eSocial.",
          updatedAt: now,
        })
        .where(
          and(
            eq(esocialEvents.orgId, orgId),
            eq(esocialEvents.batchId, batchId),
            eq(esocialEvents.status, "sent"),
          ),
        )
        .returning({ id: esocialEvents.id });
      await tx
        .update(esocialBatches)
        .set({
          status: "processed",
          responseReceivedAt: now,
          rawResponse: `Lote processado: ${updated.length} evento(s) aceito(s).`,
          updatedAt: now,
        })
        .where(and(eq(esocialBatches.orgId, orgId), eq(esocialBatches.id, batchId)));
      return { updated: updated.length };
    }),
  );
}

// Relatório: concatena os XMLs dos eventos filtrados num único blob de texto.
export async function generateReport(
  orgId: string,
  params: ListFilters = {},
): Promise<string> {
  const filters: SQL[] = [eq(esocialEvents.orgId, orgId)];
  if (params.status) filters.push(eq(esocialEvents.status, params.status));
  if (params.eventType) filters.push(eq(esocialEvents.eventType, params.eventType));
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        eventType: esocialEvents.eventType,
        status: esocialEvents.status,
        payload: esocialEvents.payload,
      })
      .from(esocialEvents)
      .where(where)
      .orderBy(desc(esocialEvents.createdAt));
    const header = `<!-- Relatório eSocial · ${rows.length} evento(s) -->`;
    const body = rows
      .map((r) => `<!-- ${r.eventType} · ${r.status} -->\n${r.payload}`)
      .join("\n");
    return `${header}\n${body}`;
  });
}
