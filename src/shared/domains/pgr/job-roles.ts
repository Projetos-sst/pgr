import { z } from "zod";

import { optionalString, requiredString, requiredUuid } from "./form-fields";

export type { JobRole } from "@/shared/db/schema/job-roles";

export const jobRoleInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  title: requiredString("Título é obrigatório"),
  cbo: optionalString,
  workSchedule: optionalString,
  description: optionalString,
});

export type JobRoleInput = z.input<typeof jobRoleInputSchema>;
export type JobRoleValues = z.output<typeof jobRoleInputSchema>;
