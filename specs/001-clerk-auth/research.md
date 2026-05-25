# Phase 0 — Research: Autenticação e Organizações (Clerk)

**Feature**: `feature/clerk-auth-foundation` · **Date**: 2026-05-24

Esta fase resolve dúvidas técnicas relevantes para a fatia. A constituição já fixa Clerk + Next.js + Supabase + Vercel + Cloudflare como stack — as decisões aqui detalham **como** integrar Clerk no Next.js 16 e **como** estruturar guards/testes.

---

## R1 — Substituto do `middleware.ts` em Next.js 16: `proxy.ts`

**Decision**: Criar `proxy.ts` na raiz do repositório com `clerkMiddleware()` de `@clerk/nextjs/server`. Não usar `middleware.ts`.

**Rationale**:
- Next.js 16 renomeou o conceito de Middleware para "Proxy" (breaking change major) e o arquivo passa a se chamar `proxy.ts`. O AGENTS.md alerta para essa mudança e o prompt oficial do Clerk para Next.js 16 prescreve exatamente `proxy.ts`.
- A documentação do Clerk confirma o uso de `proxy.ts` com `clerkMiddleware()` para Next.js 16 (validado via consulta a `/clerk/clerk-docs`).
- Matcher precisa incluir `'/__clerk/(.*)'` para que o auto-proxy path do Clerk seja roteado (requisito do SDK).

**Alternatives considered**:
- `middleware.ts` com `authMiddleware()` (legado): **rejeitado** — `authMiddleware` está deprecado e `middleware.ts` é nome legado em Next.js 16.
- Sem proxy, validando só em layouts: **rejeitado** — perde proteção em Route Handlers e Server Actions; deixa janela para acessos diretos a APIs.

---

## R2 — Estratégia de proteção: proxy "deny-by-default" + helpers server

**Decision**: O `clerkMiddleware()` no `proxy.ts` chama `await auth.protect()` para tudo que **não** estiver em rotas públicas (`/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/health` se houver). Em camada server (Server Actions, Route Handlers, Server Components da área autenticada), helpers `requireAuth()` e `requireOrgContext()` revalidam a sessão e retornam o contexto tipado.

**Rationale**:
- Defesa em profundidade: o proxy bloqueia o trânsito; os helpers garantem que **nenhum código de negócio rode** sem checagem explícita, mesmo se alguém esquecer de registrar a rota no matcher.
- Helpers padronizam o ponto de obtenção de `(userId, orgId)`, evitando que cada handler reinvente o guard (e introduza bugs de tenant — risco crítico da constituição §I).
- `auth.protect()` é o método recomendado pelo Clerk para proteção declarativa de rotas em Next.js (confirmado via docs Clerk).

**Alternatives considered**:
- Whitelist no proxy (`isPublicRoute`) + sem helpers: **rejeitado** — viola defesa em profundidade; sem helper, o `auth()` é chamado direto em cada handler com risco de inconsistência (alguns checam `userId`, outros não checam `orgId`, ninguém testa redirecionamento).
- Proteção apenas no layout do route group `(app)`: **rejeitado** — não protege Route Handlers (que vivem em `app/api/*` fora do route group) e não protege Server Actions invocadas a partir de Server Components do route group `(public)`.

---

## R3 — Origem do `(userId, orgId)` no servidor

**Decision**: Usar `await auth()` de `@clerk/nextjs/server`. O retorno fornece `{ isAuthenticated, userId, orgId, has, sessionId }`. `userId` e `orgId` são extraídos exclusivamente dessa fonte.

**Rationale**:
- API oficial do Clerk; valor é resolvido a partir do cookie de sessão criptografado e validado pelo middleware/proxy — nunca de input do usuário.
- Atende diretamente a §I da constituição: tenant da sessão, nunca do cliente.

**Alternatives considered**:
- Ler `orgId` de header customizado enviado pelo cliente (ex.: para "trocar de org" via API): **rejeitado** — abre vetor para forçar tenant arbitrário. Troca de org é feita pela UI via `<OrganizationSwitcher>` que atualiza a sessão do Clerk.

---

## R4 — Fluxos de UI: rotas catch-all hospedadas pelo Clerk

**Decision**: Criar rotas catch-all `app/sign-in/[[...sign-in]]/page.tsx` e `app/sign-up/[[...sign-up]]/page.tsx` montando `<SignIn />` e `<SignUp />` do `@clerk/nextjs`. Header da app expõe `<SignInButton mode="redirect">`, `<SignUpButton mode="redirect">`, `<UserButton>` e `<OrganizationSwitcher>` controlados por `<Show when="signed-in|signed-out">`.

