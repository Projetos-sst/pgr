# Feature Specification: Vínculo EPI × risco com neutralização

**Feature Branch**: `feature/epi-risk-link`

**Created**: 2026-07-08

**Status**: Implemented (as-built — spec retroativa a partir dos briefings + código shipado)

**Input**: User description: "Permitir que o gestor de SST vincule EPIs a cada risco do inventário
do GES e registre, por EPI, se ele neutraliza o risco (Sim/Não/Não Aplicável). Evolui o vínculo
interino `epi_risk` (EPI × GES, `neutralizes` boolean) da fatia 008 para o vínculo definitivo
EPI × risco, construindo toda a camada de fluxo (repo/actions/REST/UI/testes) que ainda não existe."

## Clarifications

### Session 2026-07-08

- Q: O vínculo `epi_risk` deve continuar apontando para `ges` (interino) ou passar a apontar para o risco? → A: Repontar para `risks.id` (`ges_id → risk_id`), realizando a decisão D6 do modelo de riscos/PGR; o card é explicitamente EPI × **risco**. (D1)
- Q: A neutralização deve continuar sendo booleana (Sim/Não) ou virar um enum? → A: `pgEnum epi_neutralization` de 3 estados (`neutralizes` / `does_not_neutralize` / `not_applicable`; rótulos pt-BR Sim / Não / Não Aplicável) — a tabela está vazia, então a troca de tipo é limpa. (D2)
- Q: A exclusão do vínculo é física ou soft delete? → A: Física — espelha `ges_job_roles`; não há Ordem de Serviço (que motivaria histórico) no repo ainda. (D3)
- Q: De onde vêm os EPIs selecionáveis para vincular? → A: `epi_catalog` (itens `type = 'epi'`); o vínculo é normativo (EPI recomendado), independe de haver saldo em estoque; reusa a busca por nome/CA. (D4)
- Q: Onde a seção EPI × risco aparece? → A: Componente irmão após o formulário, na tela de **edição** do risco (precisa de `risk_id` persistido); a tela de **criação** não a exibe (fluxo cria-depois-vincula). (D5)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Isolamento por tenant do vínculo EPI × risco (Priority: P1)

Um escritório de SST (tenant) só pode ver, criar, alterar e remover vínculos EPI × risco que
pertencem ao **seu próprio tenant**. Nenhum vínculo de outro escritório aparece, vaza ou pode ser
manipulado — mesmo que um ator tente referenciar um `risk_id`, um `catalog_id` ou o `id` de um
vínculo de outra organização.

**Why this priority**: É o requisito não-negociável (Princípio I da constituição). Como o vínculo
liga duas entidades por FK (risco e item de catálogo) e as FKs não passam pela RLS, o isolamento
depende de **validar na aplicação** que ambas pertencem ao tenant ativo antes de gravar — sem isso,
um ator poderia costurar dados entre tenants. Nenhuma das demais histórias pode ser entregue sem
essa barreira provada.

**Independent Test**: Com dois tenants semeados (org_a, org_b) e um vínculo em cada, conectado como
`app_runtime` com o tenant ativo em org_a: (1) listar os EPIs de um risco de org_a nunca traz o
vínculo de org_b; (2) tentar vincular um EPI a um risco de org_b (ou usar um EPI de org_b) é
rejeitado; (3) tentar editar/remover o vínculo de org_b pelo seu `id` retorna "não encontrado".

**Acceptance Scenarios**:

1. **Given** vínculos EPI × risco existentes em org_a e org_b, **When** o tenant ativo é org_a e se
   listam os EPIs de um risco, **Then** apenas vínculos de org_a são retornados.
2. **Given** o tenant ativo é org_a, **When** tenta-se criar um vínculo cujo risco ou EPI pertence a
   org_b, **Then** a operação é rejeitada (`FK_NOT_FOUND`) e nada é gravado.
3. **Given** o tenant ativo é org_a, **When** tenta-se editar ou remover um vínculo de org_b pelo seu
   identificador, **Then** o vínculo não é encontrado/alterado (`NOT_FOUND`).

---

### User Story 2 - Vincular EPIs a um risco indicando neutralização (Priority: P1)

O gestor de SST precisa, para um risco do inventário, **vincular um ou mais EPIs** e registrar, por
EPI, **se ele neutraliza o risco** (Sim / Não / Não Aplicável), para alimentar o PGR (adequação de
EPI por exposição). Um risco pode ter **zero ou mais** EPIs vinculados.

**Why this priority**: É o núcleo funcional da fatia — a razão de existir do vínculo. Sem ele, o PGR
não consegue relacionar EPI a exposição. Depende do isolamento (US1) mas entrega valor autônomo.

