# Quickstart — Validação do vínculo EPI × risco

Guia de validação ponta a ponta. Detalhes de schema/contratos em [data-model.md](./data-model.md) e
[contracts/api-and-repositories.md](./contracts/api-and-repositories.md).

## Pré-requisitos

- Migration `0013_epi_risk_link` aplicada (ver [data-model.md](./data-model.md) §Migration).
- Para integração: `INTEGRATION_DATABASE_URL` + `INTEGRATION_APP_RUNTIME_URL` → **Postgres efêmero**
  (nunca SQLite, nunca o banco de dev). Sem as envs, as suítes de integração fazem self-skip.

## 1. Gates de qualidade (offline)

```bash
npm run check          # format:check + lint + typecheck + unit  → esperado: verde
npm run db:generate    # esperado: "No schema changes" (schema ⇄ snapshot consistentes)
npm run build          # esperado: compila /api/v1/risks/[id]/epis e .../[linkId]
```

## 2. Testes automatizados

```bash
npm run test              # unit — schemas/rótulos/obrigatoriedade de neutralização
npm run test:integration  # integração (requer INTEGRATION_*) — CRUD + isolamento
```

Cobertura de integração esperada: list, available+busca, add, `DUPLICATE` (par repetido),
`FK_NOT_FOUND` (risco/EPI cross-tenant), update, remove + reaparecer em disponíveis,
**isolamento cross-tenant** (vínculo de org_b inacessível por org_a), `NOT_FOUND`, `FORBIDDEN` (client).

## 3. Validação manual via REST (bypass DEV) — mapa de aceite

Com `DEV_API_AUTH_BYPASS=true` e headers `x-dev-tenant`/`x-dev-role`/`x-dev-user` (ou a coleção
Postman "EPI x risco (vinculo)"), contra um risco `{riskId}` e um EPI `{epiCatalogId}` do tenant:

- [ ] `POST /api/v1/risks/{riskId}/epis` com `{ catalogId, neutralization: "neutralizes" }` → **201**.
- [ ] `GET /api/v1/risks/{riskId}/epis` → lista com o EPI (Nome · CA · neutralização).
- [ ] `POST` do **mesmo par** de novo → **409 DUPLICATE**.
- [ ] `POST` sem `neutralization` → **422 VALIDATION**.
- [ ] `GET /api/v1/risks/{riskId}/epis?available=true&search=luva` → só EPIs `epi` não vinculados que casam "luva".
- [ ] `PUT /api/v1/risks/{riskId}/epis/{linkId}` com `{ neutralization: "not_applicable" }` → **200**.
- [ ] `DELETE /api/v1/risks/{riskId}/epis/{linkId}` → **204**; o EPI reaparece em `?available=true`.
- [ ] Repetir `POST` com um `catalogId`/`riskId` de **outra org** → **422 FK_NOT_FOUND** (isolamento).

## 4. Validação manual via UI

- [ ] Abrir a **edição** de um risco → a seção "EPIs vinculados ao risco" aparece após o formulário.
- [ ] Abrir a **criação** de um risco → a seção **não** aparece (sem `risk_id` ainda).
- [ ] Adicionar um EPI (busca por nome/CA) com neutralização → aparece na tabela; some dos disponíveis.
- [ ] Trocar a neutralização por linha e remover → recarrega refletindo a mudança.
