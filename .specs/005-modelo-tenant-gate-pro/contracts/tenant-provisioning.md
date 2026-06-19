# Contrato — Provisionamento do tenant pessoal no cadastro

Garante FR-001/003/004 e D1/Inv-3: todo usuário recebe um tenant próprio (`owner`) ao se
cadastrar, sem duplicar identidade nem tenant.

## Função canônica (idempotente)

`src/shared/tenant/provision-personal-tenant.ts`:

```ts
type ProvisionInput = { userId: string; name?: string | null };
type ProvisionResult = { tenantId: string; created: boolean };

export async function provisionPersonalTenant(
  input: ProvisionInput,
): Promise<ProvisionResult>;
```

**Comportamento**:
1. Verifica se `userId` já possui um membership `owner` de um tenant pessoal
   (`clerk_org_id IS NULL`). Se sim → **no-op**, retorna `{ tenantId: existente, created:false }`.
2. Senão, numa unidade lógica:
   - cria `orgs` (id gerado — `gen_random_uuid()::text`, `plan='free'`, `clerk_org_id=null`,
     `name = input.name ?? null`);
   - cria `org_memberships (org_id, user_id=userId, role='owner')`.
   - retorna `{ tenantId, created:true }`.
3. Idempotente sob reentrega/corrida: a checagem do passo 1 + upserts `onConflict` evitam
   duplicar (Inv-3 "nunca duplica"; Princípio V).

**Persistência**: caminho admin (`getRlsBypassingSupabaseClient`) — é provisionamento de
sistema (fora de RLS), como todo o sync da `002`. **Não** usa `withOrg` (não há tenant ativo
ainda).

**Repositórios** (estendidos em `src/shared/db/repositories/`):
- `orgs.ts`: `createTenant({ id?, name?, plan?, clerkOrgId? })` → insert com `plan` default
  `free`; `toOrgColumns`/`mapOrg` passam a incluir `plan` e `clerk_org_id`.
- `org-memberships.ts`: `ensureOwnerMembership({ orgId, userId })` → upsert role `owner`
  (`onConflict: org_id,user_id`).

## Gatilhos (dois call-sites, uma função)

### Primário — webhook `user.created`

Em `clerk-sync-service.ts`, `syncUser` (após `replaceUser`):

```ts
case "user.created":
  await syncUser(event.data);          // replaceUser (mantido)
  await provisionPersonalTenant({ userId: data.id, name: nameFrom(data) });
  return OK;
```

- `user.updated` **não** provisiona (idempotência já cobriria, mas evita trabalho).
- Erro do provisionamento propaga → webhook responde 500 → Clerk reentrega (idempotente).

### Rede de segurança — resolução de contexto

`requireTenantContext()` (ver `tenant-context-resolution.md`), ao achar **0 memberships**,
chama `provisionPersonalTenant({ userId })` e re-resolve. Cobre corrida "usuário acessa
antes do webhook". Só dispara com 0 memberships (não a cada request).

## Auditoria

Emitir `logTenantEvent("info", { operation: "tenant.provisioned", outcome: "ok",
orgId: tenantId, userId })` apenas quando `created === true`. Sem PII/segredos (FR-026).

## Critérios de aceite

- [ ] `user.created` cria exatamente 1 `orgs` (`plan='free'`) + 1 membership `owner`.
- [ ] Reentrega do mesmo `user.created` → no-op (sem 2º tenant; SC-008 "0 substituições").
- [ ] Usuário que acessa sem tenant (webhook atrasado) é provisionado no 1º acesso e segue
      para a área autenticada (não vê onboarding/bloqueio).
- [ ] Nenhuma identidade duplicada para o mesmo `userId` (Inv-3).
- [ ] Log `tenant.provisioned` emitido só na criação, sem PII.
