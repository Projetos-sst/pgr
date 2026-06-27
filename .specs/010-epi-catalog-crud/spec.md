# Feature Specification: CRUD de Catálogo de EPI / Equipamentos

**Feature Branch**: `feature/epi-catalog-crud`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "CRUD completo do Catálogo de EPI/Equipamentos (`epi_catalog`) — UI (App Router) + Server Actions (list, getById para edição, create, update, delete) sobre o modelo já criado na fatia 008-epi-data-model. Itens de EPI ou Máquinas/Equipamentos dentro do escritório ativo, com Categoria coerente com o Tipo. Isolamento multi-tenant, validação zod, contrato `ActionResult<T>`, sem migration nova."

> **Continuação da 008/009 — não reabre o modelo de dados.** A fatia 008
> (`.specs/008-epi-data-model/`, migrations `0007_epi_data_model` e
> `0008_epi_catalog_type_fk`) criou a tabela `epi_catalog` e as demais tabelas do módulo
> de EPIs (estoque, movimentos, entregas, itens de entrega, vínculo EPI×risco), com RLS
> `app_runtime`, FK composta `(category_id, type) → categories(id, type)` (garante
> `item.type == categoria.type`) e os `ON DELETE` dos dependentes. A fatia 009
> (`.specs/009-category-crud/`) entregou o CRUD de `categories` reusando o contrato
> `ActionResult<T>`, a autorização `requireOfficeStaff()`, a paginação offset e o padrão de
> UI de CRUD estabelecidos na 007. **Esta fatia (010)** entrega o **CRUD completo de
> `epi_catalog`** em UI + Server Actions, reusando integralmente essa infraestrutura — **sem
> migration nova** e **sem CRUD de categorias** (usa o catálogo `categories` existente como
> taxonomia).
>
> **Esta fatia herda — e NÃO reabre — o Modelo B de tenant da 005.** Tenant = o
> **escritório** (`orgs.id`), não a organização do Clerk. `epi_catalog` é uma **dimensão de
> dados dentro do tenant** e carrega `org_id text NOT NULL → orgs.id` com RLS `app_runtime`
> (backstop herdado da 004, via `withOrg` + `set_config`). O escritório ativo vem sempre da
> sessão (`requireTenantContext()`/`requireOfficeStaff()`), NUNCA de input do cliente
> (`tenantId`/`orgId`/`organization_id`) nem da org do Clerk. A "empresa-cliente"
> (`company_id`) é dimensão interna, não fronteira de isolamento.

## Clarifications

### Session 2026-06-27

- Q: Duplicidade de item — o modelo 008 não tem UNIQUE em `epi_catalog` e a fatia é "sem
  migration nova". Como tratar homônimos? → A: **Opção A — não impor unicidade nesta fatia.**
  Homônimos são permitidos; sem pré-checagem de unicidade na aplicação; `epi_catalog` não mapeia
  `DUPLICATE`/409. Qualquer regra de unicidade futura fica para uma fatia própria de
  modelo/migration.
- Q: Exclusão de item com dependentes — `epi_stock`/`epi_risk` são `ON DELETE CASCADE` e
  `epi_delivery_items` é `RESTRICT`. Cascatear ou bloquear? → A: **Opção B — bloquear
  defensivamente na aplicação se houver QUALQUER dependente conhecido** (`epi_stock`, `epi_risk`
  ou `epi_delivery_items`): retorna conflito/"item em uso", com mensagem clara, sem remover. O FK
  `RESTRICT` de `epi_delivery_items` permanece como backstop de banco. Sem migration nova.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — CRUD do item de catálogo de EPI/Equipamento (Priority: P1)

Como gestor de SST do escritório, quero criar, listar/buscar, abrir para edição, editar e
excluir itens do catálogo de EPI e de Máquinas/Equipamentos — cada item com os atributos do
ePGR (tipo, categoria, nome, CA, validade do CA, fabricante, norma, tamanho, unidade de
medida, descrição e caminho da foto) — para manter o catálogo do escritório que servirá de
base aos módulos de estoque, entregas e vínculo EPI×risco.

**Why this priority**: É a razão de existir da fatia e a fonte de valor direto. Sem o CRUD do
catálogo, os módulos posteriores (estoque, entregas, EPI×risco) não têm de onde referenciar os
itens. É a MVP da fatia.

