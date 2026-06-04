# Feature Specification: Reorganização `src/`, refatoração para código auto-explicativo e padrões de engenharia

**Feature Branch**: `feature/drizzle-orm-setup`

**Created**: 2026-06-04

**Status**: Delivered (documentação retrospectiva)

**Input**: Documentar o estado entregue na branch `feature/drizzle-orm-setup`: a camada de
persistência Drizzle ORM + `org_memberships` (já especificada em `002-drizzle-memberships`) e a
refatoração/reorganização feita nesta sessão — migração para `src/`, remoção de comentários via
código auto-explicativo, DRY, separação de lógica testável de CLI de ops, e criação do documento
global de padrões de engenharia.

> **Natureza desta spec**: registro retrospectivo de trabalho já entregue e validado
> (typecheck + 34 testes unitários + eslint + guard de bundle + prettier verdes). Por ser uma
> fatia interna de qualidade/estrutura, os requisitos referenciam artefatos concretos do código —
> diferente de uma spec de produto, aqui a própria estrutura é o entregável. A profundidade técnica
> da camada de persistência permanece em `002-drizzle-memberships`; aqui ela é resumida e referenciada.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fronteira clara entre código de aplicação e configuração (Priority: P1)

Como pessoa desenvolvedora entrando no repositório, quero que todo o código de aplicação viva sob
uma única raiz (`src/`) e que a raiz do projeto contenha apenas configuração e tooling, para
navegar e entender a estrutura rapidamente sem ruído.

**Why this priority**: É a mudança estrutural que motivou a sessão. Reduz o atrito de onboarding e
torna a separação aplicação/configuração óbvia, sem alterar comportamento.

**Independent Test**: Verificável abrindo o repositório — `app/`, `lib/`, `proxy.ts` e os testes
estão sob `src/`; a raiz mostra só configs, `public/`, docs e tooling. Build e testes seguem verdes.

**Acceptance Scenarios**:

1. **Given** o código movido para `src/`, **When** um módulo importa `@/lib/...`, **Then** o alias
   resolve para `./src/...` e nenhuma linha de import precisou mudar.
2. **Given** a migração, **When** se roda typecheck, eslint, prettier e os testes unitários,
   **Then** todos passam (0 erros, 34/34 testes).
3. **Given** o middleware do Next renomeado para `proxy.ts`, **When** ele é movido para
   `src/proxy.ts`, **Then** o Next 16 o reconhece (raiz **ou** `src/`, conforme doc oficial).

---

### User Story 2 - Código auto-explicativo, sem comentários redundantes (Priority: P1)

Como pessoa mantenedora, quero que o comportamento não óbvio seja revelado pelo próprio código
(nomes, constantes, funções) em vez de comentários, para que o código permaneça verdadeiro à
intenção e não dependa de comentários que envelhecem.

**Why this priority**: Aplica diretamente o princípio de refatoração de Fowler — preferir tornar o
código óbvio a comentá-lo. Era um objetivo explícito da sessão.

**Independent Test**: Os três comentários de "porquê" do código de produção foram eliminados sem
perder a informação, que passou a viver em identificadores; uma varredura não encontra comentários
redundantes em produção.

**Acceptance Scenarios**:

1. **Given** as opções não óbvias do pooler, **When** elas são agrupadas na constante
   `SUPAVISOR_TRANSACTION_POOLER_OPTIONS`, **Then** o porquê fica claro sem comentário.
2. **Given** a ordem de upsert dependente de FK no webhook, **When** ela é extraída para
   `upsertMembershipWithParents()`, **Then** a ordem (pais antes do vínculo) fica óbvia pelo nome.
3. **Given** o client Supabase que ignora RLS, **When** ele é renomeado para
   `getRlsBypassingSupabaseClient()`, **Then** o risco fica explícito em cada call site.

---

### User Story 3 - Fonte única (DRY) e remoção de tooling pontual (Priority: P2)

Como pessoa mantenedora, quero que configuração duplicada tenha fonte única e que scripts pontuais
já executados sejam removidos, para reduzir duplicação e dívida morta, com o banco operado por
comandos nativos do Drizzle.

**Why this priority**: DRY e higiene de média prioridade — melhora consistência sem mudar
comportamento observável.

