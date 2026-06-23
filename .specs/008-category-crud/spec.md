# Feature Specification: CRUD de Categorias (EPI / Máquina)

**Feature Branch**: `feature/category-crud`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "Category (EPI / machine) CRUD — UI + Server Actions de CRUD completo (list, getById, create, update, delete) sobre o catálogo `categories` (modelo já criado na fatia 006). Entidade simples (detalhe coberto pela edição). Isolamento multi-tenant, unicidade nome+tipo por escritório, validação zod."

> **Continuação da 006/007 — não reabre o modelo de dados.** A fatia 006
> (`.specs/006-cadastros-base-pgr/`, migration `0005`) criou a tabela `categories`
> (catálogo `epi | machine`, `UNIQUE(org_id, type, name)`, RLS `app_runtime`) e o
> repositório base (`list`/`create`). A 007 (`.specs/007-pgr-base-cruds/`) entregou o
> CRUD completo das 5 entidades da **cadeia da empresa** e **deixou `categories` de fora
> de propósito** ("CRUD de `categories` — fora destes 5 cards"). Esta fatia (**008**)
> entrega o **CRUD completo de `categories`** em UI + Server Actions, reusando o contrato
> `ActionResult<T>`, a autorização `requireOfficeStaff()` e o padrão de auditoria/validação
> já estabelecidos na 007.
>
> **Esta fatia herda — e NÃO reabre — o Modelo B de tenant da 005.** Tenant = o
> **escritório** (`orgs.id`), não a organização do Clerk. `categories` é uma **dimensão
> de dados dentro do tenant** (catálogo independente, sem FK à cadeia da empresa) e carrega
> `org_id text NOT NULL → orgs.id` com RLS `app_runtime` (backstop herdado da 004, via
> `withOrg` + `set_config`). O escritório ativo vem sempre da sessão
> (`requireTenantContext()`), NUNCA de input do cliente nem de `session.orgId`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — CRUD de Categoria (EPI / Máquina) (Priority: P1)

Como gestor de SST do escritório, quero criar, listar, editar e excluir categorias de EPI e
de máquinas — cada uma com um tipo (`EPI` ou `Máquina`), um nome e uma observação opcional —
para manter o catálogo do escritório que servirá de base aos módulos de EPIs e de máquinas.

**Why this priority**: É a única razão de existir da fatia e a fonte de valor direto: sem o
CRUD, o catálogo permanece somente com as operações parciais (`list`/`create`) da 006 e não há
como editar nem excluir uma categoria pela interface. É a MVP da fatia.

**Independent Test**: Criar uma categoria de tipo `EPI` com nome válido, vê-la na listagem do
escritório, abrir sua edição, alterar o nome e/ou a observação, salvar, e por fim excluí-la com
confirmação — tudo escopado ao escritório ativo.

**Acceptance Scenarios**:

1. **Given** um gestor autenticado num escritório, **When** cadastra uma categoria com tipo
   `EPI` (ou `Máquina`) e nome não-vazio, **Then** a categoria é persistida com todos os campos
   informados (tipo, nome, observação) e passa a aparecer na listagem do escritório.
2. **Given** o catálogo do escritório, **When** o gestor abre a listagem, **Then** vê apenas as
   categorias do escritório ativo, podendo filtrar por tipo (`EPI`/`Máquina`) e buscar por nome.
3. **Given** uma categoria existente, **When** o gestor a edita e altera nome, tipo e/ou
   observação para valores válidos, **Then** a alteração é persistida e refletida na listagem.
4. **Given** uma categoria existente, **When** o gestor solicita a exclusão e confirma, **Then**
   a categoria é removida do catálogo do escritório e deixa de aparecer na listagem.
5. **Given** um formulário de categoria, **When** o nome é vazio/só espaços ou o tipo está fora
   de `EPI`/`Máquina`, **Then** a operação é rejeitada com validação inline e nada é salvo.

---

### User Story 2 — Isolamento entre escritórios (Priority: P1)

Como operador da plataforma, quero que as categorias de um escritório nunca apareçam, sejam
editadas ou excluídas por outro escritório — mesmo que uma consulta esqueça o filtro de tenant
— para não vazar dados entre clientes do SaaS.

