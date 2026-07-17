# Feature Specification: Fase 06 — Ordens de Serviço, Incidentes/Acidentes, Planos de Ação 5W2H e Auditorias

**Feature Branch**: `feature/phase-06-safety-workflows`

**Created**: 2026-07-16

**Status**: Draft

**Input**: Consolidação das issues `#41`, `#42`, `#44`, `#45`, `#87`, `#91`, `#93` em **uma única feature** (decisão do Tech Lead no Gate 0). Diretório: `.specs/023-phase-06-safety-workflows/`.

---

## Contexto e invariantes desta fatia

Esta fatia entrega o **fluxo operacional de segurança do trabalho** posterior ao PGR: emissão de **Ordens de Serviço (OS)** com assinatura do trabalhador, registro e ciclo de vida de **Incidentes/Acidentes**, **Planos de Ação 5W2H** multiorigem e um quadro **Kanban de Auditorias/Análises** de riscos e incidentes com sugestão assistida por IA. É a Fase 06 do roadmap, consolidada em uma spec só por decisão arquitetural — as sete issues viram sete user stories, não sete branches.

### Base factual (re-apurada no Gate 0 sobre a `develop` atual — não presumir nada além disto)

- `develop` está limpa e sincronizada, já com as **Fases 08 (Inspeções + Permissões de Trabalho), 09 (Psicossociais), 10 (eSocial) e Agenda** mergeadas. As cinco entidades desta fatia (`service_orders`, `service_order_items`, `accidents`, `action_plans`, `risk_audits`) **não existem** em lugar nenhum do schema — são greenfield, sem risco de duplicação.
- **Numeração real da próxima migration = `0024_phase_06_safety_workflows`** (o journal vai até idx 23 / `0023_schedule_events`).
- **Histórico de migrations corrompido por merge (pré-requisito P0 da US1, ver FR-002):** há dois arquivos órfãos fora do `_journal.json` (`0018_org_billing.sql` e `0018_user_is_master.sql`), a tag `0018_schedule_events` (idx 18) não tem `.sql` (o SQL foi recriado em `0023_schedule_events.sql`, duplicando `schedule_events` no journal). Os snapshots 0..23 estão íntegros e o `0023_snapshot.json` já reflete `is_master` + colunas Stripe.
- A infra de **assinatura digital genérica** (Features 010/022, mergeada) fornece: `signature_requests` / `signature_captures`; `createSignatureRequestCore`; registries `SIGNATURE_TARGET_TYPES`, `signatureTargetRegistry` (server), `signatureFormRegistry` (client) — hoje com os alvos `demo | inspection | pgr`; `SignatureFormRenderer`; rota pública `/signature-requests/[token]`; token **apenas hasheado** (sha-256), TTL, uso único, replay protection, QR code e **cota mensal compartilhada** entre todos os `target_type` (`FREE_SIGNATURE_MONTHLY_QUOTA=10`). A coluna `signature_requests.target_type` é **texto** → adicionar `service_order` é **zero migration** de assinatura.
- A infra de **IA Anthropic** (Features 016/017) fornece: cliente server-only (`ANTHROPIC_API_KEY`, modelo default `claude-opus-4-8`), saída estruturada por tool use validada por Zod, tabela append-only `ai_usage_events` com coluna **`kind` texto** (não enum) e cota derivada por mês corrente (`free=20/mês`, `pro` ilimitado), erro `AI_UNAVAILABLE` (502) com degradação graciosa. Adicionar o `kind` `action_plan_suggestion` é **zero migration**. A constituição (emenda 1.3.0) já autoriza o provedor LLM Anthropic — **nenhuma emenda nova é necessária**.
- Entidades reutilizáveis: `employees` (com `ges_id`/`job_role_id`), `companies`, `ges`, `job_roles`, `risks`, `risk_assessments`, `control_measures` (5W2H acoplado a risco — **não alterar**), `epi_risk`, `epi_catalog`. Vizinhos novos relevantes: `inspections`/`inspection_occurrences`, `work_permits`, `esocial_events` (enum já inclui `S-2210`/CAT).
- Padrões atuais obrigatórios: coluna de tenant `org_id` (**nunca** `organization_id`); código sob `src/shared/**` e `src/app/**`; `ActionResult<T>` + `officeAction`; `restHandler`; `withOrg`; `requireOfficeStaff`; `toActionError`; `auditedTenantWrite`; Postgres efêmero com RLS nos testes de integração. **Não** copiar os padrões obsoletos das issues (`organization_id`, `features/**`, `lib/db/**`, `AppError`/`Result`, SQLite em memória, `/assinaturaos/[param]`, `signature_token` na OS).

### Invariantes não-negociáveis

