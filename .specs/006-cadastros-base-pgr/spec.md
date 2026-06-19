# Feature Specification: Cadastros base do PGR — fundação de dados (Empresa → Funcionário)

**Feature Branch**: `feature/cadastros-base-pgr`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Cadastros base do PGR — fundação de dados da cadeia Empresa → Unidade de Obra → GES → Função → Funcionário. Modela e migra as 7 tabelas base (estendendo `companies`, criando `work_units`, `ges`, `job_roles`, `categories`, `employees` e a junção `ges_job_roles`), com isolamento multi-tenant por RLS, constraints de integridade (FK, UNIQUE, CHECK, enums) e o nº de trabalhadores expostos por GES derivado da associação Função↔GES."

> **Anexo / fonte da verdade**: `docs/briefing-cadastros-base-pgr.md`. Leia inteiro antes
> de planejar. Captura as decisões travadas no brainstorming, as divergências entre a
> issue original e o estado real do repo, o mapa de nomes (inglês), a reconciliação com o
> doc 02 (`ges` substitui `sectors`) e o modelo de colunas MVP por tabela.

> **Esta fatia herda — e NÃO reabre — o Modelo B de tenant da `005`.** Tenant = o
> **escritório** (nosso `orgs.id`), não a organização do Clerk. Toda tabela de dados de
> negócio é uma **dimensão dentro do tenant** e carrega `org_id text NOT NULL → orgs.id`
> com RLS `app_runtime` (backstop herdado da `004`, via `withOrg` + `set_config`). A
> empresa-cliente (`companies`) já existe e é alterada, nunca recriada. Esta é a
> **primeira fatia de dados de domínio** e fixa o precedente de nomes e padrões (inglês)
> para todo o PGR.

> **Premissas erradas da issue original — NÃO reintroduzir** (já corrigidas pela `005`):
> tenant = `organization_id` do Clerk; tabelas/colunas em PT; criar tabela `empresas`
> nova. Substituídas por: tenant = `orgs.id`; identificadores em inglês; `ALTER` em
> `companies`.

## Clarifications

### Session 2026-06-19

Decisões adotadas como padrão informado nesta spec (origem: briefing §10). Podem ser
revisitadas por `/speckit-clarify`; cada uma está registrada em **Assumptions** com a
escolha e o porquê.

- Q: Nomes das tabelas nova de unidade e da junção GES↔Função? → A: **`work_units`** e
  **`ges_job_roles`** (inglês, conforme `CODE_STANDARDS.md`; o nome PT "funcao_setor"
  engana — a junção é Função↔GES, não setor).
- Q: O nº de trabalhadores expostos por GES é coluna persistida ou derivado? → A:
  **Derivado por agregação na leitura** (`SUM(worker_count)` de `ges_job_roles` agrupado
  por `ges_id`) — fonte única, sem denormalização nem trigger.
- Q: `companies.razao_social` passa a `NOT NULL`? → A: **Sim** — tabela praticamente
  vazia hoje; empresa sem razão social não é um cadastro válido.
- Q: `ON DELETE` por FK na cadeia? → A: **`CASCADE` descendo a cadeia da empresa**
  (`companies → work_units → ges → ges_job_roles`); FKs nullable de `employees` para
  `ges`/`job_roles` usam **`SET NULL`**; `categories` é catálogo independente.
- Q: Manter `U(org_id, company_id, title)` em `job_roles`? → A: **Sim** — impede função
  duplicada por nome dentro da mesma empresa do tenant.
- Q: `employees.company_id` é obrigatório e o que acontece ao apagar a empresa? → A:
  **`company_id NOT NULL` + `ON DELETE CASCADE`** — todo funcionário tem empregador;
  apagar a empresa remove seus funcionários (consistente com a cadeia e o edge case
  "apagar `companies` afeta seus … `employees`"). `ges_id`/`job_role_id` seguem nullable
  com `SET NULL`.
