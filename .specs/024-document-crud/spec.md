# Feature Specification: Document (GED) CRUD

**Feature Branch**: `feature/document-crud` (artefatos gerados na branch `release/0.2.0` — sem troca de branch)

**Created**: 2026-07-19

**Status**: Draft

**Input**: Issue #34 — "[Fase 05] 05 · CRUD de Documentos (GED)". Modelo de dados já mergeado (fatia 023, migration `0025_documents_data_model`: `documents`, `folders`, `jobs`).

## Contexto

O SST Manager é um SaaS B2B multiempresa (multi-tenant, Modelo B: escritório = `orgs.id`). Esta fatia entrega a **camada de aplicação do GED** (Gerenciamento Eletrônico de Documentos) do escritório sobre as tabelas `documents` e `folders` já modeladas. É análoga às fatias de CRUD anteriores (referência: módulo `companies`): validação, repositórios org-scopados, Server Actions, espelho REST, docs/Postman, UI e testes. **Sem migration nova.**

A tabela `jobs`, o ciclo de vida `generating` de `documents`, a geração de PDF e o download por URL assinada **não** fazem parte desta fatia (issues #35/#36/#37/#38/#39/#40).

## Clarifications

### Session 2026-07-19

- Q: Na listagem do GED, cada linha representa o quê e como o KPI "Documentos" conta? → A: **1 linha por documento lógico** — uma linha por agrupador de versões (versão corrente = maior versão do grupo); KPI "Documentos" = nº de agrupadores distintos; histórico de versões acessível pelo detalhe, não como linhas separadas.
- Q: Quais tipos de arquivo e tamanho máximo o upload deve aceitar? → A: **PDF, PNG, JPG, DOC/DOCX, XLS/XLSX; máximo 25 MB por arquivo.**

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Listar e navegar o acervo do GED (Priority: P1)

Como staff do escritório (owner/collaborator), quero listar o acervo de documentos do meu escritório com indicadores (KPIs), navegação por pastas com trilha de navegação (breadcrumb), busca por nome e filtros por tipo e por status de validade, para encontrar e controlar os documentos rapidamente.

**Why this priority**: É a porta de entrada do módulo; sem a listagem com KPIs e navegação por pastas, nenhuma outra operação tem contexto. Entrega valor imediato (visão do acervo e do que está vencido/a vencer) mesmo antes do upload.

**Independent Test**: Com dados semeados de documentos e pastas do escritório ativo, abrir a tela do GED na raiz e em uma subpasta; verificar KPIs corretos, colunas da tabela, filtros, busca e breadcrumb — e que nada de outro escritório aparece.

**Acceptance Scenarios**:

1. **Given** o escritório ativo tem documentos e pastas na raiz, **When** o staff abre o GED sem pasta selecionada, **Then** vê os KPIs (Documentos · Pastas · Vencem em 30d · Vencidos), a lista das pastas-filhas da raiz e dos documentos da raiz, paginada e ordenada.
2. **Given** o staff está na raiz, **When** clica em uma pasta, **Then** a listagem passa a mostrar o conteúdo dessa pasta e o breadcrumb reflete o caminho ("Início > Pasta > Subpasta").
3. **Given** existem documentos vencidos e a vencer em 30 dias, **When** a lista é exibida, **Then** cada documento mostra o status de validade derivado (válido / a vencer / vencido / sem validade) com indicação visual para vencidos e a vencer.
4. **Given** o staff digita um termo de busca e/ou seleciona filtros por tipo e por status de validade, **When** aplica, **Then** a lista mostra apenas os documentos do escritório que correspondem, mantendo a paginação.
5. **Given** não há tenant ativo, **When** a listagem é solicitada, **Then** o resultado é vazio (nunca todos os registros) e a UI orienta o primeiro cadastro (estado vazio).
6. **Given** documentos e pastas de outro escritório, **When** qualquer listagem é feita, **Then** eles nunca aparecem.

---

### User Story 2 - Upload/criar documento (Priority: P1)

Como staff, quero enviar um novo documento (arquivo + título + tipo + validade opcional + pasta de destino opcional, raiz por padrão), com validação de tipo e tamanho do arquivo, para incorporá-lo ao acervo do escritório.

**Why this priority**: Sem incorporar documentos, o acervo permanece vazio; é a operação de criação do módulo. P1 porque, junto de US1, forma o MVP (ver e cadastrar).

**Independent Test**: Enviar um arquivo válido para a raiz e para uma pasta do escritório; confirmar que o binário foi gravado na área de armazenamento particionada pelo escritório e que o registro do documento existe com versão 1, referência de armazenamento, tamanho e validade; enviar um arquivo de tipo/tamanho inválido e confirmar rejeição sem gravação.

**Acceptance Scenarios**:

1. **Given** um arquivo de tipo e tamanho permitidos, título, tipo e (opcional) pasta de destino do escritório, **When** o staff confirma o upload, **Then** o binário é gravado na área de armazenamento do escritório, um documento é criado com versão 1, um novo agrupador de versões, o tamanho do arquivo e a validade informada, e a operação é auditada (sem PII).
2. **Given** nenhuma pasta de destino informada, **When** o upload é confirmado, **Then** o documento é criado na raiz.
3. **Given** um arquivo com tipo não permitido ou acima do tamanho máximo, **When** o upload é tentado, **Then** a operação é rejeitada com erro de validação e nada é gravado (nem binário nem registro).
4. **Given** uma pasta de destino que não pertence ao escritório (ou inexistente), **When** o upload é tentado, **Then** a operação é rejeitada como referência de pasta inválida.
5. **Given** o binário foi gravado mas o registro do documento falhou, **When** a falha ocorre, **Then** o binário órfão é removido (o acervo não fica com arquivo sem registro) e o erro é retornado.
6. **Given** um documento a ser vinculado ao PGR, **When** o upload informa o vínculo (entidade = PGR + identificador), **Then** o documento é criado com o vínculo polimórfico; vínculo incompleto (só o tipo ou só o id) é rejeitado.

---

### User Story 3 - Editar metadados, nova versão e mover (Priority: P1)

Como staff, quero editar os metadados de um documento, publicar uma nova versão (que incrementa a versão preservando o histórico) e mover o documento entre pastas, para manter o acervo atualizado.

**Why this priority**: Documentos evoluem (novas revisões, reorganização). Versionamento com histórico é requisito de paridade do GED. P1 porque completa o ciclo de vida do documento junto de US1/US2.

**Independent Test**: Sobre um documento existente do escritório, editar metadados e confirmar persistência; publicar uma nova versão e confirmar que a versão incrementou, que o histórico anterior permanece e que o agrupador de versões é o mesmo; mover para outra pasta do escritório e confirmar; repetir com id de outro escritório e confirmar 404.

**Acceptance Scenarios**:

1. **Given** um documento do escritório, **When** o staff edita metadados válidos (ex.: título, tipo, validade), **Then** apenas esse documento é atualizado, com carimbo de atualização automático e auditoria.
2. **Given** um documento do escritório, **When** o staff publica uma nova versão (novo arquivo), **Then** um novo registro é criado com o mesmo agrupador de versões, versão = maior versão do grupo + 1, e as versões anteriores permanecem inalteradas (histórico preservado).
3. **Given** duas publicações concorrentes de nova versão do mesmo documento, **When** ambas tentam a mesma próxima versão, **Then** apenas uma é aceita e a outra falha com conflito (unicidade de versão por grupo).
4. **Given** um documento do escritório e uma pasta de destino do escritório, **When** o staff move o documento, **Then** o documento passa a pertencer à pasta de destino; pasta de destino de outro escritório/inexistente é rejeitada.
5. **Given** um id de documento inexistente ou de outro escritório, **When** editar/nova-versão/mover é tentado, **Then** o resultado é 404 (nunca vaza nem altera dado de outro escritório).

---

### User Story 4 - Gerir pastas (Priority: P2)

Como staff, quero criar e renomear pastas organizadas em hierarquia (raiz e subpastas), para estruturar o acervo do GED.

**Why this priority**: Organização melhora a usabilidade, mas o módulo é utilizável (upload na raiz) sem hierarquia. P2.

**Independent Test**: Criar pasta na raiz e subpasta; renomear; tentar nome duplicado entre irmãs (incl. raiz) e confirmar conflito; navegar a árvore e confirmar breadcrumb; repetir renome com id de outro escritório e confirmar 404.

**Acceptance Scenarios**:

1. **Given** um nome válido e uma pasta-pai (opcional) do escritório, **When** o staff cria a pasta, **Then** a pasta é criada no escritório (pai nulo = raiz) e a operação é auditada.
2. **Given** uma pasta irmã com o mesmo nome (incluindo na raiz), **When** a criação/renome é tentada, **Then** a operação é rejeitada por nome duplicado entre irmãs (conflito).
3. **Given** uma pasta do escritório, **When** o staff a renomeia, **Then** apenas essa pasta é atualizada; id de outro escritório → 404.
4. **Given** uma pasta-pai que não pertence ao escritório, **When** a criação é tentada, **Then** é rejeitada como referência de pasta inválida.

---

### User Story 5 - Excluir documento (Priority: P1)

Como staff, quero excluir um documento com confirmação, para remover itens indevidos do acervo. Excluir um documento remove o **documento lógico inteiro** — todas as suas versões — de uma vez.

**Why this priority**: Exclusão é operação básica de CRUD e requisito de aceite. P1.

**Independent Test**: Excluir um documento do escritório (com múltiplas versões) após confirmação e verificar que todas as versões do grupo somem e os objetos são removidos do Storage; tentar excluir id de outro escritório e confirmar 404.

**Acceptance Scenarios**:

1. **Given** um documento do escritório com uma ou mais versões, **When** o staff confirma a exclusão (identificando o documento por qualquer id de versão ou pelo agrupador), **Then** **todas as linhas do agrupador de versões** são removidas numa única transação e a operação é auditada.
2. **Given** as linhas do grupo foram removidas com sucesso, **When** a transação confirma, **Then** os objetos correspondentes no Storage são removidos em **best-effort após o commit**: uma falha de remoção no Storage **não** reverte a exclusão (é registrada em log e o fluxo segue), evitando acúmulo silencioso de órfãos.
3. **Given** um id inexistente ou de outro escritório, **When** a exclusão é tentada, **Then** o resultado é 404 e nada é removido.

---

### Edge Cases

- **Consistência armazenamento↔registro**: se o binário é gravado mas o registro falha, o binário órfão é removido (compensação) — o acervo nunca fica com arquivo sem registro.
- **Corrida no incremento de versão**: duas novas versões concorrentes do mesmo agrupador não podem gerar a mesma versão; a segunda falha com conflito.
- **Ciclo de pastas**: mover uma pasta para dentro de si mesma ou de uma descendente é proibido (validado subindo a cadeia de pais). _(Fora do escopo de operações desta fatia caso "mover pasta" não seja exposto — ver Assumptions; a regra vale se/quando mover-pasta existir.)_
- **Excluir pasta com conteúdo**: uma pasta com subpastas ou documentos não pode ser removida (restrição de integridade) — a UI deve informar em vez de falhar silenciosamente. _(Ver Assumptions sobre exclusão de pasta.)_
- **Excluir documento com várias versões**: remove o agrupador inteiro (todas as versões) numa transação; objetos do Storage removidos best-effort pós-commit — falha de Storage não reverte a exclusão (logada, sem órfãos acumulando).
- **Nome de pasta duplicado entre irmãs, inclusive na raiz**: rejeitado por unicidade (conflito).
- **Sem tenant ativo**: leitura retorna vazio, nunca todos os registros.
- **PGR sem/So com vínculo**: vínculo polimórfico é opcional; se informado, deve ser completo (tipo + id), senão é rejeitado.
- **Arquivo vazio (0 byte) ou sem nome**: tratado pela validação de arquivo.
- **Documento na raiz vs. em pasta**: ambos suportados (pasta nula = raiz).

## Requirements _(mandatory)_

### Functional Requirements

**Listagem e navegação (US1)**

- **FR-001**: O sistema DEVE listar documentos e pastas-filhas do escritório ativo, escopados pela pasta atual (raiz quando nenhuma selecionada), com paginação e ordenação. A listagem apresenta **uma linha por documento lógico** (agrupador de versões), exibindo a versão corrente (maior versão do grupo); versões anteriores não aparecem como linhas.
- **FR-002**: O sistema DEVE calcular e exibir os KPIs do acervo: total de Documentos (contagem de agrupadores de versões distintos), total de Pastas, Vencem em 30 dias e Vencidos.
- **FR-003**: O sistema DEVE derivar o status de validade de cada documento na leitura (válido / a vencer / vencido / sem validade), com base na validade e na data atual, nunca como coluna persistida.
- **FR-004**: O sistema DEVE permitir busca por nome e filtros por tipo e por status de validade na listagem.
- **FR-005**: O sistema DEVE expor a trilha de navegação (breadcrumb) percorrendo a cadeia de pastas-pai da pasta atual.
- **FR-006**: O sistema DEVE apresentar estado vazio orientando o primeiro cadastro quando não há itens no escopo atual.

**Upload/criação (US2)**

- **FR-007**: O sistema DEVE validar tipo e tamanho do arquivo enviado antes de qualquer gravação. Tipos permitidos: PDF, PNG, JPG, DOC/DOCX, XLS/XLSX. Tamanho máximo: 25 MB por arquivo.
- **FR-008**: O sistema DEVE gravar o binário em área de armazenamento particionada pelo escritório ativo (identificador do escritório sempre da sessão, nunca do cliente) e registrar o documento com versão inicial 1, novo agrupador de versões, referência de armazenamento, tamanho e validade opcional.
- **FR-009**: O sistema DEVE permitir pasta de destino opcional (raiz por padrão) e rejeitar pasta que não pertença ao escritório ou inexistente como referência inválida.
- **FR-010**: O sistema DEVE remover o binário órfão caso a gravação do registro falhe após o upload (consistência armazenamento↔registro).
- **FR-011**: O sistema DEVE aceitar vínculo polimórfico opcional a uma entidade (conjunto fechado, inicialmente PGR) exigindo tipo e identificador ambos presentes ou ambos ausentes.

**Edição, versão, mover (US3)**

- **FR-012**: O sistema DEVE permitir editar metadados de um documento do escritório, atualizando somente esse registro e atualizando o carimbo de atualização.
- **FR-013**: O sistema DEVE permitir publicar uma nova versão que cria um novo registro no mesmo agrupador de versões com versão = maior versão do grupo + 1, preservando as versões anteriores (histórico).
- **FR-014**: O sistema DEVE garantir unicidade da versão por agrupador dentro do escritório; publicações concorrentes que colidam na mesma versão resultam em conflito.
- **FR-015**: O sistema DEVE permitir mover um documento para outra pasta do escritório, rejeitando destino inválido.

**Pastas (US4)**

- **FR-016**: O sistema DEVE permitir criar pasta (pai opcional; nulo = raiz) e renomear pasta, escopadas ao escritório.
- **FR-017**: O sistema DEVE garantir unicidade de nome entre pastas irmãs, inclusive na raiz; violação resulta em conflito.
- **FR-018**: O sistema DEVE expor a navegação da árvore (pastas-filhas diretas da pasta atual) escopada ao escritório.

**Exclusão (US5)**

- **FR-019**: O sistema DEVE permitir excluir um documento do escritório mediante confirmação, removendo **todas as versões do agrupador** numa única transação; os objetos no Storage são removidos em best-effort **após** o commit (falha de Storage não reverte a exclusão — é logada; sem acúmulo silencioso de órfãos).

**Transversais**

- **FR-020**: Toda operação DEVE fixar o escritório ativo da sessão; leitura sem escritório ativo retorna vazio; escrita marcada para outro escritório é rejeitada pelo backstop de isolamento.
- **FR-021**: Acesso a documento/pasta inexistente ou de outro escritório DEVE resultar em 404 (nunca vazar dados).
- **FR-022**: Erros DEVEM ser padronizados: não encontrado → 404; violação de unicidade → 409; referência de pasta inválida → 422; validação → 400.
- **FR-023**: Toda mutação (criar/editar/nova-versão/mover/excluir documento e criar/renomear pasta) DEVE gerar registro de auditoria com correlação (requisição, escritório, usuário, operação) e sem PII.
- **FR-024**: O sistema DEVE oferecer a superfície de API completa da fatia: ação de servidor (para a UI) e espelho REST com verbos reais para documentos e pastas, além de documentação da API e coleção de testes de API.

### Key Entities _(include if feature involves data)_

- **Documento**: um arquivo do acervo do escritório, com nome, tipo (texto livre), versão, agrupador de versões (agrupa as versões do mesmo documento lógico), referência de armazenamento, tamanho, validade opcional, pasta opcional (raiz quando ausente) e vínculo polimórfico opcional a uma entidade (ex.: PGR). Pertence a exatamente um escritório. _(Tabela `documents`, já modelada.)_
- **Pasta**: nó de organização hierárquica do acervo, com nome e pasta-pai opcional (raiz quando ausente). Nomes únicos entre irmãs. Pertence a um escritório. _(Tabela `folders`, já modelada.)_
- **Binário armazenado**: o conteúdo do arquivo, guardado em área particionada por escritório e referenciado pelo documento; download por URL assinada é de outra fatia.
- **Registro de auditoria**: evento de mutação com correlação e sem PII.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As cinco operações de documento (listar, detalhar, criar/upload, atualizar/nova-versão/mover, excluir) e as operações de pasta (criar, renomear, navegar) estão implementadas e cobertas por testes automatizados.
- **SC-002**: Os KPIs do acervo (Documentos · Pastas · Vencem em 30d · Vencidos) refletem corretamente os dados do escritório em cenários de teste.
- **SC-003**: 100% das leituras e escritas são isoladas por escritório: em teste, documentos/pastas de outro escritório nunca aparecem nem são acessíveis, e acesso cruzado retorna 404.
- **SC-004**: O status de validade exibido corresponde à regra derivada (válido/a vencer em 30d/vencido/sem validade) para as datas de teste, sem coluna persistida.
- **SC-005**: Um upload válido resulta em binário na área do escritório e registro correspondente (versão 1); um upload inválido (tipo/tamanho) não grava nada; uma falha de registro após upload não deixa binário órfão.
- **SC-006**: Uma nova versão incrementa a versão e preserva as versões anteriores; publicações concorrentes na mesma versão resultam em exatamente um sucesso.
- **SC-007**: As respostas de erro seguem o mapeamento padronizado (404/409/422/400) nos cenários correspondentes.
- **SC-008**: A suíte `npm run test` (unit) e `npm run test:integration` (Postgres efêmero) passam verdes, incluindo o cenário crítico de isolamento multi-tenant.

## Assumptions

- **Papéis**: apenas staff do escritório (owner/collaborator) opera o GED; `client` não tem acesso (regra `requireOfficeStaff`, herdada).
- **Escopo de operações de pasta**: esta fatia entrega **criar, renomear e navegar** pastas. **Excluir pasta e mover pasta não estão no escopo** desta fatia (a issue #34 lista apenas criar/renomear/navegar). As regras de "excluir pasta com conteúdo" e "anti-ciclo ao mover pasta" ficam documentadas como invariantes do modelo (da fatia 023) e serão exercidas apenas se/quando essas operações forem expostas; a exclusão de documento respeita a restrição de integridade que impede remover pasta com conteúdo.
- **Limites de arquivo** (confirmado no clarify): PDF, PNG, JPG, DOC/DOCX, XLS/XLSX; máximo 25 MB por arquivo. Como uploads acima de ~1 MB via ação de servidor exigem elevar o limite de corpo da requisição da plataforma, isso é uma decisão técnica a tratar no plano.
- **Granularidade da listagem** (confirmado no clarify): uma linha por documento lógico (agrupador de versões, versão corrente); histórico de versões acessível pelo detalhe, não como linhas da tabela.
- **Armazenamento**: reusa área de armazenamento gerenciada já provisionada (bucket privado `documents`); download por URL assinada é de outra fatia (#35). Escrita server-side, escopo por escritório da sessão.
- **Sem migration nova**: o esquema (documents/folders/jobs, migration 0025) já está aplicado; esta fatia é só camada de aplicação.
- **Ciclo de vida `generating`**: fora de escopo — documentos criados aqui já nascem prontos; o estado `generating` é gravado por fatia de geração de PDF (#38).
- **Detalhe = edição**: não há tela de detalhe somente-leitura separada; detalhar é a base da edição.
- **Ordenação/paginação padrão**: seguem o padrão do repo (offset, pageSize do repositório).
