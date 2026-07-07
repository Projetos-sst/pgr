# Feature Specification: CRUD do Documento PGR

**Feature Branch**: `feature/pgr-document-crud`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "CRUD completo do Documento PGR (`pgr`) — documento de Gerenciamento de Riscos Ocupacionais NR-01/GRO vinculado a uma Empresa-cliente e, opcionalmente, a uma Unidade de Obra/Contrato dentro do escritório. Operações: list, getById, create, update, delete. Criação exige aceite (não-persistido) da Declaração de Ciência de Riscos NR-01, validado no servidor. Filtros dependentes Empresa → Obra. Dual-surface Server Actions + REST `/api/v1/pgr`. Zero-migration."

> **Continuação da fatia de modelo (migration `0012_pgr_risk_data_model.sql`) — NÃO reabre o
> modelo de dados.** A tabela `pgr` já existe na `develop` (empresa/obra, responsável, tipo e
> número de registro, datas de emissão/validade, `org_id`, RLS `app_runtime`, trigger
> `set_updated_at_pgr`). Esta fatia (**013**) entrega apenas o **CRUD completo do documento PGR**
> em UI + Server Actions + REST, reusando o contrato `ActionResult<T>`, a autorização
> `requireOfficeStaff()`, o isolamento `withOrg` + RLS e os padrões de auditoria/validação já
> estabelecidos nas fatias 007/009/010.
>
> **Herda — e NÃO reabre — o Modelo B de tenant (005).** Tenant = o **escritório** (`orgs.id`),
> nunca a organização do Clerk. O escritório ativo vem sempre da sessão
> (`requireTenantContext()`/`requireOfficeStaff()`), NUNCA de input do cliente. `pgr.company_id`
> e `pgr.work_unit_id` referenciam a cadeia da empresa **dentro do mesmo tenant**.
>
> **Zero-migration.** Não altera schema nem cria migration. Não toca em `pgr_ges`,
> `pgr_revisions`, `risks`, `risk_assessments` nem `control_measures` (pertencem às fatias
> futuras #27/#79 e às tasks 04/05/06).

## User Scenarios & Testing _(mandatory)_

### User Story 1 — CRUD do Documento PGR (Priority: P1)

Como gestor de SST do escritório, quero criar, listar, detalhar, editar e excluir documentos
PGR — cada um vinculado a uma Empresa-cliente e, opcionalmente, a uma Obra/Contrato, com
responsável pela elaboração, tipo e número de registro técnico e datas de emissão e validade —
para organizar os documentos de Gerenciamento de Riscos Ocupacionais (NR-01/GRO) do escritório.

**Why this priority**: É a razão de existir da fatia e a fonte de valor direto. Sem o CRUD, a
tabela `pgr` (criada na fatia de modelo) permanece inacessível pela interface e pela API — não há
como cadastrar, consultar, corrigir nem remover um documento PGR. É a MVP da fatia.

**Independent Test**: Criar um PGR vinculado a uma empresa (e opcionalmente a uma obra) com datas
válidas e tipo de registro coerente, vê-lo na listagem do escritório, abrir seu detalhe, editá-lo
alterando responsável/datas, salvar, e por fim excluí-lo com confirmação — tudo escopado ao
escritório ativo.

**Acceptance Scenarios**:

1. **Given** um gestor autenticado num escritório, **When** cria um PGR informando empresa
   obrigatória, obra opcional, responsável, tipo de registro, número de registro (quando o tipo
   exigir), emissão e validade válidas, **Then** o PGR é persistido com todos os campos e passa a
   aparecer na listagem do escritório.
2. **Given** o conjunto de PGRs do escritório, **When** o gestor abre a listagem, **Then** vê
   apenas os PGRs do escritório ativo, paginados, podendo filtrar por Empresa e, dependentemente,
   por Obra/Contrato daquela empresa.
3. **Given** um PGR existente, **When** o gestor abre o detalhe, **Then** vê empresa, obra (se
   houver), responsável, tipo de registro, número de registro (quando aplicável), emissão e
   validade.
4. **Given** um PGR existente, **When** o gestor o edita e altera campos para valores válidos
   (mantendo validade ≥ emissão e a coerência tipo↔número de registro), **Then** a alteração é
   persistida e refletida na listagem e no detalhe.
5. **Given** um PGR existente, **When** o gestor solicita a exclusão e confirma, **Then** o PGR é
   removido do escritório e deixa de aparecer na listagem.
6. **Given** a listagem sem nenhum PGR cadastrado, **When** o gestor a abre, **Then** vê um estado
   vazio orientando a criação do primeiro PGR, com o botão "Novo".

---

### User Story 2 — Aceite obrigatório da Declaração de Ciência de Riscos NR-01 (Priority: P1)

Como gestor de SST, quero que a criação de um PGR só avance após eu confirmar explicitamente a
Declaração de Ciência de Riscos NR-01, para garantir que nenhum documento seja cadastrado sem a
confirmação consciente exigida pela norma.

**Why this priority**: É um requisito de conformidade explícito da criação. Sem o aceite validado,
a fatia não atende ao critério normativo; por isso é P1 ao lado do CRUD.

**Independent Test**: Abrir a criação de PGR, tentar prosseguir sem marcar o aceite (bloqueado na
UI e rejeitado no servidor com erro de validação), depois marcar o aceite, confirmar e concluir a
criação com sucesso.

**Acceptance Scenarios**:

1. **Given** o formulário de criação de PGR, **When** o gestor tenta confirmar sem marcar o
   checkbox de aceite da declaração, **Then** o botão "Confirmar e prosseguir" permanece
   desabilitado na UI e, caso a requisição chegue ao servidor sem o aceite, a Server Action/REST
   rejeita com erro de validação e nada é persistido.
2. **Given** o formulário de criação de PGR, **When** o gestor lê o texto da declaração, marca o
   checkbox de aceite e confirma, **Then** a criação prossegue e o PGR é persistido.
3. **Given** a edição de um PGR já existente, **When** o gestor salva alterações, **Then** o aceite
   da declaração NÃO é exigido novamente (o gate aplica-se somente à criação).

---

### User Story 3 — Filtro dependente Empresa → Obra/Contrato (Priority: P2)

Como gestor de SST, quero filtrar a listagem de PGRs por Empresa e, em seguida, por Obra/Contrato
daquela empresa, para localizar rapidamente os documentos vinculados a uma empresa-cliente.

**Why this priority**: Melhora a navegação e a localização quando há muitos documentos, mas o CRUD
e o aceite entregam valor sem ela — por isso P2.

**Independent Test**: Na listagem, selecionar uma Empresa e verificar que o seletor de
Obra/Contrato passa a oferecer apenas as obras daquela empresa; aplicar ambos os filtros e ver a
lista restrita aos PGRs correspondentes do escritório ativo.

**Acceptance Scenarios**:

1. **Given** a listagem de PGRs, **When** o gestor seleciona uma Empresa no filtro, **Then** o
   filtro de Obra/Contrato passa a listar apenas as obras daquela empresa e a lista é restrita aos
   PGRs da empresa selecionada.
2. **Given** um filtro de Empresa aplicado, **When** o gestor troca a Empresa selecionada, **Then**
   a seleção de Obra/Contrato é reiniciada para não manter uma obra de outra empresa.
3. **Given** filtros de Empresa e Obra aplicados, **When** o gestor os limpa, **Then** a listagem
   volta a exibir todos os PGRs do escritório ativo (paginados).

---

### Edge Cases

- **Validade anterior à emissão**: a criação/edição é rejeitada com validação; nada é persistido.
- **Número de registro incoerente com o tipo**: número ausente quando o tipo exige
  (CRM/CREA/MTE) → rejeição; número preenchido quando o tipo é "Não aplicável" → rejeição
  (regra definida em FR-009).
- **Obra de outra empresa**: selecionar uma obra que não pertence à empresa informada → rejeição
  como referência inexistente (não como sucesso).
- **Empresa/obra de outro tenant**: IDs de empresa/obra de outro escritório nunca resolvem →
  tratados como referência inexistente; nunca vazam nem permitem escrita cross-tenant.
- **PGR de outro tenant**: `getById`/`update`/`delete` com id de outro escritório → tratado como
  inexistente (não encontrado); nunca aparece na listagem do escritório ativo.
- **Exclusão de PGR com vínculos futuros**: a exclusão segue o comportamento da migration `0012`
  (cascata para `pgr_ges`/`pgr_revisions`); esta fatia não cria nem gerencia esses vínculos.
- **Obra removida após criação**: se a obra vinculada for excluída, o PGR é preservado e a
  Obra/Contrato passa a exibir-se como não informada (comportamento SET NULL do modelo).
- **Papel sem permissão de escritório** (`client`): qualquer operação é bloqueada como proibida.
- **Ausência de contexto de tenant**: qualquer operação é bloqueada; a listagem nunca devolve
  todos os registros.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE permitir **criar** um documento PGR informando: Empresa
  (obrigatória), Obra/Contrato (opcional), Responsável pela elaboração, Tipo de Registro, Número
  de Registro (condicionado ao tipo), Data de Emissão (obrigatória) e Data de Validade
  (obrigatória).
- **FR-002**: O sistema DEVE **listar** os documentos PGR do escritório ativo com paginação,
  exibindo as colunas: Emissão, Validade, Obra/Contrato, Empresa, Responsável pela elaboração e
  Opções (ações por linha).
- **FR-003**: O sistema DEVE permitir **detalhar** um documento PGR, exibindo empresa, obra (se
  houver), responsável, tipo de registro, número de registro (quando aplicável), emissão e
  validade.
- **FR-004**: O sistema DEVE permitir **editar** um documento PGR existente com o mesmo conjunto de
  campos da criação, preservando o escopo do escritório ativo.
- **FR-005**: O sistema DEVE permitir **excluir** um documento PGR mediante confirmação explícita.
- **FR-006**: O sistema DEVE oferecer, na listagem, o botão "Novo" (abrir criação), um botão
  "Metodologia de Avaliação" como **link/placeholder** para a feature futura #76, e um **estado
  vazio** orientando a criação do primeiro PGR quando não houver registros.
- **FR-007**: A criação DEVE exigir o **aceite da Declaração de Ciência de Riscos NR-01**: a UI
  apresenta o texto da declaração e um checkbox de aceite; o botão "Confirmar e prosseguir" só é
  habilitado após o aceite; e o **servidor DEVE revalidar o aceite**, rejeitando a criação sem ele.
- **FR-008**: O aceite da declaração **NÃO DEVE ser persistido** nesta fatia (a tabela `pgr` não
  possui coluna de aceite). O aceite é um **gate de criação validado no servidor**; a persistência
  legal/documental é explicitamente fora de escopo (#79).
- **FR-009**: O sistema DEVE validar a **coerência entre Tipo de Registro e Número de Registro**:
  para `CRM`, `CREA` e `MTE` o número é **obrigatório**; para `Não aplicável` o número **não deve
  ser informado** (se enviado, a operação é rejeitada por validação).
- **FR-010**: O sistema DEVE validar que a **Data de Validade não é anterior à Data de Emissão**
  (validade ≥ emissão), tanto na criação quanto na edição.
- **FR-011**: O sistema DEVE **filtrar** a listagem por Empresa e, dependentemente, por
  Obra/Contrato, onde o seletor de Obra/Contrato oferece apenas as obras da Empresa selecionada e é
  reiniciado ao trocar de Empresa.
- **FR-012**: Toda operação DEVE ser **escopada ao escritório ativo da sessão**
  (`requireOfficeStaff()` + `withOrg`), NUNCA a partir de `organization_id`/`organizationId`/`orgId`
  vindos do cliente; documentos de outro escritório nunca aparecem na listagem nem são acessíveis.
- **FR-013**: `getById`, `update` e `delete` de um PGR inexistente **ou de outro escritório** DEVEM
  resultar em **não encontrado** (sem distinguir "não existe" de "é de outro tenant").
- **FR-014**: Referências inválidas de Empresa ou Obra (empresa inexistente, obra inexistente, obra
  que não pertence à empresa informada, ou empresa/obra de outro tenant) DEVEM ser rejeitadas como
  **referência inexistente**, sem persistir a operação.
- **FR-015**: O sistema DEVE expor as operações tanto por **Server Actions** quanto por **Route
  Handlers REST** sob `/api/v1/pgr` (list, create, getById, update, delete), seguindo o padrão
  dual-surface dos CRUDs base; ambos compartilham a mesma validação e o mesmo mapeamento de erros.
- **FR-016**: A atualização (PUT) via REST DEVE receber o **corpo completo** do documento (mesmo
  contrato de entrada da criação), coerente com o padrão de `companies`.
- **FR-017**: Operações de escrita (create/update/delete) DEVEM emitir **auditoria de fronteira**
  (`logTenantEvent`, sem PII); leituras não emitem auditoria.
- **FR-018**: O sistema DEVE executar a validação (Zod) **antes** de qualquer regra de negócio ou
  escrita, e concentrar todo acesso a dados na camada de repositório (nenhum acesso a banco fora do
  repositório; Server Actions/handlers não acessam o ORM diretamente).
- **FR-019**: NÃO DEVE haver caso de **duplicidade (409)** para `pgr`, pois a tabela não possui
  restrição de unicidade.
- **FR-020**: A documentação da API (`docs/api/api-design.md`) e a coleção Postman
  (`docs/api/sst-manager.postman_collection.json`) DEVEM ser atualizadas com o recurso PGR antes da
  entrega (PR), seguindo o padrão de fechamento já usado para os demais recursos.

### Key Entities _(include if feature involves data)_

- **Documento PGR (`pgr`)**: documento de Gerenciamento de Riscos Ocupacionais do escritório.
  Atributos relevantes ao CRUD: vínculo à Empresa (obrigatório), vínculo à Obra/Contrato
  (opcional), Responsável pela elaboração, Tipo de Registro (`CRM` | `CREA` | `MTE` | `Não
aplicável`), Número de Registro (condicionado ao tipo), Data de Emissão, Data de Validade.
  Pertence a um escritório (tenant). **Não é editado nesta fatia**: aceite da declaração
  (não-persistido), autoria/usuário, status/ciclo de vida, revisões e vínculos com GES.
- **Empresa-cliente (`companies`)**: entidade da cadeia da empresa, já existente; fonte do vínculo
  obrigatório do PGR e do filtro por Empresa. Somente leitura nesta fatia.
- **Obra/Contrato (`work_units`)**: unidade de obra/contrato de uma empresa, já existente; fonte do
  vínculo opcional do PGR e do filtro dependente. Somente leitura nesta fatia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As 5 operações do documento PGR (listar, detalhar, criar, editar, excluir) funcionam
  ponta a ponta, tanto pela interface quanto pela API REST.
- **SC-002**: 100% das tentativas de criação sem o aceite da Declaração de Ciência são rejeitadas
  pelo servidor (nenhum PGR é criado sem aceite), e nenhuma delas persiste o aceite no banco.
- **SC-003**: 100% dos documentos PGR de outro escritório permanecem invisíveis e inacessíveis: não
  aparecem na listagem e resultam em "não encontrado" em detalhe/edição/exclusão cross-tenant.
- **SC-004**: 100% das combinações inválidas de tipo↔número de registro e de validade < emissão são
  rejeitadas por validação, sem persistência.
- **SC-005**: 100% das referências inválidas de empresa/obra (inclusive obra de outra empresa e
  empresa/obra de outro tenant) são rejeitadas como referência inexistente, sem persistência.
- **SC-006**: O filtro Empresa → Obra é dependente: ao selecionar uma empresa, o seletor de obra
  oferece apenas as obras daquela empresa; a listagem reflete os filtros aplicados.
- **SC-007**: A entrega inclui documentação de API e coleção Postman atualizadas com o recurso PGR,
  e as suítes automatizadas (unit + integração em Postgres efêmero) e os testes manuais
  (UI + cURL) concluídos antes da PR.

## Assumptions

- **Modelo já existe (zero-migration)**: a tabela `pgr` e sua RLS/trigger foram criadas na migration
  `0012_pgr_risk_data_model.sql` (já na `develop`); esta fatia não altera schema.
- **Datas obrigatórias na aplicação**: emissão e validade são `date` anuláveis no banco, mas a
  fatia trata ambas como **obrigatórias na camada de aplicação** (validação Zod); as constraints do
  banco atuam apenas como backstop.
- **Responsável é texto livre**: o modelo possui um único campo de responsável (texto); "informações
  do responsável pela elaboração" resumem-se a esse campo mais o tipo/número de registro.
- **Detalhe é tela dedicada**: diferentemente de entidades simples (categories), o PGR tem tela de
  detalhe própria (padrão análogo a `employees`), servindo de ponto de entrada para a visão
  consolidada futura (#27) — que **não** é implementada aqui.
- **Sem coluna de autor**: "Usuário autor" fica fora da listagem porque o modelo não possui
  `created_by` e o projeto ainda não tem padrão de autoria em tabelas de domínio.
- **Dual-surface por precedente**: todos os CRUDs base expõem Server Actions + REST `/api/v1/*`;
  esta fatia segue o mesmo padrão, incluindo o bypass dev de REST (impossível em produção) para o
  teste manual via cURL.
- **Reuso de dependências prontas**: feeds de Empresa e listagem de Obra por Empresa já existem e são
  reutilizados para os filtros dependentes; nenhuma nova capacidade de leitura de empresa/obra é
  criada.

## Out of Scope

- Editor multi-aba e **visão consolidada** do PGR (#27) — apenas link/placeholder.
- **Metodologia de Avaliação** / matriz 5×5 (#76) — apenas link/placeholder.
- Vínculo **PGR↔GES** (`pgr_ges`), **revisões/versionamento** (`pgr_revisions`, #79),
  **CRUD de riscos** (`risks`, #24), **avaliação de risco** (#25) e **plano de ação 5W2H**
  (`control_measures`, #26).
- **Persistência do aceite** da declaração e **assinatura/geração de PDF** (#79).
- **Usuário autor / `created_by`** e qualquer coluna de autoria.
- Qualquer **alteração de schema ou migration** — a fatia é zero-migration.