1. **Isolamento por tenant.** As cinco tabelas novas têm `org_id text NOT NULL → orgs.id`, RLS habilitado, policy `app_runtime` com `USING` **e** `WITH CHECK` sobre `current_setting('app.current_org', true)`, e GRANTs. O tenant ativo vem **sempre** da sessão (`requireOfficeStaff` → `withOrg`), nunca de input do cliente. `service_order_items` também carrega `org_id` próprio (não confia só na FK do pai).
2. **Dado de saúde é P0.** Incidentes/acidentes contêm dado sensível de saúde. Só **office staff** (`owner`/`collaborator`) acessa; papel `client` → `FORBIDDEN` (403). Dado de saúde **nunca** aparece em logs, metadata de auditoria, payload público de assinatura, prompt de IA, fixtures versionadas nem em nomes reais no Postman.
3. **Assinatura reusa a infra genérica.** A OS adiciona apenas o `target_type` `service_order` aos registries — **sem** nova tabela, **sem** `signature_token` na OS, **sem** rota pública nova, **sem** cota nova. Estado e data da assinatura da OS são **derivados** de `signature_requests`/`signature_captures`, sem duplicação de coluna na OS.
4. **Numeração da OS calculada no servidor sob concorrência.** Dentro de `withOrg` + transação: `SELECT ... FOR UPDATE` na linha do tenant em `orgs` → `MAX(number)+1` no escopo do tenant → insert → `UNIQUE(org_id, number)` como backstop. Duas criações simultâneas no mesmo tenant geram números **distintos e consecutivos**; tenants distintos **não** compartilham lock global.
5. **Itens de OS são snapshots regulatórios imutáveis após emissão.** Os itens são texto congelado no momento da emissão; alterações futuras em `risks`/`epi_risk`/`epi_catalog` **não** reescrevem uma OS já emitida. OS e itens gravam na **mesma transação** (persistem ou fazem rollback juntos).
6. **IA é opcional e degradável.** Todo CRUD funciona integralmente com a IA desabilitada. IA indisponível → `AI_UNAVAILABLE`, o fluxo continua manualmente. IA **nunca** recebe PII (nome do trabalhador, CPF, dados médicos, testemunhas, fotos).
7. **Origem de plano/auditoria é TEXT validada na aplicação; V1 = `risk|incident`.** `origin_type` é coluna **texto** (padrão de `target_type`), validada na aplicação (tipo suportado + origem existente + mesmo tenant), **sem** FK física única. V1 aceita **apenas** `risk` e `incident`; `inspection`/`non_conformity` ficam **fora da V1**, mas plugam depois com **zero migration**. Origem inválida/cross-tenant → `FK_NOT_FOUND` (422).
8. **CAT é registro interno na V1.** Os acidentes guardam `cat_number`/`cat_issued_at` como texto/opcional; **não** há emissão de S-2210 nesta fatia, embora o encanamento `esocial_events` já exista. A integração eSocial fica **fora da V1** (ponto de integração documentado).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fundação: schema, migration, RLS, reconciliação do journal e permissões (Priority: P1)

Como plataforma multi-tenant, preciso das cinco tabelas novas, seus enums, índices, constraints, RLS com `WITH CHECK` e GRANTs criados em **uma única migration** `0024_phase_06_safety_workflows`, precedida da **reconciliação do histórico corrompido de migrations**, para que todas as histórias seguintes assentem sobre isolamento real de tenant e um `db:migrate` limpo (Postgres efêmero) funcione.

**Why this priority**: É a fundação de dados; nada de US2–US7 existe sem ela. Sem a reconciliação, o `db:migrate` num banco limpo (exigido pelos testes de integração) pode quebrar; sem RLS correta, dado de saúde e OS vazam entre tenants (violação P0/P1).

**Independent Test**: Aplicar a migration em Postgres efêmero e verificar, por tenant A/B, que cada tabela tem `org_id`, RLS ligada, policy com `USING`+`WITH CHECK`, os enums/UNIQUEs/índices esperados, e que sem `withOrg` nenhuma linha é retornada nem inserida; e que a suíte de migrations aplica do zero sem erro.

**Acceptance Scenarios**:

1. **Given** o histórico corrompido (2 órfãos `0018_*`, tag `0018_schedule_events` sem `.sql`, `schedule_events` duplicado no journal), **When** a fase de fundação executa o pré-requisito P0, **Then** a sequência realmente aplicada é conferida na tabela `drizzle.__drizzle_migrations` do banco e arquivos+journal são alinhados a essa realidade **sem** apagar/renomear às cegas, e a nova migration é numerada `0024` (idx 24).
2. **Given** a migration `0024` aplicada, **When** um SELECT/INSERT roda sem `withOrg`, **Then** a RLS retorna zero linhas / bloqueia a escrita (backstop), e com `withOrg(orgA)` só linhas de A aparecem.
3. **Given** as cinco tabelas, **When** inspeciono o schema, **Then** cada uma tem `org_id text NOT NULL → orgs.id`, trigger `set_updated_at`, GRANTs para `app_runtime` e os enums fechados definidos.

---

### User Story 2 - CRUD completo de Ordem de Serviço e itens (Priority: P1)

Como técnico de segurança, quero criar, listar, ver, editar e excluir Ordens de Serviço com um checklist de itens (manuais e sugeridos a partir dos riscos/EPIs do GES do funcionário), com número gerado no servidor, para documentar a entrega de EPIs/instruções ao trabalhador.

**Why this priority**: É o núcleo operacional da fase e pré-requisito da assinatura (US3). Entrega valor sozinha (registro interno de OS).

**Independent Test**: Criar duas OS concorrentes no mesmo tenant e confirmar números consecutivos; criar OS com itens e confirmar persistência transacional; listar com paginação/filtros; editar; excluir apenas quando permitido.

**Acceptance Scenarios**:

1. **Given** um funcionário do tenant com `ges_id`, **When** crio uma OS, **Then** o número é `MAX+1` do tenant, OS e itens gravam na mesma transação, e itens podem ser manuais ou pré-populados por `employee.ges_id → risks → epi_risk → epi_catalog` (snapshots textuais).
2. **Given** duas requisições de criação simultâneas no mesmo tenant, **When** ambas confirmam, **Then** recebem números **distintos e consecutivos** (lock de linha), e um tenant diferente cria em paralelo sem ser bloqueado.
3. **Given** uma OS assinada, concluída ou cancelada, **When** tento excluí-la, **Then** a exclusão é negada; só OS **não assinada** e ainda `open`/`in_progress` pode ser excluída.
4. **Given** uma OS de outro tenant, **When** faço getById/update/delete, **Then** retorna `NOT_FOUND` (404); **Given** um `assigned_employee_id` de outro tenant, **Then** retorna `FK_NOT_FOUND` (422).
5. **Given** uma OS já assinada, **When** tento alterar seus itens, **Then** os itens são imutáveis; estados terminais (`completed`/`cancelled`) não retrocedem.

