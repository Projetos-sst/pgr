# 00 — Visão Geral da Arquitetura

## O produto

PGR-e é um **SaaS B2B multiempresa de Segurança do Trabalho (SST)**. Cada
empresa cliente é um _tenant_ isolado. O sistema cobre 9 módulos:

| Módulo                 | Natureza                                            |
| ---------------------- | --------------------------------------------------- |
| Funcionários           | Cadastro (CRUD) — entidade base de vários módulos   |
| EPIs                   | Catálogo + controle de entregas                     |
| PGR / Gestão de Riscos | Documental + regras de negócio (avaliação de risco) |
| Treinamentos           | Cadastro + controle de validade                     |
| Documentos             | Repositório de arquivos com validade                |
| Ordens de Serviço      | Workflow com estados                                |
| Acidentes              | Registro + investigação                             |
| Dashboards             | Leitura/agregação (sem dados próprios)              |
| Geração de PDF         | Operação pesada, assíncrona                         |

Tecnicamente, é um sistema **CRUD-heavy com regras de negócio moderadas,
workflows internos e forte dependência de dados por empresa**. A complexidade
não está em algoritmos — está no **isolamento entre tenants** e na **disciplina
de arquitetura** para a aplicação não virar um monólito desorganizado dentro do
Next.js.

## A stack (fixa)

A stack é definida pela constituição (Princípio II) e **não muda** sem emenda
formal:

| Camada                      | Tecnologia                                |
| --------------------------- | ----------------------------------------- |
| Aplicação (front + back)    | Next.js 16.2.6 (App Router) + React 19    |
| Hospedagem / execução       | Vercel (serverless)                       |
| Banco de dados              | Supabase — PostgreSQL gerenciado          |
| Storage de arquivos         | Supabase Storage                          |
| Autenticação + organizações | Clerk                                     |
| Borda (DNS, WAF, cache)     | Cloudflare                                |
| Geração de PDF              | Gotenberg (serviço auxiliar — ver doc 04) |

## Diagrama da arquitetura

```
                          ┌──────────────┐
        usuário  ───────▶  │  Cloudflare  │  DNS · WAF · cache de borda · mitigação
                          └──────┬───────┘
                                 │
                          ┌──────▼───────────────────────────────┐
                          │            Vercel                    │
                          │  ┌─────────────────────────────────┐ │
                          │  │   Next.js 16 (fullstack)         │ │
                          │  │                                  │ │
                          │  │  app/      → rotas / páginas      │ │
                          │  │  features/ → Server Actions,      │ │
                          │  │              queries, schemas     │ │
                          │  │  proxy.ts  → proteção de rotas    │ │
                          │  │  api/cron  → jobs assíncronos     │ │
                          │  └───────┬─────────────┬────────────┘ │
                          └──────────┼─────────────┼──────────────┘
                                     │             │
              ┌──────────────────────┘             └───────────────┐
              │                                                    │
       ┌──────▼───────┐   ┌──────────────┐                ┌────────▼────────┐
       │    Clerk     │   │   Supabase   │                │    Gotenberg    │
       │  auth/sessão │   │  PostgreSQL  │  Drizzle ORM    │  HTML → PDF     │
       │  organizações│   │  + Storage   │  (pooler)       │ (container      │
       │  webhooks    │   │  + RLS       │                 │  stateless)     │
       └──────────────┘   └──────────────┘                └─────────────────┘
```

Fluxo típico de uma requisição:

1. O usuário acessa pela Cloudflare (proteção e cache de borda).
2. O Next.js na Vercel atende. O `proxy.ts` verifica autenticação antes de
   renderizar.
3. **Leitura**: Server Components consultam o Postgres via Drizzle, sempre
   filtrando pela organização ativa.
4. **Escrita**: um formulário chama uma Server Action, que valida a entrada
   (Zod), executa a mutação no Postgres e revalida o cache.
5. **Operação pesada** (ex.: PDF em lote): a Server Action apenas registra um
   job; o processamento ocorre fora do ciclo da requisição.

## Decisões arquiteturais (ADR resumido)

