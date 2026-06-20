# Contrato — `ActionResult<T>` (retorno padronizado das Server Actions)

Estabelece o contrato de retorno de **toda** Server Action desta fatia (FR-063). Nenhuma exceção
crua chega à UI; o formulário recebe um objeto previsível. Local: `src/shared/server/result.ts`.

## Forma

```ts
export type ActionError = {
  code: string;                         // "VALIDATION" | "DUPLICATE" | "FK_NOT_FOUND" | "FORBIDDEN" | "NOT_FOUND" | "NO_TENANT_CONTEXT" | "UNKNOWN"
  message: string;                      // mensagem curta, exibível
  fields?: Record<string, string>;      // erros por campo (origem zod)
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T>;
export function fail(code: string, message: string, fields?: Record<string, string>): ActionResult<never>;
```

## Códigos de erro (canônicos)

| code | Origem | HTTP equivalente | Quando |
| --- | --- | --- | --- |
| `VALIDATION` | `ZodError` | 422 | Entrada inválida (com `fields`) |
| `DUPLICATE` | UNIQUE do Postgres | 409 | CNPJ/CPF/título/vínculo duplicado no tenant |
| `FK_NOT_FOUND` | FK do Postgres | 422 | Empresa/obra/GES/função inexistente no tenant |
| `FORBIDDEN` | `ForbiddenError` | 403 | Papel `client` (não-equipe) |
| `NOT_FOUND` | `getById` → null | 404 | Registro inexistente no tenant (cross-tenant inclui) |
| `NO_TENANT_CONTEXT` | `NoTenantContextError` | 403 | Sem escritório ativo |
| `UNKNOWN` | inesperado | 500 | Relançado/logado; não silenciar |

## Regras

- Toda action: `requireOfficeStaff()` → `schema.safeParse` → repositório → `ok(...)`.
- Erros conhecidos (`AppError`, `ZodError`, violações do Postgres) são mapeados para `ActionError`.
- Erros inesperados são **relançados** (Princípio de não silenciar falhas) após `logTenantEvent`.
- Mutações que alteram listas/telas chamam `revalidatePath` da rota afetada antes de `ok(...)`.
