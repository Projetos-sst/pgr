# Feature Specification: Modelo de tenant multiempresa + fundação de Equipe e Acessos com Gate PRO

**Feature Branch**: `feature/modelo-tenant-gate-pro`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Modelo de tenant multiempresa + fundação de Equipe e Acessos com Gate PRO — corrige a premissa de tenant, estabelece o modelo de identidade/membership e o isolamento, e introduz o campo de plano (free|pro) que serve de base ao Gate PRO."

> **Anexo / fonte da verdade**: `docs/briefing-equipe-acessos-gate-pro.md` (decisão de
> modelo, invariantes, catálogo de edge cases, modelo de dados e análise de custo).
> Nenhuma invariante nem edge case relevante deste briefing pode ser perdido — o
> isolamento entre clientes (vazamento de dados) é a falha mais grave de um SaaS B2B.

> **Esta fatia corrige a premissa de tenant da fatia `004`.** Em `004` assumiu-se
> "organização do provedor de auth = Empresa". Aqui a premissa é invertida para o
> **Modelo B**: **tenant = Escritório/conta do profissional de SST**; **Empresa-cliente
> = entidade de negócio _dentro_ do tenant** (uma dimensão de dados, não uma fronteira
> de isolamento). O motor de isolamento da `004` (helper de tenant por transação,
> backstop de Row Level Security, tabela de demonstração, auditoria de fronteira)
> permanece válido e é reutilizado; muda o **significado** do identificador de tenant e
> nasce a entidade **empresa-cliente**. Um humano decide, no checkpoint, se emenda a
> `004` ou trata esta fatia como superseding.

## Clarifications

### Session 2026-06-19

- Q: Usuário que entra apenas por convite (sem nunca ter se cadastrado sozinho) ganha workspace/tenant próprio? → A: **Sim, sempre** — toda identidade tem um tenant próprio (papel proprietário), uniforme e de custo zero (não vira organização no provedor de auth enquanto free). Mantém a invariante "toda identidade tem um tenant". _O fluxo de convite em si é fatia futura._
- Q: Downgrade PRO→free com equipe ativa apaga ou preserva os vínculos? → A: **Preserva** — os vínculos da equipe são **suspensos** (não apagados) e os dados ficam intactos; re-upgrade restaura. _O enforcement do downgrade é fatia futura; aqui só se registra a regra._
- Q: O papel "cliente" é uma entidade separada ou um vínculo? → A: É um **vínculo (membership)** com escopo restrito a uma empresa-cliente (`scoped_company_id`), mesma mecânica dos demais papéis — não uma entidade paralela.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Workspace próprio no cadastro (Priority: P1)

Como profissional de SST recém-cadastrado, quero já entrar com um espaço próprio e
isolado (meu escritório), para usar o sistema sozinho — sem depender de convite nem de
escolher uma organização.

**Why this priority**: Sem um tenant próprio não há onde isolar dado nenhum. É a porta
de entrada de toda conta nova, **inclusive free**, e a base sobre a qual todo o resto
(plano, equipe, empresas-cliente) se apoia.

**Independent Test**: Concluir o cadastro de um usuário novo e verificar que ele já
possui um tenant próprio, com ele como **proprietário**, e que chega à área autenticada
operando dentro desse tenant — sem passar por convite nem por uma escolha de
organização.

**Acceptance Scenarios**:

1. **Given** um usuário concluindo o cadastro, **When** a conta é criada, **Then** um
   tenant próprio é criado e o usuário fica vinculado a ele com papel **proprietário**.
2. **Given** o tenant recém-criado, **When** o usuário acessa a área autenticada,
   **Then** o tenant próprio é o tenant ativo e nenhum passo de "escolher organização" é
   exigido.
3. **Given** uma conta **free**, **When** o usuário usa o sistema, **Then** ele opera
   sozinho dentro do próprio tenant, com isolamento de dados desde o primeiro acesso.

---

### User Story 2 — Backstop de isolamento por tenant (Priority: P1)

Como operador da plataforma, quero que os dados de um escritório nunca apareçam para
outro — mesmo que uma consulta esqueça o filtro de tenant — para não vazar dados entre
clientes.

**Why this priority**: Vazamento de dados entre escritórios é a falha crítica de um SaaS
B2B (constituição, Princípio I). O backstop no banco é a rede que segura o erro humano,
herdada e estendida da fatia `004` ao novo significado de tenant (escritório) e à nova
dimensão `empresa-cliente`.

