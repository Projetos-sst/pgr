# Feature Specification: Editor do PGR (abas) e visão consolidada

**Feature Branch**: `feature/pgr-consolidated-view`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "[Fase 03] 09 · Editor do PGR (abas) e visão consolidada (#27) — editor do documento PGR em abas client-side dentro de `/pgr/[id]`, com aba de informações básicas, vínculo de GES, revisões e uma visão consolidada de leitura que agrega GES → riscos → avaliação vigente → medidas de controle. Zero-migration sobre `pgr`, `pgr_ges`, `pgr_revisions` (migration 0012)."

## Contexto e invariantes desta fatia

Fatia da Fase 03 que transforma o detalhe do PGR (hoje somente leitura em `/pgr/[id]`) num
**editor com abas** e adiciona uma **visão consolidada** para revisão do documento antes da geração
de PDF (Fase 05). Aproveita tabelas **já existentes** e amarra os módulos de risco já entregues.

Invariantes obrigatórios (aprovados no Gate 0):

- **ZERO MIGRATION**: não criar migration, não alterar schema, não tocar
  `src/shared/db/schema/**` nem `migrations/**`. Tabelas reais já existem na migration `0012`.
- **Tabelas reais**: **`pgr`** (documento), **`pgr_ges`** (vínculo PGR↔GES, UNIQUE
  `(org_id, pgr_id, ges_id)`), **`pgr_revisions`** (revisões, UNIQUE
  `(org_id, pgr_id, revision_number)`; campos `revision_number`/`revised_at`/`notes`; **sem autor**).
  Nunca `pgrsetor`/`pgr_sector`/`pgr_revisoes`.
- **PGR CRUD já existe** (Feature 013): repository, actions, REST (`/api/v1/pgr`), UI
  (`/pgr`, `/new`, `/[id]`, `/[id]/edit`) e o **modal de Declaração de Ciência** (gate de criação,
  aceite **não** persistido). Esta fatia **reusa/harmoniza**, não reimplementa.
- **`pgr_ges` e `pgr_revisions` ainda não têm repository/actions/REST/UI** — serão criados aqui
  (zero-migration; as tabelas já existem).
- **Medidas sem status persistido** (Feature 018): a consolidada usa **estados derivados**
  (`without_plan`/`planned`/`overdue`), nunca status gravado.
- **Avaliação vigente** por risco vem da última avaliação (`getCurrentRiskAssessment`); ordenação
  por **`risk_level`** desc; classificação por **`result`**. Sem snapshot.
- **Multi-tenant**: tenant sempre da sessão/contexto; nunca aceitar `orgId`/`organizationId`/
  `organization_id` do cliente. Isolamento por `withOrg` + RLS `app_runtime`.
- **Aba "Documentos GED" e aba "Cor/Sumário" NÃO são funcionais nesta fatia** (sem schema/storage)
  — aparecem como **placeholder desabilitado** ("Disponível na Fase 05" / follow-up), nunca como
  critério de aceite.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Editar o PGR em abas com Informações básicas (Priority: P1)

Como gestor de SST, quero abrir o PGR em `/pgr/[id]` e navegar por abas (Informações básicas, GES,
Revisões, Consolidada) editando os dados básicos do documento no mesmo lugar, para gerir o PGR sem
pular entre telas soltas.

**Why this priority**: É o **shell** que hospeda todas as demais abas e a porta de entrada da
feature; entrega valor sozinho (editor unificado do documento).

**Independent Test**: Abrir `/pgr/[id]`, alternar entre as abas, editar Informações básicas (ex.
responsável/validade) e salvar; confirmar persistência reusando o CRUD existente de `pgr`.

**Acceptance Scenarios**:

1. **Given** um PGR existente da organização ativa, **When** o gestor abre `/pgr/[id]`, **Then** vê
   um editor com abas: **Informações básicas**, **GES**, **Revisões**, **Consolidada** (e as abas
   **Cor/Sumário** e **Documentos GED** desabilitadas com aviso de Fase 05).
2. **Given** a aba Informações básicas, **When** o gestor edita campos reais de `pgr`
   (empresa, obra, responsável, tipo de registro, nº do registro, emissão, validade) e salva,
   **Then** o PGR é atualizado (reuso do CRUD existente).
3. **Given** um PGR de outra organização/ inexistente, **When** acessado, **Then** resulta em
   "não encontrado" (404), sem vazar dados.

---

### User Story 2 - Vincular e desvincular GES ao PGR (Priority: P1)

Como gestor de SST, quero, na aba GES, listar os GES vinculados ao PGR e adicionar/remover vínculos,
para definir quais grupos de exposição o documento cobre.

**Why this priority**: Os GES vinculados são a **fonte** da visão consolidada; sem vínculo, a
consolidada fica vazia. É pré-requisito do valor central.