**Independent Test**: Os headers `no-store` têm definição única consumida por `proxy.ts` e pela
rota; `.scripts/` não existe; o guard anti-leak roda no ESLint; `db:migrate` é `drizzle-kit migrate`.

**Acceptance Scenarios**:

1. **Given** os headers `no-store` antes repetidos em três lugares, **When** centralizados em
   `src/lib/http/no-store.ts`, **Then** `proxy.ts` e `whoami` consomem a mesma constante.
2. **Given** os scripts pontuais (`.scripts/`: migrate/reset/backfill/guard) já executados, **When**
   removidos, **Then** o banco passa a usar `drizzle-kit migrate` e o guard vira regra ESLint.
3. **Given** o backfill já concluído, **When** removido (CLI + lógica + teste + `db:backfill`),
   **Then** não resta código morto da operação one-off.

---

### User Story 4 - Camada de persistência Drizzle ORM + memberships (Priority: P2)

Como sistema, preciso persistir usuários, organizações e vínculos (`org_memberships`) de forma
code-first, com isolamento por organização (RLS) e papel de runtime de menor privilégio,
sincronizados a partir do Clerk via webhook. (O backfill inicial foi um one-off já concluído e foi
removido nesta fatia — ver US3.)

**Why this priority**: É a feature funcional da branch. Especificada em detalhe em
`002-drizzle-memberships`; aqui é referenciada e resumida para que a documentação da branch seja
completa.

**Independent Test**: Coberto pelos testes de `002` (unidade + integração com Postgres efêmero);
ver `.specs/002-drizzle-memberships/`.

**Acceptance Scenarios**:

1. **Given** um evento `organizationMembership.*` do Clerk, **When** o webhook o processa, **Then**
   usuário, organização e vínculo são upsertados na ordem que satisfaz as FKs.
2. **Given** uma organização ativa na sessão, **When** o cliente runtime (`app_runtime`) lê dados,
   **Then** o RLS restringe as linhas à organização do JWT.

---

### User Story 5 - Padrões de engenharia documentados (Priority: P3)

Como time, quero um documento único de boas práticas (Clean Code, KISS, YAGNI, DRY, Fowler +
padrões de código, arquitetura, IA, banco, testes e documentação) para guiar decisões de forma
consistente.

**Why this priority**: Valor de longo prazo e transversal; não bloqueia a entrega, mas padroniza o
trabalho futuro.

**Independent Test**: Existe um documento de padrões carregado no contexto global de engenharia.

**Acceptance Scenarios**:

1. **Given** os princípios acordados, **When** consolidados em `~/.claude/CODE_STANDARDS.md` e
   referenciados no `CLAUDE.md` global, **Then** as regras ficam disponíveis em toda sessão.

---

### Edge Cases

- **Vazamento de DB no bundle do cliente**: regra ESLint `no-restricted-imports` bane `@/lib/db` em
  `src/app`/`src/components`, com exceção para route handlers e `src/app/api/**` (onde o webhook usa
  repositórios legitimamente).
- **Setup de schema na integração**: os testes leem todos os `.sql` de `src/lib/db/migrations`
  (`applyMigrations`), independente de `drizzle-kit` — por isso os SQLs `0001`/`0002` permanecem.
- **Globs do Jest**: testes colocados em `src/**/__tests__` e centralizados em `src/__tests__`
  continuam capturados; integração permanece isolada do projeto unitário.
- **Cache stale do Next**: artefatos antigos em `.next/` apontando para `app/` são regenerados;
  exigem limpeza após a migração.
- **Diretórios com dot** (`.specs/`): convenção do projeto; ferramentas e specs esperam esse caminho.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Todo o código de aplicação (`app/`, `lib/`, `proxy.ts`) e os testes (`__tests__/`)
  DEVEM residir sob `src/`.
- **FR-002**: O alias de import `@/*` DEVE resolver para `./src/*`, de modo que nenhum import de
  código precise mudar após a migração.
- **FR-003**: As configurações dependentes de caminho (`tsconfig`, `jest.config`, `drizzle.config`,
  `prettierignore`, helper de integração) DEVEM apontar para a nova estrutura `src/`.
- **FR-004**: Comentários que apenas descrevem o "o quê" DEVEM ser removidos; o "porquê" não óbvio
  DEVE ser preservado via nome de constante/função ou, quando irredutível, comentário enxuto.
