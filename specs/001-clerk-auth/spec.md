# Feature Specification: Autenticação e Organizações (base de acesso e isolamento)

**Feature Branch**: `feature/clerk-auth-foundation`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Autenticação e organizações (Clerk) — base de acesso e isolamento. Fatia fundacional do SST Manager que habilita login, cadastro, pertencimento a uma organização ativa e proteção de todas as rotas de negócio."

## User Scenarios & Testing *(mandatory)*

Esta fatia entrega a fundação de identidade e tenant do SST Manager. Sem ela, nenhum módulo de negócio (PGR, EPIs, funcionários, documentos etc.) pode existir, porque todas as regras dependem de saber **quem** é o usuário e a **qual organização** ele pertence na sessão atual.

### User Story 1 - Login do usuário existente (Priority: P1)

Um usuário já cadastrado precisa autenticar-se para acessar a área restrita do SST Manager. A partir da tela pública, ele aciona a opção de login, fornece suas credenciais e, quando autenticado, é direcionado para a área da aplicação.

**Why this priority**: Sem login não há sistema utilizável. É o caminho de entrada de qualquer usuário recorrente e o pré-requisito para qualquer outra história funcionar.

**Independent Test**: Pode ser totalmente validado entrando na aplicação como usuário não autenticado, acionando "entrar", concluindo o fluxo de autenticação e verificando que a área autenticada passa a ser acessível e que a identidade do usuário aparece na interface.

**Acceptance Scenarios**:

1. **Given** um usuário não autenticado na página pública, **When** ele aciona "entrar" e conclui a autenticação com credenciais válidas, **Then** ele é redirecionado para a área autenticada e seu indicador de identidade aparece na interface.
2. **Given** um usuário não autenticado, **When** ele tenta autenticar-se com credenciais inválidas, **Then** o acesso é negado e ele permanece fora da área autenticada, com mensagem clara sobre a falha.
3. **Given** um usuário autenticado, **When** ele aciona "sair", **Then** sua sessão é encerrada e qualquer tentativa subsequente a uma rota protegida exige novo login.

---

### User Story 2 - Cadastro de nova conta (Priority: P1)

Um usuário novo precisa criar sua conta para começar a usar o SST Manager. A partir da tela pública, ele aciona a opção de cadastro, fornece os dados solicitados, conclui o fluxo e passa a ter sessão ativa.

**Why this priority**: Sem cadastro não há entrada de novos usuários no sistema. Forma o par natural com o login para o ciclo de vida da identidade. P1 porque a aplicação nasce sem usuários e precisa permitir o primeiro acesso.

**Independent Test**: Pode ser validado isoladamente entrando como visitante, acionando "criar conta", completando o fluxo e confirmando que, ao final, o usuário está autenticado e visualiza a área restrita.

**Acceptance Scenarios**:

1. **Given** um visitante na página pública, **When** ele aciona "criar conta" e completa o cadastro com dados válidos, **Then** sua conta é criada e ele passa a ter sessão ativa na aplicação.
2. **Given** um visitante tentando se cadastrar com dados inválidos ou incompletos, **When** ele submete o formulário, **Then** o cadastro é recusado com mensagem clara e a conta não é criada.
3. **Given** um usuário recém-cadastrado, **When** ele acessa a aplicação pela primeira vez, **Then** ele entra no fluxo de seleção/entrada de organização (US4) antes de operar dados de negócio.

---

### User Story 3 - Página inicial autenticada (Priority: P1)

Um usuário autenticado precisa de uma página inicial simples que confirme visualmente que ele está conectado, exibindo sua identidade e, quando aplicável, sua organização ativa.

**Why this priority**: É o "hello world" autenticado da aplicação — o menor incremento que prova que o ciclo login → sessão → área restrita funciona ponta-a-ponta. É P1 porque sem ela não há como demonstrar a fatia.

**Independent Test**: Após login, o usuário deve ver uma página interna que apresenta seu identificador visível (ex.: nome ou avatar) e, se houver organização ativa, a indicação dessa organização.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele acessa a página inicial da área restrita, **Then** ele vê uma confirmação clara de que está conectado, com sua identidade visível.
2. **Given** um usuário autenticado com organização ativa, **When** ele acessa a página inicial, **Then** ele também vê a indicação da organização ativa em uso.
3. **Given** um usuário não autenticado, **When** ele tenta acessar a página inicial da área restrita diretamente pela URL, **Then** ele é redirecionado para o fluxo de autenticação.

---

### User Story 4 - Selecionar ou entrar em uma organização (Priority: P1)

Um usuário autenticado precisa estar associado a uma organização ativa para que seus dados fiquem isolados dos de outras empresas. Ele deve poder criar uma nova organização, entrar em uma existente (via convite/aceite) ou selecionar entre as organizações às quais já pertence.

**Why this priority**: O SST Manager é multi-tenant; **sem organização ativa não há contexto de dados de negócio**. Esta história é o que transforma "usuário logado" em "usuário operando como uma empresa", e é a base do princípio de isolamento da constituição.

