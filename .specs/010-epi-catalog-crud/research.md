# Research — CRUD de Catálogo de EPI / Equipamentos (010)

Fase 0. Não há `NEEDS CLARIFICATION` pendentes (Q1/Q2 resolvidos pelo Tech Lead no
`/speckit-clarify`, Session 2026-06-27). As decisões abaixo registram **como** reusar a
infraestrutura existente e **resolver os riscos técnicos** específicos desta fatia.

## D1 — Isolamento da referência de categoria: a FK composta NÃO basta

**Decision**: `create`/`update` fazem um **assert explícito** `assertCategoryInTenant(tx, orgId,
categoryId, type)` sob `withOrg` **antes** de inserir/atualizar, selecionando a categoria por
`(org_id, id, type)`; se não houver linha, lançam `ReferenceNotFoundError` (`FK_NOT_FOUND`). A FK
composta `(category_id, type) → categories(id, type)` permanece como **backstop de banco**.

**Rationale**: a verificação de Foreign Key no Postgres roda com privilégio de sistema e **ignora as
políticas RLS** da tabela referenciada. Logo, um `category_id` pertencente a **outro** escritório,
mas com o mesmo `type`, **satisfaria** a FK composta — vazando uma referência cross-tenant sem o
assert. O assert sob `withOrg` (com o GUC `app.current_org` fixado) só enxerga categorias do tenant
ativo, cobrindo de uma vez os três casos: categoria inexistente, de outro tenant e de tipo
divergente → todos viram `FK_NOT_FOUND` (referência inválida, FR-012/SC-004).

**Alternatives considered**: (a) confiar só na FK composta — **rejeitado** (vaza cross-tenant, viola
Princípio I); (b) join/subselect na própria instrução de insert — mais obscuro e sem ganho sobre o
assert explícito, que é o padrão já usado em `assertCompanyInTenant` (work-units, 007).

**Precedente**: `src/shared/db/repositories/work-units.ts` → `assertCompanyInTenant`.

## D2 — Exclusão defensiva por dependentes (decisão Q2 / Opção B), sem corrida

**Decision**: `deleteEpiCatalog` roda **tudo numa única transação `withOrg`** e usa um **lock de
linha** para eliminar a corrida entre "contar dependentes" e "deletar". A sequência **dentro da
mesma transação**:

1. **Carregar e travar** a linha do catálogo do tenant: `SELECT id FROM epi_catalog WHERE org_id =
orgId AND id = id FOR UPDATE`. Se não houver linha (inexistente/cross-tenant) → retorna `false`
   (a action converte em `NOT_FOUND`); nada mais roda.
2. **Contar dependentes depois do lock**: `epi_stock`, `epi_risk`, `epi_delivery_items` que
   referenciam o item (todos escopados por `org_id = orgId`).
3. Se a soma > 0 → lançar `EntityInUseError` (`IN_USE`, 409); a transação é abortada e **nada** é
   removido — em particular `epi_stock`/`epi_risk` (FKs `CASCADE`) **não** são cascateados.
4. Só se a contagem for **zero** → `DELETE … RETURNING { id }` (na mesma transação).
5. **Backstop**: envolver o passo 4 (e a transação) em `try/catch` que captura SQLSTATE `23503`
   (`epi_delivery_items` `RESTRICT`) e o **reconverte em `EntityInUseError`**.

**Por que o lock elimina a corrida**: o `FOR UPDATE` no item, somado à transação única, garante que
a contagem e o `DELETE` enxergam um estado consistente. Como inserir um dependente (`epi_stock`/
`epi_risk`/`epi_delivery_items`) requer a existência do `catalog_id`, uma inserção concorrente de
dependente fica serializada em relação a este delete; o passo 5 cobre o caso-limite remanescente
(commit de dependente imediatamente antes), garantindo `IN_USE` em vez de `FK_NOT_FOUND`.

**Escopo da captura `23503`**: **local ao `delete`** — `create`/`update` continuam mapeando `23503`
para `FK_NOT_FOUND` (referência de categoria inválida). Um remapeamento global quebraria esse
significado.

