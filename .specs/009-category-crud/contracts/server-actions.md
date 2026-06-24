# Contract — Server Actions de Categorias (008)

Arquivo: `src/shared/server/actions/pgr/categories.ts`. Todas retornam
`Promise<ActionResult<T>>` (contrato `src/shared/server/result.ts`, herdado da 007) e são
embrulhadas por `officeAction(operation, fn, { audit? })`, que aplica o gate
`requireOfficeStaff()` (FR-025), o mapeamento de erro (`toActionError`) e a auditoria sem PII só
na escrita (FR-024). Nenhuma vaza exceção crua para a UI (FR-023).

## Forma do resultado (herdada da 007)

```text
ActionResult<T> = { ok: true; data: T }
                | { ok: false; error: { code: string; message: string; fields?: Record<string,string> } }
```

Códigos relevantes a esta fatia:

| `error.code` | Quando                                                   | Origem                                     | ≈HTTP |
| ------------ | -------------------------------------------------------- | ------------------------------------------ | ----- |
| `VALIDATION` | tipo fora de `epi \| machine`, nome vazio                | `ZodError` → `toActionError`               | 400   |
| `DUPLICATE`  | nome+tipo já existe no escritório                        | PG `23505` (`uq_categories_org_type_name`) | 409   |
| `NOT_FOUND`  | id inexistente **ou** de outro escritório (cross-tenant) | `NotFoundError` lançado na action          | 404   |
| `FORBIDDEN`  | papel `client` (ou sem tenant)                           | `requireOfficeStaff()` → `ForbiddenError`  | 403   |

## Operações

| Server Action          | Entrada                                | `data` no sucesso             | `operation` / audit                 | FRs                |
| ---------------------- | -------------------------------------- | ----------------------------- | ----------------------------------- | ------------------ |
| `listCategoriesAction` | `{ search?; type?; page?; pageSize? }` | `Paginated<CategoryListItem>` | `pgr.categories.list` — sem audit   | FR-001/002/003     |
| `getCategoryAction`    | `id: string`                           | `Category`                    | `pgr.categories.get` — sem audit    | FR-001/021         |
| `createCategoryAction` | `CategoryInput`                        | `Category`                    | `pgr.categories.create` — **audit** | FR-001/004/010-013 |
| `updateCategoryAction` | `(id: string, CategoryInput)`          | `Category`                    | `pgr.categories.update` — **audit** | FR-001/004/013     |
| `deleteCategoryAction` | `id: string`                           | `{ id: string }`              | `pgr.categories.delete` — **audit** | FR-001/005         |

### Comportamento por operação

- **list**: `officeAction("pgr.categories.list", ({tenantId}) => repo.listCategories(tenantId, params))`.
  Filtros (`search`/`type`) e paginação aplicados no repositório, **antes** do corte de página
  (FR-002/003). Sem tenant/sem papel → `officeAction` devolve `{ ok:false, error:{code:"FORBIDDEN"|"NO_TENANT_CONTEXT"} }` — **não** lista vazia silenciosa (a página protegida também barra no guard).
- **get**: carrega por id (para edição — FR-001). Se `repo.getCategoryById` devolver `null`
  (inexistente ou cross-tenant), a action lança `NotFoundError` ⇒ `{ code: "NOT_FOUND" }` (FR-021).
- **create**: `categoryInputSchema.parse(input)` **antes** do banco (FR-022); `revalidatePath("/categories")`.
  Duplicidade → `DUPLICATE` (constraint). `{ audit: true }`.
- **update**: idem create; `repo.updateCategory` devolve `null` (inexistente/cross-tenant) ⇒
  `NotFoundError`/`NOT_FOUND`. `revalidatePath("/categories")` e `/categories/${id}/edit`.
- **delete**: `repo.deleteCategory` devolve `false` (inexistente/cross-tenant) ⇒
  `NotFoundError`/`NOT_FOUND`. `revalidatePath("/categories")`. **Sem** aviso de dependentes (FR-005).

## Invariantes de contrato

- O `tenantId` **sempre** vem de `officeAction` → `requireOfficeStaff()` (sessão); a Server Action
  **nunca** aceita `orgId`/tenant como argumento do cliente. (FR-020)
- Erros são expressos como **códigos do contrato** (`DUPLICATE`/`NOT_FOUND`/`VALIDATION`/`FORBIDDEN`),
  não como status HTTP cru. (FR-023)
- Auditoria só em create/update/delete, sem PII; list/get não auditam. (FR-024)