- Q: `categories` tem regra de unicidade? → A: **`UNIQUE(org_id, type, name)`** — nome
  único por tipo dentro do tenant; consistente com a unicidade-por-tenant das demais
  tabelas (mantém o catálogo sem duplicatas).
- Q: Quais valores do enum `employee_status`? → A: **`active | on_leave | dismissed`**
  (exposto agora / afastado temporariamente / desligado) — conjunto mínimo suficiente
  para a exposição do PGR; sub-estados de RH podem ser acrescidos depois.
- Q: Quais valores do enum `employee_sex`? → A: **`male | female | not_informed`** — sexo
  biológico (SST/eSocial), com membro explícito `not_informed` em vez de nulo.
- Q: Quais valores do enum `marital_status`? → A:
  **`single | married | divorced | widowed | stable_union`** — conjunto padrão de estado
  civil brasileiro, incluindo união estável.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Isolamento multi-tenant em toda tabela de cadastro (Priority: P1)

Como operador da plataforma, quero que os cadastros de um escritório (empresas, unidades
de obra, GES, funções, categorias, funcionários e suas associações) nunca apareçam para
outro escritório — mesmo que uma consulta esqueça o filtro de tenant — para não vazar
dados entre clientes.

**Why this priority**: Vazamento de dados entre escritórios é a falha crítica de um SaaS
B2B (constituição, Princípio I). Como esta é a primeira fatia que cria tabelas de domínio
em volume, o backstop de RLS precisa estar correto em **cada** tabela nova desde o início
— é o precedente que todo o PGR vai copiar.

**Independent Test**: Para cada uma das 6 tabelas novas + `companies`, inserir registros
em dois tenants A e B, fixar A como tenant ativo e rodar uma consulta **sem** filtro
explícito de tenant; verificar que só retornam registros de A; sem tenant ativo fixado,
verificar que retorna vazio; e que uma escrita marcada para B é rejeitada pelo banco.

**Acceptance Scenarios**:

1. **Given** registros dos escritórios A e B em uma tabela de cadastro e A fixado como
   tenant ativo, **When** uma consulta roda **sem** filtro de tenant, **Then** apenas
   registros de A são retornados.
2. **Given** nenhum tenant ativo fixado na transação, **When** a consulta roda em qualquer
   tabela de cadastro, **Then** nenhuma linha de negócio é retornada (vazio, nunca tudo).
3. **Given** A fixado como tenant ativo, **When** a aplicação tenta gravar um registro
   pertencente ao escritório B, **Then** o banco rejeita a operação (`WITH CHECK`).
4. **Given** um valor de tenant ativo inválido/inexistente, **When** a consulta roda,
   **Then** o resultado é vazio — jamais dados de outro tenant.
5. **Given** uma transação encerrada, **When** outra operação reusa a conexão do pool,
   **Then** o tenant fixado na transação anterior não vaza para a nova.

---

### User Story 2 — Integridade e unicidade dos cadastros (Priority: P1)

Como profissional de SST, quero que a cadeia Empresa → Unidade de Obra → GES →
Função/Funcionário só aceite dados consistentes — sem CPF duplicado na mesma empresa, sem
FK apontando para registro inexistente, sem valor fora dos domínios fechados — para que o
PGR seja construído sobre dados confiáveis.

**Why this priority**: A integridade referencial e as regras de unicidade são a fundação
sobre a qual toda regra de negócio futura do PGR se apoia. Um modelo que aceita dados
inconsistentes propaga erro silencioso para todos os módulos seguintes.

**Independent Test**: Inserir dados ao longo da cadeia e verificar: CPF duplicado na mesma
org é bloqueado, o mesmo CPF em orgs distintas é permitido; o mesmo CNPJ em orgs distintas
é permitido (não é único global); FK inválida em qualquer elo é rejeitada; valores fora
dos enums e dos CHECKs (`risk_grade`, `worker_count`) são rejeitados; `ON DELETE` da
empresa propaga previsivelmente aos filhos.

**Acceptance Scenarios**:

