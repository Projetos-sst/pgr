# Research — Avaliação de Risco (matriz 5×5) · Feature 016

Fase 0 do plano. Cada decisão: **Decision / Rationale / Alternatives considered**. Nenhum
`NEEDS CLARIFICATION` pendente (as 30 decisões vieram travadas do Gate 0 + spec aprovada).

---

## D1 — Zero-migration; tabela e enums reutilizados

- **Decision**: Não criar/alterar migration nem `schema/**`. Reusar a tabela `risk_assessments` e os
  enums `assessment_criterion` já existentes (migration `0012`), e a `risk_methodology` (`0013`).
- **Rationale**: O Gate 0 confirmou que `risk_assessments` já tem colunas, CHECKs (prob/sev 1–5,
  risk_level 1–25, coerência `risk_level = probability * severity`, uncertainty 0–2), FKs CASCADE,
  RLS `risk_assessments_isolation`, GRANT e trigger `set_updated_at_risk_assessments`. Nada falta.
- **Alternatives considered**: Adicionar coluna "is_current"/flag de vigência → **rejeitado**
  (vigência é derivável na leitura; evita coluna+trigger e mantém zero-migration).

## D2 — Domínio novo `risk-assessment.ts` importa de `risks.ts` e `methodology.ts`

- **Decision**: Criar `src/shared/domains/pgr/risk-assessment.ts` importando
  `assessmentCriterionSchema`/`assessmentCriterionLabel`/`uncertaintyDegreeLabel`/`computeRiskLevel`
  de `./risks`, e `classify`/`riskClassificationLabel`/`RiskClassification` de `./methodology`. Não
  redefinir enum já existente.
- **Rationale**: Espelha a decisão da fatia `014` (domínio `risk.ts` importando de `risks.ts`). DRY:
  a matriz 5×5 (`computeRiskLevel`) e a classificação (`classify`) já são funções puras testadas.
- **Alternatives considered**: Duplicar enums/labels no novo domínio → **rejeitado** (viola DRY,
  arrisca divergência com o schema).

## D3 — Campos numéricos com **coerção** string→número

- **Decision**: No `riskAssessmentInputSchema`, `probability`/`severity` = `z.coerce.number().int()
  .min(1).max(5)`; `uncertaintyDegree` = `z.coerce.number().int().min(0).max(2)` com default `0`.
- **Rationale**: O corpo REST-JSON envia números, mas os `<select>` da UI enviam strings; a coerção
  serve ambos com **um** schema. Os limites espelham `probabilitySchema`/`severitySchema`/
  `uncertaintyDegreeSchema` de `risks.ts` (mesma faixa dos CHECKs do banco).
- **Alternatives considered**: Dois schemas (form vs REST) → **rejeitado** (duplicação). Reusar
  `probabilitySchema` cru (sem coerção) → **rejeitado** (quebraria o form que envia string).

## D4 — `assessedAt` data **obrigatória**

- **Decision**: `assessedAt` = `z.iso.date("Data inválida (use AAAA-MM-DD)")` (obrigatória, sem
  `.optional()`). A coluna é `date NOT NULL default now`, mas a app **exige** o valor; a UI
  pré-preenche hoje e permite alterar.
- **Rationale**: Requisito explícito ("data obrigatória"); `z.iso.date` rejeita datas impossíveis
  (mesmo validador de `optionalIsoDate` em `form-fields.ts`, sem o `.optional()`).
- **Alternatives considered**: Deixar o default do banco preencher → **rejeitado** (a UI precisa
  permitir informar a data; regra de negócio pede obrigatoriedade explícita).

## D5 — `criterion` / `toleranceLimit`

- **Decision**: `criterion` = `assessmentCriterionSchema` (obrigatório); `toleranceLimit` =
  `optionalString` (`""` → `undefined`) de `form-fields.ts`.
- **Rationale**: Reuso direto; `tolerance_limit` é texto livre nullable no schema.

## D6 — `riskLevel` calculado e persistido (nunca do cliente)

- **Decision**: `riskLevel = computeRiskLevel(probability, severity)` calculado no servidor; o
  `riskAssessmentInputSchema` **não** contém `riskLevel`/`result` (o cliente não os envia). O banco
  valida coerência via CHECK.
- **Rationale**: Regra 4 do Gate 0. Evita adulteração; o CHECK de coerência é backstop.
- **Alternatives considered**: Aceitar `riskLevel` do cliente e só validar → **rejeitado** (superfície
  de adulteração; redundante com o cálculo).

