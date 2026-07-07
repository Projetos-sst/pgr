# Data Model — CRUD de Risco do GES

**Zero-migration.** A tabela `risks` já existe (`src/shared/db/schema/risks.ts`, migration
`0012_pgr_risk_data_model.sql`). Este documento descreve apenas o **modelo de aplicação** (schema
Zod, tipos, projeções) que a fatia adiciona — nenhuma coluna/constraint nova.

## Entidade `risks` (colunas existentes usadas)

| Coluna (DB)                                        | Campo (app)              | Tipo                          | Regra na fatia                                                       |
| -------------------------------------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| `id` uuid PK                                       | `id`                     | string                        | gerado pelo banco                                                   |
| `org_id` text NOT NULL → orgs (cascade)            | —                        | —                             | preenchido pelo repo a partir do tenant da sessão; nunca do cliente |
| `ges_id` uuid NOT NULL → ges (**cascade**)         | `gesId`                  | uuid                          | **obrigatório**; guard `assertGesInTenant`                          |
| `agent_type` enum NOT NULL                         | `agentType`              | `risk_agent_type` (7)         | **obrigatório**; reusa `riskAgentTypeSchema`                        |
| `hazard` text                                      | `hazard`                 | string?                       | opcional (texto livre)                                              |
| `description` text NOT NULL                        | `description`            | string                        | **obrigatório** (min 1)                                             |
| `sources` text                                     | `sources`                | string?                       | opcional                                                            |
| `propagation` text                                 | `propagation`            | string?                       | opcional                                                            |
| `exposure_time` enum                               | `exposureTime`           | `exposure_time` (8)?          | opcional; `""` → `undefined`                                        |
| `possible_injuries` text                           | `possibleInjuries`       | string?                       | opcional                                                            |
| `noxious_agent_code` text                          | `noxiousAgentCode`       | string?                       | opcional (S-2240, texto livre)                                      |
| `measurement_unit` enum                            | `measurementUnit`        | `measurement_unit` (10)?      | opcional; `""` → `undefined`                                        |
| `concentration_intensity` numeric                  | `concentrationIntensity` | string decimal?               | opcional; **regra `qualitative_na`** (só com unidade quantitativa)  |
| `created_at` / `updated_at` timestamptz            | `createdAt`/`updatedAt`  | Date                          | geridos por default/trigger `set_updated_at_risks`                  |

**Fora da fatia** (não editados/lidos): `risk_assessments`, `control_measures`, `epi_risk`. Não há
coluna de autor (`created_by`). A exclusão de um risco cascateia para `risk_assessments`/
`control_measures` (comportamento do `0012`), mas essas tabelas não são tocadas pelo código.

## Schemas Zod — `src/shared/domains/pgr/risk.ts` (NOVO)

Imports: `riskAgentTypeSchema`, `exposureTimeSchema`, `measurementUnitSchema` (+ labels de exibição)
de `./risks`; `optionalString`, `requiredString`, `requiredUuid` de `./form-fields`; `z` de `zod`.

```ts
import { z } from "zod";
import { optionalString, requiredString, requiredUuid } from "./form-fields";
import {
  riskAgentTypeSchema,
  exposureTimeSchema,
  measurementUnitSchema,
  riskAgentTypeLabel,
  exposureTimeLabel,
  type RiskAgentType,
  type ExposureTime,
  type MeasurementUnit,
} from "./risks";

export type { Risk } from "@/shared/db/schema/risks";
export { riskAgentTypeLabel, exposureTimeLabel };
export type { RiskAgentType, ExposureTime, MeasurementUnit };

/** Enum opcional: "" -> undefined; senão valida contra o enum. Espelha optionalUuid. */
function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );
}

/** Concentração/intensidade: decimal opcional em string ("" -> undefined). */
const optionalDecimal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || /^\d+(\.\d+)?$/.test(v), {
    message: "Concentração deve ser um número decimal válido",
  });

const riskBaseObject = z.object({
  gesId: requiredUuid("GES é obrigatório"),
  agentType: riskAgentTypeSchema, // enum reusado (obrigatório)
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
      message: "Concentração/intensidade só é permitida com unidade de medida quantitativa",
    });
  }
}

/** Schema único de entrada (create e update — corpo completo). */
export const riskInputSchema = riskBaseObject.superRefine(refineRisk);

export type RiskInput = z.input<typeof riskInputSchema>; // form/wire
export type RiskValues = z.output<typeof riskInputSchema>; // passado ao repo
```

> **Sem gate de declaração** (diferente de `pgr`): create e update usam o **mesmo**
> `riskInputSchema`. Não há `declarationAccepted` nem descarte de campo.

## Projeção de listagem — `RiskListItem`

```ts
export type RiskListItem = {
  id: string;
  gesId: string;
  gesName: string; // ges.name (innerJoin)
  agentType: RiskAgentType;
  description: string;
  exposureTime: ExposureTime | null; // null se não informado
  measurementUnit: MeasurementUnit | null;
};
```

Colunas da tabela de UI (FR-002), na ordem: **Grupo do agente · Descrição · Tempo de exposição ·
GES · Opções**. `agentType`/`exposureTime` exibem via `riskAgentTypeLabel(...)`/`exposureTimeLabel(...)`;
`measurementUnit`, se exibida no detalhe, usa o value do enum (ou um label opcional a ser adicionado
a `risks.ts` — decisão de UI, sem alterar schema). "Usuário autor" **não** existe (fora de escopo).

## Regras de validação (resumo → requisitos)

| Regra                                                     | Origem | Erro                                        |
| --------------------------------------------------------- | ------ | ------------------------------------------- |
| `gesId` UUID obrigatório (formato)                        | FR-008 | `VALIDATION` (campo `gesId`)                |
| `agentType` ∈ enum (obrigatório)                          | FR-009 | `VALIDATION` (campo `agentType`)            |
| `description` obrigatória (min 1)                         | FR-009 | `VALIDATION` (campo `description`)          |
| `exposureTime`/`measurementUnit` ∈ enum se presentes      | FR-001 | `VALIDATION`                                |
| `concentrationIntensity` decimal se presente              | FR-001 | `VALIDATION` (campo `concentrationIntensity`) |
| concentração exige unidade quantitativa (`qualitative_na`)| FR-010 | `VALIDATION` (campo `concentrationIntensity`) |
| `gesId` inexistente/cross-tenant                          | FR-014 | `FK_NOT_FOUND` (422)                        |
| risco inexistente/cross-tenant (get/update/delete)        | FR-013 | `NOT_FOUND` (404)                           |
| (sem unique)                                              | FR-019 | — (nunca `DUPLICATE`)                       |

## State transitions

Não há máquina de estados nesta fatia (sem coluna de status/ciclo de vida). CRUD puro.