**Why this priority**: Vazamento entre escritórios é a falha crítica de um SaaS B2B
(constituição, Princípio I). `categories` é uma tabela de dados de negócio e precisa do mesmo
backstop de isolamento de toda a cadeia do PGR; um catálogo que vaza expõe a operação de um
cliente a outro.

**Independent Test**: Com categorias nos escritórios A e B, fixar A como escritório ativo:
listar (só aparecem as de A); tentar carregar (para edição)/editar/excluir uma categoria de B
pelo seu id (retorna "não encontrada"/`NOT_FOUND`/404, nunca os dados de B); confirmar que, sem
autenticação/escritório resolvido, uma página protegida ou Server Action é bloqueada pelo gate
de autenticação/tenant; e que, no nível de repositório/RLS sem tenant fixado, uma leitura nunca
devolve todos os registros (erro de contexto ou conjunto vazio, jamais vazamento cross-tenant).

**Acceptance Scenarios**:

1. **Given** categorias dos escritórios A e B e A como escritório ativo, **When** a listagem é
   carregada, **Then** apenas categorias de A são retornadas; categoria de B nunca aparece.
2. **Given** uma categoria pertencente ao escritório B, **When** o gestor de A tenta carregá-la
   (para edição), editá-la ou excluí-la pelo id, **Then** o resultado é `NOT_FOUND` (404) e nada
   de B é lido nem alterado.
3. **Given** uma página protegida ou Server Action deste CRUD, **When** não há
   autenticação/escritório ativo resolvido (contexto de tenant ausente/inválido), **Then** o
   acesso é bloqueado pelo gate de autenticação/tenant — a ausência de tenant **não** é tratada
   como catálogo vazio normal.
4. **Given** o repositório/RLS sem tenant fixado na transação, **When** uma leitura do catálogo é
   executada, **Then** o comportamento seguro é erro de contexto ou conjunto vazio — **jamais**
   todas as categorias nem dados de outro escritório.

---

### User Story 3 — Unicidade de nome por tipo dentro do escritório (Priority: P2)

Como gestor de SST, quero que não existam duas categorias com o mesmo nome e o mesmo tipo no meu
escritório, mas que o mesmo nome+tipo possa existir em escritórios diferentes, para manter o
catálogo sem duplicatas sem impedir que outros clientes usem os mesmos nomes.

**Why this priority**: Mantém o catálogo limpo e previsível, mas é uma regra de qualidade de
dados acima da funcionalidade-núcleo (US1) e do isolamento (US2). Reusa a constraint
`UNIQUE(org_id, type, name)` já existente na 006.

**Independent Test**: Criar uma categoria `EPI`/"Luva" no escritório A; tentar criar outra
`EPI`/"Luva" em A (rejeitada, 409); criar `EPI`/"Luva" no escritório B (aceita); criar
`Máquina`/"Luva" em A (aceita — tipo diferente).

**Acceptance Scenarios**:

1. **Given** uma categoria `EPI`/"Luva" já cadastrada no escritório A, **When** o gestor tenta
   criar outra `EPI`/"Luva" no **mesmo** escritório A, **Then** a operação é rejeitada com
   mensagem clara de duplicidade (conflito).
2. **Given** uma categoria `EPI`/"Luva" no escritório A, **When** o escritório B cria uma
   categoria `EPI`/"Luva", **Then** a operação é aceita (não há unicidade global).
3. **Given** uma categoria `EPI`/"Luva" no escritório A, **When** o gestor de A cria uma
   categoria `Máquina`/"Luva" no mesmo escritório, **Then** a operação é aceita (mesmo nome em
   tipos diferentes é permitido).
4. **Given** uma categoria existente, **When** o gestor a edita para um nome+tipo que colidiria
   com outra categoria do escritório, **Then** a edição é rejeitada com a mesma mensagem de
   duplicidade.

---

### Edge Cases

- **Tipo inválido**: valor de tipo fora de `EPI`/`Máquina` (`epi`/`machine`) → rejeitado, nada
  salvo.
- **Nome vazio**: nome ausente ou só com espaços → rejeitado.
- **Duplicidade no mesmo escritório**: mesmo nome+tipo já existente no escritório → bloqueado
  (conflito), tanto na criação quanto na edição.
