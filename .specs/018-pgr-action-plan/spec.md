# Feature Specification: Medidas de controle e plano de ação do risco (5W2H)

**Feature Branch**: `feature/pgr-action-plan`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "[Fase 03] 06 · Medidas de controle e plano de ação do risco (#26) — plano de ação 5W2H por risco, sobre a tabela real `control_measures` (migration 0012), zero migration, um registro por nível NR-01."

## Contexto e invariantes desta fatia

Fatia do módulo PGR que dá vida às **medidas de controle** já modeladas: para cada risco do
inventário, permite detalhar o **plano de ação 5W2H** (o quê, como, formas de acompanhamento,
aferição de resultados, responsável, prazo) por **nível da hierarquia NR-01**.

Invariantes obrigatórios (aprovados no Gate 0):

- **Tabela real: `control_measures`** (migration `0012_pgr_risk_data_model`, já aplicada). Nunca
  `medidas_controle`. As colunas reais são: `id`, `org_id`, `risk_id`, `control_level`,
  `applicable`, `justification`, `monitoring`, `action_what`, `action_how`, `action_tracking`,
  `action_measurement`, `action_responsible`, `action_deadline`, `created_at`, `updated_at`.
- **ZERO MIGRATION**: não criar migration, não alterar schema, não tocar
  `src/shared/db/schema/**` nem `migrations/**`.
- **Enum real `control_level`** com 4 valores NR-01: `elimination`, `collective_protection`,
  `administrative`, `ppe`. **Não existe** enum/coluna de status.
- **UNIQUE real `(org_id, risk_id, control_level)`** → repetir o mesmo nível para o mesmo risco é
  **DUPLICATE / 409** (real, não inventado).
- **`action_responsible` é texto** (não há FK para funcionário). Combobox de funcionários da org é
  opcional e **grava o nome como texto**; também aceita texto livre. Nunca criar FK.
- **Sem status persistido**: estados (`Sem plano`, `Planejada`, `Vencida`) são **derivados** na
  leitura, nunca gravados.
- **Nível de risco (contexto)** vem **derivado** da avaliação vigente do risco
  (`getCurrentRiskAssessment`); **não** é snapshotado em `control_measures`.
- **Multi-tenant**: tenant sempre da sessão/contexto; nunca aceitar `orgId`/`organizationId`/
  `organization_id` do cliente. Isolamento por `withOrg` + RLS `app_runtime`.
- **Dívida conhecida**: `CLAUDE.md` falha no `format:check` e será corrigido **no final desta
  feature**, junto aos gates — não durante specify/plan/tasks.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Registrar plano de ação 5W2H por nível NR-01 (Priority: P1)

Como gestor de SST, quero registrar, para um risco, uma medida de controle por nível da hierarquia
NR-01 (Eliminação, Proteção coletiva, Medidas administrativas, EPI), preenchendo o plano de ação
5W2H — o quê, como, formas de acompanhamento, aferição de resultados, responsável e prazo — para
que cada risco tenha um plano acompanhável.

**Why this priority**: É o núcleo da feature e o valor central da issue #26 — sem o registro do
plano de ação por nível, não há nada para acompanhar. Entrega um MVP utilizável sozinho.

**Independent Test**: Criar uma medida `elimination` para um risco com `applicable=true`,
`action_what`/`action_how` preenchidos, responsável e prazo; confirmar que persiste e aparece no
histórico do risco. Tentar criar uma segunda medida do mesmo nível para o mesmo risco e confirmar
que é recusada (duplicidade de nível).

**Acceptance Scenarios**:

1. **Given** um risco existente na organização ativa sem medidas, **When** o gestor cria uma medida
   nível `elimination` com `applicable=true`, `action_what` e `action_how` preenchidos, **Then** a
   medida é persistida vinculada ao risco e à organização ativa, com `control_level=elimination`.
2. **Given** um risco que já possui uma medida `elimination`, **When** o gestor tenta criar outra
   medida `elimination` para o mesmo risco, **Then** a operação é recusada como **duplicidade**
   (nível já existe para o risco).
3. **Given** o formulário de nova medida com `applicable=true`, **When** o gestor deixa `action_what`
   ou `action_how` em branco, **Then** a criação é recusada por validação (campos mínimos do plano).
4. **Given** o formulário de nova medida com `applicable=false`, **When** o gestor salva sem
   preencher os campos 5W2H, **Then** a medida é criada (todos os campos 5W2H são opcionais quando
   não aplicável).

---

### User Story 2 - Consultar medidas do risco com contexto e estado derivado (Priority: P2)

