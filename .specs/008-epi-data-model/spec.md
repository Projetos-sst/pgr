# Feature Specification: Modelo de dados do módulo de EPIs

**Feature Branch**: `feature/epi-data-model`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Modelo de dados do módulo de EPIs — fundação da Fase 2 (paridade com o ePGR). Fatia de modelagem de dados pura (schema + migration + RLS + testes de isolamento), análoga à 006. Entrega as tabelas-base do módulo de EPIs e de Máquinas/Equipamentos, isoladas por tenant. Reusa `categories` (006) como taxonomia e vincula `epi_risk` ao `ges` de forma interina (não há tabela `risks`)."

## Clarifications

### Session 2026-06-22

- Q: O banco deve impedir associar um item a uma categoria de tipo diferente (item `epi` em categoria `machine`)? → A: Sim — o banco garante que o tipo do item de catálogo é igual ao tipo da sua categoria.
- Q: A unidade de medida do catálogo deve ser texto livre ou um conjunto fechado? → A: Texto livre, campo opcional (sem lista fixa; validação fica para a aplicação, se necessário).
- Q: O token de assinatura preenchido deve ser único globalmente ou só dentro do tenant? → A: Globalmente — único em todo o sistema (resolve um link público de assinatura sem contexto de tenant).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Isolamento por tenant em todo o domínio de EPIs (Priority: P1)

Um escritório de SST (tenant) só pode ver e modificar os itens de EPI/Máquina, estoque,
movimentos, entregas, itens de entrega e vínculos de risco que pertencem ao **seu próprio
tenant**. Nenhum dado de um escritório aparece, vaza ou pode ser alterado a partir de outro
escritório — mesmo que um ator tente referenciar identificadores de outra organização.

**Why this priority**: É o requisito não-negociável (Princípio I da constituição). Vazamento
de dados entre escritórios é a falha crítica de um SaaS B2B de SST. Sem isolamento provado,
nenhuma das demais histórias pode ser entregue com segurança.

**Independent Test**: Com dois tenants semeados (org_a, org_b), conectando como o papel de
runtime com o tenant ativo em org_a: (1) leituras sem filtro explícito retornam apenas dados
de org_a; (2) tentativas de inserir/alterar/excluir linhas com o tenant de org_b são
rejeitadas; (3) referências cruzadas a identificadores de org_b não tornam dados de org_b
visíveis. Cobre as 6 tabelas novas.

**Acceptance Scenarios**:

1. **Given** itens de catálogo, estoque, movimentos, entregas, itens de entrega e riscos
   existentes em org_a e org_b, **When** o tenant ativo é org_a e se faz uma leitura sem
   filtro de tenant explícito, **Then** apenas as linhas de org_a são retornadas.
2. **Given** o tenant ativo é org_a, **When** tenta-se gravar uma linha marcada como
   pertencente a org_b, **Then** a escrita é rejeitada.
3. **Given** o tenant ativo é org_a, **When** tenta-se ler/alterar uma linha de org_b pelo seu
   identificador, **Then** a linha não é encontrada/alterada.

---

### User Story 2 - Catálogo de EPIs/Máquinas com todos os campos do ePGR (Priority: P1)

