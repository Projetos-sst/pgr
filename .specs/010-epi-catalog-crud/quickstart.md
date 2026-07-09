# Quickstart — CRUD de Catálogo de EPI / Equipamentos (010)

## O que esta fatia entrega

CRUD completo do catálogo **`epi_catalog`** (itens de EPI / Máquinas e Equipamentos): listar (busca
por nome/CA/categoria + filtro por tipo + paginação), criar, carregar por id para edição, editar e
excluir — em UI (App Router) + Server Actions, reusando a infraestrutura da 007/009. **Sem migration
nova** (o modelo é da 008). Categoria coerente com o tipo via FK composta + assert no tenant;
exclusão **bloqueada** se houver dependentes; **sem** unicidade (homônimos permitidos).

## Rodar localmente

```bash
npm run dev          # http://localhost:3000 → entrar e acessar /epi-catalog (route group protegido)
```

Fluxo manual de verificação (como `owner`/`collaborator` de um escritório):

1. `/epi-catalog` → "Novo item" → tipo **EPI** → o select de **Categoria** carrega só categorias EPI
   do escritório → escolher uma, nome "Luva nitrílica", CA "12345", validade, fabricante… → salvar →
   aparece na lista (colunas CA, Nome, Tam., Fabricante, Tipo, Categoria, Und. Medida, Validade).
2. Trocar o **Tipo** para **Máquinas e Equipamentos** no formulário → o select de Categoria recarrega
   com categorias `machine` e a seleção anterior é limpa.
3. Criar outro item com **mesmo** tipo/nome → **aceito** (sem erro de duplicidade).
4. Filtrar por tipo e buscar por nome/CA/categoria → a lista respeita filtro+busca e pagina.
5. Editar um item → alterar CA/validade/norma → salvar.
6. Excluir um item **sem** dependentes → confirmação → some da lista.
7. Excluir um item **com** dependente (estoque/risco/entrega) → bloqueado com mensagem **"item em
   uso"**; nada é removido.

## Testes (quality gate da fatia)

```bash
npm run lint                 # ESLint (flat config)            → "eslint"
npm run typecheck            # tsc --noEmit (TypeScript strict) → "tsc --noEmit"
npm run test                 # unit: epiCatalogInputSchema (obrigatórios, tipo, data, opcionais) → "jest --selectProjects unit"
npm run test:integration     # Server Actions contra Postgres efêmero (ver env abaixo)           → "jest --selectProjects integration"
npm run format:check         # Prettier verificação (todo o repo) → "prettier --check ."
npm run format               # Prettier escrita (todo o repo)     → "prettier --write ."
# npm run check              # atalho: format:check && lint && typecheck && test (sem integração)
```

> Os scripts `format`/`format:check` rodam sobre **todo o repositório** (`prettier … .`). Para
> formatar/verificar **apenas os arquivos tocados** nesta fatia (sem mexer no resto), use
> `npx prettier --write <arquivos>` / `npx prettier --check <arquivos>`. Não há script dedicado a
> "arquivos tocados".

### Variáveis para a integração (Postgres efêmero — exigido por RLS / FK composta / ON DELETE)

```bash
INTEGRATION_DATABASE_URL=postgres://<owner>@<branch>/<db>           # aplica migrations + seed (admin)
INTEGRATION_DATABASE_URL_ADMIN=postgres://<owner>@<branch>/<db>     # opcional (setup owner-level)
```

Sem essas variáveis, as suítes de integração entram em `describe.skip` (como nas demais da 007/008).

## Casos de integração obrigatórios (`src/__tests__/integration/pgr/epi-catalog.test.ts`)

Reusa `_helpers/db.ts` (`adminClient`/`applyMigrations`) e `_helpers/pgr-seed.ts`, que **já** semeia:
`categoryA`@`org_a` (`epi`/"Capacete"), `categoryB`@`org_b` (`machine`/"Betoneira"),
`epiCatalogA`@`org_a` (`epi`, categoria A, "Capacete CA-123") **com** `epi_stock`, `epi_risk` e
`epi_delivery_items` apontando para ele, e `epiCatalogB`@`org_b`. O gate `requireOfficeStaff` é
mockado (`asOwner("org_a")`), igual aos testes da 007.