1. **Given** um funcionário com CPF X já cadastrado na org A, **When** outro funcionário
   com o mesmo CPF X é cadastrado na **mesma** org A, **Then** a operação é rejeitada
   (`UNIQUE(org_id, cpf)`).
2. **Given** um funcionário com CPF X na org A, **When** um funcionário com o mesmo CPF X é
   cadastrado na org B, **Then** a operação é aceita (CPF não é único global).
3. **Given** o mesmo CNPJ atendido por dois escritórios, **When** cada um cadastra a
   empresa, **Then** resultam duas empresas distintas (CNPJ não é único global,
   consistente com `companies`/`uq_companies_org_id_cnpj`).
4. **Given** uma tentativa de criar GES, função, funcionário ou associação apontando para
   uma empresa/unidade/GES/função inexistente, **When** a escrita é executada, **Then** o
   banco rejeita por violação de FK.
5. **Given** uma escrita com `category_type`, `employee_sex`, `marital_status` ou
   `employee_status` fora do conjunto fechado, ou `risk_grade` fora de 1..4, ou
   `worker_count` ≤ 0, **When** ela é executada, **Then** o banco a rejeita.
6. **Given** uma empresa com unidades, GES e funcionários, **When** a empresa é apagada,
   **Then** seus registros-filhos são removidos de forma previsível dentro do tenant
   (cascade na cadeia da empresa).

---

### User Story 3 — Nº de trabalhadores expostos por GES (derivado) (Priority: P2)

Como profissional de SST, quero ver o número de trabalhadores expostos de cada GES sempre
coerente com as associações Função↔GES cadastradas, para que o dimensionamento de
exposição nunca fique desatualizado.

**Why this priority**: O nº de expostos é entrada direta da avaliação de risco do PGR. Ele
precisa ser uma leitura confiável da realidade cadastrada — sem drift, sem recálculo
manual. Modelá-lo como derivado (fonte única) evita o bug clássico de denormalização.

**Independent Test**: Criar um GES sem nenhuma associação e verificar que o nº de expostos
é **0** (nunca nulo nem erro); adicionar, alterar e remover associações com diferentes
`worker_count` e verificar que o nº de expostos do GES reflete a soma corrente em todos os
casos.

**Acceptance Scenarios**:

1. **Given** um GES sem nenhuma associação em `ges_job_roles`, **When** seu nº de expostos
   é lido, **Then** o valor é **0** (nunca nulo nem erro).
2. **Given** um GES com associações cujos `worker_count` somam N, **When** seu nº de
   expostos é lido, **Then** o valor é exatamente N.
3. **Given** uma associação adicionada, alterada ou removida, **When** o nº de expostos do
   GES é lido em seguida, **Then** ele reflete imediatamente a nova soma (fonte única, sem
   drift).
4. **Given** GES de tenants distintos, **When** o nº de expostos de um GES do tenant ativo
   é lido, **Then** ele soma apenas associações do tenant ativo (escopo por tenant).

---

### User Story 4 — Fundação de schema versionada e padronizada (Priority: P3)

Como mantenedor do código, quero as 7 entidades expressas como schema-as-code (uma por
arquivo) e aplicadas por uma migration versionada que sobe sem erro — replicando o padrão
canônico de RLS, enums e triggers `set_updated_at` — para que toda fatia futura do PGR
copie um precedente correto.

**Why this priority**: É a entrega estrutural que torna as demais histórias testáveis e
reproduzíveis. Sem a migration aplicável e o padrão fixado, não há fundação sobre a qual
as próximas fatias (UI, PGR, treinamentos) se apoiem.

**Independent Test**: Aplicar a migration desta fatia contra um Postgres limpo e verificar
que as 6 tabelas novas existem com `org_id`, índice, RLS habilitado, policy de isolamento
`app_runtime`, GRANTs e trigger `set_updated_at`; que `companies` ganhou as novas colunas;
e que os enums e CHECKs foram criados.

**Acceptance Scenarios**:

1. **Given** um banco com o schema da `005` aplicado, **When** a migration desta fatia é
   aplicada, **Then** ela conclui sem erro e cria as 6 tabelas novas + altera `companies`.
