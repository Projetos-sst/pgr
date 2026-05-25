# Contract — UI Surface (rotas, componentes, comportamento)

**Feature**: `feature/clerk-auth-foundation`

Define o contrato visível da UI desta fatia: rotas existentes, qual componente fica em cada uma, o comportamento esperado por estado de autenticação/organização, e os pontos de proteção. Cumpre US1–US5 e fornece a base para os testes E2E/integração.

---

## 1. Rotas — visibilidade e proteção

| Rota | Tipo | Pública? | Proteção aplicada | Responsável pela proteção |
|---|---|---|---|---|
| `/` | Server Component | ✅ Pública | Nenhuma (landing) | — |
| `/sign-in/[[...sign-in]]` | Server Component | ✅ Pública | Nenhuma | matcher do `proxy.ts` |
| `/sign-up/[[...sign-up]]` | Server Component | ✅ Pública | Nenhuma | matcher do `proxy.ts` |
| `/dashboard` (dentro de `(app)`) | Server Component | ❌ Privada | exige `userId` **e** `orgId` | `(app)/layout.tsx` → `requireOrgContext()` |
| `/select-organization` (dentro de `(app)`) | Server Component | ❌ Privada | exige `userId` (org opcional) | `(app)/layout.tsx` em modo "sem org" |
| `/api/whoami` | Route Handler GET | ❌ Privada | exige `userId` **e** `orgId` | handler chama `requireOrgContext()` + `unauthorized()`/`forbidden()` |
| `/api/health` (futuro) | Route Handler GET | ✅ Pública | sem PII | matcher do `proxy.ts` |

**Regra do `proxy.ts`** (resumo do contrato; código fica no plano):
- Públicas: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/health`, `/__clerk/(.*)`.
- Todo o resto chama `await auth.protect()` (Clerk redireciona para `/sign-in?redirect_url=…` em páginas; retorna 401 em handlers).

---

## 2. Layouts e componentes-chave

### `app/layout.tsx` (RootLayout)

- Envolve `<body>` com `<ClerkProvider>` (regra Clerk).
- Header global mínimo:
  - `<Show when="signed-out">` → `<SignInButton mode="redirect" />` + `<SignUpButton mode="redirect" />`.
  - `<Show when="signed-in">` → `<OrganizationSwitcher hidePersonal />` + `<UserButton />`.
- **Não** usar `<SignedIn>` / `<SignedOut>` (deprecados — usar `<Show when="…">`).

### `app/(app)/layout.tsx` (área autenticada)

```ts
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
// pseudo-código de contrato — implementação real em /speckit-tasks
```

Comportamento:
1. `await requireAuth()`.
2. Se ausente → `redirect('/sign-in')` (na prática `auth.protect()` no proxy já o fez — segundo nível de defesa).
3. Lê `orgId` via `auth()`; se ausente → `redirect('/select-organization')`.
4. Caso contrário, renderiza `children` (dashboard, etc.).

**Edge case crítico**: troca de organização durante a sessão. O `(app)/layout.tsx` deve ler `orgId` em **cada request** (não usar cache estático). Como Server Components não cacheiam dados de `auth()` por padrão e o layout é re-renderizado por mudança de cookie de sessão Clerk, isso "funciona" naturalmente; ainda assim, **não** memoizar manualmente o `orgId` em variáveis de módulo.

### `app/(app)/dashboard/page.tsx`

- Lê `OrgAuthContext` via `requireOrgContext()` (defesa em profundidade — layout já garantiu).
- Renderiza:
  - `<UserButton />` (já no header — referência apenas).
  - Saudação com nome do usuário e nome da organização ativa (obtido via `clerkClient().organizations.getOrganization({ organizationId: ctx.orgId })` quando precisar do nome legível).
  - Botões/links neutros (texto "Dashboard inicial — fatia fundacional"). Sem CTAs de negócio (vêm em fatias seguintes).

### `app/(app)/select-organization/page.tsx`

- Server Component que renderiza `<OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" afterCreateOrganizationUrl="/dashboard" />` do `@clerk/nextjs`.
- Cobre: criar nova organização, aceitar convite, selecionar uma das organizações às quais já pertence.

### `app/sign-in/[[...sign-in]]/page.tsx` e `app/sign-up/[[...sign-up]]/page.tsx`

- Cada um renderiza `<SignIn />` / `<SignUp />` do `@clerk/nextjs`.
- Reaproveitam `appearance` global definido no `<ClerkProvider>` (a configurar quando design system existir).

### `app/unauthorized.tsx` (401)

- Server Component estático.
- Mensagem amigável: "Você precisa estar autenticado para acessar esta página." + link `<a href="/sign-in">Entrar</a>`.
- Sem PII, sem detalhes técnicos.

### `app/forbidden.tsx` (403)

- Server Component estático.
- Mensagem: "Você não tem permissão para esta operação."
- Link para `/dashboard` (voltar).

---

## 3. Cenários de aceite (mapeados em testes de integração)

| Cenário | Setup | Expectativa |
|---|---|---|
| Visitante acessa `/` | sem sessão | 200, landing pública com CTAs visíveis |
| Visitante acessa `/dashboard` | sem sessão | 302 → `/sign-in?redirect_url=/dashboard` (do proxy/auth.protect) |
| Visitante acessa `GET /api/whoami` | sem sessão | 401 (`unauthorized()`) |
| Usuário autentica via `/sign-in` | credenciais válidas | 302 → `/dashboard` (ou `/select-organization` se sem org) |
| Usuário sem org acessa `/dashboard` | autenticado, sem `orgId` | 302 → `/select-organization` |
| Usuário cria 1ª org via `/select-organization` | autenticado, sem `orgId` | após sucesso → `/dashboard`; `auth()` passa a expor `orgId` |
| Usuário troca org no `<OrganizationSwitcher>` | autenticado, em `/dashboard` | dashboard re-renderiza com novo `orgId` |
| Usuário envia POST com campo `orgId='org_FAKE'` numa Server Action | autenticado em outra org | handler **ignora** o input; usa `orgId` da sessão (constituição §I) |
| Sessão expira durante navegação | cookie inválido | 302 → `/sign-in?redirect_url=…` |
| Usuário acessa rota de outra org via URL `?orgId=org_OUTRA` | autenticado em `org_MINHA` | handler ignora `?orgId`; comportamento é o de `org_MINHA` |
| Usuário aciona "sair" no `<UserButton>` | autenticado | sessão encerrada; próxima requisição a `/dashboard` redireciona para `/sign-in` |

---

## 4. Acessibilidade e semântica (baseline)

- Todos os botões de auth/org no header são componentes oficiais do Clerk → headers ARIA já vêm corretos.
- Páginas `unauthorized.tsx` / `forbidden.tsx`: usar `<main>` + `<h1>` único; link "Entrar" / "Voltar" com texto descritivo.
- Sem dependência de cor para indicar estado de auth.

---

## 5. O que **não** está nesta fatia

- Branding/`appearance` customizado dos componentes Clerk (default Clerk theme nesta entrega).
- Telas de erro estilizadas (vai junto do design system).
- Internacionalização — toda string em pt-BR cru por enquanto.
- E-mail transacional próprio (Clerk usa templates default da instância).
- Logging estruturado de eventos de auth (vai com a fatia de auditoria).
