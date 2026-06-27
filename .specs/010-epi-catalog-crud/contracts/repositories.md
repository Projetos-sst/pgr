# Contract — Repositório de Catálogo de EPI (010)

Arquivo: `src/shared/db/repositories/epi-catalog.ts` (**novo**). Padrão Repository: somente o
repositório toca o ORM; toda operação abre transação por `withOrg(orgId, tx => …)` (fixa o GUC
`app.current_org`) e filtra **explicitamente** por `eq(epiCatalog.orgId, orgId)` além da RLS (defesa
em profundidade). Escritas passam por `auditedTenantWrite(orgId, "pgr.epi_catalog.write_rejected",
…)`.

## Assinaturas

```text
type ListEpiCatalogParams = PageParams & { search?: string; type?: CategoryType }

listEpiCatalog(orgId, params?: ListEpiCatalogParams): Promise<Paginated<EpiCatalogListItem>>
  // innerJoin(categories, and(
  //   eq(epiCatalog.categoryId, categories.id),
  //   eq(categories.orgId, orgId),            // categoria do MESMO tenant (explícito, além da RLS) — D3
  //   eq(categories.type,  epiCatalog.type))) // coerência de tipo na junção (espelha a FK composta)
  // where: and(eq(epiCatalog.orgId, orgId), <busca>, <filtro tipo>)
  //   busca:  or(ilike(epiCatalog.name,%s%), ilike(epiCatalog.ca,%s%), ilike(categories.name,%s%)) quando search
  //   filtro: eq(epiCatalog.type, type) quando type
  // ordenação: epiCatalog.name asc ; paginação: resolvePageParams (pageSize default 20, max 100)
  // retorno: { rows: (EpiCatalog & { categoryName })[], total }  (total = count(*) com o mesmo join/where)

getEpiCatalogById(orgId, id): Promise<EpiCatalog | null>
  // where org_id = orgId and id = id ; limit 1 ; null quando ausente/cross-tenant

createEpiCatalog(orgId, input: EpiCatalogValues): Promise<EpiCatalog>
  // assertCategoryInTenant(tx, orgId, input.categoryId, input.type)  → ReferenceNotFoundError se inválida
  // insert { orgId, ...toEpiCatalogColumns(input) } returning *      (auditedTenantWrite)

updateEpiCatalog(orgId, id, input: EpiCatalogValues): Promise<EpiCatalog | null>
  // assertCategoryInTenant(tx, orgId, input.categoryId, input.type)
  // update set { ...toEpiCatalogColumns(input), updatedAt: new Date() } where org_id and id returning *
  // null quando ausente/cross-tenant                                  (auditedTenantWrite)

deleteEpiCatalog(orgId, id): Promise<boolean>
  // auditedTenantWrite + withOrg(orgId, async tx => {            // TUDO numa única transação — D2
  //   const [locked] = tx.select({id}).from(epiCatalog)
  //       .where(and(eq(orgId), eq(id))).for("update").limit(1)  // FOR UPDATE: trava a linha do tenant
  //   if (!locked) return false                                  // ausente/cross-tenant → NOT_FOUND na action
  //   const dep = <count stock+risk+deliveryItems WHERE catalog_id=id AND org_id=orgId, no mesmo tx>
  //   if (dep.stock + dep.risk + dep.deliveryItems > 0) throw new EntityInUseError()  // IN_USE; nada é removido
  //   const rows = tx.delete(epiCatalog).where(and(eq(orgId), eq(id))).returning({id})
  //   return rows.length > 0
  // })  // catch SQLSTATE 23503 (epi_delivery_items RESTRICT) → throw EntityInUseError  (backstop, local ao delete)

countEpiCatalogDependents(orgId, id): Promise<{ stock: number; risk: number; deliveryItems: number }>
  // 3× count(*)::int em epi_stock / epi_risk / epi_delivery_items (catalog_id = id, org_id = orgId), sob withOrg
  // leitura informativa p/ a UI — SEM lock (o lock pertence só ao deleteEpiCatalog)

assertCategoryInTenant(tx, orgId, categoryId, type): Promise<void>   // privada
  // select categories where org_id=orgId and id=categoryId and type=type limit 1 ; ReferenceNotFoundError("category") se ausente
```

## Regras

- **Isolamento (FR-020/021)**: `withOrg` + filtro por `org_id`. Linha de outro escritório não é
  visível (RLS) ⇒ `getById`/`update` retornam `null` e `delete` retorna `false` — a Server Action
  converte em `NOT_FOUND`. Escrita marcada para outro tenant é rejeitada pela RLS (`WITH CHECK`).
- **Categoria no tenant + tipo (FR-012, Research D1)**: `assertCategoryInTenant` sob `withOrg`
  cobre categoria inexistente, de outro tenant e de tipo divergente → `ReferenceNotFoundError`
  (`FK_NOT_FOUND`). A FK composta `(category_id, type)` é o **backstop** de banco (ela ignora RLS,
  por isso o assert é necessário, não opcional).
- **Join escopado por tenant (FR-020/021, Research D3)**: `listEpiCatalog` filtra `categories.org_id
  = orgId` **e** `categories.type = epi_catalog.type` na própria condição do join, além de
  `epi_catalog.org_id = orgId` no `where` — defesa em profundidade mesmo com `withOrg`/RLS. A
  junção nunca casa (nem expõe na busca) categoria de outro tenant ou de tipo divergente.
- **Exclusão defensiva sem corrida (FR-015/016, Research D2)**: o `delete` roda numa **única
  transação `withOrg`**; trava a linha do catálogo com `SELECT … FOR UPDATE`, **depois** conta
  dependentes e, se houver qualquer um, lança `EntityInUseError` (`IN_USE`, 409) **antes** de
  remover — impedindo cascata de `epi_stock`/`epi_risk`. O `RESTRICT` de `epi_delivery_items` é
  backstop; o `delete` captura `23503` e o reconverte em `EntityInUseError` (captura **local ao
  delete** — create/update mantêm `23503 → FK_NOT_FOUND`). O lock + transação única fecham a janela
  de corrida entre contar e deletar.
- **Sem unicidade (FR-017, Research D6)**: o repositório **não** pré-checa nem trata `23505` para
  `epi_catalog` (não há UNIQUE). Homônimos são inseridos normalmente.
- **Tipagem**: `EpiCatalogValues = z.output<typeof epiCatalogInputSchema>`; `EpiCatalog =
  InferSelectModel` do schema (008); `EpiCatalogListItem = EpiCatalog & { categoryName: string }`.
  Sem `any` (Princípio V).
- **Auditoria de escrita (FR-024)**: `auditedTenantWrite` envolve create/update/delete (sem PII);
  `list`/`getById`/`countDependents` não auditam.