2. **Given** as tabelas criadas, **When** seu padrão de tenant é inspecionado, **Then**
   cada uma tem `org_id text NOT NULL → orgs.id`, índice em `org_id`, RLS habilitado,
   policy `<t>_isolation` para `app_runtime` e GRANT `SELECT,INSERT,UPDATE,DELETE`.
3. **Given** uma atualização de qualquer linha em uma tabela nova, **When** ela é gravada,
   **Then** `updated_at` é atualizado pelo trigger `set_updated_at`.

---

### Edge Cases

**Isolamento (backstop herdado da `004`/`005`, por tabela nova + `companies`)**

- Dados do escritório A nunca aparecem para B — mesmo numa consulta **sem** filtro de
  tenant — em cada uma das 6 tabelas novas e em `companies`.
- Sem tenant ativo fixado na transação → 0 linhas de negócio (nunca tudo).
- Escrita marcada para outro tenant → rejeitada pelo banco (`WITH CHECK`).
- Valor de tenant ativo inválido/inexistente → conjunto vazio.
- Fixação do tenant escopada à transação → fora dela o valor não vaza no pool.

**Integridade e unicidade**

- `UNIQUE(org_id, cpf)` em `employees`: mesmo CPF em orgs distintas é permitido; CPF
  duplicado na mesma org é bloqueado.
- CNPJ não é único global (consistente com `companies`/FR-018 da `005`).
- FK inválida em qualquer elo da cadeia é rejeitada.
- `ON DELETE` previsível dentro do tenant: apagar `companies` cascateia para
  `work_units` → `ges` → `ges_job_roles` e para seus `employees`; apagar uma
  `ges`/`job_roles` referenciada por `employees` zera (`SET NULL`) os campos
  correspondentes do funcionário (o funcionário permanece).
- Enums fechados (`category_type`, `employee_sex`, `marital_status`, `employee_status`):
  valor fora do conjunto é rejeitado. `risk_grade` fora de 1..4 é rejeitado.
  `worker_count` ≤ 0 em `ges_job_roles` é rejeitado.
- `U(org_id, ges_id, job_role_id)` em `ges_job_roles`: a mesma função não pode ser
  associada duas vezes ao mesmo GES.
- `U(org_id, company_id, title)` em `job_roles`: função duplicada por nome na mesma
  empresa é bloqueada.
- `U(org_id, type, name)` em `categories`: categoria duplicada por nome dentro do mesmo
  tipo (`epi`/`machine`) no tenant é bloqueada.

**Derivação do nº de expostos**

- GES sem nenhuma associação em `ges_job_roles` → nº de expostos = **0** (nunca nulo nem
  erro).
- Adicionar/remover/alterar `worker_count` numa associação reflete imediatamente no nº de
  expostos do GES (fonte única; sem drift).

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. Identificadores de código em
> inglês; termos fiscais/SST intraduzíveis preservados em PT (`cnpj`, `razao_social`,
> `nome_fantasia`, `cnae`, `ges`, `cbo`).

### Functional Requirements

**A — Estrutura e cadeia de entidades**

- **FR-001**: O sistema MUST estender `companies` (ALTER, não recriar) com os campos de
  identidade fiscal, contato, atividade e endereço do briefing §5.1, incluindo
  `risk_grade` (Grau de Risco NR-04), `logo_path` (chave de Storage; upload é fatia
  futura) e `updated_at` com trigger.
- **FR-002**: O sistema MUST criar a entidade **`work_units`** (Unidade de Obra),
  pertencente a uma `companies`, representando o contrato/local de obra.
- **FR-003**: O sistema MUST criar a entidade **`ges`** (Grupo de Exposição Similar),
  pertencente a uma `companies` e a uma `work_units`, com os atributos de ambiente do
  briefing §5.3. `ges` **substitui** o conceito `sectors` do doc 02.
