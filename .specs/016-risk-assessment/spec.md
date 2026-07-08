# Feature Specification: Avaliação de Risco — Probabilidade × Severidade (matriz 5×5)

**Feature Branch**: `feature/risk-assessment`

**Spec directory**: `.specs/016-risk-assessment`

**Created**: 2026-07-08

**Status**: Draft

**Issue**: [Fase 03] 05 · Avaliação de risco — probabilidade × severidade (#25)

**Input**: Registrar e gerir avaliações de risco (matriz 5×5) para cada risco do inventário do
GES, calculando e persistindo `risk_level = probability × severity` e a classificação final
(`result`) segundo a metodologia 5×5 configurável da organização.

---

## Restrições de escopo (fonte da verdade — Gate 0 aprovado)

Esta fatia é uma **camada de fluxo/CRUD sobre uma tabela que já existe**, análoga à fatia de riscos
(#24). Os artefatos concretos são citados no cabeçalho **para travar o escopo** (continuação de uma
fatia de modelo de dados); as histórias e requisitos funcionais permanecem focados em resultado.

- **ZERO migration.** A tabela real **`risk_assessments`** já existe na migration `0012`
  (`0012_pgr_risk_data_model.sql`) com RLS, GRANT, trigger `set_updated_at_risk_assessments`, os
  CHECKs (probability 1–5, severity 1–5, risk_level 1–25, coerência `risk_level = probability *
  severity`, uncertainty_degree 0–2) e as FKs `org_id → orgs` / `risk_id → risks` (ambas CASCADE).
  **NÃO** criar/alterar migration; **NÃO** tocar em `src/shared/db/schema/**` nem em `migrations/**`.
- **Metodologia 5×5 já existe** (migration `0013`, issue #76): tabela `risk_methodology` (singleton
  por org), domínio `domains/pgr/methodology.ts` (`classify`, `buildMatrix`, `riskClassificationLabel`),
  presets `methodology-presets.ts` (`defaultRiskMethodology`) e repositório `repositories/risk-methodology.ts`
  (`getRiskMethodologyView(orgId)` → devolve a metodologia da org **ou** o padrão com
  `configured:false`). Esta fatia **consome** a metodologia; **não** cria CRUD nem altera metodologia.
- **Tabela real `risk_assessments`** — nunca `avaliacoes_risco`. **Escopo = apenas as colunas reais**:
  `risk_id`, `criterion`, `probability`, `severity`, `risk_level`, `uncertainty_degree`,
  `tolerance_limit`, `result`, `assessed_at` (+ `id`/`org_id`/`created_at`/`updated_at` geridos pela
  infra). **Não** tocar em `control_measures`/plano 5W2H (#26), `risks` (CRUD já pronto),
  `risk_methodology`, `epi_risk`, IA ou recomendação automática.
- **Histórico 1:N por risco** — **não há UNIQUE** em `risk_assessments`. Cada gravação cria uma linha
  nova (reavaliação). **Nunca 409, nunca `DUPLICATE`, sem upsert.** "Avaliação atual/vigente" = a
  última por `assessed_at desc`, depois `created_at desc` (derivada na leitura).
- **`risk_level` calculado e persistido**: `risk_level = probability × severity`, computado no domínio
  (reusando `computeRiskLevel` de `domains/pgr/risks.ts`), gravado na coluna; o banco só valida (CHECK
  de coerência). Não editável manualmente na UI.
- **`result` persistido como snapshot**: no create/update, buscar a metodologia da org (fallback
  padrão), classificar com `classify(riskLevel, methodology.classificationBands)` e gravar a classe
  resultante em `result`. Na leitura, exibe-se o `result` persistido — o histórico **não** é
  recalculado retroativamente quando a metodologia muda.
- **Update = corpo completo** (sem PATCH parcial).
- **Multi-tenant**: o tenant vem **sempre** da sessão/contexto (`requireOfficeStaff`/`withOrg`);
  **nunca** aceitar `orgId`/`organizationId`/`organization_id` do cliente. Nada de `SQLite` (a issue
  cita SQLite/`organization_id`/`features/pgr/` — **divergências**; o padrão real é Postgres +
  `org_id` + `src/shared/**` + `src/app/(protected)`).
- **Superfície obrigatória** (checklist "API surface" da CLAUDE.md): Server Actions **+** REST
  RESTful **+** `docs/api/api-design.md` **+** Postman, no mesmo PR. **Testes** unit (domínio) +
  integração (Server Actions/RLS) contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite;
  **cURL** obrigatório; **Playwright MCP** previsto quando houver credencial Clerk.
- **Gate de formatação final**: rodar `npm run format:check` (mesmo check do CI, repo-wide/LF) ao fim;
  Prettier dirigido **não** basta como único gate; corrigir antes de push/PR; não formatar repo-wide
  às cegas sem analisar o diff.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avaliar um risco pela matriz 5×5 (Priority: P1)

Como técnico/coordenador de SST, a partir do detalhe de um risco do inventário eu registro uma
avaliação escolhendo probabilidade (1–5) e severidade (1–5); o sistema calcula o nível de risco
(probabilidade × severidade) e classifica o resultado (Trivial/Tolerável/Moderado/Substancial/
Intolerável) segundo a metodologia da minha organização, salvando a avaliação vinculada ao risco.

**Why this priority**: É o coração da feature e o entregável mínimo da fatia — sem criar avaliação
não há valor. Sozinha já entrega um MVP: transforma um risco inventariado em risco avaliado.

**Independent Test**: A partir de `/risks/[id]`, criar uma avaliação com probabilidade 3 e
severidade 3 e confirmar que o sistema grava `risk_level = 9` e `result = "Moderado"` (conforme as
faixas da metodologia vigente), com a avaliação aparecendo vinculada ao risco correto e isolada ao
tenant ativo.

**Acceptance Scenarios**:

1. **Given** um risco existente no tenant ativo e a metodologia padrão, **When** o usuário cria uma
   avaliação com critério `quantitative`, probabilidade 3, severidade 3, grau de incerteza 0 e data
   de hoje, **Then** o sistema persiste `risk_level = 9` e `result` = a classe da faixa que cobre 9
   na metodologia da organização, vinculada ao risco.
2. **Given** o mesmo risco, **When** o usuário informa probabilidade 5 e severidade 5, **Then**
   `risk_level = 25` e `result` = a classe da faixa que cobre 25 (a mais grave).
3. **Given** que a organização **não** configurou metodologia, **When** o usuário abre o formulário,
   **Then** a UI usa o padrão de fallback e sinaliza que está "usando a metodologia padrão"
   (`configured: false`), sem impedir a avaliação.
4. **Given** um valor de probabilidade fora de 1–5 (ex.: 0 ou 6), **When** o usuário tenta salvar,
   **Then** a operação é rejeitada por validação (sem gravar) com mensagem de campo.

---

### User Story 2 - Consultar o histórico de avaliações de um risco (Priority: P1)

Como usuário de SST, quero ver todas as avaliações já registradas para um risco, da mais recente
para a mais antiga, com nível de risco, classificação e data, para acompanhar a evolução e
identificar a avaliação vigente.

**Why this priority**: A avaliação é histórica (1:N); sem a listagem o registro criado em US1 fica
invisível. É P1 porque compõe o fluxo mínimo (criar → ver).

**Independent Test**: Com duas avaliações no mesmo risco em datas diferentes, abrir
`/risks/[id]/assessments` e confirmar que ambas aparecem ordenadas por data (mais recente primeiro) e
que a primeira da lista é a avaliação vigente.

**Acceptance Scenarios**:

1. **Given** um risco com 2 avaliações (`assessed_at` 2026-06-01 e 2026-07-01), **When** o usuário
   abre a lista, **Then** a de 2026-07-01 aparece primeiro (ordenação `assessed_at desc`, depois
   `created_at desc`).
2. **Given** um risco sem avaliações, **When** o usuário abre a lista, **Then** vê um estado vazio
   convidando a criar a primeira avaliação.
3. **Given** riscos/avaliações de **outra** organização, **When** o usuário lista as avaliações de um
   risco do seu tenant, **Then** nenhuma avaliação de outro tenant aparece.

---

### User Story 3 - Reavaliar, editar e excluir avaliações (Priority: P2)

Como usuário de SST, quero registrar uma reavaliação (nova linha), corrigir uma avaliação existente
(corpo completo) ou excluir uma avaliação equivocada, mantendo o histórico consistente.

**Why this priority**: Complementa o ciclo de vida. É P2 porque criar + listar já entregam valor;
edição/exclusão/reavaliação refinam a gestão do histórico.

**Independent Test**: Numa avaliação com severidade 4, editar a probabilidade de 3 para 4 e
confirmar que `risk_level` passa de 12 para 16 e `result` é reclassificado; criar uma segunda
avaliação e confirmar que a primeira permanece; excluir uma avaliação e confirmar que sai da lista
sem afetar as demais.

**Acceptance Scenarios**:

1. **Given** uma avaliação com probabilidade 3 e severidade 4 (`risk_level = 12`), **When** o usuário
   edita a probabilidade para 4 (mantendo severidade 4), **Then** o sistema recalcula
   `risk_level = 16` e reclassifica `result` pela metodologia vigente, gravando o corpo completo.
2. **Given** um risco já avaliado, **When** o usuário cria uma nova avaliação, **Then** uma nova
   linha é criada (reavaliação), sem conflito/409 e sem sobrescrever a anterior.
3. **Given** uma avaliação existente, **When** o usuário confirma a exclusão, **Then** a avaliação é
   removida fisicamente e some da lista, sem endpoint/aviso de dependentes.
4. **Given** o `id` de uma avaliação de **outro** tenant, **When** o usuário tenta obter/editar/
   excluir, **Then** a operação falha como "não encontrado" (nunca vaza nem age cross-tenant).

---

### Edge Cases

- **Risco inexistente ou de outro tenant** ao listar/criar avaliação → erro de referência de FK
  (não encontrado), sem gravar e sem vazar.
- **Avaliação inexistente ou de outro tenant** ao obter/editar/excluir → "não encontrado".
- **Probabilidade/severidade fora de 1–5** ou **grau de incerteza fora de 0–2** → validação rejeita.
- **`criterion`** fora de `{qualitative, quantitative}` → validação rejeita.
- **`assessed_at` ausente/inválida** → validação rejeita (data é obrigatória; a UI pode pré-preencher
  hoje, mas o valor gravado é o informado).
- **Metodologia não configurada** → usa fallback padrão e sinaliza; nunca bloqueia a avaliação.
- **Mudança de metodologia depois de avaliações gravadas** → o `result` histórico **não** muda
  (snapshot); só novas gravações/edições usam a metodologia vigente.
- **Usuário com papel `client`** → acesso negado (somente `owner`/`collaborator`).
- **Ausência de tenant na sessão** → bloqueado pelo gate; a leitura nunca devolve todos os registros
  (RLS backstop).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir **criar** uma avaliação de risco vinculada a um risco existente
  do tenant ativo, com os campos `criterion`, `probability`, `severity`, `uncertainty_degree`,
  `tolerance_limit` (opcional) e `assessed_at`.
- **FR-002**: O sistema MUST **calcular e persistir** `risk_level = probability × severity` a cada
  create/update; o valor MUST NOT ser informado/editado manualmente pelo cliente.
- **FR-003**: O sistema MUST **classificar e persistir** `result` como snapshot, aplicando a
  metodologia da organização (`classify(riskLevel, classificationBands)`) obtida via
  `getRiskMethodologyView`, com **fallback ao padrão** quando a organização não configurou metodologia.
- **FR-004**: O sistema MUST **listar** as avaliações de um risco, ordenadas por `assessed_at desc`
  e depois `created_at desc` (mais recente primeiro), exibindo nível, classificação e data.
- **FR-005**: O sistema MUST expor a **avaliação vigente** de um risco como a primeira dessa
  ordenação (derivada na leitura, sem coluna/flag).
- **FR-006**: O sistema MUST permitir **obter** uma avaliação por `id`, **editar** (corpo completo,
  sem PATCH) e **excluir** (delete físico, com confirmação na UI, sem endpoint de dependentes).
- **FR-007**: O sistema MUST manter **histórico 1:N** por risco: cada nova avaliação é uma nova linha;
  MUST NOT existir UNIQUE, conflito 409, `DUPLICATE` ou upsert.
- **FR-008**: O sistema MUST validar `probability` ∈ [1,5], `severity` ∈ [1,5],
  `uncertainty_degree` ∈ [0,2] e `criterion` ∈ {`qualitative`,`quantitative`} **antes** de qualquer
  escrita; violações → erro de validação (não grava).
- **FR-009**: O sistema MUST rejeitar `riskId` inválido, inexistente ou de outro tenant como **erro
  de referência de FK** (não encontrado), sem gravar.
- **FR-010**: O sistema MUST tratar avaliação inexistente ou de outro tenant como **"não encontrado"**
  em obter/editar/excluir, nunca agindo cross-tenant.
- **FR-011**: O sistema MUST negar acesso a usuários sem papel de escritório (`client`) →
  "proibido"; MUST derivar o tenant da sessão e MUST NOT aceitar identificador de organização vindo
  do cliente.
- **FR-012**: O sistema MUST expor as operações tanto como **ação da aplicação** (retornando um
  resultado discriminado ok/erro) quanto como **API REST** com verbos reais, mapeando os mesmos
  códigos de erro para HTTP: sucesso de leitura/edição → 200, criação → 201, exclusão → 204,
  validação/FK → 422, não encontrado → 404, proibido → 403 e **nunca 409**.
- **FR-013**: A **UI** MUST, a partir do detalhe do risco, permitir acessar as avaliações, criar,
  editar e excluir; MUST calcular `risk_level` e **prever a classificação em tempo real** conforme a
  metodologia da organização; MUST exibir rótulos normativos de probabilidade (1–5), severidade
  (descrições normativas), grau de incerteza (0–2), limite de tolerância, data e classificação; e
  MUST sinalizar quando a metodologia é o **padrão** (`configured:false`).
- **FR-014**: O sistema MUST registrar as operações de escrita (create/update/delete) em auditoria;
  leitura (list/get) MUST NOT gerar auditoria de escrita.
- **FR-015**: A documentação (`docs/api/api-design.md`) e a coleção Postman
  (`docs/api/sst-manager.postman_collection.json`) MUST ser atualizadas com o recurso, verbos,
  filtros e exemplos de 403/404/422 (sem 409).

### Key Entities *(include if feature involves data)*

- **Avaliação de Risco (`risk_assessments`)**: uma avaliação histórica de um risco pela matriz 5×5.
  Atributos: risco vinculado (`risk_id`), critério (`qualitative`/`quantitative`), probabilidade
  (1–5), severidade (1–5), nível de risco (`risk_level` = prob × sev, persistido), grau de incerteza
  (0–2, default 0), limite de tolerância (texto livre, opcional), resultado/classificação (`result`,
  snapshot), data da avaliação (`assessed_at`, obrigatória). Pertence a um tenant (`org_id` da
  sessão) e a um único risco; relação 1:N com `risks` (um risco tem muitas avaliações).
- **Risco (`risks`)** *(existente, não alterado)*: item do inventário do GES ao qual a avaliação se
  vincula; usado para validar o vínculo dentro do tenant.
- **Metodologia de Risco (`risk_methodology`)** *(existente, não alterado)*: configuração 5×5 por
  organização (faixas de classificação); consumida para derivar `result`, com fallback padrão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir do detalhe de um risco, um usuário consegue registrar uma avaliação completa
  em menos de 2 minutos, vendo o nível de risco e a classificação previstos **antes** de salvar.
- **SC-002**: Em 100% das criações/edições, o nível de risco gravado é exatamente probabilidade ×
  severidade e a classificação gravada corresponde à faixa da metodologia vigente para aquele nível.
- **SC-003**: O histórico de um risco exibe todas as suas avaliações ordenadas da mais recente para a
  mais antiga, e identifica a avaliação vigente como a primeira da lista.
- **SC-004**: Nenhuma operação retorna dados ou aceita ações de outra organização — 100% das
  tentativas cross-tenant resultam em "não encontrado" (ou proibido, quando aplicável), comprovado por
  teste de isolamento contra banco descartável.
- **SC-005**: Nenhuma operação de avaliação retorna conflito/409 em qualquer cenário (histórico 1:N
  sem UNIQUE).
- **SC-006**: 100% dos cenários de validação (probabilidade/severidade fora de 1–5, incerteza fora de
  0–2, critério inválido, data ausente) são rejeitados sem gravação.

## Assumptions

- A tabela `risk_assessments`, a metodologia `risk_methodology` e o CRUD de `risks` (#24) já estão em
  `develop` (migrations `0012`/`0013`; PRs #135/#136 mergeados) — **zero migration** nesta fatia.
- A classificação usa a metodologia da organização com **fallback padrão** já implementado
  (`getRiskMethodologyView` → `configured:false`); o padrão é suficiente e não é persistido como linha.
- `result` guarda a classe (snapshot) vigente no momento da gravação; mudanças posteriores de
  metodologia não reescrevem o histórico.
- A avaliação vigente é derivada na leitura (`assessed_at desc`, `created_at desc`); não há coluna de
  "ativa" nem versionamento formal além do histórico 1:N.
- Papéis de escritório (`owner`/`collaborator`) podem gerir avaliações; `client` não.
- Ambiente de testes usa **Postgres efêmero** (`INTEGRATION_*`); o seed de integração já semeia
  `risk_assessments` em `org_a`/`org_b` (`riskAssessmentA`/`riskAssessmentB`) para cenários de
  isolamento — não usar Supabase compartilhado com seed destrutivo.
- Limitação conhecida do harness: **REST-via-Jest pode falhar com 500** (pré-existente, provado com
  `rest-pgr.test.ts`); nesse caso, documentar e validar o REST autoritativamente por **cURL** contra
  o dev server no Postgres efêmero.