**Independent Test**: Na aba GES, adicionar um GES da organização ao PGR, confirmar que aparece na
lista; tentar adicionar o mesmo GES de novo e confirmar recusa por duplicidade; remover o vínculo.

**Acceptance Scenarios**:

1. **Given** um PGR sem GES, **When** o gestor adiciona um GES da organização, **Then** o vínculo é
   criado e o GES passa a constar na lista de vinculados.
2. **Given** um PGR que já tem o GES X vinculado, **When** o gestor tenta vincular X de novo,
   **Then** a operação é recusada como **duplicidade**.
3. **Given** um GES de outra organização/ inexistente, **When** o gestor tenta vinculá-lo, **Then**
   a operação é recusada como **referência não encontrada**.
4. **Given** um GES vinculado, **When** o gestor remove o vínculo, **Then** o GES some da lista (o
   GES em si e seus riscos **não** são apagados — só o vínculo).
5. **Given** um usuário com papel `client`, **When** tenta adicionar/remover vínculo, **Then** a
   operação é bloqueada (sem permissão).

---

### User Story 3 - Visão consolidada do PGR (Priority: P1)

Como gestor de SST, quero uma aba Consolidada que mostre, em um só lugar, o PGR e todos os seus GES
com riscos, avaliação vigente e medidas de controle — riscos ordenados do mais grave para o menos
grave — para revisar o documento inteiro antes de emitir.

**Why this priority**: É o **entregável-título** da issue e a base de dados reutilizável pelo PDF da
Fase 05.

**Independent Test**: Para um PGR com GES vinculados que têm riscos avaliados e medidas, abrir a aba
Consolidada e conferir: contexto do PGR, GES agrupados, riscos ordenados por nível de risco desc,
avaliação vigente exibida, medidas com estado derivado; e os fallbacks para lacunas.

**Acceptance Scenarios**:

1. **Given** um PGR com GES vinculados contendo riscos avaliados, **When** o gestor abre a aba
   Consolidada, **Then** vê o documento consolidado: dados do PGR (empresa, obra, responsável), os
   GES vinculados, e por GES os riscos com **avaliação vigente** (nível + classificação) e as
   **medidas de controle** com **estado derivado** (`Sem plano`/`Planejada`/`Vencida`).
2. **Given** riscos com níveis diferentes, **When** a consolidada é exibida, **Then** os riscos
   aparecem **ordenados por `risk_level` desc** (mais graves primeiro).
3. **Given** um risco **sem avaliação vigente**, **When** exibido, **Then** mostra "Sem avaliação
   vigente" e é ordenado **por último**.
4. **Given** um PGR **sem GES vinculado**, **When** a consolidada é aberta, **Then** exibe seção
   vazia com mensagem orientando vincular GES.
5. **Given** um GES vinculado **sem riscos**, **When** exibido, **Then** o GES aparece com mensagem
   de ausência de riscos.
6. **Given** um risco **sem medidas de controle**, **When** exibido, **Then** mostra "Sem medidas de
   controle".
7. **Given** PGRs de organizações diferentes, **When** a consolidada de um é montada, **Then** só
   aparecem dados da própria organização (isolamento multi-tenant).

---

### User Story 4 - Registrar revisões do PGR (Priority: P2)

Como gestor de SST, quero, na aba Revisões, listar e registrar revisões do PGR (número, data e
notas), para manter o histórico de versões do documento.

**Why this priority**: Complementa o ciclo de vida do documento; útil, mas o valor central já é
entregue pela consolidada e pelo vínculo de GES.

**Independent Test**: Criar uma revisão com número/data/notas, confirmar que aparece na lista;
tentar criar outra revisão com o mesmo número e confirmar recusa por duplicidade.

**Acceptance Scenarios**:

1. **Given** um PGR, **When** o gestor cria uma revisão (número, data, notas), **Then** ela é
   registrada e listada, e a criação gera **registro de auditoria** do ator.
2. **Given** um PGR que já tem a revisão nº N, **When** o gestor tenta criar outra revisão nº N,
   **Then** a operação é recusada como **duplicidade**.
3. **Given** a lista de revisões, **When** exibida, **Then** mostra **número, data e notas** — **não
   há autor persistido** nesta fatia (o ator fica no log de auditoria).

---

### Edge Cases

- **PGR sem GES** → aba GES vazia (permite adicionar) e Consolidada com seção vazia + mensagem.
- **GES vinculado sem riscos** → listado na Consolidada com "sem riscos".
- **Risco sem avaliação vigente** → "Sem avaliação vigente"; ordenado por último.
- **Risco sem medidas** → "Sem medidas de controle".
- **Vínculo GES duplicado** → recusado como duplicidade (UNIQUE real).
- **Revisão com número duplicado** → recusada como duplicidade (UNIQUE real).
- **GES/PGR inexistente ou de outra organização** → referência não encontrada / não encontrado, sem
  vazar dados.
