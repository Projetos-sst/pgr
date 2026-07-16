# Data Model — Feature 022

**Zero migration.** Nada em `src/shared/db/schema/**` nem em `src/shared/db/migrations/**`.
`npm run db:generate` deve reportar **"No schema changes"**. Última migration do repo continua sendo
`0017_user_profile_fields`.

---

## 1. Persistido — e já existente (nada muda)

### `pgr` (migration `0012`) — **INTACTA**

11 colunas: `id`, `org_id`, `company_id`, `work_unit_id`, `responsible` (text **NULL**),
`registration_type` (enum `pgr_registration_type`), `registration_number`, `issued_at` (date NULL),
`valid_until` (date NULL), `created_at`, `updated_at`.

**Não tem** — e **não ganhará** — `status`, `version`, `signed_at`, `signature_id`, `document_id`,
`pdf_url`, `cover_color`, `summary_config`, `accepted_at`, `accepted_by`. Não existe enum de status de
PGR.

Usada nesta fatia como: fonte do payload público (D5) e **linha travada** (`FOR UPDATE`) para
serializar a numeração de revisões (D2).

### `pgr_revisions` (migration `0012`) — **INTACTA**

| Coluna                      | Tipo                   | Null    | Default                           |
| --------------------------- | ---------------------- | ------- | --------------------------------- |
| `id`                        | uuid PK                | não     | `gen_random_uuid()`               |
| `org_id`                    | text FK→`orgs` CASCADE | não     | —                                 |
| `pgr_id`                    | uuid FK→`pgr` CASCADE  | não     | —                                 |
| `revision_number`           | integer                | não     | — (**sem sequence, sem default**) |
| `revised_at`                | date                   | não     | `now()`                           |
| `notes`                     | text                   | **sim** | —                                 |
| `created_at` / `updated_at` | timestamptz            | não     | `now()`                           |

- **UNIQUE** `uq_pgr_revisions_org_pgr_number (org_id, pgr_id, revision_number)` → **backstop** de
  banco para a numeração (D2). Violação = SQLSTATE 23505 → `DUPLICATE` (409) via `toActionError`.
- **RLS** `pgr_revisions_isolation` (`app_runtime`, `org_id = current_setting('app.current_org', true)`).
- **Append-only**: sem update, sem delete (mantido).

### `signature_requests` / `signature_captures` (migration `0010`) — **INTACTAS**

`signature_requests`: `id`, `org_id`, **`target_type` text** (livre — é o que torna a extensão
zero-migration), **`target_id` uuid NULL**, `token_hash` text UNIQUE (sha-256; **o token cru nunca é
persistido**), `payload` **jsonb**, `status` (enum `pending|signed|cancelled`), `expires_at`,
`used_at` (guarda de uso único), `created_at`, `updated_at`.

- Índice **já existente** `idx_signature_requests_target (target_type, target_id)` → serve a nova
  leitura por alvo (D7) sem índice novo.
- **Duas policies RLS PERMISSIVE**: `signature_requests_isolation` (tenant, `FOR ALL`) **+**
  `signature_requests_token_capability` (`FOR SELECT`, `token_hash = current_setting('app.signature_token', true)`)
  — é ela que permite a leitura pública sem sessão, derivando o tenant **do token**.

`signature_captures` (1:1 com o pedido, UNIQUE `request_id`): `image_data` (data-URL PNG),
`signer_name`, `method` (`qr|link|manual`), `signed_at`, `org_id`. **Não tem — e não ganhará — CPF, IP
nem user-agent.** Só a policy de tenant (sem capability).

**Uso nesta fatia**: `target_type = 'pgr'`, `target_id = <pgr.id>`, `payload = PgrSignaturePayload`.

### Tabelas lidas pela consolidada ampliada — **INTACTAS**

- `risks` (`0012`): passa a expor também `hazard`, `sources`, `propagation`, `exposure_time`,
  `possible_injuries` e os **4 campos eSocial S-2240 já persistidos** — `noxious_agent_code` (text),
  `measurement_unit` (enum), `concentration_intensity` (**numeric → chega como `string`**),
  `exposure_time` (enum).
- `risk_assessments` (`0012`): passa a expor também `criterion`, `probability`, `severity`,
  `uncertainty_degree`, `tolerance_limit`, `assessed_at`. `result` é **text** (não enum), carregando um
  `RiskClassification`.
