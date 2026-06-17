# Feature Specification: Isolamento Multi-Tenant — onboarding/troca de organização + backstop de Row Level Security

**Feature Branch**: `feature/multi-tenant-isolation`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "Multi-tenant isolation — organization onboarding/switching + Row Level Security backstop"

> Esta fatia entrega o isolamento multi-tenant de ponta a ponta em **duas camadas
> complementares que formam uma única fatia coesa**:
>
> - **Camada A — contexto de tenant na aplicação**: o onboarding e a troca da
>   organização ativa. É o que conecta o usuário autenticado ao seu tenant e
>   define o `orgId` da sessão. É a **primeira barreira** de isolamento.
> - **Camada B — backstop no banco (Row Level Security)**: a segunda barreira,
>   defesa em profundidade. Uma query que esqueça o filtro de tenant ainda deve
>   filtrar pela organização ativa.
>
> No modelo do produto, cada organização do Clerk equivale a uma **Empresa** — a
> entidade raiz de todo o contexto multi-tenant. O seletor de organização do
> shell garante que todo dado exibido pertença à empresa ativa, e o contexto
> selecionado persiste após recarregamento. O escopo na aplicação é a primeira
> barreira; o RLS é a rede de segurança contra bugs.

## Clarifications

### Session 2026-06-17

- Q: A tabela de demonstração de RLS é permanente ou efêmera? → A: Tabela de referência **permanente** e mínima, criada por migration, mantida no schema como exemplo canônico e alvo dos testes de isolamento.
- Q: Para onde vai o usuário quando perde acesso à organização ativa (ex.: foi removido)? → A: Sempre para o **onboarding** — mesmo caminho de "sem organização ativa"; o onboarding já apresenta outras empresas/convites se houver, ou a opção de criar nova.
- Q: Auditoria de eventos de segurança de tenant entra nesta fatia? → A: **Sim** — logar eventos de fronteira de tenant (troca de organização, acesso bloqueado sem org ativa, rejeição cross-tenant pelo banco) com correlação (`requestId`/`orgId`/`userId`), sem PII/segredos.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Onboarding: criar organização (Priority: P1)

Como usuário autenticado que ainda não pertence a nenhuma empresa, quero ser
levado a um fluxo de onboarding e criar uma organização, para começar a usar o
sistema e chegar ao dashboard da empresa criada.

**Why this priority**: Sem uma organização ativa não há acesso a nenhum dado de
negócio. Esta é a porta de entrada de todo usuário novo — sem ela, ninguém
chega ao produto.

**Independent Test**: Entrar como usuário recém-cadastrado sem nenhuma empresa,
verificar que o destino é o onboarding (não o dashboard), criar uma organização
e confirmar que o destino final é o dashboard daquela empresa, com ela já
selecionada como ativa.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem nenhuma organização, **When** ele acessa
   a área autenticada, **Then** é direcionado ao onboarding e nenhum conteúdo de
   negócio é renderizado.
2. **Given** o usuário no onboarding, **When** ele cria uma nova organização,
   **Then** essa organização passa a ser a ativa e ele chega ao dashboard dela.

---

### User Story 2 — Trocar a organização ativa pelo seletor (Priority: P1)

Como usuário que pertence a várias empresas, quero trocar a organização ativa
pelo seletor do shell, para ver apenas os dados da empresa selecionada.

**Why this priority**: A multi-tenancy só é utilizável se o usuário consegue
escolher e alternar com segurança o tenant em foco. É o equivalente ao seletor
global de empresa do produto.

**Independent Test**: Com um usuário membro de duas empresas (A e B), com dados
distintos em cada, trocar de A para B pelo seletor e confirmar que 100% dos
dados exibidos passam a ser de B e nenhum dado de A permanece visível.

**Acceptance Scenarios**:

1. **Given** um usuário membro das empresas A e B com A ativa, **When** ele
   seleciona B no seletor, **Then** todos os dados exibidos passam a ser de B.
