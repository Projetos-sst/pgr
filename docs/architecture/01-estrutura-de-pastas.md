# 01 — Estrutura de Pastas

A estrutura separa três responsabilidades que tendem a se misturar num projeto
Next.js fullstack:

- **Roteamento e páginas** → `app/` (fino, só o que o App Router exige)
- **Lógica de domínio** → `features/<modulo>/` (o "backend" da aplicação)
- **Infraestrutura compartilhada** → `lib/`

Essa separação é o que impede o "monólito desorganizado dentro do Next.js"
alertado no `Projeto.md` e na constituição (Princípio III).

## Decisão: `app/` na raiz, sem `src/`

O scaffold atual já tem `app/` na raiz. O Next.js 16 suporta `src/`, mas migrar
agora geraria churn sem ganho real. **Mantemos `app/` na raiz.** O alias `@/*`
do `tsconfig.json` aponta para a raiz do repositório.

## Árvore proposta

```
sst-manager/
├── app/                          # ROTEAMENTO — só páginas, layouts, handlers
│   ├── (auth)/                   # route group — telas públicas de auth
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (app)/                    # route group — área autenticada, org-scoped
│   │   ├── layout.tsx            # shell: sidebar, header, org switcher
│   │   ├── dashboard/page.tsx
│   │   ├── funcionarios/
│   │   │   ├── page.tsx          # lista
│   │   │   ├── novo/page.tsx     # criação
│   │   │   └── [id]/page.tsx     # detalhe/edição
│   │   ├── epis/
│   │   ├── pgr/
│   │   ├── treinamentos/
│   │   ├── documentos/
│   │   ├── ordens-servico/
│   │   ├── acidentes/
│   │   └── configuracoes/
│   ├── api/                      # Route Handlers — só o necessário
│   │   ├── webhooks/clerk/route.ts
│   │   └── cron/[job]/route.ts
│   ├── layout.tsx                # layout raiz (ClerkProvider, fontes, globals)
│   ├── globals.css               # Tailwind v4 (@theme inline)
│   ├── not-found.tsx
│   └── error.tsx
│
├── features/                     # DOMÍNIO — a lógica de negócio de cada módulo
│   ├── funcionarios/
│   │   ├── actions.ts            # 'use server' — mutações (create/update/delete)
│   │   ├── queries.ts            # leituras org-scoped
│   │   ├── schema.ts             # schemas Zod (validação de entrada)
│   │   ├── types.ts              # tipos derivados
│   │   └── components/           # UI específica do módulo
│   │       ├── employee-form.tsx
│   │       └── employee-table.tsx
│   ├── epis/
│   ├── pgr/
│   ├── treinamentos/
│   ├── documentos/
│   ├── ordens-servico/
│   ├── acidentes/
│   └── dashboard/
│       └── queries.ts            # agregações (módulo sem mutações)
│
├── components/
│   ├── ui/                       # primitivos reutilizáveis (button, input...)
│   └── shared/                   # composições usadas por vários módulos
│       ├── app-sidebar.tsx
│       └── data-table.tsx
│
├── lib/
│   ├── db/
│   │   ├── index.ts              # cliente Drizzle (conexão pooled)
│   │   ├── schema/               # definições de tabela (Drizzle), por módulo
│   │   │   ├── index.ts          # re-exporta todos os schemas
│   │   │   ├── employees.ts
│   │   │   ├── epis.ts
│   │   │   ├── pgr.ts
│   │   │   └── ...
│   │   └── migrations/           # migrations geradas pelo Drizzle Kit
│   ├── auth.ts                   # getOrgContext(), requireOrg()
│   ├── storage.ts                # helpers do Supabase Storage (upload, URL assinada)
│   ├── pdf.ts                    # cliente do serviço Gotenberg
│   ├── jobs.ts                   # enfileirar/processar jobs assíncronos
│   ├── result.ts                 # tipo Result<T> das Server Actions
│   └── utils.ts                  # utilitários genéricos
│
├── proxy.ts                      # proteção de rotas (ex-middleware, v16)
├── drizzle.config.ts             # config do Drizzle Kit (migrations)
├── next.config.ts
├── tsconfig.json
└── ...
```

