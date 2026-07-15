# Feature Specification: Revisões do PGR, revisão consolidada e assinatura pública

**Feature Branch**: `feature/pgr-revisions-signature`

**Spec Directory**: `.specs/022-pgr-revisions-signature`

**Created**: 2026-07-14

**Status**: Draft

**Input**: Issue "PGR revisions and digital signature", reconciliada com a realidade do repositório
pelo relatório do **Gate 0** (auditoria read-only da `develop` pós-#146/#147).

---

## Contexto e invariantes desta fatia

Fatia **zero-migration**. Nada de schema, nada de migration, nada de coluna nova. Tudo o que esta
fatia entrega é: (a) **corrigir** o que a Feature 019 entregou pela metade, (b) **estender leituras**
já existentes e (c) **plugar o PGR na infraestrutura de assinatura genérica já entregue na Fase 0**.

### Base factual (apurada no Gate 0 — não presumir nada além disto)

- Tabela real: **`pgr_revisions`** com **exatamente 8 colunas**: `id`, `org_id`, `pgr_id`,
  `revision_number`, `revised_at`, `notes`, `created_at`, `updated_at`.
  **UNIQUE real**: `uq_pgr_revisions_org_pgr_number (org_id, pgr_id, revision_number)`.
  **Não existem** `author_id`, `author_name`, `snapshot`, `document_url`, `status`, nem conteúdo da versão.
- Tabela **`pgr`** tem 11 colunas e **nenhuma** de: `status`, `version`, `signed_at`, `signature_id`,
  `document_id`, `pdf_url`, `cover_color`, `summary_config`, `accepted_at`, `accepted_by`.
  **Não existe enum de status de PGR.**
- **`revision_number` hoje é entrada do usuário.** O servidor não calcula nada; o `max+1` existe
  apenas como `defaultValue` no formulário do cliente. A unicidade é garantida só pelo UNIQUE do banco.
- **A UI da Feature 019 está órfã.** O componente `PgrEditorTabs` (e as 5 abas) **não é importado por
  lugar nenhum**; `/pgr/[id]` ainda renderiza a página read-only pré-019. Backend e REST funcionam;
  a camada cliente é inalcançável no app rodando.
- **A visão consolidada existe e não tem N+1** (5 queries em lote), mas é **incompleta**: não traz
  EPIs por risco, e do plano 5W2H traz **apenas 2 de 6 campos** (`actionResponsible`, `actionDeadline`).
- **A infraestrutura de assinatura da Fase 0 é genuinamente genérica**: `signature_requests` +
  `signature_captures`, com `target_type` do tipo **`text`** (não enum) e `target_id`/`payload`
  polimórficos. Plugar um novo tipo é **zero migration** — comprovado por teste de extensibilidade já
  existente na suíte. O registry de aplicação hoje aceita **apenas `"demo"`**.
- **A captura de assinatura guarda apenas** `signer_name`, `image_data`, `method`, `signed_at`,
  `org_id`, `request_id`. **Não guarda CPF, IP nem user-agent** — o que se alinha com o escopo V1.
- **A rota pública de assinatura NÃO está liberada** no `src/proxy.ts`: o matcher de rotas públicas
  cobre apenas `/sign/(.*)` (que é do EPI), e não a rota `/assinar/[token]` emitida pela
  infraestrutura genérica. Hoje a página pública genérica cai no `auth.protect()`. **Isto é um defeito
  e bloqueia a US5.**
- **O "audit log" é uma linha JSON em stdout** (`console.log`), **não é persistido em tabela alguma**.
  Além disso, o caminho **REST não registra o ator** (não passa por `officeAction`).
- A coleção Postman **perdeu a pasta `Dashboard (plataforma)`** na resolução de conflito da PR #146,
  embora o `api-design.md` tenha preservado os três recursos.

### Invariantes não-negociáveis

- **Inv-1 — Zero migration.** Nenhuma alteração em `src/shared/db/schema/**` nem migration nova.
  Se alguma exigência só puder ser cumprida com coluna nova, ela **sai do escopo** — não vira migration.
- **Inv-2 — Tenant sempre da sessão.** `orgId`/`organizationId`/`organization_id` **nunca** vêm do
  cliente. Fluxo protegido: `requireOfficeStaff()` → `officeAction`/`restHandler` → `withOrg` → RLS
  `app_runtime` como backstop.
- **Inv-3 — No fluxo público, o token é a única credencial.** O tenant é derivado do **registro
  interno do token**, jamais de input. Nenhuma sessão Clerk é exigida do signatário.
- **Inv-4 — Não criar infraestrutura paralela de assinatura.** Reusar `signature_requests` /
  `signature_captures` e seus helpers. Não replicar o token inline do EPI.
- **Inv-5 — Nada de PDF/documento final.** A geração documental é da **Fase 05** (Gotenberg,
  autorizado pela constituição 1.4.0, ainda não implantado). Esta fatia só **prepara os dados**.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Editor do PGR em abas efetivamente acessível (Priority: P1)

Como gestor de SST, ao abrir um PGR eu quero ver o editor em abas — Informações básicas, GES,
Revisões e Visão consolidada — para trabalhar o documento inteiro em um só lugar. Hoje a tela mostra
apenas os campos básicos em modo leitura, e as abas construídas na Feature 019 não aparecem.

**Why this priority**: é **pré-requisito de todas as outras histórias**. As US2/US3/US4 entregam
funcionalidade dentro do editor; sem o editor montado, nada delas é alcançável pelo usuário. Além
disso, é a correção de uma regressão de integração já em `develop`.

**Independent Test**: abrir `/pgr/{id}` de um PGR existente e confirmar que as abas renderizam e
navegam, sem duplicar componentes já existentes. Entrega valor sozinha (destrava a 019 inteira).

**Acceptance Scenarios**:

1. **Given** um PGR existente do meu tenant, **When** acesso `/pgr/{id}`, **Then** vejo o editor em
   abas com Informações básicas, GES, Revisões e Visão consolidada navegáveis.
2. **Given** o editor montado, **When** navego entre as abas, **Then** cada aba usa os componentes já
   entregues pela Feature 019, sem reimplementação nem duplicação.
3. **Given** funcionalidades ainda não disponíveis (Cor/Sumário e Documentos GED), **When** o editor
   renderiza, **Then** elas aparecem como **placeholders desabilitados**, sinalizando fase futura.
4. **Given** um PGR de outro tenant, **When** tento acessar `/pgr/{id}`, **Then** recebo `NOT_FOUND`
   e nenhum dado é exposto.

---

### User Story 2 - Revisões com numeração calculada no servidor (Priority: P1)

Como gestor de SST, quero registrar revisões manuais do PGR e consultar o histórico, com o **número
da próxima revisão calculado pelo sistema**, para não depender de digitar o número certo nem colidir
com uma revisão que outra pessoa acabou de criar.

**Why this priority**: hoje o número vem do cliente. Dois usuários no mesmo PGR colidem, e o único
guarda-costas é o erro de banco. É o núcleo regulatório do histórico do documento.

**Independent Test**: criar revisões pela aba Revisões e pela API, sem informar número, e confirmar
que a sequência sai correta e que o histórico lista em ordem.

**Acceptance Scenarios**:

1. **Given** um PGR sem revisões, **When** registro a primeira revisão, **Then** o sistema atribui o
   número **1** sem que eu o informe.
2. **Given** um PGR cuja maior revisão é a 3, **When** registro uma nova revisão, **Then** o sistema
   atribui **4**.
3. **Cenário de concorrência** — **Given** duas solicitações de criação de revisão para o **mesmo
   PGR** submetidas simultaneamente, **When** ambas são processadas, **Then** o sistema **serializa**
   o cálculo do próximo número e **cria ambas**, com números **distintos e consecutivos**, sem confiar
   em número enviado pelo cliente. **Nenhuma revisão é perdida**, nenhum número se repete, e o
   isolamento por tenant é preservado. `DUPLICATE` (409) **não** é o resultado esperado deste fluxo —
   ele permanece apenas como **backstop defensivo** da UNIQUE.
4. **Given** revisões sendo criadas em **PGRs diferentes**, **When** ocorrem ao mesmo tempo, **Then**
   uma **não bloqueia** a outra (o lock é **por PGR**, nunca global).
5. **Given** um cliente que **envia** um número de revisão no corpo da requisição, **When** a
   requisição é processada, **Then** ela é **rejeitada com `VALIDATION` (422)** — o campo é **proibido**
   no input, e não silenciosamente ignorado. O servidor é a **única** fonte de verdade do número.
6. **Given** revisões existentes, **When** abro a aba Revisões, **Then** vejo o histórico ordenado por
   número decrescente exibindo **somente número, data e notas**.
7. **Given** um PGR de outro tenant, **When** tento listar ou criar revisão nele, **Then** recebo
   `NOT_FOUND` (404) e nenhuma revisão é criada.
8. **Given** um usuário de papel `client`, **When** tento criar uma revisão, **Then** recebo
   `FORBIDDEN` (403).

---

### User Story 3 - Visão consolidada completa para revisão do PGR (Priority: P2)

Como gestor de SST, quero revisar o PGR inteiro em uma tela — GES, riscos, avaliação vigente, medidas
de controle com o **plano 5W2H completo** e os **EPIs indicados para cada risco** — para conferir o
documento antes de submetê-lo à assinatura.

**Why this priority**: é o que torna a assinatura defensável (assina-se o que se conseguiu revisar) e
é a estrutura que a Fase 05 vai reaproveitar para gerar o documento. Depende da US1 estar montada.

**Independent Test**: abrir a aba Visão consolidada de um PGR com dados completos e conferir que EPIs
e os 6 campos do 5W2H aparecem; conferir os fallbacks com dados faltando.

**Acceptance Scenarios**:

1. **Given** um risco com EPIs vinculados, **When** abro a consolidada, **Then** vejo os EPIs
   indicados para aquele risco.
2. **Given** medidas de controle com plano de ação preenchido, **When** abro a consolidada, **Then**
   vejo o **plano 5W2H completo** (o quê, como, acompanhamento, medição, responsável, prazo), e não
   apenas responsável e prazo.
3. **Given** um GES com riscos avaliados e não avaliados, **When** abro a consolidada, **Then** os
   avaliados vêm primeiro por nível de risco decrescente e os **sem avaliação por último**.
4. **Given** um PGR sem GES / GES sem riscos / risco sem avaliação / risco sem medidas / risco sem
   EPI, **When** abro a consolidada, **Then** vejo um estado vazio claro em cada caso, sem erro.
5. **Given** um PGR com muitos GES e riscos, **When** a consolidada é montada, **Then** ela continua
   **sem N+1** (número de consultas não cresce com a quantidade de riscos).

---

### User Story 4 - Solicitar assinatura do PGR por link público (Priority: P2)

Como gestor de SST, quero gerar um link público de assinatura para um PGR, copiá-lo para enviar ao
responsável, e acompanhar o estado dessa assinatura na tela do PGR.

**Why this priority**: é o objetivo declarado da issue, mas depende de US1 (onde a ação vive) e faz
sentido depois que o documento pôde ser revisado (US3).

**Independent Test**: gerar a solicitação a partir do PGR, obter o link, e ver o estado do PGR mudar
de "sem solicitação" para "aguardando assinatura".

**Acceptance Scenarios**:

1. **Given** um PGR do meu tenant, **When** solicito a assinatura, **Then** o sistema cria uma
   solicitação vinculada àquele PGR e ao meu tenant, e me devolve um link público copiável.
2. **Given** uma solicitação criada, **When** consulto o PGR, **Then** vejo o estado **derivado**
   (sem solicitação · aguardando assinatura · assinado · expirado/indisponível), **sem que exista
   qualquer coluna de status no PGR**.
3. **Given** um PGR de outro tenant, **When** tento solicitar assinatura para ele, **Then** a
   operação é recusada e nenhuma solicitação é criada.
4. **Given** um usuário de papel `client`, **When** tento solicitar assinatura, **Then** recebo
   `FORBIDDEN` (403).
5. **Given** um tenant no plano `free` que já atingiu a cota mensal de solicitações de assinatura,
   **When** solicito mais uma, **Then** recebo o erro de cota da infraestrutura existente
   (`QUOTA_EXCEEDED`) — comportamento **herdado**, não redefinido por esta fatia.

---

### User Story 5 - Assinar o PGR sem precisar de conta (Priority: P2)

Como responsável indicado, quero abrir o link que recebi, ver um resumo mínimo do PGR e registrar
minha assinatura, sem criar conta nem fazer login.

**Why this priority**: é a contraparte externa da US4; sem ela a solicitação não fecha o ciclo.

**Independent Test**: abrir o link em uma sessão sem credencial Clerk, assinar, e confirmar que a
assinatura ficou registrada e que o link não serve mais.

**Acceptance Scenarios**:

1. **Given** um link válido, **When** o abro **sem nenhuma sessão autenticada**, **Then** a página
   carrega e mostra um resumo **mínimo** do PGR, suficiente para eu saber o que estou assinando.
2. **Given** a página pública aberta, **When** informo meu nome e registro a assinatura, **Then** a
   assinatura é gravada com nome, imagem da assinatura e data, vinculada **somente** ao PGR daquela
   solicitação.
3. **Given** um link **já utilizado**, **When** o abro de novo ou tento reenviar a assinatura,
   **Then** a assinatura é recusada e **nenhuma escrita** ocorre.
4. **Given** um link **expirado**, **When** tento assinar, **Then** a assinatura é recusada e
   nenhuma escrita ocorre.
5. **Given** um token **inválido/inexistente**, **When** acesso a página, **Then** recebo uma
   resposta segura que **não revela** se o PGR existe, a qual tenant pertence, ou se o token já
   existiu — mensagens de token inválido e inexistente são **indistinguíveis**.
6. **Given** um token pertencente a outro tenant, **When** ele é usado, **Then** nenhum dado de outro
   tenant é exposto nem gravado.
7. **Given** um envio duplicado do mesmo token em corrida (replay), **When** ambos chegam, **Then**
   no máximo **uma** assinatura é registrada.

---

### User Story 6 - Reconciliação da coleção Postman (Priority: P3)

Como equipe de desenvolvimento, quero que a coleção Postman volte a conter Perfil, Equipe **e
Dashboard**, e passe a conter os contratos desta feature, para que toda a superfície REST continue
testável por Postman/cURL.

**Why this priority**: é correção de dívida documental que entra conscientemente nesta PR (decisão
aprovada: **sem branch corretiva separada**). Não bloqueia o produto, mas bloqueia a testabilidade.

**Independent Test**: parsear o JSON da coleção e conferir que as três pastas de plataforma coexistem
e que os novos requests estão presentes.

**Acceptance Scenarios**:

1. **Given** a coleção atual (sem Dashboard), **When** a feature é entregue, **Then** a pasta
   `Dashboard (plataforma)` e o request `GET /api/v1/dashboard/summary` estão **restaurados**.
2. **Given** a restauração, **When** inspeciono a coleção, **Then** `Perfil (plataforma)` e
   `Equipe (plataforma)` continuam **íntegros** (nenhum request removido).
3. **Given** a coleção final, **When** faço `JSON.parse` dela, **Then** ela é **JSON válido** e não
   contém nenhum marcador de conflito (`<<<<<<<`, `=======`, `>>>>>>>`).
4. **Given** os novos endpoints desta feature, **When** inspeciono a coleção, **Then** eles estão
   registrados, e o `api-design.md` também os documenta.

---

### Edge Cases

- **Primeira revisão de um PGR** (histórico vazio) → número **1**.
- **Corrida na criação de revisão (mesmo PGR)** → as duas são **serializadas** e **ambas são criadas**,
  com números consecutivos. Nenhuma revisão é perdida; nunca duas linhas com o mesmo número.
- **Corrida em PGRs diferentes** → não há bloqueio entre elas (lock por PGR, não global).
- **Colisão inesperada de número** (ex.: linha legada gravada fora do fluxo) → `DUPLICATE` (409) pela
  UNIQUE, como **backstop defensivo** — não é o desfecho do fluxo concorrente normal.
- **Cliente envia `revisionNumber` no corpo** → **`VALIDATION` (422)**. O campo é **proibido** no input
  (schema estrito), não ignorado: um cliente desatualizado precisa **falhar visivelmente**, e não
  acreditar que controla o número.
- **Revisão em PGR inexistente ou de outro tenant** → `NOT_FOUND` (404), sem escrita.
- **Consolidada com PGR sem GES / GES sem riscos / risco sem avaliação / sem medidas / sem EPI** →
  estados vazios explícitos, nunca erro.
- **Medida de controle sem plano de ação preenchido** → os campos 5W2H aparecem vazios, sem quebrar.
- **Solicitação de assinatura para PGR de outro tenant** → recusada antes de qualquer escrita.
- **Plano `free` com cota mensal esgotada** → `QUOTA_EXCEEDED` na criação da solicitação.
- **Token inválido / inexistente / expirado / já usado / cancelado** → resposta pública segura,
  indistinguível entre os casos que poderiam permitir enumeração, e **zero escrita**.
- **Replay do mesmo token** → no máximo uma assinatura registrada.
- **PGR alterado depois da criação do link** → o link existente continua exibindo o **snapshot
  original**; a edição posterior não vaza para links já emitidos.
- **Tentativa de incluir dados de funcionário no payload público** → impedida pela **composição do
  payload mínimo**, que não admite esses campos.
- **Rota pública não liberada no proxy** → hoje o acesso público falharia; a fatia **deve** corrigir
  isso, senão a US5 é inalcançável.
- **PGR excluído após a solicitação ter sido emitida** → o fluxo público não pode expor erro que
  revele a existência prévia do documento.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Editor em abas (correção de integração da Feature 019)

- **FR-001**: A tela de detalhe do PGR (`/pgr/{id}`) MUST montar efetivamente o **editor em abas** já
  construído na Feature 019, exibindo Informações básicas, GES, Revisões e Visão consolidada.
- **FR-002**: A montagem MUST **reutilizar** os componentes existentes, sem duplicá-los nem
  reimplementá-los.
- **FR-003**: Funcionalidades da Fase 05 (Cor/Sumário e Documentos GED) MUST permanecer como
  **placeholders desabilitados**, sem prometer comportamento que não existe.
- **FR-004**: O acesso à tela MUST continuar sob o gate de equipe de escritório e isolado por tenant.

#### Revisões

- **FR-005**: O sistema MUST calcular o **número da próxima revisão no servidor** (maior número
  existente daquele PGR + 1; primeira revisão = 1). O campo `revisionNumber` MUST ser **proibido** no
  input público de criação (schema **estrito**): se enviado, a requisição MUST ser **rejeitada com
  `VALIDATION` (422)** — ele **MUST NOT** ser silenciosamente ignorado, porque um cliente desatualizado
  precisa **falhar visivelmente** em vez de acreditar que controla o número. A UI **MUST NOT** exibir
  campo de número de revisão.
- **FR-006**: A criação de revisão MUST calcular o próximo `revision_number` **exclusivamente no
  servidor**, dentro da **mesma transação** da inserção. O sistema MUST **serializar** criações
  concorrentes para o **mesmo PGR** — por lock da linha-pai ou mecanismo transacional equivalente —
  garantindo números **únicos e consecutivos**, e o lock MUST ser **por PGR** (PGRs distintos não se
  bloqueiam). O cliente **MUST NOT** definir o número final da revisão. A constraint UNIQUE
  `(org_id, pgr_id, revision_number)` permanece como **backstop defensivo**: uma violação inesperada
  MUST reutilizar o mapeamento `DUPLICATE` (409), mas **não é o resultado esperado** da concorrência
  normal.
- **FR-007**: Uma revisão MUST registrar **número**, **data** (`revised_at`) e **notas** (`notes`).
- **FR-008**: O histórico de revisões MUST ser listável, ordenado por número decrescente.
- **FR-009**: A UI de revisões MUST exibir **somente número, data e notas**. Ela **MUST NOT** exibir
  nem prometer **autor**, porque o autor **não é persistido** e o audit log é efêmero (linha de log,
  não tabela) e sequer registra o ator no caminho REST.
- **FR-010**: A operação de criação de revisão MUST emitir o evento de auditoria existente,
  entendendo-se que isso **não** constitui um campo histórico de autor consultável.
- **FR-011**: Revisões MUST ser isoladas por tenant: PGR inexistente ou de outro tenant → `NOT_FOUND`;
  papel `client` → `FORBIDDEN`.

#### Visão consolidada (extensão read-only)

- **FR-012**: A visão consolidada MUST ser **estendida** — não reescrita — para incluir, por risco, os
  **EPIs vinculados** (a partir do vínculo EPI×risco já existente).
- **FR-013**: A visão consolidada MUST incluir o **plano 5W2H completo** das medidas de controle
  (os seis campos já persistidos), e não apenas responsável e prazo.
- **FR-014**: A visão consolidada MUST incluir os campos já persistidos de risco e de avaliação
  vigente necessários à revisão do documento (incluindo agente de risco, fontes geradoras e os dados
  do eSocial S-2240 **que já existem no modelo**). Campos inexistentes no modelo **MUST NOT** ser
  inventados.
- **FR-015**: A ordenação MUST manter riscos avaliados primeiro, por nível de risco decrescente, e os
  **sem avaliação por último**.
- **FR-016**: A consolidada MUST tratar os fallbacks (sem GES, sem riscos, sem avaliação, sem medidas,
  sem EPI) com estados vazios explícitos.
- **FR-017**: A consolidada MUST permanecer **read-only** e **sem N+1** (consultas em lote), e MUST
  permanecer reutilizável pela geração documental da Fase 05.

#### Assinatura do PGR

- **FR-018**: O sistema MUST permitir que a equipe de escritório crie uma **solicitação de assinatura
  vinculada a um PGR**, reutilizando a infraestrutura genérica de assinatura da Fase 0.
- **FR-019**: A implementação MUST registrar o PGR como um **novo tipo de alvo** no registry de tipos
  da infraestrutura existente. Ela **MUST NOT** criar tabelas, colunas, enums ou uma infraestrutura
  paralela de assinatura, nem replicar o token inline usado pelo módulo de EPI.
- **FR-020**: A solicitação MUST reaproveitar, sem redefinir: token público de alta entropia,
  **armazenamento apenas do hash** do token, **expiração**, **uso único**, proteção contra replay e
  isolamento por tenant.
- **FR-021**: O sistema MUST fornecer, na tela protegida do PGR, o **link público copiável** e o
  **estado atual** da assinatura.
- **FR-022**: O estado de assinatura do PGR MUST ser **derivado** da solicitação/captura existente —
  _sem solicitação_, _aguardando assinatura_, _assinado_, _expirado/indisponível_. O sistema
  **MUST NOT** criar coluna de status, coluna `signed`/`signed_at` nem enum de status no `pgr`.
- **FR-023**: A página pública de assinatura MUST ser acessível **sem sessão autenticada** e exibir um
  **resumo mínimo** do PGR, suficiente para o signatário saber o que assina e nada além disso. Esse
  resumo MUST ser um **snapshot mínimo capturado no momento da criação da solicitação** e armazenado
  no payload da infraestrutura existente — alterações posteriores no PGR **não** modificam links já
  emitidos. O payload público **MUST NOT** conter dados de funcionários, trabalhadores expostos, CPF,
  e-mail, telefone, matrículas ou outras informações pessoais; e **MUST NOT** conter a visão
  consolidada completa, a lista integral de riscos, medidas ou EPIs, nem dados internos do tenant.

  Duas consequências que o plano MUST assumir: (1) o conteúdo exibido publicamente **congela** no
  instante em que o link é criado; (2) o **payload armazenado define toda a superfície de exposição
  pública** — a página pública não consulta o PGR ao vivo.

- **FR-024**: O registro da assinatura MUST capturar **nome do signatário**, a **assinatura** conforme
  o mecanismo existente e a **data**, vinculados exclusivamente ao PGR daquela solicitação.
- **FR-025**: O sistema **MUST NOT** coletar CPF, IP, user-agent, geolocalização, biometria nem
  certificado ICP-Brasil nesta V1.
- **FR-037**: A criação de solicitação de assinatura de PGR MUST reutilizar a **política de cota
  mensal já existente** da infraestrutura de assinatura. O contador é **por tenant e por mês e soma
  todos os tipos de alvo** de assinatura. O plano `free` mantém o limite atualmente implementado; o
  plano `pro` permanece **ilimitado**. Com a cota esgotada, o sistema MUST reutilizar o erro existente
  **`QUOTA_EXCEEDED`**, mapeado para **HTTP 402** na superfície REST. O sistema **MUST NOT** criar
  cota específica para PGR, alterar billing ou planos, nem introduzir bypass de cota. Uma cota
  separada para PGR permanece como **follow-up fora desta fatia**.

#### Segurança do fluxo público

- **FR-026**: O token MUST ser a **única credencial** do fluxo público; nenhuma sessão Clerk pode ser
  exigida do signatário.
- **FR-027**: O tenant do fluxo público MUST ser resolvido a partir do **registro interno do token**.
  O sistema **MUST NOT** aceitar `orgId`, `organizationId` ou `organization_id` vindos do cliente em
  nenhuma superfície.
- **FR-028**: A rota pública de assinatura MUST estar **efetivamente liberada** no proxy/middleware —
  hoje ela **não está** — e MUST ter política de **não-cache** (`no-store`).
- **FR-029**: Token inválido, inexistente, expirado, já utilizado ou cancelado MUST produzir resposta
  **segura e mínima**, **sem escrita** e **sem permitir enumeração**: não pode revelar se o PGR
  existe, a que tenant pertence, nem se o token já existiu.
- **FR-030**: Um token de um tenant MUST NOT ler nem escrever dados de outro tenant.
- **FR-031**: Todas as entradas do fluxo público MUST ser validadas por esquema antes de qualquer
  escrita.
- **FR-032**: O token cru **MUST NOT** ser persistido nem aparecer em logs.

#### Documentação e Postman (reconciliação)

- **FR-033**: A entrega MUST **restaurar** a pasta `Dashboard (plataforma)` e o request
  `GET /api/v1/dashboard/summary` na coleção Postman, **preservando** as pastas `Perfil (plataforma)`
  e `Equipe (plataforma)` **antes** de adicionar os contratos desta feature.
- **FR-034**: A coleção MUST permanecer **JSON válido**, em **arquivo único**, sem marcadores de
  conflito, com a ordem Perfil → Equipe → Dashboard → PGR/assinatura → Integrações externas.
- **FR-035**: Toda superfície HTTP nova MUST ser registrada em `docs/api/api-design.md` e na coleção
  Postman, seguindo a regra do projeto de que uma superfície REST só está pronta com docs + Postman.

#### Erros

- **FR-036**: O sistema MUST reutilizar os códigos de erro de domínio existentes: `NOT_FOUND` (404)
  para PGR inexistente/cross-tenant, `DUPLICATE` (409) para colisão de número de revisão,
  `VALIDATION` (422) para entrada inválida, `FORBIDDEN` (403) para papel sem permissão, e os códigos
  já definidos pela infraestrutura de assinatura para os estados de token e de cota. Códigos novos
  **MUST NOT** ser inventados se um existente cobre o caso.

### Key Entities

- **PGR**: o documento de gestão de riscos do tenant. Nesta fatia é **lido**, nunca ganha colunas.
  Seu estado de assinatura é **derivado**, não armazenado nele.
- **Revisão do PGR** (`pgr_revisions`): marco regulatório do documento — número, data e notas.
  Único por `(tenant, PGR, número)`. **Não guarda autor nem conteúdo da versão.**
- **Solicitação de assinatura** (infraestrutura da Fase 0): pedido de assinatura apontando para um
  alvo polimórfico — nesta fatia, um PGR. Guarda o **hash** do token, expiração, uso e estado.
- **Captura de assinatura** (infraestrutura da Fase 0): resultado 1:1 da solicitação — nome do
  signatário, imagem da assinatura, método e data.
- **Visão consolidada**: estrutura **derivada, não persistida**, que agrega PGR → GES → riscos →
  avaliação vigente → medidas (5W2H) → EPIs. É o insumo que a Fase 05 vai reaproveitar.

### Estados reais da assinatura (para o plano — não inventar estados)

Os estados abaixo são os **realmente suportados** pela infraestrutura existente. O plano MUST
reutilizá-los, **sem criar enum novo** e sem renomear comportamento:

- **Fluxo público**: `signable` · `invalid` · `expired` · `used`
- **Fluxo protegido**: `pending` · `signed` · `expired` (derivado na leitura) · `cancelled`

Observação registrada: uma solicitação `cancelled` **aparece como `used`** no resolvedor público
atual. Isso é **seguro** (estado terminal, sem escrita) e **não deve ser alterado silenciosamente**
por esta fatia. Os estados de negócio da US4 (_sem solicitação · aguardando assinatura · assinado ·
expirado/indisponível_) são a leitura de produto desses estados reais — o plano MUST mapeá-los aos
enums existentes, sem mudar o comportamento esperado.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O número da próxima revisão é atribuído pelo servidor; um cliente que não envia número
  nenhum consegue criar revisões com a sequência correta (1, 2, 3, …). O número final **não depende de
  nenhum dado fornecido pelo cliente** — um número enviado no corpo é **rejeitado** (422).
- **SC-002**: Duas criações concorrentes para o **mesmo PGR** resultam em **duas** revisões
  persistidas, com números **distintos e consecutivos** — nenhuma revisão é perdida e nunca existem
  duas revisões com o mesmo número no mesmo PGR. A UNIQUE impede corrupção caso ocorra uma colisão
  inesperada, e criações em **PGRs diferentes** não se bloqueiam.
- **SC-003**: Revisões, PGRs e solicitações de assinatura de um tenant são **inacessíveis** a outro
  tenant, em todas as superfícies (tela, ação e API).
- **SC-004**: O editor em abas é efetivamente alcançável ao abrir um PGR — um usuário consegue
  navegar até a aba Revisões e até a Visão consolidada partindo de `/pgr/{id}`.
- **SC-005**: A visão consolidada apresenta, para cada risco, os EPIs vinculados e, para cada medida,
  os seis campos do plano 5W2H já persistidos.
- **SC-006**: A visão consolidada continua sem N+1: o número de consultas não cresce com a quantidade
  de GES ou de riscos do PGR.
- **SC-007**: Um gestor autorizado consegue gerar um link público de assinatura para um PGR e
  visualizar o estado da assinatura na tela do PGR.
- **SC-008**: O link público funciona **sem login** — um signatário sem conta consegue abrir, revisar
  o resumo mínimo e assinar.
- **SC-009**: Um token expirado, já utilizado ou inválido **não** permite registrar assinatura, e
  nenhuma escrita ocorre nesses casos.
- **SC-010**: A página pública não expõe nenhum dado de outro PGR ou de outro tenant, e não permite
  distinguir "token inválido" de "PGR inexistente".
- **SC-011**: O estado "assinado" é derivado da assinatura — **nenhuma coluna nova no `pgr`**.
- **SC-012**: A coleção Postman final contém, simultaneamente, Perfil, Equipe e Dashboard, e é
  **JSON válido**.
- **SC-013**: A entrega é **zero schema e zero migration**: o comando de geração de migrations reporta
  "No schema changes" e nenhum arquivo de migration é criado.
- **SC-014**: As suítes unit e de integração (Postgres efêmero, RLS real), lint, tipos e build passam.

---

## Divergências da issue × realidade aprovada

| Issue original                                | Realidade aprovada nesta spec                                                                                                                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/pgr/`                               | Estrutura real: `src/shared/**` (domínio, repositórios, actions) e `src/app/**` (páginas e REST)                                                                                                                                                               |
| `organization_id`                             | `org_id`, **sempre obtido da sessão/contexto**, nunca do cliente                                                                                                                                                                                               |
| `pgr_revisoes`                                | `pgr_revisions`                                                                                                                                                                                                                                                |
| `revisao_numero` / `data` / `descricao`       | `revision_number` / `revised_at` / `notes`                                                                                                                                                                                                                     |
| `author_id` já existe                         | **Não existe** e **não será criado** nesta V1 (exigiria migration)                                                                                                                                                                                             |
| Autor exibível vindo do audit log             | **Impossível**: o audit log é uma linha de stdout, não é persistido, e o caminho REST nem registra o ator. A UI **não promete autor**                                                                                                                          |
| Revisão automática ao alterar o PGR           | **Fora da V1** — sem snapshot ela não tem valor e infla o histórico                                                                                                                                                                                            |
| Snapshot / comparação / restauração de versão | **Fora da V1** (exigiria migration e decisão de imutabilidade regulatória)                                                                                                                                                                                     |
| Gerar PDF nesta task                          | **Fora** — pertence à **Fase 05** (Gotenberg, autorizado pela constituição 1.4.0, ainda não implantado). Fazê-lo aqui duplicaria entregáveis já inventariados                                                                                                  |
| "Gutenberg"                                   | O serviço é **Gotenberg**                                                                                                                                                                                                                                      |
| CPF / IP na assinatura                        | **Fora** — a captura existente não tem essas colunas; incluí-las exigiria migration e aumentaria PII                                                                                                                                                           |
| Status `assinado` no `pgr`                    | **Estado derivado** da solicitação/captura; `pgr` não tem (nem ganhará) coluna de status                                                                                                                                                                       |
| Testes com SQLite em memória                  | **Não existe SQLite** no projeto: integração roda em **Postgres efêmero** com RLS real                                                                                                                                                                         |
| "É só reusar a assinatura da Fase 0"          | Reuso **é viável e zero-migration** (o tipo de alvo é texto livre, comprovado por teste de extensibilidade). Mas a infra **não** entrega CPF, IP, user-agent nem revogação, e a **rota pública nem está liberada no proxy** — a premissa "é só plugar" é falsa |
| EPIs já presentes na consolidada              | **Não estão.** O vínculo EPI×risco existe, mas a consolidada não o inclui — daí a extensão read-only                                                                                                                                                           |
| Aba Revisões já entregue e disponível         | O componente existe, mas **não está montado**: `/pgr/{id}` ainda é a tela pré-019                                                                                                                                                                              |
| Plano 5W2H completo na consolidada            | Só **2 de 6** campos chegam à consolidada hoje                                                                                                                                                                                                                 |

---

## Assumptions

- **A montagem do editor é correção de integração**, não reimplementação: os componentes da Feature
  019 são reaproveitados como estão, salvo o ajuste necessário para o número da revisão vir do servidor.
- **A infraestrutura de assinatura é reutilizada como está.** Como o tipo de alvo é texto livre e a
  extensibilidade já é coberta por teste, registrar o PGR como novo tipo **não exige migration**.
- **A cota de assinaturas do plano é herdada** (regra normativa em **FR-037**; este item é apenas a
  explicação do porquê). A criação de solicitação já é limitada por plano (`free` com cota mensal;
  `pro` ilimitado) e o contador existente é **por tenant/mês somando todos os tipos de alvo** — de
  modo que solicitações de PGR passam a consumir essa mesma cota **por consequência do reuso**, sem
  código de cota novo. Esta fatia **não** redefine a política de cota.
- **O estado "cancelado" da solicitação existe no modelo mas não tem quem o escreva.** Esta fatia
  **trata** esse estado com segurança no fluxo público (terminal, sem escrita), mas **não** entrega
  uma ação de revogação — isso fica explicitamente fora do escopo.
- **A liberação da rota pública no proxy é pré-requisito**, não item opcional: sem ela a US5 não é
  alcançável. É correção de um defeito existente na infraestrutura da Fase 0.
- **O resumo mínimo da página pública** contém apenas o necessário para identificar o documento a ser
  assinado; a definição exata do conjunto de campos é decisão do plano, respeitando FR-023 e FR-029.
- **Data de revisão** é informada pelo usuário (o modelo já a suporta com default de hoje); apenas o
  **número** passa a ser calculado pelo servidor.

---

## Out of Scope

Declarado explicitamente — nada abaixo entra nesta fatia:

- **Migration**, alteração de schema, coluna, enum ou tabela nova — de qualquer tipo.
- `author_id` / `author_name` / **autor persistido** na revisão.
- **Snapshot** do conteúdo da versão, **comparação** entre versões, **restauração** de versão.

  > **Desambiguação de "snapshot".** Fica fora desta fatia o **snapshot completo do conteúdo do PGR**
  > destinado a **versionamento, comparação ou restauração** de versões. Essa exclusão **não se
  > aplica** ao **snapshot mínimo do payload público da assinatura** exigido pela **FR-023**, que
  > contém apenas os dados necessários à identificação consciente do documento e permanece
  > **congelado** no momento da criação da solicitação. São conceitos distintos: um congela o
  > documento inteiro para poder restaurá-lo (**proibido**); o outro congela um resumo mínimo para
  > exibir a um signatário (**obrigatório**).

- **Revisão automática** e qualquer gatilho/trigger que crie revisão em alterações do PGR, GES,
  riscos, avaliações ou medidas.
- Versionamento individual de risco, medida ou GES.
- **CPF**, **IP**, **user-agent**, geolocalização, biometria, certificado **ICP-Brasil**.
- **Status persistido** no `pgr` (`signed`, `signed_at`, enum de status).
- **Ação de revogação** de solicitação de assinatura.
- **PDF**, **Gotenberg**, Puppeteer, `@react-pdf/renderer`, HTML final para impressão, template final
  do PGR — tudo isto é **Fase 05**.
- **GED**, storage, upload, download, URL assinada de documento, tabela de documentos.
- **Capa gerada**, **cor de capa persistida**, **sumário configurável persistido**.
- Alterações em tabelas que a feature não precisa tocar.

---

## Dependências e riscos

- **Depende de**: infraestrutura de assinatura da Fase 0 (`signature_requests` / `signature_captures`
  e seus helpers); vínculo EPI×risco; visão consolidada e revisões da Feature 019; padrões de tenant
  (`requireOfficeStaff`, `officeAction`, `withOrg`, `restHandler`, RLS `app_runtime`).
- **Risco 1 — A rota pública não está liberada no proxy.** É um defeito real e **bloqueante** para a
  US5. Precisa ser corrigido nesta fatia, com teste que prove o acesso público sem sessão.
- **Risco 2 — Cota do plano.** Solicitações de assinatura de PGR consomem a cota mensal do plano
  `free`. Se isso for indesejável para o produto, é decisão de negócio a ser levantada **antes** do
  plano — não uma mudança silenciosa de código.
- **Risco 3 — Expectativa de "autor" na issue.** A UI não vai exibir autor. Se o negócio exigir autor
  histórico, isso é **outra fatia com migration**, e deve ser aberto como issue própria.
- **Risco 4 — Limitação conhecida do harness REST-via-Jest** (pode retornar 500). Validação por cURL
  real quando ocorrer, comparando com a baseline já documentada nas suítes existentes.

---

## Ambiente de testes

- Integração contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL`, `INTEGRATION_APP_RUNTIME_URL`),
  com **RLS real** pelo papel `app_runtime`. **Nunca SQLite. Nunca Supabase compartilhado** para seed
  destrutivo. **Nenhum secret** impresso em log.
- **Unit**: o input de criação **rejeita `revisionNumber`** com `VALIDATION` (schema estrito — o
  cliente não consegue escolher o número); próximo número com **histórico vazio** (→ 1); próximo número
  com **revisões existentes** (→ max+1); validação da revisão; ordenação do histórico; ordenação da consolidada (risco sem
  avaliação por último); mapeamento de EPIs; mapeamento dos 6 campos do 5W2H; derivação do estado de
  assinatura; token expirado; token usado; validação da assinatura.
  - **Cota**: cota disponível no plano `free`; cota **excedida** no plano `free`; plano `pro` **sem
    limite mensal**; **contador compartilhado entre diferentes `target_type`**; mapeamento de
    `QUOTA_EXCEEDED`.
  - **Snapshot público**: composição do **payload mínimo**; **ausência** de dados de funcionários e
    de trabalhadores expostos; **ausência** da consolidada completa no payload; o snapshot **não
    muda** quando o PGR é editado depois.
- **Integração**: revisão manual; número calculado no servidor; primeira revisão = 1; cross-tenant
  (`NOT_FOUND`); `FORBIDDEN` para `client`; consolidada com EPIs e com 5W2H completo; criação de
  solicitação de assinatura e seu tenant; token válido / inválido / expirado / usado; replay
  bloqueado; registro da assinatura; isolamento RLS.
  - **Concorrência de revisão**: duas criações simultâneas para o **mesmo PGR** → **ambas persistidas**,
    com números **distintos e consecutivos**, **nenhuma perdida**; criações em **PGRs diferentes** não
    se bloqueiam (lock não é global); a **UNIQUE permanece ativa** (colisão inesperada → `DUPLICATE`,
    como backstop).
  - **Cota**: criação de solicitação de assinatura de PGR **com cota disponível**; criação com **cota
    mensal esgotada** retornando `QUOTA_EXCEEDED`; **contador mensal compartilhado** entre assinaturas
    de `target_type` diferentes; plano `pro` **não bloqueado** pela cota do plano `free`.
  - **Snapshot público**: a solicitação **persiste o snapshot mínimo**; a página pública **lê o
    payload da solicitação, sem consultar o PGR ao vivo**; alteração posterior do PGR **não modifica**
    o conteúdo de uma solicitação já criada; o payload público **não contém dados pessoais** de
    funcionários.
- **REST/cURL**: endpoints protegidos; criação da solicitação; consulta e assinatura públicas; os
  estados de token; e os códigos **`402`** (cota — `QUOTA_EXCEEDED`), **`403`**, **`404`**, **`409`**
  e **`422`** — com **cURL real** quando o harness Jest esbarrar na limitação conhecida. Nenhum código
  de erro novo é criado: todos são reutilizados da infraestrutura existente.
- **UI (Playwright MCP)**: editor em abas montado; aba Revisões; geração/cópia do link; página pública
  **sem credencial Clerk**; assinatura; token expirado/usado. O editor protegido pode ficar bloqueado
  sem credencial Clerk, desde que isso seja documentado.
- **Segurança**: não-enumeração (token inválido e entidade inexistente permanecem
  **indistinguíveis**); replay; isolamento; **nenhuma exposição de funcionários/trabalhadores
  expostos**; **nenhuma exposição da lista completa de riscos, medidas ou EPIs**; payload público
  **mínimo e estático**; token cru ausente dos logs; nenhum tenant vindo do cliente.
