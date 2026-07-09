# Data Model — Avaliação de Risco (`risk_assessments`) · Feature 016

**Zero-migration.** A tabela, os enums, CHECKs, FKs, RLS, GRANT e trigger já existem na migration
`0012_pgr_risk_data_model.sql`. Este documento descreve o **modelo consumido** e as **projeções/
schemas Zod** da fatia — **não** há DDL nova. Nenhuma alteração em `src/shared/db/schema/**`.

## Tabela `risk_assessments` (existente — migration `0012`)

Schema Drizzle: `src/shared/db/schema/risks.ts` (export `riskAssessments`).

| Coluna               | Tipo (pg)                   | Notas                                                          |
| -------------------- | --------------------------- | -------------------------------------------------------------- |
| `id`                 | uuid PK `defaultRandom()`   | —                                                              |
| `org_id`             | text NOT NULL               | FK → `orgs.id` **ON DELETE CASCADE**; tenant da sessão         |
| `risk_id`            | uuid NOT NULL               | FK → `risks.id` **ON DELETE CASCADE**                          |
| `criterion`          | enum `assessment_criterion` | `qualitative` \| `quantitative` — **NOT NULL**                 |
| `probability`        | integer NOT NULL            | CHECK `between 1 and 5`                                        |
| `severity`           | integer NOT NULL            | CHECK `between 1 and 5`                                        |
| `risk_level`         | integer NOT NULL            | CHECK `between 1 and 25` **e** `= probability * severity`      |
| `uncertainty_degree` | smallint NOT NULL default 0 | CHECK `between 0 and 2` (0 Certa / 1 Incerta / 2 Alt. Incerta) |
| `tolerance_limit`    | text (nullable)             | texto livre                                                    |
| `result`             | text (nullable)             | **snapshot** da classificação (`trivial`…`intolerable`)        |
| `assessed_at`        | date NOT NULL default now   | data da avaliação (**app exige**; permite histórico 1:N)       |
| `created_at`         | timestamptz NOT NULL        | —                                                              |
| `updated_at`         | timestamptz NOT NULL        | trigger `set_updated_at_risk_assessments`                      |

**Índices**: `idx_risk_assessments_org_id`, `idx_risk_assessments_risk_id`.
**RLS**: `risk_assessments_isolation` PERMISSIVE FOR ALL TO `app_runtime`
(`org_id = current_setting('app.current_org', true)`, using + with check). **GRANT**:
SELECT/INSERT/UPDATE/DELETE a `app_runtime`.
**Sem UNIQUE** → histórico 1:N, **sem 409**. **ON DELETE**: CASCADE em `org_id` e `risk_id`.

## Tabelas relacionadas (somente leitura nesta fatia)

- **`risks`** (`0012`): validação de vínculo por `(org_id, id)` via `assertRiskInTenant`. Não
  alterada.
- **`risk_methodology`** (`0013`): singleton por org; lida via `getRiskMethodologyView(orgId)` para
  obter `classificationBands` (com fallback `defaultRiskMethodology()` quando `configured:false`).
  Não alterada.

## Domínio Zod — `src/shared/domains/pgr/risk-assessment.ts` (NOVO)

Importa de `./risks`: `assessmentCriterionSchema`, `assessmentCriterionLabel`,
`uncertaintyDegreeLabel`, `computeRiskLevel`. De `./methodology`: `classify`,
`riskClassificationLabel`, `type RiskClassification`, `type ClassificationBand`. De `./form-fields`:
`optionalString`, `requiredUuid`.

### `riskAssessmentInputSchema` (create **e** update — corpo completo)

```ts
const probabilityField = z.coerce.number().int().min(1).max(5); // "Probabilidade deve ser 1–5"
const severityField = z.coerce.number().int().min(1).max(5); // "Severidade deve ser 1–5"
const uncertaintyField = z.coerce.number().int().min(0).max(2).default(0);

export const riskAssessmentInputSchema = z.object({
  criterion: assessmentCriterionSchema, // qualitative | quantitative (obrigatório)
  probability: probabilityField,
  severity: severityField,
  uncertaintyDegree: uncertaintyField,
  toleranceLimit: optionalString, // "" → undefined
  assessedAt: z.iso.date("Data inválida (use AAAA-MM-DD)"), // obrigatória
});
// NB: NÃO inclui riskLevel nem result (computados no servidor); NÃO inclui riskId
//     (vem da rota/param, não do corpo) nem orgId (sessão).

export type RiskAssessmentInput = z.input<typeof riskAssessmentInputSchema>; // form/REST
export type RiskAssessmentValues = z.output<typeof riskAssessmentInputSchema>; // validado
```