2. **Given** a troca para B concluída, **When** a tela é re-renderizada,
   **Then** nenhum dado de A permanece visível.
3. **Given** a empresa B ativa, **When** qualquer leitura ou escrita ocorre,
   **Then** o `orgId` usado é o de B e bate com a seleção do seletor.

---

### User Story 3 — Backstop de leitura: query sem filtro ainda isola o tenant (Priority: P1)

Como operador da plataforma, quero que uma query que esqueça o filtro de
organização ainda retorne apenas dados do tenant ativo, para que um bug de
aplicação não vaze dados entre clientes.

**Why this priority**: Vazamento de dados entre empresas é a falha crítica de
um SaaS B2B (constituição, Princípio I). O RLS é a rede que segura o erro humano.

**Independent Test**: Numa tabela com RLS habilitado e o tenant ativo fixado na
transação, executar uma consulta **sem** o filtro explícito de organização e
verificar que retorna somente os registros do tenant ativo.

**Acceptance Scenarios**:

1. **Given** registros das empresas A e B na mesma tabela e A fixada como tenant
   ativo na transação, **When** uma consulta roda **sem** `WHERE organization`,
   **Then** apenas registros de A são retornados.
2. **Given** o mesmo cenário com B fixada como tenant ativo, **When** a mesma
   consulta roda, **Then** apenas registros de B são retornados.
3. **Given** nenhum tenant ativo fixado na transação, **When** a consulta roda,
   **Then** nenhuma linha de negócio é retornada.

---

### User Story 4 — Padrão de isolamento por tabela validado numa tabela de teste (Priority: P1)

Como engenheiro, quero um padrão de policy de isolamento por tabela + fixação do
tenant por transação documentado e validado numa tabela de teste, para replicá-lo
em cada novo módulo sem reinventar.

**Why this priority**: Cada módulo futuro (funcionários, EPIs, PGR, etc.) vai
herdar este padrão. Sem um exemplo canônico provado, cada fatia correria o risco
de aplicar o isolamento de forma inconsistente.

**Independent Test**: Verificar que existe uma tabela de demonstração criada por
migration com RLS habilitado e policy aplicada, e que a suíte de testes prova o
padrão (isolamento de leitura, rejeição de escrita cruzada e escopo por
transação) contra ela.

**Acceptance Scenarios**:

1. **Given** o padrão (policy `USING`/`WITH CHECK` + fixação do tenant por
   transação + helper de acesso), **When** um engenheiro precisa isolar uma nova
   tabela, **Then** o padrão está documentado de forma replicável.
2. **Given** a tabela de demonstração, **When** as migrations são aplicadas em um
   ambiente limpo, **Then** a tabela existe com RLS habilitado e a policy ativa,
   sem nenhum passo manual fora de migration.

---

### User Story 5 — Onboarding: aceitar convite pendente (Priority: P2)

Como usuário com convite pendente, quero aceitar o convite no onboarding, para
entrar na empresa que me convidou em vez de criar uma nova.

**Why this priority**: É o caminho de entrada de colaboradores em empresas
existentes — comum, mas secundário em relação à criação da primeira empresa.

**Independent Test**: Entrar como usuário com um convite pendente, aceitá-lo pelo
onboarding e confirmar que passa a acessar a empresa que convidou, com ela ativa.

**Acceptance Scenarios**:

1. **Given** um usuário sem organização e com convite pendente, **When** ele
   acessa o onboarding, **Then** o convite pendente é apresentado como opção.
2. **Given** o convite apresentado, **When** o usuário o aceita, **Then** ele
   passa a pertencer àquela empresa, que se torna a ativa, e chega ao dashboard.

---

### User Story 6 — Persistência da organização ativa (Priority: P2)

Como usuário, quero que a empresa ativa que selecionei continue selecionada após
recarregar a página ou reabrir a sessão, sem precisar reescolher.