---

### User Story 3 - Workflow e assinatura pública da Ordem de Serviço (Priority: P2)

Como técnico de segurança, quero gerar um link/QR de assinatura para uma OS e que o trabalhador assine sem login, reusando a infra genérica, para ter a via assinada da OS.

**Why this priority**: Depende de US2. Agrega o valor de conformidade (assinatura do trabalhador), mas a OS já tem valor como registro interno antes disso.

**Independent Test**: Criar uma solicitação de assinatura para uma OS (`target_type` `service_order`), abrir `/signature-requests/[token]` sem sessão, assinar, e confirmar que o estado da OS reflete a captura derivada; testar token inválido/expirado/usado/replay.

**Acceptance Scenarios**:

1. **Given** uma OS emitida, **When** solicito assinatura, **Then** é criada uma `signature_request` com `target_type = 'service_order'`, o link é exibido **somente na criação**, com QR, consumindo a **cota compartilhada** (sem cota nova).
2. **Given** o link público, **When** o trabalhador abre sem Clerk, **Then** vê apenas o payload **congelado e mínimo** (`documentTitle`, `serviceOrderNumber`, `companyName`, `employeeName`, `issuedAt`, `items`) — **sem** CPF, dados de saúde, incidentes, riscos completos, IDs internos, `org_id` ou token — assina, e a resposta é `no-store`.
3. **Given** um token, **When** ele é inválido, expirado, já usado ou reapresentado (replay), **Then** a página pública recusa a assinatura com o estado derivado correto, sem vazar existência de outros tenants.
4. **Given** uma OS assinada, **When** consulto seu estado, **Then** estado e data da assinatura são **derivados** de `signature_requests`/`signature_captures`, sem coluna duplicada na OS, e os itens ficam imutáveis.

---

### User Story 4 - CRUD completo de Incidente/Acidente (Priority: P1)

Como técnico de segurança, quero registrar, listar, ver, editar e excluir incidentes/acidentes com dados de ocorrência, causas/investigação e uma aba de fotos (placeholder), restrito a office staff, para manter o registro interno de acidentes de trabalho.

**Why this priority**: Entidade central da fase, insumo de US5 (ciclo de vida) e origem de planos/auditorias (US6/US7). Contém dado de saúde (P0).

**Independent Test**: CRUD completo por office staff; papel `client` bloqueado; incidente de outro tenant nunca aparece; campos código/descrição opcionais aceitos vazios; aba Fotos exibe apenas o placeholder.

**Acceptance Scenarios**:

1. **Given** um office staff, **When** registro um incidente, **Then** os enums fechados (`accident_type`, `accident_category`, `accident_severity`, `accident_status`) são validados e todos os campos código/descrição CAT (natureza da lesão, parte do corpo, agente causador) e `cat_number`/`cat_issued_at` são **opcionais e textuais** (registro **interno**, sem lookup oficial e **sem** emissão S-2210).
2. **Given** um papel `client`, **When** tento acessar qualquer superfície de incidentes, **Then** recebo `FORBIDDEN` (403).
3. **Given** um incidente de outro tenant, **When** faço list/getById, **Then** ele nunca aparece; getById cross-tenant retorna `NOT_FOUND` (404).
4. **Given** o formulário de incidente, **When** abro a aba **Fotos**, **Then** vejo apenas o texto placeholder ("Upload de fotos será disponibilizado após a implantação da infraestrutura de documentos/storage.") — **sem** base64 no banco, bucket improvisado, path manual ou SDK novo.

---

### User Story 5 - Ciclo de vida dos incidentes (Priority: P2)

Como gestor de SST, quero uma tela central para acompanhar o estado de cada incidente (`registered → awaiting_planning → awaiting_completion → completed`, além de `cancelled`), iniciar planos de ação e concluir com justificativa, para gerir o tratamento dos incidentes.

**Why this priority**: Depende de US4 e US6. Agrega gestão sobre o registro, mas o registro (US4) já vale sozinho.

**Independent Test**: Transitar um incidente pelos estados via ações explícitas; bloquear conclusão com plano ativo pendente; exigir justificativa na conclusão; contar planos exibidos.

**Acceptance Scenarios**:

1. **Given** um incidente `registered`, **When** aplico transições manuais, **Then** ele segue `registered → awaiting_planning → awaiting_completion → completed`; a criação do **primeiro** plano de ação pode movê-lo para `awaiting_completion`; sem plano, permanece `awaiting_planning`.
2. **Given** um incidente com plano ativo não concluído, **When** tento concluí-lo, **Then** a conclusão é **bloqueada**; plano **cancelado** conta como resolvido.
3. **Given** a conclusão de um incidente, **When** confirmo, **Then** é exigida **justificativa** e `completed_at` é registrado; estados terminais não retrocedem; o status é **persistido**.
4. **Given** a tela central, **When** filtro, **Then** disponho de "Todos / Aguardando planejamento / Aguardando conclusão / Concluídos", "Ocultar concluídos", "Iniciar plano de ação", "Marcar como concluído" e a **contagem de planos** por incidente.

---

### User Story 6 - CRUD de Plano de Ação 5W2H multiorigem (Priority: P1)

Como técnico de segurança, quero criar planos de ação 5W2H vinculados a uma origem `risk` ou `incident` do meu tenant, com status, prazo e valor monetário, para planejar e acompanhar as ações corretivas.

**Why this priority**: Núcleo de tratamento, consumido por US5 e US7. Entrega valor sozinho (planejamento de ações).

