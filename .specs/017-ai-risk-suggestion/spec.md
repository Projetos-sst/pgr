# Feature Specification: Sugestão de riscos assistida por IA

**Feature Branch**: `feature/ai-risk-suggestion`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "No inventário de riscos de um GES, um botão 'Sugerir Riscos com IA'
coleta o contexto do GES (processo, ambiente, funções expostas), consulta um LLM e devolve uma lista
estruturada de riscos para o gestor de SST revisar, selecionar e adicionar ao inventário como rascunho;
além disso, exibe dicas de preenchimento nos campos críticos dos formulários de GES e de risco. É a
primeira feature que chama um LLM externo e a primeira que envia dados do tenant para fora."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sugerir e revisar riscos por IA (Priority: P1)

Como gestor de SST, ao montar o inventário de riscos de um GES, quero acionar uma sugestão automática
baseada no contexto do GES (processo produtivo, ambiente e funções expostas), revisar a lista proposta,
escolher quais riscos fazem sentido e adicioná-los ao inventário como **rascunho** — para acelerar o
levantamento sem perder o controle editorial. Nada é adicionado sem a minha aprovação, e eu completo os
campos obrigatórios (avaliação, controles) depois.

**Why this priority**: É o coração da feature e o único fluxo que entrega valor de ponta a ponta
(agilizar o inventário de riscos). Sozinho já constitui um MVP demonstrável; a US2 é complementar.

**Independent Test**: Com um GES de contexto bem preenchido, acionar "Sugerir Riscos com IA", conferir
que a lista devolvida é estruturada (agente, perigo, descrição, fontes), selecionar um subconjunto,
confirmar e verificar que apenas os selecionados aparecem no inventário do GES como rascunho — sem que
nenhum tenha sido adicionado automaticamente.

**Acceptance Scenarios**:

1. **Given** um GES do tenant ativo com processo/ambiente/funções descritos, **When** o gestor aciona
   "Sugerir Riscos com IA", **Then** o sistema exibe uma lista de riscos sugeridos (agente, perigo,
   descrição, fontes geradoras) para revisão, sem persistir nada ainda.
2. **Given** uma lista de sugestões exibida, **When** o gestor seleciona alguns itens e confirma,
   **Then** apenas os itens selecionados são adicionados ao inventário do GES como rascunho (sem
   avaliação e sem controles) e os não selecionados são descartados.
3. **Given** uma lista de sugestões exibida, **When** o gestor fecha/descarta sem selecionar,
   **Then** nada é adicionado ao inventário.
4. **Given** um GES com contexto muito vago, **When** o gestor aciona a sugestão, **Then** o sistema
   informa que não há sugestões relevantes e orienta a descrever melhor o processo/ambiente.
5. **Given** o gestor pediu uma sugestão para um GES, **When** o pedido é processado, **Then** o uso é
   contabilizado para efeito de cota mensal da organização.

---

### User Story 2 - Dicas de preenchimento nos formulários (Priority: P2)

Como gestor de SST, quero ver dicas de preenchimento nos campos críticos dos formulários de GES e de
risco — para garantir qualidade e conformidade com a NR-01 ao descrever processo, ambiente, funções,
fontes geradoras, propagação e possíveis lesões.

**Why this priority**: Complementa a US1 melhorando a qualidade do contexto que alimenta a sugestão,
mas não é pré-requisito para o fluxo principal; pode ser entregue e testado de forma independente.

**Independent Test**: Abrir o formulário de GES e o de risco e verificar que os campos críticos exibem
uma dica de orientação clara, sem depender de nenhuma chamada externa.

**Acceptance Scenarios**:

1. **Given** o formulário de GES aberto, **When** o gestor visualiza os campos de descrição do
   processo, ambiente e funções, **Then** cada um exibe uma dica de preenchimento orientada à NR-01.
2. **Given** o formulário de risco aberto, **When** o gestor visualiza os campos de fontes geradoras,
   propagação e possíveis lesões, **Then** cada um exibe a dica correspondente.

---