**Rationale**: dados de SST têm peso legal (Princípio V); cascatear estoque/risco silenciosamente é
inaceitável, e uma janela de corrida poderia fazer exatamente isso. Transação única + lock + backstop
fecham a janela. A pré-checagem no app é a barreira primária (mensagem clara); o `RESTRICT` cobre o
resto.

**Alternatives considered**: (a) seguir o `ON DELETE` do banco (cascata de estoque/risco) — recusado
pelo Tech Lead (Q2); (b) contar **fora** da transação do delete (duas transações `withOrg`) —
**rejeitado**: reabre a corrida que o Tech Lead pediu para fechar; (c) remapear `23503` globalmente
para `IN_USE` — **rejeitado** (quebraria `FK_NOT_FOUND` em create/update). Daí a captura ser local ao
delete.

**Novo erro**: `src/shared/errors/entity-in-use-error.ts` — `class EntityInUseError extends AppError`
com `code = "IN_USE"`, `status = 409`. Flui pelo `toActionError` existente (ramo genérico de
`AppError`) **sem** alterar `action-error.ts` ⇒ a Server Action devolve
`ActionResult` com `error.code = "IN_USE"` (semântica ≈ 409), sem vazar exceção crua (asserção
obrigatória de teste — ver contracts/quickstart).

**Nota sobre `countEpiCatalogDependents` (UI)**: a função pública usada pela
`getEpiCatalogDependentsAction` (para a UI exibir o motivo) **não** trava linha — é uma leitura
informativa. O lock pertence **exclusivamente** ao caminho de `deleteEpiCatalog`, onde a corrida
importa.

## D3 — Busca textual incluindo nome da categoria → join na listagem (escopado por tenant)

**Decision**: `listEpiCatalog` faz `innerJoin(categories, …)` e seleciona também
`categories.name as categoryName`. **A condição do join é escopada por tenant em ambos os lados, por
defesa em profundidade** (não basta o `withOrg`/RLS):

```text
innerJoin(categories, and(
  eq(epiCatalog.categoryId, categories.id),
  eq(categories.orgId, orgId),          // categoria do MESMO tenant (explícito, além da RLS)
  eq(categories.type,  epiCatalog.type) // coerência de tipo na junção (espelha a FK composta)
))
where and(
  eq(epiCatalog.orgId, orgId),          // item do tenant ativo (explícito, além da RLS)
  … (busca/filtro) …
)
```

A busca textual aplica `or(ilike(epiCatalog.name,%s%), ilike(epiCatalog.ca,%s%),
ilike(categories.name,%s%))`; o filtro por tipo é `eq(epiCatalog.type, type)` (separado da busca). O
DTO de linha (`EpiCatalogListItem`) carrega `categoryName` para a coluna "Categoria" (FR-002/004).

**Rationale**: a coluna "Categoria" e a "busca por categoria" exigem o nome (não o `uuid`); o join
resolve numa só query. **Escopar `categories.org_id = orgId` e `categories.type = epi_catalog.type`
no próprio join** é defesa em profundidade: mesmo que uma falha de configuração desabilite a RLS de
`categories`, a junção não pode trazer (nem casar a busca com) uma categoria de outro tenant ou de
tipo divergente. `innerJoin` é correto porque `category_id` é `NOT NULL` e a FK garante a existência.

**Alternatives considered**: (a) join só por `category_id`, confiando apenas em `withOrg`/RLS —
**rejeitado** (sem defesa em profundidade; o princípio do projeto é filtrar explicitamente por
`org_id` **além** da RLS); (b) buscar categorias num segundo passo e mapear em memória — mais
queries, sem ganho; rejeitado.

## D4 — Select de Categoria dependente do Tipo → reuso de `listCategoriesAction`

**Decision**: o formulário é **controlado** para `type` e `categoryId` (o `_ui/SelectField` já
suporta modo controlado). Ao montar e a cada troca de `type`, o Client Component chama
`listCategoriesAction({ type, pageSize: PAGE_SIZE_MAX })` (009) e popula o select de categoria;
trocar o tipo limpa o `categoryId` selecionado. Nenhuma nova action/endpoint de categorias é criada.