**Independent Test**: Um usuário autenticado sem organização ativa deve ser conduzido a um fluxo no qual ele cria uma organização (ou aceita convite/seleciona uma existente). Após concluir, a organização ativa deve refletir essa escolha em todas as próximas operações da sessão.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem organização ativa, **When** ele acessa a área restrita, **Then** ele é direcionado a um fluxo para criar uma nova organização ou entrar em uma existente, antes de operar dados de negócio.
2. **Given** um usuário que pertence a múltiplas organizações, **When** ele troca a organização ativa, **Then** a sessão passa a refletir a nova organização e qualquer consulta de dados subsequente é escopada por ela.
3. **Given** uma organização ativa selecionada, **When** o servidor responde a uma operação de negócio, **Then** o identificador da organização usado para escopar a operação é exatamente o da sessão (nunca um valor enviado pelo cliente).

---

### User Story 5 - Bloqueio universal de funcionalidades de negócio sem autenticação (Priority: P1)

Como time de produto, é necessário garantir que **nenhuma** funcionalidade de negócio (rotas de página, Server Actions ou Route Handlers) seja acessível sem usuário autenticado e, quando aplicável, sem organização ativa.

**Why this priority**: É a garantia transversal que sustenta a confiança do produto. Uma única rota de negócio acessível sem autenticação compromete o isolamento multi-tenant — o risco crítico do sistema.

**Independent Test**: Para qualquer rota de página de negócio, Server Action de negócio ou Route Handler de negócio existentes ou futuras nesta fatia, uma requisição sem sessão válida resulta em negação de acesso (redirecionamento para login ou resposta não autorizada).

**Acceptance Scenarios**:

1. **Given** uma rota da área de negócio, **When** um cliente sem sessão válida tenta acessá-la, **Then** o acesso é negado (redirecionamento para login no caso de páginas; resposta não autorizada no caso de chamadas server-side).
2. **Given** uma operação de negócio no servidor (Server Action ou Route Handler), **When** ela é invocada sem identidade resolvida, **Then** a operação é interrompida antes de qualquer leitura/escrita de dados.
3. **Given** uma operação de negócio que exige organização, **When** ela é invocada por um usuário autenticado sem organização ativa, **Then** a operação é interrompida e o usuário é levado ao fluxo de organização (US4).

---

### Edge Cases

- **Usuário autenticado sem organização ativa**: deve ser conduzido ao fluxo de organização (US4) antes de poder operar qualquer dado de negócio. A página inicial autenticada permanece acessível e indica claramente que falta selecionar/criar organização.
- **Acesso a rota protegida sem sessão válida**: páginas devem redirecionar para o fluxo de autenticação; chamadas server-side devem ser rejeitadas como não autorizadas, sem vazar informação de existência do recurso.
- **Troca de organização durante a sessão**: ao trocar a organização ativa, qualquer operação subsequente deve usar imediatamente o novo identificador; dados em cache vinculados à organização anterior não devem aparecer.
- **Sessão expirada em navegação para área protegida**: o usuário deve ser redirecionado para login e, após reautenticar, retornar (idealmente) à intenção original ou a um ponto seguro da área restrita, sem executar a ação pendente como anônimo.
- **Cliente tenta forçar `orgId` por header/body/query**: o valor enviado pelo cliente deve ser ignorado; o tenant SEMPRE vem da sessão.
- **Usuário tenta acessar organização à qual não pertence**: a tentativa deve ser negada mesmo se o identificador for conhecido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um fluxo público de login para usuários já cadastrados.
- **FR-002**: O sistema MUST oferecer um fluxo público de cadastro para criação de nova conta.
- **FR-003**: O sistema MUST oferecer ao usuário autenticado uma ação clara de "sair", encerrando sua sessão de forma efetiva.
- **FR-004**: O sistema MUST expor, no servidor, a identidade do usuário autenticado (`userId`) e o identificador da organização ativa (`orgId`) para uso por regras de negócio.
- **FR-005**: O sistema MUST tratar como ausente/anônima qualquer sessão inválida, expirada ou não verificada.
- **FR-006**: O sistema MUST proteger todas as rotas de página de negócio: usuário sem sessão válida MUST ser redirecionado para o fluxo de autenticação.
- **FR-007**: Toda Server Action e todo Route Handler de negócio MUST verificar a identidade do usuário antes de qualquer leitura/escrita de dados; sem identidade, a operação MUST ser rejeitada.
- **FR-008**: Toda Server Action e todo Route Handler que opera dados de negócio MUST exigir uma organização ativa; sem organização ativa, a operação MUST ser rejeitada.
- **FR-009**: O identificador da organização (tenant) usado para escopar dados MUST sempre derivar da sessão autenticada e NUNCA de input do cliente (body, query, header, cookie controlado pelo cliente).
- **FR-010**: O sistema MUST oferecer ao usuário autenticado um fluxo para criar uma nova organização.
- **FR-011**: O sistema MUST permitir que o usuário entre em uma organização existente por meio de convite/aceite controlado.
- **FR-012**: O sistema MUST permitir que o usuário pertencente a múltiplas organizações alterne a organização ativa, refletindo a troca em operações subsequentes da sessão.
- **FR-013**: Usuário autenticado sem organização ativa MUST ser conduzido ao fluxo de organização antes de operar qualquer dado de negócio.
- **FR-014**: O sistema MUST fornecer uma página inicial autenticada que confirme visualmente o estado conectado, exibindo a identidade do usuário e a organização ativa (quando houver).
- **FR-015**: Toda Server Action e todo Route Handler MUST validar a entrada com schema antes de tocar o banco de dados ou serviços externos.
- **FR-016**: O sistema MUST aderir a TypeScript em modo `strict`, sem uso de `any` não justificado.
- **FR-017**: Nenhuma chave/secret de autenticação MUST ser commitada no repositório; segredos residem apenas em variáveis de ambiente.
- **FR-018**: O sistema MUST possuir testes unitários cobrindo a lógica de autorização/escopo de tenant desta fatia, e testes de integração cobrindo Server Actions e Route Handlers introduzidos por ela (com SQLite em memória como banco substituto, conforme constituição).
- **FR-019**: `npm run lint` e a checagem de tipos do TypeScript MUST passar antes da fatia ser considerada concluída.
- **FR-020**: O sistema MUST exibir ao usuário mensagens de erro claras para falhas de autenticação, falta de organização e acesso negado, sem vazar detalhes sensíveis (existência de e-mails, identificadores internos etc.).