**Independent Test**: Para um risco, adicionar um EPI com neutralização "Sim"; confirmar que aparece
na lista com Nome/CA/neutralização; tentar adicionar o mesmo EPI de novo e confirmar rejeição por
duplicidade; alterar a neutralização para "Não Aplicável" e removê-lo; confirmar que o risco pode
ficar sem nenhum EPI.

**Acceptance Scenarios**:

1. **Given** um risco e um item de catálogo do tipo EPI no tenant, **When** vincula-se o EPI
   indicando a neutralização, **Then** o vínculo é persistido e listado com Nome · CA · neutralização.
2. **Given** um EPI já vinculado a um risco, **When** tenta-se vincular o mesmo par de novo,
   **Then** a duplicação é rejeitada (`DUPLICATE`).
3. **Given** um vínculo existente, **When** altera-se a neutralização, **Then** o novo valor é
   persistido; **When** remove-se o vínculo, **Then** ele deixa de existir e o risco pode ficar sem EPIs.
4. **Given** o formulário de vínculo, **When** tenta-se vincular sem escolher a neutralização,
   **Then** a operação é rejeitada (neutralização obrigatória).

---

### User Story 3 - Descoberta e gestão do vínculo na tela de edição do risco (Priority: P2)

O gestor precisa **encontrar o EPI a vincular** buscando por nome ou CA (sem rolar um catálogo
inteiro), enxergar **apenas os EPIs ainda não vinculados** àquele risco, e gerenciar os vínculos
diretamente na tela de **edição** do risco (adicionar, trocar neutralização por linha, remover).

**Why this priority**: É a camada de experiência que torna o vínculo utilizável em escala; depende
do núcleo (US2) mas pode ser validada de forma independente (a lista de disponíveis e a busca).

**Independent Test**: Na edição de um risco, buscar "luva" e confirmar que só EPIs com "luva" no
nome/CA e ainda não vinculados aparecem; adicionar um; confirmar que ele some da lista de
disponíveis e aparece na de vinculados.

**Acceptance Scenarios**:

1. **Given** um risco com alguns EPIs já vinculados, **When** abre-se a lista de EPIs disponíveis,
   **Then** os já vinculados não aparecem (apenas os disponíveis do tenant).
2. **Given** a busca de EPI disponível, **When** digita-se um termo, **Then** filtra por nome **ou**
   CA do item.
3. **Given** a tela de **criação** de risco (sem id persistido), **When** ela é exibida, **Then** a
   seção de vínculo **não** aparece — o vínculo só é possível após salvar (fluxo cria-depois-vincula).

---

### Edge Cases

- Risco **sem nenhum EPI** vinculado → válido (lista vazia, nenhuma linha). Distinto de um EPI
  vinculado com neutralização **"Não Aplicável"** (uma linha existe, com valor N.A.).
- **Par duplicado** (mesmo EPI no mesmo risco) → `DUPLICATE`, não um segundo insert.
- EPI **sem CA** (`ca` nullable) → a lista exibe CA vazio/"—".
- Excluir o **risco** → seus vínculos são removidos junto (`ON DELETE CASCADE` em `risk_id`).
- Excluir o **item de catálogo** já vinculado → o vínculo é removido junto (`ON DELETE CASCADE` em
  `catalog_id`, comportamento herdado da 008).
- Concorrência: dois gestores adicionando o mesmo par ao mesmo tempo → a constraint de unicidade
  resolve (o segundo vira `DUPLICATE`).
- Risco ou EPI de **outra organização** referenciado por id na criação → `FK_NOT_FOUND` (a validação
  de pertencimento ao tenant é a barreira, não a FK).
- Papel `client` tentando qualquer escrita → `FORBIDDEN`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir **vincular um item de catálogo do tipo EPI a um risco**,
  registrando a **neutralização**; a indicação de neutralização é **obrigatória** ao vincular.
- **FR-002**: O sistema MUST **repontar** o vínculo `epi_risk` de `ges_id` (interino, fatia 008) para
  **`risk_id → risks.id`** (`ON DELETE CASCADE`), realizando a evolução já planejada do modelo.
- **FR-003**: A neutralização MUST ser um **conjunto fechado de 3 estados** — neutraliza / não
  neutraliza / não aplicável (rótulos pt-BR Sim / Não / Não Aplicável) — e **não** mais um booleano.
- **FR-004**: O sistema MUST **listar** os EPIs vinculados a um risco com **nome do EPI, CA e
  neutralização**.
- **FR-005**: O sistema MUST permitir **alterar a neutralização** de um vínculo existente e **remover**
  um vínculo (exclusão **física**).
- **FR-006**: O sistema MUST oferecer a lista de **EPIs disponíveis** para vincular = itens do catálogo
  do tenant com `type = 'epi'` **menos** os já vinculados àquele risco, com **busca por nome ou CA**.
