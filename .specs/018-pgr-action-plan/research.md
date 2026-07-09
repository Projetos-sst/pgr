# Research — Medidas de controle e plano de ação (5W2H)

Decisões técnicas da fatia 018. Nenhum `NEEDS CLARIFICATION` pendente. Tudo validado contra o
código real do `develop` (fatia 016 `risk-assessment` mergeada é o molde direto).

## D1 — Tabela e enum já existem (zero migration)

- **Decisão**: usar `control_measures` (schema `src/shared/db/schema/risks.ts`, export
  `controlMeasures`) e o enum `control_level` — **ambos criados na migration `0012`**. Nenhuma
  migration nova, nenhuma alteração de `schema/**` ou `migrations/**`.
- **Rationale**: as colunas 5W2H (`action_*`), `applicable`, `justification`, `monitoring`, a
  UNIQUE e a RLS já existem. A fatia é 100% código de aplicação sobre modelo pronto.
- **Alternativas rejeitadas**: adicionar coluna de status / FK de responsável (exigiria migration —
  fora do escopo aprovado).

## D2 — DUPLICATE / 409 é automático (SQLSTATE 23505)

- **Decisão**: **não** capturar a violação de UNIQUE no repositório. O `INSERT` que viola
  `uq_control_measures_org_risk_level` lança 23505, que sobe por `auditedTenantWrite` →
  `officeAction`/`restHandler` → **`toActionError`** mapeia `23505 → { code: "DUPLICATE" }`
  (`src/shared/server/action-error.ts`, `PG_ERROR_MAP`) → REST **409** (`HTTP_BY_CODE`).
- **Rationale**: é o padrão vigente (categories/companies não capturam 23505 no repo). Menos
  código, comportamento idêntico ao resto do projeto.
- **Alternativas rejeitadas**: pré-checar existência do nível antes do insert (race condition;
  duplicaria a garantia do banco).

## D3 — Guard de tenant no risco (`assertRiskInTenant`)

- **Decisão**: replicar `assertRiskInTenant(tx, orgId, riskId)` do repo `risk-assessments`
  (`SELECT id FROM risks WHERE org_id=? AND id=?`; senão `throw new ReferenceNotFoundError("risk")`
  → code `FK_NOT_FOUND` → **422**). Aplicar em `list` e `create` (operações ancoradas no `riskId`
  da rota).
- **Rationale**: `riskId` inválido/cross-tenant deve virar FK_NOT_FOUND/422, não NOT_FOUND. Mesma
  semântica da 016.
- **Alternativas rejeitadas**: confiar só na FK do banco (o INSERT com risk_id de outro tenant é
  barrado pela RLS/FK, mas o erro/HTTP resultante seria menos explícito).

## D4 — `getById` por id, sem join; cross-tenant → NOT_FOUND/404

- **Decisão**: `getControlMeasureById(orgId, id)` filtra por `(org_id, id)`, sem validar `riskId`.
  Linha inexistente/de outro tenant → `null` → a Action lança `NotFoundError` → **404**. Idêntico a
  `getRiskAssessmentById`.
- **Rationale**: a rota flat `control-measures/[id]` é ancorada no id da medida; o `org_id` da linha
  já garante o tenant.

## D5 — Estados derivados (sem status persistido)

- **Decisão**: função **pura** `deriveMeasureState(measure, today)` →
  `"without_plan" | "planned" | "overdue"` e `isOverdue(applicable, actionDeadline, today)`, no
  domínio. Regras:
  - `overdue` ⇔ `applicable === true` **e** `actionDeadline != null` **e** `actionDeadline < today`;
  - `planned` ⇔ `applicable === true` e **não** overdue;
  - `without_plan` ⇔ `applicable === false`.
- **`today`** é **parâmetro** (string `AAAA-MM-DD`) → função testável e determinística. O caller
  passa "hoje" no fuso `America/Sao_Paulo`.
- **Comparação de datas**: `action_deadline` é coluna `date` → Drizzle retorna **string
  "AAAA-MM-DD"**; comparação **lexicográfica** de ISO-date é equivalente à cronológica → sem
  `Date`/timezone no núcleo.
- **Rationale**: não há coluna de status; derivar mantém zero migration e é trivialmente testável.
- **Alternativas rejeitadas**: coluna/enum de status (migration, fora do escopo); calcular no banco
  (window/CASE) — desnecessário e menos testável.

## D6 — "Hoje" no fuso America/Sao_Paulo

- **Decisão**: a UI/Action que precisa do estado derivado calcula `today` como a data local de
  São Paulo em `AAAA-MM-DD` (`Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })` ou
  equivalente) e passa ao domínio puro. O domínio **não** lê o relógio.