- **CRUD feliz**: criar `epi` em `org_a` com categoria A → aparece no `list` (com `categoryName`);
  `get` por id devolve a linha; `update` muda CA/validade; `delete` de um item **sem** dependentes
  remove (`list.total` cai).
- **Homônimos (FR-017/SC-008)**: criar dois itens com mesmo tipo/nome em `org_a` → **ambos aceitos**;
  nenhuma resposta `DUPLICATE`.
- **Tipo×Categoria (FR-012/SC-004)**: criar item `machine` apontando para `categoryA` (que é `epi`)
  → `FK_NOT_FOUND`; criar item apontando para `categoryB` (de `org_b`) → `FK_NOT_FOUND`; `categoryId`
  inexistente → `FK_NOT_FOUND`.
- **Validação (SC-005)**: tipo fora de `epi|machine` → `VALIDATION`; nome vazio → `VALIDATION`;
  `categoryId` não-uuid → `VALIDATION`; `caValidUntil` malformada → `VALIDATION`; opcionais ausentes
  → aceitos.
- **Isolamento cross-tenant (FR-021/SC-003)**: `getEpiCatalogAction(epiCatalogB)` → `NOT_FOUND`;
  `update(epiCatalogB, …)` → `NOT_FOUND`; `delete(epiCatalogB)` → `NOT_FOUND`; `list` como `org_a`
  não traz `epiCatalogB`.
- **Exclusão bloqueada (FR-015/016/SC-007)**: `deleteEpiCatalogAction(epiCatalogA)` (tem
  stock+risk+delivery_item no seed) → resultado `{ ok:false, error:{ code:"IN_USE" } }` (≈409),
  **sem** exceção crua; o item **e** os dependentes continuam no banco (nada cascateado).
  `getEpiCatalogDependentsAction(epiCatalogA)` retorna contagens > 0. Cobrir também o backstop:
  remover stock+risk do seed deixando só `epi_delivery_items` → ainda `IN_USE` (via `RESTRICT`/
  `23503`), não `FK_NOT_FOUND`.
- **Autorização (FR-025/SC-009)**: gate rejeitando (`ForbiddenError`) → toda ação devolve `FORBIDDEN`.
- **Sem GUC/tenant**: leitura em nível de repositório/RLS sem tenant fixado → conjunto vazio, nunca
  todos os registros (coberto também pela suíte de isolamento de tabela da 008).

> Isolamento em nível de tabela já é coberto por
> `src/__tests__/integration/shared/db/epi-catalog-isolation.test.ts` (008); esta fatia adiciona a
> cobertura em nível de **Server Action**.

## Casos unitários obrigatórios (`src/__tests__/unit/domains/pgr/epi-catalog.test.ts`)

- `epiCatalogInputSchema`: aceita entrada mínima válida (type+categoryId+name); rejeita tipo fora do
  enum, nome vazio, `categoryId` não-uuid e `caValidUntil` malformada; normaliza opcionais vazios
  para `undefined`; aceita `caValidUntil` ISO válida.
- **Mapeamento `EntityInUseError` → contrato**: `toActionError(new EntityInUseError())` retorna
  `{ code: "IN_USE", message }` (status/semântica 409), garantindo que o erro vira `ActionResult` e
  nunca vaza como exceção crua (FR-016/023).

## Definição de pronto

`npm run lint` + `npm run typecheck` + `npm run test` + `npm run test:integration` verdes (incluindo
isolamento, coerência Tipo×Categoria e exclusão bloqueada em Postgres efêmero), e `npm run format`
aplicado aos arquivos tocados. Ver `spec.md` → "Definição de pronto — testes obrigatórios".