**Independent Test**: Cadastrar um item de tipo `EPI` com categoria compatível e nome válido,
vê-lo na listagem do escritório, abrir sua edição carregada por id, alterar atributos (ex.: CA,
validade, fabricante), salvar, e por fim excluí-lo com confirmação — tudo escopado ao escritório
ativo.

**Acceptance Scenarios**:

1. **Given** um gestor autenticado num escritório, **When** cadastra um item com tipo `EPI` (ou
   `Máquina`), uma categoria compatível com o tipo e nome não-vazio, **Then** o item é persistido
   com todos os atributos informados e passa a aparecer na listagem do escritório.
2. **Given** o catálogo do escritório, **When** o gestor abre a listagem, **Then** vê apenas os
   itens do escritório ativo, com as colunas CA, Nome, Tamanho, Fabricante, Tipo, Categoria,
   Unidade de Medida, Validade e Opções, podendo filtrar por tipo e buscar por nome/CA/categoria.
3. **Given** um item existente, **When** o gestor o abre para edição (carregado por id) e altera
   atributos para valores válidos, **Then** a alteração é persistida e refletida na listagem.
4. **Given** um item existente sem dependentes que bloqueiem, **When** o gestor solicita a
   exclusão e confirma, **Then** o item é removido do catálogo do escritório e deixa de aparecer
   na listagem.
5. **Given** um formulário de item, **When** o nome é vazio/só espaços ou o tipo está fora de
   `epi`/`machine`, **Then** a operação é rejeitada com validação inline e nada é salvo.

---

### User Story 2 — Isolamento entre escritórios (Priority: P1)

Como operador da plataforma, quero que os itens de catálogo de um escritório nunca apareçam,
sejam carregados, editados ou excluídos por outro escritório — mesmo que uma consulta esqueça o
filtro de tenant — para não vazar dados entre clientes do SaaS.

**Why this priority**: Vazamento entre escritórios é a falha crítica de um SaaS B2B
(constituição, Princípio I). `epi_catalog` é tabela de dados de negócio e precisa do mesmo
backstop de isolamento (RLS `app_runtime`) de todo o módulo.

**Independent Test**: Com itens nos escritórios A e B, fixar A como ativo: listar (só aparecem os
de A); tentar carregar (para edição)/editar/excluir um item de B pelo seu id (retorna
"não encontrado"/`NOT_FOUND`/404, nunca os dados de B); confirmar que, sem autenticação/escritório
resolvido, página protegida ou Server Action é bloqueada pelo gate; e que, no nível de
repositório/RLS sem tenant fixado, uma leitura nunca devolve todos os registros.

**Acceptance Scenarios**:

1. **Given** itens dos escritórios A e B e A como escritório ativo, **When** a listagem é
   carregada, **Then** apenas itens de A são retornados; item de B nunca aparece.
2. **Given** um item pertencente ao escritório B, **When** o gestor de A tenta carregá-lo (para
   edição), editá-lo ou excluí-lo pelo id, **Then** o resultado é `NOT_FOUND` (404) e nada de B é
   lido nem alterado.
3. **Given** uma página protegida ou Server Action deste CRUD, **When** não há
   autenticação/escritório ativo resolvido, **Then** o acesso é bloqueado pelo gate de
   autenticação/tenant — a ausência de tenant **não** é tratada como catálogo vazio normal.
4. **Given** o repositório/RLS sem tenant fixado na transação, **When** uma leitura do catálogo é
   executada, **Then** o comportamento seguro é erro de contexto ou conjunto vazio — **jamais**
   todos os itens nem dados de outro escritório.

---

### User Story 3 — Coerência Tipo × Categoria (Priority: P1)

Como gestor de SST, quero que a Categoria disponível e aceita no formulário seja sempre do mesmo
Tipo do item (um item `EPI` só aceita categoria `EPI`; um item `Máquina` só aceita categoria
`Máquina`) e do meu próprio escritório, para não cadastrar item com categoria de tipo ou de
escritório incorreto.

**Why this priority**: É a regra de integridade central do catálogo, garantida no banco pela FK
composta `(category_id, type) → categories(id, type)` (008). Sem ela, o catálogo aceitaria
classificações incoerentes que contaminam estoque, entregas e relatórios. O backend MUST
rejeitar a incoerência mesmo que o frontend falhe.

**Independent Test**: No escritório A, com categorias `EPI`/"Luva" e `Máquina`/"Torno": criar
item `EPI` apontando para a categoria `EPI` (aceito); tentar criar item `EPI` apontando para a
categoria `Máquina` (rejeitado — incompatibilidade de tipo); tentar criar item apontando para
uma categoria do escritório B ou para um `category_id` inexistente (rejeitado — referência
inválida), tudo mapeado para erro padronizado do contrato.

