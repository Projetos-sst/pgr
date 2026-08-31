import { z } from "zod";

import type { WorkUnit } from "@/shared/db/schema/work-units";

import { optionalString, requiredString, requiredUuid } from "./form-fields";

export type { WorkUnit } from "@/shared/db/schema/work-units";

export const WORK_UNIT_STATUSES = ["active", "suspended", "closed"] as const;
export type WorkUnitStatus = (typeof WORK_UNIT_STATUSES)[number];
export const workUnitStatusSchema = z.enum(WORK_UNIT_STATUSES, {
  error: "Situação inválida",
});
export const WORK_UNIT_STATUS_LABELS: Record<WorkUnitStatus, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  closed: "Encerrada",
};
export const WORK_UNIT_STATUS_TONE: Record<
  WorkUnitStatus,
  "green" | "amber" | "neutral"
> = {
  active: "green",
  suspended: "amber",
  closed: "neutral",
};

export const WORK_UNIT_TYPES = ["site", "branch", "workfront"] as const;
export type WorkUnitType = (typeof WORK_UNIT_TYPES)[number];
export const workUnitTypeSchema = z.enum(WORK_UNIT_TYPES, { error: "Tipo inválido" });
export const WORK_UNIT_TYPE_LABELS: Record<WorkUnitType, string> = {
  site: "Obra / Canteiro",
  branch: "Filial",
  workfront: "Frente de trabalho",
};

/** Data ISO opcional (AAAA-MM-DD); string vazia → undefined. */
const optionalIsoDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.iso.date("Data inválida").optional(),
);

export const workUnitInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  name: requiredString("Nome é obrigatório"),
  description: requiredString("Escopo do Contrato é obrigatório"),
  contractNumber: optionalString,
  type: workUnitTypeSchema.optional(),
  status: workUnitStatusSchema.default("active"),
  startDate: optionalIsoDate,
  expectedEndDate: optionalIsoDate,
  managerName: optionalString,
  managerRole: optionalString,
  professionalTitle: optionalString,
  professionalRegistration: optionalString,
  zipCode: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
});

export type WorkUnitInput = z.input<typeof workUnitInputSchema>;
export type WorkUnitValues = z.output<typeof workUnitInputSchema>;

/** DTO da listagem: unidade + nome da empresa resolvido por join (#190). */
export type WorkUnitListItem = WorkUnit & { companyName: string };