- **Declaração de Ciência** → o PGR continua não podendo ser criado sem aceite (gate de criação); o
  aceite **não** é persistido (sem coluna, sem migration).
- **Abas Cor/Sumário e Documentos GED** → desabilitadas com aviso "Fase 05"; não são critério de
  aceite.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST apresentar o PGR em `/pgr/[id]` como um **editor com abas client-side**:
  **Informações básicas**, **GES**, **Revisões**, **Consolidada** funcionais; **Cor/Sumário** e
  **Documentos GED** presentes apenas como **placeholder desabilitado** (aviso de Fase 05).
- **FR-002**: A aba **Informações básicas** MUST reutilizar o CRUD existente de `pgr` para exibir e
  editar os campos reais: empresa, obra/contrato, responsável, tipo de registro
  (`crm`/`crea`/`mte`/`not_applicable`), número do registro, data de emissão, data de validade.
- **FR-003**: O sistema MUST manter a regra de que um PGR **não pode ser criado sem o aceite** da
  Declaração de Ciência de Riscos (gate no fluxo de criação existente); o aceite MUST NOT ser
  persistido (sem coluna, sem migration).
- **FR-004**: A aba **GES** MUST listar os GES vinculados ao PGR, permitir **adicionar** e
  **remover** vínculos usando `pgr_ges`.
- **FR-005**: O sistema MUST recusar a criação de um vínculo GES já existente para o PGR, tratando
  como **duplicidade** (UNIQUE `(org_id, pgr_id, ges_id)`; nunca upsert).
- **FR-006**: A remoção de um vínculo GES MUST remover apenas o vínculo (`pgr_ges`), **sem** apagar
  o GES nem seus riscos.
- **FR-007**: A aba **Revisões** MUST listar as revisões do PGR e permitir **criar** uma nova
  revisão com número, data e notas; MUST NOT persistir autor (não há campo real).
- **FR-008**: O sistema MUST recusar a criação de uma revisão cujo número já exista para o PGR,
  tratando como **duplicidade** (UNIQUE `(org_id, pgr_id, revision_number)`).
- **FR-009**: A aba **Consolidada** MUST exibir, em leitura, o documento agregado: dados do PGR
  (empresa, obra, responsável), os **GES vinculados**, e por GES seus **riscos** com **avaliação
  vigente** (nível `risk_level` + classificação `result`) e as **medidas de controle** com **estado
  derivado** (`without_plan`/`planned`/`overdue`).
- **FR-010**: Na consolidada, os riscos MUST ser ordenados por **`risk_level` desc** (mais graves
  primeiro); riscos **sem avaliação vigente** MUST ser exibidos por último com "Sem avaliação
  vigente".
- **FR-011**: A consolidada MUST usar **estados derivados** das medidas (regra da Feature 018) e
  MUST NOT introduzir status persistido, `pending`/`in_progress`/`completed`, nem snapshot de
  `risk_level`/`result`.
- **FR-012**: A consolidada MUST tratar os fallbacks: PGR sem GES (seção vazia + mensagem), GES sem
  riscos (mensagem de ausência), risco sem avaliação ("Sem avaliação vigente"), risco sem medidas
  ("Sem medidas de controle").
- **FR-013**: A estrutura de dados da consolidada MUST ser **reutilizável** pela Fase 05 (geração de
  PDF), porém a geração de PDF em si MUST ficar fora do escopo.
- **FR-014**: Todo acesso a dados MUST ser escopado pela organização ativa vinda da sessão/contexto;
  o sistema MUST NOT aceitar `orgId`/`organizationId`/`organization_id` do cliente.
- **FR-015**: O sistema MUST expor as operações também como superfície **REST** versionada, além das
  Server Actions: (a) **vínculo PGR↔GES** — listar, adicionar, remover; (b) **revisões** — listar,
  criar; (c) **consolidada** — obter (read-only). Reutilizando os mesmos repositórios/validação.
- **FR-016**: O sistema MUST mapear os erros assim: PGR inexistente/cross-tenant →
  **NOT_FOUND / 404**; GES inexistente/cross-tenant → **FK_NOT_FOUND / 422**; vínculo GES duplicado
  → **DUPLICATE / 409**; revisão de número duplicado → **DUPLICATE / 409**; entrada inválida →
  **VALIDATION / 422**; papel `client` em escrita → **FORBIDDEN / 403**.