## D7 — `result` snapshot + **onde** classificar (single write path)

- **Decision**: Expor no domínio a função **pura** `deriveAssessmentResult(values, bands)` →
  `{ riskLevel, result }` (`result = classify(computeRiskLevel(p,s), bands)`). **Cada superfície**
  (Server Action e REST handler) (1) lê a metodologia da org via `getRiskMethodologyView(tenantId)`
  (repo `risk-methodology`, com fallback `configured:false`), (2) chama `deriveAssessmentResult`,
  (3) passa `riskLevel`/`result` já computados ao repositório. O repositório **persiste** os valores
  recebidos (não lê metodologia).
- **Rationale**: A CLAUDE.md manda "reuse the same repository, zod schema e a regra — never
  re-implement the rule". A **regra** (classificação) vive **uma vez** na função pura do domínio,
  unit-testável; a orquestração (ler metodologia + derivar + persistir) é glue trivial repetido nas
  duas superfícies — exatamente como a fatia `014` repete `schema.parse + repo.create` em Action e
  REST. Mantém Drizzle fora de actions/handlers e o repo recebe dados já validados/derivados.
- **Alternatives considered**:
  - Classificar **dentro do repositório** (repo lê `risk_methodology` na mesma transação) →
    **rejeitado**: acopla o repo de avaliações à metodologia e afasta-se da instrução do roteiro
    ("leitura da metodologia pela action"); ganho de atomicidade é irrelevante (metodologia muda
    raramente e o snapshot é o objetivo).
  - Chamar a Server Action a partir do REST para reaproveitar → **rejeitado** (Actions são
    POST-only/`officeAction`, não reutilizáveis por handler REST).
- **Snapshot na leitura**: list/get/getCurrent **exibem `result` persistido**; nunca reclassificam o
  histórico. Só create/update recomputam (com a metodologia vigente no momento da gravação).

## D8 — Histórico 1:N, sem UNIQUE, sem 409, vigente derivada

- **Decision**: Cada create insere nova linha; nenhum upsert; nenhum tratamento de `DUPLICATE`/409.
  "Vigente" = `orderBy(desc(assessedAt), desc(createdAt))` `LIMIT 1`. `getCurrent` pode retornar
  `null` (risco sem avaliações) — **não** é erro.
- **Rationale**: Não há UNIQUE em `risk_assessments` (Gate 0). Ordena por data de avaliação e
  desempata por criação.
- **Alternatives considered**: Marcar "ativa" por flag/coluna → **rejeitado** (zero-migration; derivar
  é suficiente).

## D9 — `assertRiskInTenant` (guard tenant-scopado) → `FK_NOT_FOUND`

- **Decision**: Copiar o padrão `assertGesInTenant` (repo `risks`) para `assertRiskInTenant(tx, orgId,
  riskId)` no novo repo, consultando `risks` por `(orgId, riskId)`; ausente → `ReferenceNotFoundError
  ("risk")` (código `FK_NOT_FOUND`/422). Aplicado em `create`, `list` e `getCurrent` (operações
  ancoradas por `riskId`).
- **Rationale**: `risk_id` inválido/cross-tenant deve dar 422, não vazar. Espelha a fatia `014`.
- **Alternatives considered**: Confiar só na FK do banco → **rejeitado** (a FK dá erro genérico e não
  distingue cross-tenant; o guard dá o código de contrato correto e não escreve).

## D10 — Update = corpo completo, sem tocar `risk_id`; delete físico

- **Decision**: `update` recebe o mesmo `riskAssessmentInputSchema` (corpo completo), recomputa
  `riskLevel`/`result`, e faz `UPDATE ... WHERE org_id AND id` setando as colunas mutáveis
  (criterion/probability/severity/riskLevel/uncertaintyDegree/toleranceLimit/result/assessedAt +
  `updatedAt`), **sem** alterar `risk_id`. `delete` = físico (`DELETE ... WHERE org_id AND id`
  RETURNING) → boolean; sem endpoint de dependentes.
- **Rationale**: Regras 2/3 do Gate 0. A avaliação não "muda de risco"; editar é corrigir os valores.
- **Alternatives considered**: PATCH parcial → **rejeitado** (fora de escopo). Permitir mover de
  risco no update → **rejeitado** (semântica de reavaliação é criar nova, não migrar).

## D11 — Mapa de erros (contratos)