### Derivação pura (coração unit-testável)

```ts
export function deriveAssessmentResult(
  values: Pick<RiskAssessmentValues, "probability" | "severity">,
  bands: ClassificationBand[],
): { riskLevel: number; result: RiskClassification } {
  const riskLevel = computeRiskLevel(values.probability, values.severity);
  return { riskLevel, result: classify(riskLevel, bands) };
}

/** Valores prontos p/ o repositório (input validado + derivados). */
export type RiskAssessmentWriteValues = RiskAssessmentValues & {
  riskLevel: number;
  result: RiskClassification;
};
```

### Rótulos normativos (pt-BR)

```ts
export const PROBABILITY_LABELS: Record<number, string> = {
  1: "Rara",
  2: "Pouco provável",
  3: "Possível",
  4: "Provável",
  5: "Muito provável",
};
export const SEVERITY_LABELS: Record<number, string> = {
  1: "Leve, sem necessidade de atenção médica",
  2: "Séria, reversível",
  3: "Crítica, irreversível",
  4: "Incapacitante ou mortal individual",
  5: "Mortes ou incapacitantes múltiplas",
};
export function probabilityLabel(v: number): string {
  return PROBABILITY_LABELS[v] ?? String(v);
}
export function severityLabel(v: number): string {
  return SEVERITY_LABELS[v] ?? String(v);
}
// uncertaintyDegreeLabel: reexportado de ./risks (0 Certa / 1 Incerta / 2 Altamente Incerta)
// riskClassificationLabel / assessmentCriterionLabel: reexportados de ./methodology e ./risks
```

### Projeções (list/detail)

```ts
export type RiskAssessment = typeof riskAssessments.$inferSelect; // reexport do schema

/** Item da lista/histórico (colunas cruas — result já persistido). */
export type RiskAssessmentListItem = {
  id: string;
  criterion: AssessmentCriterion;
  probability: number;
  severity: number;
  riskLevel: number;
  uncertaintyDegree: number;
  toleranceLimit: string | null;
  result: RiskClassification | null; // snapshot persistido
  assessedAt: string; // date "YYYY-MM-DD"
  createdAt: string; // ISO ts
};
```

> `result` é `text` no banco; ao ler, tipamos como `RiskClassification | null` (os valores gravados
> vêm sempre do enum). A UI usa `riskClassificationLabel` quando não-nulo.

## Regras de validação (resumo)

| Campo               | Regra                                                            | Violação →         |
| ------------------- | ---------------------------------------------------------------- | ------------------ |
| `criterion`         | ∈ {`qualitative`,`quantitative`}                                 | 422                |
| `probability`       | inteiro 1–5 (coerção string→número)                              | 422                |
| `severity`          | inteiro 1–5 (coerção string→número)                              | 422                |
| `uncertaintyDegree` | inteiro 0–2 (default 0)                                          | 422                |
| `toleranceLimit`    | texto opcional                                                   | —                  |
| `assessedAt`        | ISO `AAAA-MM-DD` obrigatória, calendário válido                  | 422                |
| `riskId` (rota)     | existe DENTRO do tenant (`assertRiskInTenant`)                   | `FK_NOT_FOUND`/422 |
| `riskLevel`         | derivado no servidor; **não** aceito do cliente; CHECK coerência | (backstop)         |
| `result`            | derivado no servidor (`classify`); snapshot                      | —                  |

## Fora do modelo desta fatia

`control_measures` (plano 5W2H — #26), `epi_risk`, alteração de `risk_methodology` (só leitura),
alteração de `risks`, colunas novas, flags de vigência, versionamento formal.