- **FR-005**: O sistema DEVE expor o client Supabase que ignora RLS sob um nome que evidencie o
  risco (`getRlsBypassingSupabaseClient`).
- **FR-006**: A ordem de upsert dependente de FK no webhook DEVE ser expressa por uma função nomeada
  cuja assinatura/corpo tornem a ordem evidente.
- **FR-007**: Configuração duplicada de cabeçalhos `no-store` DEVE ter fonte única reutilizada pelos
  consumidores.
- **FR-008**: Os scripts pontuais (`.scripts/`: migrate, reset, backfill, guard) e a lógica de
  backfill (CLI + `src/lib` + teste + `db:backfill`) DEVEM ser removidos por serem one-off já
  concluídos.
- **FR-009**: As operações de banco DEVEM usar comandos nativos do Drizzle (`db:migrate` =
  `drizzle-kit migrate`); os `.sql` históricos permanecem para o setup dos testes de integração.
- **FR-010**: A proteção contra `@/lib/db` no bundle do cliente DEVE ser uma regra ESLint
  (`no-restricted-imports`), com exceção para route handlers / `src/app/api/**`.
- **FR-011**: A camada de persistência (`users`, `orgs`, `org_memberships`) DEVE permanecer
  code-first com RLS e papel `app_runtime`, conforme `002-drizzle-memberships`.
- **FR-012**: `.env.example` DEVE conter apenas chaves e placeholders, sem comentários.
- **FR-013**: Um documento de padrões de engenharia DEVE existir e ser carregado no contexto global.
- **FR-014**: O conjunto de verificações (typecheck, eslint com a regra anti-leak, prettier, testes
  unitários) DEVE permanecer verde após todas as mudanças.

### Key Entities _(include if feature involves data)_

- **users / orgs / org_memberships**: entidades de persistência sincronizadas do Clerk; chave, RLS
  por organização e timestamps. Detalhadas em `002-drizzle-memberships/data-model.md`.
- **Layout de módulos**: organização do código sob `src/` (`app/`, `lib/{auth,clerk,db,http,server,
supabase,validation}`, `proxy.ts`, `__tests__/`), com a raiz reservada a configuração e tooling.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Após a migração, typecheck, eslint, prettier e o projeto de testes unitários passam
  com 0 erros e 34/34 testes.
- **SC-002**: Nenhum import de código foi alterado para acomodar a mudança de pastas (apenas
  configs).
- **SC-003**: O código de produção não contém comentários redundantes; os três comentários de
  "porquê" anteriores foram convertidos em código auto-explicativo.
- **SC-004**: Cabeçalhos `no-store` têm exatamente uma definição reutilizada.
- **SC-005**: A raiz do projeto não contém mais código de aplicação — apenas configuração, `public/`
  e docs. A pasta `.scripts/` deixou de existir.
- **SC-006**: O banco é operado por comandos nativos do Drizzle; a proteção anti-leak de bundle roda
  no ESLint e comprovadamente acusa violação em arquivo client e libera o webhook (`api/`).
- **SC-007**: As regras de boas práticas estão disponíveis em toda sessão de engenharia via o
  documento de padrões.

## Assumptions

- O trabalho é documentado na branch existente `feature/drizzle-orm-setup`; **nenhuma branch nova**
  é criada para esta spec (instrução explícita do usuário).
- Specs vivem em `.specs/` (convenção de dotfolder do projeto). A pasta `.scripts/` foi removida —
  seus scripts eram operações pontuais (migrate/reset/backfill) já concluídas.
- Os SQLs `0001` (triggers) e `0002` (papel `app_runtime`) já foram aplicados no banco; permanecem
  como `.sql` históricos para o setup dos testes de integração, mas não são reaplicados por
  `drizzle-kit migrate` (só o `0000` está no journal).
- A especificação detalhada da camada de persistência permanece em `002-drizzle-memberships`; esta
  spec a referencia em vez de duplicar.
- Identificadores e código permanecem em inglês; documentação em PT, conforme o padrão de código.
- Não foi executado um `next build` completo (depende de ambiente/rede); o layout `src/app` +
  `src/proxy` segue a documentação oficial do Next 16 e a validação estática está verde.