Como gestor de SST, quero ver a lista das medidas de controle de um risco, com o contexto do risco
(fonte/agente, perigo, descrição) e a avaliação vigente (nível de risco e classificação), e com
indicação visual do estado de cada medida — incluindo destaque de **medidas vencidas** — para
priorizar o acompanhamento.

**Why this priority**: Torna o plano de ação acompanhável e destaca pendências vencidas; depende do
registro (US1) existir, mas entrega valor de gestão independentemente de editar/excluir.

**Independent Test**: Abrir o histórico de medidas de um risco que tem medidas aplicáveis com
prazo no passado e no futuro; confirmar que a vencida é destacada, que o contexto do risco aparece
read-only, e que a avaliação vigente (nível/classificação) é exibida — ou "Sem avaliação vigente"
quando não houver.

**Acceptance Scenarios**:

1. **Given** um risco com medidas cadastradas, **When** o gestor abre a lista de medidas, **Then**
   vê cada medida com seu nível NR-01, responsável, prazo e um **estado derivado**
   (`Sem plano` / `Planejada` / `Vencida`).
2. **Given** uma medida `applicable=true` com `action_deadline` anterior a hoje, **When** a lista é
   exibida, **Then** a medida é sinalizada visualmente como **Vencida**.
3. **Given** um risco com avaliação vigente, **When** a tela de medidas é aberta, **Then** exibe o
   `riskLevel` e a classificação (`result`) da avaliação vigente como contexto read-only.
4. **Given** um risco **sem** avaliação vigente, **When** a tela é aberta, **Then** exibe
   "Sem avaliação vigente" e **não** bloqueia criar/editar medidas.
5. **Given** dois riscos de organizações diferentes, **When** o gestor de uma organização lista
   medidas, **Then** vê apenas medidas da sua organização (isolamento multi-tenant).

---

### User Story 3 - Editar uma medida de controle (Priority: P3)

Como gestor de SST, quero editar uma medida existente (corpo completo), ajustando aplicabilidade,
campos 5W2H, responsável e prazo, para manter o plano de ação atualizado.

**Why this priority**: Complementa o ciclo de vida; útil, mas o valor principal já é entregue por
registrar (US1) e consultar (US2).

**Independent Test**: Abrir uma medida existente, alterar responsável e prazo, salvar e confirmar
persistência; alterar `applicable` para `true` sem `action_what` e confirmar recusa por validação.

**Acceptance Scenarios**:

1. **Given** uma medida existente da organização ativa, **When** o gestor edita e envia o corpo
   completo com dados válidos, **Then** a medida é atualizada.
2. **Given** a edição de uma medida com `applicable=true`, **When** `action_what`/`action_how`
   ficam vazios, **Then** a atualização é recusada por validação.
3. **Given** uma medida de outra organização, **When** o gestor tenta editá-la, **Then** a operação
   resulta em "não encontrada" (isolamento — nunca vaza cross-tenant).
4. **Given** a edição de uma medida, **When** o gestor envia, **Then** o **nível** (`control_level`)
   não é alterado pela edição (o nível define a identidade da medida no risco).

---

### User Story 4 - Excluir uma medida de controle (Priority: P3)

Como gestor de SST, quero excluir uma medida de controle, com confirmação, para remover planos que
não se aplicam mais.

**Why this priority**: Fecha o CRUD; menor frequência de uso e menor risco de negócio.

**Independent Test**: Excluir uma medida existente após confirmação e verificar que some da lista;
tentar excluir uma medida de outra organização e confirmar "não encontrada".

**Acceptance Scenarios**:

1. **Given** uma medida existente da organização ativa, **When** o gestor confirma a exclusão,
   **Then** a medida é removida fisicamente e some da lista, liberando aquele nível NR-01 para novo
   cadastro no mesmo risco.
2. **Given** uma medida de outra organização, **When** o gestor tenta excluí-la, **Then** a
   operação resulta em "não encontrada".

---

### Edge Cases

- **Risco sem nenhuma medida**: a lista aparece vazia e permite criar a primeira medida (por nível).
- **Medida sem responsável e/ou sem prazo**: permitido (`action_responsible`/`action_deadline`
  opcionais); sem prazo, a medida nunca é "vencida".
- **Medida vencida**: `applicable=true` **e** `action_deadline` preenchido **e** prazo anterior a
  hoje → sinalizada como `Vencida` (derivado, não persistido).
- **Duplicidade de nível**: tentar um segundo `control_level` igual para o mesmo risco → recusado
  como duplicidade.
