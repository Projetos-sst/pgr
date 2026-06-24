# Quickstart — CRUD de Categorias (008)

## O que esta fatia entrega

CRUD completo do catálogo **`categories`** (EPI / Máquina): listar (busca por nome + filtro por
tipo + paginação), criar, carregar por id para edição, editar e excluir — em UI (App Router) +
Server Actions, reusando a infraestrutura da 007. **Sem migration nova.**

## Rodar localmente

```bash
npm run dev          # http://localhost:3000 → entrar e acessar /categories (route group protegido)
```

Fluxo manual de verificação (como `owner`/`collaborator` de um escritório):

1. `/categories` → "Nova categoria" → tipo **EPI**, nome "Luva" → salvar → aparece na lista.
2. Criar outra **EPI** "Luva" → erro de **conflito** (`DUPLICATE`).
3. Criar **Máquina** "Luva" → aceita (tipo diferente).
4. Filtrar por tipo e buscar por nome → a lista respeita o filtro e pagina.
5. Editar uma categoria → alterar nome/observação → salvar.
6. Excluir → confirmação → some da lista (sem aviso de cascata).

## Testes (quality gate da fatia)

```bash
npm run lint                 # ESLint (flat config)
npm run typecheck            # tsc --noEmit (TypeScript strict)
npm run test                 # unit: categoryInputSchema (tipo/enum, nome não-vazio, note opcional)
npm run test:integration     # Server Actions contra Postgres efêmero (ver env abaixo)
```

### Variáveis para a integração (Postgres efêmero — exigido por RLS)

```bash
INTEGRATION_DATABASE_URL=postgres://<owner>@<branch>/<db>        # aplica migrations + seed (admin)
INTEGRATION_APP_RUNTIME_URL=postgres://app_runtime@<branch>/<db> # conexão da app (RLS ativa)
```

Sem essas variáveis, as suítes de integração entram em `describe.skip` (como nas demais da 007).

## Casos de integração obrigatórios (`src/__tests__/integration/pgr/categories.test.ts`)

Reusa `_helpers/db.ts` (`adminClient`/`applyMigrations`) e `_helpers/pgr-seed.ts` (já semeia
`categoryA`@`org_a` = `epi`/"Capacete" e `categoryB`@`org_b` = `machine`/"Betoneira"). O gate
`requireOfficeStaff` é mockado (`asOwner("org_a")`), igual aos testes da 007.

- **CRUD feliz**: criar `epi`/"Luva" em `org_a` → aparece no `list`; `get` por id devolve a linha;
  `update` muda o nome; `delete` remove (`list.total` cai).
- **Unicidade (FR-013/SC-003)**: criar `epi`/"Capacete" em `org_a` (colide com o seed) → `DUPLICATE`;
  criar `machine`/"Capacete" em `org_a` → ok (tipo diferente); o mesmo nome+tipo em `org_b` → ok.
- **Validação (SC-004)**: tipo fora de `epi|machine` → `VALIDATION`; nome vazio → `VALIDATION`.
- **Isolamento cross-tenant (FR-021/SC-002)**: `getCategoryAction(categoryB)` → `NOT_FOUND`;
  `updateCategoryAction(categoryB, …)` → `NOT_FOUND`; `deleteCategoryAction(categoryB)` → `NOT_FOUND`;
  `list` como `org_a` não traz `categoryB`.
- **Autorização (FR-025/SC-005)**: gate rejeitando (`ForbiddenError`) → toda ação devolve `FORBIDDEN`.

> Isolamento em nível de tabela já é coberto por
> `src/__tests__/integration/shared/db/categories-isolation.test.ts` (`runIsolationSuite`); esta
> fatia adiciona a cobertura em nível de **Server Action**.

## Definição de pronto

`npm run lint` + `npm run typecheck` + `npm run test` + `npm run test:integration` verdes
(incluindo isolamento e unicidade em Postgres efêmero). Ver `spec.md` → "Definição de pronto —
testes obrigatórios".