- **Decision**: `riskId` inválido/inexistente/cross-tenant → `FK_NOT_FOUND`/422; avaliação
  inexistente/cross-tenant (get/put/delete por id) → `NOT_FOUND`/404; validação (ranges/criterion/
  assessedAt) → `VALIDATION`/422; papel `client` → `FORBIDDEN`/403; **nunca** 409/`DUPLICATE`.
- **Rationale**: Reusa `HTTP_BY_CODE` de `src/shared/api/rest.ts` e `NotFoundError`/
  `ReferenceNotFoundError`; idêntico ao mapeamento validado na fatia `014`.

## D12 — Multi-tenant

- **Decision**: Tenant sempre de `officeAction`/`restHandler` (`tenantId`). Nunca aceitar
  `orgId`/`organizationId`/`organization_id` do corpo/query. `withOrg` + RLS.
- **Rationale**: Princípio I. Idêntico às fatias anteriores.

## D13 — REST em duas superfícies (nested + flat)

- **Decision**: List/create sob `api/v1/risks/[id]/assessments/route.ts` (`riskId` = param de rota);
  get/put/delete sob `api/v1/risk-assessments/[id]/route.ts`. Ambos via `restHandler`; 201 no create,
  204 no delete; `runtime="nodejs"`, `dynamic="force-dynamic"`.
- **Rationale**: Decisão de rota aprovada. Nested expressa "avaliações **de um** risco"; flat expressa
  "uma avaliação por id". O PUT recebe `riskId` via corpo? **Não** — o update é por `id` da avaliação
  (flat), e a Action/handler resolve `riskId` a partir da avaliação (para `revalidatePath`) lendo a
  linha ou recebendo-o no wrapper de UI. Ver contrato.
- **Alternatives considered**: Superfície única flat `/api/v1/risk-assessments?riskId=` → **rejeitado**
  (menos RESTful; a coleção "de um risco" fica melhor aninhada).

## D14 — UI: rotas aninhadas + preview client-side

- **Decision**: Páginas server aninhadas sob `risks/[id]/assessments/**`; formulário **client**
  (`assessment-form.tsx`) recebe `classificationBands` + `configured` como props e recomputa
  `riskLevel`/classificação a cada mudança de probability/severity (importando `computeRiskLevel` +
  `classify` + `riskClassificationLabel`, puros e client-safe). Botão "Avaliações" adicionado em
  `risks/[id]/page.tsx`. `riskLevel`/`result` **não editáveis** (read-only no form). Fallback de
  metodologia sinalizado quando `configured:false`.
- **Rationale**: Preview sem round-trip por tecla (Princípio IV). Reusa `_ui/list`/`_ui/form`/
  `ConfirmDeleteButton`. Botão no detalhe cumpre "atalho a partir de `/risks/[id]`".
- **Alternatives considered**: Recalcular classificação no servidor a cada input (Server Action) →
  **rejeitado** (latência desnecessária; a regra é pura e roda no cliente).

## D15 — Testes e seed

- **Decision**: Unit (`risk-assessment.test.ts`): ranges prob/sev/uncertainty, criterion inválido,
  `assessedAt` obrigatória, `computeRiskLevel`, `deriveAssessmentResult` com `defaultRiskMethodology`.
  Integração de Actions + REST + isolamento (`runIsolationSuite({ table:"risk_assessments" })`)
  contra Postgres efêmero. Seed **já** tem `riskAssessmentA`(org_a)/`riskAssessmentB`(org_b) → sem
  mudança (estender só se um cenário exigir 2ª avaliação no mesmo risco).
- **Rationale**: Cobre os cenários da spec; reusa infra `INTEGRATION_*`.
- **Limitação conhecida**: REST-via-Jest pode dar 500 (pré-existente, provado com `rest-pgr.test.ts`
  na fatia `014`); nesse caso, documentar e validar o REST autoritativamente por **cURL** contra o
  dev server no Postgres efêmero. Server Actions (mesmo repo/validação/mapeamento) + isolamento
  provam a lógica.

## D16 — Gate de formatação final

- **Decision**: Ao fim, rodar `npm run format:check` (mesmo check do CI, LF/repo-wide) além de
  `lint`/`typecheck`/`test`/`test:integration`. Formatar com Prettier **os artefatos .md da spec**
  antes de commitar (o CI reprova `.md` desformatado — aprendizado do PR #135). Não formatar
  repo-wide às cegas; analisar o diff.
- **Rationale**: O `format:check` do CI roda em todo o repo; Prettier dirigido nos arquivos da
  feature não basta como prova final.