**Rationale**:
- Catch-all routes são o padrão recomendado pelo Clerk para Next.js App Router e suportam fluxos multi-etapa (verificação por e-mail, MFA futuro, etc.) sem reescrever roteamento.
- `<Show>` é a API atual; `<SignedIn>`/`<SignedOut>` estão deprecadas (regra explícita do prompt Clerk).
- `<OrganizationSwitcher>` cobre criar org, alternar org e gerenciar membros — atende US4 com componente único e dispensa código próprio nesta fatia.
- Páginas dedicadas (em vez de só modais) facilitam deep-link, SEO da landing e futuras customizações de branding.

**Alternatives considered**:
- Apenas `<SignInButton mode="modal">` sem rotas dedicadas: **rejeitado** — sem URL própria, perde deep-link e dificulta integração futura com convites por e-mail (que redirecionam para `/sign-up?__clerk_ticket=...`).
- UI customizada totalmente própria sobre `useSignIn()/useSignUp()`: **rejeitado** — escopo desproporcional para esta fatia (YAGNI, §II).

---

## R5 — Fluxo "usuário sem organização ativa"

**Decision**: O layout do route group `(app)` chama `requireAuth()` e, se `orgId` for ausente, redireciona para `/select-organization`. Essa página monta `<OrganizationList hidePersonal />` (ou `<CreateOrganization />` + `<OrganizationSwitcher />`) para o usuário criar nova org ou aceitar/entrar em uma existente. Após a primeira escolha, o Clerk atualiza a sessão e o usuário volta para `/dashboard`.

**Rationale**:
- Centraliza o ponto de decisão "preciso de org" em um único redirect; nenhuma página de negócio precisa replicar essa lógica.
- `hidePersonal` desabilita a "Personal Account" do Clerk (não faz sentido em SaaS B2B onde dados são SEMPRE da empresa).
- O dashboard fica simples: assume que `orgId` existe porque o layout já garantiu.

**Alternatives considered**:
- Permitir conta pessoal como fallback: **rejeitado** — quebraria o princípio de isolamento por organização (§I) e criaria caminhos para dados "órfãos" sem tenant.
- Forçar criação de org no cadastro (pre-sign-up form): **rejeitado** — atrasa o primeiro acesso, torna o cadastro mais frágil, e o Clerk já oferece um caminho pronto após o sign-up.

---

## R6 — Validação de entrada com Zod em Server Actions/Route Handlers

**Decision**: Adicionar `zod` como dependência e padronizar todas as Server Actions e Route Handlers desta fatia (e seguintes) a validarem suas entradas com schemas Zod antes de tocar qualquer recurso. Helper `parseOrThrow(schema, input)` em `lib/validation/parse.ts` para uniformizar o erro.

**Rationale**:
- Constituição §V exige validação de schema antes do banco — Zod é a escolha mais comum no ecossistema Next.js/TS, com inferência de tipos e zero runtime adicional relevante.
- Mesmo nesta fatia, onde quase não há input (apenas o `whoami` de exemplo), introduzir o padrão evita que fatias futuras "esqueçam" a validação.

**Alternatives considered**:
- `valibot` / `arktype`: **rejeitado** por enquanto — Zod é mais maduro e bem documentado; YAGNI sugere padrão comum.
- Validação manual (`typeof`, `if`): **rejeitado** — verboso, fácil de errar, dificulta tipagem.

---

## R7 — Infraestrutura de testes (Jest + Testing Library)