O consultor de SST precisa de um lugar para persistir um item de catálogo (EPI ou
Máquina/Equipamento) com todos os atributos exigidos pelo ePGR — tipo, categoria, CA, validade
do CA, fabricante, norma, tamanho, unidade de medida, descrição e foto — para que os cards de
CRUD da Fase 2 (#18) tenham onde gravar e ler os dados.

**Why this priority**: O catálogo é a raiz da cadeia de EPIs; estoque, movimentos, itens de
entrega e riscos todos dependem dele. Sem ele, nenhum fluxo da Fase 2 existe.

**Independent Test**: Criar um item de catálogo com todos os campos do ePGR preenchidos e
confirmar que persiste e é recuperado fielmente; criar um item do tipo "máquina" sem CA/norma/
validade e confirmar que é aceito (campos condicionais opcionais no banco).

**Acceptance Scenarios**:

1. **Given** uma categoria existente do tipo EPI, **When** cria-se um item de catálogo do tipo
   EPI com CA, validade do CA, fabricante, norma, tamanho, unidade de medida, descrição e foto,
   **Then** o item é persistido com todos os campos.
2. **Given** uma categoria do tipo máquina, **When** cria-se um item do tipo máquina sem CA,
   validade nem norma, **Then** o item é aceito (campos condicionais ficam vazios).
3. **Given** uma categoria em uso por um item, **When** tenta-se excluir essa categoria,
   **Then** a exclusão é bloqueada (a categoria não pode sumir enquanto houver item dependente).

---

### User Story 3 - Estoque, movimentos tipados e entregas com assinatura (Priority: P2)

O consultor precisa registrar o estoque de cada item (saldo atual e quantidade mínima),
movimentos tipados (compra, entrega ao funcionário, ajuste, descarte) e entregas de EPI a
funcionários com status de assinatura (pendente, assinado por QR, por link ou manual), para
suportar os fluxos de movimentação (#72) e de entrega (#19) na Fase 2.

**Why this priority**: É a camada de operação do módulo, mas depende do catálogo (P1). Pode ser
modelada e testada de forma independente assim que o catálogo existir.

**Independent Test**: Criar estoque para um item, lançar movimentos de cada tipo com quantidade
positiva, criar uma entrega para um funcionário e seus itens; confirmar que quantidade ≤ 0 é
rejeitada e que saldo/mínimo não podem ficar negativos.

**Acceptance Scenarios**:

1. **Given** um item de catálogo, **When** cria-se o estoque dele, **Then** existe no máximo um
   registro de estoque por item dentro do tenant.
2. **Given** um estoque, **When** lança-se um movimento com quantidade zero ou negativa,
   **Then** o lançamento é rejeitado.
3. **Given** uma entrega com itens, **When** atribui-se um status de assinatura,
   **Then** apenas os status válidos (pendente, QR, link, manual) são aceitos.
4. **Given** uma entrega que gerou um movimento de estoque, **When** a entrega é excluída,
   **Then** o movimento é preservado (sem vínculo com a entrega).

---

### User Story 4 - Vínculo EPI × risco do GES (Priority: P3)

O consultor quer vincular um item de EPI a um GES (grupo de exposição similar), indicando se o
EPI neutraliza os riscos daquele grupo, para preparar o relatório de adequação na Fase 2.

**Why this priority**: É um enriquecimento para relatórios; não bloqueia catálogo, estoque nem
entregas. Modelado de forma interina enquanto não existe um modelo de risco dedicado.

**Independent Test**: Vincular um item a um GES com a flag de neutralização e confirmar que o
mesmo par item×GES não pode ser duplicado dentro do tenant.

**Acceptance Scenarios**:

1. **Given** um item de catálogo e um GES, **When** cria-se o vínculo de risco indicando
   neutralização, **Then** o vínculo é persistido.
2. **Given** um vínculo item×GES existente, **When** tenta-se criar o mesmo vínculo de novo,
   **Then** a duplicação é rejeitada.

---

### Edge Cases

- Excluir uma **categoria em uso** por um item do catálogo → bloqueado (preserva a taxonomia
  em uso).
- Excluir um **item do catálogo que já tem entregas registradas** → bloqueado (o histórico de
  entrega não pode ser perdido silenciosamente).
- Excluir um **item do catálogo sem entregas** → o estoque e os movimentos dele são removidos
  junto (cadeia de posse).
- Excluir uma **entrega que originou um movimento** → o movimento permanece, sem o vínculo com
  a entrega.
- Excluir um **funcionário** → suas entregas são removidas junto.
- **Duas entregas sem token de assinatura** ao mesmo tempo → coexistem; um token preenchido
  nunca se repete.
- Item do tipo **"máquina"** sem CA/validade/norma → aceito (campos condicionais opcionais no
  banco; a obrigatoriedade por tipo é decidida na camada de aplicação, na Fase 2).
- Tentar gravar um **valor fora do conjunto** dos estados de movimento ou de assinatura →
  rejeitado.
- Tentar gravar **quantidade ≤ 0** em movimento ou item de entrega → rejeitado.
- Tentar associar um item de catálogo a uma **categoria de tipo diferente** (ex.: item `epi`
  numa categoria `machine`) → rejeitado pelo banco.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST persistir um **catálogo** de itens (EPI e Máquina/Equipamento) com
  os campos do ePGR: tipo (EPI/máquina), categoria, nome, CA, validade do CA, fabricante,
  norma, tamanho, unidade de medida, descrição e referência de foto. A **unidade de medida** é
  **texto livre opcional** (sem lista fixa nesta fatia).
- **FR-002**: O sistema MUST reusar a taxonomia **`categories`** (da fatia 006) como categoria
  do catálogo — sem criar uma tabela de categorias dedicada de EPIs.
- **FR-002a**: O banco MUST **impedir** que um item de catálogo seja associado a uma categoria
  de **tipo diferente** — o `type` (EPI/máquina) do item MUST ser igual ao `type` da sua
  categoria. A garantia é do banco (fonte de verdade), não apenas da aplicação.
- **FR-003**: O sistema MUST permitir que os campos condicionais (CA, validade do CA, norma,
  tamanho) fiquem **vazios** para itens cujo tipo não os exige (ex.: máquinas).
- **FR-004**: O sistema MUST manter, por item de catálogo, no máximo **um registro de estoque**
  por tenant, com **saldo atual** e **quantidade mínima**, ambos nunca negativos.
- **FR-005**: O sistema MUST registrar **movimentos de estoque tipados** com os estados
  compra, entrega ao funcionário, ajuste e descarte; cada movimento MUST ter quantidade
  **positiva** e uma data; o número da nota fiscal é opcional.
- **FR-006**: O sistema MUST armazenar a quantidade do movimento sempre como valor positivo; o
  **sentido** (entrada/saída) é derivado do tipo, não armazenado.
- **FR-007**: O sistema MUST registrar **entregas de EPI a funcionários** com data e um
  **status de assinatura** dentre: pendente, assinado por QR, assinado por link, assinado
  manualmente; o padrão é pendente.
- **FR-008**: O sistema MUST permitir um **token de assinatura** opcional por entrega; quando
  preenchido, o token MUST ser **único globalmente** (em todo o sistema, não apenas dentro do
  tenant), pois resolve um link público de assinatura sem contexto de tenant; várias entregas
  sem token MUST poder coexistir.
- **FR-009**: O sistema MUST registrar os **itens de cada entrega** referenciando o item de
  catálogo, com quantidade **positiva**.
- **FR-010**: O sistema MUST permitir vincular um item de catálogo a um **GES** (vínculo de
  risco interino) com a indicação de **se neutraliza** os riscos, sem permitir o **mesmo par
  item×GES duplicado** dentro do tenant.
- **FR-011**: O sistema MUST **bloquear a exclusão** de uma categoria enquanto houver item de
  catálogo que a use.
- **FR-012**: O sistema MUST **bloquear a exclusão** de um item de catálogo enquanto houver
  itens de entrega que o referenciem (preservar o histórico de entregas).
- **FR-013**: O sistema MUST **remover em cadeia** o estoque e os movimentos quando o item de
  catálogo é excluído (e não há histórico de entrega que o impeça).
- **FR-014**: O sistema MUST **remover em cadeia** os itens de uma entrega quando a entrega é
  excluída, e as entregas de um funcionário quando o funcionário é excluído.
- **FR-015**: O sistema MUST **preservar o movimento de estoque** quando a entrega que o
  originou é excluída (o vínculo do movimento com a entrega fica vazio).
- **FR-016**: Toda tabela do domínio de EPIs MUST ser **escopada pelo tenant ativo**: leituras
  só enxergam o tenant ativo e escritas para outro tenant são rejeitadas, com o tenant vindo
  **sempre da sessão**, nunca de input do cliente.
- **FR-017**: O banco MUST ser a fonte de verdade das regras de dados acima por meio de
  constraints (chaves, obrigatoriedade, unicidade, verificações de quantidade/saldo e conjuntos
  de estados), complementadas — não substituídas — por validação na aplicação.

### Key Entities

- **Item de catálogo (`epi_catalog`)**: um EPI ou Máquina/Equipamento. Atributos: tipo
  (EPI/máquina), categoria (→ `categories`, **com o mesmo tipo do item** — ver FR-002a), nome,
  CA, validade do CA, fabricante, norma, tamanho, unidade de medida, descrição, foto. Raiz da
  cadeia de EPIs.
- **Estoque (`epi_stock`)**: o saldo de um item de catálogo no tenant. Atributos: saldo atual,
  quantidade mínima. Um por item por tenant.
- **Movimento de estoque (`stock_movements`)**: uma entrada/saída tipada sobre um estoque.
  Atributos: tipo (compra/entrega/ajuste/descarte), quantidade positiva, data, nota fiscal
  (opcional), vínculo opcional com a entrega de origem.
- **Entrega (`epi_deliveries`)**: a entrega de EPIs a um funcionário. Atributos: funcionário,
  data, status de assinatura, token de assinatura (opcional, único quando presente).
- **Item de entrega (`epi_delivery_items`)**: cada item incluído numa entrega. Atributos:
  entrega, item de catálogo, quantidade positiva.
- **Vínculo de risco (`epi_risk`)**: associação interina entre um item de catálogo e um GES.
  Atributos: item, GES, indicador de neutralização. Único por par item×GES no tenant.
- **Categoria (`categories`, reusada)**: taxonomia EPI/máquina existente da fatia 006; não é
  criada nesta fatia, apenas referenciada.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As **6 tabelas** do domínio de EPIs (catálogo, estoque, movimentos, entregas,
  itens de entrega, vínculo de risco) existem após a migration, e **nenhuma** tabela de
  categorias de EPI dedicada é criada (a taxonomia é reusada).
- **SC-002**: Em **100% das 6 tabelas**, nenhum dado de um escritório aparece em leitura para
  outro escritório, e **toda** escrita cross-tenant é rejeitada (verificado com dois tenants).
- **SC-003**: O catálogo armazena e recupera fielmente **todos os campos do ePGR** listados,
  incluindo itens "máquina" com campos condicionais vazios.
- **SC-004**: **100% das tentativas** de gravar quantidade ≤ 0 (em movimentos e itens de
  entrega) e de deixar saldo ou quantidade mínima negativos são rejeitadas.
- **SC-005**: Um token de assinatura preenchido **nunca** se repete **em todo o sistema**;
  **múltiplas** entregas sem token coexistem sem conflito.
- **SC-006**: As regras de exclusão se comportam conforme especificado em **100%** dos casos:
  categoria/item em uso bloqueiam, cadeia de posse remove junto, movimento sobrevive à exclusão
  da entrega.
- **SC-007**: As suítes de teste automatizado (unitárias e de integração, incluindo o conjunto
  de isolamento multi-tenant em Postgres efêmero) passam, e as verificações de lint e de tipos
  passam.

## Assumptions

- **Tenant = escritório de SST (`orgs.id`)**, resolvido sempre da sessão; a empresa-cliente é
  dimensão de dados dentro do tenant, não fronteira de isolamento (Constituição, Princípio I).
- **Reuso de `categories`** (006) como taxonomia EPI/máquina é a decisão adotada — não há
  necessidade de separar taxonomias de EPI das de outros módulos nesta fatia.
- **`epi_risk` vincula-se ao `ges`** de forma **interina** porque ainda não existe tabela de
  risco dedicada (`risks`) nem associação GES↔risco; quando esse modelo existir, o vínculo
  migra. Registrado como dívida técnica.
- O **saldo** do estoque é um valor mantido (materializado); sua atualização a partir dos
  movimentos é responsabilidade da **Fase 2** — esta fatia não inclui automação de saldo.
- A **geração** do token de assinatura e o fluxo de QR/link são da **Fase 2**; aqui só existe o
  campo e a regra de unicidade.
- **Upload de foto** é futuro; o catálogo guarda apenas a **referência** (caminho) da foto.
- A obrigatoriedade condicional de campos por tipo (EPI vs máquina) é validada na **camada de
  aplicação** na Fase 2; no banco esses campos são opcionais.
- Esta é uma fatia de **modelagem de dados** (paralela à 006); **fora de escopo**: UI,
  formulários, Server Actions, repositórios de CRUD, fluxo de assinatura, manutenção de saldo,
  relatórios/histórico, tabela `risks` dedicada e integrações externas (lookup de CA).
