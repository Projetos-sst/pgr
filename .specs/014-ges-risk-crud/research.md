# Research — CRUD de Risco do GES

Consolidação das decisões técnicas. Não há `NEEDS CLARIFICATION` pendente: a spec foi aprovada com
as decisões do Gate 0 e o modelo (`risks`, migration `0012`) já está na `develop`. As decisões
abaixo derivam da leitura do código real das fatias análogas (013 `pgr`, `ges`, `companies`).

## Arquivos de referência lidos

- `CLAUDE.md`, `.specify/memory/constitution.md`, `package.json`
- `src/shared/db/schema/risks.ts`, `src/shared/db/migrations/0012_pgr_risk_data_model.sql`
- `src/shared/db/schema/ges.ts`, `companies.ts`, `work-units.ts`
- `src/shared/db/repositories/pgr.ts`, `ges.ts`, `companies.ts`, `work-units.ts`, `audited-write.ts`
- `src/shared/pagination.ts`, `src/shared/errors/{app-error,not-found-error,reference-not-found-error}.ts`
- `src/shared/server/office-action.ts`, `result.ts`, `action-error.ts`, `src/shared/api/rest.ts`
- `src/shared/db/with-org.ts`
- `src/shared/domains/pgr/{risks,form-fields,pgr,ges,validation}.ts`
- `src/shared/server/actions/pgr/{pgr,ges,companies,work-units}.ts`
- `src/app/api/v1/pgr/**`, `src/app/api/v1/ges/**`
- `src/app/(protected)/pgr/**`, `ges/**`, `_ui/**`, `layout.tsx`
- `.specs/013-pgr-document-crud/**` (plan/research/data-model/contracts/quickstart)
- `src/__tests__/integration/_helpers/{db,pgr-seed,isolation-suite}.ts`
- `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`

## Decisões

### D1 — Reuso dos enums/labels de risco (DRY)

**Decisão**: importar `riskAgentTypeSchema`, `exposureTimeSchema`, `measurementUnitSchema` e os
helpers de rótulo `riskAgentTypeLabel`/`exposureTimeLabel` (+ o de unidade, se necessário) de
`@/shared/domains/pgr/risks.ts`, sem redefinir.
**Rationale**: `risks.ts` (fatia do modelo `0012`) já espelha os `pgEnum`
`risk_agent_type`/`exposure_time`/`measurement_unit` e os rótulos pt-BR. Redefinir violaria DRY e
criaria drift. **Não** se cria rótulo para unidade de medida se ainda não existir — usar o value do
enum diretamente é aceitável, mas preferir adicionar um `measurementUnitLabel` a `risks.ts` só se a
UI precisar (P2 de UI, decidido no data-model: manter values na v1 para evitar tocar `risks.ts`).
**Alternativas**: redefinir enums locais — rejeitada (duplicação/drift).

### D2 — Domínio novo `domains/pgr/risk.ts` (singular) para evitar colisão

**Decisão**: criar o schema CRUD em `src/shared/domains/pgr/risk.ts` (singular), que **importa** de
`./risks` (plural, já existente). O repositório/actions/UI usam o plural (`risks`, `/risks`).
**Rationale**: `risks.ts` já existe e tem outro papel (enums/matriz/labels). Um segundo arquivo com
o mesmo nome é impossível; o singular deixa clara a separação "regras CRUD" vs "modelo/matriz".
**Alternativas**: (a) estender `risks.ts` com o schema CRUD — rejeitada (mistura responsabilidades e
incha um arquivo já consumido por `pgr.ts`); (b) `risk-crud.ts` — aceitável, mas `risk.ts` é mais
limpo e não conflita.

### D3 — `concentrationIntensity`: string decimal opcional (precedente `numeric`)

**Decisão**: tratar `concentrationIntensity` como **`optionalString`** com um refino de formato
decimal (rejeita não-numérico), governada pela regra `qualitative_na` (D4). Persistida como string
(o driver aceita string em coluna `numeric`).
**Rationale**: o precedente do projeto para colunas `numeric` é string — `ges.ceilingHeight` usa
`optionalString`; Drizzle mapeia `numeric` → `string`; postgres-js envia a string ao Postgres, que a
converte. Evita `Date`/`number` coercion e problemas de precisão de ponto flutuante. O input de UI é
texto/`inputMode="decimal"`. **Alternativas**: (a) `z.coerce.number()` — rejeitada (perda de
precisão/casas decimais e divergência do precedente); (b) `numeric` como number no Drizzle
(`mode:"number"`) — rejeitada (exigiria alterar o schema; zero-migration).

### D4 — Regra `qualitative_na` (superRefine)

