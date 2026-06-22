# Phase 0 — Research & Decisions: CRUDs base do PGR

Sem `NEEDS CLARIFICATION` pendentes: a stack é fixa (constituição) e os pontos abertos
(exclusão, autorização, paginação) foram resolvidos no `/speckit-clarify`. Este documento
registra as decisões técnicas que orientam o design, todas ancoradas no código real da 006.

## D1 — Contrato de retorno das Server Actions (`ActionResult<T>`) — FR-063

- **Decisão**: criar `src/shared/server/result.ts` com uma união discriminada minimalista:
  - `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }`
  - `type ActionError = { code: string; message: string; fields?: Record<string, string> }`
  - helpers `ok(data)` e `fail(code, message, fields?)`.
- **Rationale**: já existe a forma `{ ok: true … } | { ok: false; error }` em
  `src/shared/server/actions/me.ts`. Formalizar essa forma evita vazar exceção crua para a UI
  (FR-063), dá lugar a erros de campo (zod) e a erros de negócio (unicidade, FK, autorização).
  KISS — sem biblioteca de Result.
- **Alternativas**: lançar exceções e tratar com error boundary (rejeitada — mistura validação de
  formulário com erro de runtime, pior DX no formulário); `neverthrow`/lib externa (rejeitada —
  Princípio II, sem dependência nova).
- **Mapeamento de erros**: `AppError` conhecidos → `error.code` (ex.: `ForbiddenError` →
  `FORBIDDEN`, `NoTenantContextError` → `NO_TENANT_CONTEXT`); `ZodError` → `VALIDATION` com
  `fields`; violação de UNIQUE/FK do Postgres → códigos de negócio (`DUPLICATE`,
  `FK_NOT_FOUND`). Erros inesperados são relançados (não silenciados).

## D2 — Autorização por papel (`requireOfficeStaff`) — FR-065

- **Decisão**: `src/shared/auth/require-office-staff.ts` chama `requireTenantContext()` e exige
  `role ∈ {"owner","collaborator"}`; caso contrário lança `ForbiddenError` (nova subclasse de
  `AppError`, `status 403`, `code "FORBIDDEN"`). Toda Server Action de escrita/leitura desta
  fatia começa por `requireOfficeStaff()`. Páginas (Server Components) chamam o mesmo gate e, na
  negação, usam `forbidden()` do Next 16 (já há `app/forbidden.tsx`).
- **Rationale**: `requireTenantContext()` já expõe `role`; o valor `client` indica membro
  vinculado a uma empresa (`scoped_company_id`) que não pode operar os cadastros. Ponto único de
  enforcement (DRY) reusado pelas 5 entidades.
- **Alternativas**: checar papel em cada action manualmente (rejeitada — duplicação, risco de
  esquecer); RLS por papel no banco (rejeitada agora — o backstop de isolamento é por `org_id`;
  gate de papel é regra de aplicação, mais simples e testável aqui). Os valores de papel são
  `owner`/`collaborator`/`client` (string em `org_memberships.role`, convenção em inglês).

## D3 — Validação: local e reuso — FR-062

- **Decisão**: schemas zod de **entrada por entidade** em `src/shared/domains/pgr/<entity>.ts`,
  compostos a partir de `validation.ts` (`cpfSchema`, `cnpjSchema`, `riskGradeSchema`,
  `workerCountSchema`, enums). A Server Action faz `schema.safeParse(input)` **antes** de chamar
  o repositório; em erro, retorna `fail("VALIDATION", …, fields)`.
- **Rationale**: Princípio V (validar antes do banco) + DRY. Os repositórios da 006 já fazem um
  `parse` defensivo (ex.: `createEmployee`, `createGesJobRole`) — mantém-se como defesa em
  profundidade; a validação canônica do formulário é na action.
- **Alternativas**: validar só no repositório (rejeitada — erros de campo não chegam bem à UI);
  validar só na action (rejeitada — perderia a defesa do repo).

## D4 — Paginação das listas — FR-006