**Independent Test**: CRUD com os sete campos 5W2H; validar origem suportada/existente/do tenant; overdue derivado; conclusão/cancelamento com timestamps; exclusão física só quando não iniciado e sem dependentes; origem removida vira histórico.

**Acceptance Scenarios**:

1. **Given** uma origem `risk` ou `incident` do tenant, **When** crio um plano, **Then** os sete campos (`what`, `why`, `who`, `where`, `when`, `how`, `how_much`) são aceitos (`how_much` numérico) e o plano nasce `planned`.
2. **Given** uma origem de tipo não suportado na V1 (`inspection`/`non_conformity`), inexistente ou de outro tenant, **When** crio/edito, **Then** recebo `FK_NOT_FOUND` (422).
3. **Given** um plano com prazo passado e não concluído, **When** listo, **Then** ele é marcado como **overdue** (derivado, não persistido).
4. **Given** um plano, **When** concluo, **Then** registra `completed_at`; **When** cancelo, **Then** registra `cancelled_at`; nenhum dos dois retrocede.
5. **Given** um plano ainda **não iniciado e sem dependentes**, **When** excluo, **Then** é exclusão física; caso contrário, uso **cancelamento**. `control_measures` permanece entidade distinta e **não** é alterada.
6. **Given** um plano cuja origem foi removida depois, **When** o visualizo, **Then** o plano **permanece como histórico** e a UI mostra "Origem removida".

---

### User Story 7 - Auditorias/Análises em Kanban com sugestão por IA (Priority: P3)

Como gestor de SST, quero um quadro Kanban de auditorias de riscos e incidentes com três colunas (`awaiting_analysis → planning_actions → completed`), transições por botões explícitos com justificativa, e um botão para sugerir campos 5W2H de planos por IA, para analisar riscos/incidentes e derivar ações.

**Why this priority**: Camada de gestão/analítica sobre US4/US6; opcional para o valor mínimo da fase.

**Independent Test**: Criar auditoria por origem `risk`/`incident`; garantir só **uma ativa** por origem; transitar por ações validadas com justificativa; criar planos 5W2H para a mesma origem; acionar IA mockada, cota free/pro e degradação graciosa.

**Acceptance Scenarios**:

1. **Given** uma origem `risk` ou `incident`, **When** abro uma auditoria, **Then** existe no máximo **uma auditoria ativa** por origem (UNIQUE parcial `(org_id, origin_type, origin_id) WHERE status <> 'completed'`).
2. **Given** o Kanban, **When** movo um card, **Then** a transição só ocorre por **botão explícito** e Server Action validada (não por drag-and-drop persistente), com **justificativa obrigatória** nas transições definidas pela regra.
3. **Given** uma auditoria, **When** crio planos, **Then** os planos vinculam-se à **origem** (`risk|incident`), não diretamente à auditoria; a auditoria **não** substitui o ciclo de vida do incidente (state machine única, não duplicada).
4. **Given** o botão "Sugerir 5W2H com IA", **When** o aciono, **Then** a IA recebe **apenas** contexto não-PII, sugere campos 5W2H, respeita cota (`pro` ilimitado, `free` = cota mensal padrão de 20); IA indisponível → `AI_UNAVAILABLE` com degradação graciosa; cota estourada → `QUOTA_EXCEEDED` (402); e o CRUD segue funcionando sem IA.

---

### Edge Cases

- Duas criações de OS simultâneas no mesmo tenant → números consecutivos; falha de uma transação faz rollback de OS **e** itens juntos.
- Emissão de OS após alteração de `risks`/`epi_catalog` → itens da OS já emitida permanecem congelados (snapshot).
- Solicitar segunda assinatura para OS já assinada → bloqueado; itens imutáveis.
- Token público inválido/expirado/usado/replay → recusa com estado derivado, sem vazar tenant.
- Incidente com plano ativo → conclusão bloqueada; plano cancelado libera conclusão.
- Conclusão de incidente sem justificativa → `VALIDATION` (422).
- Plano com origem de outro tenant → `FK_NOT_FOUND` (422); origem apagada depois → plano vira histórico "Origem removida".
- Segunda auditoria ativa para a mesma origem → bloqueada pela UNIQUE parcial (`DUPLICATE` 409).
- IA sem chave/instável → `AI_UNAVAILABLE`, fluxo manual segue; cota `free` esgotada → `QUOTA_EXCEEDED`.
- Papel `client` em qualquer superfície de incidentes → `FORBIDDEN` (403), sem exposição de dado de saúde.
- `db:migrate` num banco limpo antes da reconciliação do journal → pode falhar na tag `0018_schedule_events` sem `.sql` (endereçado pelo pré-requisito P0 da US1).

---

## Requirements _(mandatory)_

### Functional Requirements

#### Fundação, tenant, RLS, journal e erros (US1)

