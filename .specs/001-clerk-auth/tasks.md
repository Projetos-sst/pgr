---
description: "Task list para a fatia 'Autenticação e Organizações (Clerk)'"
---

# Tasks: Autenticação e Organizações (Clerk) — `feature/clerk-auth-foundation`

**Input**: Design documents em `specs/001-clerk-auth/`

**Prerequisites**: `plan.md` ✅ · `spec.md` ✅ · `research.md` ✅ · `data-model.md` ✅ · `contracts/server-helpers.md` ✅ · `contracts/ui-surface.md` ✅ · `quickstart.md` ✅

**Tests**: **OBRIGATÓRIOS nesta fatia** — a constituição §III exige testes unitários para lógica de negócio e testes de integração para Server Actions e Route Handlers. Tarefas de teste estão marcadas e devem ser escritas **antes** da implementação correspondente (red → green).

**Organization**: Tarefas agrupadas por user story para permitir entrega e validação independentes. Todas as 5 user stories da spec são P1 (fatia fundacional), mas existe ordem natural pelo grau de dependência sobre infra compartilhada.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos distintos, sem dependência de tarefas pendentes)
- **[Story]**: tag de user story (US1..US5)
- Caminhos absolutos a partir da raiz do repo (`/Users/dougladmo/Documents/GitHub/sst-manager` é raiz; tarefas usam paths relativos)

## Path Conventions

Monolito Next.js fullstack (decisão R-Plan §Structure Decision): `app/`, `lib/`, `tests/integration/` na raiz; testes unitários ao lado do código em `__tests__/`. Sem `src/`.

---

## Phase 1: Setup (infra compartilhada do projeto)

**Purpose**: Instalar dependências, configurar Jest, criar `.env.example` e cabeçalhos de segurança. Nada disso é específico de user story — habilita toda a fatia.

