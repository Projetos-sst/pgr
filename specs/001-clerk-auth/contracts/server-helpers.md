# Contract — Server Helpers (`lib/auth/*`)

**Feature**: `feature/clerk-auth-foundation`

Estes helpers são a única superfície permitida para código de negócio obter `userId` e `orgId`. Toda Server Action, Route Handler e Server Component da área `(app)` MUST usá-los — não chamar `auth()` diretamente.

---

## `requireAuth()`

```ts
// lib/auth/require-auth.ts
import "server-only";                 // barreira: nunca importar de Client Component
import type { AuthContext } from "./types";

export async function requireAuth(): Promise<AuthContext>;
```

**Behavior**:
1. Chama `await auth()` de `@clerk/nextjs/server`.
2. Se `isAuthenticated === false` ou `userId` ausente: lança `UnauthorizedError`.
3. Caso contrário, retorna `{ userId, sessionId }` tipado.

**Contract tests** (mockando `auth()`):

| Caso | Setup `auth()` mock retorna | Resultado esperado |
|---|---|---|
| Anônimo | `{ isAuthenticated: false, userId: null }` | lança `UnauthorizedError` |
| Sessão inválida (sem userId) | `{ isAuthenticated: true, userId: null }` | lança `UnauthorizedError` |
| Autenticado | `{ isAuthenticated: true, userId: "user_1", sessionId: "sess_1" }` | retorna `{ userId: "user_1", sessionId: "sess_1" }` |

---

## `requireOrgContext()`

```ts
// lib/auth/require-org-context.ts
import "server-only";
import type { OrgAuthContext } from "./types";

export async function requireOrgContext(): Promise<OrgAuthContext>;
```

**Behavior**:
1. Chama `requireAuth()` internamente (logo, lança `UnauthorizedError` se anônimo).
2. Se `orgId` ausente: lança `NoActiveOrgError`.
3. Caso contrário, retorna `{ userId, sessionId, orgId, orgRole, orgSlug }`.

**Garantia crítica (constituição §I)**: `orgId` retornado é estritamente o `orgId` de `auth()` — **nunca** lê de cabeçalho, body, query, cookie de cliente ou contexto de request.

**Contract tests**:

| Caso | Setup `auth()` mock retorna | Resultado esperado |
|---|---|---|
| Anônimo | `{ isAuthenticated: false }` | lança `UnauthorizedError` |
| Autenticado sem org | `{ isAuthenticated: true, userId: "u1", orgId: null }` | lança `NoActiveOrgError` |
| Autenticado com org | `{ isAuthenticated: true, userId: "u1", orgId: "o1", orgRole: "org:admin" }` | retorna contexto completo |

---

## Errors

```ts
// lib/auth/errors.ts
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
}

export class NoActiveOrgError extends Error {
  readonly code = "NO_ACTIVE_ORG" as const;
}
```

**Tratamento (alinhado a Next.js 16 oficial — research R11/R15)**:
- **Server Components do `(app)` layout**: capturam exceções e usam `redirect()` de `next/navigation` para UX (`UnauthorizedError` → `redirect('/sign-in')`; `NoActiveOrgError` → `redirect('/select-organization')`).
- **Route Handlers (`app/api/*`)**: usam `unauthorized()` / `forbidden()` de `next/navigation` (rendem 401/403 + páginas `app/unauthorized.tsx` / `app/forbidden.tsx`). Quando precisar de body JSON estruturado, `NextResponse.json({ error: 'CODE' }, { status })` sem stack.
- **Server Actions consumidas por forms**: devolvem objeto discriminado `{ ok: false, error: 'UNAUTHORIZED' | 'NO_ACTIVE_ORG' }` em vez de propagar `Error.message` cru — evita vazar internals (FR-020).
- **Logs**: helpers logam `code` + `userId` (se houver), nunca o body de input nem stack do Clerk em produção.

---

## Server Action de exemplo: `whoamiAction`

```ts
// lib/server/actions/whoami.ts
"use server";
import { requireOrgContext } from "@/lib/auth/require-org-context";

export type WhoamiPayload = { userId: string; orgId: string };

export async function whoamiAction(): Promise<WhoamiPayload> {
  const { userId, orgId } = await requireOrgContext();
  return { userId, orgId };
}
```

**Contract tests** (`tests/integration/auth-guards.test.ts`):

| Caso | Setup | Resultado esperado |
|---|---|---|
| Sem sessão | `auth()` → anônimo | `whoamiAction()` rejeita com `UnauthorizedError` |
| Sem org | `auth()` → autenticado, sem org | rejeita com `NoActiveOrgError` |
| Org ativa | `auth()` → autenticado, com org | resolve `{ userId, orgId }` corretos |
| Cliente "envia" orgId via input | (input adicionado ao input) | resultado IGNORA input; `orgId` é o da sessão |

---

## Route Handler de exemplo: `GET /api/whoami`

```ts
// app/api/whoami/route.ts
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/require-org-context";
import { UnauthorizedError, NoActiveOrgError } from "@/lib/auth/errors";

export async function GET() {
  try {
    const ctx = await requireOrgContext();
    return NextResponse.json({ userId: ctx.userId, orgId: ctx.orgId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return new NextResponse(null, { status: 401 });
    if (err instanceof NoActiveOrgError)
      return NextResponse.json({ error: "NO_ACTIVE_ORG" }, { status: 409 });
    throw err;
  }
}
```

**Contract tests**:

| Request | Setup `auth()` | Resposta esperada |
|---|---|---|
| `GET /api/whoami` sem sessão | anônimo | `401`, body vazio |
| `GET /api/whoami?orgId=org_FAKE` autenticado sem org | sem org | `409 { error: "NO_ACTIVE_ORG" }` — `?orgId` é ignorado |
| `GET /api/whoami` autenticado com org | com org `o1` | `200 { userId, orgId: "o1" }` |

---

## Convenções não-negociáveis

1. **Nenhum** código fora de `lib/auth/*` chama `auth()` de `@clerk/nextjs/server` para obter `orgId`.
2. **Nenhum** handler aceita `orgId` como input (não fazer parte do schema Zod de entrada).
3. Helpers são `async` e devem ser `await`ados; resultados não devem ser cacheados entre requests.
4. `UnauthorizedError` e `NoActiveOrgError` são as **únicas** exceções esperadas vindas dos helpers — qualquer outra é bug.