**Independent Test**: Numa tabela com o backstop habilitado e o tenant ativo fixado por
transação, executar uma consulta **sem** o filtro explícito de tenant e verificar que
retorna somente os registros do tenant ativo; sem tenant ativo, verificar que retorna
vazio; e que uma escrita marcada para outro tenant é rejeitada.

**Acceptance Scenarios**:

1. **Given** registros dos escritórios A e B na mesma tabela e A fixado como tenant
   ativo, **When** uma consulta roda **sem** filtro de tenant, **Then** apenas registros
   de A são retornados.
2. **Given** nenhum tenant ativo fixado na transação, **When** a consulta roda, **Then**
   nenhuma linha de negócio é retornada (vazio, nunca tudo).
3. **Given** A fixado como tenant ativo, **When** a aplicação tenta gravar um registro
   pertencente ao escritório B, **Then** o banco rejeita a operação.

---

### User Story 3 — Campo de plano do tenant (free|pro) (Priority: P1)

Como produto, quero distinguir tenants free de PRO por um campo de plano no tenant, para
servir de base ao futuro Gate PRO de "Equipe e Acessos".

**Why this priority**: O plano é a chave que, em fatias futuras, destrava a gestão de
equipe e alinha o custo de organização do provedor de auth à receita. Sem o campo, não
há como construir o gate depois. Nesta fatia entrega-se **apenas o campo/estado**.

**Independent Test**: Verificar que todo tenant possui exatamente um valor de plano,
default `free`, assumindo apenas `free` ou `pro`, e que o valor é propriedade do tenant
(não do usuário).

**Acceptance Scenarios**:

1. **Given** um tenant recém-criado, **When** ele é persistido, **Then** seu plano é
   `free` por default.
2. **Given** qualquer tenant, **When** seu plano é lido, **Then** o valor é exatamente
   um de `{ free, pro }` — nunca nulo nem outro valor.
3. **Given** um usuário com vínculos a tenants de planos diferentes, **When** o plano é
   resolvido, **Then** ele é lido do **tenant ativo**, nunca de um "plano do usuário"
   global.

---

### User Story 4 — Uma identidade, vários escritórios (Priority: P2)

Como usuário convidado para o escritório de um terceiro, quero pertencer a esse
escritório mantendo meu próprio espaço, e alternar entre eles com segurança, para atuar
em mais de um contexto sem misturar dados.

**Why this priority**: É o que torna a multiempresa real — uma identidade com N vínculos
(modelo Slack/Notion). O **modelo de dados** que sustenta os N vínculos é fundação desta
fatia; o **fluxo de convite e o seletor de troca** são fatias futuras (ver Out of Scope).

**Independent Test**: Modelar uma identidade com dois vínculos (proprietário do tenant
próprio + colaborador de um tenant de terceiro) e verificar que ambos coexistem (vínculo
é **aditivo**, nunca substitui), que papel e plano são resolvidos **por vínculo do
tenant ativo**, e que um usuário com 2+ vínculos é elegível ao seletor de troca
(presença do seletor é fatia futura).

**Acceptance Scenarios**:

1. **Given** uma identidade já proprietária do próprio tenant, **When** ela passa a ter
   um segundo vínculo a outro tenant, **Then** os dois vínculos coexistem e o tenant
   próprio **não** é perdido nem substituído.
2. **Given** uma identidade com vínculos a um tenant free (próprio) e a um tenant PRO (de
   terceiro), **When** o tenant ativo é o PRO, **Then** suas permissões seguem o **plano
   do tenant PRO** — ela é colaboradora plena ali, independentemente de seu tenant
   próprio ser free.
3. **Given** uma identidade com exatamente 1 vínculo, **When** a elegibilidade ao seletor
   é avaliada, **Then** ela **não** é elegível; com 2+ vínculos, **é** elegível.

---

### User Story 5 — Acesso de cliente restrito a uma empresa (Priority: P2)

Como dono de escritório PRO, quero conceder a um cliente acesso restrito aos dados apenas
da empresa dele, para não expor as demais empresas do escritório.

**Why this priority**: É a base do papel `cliente` (escopo por empresa-cliente dentro do
tenant). O **modelo** (papel `cliente` + escopo por empresa no vínculo + entidade
empresa-cliente) é fundação desta fatia; a **policy de enforcement do escopo por
empresa** é fatia futura (ver Out of Scope).