- [x] T001 Instalar dependências de runtime (`npm install @clerk/nextjs@latest @clerk/localizations zod`) — atualizar `package.json` e `package-lock.json` (`@clerk/localizations` cobre C2: traduzir widgets do Clerk para pt-BR e sustentar SC-003)
- [x] T002 Instalar dependências de teste (`npm install -D jest @types/jest @swc/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom`) — atualizar `package.json`
- [x] T003 [P] Criar `.env.example` na raiz com `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=`, `CLERK_SECRET_KEY=`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard` (sem valores reais)
- [x] T004 [P] Confirmar que `.env*.local` está no `.gitignore` (já vem do Next; só validar) e adicionar `coverage/` se ainda não estiver
- [x] T005 [P] Criar `jest.config.ts` na raiz com dois projects (`unit` em jsdom, `integration` em node), `moduleNameMapper` para alias `@/*`, transform `@swc/jest`, `setupFilesAfterEach` apontando para `jest.setup.ts`
- [x] T006 [P] Criar `jest.setup.ts` na raiz importando `@testing-library/jest-dom` e definindo mock factory padrão para `@clerk/nextjs/server` (default: anônimo; cada teste sobrescreve)
- [x] T007 Adicionar scripts em `package.json`: `"test": "jest --selectProjects unit"`, `"test:integration": "jest --selectProjects integration"`, `"typecheck": "tsc --noEmit"`
- [x] T008 [P] Adicionar baseline de cabeçalhos de segurança em `next.config.ts` via `async headers()` retornando `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (research R12)

**Checkpoint**: `npm install` passa; `npm run test` roda (sem testes ainda) sem erro de config; `npm run typecheck` passa.

---

## Phase 2: Foundational (pré-requisitos bloqueantes para TODAS as user stories)

**Purpose**: Toda US depende do Clerk montado, do `proxy.ts` deny-by-default, do `<ClerkProvider>` envolvendo a app, do DAL de identidade (`lib/auth/*`) e das páginas `unauthorized`/`forbidden`. Nada de US1–US5 começa antes deste checkpoint.

**⚠️ CRITICAL**: nenhuma user story pode iniciar até este Phase fechar.

### Tipos e erros (DAL skeleton)

- [x] T009 [P] Criar `lib/auth/types.ts` exportando `type AuthContext = { userId: string; sessionId: string }` e `type OrgAuthContext = AuthContext & { orgId: string; orgRole: string | null; orgSlug: string | null }` (data-model §Contrato de Sessão)
- [x] T010 [P] Criar `lib/auth/errors.ts` exportando `class UnauthorizedError extends Error { readonly code = 'UNAUTHORIZED' as const }` e `class NoActiveOrgError extends Error { readonly code = 'NO_ACTIVE_ORG' as const }`

### Helpers de auth (DAL) — testes primeiro

- [x] T011 [P] Escrever testes unitários em `lib/auth/__tests__/require-auth.test.ts` cobrindo os 3 casos da tabela em `contracts/server-helpers.md §requireAuth` (anônimo → throws; sessão inválida → throws; autenticado → retorna contexto). Mockar `@clerk/nextjs/server`.
- [x] T012 [P] Escrever testes unitários em `lib/auth/__tests__/require-org-context.test.ts` cobrindo os 3 casos da tabela em `contracts/server-helpers.md §requireOrgContext` (anônimo → UnauthorizedError; sem org → NoActiveOrgError; com org → contexto completo)
- [x] T013 Implementar `lib/auth/require-auth.ts` começando com `import 'server-only'`, importando `auth` de `@clerk/nextjs/server`, retornando `AuthContext` ou lançando `UnauthorizedError` conforme contrato (faz T011 passar)
- [x] T014 Implementar `lib/auth/require-org-context.ts` com `import 'server-only'`, reusando `requireAuth()` + leitura de `orgId/orgRole/orgSlug` direto de `auth()`; lança `NoActiveOrgError` se sem org (faz T012 passar)

### Validação Zod compartilhada

- [x] T015 [P] Criar `lib/validation/parse.ts` com `parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T` que faz `schema.parse(input)` e converte `ZodError` em mensagem genérica (sem expor caminho do campo no erro propagado ao cliente)
- [x] T015a [P] **U1** — Criar `lib/validation/__tests__/parse.test.ts` cobrindo: (a) happy path retorna o valor parseado tipado; (b) input inválido lança erro **sem** vazar o caminho do campo nem o input original (FR-020); (c) compila em strict mode sem `any`. Garante que o padrão de validação está exercitado nesta fatia mesmo sem SA/RH com input próprio

### Proxy (Next.js 16) + ClerkProvider

- [x] T016 Criar `proxy.ts` na raiz com `clerkMiddleware()` deny-by-default: `createRouteMatcher` lista rotas públicas (`/`, `/sign-in(.*)`, `/sign-up(.*)`, `/__clerk/(.*)`); todo resto chama `await auth.protect()`. Exportar `config.matcher` exatamente como em `research.md §R1` (skip Next internals + sempre rodar para `(api|trpc)(.*)` e `/__clerk/(.*)`)
- [x] T017 Modificar `app/layout.tsx` para envolver `<body>` com `<ClerkProvider localization={ptBR}>` (importar `ptBR` de `@clerk/localizations`); remover meta `Create Next App` e ajustar `<html lang="pt-BR">`. Importar `ClerkProvider, SignInButton, SignUpButton, Show, UserButton, OrganizationSwitcher` de `@clerk/nextjs`. Não renderizar header ainda (entra na T018)
- [x] T018 Adicionar header global em `app/layout.tsx` dentro do `<ClerkProvider>`: `<Show when="signed-out">` com `<SignInButton mode="redirect">Entrar</SignInButton>` + `<SignUpButton mode="redirect">Criar conta</SignUpButton>`; `<Show when="signed-in">` com `<OrganizationSwitcher hidePersonal />` + `<UserButton />`. NÃO usar `<SignedIn>`/`<SignedOut>` (deprecados — research R4)

### Páginas de erro padrão (Next.js 16 helpers)

- [x] T019 [P] Criar `app/unauthorized.tsx` (Server Component) — `<main>` com `<h1>` "Você precisa estar autenticado" + link `<a href="/sign-in">Entrar</a>`. Sem PII, sem stack
- [x] T020 [P] Criar `app/forbidden.tsx` (Server Component) — `<main>` com `<h1>` "Você não tem permissão" + link `<a href="/dashboard">Voltar ao painel</a>`

**Checkpoint**: `npm run test` mostra `require-auth` + `require-org-context` verdes. `npm run typecheck` passa. `npm run dev` sobe sem erros. Acessar `/dashboard` ainda 404 (não criado), mas qualquer rota não-pública é interceptada pelo `proxy.ts` redirecionando para `/sign-in`. **Foundation pronta**.

---

## Phase 3: User Story 1 — Login do usuário existente (P1) 🎯 MVP

**Goal**: Usuário cadastrado consegue autenticar via `/sign-in` e ser redirecionado para a área autenticada.

**Independent Test**: navegador anônimo abre `/`, clica "Entrar", conclui login com usuário existente, é redirecionado para `/dashboard` (criado na US3) **ou** para `/select-organization` (criado na US4) caso não tenha org. Se US3/US4 ainda não existirem, o redirect cairá em rota inexistente — isso é esperado e cobre apenas o fluxo de login em si.

### Tests for User Story 1 ⚠️

- [x] T021 [P] [US1] Criar `tests/integration/sign-in-page.test.ts` (project `integration`) renderizando `app/sign-in/[[...sign-in]]/page.tsx` e assertando que monta o `<SignIn />` do Clerk com `path="/sign-in"` (mock superficial do componente Clerk)

### Implementation for User Story 1

- [x] T022 [US1] Criar rota catch-all `app/sign-in/[[...sign-in]]/page.tsx` (Server Component) que renderiza `<SignIn />` de `@clerk/nextjs` com `path="/sign-in"`. Sem `appearance` customizado nesta fatia (default Clerk theme)
- [x] T023 [US1] Atualizar `app/page.tsx` (landing) para texto neutro do SST Manager + CTAs visíveis pertencentes ao header (não duplicar `<SignInButton>` no corpo se já estiver no header). Garantir layout responsivo Tailwind v4 (`@theme inline` em `globals.css` é a única fonte de tokens)

**Checkpoint**: Acessar `/sign-in` exibe widget Clerk; após login válido o Clerk redireciona para `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard` (criado depois). `npm run test:integration` verde para T021. Sign-out via `<UserButton>` no header funciona (provém do Clerk).

---

## Phase 4: User Story 2 — Cadastro de nova conta (P1)

**Goal**: Visitante consegue criar conta via `/sign-up` e termina autenticado.

**Independent Test**: navegador anônimo abre `/`, clica "Criar conta", completa o sign-up com e-mail novo, conclui — sessão fica ativa e a UI no header passa de "signed-out" para "signed-in".

### Tests for User Story 2 ⚠️

- [x] T024 [P] [US2] Criar `tests/integration/sign-up-page.test.ts` (project `integration`) renderizando `app/sign-up/[[...sign-up]]/page.tsx` e assertando que monta o `<SignUp />` do Clerk com `path="/sign-up"`

### Implementation for User Story 2

- [x] T025 [US2] Criar rota catch-all `app/sign-up/[[...sign-up]]/page.tsx` (Server Component) que renderiza `<SignUp />` de `@clerk/nextjs` com `path="/sign-up"`

**Checkpoint**: `/sign-up` exibe widget; após cadastro o usuário cai em `/dashboard` (que existirá após US3) ou em `/select-organization` (US4). Header alterna para estado "signed-in". `npm run test:integration` cobre T024.

---

## Phase 5: User Story 3 — Página inicial autenticada (P1)

**Goal**: Usuário autenticado vê a página inicial confirmando login (identidade + organização ativa quando houver).

**Independent Test**: usuário autenticado em sessão com org ativa abre `/dashboard` e vê seu identificador (via `<UserButton>` no header) + nome da organização ativa renderizado no corpo. Sem sessão, é redirecionado para `/sign-in`.

### Tests for User Story 3 ⚠️

- [x] T026 [P] [US3] Criar `tests/integration/dashboard-guard.test.ts` (project `integration`) cobrindo: (a) sem sessão → layout faz `redirect('/sign-in')`; (b) com sessão sem org → layout faz `redirect('/select-organization')`; (c) com sessão + org → page renderiza userId + orgId via `requireOrgContext()`; (d) **C6** — header autenticado renderiza `<UserButton>` (asserção mínima de que a ação "sair" da FR-003 está visível no DOM)
- [x] T027 [P] [US3] Criar `tests/integration/whoami-action.test.ts` cobrindo casos da tabela em `contracts/server-helpers.md §whoamiAction` — incluindo o caso "cliente envia orgId via input, handler ignora e usa orgId da sessão"

### Implementation for User Story 3

- [x] T028 [US3] Criar `app/(app)/layout.tsx` (Server Component): chama `await requireAuth()`; se lançar `UnauthorizedError` faz `redirect('/sign-in')`; lê `orgId` via `auth()` direto; se ausente faz `redirect('/select-organization')`; renderiza `{children}`. **Não** memoizar `orgId` em escopo de módulo (research R-ui-surface §Edge case crítico)
- [x] T029 [US3] Criar `lib/server/actions/whoami.ts` com `"use server"`, `import 'server-only'` (via DAL), `export async function whoamiAction(): Promise<{ userId: string; orgId: string }>` chamando `requireOrgContext()`. NÃO aceitar `orgId` como input
- [x] T030 [US3] Criar `app/(app)/dashboard/page.tsx` (Server Component async) — chama `requireOrgContext()` (defesa em profundidade), busca nome da org via `clerkClient().organizations.getOrganization({ organizationId: orgId })`, renderiza saudação + nome da organização + texto "Fatia fundacional — área autenticada". Sem CTAs de negócio
- [x] T031 [US3] Criar `app/api/whoami/route.ts` (Route Handler `GET`) que chama `requireOrgContext()` e retorna `NextResponse.json({ userId, orgId })`; no `catch`, `UnauthorizedError` → `unauthorized()` de `next/navigation`, `NoActiveOrgError` → `NextResponse.json({ error: 'NO_ACTIVE_ORG' }, { status: 409 })`

**Checkpoint**: usuário autenticado COM org ativa vê dashboard com nome da org; SEM org é redirecionado para `/select-organization` (criada na US4). `GET /api/whoami` autenticado responde 200 com `{userId, orgId}`; sem sessão responde 401. `npm run test:integration` cobre T026 + T027.

---

## Phase 6: User Story 4 — Selecionar ou entrar em uma organização (P1)

**Goal**: Usuário autenticado sem org ativa entra num fluxo que permite criar org ou entrar em existente; após escolha, sessão reflete a nova org e operações subsequentes são escopadas por ela.

**Independent Test**: usuário recém-cadastrado (sem org) tenta acessar `/dashboard` e é redirecionado para `/select-organization`. Cria org "ACME Segurança" via UI. Volta para `/dashboard` mostrando "ACME Segurança". No header, `<OrganizationSwitcher>` permite criar segunda org "ACME Filial" e alternar — dashboard re-renderiza com a nova org.

### Tests for User Story 4 ⚠️

- [x] T032 [P] [US4] Criar `tests/integration/select-organization-page.test.ts` renderizando `app/(app)/select-organization/page.tsx` mockando `requireAuth()` para usuário autenticado sem org; assertar que `<OrganizationList hidePersonal />` é montado com `afterSelectOrganizationUrl="/dashboard"` e `afterCreateOrganizationUrl="/dashboard"`. **C3**: incluir caso que confirma que a lista exibe convites pendentes quando o mock de `auth()`/Clerk traz `pendingInvitations` — fecha FR-011
- [x] T033 [P] [US4] Adicionar caso de teste em `tests/integration/whoami-action.test.ts` (criado em T027): "troca de org no meio da execução" — duas chamadas consecutivas a `whoamiAction()` com `auth()` mockada para orgs diferentes devem retornar `orgId` distintos sem cache cruzado

### Implementation for User Story 4

- [x] T034 [US4] Criar `app/(app)/select-organization/page.tsx` (Server Component) chamando `requireAuth()` (não `requireOrgContext()` — aqui org é opcional) e renderizando `<OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" afterCreateOrganizationUrl="/dashboard" />` de `@clerk/nextjs`
- [x] T035 [US4] Conferir que `<OrganizationSwitcher hidePersonal />` no header (T018) está com props necessárias (`afterSelectOrganizationUrl="/dashboard"`, `afterCreateOrganizationUrl="/dashboard"`); ajustar se faltar
- [x] T036 [US4] Documentar em `specs/001-clerk-auth/quickstart.md` §2 que **na instância Clerk Dashboard** o operador precisa: habilitar Organizations, desabilitar Personal Accounts, **permitir convites de membros (Allow members to invite)** e **definir o papel default do convidado** (`org:member`) — atende FR-010, FR-011 e o caminho de aceite usado por C3 / T032

**Checkpoint**: visitante recém-cadastrado completa fluxo até dashboard com org ativa em <3min (SC-003). Troca de org via `<OrganizationSwitcher>` reflete instantaneamente em `/dashboard` e em `GET /api/whoami` (SC-006).

---

## Phase 7: User Story 5 — Bloqueio universal de funcionalidades de negócio sem autenticação (P1)

**Goal**: Garantia transversal: **toda** rota de negócio, Server Action ou Route Handler desta fatia nega acesso sem sessão; **nenhum** input do cliente influencia `orgId`.

**Independent Test**: bateria de testes de integração cobre cada superfície protegida desta fatia provando os 3 acceptance scenarios da US5 — sem sessão, sem org, e tentativa de forçar tenant via input.

### Tests for User Story 5 ⚠️ (transversais)

- [x] T037 [P] [US5] Criar `tests/integration/proxy-protection.test.ts` simulando matcher do `proxy.ts` (testar `createRouteMatcher` com lista de rotas privadas: `/dashboard`, `/select-organization`, `/api/whoami`) e assertando que cada uma resulta em `auth.protect()` sendo chamado quando sessão é anônima
- [x] T038 [P] [US5] Criar `tests/integration/auth-guards.test.ts` consolidando: (a) `whoamiAction` rejeita sem sessão; (b) `whoamiAction` rejeita sem org; (c) `whoamiAction` ignora `orgId` passado como parâmetro extra; (d) `GET /api/whoami` retorna 401 sem sessão; (e) `GET /api/whoami?orgId=org_FAKE` autenticado retorna o `orgId` da SESSÃO, nunca do query — alinhado às 4 linhas da tabela em `contracts/server-helpers.md`. **C4** — adicionar 2 sub-casos extras de tenant-injection: (e2) `POST` para `whoamiAction` via Server Action com `FormData.append('orgId', 'org_FAKE')` é ignorado; (e3) `GET /api/whoami` com header `X-Org-Id: org_FAKE` é ignorado. **C1** (FR-020 no-leak) — adicionar 3 asserções: (f) body do 401 NÃO contém keys `stack`, `error`, `email`, `userId`; (g) body do 409 `NO_ACTIVE_ORG` contém apenas `{ error: 'NO_ACTIVE_ORG' }` (zero PII); (h) resultado de Server Action `{ ok:false, error:'…' }` não inclui `Error.message` cru nem propriedade `stack`
- [x] T039 [US5] **A1** — Auditar via grep refinado (apenas código de produto, sem testes nem comentários):
      `grep -RIn --include='*.ts' --include='*.tsx' --exclude-dir=__tests__ --exclude-dir=node_modules -E "(request\\.headers\\.get\\(.*org|searchParams\\.get\\(.*orgId|formData\\.get\\(.*orgId|cookies\\(\\)\\.get\\(.*org)" app/api lib/server lib/auth`
      garantindo que NENHUM handler de negócio lê `orgId`/tenant de input do cliente. **C5** — Documentar no comentário final de `tests/integration/auth-guards.test.ts`: (i) o resultado do grep (esperado: vazio); (ii) que o edge case "acessar org à qual não pertence" é estruturalmente impossível nesta fatia (sem recursos org-escoped/DB) e será coberto com fixtures de banco na primeira fatia com persistência

**Checkpoint**: 100% das superfícies introduzidas nesta fatia passam os 3 cenários da US5 (SC-001, SC-002, SC-005). `npm run test:integration` fica verde com todos os testes; `npm run test` verde para unit; `npm run typecheck` e `npm run lint` verdes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Aparar arestas, atualizar docs, rodar quickstart manual e validar quality gates antes de declarar a fatia concluída.

- [x] T040 [P] Atualizar `README.md` com seção "Como rodar" curta apontando para `specs/001-clerk-auth/quickstart.md` (não duplicar conteúdo)
- [x] T041 [P] Conferir que `CLAUDE.md` (bloco SPECKIT) continua apontando para `specs/001-clerk-auth/plan.md` e demais artefatos — ajustar se algum path mudou
- [x] T042 Executar `quickstart.md` §5 (smoke manual de 10 passos) em ambiente local com instância Clerk dev; registrar resultados no PR
- [x] T043 Rodar os quality gates finais e anexar saída ao PR: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration` — todos MUST passar (SC-008, constituição §III)
- [x] T044 Conferir que `grep -RIn "console.log\\|TODO" app lib | grep -v __tests__` retorna vazio (sem ruído de desenvolvimento)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → sem dependências; inicia imediatamente
- **Phase 2 (Foundational)** → depende de Phase 1; **BLOQUEIA todas as user stories**
- **Phase 3 (US1)** → depende de Phase 2
- **Phase 4 (US2)** → depende de Phase 2 (independente de US1)
- **Phase 5 (US3)** → depende de Phase 2 + criação da rota `/dashboard`; o redirect de US3 referencia `/select-organization` (criada em US4), mas o teste de redirect só precisa que `redirect()` seja chamado — pode rodar antes de US4 com `/select-organization` retornando 404 temporariamente
- **Phase 6 (US4)** → depende de Phase 2; integra naturalmente com US3
- **Phase 7 (US5)** → depende de US1, US3 e US4 (precisa das superfícies para testar)
- **Phase 8 (Polish)** → depende de US1–US5 completas

### User Story Dependencies (resumo)

- **US1 (Login)**: independente de US2, US3, US4. Pode ser entregue isoladamente como sub-MVP.
- **US2 (Cadastro)**: independente das outras. Pode ser entregue isoladamente.
- **US3 (Dashboard)**: precisa de US1 ou US2 funcionando para haver sessão; mecanicamente independente dos arquivos das outras.
- **US4 (Org)**: complementa US3 (sem US4, usuário sem org fica em redirect-loop em prod; em testes funciona porque mockamos `auth()`).
- **US5 (Bloqueio)**: transversal — valida o conjunto.

### Within Each User Story

1. Tests primeiro (red).
2. Implementação até virar verde.
3. Sem cross-references quebradas entre stories.

### Parallel Opportunities

- **Phase 1**: T003, T004, T005, T006, T008 em paralelo após T001+T002
- **Phase 2**: T009, T010, T011, T012, T015, T019, T020 em paralelo (arquivos distintos); T013/T014 sequenciais após T009/T010/T011/T012
- **US1 e US2**: podem ser feitas em paralelo por devs diferentes (rotas independentes)
- **US3 testes** (T026, T027) em paralelo
- **US4 testes** (T032, T033) em paralelo
- **US5 testes** (T037, T038) em paralelo

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Após T001+T002 (deps instaladas), disparar em paralelo:
Task: "T009 — criar lib/auth/types.ts"
Task: "T010 — criar lib/auth/errors.ts"
Task: "T011 — testes unit require-auth"
Task: "T012 — testes unit require-org-context"
Task: "T015 — lib/validation/parse.ts"
Task: "T019 — app/unauthorized.tsx"
Task: "T020 — app/forbidden.tsx"

# Depois (sequenciais, pois dependem dos arquivos acima):
Task: "T013 — implementar require-auth (faz T011 passar)"
Task: "T014 — implementar require-org-context (faz T012 passar)"
Task: "T016 — proxy.ts"
Task: "T017 — ClerkProvider no layout"
Task: "T018 — header com Show + buttons"
```

## Parallel Example: User Story 1

```bash
Task: "T021 — teste de integração sign-in-page"
# então:
Task: "T022 — rota /sign-in"
Task: "T023 — landing atualizada"
```

---

## Implementation Strategy

### MVP first (sub-MVP demonstrável)

A spec classifica todas as 5 USs como P1, mas para entregas incrementais use:

1. **Sub-MVP** = Phase 1 + Phase 2 + US1 (login) + US3 (dashboard mínimo lendo `auth()` sem org) — prova ponta-a-ponta: visitante → login → área autenticada protegida.
2. **MVP completo da fatia** = + US2 (cadastro) + US4 (organização) + US5 (bloqueio universal).

### Incremental delivery

1. Setup + Foundational → testes verdes para helpers.
2. - US1 → /sign-in funcional, login redireciona para 404 do /dashboard.
3. - US3 → dashboard renderiza para quem tem sessão+org; quem não tem org cai em 404 de /select-organization (esperado até US4).
4. - US4 → fluxo de org completo.
5. - US2 → cadastro fechando o ciclo de vida.
6. - US5 → bateria transversal valida a fatia inteira.
7. Polish → quality gates.

### Parallel team strategy

Com 2+ devs após Phase 2:

- Dev A: US1 + US3.
- Dev B: US2 + US4.
- Dev A ou Dev C: US5 (transversal, fecha por último).

---

## Notes

- **Tests are MANDATORY** nesta fatia (constituição §III); não pular nenhuma tarefa de teste.
- `[P]` = arquivos diferentes, sem dep pendente.
- `[Story]` rastreia para a US — não cruzar stories no mesmo arquivo.
- Verificar testes vermelhos antes de implementar (red → green).
- Commit por tarefa ou grupo lógico — branch é `feature/clerk-auth-foundation`.
- Cada checkpoint é momento de parar e validar.
- Antes do PR, T043 é obrigatório: `npm run lint && npm run typecheck && npm run test && npm run test:integration`.
