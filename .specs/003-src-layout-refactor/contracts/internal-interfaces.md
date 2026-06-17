# Contratos — Reorganização `src/` e refatoração

Esta fatia é majoritariamente **interna**. Os contratos **externos** (endpoint do webhook, rota
`whoami`) permanecem inalterados — ver
[`002-drizzle-memberships/contracts/`](../../002-drizzle-memberships/contracts/). Abaixo, as
mudanças de interface internas, para rastreabilidade.

## Contratos externos (inalterados)

| Superfície                 | Contrato                                                                                                        | Mudança                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `POST /api/webhooks/clerk` | Verifica assinatura Svix; processa eventos `user.*`, `organization.*`, `organizationMembership.*`; 200/400/500. | Nenhuma — só refatoração interna dos handlers.                             |
| `GET /api/whoami`          | 200 `{userId, orgId}` · 401 · 403 `NO_ACTIVE_ORG`; sempre `no-store`.                                           | Headers passam a vir da fonte única `NO_STORE_HEADERS`; resposta idêntica. |

## Mudanças de interface internas

### Rename: client Supabase que ignora RLS

- **Antes**: `getSupabaseAdminClient()` (de `@/lib/supabase/admin`)
- **Depois**: `getRlsBypassingSupabaseClient()` — mesma assinatura e comportamento
- **Motivo**: o nome evidencia o risco (bypass de RLS) em cada call site; substitui o JSDoc removido.
- **Consumidores atualizados**: repositórios (`users`, `orgs`, `org_memberships`), webhook e os
  mocks de teste correspondentes.

### Novo módulo: `src/lib/http/no-store.ts`

- **Export**: `NO_STORE_HEADERS: Readonly<Record<string,string>>`
- **Consumidores**: `src/proxy.ts`, `src/app/api/whoami/route.ts`

### Removido: backfill (one-off concluído)

- `.scripts/backfill-memberships.ts` (CLI), `src/lib/clerk/backfill-memberships.ts` (lógica), o teste
  de integração de backfill e o script `db:backfill` foram **removidos** — operação pontual já
  executada. `src/lib/clerk/` mantém apenas `membership-event-mappers.ts`.

### Guard anti-leak de bundle → ESLint

- **Antes**: shell `.scripts/check-no-db-in-client.sh` no `npm run lint`.
- **Depois**: regra `no-restricted-imports` em `eslint.config.mjs` banindo `@/lib/db`/`@/lib/db/**`
  em `src/app`/`src/components`, com `no-restricted-imports: off` para `src/app/api/**` e
  `src/app/**/route.{ts,tsx}`. Verificado: acusa violação em arquivo client, libera o webhook.

### Banco → comandos Drizzle nativos

- `db:migrate` agora é `drizzle-kit migrate` (removido o runner custom). `db:reset`/`db:backfill`
  removidos. Os `.sql` históricos seguem em `src/lib/db/migrations` para o setup da integração.

### Webhook — refatoração interna (sem mudança de contrato)

- `parseMembershipPayload(evt)` — valida o payload e retorna `null` (→ 400) em caso de falha.
- `upsertMembershipWithParents(payload)` — encapsula a ordem `user → org → membership` exigida pelas
  FKs (substitui o comentário explicativo).
