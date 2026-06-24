# Research — CRUD de Categorias (EPI / Máquina) (008)

> Phase 0. A fatia reusa integralmente os padrões fixados na 006 (modelo de dados) e na 007
> (CRUD/contrato/gate/UI). Não há **NEEDS CLARIFICATION**: o "como" já está provado no repo.
> Abaixo, as decisões de design e as alternativas descartadas.

## D1 — Alinhar `categories` ao padrão `ActionResult` + `officeAction` da 007

- **Decisão**: a validação zod ocorre **na Server Action** (`categoryInputSchema.parse(input)`) e
  o repositório recebe valores já validados (`CategoryValues`). As Server Actions são embrulhadas
  por `officeAction(operation, fn, { audit })`, que centraliza gate + mapeamento de erro +
  auditoria. O `createCategory` atual (que hoje faz `categoryTypeSchema.parse` **dentro** do
  repositório e aceita `{ type: string }`) é **refatorado** para receber `CategoryValues` tipado,
  igual a `companies`/`job-roles`.
- **Rationale**: caminho único de validação e de mapeamento de erro (`toActionError`); consistência
  com as 5 entidades da 007; o repositório deixa de duplicar parsing.
- **Alternativas descartadas**: manter o parsing dentro do repositório (inconsistente, dificulta o
  teste unitário do schema e mistura camadas); criar um contrato próprio (já existe `ActionResult`
  na 007 — reusar).

## D2 — Sem tela de detalhe dedicada (detalhe = edição)

- **Decisão**: não há rota/tela só-leitura. O "detalhe" é o carregamento da categoria por id no
  formulário de edição (`/categories/[id]/edit`), via `getCategoryAction(id)`.
- **Rationale**: entidade de 3 campos; uma tela só-leitura seria redundante (KISS). É o que o spec
  fixa em FR-001 e na Assumption A1.
- **Alternativas descartadas**: página de detalhe separada (over-engineering para 3 campos).

## D3 — Exclusão é confirmar-e-remover (sem dependentes)

- **Decisão**: `deleteCategoryAction(id)` remove o registro após confirmação na UI
  (`delete-category.tsx` reusa o `confirm-delete-button.tsx`/padrão da 007). **Não** há aviso de
  cascata nem helper de contagem de dependentes.
- **Rationale**: `categories` é catálogo independente — **nenhuma** tabela da 006 tem FK de entrada
  para `categories` (diferente de `companies`, que tem `countCompanyDependents`). Logo não há
  impacto a avisar. É o spec FR-005 / Assumption A2.
- **Alternativas descartadas**: replicar o fluxo "confirmar-com-aviso-de-cascata" da 007 (não se
  aplica — não há filhos); bloquear exclusão (sem motivo, não há integridade a proteger).

## D4 — Lista: busca por nome + filtro por tipo + paginação offset

- **Decisão**: `listCategories(orgId, { search?, type?, page?, pageSize? })` retorna
  `Paginated<Category>` (`{ rows, total }`). Busca por `name` via `ilike`; filtro por `type`
  (enum) quando informado; ordenação por `name` (catálogo) ou `createdAt` (decisão de
  implementação — alinhar à UX da lista). Paginação por `resolvePageParams` (pageSize default 20,
  `PAGE_SIZE_MAX` 100), reusando `src/shared/pagination.ts`.
- **Rationale**: idêntico ao padrão de `companies`/`job-roles`; o filtro por tipo segue o mesmo
  mecanismo do `companyId` em `job-roles` (campo `hidden` no `SearchForm`, repassado ao
  `Pagination`).
- **Alternativas descartadas**: paginação cursor (desnecessária no volume; offset basta — A5);
  carregar tudo no cliente (degrada com volume; fere FR-003).

## D5 — `DUPLICATE` e `NOT_FOUND` saem do mecanismo existente, sem código novo de erro

- **Decisão**: a duplicidade `(org_id, type, name)` é capturada pela **constraint** Postgres
  `uq_categories_org_type_name` (SQLSTATE `23505`), que `toActionError` já mapeia para
  `{ code: "DUPLICATE" }` (≈409). O `NOT_FOUND` (≈404) é emitido lançando `NotFoundError` na
  Server Action quando o repositório retorna `null` (getById/update) ou `false` (delete) — inclui
  o caso **cross-tenant** (a RLS não enxerga a linha do outro escritório, então o `getById`
  devolve `null`). O `VALIDATION` (tipo fora do enum, nome vazio) vem do `ZodError`.
- **Rationale**: zero novos códigos/branches; a fonte de verdade é a constraint do banco (006) +
  o mapeador único da 007. Cobre o requisito de erros **expressos como códigos do contrato**, não
  status HTTP (FR-023).
- **Alternativas descartadas**: pré-checar duplicidade com um `SELECT` antes do insert (corrida +
  duplica a regra do banco — a constraint é a fonte de verdade); devolver status HTTP cru (a UI
  consome `ActionResult`, não HTTP).

## D6 — Auditoria só na escrita, sem PII

- **Decisão**: `create`/`update`/`delete` chamam `officeAction(..., { audit: true })` (evento de
  fronteira sem PII no sucesso) e os writes do repositório passam por `auditedTenantWrite(...,
"pgr.categories.write_rejected", ...)` (já usado no `createCategory`; estender a `update`/
  `delete`). `list`/`get` **não** auditam (FR-024).
- **Rationale**: replica exatamente o comportamento de `companies`/`job-roles`; `categories` não
  tem PII (só `type`/`name`/`note`), e ainda assim o evento não carrega payload.
- **Alternativas descartadas**: auditar leituras (ruído, fere FR-024).

## D7 — Sem migration; reuso do seed e do harness de integração

- **Decisão**: nenhuma alteração de schema. Os testes de integração reusam `pgr-seed.ts`, que já
  insere `categoryA` (`org_a`, `epi`, "Capacete") e `categoryB` (`org_b`, `machine`, "Betoneira")
  — material pronto para os casos cross-tenant. O isolamento em nível de tabela já é coberto por
  `categories-isolation.test.ts` (via `runIsolationSuite`); esta fatia adiciona o teste em nível
  de **Server Action**.
- **Rationale**: a tabela/constraint/RLS são da 006; recriar seria retrabalho e risco. KISS.
- **Alternativas descartadas**: nova migration (nada a migrar); novo seed paralelo (duplicação).

## Conformidade constitucional

Sem novas dependências/infra (Princípio II); CRUD síncrono (IV); zod antes do banco + constraints
do Postgres como fonte de verdade (V); isolamento pela sessão + RLS backstop, testado em Postgres
efêmero (I + Quality Gates). Nada a registrar em _Complexity Tracking_.
