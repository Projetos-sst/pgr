# Contrato — Auditoria de fronteira de tenant

`src/shared/tenant/audit-log.ts` — `logTenantEvent`, espelhando o padrão de
`src/shared/clerk-sync/log.ts` (linha JSON em `console`).

```ts
type TenantEventOutcome = "ok" | "blocked" | "rejected";

type TenantAuditFields = {
  operation: string; // ex.: "tenant.org_switched"
  outcome: TenantEventOutcome;
  requestId?: string;
  orgId?: string | null;
  userId?: string | null;
};

export function logTenantEvent(level: "info" | "error", fields: TenantAuditFields): void;
```

## Eventos

| `operation`                    | Quando                                           | `outcome`  | Nível |
| ------------------------------ | ------------------------------------------------ | ---------- | ----- |
| `tenant.org_switched`          | Troca de organização ativa concluída             | `ok`       | info  |
| `tenant.access_blocked_no_org` | Acesso à área autenticada / action sem org ativa | `blocked`  | info  |
| `tenant.cross_tenant_rejected` | Banco rejeita leitura/escrita cross-tenant (RLS) | `rejected` | error |

## Regras

- Sempre inclui correlação disponível: `requestId`, `orgId`, `userId`, `operation`,
  `outcome` (FR-020).
- **Nunca** inclui PII (nome, e-mail, CPF), segredos, tokens ou payloads de dados.
- A rejeição cross-tenant do banco sobe como exceção; o wrapper de acesso
  (`withOrg`/action) captura, loga `tenant.cross_tenant_rejected` e converte em
  `Result`/erro HTTP — sem vazar SQL/stack ao cliente.
- Cobertura: 100% dos três eventos geram log (SC-013); 0 logs com PII/segredos.