**Rationale**: a action de listagem de categorias da 009 já é org-scoped, filtra por `type` e é
paginada; `PAGE_SIZE_MAX = 100` cobre um catálogo de categorias de escritório com folga. Reuso puro
(Princípio II); o backend (D1) é a guarda final caso a UI falhe.

**Alternatives considered**: (a) nova action "listar todas as categorias por tipo" — desnecessária
(YAGNI); (b) carregar todas as categorias e filtrar no cliente — vaza tipos no payload e não escala;
rejeitado. **Limite conhecido**: se um tenant tiver >100 categorias de um mesmo tipo, o select
trunca — registrado como melhoria futura (typeahead via `search`), fora do escopo desta fatia.

## D5 — Validação dos campos opcionais e da data do CA

**Decision**: `epiCatalogInputSchema` (zod) valida: `type` (`categoryTypeSchema`), `categoryId`
(`z.string().uuid()` obrigatório), `name` (`requiredString`); e opcionais `ca`, `manufacturer`,
`norm`, `size`, `unitOfMeasure`, `description`, `photoPath` via `optionalString` (trim → `undefined`
quando vazio) e `caValidUntil` via um helper de **data ISO opcional** (`optionalIsoDate`: aceita
vazio→`undefined` ou string `YYYY-MM-DD` válida; data malformada → `VALIDATION`). O repositório
normaliza `undefined → null` nas colunas nullable.

**Rationale**: reusa os helpers de `form-fields.ts` (006/007). A coluna `ca_valid_until` é `date`;
manter a entrada como string ISO `YYYY-MM-DD` (Drizzle `date` mode string) é consistente com o
restante do projeto (datas ISO no armazenamento, `toLocaleDateString('pt-BR')` na exibição).

**Alternatives considered**: aceitar `Date` nativo — atrita com o `FormData` (strings) e com o modo
`date` string do Drizzle; rejeitado.

## D6 — Sem unicidade (decisão Q1 / Opção A)

**Decision**: nenhuma constraint, índice ou pré-checagem de unicidade; o repositório **não** trata
`23505` para `epi_catalog` (não há UNIQUE que o dispare). Itens homônimos no mesmo escritório são
inseridos normalmente (FR-017/SC-008).

**Rationale**: o modelo 008 não define UNIQUE e a fatia é "sem migration nova"; impor unicidade na
aplicação seria garantia ilusória (corrida) e contraria a decisão do Tech Lead.

**Alternatives considered**: pré-checagem `(org,type,name)` na app — rejeitada (Q1).

## D7 — Auditoria e gate (reuso 006/007)

**Decision**: escritas (`create`/`update`/`delete`) passam por `auditedTenantWrite(orgId,
"pgr.epi_catalog.write_rejected", …)` no repositório e por `officeAction(op, fn, { audit: true })`
na action (evento de fronteira sem PII). `list`/`get`/`dependents` **não** auditam. Gate
`requireOfficeStaff()` (via `officeAction`) ⇒ papel `client` → `FORBIDDEN` (FR-024/025).

**Rationale**: reuso idêntico ao das 5 entidades da 007 e da 009. Sem PII (apenas operação, outcome,
orgId, userId).

## Resumo das decisões

| #   | Decisão                                                                           | Arquivo-chave                                                  |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| D1  | Assert de categoria no tenant + tipo (FK composta é só backstop)                  | `repositories/epi-catalog.ts`                                  |
| D2  | Exclusão bloqueia se houver qualquer dependente; `23503`→`IN_USE` local ao delete | `repositories/epi-catalog.ts`, `errors/entity-in-use-error.ts` |
| D3  | Join com `categories` para nome/busca/coluna                                      | `repositories/epi-catalog.ts`                                  |
| D4  | Select de categoria reusa `listCategoriesAction({type})`                          | `_components/epi-catalog-form.tsx`                             |
| D5  | zod para obrigatórios + data ISO opcional + opcionais                             | `domains/pgr/epi-catalog.ts`                                   |
| D6  | Sem unicidade; sem `DUPLICATE`                                                    | `domains`/`repositories`                                       |
| D7  | Auditoria só na escrita; gate office-staff                                        | `actions/pgr/epi-catalog.ts`                                   |