| #     | Decisão                                                                                                              | Alternativas descartadas                                                                                             | Justificativa                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AD-01 | **Drizzle ORM** com connection pooler do Supabase                                                                    | Prisma (runtime mais pesado p/ serverless); cliente Supabase puro (transações e queries complexas menos ergonômicas) | Type-safe, leve, transações ACID limpas, bom encaixe serverless                                               |
| AD-02 | **Multi-tenant em duas camadas**: escopo por organização na aplicação (obrigatório) **+ RLS no Supabase** (backstop) | RLS como única barreira; escopo só na aplicação                                                                      | Constituição exige RLS; defesa em profundidade — nenhuma camada é a única                                     |
| AD-03 | **Server Actions** como padrão para mutações                                                                         | Route Handlers REST para tudo                                                                                        | Menos boilerplate, integração nativa com forms e cache do Next.js 16                                          |
| AD-04 | **Route Handlers** só para webhooks, cron e downloads                                                                | —                                                                                                                    | São os casos onde Server Actions não se aplicam (chamadas externas/scheduledas)                               |
| AD-05 | **`features/`** separado de **`app/`**                                                                               | Colocation total dentro de `app/`                                                                                    | Isola a lógica de domínio; mantém o App Router fino e o domínio testável                                      |
| AD-06 | **Gotenberg** como serviço auxiliar de PDF                                                                           | Puppeteer dentro da função Vercel; `@react-pdf/renderer`                                                             | Resolve cold start / limite de bundle / memória; alta fidelidade HTML/CSS; zero código de serviço para manter |
| AD-07 | **Zod** validando a entrada no boundary de toda Server Action e Route Handler                                        | Validação ad-hoc                                                                                                     | Exigência da constituição (Princípio V); schema único reaproveitado                                           |
| AD-08 | **Jobs assíncronos** via tabela `jobs` + Vercel Cron                                                                 | Fila dedicada (QStash) já no MVP                                                                                     | YAGNI — a tabela + cron atende o MVP; QStash fica como evolução                                               |

> Trade-off registrado em AD-06: o `Projeto.md` pede "manter a stack simples,
> sem microserviços". O Gotenberg é **um único worker auxiliar stateless de
> renderização**, não uma arquitetura de microserviços. É um desvio pequeno,
> isolado e justificado pelos limites reais do ambiente serverless. Por
> introduzir infraestrutura nova, formalmente requer emenda à constituição
> (Princípio II) antes da Fase 5 — ver doc 05.

## Como a arquitetura concretiza a constituição

| Princípio da constituição             | Como a arquitetura o realiza                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I. Isolamento Multi-Tenant**        | `organization_id` (NOT NULL + índice) em toda tabela; `orgId` vem sempre da sessão Clerk; camada de `queries`/repositórios exige `orgId`; RLS habilitado como backstop; Storage particionado por organização |
| **II. Stack Fixa e Simplicidade**     | Stack da tabela acima; nenhuma infra nova além do Gotenberg (com emenda); YAGNI aplicado em cada doc deste roadmap                                                                                           |
| **III. Entrega em Fatias Verticais**  | `features/<modulo>/` permite construir um módulo de ponta a ponta; o doc 05 sequencia as fatias                                                                                                              |
| **IV. Operações Pesadas Assíncronas** | Tabela `jobs` + Vercel Cron; geração de PDF desacoplada da requisição; serviço Gotenberg externo                                                                                                             |
| **V. Segurança e Integridade**        | TypeScript `strict`; Zod no boundary; constraints (FK/NOT NULL/UNIQUE/CHECK) no Postgres como fonte de verdade; segredos só em env vars                                                                      |

## Princípios de engenharia aplicados

- **SOLID** — _Single Responsibility_: cada `features/<modulo>/` tem uma
  responsabilidade; `actions.ts` (escrita), `queries.ts` (leitura) e `schema.ts`
  (validação) são separados. _Dependency Inversion_: a UI depende de funções de
  domínio, não diretamente do Drizzle.
- **KISS** — Server Actions em vez de uma camada REST completa; tabela `jobs` em
  vez de fila dedicada; sem `src/` (evita churn no scaffold atual).
- **DRY** — schemas Zod reaproveitados entre Server Action e formulário; helpers
  de tenant (`getOrgContext`/`requireOrg`) centralizados em `lib/auth.ts`;
  primitivos de UI em `components/ui/`.
- **YAGNI** — sem soft-delete, sem auditoria completa, sem fila dedicada, sem
  multi-idioma no MVP. Tudo isso está em "melhorias futuras" (doc 05).
- **ACID** — operações multi-tabela (ex.: criar OS com itens, entregar EPI)
  rodam em `db.transaction()`; constraints no Postgres garantem integridade
  mesmo sob concorrência.
- **Clean Code** — fronteira servidor/cliente explícita (`'use server'` /
  `'use client'`); nomes de domínio em português no produto, identificadores de
  código em inglês conforme convenção do ecossistema.

## Riscos macro

| Risco                                      | Mitigação                                                         |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Prazo de 45 dias agressivo, sem folga      | Escopo congelado; fatias verticais; P1 funcional antes da próxima |
| Vazamento de dados entre tenants           | Duas camadas (aplicação + RLS); teste de isolamento na Fase 7     |
| Aplicação virar monólito desorganizado     | Separação `app/` × `features/`; um módulo por fatia               |
| Dependência de serviço externo (Gotenberg) | Serviço stateless e substituível; geração assíncrona com retry    |
| Timeouts em operações pesadas              | Princípio IV: nada pesado roda síncrono                           |

Detalhamento e mais riscos no documento [05 — Roadmap de Fases](./05-roadmap-de-fases.md).