**Why this priority**: Reescolher a empresa a cada acesso é atrito desnecessário
e fonte de erro (operar no tenant errado). Importa para a experiência, mas o
isolamento em si não depende disso.

**Independent Test**: Selecionar a empresa B, recarregar a página e reabrir a
sessão; confirmar que B permanece a ativa em ambos os casos.

**Acceptance Scenarios**:

1. **Given** a empresa B selecionada como ativa, **When** a página é recarregada,
   **Then** B continua ativa.
2. **Given** a empresa B selecionada como ativa, **When** a sessão é reaberta,
   **Then** B continua ativa, sem nova escolha.

---

### User Story 7 — Backstop de escrita: rejeição de escrita cross-tenant (Priority: P2)

Como engenheiro, quero que uma tentativa de escrever um registro de outra
organização que não a ativa seja rejeitada pelo banco, mesmo que a aplicação erre.

**Why this priority**: Complementa o backstop de leitura — fecha a porta para
gravações cruzadas que corromperiam o isolamento. É a contrapartida de escrita
do Princípio I.

**Independent Test**: Com a empresa A fixada como tenant ativo na transação,
tentar gravar um registro marcado como pertencente à empresa B e verificar que o
banco rejeita a operação.

**Acceptance Scenarios**:

1. **Given** A fixada como tenant ativo, **When** a aplicação tenta inserir um
   registro com organização = B, **Then** o banco rejeita a gravação.
2. **Given** A fixada como tenant ativo, **When** a aplicação tenta alterar um
   registro para organização = B, **Then** o banco rejeita a alteração.

---

### User Story 8 — Bloqueio de acesso sem organização ativa (Priority: P3)

Como operador da plataforma, quero que qualquer acesso à área autenticada sem
organização ativa seja bloqueado/redirecionado, para não existir tela sem tenant.

**Why this priority**: Garante a invariante "sem tenant, sem dado" em todos os
caminhos de entrada. É um reforço da regra já coberta pelo onboarding (US1),
agora como garantia transversal.

**Independent Test**: Acessar diferentes rotas da área autenticada com uma sessão
sem organização ativa e confirmar que todas redirecionam ao onboarding sem
renderizar conteúdo de negócio.

**Acceptance Scenarios**:

1. **Given** uma sessão autenticada sem organização ativa, **When** o usuário
   acessa qualquer rota da área autenticada, **Then** é redirecionado ao
   onboarding.
2. **Given** o mesmo estado, **When** uma Server Action ou Route Handler de
   negócio é invocado, **Then** a operação é bloqueada antes de qualquer acesso a
   dado.

---

### User Story 9 — Padrão de RLS documentado para revisão (Priority: P3)

Como revisor, quero o padrão de RLS documentado (policy `USING`/`WITH CHECK` +
helper de acesso org-scoped) para exigir sua aplicação na modelagem de cada módulo.

**Why this priority**: Transforma o padrão em critério de revisão repetível. É
governança — depende do padrão já existir (US4), por isso prioridade menor.

**Independent Test**: Localizar a documentação do padrão e confirmar que descreve
policy, fixação do tenant por transação e helper de acesso de forma suficiente
para um revisor cobrar sua aplicação em uma PR de novo módulo.

**Acceptance Scenarios**:

1. **Given** uma PR que adiciona uma nova tabela de dados de negócio, **When** o
   revisor consulta a documentação do padrão, **Then** consegue verificar se RLS,
   policy e helper foram aplicados conforme o padrão.

---

### Edge Cases

- **Usuário autenticado sem nenhuma organização** → vai ao onboarding; nenhum
  conteúdo de negócio é renderizado (US1, US8).
- **Usuário com um ou mais convites pendentes** → convites apresentados no
  onboarding como alternativa a criar empresa (US5).
- **Primeiro acesso multi-empresa sem organização ativa selecionada** → tratado
  como "sem tenant ativo": acesso bloqueado até a seleção (US8).