- `control_measures` (`0012`): passa a expor o **5W2H completo** — `action_what`, `action_how`,
  `action_tracking`, `action_measurement`, `action_responsible`, `action_deadline` — mais
  `justification` e `monitoring`. UNIQUE `(org_id, risk_id, control_level)`.
- `epi_risk` (`0007` + `0014`) ⨝ `epi_catalog`: `catalog_id`, **`risk_id`** (a `0014` moveu a FK de
  `ges_id` → `risk_id`), `neutralization` (enum `neutralizes|does_not_neutralize|not_applicable`),
  UNIQUE `(org_id, catalog_id, risk_id)`. Do catálogo, expõe `name` e `ca`.

---

## 2. Derivado — calculado na leitura, **nunca persistido**

| Derivação                       | Como                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Próximo nº de revisão**       | `coalesce(max(revision_number), 0) + 1` por `(org_id, pgr_id)`, dentro da transação, com `FOR UPDATE` na linha do `pgr`. **Não existe sequence.**           |
| **Estado da assinatura do PGR** | Do último `signature_requests` do alvo: sem linha → `none`; `pending` + `expires_at < now()` → `expired`; senão o próprio `status`.                         |
| **Payload público**             | Montado no servidor na **criação** e gravado em `payload` (jsonb). Congelado: edições posteriores no PGR **não** o alteram.                                 |
| **`documentTitle`**             | **Não existe coluna de título no `pgr`.** Composto por `buildPgrDocumentTitle({ companyName, workUnitName })` (função pura).                                |
| **Consolidada ampliada**        | Composição em memória de 6 queries em lote. Read-only, não persiste nada.                                                                                   |
| **Estado das medidas**          | `deriveMeasureState({ applicable, actionDeadline }, hoje)` → `without_plan \| planned \| overdue` (Feature 018, reusado).                                   |
| **Ordenação dos riscos**        | `sortConsolidatedRisks` — avaliados primeiro por `riskLevel` desc; **sem avaliação por último**.                                                            |
| **Fallbacks**                   | PGR sem GES → `ges: []`; GES sem riscos → `risks: []`; risco sem avaliação → `riskLevel/result = null`; sem medidas → `measures: []`; sem EPI → `epis: []`. |

---

## 3. **NÃO** persistido (reafirmado)

- **Status de assinatura no `pgr`** — nem coluna `signed`, nem `signed_at`, nem enum.
- **Autor da revisão** — sem `author_id`, sem `author_name`. O `officeAction` emite o `userId` numa
  **linha de log em stdout** (`tenant/audit-log.ts` → `console.log`), que **não é tabela** e **não é
  consultável**; além disso o caminho **REST não registra o ator** (não passa por `officeAction`). Por
  isso a UI **não promete autor**.
- **Snapshot de versionamento do PGR** (conteúdo integral da versão, para comparar/restaurar).
  ⚠️ **Não confundir** com o _snapshot do payload público da assinatura_ (§2), que é obrigatório —
  um congela o documento inteiro para restaurá-lo (**proibido**), o outro congela um resumo de 7
  campos para exibir a um signatário (**obrigatório**).
- **CPF, IP, user-agent, geolocalização, biometria, ICP-Brasil.**
- **PDF / documento final / storage / GED** — Fase 05.
- **Token cru** — só o hash.

---

## 4. Tipos de domínio (TypeScript — nada disso é tabela)

### `domains/signatures/targets/pgr.ts` (NOVO)

```ts
export const pgrSignaturePayloadSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200), // composto no servidor
  companyName: z.string().trim().min(1).max(200),
  workUnitName: z.string().trim().max(200).nullable(),
  responsibleName: z.string().trim().max(200).nullable(), // pgr.responsible é NULL-able
  issuedAt: z.iso.date().nullable(), // coluna `date` → string AAAA-MM-DD
  validUntil: z.iso.date().nullable(),
  revisionNumber: z.number().int().min(1).nullable(), // última revisão, se houver
});
export type PgrSignaturePayload = z.infer<typeof pgrSignaturePayloadSchema>;
```

**Sem `pgrId`** (vive em `target_id`). **Sem `orgId`.** **Sem PII.** **Sem listas.**

### `domains/pgr/pgr-signature.ts` (NOVO)

