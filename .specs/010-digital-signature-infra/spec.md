# Feature Specification: Infraestrutura de assinatura digital (links públicos com token + QR + captura)

**Feature Branch**: `feature/digital-signature-infra`

**Created**: 2026-06-28

**Status**: Draft

**Issue**: #67 · `[Fase 00] 05` · Milestone "Fase 00 — Fundação"

**Fonte da verdade**: `docs/briefings/briefing-digital-signature-infra.md` (decisões travadas no brainstorming). Em conflito entre este documento e o briefing, **o briefing prevalece**.

**Input**: User description: "Infraestrutura de assinatura digital por link público com token — camada de PLATAFORMA, transversal e reutilizável (DRY), consumida por múltiplos módulos (entrega de EPI, Ordem de Serviço, inspeção de segurança, PGR, foto 3x4, questionário psicossocial). Permite que um membro do escritório gere, para um registro/evento de qualquer módulo, um link público (e QR Code) protegido por token, que um terceiro SEM login acessa para assinar digitalmente. A assinatura é persistida e vinculada ao registro de origem, e o status (Aguardando → Assinado) reflete em tempo real na tela interna. Tudo isolado por tenant e respeitando o plano free/pro."

---

## Contexto e enquadramento

Esta é uma fatia de **infraestrutura transversal**, não um módulo de negócio. Entrega um mecanismo único de coleta de assinatura por link público com token, para ser **reutilizado** por vários módulos do produto (DRY). O escopo desta fatia prova o mecanismo ponta a ponta com um **consumidor de demonstração**; consumidores reais (ex.: entrega de EPI) são plugados em fatias futuras sem alterar o modelo de dados.

A spec descreve **o quê** e **por quê**. As decisões técnicas ("o como" — modelo de tabelas, bibliotecas, nomes de arquivo, estratégia de tempo real) já estão consolidadas no briefing e pertencem ao `/speckit-plan`.

**Arquivos lidos para escrever esta spec**: `docs/briefings/briefing-digital-signature-infra.md` (fonte da verdade); `.specs/005-modelo-tenant-gate-pro/spec.md` (regras de plano, Inv-1); `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md` (motor de isolamento e padrão de RLS); `CLAUDE.md` (camadas, `officeAction`/`restHandler`, `ActionResult`, política de testes); `src/shared/db/schema/companies.ts` (template de tabela com `org_id` + RLS); `src/shared/db/schema/epis.ts` (colunas dormentes de assinatura em `epi_deliveries`); `src/shared/tenant/active-tenant.ts` e `src/shared/tenant/plan.ts` (resolução do plano do tenant ativo e padrão de helper de gate).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Gerar link/QR assinável sem login (Priority: P1)

Como membro do escritório, quero gerar um QR Code ou link a partir de um registro do sistema para que um terceiro (ex.: funcionário) assine digitalmente **sem precisar de conta ou login**.

**Why this priority**: É a razão de existir da infraestrutura. Sem a geração do link/QR e a captura pública, nada mais tem valor. É a fundação sobre a qual as demais histórias se apoiam.

**Independent Test**: A partir de um registro de demonstração, gerar link + QR; abrir a URL pública em uma sessão sem autenticação e confirmar que o formulário de captura correto (conforme o tipo de alvo) é exibido e aceita a assinatura.

**Acceptance Scenarios**:

1. **Given** um membro do escritório autenticado num tenant, **When** ele gera um pedido de assinatura para um registro, **Then** o sistema produz um link público e um QR Code que embutem um token único, e disponibiliza copiar o link / exibir o QR na tela interna.
2. **Given** um link público válido recém-gerado, **When** um terceiro sem login o abre, **Then** o formulário de captura correspondente ao tipo de alvo é exibido.
3. **Given** o terceiro desenha sua assinatura e informa o nome, **When** confirma o envio, **Then** a assinatura é persistida vinculada ao registro de origem e o pedido passa a "Assinado".

---

### User Story 2 - Acompanhar a confirmação em tempo real (Priority: P1)

Como membro do escritório, quero ver na tela interna que a assinatura foi concluída **sem precisar recarregar a página**, para confirmar a coleta no momento em que acontece.

**Why this priority**: O valor operacional do mecanismo depende de o escritório saber, em tempo hábil, que a assinatura foi feita. Sem feedback imediato, o fluxo presencial (gerar QR → pessoa assina ao lado) não funciona.