- **Usuário removido de uma empresa** → perde acesso àquele tenant; se era a
  ativa, é tratado como "sem organização ativa" e redirecionado ao onboarding,
  que apresenta outras empresas/convites se houver.
- **Troca de organização no meio de uma navegação com dados já carregados** →
  após a troca, os dados exibidos passam a ser exclusivamente da nova empresa;
  nada da anterior permanece (US2).
- **Transação sem o tenant ativo definido no banco** → retorna vazio, nunca tudo
  (US3, cenário 3).
- **Leitura e escrita cruzando organizações** → ambas barradas pelo RLS (US3, US7).
- **Valor de `app.current_org` inválido / inexistente** → o RLS não casa nenhuma
  linha; o resultado é vazio, jamais dados de outra organização.
- **Pooler em transaction mode** → a fixação do tenant é escopada à transação;
  fora dela o valor não persiste e não vaza para a próxima operação no pool.
- **Conexão com papel que ignora RLS** → não é usada pela aplicação; o runtime
  conecta apenas com o papel restrito sujeito a RLS.

## Requirements _(mandatory)_

### Functional Requirements

**Camada A — contexto de tenant na aplicação**

- **FR-001**: O sistema MUST direcionar ao onboarding (não ao dashboard) todo
  usuário autenticado que não pertence a nenhuma organização.
- **FR-002**: O sistema MUST permitir criar uma nova organização no onboarding e,
  ao concluir, definir essa organização como ativa e levar o usuário ao dashboard
  dela.
- **FR-003**: O sistema MUST permitir aceitar um convite pendente no onboarding;
  ao aceitar, o usuário passa a pertencer àquela empresa, que se torna a ativa.
- **FR-004**: O sistema MUST oferecer, no shell da área autenticada, um seletor
  que permita trocar a organização ativa entre as empresas a que o usuário
  pertence.
- **FR-005**: Ao trocar de organização, o sistema MUST garantir que 100% dos
  dados exibidos passem a ser da nova empresa e que nenhum dado da empresa
  anterior permaneça visível.
- **FR-006**: A organização ativa selecionada MUST persistir entre
  recarregamentos de página e reaberturas de sessão, sem nova escolha.
- **FR-007**: Qualquer acesso à área autenticada sem organização ativa MUST ser
  bloqueado/redirecionado ao onboarding, sem renderizar conteúdo de negócio.
- **FR-008**: O `orgId`/tenant ativo MUST vir sempre da sessão autenticada
  (Clerk), NUNCA de input do cliente (query string, body ou header).
- **FR-009**: Toda leitura e escrita de dados de negócio MUST ocorrer no escopo
  da organização ativa, e o `orgId` usado MUST bater com a organização
  selecionada no seletor.
- **FR-010**: Quando um usuário é removido de uma empresa, o sistema MUST revogar
  seu acesso àquele tenant; se era a organização ativa, MUST tratá-lo como "sem
  organização ativa" e redirecioná-lo ao onboarding (mesmo caminho de FR-007),
  onde outras empresas/convites são apresentados, se houver.

**Camada B — backstop de Row Level Security**

- **FR-011**: O RLS MUST ser habilitado, por tabela de dados de negócio, via
  migration (SQL custom no ferramental de migrations); o banco NUNCA é alterado
  manualmente fora de migration.
- **FR-012**: O tenant ativo MUST ser fixado por transação, no início de cada
  transação de acesso, por um helper centralizado — nunca caso a caso.
- **FR-013**: Numa tabela com RLS habilitado e tenant ativo fixado, uma consulta
  SEM o filtro explícito de organização MUST retornar somente os registros do
  tenant ativo.
- **FR-014**: Sem tenant ativo fixado na transação, nenhuma linha de dados de
  negócio MUST ser retornada.
- **FR-015**: Uma tentativa de gravar (inserir ou alterar) um registro
  pertencente a uma organização diferente da ativa MUST ser rejeitada pelo banco.
- **FR-016**: A fixação do tenant MUST ser escopada à transação, compatível com o
  pooler em transaction mode; fora da transação o valor NÃO persiste.