- **Mesmo nome+tipo em escritórios distintos**: permitido (sem unicidade global).
- **Mesmo nome em tipos diferentes no mesmo escritório**: permitido.
- **Cross-tenant por id**: carregar (para edição)/editar/excluir uma categoria de outro
  escritório → `NOT_FOUND`/404; ela nunca aparece na listagem.
- **Sem autenticação/escritório ativo** em página protegida ou Server Action: bloqueado pelo gate
  de autenticação/tenant — **não** é tratado como catálogo vazio normal.
- **Sem tenant fixado no nível de repositório/RLS**: o comportamento seguro é erro de contexto ou
  conjunto vazio; a ausência de tenant **nunca** devolve todos os registros nem vaza dados
  cross-tenant.
- **Papel `client`**: membro vinculado a uma empresa específica (`scoped_company_id`) tem acesso
  negado a qualquer operação deste CRUD (leitura e escrita).
- **Exclusão**: categoria sem dependentes no modelo atual (catálogo independente, sem FK de
  entrada na 006) — exclusão pede confirmação e remove o registro; não há aviso de cascata.
- **Listagem volumosa**: catálogo paginado no servidor; filtro por tipo e busca por nome
  aplicam-se antes da paginação e a navegação entre páginas nunca cruza escritórios.

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. Identificadores de código em inglês;
> os valores de tipo do domínio são `epi`/`machine`, exibidos como `EPI`/`Máquina`.

### Functional Requirements — CRUD da Categoria (US1)

- **FR-001**: O sistema MUST oferecer as cinco operações do CRUD de `categories`: **criar,
  listar, carregar categoria por id para edição, editar e excluir**. Por ser entidade simples,
  **NÃO haverá tela de detalhe dedicada** — o "detalhe" é o próprio carregamento da categoria
  por id no formulário de edição (sem tela somente-leitura redundante).
- **FR-002**: A listagem MUST ser escopada ao escritório ativo e MUST suportar **filtro por
  tipo** (`EPI`/`Máquina`/todos) e **busca por nome**, aplicados antes da paginação.
- **FR-003**: A listagem MUST ser **paginada no servidor**, de modo que o volume de categorias
  não degrade a página; a navegação entre páginas MUST preservar o filtro/busca aplicados.
- **FR-004**: As operações de criar e editar MUST persistir **todos** os campos do modelo 006 da
  categoria: `type` (obrigatório), `name` (obrigatório) e `note` (opcional).
- **FR-005**: A exclusão MUST exigir **confirmação** antes de remover. Como `categories` é um
  catálogo independente sem dependentes no modelo atual, a exclusão remove o registro sem aviso
  de cascata.

### Functional Requirements — Validação e domínio (US1/US3)

- **FR-010**: O `type` MUST pertencer ao conjunto fechado `epi | machine`; valor fora do conjunto
  MUST ser rejeitado sem persistir.
- **FR-011**: O `name` MUST ser obrigatório e não-vazio (após `trim`); ausência ou string vazia
  MUST ser rejeitada.
- **FR-012**: O `note` MUST ser texto livre opcional (aceita ausência/nulo).
- **FR-013**: O sistema MUST impedir categoria duplicada por `(escritório, tipo, nome)` —
  duplicata no mesmo escritório/tipo MUST ser rejeitada como **conflito**; o mesmo nome+tipo em
  escritórios distintos MUST ser permitido; o mesmo nome em tipos distintos no mesmo escritório
  MUST ser permitido. A regra aplica-se à criação **e** à edição.

### Functional Requirements — Isolamento, autorização e contrato (cross-cutting, US2)

- **FR-020**: Todo acesso a dados (leitura e escrita) MUST ser escopado pelo escritório ativo, e
  o identificador do escritório MUST vir sempre da sessão/vínculo do usuário
  (`requireTenantContext()`) — NUNCA de entrada do cliente (query string, corpo ou cabeçalho) nem
  de `session.orgId`.
- **FR-021**: O isolamento entre escritórios MUST ter um **backstop no banco** (RLS `app_runtime`
  herdado da 004, via `withOrg`), de modo que categorias de um escritório jamais sejam visíveis,
  editáveis ou excluíveis por usuário de outro: **getById/update/delete cross-tenant MUST
  retornar 404** e a listagem cross-tenant MUST retornar vazio.
- **FR-022**: Toda Server Action MUST validar a entrada por esquema (zod) **antes** de aplicar
  regra de negócio, reutilizando os validadores de domínio já existentes (`categoryTypeSchema`)
  — sem duplicá-los.