- **FR-004**: O sistema MUST criar a entidade **`job_roles`** (Função), pertencente a uma
  `companies`, com `cbo` como **campo texto** (sem tabela de referência CBO nesta fatia).
- **FR-005**: O sistema MUST criar a entidade **`categories`** (catálogo) com `type` no
  enum fechado `category_type` (`epi | machine`); é catálogo independente do tenant, sem
  vínculo obrigatório à cadeia da empresa.
- **FR-006**: O sistema MUST criar a entidade **`employees`** (Funcionário), com núcleo de
  identidade do briefing §5.6, com `company_id` **obrigatório** (`NOT NULL`) e
  vínculos **opcionais** a `ges_id` e `job_role_id`.
- **FR-007**: O sistema MUST criar a junção **`ges_job_roles`** (GES↔Função), com
  `worker_count` (nº de trabalhadores) e `work_schedule`, registrando quais funções
  compõem cada GES.

**B — Isolamento por tenant (backstop herdado da `004`/`005`)**

- **FR-008**: Toda tabela nova e `companies` MUST carregar `org_id text NOT NULL → orgs.id`
  indexado; toda leitura/escrita de cadastro MUST ser escopada pelo **tenant ativo**
  resolvido de `requireTenantContext()` (das `org_memberships` pelo `userId` da sessão),
  NUNCA de input do cliente nem de `session.orgId`.
- **FR-009**: Toda tabela nova e `companies` MUST ter RLS habilitado com policy
  `<t>_isolation` `FOR ALL TO app_runtime` usando
  `org_id = current_setting('app.current_org', true)` em `USING` e `WITH CHECK`, e GRANT
  `SELECT, INSERT, UPDATE, DELETE` para `app_runtime` — replicando o padrão
  `tenant_probe`/`companies`. A app NÃO conecta como owner.
- **FR-010**: Com o tenant ativo fixado por transação (via `withOrg` + `set_config`), uma
  consulta **sem** filtro explícito de tenant em qualquer tabela de cadastro MUST retornar
  somente registros do tenant ativo.
- **FR-011**: Sem tenant ativo fixado na transação, nenhuma linha de dados de cadastro MUST
  ser retornada (vazio, nunca tudo); um valor de tenant ativo inválido/inexistente MUST
  resultar em conjunto vazio.
- **FR-012**: Uma tentativa de inserir/alterar registro pertencente a um tenant diferente
  do ativo MUST ser rejeitada pelo banco (`WITH CHECK`).

**C — Integridade e unicidade**

- **FR-013**: A cadeia de FKs `companies → work_units → ges → ges_job_roles ← job_roles` e
  `employees → (company, ges, job_role)` MUST ser íntegra: FK inválida em qualquer elo é
  rejeitada pelo banco.
- **FR-014**: `ON DELETE` MUST ser previsível dentro do tenant: `CASCADE` descendo a cadeia
  da empresa (`companies → work_units → ges → ges_job_roles`, e
  `companies → employees`); apagar uma `job_roles` também `CASCADE` em suas linhas de
  `ges_job_roles` (a associação não existe sem a função); as FKs nullable de `employees`
  para `ges`/`job_roles` usam `SET NULL`.
- **FR-015**: `employees` MUST impor `UNIQUE(org_id, cpf)` — CPF duplicado na mesma org é
  bloqueado; o mesmo CPF em orgs distintas é permitido.
- **FR-016**: O CNPJ MUST **não** ser único global (consistente com a `005`): o mesmo CNPJ
  pode existir como empresas distintas em tenants distintos.
- **FR-017**: `ges_job_roles` MUST impor `UNIQUE(org_id, ges_id, job_role_id)`; `job_roles`
  MUST impor `UNIQUE(org_id, company_id, title)`; `categories` MUST impor
  `UNIQUE(org_id, type, name)`.
- **FR-018**: Os domínios fechados MUST ser impostos pelo banco. Enums:
  `category_type` (`epi | machine`); `employee_status` (`active | on_leave | dismissed`);
  `employee_sex` e `marital_status` (membros conforme Clarifications). `risk_grade` via
  `CHECK (1..4)`; `worker_count` via `CHECK (> 0)`. Valor fora do domínio é rejeitado.

