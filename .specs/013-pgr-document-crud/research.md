# Research — CRUD do Documento PGR

Consolidação das decisões técnicas. Não há `NEEDS CLARIFICATION` pendente: a spec foi aprovada com
as decisões do Gate 0 e o modelo (`pgr`, migration `0012`) já está na `develop`. As decisões abaixo
derivam da leitura do código real das fatias análogas.

## Arquivos de referência lidos

- `CLAUDE.md`, `.specify/memory/constitution.md`, `package.json`
- `src/shared/db/schema/pgr.ts`, `src/shared/db/migrations/0012_pgr_risk_data_model.sql`
- `src/shared/db/schema/companies.ts`, `src/shared/db/schema/work-units.ts`
- `src/shared/db/repositories/companies.ts`, `work-units.ts`, `ges.ts`, `audited-write.ts`
- `src/shared/pagination.ts`, `src/shared/errors/{app-error,not-found-error,reference-not-found-error}.ts`
- `src/shared/server/office-action.ts`, `result.ts`, `action-error.ts`, `src/shared/api/rest.ts`
- `src/shared/db/with-org.ts`
- `src/shared/domains/pgr/{risks,form-fields,validation,companies,work-units}.ts`
- `src/shared/server/actions/pgr/{companies,work-units}.ts`
- `src/app/api/v1/companies/**`, `src/app/api/v1/work-units/route.ts`
- `src/app/(protected)/companies/**`, `employees/**`, `_ui/**`, `layout.tsx`
- `src/__tests__/integration/_helpers/{db,pgr-seed,isolation-suite}.ts`
- `src/__tests__/integration/pgr/{companies,rest-companies}.test.ts`, `unit/domains/pgr/{companies,categories}.test.ts`
- `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`

## Decisões

### D1 — Reuso do enum de registro (DRY)

**Decisão**: importar `pgrRegistrationTypeSchema` (e o helper de rótulo `pgrRegistrationTypeLabel`)
de `@/shared/domains/pgr/risks.ts`, em vez de redefinir o enum no novo domínio.
**Rationale**: `risks.ts` (fatia do modelo `0012`) já espelha o `pgEnum pgr_registration_type`
(`crm|crea|mte|not_applicable`) e o rótulo pt-BR. Redefinir violaria DRY e criaria divergência.
**Alternativas**: redefinir enum local — rejeitada (duplicação, risco de drift).

### D2 — Datas: string ISO obrigatória com validação de calendário

**Decisão**: `issuedAt`/`validUntil` como `z.iso.date(msg)` (obrigatórias), e a regra
`validUntil >= issuedAt` por comparação lexicográfica de strings `AAAA-MM-DD` num `superRefine`.
`form-fields.ts` já tem `optionalIsoDate` (opcional); crio um `requiredIsoDate` inline análogo.
**Rationale**: colunas `date` são anuláveis no banco (backstop), mas a fatia as exige na app; `z.iso.date`
rejeita datas impossíveis (ex. `2026-13-45`); comparação de strings `AAAA-MM-DD` é ordenável e
suficiente (sem timezone). Drizzle mapeia `date` para `string`, então persistimos a string.
**Alternativas**: `Date` objects — rejeitada (introduz timezone e coerção desnecessária para coluna `date`).

### D3 — Aceite da declaração: dois schemas (gate não-persistido)