- **Risco sem avaliação vigente**: exibir "Sem avaliação vigente"; não bloquear o preenchimento.
- **`riskId` inexistente/de outra organização**: tratado como referência não encontrada (não vaza).
- **Medida `applicable=false` com campos 5W2H preenchidos**: permitido (os campos ficam guardados,
  a medida é considerada `Sem plano` no estado derivado por não estar aplicável).
- **Fuso do "hoje"**: a regra de vencimento usa a data local do negócio (America/Sao_Paulo),
  coerente com o restante do PGR.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir listar as medidas de controle de um risco da organização
  ativa, ordenadas de forma estável pela hierarquia NR-01 (`elimination`, `collective_protection`,
  `administrative`, `ppe`).
- **FR-002**: O sistema MUST permitir criar uma medida de controle para um risco, informando o
  `control_level` (um dos 4 valores NR-01), `applicable` e os campos do plano 5W2H
  (`action_what`, `action_how`, `action_tracking`, `action_measurement`, `action_responsible`,
  `action_deadline`) além de `justification` e `monitoring`.
- **FR-003**: O sistema MUST recusar a criação de uma medida cujo `control_level` já exista para o
  mesmo risco na organização, tratando como **duplicidade** (nunca upsert; a unicidade real é
  `(org_id, risk_id, control_level)`).
- **FR-004**: Quando `applicable = true`, o sistema MUST exigir `action_what` e `action_how`
  preenchidos; os demais campos (`action_tracking`, `action_measurement`, `action_responsible`,
  `action_deadline`, `justification`, `monitoring`) permanecem opcionais. Quando
  `applicable = false`, todos os campos do plano são opcionais. Esta regra é de validação de
  domínio e **não** exige migration.
- **FR-005**: O sistema MUST permitir editar uma medida existente **com corpo completo** (sem
  atualização parcial/PATCH), aplicando as mesmas regras de validação da criação.
- **FR-006**: A edição de uma medida MUST NOT alterar o `control_level` (o nível identifica a
  medida dentro do risco); a mudança de nível se faz criando/excluindo medidas.
- **FR-007**: O sistema MUST permitir excluir fisicamente uma medida, mediante confirmação na UI,
  sem endpoint de dependentes (a tabela não possui FKs de entrada).
- **FR-008**: O sistema MUST derivar e exibir o **estado** de cada medida sem persistir status:
  `Sem plano` (quando `applicable = false` ou sem ação aplicável), `Planejada`
  (`applicable = true` e não vencida) e `Vencida` (`applicable = true`, `action_deadline`
  preenchido e anterior a hoje).
- **FR-009**: O sistema MUST sinalizar visualmente as medidas **vencidas** na listagem.
- **FR-010**: O sistema MUST exibir, como contexto read-only, dados reais do risco: agente/tipo,
  perigo, descrição, fontes, possíveis lesões e — quando existirem — código de agente nocivo e
  tempo de exposição.
- **FR-011**: O sistema MUST exibir, como contexto read-only, a **avaliação vigente** do risco
  (nível de risco `riskLevel` e classificação `result`), obtida da última avaliação registrada;
  MUST NOT gravar esse valor como snapshot na medida.
- **FR-012**: Quando o risco **não** tiver avaliação vigente, o sistema MUST exibir "Sem avaliação
  vigente" e MUST NOT bloquear a criação/edição de medidas.
- **FR-013**: O sistema MUST oferecer, no campo responsável, seleção assistida por funcionários da
  organização ativa (quando a listagem existir), **gravando o nome como texto** em
  `action_responsible`, e MUST também aceitar texto livre. MUST NOT criar FK nem migration.
- **FR-014**: Todo acesso a dados MUST ser escopado pela organização ativa vinda da sessão/contexto;
  o sistema MUST NOT aceitar `orgId`/`organizationId`/`organization_id` do cliente.
- **FR-015**: O sistema MUST expor as operações também como superfície REST versionada, além das
  Server Actions da UI, reutilizando a mesma validação e regras (sem reimplementar a regra).
- **FR-016**: O sistema MUST mapear os erros assim: `riskId` inválido/inexistente/cross-tenant →
  referência não encontrada (**FK_NOT_FOUND / 422**); medida inexistente/cross-tenant →
  **NOT_FOUND / 404**; duplicidade de `control_level` no risco → **DUPLICATE / 409**; entrada
  inválida → **VALIDATION / 422**; papel `client` → **FORBIDDEN / 403**. Nunca aceitar
  `orgId`/`organizationId`/`organization_id` do cliente.
