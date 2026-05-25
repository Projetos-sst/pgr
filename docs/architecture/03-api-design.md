# 03 — API Design

Não há API REST tradicional separada. O backend são **Server Actions** e
**Route Handlers** dentro do próprio Next.js (constituição, "Restrições
Técnicas"). Este documento define quando usar cada um e os padrões obrigatórios.

## Quando usar cada mecanismo

| Mecanismo                           | Use para                                                                | Não use para                                     |
| ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| **Server Action** (`'use server'`)  | Toda mutação disparada pela UI: criar, atualizar, excluir, mudar status | Chamadas de sistemas externos; tarefas agendadas |
| **Route Handler** (`route.ts`)      | Webhooks (Clerk), endpoints de Vercel Cron, downloads / URLs assinadas  | Mutações de formulário (use Server Action)       |
| **Server Component + `queries.ts`** | Toda leitura para renderizar página                                     | Mutar dados                                      |

Regra prática: **se quem dispara é o usuário pela interface, é Server Action.**
Route Handler é só para quem chama de fora (Clerk, Cron) ou para servir arquivo.

## Server Actions — padrão

Ficam em `features/<modulo>/actions.ts`, com `'use server'` no topo do arquivo.

### Retorno tipado

Toda Server Action retorna um `Result` discriminado — nunca lança exceção para a
UI tratar. Tipo central em `lib/result.ts`:

```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

`fieldErrors` carrega os erros de validação Zod por campo, para o formulário
exibir inline.

### Anatomia de uma Server Action

Toda Server Action segue a mesma sequência. A ordem importa:

```ts
"use server";

export async function createEmployee(
  _prev: unknown,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  // 1. AUTENTICAÇÃO + TENANT — sempre da sessão, nunca do input
  const { orgId, userId } = await requireOrg();

  // 2. VALIDAÇÃO — schema Zod no boundary (constituição, Princípio V)
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // 3. AUTORIZAÇÃO — checar permissão do usuário na organização, se aplicável

  // 4. MUTAÇÃO — sempre escopada pelo orgId da sessão
  const employee = await createEmployeeRecord(orgId, userId, parsed.data);

  // 5. INVALIDAÇÃO DE CACHE
  revalidateTag(`employees:${orgId}`);

  // 6. RETORNO tipado
  return { ok: true, data: { id: employee.id } };
}
```

Pontos não-negociáveis:

- **Auth e tenant vêm sempre da sessão** (`requireOrg()` → Clerk). O
  `organization_id` **nunca** é lido de `formData`, query ou header
  (constituição, Princípio I).
- **Validação antes de tocar o banco.** Sem schema validado, não há mutação.
- **A Server Action revalida auth por conta própria.** Não confia só no
  `proxy.ts` — Server Actions recebem POST direto e o proxy pode não cobrir
  todos os caminhos (nota de segurança da doc do Next.js 16).

### Consumo no cliente

Formulários usam `useActionState` para estado de envio e erros:

```tsx
"use client";
const [state, formAction, pending] = useActionState(createEmployee, null);
return <form action={formAction}>{/* ...campos, state?.fieldErrors... */}</form>;
```

## Acesso a dados org-scoped

Esta é a barreira primária de isolamento multi-tenant (o RLS do doc 02 é o
backstop). Dois elementos:

### `lib/auth.ts` — contexto de tenant

```ts
// Lê a organização ativa da sessão Clerk. Lança/redireciona se ausente.
export async function requireOrg(): Promise<{ orgId: string; userId: string }>;

// Variante sem lançar — para casos opcionais.
export async function getOrgContext(): Promise<{ orgId: string; userId: string } | null>;
```

### `lib/db` — `orgScopedDb`

O acesso ao banco passa por um wrapper que **abre uma transação, fixa o tenant e
só então executa** — garantindo que o `SET LOCAL app.current_org` do RLS
(doc 02) esteja sempre ativo:

```ts
// Executa o callback numa transação com o tenant fixado para o RLS.
export async function withOrg<T>(
  orgId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org = ${orgId}`);
    return fn(tx);
  });
}
```

As funções de `queries.ts` e `actions.ts` **sempre** recebem `orgId` como
primeiro parâmetro e usam `withOrg`. Exemplo em `features/funcionarios/queries.ts`:

```ts
export async function listEmployees(orgId: string) {
  return withOrg(orgId, (tx) =>
    tx.select().from(employees).where(eq(employees.organizationId, orgId)),
  );
}
```

Resultado: o `WHERE organization_id` explícito é a 1ª barreira; o RLS via
`SET LOCAL` é a 2ª. Esquecer uma não vaza dados — a outra ainda filtra.

## Validação com Zod

- Um `schema.ts` por módulo define os schemas de entrada.
- O **mesmo schema** valida a Server Action (servidor) e pode tipar o
  formulário (cliente) — DRY.
- Validação no boundary de **toda** Server Action e **todo** Route Handler que
  recebe dados — exigência da constituição (Princípio V).
- Os tipos de domínio derivam do schema com `z.infer<typeof schema>` — uma
  fonte de verdade só.

## Route Handlers

### Webhook do Clerk — `app/api/webhooks/clerk/route.ts`

- Recebe eventos de `user` e `organization` para manter `user_profiles`
  sincronizada (doc 04).
- **Verifica a assinatura** do webhook (Svix/Clerk) antes de processar — um
  Route Handler é um endpoint público.
- Idempotente: o mesmo evento pode chegar mais de uma vez.

### Vercel Cron — `app/api/cron/[job]/route.ts`

- Processa a fila de `jobs` (doc 04).
- Protegido por um segredo (`CRON_SECRET`) conferido no header — só o Cron da
  Vercel pode acionar.

### Convenções

| Aspecto           | Padrão                                                    |
| ----------------- | --------------------------------------------------------- |
| Métodos           | Exportar `GET`/`POST`/etc. conforme o caso                |
| `params`          | Assíncrono no Next.js 16 — `const { job } = await params` |
| Sucesso           | `Response.json(data)` (200)                               |
| Erro de validação | `Response.json({ error }, { status: 400 })`               |
| Não autorizado    | `status: 401`; sem permissão `403`                        |
| Erro interno      | `status: 500`, sem vazar detalhes internos                |

## Cache e revalidação (Next.js 16)

O Next.js 16 usa o modelo **Cache Components**. Diretrizes:

- **Leituras**: marcar funções de `queries.ts` cacheáveis com `'use cache'` +
  `cacheLife(...)` quando os dados toleram alguma defasagem; etiquetar com
  `cacheTag(\`<entidade>:${orgId}\`)`. **A tag inclui o `orgId`\*\* — invalidação
  e cache nunca cruzam tenants.
- **Após mutação**: a Server Action chama `revalidateTag(tag, profile)` (ou
  `updateTag` quando o usuário precisa ver imediatamente a própria escrita).
- **Dados de runtime** (sessão, `searchParams`): nunca cacheados; componentes
  que dependem deles ficam sob `<Suspense>`.
- **APIs assíncronas da v16**: `cookies()`, `headers()`, `params`,
  `searchParams` são sempre `await`.

## Tratamento de erros

| Origem                   | Tratamento                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Validação (Zod)          | `Result` com `fieldErrors`; formulário exibe inline                                 |
| Regra de negócio         | `Result` com `error` legível em português                                           |
| Falha inesperada         | Logar no servidor; `Result` com mensagem genérica; nunca vazar stack/SQL ao cliente |
| Erro de renderização     | `app/error.tsx` (boundary de rota)                                                  |
| Rota/recurso inexistente | `app/not-found.tsx`                                                                 |

Princípio: **erros esperados são valores** (`Result`); **erros inesperados** são
exceções que sobem para o boundary. A UI nunca recebe detalhe técnico interno.

## Resumo dos contratos

| Operação                 | Mecanismo                        | Local                            |
| ------------------------ | -------------------------------- | -------------------------------- |
| Listar / detalhar        | Server Component + `queries.ts`  | `features/<m>/queries.ts`        |
| Criar / editar / excluir | Server Action                    | `features/<m>/actions.ts`        |
| Mudar status / workflow  | Server Action                    | `features/<m>/actions.ts`        |
| Agregação de dashboard   | `queries.ts`                     | `features/dashboard/queries.ts`  |
| Sincronização Clerk      | Route Handler                    | `app/api/webhooks/clerk/`        |
| Processar jobs           | Route Handler + Vercel Cron      | `app/api/cron/[job]/`            |
| Upload de arquivo        | Server Action + `lib/storage.ts` | `features/documentos/actions.ts` |
| Download de arquivo      | URL assinada (`lib/storage.ts`)  | —                                |
