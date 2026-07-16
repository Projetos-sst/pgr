# Briefing US1 — CRUD de Catálogo de Treinamentos

> Issue **#29**. Depende da Fundação (#28). **Zero migration.** Padrão: cópia estrutural do CRUD de
> `companies`. Ver decisões D3 (enum) no [brainstorming](./fase04-treinamentos-brainstorming.md).

## Escopo

CRUD completo do `training_catalog` (list paginada + busca, getById, create, update, delete) numa
única fatia — a base que registros (#30) e vínculos obrigatórios (#80) referenciam.

## Camadas (sem Drizzle nas actions)

```
app/(protected)/training-catalog/**        (páginas + _components, molde _ui/{list,form})
  → actions/pgr/training-catalog.ts        (officeAction → ActionResult<T>)
    → domains/pgr/trainings.ts             (trainingCatalogInputSchema — zod; reusa periodicityEnum)
      → repositories/training-catalog.ts   (todo query em withOrg; {rows,total} via pagination.ts)
        → schema/trainings.ts              (#28)
```

## Operações (todas org-scopadas; RLS = backstop)

| Operação      | Assinatura                                              | Comportamento                                                                                                   |
| ------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Listar**    | `listTrainingCatalog(filters, {page,pageSize,orderBy})` | Paginada/ordenada do tenant; busca `ILIKE` em `name`/`reference_norm`; sem tenant → vazio.                      |
| **Detalhar**  | `getTrainingCatalogById(id)`                            | 1 registro do tenant; inexistente/cross-tenant → **404**. Reusado por edição, #30 e #80.                        |
| **Criar**     | `createTrainingCatalog(input)`                          | zod → insere com `org_id` da sessão; `UNIQUE(org_id,name)` → **409**; audita.                                   |
| **Atualizar** | `updateTrainingCatalog(id, patch)`                      | zod parcial → atualiza só no tenant; **404** cross-tenant; `updated_at` por trigger; audita.                    |
| **Excluir**   | `deleteTrainingCatalog(id)`                             | Remove no tenant; **RESTRICT** avisa via `dependents` se houver realizações/vínculos; 404 cross-tenant; audita. |

## Superfície de API (os 4 juntos)

- **Server Action** (`officeAction`) — entrada da UI.
- **REST mirror** `app/api/v1/training-catalog/**`: `GET`/`POST` na coleção; `GET`/`PUT`/`DELETE` em
  `[id]`; **`GET [id]/dependents`** (tem FKs de entrada). Reusa o MESMO repo + zod + `toActionError`.
  `201` no create, `204` no delete.
- **Docs** em `docs/api/api-design.md` (tabelas Recursos + Sumário).
- **Postman** em `sst-manager.postman_collection.json` (1 pasta `training-catalog`).

## Regras verificáveis

- Campos ePGR: Nome (obrigatório) · Norma Ref. (opcional) · Carga Horária (inteiro > 0) · Periodicidade
  (select com as 5 opções) · Descrição (opcional).
- `workload_hours` só inteiro positivo; `periodicity` dentro do enum → senão `VALIDATION`/422.
- Nome duplicado no mesmo escritório → `DUPLICATE`/409.
- getById/update/delete de outro escritório → `NOT_FOUND`/404 (nunca vaza).
- Excluir item em uso → aviso/bloqueio previsível (`dependents`), nunca deixa órfão.
- Busca por nome/norma funciona; estado vazio orienta o 1º cadastro.

## YAGNI

- **Sem tela "detalhe só-leitura"** — o form de edição é o detalhe (mesma decisão da fatia 009).
- Busca é `ILIKE`, não full-text.

## Testes

- **Unit**: `trainingCatalogInputSchema` (obrigatórios, carga horária > 0, periodicidade no enum).
- **Integração (Postgres efêmero)**: as 5 operações; **404 cross-tenant** em getById/update/delete;
  **409** nome duplicado no mesmo org; isolamento (catálogo de outro escritório nunca aparece nem é
  editável); `dependents` bloqueia exclusão em uso; `FORBIDDEN` para `client`.

## Referência

`src/shared/server/actions/pgr/companies.ts` + `src/app/api/v1/companies/**` (copiar 1:1) ·
`.specs/009-category-crud/` (CRUD análogo sobre catálogo sem FK de entrada).
