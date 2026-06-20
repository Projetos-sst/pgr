# Contrato — Repositórios org-scoped + validação de domínio

Define a camada de acesso e a validação desta fatia. Services **não** tocam o ORM direto
(Repository pattern, CODE_STANDARDS §2.2). Todo acesso passa por `withOrg(activeTenant, …)`
— o `org_id` vem do tenant ativo (`requireTenantContext()`), nunca de input do cliente.

## 1. Padrão de repositório (por entidade)

`src/shared/db/repositories/<entity>.ts`. Cada função recebe o `orgId` do tenant ativo e
fixa o tenant na transação; o `WHERE org_id` explícito é a 1ª barreira, o RLS a 2ª.

```ts
export async function listWorkUnits(orgId: string, filters?: WorkUnitFilters) {
  return withOrg(orgId, (tx) =>
    tx.select().from(workUnits).where(eq(workUnits.orgId, orgId)),
  );
}

export async function createWorkUnit(orgId: string, input: NewWorkUnitInput) {
  const data = parseNewWorkUnit(input);          // zod — valida ANTES de tocar o banco
  return withOrg(orgId, (tx) =>
    tx.insert(workUnits).values({ ...data, orgId }).returning(),
  );
}
```

Repositórios a criar: `work-units`, `ges`, `job-roles`, `categories`, `employees`,
`ges-job-roles` (CRUD org-scoped básico). Escrita sempre fixa `orgId` = tenant ativo no
`values` (o RLS `WITH CHECK` rejeita qualquer outro — FR-012).

## 2. Agregação do nº de trabalhadores expostos (R1 / FR-019/020)

`src/shared/db/repositories/ges.ts`:

```ts
// Nº de expostos de UM GES (0 quando não há associações).
export async function countExposedWorkersByGes(orgId: string, gesId: string): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int` })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));
    return row?.total ?? 0;
  });
}

// Mapa ges_id → nº de expostos para todos os GES do tenant (LEFT JOIN → 0 inclusive).
export async function exposedWorkersByGesMap(orgId: string): Promise<Record<string, number>>;
```

- Fonte única `ges_job_roles`; sem coluna persistida nem trigger.
- `coalesce(…, 0)` garante **0** (nunca nulo nem erro) para GES sem associação.
- Escopo por `org_id` no `withOrg` (RLS) **e** no `WHERE` (1ª barreira).
- Reflete imediatamente add/update/delete de associação (sem drift — SC-011).

## 3. Validação de domínio (zod) — antes da regra (FR-024, Princípio V)

`src/shared/domains/pgr/validation.ts` (ou junto de cada repositório). Schemas espelham os
domínios do banco — complementam, não substituem, as constraints:

```ts
export const categoryTypeSchema   = z.enum(["epi", "machine"]);
export const employeeSexSchema    = z.enum(["male", "female", "not_informed"]);
export const maritalStatusSchema  = z.enum(["single", "married", "divorced", "widowed", "stable_union"]);
export const employeeStatusSchema = z.enum(["active", "on_leave", "dismissed"]);

export const riskGradeSchema   = z.number().int().min(1).max(4);        // NR-04
export const workerCountSchema = z.number().int().positive();           // > 0
// cpf/cnpj: validação de FORMATO (não unicidade — unicidade é do banco)
```

- A validação cobre membros de enum, `risk_grade ∈ 1..4`, `worker_count > 0` e formato de
  `cpf`/`cnpj`. A **unicidade** (`UNIQUE(org_id, cpf)` etc.) e a **integridade de FK** são
  garantidas pelo banco — o repositório propaga o erro do banco como erro de domínio.

## 4. Auditoria de fronteira (FR-025)

Bloqueio por falta de tenant ativo e rejeição cross-tenant pelo banco reutilizam
`logTenantEvent` (padrão `004`): log com `requestId`/`orgId`/`userId`/operação, **sem** PII
nem payloads sensíveis (sem `cpf`, nomes, etc.).

## 5. Critérios de aceite

- [ ] Cada repositório acessa o banco apenas via `withOrg(activeTenant, …)`; nenhum acesso
      ao ORM fora de repositório.
- [ ] `createX` valida a entrada por zod **antes** de inserir; valor de enum/`risk_grade`/
      `worker_count` inválido falha na validação (unitário) e, se burlado, no banco.
- [ ] `countExposedWorkersByGes` retorna `0` para GES sem associação e a soma correta caso
      contrário; muda imediatamente após add/update/delete de `ges_job_roles`.
- [ ] A agregação soma apenas associações do tenant ativo (não vaza entre tenants).
- [ ] Tentativa de inserir com `org_id ≠ tenant ativo` é rejeitada (RLS `WITH CHECK`).
