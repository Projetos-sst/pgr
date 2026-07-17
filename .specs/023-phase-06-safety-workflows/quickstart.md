# Quickstart — Fase 06 (023)

Como validar a fatia localmente. **Nada aqui foi executado no planejamento** — é o roteiro para a implementação.

## Pré-requisito ABSOLUTO (Bloco A)

Antes de qualquer `db:generate`/`db:migrate` da Fase 06, executar a reconciliação do journal (research.md §1):

```bash
# 1) evidência da realidade aplicada (ambiente autorizado, com backup):
#    SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;
# 2) comparar journal × arquivos .sql × snapshots
# 3) aplicar a correção mínima compatível com banco existente e novo
# 4) validar em Postgres efêmero limpo:
INTEGRATION_DATABASE_URL=postgres://…:PORT/db npm run test:integration -- --runInBand
# 5) só então gerar a migration da fase:
npm run db:generate   # deve emitir APENAS o delta da Fase 06 → 0024_phase_06_safety_workflows
```

## Ambiente

```bash
# App
npm run dev                         # http://localhost:3000

# Migrations/schema (owner, DATABASE_URL_UNPOOLED)
npm run db:generate                 # emite migration a partir do schema
npm run db:migrate                  # aplica no banco de dev

# Testes
npm run test                        # unit (jsdom)
INTEGRATION_DATABASE_URL=… INTEGRATION_APP_RUNTIME_URL=… \
  npm run test:integration          # integração em Postgres efêmero (--runInBand). NUNCA SQLite.

# Qualidade (gate final, Bloco G)
npm run check                       # format:check + lint + typecheck + unit
npm run build
```

## Roteiro de verificação por user story

| US  | Como verificar                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| US1 | `db:migrate` limpo pós-reconciliação; SELECT/INSERT sem `withOrg` → 0 linhas (RLS); enums/UNIQUEs presentes                                |
| US2 | criar 2 OS concorrentes no mesmo tenant → números consecutivos; itens gravam/rollback juntos; excluir OS assinada → negado                 |
| US3 | POST `/service-orders/{id}/signature` → abrir `/signature-requests/[token]` sem login → assinar → replay recusado; payload só com 6 campos |
| US4 | CRUD via office staff; `client` → 403; incidente de outro tenant não aparece; aba Fotos = placeholder                                      |
| US5 | transitar incidente; concluir com plano ativo → bloqueado; concluir sem justificativa → 422                                                |
| US6 | criar plano `risk`/`incident`; origem inválida/cross-tenant → 422; overdue derivado; cancelar registra `cancelled_at`                      |
| US7 | criar 2ª auditoria ativa p/ mesma origem → 409; transição exige justificativa; `suggest-action-plan` com IA mockada/off                    |

## cURL (Bloco G, bypass DEV não-prod) — roteiro sanitizado

> Pré-condições: `.env.local` com `APP_ENV=local`, `DEV_API_AUTH_BYPASS=true`, `DEV_TENANT_ID=<orgId>`;
> `npm run dev`. Variáveis: `BASE=http://localhost:3000`, `ORG=<orgId>`. **Nunca** imprima cookies,
> tokens de assinatura ou payloads sensíveis. Os mesmos contratos abaixo são exercidos ponta-a-ponta
> pelas suítes de integração `src/__tests__/integration/safety/*` (Postgres efêmero; LLM mockado).