### Edge Cases

- **Contexto insuficiente**: GES com processo/ambiente/funções vagos → a sugestão pode retornar poucos
  ou nenhum item; a interface mostra estado "nenhuma sugestão — descreva melhor o processo/ambiente".
- **Falha do serviço de IA**: indisponibilidade, timeout, erro do provedor ou credencial ausente → o
  sistema informa que a sugestão está indisponível **sem vazar detalhes do provedor**; o cadastro do GES
  permanece intacto e o gestor pode seguir cadastrando manualmente.
- **Cota esgotada**: organização em plano gratuito que atingiu o limite mensal → o pedido é bloqueado
  com mensagem clara; o plano pago não tem esse limite.
- **Sugestão parcialmente inválida**: se um item vier com um agente fora do conjunto reconhecido ou sem
  descrição, o **item** é descartado, não o lote inteiro.
- **GES de outra organização**: pedido para um GES que não pertence ao tenant ativo é rejeitado como
  "não encontrado" **antes** de qualquer chamada externa (isolamento).
- **Duplicidade**: uma sugestão pode repetir um risco já presente no inventário; o sistema não impede a
  adição (a decisão fica com o gestor durante a revisão).
- **Aceite vazio/ inválido**: confirmar sem itens válidos selecionados resulta em erro de validação e
  nada é persistido.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST oferecer, no inventário de riscos de um GES, uma ação para solicitar
  sugestões de riscos geradas por IA.
- **FR-002**: O sistema MUST montar o contexto enviado à IA **exclusivamente** a partir de campos
  descritivos do GES (processo produtivo, ambiente e **títulos** das funções expostas), NUNCA incluindo
  dados de funcionários (nome, CPF ou qualquer PII).
- **FR-003**: O sistema MUST retornar as sugestões em formato estruturado e previsível, com pelo menos:
  agente/tipo de risco, perigo, descrição e fontes geradoras.
- **FR-004**: O sistema MUST apresentar as sugestões para revisão e seleção **sem persistir nada**
  automaticamente.
- **FR-005**: Usuários MUST poder selecionar um subconjunto das sugestões e adicioná-lo ao inventário do
  GES como **rascunho** (risco sem avaliação e sem controles associados).
- **FR-006**: O sistema MUST descartar, na recepção da resposta da IA, qualquer item malformado ou com
  agente/tipo não reconhecido, preservando os itens válidos do mesmo lote.
- **FR-007**: O sistema MUST validar que o GES pertence à organização ativa **antes** de qualquer
  chamada ao serviço de IA; um GES de outra organização é tratado como não encontrado.
- **FR-008**: O sistema MUST aplicar um limite mensal de sugestões por organização conforme o plano: o
  plano gratuito tem cota mensal finita; o plano pago é ilimitado. Pedidos além da cota são bloqueados.
- **FR-009**: O sistema MUST contabilizar cada pedido de sugestão para efeito da cota mensal da
  organização, de forma que a contagem sobreviva a reinícios do servidor.
- **FR-010**: O sistema MUST tratar qualquer falha, timeout ou indisponibilidade da IA como um erro
  amigável e específico, sem vazar detalhes internos do provedor e sem bloquear o cadastro do GES.
- **FR-011**: O sistema MUST manter a chave de acesso ao serviço de IA **apenas no servidor**, nunca
  exposta ao cliente.
- **FR-012**: O sistema MUST expor a capacidade de sugestão e de aceite tanto pela interface (ação de
  servidor) quanto por uma superfície REST equivalente, reaproveitando a **mesma** regra de negócio
  (sem reimplementar a lógica em duas superfícies).
- **FR-013**: O sistema MUST exibir dicas de preenchimento nos campos críticos dos formulários de GES
  (descrição do processo, ambiente, funções) e de risco (fontes geradoras, propagação, possíveis
  lesões), orientadas à NR-01.
- **FR-014**: O sistema MUST restringir a ação de sugestão/aceite a papéis de escritório (proprietário/
  colaborador); o papel cliente MUST ser proibido.