**Decision**: Adicionar Jest (`jest`, `ts-jest` ou `@swc/jest`, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`). Configurar `jest.config.ts` com dois projetos:
- `unit` — jsdom, padrão `**/__tests__/**/*.test.ts(x)`, mocks padrão de `@clerk/nextjs/server`.
- `integration` — node, padrão `tests/integration/**/*.test.ts`, mocks de `auth()` por cenário.

Scripts no `package.json`:
- `"test": "jest --selectProjects unit"`
- `"test:integration": "jest --selectProjects integration"`

**Rationale**:
- Constituição §III (Fluxo de Desenvolvimento) define Jest + Testing Library como ferramentas. SQLite em memória é prescrito **quando** há DB; esta fatia não tem DB, então a configuração de SQLite é deferida.
- Dois projects mantém os comandos `npm run test` e `npm run test:integration` separados, conforme constituição, sem precisar de outro runner.
- Para esta fatia, mockar `auth()` é o caminho correto: o objetivo do teste de integração é provar que o **guard** se comporta corretamente diante de sessões reais ou ausentes, não testar a infraestrutura do Clerk (que é responsabilidade do fornecedor).

**Alternatives considered**:
- Vitest: **rejeitado** — constituição cita Jest explicitamente; trocar de runner é uma decisão de stack e exigiria emenda.
- Playwright para E2E real contra Clerk: **rejeitado nesta fatia** (escopo + custo) — E2E pode entrar em fatias posteriores quando houver mais superfície.
- SQLite em memória já configurado: **deferido** — primeira fatia com persistência (provavelmente "funcionários" ou "empresas-cadastro") configura `better-sqlite3` + adapter Drizzle/Prisma; aqui seria YAGNI.

---

## R8 — Variáveis de ambiente e segredos

**Decision**: Criar `.env.example` no repo com as chaves esperadas (sem valores reais). `.env.local` é gitignored (já configurado pelo `.gitignore` padrão do Next).

Variáveis:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

**Rationale**:
- Atende SC-007 (zero segredos versionados) e constituição §V.
- URLs explícitas evitam que o Clerk caia em rotas default que não existem nesta app (`/sign-in` vs. Account Portal hospedado).

**Alternatives considered**:
- Usar Account Portal hospedado do Clerk (sem páginas próprias): **rejeitado** — pior UX (sai do domínio), mais difícil de customizar visualmente no futuro.

---

## R9 — Configuração inicial do Clerk Dashboard (operacional, não-código)

**Decision** (documentado para o operador, não é código):
- Habilitar **Organizations** na instância Clerk.
- Definir "Allow users to create organizations" = **true**.
- Definir "Personal accounts" = **disabled** (B2B-first, alinhado a R5).
- Configurar e-mail/senha como método primário; provedores sociais ficam para fatia futura (Assumption da spec).

**Rationale**:
- Sem essas configurações o `<OrganizationSwitcher>` e `<OrganizationList>` ficam vazios e a US4 falha em produção.

**Alternatives considered**: nenhuma — é configuração obrigatória do provedor.

---

## R10 — Data Access Layer (DAL) e barreira `server-only`

**Decision**: Centralizar autenticação e acesso a dados em um Data Access Layer (`lib/auth/`, futuramente `lib/data/`). Todo módulo do DAL importa `'server-only'` no topo. Server Actions e Route Handlers são **finos** e delegam ao DAL.

```ts
// lib/auth/require-org-context.ts
import "server-only";
import { auth } from "@clerk/nextjs/server";
// ...
```

**Rationale**:
- Padrão oficial recomendado pela documentação do Next.js (`docs/guides/data-security.mdx`, `docs/guides/authentication.mdx`): Server Actions e RH são tratados como endpoints públicos — qualquer auth/authz deve ser revalidado dentro deles, e o DAL centraliza essa lógica para evitar inconsistências.
- `import 'server-only'` causa erro de build se algum Client Component tentar importar o módulo (Next.js detecta a boundary). Impede vazamento acidental de `auth()` e segredos para o bundle do cliente.
- Mantém helpers sintetizados em um único ponto auditável (constituição §I: defesa em profundidade).

**Alternatives considered**:
- Espalhar `auth()` em cada handler: **rejeitado** — viola DRY e cria pontos de erro silenciosos.
- Confiar apenas na proteção do `proxy.ts`: **rejeitado** — a doc oficial do Next.js é explícita: "Page-level checks do not protect Server Actions; always perform authentication checks within the action body".

---

## R11 — `unauthorized()` e `forbidden()` em vez de Response manual em Route Handlers / Server Components

**Decision**: Em Server Components da área `(app)` e em Route Handlers, usar as funções `unauthorized()` e `forbidden()` de `next/navigation` para sinalizar 401/403. Adicionar arquivos raiz `app/unauthorized.tsx` e `app/forbidden.tsx` com UI mínima e amigável (sem vazar dados).

**Rationale**:
- `unauthorized()` (Next.js 16) interrompe a renderização, retorna 401 e renderiza a página `unauthorized.tsx` mais próxima — padrão oficial e mais limpo do que `throw new Response(...)`.
- Mantém consistência: rotas, handlers e components todos sinalizam 401 do mesmo jeito.
- Em Server Actions, `unauthorized()` também funciona para encerrar com 401; helpers internos podem continuar lançando `UnauthorizedError` para o caller decidir UX (ex.: toast em vez de redirect).

**Alternatives considered**:
- `redirect('/sign-in')`: **válido** para Server Components (UX melhor que página de erro) e é o que o layout `(app)` usa; mas em Route Handlers HTTP perde a semântica do 401.
- `throw new Response('Unauthorized', { status: 401 })`: **rejeitado** — não-idiomático no Next.js 16 e perde a página customizada.

**Política final**:
- Server Components do layout `(app)`: `redirect()` (UX) — capturam `UnauthorizedError`/`NoActiveOrgError` e redirecionam.
- Route Handlers (`app/api/*`): `unauthorized()` / `forbidden()`.
- Server Actions consumidas por forms da própria UI: relançar a exceção do helper para o caller decidir; framework converte para erro de form.

---

## R12 — Cabeçalhos de segurança (CSP, HSTS, Frame, Referrer)

**Decision**: Adicionar `headers()` no `next.config.ts` com baseline de segurança:

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
// CSP é introduzida na próxima iteração após validar os domínios usados pelo Clerk.
```

**Rationale**:
- Baseline mínimo de segurança para uma SaaS B2B em produção. HSTS, X-Frame, X-Content-Type-Options são de baixo risco e alto valor.
- CSP estrita exige conhecer todos os domínios do Clerk (frontend API, Workos, etc.) — fica para uma fatia de hardening dedicada para não bloquear esta entrega; documentado como follow-up.
- Cloudflare na borda complementa, mas headers vindos da app garantem que mesmo em bypass de CDN as proteções valem.

**Alternatives considered**:
- Só Cloudflare: **rejeitado** — perde controle granular por rota e quebra ambientes locais.
- CSP estrita já nesta fatia: **rejeitado** — risco alto de bloquear o Clerk e travar a UX; fazer separado com testes.

---

## R13 — Runtime do `proxy.ts` é Node.js (não Edge)

**Decision**: Aceitar e documentar que `proxy.ts` no Next.js 16 roda em **Node.js runtime** (não Edge). Não tentar configurar `runtime: 'edge'`.

**Rationale**:
- Documentação oficial Next.js 16: "The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured."
- Latência adicional é mínima na Vercel (Node Functions são rápidos em região próxima).
- Permite usar APIs Node.js completas no proxy se necessário no futuro (ex.: leitura de FS, libs nativas).

**Alternatives considered**:
- Continuar com `middleware.ts` (edge): **rejeitado** — deprecado em Next.js 16; o Clerk para Next.js 16 já assume `proxy.ts`.

---

## R14 — Server Actions: CSRF, taint e re-checagem obrigatória

**Decision**:
1. **Sempre re-verificar autenticação** dentro do corpo de Server Actions, via helpers (R10) — page-level checks **não** protegem SAs.
2. Marcar respostas que devolvem dados sensíveis com `experimental_taintObjectReference` (e `taintUniqueValue` para strings sensíveis) **a partir da primeira fatia que carregar dados de membros/usuários para uso pela UI**. Nesta fatia, `whoamiAction` devolve só `userId` e `orgId` — não-sensíveis o suficiente para dispensar taint.
3. CSRF: Server Actions do Next.js já têm proteção embutida (mesma origem + tokens internos). Garantir que `allowedOrigins` em `next.config.ts` esteja configurado se a app precisar receber actions de outras origens (não é o caso aqui — mesma origem).

**Rationale**:
- Próximas fatias vão carregar funcionários, documentos, etc. — instituir o padrão agora evita vazamentos quando o blast radius crescer.
- Documentação oficial Next.js sobre Data Security é explícita sobre a necessidade de re-checar auth em cada Server Action.

---

## R15 — Padrão de tratamento de erros server → cliente sem vazamento

**Decision**: Helpers lançam erros tipados com `code` discriminante (`UNAUTHORIZED`, `NO_ACTIVE_ORG`). Em Route Handlers, o catch traduz para HTTP + body JSON **mínimo** (sem stack, sem detalhes). Em Server Components, redirecionamos. Em Server Actions consumidas por forms, devolvemos `{ ok: false, error: 'UNAUTHORIZED' }` em vez de propagar a stack.

**Rationale**:
- FR-020 da spec exige mensagens claras sem vazar detalhes sensíveis.
- Código discriminante permite i18n e tradução para mensagens amigáveis sem expor internals.
- Stack traces em produção ficam apenas no log do servidor (Vercel observability), nunca no response.

**Alternatives considered**:
- Propagar `Error.message` cru: **rejeitado** — pode vazar detalhes (ex.: nome de tabela, e-mail de usuário).

---

## Resumo de NEEDS CLARIFICATION resolvidos

A spec não deixou nenhum marcador `[NEEDS CLARIFICATION]` aberto. As decisões técnicas (R1–R15) fecham todas as escolhas necessárias para a Fase 1, com referência cruzada à documentação oficial do Next.js 16 e do Clerk consultada via Context7.

## Follow-ups (não-bloqueantes para esta fatia)

- **CSP estrita** com os domínios do Clerk (próxima fatia de hardening).
- **`taint` API** em entidades sensíveis assim que aparecerem (primeira fatia que carregar dados de pessoa).
- **`unauthorized.tsx`/`forbidden.tsx`**: estilizar visualmente quando design system existir.
- **SQLite em memória** para integração: introduzido na primeira fatia com persistência.
- **Provedores sociais** (Google/Microsoft): habilitar no Clerk Dashboard quando o produto pedir.