- **FR-017**: A aplicação MUST conectar ao banco com um papel restrito sujeito a
  RLS; NUNCA com um papel que ignora RLS.
- **FR-018**: Um valor de tenant ativo inválido ou inexistente MUST resultar em
  conjunto vazio — jamais em dados de outra organização.
- **FR-019**: O padrão de isolamento (policy `USING`/`WITH CHECK` + fixação do
  tenant por transação + helper de acesso org-scoped) MUST estar documentado de
  forma replicável, e MUST haver uma tabela de demonstração **permanente**, criada
  por migration, que prove o padrão aplicado.

**Observabilidade — auditoria de fronteira de tenant (transversal às camadas A e B)**

- **FR-020**: O sistema MUST registrar log de auditoria nos eventos de fronteira
  de tenant — troca de organização ativa, acesso bloqueado por falta de
  organização ativa, e rejeição cross-tenant pelo banco (leitura ou escrita) —
  com correlação (`requestId`, `orgId`, `userId`, operação) e SEM PII, segredos
  ou payloads sensíveis. O bloqueio sem org ativa e a rejeição cross-tenant são
  determinísticos no servidor. A troca de organização é registrada no **ponto de
  entrada pós-troca**: o carregamento do shell autenticado após o redirecionamento
  de `afterSelectOrganizationUrl`, comparando o `orgId` ativo com o último
  observado na sessão.

### Key Entities

- **Organização ativa (tenant)**: a empresa em foco na sessão. Equivale a uma
  organização do Clerk. É a raiz de todo o escopo de dados; identificada pelo
  `orgId` da sessão.
- **Sessão autenticada**: origem única e confiável do `orgId` e do `userId`.
  Nenhum identificador de tenant vem de input do cliente.
- **Convite pendente**: vínculo proposto entre um usuário e uma empresa
  existente, aceitável no onboarding como alternativa a criar nova empresa.
- **Membership (vínculo usuário↔organização)**: determina a quais empresas o
  usuário pertence e, portanto, quais pode selecionar; sua revogação remove o
  acesso ao tenant.
- **Tenant ativo da transação**: variável de sessão do banco que fixa, por
  transação, a organização contra a qual o RLS avalia as policies.
- **Tabela de demonstração de RLS**: tabela de referência, criada por migration,
  com `organization_id` e policy de isolamento — serve de exemplo canônico,
  replicável em cada novo módulo, e de alvo dos testes de isolamento.

## Success Criteria _(mandatory)_

### Measurable Outcomes

**Camada A — contexto de tenant na aplicação**

- **SC-001**: 100% dos usuários recém-cadastrados sem empresa são direcionados ao
  onboarding (não ao dashboard) ao entrar.
- **SC-002**: Após criar uma organização no onboarding, o usuário chega ao
  dashboard daquela empresa, com ela ativa.
- **SC-003**: Usuário com convite pendente consegue aceitá-lo pelo onboarding e
  passa a acessar a empresa que convidou.
- **SC-004**: Ao trocar de organização pelo seletor, 100% dos dados exibidos são
  da nova empresa e 0% dados da empresa anterior permanecem visíveis.
- **SC-005**: 100% das requisições à área autenticada sem organização ativa são
  bloqueadas/redirecionadas ao onboarding — nenhuma renderiza conteúdo de negócio.
- **SC-006**: A organização ativa selecionada persiste em 100% dos
  recarregamentos e reaberturas de sessão.
- **SC-007**: O `orgId` usado em toda leitura/escrita coincide com a organização
  selecionada no seletor em 100% dos casos.

**Camada B — backstop de Row Level Security**

- **SC-008**: Com tenant ativo fixado, uma consulta sem filtro explícito de
  organização retorna somente registros do tenant ativo (0 registros de outra
  organização).
- **SC-009**: Uma tentativa de gravar registro pertencente a outra organização é
  rejeitada pelo banco em 100% das tentativas.
