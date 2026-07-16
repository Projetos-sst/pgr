# Contracts — REST Endpoints (Fase 06)

Padrão real (`app/api/v1/companies/**`): cada handler é `restHandler(req, async ({ tenantId }) => …, { status? })`; `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Reusa o **mesmo** repositório + schema Zod + `toActionError` das Actions (nunca re-implementa a regra). Verbos reais: `GET` (list) + `POST` (create) em `/<recurso>`; `GET`/`PUT`/`DELETE` em `/<recurso>/[id]`; `201` no create, `204` no delete. Códigos de erro do mapa `HTTP_BY_CODE` (nenhum novo). Autenticação: `restHandler` (sessão Clerk ou bypass DEV não-prod).

Toda rota aqui DEVE entrar em `docs/api/api-design.md` (tabelas Recursos/Sumário) **e** em `docs/api/sst-manager.postman_collection.json` (uma pasta por recurso, reusando `baseUrl`/`devTenant`/`devRole`/ids) — FR-044/FR-045.

---

## `service-orders`

```txt
GET    /api/v1/service-orders                 → 200 Paginated<ServiceOrderListItem>   (filtros: status, q, page, pageSize)
POST   /api/v1/service-orders                 → 201 ServiceOrder                       (number server-side; itens na mesma tx)
GET    /api/v1/service-orders/{id}            → 200 ServiceOrderDetail (com itens)     | 404 NOT_FOUND
PUT    /api/v1/service-orders/{id}            → 200 ServiceOrder                        | 404 | itens imutáveis se assinada
DELETE /api/v1/service-orders/{id}            → 204                                     | 404 | erro de estado se assinada/terminal
PUT    /api/v1/service-orders/{id}/status     → 200 ServiceOrder                        (transições; terminal não volta)
GET    /api/v1/service-orders/{id}/signature  → 200 SOSignatureView (estado derivado)
POST   /api/v1/service-orders/{id}/signature  → 201 { signature, requestId, publicUrl, qrCodeDataUrl }  (protegido; cota compartilhada)
```

- `employee` cross-tenant no create/update → `422 FK_NOT_FOUND`. OS cross-tenant → `404`.
- **Não** há REST público de assinatura: a assinatura pública usa a rota `/signature-requests/[token]` (página, não-REST). Documentar como "não-REST" no api-design.

## `incidents` (tabela `accidents`)

```txt
GET    /api/v1/incidents                → 200 Paginated<AccidentListItem>   (filtros: status, company_id, q, page)
POST   /api/v1/incidents                → 201 Accident
GET    /api/v1/incidents/{id}           → 200 Accident        | 404
PUT    /api/v1/incidents/{id}           → 200 Accident        | 404
DELETE /api/v1/incidents/{id}           → 204                 | 404
PUT    /api/v1/incidents/{id}/status    → 200 Accident        (state machine; conclusão exige justificativa e sem plano ativo → erro de estado)
```

- Acesso só office staff; `client` → `403 FORBIDDEN`. Dado de saúde nunca no corpo de erro/log. Cross-tenant → `404`.

## `action-plans`

```txt
GET    /api/v1/action-plans                 → 200 Paginated<ActionPlanListItem>   (filtros: status, origin_type, origin_id, overdue, page)
POST   /api/v1/action-plans                 → 201 ActionPlan                       (origem risk|incident validada → 422 se inválida/cross-tenant)
GET    /api/v1/action-plans/{id}            → 200 ActionPlan   | 404
PUT    /api/v1/action-plans/{id}            → 200 ActionPlan   | 404
DELETE /api/v1/action-plans/{id}            → 204              | 404 | 409 IN_USE (se iniciado/dependentes → usar cancel)
PUT    /api/v1/action-plans/{id}/status     → 200 ActionPlan   (planned→in_progress→completed / cancelled; terminal não volta)
```

- `origin` removida depois → plano persiste (histórico). `overdue` derivado (não filtra por coluna persistida).

## `risk-audits`

```txt
GET    /api/v1/risk-audits                        → 200 Paginated<RiskAuditListItem>   (filtros: status, origin_type, page) — kanban
POST   /api/v1/risk-audits                        → 201 RiskAudit                       (uma ativa/origem → 409 DUPLICATE)
GET    /api/v1/risk-audits/{id}                   → 200 RiskAudit   | 404
PUT    /api/v1/risk-audits/{id}/status            → 200 RiskAudit   (transição explícita + justificativa obrigatória)
POST   /api/v1/risk-audits/{id}/suggest-action-plan → 200 ActionPlan5W2HSuggestion | 402 QUOTA_EXCEEDED | 502 AI_UNAVAILABLE
```

- `suggest-action-plan`: IA opcional; falha nunca bloqueia o fluxo (degradação graciosa). Payload de entrada não-PII (allowlist).

---

## Erros (reuso do `HTTP_BY_CODE` atual — nenhum novo)

`VALIDATION` 422 · `DUPLICATE` 409 · `FK_NOT_FOUND` 422 · `IN_USE` 409 · `NOT_FOUND` 404 · `FORBIDDEN` 403 · `NO_TENANT_CONTEXT` 403 · `UNAUTHORIZED` 401 · `QUOTA_EXCEEDED` 402 · `AI_UNAVAILABLE` 502.

## Docs & Postman (FR-044/FR-045)

- `docs/api/api-design.md`: adicionar `service-orders`, `incidents`, `action-plans`, `risk-audits` (+ assinatura protegida da OS; página pública como não-REST) nas tabelas Recursos e Sumário, com filtros e códigos de erro.
- `docs/api/sst-manager.postman_collection.json`: uma pasta por recurso espelhando as existentes, com exemplo válido e erros principais; reusar variáveis `baseUrl`/`devTenant`/`devRole`/ids. Arquivo **único**.
