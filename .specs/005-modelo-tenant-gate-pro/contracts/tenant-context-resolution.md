# Contrato — Resolução do tenant ativo (das nossas memberships) + plano

Corrige a premissa da `004`: o tenant ativo vem das **nossas** `org_memberships`
(chaveadas pelo `userId` da sessão), não da org ativa do Clerk (FR-002/019/020, Inv-2).
Garante que o tenant **nunca** vem de input do cliente (Princípio I).

## `requireTenantContext()`

`src/shared/auth/require-tenant-context.ts`:

```ts
type TenantContext = {
  userId: string;
  tenantId: string;          // orgs.id (nosso id canônico)
  plan: "free" | "pro";      // do tenant ativo (Inv-1)
  role: string;              // papel no tenant ativo (org_memberships.role)
};

export async function requireTenantContext(): Promise<TenantContext>;
```

**Algoritmo**:
1. `userId` ← sessão Clerk (`auth()` / `assertAuthenticated`). Sem sessão → erro de auth
   (caminho existente).
2. Lê memberships do `userId` (com o `plan` do tenant via join `orgs`).
3. **0 memberships** → `provisionPersonalTenant({ userId })` (self-heal) e relê. Se ainda 0
   → `NoTenantContextError` (bloqueio; `logTenantEvent("error", { operation:
   "tenant.context", outcome: "blocked", userId })`).
4. **1 membership** → tenant ativo = esse. Retorna `{ userId, tenantId, plan, role }`.
5. **2+ memberships** _(prático só com convite, futuro)_ → escolher pelo cookie
   `ACTIVE_ORG_COOKIE` (`tenant_active_org`, já em `org-switch.ts`) se apontar para um
   membership válido; senão **bloqueio determinístico** (nunca default ambíguo — spec edge
   case) até o seletor (futuro).

**Origem do tenant**: sempre `userId`→memberships. **Nunca** body/query/header (FR-002).

## Uso no acesso a dados

A Server Action/handler de negócio resolve o contexto e abre a transação tenant-scoped:

```ts
const { tenantId } = await requireTenantContext();
return withOrg(tenantId, async (tx) => {
  // queries tenant-scoped; RLS fixa app.current_org = tenantId
});
```

`withOrg` [reutilizado, inalterado] fixa `set_config('app.current_org', tenantId, true)`.

## Bloqueio na área autenticada

`src/app/(protected)/layout.tsx` passa a usar `requireTenantContext()` em vez de depender de
`session.orgId` (Clerk). `NoTenantContextError` → bloqueio/redirecionamento (mesmo caminho
"sem org ativa" da `004`; FR-024). `requireOrgContext()` permanece para o caminho Clerk-org
do PRO (futuro), não é removido.

## Plano e elegibilidade (campo apenas — sem enforcement)

`src/shared/tenant/plan.ts`:

```ts
export function isTeamManagementAvailable(plan: "free" | "pro"): boolean {
  return plan === "pro";  // reflete o campo; NÃO bloqueia nada nesta fatia (FR-013 futuro)
}
```

`src/shared/tenant/active-tenant.ts` (ou no resolver):

```ts
export function isSwitcherEligible(membershipCount: number): boolean {
  return membershipCount >= 2;  // FR-020 (renderização do seletor é futura)
}
```

- Plano sempre do **tenant ativo** (Inv-1); 0 leituras de "plano do usuário" global (SC-007).
- `isTeamManagementAvailable` é ponto único para o Gate PRO futuro — sem enforcement agora.

## Critérios de aceite

- [ ] Usuário com 1 membership → `tenantId` é o desse membership; `withOrg(tenantId)` isola
      corretamente.
- [ ] Tenant ativo nunca deriva de input do cliente (teste: body/query/header com outro id
      são ignorados).
- [ ] 0 memberships com webhook atrasado → self-heal provisiona e resolve; falha real →
      `NoTenantContextError` → bloqueio (sem expor dado de outro tenant).
- [ ] `plan` retornado é o do tenant ativo; `isTeamManagementAvailable` reflete o campo.
- [ ] `isSwitcherEligible`: 1 vínculo → false; 2+ → true (SC-010).
- [ ] Nenhuma regressão no `requireOrgContext()` (caminho Clerk-org mantido).