- **FR-007**: O sistema MUST **impedir o mesmo par** `(org, catalog_id, risk_id)` duplicado no tenant
  (unicidade no banco → `DUPLICATE`).
- **FR-008**: Um risco MUST poder ter **zero ou mais** EPIs vinculados; zero vínculos é um estado
  válido (não é o mesmo que "Não Aplicável").
- **FR-009**: Ao criar um vínculo, o sistema MUST **validar que o risco e o EPI pertencem ao tenant
  ativo** antes do insert; referência cruzada a outra organização → `FK_NOT_FOUND`.
- **FR-010**: Toda leitura/escrita do vínculo MUST ser **escopada pelo tenant ativo da sessão**
  (nunca por input do cliente), com RLS como backstop; vínculos de outro tenant nunca são acessíveis.
- **FR-011**: A gestão do vínculo MUST ser exposta na tela de **edição** do risco (que já tem
  `risk_id` persistido); a tela de **criação** não a exibe.
- **FR-012**: A funcionalidade MUST ser exposta pela **superfície de API completa** (regra das 4
  partes do repo): Server Actions + REST mirror + docs (`api-design.md`) + coleção Postman.
- **FR-013**: O banco MUST ser a fonte de verdade das regras (FK, NOT NULL, UNIQUE, enum),
  complementado — não substituído — por validação Zod na aplicação.

### Key Entities

- **Vínculo EPI × risco (`epi_risk`, evoluída da 008)**: associação entre um item de catálogo (EPI) e
  um risco, com a indicação de neutralização (enum 3 estados). Único por par `(org, catalog_id,
  risk_id)`. Antes ligava-se ao `ges` com `neutralizes` boolean — esta fatia troca `ges_id → risk_id`
  e `neutralizes boolean → neutralization enum`.
- **Risco (`risks`, referenciada)**: linha do inventário de riscos do GES; alvo do vínculo. Não é
  criada nesta fatia. Excluir o risco remove os vínculos em cadeia.
- **Item de catálogo (`epi_catalog`, referenciada)**: origem do EPI vinculável (itens `type = 'epi'`);
  fornece nome e CA. Não é criado nesta fatia. Excluir o item remove os vínculos em cadeia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cada risco pode ter **zero ou mais** EPIs vinculados, com **neutralização obrigatória**
  ao vincular; 100% das tentativas de vincular sem neutralização são rejeitadas.
- **SC-002**: O par (EPI, risco) é **único por organização**; 100% das tentativas de duplicar o par
  são rejeitadas.
- **SC-003**: Vínculos de outra organização **nunca** são acessíveis (leitura, edição ou remoção),
  comprovado com dois tenants em teste de integração.
- **SC-004**: A neutralização é sempre um dos **3 estados** (Sim / Não / Não Aplicável); nenhum valor
  fora do conjunto é aceito.
- **SC-005**: A lista de EPIs disponíveis para vincular traz **apenas** itens `epi` do tenant **ainda
  não vinculados** àquele risco, filtráveis por **nome ou CA**.
- **SC-006**: O PGR consegue **consultar os EPIs por risco** (a query de leitura existe e é testada),
  deixando o downstream (ex.: Ordem de Serviço) pronto para reuso.
- **SC-007**: As suítes automatizadas (unit + integração de isolamento/CRUD em Postgres efêmero) e as
  verificações de lint e tipos passam.

## Assumptions

- **Tenant = escritório de SST (`orgs.id`)**, resolvido sempre da sessão; a empresa-cliente é
  dimensão de dados dentro do tenant, não fronteira de isolamento (Constituição, Princípio I).
- A tabela `epi_risk` **está vazia e sem consumidores** ao início desta fatia (nenhum repo/action/UI
  a consumia) → a migration de evolução é de **baixo risco** (sem dados a migrar, sem código a
  quebrar). Se algum ambiente tiver linhas, decidir estratégia antes de dropar `ges_id`.
- A tabela **`risks`** já existe (fatia de riscos/PGR) e é o alvo definitivo do vínculo.
- A exclusão do vínculo é **física**; soft delete só seria revisitado se/quando a **Ordem de Serviço
  (OS)** — que hoje **não existe** no repo — passar a referenciar vínculos historicamente.
- O vínculo é **normativo** (indica EPI recomendado para o risco) e **independe** de haver saldo em
  estoque — por isso a origem é o **catálogo**, não o estoque.
- A correlação `epi_catalog.ca ↔ caepi_certificates` é **por string, sem FK**; a validação de CA
  vigente é da fatia CAEPI, **fora** desta.
- **Fora de escopo**: Ordem de Serviço (consumidor futuro do vínculo), unificação com
  `control_measures` (nível `ppe` da NR-01 é conceito distinto), tela de criação de risco exibindo a
  seção, e qualquer integração externa.