```ts
/** Estados protegidos reais da infra + ausência de solicitação. NÃO é enum de banco. */
export type PgrSignatureStatus = SignatureStatusView; // pending | signed | expired | cancelled
export type PgrSignatureState = "none" | PgrSignatureStatus;

/** View derivada. NUNCA contém token nem URL (o token cru não é persistido — D12). */
export type PgrSignatureView = {
  state: PgrSignatureState;
  requestId: string | null;
  signedAt: string | null; // ISO, só quando signed
  signerName: string | null; // só quando signed
  expiresAt: string | null; // ISO, só quando pending
};

/**
 * Input do pedido de assinatura. `ttlSeconds` REUSA a regra da infra
 * (`z.number().int().positive()`, default `DEFAULT_SIGNATURE_TTL_SECONDS` = 72 h,
 * aplicado pelo core genérico). **Não há limite máximo na infra — nenhum é inventado aqui.**
 * `pgrId` vem do path/argumento, NUNCA do body.
 */
export const pgrSignatureRequestSchema = z
  .object({
    ttlSeconds: z.number().int().positive().optional(),
  })
  .strict(); // proíbe payload/orgId/targetType/targetId/pgrId no body

export type PgrSignatureRequestInput = z.infer<typeof pgrSignatureRequestSchema>;

export function buildPgrDocumentTitle(input: {
  companyName: string;
  workUnitName: string | null;
}): string;
```

### `domains/pgr/pgr-revision.ts` (EDIT — **breaking**)

`pgrRevisionInputSchema` **perde `revisionNumber`** e passa a ser **estrito**:

```ts
export const pgrRevisionInputSchema = z
  .object({
    revisedAt: z.iso.date("Data da revisão inválida (use AAAA-MM-DD)"),
    notes: optionalString,
  })
  .strict(); // `revisionNumber` enviado pelo cliente → ZodError → VALIDATION (422)
```

⚠️ **Por que `.strict()` e não o strip padrão do Zod**: o `z.object()` do Zod **remove** chaves
desconhecidas silenciosamente. Isso deixaria um cliente antigo enviando `revisionNumber` e **acreditando
que controla o número** — falha invisível. Com `.strict()`, ele recebe **422** e fica evidente que o
contrato mudou (FR-005). O `revisionNumberField` (`z.coerce.number()`) é **removido** — é `const`
local, não exportado, sem outros consumidores.

`PgrRevisionListItem` permanece `{ id, revisionNumber, revisedAt, notes, createdAt }` — o número
continua sendo **lido**, só deixa de ser **escrito** pelo cliente.

### `domains/pgr/pgr-consolidated.ts` (EDIT — ampliação)

```ts
export type ConsolidatedEpi = {
  // NOVO — mesma forma de EpiRiskLinkItem
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  neutralization: EpiNeutralization;
};

export type ConsolidatedMeasure = {
  // + justification, monitoring e os 4 campos 5W2H faltantes
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  justification: string | null;
  monitoring: string | null;
  actionWhat: string | null;
  actionHow: string | null;
  actionTracking: string | null;
  actionMeasurement: string | null;
  actionResponsible: string | null;
  actionDeadline: string | null;
  state: MeasureState;
};

export type ConsolidatedAssessment = {
  // NOVO — avaliação vigente detalhada
  criterion: AssessmentCriterion;
  probability: number;
  severity: number;
  riskLevel: number;
  uncertaintyDegree: number;
  toleranceLimit: string | null;
  result: RiskClassification | null;
  assessedAt: string;
};

export type ConsolidatedRisk = {
  id: string;
  agentType: RiskAgentType;
  description: string;
  hazard: string | null;
  sources: string | null;
  propagation: string | null;
  exposureTime: ExposureTime | null;
  possibleInjuries: string | null;
  // eSocial S-2240 (já persistidos — nada inventado):
  noxiousAgentCode: string | null;
  measurementUnit: MeasurementUnit | null;
  concentrationIntensity: string | null; // ⚠️ numeric → o Drizzle devolve string
  // compatibilidade com a 019 (mantidos):
  riskLevel: number | null;
  result: RiskClassification | null;
  assessment: ConsolidatedAssessment | null; // NOVO
  measures: ConsolidatedMeasure[];
  epis: ConsolidatedEpi[]; // NOVO
};
```

`ConsolidatedGes` e `PgrConsolidated` **não mudam de forma** (só o `ConsolidatedRisk` engorda).
`sortConsolidatedRisks` continua válida (ordena por `riskLevel`, que permanece no tipo).