- **FR-001**: O sistema DEVE criar cinco tabelas novas — `service_orders`, `service_order_items`, `accidents`, `action_plans`, `risk_audits` — em uma **única** migration `0024_phase_06_safety_workflows` (idx 24) contendo enums, índices, constraints, RLS, policies, GRANTs e triggers `set_updated_at`.
- **FR-002**: **Pré-requisito P0 obrigatório da US1, ANTES de gerar a `0024` (registrar; não corrigir nesta spec):** reconciliar o histórico corrompido de migrations — 2 arquivos órfãos (`0018_org_billing.sql`, `0018_user_is_master.sql`) fora do `_journal.json`, tag `0018_schedule_events` sem `.sql`, e `schedule_events` duplicado (idx 18 e 23). A reconciliação DEVE conferir a sequência realmente aplicada na tabela `drizzle.__drizzle_migrations` do banco e alinhar arquivos+journal a essa realidade, **sem** apagar, renomear ou adicionar manualmente ao journal às cegas. DEVE também verificar se o helper de integração (`src/__tests__/integration/_helpers/db.ts`) enumera migrations por journal ou por glob, para garantir `db:migrate` limpo no Postgres efêmero.
- **FR-003**: Cada uma das cinco tabelas DEVE ter `org_id text NOT NULL → orgs.id`, RLS habilitada e policy `app_runtime` com `USING` **e** `WITH CHECK` sobre `current_setting('app.current_org', true)`, além de GRANTs para `app_runtime`.
- **FR-004**: Todo acesso a dados DEVE passar por `withOrg`; o tenant ativo vem de `requireOfficeStaff()`/sessão, **nunca** de input do cliente. Nenhuma Server Action acessa Drizzle diretamente — só via repositórios que envolvem `withOrg` e retornam `{rows,total}`.
- **FR-005**: O sistema DEVE mapear erros por **código de domínio** (não HTTP cru): target cross-tenant → `NOT_FOUND` (404); FK/origem cross-tenant ou inexistente → `FK_NOT_FOUND` (422); papel `client` → `FORBIDDEN` (403); input inválido → `VALIDATION` (422); duplicidade → `DUPLICATE` (409). Nenhum código de erro novo é necessário (o `HTTP_BY_CODE` atual já cobre todos).
- **FR-006**: Toda escrita DEVE passar por `auditedTenantWrite`; a auditoria/log DEVE registrar apenas `{level, operation, outcome, requestId, orgId, userId}` — **nunca** PII nem dado de saúde.

#### Ordem de Serviço — dados e CRUD (US2)

- **FR-007**: `service_orders` DEVE ter no mínimo: `id`, `org_id`, `number`, `title`, `assigned_employee_id`, `opened_at`, `due_date`, `closed_at`, `status`, `created_at`, `updated_at`, com enum `service_order_status` = `open | in_progress | completed | cancelled` e constraint `UNIQUE(org_id, number)`.
- **FR-008**: O `number` da OS DEVE ser calculado no servidor: dentro de `withOrg` + transação, `SELECT ... FOR UPDATE` na linha do tenant em `orgs` → `MAX(number)+1` no escopo do tenant → insert → `UNIQUE(org_id, number)` como backstop. Duas criações simultâneas no mesmo tenant DEVEM gerar números **distintos e consecutivos**; tenants distintos **não** compartilham lock global.
- **FR-009**: `service_order_items` DEVE ter no mínimo: `id`, `org_id`, `service_order_id`, `description`, `source_type`, `source_id`, `done`, `sort_order`, `created_at`, `updated_at`, com `source_type` ∈ `{manual, risk, epi}`. Cada `description` DEVE ter **no máximo 500 caracteres** (validado no domínio); acima disso → `VALIDATION` (422). _(Não há coluna `description` em `service_orders`; o limite aplica-se ao `service_order_item`.)_
- **FR-010**: Os itens de OS são **snapshots textuais regulatórios**; o sistema PODE pré-popular itens a partir de `employee.ges_id → risks → epi_risk → epi_catalog`, mas alterações futuras nessas fontes **não** DEVEM reescrever uma OS já emitida.
- **FR-011**: OS e seus itens DEVEM ser gravados na **mesma transação** (persistem ou fazem rollback juntos); item manual é permitido.
- **FR-012**: O sistema DEVE oferecer `list` (com paginação e filtros), `getById`, `create`, `update`, `delete` para OS, incluindo estado vazio, tela de detalhe e checklist de itens.
- **FR-013**: OS de outro tenant → `NOT_FOUND` (404); `assigned_employee_id` de outro tenant → `FK_NOT_FOUND` (422).
- **FR-014**: OS **assinada** tem itens **imutáveis**; OS assinada, concluída ou cancelada **não** pode ser excluída; exclusão só de OS **não assinada** e ainda `open`/`in_progress`; estados terminais (`completed`/`cancelled`) **não** retrocedem.
- **FR-015**: `days_open` DEVE ser **derivado** na leitura (não persistido, fuso `America/Sao_Paulo`). Estado e data da assinatura da OS DEVEM ser **derivados** de `signature_requests`/`signature_captures`, sem coluna duplicada na OS.

#### Workflow e assinatura da OS (US3)

- **FR-016**: O sistema DEVE registrar o `target_type` `service_order` nos registries de assinatura (`SIGNATURE_TARGET_TYPES`, `signatureTargetRegistry` server com `payloadSchema` Zod, `signatureFormRegistry` client) — hoje `demo | inspection | pgr`, passando a incluir `service_order`. Como `signature_requests.target_type` é texto, isso é **zero migration** de assinatura.
- **FR-017**: O sistema DEVE reusar `createSignatureRequestCore`, `signature_requests`, `signature_captures`, `/signature-requests/[token]`, QR code, `SignatureFormRenderer` e a **cota compartilhada**. É **proibido** criar `signature_token` na OS, rota `/assinaturaos/**`, REST público novo, tabela de assinatura nova ou cota nova.
- **FR-018**: O payload público da OS DEVE ser **mínimo e congelado**: `documentTitle`, `serviceOrderNumber`, `companyName`, `employeeName`, `issuedAt`, `items`. O schema público DEVE ser **`.strict()`**; `items` DEVE conter **no máximo 100 entradas** e cada item DEVE ter `description` com **no máximo 500 caracteres**; payload que exceda esses limites (ou traga campo extra) DEVE ser **rejeitado como `VALIDATION`** (422) antes da persistência/emissão pública. É **proibido** incluir CPF, dados de saúde, incidentes, riscos completos, IDs internos, `org_id` ou token.
- **FR-019**: Fluxo protegido: criar solicitação, consultar estado, copiar link e mostrar QR; o link é visível **somente na criação**.
- **FR-020**: Fluxo público: aceitar token **válido**; recusar **inválido/expirado/usado**; bloquear **replay**; funcionar **sem Clerk**; responder `no-store`.