- **FR-017**: O sistema MUST fornecer, a partir do detalhe do risco, um atalho/botão para a tela de
  medidas de controle do risco (única alteração permitida no CRUD de `risks` nesta fatia).
- **FR-018**: A documentação de API (`docs/api/api-design.md`) e a coleção Postman
  (`docs/api/sst-manager.postman_collection.json`) MUST ser atualizadas com o recurso, verbos,
  filtros e exemplos (incluindo 403/404/409/422).

### Key Entities _(include if feature involves data)_

- **Medida de controle (`control_measures`)**: plano de ação de um nível NR-01 para um risco.
  Atributos: nível de controle (`control_level`), aplicabilidade (`applicable`), justificativa,
  monitoramento e os campos 5W2H (o quê, como, formas de acompanhamento, aferição de resultados,
  responsável em texto, prazo). Pertence a uma organização e a um risco. **Único** por
  `(organização, risco, nível)`. Estado (`Sem plano`/`Planejada`/`Vencida`) é derivado, não
  armazenado.
- **Risco (`risks`)**: fonte do contexto exibido (agente/tipo, perigo, descrição, fontes, possíveis
  lesões, código de agente nocivo, tempo de exposição). Relação 1:N com medidas.
- **Avaliação vigente (`risk_assessments`)**: última avaliação do risco; fornece `riskLevel` e
  `result` como contexto read-only. Somente leitura nesta fatia.
- **Funcionário (`employees`)**: origem opcional das sugestões de responsável; apenas o nome é
  copiado como texto para a medida (sem vínculo persistido).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Para qualquer risco, um gestor consegue registrar o plano de ação completo de um nível
  NR-01 (5W2H) em uma única tela, em menos de 3 minutos.
- **SC-002**: Cada risco suporta no máximo 4 medidas, uma por nível NR-01; tentativas de duplicar um
  nível no mesmo risco são bloqueadas em 100% dos casos.
- **SC-003**: Medidas aplicáveis com prazo no passado são identificadas visualmente como vencidas em
  100% das exibições da lista, sem que exista qualquer campo de status persistido.
- **SC-004**: Nenhuma medida de uma organização é visível, editável ou excluível por outra
  organização (0% de vazamento cross-tenant), validado por testes de isolamento e RLS.
- **SC-005**: O contexto do risco e a avaliação vigente (nível/classificação) são exibidos na tela
  de medidas; quando não há avaliação, a tela permanece funcional e exibe "Sem avaliação vigente".
- **SC-006**: A superfície REST responde com os códigos corretos em 100% dos casos previstos:
  200 (list/get/update), 201 (create), 204 (delete), 409 (nível duplicado), 404 (alvo inexistente/
  cross-tenant), 422 (validação/FK), 403 (papel `client`).

## Assumptions

- A tabela `control_measures` e o enum `control_level` já existem (migration `0012`); esta fatia é
  **zero migration** e não altera schema.
- A cadeia de avaliação de risco (`risk_assessments`, `getCurrentRiskAssessment`/
  `getCurrentRiskAssessmentAction`) já está mergeada em `develop` e disponível para leitura.
- Existe listagem de funcionários da organização reutilizável para alimentar o combobox de
  responsável; caso indisponível, o campo degrada para texto livre sem bloquear a feature.
- Os 4 níveis NR-01 **não** são semeados automaticamente no cadastro do risco; as medidas são
  criadas sob demanda por nível (a geração automática obrigatória está fora do escopo).
- "Hoje" para efeito de vencimento é a data local do negócio (America/Sao_Paulo).
- Somente papéis de escritório (`owner`/`collaborator`) operam a feature; `client` é bloqueado.
- Testes de integração rodam contra **Postgres efêmero** via `INTEGRATION_*`; nunca SQLite e nunca
  seed destrutivo em Supabase compartilhado.
- A correção de formatação de `CLAUDE.md` é **dívida conhecida** a ser resolvida nos gates finais
  desta feature, não durante specify/plan/tasks; arquivos da feature devem ficar Prettier-clean e
  `format:check` é gate final obrigatório.

## Out of Scope

- Migration, alteração de schema, ou qualquer mudança em `src/shared/db/schema/**` /
  `migrations/**`.
- Coluna/enum de status persistido; FK de responsável; snapshot de avaliação em `control_measures`.
- CRUD/alteração de metodologia (`risk_methodology`); alteração do CRUD de `risks` além do
  botão/atalho para medidas.
- Geração automática obrigatória dos 4 níveis no cadastro do risco.
- IA, recomendação automática de medidas, plano com múltiplas ações por nível (lista aberta).
