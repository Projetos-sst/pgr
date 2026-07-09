# Feature Specification: CRUD de Risco do GES

**Feature Branch**: `feature/ges-risk-crud`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "CRUD completo do Risco do GES (`risks`) — inventário de riscos por Grupo de Exposição Similar (NR-01/GRO + eSocial S-2240). Operações: list, getById, create, update, delete. Filtros dependentes Empresa → Obra → GES. Reutilização de risco de outro GES do mesmo escritório por prefill de formulário. Regra `qualitative_na`: concentração/intensidade só com unidade quantitativa. Dual-surface Server Actions + REST `/api/v1/risks`. Zero-migration."

> **Continuação da fatia de modelo (migration `0012_pgr_risk_data_model.sql`) — NÃO reabre o
> modelo de dados.** A tabela `risks` já existe na `develop` (`org_id`, `ges_id`, `agent_type`,
> `hazard`, `description`, `sources`, `propagation`, `exposure_time`, `possible_injuries`,
> `noxious_agent_code`, `measurement_unit`, `concentration_intensity`, timestamps; RLS
> `risks_isolation` para `app_runtime`, GRANT e trigger `set_updated_at_risks`). Esta fatia
> (**014**) entrega apenas o **CRUD completo do inventário de riscos** em UI + Server Actions +
> REST, reusando o contrato `ActionResult<T>`, a autorização `requireOfficeStaff()`, o isolamento
> `withOrg` + RLS e os padrões de auditoria/validação já estabelecidos nas fatias 007/009/010/013.
>
> **Herda — e NÃO reabre — o Modelo B de tenant (005).** Tenant = o **escritório** (`orgs.id`),
> nunca a organização do Clerk. O escritório ativo vem sempre da sessão
> (`requireTenantContext()`/`requireOfficeStaff()`), NUNCA de input do cliente. `risks.ges_id`
> referencia a cadeia da empresa (`companies → work_units → ges`) **dentro do mesmo tenant**.
>
> **Zero-migration.** Não altera schema nem cria migration. Gerencia SOMENTE as colunas da
> tabela `risks`. NÃO toca em `risk_assessments` (avaliação P×S, #25), `control_measures`
> (medidas/plano 5W2H, #26), `epi_risk` (#78) nem em qualquer outra tabela. Embora a issue #24
> cite "hierarquia de controles NR-01 embutida no risco", o schema real coloca essa hierarquia em
> `control_measures` — **fora desta fatia**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — CRUD do Risco do GES (Priority: P1)

Como gestor de SST do escritório, quero criar, listar, detalhar, editar e excluir riscos
vinculados a um GES (Grupo de Exposição Similar) — cada risco com grupo do agente, perigo,
descrição, fontes geradoras, meios de propagação, tempo de exposição, possíveis lesões, código do
agente nocivo (eSocial S-2240), unidade de medida e concentração/intensidade — para manter o
inventário de riscos ocupacionais por GES exigido pela NR-01/GRO.

**Why this priority**: É a razão de existir da fatia e a fonte de valor direto. Sem o CRUD, a
tabela `risks` (criada na fatia de modelo) permanece inacessível pela interface e pela API — não há
como inventariar, consultar, corrigir nem remover um risco. É a MVP da fatia.

**Independent Test**: Criar um risco vinculado a um GES do escritório, com grupo de agente e
descrição obrigatórios e demais campos válidos, vê-lo na listagem do escritório, abrir seu detalhe,
editá-lo (corpo completo) alterando descrição/tempo de exposição, salvar, e por fim excluí-lo com
confirmação — tudo escopado ao escritório ativo.

**Acceptance Scenarios**:

1. **Given** um gestor autenticado num escritório, **When** cria um risco informando GES
   (obrigatório), grupo do agente (obrigatório), descrição (obrigatória) e demais campos válidos,
   **Then** o risco é persistido com todos os campos e passa a aparecer na listagem do escritório.
2. **Given** o conjunto de riscos do escritório, **When** o gestor abre a listagem, **Then** vê
   apenas os riscos do escritório ativo, paginados, com as colunas relevantes (grupo do agente,
   descrição, tempo de exposição, GES) e ações por linha.
3. **Given** um risco existente, **When** o gestor abre o detalhe, **Then** vê todos os campos do
   risco com rótulos pt-BR dos enums (grupo do agente, tempo de exposição, unidade de medida).
4. **Given** um risco existente, **When** o gestor o edita enviando o **corpo completo** com valores
   válidos, **Then** a alteração é persistida e refletida na listagem e no detalhe.
5. **Given** um risco existente, **When** o gestor solicita a exclusão e confirma, **Then** o risco
   é removido do escritório e deixa de aparecer na listagem.
6. **Given** a listagem sem nenhum risco cadastrado, **When** o gestor a abre, **Then** vê um estado
   vazio orientando a criação do primeiro risco, com o botão "Novo".

---

### User Story 2 — Filtro dependente Empresa → Obra → GES (Priority: P2)

Como gestor de SST, quero filtrar a listagem de riscos por Empresa, depois por Obra/Contrato
daquela empresa e, por fim, por GES daquela obra, para localizar rapidamente os riscos de um grupo
de exposição específico.

**Why this priority**: Melhora a navegação e a localização quando há muitos riscos; além disso,
selecionar o GES é o caminho natural para a criação (o `gesId` é obrigatório). O CRUD entrega valor
sem os filtros completos, por isso P2.

**Independent Test**: Na listagem, selecionar uma Empresa e verificar que o seletor de
Obra/Contrato passa a oferecer apenas as obras daquela empresa; selecionar a Obra e ver o seletor de
GES restrito àquela obra; aplicar os filtros e ver a lista restrita aos riscos do GES escolhido, no
escritório ativo.

**Acceptance Scenarios**:

1. **Given** a listagem de riscos, **When** o gestor seleciona uma Empresa no filtro, **Then** o
   filtro de Obra/Contrato passa a listar apenas as obras daquela empresa.
2. **Given** uma Obra selecionada, **When** o gestor a escolhe, **Then** o filtro de GES passa a
   listar apenas os GES daquela obra e a lista é restrita aos riscos do GES selecionado.
3. **Given** um filtro de Empresa/Obra aplicado, **When** o gestor troca a seleção de um nível
   acima, **Then** os níveis dependentes abaixo são reiniciados para não manter seleção órfã.

---

### User Story 3 — Reutilizar risco de outro GES por prefill (Priority: P2)

Como gestor de SST, quero partir de um risco já cadastrado em outro GES do mesmo escritório e
reaproveitá-lo como base para um novo risco em outro GES, para não redigitar riscos recorrentes
(ex.: "Ruído contínuo") que se repetem entre grupos de exposição semelhantes.

**Why this priority**: Reduz retrabalho e acelera o inventário, mas o CRUD funciona plenamente sem
ele — por isso P2. É uma conveniência de UI, sem nova regra de servidor.

**Independent Test**: A partir de um risco existente, acionar "Reutilizar", verificar que o
formulário de criação abre **pré-preenchido** com os campos do risco de origem, escolher um GES de
destino diferente, confirmar, e obter um **novo** risco (novo `id`) no GES de destino — sem que o
risco de origem seja alterado e sem qualquer bloqueio por duplicidade.

**Acceptance Scenarios**:

1. **Given** um risco existente do escritório, **When** o gestor aciona "Reutilizar", **Then** o
   formulário de criação abre com os campos copiados do risco de origem (exceto o `id`).
2. **Given** o formulário pré-preenchido, **When** o gestor escolhe o GES de destino e confirma,
   **Then** um novo risco é criado no GES de destino com novo `id`, e o risco de origem permanece
   inalterado.
3. **Given** dois riscos idênticos em GES diferentes, **When** ambos são criados, **Then** nenhum é
   rejeitado por duplicidade (não há restrição de unicidade em `risks`).

---

### Edge Cases

- **Unidade qualitativa com concentração**: `measurementUnit = qualitative_na` (ou ausente) com
  `concentrationIntensity` informado → rejeição por validação; nada é persistido (FR-010).
- **Concentração sem unidade quantitativa**: concentração informada sem unidade de medida
  quantitativa → rejeição por validação.
- **GES inexistente, inválido ou de outro tenant**: `gesId` que não resolve no escritório ativo →
  rejeição como **referência inexistente** (`FK_NOT_FOUND`); nunca vaza nem permite escrita
  cross-tenant.
- **Risco de outro tenant**: `getById`/`update`/`delete` com id de outro escritório → tratado como
  **não encontrado** (`NOT_FOUND`); nunca aparece na listagem do escritório ativo.
- **Campos obrigatórios ausentes**: `agentType` ou `description` ausentes → rejeição por validação.
- **Enum inválido**: valor fora do conjunto de `agent_type`/`exposure_time`/`measurement_unit` →
  rejeição por validação.
- **Exclusão de risco com dependentes**: a exclusão segue o comportamento da migration `0012`
  (cascata para `risk_assessments`/`control_measures`); esta fatia não cria nem gerencia esses
  vínculos, mas a remoção do risco os leva junto por `ON DELETE CASCADE` do banco.
- **GES removido após criação**: se o GES vinculado for excluído, o risco é removido junto
  (comportamento `ON DELETE CASCADE` de `risks.ges_id`).
- **Papel sem permissão de escritório** (`client`): qualquer operação é bloqueada como proibida.
- **Ausência de contexto de tenant**: qualquer operação é bloqueada; a listagem nunca devolve todos
  os registros.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE permitir **criar** um risco informando: GES (obrigatório), Grupo do
  Agente (obrigatório), Perigo, Descrição (obrigatória), Fontes Geradoras, Meios de Propagação,
  Tempo de Exposição, Possíveis Lesões, Código do Agente Nocivo (S-2240), Unidade de Medida e
  Concentração/Intensidade — restrito às colunas reais da tabela `risks`.
- **FR-002**: O sistema DEVE **listar** os riscos do escritório ativo com paginação, exibindo
  colunas relevantes (grupo do agente, descrição, tempo de exposição, GES) e ações por linha.
- **FR-003**: O sistema DEVE permitir **detalhar** um risco, exibindo todos os seus campos com os
  **rótulos pt-BR** dos enums (`agent_type`, `exposure_time`, `measurement_unit`) já definidos em
  `domains/pgr/risks.ts`.
- **FR-004**: O sistema DEVE permitir **editar** um risco existente com o mesmo conjunto de campos
  da criação, preservando o escopo do escritório ativo.
- **FR-005**: O sistema DEVE permitir **excluir** um risco mediante confirmação explícita.
- **FR-006**: O sistema DEVE oferecer, na listagem, o botão "Novo" (abrir criação) e um **estado
  vazio** orientando a criação do primeiro risco quando não houver registros.
- **FR-007**: O sistema DEVE **filtrar** a listagem por Empresa → Obra/Contrato → GES, de forma
  **dependente**: cada seletor oferece apenas os itens do nível imediatamente acima e é reiniciado
  quando um nível acima é alterado.
- **FR-008**: A **criação exige `gesId`** (obrigatório) apontando para um GES do escritório ativo;
  o seletor de GES na criação segue o encadeamento Empresa → Obra → GES.
- **FR-009**: O sistema DEVE exigir **Grupo do Agente (`agentType`) e Descrição (`description`)**
  como obrigatórios; os demais campos da tabela `risks` são **opcionais**.
- **FR-010**: O sistema DEVE validar a **regra de concentração/unidade**: se `measurementUnit` for
  `qualitative_na` (ou ausente), `concentrationIntensity` DEVE ser nulo/ausente; a
  concentração/intensidade só é aceita com uma **unidade de medida quantitativa**. A regra é
  aplicada por `superRefine` no schema de domínio e revalidada no servidor.
- **FR-011**: O sistema DEVE permitir **reutilizar** um risco existente como base para um novo, via
  **prefill de formulário** na UI (copiando os campos do risco de origem, exceto o `id`); a criação
  usa a mesma Server Action de criação, gera **novo `id`** e permite escolher o **GES de destino**.
  NÃO há clonagem no servidor nem verificação de duplicidade.
- **FR-012**: Toda operação DEVE ser **escopada ao escritório ativo da sessão**
  (`requireOfficeStaff()` + `withOrg`), NUNCA a partir de
  `organization_id`/`organizationId`/`orgId` vindos do cliente; riscos de outro escritório nunca
  aparecem na listagem nem são acessíveis.
- **FR-013**: `getById`, `update` e `delete` de um risco inexistente **ou de outro escritório**
  DEVEM resultar em **não encontrado** (`NOT_FOUND` / 404), sem distinguir "não existe" de "é de
  outro tenant".
- **FR-014**: Referência inválida de GES (`gesId` inexistente, malformado ou de outro tenant) DEVE
  ser rejeitada como **referência inexistente** (`FK_NOT_FOUND` / 422), sem persistir a operação —
  validado explicitamente no repositório contra o tenant ativo.
- **FR-015**: O sistema DEVE expor as operações tanto por **Server Actions** quanto por **Route
  Handlers REST** sob `/api/v1/risks` (list, create, getById, update, delete), seguindo o padrão
  dual-surface; ambos compartilham a mesma validação (Zod) e o mesmo mapeamento de erros
  (`toActionError`).
- **FR-016**: A atualização (PUT) via REST DEVE receber o **corpo completo** do risco (mesmo
  contrato de entrada da criação), coerente com o padrão de `companies`/`pgr`.
- **FR-017**: Operações de escrita (create/update/delete) DEVEM emitir **auditoria de fronteira**
  (`auditedTenantWrite`/`logTenantEvent`, sem PII); leituras (list/get) NÃO emitem auditoria.
- **FR-018**: O sistema DEVE executar a validação (Zod) **antes** de qualquer regra de negócio ou
  escrita, e concentrar todo acesso a dados na camada de repositório
  (`src/shared/db/repositories/risks.ts`); Server Actions/handlers **não** acessam o ORM
  diretamente.
- **FR-019**: NÃO DEVE haver caso de **duplicidade (409 / `DUPLICATE`)** para `risks`, pois a tabela
  não possui restrição de unicidade.
- **FR-020**: A camada de negócio/dados NÃO DEVE tocar em `risk_assessments`, `control_measures`,
  `epi_risk` nem em qualquer tabela fora de `risks` (leitura de `ges`/`companies`/`work_units`
  apenas para vínculo e filtros).
- **FR-021**: O domínio DEVE **reutilizar** os enums e rótulos já existentes em
  `src/shared/domains/pgr/risks.ts` (`riskAgentTypeSchema`, `exposureTimeSchema`,
  `measurementUnitSchema` e seus `*Label`), sem redefini-los.
- **FR-022**: A documentação da API (`docs/api/api-design.md`) e a coleção Postman
  (`docs/api/sst-manager.postman_collection.json`) DEVEM ser atualizadas com o recurso Risks (list,
  create, get, update, delete + exemplos 403/404/422; **sem** 409) antes da entrega (PR).

### Key Entities _(include if feature involves data)_

- **Risco (`risks`)**: item do inventário de riscos de um GES. Atributos gerenciados nesta fatia:
  vínculo ao GES (`ges_id`, obrigatório), Grupo do Agente (`agent_type`, obrigatório), Perigo
  (`hazard`), Descrição (`description`, obrigatória), Fontes Geradoras (`sources`), Meios de
  Propagação (`propagation`), Tempo de Exposição (`exposure_time`), Possíveis Lesões
  (`possible_injuries`), Código do Agente Nocivo (`noxious_agent_code`), Unidade de Medida
  (`measurement_unit`), Concentração/Intensidade (`concentration_intensity`). Pertence a um
  escritório (tenant). **Fora desta fatia**: avaliação P×S, medidas de controle/plano de ação,
  vínculo EPI, autoria/usuário.
- **GES (`ges`)**: Grupo de Exposição Similar, já existente; fonte do vínculo obrigatório do risco e
  do último nível de filtro. Somente leitura nesta fatia.
- **Empresa-cliente (`companies`)** e **Obra/Contrato (`work_units`)**: níveis superiores da cadeia,
  já existentes; fonte dos filtros dependentes que levam ao GES. Somente leitura nesta fatia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: As 5 operações do risco (listar, detalhar, criar, editar, excluir) funcionam ponta a
  ponta, tanto pela interface quanto pela API REST.
- **SC-002**: 100% dos riscos de outro escritório permanecem invisíveis e inacessíveis: não aparecem
  na listagem e resultam em "não encontrado" em detalhe/edição/exclusão cross-tenant.
- **SC-003**: 100% das criações/edições com `gesId` inválido ou de outro tenant são rejeitadas como
  referência inexistente (422 `FK_NOT_FOUND`), sem persistência.
- **SC-004**: 100% das combinações inválidas de unidade↔concentração (concentração com
  `qualitative_na`/sem unidade quantitativa) são rejeitadas por validação, sem persistência; e
  concentração com unidade quantitativa é aceita.
- **SC-005**: A reutilização por prefill produz um novo risco (novo `id`) no GES de destino sem
  alterar o risco de origem e **sem** qualquer erro de duplicidade (nenhum 409 é possível).
- **SC-006**: Os filtros Empresa → Obra → GES são dependentes: cada nível oferece apenas os itens do
  nível acima; a listagem reflete os filtros aplicados.
- **SC-007**: A entrega inclui documentação de API e coleção Postman atualizadas com o recurso
  Risks, e as suítes automatizadas (unit + integração de Server Actions e REST em Postgres efêmero)
  e os testes manuais (UI via Playwright MCP + REST via cURL) concluídos antes da PR.

## Assumptions

- **Modelo já existe (zero-migration)**: a tabela `risks` e sua RLS/GRANT/trigger foram criadas na
  migration `0012_pgr_risk_data_model.sql` (já na `develop`); esta fatia não altera schema.
- **Enums e rótulos reaproveitados**: `risk_agent_type` (7 grupos), `exposure_time` (8 faixas) e
  `measurement_unit` (10 unidades, incl. `qualitative_na`) já estão em Zod + labels pt-BR em
  `domains/pgr/risks.ts`; o CRUD reusa sem redefinir.
- **Concentração é numérica opcional**: `concentration_intensity` é `numeric` anulável no banco
  (o driver a expõe como string); a fatia a trata como campo opcional, sujeito à regra
  `qualitative_na` (FR-010). A precisão/decimais é validada na aplicação; o banco não impõe faixa.
- **Código S-2240 é texto livre**: `noxious_agent_code` é `text`; nesta fatia é um campo de entrada
  simples, sem tabela de referência, seed ou autocomplete (fora de escopo).
- **Detalhe é tela dedicada**: o risco tem tela de detalhe própria (padrão análogo a
  `employees`/`pgr`), servindo de ponto de entrada para futuras avaliações/medidas (#25/#26) — que
  **não** são implementadas aqui.
- **Sem coluna de autor**: "Usuário autor" fica fora porque o modelo não possui `created_by`.
- **Dual-surface por precedente**: todos os CRUDs base expõem Server Actions + REST `/api/v1/*`;
  esta fatia segue o mesmo padrão, incluindo o bypass dev de REST (impossível em produção) para o
  teste manual via cURL.
- **Reuso de dependências prontas**: feeds de Empresa, listagem de Obra por Empresa e listagem de
  GES já existem e são reutilizados para os filtros dependentes; nenhuma nova capacidade de leitura
  de empresa/obra/GES é criada.

## Out of Scope

- **Avaliação de risco** probabilidade × severidade (`risk_assessments`, #25).
- **Medidas de controle** / hierarquia NR-01 / plano de ação 5W2H (`control_measures`, #26) — mesmo
  que a issue #24 cite "hierarquia embutida no risco", o schema real a separa em `control_measures`.
- **Vínculo EPI × risco** (`epi_risk`, #78) e **sugestão por IA** (#77).
- **Versionamento / geração de PDF / assinatura** do inventário de riscos.
- **Usuário autor / `created_by`** e qualquer coluna de autoria.
- Qualquer **alteração de schema ou migration** — a fatia é zero-migration.
