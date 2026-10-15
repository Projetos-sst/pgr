"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/esocial-events";
import { buildEsocialXml } from "@/shared/domains/esocial/builders";
import {
  eventTypeSchema,
  listFiltersSchema,
  type EsocialDashboard,
  type EventListItem,
  type ListFilters,
} from "@/shared/domains/esocial/events";
import type { EsocialBatch, EsocialEvent, EsocialEventType } from "@/shared/db/schema";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/esocial";

export async function listEventsAction(
  params: repo.ListEventsParams = {},
): Promise<ActionResult<Paginated<EventListItem>>> {
  return officeAction("esocial.events.list", ({ tenantId }) => {
    const filters = listFiltersSchema.parse({
      status: params.status,
      eventType: params.eventType,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
    return repo.listEvents(tenantId, { ...filters, page: params.page });
  });
}

/** Painel do eSocial (#218) — KPIs/por tipo/recentes, agregados no repositório. */
export async function getEsocialDashboardAction(): Promise<
  ActionResult<EsocialDashboard>
> {
  return officeAction("esocial.dashboard", ({ tenantId }) =>
    repo.getEsocialDashboard(tenantId),
  );
}

export async function getEventAction(id: string): Promise<ActionResult<EsocialEvent>> {
  return officeAction("esocial.events.get", async ({ tenantId }) => {
    const row = await repo.getEvent(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

// Geração genérica: valida o input pelo schema do tipo, monta XML e persiste.
export async function generateEventAction(
  type: string,
  input: unknown,
  referenceId?: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "esocial.events.generate",
    async ({ tenantId }) => {
      const eventType = eventTypeSchema.parse(type) as EsocialEventType;
      const payload = buildEsocialXml(eventType, input);
      const result = await repo.createEvent(tenantId, {
        eventType,
        payload,
        referenceId: referenceId ?? null,
      });
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

// S-2200 a partir de um funcionário do tenant (referenceId = employeeId).
export async function generateS2200FromEmployeeAction(
  employeeId: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "esocial.events.generate_s2200",
    async ({ tenantId }) => {
      const emp = await repo.getEmployeeSource(tenantId, employeeId);
      if (!emp) throw new ReferenceNotFoundError();
      const payload = buildEsocialXml("S-2200", {
        cpf: emp.cpf,
        nome: emp.fullName,
        dataNascimento: emp.birthDate ?? "1970-01-01",
        dataAdmissao: emp.admissionDate ?? "1970-01-01",
      });
      const result = await repo.createEvent(tenantId, {
        eventType: "S-2200",
        payload,
        referenceId: employeeId,
      });
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

// S-2240 a partir do inventário de riscos (agente nocivo + unidade) + funcionário.
export async function generateS2240FromRiskAction(
  riskId: string,
  employeeId: string,
  dataInicio: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "esocial.events.generate_s2240",
    async ({ tenantId }) => {
      const [risk, emp] = await Promise.all([
        repo.getRiskSource(tenantId, riskId),
        repo.getEmployeeSource(tenantId, employeeId),
      ]);
      if (!risk || !emp) throw new ReferenceNotFoundError();
      if (!risk.noxiousAgentCode) {
        // Agente sem código eSocial mapeado bloqueia a geração.
        throw new ReferenceNotFoundError(
          "Agente nocivo sem código eSocial no inventário de riscos.",
        );
      }
      const payload = buildEsocialXml("S-2240", {
        cpf: emp.cpf,
        dataInicio,
        codigoAgenteNocivo: risk.noxiousAgentCode,
        unidadeMedida: risk.measurementUnit ?? undefined,
        descricaoAtividade: risk.description,
      });
      const result = await repo.createEvent(tenantId, {
        eventType: "S-2240",
        payload,
        referenceId: riskId,
      });
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

// ── Lote ────────────────────────────────────────────────────────────────────

export async function sendBatchAction(
  eventIds: string[],
): Promise<ActionResult<repo.SendBatchResult>> {
  return officeAction(
    "esocial.batch.send",
    async ({ tenantId }) => {
      const result = await repo.sendBatch(tenantId, eventIds);
      if (!result) throw new NotFoundError();
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function queryBatchReturnAction(
  batchId: string,
): Promise<ActionResult<{ updated: number }>> {
  return officeAction(
    "esocial.batch.query",
    async ({ tenantId }) => {
      const result = await repo.queryBatchReturn(tenantId, batchId);
      if (!result) throw new NotFoundError();
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function listBatchesAction(): Promise<ActionResult<EsocialBatch[]>> {
  return officeAction("esocial.batch.list", ({ tenantId }) => repo.listBatches(tenantId));
}

export async function generateReportAction(
  filters: ListFilters = {},
): Promise<ActionResult<{ report: string }>> {
  return officeAction("esocial.report", async ({ tenantId }) => {
    const report = await repo.generateReport(tenantId, listFiltersSchema.parse(filters));
    return { report };
  });
}
