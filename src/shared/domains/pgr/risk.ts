import { z } from "zod";

import {
  optionalString,
  optionalUuid,
  requiredString,
  requiredUuid,
} from "./form-fields";
import {
  riskAgentTypeSchema,
  exposureTimeSchema,
  measurementUnitSchema,
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
  type RiskAgentType,
  type ExposureTime,
  type MeasurementUnit,
} from "./risks";

export type { Risk } from "@/shared/db/schema/risks";
export { riskAgentTypeLabel, exposureTimeLabel, measurementUnitLabel };
export type { RiskAgentType, ExposureTime, MeasurementUnit };

/**
 * Enum opcional: `""` → `undefined`; senão valida contra o enum. Espelha `optionalUuid`
 * (`form-fields.ts`) para os selects de UI com opção vazia "—".
 */
function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );
}

/**
 * Concentração/intensidade: string decimal opcional (`""` → `undefined`). A coluna
 * `concentration_intensity` é `numeric` (Drizzle/postgres-js expõem como string), então
 * persistimos a string; o formato é validado aqui (rejeita não-numérico).
 */
const optionalDecimal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || /^\d+(\.\d+)?$/.test(v), {
    message: "Concentração deve ser um número decimal válido",
  });

/** Campos persistidos do risco (colunas reais de `risks`). */
const riskBaseObject = z.object({
  // Optional for existing API clients. The GES remains the persisted source of context.
  companyId: optionalUuid,
  workUnitId: optionalUuid,
  gesId: requiredUuid("GES é obrigatório"),
  agentType: riskAgentTypeSchema,
  hazard: optionalString,
  description: requiredString("Descrição é obrigatória"),
  sources: optionalString,
  propagation: optionalString,
  exposureTime: optionalEnum(exposureTimeSchema),
  possibleInjuries: optionalString,
  noxiousAgentCode: optionalString,
  measurementUnit: optionalEnum(measurementUnitSchema),
  concentrationIntensity: optionalDecimal,
});

/**
 * Regra `qualitative_na`: concentração/intensidade só é permitida com unidade de medida
 * QUANTITATIVA. Se há concentração e a unidade é `qualitative_na` (ou ausente) → erro.
 */
function refineRisk(data: z.infer<typeof riskBaseObject>, ctx: z.RefinementCtx): void {
  const hasConcentration = data.concentrationIntensity != null;
  const unitIsQualitativeOrAbsent =
    !data.measurementUnit || data.measurementUnit === "qualitative_na";
  if (hasConcentration && unitIsQualitativeOrAbsent) {
    ctx.addIssue({
      path: ["concentrationIntensity"],
      code: "custom",
      message:
        "Concentração/intensidade só é permitida com unidade de medida quantitativa",
    });
  }
}

/** Schema único de entrada (create e update — corpo completo). */
export const riskInputSchema = riskBaseObject.superRefine(refineRisk);

export type RiskInput = z.input<typeof riskInputSchema>;
export type RiskValues = z.output<typeof riskInputSchema>;

/** Projeção da listagem com o nome do GES resolvido por join. */
export type RiskListItem = {
  id: string;
  gesId: string;
  gesName: string;
  agentType: RiskAgentType;
  description: string;
  exposureTime: ExposureTime | null;
  measurementUnit: MeasurementUnit | null;
};