#### Incidentes/Acidentes — dados e CRUD (US4)

- **FR-021**: A tabela canônica DEVE se chamar `accidents` (rótulo de UI "Incidentes/Acidentes") e ter no mínimo: `id`, `org_id`, `company_id`, `employee_id`, `occurred_at`, `type`, `category`, `severity`, `status`, `location`, `description`, `away_from_work`, `worked_hours`, `hospital`, `injury_nature_code`, `injury_nature_description`, `body_part_code`, `body_part_description`, `causative_agent_code`, `causative_agent_description`, `causes`, `environmental_impact`, `material_loss`, `third_parties`, `fatality_potential`, `responsible_area`, `activity_procedure`, `witnesses`, `investigation_notes`, `cat_number`, `cat_issued_at`, `completion_justification`, `completed_at`, `created_at`, `updated_at`.
- **FR-022**: DEVEM existir enums **fechados** apenas para `accident_type`, `accident_category`, `accident_severity`, `accident_status` (valores como identificadores em inglês, rótulos PT na UI). Todos os campos código/descrição (natureza da lesão, parte do corpo, agente causador) e `cat_number`/`cat_issued_at` DEVEM ser **opcionais e textuais** — **sem** tabelas oficiais de lookup CAT e **sem** emissão S-2210 (registro **interno**).
- **FR-023**: O sistema DEVE oferecer `list`, `getById`, `create`, `update`, `delete` para incidentes, com UI em abas: **Dados**, **Causas e investigação**, **Fotos**.
- **FR-024**: A aba **Fotos** DEVE ser **apenas placeholder** ("Upload de fotos será disponibilizado após a implantação da infraestrutura de documentos/storage."). É **proibido** base64 no banco, bucket improvisado, path manual, SDK novo ou upload inseguro.
- **FR-025**: **Somente office staff** acessa incidentes e dado de saúde; papel `client` → `FORBIDDEN` (403). Incidente de outro tenant nunca aparece; getById cross-tenant → `NOT_FOUND` (404).
- **FR-026**: Dado de saúde **nunca** DEVE aparecer em logs, metadata de auditoria, payload público, prompt de IA, fixtures versionadas nem em nomes reais no Postman.

#### Ciclo de vida do incidente (US5)

- **FR-027**: O incidente DEVE ter uma **state machine única persistida**: `registered → awaiting_planning → awaiting_completion → completed`, permitindo também `cancelled`; as transições são **manuais** (ações explícitas). Essa state machine **não** DEVE ser duplicada na auditoria.
- **FR-028**: A criação do **primeiro** plano de ação PODE mover o incidente para `awaiting_completion`; sem plano, permanece `awaiting_planning`.
- **FR-029**: A conclusão do incidente DEVE ser **bloqueada** enquanto houver plano ativo não concluído; plano **cancelado** conta como resolvido; a conclusão exige **justificativa** e grava `completed_at`; estados terminais não retrocedem.
- **FR-030**: A tela central de gestão DEVE oferecer filtros "Todos / Aguardando planejamento / Aguardando conclusão / Concluídos", "Ocultar concluídos", ações "Iniciar plano de ação" e "Marcar como concluído", e exibir a **contagem de planos** por incidente.

#### Planos de Ação 5W2H (US6)

- **FR-031**: `action_plans` DEVE ter os sete campos 5W2H — `what`, `why`, `who`, `where`, `when`, `how`, `how_much` (`how_much` em `numeric`) — mais `id`, `org_id`, `status`, `origin_type`, `origin_id`, `priority`, `completed_at`, `cancelled_at`, `created_at`, `updated_at`.
- **FR-032**: `origin_type` DEVE ser coluna **TEXT validada na aplicação** (não pgEnum), aceitando **apenas** `risk` e `incident` na V1; `inspection` e `non_conformity` ficam **fora da V1** mas plugam depois sem migration. `origin_type + origin_id` **não** têm FK física única; a aplicação DEVE validar tipo suportado, origem existente e origem **do tenant atual**. Origem inválida ou cross-tenant → `FK_NOT_FOUND` (422).
- **FR-033**: O sistema DEVE oferecer `list` (paginação/filtros), `getById`, `create`, `update`, `delete/cancel`, transições de status e uma **central multiorigem**. Status sugeridos: `planned | in_progress | completed | cancelled`.
- **FR-034**: `overdue` DEVE ser **derivado** do prazo (não persistido, fuso `America/Sao_Paulo`); concluído grava `completed_at`; cancelado grava `cancelled_at`; concluído/cancelado não retrocede.
- **FR-035**: Exclusão física só quando o plano ainda **não foi iniciado e não tem dependentes**; caso contrário, usar **cancelamento**. `control_measures` permanece entidade distinta e **não** DEVE ser alterada.
- **FR-036**: Se a origem for removida depois, o plano DEVE **permanecer como histórico** e a UI DEVE mostrar "Origem removida".

#### Auditorias/Kanban (US7)