## Convenções por diretório

### `app/` — só roteamento

Arquivos em `app/` cuidam **apenas** de roteamento, composição de layout e
streaming. Eles **importam** funções de `features/` — nunca contêm regra de
negócio ou acesso direto ao banco.

- `(auth)` e `(app)` são **route groups** (parênteses): organizam sem afetar a
  URL. `(app)` concentra todo o shell autenticado.
- Páginas são **Server Components** por padrão. Só marque `'use client'` quando
  houver interatividade real (estado, eventos, hooks de browser).
- Next.js 16: `params` e `searchParams` são **assíncronos** — sempre
  `const { id } = await params`.

### `app/api/` — Route Handlers mínimos

Só existem três usos legítimos de Route Handler (detalhe no doc 03):

- `webhooks/clerk/route.ts` — recebe eventos do Clerk.
- `cron/[job]/route.ts` — endpoints chamados pelo Vercel Cron.
- Downloads / URLs assinadas, quando necessário.

Tudo o que é mutação disparada pela UI usa **Server Action**, não Route Handler.

### `features/<modulo>/` — o domínio

Cada módulo é uma fatia vertical autocontida. Arquivos padronizados:

| Arquivo | Responsabilidade | Diretiva |
|---|---|---|
| `actions.ts` | Mutações: criar, atualizar, excluir | `'use server'` |
| `queries.ts` | Leituras org-scoped (lista, detalhe, agregação) | servidor |
| `schema.ts` | Schemas Zod de entrada | — |
| `types.ts` | Tipos derivados dos schemas e do banco | — |
| `components/` | UI específica do módulo (forms, tabelas) | mista |

Um módulo **pode** importar de `lib/` e de `components/`. Um módulo **não deve**
importar de outro módulo `features/`. Se dois módulos precisam da mesma coisa,
ela sobe para `lib/` ou `components/shared/` (DRY sem acoplar domínios).

### `components/` — UI sem domínio

- `components/ui/` — primitivos puros e reutilizáveis (botão, input, modal,
  badge). Sem regra de negócio, sem acesso a dados.
- `components/shared/` — composições usadas por vários módulos (sidebar, tabela
  de dados genérica). Podem receber dados via props, mas não os buscam.

### `lib/` — infraestrutura

Código transversal que não pertence a nenhum módulo: cliente do banco, helpers
de autenticação/tenant, Storage, PDF, jobs. É a camada que os módulos consomem.

## Fronteira servidor / cliente

| Contexto | Regra |
|---|---|
| Server Components (padrão) | Podem chamar `queries.ts` e ler o banco diretamente |
| `actions.ts` | `'use server'` no topo; sempre revalidam auth + org internamente |
| Client Components | `'use client'`; recebem dados via props; chamam Server Actions via `<form action>` ou `useActionState` |
| `proxy.ts` | Roda antes da renderização; protege rotas; **não** é a única barreira de auth |

Regra de ouro: **dado sensível e regra de negócio ficam no servidor**. O cliente
só recebe o que precisa renderizar.

## Convenções de nomenclatura

- **Arquivos e pastas**: `kebab-case` (`employee-form.tsx`, `ordens-servico/`).
- **Rotas em `app/`**: em português (`funcionarios`, `ordens-servico`) — espelham
  a linguagem do produto.
- **Identificadores de código** (funções, variáveis, tipos): inglês, conforme
  convenção do ecossistema React/Node — `camelCase` para funções/variáveis,
  `PascalCase` para tipos e componentes.
- **Tabelas e colunas do banco**: `snake_case` (ver doc 02).
- **Sem misturar convenções** dentro do mesmo escopo.
