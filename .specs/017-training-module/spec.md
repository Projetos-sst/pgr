# Feature Specification: Módulo de Treinamentos (Fase 04)

**Feature Branch**: `feature/training-module`

**Created**: 2026-07-08

**Status**: Draft

**Input**: Fechar toda a Fase 04 (label `Fase 04 — Treinamentos`) numa única leva: modelo de dados
(#28), CRUD de catálogo (#29), registro de realização por funcionário (#30), controle de
vencimento/reciclagem (#31) e treinamentos obrigatórios por função com conformidade (#80). A leva é
"zero migration", exceto o modelo, que traz a migration `0016`.

> Fonte da verdade: `docs/briefings/fase04-treinamentos-brainstorming.md` (âncora, prevalece) +
> briefings 028/029/030/031/080. As issues #28/#30/#31/#80 estão desatualizadas (pré-Modelo B) e não
> valem onde divergirem dos briefings.

## User Scenarios & Testing _(mandatory)_

### Fundação (pré-requisito das histórias) — Modelo de dados + regras de validade e status

Antes de qualquer tela, o sistema precisa persistir treinamentos, realizações e vínculos obrigatórios
de forma isolada por escritório (tenant), e precisa de **duas regras de negócio únicas e centralizadas**
que todas as histórias reutilizam:

- **Cálculo de validade** (`computeValidUntil`): dada a data de realização e a periodicidade do
  treinamento, a validade é `+1/+2/+3/+5 anos` para `annual/biennial/triennial/quinquennial`, e
  **sem validade** (nunca expira) para `single`.
- **Classificação de status** (`classifyTrainingStatus`): a partir do último registro (ou da ausência
  dele), retorna `missing` (ausente) · `expired` (vencido) · `due_soon` (a vencer dentro da janela) ·
  `ok` (em dia). Comparação por dia (date-only), fuso `America/Sao_Paulo`, limites inclusivos.

**Independent Test**: as duas regras são testáveis isoladamente por testes unitários (matriz de
periodicidades e de status, incluindo fronteiras de janela e o caso `single`), e a persistência é
testável por testes de integração de isolamento/integridade contra Postgres efêmero — tudo sem UI.

**Acceptance Scenarios**:

1. **Given** uma realização em `2026-07-08` de um treinamento `annual`, **When** o sistema calcula a
   validade, **Then** o resultado é `2027-07-08`.
2. **Given** uma realização de um treinamento `single`, **When** o sistema calcula a validade,
   **Then** o resultado é "sem validade" (não expira).
3. **Given** um registro cujo `valid_until` já passou de hoje, **When** o status é classificado,
   **Then** o resultado é `expired`.
4. **Given** um registro cujo `valid_until` cai dentro da janela de alerta (ex.: 30 dias), **When** o
   status é classificado, **Then** o resultado é `due_soon`.
5. **Given** ausência de qualquer registro para um par funcionário+treinamento, **When** o status é
   classificado no contexto de obrigatórios, **Then** o resultado é `missing`.
6. **Given** um usuário do escritório A, **When** consulta as tabelas de treinamento sem contexto de
   tenant, **Then** nenhum dado do escritório B é retornado (isolamento por RLS).

---

### User Story 1 - CRUD do Catálogo de Treinamentos (Priority: P1)

O gestor de SST cadastra, edita, lista, busca e exclui os treinamentos do catálogo do seu escritório,
com os 5 campos ePGR: **Nome** (obrigatório) · **Norma de Referência** (opcional, ex.: NR-10, NR-35) ·
**Carga Horária** (inteiro positivo) · **Periodicidade** (Anual/Bianual/Trienal/Quinquenal/Única) ·
**Descrição** (opcional). O catálogo é a base que registros (US2) e vínculos obrigatórios (US4)
referenciam.

**Why this priority**: sem catálogo não há o que registrar nem o que exigir. É o pré-requisito
funcional de US2 e US4 e já entrega valor sozinho (o escritório passa a manter seu rol de treinamentos).

**Independent Test**: criar, listar (com paginação e busca por nome/norma), detalhar/editar e excluir
um item do catálogo, incluindo os bloqueios de duplicidade, isolamento cross-tenant e exclusão de item
em uso — verificável de ponta a ponta pela UI e pela API REST, sem depender de US2/US3/US4.

**Acceptance Scenarios**:

1. **Given** o gestor autenticado do escritório A, **When** cria um treinamento com nome, carga horária
   positiva e periodicidade válida, **Then** o item é criado no escritório A e aparece na listagem.
2. **Given** já existe um treinamento chamado "NR-35 Trabalho em Altura" no escritório A, **When** o
   gestor tenta criar outro com o mesmo nome, **Then** a criação é recusada com erro de duplicidade
   (`DUPLICATE`/409).
3. **Given** carga horária `0`, negativa ou não inteira, ou periodicidade fora do enum, **When** o
   gestor tenta salvar, **Then** a operação é recusada com erro de validação (`VALIDATION`/422).
4. **Given** um treinamento pertencente ao escritório B, **When** o gestor do escritório A tenta
   detalhar, editar ou excluir por id, **Then** o sistema responde `NOT_FOUND`/404 (nunca vaza dados).
5. **Given** um treinamento que possui realizações registradas ou vínculos obrigatórios, **When** o
   gestor tenta excluí-lo, **Then** a exclusão é bloqueada com aviso de dependências (via `dependents`),
   sem deixar registros órfãos.
6. **Given** uma lista com muitos itens, **When** o gestor busca por parte do nome ou da norma,
   **Then** a listagem retorna paginada apenas os itens correspondentes do seu escritório.
7. **Given** o papel `client` (sem função de escritório), **When** tenta qualquer operação de escrita
   no catálogo, **Then** a operação é recusada com `FORBIDDEN`/403.

---

### User Story 2 - Registro de treinamento realizado (Priority: P1)

O gestor registra que um funcionário realizou um treinamento do catálogo, informando a **data de
realização** e, opcionalmente, um **certificado** (caminho de arquivo — sem upload/GED nesta fase). A
**validade é calculada automaticamente** pela periodicidade do treinamento, no servidor — o gestor não
digita validade.

**Why this priority**: é o registro operacional que alimenta o controle de vencimento (US3) e a
conformidade (US4). Sem ele, o módulo não tem dado de realização.

**Independent Test**: registrar uma realização para um funcionário do escritório ativo e verificar que
a validade gravada corresponde à periodicidade (`single` grava sem validade), que data futura é
bloqueada, e que funcionário/treinamento de outro escritório não gravam nada.

**Acceptance Scenarios**:

1. **Given** um funcionário e um treinamento `biennial` do escritório ativo, e realização em
   `2026-07-08`, **When** o gestor registra, **Then** a realização é gravada com validade `2028-07-08`.
2. **Given** um treinamento `single`, **When** o gestor registra a realização, **Then** a realização é
   gravada **sem validade** (não expira).
3. **Given** uma data de realização no futuro (posterior a hoje), **When** o gestor tenta registrar,
   **Then** a operação é recusada com `VALIDATION`/422 ("realizado" é passado).
4. **Given** um registro sem certificado informado, **When** o gestor registra, **Then** a realização é
   gravada normalmente (certificado é opcional).
5. **Given** um funcionário ou treinamento pertencente a outro escritório, **When** o gestor tenta
   registrar, **Then** nada é gravado e o sistema responde `FK_NOT_FOUND`/422 (isolamento por RLS).
6. **Given** um funcionário com histórico, **When** o gestor consulta os registros daquele funcionário,
   **Then** o sistema lista o histórico de realizações do escritório ativo; um registro pode ser
   excluído.
7. **Given** o papel `client`, **When** tenta registrar uma realização, **Then** recebe `FORBIDDEN`/403.

---

### User Story 3 - Controle de vencimento / reciclagem (Priority: P1)

O gestor vê, numa tela consolidada só-leitura, todos os treinamentos **vencidos** e **a vencer** por
funcionário, com status visual, para identificar quem precisa reciclar. A tela filtra por funcionário e
por **janela** (30/60/90 dias). O sistema também expõe uma **query de resumo** (`{ expired, dueSoon }`)
para o dashboard futuro (Fase 7).

**Why this priority**: é o valor de gestão central do módulo (evitar treinamentos vencidos). Consome
diretamente as regras da Fundação.

**Independent Test**: com realizações de vários status, verificar que a listagem classifica corretamente
cada linha, que `single` nunca aparece como vencido, que apenas o último registro de cada par conta
(reciclagem), que os filtros funcionam e que o resumo retorna as contagens corretas — tudo escopado ao
tenant.

**Acceptance Scenarios**:

1. **Given** funcionários com realizações de diferentes status, **When** o gestor abre o controle de
   vencimento, **Then** cada linha mostra Funcionário · Treinamento · Data de Realização · Validade ·
   Status (Vencido/A vencer/Em dia).
2. **Given** um treinamento `single` realizado, **When** o controle é exibido, **Then** ele **nunca**
   aparece como vencido (fica fora do cômputo de vencimentos).
3. **Given** um funcionário que refez (reciclou) um treinamento vencido, **When** o status é calculado,
   **Then** apenas o **último** registro conta e o status reflete a nova validade (não fica "vencido").
4. **Given** o filtro de janela em 30 dias, **When** o gestor aplica, **Then** só aparecem os que vencem
   até hoje+30 (além dos já vencidos), respeitando limites inclusivos.
5. **Given** nenhum treinamento vencido nem a vencer, **When** o gestor abre a tela, **Then** vê um
   estado vazio positivo ("tudo em dia").
6. **Given** o escritório A, **When** consulta o resumo, **Then** recebe `{ expired, dueSoon }` contando
   apenas os dados do escritório A.

---

### User Story 4 - Treinamentos obrigatórios por função + conformidade (Priority: P2)

O gestor define quais treinamentos são **obrigatórios** para cada função (vínculo função ↔ treinamento)
e o sistema sinaliza automaticamente os funcionários **não-conformes** — aqueles cujo obrigatório está
**ausente** ou **vencido**. A aba "Treinamentos Obrigatórios" no perfil do funcionário reflete
exatamente os vínculos da função dele; um relatório de não-conformes usa a mesma regra sem filtro de
funcionário.

**Why this priority**: agrega valor de conformidade regulatória, mas depende das histórias anteriores
(catálogo, registro, regra de status). Por isso P2.

**Independent Test**: vincular/desvincular treinamentos obrigatórios a uma função e verificar a
conformidade por funcionário (incluindo `missing` quando não há registro, respeito ao último registro,
funcionário sem função) — verificável pela UI/aba do perfil e pela API, isolado por tenant.

**Acceptance Scenarios**:

1. **Given** uma função sem vínculos, **When** o gestor adiciona um treinamento obrigatório,
   **Then** o vínculo é criado; adicionar o mesmo par novamente é **idempotente** (não duplica).
2. **Given** um funcionário cuja função exige um treinamento que ele **nunca** realizou, **When** a
   conformidade é calculada, **Then** o status é `missing` (Ausente) → **não-conforme**.
3. **Given** um funcionário cujo obrigatório está com validade vencida, **When** a conformidade é
   calculada, **Then** o status é `expired` → **não-conforme**.
4. **Given** um funcionário **sem função** (`job_role_id` nulo), **When** a conformidade é calculada,
   **Then** ele não tem obrigatórios e é **conforme por vacuidade** (não é erro).
5. **Given** uma função **sem** treinamentos obrigatórios, **When** o gestor abre a aba do perfil,
   **Then** a aba aparece vazia (não é erro).
6. **Given** um treinamento obrigatório `single` já realizado uma vez, **When** a conformidade é
   calculada, **Then** o status é sempre `ok` (nunca "a vencer"/"vencido").
7. **Given** o mesmo treinamento obrigatório em várias funções, **When** vinculado, **Then** cada
   vínculo (função, treinamento) é independente e válido.
8. **Given** vínculos ou funcionários de outro escritório, **When** o gestor do escritório A consulta,
   **Then** o sistema não vaza e responde `NOT_FOUND`/404 quando aplicável; escrita por `client` →
   `FORBIDDEN`/403.

---

### Edge Cases

- **Periodicidade `single` (atravessa todo o módulo)**: validade nula; nunca `expired`/`due_soon`; fora
  do controle de vencimento; conta como `ok` na conformidade quando há registro.
- **Data de realização no futuro**: bloqueada como `VALIDATION` (realizado é passado).
- **Reciclagem**: um novo registro do mesmo par funcionário+treinamento substitui o anterior no cálculo
  de status; realizações antigas nunca "contaminam" o status atual (só o último registro conta).
- **Excluir item do catálogo em uso**: bloqueado (RESTRICT) com aviso via `dependents`; nunca gera
  registro/vínculo órfão.
- **Fronteiras de janela**: um treinamento que vence exatamente hoje ainda **não** está vencido
  (comparação inclusiva/date-only); hoje+30 e hoje+90 entram como "a vencer" conforme a janela.
- **Funcionário com múltiplos obrigatórios vencidos ao mesmo tempo**: todos listados como não-conformes.
- **Nome de catálogo duplicado no mesmo escritório**: `DUPLICATE`/409. O mesmo nome pode existir em
  escritórios diferentes.
- **Ausência de contexto de tenant**: nenhuma query retorna dados de outro escritório (RLS backstop);
  papel `client` sem função de escritório é `FORBIDDEN` em toda escrita.

## Requirements _(mandatory)_

### Functional Requirements

**Fundação (modelo + regras)**

- **FR-001**: O sistema MUST persistir três entidades isoladas por escritório: catálogo de treinamentos,
  realizações de treinamento e vínculos de treinamento obrigatório por função.
- **FR-002**: O sistema MUST oferecer exatamente 5 periodicidades: `annual`, `biennial`, `triennial`,
  `quinquennial`, `single` (rótulos em português apenas na interface).
- **FR-003**: O sistema MUST calcular a validade de uma realização como data de realização + 1/2/3/5
  anos conforme a periodicidade, e **sem validade** para `single`, usando uma **única** regra
  centralizada.
- **FR-004**: O sistema MUST persistir a validade calculada junto da realização (não recalcular na
  leitura); mudar a periodicidade do catálogo depois NÃO altera realizações passadas.
- **FR-005**: O sistema MUST classificar o status de um par funcionário+treinamento em
  `missing | expired | due_soon | ok` a partir do **último** registro (ou ausência dele) e de uma
  janela de alerta, usando uma **única** regra centralizada, com comparação por dia no fuso
  `America/Sao_Paulo` e limites inclusivos.
- **FR-006**: O sistema MUST garantir isolamento multi-tenant em todas as três entidades: escrita/leitura
  sempre no escritório da sessão; uma consulta sem contexto de tenant retorna zero linhas (RLS backstop).
- **FR-007**: O sistema MUST auditar toda escrita (criar/atualizar/excluir) com correlação e sem dados
  pessoais sensíveis.

**Catálogo (US1)**

- **FR-010**: Usuários de escritório (papéis `owner`/`collaborator`) MUST poder criar, listar (com
  paginação e busca por nome/norma), detalhar, atualizar e excluir treinamentos do catálogo.
- **FR-011**: O sistema MUST exigir nome e periodicidade e carga horária inteira positiva; norma de
  referência e descrição são opcionais.
- **FR-012**: O sistema MUST recusar nome de treinamento duplicado no mesmo escritório com erro de
  duplicidade.
- **FR-013**: O sistema MUST recusar carga horária não-inteira/≤0 e periodicidade fora do enum com erro
  de validação.
- **FR-014**: O sistema MUST responder "não encontrado" para detalhar/atualizar/excluir itens de outro
  escritório (sem vazamento).
- **FR-015**: O sistema MUST bloquear a exclusão de um item do catálogo que possua realizações ou
  vínculos obrigatórios, informando as dependências.

**Registro de realização (US2)**

- **FR-020**: Usuários de escritório MUST poder registrar uma realização vinculando um funcionário e um
  treinamento do escritório ativo a uma data de realização, com certificado opcional.
- **FR-021**: O sistema MUST calcular e gravar a validade no servidor (nunca confiar em validade vinda
  do cliente); `single` grava sem validade.
- **FR-022**: O sistema MUST recusar data de realização futura com erro de validação.
- **FR-023**: O sistema MUST recusar funcionário ou treinamento de outro escritório, sem gravar nada.
- **FR-024**: Usuários de escritório MUST poder listar o histórico de realizações por funcionário e
  excluir uma realização.

**Controle de vencimento (US3)**

- **FR-030**: O sistema MUST apresentar uma visão só-leitura das realizações por funcionário com status
  visual (Vencido/A vencer/Em dia), considerando apenas o último registro de cada par.
- **FR-031**: O sistema MUST excluir treinamentos `single` (sem validade) do cômputo de vencimentos.
- **FR-032**: O sistema MUST permitir filtrar por funcionário e por janela de alerta (30/60/90 dias) via
  um único parâmetro de janela.
- **FR-033**: O sistema MUST expor uma consulta de resumo com as contagens `{ expired, dueSoon }`
  escopadas ao escritório ativo, para consumo por dashboard.
- **FR-034**: O sistema MUST apresentar estado vazio positivo quando não houver vencidos nem a vencer.

**Obrigatórios por função + conformidade (US4)**

- **FR-040**: Usuários de escritório MUST poder adicionar (idempotente), listar e remover vínculos de
  treinamento obrigatório por função.
- **FR-041**: O sistema MUST calcular a conformidade de um funcionário para cada obrigatório da função
  dele, classificando com a mesma regra de status; sem registro → `missing`.
- **FR-042**: O sistema MUST tratar funcionário sem função como conforme por vacuidade (nenhum
  obrigatório) e função sem obrigatórios como aba vazia (não erro).
- **FR-043**: O sistema MUST considerar não-conforme o funcionário cujo obrigatório está `missing` ou
  `expired`.
- **FR-044**: O sistema MUST oferecer um relatório de não-conformes usando a mesma regra de conformidade
  sem filtro de funcionário.

**Superfície de API (todos os recursos HTTP-expostos)**

- **FR-050**: Para cada recurso HTTP-exposto, o sistema MUST entregar em conjunto: Server Action, Route
  Handler REST espelho reutilizando a mesma regra, registro em `docs/api/api-design.md` e requisições na
  coleção Postman única.
- **FR-051**: Recursos e verbos: `training-catalog` (GET/POST na coleção; GET/PUT/DELETE em `[id]`; GET
  `[id]/dependents`); `training-records` (GET/POST na coleção; GET/DELETE em `[id]`);
  `job-role-required-trainings` (GET/POST na coleção; DELETE em `[id]`). Criação retorna `201`, exclusão
  retorna `204`.
- **FR-052**: O sistema MUST reutilizar os códigos de erro existentes (`VALIDATION`/422, `DUPLICATE`/409,
  `NOT_FOUND`/404, `FK_NOT_FOUND`/422, `FORBIDDEN`/403) — **nenhum código de erro novo** nesta fase.

### Key Entities _(include if feature involves data)_

- **Catálogo de Treinamento** (`training_catalog`): treinamento oferecido pelo escritório. Atributos:
  escritório (tenant), nome (único no escritório), norma de referência (opcional), carga horária
  (inteiro positivo), periodicidade (enum), descrição (opcional). Referenciado por realizações e
  vínculos obrigatórios (exclusão em uso é bloqueada).
- **Realização de Treinamento** (`training_records`): registro de que um funcionário fez um treinamento.
  Atributos: escritório, funcionário, treinamento, data de realização, validade (persistida, nula para
  `single`), caminho do certificado (opcional). Excluída em cascata com o funcionário.
- **Treinamento Obrigatório por Função** (`job_role_required_trainings`): vínculo que declara um
  treinamento obrigatório para uma função. Atributos: escritório, função, treinamento. Único por
  (escritório, função, treinamento); excluído em cascata com a função.
- **Funcionário** / **Função** (existentes): fornecem os vínculos base (`employees`, `job_roles`); não
  são alterados nesta feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O gestor consegue cadastrar, editar, listar/buscar e excluir treinamentos do catálogo com
  os 5 campos ePGR; um item em uso nunca é excluído sem aviso de dependências.
- **SC-002**: Ao registrar uma realização, a validade é preenchida automaticamente conforme a
  periodicidade, sem cálculo manual; treinamentos `single` não expiram em 100% dos casos.
- **SC-003**: O gestor visualiza numa única tela todos os treinamentos vencidos e a vencer por
  funcionário com status visual, e `single` nunca aparece como vencido; a query de resumo retorna as
  contagens corretas para o dashboard.
- **SC-004**: Vincular treinamentos obrigatórios a uma função faz o sistema sinalizar automaticamente os
  funcionários não-conformes (obrigatório ausente ou vencido), e a aba do perfil reflete exatamente os
  vínculos da função.
- **SC-005**: Nenhum dado de treinamento cruza a fronteira entre escritórios em nenhuma operação
  (leitura ou escrita), comprovado por testes de isolamento cross-tenant.
- **SC-006**: A suíte de qualidade passa integralmente: `npm run check` (format + lint + types + unit) e
  `npm run test:integration` (Postgres efêmero) verdes.

## Assumptions

- A leva inteira introduz **exatamente uma** migration nova (`0016`), correspondente à Fundação (3
  tabelas + 1 enum); todas as demais histórias são "zero migration".
- As tabelas base `employees` e `job_roles` já existem (fatia 006) e não serão alteradas.
- Certificado é apenas um caminho de texto (`certificate_path`); **não** há upload, storage ou módulo de
  documentos/GED nesta fase (vira FK numa migration futura quando o módulo existir).
- **Não** há notificação/agendador/cron nesta fase; apenas a query de resumo de vencimento é exposta
  (a central de notificações é da Fase 7).
- **Não** há assinatura digital de treinamento nesta fase.
- Os testes de integração rodam contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite nem o banco
  de desenvolvimento.
- O contexto de escritório (tenant) vem sempre da sessão autenticada, nunca de entrada do cliente; o
  papel `client` não tem acesso de escrita.
- Conteúdo da spec em pt-BR; identificadores de código, nomes de recursos, branch e commits em inglês.