**Decisão**: um objeto base `pgrBaseObject` (campos persistidos) refinado em `pgrInputSchema`
(update/persist) e estendido em `pgrCreateSchema = pgrBaseObject.extend({ declarationAccepted:
z.literal(true, {error}) }).superRefine(...)`. A action/handler de **create** faz
`pgrCreateSchema.parse(input)` e **descarta** `declarationAccepted` (`const { declarationAccepted,
...values } = parsed`) antes de chamar o repo. Update usa `pgrInputSchema` (sem aceite).
**Rationale**: cumpre FR-007 (aceite validado no servidor em create) e FR-008 (não-persistido, sem
coluna) sem migration. `z.literal(true)` rejeita ausência/`false` com `VALIDATION`.
**Alternativas**: (a) validar o aceite só na UI — rejeitada (spec exige revalidação no servidor);
(b) persistir num campo — rejeitada (exigiria migration, fora de escopo #79).

### D4 — Coerência tipo↔número de registro

**Decisão**: `superRefine` — se `registrationType !== "not_applicable"` então `registrationNumber`
é obrigatório (issue em `registrationNumber`); se `== "not_applicable"` e `registrationNumber`
preenchido → issue (não se aplica). `registrationNumber` base = `optionalString`.
**Rationale**: FR-009. Regra de negócio pura, testável em unit; mapeada a `VALIDATION` via `ZodError`.
**Alternativas**: aceitar número livre — rejeitada (contraria a regra normativa da issue).

### D5 — Guards de integridade referencial (copiar, não abstrair)

**Decisão**: no repo `pgr.ts`, replicar `assertCompanyInTenant(tx, orgId, companyId)` e
`assertWorkUnitInCompany(tx, orgId, companyId, workUnitId)` (de `work-units.ts`/`ges.ts`), chamados
dentro do `withOrg` de create/update, ANTES do insert/update. `workUnitId` só é checado quando
presente. Ambos lançam `ReferenceNotFoundError` → `FK_NOT_FOUND`/422.
**Rationale**: FR-014 e edge cases (empresa/obra inválida, obra de outra empresa, cross-tenant). Os
guards são tenant-scopados (`eq(orgId)`), então empresa/obra de outro tenant não resolvem →
`FK_NOT_FOUND`. Copiar segue o padrão vigente (YAGNI; sem helper compartilhado especulativo).
**Alternativas**: confiar só na FK do banco — rejeitada (a FK do banco daria `23503`→FK_NOT_FOUND,
mas não cobre "obra pertence à empresa X", que precisa do guard explícito).

### D6 — Sem 409/DUPLICATE

**Decisão**: não há caminho de duplicidade; nenhum tratamento de `23505`.
**Rationale**: FR-019 — a tabela `pgr` não tem unique. `toActionError` continua mapeando `23505`
genericamente, mas nenhuma operação de `pgr` o produz.

### D7 — REST create também exige aceite

**Decisão**: `POST /api/v1/pgr` faz `pgrCreateSchema.parse(await req.json())` (exige
`declarationAccepted:true`), depois descarta o campo e chama `repo.createPgr`. `PUT` usa
`pgrInputSchema` (corpo completo, sem aceite).
**Rationale**: FR-007 exige revalidação no servidor — REST é superfície de servidor. Consistência com
a Server Action de create.
**Alternativas**: pular o gate no REST — rejeitada (abriria bypass do requisito de conformidade).

### D8 — getById devolve linha crua; detalhe resolve nomes à parte

**Decisão**: `getPgrById` retorna `Pgr | null` (sem join). A **página de detalhe** resolve nomes de
empresa/obra via `getCompanyAction`/`getWorkUnitAction` em paralelo (padrão de `employees/[id]`).
A **listagem** usa join (D9), pois precisa dos nomes em massa.
**Rationale**: espelha o padrão existente; mantém `getPgrById` simples e reusável pela edição.
**Alternativas**: getById com join — desnecessário para a edição (que precisa dos IDs, não dos nomes).

### D9 — Listagem com join para nomes + filtros dependentes

**Decisão**: `listPgr` faz `innerJoin(companies)` (razão social) e `leftJoin(workUnits)` (nome da
obra; left porque `work_unit_id` é nullable). Filtros: `companyId?` e `workUnitId?` (cada um
`eq(...)` quando presente); `search?` opcional em responsável. Paginação offset (`resolvePageParams`)
e `{ rows, total }`. Ordena por `desc(pgr.createdAt)`.
**Rationale**: FR-002/FR-011; colunas Emissão/Validade/Obra/Empresa/Responsável exigem os nomes.
**Alternativas**: N+1 resolvendo nomes por linha — rejeitada (performance).

### D10 — Filtro dependente na UI (client) + modal da declaração sem primitivo novo

**Decisão**: `pgr-filters.tsx` (client) replica a cascata de `employee-form` (company select →
carrega work units via `listWorkUnitsAction({ companyId })` → reseta obra ao trocar empresa) e
navega por query params (`router.push`). O modal da declaração (`declaration-modal.tsx`) reusa o
**overlay inline** de `confirm-delete-button.tsx` (não há primitivo de Modal genérico).
**Rationale**: reuso máximo do `_ui` existente (FR-011, FR-007); YAGNI (não introduz biblioteca de
modal).
**Alternativas**: criar primitivo `<Modal>` genérico — rejeitada nesta fatia (YAGNI; um consumidor só).

### D11 — Exclusão sem `/dependents`

**Decisão**: `delete-pgr.tsx` usa `ConfirmDeleteButton` **sem** `loadDependentsAction`, com uma
`description` estática avisando que vínculos futuros (GES/revisões) são removidos em cascata
(comportamento do `0012`). Sem endpoint `/api/v1/pgr/[id]/dependents`.
**Rationale**: Gate 0 — `pgr_ges`/`pgr_revisions` fora de escopo (#27/#79); não há dependentes a
pré-visualizar nesta fatia.
**Alternativas**: endpoint de dependentes — rejeitada (gerenciar esses vínculos está fora de escopo).

### D12 — Testes em Postgres efêmero; seed já tem `pgr`

**Decisão**: integração mocka `@/shared/db/env` (`getDatabaseUrl → INTEGRATION_APP_RUNTIME_URL`),
`next/cache`, e `requireOfficeStaff`; `shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL`; `applyMigrations`
no `beforeAll`, `seedPgrBase` no `beforeEach`. A seed **já cria** `pgr` para org_a/org_b
(`PGR_IDS.pgrA=…d4`, `pgrB=…e4`, cols `id,org_id,company_id,work_unit_id`). Isolamento via
`runIsolationSuite({ table:"pgr", seededCountA:1, crossTenantInsertSql:"insert into public.pgr … org_b" })`.
**Rationale**: Princípio I exige RLS comprovável (Postgres, não SQLite). Reuso total do harness.
**Consideração**: as linhas seed de `pgr` têm só company/work_unit (sem responsável/datas). Testes de
**detalhe/listagem** que assertem responsável/tipo/datas devem (a) criar via `createPgrAction`, ou
(b) estender o insert de `pgr` na seed com `responsible/registration_type/issued_at/valid_until`.
Preferir (a) para não alterar a seed compartilhada; estender a seed só se um teste de isolamento/lista
exigir valores específicos.

## Riscos técnicos

- **R1 — Comparação de datas como string**: só vale para o formato `AAAA-MM-DD` de `z.iso.date`.
  Mitigação: `requiredIsoDate` garante o formato antes do `superRefine`.
- **R2 — Estender a seed compartilhada** (`pgr-seed.ts`) pode afetar outras suítes (pgr-risk-\*).
  Mitigação: preferir criar linhas via action nos testes desta fatia; se estender, manter
  `PGR_IDS.pgrA/pgrB` e apenas adicionar colunas (não novos IDs), revalidando as suítes vizinhas.
- **R3 — Modal via overlay inline**: acessibilidade/foco limitados (herdado do padrão atual).
  Aceitável nesta fatia; melhoria de primitivo de modal fica para depois (YAGNI).
- **R4 — `revalidatePath`** dos caminhos `/pgr` e `/pgr/[id]/edit` deve espelhar o padrão de
  companies (create/delete → base; update → base + `/[id]/edit`; adicionar `/pgr/[id]` no update
  para refletir no detalhe).