**D — Nº de trabalhadores expostos (derivado)**

- **FR-019**: O nº de trabalhadores expostos por GES MUST ser **derivado** da soma de
  `worker_count` em `ges_job_roles` agrupado por `ges_id`, calculado por **agregação na
  leitura** num repositório escopado por `org_id` — **sem** coluna denormalizada e **sem**
  trigger.
- **FR-020**: A leitura do nº de expostos de um GES sem associações MUST retornar **0**
  (nunca nulo nem erro); qualquer alteração nas associações MUST refletir imediatamente na
  próxima leitura (fonte única, sem drift); a agregação MUST somar apenas associações do
  tenant ativo.

**E — Migration e padrões de schema**

- **FR-021**: As 7 entidades MUST ser expressas como schema Drizzle (um arquivo por tabela
  em `src/shared/db/schema/`, re-exportadas pelo index) e materializadas por uma migration
  `0005_*` (Drizzle Kit) que aplica enums, RLS, policies, GRANTs e triggers
  `set_updated_at` (padrão da migration `0001`) sem erro.
- **FR-022**: Toda tabela nova MUST ter `id uuid PK default gen_random_uuid()`,
  `created_at timestamptz NOT NULL default now()` e `updated_at timestamptz NOT NULL` com
  trigger `set_updated_at`; `companies` MUST ganhar `updated_at` + trigger no mesmo ALTER.
- **FR-023**: O acesso a cada entidade MUST ser feito por repositórios escopados por
  `org_id` (services não acessam o ORM diretamente; padrão Repository do
  `CODE_STANDARDS.md`), incluindo a query de agregação do nº de expostos.

**F — Validação e auditoria (transversais, padrão `004`/`005`)**

- **FR-024**: Toda Server Action / Route Handler que leia ou grave cadastro MUST validar a
  entrada por schema (zod) antes da regra de negócio. _Nesta fatia entram os repositórios
  e a validação de domínio; as Server Actions de CRUD com UI são fatia futura — a
  fundação de validação (schemas de entrada e domínios de enum) é entregue agora._
- **FR-025**: A **rejeição cross-tenant pelo banco** (`WITH CHECK`) nos repositórios de
  cadastro MUST gerar log de auditoria com correlação (`requestId`, `orgId`, `userId`,
  operação) e SEM PII, segredos ou payloads sensíveis (`logTenantEvent`, padrão da `004`).
  _O bloqueio por falta de tenant ativo é herdado de `requireTenantContext()` da `005`
  (fora dos repositórios desta fatia) — não há novo caminho de bloqueio aqui._

### Key Entities

- **Empresa (`companies`, ALTER)**: a empresa-cliente, dimensão de negócio dentro do
  tenant (não fronteira de isolamento). Ganha identidade fiscal (`cnpj`, `razao_social`,
  `nome_fantasia`, `cnae`, `main_activity`), `risk_grade` (NR-04, 1..4), contato,
  endereço estruturado e `logo_path`. Raiz da cadeia de cadastros.
- **Unidade de Obra (`work_units`)**: contrato/local de obra de uma empresa. Filha de
  `companies`.
- **GES (`ges`)**: Grupo de Exposição Similar — o agrupamento de exposição (substitui
  `sectors` do doc 02). Filho de `companies` e `work_units`; reúne as funções expostas a
  um mesmo ambiente. Seu **nº de expostos** é derivado, não armazenado.
- **Função (`job_roles`)**: função/cargo de uma empresa, com `cbo` textual. Única por
  `(org_id, company_id, title)`.
- **Categoria (`categories`)**: catálogo de `epi | machine` dentro do tenant; independente
  da cadeia da empresa.
- **Funcionário (`employees`)**: pessoa cadastrada no escritório, com núcleo de identidade
  (nome, `cpf`, sexo, estado civil, contato, etc.), vinculada **obrigatoriamente** a uma
  empresa e **opcionalmente** a um GES e a uma função. Único por `(org_id, cpf)`.