- **FR-037**: `risk_audits` DEVE ter no mínimo: `id`, `org_id`, `origin_type`, `origin_id`, `status`, `justification`, `started_at`, `completed_at`, `created_at`, `updated_at`, com `origin_type` TEXT validada (`risk|incident` na V1) e estados `awaiting_analysis → planning_actions → completed`.
- **FR-038**: DEVE existir **somente uma auditoria ativa por origem**, garantida por **UNIQUE parcial** `(org_id, origin_type, origin_id) WHERE status <> 'completed'`.
- **FR-039**: As transições de estado DEVEM ocorrer **somente por botões explícitos** e Server Actions validadas — **não** por drag-and-drop persistente. Justificativa é **obrigatória** nas transições definidas pela regra de negócio.
- **FR-040**: A tela DEVE ser um Kanban de três colunas ("Aguardando análise / Planejando ações / Concluído"); PODE criar planos 5W2H para a **mesma origem**; os planos vinculam-se à **origem** (`risk|incident`), não diretamente à auditoria. A auditoria **não** substitui o ciclo de vida do incidente.

#### IA (US7)

- **FR-041**: O sistema DEVE reusar a infra Anthropic existente e adicionar o `kind` de uso `action_plan_suggestion` — **zero migration** (`ai_usage_events.kind` é coluna texto).
- **FR-042**: A IA DEVE sugerir campos 5W2H recebendo **apenas** contexto não-PII; **nunca** DEVE receber nome do trabalhador, CPF, dados médicos, testemunhas, fotografias ou outros dados pessoais.
- **FR-043**: Cota: `pro` ilimitado; `free` = mesma cota mensal do padrão atual (20/mês). IA indisponível → `AI_UNAVAILABLE` (502) com **degradação graciosa**; cota estourada → `QUOTA_EXCEEDED` (402, já mapeado). Todo o CRUD DEVE funcionar integralmente **sem** IA.

#### API, docs e Postman (transversal)

- **FR-044**: Cada recurso HTTP-exposto DEVE entregar as **quatro** superfícies no mesmo PR: Server Action (`officeAction` → `ActionResult<T>`), Route Handler REST espelho (`restHandler`, verbos reais, `201` no create, `204` no delete, `/[id]/dependents` quando houver FK de entrada), registro em `docs/api/api-design.md` e requests no `docs/api/sst-manager.postman_collection.json`.
- **FR-045**: Os recursos REST a documentar são: `service-orders`, `accidents`, `action-plans`, `risk-audits` e a **assinatura da service-order**. É **proibido** entregar Route Handler sem documentação/Postman.

### Key Entities

- **service_orders**: OS emitida a um funcionário; numeração por tenant; estados `open/in_progress/completed/cancelled`; estado/data de assinatura derivados da infra genérica; `days_open` derivado.
- **service_order_items**: itens/checklist da OS; snapshots textuais imutáveis após emissão; `source_type` `manual/risk/epi`; carrega `org_id` próprio.
- **accidents**: incidente/acidente (dado de saúde, P0); enums fechados de tipo/categoria/severidade/status; campos CAT opcionais e textuais (registro interno, sem S-2210); state machine de ciclo de vida persistida.
- **action_plans**: plano de ação 5W2H; `origin_type` TEXT validada (`risk|incident` na V1); `how_much` numérico; overdue derivado; histórico preservado se a origem sumir.
- **risk_audits**: auditoria/análise em Kanban por origem `risk|incident`; uma ativa por origem (UNIQUE parcial); transições por ação explícita com justificativa.
- **Reuso (não alterar)**: `signature_requests`/`signature_captures` (assinatura), `ai_usage_events` (cota IA), `employees`/`companies`/`ges`/`job_roles`/`risks`/`epi_risk`/`epi_catalog`/`control_measures`.

### Estados reais da assinatura da OS (para o plano — não inventar estados)

O estado público do token é **derivado** pela infra genérica (`signable` / `invalid` / `expired` / `used`), e o estado de assinatura da OS é derivado da existência de `signature_captures` vinculada à `signature_request` de `target_type = service_order`. **Não** persistir estado de assinatura na OS.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Duas criações concorrentes de OS no **mesmo** tenant produzem, em 100% das execuções do teste de concorrência, dois números **distintos e consecutivos** (sem gap, sem colisão).
- **SC-002**: Uma criação de OS em um tenant B iniciada durante o lock de um tenant A **não** é bloqueada por A (tenants distintos não compartilham lock global) — verificável no teste de concorrência cruzada.
- **SC-003**: Ao falhar a gravação de qualquer item, **nenhuma** OS e **nenhum** item daquela requisição persistem (rollback conjunto) — 0 linhas órfãs após o teste.
- **SC-004**: Uma OS pode ser assinada por um usuário **sem login** via `/signature-requests/[token]`, e a captura aparece vinculada à `signature_request` correspondente.
- **SC-005**: Um token de assinatura de OS é de **uso único**: a segunda tentativa (replay) é recusada em 100% dos casos.
- **SC-006**: O payload público da OS contém **exclusivamente** os seis campos congelados e **nenhum** campo de PII sensível (CPF, saúde, IDs internos, `org_id`, token) — verificável por asserção de shape; e solicitações com **mais de 100 itens** ou item com `description` **acima de 500 caracteres** são **rejeitadas como `VALIDATION`** antes da persistência/emissão pública.
- **SC-007**: Em 100% das listagens/consultas, incidentes de **outro** tenant **nunca** aparecem para o tenant ativo.
- **SC-008**: Papel `client` recebe `FORBIDDEN` (403) em **todas** as superfícies (Server Action e REST) de incidentes/dado de saúde — 0 vazamentos.
- **SC-009**: Um incidente com plano ativo **não** conclui: a tentativa retorna erro de estado em 100% dos casos; após cancelar/concluir os planos, a conclusão passa.
- **SC-010**: Um plano com origem inexistente, de tipo não suportado na V1 ou de outro tenant é rejeitado com `FK_NOT_FOUND` (422) em 100% dos casos; origem válida do tenant é aceita.
- **SC-011**: Só existe **uma** auditoria ativa por origem: a segunda criação ativa para a mesma origem é rejeitada (UNIQUE parcial) em 100% dos casos.
- **SC-012**: Com a IA indisponível, o CRUD de planos permanece 100% funcional e a sugestão retorna `AI_UNAVAILABLE` sem quebrar o fluxo.
- **SC-013**: As cinco tabelas novas têm RLS **real**: um SELECT/INSERT sem `withOrg` retorna 0 linhas / é bloqueado, comprovado em Postgres efêmero por isolamento tenant A/B.
- **SC-014**: Após a reconciliação do journal (US1), `db:migrate` aplica **do zero** num Postgres efêmero sem erro (0 falhas na tag antes órfã).
- **SC-015**: REST, `docs/api/api-design.md` e `docs/api/sst-manager.postman_collection.json` permanecem **sincronizados**: todo endpoint entregue está documentado e no Postman; e `lint`, `typecheck`, `unit`, `integração` e `build` ficam **verdes** antes do merge.