**Acceptance Scenarios**:

1. **Given** uma categoria `EPI` do escritório ativo, **When** o gestor cria/edita um item `EPI`
   apontando para ela, **Then** a operação é aceita.
2. **Given** uma categoria `Máquina` do escritório ativo, **When** o gestor tenta criar/editar um
   item `EPI` apontando para ela (tipo divergente), **Then** a operação é rejeitada com erro
   padronizado e nada é salvo — **mesmo que a UI não tenha filtrado** o select.
3. **Given** uma `category_id` inexistente ou pertencente a outro escritório, **When** o gestor
   tenta criar/editar um item apontando para ela, **Then** a operação é rejeitada como referência
   inválida (erro padronizado), sem vazar a existência de categoria de outro escritório.
4. **Given** o formulário de item, **When** o gestor seleciona um Tipo, **Then** o select de
   Categoria oferece apenas categorias daquele tipo no escritório ativo (filtragem na UI), com o
   backend como guarda final.

---

### User Story 4 — Exclusão segura de item com dependentes (Priority: P1)

Como gestor de SST, quero excluir itens criados por engano com confirmação, e quero que o sistema
trate de forma coerente e com mensagem clara quando o item já estiver referenciado por outros
registros do módulo de EPIs, para não remover silenciosamente dados que sustentam estoque ou um
histórico de entrega.

**Why this priority**: Dados de SST têm peso legal (constituição, Princípio V). Os `ON DELETE` da
008 **não são uniformes** (`epi_stock`/`epi_risk` cascateiam; `epi_delivery_items` restringe), e
cascatear silenciosamente estoque ou vínculo de risco corromperia dados de operação. Por decisão
do Tech Lead (Clarifications, Q2), a aplicação **bloqueia defensivamente** a exclusão se houver
qualquer dependente conhecido, comunicando o resultado ao usuário.

**Independent Test**: Excluir, com confirmação, um item sem dependentes (removido). Para um item
com **qualquer** dependente conhecido — registro de estoque (`epi_stock`), vínculo EPI×risco
(`epi_risk`) ou item de entrega (`epi_delivery_items`) — tentar excluir e observar bloqueio com
mensagem de "item em uso" (não removido). Confirmar que o cancelamento da confirmação não remove
nada.

**Acceptance Scenarios**:

1. **Given** um item sem nenhum dependente conhecido, **When** o gestor solicita exclusão e
   confirma, **Then** o item é removido.
2. **Given** um item referenciado por **qualquer** dependente conhecido (`epi_stock`, `epi_risk`
   ou `epi_delivery_items`), **When** o gestor tenta excluí-lo, **Then** a aplicação **bloqueia** a
   exclusão antes de remover, retorna erro padronizado de conflito/"item em uso" com mensagem clara
   e **nada é removido** — em particular, nenhum registro de estoque ou vínculo de risco é
   cascateado/apagado.
3. **Given** o diálogo de confirmação de exclusão, **When** o gestor cancela, **Then** nenhuma
   alteração ocorre.
4. **Given** um item referenciado por `epi_delivery_items`, **When** — por qualquer razão — a
   verificação de dependentes da aplicação falhar em bloquear, **Then** o banco ainda **rejeita** a
   exclusão pela FK `ON DELETE RESTRICT` (SQLSTATE 23503), que permanece como backstop, e o erro é
   traduzido para o mesmo conflito de "item em uso" — nada é removido.

---

### Edge Cases

- **Catálogo vazio**: a listagem exibe estado vazio orientando o primeiro cadastro (não erro).
- **Busca sem resultado**: lista vazia com mensagem de "nenhum item encontrado", sem erro.
- **Tipo inválido**: valor fora de `epi`/`machine` → rejeitado, nada salvo.
- **Nome vazio**: nome ausente ou só espaços (após `trim`) → rejeitado.
- **Categoria inexistente**: `category_id` que não existe → referência inválida (erro padronizado).
- **Categoria de outro escritório**: bloqueada pela RLS/escopo — tratada como referência inválida,
  sem vazar existência.
- **Categoria de tipo diferente do item**: rejeitada pela FK composta `(category_id, type)`
  (backend como guarda final, independentemente do filtro da UI).
- **CA vazio/ausente**: permitido (campo opcional).
- **Data de validade do CA inválida**: formato/data inválida → rejeitada na validação; ausência é
  permitida (campo opcional).
