# Contract — Server Actions de Catálogo de EPI (010)

Arquivo: `src/shared/server/actions/pgr/epi-catalog.ts`. Todas retornam
`Promise<ActionResult<T>>` (contrato `src/shared/server/result.ts`, herdado da 007) e são
embrulhadas por `officeAction(operation, fn, { audit? })`, que aplica o gate `requireOfficeStaff()`
(FR-025), o mapeamento de erro (`toActionError`) e a auditoria sem PII só na escrita (FR-024).
Nenhuma vaza exceção crua para a UI (FR-023).

## Forma do resultado (herdada da 007)

```text
ActionResult<T> = { ok: true; data: T }
                | { ok: false; error: { code: string; message: string; fields?: Record<string,string> } }
```

Códigos relevantes a esta fatia:

| `error.code` | Quando | Origem | ≈HTTP |
| --- | --- | --- | --- |
| `VALIDATION` | tipo fora de `epi \| machine`, nome vazio, `categoryId` não-uuid, data inválida | `ZodError` → `toActionError` | 422 |
| `FK_NOT_FOUND` | `categoryId` inexistente / de outro escritório / de tipo divergente | `ReferenceNotFoundError` (assert, D1); backstop FK composta `23503` em create/update | 422 |
| `NOT_FOUND` | id inexistente **ou** de outro escritório (cross-tenant) em get/update/delete | `NotFoundError` lançado na action | 404 |
| `IN_USE` | exclusão de item com **qualquer** dependente (`epi_stock`/`epi_risk`/`epi_delivery_items`) | `EntityInUseError` (pré-checagem, D2); backstop `23503` no delete | 409 |
| `FORBIDDEN` | papel `client` (ou sem tenant → `NO_TENANT_CONTEXT`) | `requireOfficeStaff()` → `ForbiddenError` | 403 |

> **Sem `DUPLICATE`**: esta fatia não impõe unicidade (FR-017); nenhum cenário de `epi_catalog`
> produz `23505`.

## Operações

| Server Action | Entrada | `data` no sucesso | `operation` / audit | FRs |
| --- | --- | --- | --- | --- |
| `listEpiCatalogAction` | `{ search?; type?; page?; pageSize? }` | `Paginated<EpiCatalogListItem>` | `pgr.epi_catalog.list` — sem audit | FR-001/002/003/004 |
| `getEpiCatalogAction` | `id: string` | `EpiCatalog` | `pgr.epi_catalog.get` — sem audit | FR-001/021 |
| `createEpiCatalogAction` | `EpiCatalogInput` | `EpiCatalog` | `pgr.epi_catalog.create` — **audit** | FR-001/005/010-014 |
| `updateEpiCatalogAction` | `(id: string, EpiCatalogInput)` | `EpiCatalog` | `pgr.epi_catalog.update` — **audit** | FR-001/005/012/013 |
| `deleteEpiCatalogAction` | `id: string` | `{ id: string }` | `pgr.epi_catalog.delete` — **audit** | FR-001/007/015/016 |
| `getEpiCatalogDependentsAction` | `id: string` | `{ stock; risk; deliveryItems }` | `pgr.epi_catalog.dependents` — sem audit | FR-015 (UI) |

### Comportamento por operação

- **list**: `officeAction("pgr.epi_catalog.list", ({tenantId}) => repo.listEpiCatalog(tenantId,
  params))`. Filtros (`search`/`type`) e paginação no repositório, **antes** do corte de página
  (FR-002/003). Sem tenant/sem papel → `{ ok:false, error:{code:"FORBIDDEN"|"NO_TENANT_CONTEXT"} }`
  — **não** lista vazia silenciosa.
- **get**: carrega por id (para edição — FR-001). `repo.getEpiCatalogById` `null`
  (inexistente/cross-tenant) ⇒ a action lança `NotFoundError` ⇒ `NOT_FOUND` (FR-021).
- **create**: `epiCatalogInputSchema.parse(input)` **antes** do banco (FR-022). Categoria
  inválida/incoerente/cross-tenant → `FK_NOT_FOUND` (assert, D1). `revalidatePath("/epi-catalog")`.
  `{ audit: true }`. **Sem** `DUPLICATE` (homônimos aceitos).
- **update**: idem create; `repo.updateEpiCatalog` `null` (inexistente/cross-tenant) ⇒
  `NotFoundError`/`NOT_FOUND`. `revalidatePath("/epi-catalog")` e `/epi-catalog/${id}/edit`.
- **delete**: `repo.deleteEpiCatalog` (transação única com `FOR UPDATE` + contagem + delete — D2).
  Se houver dependente conhecido → `EntityInUseError` ⇒ `ActionResult{ ok:false, error.code:"IN_USE"
  }` (≈409), **nada removido** (nem cascateado). `false` (inexistente/cross-tenant) ⇒
  `NotFoundError`/`NOT_FOUND`. `revalidatePath("/epi-catalog")`. **Asserção de teste obrigatória**:
  excluir item com dependente devolve `{ ok:false, error:{ code:"IN_USE" } }` — exceção crua nunca
  vaza para a UI.
- **dependents**: lê contagens (sem audit) para a UI exibir o motivo do bloqueio antes/depois da
  confirmação. Org-scoped; cross-tenant retorna zeros (a linha não é visível).

## Invariantes de contrato

- O `tenantId` **sempre** vem de `officeAction` → `requireOfficeStaff()` (sessão); a Server Action
  **nunca** aceita `orgId`/tenant como argumento do cliente. (FR-020)
- Erros são expressos como **códigos do contrato** (`VALIDATION`/`FK_NOT_FOUND`/`NOT_FOUND`/`IN_USE`/
  `FORBIDDEN`), não como status HTTP cru. (FR-023)
- Auditoria só em create/update/delete, sem PII; list/get/dependents não auditam. (FR-024)
- Nenhum `DUPLICATE` para `epi_catalog` (FR-017).
- **`IN_USE` é contrato, não exceção**: `EntityInUseError` (status 409) é mapeado por `toActionError`
  (ramo genérico `AppError`) para `ActionResult{ ok:false, error:{ code:"IN_USE", message } }`. A UI
  recebe o código/mensagem; **nenhuma** exceção crua atravessa o `officeAction`. (FR-016/023)
