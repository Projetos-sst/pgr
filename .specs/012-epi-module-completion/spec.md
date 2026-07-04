# Feature Specification: Conclusão da Fase 02 — Módulo Operacional de EPI

**Feature Branch**: `feature/epi-module-completion`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Conclusão da Fase 02 — módulo operacional de EPI. Numa única leva, fechar todas as issues de EPI ainda abertas: plugar a validação de CA (CAEPI) já pronta no formulário de catálogo (#18/#115/#75), entrega de EPI com baixa transacional de estoque e assinatura digital de recebimento (#19), devolução de EPI com reposição de saldo (#20) e ficha/histórico de EPI por funcionário (#21). Fora: #78 (EPI×risco, Fase 03)."

## Contexto de negócio

O módulo de EPI (Equipamento de Proteção Individual) é o coração operacional da Fase 02 da plataforma
SST. O modelo de dados, o catálogo, o estoque e as movimentações já estão entregues; a base de
certificados do CAEPI/MTE já é sincronizada e consultável. Falta a camada que o técnico de segurança
usa no dia a dia: **entregar** EPIs a um funcionário dando baixa no estoque, **coletar a assinatura**
de recebimento, **registrar a devolução** repondo o saldo, e **consultar a ficha** de cada funcionário.
Além disso, a validação de CA construída na fatia anterior nunca foi conectada ao formulário de
cadastro de EPI — o autofill prometido não acontece hoje.

Esta especificação fecha essas lacunas numa única leva, priorizada em cinco histórias de usuário
independentemente testáveis.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Autofill de CA ao cadastrar EPI (Priority: P1)

Como técnico de segurança cadastrando um EPI no catálogo, quero que ao informar o número do CA
(Certificado de Aprovação) o sistema consulte a base do CAEPI e preencha automaticamente fabricante,
norma e validade, indicando visualmente se o CA está vigente, vencido ou não encontrado — sem nunca
me impedir de salvar o cadastro.

**Why this priority**: É o menor incremento de valor (só conecta peças já prontas e testadas), fecha
três issues (#18/#115/#75) e elimina retrabalho manual em todo cadastro de EPI. Ortogonal às demais
histórias — pode ser entregue e demonstrada sozinha.

**Independent Test**: Abrir o formulário de catálogo de EPI, digitar um CA vigente e confirmar o
preenchimento automático de fabricante/norma/validade com indicação de vigência; digitar um CA
inexistente e confirmar que o cadastro ainda pode ser salvo normalmente.

**Acceptance Scenarios**:

1. **Given** o formulário de catálogo aberto e a base CAEPI sincronizada, **When** o usuário informa um
   CA válido e vigente e sai do campo, **Then** fabricante, norma e validade são preenchidos
   automaticamente e um indicador verde de "CA vigente" é exibido, permanecendo todos os campos
   editáveis.
2. **Given** o mesmo formulário, **When** o usuário informa um CA existente porém vencido, **Then** é
   exibido um aviso distinto de "CA vencido" **e** os dados ainda são autopreenchidos (o usuário
   decide), sem bloquear o salvamento.
3. **Given** o mesmo formulário, **When** o usuário informa um CA não encontrado na base, **Then** é
   exibido um aviso inline "CA não encontrado" e o cadastro segue de forma manual.
4. **Given** a base CAEPI vazia/nunca sincronizada, **When** o usuário consulta qualquer CA, **Then** é
   exibido o aviso "base CAEPI ainda não sincronizada" (informativo, não erro) e o salvamento continua
   possível.
5. **Given** qualquer desfecho da consulta (válido, vencido, não encontrado, erro, timeout), **When** o
   usuário confirma o cadastro, **Then** o EPI é salvo com os valores presentes nos campos, pois o
   estado da validação **nunca** bloqueia o salvamento.

---

### User Story 2 - Entrega de EPI com baixa de estoque e assinatura manual (Priority: P1)

Como técnico de segurança, quero registrar a entrega de um ou mais EPIs a um funcionário, dando baixa
atômica no estoque no ato da confirmação, e registrar a assinatura de recebimento manualmente quando o
funcionário assinar presencialmente.

**Why this priority**: É o fluxo central do módulo e destrava devolução (US4) e ficha (US5). A baixa
transacional de estoque é o caminho crítico de integridade de dados.

**Independent Test**: Selecionar itens com saldo disponível, confirmar uma entrega a um funcionário do
próprio tenant, verificar que o saldo de cada item caiu exatamente pela quantidade entregue e que a
entrega foi criada como "aguardando assinatura"; registrar a assinatura manual e ver o status mudar.

**Acceptance Scenarios**:

1. **Given** itens em estoque com saldo suficiente, **When** o usuário confirma uma entrega de N itens
   a um funcionário, **Then** a entrega é criada com status "pendente de assinatura", cada item da
   entrega é registrado e o saldo de cada estoque é decrementado pela quantidade entregue, tudo na
   mesma transação.
2. **Given** uma entrega com pelo menos um item cujo saldo é insuficiente, **When** o usuário confirma,
   **Then** **nada** é gravado (rollback total), o erro `INSUFFICIENT_STOCK` é retornado e o saldo de
   todos os itens permanece intacto.
3. **Given** duas entregas concorrentes que consomem o mesmo estoque, **When** ambas são confirmadas,
   **Then** elas são serializadas de modo que o saldo nunca fica negativo nem "fura".
4. **Given** uma entrega pendente de assinatura, **When** o usuário registra a assinatura manual,
   **Then** o status passa a "assinada manualmente" com data/hora, uma única vez; uma segunda tentativa
   retorna `ALREADY_SIGNED`.
5. **Given** uma entrega, **When** o usuário tenta excluí-la após ela ter sido assinada, **Then** a
   exclusão é bloqueada (`FORBIDDEN`) — o retorno de saldo só é possível via devolução.
6. **Given** um funcionário ou estoque de outro tenant, **When** o usuário tenta entregá-lo, **Then** o
   alvo é tratado como inexistente (`NOT_FOUND`); nada cruza tenant.

---

### User Story 3 - Assinatura pública de recebimento por QR/link (Priority: P1)

Como funcionário que recebeu um EPI, quero assinar o recebimento pelo meu próprio dispositivo, acessando
um link (ou QR code) gerado pela entrega, sem precisar de login na plataforma; e como técnico, quero ver
o painel da entrega atualizar quando a assinatura é concluída.

**Why this priority**: Completa a prova de recebimento de #19 e é o requisito legal do controle de EPI.
Depende de US2 (a entrega precisa existir para ser assinada).

**Independent Test**: Gerar o link/QR de uma entrega pendente, abrir a rota pública sem sessão
autenticada, assinar, e confirmar que o painel interno da entrega reflete o novo status por polling.

**Acceptance Scenarios**:

1. **Given** uma entrega pendente, **When** o técnico escolhe assinatura por QR ou link, **Then** um
   token curto, imprevisível e com validade de 72h é gerado e associado à entrega (um token por
   entrega).
2. **Given** o link público de assinatura, **When** o funcionário o acessa sem estar autenticado,
   **Then** a rota pública abre (sem tenant, sem Clerk), mostra os itens da entrega e a área de
   assinatura.
3. **Given** o funcionário assinou na rota pública, **When** ele confirma, **Then** a assinatura é
   gravada, o status passa a "assinada por QR" ou "assinada por link" com data/hora, e o painel interno
   reflete a mudança por polling.
4. **Given** um token inexistente, **When** acessado, **Then** a resposta é "token inválido" sem
   vazamento de informação (`TOKEN_INVALID`).
5. **Given** um token expirado (>72h), **When** acessado, **Then** a resposta é "token expirado"
   (`TOKEN_EXPIRED`), com mensagem clara e sem erro de servidor.
6. **Given** uma entrega já assinada, **When** o token é reutilizado, **Then** uma mensagem clara indica
   que já foi assinada, sem 500 e sem permitir reassinar.
7. **Given** a rota pública, **When** acessada com um token de uma entrega, **Then** ela só enxerga
   aquela entrega e o tenant dela; nenhuma outra entrega ou tenant é acessível, e a rota resiste a
   enumeração (rate-limit).

---

### User Story 4 - Devolução de EPI com reposição de saldo (Priority: P2)

Como técnico de segurança, quero registrar a devolução de um EPI já entregue, repondo a quantidade ao
estoque e marcando o item como devolvido, sem permitir devolver o mesmo item duas vezes.

**Why this priority**: Fecha #20 e completa o ciclo de vida do EPI. Depende de US2. É a **única** história
que exige mudança de esquema (migration `0010`).

**Independent Test**: Sobre uma entrega existente, devolver um item, confirmar que o saldo do estoque
subiu exatamente pela quantidade do item e que o item ficou marcado com data de devolução; tentar
devolver o mesmo item de novo e ver a operação barrada.

**Acceptance Scenarios**:

1. **Given** um item de entrega ainda não devolvido, **When** o usuário registra sua devolução, **Then**
   o item recebe uma data de devolução e o saldo do estoque correspondente é acrescido exatamente pela
   quantidade do item, na mesma transação.
2. **Given** um item já devolvido, **When** o usuário tenta devolvê-lo novamente, **Then** a operação é
   barrada (`ALREADY_RETURNED`) e o saldo permanece intacto.
3. **Given** um item de entrega de outro tenant, **When** o usuário tenta devolvê-lo, **Then** é tratado
   como inexistente (`NOT_FOUND`).
4. **Given** uma entrega ainda pendente de assinatura, **When** um item é devolvido, **Then** a
   devolução ocorre normalmente — devolver independe do estado da assinatura.
5. **Given** devoluções concorrentes do mesmo estoque, **When** confirmadas, **Then** a reposição é
   serializada e o saldo final é consistente.

---

### User Story 5 - Ficha/histórico de EPI por funcionário (Priority: P2)

Como técnico de segurança ou gestor, quero consultar a ficha de EPI de um funcionário — todos os EPIs
entregues, com data de entrega, data de devolução e status de assinatura — com filtros por período e
status, e poder imprimi-la.

**Why this priority**: Fecha #21 e é a visão de auditoria/comprovação. Somente leitura; depende de US2
para haver o que listar (US4 enriquece a coluna de devolução).

**Independent Test**: Abrir a ficha de um funcionário do próprio tenant, ver a lista de entregas com
suas colunas, aplicar filtro por status "pendente"/"devolvido" e por período, e acionar a impressão.

**Acceptance Scenarios**:

1. **Given** um funcionário com entregas, **When** o usuário abre sua ficha, **Then** são listadas as
   entregas com CA, nome do EPI, tamanho, data de entrega, data de devolução e status de assinatura,
   ordenadas da mais recente para a mais antiga, com paginação.
2. **Given** a ficha, **When** o usuário filtra por status "pendente", **Then** apenas itens ainda não
   devolvidos são exibidos; ao filtrar por "devolvido", apenas os que têm data de devolução.
3. **Given** a ficha, **When** o usuário filtra por um intervalo de datas, **Then** apenas as entregas
   dentro do período são exibidas.
4. **Given** um funcionário de outro tenant, **When** o usuário tenta abrir sua ficha, **Then** é
   tratado como inexistente (`NOT_FOUND`).
5. **Given** um funcionário sem nenhuma entrega, **When** sua ficha é aberta, **Then** uma lista vazia é
   exibida (não um erro).
6. **Given** a ficha carregada, **When** o usuário aciona "Imprimir", **Then** uma versão para impressão
   da ficha de controle é produzida.

---

### Edge Cases

- **Rollback de entrega multi-item**: se qualquer item de uma entrega não tem saldo, a entrega inteira
  falha e nada é persistido; o saldo permanece exatamente como antes.
- **Concorrência de saldo**: entregas/devoluções simultâneas sobre o mesmo estoque são serializadas; o
  saldo nunca fica negativo nem é sobrescrito por leitura obsoleta.
- **Baixa vs. assinatura**: a baixa acontece na confirmação da entrega; a assinatura pendente não
  impede a baixa. O EPI sai do estoque no ato, a assinatura é a prova posterior.
- **Exclusão de entrega assinada**: proibida; o único caminho de retorno de saldo é a devolução.
- **Token de assinatura**: inexistente → inválido; >72h → expirado; entrega já assinada → mensagem
  clara; sempre sem erro de servidor e sem vazar dados de outro tenant; resiste a enumeração.
- **Devolução dupla**: um item só pode ser devolvido uma vez; a segunda tentativa é barrada e o saldo
  não muda.
- **CA sem base sincronizada / formato inválido / digitação rápida**: base vazia gera aviso informativo
  (não erro); formato inválido não dispara consulta; digitação rápida cancela a consulta anterior;
  nenhum desfecho bloqueia o salvamento do EPI.
- **Isolamento de tenant**: toda leitura/escrita enxerga apenas o próprio tenant; um acesso sem contexto
  de tenant nunca retorna registros de outros tenants (backstop de RLS). Alvo de outro tenant →
  `NOT_FOUND`.
- **Autorização**: usuários sem papel de equipe do escritório (papel `client`) recebem `FORBIDDEN` em
  todas as ações de escrita.

## Requirements _(mandatory)_

### Functional Requirements

**Autofill de CA (US1)**

- **FR-001**: O formulário de cadastro de EPI MUST consultar a base do CAEPI ao usuário informar um CA
  em formato válido e autopreencher fabricante, norma e validade quando o CA for encontrado.
- **FR-002**: O sistema MUST distinguir visualmente os desfechos: CA vigente (indicador positivo), CA
  vencido (aviso distinto, mas ainda autopreenchendo), CA não encontrado (aviso inline) e base não
  sincronizada (aviso informativo).
- **FR-003**: Os campos autopreenchidos MUST permanecer editáveis pelo usuário.
- **FR-004**: O estado ou a falha da consulta de CA MUST NOT, em hipótese alguma, bloquear o salvamento
  do EPI.
- **FR-005**: O sistema MUST NOT alterar o modelo de dados do catálogo nem sua validação de entrada para
  atender a US1 (é wiring de comportamento já existente).

**Entrega + baixa (US2)**

- **FR-006**: O sistema MUST permitir registrar uma entrega de um ou mais EPIs a um funcionário do
  próprio tenant, criando a entrega com status inicial "pendente de assinatura".
- **FR-007**: Ao confirmar a entrega, o sistema MUST decrementar o saldo de cada estoque envolvido pela
  quantidade entregue, validando saldo suficiente e registrando o movimento de saída, tudo na mesma
  transação atômica.
- **FR-008**: Se qualquer item da entrega não tiver saldo suficiente, o sistema MUST abortar a operação
  inteira (rollback total), não persistir nada e retornar `INSUFFICIENT_STOCK`.
- **FR-009**: Escritas de saldo concorrentes MUST ser serializadas de forma que o saldo nunca fique
  negativo; a validação de saldo não-negativo é aplicada na operação, com restrição de banco como
  backstop.
- **FR-010**: A seleção de itens para entrega MUST apresentar apenas itens com saldo disponível e o
  saldo disponível de cada um, com busca por CA/nome.

**Assinatura (US2 manual + US3 pública)**

- **FR-011**: O sistema MUST permitir registrar a assinatura de recebimento por três métodos — manual
  (presencial), QR e link — cada um levando o status de "pendente" a um estado assinado correspondente
  com data/hora.
- **FR-012**: Uma entrega MUST poder ser assinada apenas uma vez; tentativas de reassinar MUST retornar
  `ALREADY_SIGNED`.
- **FR-013**: Para QR/link, o sistema MUST gerar um token por entrega, curto, imprevisível e com
  validade de 72 horas.
- **FR-014**: O sistema MUST expor uma rota pública de assinatura, acessível sem autenticação e sem
  contexto de tenant, que resolve a entrega e seu tenant exclusivamente a partir do token.
- **FR-015**: A rota pública MUST tratar token inexistente como `TOKEN_INVALID`, token expirado como
  `TOKEN_EXPIRED` e entrega já assinada com mensagem clara, sempre sem erro de servidor e sem expor
  qualquer entrega/tenant além da referenciada pelo token; MUST resistir a enumeração (rate-limit).
- **FR-016**: O painel interno da entrega MUST refletir a conclusão da assinatura pública por polling.
- **FR-017**: O sistema MUST proibir a exclusão de uma entrega já assinada (`FORBIDDEN`).

**Devolução (US4)**

- **FR-018**: O sistema MUST permitir registrar a devolução de um item de entrega, por item e total
  (quantidade inteira), marcando-o com data de devolução e acrescentando a quantidade ao saldo do
  estoque na mesma transação atômica.
- **FR-019**: O sistema MUST impedir a devolução de um item já devolvido, retornando `ALREADY_RETURNED`
  e mantendo o saldo intacto.
- **FR-020**: A devolução MUST independer do estado de assinatura da entrega.

**Ficha (US5)**

- **FR-021**: O sistema MUST oferecer, apenas para leitura, a ficha de EPI de um funcionário do próprio
  tenant, listando entregas com CA, nome do EPI, tamanho, data de entrega, data de devolução e status
  de assinatura, ordenadas da mais recente para a mais antiga, com paginação.
- **FR-022**: A ficha MUST suportar filtro por status (pendente = sem devolução; devolvido = com data de
  devolução; todos) e por intervalo de datas.
- **FR-023**: A ficha MUST oferecer uma saída de impressão da ficha de controle.

**Isolamento e autorização (transversal a US2–US5)**

- **FR-024**: Toda leitura e escrita de EPI (exceto a rota pública de assinatura) MUST operar
  estritamente no tenant da sessão, obtido do contexto de sessão e nunca de entrada do cliente; alvos de
  outro tenant MUST ser tratados como `NOT_FOUND`.
- **FR-025**: Todas as ações de escrita MUST exigir papel de equipe do escritório; o papel `client` MUST
  receber `FORBIDDEN`.

**Superfície de API (transversal — obrigatória por recurso novo)**

- **FR-026**: Cada recurso HTTP-exposto novo MUST entregar, no mesmo escopo, os quatro artefatos: Server
  Action, Route Handler REST espelho com verbos reais, registro em `docs/api/api-design.md` e requests
  na coleção Postman única, reutilizando a mesma regra de negócio (repositório/schema/mapeamento de
  erro) entre Server Action e REST, sem reimplementá-la.
- **FR-027**: Os recursos REST MUST cobrir: listar/criar entregas; obter/atualizar/excluir entrega
  (exclusão barrada se assinada); assinar (manual); devolver item(ns); ficha de EPI do funcionário
  (somente leitura, com filtros de status/período/página); e a rota pública de assinatura, fora do
  namespace de API versionada e sem tenant. Criações retornam `201`; exclusões retornam `204`.

### Key Entities _(include if feature involves data)_

- **Entrega de EPI (`epi_deliveries`)**: um evento de entrega de EPIs a um funcionário; possui data de
  entrega, status de assinatura (pendente / assinada manual / QR / link) e um token de assinatura
  opcional e único quando presente. Pertence a um tenant. _(Já existe no modelo — fatia 008.)_
- **Item de entrega (`epi_delivery_items`)**: cada EPI dentro de uma entrega, com item de catálogo e
  quantidade; passa a ter uma **data de devolução** (nova, nullable). _(Coluna nova na migration 0010.)_
- **Movimento de estoque (`stock_movements`)**: registro de saída (entrega) ou entrada (devolução) que
  altera o saldo; ganha o tipo **devolução do funcionário** (novo valor de enum). _(Valor novo na
  migration 0010.)_
- **Estoque de EPI (`epi_stock`)**: saldo materializado por item, alterado transacionalmente por
  entregas e devoluções. _(Já existe.)_
- **Catálogo de EPI (`epi_catalog`)**: cadastro do EPI, com CA, validade, fabricante e norma —
  autopreenchidos a partir do CAEPI na US1. _(Já existe; não alterado.)_
- **Certificado CAEPI (`caepi_certificates`)**: base global (sem tenant) de certificados do MTE, fonte
  do autofill de CA. _(Já existe; somente consultado.)_

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Ao cadastrar um EPI com um CA vigente, fabricante, norma e validade são preenchidos
  automaticamente; com CA vencido ou inexistente, o usuário é avisado e ainda consegue salvar — em 100%
  dos casos o salvamento nunca é bloqueado pelo estado da validação.
- **SC-002**: Entregar N EPIs a um funcionário reduz o saldo de cada item exatamente pela quantidade
  entregue e cria a entrega pendente; quando qualquer item não tem saldo, nenhuma alteração é
  persistida (saldo idêntico ao anterior em 100% das falhas).
- **SC-003**: Um funcionário consegue assinar o recebimento por QR/link na rota pública sem login, e o
  painel do gestor passa a exibir a assinatura concluída; alternativamente o gestor registra a
  assinatura manual — cada entrega é assinável uma única vez.
- **SC-004**: Devolver um EPI aumenta o saldo do estoque exatamente pela quantidade do item e marca a
  data de devolução; uma segunda devolução do mesmo item é sempre barrada.
- **SC-005**: A ficha de um funcionário lista suas entregas e devoluções com filtros de status e período
  e permite impressão.
- **SC-006**: Nenhum dado cruza tenant em nenhuma história: consultas sem contexto de tenant retornam
  zero registros e alvos de outro tenant retornam `NOT_FOUND` em 100% dos testes de isolamento.
- **SC-007**: A suíte de verificação do projeto (formatação, lint, tipos e testes unitários) e a suíte
  de integração contra Postgres efêmero passam integralmente.

## Assumptions

- **Base de código a partir de `develop`**: implementação limpa sobre o `develop` atual (última migration
  `0009`), reaproveitando apenas a **lógica** das branches antigas (`feature/ppe-delivery-with-signature`,
  `feature/ppe-return-record`, `feature/digital-signature-infra`) como referência; sem mergear/rebasear
  seus commits (têm duplicação e colisão de migration `0009`).
- **Modelo de dados já existente (fatia 008)**: `epi_catalog`, `epi_stock`, `stock_movements`,
  `epi_deliveries` (com status de assinatura e token), `epi_delivery_items` e os enums de tipo de
  movimento e de status de assinatura já estão em `develop`. A fonte da verdade do modelo é
  `src/shared/db/schema/epis.ts`; campos citados em issues antigas que não existem no schema
  (`standard`, `ca_expires_at`, `current_balance`, `organization_id`, SQLite) são desconsiderados.
- **Assinatura inline, não infra genérica (D1)**: a prova de recebimento usa o token e o status já
  presentes em `epi_deliveries`. Não se cria uma infraestrutura polimórfica de assinatura
  (`signature_requests`/`captures`) — isso fica para quando houver um segundo consumidor real (o PGR, na
  Fase 03+), conforme o padrão de "abstrair com 2+ consumidores".
- **Reuso de saldo (D2)**: a lógica de baixa hoje inline em `registerStockExit` é **extraída** para um
  auxiliar reutilizável (`applyStockExit`) e ganha o espelho `applyStockEntry` para a devolução,
  preservando o comportamento e os testes já existentes das movimentações (#72) — é refatoração sem
  mudança de contrato.
- **Baixa na confirmação (D3)**: o EPI sai do estoque ao confirmar a entrega; a assinatura pode ser
  concluída depois. O retorno de saldo só ocorre por devolução, nunca por estorno silencioso.
- **Migration única (D4)**: apenas a devolução exige mudança de esquema — a migration `0010` adiciona o
  valor de enum de devolução ao tipo de movimento e a coluna de data de devolução ao item de entrega,
  sem GRANT/RLS novos (herdados da tabela). Emitida via drizzle-kit com SQL custom (padrão da `0005`),
  aplicada pela conexão direta de owner; o valor de enum é forward-only no rollback.
- **Ficha somente leitura (D5)**: sem tabela nem coluna nova; join escopado por tenant + impressão via
  CSS.
- **Rota pública de assinatura**: adicionada à lista de rotas públicas (padrão de `sign-in`/`sign-up`/
  webhooks), sem Clerk e sem tenant; o token é a única credencial. Notificação por SSE é considerada
  desnecessária — polling simples atende.
- **Devolução total por item**: devolução parcial de quantidade está fora de escopo (YAGNI); data de
  devolução ausente = pendente.
- **Testes de integração** rodam exclusivamente contra Postgres efêmero (`INTEGRATION_*`), nunca SQLite
  nem o banco de desenvolvimento; isolamento multi-tenant é caminho crítico obrigatório em toda história
  com escrita.

## Out of Scope

- **#78 (EPI × risco / neutralização)** — Fase 03; depende de um módulo de Riscos que ainda não existe
  (`epi_risk` referencia `ges` interino). Nenhum código especulativo.
- **Infra de assinatura genérica** (`signature_requests`/`captures`) — adiada até um segundo consumidor
  real (PGR).
- **Job/tabela de ingestão do CAEPI** e seu agendador — já entregues na fatia 011; não reabrir.
- **Devolução parcial de quantidade**, notificação por SSE (usa-se polling), upload de imagem além da
  assinatura e geração de PDF por biblioteca (usa-se impressão via CSS).
- **Qualquer alteração ao modelo da fatia 008** fora da migration `0010`.

## Housekeeping (não é código)

- Fechar #70 e #72 (já mergeadas em `develop`).
- Ao concluir a US1: marcar #18 e #115 como concluídas e #75 como **duplicada de #115**.