- **Foto ausente**: permitido; `photo_path` é apenas caminho/URL textual, sem upload físico.
- **Item inexistente / item de outro escritório por id**: carregar (para edição)/editar/excluir →
  `NOT_FOUND`/404; nunca aparece na listagem.
- **Exclusão cancelada pelo usuário**: nada é removido.
- **Exclusão bloqueada por dependentes**: item referenciado por **qualquer** dependente conhecido
  (`epi_stock`, `epi_risk` ou `epi_delivery_items`) → a aplicação bloqueia antes de remover, com
  mensagem de "item em uso"; o FK `RESTRICT` de `epi_delivery_items` permanece como backstop de
  banco (estoque/risco não são cascateados porque a remoção nem chega a executar).
- **Tentativa de passar tenant pelo cliente**: qualquer `tenantId`/`orgId`/`organization_id` em
  input do cliente é ignorado; o escritório vem sempre da sessão.
- **Sem autenticação/escritório ativo**: bloqueado pelo gate de autenticação/tenant — não é
  "catálogo vazio".
- **Papel `client`**: acesso negado a qualquer operação (leitura e escrita).
- **Item homônimo**: dois itens com mesmo tipo/nome (e demais atributos) no **mesmo** escritório
  são **permitidos** — o modelo 008 não tem UNIQUE em `epi_catalog` e esta fatia não impõe
  unicidade (Clarifications, Q1). Não há erro de duplicidade no catálogo.

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. Identificadores de código em inglês;
> os valores de tipo do domínio são `epi`/`machine`, exibidos como `EPI`/`Máquinas e
> Equipamentos`. Os nomes de atributo seguem o schema real da 008
> (`src/shared/db/schema/epis.ts`): `norm` é exibido como **Norma** (o input chamou de
> "standard"); `caValidUntil` é a **Validade do CA**.

### Functional Requirements — CRUD do item (US1)

- **FR-001**: O sistema MUST oferecer as cinco operações do CRUD de `epi_catalog`: **criar,
  listar, carregar item por id para edição, editar e excluir**. Por ser entidade sem fluxo de
  detalhe próprio, **NÃO haverá tela de detalhe somente-leitura** — o "detalhe" é o próprio
  carregamento do item por id no formulário de edição.
- **FR-002**: A listagem MUST ser escopada ao escritório ativo e MUST suportar **filtro por tipo**
  (`EPI`/`Máquinas e Equipamentos`/todos) e **busca textual por nome, CA e categoria**, aplicados
  antes da paginação.
- **FR-003**: A listagem MUST ser **paginada no servidor** com **ordenação previsível** (default a
  decidir no `/speckit-plan`, ex.: por nome asc), de modo que o volume de itens não degrade a
  página; a navegação entre páginas MUST preservar filtro/busca aplicados e nunca cruzar
  escritórios.
- **FR-004**: As colunas da listagem MUST ser: **CA, Nome, Tamanho, Fabricante, Tipo, Categoria,
  Unidade de Medida, Validade (do CA) e Opções** (ações por linha: editar/gerenciar e excluir).
- **FR-005**: As operações de criar e editar MUST persistir todos os atributos do modelo 008 do
  item (ver Key Entities), com `type`, `category_id` e `name` obrigatórios e os demais opcionais.
- **FR-006**: A listagem MUST exibir **estado vazio** orientando o primeiro cadastro quando o
  catálogo do escritório não tiver itens, distinto do estado "busca sem resultado".
- **FR-007**: A exclusão MUST exigir **confirmação** explícita antes de remover.

### Functional Requirements — Validação e domínio (US1/US3)

- **FR-010**: O `type` MUST pertencer ao conjunto fechado `epi | machine`; valor fora do conjunto
  MUST ser rejeitado sem persistir, reusando `categoryTypeSchema` do domínio do PGR.
- **FR-011**: O `name` MUST ser obrigatório e não-vazio (após `trim`); ausência ou string vazia
  MUST ser rejeitada.
- **FR-012**: O `category_id` MUST ser obrigatório e MUST referenciar uma categoria **do
  escritório ativo** cujo `type` seja **igual** ao `type` do item. A incoerência de tipo ou a
  referência a categoria inexistente/de outro escritório MUST ser rejeitada, com o **backend como
  guarda final** (FK composta `(category_id, type)`), independentemente da filtragem na UI.
