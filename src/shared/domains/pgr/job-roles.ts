import { z } from "zod";

import type { JobRole } from "@/shared/db/schema/job-roles";

import {
  optionalString,
  optionalUuid,
  requiredString,
  requiredUuid,
} from "./form-fields";

export type { JobRole } from "@/shared/db/schema/job-roles";

/** Booleano vindo de form (`"true"`/`"false"`) ou JSON (boolean); default `true`. */
const activeFromForm = z.preprocess(
  (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : v),
  z.boolean().default(true),
);

/** Trabalhadores expostos do vínculo GES↔função (`ges_job_roles.worker_count > 0`). */
const optionalWorkerCount = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

export const jobRoleInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  title: requiredString("Função é obrigatório"),
  cbo: optionalString,
  sector: optionalString,
  workSchedule: optionalString,
  description: optionalString,
  isActive: activeFromForm,
  // GES-inline (#194): vincula a função a um GES via `ges_job_roles` (worker_count).
  gesId: optionalUuid,
  workerCount: optionalWorkerCount,
});

export type JobRoleInput = z.input<typeof jobRoleInputSchema>;
export type JobRoleValues = z.output<typeof jobRoleInputSchema>;

/** DTO da listagem: função + GES agregados (nomes) + nº de funcionários (derivados). */
export type JobRoleListItem = JobRole & {
  gesNames: string | null;
  employeeCount: number;
};
