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

## cURL (Bloco G, bypass DEV não-prod)

```bash
# .env.local: APP_ENV=local, DEV_API_AUTH_BYPASS=true, DEV_TENANT_ID=<orgId>
curl -s $BASE/api/v1/service-orders -H "x-dev-tenant: $ORG" -H "x-dev-role: owner"
curl -s -X POST $BASE/api/v1/action-plans -H "x-dev-tenant: $ORG" -H "x-dev-role: owner" \
  -H 'content-type: application/json' -d '{"origin_type":"risk","origin_id":"…","what":"…"}'
# esperado: 201 | 422 FK_NOT_FOUND (origem inválida) | 403 (role client)
```

## Playwright

- **Público** (sempre): fluxo `/signature-requests/[token]` da OS (válido/inválido/expirado/usado).
- **Protegido** (quando Clerk disponível): CRUD de OS/incidentes/planos + kanban de auditorias.

## Checklist de saída (gate final)

`format` · `lint` · `typecheck` · `unit` · `integration --runInBand` · `build` · cURL · Playwright · `docs/api/api-design.md` + Postman sincronizados · diff de schema/migrations = apenas `0024` + reconciliação esperada.