- **FR-013**: Os atributos opcionais MUST aceitar ausência/nulo e, quando presentes, MUST ser
  validados por esquema: `ca` (texto), `caValidUntil` (data válida), `manufacturer` (texto),
  `norm` (texto), `size` (texto), `unitOfMeasure` (texto), `description` (texto), `photoPath`
  (texto — caminho/URL, **sem upload físico** nesta fatia).
- **FR-014**: O select de **Categoria** na UI MUST oferecer apenas categorias do **tipo
  selecionado** e do escritório ativo, recarregando ao trocar o Tipo. Esta é uma ajuda de UX; a
  garantia de integridade é do backend (FR-012).

### Functional Requirements — Exclusão e dependentes (US4)

- **FR-015**: Antes de remover, a exclusão MUST verificar a existência de **qualquer dependente
  conhecido** do item em `epi_stock`, `epi_risk` ou `epi_delivery_items` (escopados ao escritório
  ativo). Havendo **pelo menos um** dependente, a aplicação MUST **bloquear** a exclusão e MUST NOT
  executar a remoção — em particular, MUST NOT permitir que `epi_stock`/`epi_risk` (FKs `CASCADE`
  no modelo 008) sejam apagados em cascata. Esta verificação na aplicação é a barreira primária
  (decisão do Tech Lead, Q2); o FK `ON DELETE RESTRICT` de `epi_delivery_items` permanece como
  **backstop de banco**. **Nenhuma migration é criada** nesta fatia.
- **FR-016**: Quando a exclusão for bloqueada — seja pela verificação de dependentes da aplicação
  (FR-015), seja pelo backstop de FK `RESTRICT` (violação de FK, SQLSTATE 23503) — o sistema MUST
  traduzir o resultado no **código padronizado do contrato `IN_USE`** (conflito/"item em uso",
  semântica equivalente a **409**) com **mensagem clara** ao usuário, sem vazar exceção crua e sem
  remover nada. O item MUST NOT ser excluído silenciosamente, e dependentes (estoque, risco, itens
  de entrega) MUST NOT ser removidos/cascateados.
- **FR-017**: Esta fatia **NÃO impõe unicidade** de item em `epi_catalog` (decisão do Tech Lead,
  Q1): o modelo 008 não define constraint UNIQUE e nenhuma migration é criada aqui. A aplicação
  MUST NOT fazer pré-checagem de unicidade nem mapear qualquer cenário de `epi_catalog` para um
  erro de duplicidade (`DUPLICATE`/409); itens homônimos no mesmo escritório são aceitos. Qualquer
  regra de unicidade futura é responsabilidade de uma fatia própria de modelo/migration.

### Functional Requirements — Isolamento, autorização e contrato (cross-cutting, US2)

- **FR-020**: Todo acesso a dados (leitura e escrita) MUST ser escopado pelo escritório ativo, e o
  identificador do escritório MUST vir sempre da sessão (`requireTenantContext()`/`withOrg`) —
  NUNCA de entrada do cliente (`tenantId`/`orgId`/`organization_id`, query, corpo ou cabeçalho)
  nem da org do Clerk.
- **FR-021**: O isolamento entre escritórios MUST ter um **backstop no banco** (RLS `app_runtime`
  herdado da 004/008, via `withOrg`): **getById/update/delete cross-tenant MUST retornar
  `NOT_FOUND`/404** e a listagem cross-tenant MUST retornar vazio; no repositório/RLS sem tenant
  fixado, o comportamento seguro é erro de contexto ou conjunto vazio — jamais todos os registros.
- **FR-022**: Toda Server Action MUST validar a entrada por esquema (zod) **antes** de aplicar
  regra de negócio ou tocar o banco, reusando os validadores de domínio existentes
  (`categoryTypeSchema`, helpers de `form-fields`) — sem duplicá-los.
- **FR-023**: Toda Server Action MUST retornar o **contrato padronizado** `ActionResult<T>` (007),
  sem vazar exceção crua. Os erros MUST ser expressos como **códigos do contrato** (não HTTP cru):
  tipo/nome/atributo inválido → `VALIDATION` (422); `category_id` inválida/incoerente/cross-tenant
  → `FK_NOT_FOUND`/`VALIDATION` (referência inválida); id inexistente ou cross-tenant →
  `NOT_FOUND` (404); exclusão bloqueada por dependente (item em uso) → **`IN_USE`** (conflito,
  equivalente a 409); papel `client` → `FORBIDDEN` (403); ausência de tenant →
  `NO_TENANT_CONTEXT`/`UNAUTHORIZED`. **Sem `DUPLICATE`** para `epi_catalog` (FR-017).