**Independent Test**: Modelar um vínculo de papel `cliente` escopado à empresa-cliente X
de um tenant e verificar que o vínculo carrega o escopo por empresa; que a empresa-cliente
é uma entidade **dentro** do tenant (dimensão, não fronteira); e que o mesmo CNPJ pode
existir como empresas distintas em tenants distintos.

**Acceptance Scenarios**:

1. **Given** um tenant com empresas-cliente X e Y, **When** um vínculo de papel `cliente`
   é criado para a empresa X, **Then** o vínculo registra o escopo restrito à empresa X.
2. **Given** o mesmo CNPJ atendido por dois escritórios diferentes, **When** cada
   escritório cadastra a empresa, **Then** resultam **duas** empresas-cliente distintas
   (CNPJ não é único global) — cada uma isolada em seu tenant.
3. **Given** uma empresa-cliente, **When** sua propriedade é verificada, **Then** ela
   pertence a exatamente um tenant e é alcançada apenas dentro daquele tenant.

---

### User Story 6 — Preservação previsível no ciclo de vida (Priority: P3)

Como dono de escritório, quero que, ao perder acesso ou plano, os dados sejam preservados
e o acesso tratado de forma previsível (sem vazamento, sem perda).

**Why this priority**: Define o comportamento de fronteira nos casos-limite de ciclo de
vida (downgrade, remoção de membro, deleção). As **regras** entram no registro agora; o
**enforcement** (suspensão no downgrade, cascatas de deleção) é fatia futura.

**Independent Test**: Verificar que as regras de ciclo de vida estão registradas como
requisitos verificáveis: downgrade preserva dados e suspende vínculos; remoção do tenant
ativo cai para "sem tenant ativo"; e remover o último proprietário é proibido.

**Acceptance Scenarios**:

1. **Given** um tenant PRO com equipe, **When** ocorre downgrade para free, **Then** a
   regra registrada é: vínculos da equipe **suspensos** (não apagados) e dados
   preservados.
2. **Given** um usuário cujo tenant ativo deixa de estar acessível (foi removido),
   **When** ele acessa a área autenticada, **Then** é tratado como "sem tenant ativo"
   (mesmo caminho de bloqueio da `004`), nunca recebendo dados de outro tenant.
3. **Given** um tenant com um único proprietário, **When** se tenta remover esse último
   proprietário, **Then** a operação é proibida (exige transferência de propriedade).

---

### Edge Cases

Derivados do catálogo do briefing (seção 11). Os marcados _(futuro)_ entram como **regra
registrada** nesta fatia; o **enforcement** vem em fatia futura.

**Identidade e convite** _(modelo registrado; fluxo de convite é futuro)_

- **Convidar e-mail que já tem conta** → anexar vínculo à identidade existente
  (idempotente); **nunca** duplicar identidade/login para o mesmo CPF/e-mail (Inv-3).
- **Convidar e-mail sem conta** → vínculo pendente; no aceite, cria identidade + vínculo.
- **Nome/CPF digitado pelo convidante divergente do real** → a **identidade real vence**;
  o dado digitado é apenas rótulo/sugestão até o aceite.
- **Aceite com e-mail diferente do convidado** → casar pelo **token do convite**, nunca
  por igualdade de e-mail.
- **Convidar a si mesmo / já-membro / convite duplicado** → rejeitar ou no-op
  (idempotência).

**Plano e billing**

- **Downgrade PRO→free com equipe** → vínculos **suspensos** (não apagados); dados
  preservados; re-upgrade restaura _(regra registrada; enforcement futuro)_.
- **Usuário free como colaborador pleno num tenant PRO** → acesso segue o **plano do
  tenant ativo** (Inv-1); ser free no próprio tenant não limita o acesso ao tenant PRO.

**Contexto / multi-tenant**

- **Tenant ativo default sem ambiguidade** → persistir o último tenant ativo; nunca um
  default ambíguo (risco de operar no tenant errado).
- **Seletor lista tenants free e PRO juntos** → a lista é dirigida pelos **vínculos do
  nosso sistema**, não pelo provedor de auth (Inv-2) _(seletor é futuro)_.
- **Mesma identidade com papéis diferentes em tenants diferentes** → papel e escopo
  resolvidos **por vínculo do tenant ativo**, nunca global no usuário.

