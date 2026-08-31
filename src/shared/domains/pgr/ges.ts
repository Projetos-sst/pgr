import { z } from "zod";

import { optionalString, requiredString, requiredUuid } from "./form-fields";
import { workerCountSchema } from "./validation";
import { resolveExposedTotal } from "./exposed-workers";

export type { Ges } from "@/shared/db/schema/ges";

/**
 * Enum opcional: `""` → `undefined`; senão valida contra o enum. Espelha o helper
 * homônimo de `employees.ts`/`risk.ts` (ainda não extraído para `form-fields.ts`).
 */
function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

export const roofSchema = z.enum(["none", "partial", "total"], {
  error: "Cobertura deve ser uma das opções da lista",
});
export type Roof = z.infer<typeof roofSchema>;

export const roofLabel: Record<Roof, string> = {
  none: "Sem cobertura",
  partial: "Cobertura parcial",
  total: "Cobertura total",
};

/**
 * Pé-direito: string decimal opcional (`""` → `undefined`, sem erro — cobre o caso
 * "não aplicável"). Aceita vírgula OU ponto como separador decimal (normaliza `,`→`.`
 * antes de validar); a coluna `ceiling_height` é `numeric` (Drizzle/postgres-js expõem
 * como string), então persistimos a string já normalizada. Espelha `optionalDecimal`
 * de `risk.ts` (concentração/intensidade), acrescentando a normalização de vírgula e a
 * checagem de valor positivo.
 */
const ceilingHeightSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value.replace(",", ".")))
  .optional()
  .refine((value) => value === undefined || /^\d+(\.\d+)?$/.test(value), {
    message: "Pé-direito deve ser um número válido (ex: 2.50 ou 2,50)",
  })
  .refine((value) => value === undefined || Number(value) > 0, {
    message: "Pé-direito deve ser maior que zero",
  });

export const gesInputSchema = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  workUnitId: requiredUuid("Unidade de obra é obrigatória"),
  name: requiredString("Nome é obrigatório"),
  processDescription: optionalString,
  constructionType: optionalString,
  ceilingHeight: ceilingHeightSchema,
  floor: optionalString,
  roof: optionalEnum(roofSchema),
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