- **FR-024**: A auditoria obrigatória desta fatia é **somente** para as operações de escrita —
  **create, update e delete** —, registrando evento de fronteira **sem PII**, reusando o padrão de
  escrita auditada (`auditedTenantWrite`) da 006/007. As operações de **leitura** (listar,
  carregar por id) **NÃO** emitem evento de auditoria.
- **FR-025**: O acesso a este CRUD MUST ser restrito à equipe do escritório — papéis `owner` ou
  `collaborator` (`requireOfficeStaff()`). Membros com papel `client` MUST NOT ter acesso (leitura
  ou escrita); a tentativa MUST ser negada com `FORBIDDEN`.

### Key Entities _(modelo herdado da 008 — fonte da verdade no schema/`data-model.md`)_

- **Item de catálogo (`epi_catalog`)**: item de `EPI` ou `Máquina/Equipamento` dentro do
  escritório; dimensão de dados dentro do tenant. Atributos:
  - `type` (`epi | machine`, **obrigatório**) — coerente com a categoria;
  - `category_id` (**obrigatório**) — FK composta `(category_id, type) → categories(id, type)`,
    `ON DELETE RESTRICT` (não se pode excluir categoria em uso);
  - `name` (**obrigatório**);
  - `ca` (opcional — Certificado de Aprovação);
  - `ca_valid_until` / `caValidUntil` (data opcional — validade do CA);
  - `manufacturer` (opcional);
  - `norm` (opcional — exibido como **Norma**);
  - `size` (opcional);
  - `unit_of_measure` / `unitOfMeasure` (opcional);
  - `description` (opcional);
  - `photo_path` / `photoPath` (opcional — caminho/URL textual, sem upload nesta fatia);
  - `org_id` (tenant, obrigatório, `→ orgs.id`, `ON DELETE CASCADE`).
  - **Sem constraint UNIQUE** no modelo 008 → itens homônimos são permitidos; esta fatia não impõe
    unicidade (FR-017).
- **Categoria (`categories`)** _(taxonomia reusada da 006/009 — não é CRUD desta fatia)_: fornece
  o par `(id, type)` referenciado pela FK composta; filtra o catálogo por tipo.
- **Dependentes de `epi_catalog`** _(modelo 008, sem UI nesta fatia)_: `epi_stock` (`CASCADE`),
  `epi_risk` (`CASCADE`), `epi_delivery_items` (`RESTRICT`) — relevantes apenas para a semântica de
  exclusão (FR-015/FR-016).

### Invariantes herdadas (não podem ser violadas)

- **Inv-1 — Escopo sempre pelo escritório ativo.** Todo acesso ao catálogo é escopado pelo
  escritório ativo (`requireTenantContext()`), nunca por input do cliente. (FR-020)
- **Inv-2 — Backstop de RLS é real.** Listagem sem filtro só vê o escritório ativo; ausência de
  autenticação/tenant é bloqueada pelo gate (não vira "catálogo vazio"); no repositório/RLS sem
  tenant fixado, o comportamento seguro é erro de contexto ou conjunto vazio; acesso cross-tenant
  por id → `NOT_FOUND`/404; escrita cross-tenant é rejeitada pelo banco. (FR-020, FR-021)
- **Inv-3 — Tipo do item == tipo da categoria.** Garantido no banco pela FK composta
  `(category_id, type) → categories(id, type)`; o backend é a guarda final. (FR-012)
- **Inv-4 — Exclusão nunca remove item com dependente conhecido.** A aplicação bloqueia a exclusão
  se houver qualquer dependente (`epi_stock`/`epi_risk`/`epi_delivery_items`), com mensagem clara;
  o FK `RESTRICT` de `epi_delivery_items` é backstop; estoque/risco nunca são cascateados; nada é
  removido às cegas. (FR-015, FR-016)
- **Inv-5 — Sem unicidade de catálogo nesta fatia.** `epi_catalog` não tem UNIQUE no modelo 008;
  homônimos são permitidos e nenhum cenário mapeia `DUPLICATE`/409. (FR-017)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As cinco operações (criar, listar, carregar por id para edição, editar, excluir) de
  `epi_catalog` estão funcionais e demonstráveis na fatia, sobre o modelo da 008 (sem migration
  nova).