- **FR-015**: O aceite de sugestões MUST reutilizar o mesmo caminho de criação de risco já existente,
  de modo que os riscos criados por IA sejam indistinguíveis (em estrutura e regras) dos criados
  manualmente.

### Key Entities _(include if feature involves data)_

- **Risco sugerido (transitório)**: proposta devolvida pela IA antes da aprovação — agente/tipo,
  perigo, descrição, fontes geradoras. Não é persistido enquanto não for aceito.
- **Risco (inventário)**: entidade já existente do domínio, escopada ao GES e à organização. O aceite
  cria riscos em estado **rascunho** (sem avaliação e sem medidas de controle) reutilizando a estrutura
  existente. "Rascunho" é um **estado derivado** (ausência de avaliação/controles), não um novo campo.
- **Evento de uso de IA**: registro append-only por organização usado para derivar a contagem mensal de
  pedidos (base da cota). Atributos mínimos: organização, tipo de uso, momento de criação.
- **Dica de preenchimento**: texto estático de orientação associado a um campo específico dos
  formulários de GES/risco.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Para um GES com contexto bem preenchido, a IA sugere **ao menos 3 riscos relevantes**.
- **SC-002**: **Nenhum** risco sugerido é adicionado ao inventário sem aprovação explícita do gestor
  (100% dos itens persistidos passaram por seleção).
- **SC-003**: **Nenhum** dado sensível da organização (funcionários/CPF) é enviado ao serviço de IA
  além do contexto do GES — verificável no conteúdo efetivamente enviado.
- **SC-004**: A cota mensal do plano gratuito é respeitada — pedidos além do limite são bloqueados; o
  plano pago não sofre bloqueio por cota.
- **SC-005**: Uma falha do serviço de IA **não bloqueia** o cadastro: o gestor vê um estado de
  carregamento e, em caso de erro, uma mensagem clara, com o GES intacto.
- **SC-006**: As dicas de preenchimento aparecem em **todos** os campos críticos definidos dos
  formulários de GES e de risco.
- **SC-007**: A verificação de pertencimento do GES à organização ocorre **antes** da chamada externa —
  um pedido cross-tenant nunca dispara uma chamada ao serviço de IA.

## Assumptions

Decisões tomadas com base em padrões já existentes no projeto e no comportamento já implementado
(as-built). Registradas aqui para revisão; podem ser reabertas em `/speckit-clarify`.

- **Rate limiting**: a contagem mensal é **derivada de um registro persistido append-only por
  organização** (espelhando como a assinatura digital conta pedidos no mês corrente), e não de um
  contador em memória — necessário porque o ambiente é serverless. Cota mensal do plano gratuito
  assumida em **20 pedidos/mês**; plano pago ilimitado.
- **Estado "rascunho"**: representado como **estado derivado** (risco sem avaliação e sem controles),
  sem novo campo/flag nem nova tabela de risco — reutiliza a modelagem de riscos existente.
- **Dicas de preenchimento**: **estáticas** (texto curador orientado à NR-01), não geradas
  dinamicamente por LLM nesta versão.
- **Superfície de API**: além da ação de servidor (interface), há **espelho REST** equivalente,
  conforme a regra de superfície de API do projeto (ação + REST + docs + coleção de testes de API).
- **Modelo de IA**: **configurável por ambiente**, com um modelo padrão definido; sem streaming da
  resposta nesta versão (resposta estruturada única).
- **Deduplicação**: sugestões que repetem riscos já inventariados **não** são bloqueadas
  automaticamente; a decisão fica com o gestor na revisão (não há restrição de unicidade em riscos).
- **Escopo**: o tenant é sempre resolvido a partir da sessão (organização ativa), nunca de entrada do
  cliente; toda leitura/escrita passa pelo isolamento por tenant.
- **Fora de escopo**: streaming da resposta; dicas dinâmicas por LLM; auto-avaliação (matriz 5×5)
  sugerida por IA; qualquer envio de dados de funcionários/PII; geração do documento de PGR.