**Independent Test**: Com um pedido em estado "Aguardando" aberto na tela interna, concluir a assinatura pela rota pública e observar a tela interna transicionar para "Assinado" sozinha em menos de 5 segundos.

**Acceptance Scenarios**:

1. **Given** um pedido "Aguardando" exibido na tela interna, **When** a assinatura é concluída na rota pública, **Then** a tela interna reflete "Assinado" em menos de 5 segundos, sem ação manual do usuário.
2. **Given** um pedido ainda não assinado, **When** o membro consulta o status, **Then** o sistema informa o estado atual (Aguardando / Assinado / Expirado / Cancelado).

---

### User Story 3 - Reutilização por múltiplos módulos (DRY) (Priority: P1)

Como produto, quero que a mesma infraestrutura sirva a vários módulos por meio de **um único contrato**, para construir uma vez e plugar em cada módulo sem reescrever a coleta de assinatura.

**Why this priority**: A reutilização é o objetivo declarado da issue (#67). Se o mecanismo não for genérico, cada módulo reimplementaria assinatura, anulando o ganho. Tem prioridade P1 porque a forma do contrato condiciona toda a modelagem.

**Independent Test**: Um consumidor de demonstração integra-se exclusivamente pelo contrato; verificar que registrar um novo tipo de consumidor está documentado e **não exige alteração do modelo de dados**.

**Acceptance Scenarios**:

1. **Given** o contrato de consumo único, **When** o consumidor de demonstração gera um pedido, captura a assinatura e lê o status, **Then** todo o ciclo funciona sem código específico fora do contrato.
2. **Given** a necessidade de um novo módulo consumidor, **When** se segue o caminho de extensão documentado, **Then** adicionar o novo tipo de alvo não requer mudança de schema.

---

### User Story 4 - Assinatura manual (fallback) (Priority: P2)

Como membro do escritório, quero registrar uma **assinatura manual** (quando houve assinatura impressa/presencial e o terceiro não pôde assinar pelo dispositivo), para manter o registro completo mesmo sem captura digital.

**Why this priority**: É um caminho de contingência importante, mas secundário ao fluxo digital principal. O produto funciona sem ele no MVP, porém a cobertura de casos reais melhora com ele.

**Independent Test**: A partir de um pedido "Aguardando", marcar como assinado manualmente e confirmar que o registro fica gravado e identificado como assinatura manual.

**Acceptance Scenarios**:

1. **Given** um pedido "Aguardando", **When** o membro registra assinatura manual informando o nome do signatário, **Then** o pedido passa a "Assinado" e o registro indica o método manual.

---

### User Story 5 - Limite de uso por plano (Priority: P3)

Como produto, quero **limitar o volume no plano free** e **liberar ilimitado no pro**, para alinhar o uso ao modelo comercial (conformidade com a spec 005).

**Why this priority**: É regra de monetização/gate, valiosa mas não essencial para provar a infraestrutura. Pode ser validada após o fluxo central existir.

**Independent Test**: Um tenant free é impedido de criar novo pedido após atingir o limite mensal; um tenant pro nunca é impedido.

**Acceptance Scenarios**:

1. **Given** um tenant no plano free que já criou o limite mensal de pedidos, **When** tenta criar mais um pedido no mesmo mês, **Then** a criação é bloqueada com indicação de quota excedida.
2. **Given** um tenant no plano pro, **When** cria pedidos em qualquer volume, **Then** nunca é bloqueado por quota.
3. **Given** qualquer plano, **When** o mês corrente muda, **Then** a contagem considera apenas o mês corrente (reset implícito).

---

### Edge Cases

- **Token expirado antes da assinatura**: ao abrir a rota pública com um token cujo prazo já passou, o terceiro vê um estado "expirado" amigável e **nenhuma gravação** é permitida.
- **Token já utilizado (reuso)**: ao reabrir/reenviar com um token de uso único já consumido, a rota pública informa "já utilizado" e recusa nova gravação.
- **Token inválido/inexistente**: a rota pública retorna estado de erro claro **sem expor dados** de nenhum tenant.
- **Terceiro sem smartphone**: o fluxo de assinatura manual (US4) cobre o caso, do lado interno.
- **Perda de conexão durante a captura**: enquanto o token não tiver sido consumido, a tentativa de envio pode ser repetida; um envio incompleto não marca o pedido como assinado nem deixa captura parcial persistida.
- **Tenant free atinge o limite mensal na criação**: o bloqueio ocorre **na criação** (lado interno, com sessão), nunca na rota pública.
- **Ausência de tenant/token**: sem token (rota pública) ou sem tenant ativo (lado interno) nada é retornado — nunca o conjunto completo de registros.

---

## Requirements _(mandatory)_

### Functional Requirements

**Geração do pedido (US1)**

- **FR-001**: O sistema MUST permitir que um membro do escritório crie um pedido de assinatura para um registro de qualquer módulo consumidor, identificado por um **tipo de alvo** e por uma referência opcional ao registro de origem.
- **FR-002**: O sistema MUST gerar, para cada pedido, um **token único e de alta entropia** (não adivinhável). O token em claro MUST transitar apenas no link/QR e **nunca** ser armazenado em texto claro nem retornado após a criação.
- **FR-003**: O sistema MUST gerar um **link público** e um **QR Code** que apontam para a rota pública de assinatura contendo o token.
- **FR-004**: Cada pedido MUST ter um **prazo de expiração configurável**.
- **FR-005**: Cada token MUST ser de **uso único** (consumido na primeira assinatura bem-sucedida).
- **FR-006**: A tela interna MUST permitir **copiar o link** e **exibir o QR Code** do pedido.

**Rota pública e captura (US1)**

- **FR-007**: O sistema MUST expor uma **rota pública acessível sem autenticação** que valida o token e exibe o **formulário de captura correto conforme o tipo de alvo**.
- **FR-008**: A rota pública MUST resolver o **tenant a partir do token**, nunca de qualquer input fornecido pelo cliente.
- **FR-009**: A rota pública MUST capturar a **assinatura (imagem)** e o **nome do signatário**, persistir o resultado **vinculado ao registro de origem**, marcar o pedido como assinado e consumir o token.
- **FR-010**: Token **inválido/inexistente** MUST resultar em estado de erro claro, sem expor dados de qualquer tenant.
- **FR-011**: Token **expirado** MUST resultar em estado "expirado" amigável, sem permitir gravação.
- **FR-012**: Token **já utilizado** MUST resultar em estado "já utilizado", sem permitir nova gravação.

**Status em tempo real (US2)**

- **FR-013**: A tela interna MUST refletir a transição "Aguardando" → "Assinado" **sem recarga manual**, em **menos de 5 segundos** após a conclusão da assinatura.
- **FR-014**: O sistema MUST permitir consultar o **status de um pedido**, expresso como `pending | signed | expired | cancelled` (o estado "expirado" é **derivado na leitura**, não um estado persistido).

**Contrato reutilizável (US3)**

- **FR-015**: O sistema MUST oferecer um **contrato único de consumo** (criar pedido, consultar status, registrar assinatura manual, submeter assinatura pública) reutilizável por múltiplos módulos.
- **FR-016**: Registrar um **novo tipo de alvo** (novo módulo consumidor) MUST **não exigir alteração do modelo de dados**; o caminho de extensão MUST estar documentado.
- **FR-017**: O sistema MUST incluir um **consumidor de demonstração** que exercita o contrato ponta a ponta.

**Assinatura manual (US4)**

- **FR-018**: O membro do escritório MUST poder registrar **assinatura manual** para um pedido "Aguardando", informando o nome do signatário; o registro MUST ficar identificado como **método manual**.

**Plano free/pro (US5) — conformidade com a spec 005**

- **FR-019**: O limite de uso MUST ser avaliado **na criação do pedido** (superfície interna, com sessão), com base no **plano do tenant ativo** (Inv-1: o plano é do tenant, nunca do usuário).
- **FR-020**: No plano **free**, a criação de pedidos MUST ser **bloqueada ao exceder o limite mensal** (10 pedidos criados por mês), retornando o código de domínio de quota excedida. No plano **pro**, a criação MUST ser **ilimitada**.
- **FR-021**: A contagem de uso MUST considerar apenas o **mês corrente** (reset implícito por filtro de período), sem contador persistido nem rotina agendada.
- **FR-022**: A **rota pública** MUST **nunca** verificar plano ou quota (não há tenant de sessão ali; checar violaria a Inv-1).

**Isolamento, validação e erros (transversais — constituição)**

- **FR-023**: Toda gravação/consulta de dados de assinatura MUST ser **escopada por tenant**. Sem token (rota pública) ou sem tenant ativo (lado interno), nada é retornado; gravação cross-tenant MUST ser rejeitada. Um token de uma organização **nunca** lê/grava dados de outra.
- **FR-024**: Toda Server Action MUST **validar a entrada por schema** antes da regra de negócio.
- **FR-025**: Os erros MUST ser expressos como **códigos de domínio** (`VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `QUOTA_EXCEEDED`) e estados públicos amigáveis ("expirado" / "já utilizado"), nunca HTTP cru.
- **FR-026**: No lado interno, o papel `client` MUST ser recusado com `FORBIDDEN`; apenas membros do escritório (owner/collaborator) podem gerar pedidos, consultar status e registrar assinatura manual.

### Key Entities _(include if feature involves data)_

- **Pedido de assinatura (signature request)**: representa a solicitação de assinatura emitida por um módulo consumidor. Atributos conceituais: tenant de origem, tipo de alvo, referência ao registro de origem (opcional), credencial de acesso público (derivada do token, armazenada de forma não reversível), dados que o formulário exibe ao signatário, estado (pendente/assinado/cancelado), prazo de expiração e marcação de uso. Relaciona-se 1:1 com a captura.
- **Captura de assinatura (signature capture)**: representa o resultado coletado de um pedido. Atributos conceituais: tenant, vínculo único ao pedido, imagem da assinatura, nome do signatário, método de coleta (via QR/link ou manual) e momento da assinatura.
- **Tipo de alvo (target type)**: discrimina qual módulo consumidor originou o pedido e qual formulário/validação se aplica; é o ponto de extensão que permite adicionar novos consumidores sem mudar o modelo de dados.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um terceiro sem login acessa o link e conclui a assinatura; o status na tela interna muda para "Assinado" em **menos de 5 segundos** após a conclusão.
- **SC-002**: Cada token é de **uso único** e expira no tempo configurado; reuso ou uso após expiração retorna mensagem de erro clara, **sem permitir gravação**.
- **SC-003**: A assinatura coletada fica **persistida e recuperável**, vinculada ao registro de origem.
- **SC-004**: O mesmo mecanismo atende a **pelo menos um módulo consumidor (demonstração)** via o contrato único; adicionar novo módulo consumidor **não exige alterar o modelo de dados**.
- **SC-005**: **Nenhum dado de assinatura cruza organizações**: um token de uma organização nunca lê/grava dados de outra; sem token, nada é retornado.
- **SC-006**: No plano free, a criação de pedidos é **bloqueada ao exceder o limite mensal**; no pro **não há bloqueio**. O plano considerado é o do **tenant ativo**.

## Assumptions

- O **consumidor real** desta fatia é um **demo auto-contido** (tipo de alvo `demo`); a entrega de EPI e demais módulos são plugados em fatias futuras pelo caminho de extensão documentado.
- A **imagem da assinatura é pequena** (ordem de dezenas de KB) e é persistida no próprio banco sob isolamento por tenant nesta fatia (storage externo é Out of Scope).
- O **limite do plano free é de 10 pedidos criados por mês**; assinatura **não** era definida como recurso PRO pela spec 005 — esta é uma decisão de produto desta fatia, alinhada às regras de gate da 005.
- O **prazo de expiração padrão** do token é configurável; o valor concreto é decisão de plano/implementação.
- As regras de **plano, tenant ativo e isolamento (withOrg + RLS)** já existem no repositório e são **reutilizadas**, não reconstruídas.
- Os **testes de integração** rodam contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite, conforme CLAUDE.md e a constituição.

## Out of Scope

- **Envio do link** por WhatsApp/SMS/e-mail — depende da issue #66 (camada de integrações externas).
- **Storage externo de imagem** (ex.: Backblaze) — a imagem fica no banco nesta fatia.
- **Integração com o módulo real de entrega de EPI** — vive em branch irmã; apenas o caminho de plug-in é documentado (as colunas dormentes de assinatura em `epi_deliveries` permanecem intocadas).
- **Tempo real via streaming persistente (SSE)** — o critério de atualização (<5s) é atendido por outro meio decidido no plano.
- **Contador/rotina agendada (cron) de quota** — a contagem é derivada pelo mês corrente.

## Dependencies

- **Spec 005** (modelo de tenant + gate free/pro): origem da Inv-1 e das regras de plano que esta fatia honra.
- **Spec 004** (isolamento multi-tenant): motor `withOrg` + padrão de RLS reutilizado, incluindo o caminho da rota pública sem sessão (isolamento derivado do token).
- **Plataforma de auth/tenant existente** (`requireOfficeStaff`, `requireTenantContext`, resolução do plano do tenant ativo).
