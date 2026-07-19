# Feature Specification: Modelo de dados — Documentos, Pastas e Jobs

**Feature Branch**: `feature/documents-data-model`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Modelo de dados de documentos com pastas hierárquicas e metadados de validade, mais fila leve de jobs para operações assíncronas (Fase 05, issue #33) — fatia de modelagem pura (schema + migration + RLS + testes), sem UI e sem CRUD, no padrão Modelo B. Brainstorm: `claudedocs/fase-05-brainstorms/01-issue-33-modelo-de-dados.md`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Acervo de documentos com pastas e validade (Priority: P1)

Como plataforma, preciso armazenar os metadados dos documentos do escritório (nome, tipo, versão, tamanho, referência do arquivo, validade) organizados em pastas hierárquicas, isolados por escritório (tenant), para que as fatias seguintes do GED (#34 CRUD, #35 download) tenham fundação de dados pronta.

**Why this priority**: Sem este modelo, nenhuma outra fatia do trilho GED da Fase 05 pode começar. É a fundação da fase.

**Independent Test**: Aplicar a migration num banco limpo, inserir documentos e pastas para dois escritórios distintos e verificar que (a) cada escritório enxerga somente o próprio acervo, (b) a hierarquia de pastas com raiz funciona, (c) os metadados obrigatórios são exigidos pelo banco.

**Acceptance Scenarios**:

1. **Given** dois escritórios A e B com documentos cadastrados, **When** o escritório A lista seus documentos, **Then** nenhum documento ou pasta de B aparece (nem por consulta direta que esqueça o filtro de tenant — o backstop do banco devolve vazio).
2. **Given** uma pasta "Raiz > Contratos > 2026" do escritório A, **When** um documento é criado apontando para "2026", **Then** o vínculo persiste e a subida pela cadeia de pais chega à raiz.
3. **Given** uma pasta com um nome já usado por outra pasta irmã (mesmo pai, mesmo escritório), **When** a segunda é inserida, **Then** o banco rejeita por duplicidade.
4. **Given** um documento com data de validade no passado, **When** o status de validade é consultado, **Then** ele é classificado como vencido **por derivação na leitura** — nenhuma rotina de atualização periódica é necessária.

---

### User Story 2 - Fila leve de jobs com retry e claim seguro (Priority: P1)

Como plataforma, preciso de uma fila persistida de trabalhos assíncronos (primeiro consumidor: geração de PDF em lote, #39) em que cada trabalho pertence a um escritório, registra tentativas e resultado, e pode ser reivindicado por um processador sem risco de execução dupla.

**Why this priority**: A geração em lote (#39) é inviável sem a fila; o modelo precisa nascer correto quanto a concorrência (claim atômico) e recuperação (job travado volta à fila), pois esses invariantes são de schema, não de UI.

**Independent Test**: Inserir jobs pendentes e simular dois processadores concorrentes reivindicando o mesmo job; verificar que apenas um o obtém. Simular processador que morre no meio e verificar que o modelo permite identificar e devolver o job à fila.

**Acceptance Scenarios**:

1. **Given** um job pendente, **When** dois processadores tentam reivindicá-lo simultaneamente, **Then** exatamente um obtém o job e o outro não o processa.
2. **Given** um job cujo processamento falhou, **When** a falha é registrada, **Then** o contador de tentativas incrementa e o erro fica registrado no resultado.
3. **Given** um job reivindicado há mais tempo que o limite de processamento (processador morto), **When** a fila é inspecionada, **Then** é possível identificá-lo pelo carimbo de reivindicação e devolvê-lo ao estado pendente.
4. **Given** jobs de escritórios A e B, **When** o processamento de um job de A escreve resultados (ex.: documentos gerados), **Then** a escrita ocorre exclusivamente no escopo do escritório A.

---

### User Story 3 - Vínculo de documento a outras entidades (Priority: P2)

Como plataforma, preciso poder anexar um documento a outra entidade do sistema (ex.: PGR, futura OS) sem acoplamento rígido de schema, para que novos módulos consumidores não exijam mudança de estrutura.

**Why this priority**: Habilita os consumos futuros (anexos de PGR/OS) sem migrations adicionais, mas nenhuma fatia da Fase 05 depende dele para funcionar.

**Independent Test**: Inserir um documento vinculado a um tipo/id de entidade permitido e verificar persistência e consulta pelo par (tipo, id); verificar que o conjunto de tipos é fechado na camada de aplicação.

**Acceptance Scenarios**:

1. **Given** um documento sem vínculo, **When** ele é criado, **Then** os campos de vínculo ficam vazios sem erro.
2. **Given** um documento vinculado a uma entidade, **When** se consulta por (tipo, id) da entidade, **Then** o documento é localizado eficientemente (índice composto).
3. **Given** a exclusão da entidade vinculada, **Then** o documento permanece (integridade do vínculo é responsabilidade da aplicação — decisão registrada, sem FK).

---

### Edge Cases

- Pasta na raiz (pai nulo): unicidade de nome entre as pastas da raiz do mesmo escritório também é garantida (o pai nulo não pode furar a regra de duplicidade).
- Ciclo de pastas (mover pasta para dentro de si mesma/descendente): o banco não impede; é **invariante de aplicação** documentado para a fatia #34.
- Documento sem validade definida: permitido; fica fora da classificação vencido/a vencer.
- Arquivo muito grande: tamanho em bytes comporta arquivos acima de 2 GiB (tipo largo).
- Job com payload vazio ou malformado: o processamento falha de forma registrada (tentativas + erro), nunca silenciosa.
- Escrita marcada para outro tenant: rejeitada pelo banco (`WITH CHECK` da policy).

## Requirements _(mandatory)_

### Functional Requirements

**Documentos**

- **FR-001**: O sistema MUST persistir documentos com: nome, tipo, versão, tamanho em bytes (tipo largo), referência do arquivo armazenado (`storage_path`), data de validade (opcional), pasta (opcional — raiz quando ausente), vínculo polimórfico opcional, escritório dono e timestamps.
- **FR-002**: O status de validade (válido / a vencer / vencido) MUST ser derivável dos dados na leitura (padrão `classifyTrainingStatus` da fatia 017); NENHUMA coluna materializada de validade que exija atualização periódica. A coluna `status` representa **ciclo de vida** (`generating|ready`, default `ready`) e já nasce nesta fatia para consumo da #38 (custo marginal agora; evita migration depois).
- **FR-003**: Versionamento por **1 linha por versão** (decisão Q1): cada revisão é uma linha em `documents`, agrupadas por um identificador de grupo (`document_group_id`); a versão corrente é a de maior número no grupo; unicidade `(org, grupo, versão)` garantida pelo banco. O histórico fica preservado por construção e o download de versão antiga (#35) não exige estrutura extra.
- **FR-004**: Tipo de documento é **texto livre** (decisão Q2 — paridade ePGR: vocabulário definido pelo escritório; tipo novo sem migration; filtro por igualdade de texto).
- **FR-005**: O vínculo polimórfico (`related_entity_type` + `related_entity_id`) MUST existir **sem** FK, com índice composto e conjunto fechado de tipos permitidos definido na camada de aplicação (tipos iniciais: `pgr`; extensível sem migration).

**Pastas**

- **FR-006**: Pastas MUST formar árvore simples por auto-referência ao pai (raiz = pai nulo), sem closure table.
- **FR-007**: Nome de pasta MUST ser único entre irmãs do mesmo escritório, **inclusive na raiz** (pai nulo participa da regra via índice parcial ou equivalente).
- **FR-008**: Exclusão de pasta com filhos (subpastas ou documentos) é **restrita no banco** (decisão Q3 — `RESTRICT`): pasta não-vazia não pode ser excluída; a UX de esvaziar/mover antes é responsabilidade da fatia #34. Postura conservadora contra perda acidental de acervo.

**Jobs**

- **FR-009**: Jobs MUST ter: tipo (conjunto fechado), status (conjunto fechado: pendente / em processamento / concluído / falhou), payload estruturado (jsonb), resultado/erro estruturado (jsonb), contador de tentativas, carimbo de reivindicação (para recuperação de claim travado), escritório dono e timestamps.
- **FR-010**: O modelo MUST suportar reivindicação atômica (um job pendente reivindicado por dois processadores é obtido por exatamente um) — invariante exercitado por teste de integração.
- **FR-011**: O modelo MUST permitir leitura administrativa da fila (o processador atravessa tenants) mantendo TODA escrita de resultado escopada ao tenant do job — a forma de acesso administrativo (role/policy dedicada, análoga ao precedente `caepi-upsert`) é decisão do plan, mas o requisito fica registrado aqui.

**Transversais (Modelo B / constituição)**

- **FR-012**: As três tabelas MUST ter `org_id text NOT NULL → orgs.id` indexado, RLS habilitado com policy de isolamento para `app_runtime` (template `companies.ts`) e GRANTs + triggers `set_updated_at` como SQL custom na migration.
- **FR-013**: A migration MUST ser gerada pelo fluxo padrão (drizzle-kit) com a próxima numeração livre (hoje: `0025`), aplicada por conexão owner.
- **FR-014**: Zero UI, zero Server Action de CRUD nesta fatia; repositórios só se exigidos pelos testes.

### Key Entities

- **Documento**: metadado de um arquivo do acervo do escritório — nome, tipo, versão, tamanho, referência de armazenamento, validade opcional, pasta opcional, vínculo polimórfico opcional. Pertence a exatamente um escritório.
- **Pasta**: nó da árvore de organização do acervo — nome e pai opcional (raiz). Pertence a exatamente um escritório; nomes únicos entre irmãs.
- **Job**: unidade de trabalho assíncrono — tipo, status, payload, resultado, tentativas, carimbo de reivindicação. Pertence a exatamente um escritório; processada por um worker que atravessa tenants na leitura, nunca na escrita.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As 3 tabelas existem via migration aplicada num banco limpo, e os testes de isolamento em Postgres efêmero provam que dados de um escritório nunca aparecem para outro (leitura sem tenant → vazio; escrita cross-tenant → rejeitada).
- **SC-002**: Hierarquia de pastas funciona com raiz; nome duplicado entre irmãs (inclusive na raiz) do mesmo escritório é rejeitado pelo banco (teste de integração com violação de unicidade).
- **SC-003**: Um job pendente disputado por dois processadores simultâneos é obtido por exatamente um (teste de integração de concorrência); job com claim mais velho que o limite é identificável e retornável à fila.
- **SC-004**: O status de validade de qualquer documento é computável por função pura a partir dos dados persistidos, coberta por testes unitários com datas fixas (fuso `America/Sao_Paulo`), sem nenhuma rotina agendada.
- **SC-005**: `npm run test` e `npm run test:integration` verdes; lint + typecheck verdes.

## Assumptions

- A numeração real da próxima migration é `0025` (o repositório estava em `0023_schedule_events` na especificação; no rebase sobre o develop pós-#175 (`0024_phase_06_safety_workflows`) a migration foi renumerada para `0025`; o texto da issue #33 e o CLAUDE.md estão desfasados do estado atual).
- Tabelas `documents`, `folders` e `jobs` não existem hoje no schema (verificado em `src/shared/db/schema/` em 2026-07-18).
- O evento trigger `ensure_rls` de produção força RLS em tabela nova — as policies explícitas desta fatia já cobrem isso.
- `storage_path` é texto opaco nesta fatia; o particionamento por tenant do Storage é responsabilidade das fatias #37/#34.
- O conjunto de tipos do vínculo polimórfico nasce mínimo (`pgr`) e cresce por código, sem migration.
- Decisões de clarificação registradas em 2026-07-18: Q1 = 1 linha por versão (`document_group_id`); Q2 = tipo de documento em texto livre; Q3 = exclusão de pasta com filhos restrita no banco. A coluna `status` de ciclo de vida (`generating|ready`) entra já nesta fatia como default `ready` (consumo futuro pela #38).
- A fila de jobs nasce com um único tipo (`pdf_batch` ou equivalente), definido em enum de banco ampliável por migration futura — consumidores além do #39 não são antecipados (YAGNI).
- Testes de integração usam Postgres efêmero (`INTEGRATION_*`), nunca SQLite, seguindo `src/__tests__/integration/_helpers/db.ts`.

## Out of Scope

- CRUD/telas do GED (#34); download via URL assinada (#35); cliente/deploy Gotenberg (#36/#37); geração de PDF única (#38) e em lote (#39); template do PGR (#40); controle de formulário ISO (#88).
- Upload de binários e qualquer interação com o Supabase Storage.
- Processador (worker/cron) da fila — apenas o modelo que o suporta.