- **FR-017**: A documentação de API (`docs/api/api-design.md`) e a coleção Postman
  (`docs/api/sst-manager.postman_collection.json`) MUST ser atualizadas com os recursos, verbos,
  filtros e exemplos (incluindo 403/404/409/422), com as variáveis necessárias (`pgrId`, `gesId` e
  o id de revisão, se aplicável).

### Key Entities _(include if feature involves data)_

- **PGR (`pgr`)**: documento — empresa, obra/contrato, responsável, tipo/nº de registro, emissão,
  validade. CRUD já existente; reutilizado.
- **Vínculo PGR↔GES (`pgr_ges`)**: associação N:N entre PGR e GES. **Único** por
  `(organização, pgr, ges)`. Adicionar/remover; sem dados próprios além do vínculo.
- **Revisão (`pgr_revisions`)**: metadados de versão — número, data, notas. **Único** por
  `(organização, pgr, número)`. Sem autor persistido (ator no log de auditoria).
- **Consolidado (derivado, não persistido)**: agregação read-only de PGR → GES vinculados → riscos →
  avaliação vigente (`risk_level`/`result`) → medidas de controle (estado derivado). Reutilizável
  pela Fase 05.
- **Risco / Avaliação / Medida (`risks` / `risk_assessments` / `control_measures`)**: modelos
  existentes; somente leitura nesta fatia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A partir de `/pgr/[id]`, um gestor navega entre as 4 abas funcionais e edita as
  informações básicas do PGR sem sair da página.
- **SC-002**: Um GES pode ser vinculado e desvinculado do PGR; tentativas de vincular o mesmo GES
  duas vezes são bloqueadas em 100% dos casos.
- **SC-003**: A aba Consolidada exibe todos os GES vinculados com seus riscos ordenados por nível de
  risco (mais graves primeiro) e riscos sem avaliação por último, em 100% das exibições.
- **SC-004**: As medidas na consolidada mostram estado derivado (`Sem plano`/`Planejada`/`Vencida`)
  sem qualquer campo de status persistido.
- **SC-005**: Revisões podem ser registradas e listadas; números de revisão duplicados são
  bloqueados em 100% dos casos.
- **SC-006**: Nenhum dado de uma organização é visível na consolidada/listas de outra organização
  (0% de vazamento cross-tenant), validado por testes de isolamento e RLS.
- **SC-007**: A superfície REST responde com os códigos corretos em 100% dos casos previstos:
  200 (list/get/consolidada), 201 (add vínculo/create revisão), 204 (remove vínculo), 409
  (duplicidade), 404 (PGR alvo), 422 (validação/FK GES), 403 (papel `client`).

## Assumptions

- As tabelas `pgr`, `pgr_ges`, `pgr_revisions` e o enum `pgr_registration_type` já existem
  (migration `0012`); esta fatia é **zero migration**.
- A cadeia de risco (`risks`, `risk_assessments` com `getCurrentRiskAssessment`, `control_measures`
  com estados derivados) já está mergeada em `develop` e disponível para leitura.
- O CRUD do documento PGR e o modal de Declaração de Ciência (Feature 013) já existem e são
  reutilizados; o aceite continua **não** persistido.
- "Nível de risco" para ordenação é `risk_level` da **avaliação vigente**; sem avaliação, o risco
  vai para o fim.
- O ator das escritas é registrado pelo **log de auditoria** (`auditedTenantWrite`); a coluna de
  autor da revisão não existe e persistir autor seria follow-up com migration.
- Abas **Cor/Sumário** e **Documentos GED** são placeholders desabilitados (Fase 05); não contam
  como critério de aceite.
- Somente papéis de escritório (`owner`/`collaborator`) operam escritas; `client` é bloqueado.
- Testes de integração rodam contra **Postgres efêmero** via `INTEGRATION_*`; nunca SQLite e nunca
  seed destrutivo em Supabase compartilhado. O harness REST-via-Jest pode falhar com 500 (limitação
  pré-existente) → validação REST por cURL.
- `CLAUDE.md`/formatação seguem o gate final da fatia (Prettier dirigido + `format:check`).

## Out of Scope

- Qualquer **migration** (`0016`) ou alteração de schema (`src/shared/db/schema/**`,
  `migrations/**`).
- **Documentos GED**: CRUD, upload, storage, download, URL assinada, anexos, tabela de documentos,
  vínculo de documento com PGR (tudo Fase 05).
- **Cor da capa** e **sumário** persistidos; **aceite** da declaração persistido (data/usuário);
  **autor** persistido de revisão; **status** do documento; **versão** persistida.
- **Status manual** de medidas (proibido pela Feature 018 — consolidada usa estado derivado).
- **PDF** final da Fase 05.
- Alteração em `control_measures`, `risk_methodology` ou nos CRUDs de risco/avaliação;
  IA/recomendação automática.