- **SC-002**: Todos os atributos do modelo 008 do item aparecem no formulário (tipo, categoria,
  nome, CA, validade do CA, fabricante, norma, tamanho, unidade de medida, descrição, caminho da
  foto).
- **SC-003**: 0% dos itens de um escritório são visíveis, editáveis ou excluíveis por usuário de
  outro escritório, em qualquer caminho de acesso; carregar (para edição)/editar/excluir um item
  de outro escritório retorna `NOT_FOUND`/404 em **100%** dos casos, e a listagem cross-tenant
  retorna vazio.
- **SC-004**: 100% das tentativas de salvar item com categoria de **tipo divergente**, com
  categoria **de outro escritório** ou com `category_id` **inexistente** são rejeitadas como
  referência inválida; nenhuma é persistida — **mesmo quando a UI não filtra** o select.
- **SC-005**: 100% das tentativas de salvar com tipo fora de `epi | machine`, com nome vazio ou
  com data de validade inválida são rejeitadas; nenhuma é persistida.
- **SC-006**: A busca por nome/CA/categoria e o filtro por tipo retornam o subconjunto correto do
  escritório ativo em 100% dos casos; a navegação entre páginas nunca cruza escritórios.
- **SC-007**: 100% das tentativas de excluir um item com **qualquer** dependente conhecido
  (`epi_stock`, `epi_risk` ou `epi_delivery_items`) são bloqueadas pela aplicação com mensagem clara
  de "item em uso"; nenhum item é removido e nenhum registro de estoque/risco é cascateado quando
  há dependente.
- **SC-008**: Itens homônimos no mesmo escritório são aceitos em 100% dos casos; nenhuma operação
  de `epi_catalog` retorna erro de duplicidade (`DUPLICATE`/409), pois esta fatia não impõe
  unicidade.
- **SC-009**: 100% das tentativas de acesso (leitura ou escrita) por um membro com papel `client`
  são negadas; apenas `owner`/`collaborator` operam o CRUD.
- **SC-010**: As suítes `npm run test` (unitário) e `npm run test:integration` (integração) passam,
  incluindo isolamento entre escritórios, coerência Tipo×Categoria, referência inválida de
  categoria e exclusão bloqueada por dependente conhecido, validados em **Postgres efêmero** (nunca
  SQLite); `npm run lint` e a checagem de tipos ficam verdes.

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os testes abaixo
verdes, além de `npm run lint` e checagem de tipos. Casos críticos multi-tenant são escritos/validados
à mão.

- **Unitários (regra/validação/contrato)**: schema zod de entrada (tipo no enum; nome não-vazio;
  `category_id` obrigatório; data de validade válida quando presente; opcionais aceitando nulo);
  mapeamento de erro para `ActionResult` (referência inválida de categoria, não encontrado → 404,
  validação → erro de campos, exclusão bloqueada → conflito de "em uso").
- **Integração — Server Actions contra Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**):
  CRUD completo escopado ao escritório ativo; isolamento (itens de A não vazam para B;
  getById/update/delete cross-tenant → 404; listagem sem escritório ativo → vazio); coerência
  Tipo×Categoria (categoria de tipo divergente e categoria de outro escritório rejeitadas pela FK
  composta); referência inválida de `category_id`; exclusão bloqueada pela aplicação quando há
  **qualquer** dependente conhecido (`epi_stock`, `epi_risk` ou `epi_delivery_items`) — verificando
  que estoque/risco **não** são cascateados — e o FK `RESTRICT` de `epi_delivery_items` como
  backstop; item homônimo aceito (sem `DUPLICATE`); autorização (papel `client` negado;
  `owner`/`collaborator` permitidos).

> Justificativa do Postgres efêmero: o SQLite não tem RLS, FK composta com `ON DELETE` nem
> policies; o backstop de isolamento, a FK de coerência de tipo e a semântica de exclusão só podem
> ser provados contra Postgres real (branch efêmera), conforme 004/005/006/008 e a constituição.

## Assumptions

- **A1 — Detalhe = edição**: não há tela de detalhe somente-leitura; o "detalhe" é o carregamento
  do item por id no formulário de edição (KISS, como na 009).
- **A2 — Sem migration nova**: a tabela `epi_catalog`, a FK composta `(category_id, type)`, a RLS e
  os `ON DELETE` dos dependentes já foram criados nas migrations `0007`/`0008` (008); esta fatia
  estende apenas o repositório (`getById`/`update`/`delete`/`list` com busca+filtro+paginação) e
  adiciona Server Actions + UI. Nenhuma constraint nova é introduzida.
