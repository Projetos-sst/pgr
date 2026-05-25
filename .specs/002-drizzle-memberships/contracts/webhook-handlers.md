# Contract — Clerk webhook membership handlers

**File**: `app/api/webhooks/clerk/route.ts` (existente, estendido nesta fatia).
**Entrega**: 3 novos casos no switch de `evt.type`.

---

## Eventos novos

### `organizationMembership.created`

**Trigger**: Clerk dispara quando um user vira membro de uma org (via invite aceito, criação inicial da org, etc.).

**Payload** (campos relevantes): ver `data-model.md > Validação de payload (Zod)`.

**Comportamento esperado**:

1. Validar payload com Zod. Falha → HTTP 400, sem efeito colateral.
2. **Upsert defensivo** de `public.users` (mapeado de `evt.data.public_user_data`). Não sobrescreve campos populados com `null`.
3. **Upsert defensivo** de `public.orgs` (mapeado de `evt.data.organization`). Mesma regra.
4. **Upsert** de `public.org_memberships` com `(org_id, user_id, role)`. Atualiza `role` e `updated_at` se a PK já existir.
5. Logar evento processado (id da entrega Svix, type, org_id, user_id) sem dados sensíveis.
6. HTTP 200 com `{ ok: true }`.

**Idempotência**: 2ª entrega do mesmo evento NÃO duplica linhas nem altera dados além de `updated_at`.

---

### `organizationMembership.updated`

**Trigger**: mudança de role.

**Comportamento esperado**: idêntico ao `created` (mesma sequência de upserts), porque upserts são idempotentes e a única diferença observável é o `role` atualizado em `org_memberships`. Mantém o handler unificado (simplifica).

---

### `organizationMembership.deleted`

**Trigger**: user removido da org.

**Comportamento esperado**:

1. Validar payload com Zod.
2. **NÃO** upsert de users/orgs (não há razão pra criar registros num evento de delete).
3. `delete from public.org_memberships where org_id = $1 and user_id = $2`. Linha inexistente → no-op silencioso.
4. Log e HTTP 200.

**Não cascateia** removal de `users` ou `orgs` — o cascade vai no sentido contrário (delete de `orgs(id)` remove memberships dependentes).

---

## Garantias gerais do handler do webhook

- Verificação de assinatura Svix (já existente) MUST preceder qualquer parsing de payload. Falha → HTTP 401.
- Toda escrita usa `getSupabaseAdminClient()` (sb*secret*..., bypassa RLS).
- Tempo de resposta: < 1s p95.
- Erros não-Svix (constraint violation, falha de DB) → HTTP 500 com mensagem genérica + log estruturado. Clerk reentregará.
- Headers sensíveis (assinatura, body raw) **não** logados.

---

## Contrato de teste (informativo)

### Unitários (`tests/unit/webhooks/membership-handlers.test.ts`)

Cobertura mínima:

- ✅ `created` chama `upsertUser`, `upsertOrg`, `upsertOrgMembership` na ordem correta com os dados mapeados.
- ✅ `updated` resulta em `upsertOrgMembership` com `role` atualizado.
- ✅ `deleted` chama apenas `deleteOrgMembership`; sem upserts.
- ✅ Payload Zod inválido → 400, sem chamadas ao repositório.
- ✅ Falha de assinatura Svix → 401, sem parsing.

Mocks: `upsertUser`, `upsertOrg`, `upsertOrgMembership`, `deleteOrgMembership` mockados; verificar argumentos e ordem.

### Integração (`tests/integration/webhooks/clerk-membership.test.ts`)

Cobertura mínima (contra Postgres efêmero):

- ✅ `created` insere row em `org_memberships`; segunda entrega não duplica.
- ✅ `updated` muda `role`; `updated_at` avança.
- ✅ `deleted` remove a row; segunda entrega é no-op.
- ✅ Membership chegando antes de `user.created`/`organization.created`: row de `users` e `orgs` aparece via upsert defensivo; depois evento `user.created` enriquece sem sobrescrever campos.
- ✅ Tentativa de `SELECT` em `org_memberships` como papel `app_runtime` com claim `org_id = 'org_outra'` retorna 0 linhas (RLS).
- ✅ Tentativa de `INSERT` em `org_memberships` como `app_runtime` é rejeitada.