- **Decisão**: paginação **offset** (`page`, `pageSize`) com `pageSize` padrão **20**. Cada
  `list*` recebe `{ page, pageSize, ...filtros }` e retorna `{ rows, total }` (total para a UI
  paginar). Filtros/busca aplicam-se antes do `limit/offset`. Tudo dentro de `withOrg`.
- **Rationale**: volume típico de um escritório (centenas) torna offset suficiente e simples
  (KISS); evita o contrato de cursor. `total` habilita "página X de Y".
- **Alternativas**: cursor/keyset (rejeitada — complexidade desnecessária nesta escala); sem
  paginação (rejeitada — contraria FR-006/SC-009).

## D5 — Semântica de exclusão — FR-004 (clarificado)

- **Decisão**: confiar na integridade já definida na 006 — `ON DELETE CASCADE` descendo a cadeia
  da empresa e `SET NULL` de funcionário→GES/função. O repositório `delete*` é um único `DELETE`
  escopado por `org_id`. A UI **confirma e avisa o impacto** antes; o aviso usa **helpers de
  contagem de dependentes** (novos) para exibir quantos filhos/vínculos serão afetados.
- **Rationale**: sem bloqueio duro (decisão do clarify), sem lógica de exclusão manual em cascata
  na aplicação — o banco já garante. Aviso informado evita exclusões surpresa.
- **Alternativas**: soft delete (rejeitada — fora de escopo, sem requisito); bloquear se há
  dependentes (rejeitada no clarify).

## D6 — Estrutura de UI e rotas

- **Decisão**: rotas sob `(protected)` (layout já exige tenant). Listas/detalhes = **Server
  Components** (buscam via repositório dentro do tenant); formulários = **Client Components**
  ("use client") que invocam Server Actions e renderizam `error.fields`. Detalhe = edição para
  Empresa/Unidade de Obra/Função; Funcionário tem ficha de detalhe própria + tela de edição.
  Confirmação de exclusão é um diálogo simples (sem lib). GES tem subseção de gestão de funções.
- **Rationale**: segue o padrão existente (`(protected)/dashboard` Server Component; sem lib de
  UI). KISS: HTML nativo + Tailwind v4, sem design system novo.
- **Alternativas**: client-side data fetching/SPA (rejeitada — contraria App Router/Server
  Actions); introduzir react-hook-form/UI kit (rejeitada — Princípio II/YAGNI).

## D7 — Seletores dependentes (cascata Empresa→Obra; Função do GES; expostos)

- **Decisão**: queries de apoio org-scopadas:
  - obras por empresa (para o seletor em cascata do GES) — filtro em `listWorkUnits`.
  - funções **disponíveis** para vincular a um GES (funções da empresa **não** já vinculadas) —
    nova query em `ges-job-roles.ts`.
  - funções **vinculadas** a um GES (para o picker de Função do funcionário e para o painel de
    gestão) — `listGesJobRoles` estendido com join em `job_roles` para exibir o título.
  - nº de expostos — `countExposedWorkersByGes`/`exposedWorkersByGesMap` (reuso).
- **Rationale**: FR-040/045/053 exigem seleção coerente e filtrada; tudo dentro do tenant.

## D8 — Estratégia de testes

- **Decisão**:
  - **Unit** (`__tests__/unit/domains/pgr/`): schemas de entrada (obrigatórios, unicidade de
    formato, enums, risk_grade, worker_count), mapeadores de DTO, derivação de expostos (helpers
    puros), e o mapeamento de erro→`ActionResult`.
  - **Integração** (`__tests__/integration/pgr/`): cada Server Action (create/list/detail/update/
    delete), gestão de `ges_job_roles`, picker de função do GES, **404 cross-tenant**, e o gate de
    papel (`client` negado). Roda contra **Postgres efêmero**.
  - **Isolamento**: estender `runIsolationSuite` para as operações de escrita/leitura das 5
    entidades (A só vê A; B só vê B; sem tenant → vazio; escrita cross-tenant rejeitada;
    `UNIQUE(org_id, cpf)` e `uq_companies_org_id_cnpj` aceitam mesmo valor em orgs distintas e
    bloqueiam no mesmo).
- **Rationale**: CLAUDE.md + constituição (exceção de Postgres efêmero para RLS). Reusa o harness
  e o seed existentes.