- **SC-010**: Sem tenant ativo fixado na transação, a consulta retorna 0 linhas
  de dados de negócio.
- **SC-011**: A fixação do tenant não persiste fora da transação — uma operação
  subsequente no mesmo pool, sem fixação, retorna 0 linhas.
- **SC-012**: O padrão está documentado de forma replicável e a tabela de
  demonstração comprova o padrão aplicado via migration em ambiente limpo, sem
  passos manuais.

**Observabilidade**

- **SC-013**: Os eventos de fronteira de tenant geram log de auditoria com
  `requestId`, `orgId`, `userId` e operação, e 0 logs contêm PII ou segredos.
  Cobertura: 100% dos bloqueios por falta de org ativa e 100% das rejeições
  cross-tenant (ambos determinísticos no servidor); a troca de organização é
  logada no ponto de entrada pós-troca (carregamento do shell após
  `afterSelectOrganizationUrl`).

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída
sem os testes abaixo verdes, além de `npm run lint` e checagem de tipos:

- **Unitários**: detecção de "usuário sem organização"; regra de bloqueio da área
  autenticada; resolução do `orgId` a partir da sessão.
- **Integração da camada de aplicação (SQLite em memória)**: Server Actions /
  Route Handlers que dependem da organização ativa, incluindo o caminho de
  bloqueio quando não há tenant ativo.
- **Integração da camada RLS (Postgres efêmero, não SQLite)**: justificativa — o
  SQLite não tem RLS nem policies; o backstop só pode ser provado contra Postgres
  real (branch efêmera do Supabase).
- **Caminho crítico de isolamento (escrito/validado à mão)**: com tenant A ativo,
  consulta sem filtro retorna só dados de A; com tenant B ativo, só dados de B;
  sem tenant, vazio; e dados de uma organização nunca aparecem para outra após a
  troca de organização.
- **Rejeição de escrita cross-tenant** (`WITH CHECK`).
- **Escopo do tenant por transação**: o valor fixado não vaza para fora da
  transação.
- **Auditoria de fronteira de tenant**: os eventos de troca de organização,
  bloqueio sem org ativa e rejeição cross-tenant emitem log com a correlação
  esperada e sem PII/segredos.

## Assumptions

- O **papel restrito sujeito a RLS** (pré-requisito desta fatia) já está
  provisionado por migration anterior; esta fatia o consome, não o cria.
- A resolução do `orgId` a partir da sessão já existe na camada de autenticação;
  esta fatia a reutiliza e amplia (onboarding, bloqueio, helper de acesso).
- A persistência da organização ativa entre sessões é responsabilidade do
  provedor de autenticação (organização ativa da sessão Clerk); a aplicação a
  consome, não implementa armazenamento próprio de seleção.
- Como ainda não existem tabelas de módulos de negócio, a **tabela de
  demonstração de RLS** é uma tabela de referência permanente, criada por
  migration, que serve de exemplo canônico do padrão e de alvo dos testes — não
  um artefato descartável.
- O escopo desta fatia é entregar o **padrão + a tabela de demonstração**;
  aplicar RLS às tabelas reais de cada módulo ocorre nas fatias dos respectivos
  módulos, herdando este padrão.
- Sugestões técnicas (componentes nativos do provedor de auth para criar
  organização e trocar de organização; forma exata da policy e do helper de
  acesso) ficam para o plano — esta spec define o "o quê" e o "porquê".

## Out of Scope

- Aplicação de RLS às tabelas de módulos de negócio reais (funcionários, EPIs,
  PGR, etc.) — virão nas fatias de cada módulo.
- Autorização fina por papel dentro da organização (quem pode fazer o quê) — esta
  fatia trata de isolamento de tenant, não de permissões intra-org.
- Particionamento de Storage por organização — coberto pela fatia/documentação de
  Storage.
- Gestão de convites e papéis (emissão, revogação) além de **aceitar** um convite
  pendente no onboarding.