---

## Divergências das issues × realidade aprovada

- Issues usam `organization_id`, `features/**`, `lib/db/**`, `AppError`/`Result`, SQLite, `/assinaturaos/[param]`, `signature_token` na OS → **substituídos** por `org_id`, `src/shared/**`+`src/app/**`, `ActionResult<T>`+`officeAction`+`restHandler`, Postgres efêmero, `/signature-requests/[token]`, infra genérica de assinatura.
- Issues sugerem tabelas oficiais de lookup CAT e transmissão eSocial → **fora da V1**; V1 é registro **interno** com códigos textuais opcionais (o encanamento `esocial_events`/`S-2210` existe mas não é acionado).
- Issues sugerem origens `inspection`/`non_conformity` → **fora da V1**; `origin_type` é TEXT extensível, restrito a `risk|incident` agora (adição futura = zero migration).
- Issues sugerem upload de fotos → **placeholder** até existir infra de storage/documentos.
- Numeração de migration presumida `0019` nas notas antigas → **corrigida para `0024`** (a `develop` avançou até `0023`).
- Sete issues → **uma** spec com sete user stories (decisão do Tech Lead no Gate 0).

---

## Assumptions

- A reconciliação de migrations (FR-002) é resolvida na primeira fase de implementação **antes** de gerar a `0024`; a decisão concreta sai da conferência da tabela `drizzle.__drizzle_migrations` real, registrada no plano.
- `ai_usage_events.kind` é coluna texto (confirmado) → o `kind` `action_plan_suggestion` não exige migration.
- A cota mensal `free` para `action_plan_suggestion` espelha a cota atual de sugestão de IA (20/mês).
- A "origem" de plano/auditoria é resolvida por `(origin_type, origin_id)` validado na aplicação; não há FK física composta única.
- `days_open` e `overdue` são calculados no fuso `America/Sao_Paulo` (padrão do projeto, `todayInSaoPaulo`).
- Playwright protegido roda apenas quando Clerk estiver disponível no ambiente; o público roda sempre.

## Out of Scope (Fora da V1)

- Upload real de fotos e infra de storage/buckets.
- Tabelas oficiais de lookup CAT e validação oficial completa dos códigos.
- Transmissão CAT/eSocial S-2210 (o encanamento `esocial_events` existe, mas não é acionado nesta fatia).
- Geração de PDF/Gotenberg.
- Origens `inspection` e `non_conformity` (adição futura via `origin_type` TEXT = zero migration).
- Drag-and-drop **persistente** no Kanban.
- Coleta de CPF/IP/user-agent no fluxo público.
- Alteração de `control_measures` (entidade do PGR, permanece distinta e intacta).
- **Correção** do histórico de migrations além do necessário para gerar/aplicar a `0024` (a reconciliação é escopo de implementação da US1, não desta spec).

## Dependências e riscos

- **Dependência**: infra de assinatura genérica (010/022) e infra de IA (016/017) mergeadas em `develop` — confirmadas no Gate 0.
- **Risco (P0)**: reconciliação do histórico de migrations mal feita pode corromper o journal ou quebrar `db:migrate` no Postgres efêmero — mitigar conferindo `drizzle.__drizzle_migrations` real antes de tocar em arquivos/journal (FR-002).
- **Risco (P0)**: vazamento de dado de saúde por log/payload/IA/fixture — mitigado pelas invariantes 2 e 6 e por asserções de shape nos testes.
- **Risco (P2)**: crescimento do payload público da OS além do congelado — mitigado por schema Zod fixo e teste de shape.

## Ambiente de testes

- **Unit**: numeração/derivações (days_open, overdue, estado de assinatura derivado), state machine de incidente, validação de origem (`origin_type` TEXT), schemas Zod, shape do payload público.
- **Integração** (Postgres efêmero, `INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL`, `--runInBand`, **nunca** SQLite): migration/RLS/enums/FKs/UNIQUEs/índices/`WITH CHECK`/`app_runtime`/isolamento tenant A-B + `db:migrate` limpo pós-reconciliação; CRUD de OS + itens transacionais + rollback + snapshot + numeração concorrente + tenants independentes + filtros/estados + imutabilidade pós-assinatura + assinatura pública + replay; incidentes (CRUD, campos opcionais, `client` proibido, cross-tenant, state machine, conclusão com planos pendentes, placeholder de fotos); planos (CRUD, 5W2H, origens válidas/inválidas/cross-tenant, status, overdue, cancelamento, origem removida); auditorias (uma ativa por origem, transições, justificativa, vínculo a planos, filtros, IA **mockada**, cota free/pro, degradação graciosa).
- **REST/cURL**: superfícies espelho de cada recurso.
- **Playwright**: fluxo público de assinatura (sempre) e protegido (quando Clerk disponível).
- **Qualidade**: `lint`, `typecheck`, `format`, `build`, além de docs + Postman sincronizados.
