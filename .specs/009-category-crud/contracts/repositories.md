# Contract — Repositório de Categorias (008)

Arquivo: `src/shared/db/repositories/categories.ts` (**estender**; hoje só `listCategories`/
`createCategory`). Padrão Repository: somente o repositório toca o ORM; toda operação abre
transação por `withOrg(orgId, tx => …)` (fixa o GUC `app.current_org`) e filtra **explicitamente**
por `eq(categories.orgId, orgId)` além da RLS (defesa em profundidade). Escritas passam por
`auditedTenantWrite(orgId, "pgr.categories.write_rejected", …)`.

## Assinaturas

```text
type ListCategoriesParams = PageParams & { search?: string; type?: CategoryType }

listCategories(orgId: string, params?: ListCategoriesParams): Promise<Paginated<Category>>
  // filtros: ilike(name, %search%) quando search; eq(type) quando type
  // paginação: resolvePageParams(params) → limit/offset (pageSize default 20, max 100)
  // retorno: { rows: Category[], total: number }   (total = count(*) com os mesmos filtros)

getCategoryById(orgId: string, id: string): Promise<Category | null>
  // where org_id = orgId and id = id ; limit 1 ; null quando ausente/cross-tenant

createCategory(orgId: string, input: CategoryValues): Promise<Category>
  // insert { orgId, type, name, note } returning *  (auditedTenantWrite)
  // REFATORAÇÃO: deixa de aceitar { type: string } e de fazer parse interno — recebe valores já validados

updateCategory(orgId: string, id: string, input: CategoryValues): Promise<Category | null>
  // update set { type, name, note, updatedAt: new Date() } where org_id and id returning *
  // null quando ausente/cross-tenant  (auditedTenantWrite)

deleteCategory(orgId: string, id: string): Promise<boolean>
  // delete where org_id and id returning { id } ; true se removeu, false se ausente/cross-tenant
  // (auditedTenantWrite)
```

## Regras

- **Isolamento (FR-020/021)**: `withOrg` + filtro por `org_id`. Uma linha de outro escritório não
  é visível (RLS) ⇒ `getById`/`update` retornam `null` e `delete` retorna `false` — a Server
  Action converte em `NOT_FOUND`. Escrita marcada para outro tenant é rejeitada pela RLS
  (`WITH CHECK`).
- **Sem tenant fixado**: o repositório nunca devolve todos os registros — sem GUC válido a RLS
  resolve para conjunto vazio; o caminho normal de chamada (Server Action) já barra antes via
  `requireOfficeStaff()`. (Inv-2 / spec FR-021)
- **Unicidade (FR-013)**: imposta pela constraint `uq_categories_org_type_name`; uma violação
  emerge como SQLSTATE `23505`, mapeada para `DUPLICATE` na camada de ação. O repositório **não**
  pré-checa (evita corrida; a constraint é a fonte de verdade).
- **Tipagem**: `CategoryValues` é `z.output<typeof categoryInputSchema>` (domínio); `Category` é o
  `InferSelectModel` do schema (006). Sem `any` (Princípio V).
- **Auditoria de escrita (FR-024)**: `auditedTenantWrite` envolve create/update/delete (sem PII);
  leituras não auditam.
