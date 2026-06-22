# Feature Specification: CRUDs dos cadastros base do PGR

**Feature Branch**: `feature/pgr-base-cruds`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "CRUDs dos cadastros base do PGR — Empresa, Unidade de Obra, GES (com gestão de funções vinculadas), Função (Cargo) e Funcionário. Fatia única que entrega a UI + Server Actions de CRUD COMPLETO sobre o modelo de dados criado na fatia 006."

> **Continuação da 006.** A fatia 006 (`.specs/006-cadastros-base-pgr/`, migration `0005`)
> criou o **modelo de dados** de toda a cadeia (`companies`, `work_units`, `ges`,
> `ges_job_roles`, `job_roles`, `employees`, `categories`) com seus repositórios base
> (`list`/`create`), helpers de derivação e testes. A **007** entrega o **CRUD completo**
> (criar, listar, detalhar, editar, excluir) de cada entidade, em UI + Server Actions.
>
> **Anexos (fonte da verdade):** `docs/briefings/007-01-empresa.md`,
> `007-02-unidade-obra.md`, `007-03-ges.md`, `007-04-funcoes.md`, `007-05-funcionarios.md`.
> Cada briefing detalha, por entidade, o modelo real da 006, o escopo, as lacunas de
> repositório, as regras, os edge cases e os critérios de aceite.
>
> **Decisão de escopo:** os 5 cards (#69, #71, #12, #13, #14) são consolidados em **uma**
> fatia (1 spec, 1 branch). As entidades têm dependência de cadeia
> (Empresa → Unidade de Obra → GES/Função → Funcionário); a ordem das histórias reflete a
> cadeia. **Não** fragmentar em 5 specs.

## Clarifications

### Session 2026-06-20

- Q: Comportamento da exclusão quando há dependentes (empresa com obras/GES/funcionários; obra com GES; função vinculada) → A: Confirmar + cascata com aviso, seguindo a integridade da 006 (cascata na cadeia da empresa; `SET NULL` de funcionário→GES/função). Não há bloqueio duro.
- Q: Quem, dentro do escritório ativo, pode executar estes CRUDs → A: A equipe do escritório (papéis `owner` e `collaborator`) pode operar; o papel `client` (membro vinculado a uma empresa específica via `scoped_company_id`) **não** tem acesso a estes CRUDs.
- Q: Tratamento de listas potencialmente longas → A: Paginação server-side em **todas** as listagens (Empresa, Unidade de Obra, Função, GES, Funcionário), combinada com os filtros/busca.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - CRUD de Empresa-cliente (Priority: P1)

Como gestor de SST do escritório, quero criar, listar, detalhar, editar e excluir as
empresas-cliente do meu escritório — com os dados legais do cabeçalho do PGR (CNPJ, razão
social, nome fantasia, contato, CNAE + atividade principal, Grau de Risco NR-04, endereço e
logo) — para manter a raiz da cadeia de dados do PGR.

**Why this priority**: A Empresa é a entidade-raiz; todas as demais (`work_units`, `ges`,
`job_roles`, `employees`) dependem dela. Sem ela, nenhum outro cadastro existe. É a MVP da fatia.

**Independent Test**: Criar uma empresa com razão social e Grau de Risco válidos, vê-la na
lista do escritório, abrir o detalhe, editar um campo, e excluí-la com confirmação — tudo
escopado ao escritório ativo.

**Acceptance Scenarios**:

1. **Given** um gestor autenticado num escritório, **When** cadastra uma empresa com razão
   social e Grau de Risco (1–4) válidos, **Then** a empresa é persistida com **todos** os
   campos informados (endereço, CNAE, Grau de Risco etc.) e passa a aparecer na listagem do
   escritório.
2. **Given** uma empresa com CNPJ "X" já cadastrada no escritório, **When** o gestor tenta
   criar outra com o mesmo CNPJ "X" no mesmo escritório, **Then** a operação é rejeitada com
   mensagem clara (unicidade por escritório).
3. **Given** dois escritórios distintos, **When** cada um cadastra uma empresa com o mesmo
   CNPJ "X", **Then** ambas são aceitas (CNPJ não é único global).
4. **Given** um formulário de empresa, **When** o Grau de Risco informado está fora de 1..4 (ou
   ausente), **Then** a operação é rejeitada e nada é salvo.
5. **Given** um CNPJ informado com formato inválido (≠ 14 dígitos), **When** o gestor salva,
   **Then** a operação é rejeitada; **And** CNPJ vazio é aceito (campo opcional).
6. **Given** uma empresa com obras/GES/funcionários vinculados, **When** o gestor solicita
   exclusão, **Then** o sistema pede confirmação e avisa explicitamente do impacto em cascata
   antes de excluir.
7. **Given** uma empresa pertencente a outro escritório, **When** o gestor tenta detalhá-la,
   editá-la ou excluí-la, **Then** o resultado é "não encontrada" (404) e ela nunca aparece na
   sua listagem.

---

### User Story 2 - CRUD de Unidade de Obra (Priority: P1)

Como gestor de SST, quero CRUD completo de Unidade de Obra (canteiro/filial/local) por empresa,
com endereço próprio e a opção de copiar o endereço da empresa, para representar o 2º nível da
cadeia (`companies → work_units → ges`).

**Why this priority**: A Unidade de Obra é pré-requisito do GES (todo GES exige
`work_unit_id`). Sem obra, não há caracterização ambiental.

**Independent Test**: Com uma empresa existente, criar uma unidade de obra (nome, objeto,
empresa), listá-la, editá-la, usar "preencher com endereço da empresa", e excluí-la com
confirmação.

**Acceptance Scenarios**:

1. **Given** uma empresa do escritório, **When** o gestor cria uma unidade de obra com nome,
   objeto/descrição e empresa, **Then** a unidade é persistida sob aquela empresa.
2. **Given** os campos obrigatórios ausentes (nome, objeto/descrição ou empresa), **When** o
   gestor salva, **Then** a operação é rejeitada com validação inline.
3. **Given** uma empresa **com** endereço cadastrado, **When** o gestor aciona "preencher com
   endereço da empresa", **Then** os campos de endereço da unidade são preenchidos com os da
   empresa.
4. **Given** uma empresa **sem** endereço, **When** o gestor abre o formulário de unidade,
   **Then** a ação "preencher com endereço da empresa" fica desabilitada (não copia vazio).
5. **Given** uma unidade de obra **com** GES vinculados, **When** o gestor solicita exclusão,
   **Then** o sistema avisa explicitamente que excluir a obra removerá os GES vinculados
   (cascata) antes de confirmar.
6. **Given** o seletor de empresa, **When** o gestor escolhe a empresa da unidade, **Then** só
   aparecem empresas do escritório ativo (empresa de outro escritório nunca é selecionável).
7. **Given** uma unidade de obra de outro escritório, **When** o gestor tenta detalhá-la/editá-la/excluí-la, **Then** retorna 404.

---

### User Story 3 - CRUD de Função (Cargo) (Priority: P1)

Como gestor de SST, quero CRUD completo de Função/Cargo (com CBO) por empresa, para usar a
função tanto na associação Função↔GES (que dimensiona a exposição) quanto na lotação do
funcionário.

**Why this priority**: A Função é insumo de duas relações centrais (`ges_job_roles` e
`employees.job_role_id`). É necessária antes de dimensionar exposição no GES.

**Independent Test**: Com uma empresa existente, criar uma função (título + empresa), listá-la
com busca por título/CBO, editá-la, e excluí-la observando o aviso de impacto quando vinculada.

**Acceptance Scenarios**:

1. **Given** uma empresa do escritório, **When** o gestor cria uma função com título, **Then**
   a função é persistida sob aquela empresa (CBO é texto livre e opcional).
2. **Given** uma função com título "T" já existente numa empresa, **When** o gestor cria outra
   função com título "T" na **mesma** empresa, **Then** a operação é rejeitada (unicidade por
   empresa do escritório).
3. **Given** duas empresas distintas do escritório, **When** cada uma recebe uma função com o
   mesmo título "T", **Then** ambas são aceitas.
4. **Given** uma função vinculada a GES e/ou a funcionários, **When** o gestor solicita
   exclusão, **Then** o sistema avisa do impacto (o vínculo com o GES é removido e o nº de
   expostos cai; funcionários ficam sem função) antes de confirmar.
5. **Given** uma função de outro escritório, **When** o gestor tenta editá-la/excluí-la,
   **Then** retorna 404.

---

### User Story 4 - CRUD de GES + gestão das funções vinculadas (Priority: P1)

Como gestor de SST, quero CRUD completo de GES (Grupo de Exposição Similar) com a caracterização
do ambiente e gerenciar as funções vinculadas (adicionar/editar/remover, cada uma com seu
`worker_count`), com o **nº de trabalhadores expostos derivado** pela soma das funções, para
montar o núcleo da caracterização ambiental do PGR.

**Why this priority**: O GES é o núcleo do PGR e a origem do nº de expostos (derivado). Depende
de Empresa, Unidade de Obra e Função já existirem.

**Independent Test**: Com empresa + unidade de obra + função existentes, criar um GES (nome +
empresa + obra), adicionar uma função com `worker_count`, ver o nº de expostos refletir a soma,
editar/remover o vínculo, e excluir o GES com confirmação.

**Acceptance Scenarios**:

1. **Given** uma empresa com pelo menos uma unidade de obra, **When** o gestor cria um GES com
   nome, empresa e obra (a obra é filtrada pela empresa selecionada), **Then** o GES é
   persistido com os campos de ambiente informados.
2. **Given** uma empresa **sem** unidades de obra, **When** o gestor tenta criar um GES, **Then**
   a seleção de obra fica vazia e a criação é bloqueada até existir uma obra.
3. **Given** um GES sem funções vinculadas, **When** o gestor consulta o nº de expostos, **Then**
   o valor é **0** (nem nulo nem erro).
4. **Given** um GES, **When** o gestor adiciona uma função com `worker_count > 0`, **Then** o
   vínculo é criado e o nº de expostos passa a refletir a nova soma imediatamente.
5. **Given** o painel de funções do GES, **When** o gestor escolhe uma função para adicionar,
   **Then** o seletor mostra apenas funções do escritório **ainda não vinculadas** àquele GES.
6. **Given** um vínculo com `worker_count` inválido (≤ 0), **When** o gestor salva, **Then** a
   operação é rejeitada.
7. **Given** uma função já vinculada a um GES, **When** o gestor tenta vinculá-la novamente ao
   **mesmo** GES, **Then** a operação é rejeitada (vínculo único por GES+função).
8. **Given** um vínculo existente, **When** o gestor edita seu `worker_count`/jornada ou o
   remove, **Then** o nº de expostos é recalculado e reflete a soma atual.
9. **Given** um GES com vínculos e/ou funcionários, **When** o gestor exclui o GES, **Then** o
   sistema confirma e avisa que os vínculos serão removidos (cascata) e que os funcionários
   daquele GES serão **desvinculados** (preservados, com GES nulo).
10. **Given** o card "Total de Trabalhadores" da listagem, **When** filtros são aplicados,
    **Then** a soma respeita o escopo do escritório ativo e **nunca** cruza escritórios.

---

### User Story 5 - CRUD de Funcionário (Priority: P1)

Como gestor de SST, quero CRUD completo de Funcionário (lista filtrável, ficha de detalhe,
criar/editar, excluir) com os dados do PGR, vinculado a Empresa (obrigatório) e, opcionalmente, a
um GES e a uma Função desse GES, para registrar as pessoas — folha da cadeia de cadastros.

**Why this priority**: É a folha da cadeia e a entidade base referenciada pelas fases seguintes
(EPIs, treinamentos, acidentes). Depende de Empresa (e, quando informado, GES/Função).

**Independent Test**: Com uma empresa existente, criar um funcionário (nome + CPF + empresa),
listá-lo com filtro por empresa/status e busca, abrir a ficha de detalhe, editar, e excluir com
confirmação.

**Acceptance Scenarios**:

1. **Given** uma empresa do escritório, **When** o gestor cria um funcionário com nome completo,
   CPF válido e empresa, **Then** o funcionário é persistido com status `active` por padrão.
2. **Given** um CPF "C" já cadastrado no escritório, **When** o gestor cria outro funcionário
   com o mesmo CPF "C" no **mesmo** escritório, **Then** a operação é rejeitada.
3. **Given** dois escritórios distintos, **When** cada um cadastra um funcionário com o mesmo
   CPF "C", **Then** ambos são aceitos.
4. **Given** um CPF com formato inválido (≠ 11 dígitos), **When** o gestor salva, **Then** a
   operação é rejeitada.
5. **Given** um funcionário com um GES selecionado, **When** o gestor abre o seletor de Função,
   **Then** aparecem **apenas** as funções vinculadas àquele GES (não todas as funções da
   empresa).
6. **Given** um GES **sem** funções vinculadas, **When** o gestor seleciona esse GES, **Then** o
   seletor de Função fica vazio e o funcionário pode ser salvo sem função.
7. **Given** um funcionário sem GES e sem função, **When** o gestor salva, **Then** a operação é
   aceita (ambos os vínculos são opcionais).
8. **Given** um valor de sexo/estado civil/status fora do conjunto permitido, **When** o gestor
   salva, **Then** a operação é rejeitada.
9. **Given** um funcionário de outro escritório, **When** o gestor tenta detalhá-lo/editá-lo/excluí-lo, **Then** retorna 404 e ele nunca aparece na sua lista.
10. **Given** a listagem de funcionários, **When** o gestor filtra por empresa e por status
    (Todos/Ativos/Afastados/Desligados) ou busca por nome/GES/função, **Then** a lista reflete
    o filtro dentro do escritório ativo.

---

### Edge Cases

**Empresa**

- CNPJ duplicado no mesmo escritório → bloqueado; mesmo CNPJ em escritórios distintos → permitido.
- Grau de Risco fora de 1..4 ou ausente → rejeitado.
- CNPJ com formato inválido (≠ 14 dígitos) → rejeitado; CNPJ vazio → aceito (opcional).
- Excluir empresa com filhos → confirmação + aviso explícito de cascata.

**Unidade de Obra**

- Empresa sem endereço → "preencher com endereço da empresa" desabilitado.
- Excluir unidade com GES vinculados → aviso de cascata antes de confirmar.
- Empresa de outro escritório → nunca selecionável.

**GES + vínculos**

- GES sem funções vinculadas → nº de expostos = 0 (e card "Total" = 0), nunca erro.
- `worker_count` ≤ 0 → rejeitado.
- Mesma função vinculada duas vezes ao mesmo GES → bloqueado.
- Empresa sem unidades de obra → criação de GES bloqueada (seleção de obra vazia).
- Excluir GES → vínculos removidos (cascata); funcionários daquele GES ficam com GES nulo
  (preservados) — avisar.
- Soma do card "Total" nunca cruza escritórios.

**Função (Cargo)**

- Título duplicado na mesma empresa → bloqueado; mesmo título em empresas diferentes → permitido.
- Excluir função vinculada a GES (vínculo removido, expostos caem) ou a funcionários (função do
  funcionário fica nula) → avisar do impacto.

**Funcionário**

- CPF inválido → rejeitado; CPF duplicado no mesmo escritório → rejeitado; mesmo CPF em outro
  escritório → aceito.
- GES sem funções → seletor de Função vazio; salvar sem função é permitido.
- Funcionário sem GES/sem função → permitido (vínculos opcionais).
- GES ou função do funcionário é excluído → o vínculo correspondente fica nulo (funcionário
  preservado).
- Valor de enum fora do conjunto → rejeitado.

**Geral (todas as entidades)**

- Sem escritório ativo (contexto de tenant inexistente/inválido) → listagem vazia, **jamais**
  dados de outro escritório.
- Registro de outro escritório → 404 no detalhe/edição/exclusão, e nunca presente na listagem.
- Membro com papel `client` → acesso negado a qualquer operação destes CRUDs (leitura e escrita).
- Lista com muitos registros → paginada no servidor; a navegação entre páginas mantém os
  filtros/busca aplicados e nunca cruza escritórios.

## Requirements _(mandatory)_

### Functional Requirements — CRUD completo (todas as entidades)

- **FR-001**: O sistema MUST oferecer, para **cada** uma das 5 entidades (Empresa, Unidade de
  Obra, Função, GES, Funcionário), as cinco operações: **criar, listar, detalhar (por id),
  editar e excluir**.
- **FR-002**: A listagem de cada entidade MUST suportar busca/filtros conforme o briefing:
  Empresa (busca por razão social/CNPJ); Unidade de Obra (busca por nome/contrato/empresa);
  Função (busca por título/CBO, filtro por empresa); GES (filtros por empresa e obra, busca por
  nome/descrição); Funcionário (filtro por empresa e status, busca por nome/GES/função).
- **FR-003**: O detalhe (por id) MUST ser escopado ao escritório ativo: id de outro escritório
  MUST resultar em "não encontrado" (404), nunca nos dados do outro escritório.
- **FR-004**: A exclusão MUST exigir confirmação e, quando houver dependentes, MUST avisar
  explicitamente o impacto (cascata ou desvínculo) antes de confirmar. O sistema NÃO bloqueia a
  exclusão; ele confirma com aviso, seguindo a semântica de integridade definida na 006
  (cascata descendo a cadeia da empresa; desvínculo `SET NULL` de funcionário → GES/função).
- **FR-005**: O sistema MUST persistir **todos** os campos previstos no modelo 006 de cada
  entidade nas operações de criar/editar (em particular, o cadastro de Empresa MUST passar a
  gravar endereço, Grau de Risco, CNAE, atividade principal, contatos e nome fantasia — não
  apenas CNPJ e razão social).
- **FR-006**: Toda listagem MUST ser **paginada no servidor** (a busca/filtros aplicam-se sobre o
  conjunto antes da paginação), de modo que o volume de registros não degrade a página. Aplica-se
  às 5 entidades.

### Functional Requirements — Empresa (US1)

- **FR-010**: Razão social MUST ser obrigatória e não-vazia.
- **FR-011**: Grau de Risco MUST ser obrigatório e estar entre 1 e 4 (NR-04); fora disso a
  operação MUST ser rejeitada sem persistir.
- **FR-012**: CNPJ, quando informado, MUST ter formato válido (14 dígitos); CNPJ vazio MUST ser
  aceito (opcional).
- **FR-013**: O sistema MUST impedir CNPJ duplicado dentro do mesmo escritório e MUST permitir o
  mesmo CNPJ em escritórios distintos (sem unicidade global).

### Functional Requirements — Unidade de Obra (US2)

- **FR-020**: Nome, objeto/descrição e empresa MUST ser obrigatórios.
- **FR-021**: A empresa da unidade MUST pertencer ao escritório ativo; o seletor MUST listar
  apenas empresas do escritório ativo.
- **FR-022**: O sistema MUST oferecer "preencher com endereço da empresa", habilitado apenas
  quando a empresa selecionada possuir endereço.

### Functional Requirements — Função/Cargo (US3)

- **FR-030**: Título MUST ser obrigatório e não-vazio; empresa MUST ser obrigatória e do
  escritório ativo.
- **FR-031**: O título MUST ser único por empresa do escritório; duplicado na mesma empresa MUST
  ser bloqueado; o mesmo título em empresas diferentes MUST ser permitido.
- **FR-032**: CBO MUST ser tratado como texto livre (sem validação contra tabela oficial nesta
  fatia).

### Functional Requirements — GES + vínculos (US4)

- **FR-040**: GES MUST exigir nome, empresa e unidade de obra; a unidade MUST pertencer à
  empresa selecionada (seleção em cascata) e ao escritório ativo.
- **FR-041**: O nº de trabalhadores expostos do GES MUST ser **derivado** pela soma dos
  `worker_count` das funções vinculadas; MUST ser somente leitura; MUST ser 0 quando não houver
  vínculos; e NUNCA MUST ser aceito como entrada do cliente nem persistido como coluna/gatilho.
- **FR-042**: O sistema MUST permitir gerenciar as funções vinculadas ao GES — **adicionar**
  (função + `worker_count` + jornada opcional), **editar** (`worker_count`/jornada) e
  **remover** o vínculo.
- **FR-043**: `worker_count` MUST ser inteiro positivo (> 0); valor ≤ 0 MUST ser rejeitado.
- **FR-044**: O sistema MUST impedir vincular a mesma função duas vezes ao mesmo GES.
- **FR-045**: O seletor de funções a adicionar MUST mostrar apenas funções do escritório ainda
  **não** vinculadas àquele GES.
- **FR-046**: Após adicionar/editar/remover um vínculo, o nº de expostos exibido MUST refletir a
  soma atual (fonte única, sem divergência).
- **FR-047**: A listagem de GES MUST exibir um card "Total de Trabalhadores" cuja soma respeita
  o escopo filtrado dentro do escritório ativo e nunca cruza escritórios.
- **FR-048**: Quando a empresa não tiver unidades de obra, a criação de GES MUST ser bloqueada.

### Functional Requirements — Funcionário (US5)

- **FR-050**: Nome completo, CPF e empresa MUST ser obrigatórios; o status MUST ser `active` por
  padrão na criação.
- **FR-051**: CPF MUST ter formato válido (11 dígitos); MUST ser único por escritório; o mesmo
  CPF em escritórios distintos MUST ser permitido.
- **FR-052**: GES e Função MUST ser opcionais; o funcionário pode ser salvo sem GES e/ou sem
  função.
- **FR-053**: O seletor de Função do funcionário MUST mostrar apenas as funções vinculadas ao
  GES selecionado; se o GES não tiver funções, o seletor fica vazio e o salvamento sem função é
  permitido.
- **FR-054**: Sexo, estado civil e status MUST aceitar apenas valores dos conjuntos definidos no
  modelo; valores fora do conjunto MUST ser rejeitados.

### Functional Requirements — Isolamento, validação e contrato (cross-cutting)

- **FR-060**: Todo acesso a dados (leitura e escrita) MUST ser escopado pelo escritório ativo, e
  o identificador do escritório MUST vir sempre da sessão/vínculo do usuário — NUNCA de entrada
  do cliente (query string, corpo da requisição ou cabeçalho).
- **FR-061**: O isolamento entre escritórios MUST ter um backstop no banco (mesmo padrão de RLS
  herdado da fatia 004), de modo que dados de um escritório jamais sejam visíveis, editáveis ou
  excluíveis por usuário de outro. A empresa-cliente é uma **dimensão de dados dentro do
  escritório**, não uma fronteira de isolamento.
- **FR-062**: Toda Server Action MUST validar a entrada por esquema **antes** de aplicar regra de
  negócio, reutilizando os validadores já existentes do domínio (CPF, CNPJ, Grau de Risco,
  `worker_count`, enums) — sem duplicá-los.
- **FR-063**: Toda Server Action MUST retornar um **contrato de resultado padronizado**
  (sucesso vs. erro de validação/negócio), sem vazar exceção crua para a UI. Este contrato
  ainda não existe no projeto e MUST ser estabelecido nesta fatia, e reutilizado por todas as 5
  entidades.
- **FR-064**: As operações de **escrita** na fronteira de escritório (criar/editar/excluir e
  mutações de vínculo GES↔Função) MUST registrar evento de auditoria sem expor dados pessoais
  (sem PII). Operações de leitura não emitem evento de auditoria.
- **FR-065**: O acesso a estes CRUDs MUST ser restrito à equipe do escritório — membros com papel
  `owner` ou `collaborator`. Membros com papel `client` (vinculados a uma empresa específica via
  `scoped_company_id`) MUST NOT ter acesso a estas operações (leitura ou escrita); a tentativa MUST
  ser negada.

### Key Entities _(modelo herdado da 006 — fonte da verdade nos briefings)_

- **Empresa (`companies`)**: empresa-cliente do escritório; raiz da cadeia. Campos legais do
  cabeçalho do PGR (CNPJ opcional, razão social obrigatória, nome fantasia, contatos, CNAE +
  atividade principal, Grau de Risco 1–4 obrigatório, endereço, logo). Único por
  `(escritório, CNPJ)`.
- **Unidade de Obra (`work_units`)**: canteiro/filial/local sob uma empresa; nome e
  objeto/descrição obrigatórios; endereço próprio. Filha de Empresa (cascata), pai de GES.
- **Função/Cargo (`job_roles`)**: cargo ocupacional (com CBO texto livre) por empresa; título
  obrigatório, único por `(escritório, empresa, título)`. Usada na associação Função↔GES e na
  lotação do funcionário.
- **GES (`ges`)**: Grupo de Exposição Similar; núcleo da caracterização ambiental, dentro de uma
  unidade de obra. Nome, empresa e obra obrigatórios; campos de ambiente. Nº de expostos é
  **derivado**, não armazenado.
- **Vínculo GES↔Função (`ges_job_roles`)**: tabela de junção (sem CRUD standalone — seu ciclo de
  vida vive dentro do GES); `worker_count` > 0; jornada opcional; único por `(GES, função)`. É a
  **fonte** do nº de expostos.
- **Funcionário (`employees`)**: pessoa vinculada a uma empresa (obrigatório) e, opcionalmente, a
  um GES e a uma função do GES. Nome e CPF obrigatórios; CPF único por escritório; status com
  default `active`. Folha da cadeia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cada uma das 5 entidades possui as 5 operações (criar, listar, detalhar, editar,
  excluir) funcionais e demonstráveis na fatia.
- **SC-002**: 100% das tentativas de salvar uma empresa com Grau de Risco fora de 1..4 (ou
  ausente) são rejeitadas; nenhuma é persistida.
- **SC-003**: O nº de trabalhadores expostos exibido em qualquer GES é sempre igual à soma dos
  `worker_count` das funções vinculadas no escritório ativo, é somente leitura, e vale 0 quando
  não há vínculos — verificado após cada adicionar/editar/remover de vínculo.
- **SC-004**: O seletor de Função do funcionário lista exatamente as funções vinculadas ao GES
  selecionado e nenhuma outra; com GES sem funções, lista vazia.
- **SC-005**: O mesmo CPF é aceito em escritórios distintos e bloqueado em duplicidade dentro do
  mesmo escritório; idem para CNPJ de empresa.
- **SC-006**: 0% dos registros de um escritório são visíveis, editáveis ou excluíveis por
  usuário de outro escritório, em qualquer caminho de acesso; detalhe cross-tenant retorna 404 e
  listagem cross-tenant retorna vazio.
- **SC-007**: As suítes `npm run test` (unitário) e `npm run test:integration` (integração)
  passam, incluindo o caminho crítico de isolamento entre escritórios em Postgres efêmero.
- **SC-008**: 100% das tentativas de acesso (leitura ou escrita) por um membro com papel `client`
  são negadas; apenas `owner`/`collaborator` conseguem operar os CRUDs.
- **SC-009**: Toda listagem retorna no máximo uma página de resultados por requisição
  (paginação server-side), preservando filtros/busca ao navegar entre páginas.

## Assumptions

- **Semântica de exclusão**: a exclusão segue a integridade já definida na 006 — cascata descendo
  a cadeia da empresa (`companies → work_units → ges → ges_job_roles`) e desvínculo `SET NULL`
  de funcionário para GES/função. A UI sempre confirma e avisa do impacto; **não** há bloqueio
  duro de exclusão (decisão tomada para manter consistência com o modelo de dados existente e
  evitar estados órfãos).
- **Detalhe = edição**: para Empresa, Unidade de Obra e Função, a tela de detalhe pode ser a
  própria tela de edição (todos os campos visíveis), evitando uma tela somente-leitura
  redundante (KISS). Funcionário tem ficha de detalhe própria (com placeholders de
  EPI/Histórico/OS para as fases futuras).
- **Derivação reutilizada**: o nº de expostos consome os helpers de derivação já existentes na
  006 (`countExposedWorkersByGes` / `exposedWorkersByGesMap`); a fatia não cria coluna nem
  gatilho.
- **Validadores reutilizados**: os esquemas de validação já existentes do domínio (CPF, CNPJ,
  Grau de Risco, `worker_count`, enums) são reutilizados; a fatia não os reescreve.
- **Campos de imagem sem upload**: `logo_path` (empresa) e `photo_path` (funcionário) entram
  apenas como referência textual; o upload/armazenamento é fatia futura.
- **Escritório ativo resolvido pela sessão**: o escritório ativo é obtido do vínculo do usuário
  (contexto de tenant), conforme o Modelo B da 005; a fatia não introduz nova forma de
  resolução de tenant.
- **Ator destas histórias**: o "gestor de SST" das user stories corresponde a um membro com papel
  `owner` ou `collaborator` no escritório ativo; o papel `client` não é ator destes fluxos
  (FR-065).
- **Tamanho de página**: a paginação é server-side em todas as listas (FR-006); o tamanho de
  página padrão e o estilo (offset vs. cursor) são decisão do `/speckit-plan`.

## Out of Scope

- Lookup automático de CNPJ (Receita) e ViaCEP — dependem da integração externa #68.
- Upload/armazenamento de imagem (logo da empresa, foto 3x4 do funcionário) — apenas os campos
  de caminho existem.
- "Sugerir riscos com IA" / "Gerenciar Riscos" do GES (módulo PGR, Fase 3).
- Vínculo de Treinamentos do funcionário e tabela de referência de CBO (Fase 4).
- Contatos de emergência, CNH e passaporte do funcionário (deferidos na 006).
- CRUD de `categories` (catálogo EPI/Máquinas) — fora destes 5 cards.

## Dependencies

- Fatia **006** (`.specs/006-cadastros-base-pgr/`): modelo de dados (migration `0005`),
  repositórios base (`list`/`create`), helpers de derivação e testes.
- Fatia **005** (`.specs/005-modelo-tenant-gate-pro/`): Modelo B de tenant (escritório =
  `orgs.id`), provisionamento e resolução do escritório ativo.
- Fatia **004** (`.specs/004-multi-tenant-isolation/`): padrão de isolamento multi-tenant com
  backstop no banco (RLS) e auditoria de fronteira.
