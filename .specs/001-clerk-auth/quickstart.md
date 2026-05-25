# Quickstart — Autenticação e Organizações (Clerk)

**Feature**: `feature/clerk-auth-foundation` · **Branch**: `feature/clerk-auth-foundation`

Guia rápido para subir, validar e demonstrar esta fatia depois que `/speckit-implement` rodar. Antes da implementação, use este documento para confirmar que o plano é executável.

---

## 1. Pré-requisitos

- Node.js 20+ (compatível com Next.js 16).
- Conta no [Clerk](https://dashboard.clerk.com) com uma instância (development).
- Acesso ao repositório local em `feature/clerk-auth-foundation`.

---

## 2. Configuração da instância Clerk (uma vez)

Em `dashboard.clerk.com`, na instância. Estas settings implementam as **regras de negócio** do SST Manager (invite-only B2B, máx 5 orgs/usuário, sem self-create de org):

1. **User & Authentication** → **Restrictions**
   - Sign-up modes: **Restricted** (bloqueia auto-cadastro; novos usuários só entram via convite — regra 1)
2. **Organizations** → **Enable Organizations**: ON
3. **Organizations** → **Settings**
   - "Personal accounts": **OFF** (B2B-first)
   - "Allow users to create organizations": **OFF** (orgs só são criadas via Backend API / Clerk Dashboard pelo time admin — reforça regra 3)
   - "Maximum number of organizations per user": **5** (regra 2 — aplicada também em `lib/auth/policy.ts` como defesa em profundidade)
   - "Allow members to invite": **ON** (admin da org convida novos usuários — regra 3)
   - Default role para convites: `org:member`
4. **User & Authentication** → Email/password: **ON** (mínimo desta fatia)
5. Copiar **Publishable key** e **Secret key** (aba "API Keys")
6. **(Opcional, recomendado em prod)** **DNS & domains** → **Proxying** → habilitar
   - Configurar **Proxy URL**: `https://app.seu-dominio.com/__clerk`
   - Em dev local: `http://localhost:3000/__clerk`
   - Esconde o subdomínio `*.clerk.accounts.dev` das chamadas no browser. Setar também `NEXT_PUBLIC_CLERK_PROXY_URL` no `.env.local` com o mesmo valor.
   - A app já vem com o handler `app/api/__clerk/[[...path]]/route.ts` e `frontendApiProxy: { enabled: true }` no `proxy.ts`. Basta ligar no Dashboard + setar a env.

> 🔒 As regras 1–4 da fatia atual dependem destas settings. A aplicação faz defesa em profundidade via `requireOrgContext()` (tenant) e `lib/auth/policy.ts` (cota de orgs), mas a barreira primária é o Clerk Dashboard.

---

## 3. Variáveis de ambiente

Criar `.env.local` na raiz (não versionado — `.gitignore` cobre):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

> As URLs de rota (`/sign-in`, `/sign-up`, fallbacks `/dashboard`) são configuradas como **props no `<ClerkProvider>`** em `app/layout.tsx` — não dependem de env vars. O arquivo `.env.example` (versionado) contém apenas as duas chaves acima como placeholders vazios.

---

## 4. Instalação e execução

```bash
npm install            # instala next, react, clerk, zod, jest, RTL etc.
npm run lint           # eslint flat
npm run test           # unit
npm run test:integration
npm run dev            # http://localhost:3000
```

Quality gates desta fatia (constituição §III): todos os quatro comandos acima MUST passar antes do merge.

---

## 5. Roteiro de validação manual (smoke)

> Execute do estado limpo (browser anônimo).

| #   | Passo                                                                                          | Resultado esperado                                                            |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `http://localhost:3000/`                                                                       | Landing pública, header com apenas "Entrar" (sem "Criar conta" — invite-only) |
| 2   | Tentar `http://localhost:3000/dashboard` direto                                                | Redireciona para `/sign-in?redirect_url=…`                                    |
| 3   | Tentar `GET http://localhost:3000/api/whoami`                                                  | HTTP 401                                                                      |
| 4   | Acessar `/sign-up` direto, sem `__clerk_ticket`                                                | Página exibe "Cadastro por convite" + link para `/sign-in` (sem widget Clerk) |
| 5   | No Clerk Dashboard: criar org "ACME Segurança" + convidar `seu-email@…` como `org:member`      | Você recebe e-mail com link contendo `?__clerk_ticket=…`                      |
| 6   | Abrir link do convite (cai em `/sign-up?__clerk_ticket=…`)                                     | Widget `<SignUp />` aparece; completar cadastro                               |
| 7   | Após cadastro completo, redireciona para `/dashboard`                                          | Exibe nome do usuário e nome da org "ACME Segurança"                          |
| 8   | `GET http://localhost:3000/api/whoami` autenticado                                             | 200, JSON `{ userId, orgId }`                                                 |
| 9   | Header: `<OrganizationSwitcher>` — **não** deve mostrar "Criar nova organização" (setting OFF) | Apenas alternar entre orgs existentes                                         |
| 10  | Forjar `curl 'http://localhost:3000/api/whoami?orgId=org_FAKE'` autenticado                    | Resposta usa `orgId` da sessão; `?orgId` é ignorado                           |
| 11  | Header: `<UserButton>` → Sign out                                                              | Volta para landing; passo 2 reproduz redirect                                 |
| 12  | Aguardar expiração (ou apagar cookie de sessão) e tentar `/dashboard`                          | Redireciona para `/sign-in`                                                   |

Cada item acima tem teste automatizado correspondente em `tests/integration/`.

---

## 6. Como checar conformidade com a constituição

| Princípio                | Checagem prática                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| §I Multi-Tenant          | `grep -RIn "request.headers" app/api lib/server` não deve encontrar leitura de `orgId` vinda do cliente. `requireOrgContext()` é o único caminho. |
| §II Stack Fixa           | `package.json` ganha apenas: `@clerk/nextjs`, `zod`, e libs de teste (jest, ts-jest/@swc/jest, RTL, jest-environment-jsdom). Nada mais.           |
| §III Fatia Vertical      | `npm run test && npm run test:integration && npm run lint && npx tsc --noEmit` passam.                                                            |
| §IV Async Pesado         | N/A (sem operação pesada).                                                                                                                        |
| §V Segurança/Integridade | Nenhum `.env*` (exceto `.env.example`) versionado; helpers `lib/auth/*` começam com `import 'server-only'`.                                       |

---

## 7. Deploy (Vercel) — checklist

- Variáveis `NEXT_PUBLIC_CLERK_*` e `CLERK_SECRET_KEY` configuradas no Project → Settings → Environment Variables.
- Domínio adicionado no Clerk Dashboard (Frontend API allowed origins).
- Cloudflare apontado para a Vercel; HSTS e demais headers do `next.config.ts` devem aparecer em `curl -I https://<dominio>`.

---

## 8. Troubleshooting rápido

- **"Auth.protect was called with no session"** no proxy → faltou `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` em build/dev.
- **Loop infinito de redirect** entre `/sign-in` e `/dashboard` → `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` aponta para rota protegida sem org; ajustar para `/dashboard` (que então redireciona para `/select-organization`).
- **`<OrganizationSwitcher>` vazio** → "Organizations" não habilitado na instância Clerk (passo 2).
- **Build falha por `import 'server-only'`** em arquivo importado por Client Component → mover a chamada para um Server Component ou um helper async aceitando os dados como argumento.

---

## 9. Próximos passos (após esta fatia)

1. `/speckit-tasks` — gerar tasks.md.
2. `/speckit-implement` — executar tasks (com testes verde antes de cada commit).
3. Hardening: CSP estrita com domínios do Clerk (fatia separada).
4. Primeira fatia de negócio (provavelmente "Empresa / Cadastro Inicial") usa `requireOrgContext()` e introduz o adapter de SQLite em memória para integração.