- **Rationale**: coerência com a 011 (regra de vigência de CA no mesmo fuso) e testes determinísticos.

## D7 — Validação condicional dos campos mínimos (Zod)

- **Decisão**: `controlMeasureInputSchema` = `z.object({...}).superRefine(...)`. Todos os `action_*`,
  `justification`, `monitoring` como `optionalString`; `actionDeadline` como `optionalIsoDate`
  (helpers de `domains/pgr/form-fields.ts`). No `superRefine`: se `applicable === true` e
  `actionWhat` ausente → issue no path `actionWhat`; idem `actionHow`. Mensagens pt-BR.
- **Rationale**: FR-004; regra de domínio, sem migration. `ZodError` → `toActionError` → **422** com
  `fields`.
- **Alternativas rejeitadas**: exigir sempre (quebra edge "applicable=false") ou nunca (quebra
  critério de aceite).

## D8 — `applicable` robusto (form + REST JSON)

- **Decisão**: `applicableField` = `z.preprocess` que aceita **boolean** (REST JSON) e **string**
  de formulário: `true`/`"true"`/`"on"`/`"1"` → `true`; `false`/`"false"`/`""`/`"0"`/`undefined` →
  `false`. Default `false`.
- **Rationale**: `z.coerce.boolean()` trataria `"false"` como `true` (qualquer string não vazia é
  truthy) — bug. O preprocess explícito evita isso e serve form e JSON.

## D9 — `control_level` imutável no update (identidade da medida)

- **Decisão**: `controlMeasureInputSchema` inclui `controlLevel` (enum obrigatório) para **create**.
  No **update**, o repositório **não** grava `control_level` (nem `risk_id`) — o nível identifica a
  medida no risco (FR-006). O corpo do PUT é completo, mas `control_level` é ignorado na escrita.
- **Rationale**: trocar de nível = criar/excluir medida; preserva a semântica da UNIQUE.
- **Alternativas rejeitadas**: rejeitar update com nível divergente (fricção desnecessária).

## D10 — Reuso de `control_level` do domínio de riscos

- **Decisão**: reusar `controlLevelSchema` e `controlLevelLabel` de `src/shared/domains/pgr/risks.ts`
  (já existem: enum `elimination|collective_protection|administrative|ppe`; labels
  "I — Eliminação", "II — Proteção Coletiva", "III — Medidas Administrativas/Organização", "IV —
  EPI"). Não redefinir enum.
- **Rationale**: DRY; fonte única de verdade dos rótulos NR-01.

## D11 — Contexto do risco + avaliação vigente (derivados, sem snapshot)

- **Decisão**: a página carrega o risco via `getRiskAction(riskId)` (contexto read-only) e a
  avaliação vigente via **`getCurrentRiskAssessmentAction(riskId)`** (retorna
  `ActionResult<RiskAssessment | null>` — `riskLevel`/`result`). `null` → UI exibe "Sem avaliação
  vigente" e **não** bloqueia. **Nada** disso é gravado em `control_measures`.
- **Rationale**: FR-010/011/012; a 016 já expõe `getCurrentRiskAssessmentAction`. Sem snapshot =
  sem migration e sem histórico congelado incorreto.

## D12 — Responsável: combobox → texto (sem FK)

- **Decisão**: campo `actionResponsible` é `optionalString`. A UI oferece um combobox alimentado por
  **`listEmployeesAction()`** (existe; `EmployeeListItem.fullName`); ao escolher, grava o `fullName`
  como **texto**. Também aceita digitação livre (datalist/autocomplete). Sem FK, sem migration.
- **Rationale**: FR-013; a coluna é `text`. Sugestão melhora UX sem acoplar schema.

## D13 — Delete físico; update corpo completo (sem PATCH); auditoria só em escrita

- **Decisão**: `delete` físico (RETURNING → boolean; `false` → NotFoundError/404), com confirmação
  na UI; sem endpoint de dependentes (`control_measures` não tem FK de entrada). `update` recebe
  corpo completo (sem PATCH). `create`/`update`/`delete` sob `officeAction(..., { audit: true })` e
  `auditedTenantWrite`; `list`/`get`/`context` sem audit de escrita.
- **Rationale**: espelha 016; auditoria de fronteira só em mutações.

## D14 — REST: harness Jest pode dar 500 (limitação pré-existente)

- **Decisão**: prever `rest-control-measures.test.ts`, mas se o harness REST-via-Jest falhar com 500
  (limitação pré-existente já provada nas fatias 014/016), **documentar** e validar o REST
  **autoritativamente por cURL** contra o dev server no Postgres efêmero. Actions + isolamento
  provam a lógica.
- **Rationale**: mesma limitação/mitigação das fatias anteriores.