### Key Entities

- **Usuário**: identidade autenticável da pessoa que usa o sistema. Possui um identificador estável (`userId`), credenciais e perfil mínimo. Pode pertencer a 0, 1 ou N organizações.
- **Organização**: representa uma empresa-cliente do SST Manager. Possui identificador estável (`orgId`), nome e conjunto de membros. É o **tenant** para isolamento de dados.
- **Membro (relação Usuário×Organização)**: vínculo de pertencimento. Define que um usuário pode operar como uma organização. (Papéis/permissões internos à organização ficam fora do escopo desta fatia.)
- **Sessão ativa**: contexto de execução autenticado contendo a dupla `(userId, orgId)` resolvida no servidor, usada como única fonte do tenant nas operações de negócio.
- **Convite de organização**: artefato controlado que permite a um usuário ingressar em uma organização existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das rotas de página, Server Actions e Route Handlers classificados como "de negócio" rejeitam acesso sem sessão válida (verificável por testes automatizados que cubram cada rota/handler da fatia).
- **SC-002**: 100% das operações de negócio que tocam dados escopam por `orgId` derivado da sessão; nenhuma usa `orgId` recebido do cliente (verificável por inspeção dirigida por testes).
- **SC-003**: Um usuário novo consegue completar o fluxo "abrir aplicação → cadastrar → criar/entrar em organização → ver página inicial autenticada com organização ativa" sem assistência, em menos de 3 minutos no primeiro uso.
- **SC-004**: Um usuário existente consegue completar o login e chegar à página inicial autenticada em menos de 30 segundos.
- **SC-005**: Sessão expirada nunca permite executar uma ação de negócio; em 100% dos casos a tentativa redireciona para o fluxo de autenticação ou é rejeitada como não autorizada.
- **SC-006**: Troca de organização ativa reflete-se em 100% das operações de negócio subsequentes (sem leitura de dados da organização anterior em cache).
- **SC-007**: 0 (zero) segredos ou chaves de autenticação versionados no repositório (verificável por inspeção do diff e por arquivos de ignorar de versionamento).
- **SC-008**: `npm run lint`, a checagem de tipos, `npm run test` e `npm run test:integration` passam antes da fatia ser entregue.

## Assumptions

- A organização ativa de um usuário em múltiplas organizações é uma escolha **única por sessão** — não há "modo dois tenants ao mesmo tempo".
- O escopo desta fatia é **autenticação e tenant**. Papéis/permissões internos à organização (admin, técnico, leitor etc.) ficam para uma fatia futura — esta apenas garante presença de identidade e organização.
- Esta fatia assume autenticação baseada em e-mail/senha como ponto de partida; provedores sociais adicionais (Google, Microsoft etc.) não são requisito desta entrega, mesmo que a plataforma os suporte.
- Recuperação de senha é uma capacidade esperada do provedor de identidade adotado e não exige código de negócio desta fatia.
- A fatia introduz uma área "autenticada" mínima (pelo menos a página inicial autenticada) e, fora dela, a área pública restrita aos fluxos de autenticação e à landing.
- O fluxo de criação de organização nesta fatia é o **mínimo viável** (nome da organização e criador como primeiro membro); detalhes cadastrais ricos de empresa (CNPJ, endereços etc.) pertencem a fatias de negócio posteriores.
- O ambiente de testes de integração usa SQLite em memória como banco substituto (conforme constituição), independentemente do banco de produção; assim, testes não dependem de serviços externos.
- A constituição já define a plataforma de autenticação/organizações adotada (Clerk); esta spec descreve **o que** precisa funcionar e **por quê**, sem fixar APIs ou estrutura de código.