**Escopo / RBAC** _(modelo registrado; policy de escopo por empresa é futura)_

- **`cliente` escopado à empresa X vê dados de outra empresa** → proibido: o acesso de
  `cliente` é restrito a `tenant ativo` **e** à sua empresa-cliente; sem isso, vaza.
- **`cliente` acessa áreas de admin/equipe** → proibido; `cliente` não gere equipe nem
  administra o tenant.
- **Mesmo CNPJ em dois escritórios** → duas empresas-cliente distintas (CNPJ não é único
  global); cada uma isolada em seu tenant.

**Ciclo de vida** _(regra registrada; enforcement futuro)_

- **Remover o último proprietário** → proibido; exigir transferência de propriedade.
- **Deleção de tenant/conta** → cascata previsível dentro do tenant; os demais vínculos
  da identidade (em outros tenants) são preservados.
- **Usuário removido do tenant que estava ativo na sessão** → tratado como "sem tenant
  ativo"; reusa o caminho de bloqueio/redirecionamento da `004`.

**Backstop (herdado da `004`)**

- **Valor de tenant ativo inválido/inexistente** → resultado vazio, jamais dados de outro
  tenant.
- **Transação sem tenant ativo fixado** → retorna vazio, nunca tudo.
- **Fixação do tenant escopada à transação** → fora da transação o valor não persiste e
  não vaza para a próxima operação no pool.

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. **SHALL _(futuro)_** = regra
> normativa registrada agora para o modelo, com implementação/enforcement em fatia
> futura. O modelo de dados que sustenta os requisitos futuros é fundação desta fatia.

### Functional Requirements

**A — Identidade e tenant (workspace no cadastro)**

- **FR-001**: Todo usuário recém-cadastrado MUST receber um **tenant (escritório/
  workspace) próprio**, com ele vinculado como **proprietário**.
- **FR-002**: O identificador do **tenant ativo** MUST vir sempre da sessão/identidade
  autenticada e do **vínculo** correspondente, NUNCA de input do cliente (query string,
  body ou header).
- **FR-003**: Uma **identidade** (CPF/e-mail) MUST poder pertencer a **N** tenants por
  meio de vínculos, com **papel por vínculo**; o vínculo é **aditivo** (nunca substitui
  um existente).
- **FR-004**: O modelo MUST garantir **1 identidade por CPF/e-mail** — sem identidade/
  login duplicado para o mesmo CPF/e-mail. _Nesta fatia a unicidade é assegurada
  estruturalmente pelo provedor de auth (dono da identidade) + PK de `users.id`; a
  reconciliação por CPF/e-mail no aceite de convite (Inv-3) é fatia futura._

**B — Isolamento por tenant (backstop no banco, herdado da `004`)**

- **FR-005**: Todo acesso a dados de negócio MUST ser escopado pelo **tenant ativo**; o
  tenant ativo é fixado por transação por um helper centralizado (padrão da `004`).
- **FR-006**: Numa tabela de negócio com o backstop habilitado e tenant ativo fixado, uma
  consulta **sem** filtro explícito de tenant MUST retornar somente registros do tenant
  ativo.
- **FR-007**: Sem tenant ativo fixado na transação, nenhuma linha de dados de negócio
  MUST ser retornada (vazio, nunca tudo).
- **FR-008**: Uma tentativa de gravar (inserir ou alterar) registro pertencente a um
  tenant diferente do ativo MUST ser rejeitada pelo banco.
- **FR-009**: Um valor de tenant ativo inválido ou inexistente MUST resultar em conjunto
  vazio — jamais em dados de outro tenant.
- **FR-010**: A entidade **empresa-cliente** MUST ser modelada como dado **dentro** do
  tenant (dimensão de negócio), isolada pelo mesmo backstop por tenant — **não** como
  fronteira de isolamento.

**C — Plano do tenant (campo/estado apenas nesta fatia)**

- **FR-011**: Todo tenant MUST ter um campo de **plano** com valores `free | pro`,
  default `free`, e exatamente um valor (nunca nulo).
- **FR-012**: O plano MUST ser propriedade do **tenant**, não do usuário; permissões e
  disponibilidade de feature MUST ser resolvidas pelo **plano do tenant ativo** (Inv-1).