- **A3 — Contrato e autorização reutilizados da 007/009**: `ActionResult<T>`, `officeAction`,
  `requireOfficeStaff()`, paginação offset (`{rows,total}`, `resolvePageParams`), `_ui/list` +
  `_ui/form` e `auditedTenantWrite` já existem e são reusados; a fatia não os reescreve.
- **A4 — Validadores reutilizados da 006/009**: `categoryTypeSchema` e os helpers de `form-fields`
  são reusados; a fatia adiciona apenas o schema de entrada de `epi_catalog`
  (`epiCatalogInputSchema`).
- **A5 — Busca textual abrange nome, CA e nome da categoria**: a "busca por categoria" é entendida
  como busca textual pelo **nome** da categoria associada (via join), além de nome e CA do item;
  o filtro por tipo é separado da busca textual.
- **A6 — `norm` = "Norma"**: o atributo que o input chamou de `standard` corresponde ao campo real
  `norm` do schema 008, exibido como **Norma**.
- **A7 — `photo_path` é texto**: apenas caminho/URL textual; **sem upload físico** nem validação de
  storage nesta fatia.
- **A8 — Tamanho de página consistente com a 009**: paginação no servidor seguindo o padrão
  estabelecido (offset, `{rows,total}`); o `pageSize` default é decisão do `/speckit-plan`.
- **A9 — Modelo B de tenant reutilizado**: escritório ativo resolvido por
  `requireTenantContext()`/`requireOfficeStaff()` (005); a fatia não introduz nova forma de
  resolução de tenant.
- **A10 — Sem unicidade de catálogo (decisão Tech Lead, Q1)**: como o modelo 008 não tem UNIQUE em
  `epi_catalog` e a fatia é "sem migration nova", o CRUD **não** impõe unicidade nem pré-checa
  homônimos; nenhum cenário de `epi_catalog` mapeia `DUPLICATE`/409. Unicidade futura = fatia
  própria de modelo/migration. (FR-017)
- **A11 — Exclusão defensiva por dependentes (decisão Tech Lead, Q2)**: a aplicação bloqueia a
  exclusão se houver **qualquer** dependente conhecido (`epi_stock`/`epi_risk`/`epi_delivery_items`),
  apesar de estoque/risco serem `CASCADE` no banco, para não apagá-los silenciosamente; o FK
  `RESTRICT` de `epi_delivery_items` permanece como backstop. Sem migration nova. (FR-015, FR-016)

## Out of Scope

- **Criar ou alterar o modelo de dados/migrations** — herdados intactos da 008.
- **CRUD de categorias** — usa o catálogo `categories` existente (009) como taxonomia.
- **Estoque, movimentações de estoque, entregas, itens de entrega, devolução e histórico** —
  fases futuras; esta fatia entrega apenas o catálogo. Os dependentes só importam para a semântica
  de exclusão.
- **Vínculo EPI×risco** — fase futura; relevante apenas como dependente `CASCADE` na exclusão.
- **Upload físico de foto** para storage — apenas `photo_path` textual.
- **Consulta externa CAEPI/MTE** (validação automática de CA/validade) — fora desta fatia.

## Dependencies

- Fatia **008** (`.specs/008-epi-data-model/`): modelo de dados de `epi_catalog` e dependentes
  (migrations `0007`/`0008`), FK composta `(category_id, type)`, RLS `app_runtime` e `ON DELETE`
  dos dependentes.
- Fatia **009** (`.specs/009-category-crud/`): catálogo `categories` (taxonomia) e o padrão de CRUD
  (repositório com busca+filtro+paginação, Server Actions, UI) replicado aqui.
- Fatia **007** (`.specs/007-pgr-base-cruds/`): contrato `ActionResult<T>`
  (`src/shared/server/result.ts`), `officeAction`, `requireOfficeStaff()`, paginação offset e UI
  de CRUD em App Router.
- Fatia **006** (`.specs/006-cadastros-base-pgr/`): `categoryTypeSchema`, helpers de validação e
  padrão de escrita auditada (`auditedTenantWrite`).
- Fatia **005** (`.specs/005-modelo-tenant-gate-pro/`): Modelo B de tenant (escritório = `orgs.id`)
  e resolução do escritório ativo.
- Fatia **004** (`.specs/004-multi-tenant-isolation/`): padrão de isolamento multi-tenant com
  backstop no banco (RLS) e auditoria de fronteira.