**Decisão**: `superRefine` — se `concentrationIntensity` estiver presente **e** `measurementUnit`
for `qualitative_na` **ou** ausente, adicionar issue em `concentrationIntensity` ("concentração só é
permitida com unidade de medida quantitativa"). Ou seja: concentração ⇒ exige unidade quantitativa.
**Rationale**: FR-010. Regra de negócio pura, testável em unit; mapeada a `VALIDATION` via
`ZodError`. Como `optionalString` transforma `""` → `undefined`, "presente" = `!= null`.
**Alternativas**: validar só na UI — rejeitada (spec exige validação no servidor); CHECK no banco —
rejeitada (zero-migration; não há CHECK dessa regra no `0012`).

### D5 — Um único schema para create e update (sem gate de declaração)

**Decisão**: `riskInputSchema = riskBaseObject.superRefine(refineRisk)` é usado **tanto** por create
quanto por update (corpo completo). Não há gate de aceite (diferente de `pgr`).
**Rationale**: a issue #24 não tem declaração/aceite; update é corpo completo (decisão aprovada); o
mesmo schema simplifica (YAGNI). **Alternativas**: dois schemas — desnecessário (não há campo
exclusivo de create).

### D6 — Guard de integridade referencial `assertGesInTenant`

**Decisão**: no repo `risks.ts`, criar `assertGesInTenant(tx, orgId, gesId)` (espelha
`assertWorkUnitInCompany`): `select id from ges where org_id=orgId and id=gesId limit 1`; se ausente
→ `ReferenceNotFoundError("ges")` → `FK_NOT_FOUND`/422. Chamado dentro do `withOrg` de create/update
ANTES do insert/update.
**Rationale**: FR-014 e edge cases (`gesId` inexistente/malformado/cross-tenant). O guard é
tenant-scopado (`eq(orgId)`), então GES de outro tenant não resolve → `FK_NOT_FOUND`. A FK do banco
(`23503`) é backstop, mas o guard dá o erro correto e explícito sem depender do SQLSTATE.
**Alternativas**: confiar só na FK — rejeitada (mensagem/rota de erro menos precisa; e a FK dispara
só no insert, não distingue tenant).

### D7 — `getRiskById` devolve linha crua; detalhe resolve o nome do GES à parte

**Decisão**: `getRiskById` retorna `Risk | null` (sem join). A **página de detalhe** resolve o nome
do GES via `getGesAction(gesId)` (padrão `pgr/[id]` que usa `getCompanyAction`/`getWorkUnitAction`).
A **listagem** usa join (D8).
**Rationale**: espelha o padrão da 013; mantém `getRiskById` simples e reusável pela edição.
**Alternativas**: getById com join — desnecessário para a edição (que precisa dos IDs).

### D8 — Listagem com join para o nome do GES + filtros

**Decisão**: `listRisks` faz `innerJoin(ges, eq(ges.id, risks.gesId) AND eq(ges.orgId, orgId))` para
projetar `gesName`. Filtros: `gesId?` (`eq`), e — para o filtro dependente Empresa→Obra→GES — também
aceitar `companyId?`/`workUnitId?` aplicados via colunas de `ges` (o join expõe `ges.companyId`/
`ges.workUnitId`). `search?` opcional em `risks.description`. Paginação offset
(`resolvePageParams`), `{ rows, total }`, `orderBy(desc(risks.createdAt))`.
**Rationale**: FR-002/FR-007. A tabela `risks` não tem `company_id`/`work_unit_id`; o vínculo com a
empresa/obra vem **através do GES**, então os filtros de empresa/obra atuam sobre as colunas de `ges`
no join. O `count(*)` roda com o mesmo `where`; se houver filtro por coluna de `ges`, o count também
faz o innerJoin com `ges` (mesmo predicado).
**Alternativas**: resolver nome do GES por N+1 — rejeitada (performance); filtrar empresa/obra só na
UI sem tocar o repo — rejeitada (o filtro precisa restringir as linhas retornadas).

### D9 — Filtro dependente Empresa→Obra→GES na UI (client)

**Decisão**: `risk-filters.tsx` (client) estende a cascata de `pgr-filters.tsx` para **três** níveis:
company select → carrega obras via `listWorkUnitsAction({ companyId })` → carrega GES via
`listGesAction({ workUnitId, pageSize:100 })`. Trocar a Empresa reseta Obra **e** GES; trocar a Obra
reseta GES. Navega por query params (`companyId`/`workUnitId`/`gesId`). A mesma cascata alimenta o
seletor de GES **obrigatório** do `risk-form.tsx` (na criação).
**Rationale**: FR-007/FR-008; reuso máximo das actions existentes (`listCompanyOptionsAction`,
`listWorkUnitsAction`, `listGesAction`) — nenhuma action nova. Espelha o padrão de reset de
`pgr-filters`/`pgr-form` (que zera dependentes no handler, evitando `set-state-in-effect`).
**Alternativas**: uma action agregada "árvore empresa/obra/ges" — rejeitada (YAGNI; 3 actions já
existem).

### D10 — Reutilização por prefill (sem action de clone)

**Decisão**: a UI faz o reuso **sem** action de clone. O botão "Reutilizar" (no detalhe e/ou na
linha da lista) navega para `/risks/new?from=<idOrigem>`. A página `new/page.tsx`, se receber
`from`, chama `getRiskAction(from)` no servidor e passa os valores como `defaultValues` ao
`risk-form.tsx` (incluindo o `gesId` de origem, que o usuário pode trocar). O submit usa
`createRiskAction` → **novo `id`**. Sem verificação de duplicidade.
**Rationale**: decisão aprovada (prefill, não clone server-side). Reusa `getRiskAction` +
`createRiskAction` já existentes; zero superfície nova. FR-011.
**Alternativas**: `duplicateRiskAction` server-side — rejeitada explicitamente (Gate 0).

### D11 — Sem 409/DUPLICATE

**Decisão**: não há caminho de duplicidade; nenhum tratamento de `23505`.
**Rationale**: FR-019 — a tabela `risks` não tem unique. `toActionError` ainda mapeia `23505`
genericamente, mas nenhuma operação de `risks` o produz.

### D12 — Exclusão sem `/dependents`; cascata do banco

**Decisão**: `delete-risk.tsx` usa `ConfirmDeleteButton` **sem** `loadDependentsAction`, com
`description` estática avisando que avaliações/medidas futuras são removidas em cascata
(comportamento `ON DELETE CASCADE` do `0012` para `risk_assessments`/`control_measures`). Sem
endpoint `/api/v1/risks/[id]/dependents`.
**Rationale**: `risk_assessments`/`control_measures` (#25/#26) estão fora de escopo e ainda não têm
UI; não há dependentes a pré-visualizar. Nota de teste: como a seed cria 1 assessment + 1 measure
por risco, o delete de `riskA` cascateia essas linhas — o teste só assere que o risco some.
**Alternativas**: endpoint de dependentes — rejeitada (gerenciar esses vínculos é fora de escopo).

### D13 — `exposureTime`/`measurementUnit` opcionais (enum nullable)

**Decisão**: no schema, `exposureTime` e `measurementUnit` são enums **opcionais** com preprocess de
`""` → `undefined` (helper local `optionalEnum(schema)`, espelhando `optionalUuid`). As colunas são
nullable no banco.
**Rationale**: FR-009 (só `agentType`/`description` obrigatórios). Selects de UI têm opção vazia "—".
**Alternativas**: enums obrigatórios — contraria o schema nullable e a spec.

### D14 — Testes em Postgres efêmero; seed já tem `risks`

**Decisão**: integração mocka `@/shared/db/env` (`getDatabaseUrl → INTEGRATION_APP_RUNTIME_URL`),
`next/cache`, e `requireOfficeStaff`; `shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL`;
`applyMigrations` no `beforeAll`, `seedPgrBase` no `beforeEach`. A seed **já cria** `risks` para
org_a/org_b (`PGR_IDS.riskA=…d1`, `riskB=…e1`, cols `id,org_id,ges_id,agent_type,description`).
Isolamento via `runIsolationSuite({ table:"risks", seededCountA:1, crossTenantInsertSql: "insert
into public.risks … org_b, gesB" })`.
**Rationale**: Princípio I exige RLS comprovável (Postgres, não SQLite). Reuso total do harness.
**Consideração**: as linhas seed de `risks` têm só `ges_id`/`agent_type`/`description`. Testes de
detalhe/listagem que assertem campos opcionais (tempo/unidade/concentração) devem **criar via
`createRiskAction`** (preferido) em vez de alterar a seed compartilhada.

## Riscos técnicos

- **R1 — Filtro empresa/obra via join em `ges`**: `risks` não tem `company_id`/`work_unit_id`; o
  count e a lista precisam do innerJoin com `ges` quando se filtra por empresa/obra. Mitigação:
  aplicar o mesmo `where` (com join) no `select` e no `count`.
- **R2 — Concentração como string**: validar formato decimal no domínio para não enviar lixo ao
  `numeric` (que lançaria `22P02` genérico). Mitigação: refine de formato antes do `superRefine`.
- **R3 — Estender a seed compartilhada** (`pgr-seed.ts`) afeta suítes vizinhas. Mitigação: criar
  linhas via `createRiskAction` nos testes desta fatia; não alterar a seed.
- **R4 — `revalidatePath`**: espelhar o padrão de `pgr` (create/delete → base; update → base +
  `/[id]` + `/[id]/edit`).
- **R5 — Colisão de nome de arquivo**: `risk.ts` (novo, CRUD) vs `risks.ts` (existente, modelo).
  Mitigação: nomes distintos e import explícito (D2).