```bash
H=(-H "x-dev-tenant: $ORG" -H "x-dev-role: owner" -H 'content-type: application/json')

# ── Service Orders ────────────────────────────────────────────────────────────
curl -s "${H[@]}" -X POST  $BASE/api/v1/service-orders \
  -d '{"companyId":"<uuid>","description":"OS de manutenção","items":[{"description":"Trocar EPI"}]}'   # 201 (número server-side)
curl -s "${H[@]}"          $BASE/api/v1/service-orders?page=1                                          # 200 lista
curl -s "${H[@]}"          $BASE/api/v1/service-orders/<id>                                            # 200 detalhe+itens | 404 cross-tenant
curl -s "${H[@]}" -X PUT   $BASE/api/v1/service-orders/<id>/status -d '{"status":"in_progress"}'       # 200 (terminal não volta)
curl -s "${H[@]}" -X POST  $BASE/api/v1/service-orders/<id>/signature -d '{}'                          # 201 {publicUrl,qrCodeDataUrl} (só aqui)
curl -s "${H[@]}"          $BASE/api/v1/service-orders/<id>/signature                                  # 200 estado derivado (sem token/URL)
curl -s -H "x-dev-tenant: $ORG" -H "x-dev-role: client" -X POST $BASE/api/v1/service-orders -d '{…}'   # 403 FORBIDDEN

# ── Incidents (accidents) ─────────────────────────────────────────────────────
curl -s "${H[@]}" -X POST  $BASE/api/v1/incidents \
  -d '{"companyId":"<uuid>","occurredAt":"2026-07-10T14:30:00Z","type":"typical","category":"without_leave","severity":"minor","catNumber":"CAT-INTERNO-1"}'  # 201 (CAT interno)
curl -s "${H[@]}" -X PUT   $BASE/api/v1/incidents/<id>/status -d '{"status":"awaiting_planning"}'      # 200
curl -s "${H[@]}" -X PUT   $BASE/api/v1/incidents/<id>/status -d '{"status":"completed"}'              # 422 (plano ativo / sem justificativa)
curl -s -H "x-dev-tenant: $ORG" -H "x-dev-role: client" $BASE/api/v1/incidents                         # 403 FORBIDDEN

# ── Action Plans ──────────────────────────────────────────────────────────────
curl -s "${H[@]}" -X POST  $BASE/api/v1/action-plans \
  -d '{"originType":"risk","originId":"<uuid>","what":"…","why":"…","who":"SESMT","where":"…","how":"…"}' # 201
curl -s "${H[@]}" -X POST  $BASE/api/v1/action-plans -d '{"originType":"inspection","originId":"<uuid>",…}' # 422 VALIDATION (origem não suportada)
curl -s "${H[@]}" -X POST  $BASE/api/v1/action-plans -d '{"originType":"risk","originId":"<uuid-de-outro-tenant>",…}' # 422 FK_NOT_FOUND
curl -s "${H[@]}" -X PUT   $BASE/api/v1/action-plans/<id>/status -d '{"status":"in_progress"}'          # 200 (overdue derivado no GET)
curl -s "${H[@]}" -X DELETE $BASE/api/v1/action-plans/<id>                                              # 204 se planned | 409 IN_USE se iniciado

# ── Risk Audits + IA ──────────────────────────────────────────────────────────
curl -s "${H[@]}" -X POST  $BASE/api/v1/risk-audits -d '{"originType":"risk","originId":"<uuid>"}'      # 201
curl -s "${H[@]}" -X POST  $BASE/api/v1/risk-audits -d '{"originType":"risk","originId":"<mesmo uuid>"}' # 409 IN_USE (uma ativa/origem)
curl -s "${H[@]}" -X PUT   $BASE/api/v1/risk-audits/<id>/status -d '{"status":"planning_actions"}'      # 200
curl -s "${H[@]}" -X PUT   $BASE/api/v1/risk-audits/<id>/status -d '{"status":"completed","justification":"Ações tratadas"}'  # 200
curl -s "${H[@]}" -X PUT   $BASE/api/v1/risk-audits/<id>/status -d '{"status":"completed"}'             # 422 (inválida / sem justificativa)
curl -s "${H[@]}" -X POST  $BASE/api/v1/risk-audits/<id>/suggest-action-plan -d '{}'                    # 200 5W2H | 402 QUOTA_EXCEEDED | 502 AI_UNAVAILABLE
```

**Evidência (T074)**: nesta sessão **não** havia servidor Next + Supabase em execução para captura de
respostas cURL ao vivo (proibido tocar no banco real e chamar a Anthropic real). As mesmas superfícies —
mesmos repositórios, schemas Zod e mapeamento de erro consumidos pelo REST — são verificadas
**ponta-a-ponta** pelas suítes de integração em Postgres efêmero (`--runInBand`, LLM mockado):
`safety/service-orders`, `safety/service-order-signature`, `safety/incidents`, `safety/action-plans`,
`safety/incident-lifecycle`, `safety/risk-audits` (todas verdes no gate final). O roteiro acima é o
mapa 1:1 com esses cenários para reexecução manual quando um ambiente local autorizado estiver ativo.

## Playwright

- **Público** (sempre): fluxo `/signature-requests/[token]` da OS (válido/inválido/expirado/usado).
- **Protegido** (quando Clerk disponível): CRUD de OS/incidentes/planos + kanban de auditorias.

## Checklist de saída (gate final)

`format` · `lint` · `typecheck` · `unit` · `integration --runInBand` · `build` · cURL · Playwright · `docs/api/api-design.md` + Postman sincronizados · diff de schema/migrations = apenas `0024` + reconciliação esperada.