- **FR-013 _(futuro)_**: "Equipe e Acessos" SHALL ser acessível somente quando o plano do
  tenant ativo for `pro`. **O enforcement do gate NÃO é implementado nesta fatia** —
  apenas o campo (FR-011) é entregue.
- **FR-014 _(futuro)_**: A organização correspondente no provedor de autenticação SHALL
  ser criada apenas no upgrade para `pro`. **Fora desta fatia.**

**D — Modelo de identidade/vínculo e empresa-cliente (fundação estrutural)**

- **FR-015**: O **vínculo** MUST registrar um **papel**. Os papéis conceituais
  `proprietário | colaborador | cliente` são persistidos com identificadores em inglês
  (padrão de código): `proprietário → owner`, `colaborador → collaborator`,
  `cliente → client`. Nesta fatia somente `owner` é escrito (provisionamento do tenant
  pessoal). _Nota: o caminho Clerk-org do PRO (futuro) persiste o papel nativo do Clerk
  (`org:admin`, `org:member`) — domínio separado, reconciliado na fatia de convite._
- **FR-016**: O vínculo de papel `cliente` MUST poder registrar um **escopo por
  empresa-cliente** (restrição a uma empresa específica do tenant); para os demais
  papéis, o escopo por empresa é ausente.
- **FR-017**: Papel e escopo MUST ser resolvidos **por vínculo do tenant ativo**, nunca
  como atributo global do usuário.
- **FR-018**: A **empresa-cliente** MUST pertencer a exatamente um tenant; o **mesmo
  CNPJ** MUST poder existir como empresas-cliente distintas em tenants distintos (CNPJ
  não é único global).

**E — "Org ativa" como conceito do nosso sistema (Inv-2)**

- **FR-019**: A noção de **tenant ativo** e a **lista de tenants** de um usuário MUST ser
  dirigidas pelos **vínculos do nosso sistema**, não pelo provedor de autenticação.
- **FR-020**: Um usuário com **2+ vínculos** MUST ser elegível ao seletor de troca de
  tenant; com **exatamente 1 vínculo**, NÃO. _(A renderização do seletor é fatia futura;
  esta fatia entrega a regra de elegibilidade.)_

**F — Ciclo de vida (regras registradas; enforcement futuro)**

- **FR-021 _(futuro)_**: No downgrade PRO→free com equipe, os vínculos da equipe SHALL
  ser **suspensos** (não apagados) e os dados SHALL ser preservados; re-upgrade restaura.
- **FR-022 _(futuro)_**: Remover o **último proprietário** de um tenant SHALL ser
  proibido; exigir transferência de propriedade.
- **FR-023 _(futuro)_**: A deleção de um tenant/conta SHALL ter cascata previsível dentro
  do tenant, preservando os demais vínculos da identidade em outros tenants.
- **FR-024**: Quando o usuário perde acesso ao tenant que estava ativo, o sistema MUST
  tratá-lo como "sem tenant ativo" (caminho de bloqueio da `004`), nunca expondo dados de
  outro tenant.

**G — Validação e auditoria (transversais)**

- **FR-025**: Toda Server Action / Route Handler que cria tenant, cria vínculo ou lê/grava
  dado de negócio MUST validar a entrada por schema antes da regra de negócio. _Nesta
  fatia o único ponto de entrada é o webhook `user.created`, cuja validação é reutilizada
  (assinatura via `verifyWebhook` + schema zod dos event-mappers) antes de
  `provisionPersonalTenant`; o teste de integração assegura esse contrato. Server Actions
  de CRUD de `companies` são fatia futura._
- **FR-026**: Os eventos de fronteira de tenant — criação de tenant/vínculo no cadastro,
  bloqueio por falta de tenant ativo e rejeição cross-tenant pelo banco — MUST gerar log
  de auditoria com correlação (`requestId`, `tenant`/`orgId`, `userId`, operação) e SEM
  PII, segredos ou payloads sensíveis (padrão da `004`).

### Key Entities

- **Identidade (usuário)**: pessoa física, 1 por CPF/e-mail, um login. Vive no provedor
  de autenticação. Nunca fica presa a um único tenant.
- **Tenant (Escritório / Workspace)**: a unidade de **isolamento** — a conta do
  profissional de SST. Raiz de todo o escopo de dados. Possui um **plano** (`free|pro`).
  Criado no cadastro de toda identidade.