- **Associação GES↔Função (`ges_job_roles`)**: junção que compõe um GES a partir de
  funções, com `worker_count` (> 0) e jornada. Única por `(org_id, ges_id, job_role_id)`.
  Fonte única do nº de expostos.
- **Nº de trabalhadores expostos por GES (derivado)**: valor calculado por
  `SUM(worker_count)` das associações do GES no tenant ativo; 0 quando não há associações.

### Invariantes herdadas (da `005` — não podem ser violadas)

- **Inv-1 — Escopo sempre pelo tenant ativo.** Todo acesso a cadastro é escopado pelo
  tenant ativo (`requireTenantContext()`), nunca por atributo global do usuário nem por
  input do cliente. (FR-008)
- **Backstop de RLS é real.** Consulta sem filtro só vê o tenant ativo; sem tenant ativo →
  vazio (nunca tudo); escrita cross-tenant é rejeitada pelo banco. (FR-010, FR-011,
  FR-012)
- **CNPJ não é único global** (FR-018 da `005`); a unicidade-por-tenant é o padrão
  replicado onde fizer sentido (`UNIQUE(org_id, …)`). (FR-015, FR-016, FR-017)

## Success Criteria _(mandatory)_

### Measurable Outcomes

**Isolamento (verificável nesta fatia)**

- **SC-001**: 0% de registros de um tenant visíveis para usuário de outro tenant, em
  qualquer caminho de leitura, nas 6 tabelas novas e em `companies`.
- **SC-002**: Consulta sem filtro explícito retorna apenas dados do tenant ativo; sem
  tenant ativo, retorna **0 linhas** de negócio (nunca tudo) — em 100% das tabelas de
  cadastro.
- **SC-003**: Tentativa de gravar registro pertencente a outro tenant é rejeitada pelo
  banco em **100%** dos casos.
- **SC-004**: Um valor de tenant ativo inválido/inexistente retorna **0 linhas** — jamais
  dados de outro tenant.

**Integridade (verificável nesta fatia)**

- **SC-005**: CPF duplicado na mesma org é bloqueado em 100% dos casos; o mesmo CPF em
  orgs distintas é aceito em 100% dos casos.
- **SC-006**: O mesmo CNPJ cadastrado em dois tenants resulta em duas empresas distintas
  em 100% dos casos; 0 colisões globais por CNPJ.
- **SC-007**: FK inválida em qualquer elo da cadeia é rejeitada em 100% dos casos.
- **SC-008**: Valor fora dos enums, `risk_grade` fora de 1..4 e `worker_count` ≤ 0 são
  rejeitados em 100% dos casos.
- **SC-009**: Apagar uma empresa remove de forma previsível seus `work_units`, `ges` e
  `ges_job_roles` dentro do tenant; 0 registros-filhos órfãos.

**Nº de expostos derivado (verificável nesta fatia)**

- **SC-010**: O nº de expostos de um GES sem associações é **0** em 100% dos casos (0
  nulos, 0 erros).
- **SC-011**: O nº de expostos de um GES é igual à soma corrente de `worker_count` das suas
  associações em 100% das leituras, imediatamente após qualquer alteração (0 drift).

**Fundação de schema (verificável nesta fatia)**

- **SC-012**: A migration `0005_*` aplica sem erro contra um Postgres limpo (com `005`
  aplicado) e cria 6 tabelas novas + altera `companies`, cada tabela nova com RLS, policy
  `app_runtime`, índice em `org_id` e trigger `set_updated_at`.
- **SC-013**: `npm run test`, `npm run test:integration`, `npm run lint` e a checagem de
  tipos ficam verdes — incluindo o caminho crítico de isolamento em Postgres efêmero.

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os testes
abaixo verdes, além de `npm run lint` e checagem de tipos. Casos críticos multi-tenant são
escritos/validados à mão.

