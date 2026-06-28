# Feature Specification: Entrega de EPI com assinatura digital

**Feature Branch**: `feature/ppe-delivery-with-signature`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "PPE delivery with digital signature (entrega de EPI ao funcionário com assinatura digital) — wizard + Server Actions + rota pública sem Clerk + baixa de estoque. É o '#19' que a fatia 010 deixou fora de escopo: o gestor seleciona EPIs com saldo, revisa, escolhe um método de assinatura (QR Code, link remoto ou manual) e, na confirmação, o sistema registra a entrega e dá baixa no estoque, gerando o movimento employee_delivery."

## Clarifications

### Session 2026-06-27

- Q: Quando o estoque deve ser baixado? → A: A entrega é criada como **pendente** (itens + token) sem
  mexer no saldo; a **baixa ocorre apenas na confirmação** (assinatura), de forma atômica, revalidando
  a disponibilidade no momento.
- Q: O token de assinatura (QR/link) expira? Como? → A: Sim — **expira após uma janela fixa de 72h
  contada a partir da criação**, **derivada da data de criação** (sem persistir nova coluna / zero
  migration).
- Q: O método "Enviar Link" envia de verdade por e-mail/SMS? → A: Não no MVP — apenas **gera e
  exibe/copia** o link (não há provedor configurado; o disparo real fica para fatia futura).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Registrar entrega com baixa de estoque (Priority: P1)

Como **gestor de SST** (perfil de escritório), quero **registrar a entrega de um ou mais EPIs a um
funcionário e obter a comprovação por assinatura digital**, de modo que o fornecimento fique
documentado legalmente e o **saldo de estoque seja reduzido automaticamente** na confirmação.

O gestor abre a entrega a partir de um funcionário, **seleciona** os EPIs disponíveis (apenas os que
têm saldo), informa a **quantidade** de cada um, **revisa** os itens e a data, e **autentica** a
entrega. Na confirmação (por qualquer método), o sistema cria a entrega, registra um movimento de
saída por item e decrementa o saldo — tudo de forma **atômica** (se faltar saldo em qualquer item,
nada é gravado).

**Why this priority**: É o núcleo legal e operacional da fatia — sem ele não há comprovação de
entrega nem baixa de estoque. Entrega valor mesmo sem a parte pública (a assinatura manual já fecha o
fluxo). Prova o transacional multi-item, que é o maior risco técnico.

**Independent Test**: Criar uma entrega com 2 itens via caminho interno, registrar **assinatura
manual**, e verificar que: a entrega ficou `signed_manual`, há 1 movimento `employee_delivery` por
item ligado à entrega, e o saldo de cada item de estoque caiu pela quantidade entregue. Tentar uma
entrega com quantidade maior que o saldo e confirmar **rollback total**.

**Acceptance Scenarios**:

1. **Given** um funcionário da organização ativa e itens de estoque com saldo suficiente, **When** o
   gestor cria a entrega e registra a assinatura manual, **Then** a entrega fica `signed_manual`, é
   criado 1 movimento `employee_delivery` por item (com `delivery_id`) e o `balance` de cada item
   reduz pela quantidade entregue.
2. **Given** uma entrega cujo último item excede o saldo disponível no momento da confirmação,
   **When** a confirmação é executada, **Then** a operação é recusada com erro de saldo insuficiente
   e **nada** é persistido (sem entrega assinada, sem movimentos, sem alteração de saldo).
3. **Given** itens cujo saldo ficará abaixo da quantidade mínima após a baixa, **When** a entrega é
   confirmada, **Then** a entrega é concluída e um **aviso de mínima** é retornado (não bloqueia).
4. **Given** um usuário com papel `client`, **When** tenta registrar uma entrega, **Then** a operação
   é negada (403).

---

### User Story 2 - Funcionário confirma o recebimento sem login (Priority: P2)

Como **funcionário**, quero **confirmar o recebimento dos EPIs pelo meu próprio dispositivo** (lendo
um QR Code ou abrindo um link), **sem precisar de login**, para assinar a entrega remotamente.

O gestor exibe um QR Code (ou gera um link) vinculado à entrega; o funcionário acessa uma **página
pública**, vê os itens e quantidades que está recebendo e confirma. Na confirmação pública, o sistema
dá baixa no estoque e marca a entrega como assinada por QR/link. O painel do gestor reflete a
confirmação.

**Why this priority**: Habilita a assinatura remota (o diferencial do produto), mas depende do núcleo
(US1). É o maior risco de **segurança** (primeiro caminho de escrita sem autenticação), então vem
depois do MVP interno.

**Independent Test**: Criar uma entrega pendente com token; acessar a página pública pelo token (sem
sessão) e confirmar; verificar baixa de estoque na organização correta e status `signed_qr`/
`signed_link`. Verificar que um token de **outra organização** não expõe dados e que a confirmação
afeta **somente** a entrega daquele token.

**Acceptance Scenarios**:

1. **Given** uma entrega pendente com `auth_token` válido, **When** o funcionário acessa a página
   pública e confirma, **Then** o estoque é baixado na organização da entrega e o status vira
   `signed_qr` (ou `signed_link`).
2. **Given** um token inexistente, **When** a página pública é acessada, **Then** retorna "não
   encontrado" (404) sem vazar nenhum dado.
3. **Given** uma entrega já assinada, **When** o token é usado novamente, **Then** a confirmação é
   recusada como "já utilizado" (409) — idempotência.
4. **Given** o painel do gestor exibindo "Aguardando confirmação…", **When** o funcionário confirma,
   **Then** o painel passa a refletir a entrega assinada.

---

### User Story 3 - Assinatura manual quando não há dispositivo (Priority: P3)

Como **gestor**, quando o funcionário **não possui celular/e-mail** ou assina presencialmente, quero
**registrar a assinatura manual** (após a coleta física da assinatura) para concluir a entrega e dar
baixa no estoque.

**Why this priority**: É o caminho de contingência, totalmente interno; tecnicamente é um caso do
mesmo núcleo (US1) sem a complexidade pública. Garante que a entrega nunca fica bloqueada por falta de
contato do funcionário.

**Independent Test**: Em uma entrega pendente, acionar "Registrar assinatura manual" e verificar
status `signed_manual` + baixa de estoque, com a mesma garantia transacional da US1.

**Acceptance Scenarios**:

1. **Given** uma entrega pendente, **When** o gestor registra a assinatura manual, **Then** a entrega
   fica `signed_manual` e o estoque é baixado na mesma transação.
2. **Given** um funcionário sem e-mail/telefone, **When** o gestor escolhe "Enviar Link", **Then** o
   sistema orienta a completar o cadastro do funcionário (o método não fica disponível).

---

### Edge Cases

- **EPI sem saldo** (`balance = 0`) não aparece na seleção.
- **Saldo insuficiente no momento da confirmação** (alguém consumiu antes) → recusa + **rollback
  total** da entrega.
- **Funcionário sem e-mail/telefone** → método "Enviar Link" indisponível (orienta cadastro).
- **Token inexistente** (404), **já utilizado / entrega já assinada** (409), **expirado** (tratamento
  conforme decisão de expiração — ver Decisões em Aberto).
- **Saldo abaixo da mínima após a baixa** → exibir alerta (não bloqueia).
- **Concorrência**: duas confirmações da mesma entrega resolvem-se por idempotência; duas entregas
  concorrentes do mesmo item são serializadas (uma observa o saldo já reduzido pela outra).
- **Itens duplicados no payload** (mesmo item de estoque repetido) → rejeitado na validação.
- **Data de entrega** é uma data (sem hora).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um gestor (perfil de escritório) inicie uma entrega de EPI
  para um funcionário da **organização ativa**, selecionando um ou mais itens de estoque **com saldo**
  e a quantidade de cada um.
- **FR-002**: O sistema MUST exibir na seleção **apenas** itens com saldo disponível (> 0), com busca
  por CA/nome.
- **FR-003**: O sistema MUST validar, antes de qualquer gravação, que cada quantidade é inteira e
  positiva, que não há item repetido na mesma entrega, e que o funcionário pertence à organização
  ativa.
- **FR-004**: O sistema MUST registrar a entrega como um **cabeçalho** (funcionário + data) e seus
  **itens** (cada item × quantidade), iniciando no estado **pendente de assinatura**.
- **FR-005**: O sistema MUST oferecer três métodos de assinatura — **QR Code**, **link remoto** e
  **assinatura manual** — e registrar qual método concluiu a entrega.
- **FR-006**: Na **confirmação** (qualquer método), o sistema MUST, de forma **atômica**: para cada
  item, revalidar a disponibilidade do saldo, registrar um **movimento de saída** do tipo "entrega ao
  funcionário" vinculado à entrega, e **decrementar o saldo**; e marcar a entrega como assinada pelo
  método usado. Se qualquer item não tiver saldo, MUST recusar e **reverter tudo** (rollback total).
- **FR-007**: O saldo de estoque MUST **nunca** ficar negativo; o sistema MUST recusar a confirmação
  que o tornaria negativo.
- **FR-008**: Após a baixa, o sistema MUST retornar um **aviso** quando o saldo de um item ficar
  abaixo da quantidade mínima, **sem** bloquear a entrega.
- **FR-009**: O sistema MUST disponibilizar uma **página pública** de confirmação acessível por um
  **token** vinculado à entrega, **sem exigir login**, exibindo apenas o mínimo necessário
  (funcionário, itens, quantidades, data) para o funcionário confirmar.
- **FR-010**: Na confirmação pública, o sistema MUST derivar a organização **da própria entrega** (a
  partir do token), nunca de dados fornecidos pelo visitante, e MUST garantir que a operação afete
  **somente** a entrega daquele token, sem expor dados de outras organizações.
- **FR-011**: O token MUST ser de **alta entropia** e de **uso único**: após a entrega ser assinada,
  novas tentativas de confirmar com o mesmo token MUST ser recusadas (idempotência).
