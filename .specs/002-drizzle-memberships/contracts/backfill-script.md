# Contract — `scripts/backfill-memberships.ts`

**Type**: script Node.js one-off, executado manualmente.
**Invocação**: `npx tsx scripts/backfill-memberships.ts` (ou `node --import tsx`).
**Ambiente**: requer `.env.local` com `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (admin client).

---

## Comportamento

1. Carrega env via `lib/supabase/env.ts` (validações existentes).
2. Inicializa `clerkClient()` (`@clerk/nextjs/server`) e `getSupabaseAdminClient()`.
3. Lista **todas as organizações** do Clerk via `clerkClient.organizations.getOrganizationList({ limit: 100 })`, paginando (`offset`).
4. Para cada org:
   a. Upsert da `org` em `public.orgs` (defensivo, mesmo padrão dos handlers).
   b. Lista `clerkClient.organizations.getOrganizationMembershipList({ organizationId, limit: 100 })`, paginando.
   c. Para cada membership:
   - Upsert defensivo do `user` em `public.users`.
   - Upsert em `public.org_memberships` com `(organization.id, public_user_data.user_id, role)`.
5. Imprime resumo final: `{ orgs_processed, memberships_processed, errors }`.

---

## Garantias

- **Idempotente**: execuções repetidas convergem; nenhuma duplicata é criada (PK composta + upsert por `(org_id, user_id)`).
- **Resiliente a falhas transitórias**: erro em uma org/membership é logado e o script continua para os próximos; exit code = 0 se `errors == 0`, senão exit code = 1.
- **Seguro contra rate-limit do Clerk**: respeita o `429`/headers de rate (delay simples no retry, sem dependência externa).
- **Coexiste com webhook ativo**: como ambos usam upsert pela mesma PK, race conditions terminam no estado correto.
- **Server-only**: usa `getSupabaseAdminClient()`, `server-only`.

---

## Não-objetivos

- NÃO deleta memberships ausentes no Clerk (não há "diff" de remoção). Memberships removidos antes do backfill ficarão órfãos até serem manualmente limpos. Aceitável nesta fatia porque o webhook gerencia deletes futuros.
- NÃO atualiza outros campos de `users`/`orgs` fora do mínimo necessário; o webhook regular faz isso de forma reativa.

---

## Contrato de teste (informativo)

Unitário/integração:

- ✅ Roda contra fixtures (Clerk SDK mockado) e verifica que `upsertOrg`, `upsertUser`, `upsertOrgMembership` são chamados na ordem certa para todos os membros retornados.
- ✅ Segunda execução: nenhum write adicional além de `updated_at`.
- ✅ Erro simulado em uma org: contagem de `errors` ≥ 1, script termina com exit code 1, mas processou as demais orgs.