- **FR-023**: Toda Server Action MUST retornar o **contrato de resultado padronizado**
  `ActionResult<T>` estabelecido na 007 (sucesso vs. erro de validação/negócio), sem vazar
  exceção crua para a UI. Os erros MUST ser expressos como **códigos de erro padronizados do
  contrato** — não como status HTTP em si: a duplicidade de `(escritório, tipo, nome)` MUST ser
  mapeada para um erro de **conflito** (`DUPLICATE`, equivalente a 409); o id **inexistente ou de
  outro escritório (cross-tenant)** MUST ser mapeado para **`NOT_FOUND`** (equivalente a 404).
- **FR-024**: A auditoria obrigatória desta fatia é **somente** para as operações de escrita —
  **create, update e delete** —, que MUST registrar evento de fronteira **sem PII** (sem dados
  pessoais nem payloads sensíveis), reusando o padrão de escrita auditada da 006/007. As
  operações de **leitura** (listar, carregar por id) **NÃO** emitem evento de auditoria.
- **FR-025**: O acesso a este CRUD MUST ser restrito à equipe do escritório — membros com papel
  `owner` ou `collaborator` (`requireOfficeStaff()`). Membros com papel `client` MUST NOT ter
  acesso (leitura ou escrita); a tentativa MUST ser negada.

### Key Entities _(modelo herdado da 006 — fonte da verdade no schema/`data-model.md`)_

- **Categoria (`categories`)**: catálogo de itens de `EPI` ou `Máquina` dentro do escritório;
  dimensão de dados dentro do tenant, **independente** da cadeia da empresa (sem FK a
  `companies`). Campos: `type` (`epi | machine`, obrigatório), `name` (obrigatório), `note`
  (opcional). Único por `(escritório, tipo, nome)`. Sem dependentes de entrada no modelo atual.

### Invariantes herdadas (não podem ser violadas)

- **Inv-1 — Escopo sempre pelo escritório ativo.** Todo acesso ao catálogo é escopado pelo
  escritório ativo (`requireTenantContext()`), nunca por input do cliente. (FR-020)
- **Inv-2 — Backstop de RLS é real.** Listagem sem filtro só vê o escritório ativo; em página
  protegida/Server Action, ausência de autenticação/tenant é bloqueada pelo gate (não vira
  "catálogo vazio"); no repositório/RLS sem tenant fixado, o comportamento seguro é erro de
  contexto ou conjunto vazio (nunca todos os registros); acesso cross-tenant por id →
  `NOT_FOUND`/404; escrita cross-tenant é rejeitada pelo banco. (FR-020, FR-021)
- **Inv-3 — Sem unicidade global.** A unicidade é por `(org_id, type, name)`; o mesmo nome+tipo
  em escritórios distintos é permitido. (FR-013)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As cinco operações (criar, listar, carregar por id para edição, editar, excluir) de
  `categories` estão funcionais e demonstráveis na fatia, sobre o modelo da 006 (sem migration
  nova).
- **SC-002**: 0% das categorias de um escritório são visíveis, editáveis ou excluíveis por
  usuário de outro escritório, em qualquer caminho de acesso; carregar (para edição)/editar/
  excluir uma categoria de outro escritório retorna `NOT_FOUND`/404 em **100%** dos casos, e a
  listagem cross-tenant retorna vazio.
- **SC-003**: Nome+tipo duplicado no mesmo escritório é rejeitado (conflito) em **100%** dos
  casos; o mesmo nome+tipo em escritórios distintos é aceito em **100%** dos casos; o mesmo nome
  em tipos distintos no mesmo escritório é aceito em **100%** dos casos.
- **SC-004**: 100% das tentativas de salvar com tipo fora de `epi | machine` ou com nome vazio
  são rejeitadas; nenhuma é persistida.
- **SC-005**: 100% das tentativas de acesso (leitura ou escrita) por um membro com papel `client`
  são negadas; apenas `owner`/`collaborator` conseguem operar o CRUD.
- **SC-006**: As suítes `npm run test` (unitário) e `npm run test:integration` (integração)
  passam, incluindo o caminho crítico de isolamento entre escritórios e a unicidade
  `(org_id, type, name)` validados em **Postgres efêmero** (nunca SQLite); `npm run lint` e a
  checagem de tipos ficam verdes.

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os testes
abaixo verdes, além de `npm run lint` e checagem de tipos. Casos críticos multi-tenant são
escritos/validados à mão.