- **Unitários (regra/validação/agregação)**: schemas zod de entrada; domínios de enum;
  `worker_count > 0`; `risk_grade ∈ 1..4`; cálculo do nº de expostos por agregação
  (incluindo o caso 0 sem associações).
- **Integração — RLS contra Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**): para
  cada tabela nova + `companies` — dados da org A não vazam para a org B (uma asserção por
  tabela); sem tenant ativo, vazio; rejeição de escrita cross-tenant (`WITH CHECK`);
  `UNIQUE(org_id, cpf)` bloqueia duplicata na mesma org e permite em orgs distintas;
  integridade de FK ao longo da cadeia; `ON DELETE` cascade da empresa; nº de expostos
  reflete a soma de `ges_job_roles`.

> Justificativa do Postgres efêmero: o SQLite não tem RLS nem policies; o backstop só pode
> ser provado contra Postgres real (branch efêmera), conforme `004`/`005` e a constituição.

## Assumptions

Decisões em aberto do briefing §10 resolvidas aqui como **padrão informado** (revisitáveis
por `/speckit-clarify`):

- **A1 — Nomes `work_units` e `ges_job_roles`** adotados (inglês, `CODE_STANDARDS.md`). O
  nome PT "funcao_setor" da issue é descartado por enganar (a junção é Função↔GES).
- **A2 — Nº de expostos derivado por agregação na leitura** (recomendação do briefing
  §6.3): fonte única em `ges_job_roles`, sem coluna denormalizada e sem trigger (KISS/DRY;
  lógica testável). A alternativa de coluna recalculada na Server Action fica descartada
  nesta fatia.
- **A3 — `companies.razao_social` passa a `NOT NULL`**: tabela praticamente vazia hoje
  (backfill trivial/desnecessário); uma empresa sem razão social não é cadastro válido.
- **A4 — `ON DELETE`**: `CASCADE` descendo a cadeia da empresa
  (`companies → work_units → ges → ges_job_roles` e `companies → employees`); `SET NULL`
  nas FKs nullable de `employees` para `ges`/`job_roles` (apagar um GES/função não apaga o
  funcionário, apenas desvincula); `employees.company_id` é `NOT NULL` (todo funcionário
  tem empregador); `categories` independente.
- **A5 — `U(org_id, company_id, title)` em `job_roles`** mantido: impede função duplicada
  por nome na mesma empresa do tenant.
- **A6 — Campos `*_path` (`logo_path`, `photo_path`) entram como texto agora**; o upload de
  logo/foto 3x4 é fatia futura.
- **A7 — Modelo B de tenant e motor de isolamento da `004`/`005` reutilizados sem
  mudança**: `org_id text NOT NULL → orgs.id`, `withOrg` + `set_config`, RLS `app_runtime`,
  `tenant_probe` como padrão canônico. Muda apenas o conjunto de tabelas, não o motor.
- **A8 — Drizzle é dono code-first do schema**; runtime conecta como `app_runtime` (pooler
  6543), `drizzle-kit` usa conexão direta como owner — herdado do repo.

## Out of Scope

Especificado para registro; implementado em fatias futuras.

- **UI/formulários** das 7 entidades; **lookup de CNPJ**; **ViaCEP**; **upload** de
  logo/foto 3x4 (apenas os campos `*_path` entram agora).
- **Tabela de referência de CBO** — `cbo` é campo texto em `job_roles`.
- **Vínculo `job_roles` ↔ `training_catalog`** (módulo Treinamentos — o catálogo ainda não
  existe).
- **Contatos de emergência, CNH e passaporte** em `employees` — deferidos (YAGNI); não são
  necessários à cadeia nem ao núcleo de identidade do MVP.
- **Enforcement de plano/gate** e **vínculo `employees` ↔ `risks`** (módulo PGR; quando
  vier, `risks.sector_id` do doc 02 nasce como `risks.ges_id`).
- **Server Actions de CRUD com UI** para as entidades — esta fatia entrega schema,
  migration, repositórios e validação de domínio; os fluxos de escrita com interface são
  fatia seguinte.
