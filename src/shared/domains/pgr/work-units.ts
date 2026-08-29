import { z } from "zod";

import { optionalString, requiredString, requiredUuid } from "./form-fields";

export type { WorkUnit } from "@/shared/db/schema/work-units";

export const workUnitInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  name: requiredString("Nome é obrigatório"),
  description: requiredString("Escopo do Contrato é obrigatório"),
  contractNumber: optionalString,
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
