# Research — Document (GED) CRUD

**Feature**: `.specs/024-document-crud/` · **Date**: 2026-07-19

Decisões técnicas da fatia. Sem `NEEDS CLARIFICATION` pendente (limites de arquivo e granularidade da lista resolvidos no clarify).

## §1. Estratégia de Storage (upload/remoção do binário)

- **Decision**: Upload/remoção server-side via **cliente admin** do Supabase (`getRlsBypassingSupabaseClient`, `SUPABASE_SECRET_KEY`) no **bucket privado `documents`** (já provisionado). Path particionado: `<org_id>/documentos/<document_group_id>/v<version>-<slug-do-nome>`. `org_id` **sempre** de `requireOfficeStaff()`.
- **Rationale**: O `app_runtime` (pooler) é só Postgres; o Storage é acessado pelo JS client. O repo já usa o cliente admin para operações privilegiadas (precedente `caepi-upsert`/`admin.ts`). O isolamento vem de duas fontes: (1) `org_id` no path, da sessão, nunca do input; (2) o registro-espelho em `documents` é RLS-protegido — objeto sem registro é inalcançável pela app. Bucket privado ⇒ acesso só por URL assinada (que é a **#35**, fora de escopo). O cliente admin toca **apenas o binário**; **toda escrita de dados de negócio no DB continua em `withOrg` (app_runtime, RLS)** — sem bypass de RLS em dados de negócio (Constituição, Princípio I).
- **Alternatives considered**: RLS de Storage por policy keyed em `org_id` via JWT Clerk — exige políticas de Storage novas + claim de org no JWT; mais superfície, sem ganho nesta fatia. Registrado como evolução futura (defense-in-depth no próprio Storage).

## §2. Transporte do upload e limite de corpo (Next Server Action)

- **Decision**: Upload por `FormData` (arquivo como `File`/`Blob`) na Server Action e no POST REST. Elevar `experimental.serverActions.bodySizeLimit` em `next.config` para **`"25mb"`** (alinha ao teto do clarify). O POST REST (`/api/v1/documents`) lê `await req.formData()`.
- **Rationale**: O default do `bodySizeLimit` de Server Actions é ~1 MB; sem elevar, uploads reais falham. `FormData` é o transporte nativo para binário em Server Actions/Route Handlers do App Router. Validação de tamanho/tipo ocorre no servidor **antes** de qualquer gravação (defense-in-depth com o limite do framework).
- **Alternatives considered**: Upload direto do browser ao Storage por signed upload URL — reduz carga no serverless, mas quebra o gate server-side de tipo/tamanho e a partição controlada por sessão nesta fatia; adia para otimização futura se necessário.

## §3. Incremento de versão e concorrência

- **Decision**: `addVersion` roda dentro de `withOrg` (transação): `SELECT max(version) ... WHERE org_id=$1 AND document_group_id=$2` → `INSERT` com `version = max+1`, mesmo `document_group_id`, novo `storage_path`. A **unicidade `uq_documents_org_group_version` (023)** é o backstop: colisão concorrente → SQLSTATE 23505 → mapeado para `DUPLICATE`/409.
- **Rationale**: Preserva histórico (novo registro, não UPDATE). A constraint garante corretude sob corrida sem depender de lock pessimista; a app trata o 23505 como conflito e a UI pode reapresentar. Consistente com o padrão do repo (duplicidade → `DUPLICATE`).
- **Alternatives considered**: `SELECT ... FOR UPDATE` na linha corrente do grupo — possível, mas a unique já resolve a corretude; manter simples (YAGNI). Não persistir "versão corrente" em coluna (derivada por `MAX`).

## §4. Consistência armazenamento↔registro (upload atômico lógico)

- **Decision**: Ordem: (1) validar zod (tipo/tamanho) → (2) `upload` do binário no Storage → (3) `INSERT` em `documents` dentro de `withOrg`. Se (3) falhar, **remover o objeto** recém-enviado (compensação) e propagar o erro.
- **Rationale**: Não há transação distribuída Storage+DB. A ordem "objeto antes do registro" + compensação no catch evita binário órfão (FR-010). O caminho inverso (registro antes do objeto) deixaria registro apontando para arquivo inexistente — pior para leitura. `status` permanece `ready` (o estado `generating` é da #38).
- **Alternatives considered**: Gravar `status=generating` antes e confirmar após o objeto — introduz máquina de estado não requerida nesta fatia (YAGNI); a compensação simples basta.

## §5. Listagem: uma linha por documento lógico + KPIs

- **Decision**: A lista agrupa por `document_group_id` retornando **a versão corrente** (`version = MAX` do grupo) via subquery/`DISTINCT ON (org_id, document_group_id) ... ORDER BY version DESC` ou window function `row_number()`. Escopada por `folder_id` (raiz = `IS NULL`). Filtros: busca por `name ILIKE`, `doc_type`, e status de validade (aplicado sobre `valid_until` na query ou pós-derivação — ver §6). KPIs numa query agregada: `Documentos` = `COUNT(DISTINCT document_group_id)` (na pasta atual? ver nota), `Pastas` = filhas diretas, `Vencem em 30d`/`Vencidos` derivados de `valid_until` sobre as versões correntes.
- **Rationale**: Clarify definiu 1 linha por grupo (versão corrente); KPI "Documentos" = grupos distintos. `DISTINCT ON` do Postgres é idiomático e barato com `idx_documents_org_group`. Paginação offset padrão do repo (`resolvePageParams`, pageSize 20).
- **Nota de escopo de KPI**: KPIs do **acervo** (todo o escritório) vs. da **pasta atual** — a issue lista "KPIs do acervo". Decisão: KPIs calculados sobre **todo o escritório** (acervo), independentes da pasta navegada; a listagem (linhas) é escopada pela pasta. A confirmar no gate de arquitetura se deve ser por-pasta.
- **Documento lógico vive em UMA pasta**: `moveDocument` atualiza `folder_id` de **todas as versões do grupo** (não só a corrente) — mantém o grupo coerente e torna o escopo por pasta da listagem inequívoco. A "versão corrente" na lista é selecionada por `NOT EXISTS (versão maior no grupo)` (index-friendly com `idx_documents_org_group`), e todos os filtros (busca/tipo/validade/pasta) aplicam sobre a linha corrente.
- **Alternatives considered**: Uma linha por versão (rejeitado no clarify).

## §6. Status de validade derivado

- **Decision**: Reusar `classifyDocumentValidity(valid_until, { today, dueWindowDays: 30 })` (existe em `domains/documents/validity.ts`), com `today = todayInSaoPaulo()` (`src/shared/dates.ts`). Deriva `ok | due_soon | expired | no_expiry` na leitura; o filtro por status na lista converte a seleção do usuário nas faixas de `valid_until` correspondentes (para paginar corretamente no banco) **ou** filtra pós-derivação quando a janela é pequena. Preferência: traduzir o filtro para predicados de data no SQL (paginação correta).
- **Rationale**: Espelha a fatia 017; zero coluna persistida (FR-003). Filtrar no SQL preserva a semântica de paginação/total.
- **Alternatives considered**: Persistir status — viola FR-003.

## §7. Anti-ciclo e integridade de pasta

- **Decision**: Criar/renomear pasta valida unicidade de irmã via `uq_folders_org_parent_name` (NULLS NOT DISTINCT, 023) → 23505 → `DUPLICATE`/409. `parent_id` informado deve ser do tenant (senão `FK_NOT_FOUND`/422 — checagem explícita antes do insert, pois a FK só garante existência global). **Mover/excluir pasta ficam fora do escopo** (issue #34); a regra anti-ciclo e o RESTRICT de exclusão são invariantes documentadas da 023 e só serão exercidas quando essas ops existirem. A exclusão de **documento** respeita naturalmente os FKs RESTRICT (não remove pasta).
- **Rationale**: Escopo enxuto conforme a issue. As constraints do banco (023) cobrem unicidade e RESTRICT sem código extra.
- **Alternatives considered**: Incluir mover/excluir pasta — expande escopo além da issue (YAGNI).

## §8. Ambiente de teste de integração

- **Decision**: **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite — a fatia depende de RLS (isolamento), unicidades e FKs RESTRICT. O Storage é **mockado** (o objetivo dos testes de integração é a lógica DB + isolamento + mapeamento de erro, não o serviço externo). Um teste de unidade cobre o wrapper de Storage com o client mockado (ordem upload→insert→compensação).
- **Rationale**: Constituição (exceção RLS) + CLAUDE.md. Mockar o Storage mantém os testes determinísticos e sem dependência de rede.
- **Alternatives considered**: Storage real em teste — flaky, lento, custo; rejeitado.

## §9. Vínculo polimórfico ao PGR

- **Decision**: `related_entity_type` validado por `documentRelatedEntityTypeSchema` (`z.enum(["pgr"])`, já existe). Regra completo-ou-vazio garantida pelo CHECK `documents_related_entity_check` (023) + zod (`.refine`). Sem FK (polimórfico); id é `uuid`.
- **Rationale**: Reusa o conjunto fechado existente; ampliar = editar o zod, sem migration.
- **Alternatives considered**: Tabela de junção — over-engineering para 1 tipo (YAGNI).

## §11. Semântica de exclusão (grupo inteiro + Storage best-effort)

- **Decision**: `deleteDocument(orgId, id)` resolve o `document_group_id` da linha alvo (404 se não existe/cross-tenant) e, numa **transação `withOrg`**, apaga **todas** as linhas do grupo (`DELETE ... WHERE org_id=$1 AND document_group_id=$2`), coletando os `storage_path` de todas as versões. **Após o commit**, remove os objetos no Storage em **best-effort**: cada falha é registrada via `logTenantEvent` (`operation: documents.documents.delete_object`, sem PII) e **não** reverte a exclusão no banco.
- **Rationale**: Excluir "o documento" (conceito do usuário) = remover o documento lógico e seu histórico, não uma versão isolada. A remoção de Storage fora da transação evita que uma falha de rede no provedor externo bloqueie a operação de negócio (o registro é a fonte de verdade; objeto sem registro é inalcançável). Best-effort + log evita órfãos silenciosos: a falha fica auditável para reconciliação futura. Consistente com o Princípio IV (não acoplar o fluxo do usuário a serviço externo) e com a compensação do create (research §4), invertida no tempo.
- **Alternatives considered**: (a) apagar só a versão apontada — contraria a semântica de "excluir o documento" (deixaria o grupo vivo); rejeitado. (b) abortar a exclusão se o Storage falhar — acopla dado de negócio à disponibilidade do Storage e pode travar remoção legítima; rejeitado. (c) fila de limpeza assíncrona (`jobs`) — over-engineering para esta fatia (YAGNI); o log best-effort basta e a coleta de órfãos pode virar job depois.

## §10. Namespaces de operação e erros

- **Decision**: Operações auditadas: `documents.documents.{list,get,create,update,add_version,move,delete}` e `documents.folders.{create,rename,tree}`. Erros padronizados via `toActionError`: `NotFoundError`→404; 23505→`DUPLICATE`/409; pasta inválida→`FK_NOT_FOUND`/422; zod→`VALIDATION`/422(action)/400-422(REST conforme mapa). REST usa `restHandler` (mapa `HTTP_BY_CODE` já cobre os códigos usados).
- **Rationale**: Consistência com o repo; nenhum código de erro novo necessário.
- **Alternatives considered**: Novos códigos — desnecessário.