- **Unitários (regra/validação/contrato)**: schema zod de entrada (tipo no enum, nome não-vazio,
  `note` opcional); mapeamento de erro para `ActionResult` (conflito → 409, não encontrado →
  404, validação → erro de campos).
- **Integração — Server Actions contra Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**):
  CRUD completo escopado ao escritório ativo; isolamento (categorias de A não vazam para B;
  getById/update/delete cross-tenant → 404; listagem sem escritório ativo → vazio); unicidade
  `(org_id, type, name)` bloqueia duplicata no mesmo escritório e permite em escritórios
  distintos; autorização (papel `client` negado; `owner`/`collaborator` permitidos).

> Justificativa do Postgres efêmero: o SQLite não tem RLS nem policies; o backstop de isolamento
> e a constraint de unicidade só podem ser provados contra Postgres real (branch efêmera),
> conforme 004/005/006 e a constituição.

## Assumptions

- **A1 — Detalhe = edição**: por ser entidade simples (3 campos), a tela de detalhe é a própria
  tela de edição, evitando uma tela somente-leitura redundante (KISS). É o que o input desta
  fatia chama de "detalhe coberto pela edição".
- **A2 — Exclusão sem cascata**: `categories` é catálogo independente, sem FK de entrada no
  modelo da 006; portanto a exclusão é uma remoção simples com confirmação, sem aviso de impacto
  em cascata (diferente das entidades da cadeia da empresa na 007).
- **A3 — Contrato e autorização reutilizados da 007**: `ActionResult<T>`, `requireOfficeStaff()`
  e o padrão de escrita auditada já existem (007/006) e são reusados; a fatia não os reescreve.
- **A4 — Validadores reutilizados da 006**: o `categoryTypeSchema` (enum `epi | machine`) já
  existe no domínio do PGR e é reusado; a fatia adiciona apenas o schema de entrada da Server
  Action (nome/observação) onde faltar.
- **A5 — Paginação consistente com a 007**: a listagem é paginada no servidor seguindo o padrão
  já estabelecido (offset, `{rows,total}`); o tamanho de página padrão é decisão do
  `/speckit-plan`.
- **A6 — Sem migration nova**: a tabela `categories`, sua constraint `UNIQUE(org_id, type, name)`
  e a RLS já foram criadas na migration `0005` (006); esta fatia estende apenas o repositório
  (`getById`/`update`/`delete`/busca+paginação) e adiciona Server Actions + UI.
- **A7 — Modelo B de tenant reutilizado**: escritório ativo resolvido por `requireTenantContext()`
  (005); a fatia não introduz nova forma de resolução de tenant.

## Out of Scope

- **Vínculo das categorias** a EPIs/máquinas concretos, a funcionários ou à cadeia do PGR — esta
  fatia entrega apenas o catálogo; os vínculos pertencem a fases futuras (EPIs, máquinas).
- **Importação em massa** / seed de catálogo padrão de EPIs/máquinas.
- **Upload de imagem/ícone** por categoria.
- **Subtipos, fabricante, CA (Certificado de Aprovação) e demais atributos** de EPI/máquina —
  o modelo da 006 tem apenas `type`, `name`, `note`.
- **Alteração do modelo de dados** (`categories`) ou nova migration — herdados intactos da 006.

## Dependencies

- Fatia **007** (`.specs/007-pgr-base-cruds/`): contrato `ActionResult<T>`
  (`src/shared/server/result.ts`), autorização `requireOfficeStaff()`, padrão de paginação
  offset e de UI de CRUD em App Router.
- Fatia **006** (`.specs/006-cadastros-base-pgr/`): modelo de dados de `categories` (migration
  `0005`), `categoryTypeSchema`, repositório base (`list`/`create`) e padrão de escrita auditada.
- Fatia **005** (`.specs/005-modelo-tenant-gate-pro/`): Modelo B de tenant (escritório =
  `orgs.id`) e resolução do escritório ativo.
- Fatia **004** (`.specs/004-multi-tenant-isolation/`): padrão de isolamento multi-tenant com
  backstop no banco (RLS) e auditoria de fronteira.