- **Vínculo (Membership)**: relação N:N entre identidade e tenant, com **papel**
  (`proprietário | colaborador | cliente`) e, para `cliente`, **escopo por
  empresa-cliente**. Determina a quais tenants o usuário pertence e o que pode fazer no
  tenant ativo. É **aditivo**.
- **Empresa-cliente**: entidade de negócio **dentro** do tenant (dimensão de dados, não
  fronteira de isolamento). Pertence a exatamente um tenant; identificada por dados como
  CNPJ — que **não** é único global.
- **Plano do tenant**: atributo do tenant com valores `free | pro` (default `free`).
  Resolve permissões/feature pelo **tenant ativo** (Inv-1).
- **Tenant ativo da sessão/transação**: o tenant em foco, derivado da sessão e do
  vínculo (FR-002); fixado por transação para o backstop avaliar o isolamento. Ausente →
  conjunto vazio.

### Invariantes normativas (do briefing — não podem ser violadas)

- **Inv-1 — Plano é do tenant, não do usuário.** Não existe "usuário free/pro" global;
  existe "tenant free/pro". Permissões e features são resolvidas pelo plano do **tenant
  ativo**. Um usuário free pode ser colaborador pleno num tenant PRO. (FR-012, FR-017)
- **Inv-2 — "Tenant ativo" é conceito do nosso sistema, não do provedor de auth.** A
  lista de tenants e o tenant ativo são dirigidos pelos **vínculos do nosso sistema**
  (free e PRO na mesma lista). Qualquer usuário com 2+ vínculos é elegível ao seletor;
  com 1 vínculo, não. (FR-019, FR-020)
- **Inv-3 — Convite reconcilia identidade existente; nunca duplica conta.** Convidar =
  criar vínculo. O dono do tenant é apenas um vínculo de papel proprietário. O aceite
  casa pelo **token do convite**, não por igualdade de e-mail; o dado digitado pelo
  convidante é apenas rótulo. (FR-003, FR-004)

## Success Criteria _(mandatory)_

### Measurable Outcomes

**Tenant e isolamento (verificáveis nesta fatia)**

- **SC-001**: 100% dos usuários recém-cadastrados entram com um tenant próprio isolado,
  com papel proprietário.
- **SC-002**: 0% de registros de um tenant visíveis para usuário de outro tenant, em
  qualquer caminho de leitura.
- **SC-003**: Consulta sem filtro explícito retorna apenas dados do tenant ativo; sem
  tenant ativo, retorna **0 linhas** de negócio (nunca tudo).
- **SC-004**: Tentativa de gravar registro pertencente a outro tenant é rejeitada pelo
  banco em **100%** dos casos.
- **SC-005**: Um valor de tenant ativo inválido/inexistente retorna **0 linhas** — jamais
  dados de outro tenant.

**Plano (verificável nesta fatia)**

- **SC-006**: 100% dos tenants têm exatamente um valor de plano em `{ free, pro }`,
  default `free`; 0 tenants com plano nulo ou fora do conjunto.
- **SC-007**: A resolução de permissão/feature usa o plano do **tenant ativo** em 100%
  dos casos — 0 leituras de um "plano do usuário" global.

**Modelo de identidade/vínculo (verificável nesta fatia)**

- **SC-008**: Uma identidade pode acumular N vínculos sem perder nenhum existente; após
  ganhar um 2º vínculo, ambos coexistem em 100% dos casos (0 substituições).
- **SC-009**: Papel e escopo do usuário são resolvidos pelo vínculo do tenant ativo em
  100% dos casos; 0 resoluções a partir de atributo global do usuário.
- **SC-010**: A elegibilidade ao seletor é verdadeira para 100% dos usuários com 2+
  vínculos e falsa para 100% dos usuários com 1 vínculo.
- **SC-011**: O mesmo CNPJ cadastrado em dois tenants resulta em duas empresas-cliente
  distintas em 100% dos casos; 0 colisões globais por CNPJ.

**Escopo de cliente (modelado nesta fatia; enforcement futuro)**

- **SC-012 _(futuro)_**: Um usuário de papel `cliente` enxerga 0 dados de empresas
  diferentes da sua dentro do tenant. _(Critério-alvo da policy de escopo por empresa,
  validado quando o enforcement for implementado.)_

**Troca de tenant (modelada nesta fatia; seletor futuro)**