- **FR-012**: O sistema MUST permitir que o painel do gestor acompanhe o estado da assinatura
  ("Aguardando confirmação…" → assinada) após o funcionário confirmar.
- **FR-013**: O sistema MUST registrar evento de auditoria (sem dados pessoais sensíveis) na criação e
  na assinatura da entrega, inclusive na confirmação pública.
- **FR-014**: O sistema MUST recusar (403) qualquer operação interna de entrega feita por usuário sem
  papel de escritório (perfil `client`).
- **FR-015**: A transição de estado da assinatura MUST ser **única e irreversível** dentro desta
  fatia (pendente → assinada por um método); não há, aqui, devolução/estorno.

- **FR-016**: O sistema MUST criar a entrega no estado **pendente** (com itens e token) **sem alterar
  o saldo**; a **baixa de estoque ocorre apenas na confirmação** (assinatura), de forma atômica,
  revalidando a disponibilidade de cada item no momento da confirmação (ver FR-006).
- **FR-017**: O token de assinatura MUST **expirar após uma janela fixa de 72 horas** contada a partir
  da **criação da entrega**, com a expiração **derivada da data de criação** (sem persistir coluna de
  expiração / zero alteração de modelo). Tentativa de confirmar com token expirado MUST ser recusada.
- **FR-018**: O método "Enviar Link" MUST, no MVP, **gerar e exibir/copiar** o link de assinatura
  (não há disparo automático por e-mail/SMS — fica para fatia futura). Quando o funcionário não tiver
  contato cadastrado, o sistema MUST orientar a completar o cadastro (o método não fica disponível).

### Key Entities _(include if feature involves data)_

- **Entrega de EPI**: cabeçalho da entrega de um funcionário em uma data; possui um **estado de
  assinatura** (pendente, assinada por QR, assinada por link, assinada manualmente) e um **token** de
  capacidade (presente para QR/link; ausente para manual). Pertence a uma organização e a um
  funcionário.
- **Item da entrega**: vínculo entre a entrega e um EPI do catálogo, com a **quantidade** entregue
  (sempre positiva). Uma entrega tem um ou mais itens.
- **Movimento de estoque (entrega ao funcionário)**: saída de estoque gerada por item entregue,
  vinculada à entrega; é o registro que efetiva a baixa do saldo.
- **Item de estoque**: saldo materializado de um EPI por organização (nunca negativo) e sua
  quantidade mínima; é a fonte da seleção e o alvo da baixa.
- **Funcionário**: destinatário da entrega; possui contato (e-mail/telefone) eventualmente ausente,
  o que condiciona o método "Enviar Link".

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um gestor consegue concluir o fluxo (seleção → revisão → autenticação por QR) em **menos
  de 2 minutos**.
- **SC-002**: Ao confirmar uma entrega (qualquer método), o saldo de cada item entregue **diminui
  exatamente pela quantidade entregue** e **nunca** fica negativo, em **100%** das confirmações
  bem-sucedidas.
- **SC-003**: Em **100%** das confirmações com algum item sem saldo suficiente, **nenhuma** alteração
  é persistida (sem entrega assinada, sem movimento, sem mudança de saldo).
- **SC-004**: Toda entrega confirmada possui **exatamente um** registro de saída por item entregue
  vinculado à entrega (consistência total entre histórico e saldo).
- **SC-005**: A página pública de confirmação **não expõe** dados de outras organizações e uma
  confirmação por token afeta **somente** a entrega daquele token, verificado por testes de
  isolamento dedicados.
- **SC-006**: Itens sem saldo **nunca** aparecem na seleção de entrega.

## Assumptions

- **Modelo de dados existente é suficiente** (alvo: **zero alteração de schema**), reutilizando as
  entidades já criadas na fatia 008 (entrega, itens, movimento "entrega ao funcionário", saldo). A
  expiração de token (FR-017) é **derivada da data de criação** (janela de 72h), portanto **não**
  exige nova coluna nem migration.
- **Tempo real por _polling_** (consulta periódica curta) é o padrão adotado para o painel "Aguardando
  confirmação…"; uma solução de tempo real instantâneo é alternativa fora do MVP.
- **Ficha de impressão da assinatura manual** (versão imprimível) é considerada **fora do MVP**; pode
  entrar como incremento posterior.
- **Fatiamento recomendado** (entrega ergonômica): (1) MVP interno = entrega + assinatura manual +
  baixa; (2) QR + rota pública; (3) Enviar Link / impressão / tempo real instantâneo.
- **Isolamento multi-tenant (Modelo B)**: o caminho interno usa o tenant da sessão; o caminho público
  usa exclusivamente o token como capacidade, derivando a organização no servidor — nunca de input do
  visitante.
- **"Usuário que registrou"** não é capturado nesta fatia (o modelo não possui esse campo).
- **Fora de escopo**: devolução/estorno de entrega; disparo real de e-mail/SMS (se não houver
  provedor); geração de PDF sofisticada; alterações de catálogo e CRUDs já entregues (009/010).
