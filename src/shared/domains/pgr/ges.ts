import { z } from "zod";

import { optionalString, requiredString, requiredUuid } from "./form-fields";
import { workerCountSchema } from "./validation";
import { resolveExposedTotal } from "./exposed-workers";

export type { Ges } from "@/shared/db/schema/ges";

export const gesInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  workUnitId: requiredUuid("Unidade de obra é obrigatória"),
  name: requiredString("Nome é obrigatório"),
  processDescription: optionalString,
  constructionType: optionalString,
  ceilingHeight: optionalString,
  floor: optionalString,
  roof: optionalString,
  lighting: optionalString,
  ventilation: optionalString,
  otherCharacteristics: optionalString,
});

export type GesInput = z.input<typeof gesInputSchema>;
export type GesValues = z.output<typeof gesInputSchema>;

export const gesJobRoleInputSchema = z.object({
  gesId: requiredUuid("GES é obrigatório"),
  jobRoleId: requiredUuid("Função é obrigatória"),
  workerCount: z.coerce.number().pipe(workerCountSchema),
  workSchedule: optionalString,
});

export type GesJobRoleInput = z.input<typeof gesJobRoleInputSchema>;
export type GesJobRoleValues = z.output<typeof gesJobRoleInputSchema>;

export const gesJobRoleUpdateSchema = z.object({
  workerCount: z.coerce.number().pipe(workerCountSchema),
  workSchedule: optionalString,
});

export type GesJobRoleUpdateInput = z.input<typeof gesJobRoleUpdateSchema>;
export type GesJobRoleUpdateValues = z.output<typeof gesJobRoleUpdateSchema>;

export type GesListItem = {
  id: string;
  name: string;
  processDescription: string | null;
  exposedWorkers: number;
};

export type GesJobRoleItem = {
  id: string;
  jobRoleId: string;
  title: string;
  workerCount: number;
  workSchedule: string | null;
};

export type JobRoleOption = { jobRoleId: string; title: string };

export function toGesListItem(
  row: { id: string; name: string; processDescription: string | null },
  exposed: { total: number | null } | undefined,
): GesListItem {
  return {
    id: row.id,
    name: row.name,
    processDescription: row.processDescription,
    exposedWorkers: resolveExposedTotal(exposed),
  };
}