- **SC-013 _(futuro)_**: Um usuário com 2+ vínculos que alterna de tenant passa a ver
  100% dos dados do tenant selecionado e 0% do anterior. _(Critério-alvo do seletor,
  validado quando o enforcement for implementado.)_

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os
testes abaixo verdes, além de `npm run lint` e checagem de tipos. Casos críticos
multi-tenant são escritos/validados à mão.

- **Unitários (regra de negócio)**: criação do tenant próprio + vínculo proprietário no
  cadastro; resolução do tenant ativo a partir da sessão/vínculo (nunca de input do
  cliente); resolução de plano e papel pelo **tenant ativo** (Inv-1); regra de
  elegibilidade ao seletor (1 vínculo → não; 2+ → sim); default de plano `free`.
- **Integração de Server Actions / Route Handlers (SQLite em memória)**: fluxo de cadastro
  que cria tenant + vínculo; validação de schema na entrada; caminho de bloqueio quando
  não há tenant ativo.
- **Caminho crítico de isolamento (Postgres efêmero — RLS, nunca SQLite; escrito à mão)**:
  tenant A ativo só vê A; tenant B ativo só vê B; sem tenant ativo, vazio; rejeição de
  escrita cross-tenant (`WITH CHECK`); escopo do tenant por transação (valor não vaza fora
  da transação).
- **Auditoria de fronteira de tenant**: criação de tenant/vínculo no cadastro, bloqueio
  sem tenant ativo e rejeição cross-tenant emitem log com a correlação esperada e sem
  PII/segredos.

> Justificativa do Postgres efêmero: o SQLite não tem RLS nem policies; o backstop só
> pode ser provado contra Postgres real (branch efêmera), conforme `004` e a constituição.

## Assumptions

- **Motor de isolamento da `004` reutilizado sem mudança**: helper de tenant por
  transação, backstop de Row Level Security, tabela de demonstração permanente e auditoria
  de fronteira de tenant permanecem válidos; muda apenas o **significado** do
  identificador de tenant (escritório, não empresa) e nasce a entidade empresa-cliente.
- **Provedor de autenticação como dono da identidade**: a identidade (1 por CPF/e-mail) e
  a sessão vivem no provedor de auth; o tenant, o vínculo, o plano e a empresa-cliente
  vivem no nosso banco. A forma técnica (qual provedor, criação de organização no upgrade,
  forma exata da policy) é decisão do `/speckit-plan` — esta spec define o "o quê" e o
  "porquê".
- **Vínculo de `org_memberships` já iniciado na `002`** é a base do vínculo aqui
  formalizado (papel + escopo por empresa); esta fatia estende, não recria.
- **D1 — toda identidade tem tenant próprio** (inclusive quem entraria só por convite):
  adotado o default recomendado do briefing (sempre cria tenant pessoal free; custo zero
  por não virar organização no provedor de auth). O fluxo de convite é fatia futura.
- **D2 — downgrade preserva** (suspende vínculos, mantém dados): adotado como regra
  registrada; enforcement futuro.
- **D3 — `cliente` é um vínculo** com escopo por empresa, não entidade paralela: adotado.
- **Questões em aberto do briefing (Q1–Q3: add-on/limites do provedor de auth, alavancas
  de monetização do solo)** não afetam o escopo desta fatia (apenas o campo de plano) e
  ficam para a fatia de billing/enforcement.

## Out of Scope

Especificado para registro; implementado em fatias futuras.

- **Enforcement do Gate PRO** — bloquear "Equipe e Acessos" quando o tenant é free
  (FR-013).
- **Fluxo de convite** (envio/aceite) e UI de "Equipe e Acessos" — incluindo a
  reconciliação de identidade por token (Inv-3 fica registrada, não implementada).
- **Criação automática da organização no provedor de auth no upgrade** (FR-014).
- **Policy de enforcement de escopo por empresa** para o papel `cliente` e RBAC fino
  intra-tenant (SC-012).
- **Seletor de troca de tenant** e onboarding multi-tenant — apenas a regra de
  elegibilidade (FR-020) entra agora; a renderização e a troca efetiva (SC-013) são
  futuras.
- **Enforcement de ciclo de vida** — suspensão no downgrade (FR-021), proibição de remover
  último proprietário (FR-022) e cascata de deleção (FR-023): regras registradas,
  enforcement futuro.
- **Integração de billing/assinatura** real.
