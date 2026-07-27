import { z } from "zod";

import { optionalString, requiredString, requiredUuid } from "./form-fields";
import { workerCountSchema } from "./validation";
import { resolveExposedTotal } from "./exposed-workers";
import type { RiskAgentType } from "./risks";

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
  workerCount: z.coerce
    .number({ error: "Quantidade de trabalhadores é obrigatória" })
    .pipe(workerCountSchema),
  workSchedule: optionalString,
});

export type GesJobRoleInput = z.input<typeof gesJobRoleInputSchema>;
export type GesJobRoleValues = z.output<typeof gesJobRoleInputSchema>;

export const gesJobRoleUpdateSchema = z.object({
  workerCount: z.coerce
    .number({ error: "Quantidade de trabalhadores é obrigatória" })
    .pipe(workerCountSchema),
  workSchedule: optionalString,
});

export type GesJobRoleUpdateInput = z.input<typeof gesJobRoleUpdateSchema>;
export type GesJobRoleUpdateValues = z.output<typeof gesJobRoleUpdateSchema>;

export type GesListItem = {
  id: string;
  name: string;
  processDescription: string | null;
  companyName: string | null;
  exposedWorkers: number;
  risks: RiskAgentType[];
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
  companyName?: string | null,
  risks?: RiskAgentType[],
): GesListItem {
  return {
    id: row.id,
    name: row.name,
    processDescription: row.processDescription,
    companyName: companyName ?? null,
    exposedWorkers: resolveExposedTotal(exposed),
    risks: risks ?? [],
  };
}
