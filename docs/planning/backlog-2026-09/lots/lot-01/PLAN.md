# Lote 1 — PLAN

Base: `develop` @ `690ec1b` · Data: 2026-09-16 · Ordem: **1A (#56) → 1C (#33) → 1B (#42)**

Fontes: fichas `tasks/056`, `tasks/033`, `tasks/042` (auditoria específica) e decisões de produto de
2026-09-16 registradas nelas. Nenhuma decisão abaixo deve ser reaberta.

## Entrega

- **Uma PR única do Lote 1** (decisão do responsável, 2026-09-16), branch
  `lot-01-feat/document-versions-risk-plan-coverage`, com commits separados por issue:
  `docs` (auditoria + PLAN/TASK) → `#56 feat` → `#42 feat` → `docs` (REVIEW).
- #33 não gera commit de código: evidência + comentário + fechamento.
- Merge é do responsável. Rebase em `origin/develop` antes de marcar a PR como pronta.

## Linha de base de testes (antes de qualquer código)

Postgres 16 efêmero local (binários portáteis, porta 5433, mesmo bootstrap do CI
`scripts/ci-integration-bootstrap.sql`, `fsync=off`). Suítes `documents`, `control-measures` e `pgr-editor`:
**137/137 verdes** com `--testTimeout=60000`. Com o timeout padrão de 5s, 44 testes estouram por lentidão da
máquina (não é defeito de código). O CI (Postgres 16 real) continua sendo a autoridade.

---

# 1A — #56 · Histórico de versões do GED

## Objetivo

Versões antigas consultáveis pelo histórico, versão vigente identificada, versões antigas somente leitura
**no backend**, sem implementar revisão/aprovação (#54).

## Estado atual

- Vigente = maior versão do grupo (`currentVersionPredicate`, privado em `repositories/documents.ts:72-86`).
- Criar versão preserva histórico (testado, `documents-update.test.ts:107`); corrida de nomes diferentes →
  `409 DUPLICATE` (testado, `:120`).
- Não existe listagem de versões (repositório, action, REST GET, UI).
- `PUT /documents/{idAntigo}` edita a versão antiga; `POST /documents/{idAntigo}/versions` herda metadados da
  versão antiga; upload de mesmo nome em corrida estoura erro genérico do Storage.

## Arquitetura

1. **Regra de vigente num ponto só** — novo `src/shared/db/repositories/document-versions.ts`:
   - `currentVersionPredicate(tx)` (movido de `documents.ts`, exportado);
   - `getCurrentVersionTx(tx, orgId, groupId)`;
   - `listDocumentVersions(orgId, documentId)`.
     #54 troca a regra ("maior versão aprovada") só neste arquivo.
2. **Domínio** — `src/shared/domains/documents/versions.ts`: `DocumentVersionItem`
   (`DocumentListItem` + `isCurrent`) e `toDocumentVersionHistory(rows, currentVersion, today)` (ordena desc e
   marca a vigente; puro, unitário).
3. **Somente leitura no repositório** (serve Action e REST):
   - `updateDocument`: se a linha não é a vigente → `DocumentVersionReadOnlyError`
     (`DOCUMENT_VERSION_READ_ONLY`, **409**), nada gravado.
   - `addDocumentVersion`: resolve o grupo pelo id e herda metadados da **vigente**; `version = vigente + 1`.
   - `move`/`delete` continuam operações de grupo (inalterado).
   - Worker de PDF (`pdf-batch-core.ts`) não passa por `updateDocument` → não afetado.
4. **Conflito de upload** — `documents-storage.ts` identifica "objeto já existe" do Storage e lança
   `StorageObjectExistsError`; `addDocumentVersion` converte em `DuplicateError` (`DUPLICATE`, 409).
5. **Superfícies** — `listDocumentVersionsAction(id)` (`officeAction`); `GET /api/v1/documents/{id}/versions`
   (`restHandler`, mesmo arquivo do POST); `api-design.md`; Postman (pasta Documentos).
6. **UI** — `version-history-modal.tsx`: botão "Histórico de versões" em `DocumentRowActions`; lista versão,
   badge "Vigente", data de envio, tamanho, validade e download por versão. Sem ações de edição nas antigas.

## Arquivos afetados

`src/shared/db/repositories/documents.ts`, `document-versions.ts` (novo),
`src/shared/domains/documents/versions.ts` (novo), `src/shared/errors/document-version-read-only-error.ts`
(novo), `src/shared/errors/duplicate-error.ts` (novo), `src/shared/api/rest.ts` (mapa HTTP),
`src/shared/integrations/storage/documents-storage.ts`, `src/shared/server/actions/documents/documents.ts`,
`src/app/api/v1/documents/[id]/versions/route.ts`,
`src/app/(protected)/documents/_components/{document-row-actions,version-history-modal}.tsx`,
`docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`, testes.

## Migration

Nenhuma.

## Testes

- **UNIT** — `toDocumentVersionHistory`: ordenação desc, exatamente uma vigente, DTO; storage: detecção de conflito.
- **INTEGRATION** — 3 versões: listagem desc com uma vigente; listar pelo id antigo = mesmo grupo; PUT na
  antiga → 409 e linha inalterada; PUT na vigente continua funcionando; nova versão via id antigo herda
  metadados da vigente; corrida existente segue 409; upload de mesmo nome → `DUPLICATE`; outro tenant → 404.
- **REST** — `GET /documents/{id}/versions` 200 + 404 cross-tenant; `PUT` antiga → 409; `POST` sem regressão.
- **RLS** — listagem sob `app_runtime` não enxerga outro tenant.
- **Regressão** — `documents-*`, `folders`, `pdf-batch-core`, `jobs-worker`, download.
- **E2E** — evidência Playwright do modal (375/768/1440) se o ambiente logado permitir; sem seed permanente.

## Riscos

Clientes REST que editavam versão antiga passam a receber 409 (sem uso na UI). Mensagem do Storage para
conflito pode variar — detecção cobre `statusCode 409` e texto "already exists".

## DoD

Check, integração, build e regressão verdes; 4 superfícies do GET; ficha `tasks/056` atualizada; TASK 1A marcado.

---

# 1C — #33 · Assinatura/QR na entrega de EPI

## Objetivo

Validar com evidência que o fluxo próprio já atende os critérios, comentar e fechar. **Decisão: não migrar.**

## Estado atual

Critérios atendidos (tabela em `tasks/033`). Testes: `epi-sign-public.test.ts`, `epi-deliveries.test.ts`,
`unit/epi-signature-token.test.ts`.

## Arquitetura / backend / frontend / REST / migration

N/A — sem código, sem migration, sem branch funcional.

## Execução

1. Revalidar as referências da tabela contra o código atual.
2. Rodar as suítes de EPI como evidência.
3. Registrar "Verificação dos critérios de aceite" na ficha.
4. Comentar na issue (tabela + motivo de não migrar) e fechar como concluída.
5. Card do Project → Done.

## Riscos

Nenhum.

## DoD

Issue fechada com comentário; card Done; ficha atualizada.

---

# 1B — #42 · Cobertura do plano do PGR por nível de risco

## Objetivo

Todo risco do inventário aparece no plano do PGR com cobertura derivada; status da medida visível no
consolidado; formulário sinaliza prazo/responsável antes do submit para moderado+.

## Estado atual

Status e regra por nível prontos em `control_measures` (migration 0031, 9 testes). Consolidado não expõe
`status` nem cobertura; aba Inventário mostra "Sem medidas de controle cadastradas" só no detalhe expandido.

## Arquitetura

1. **Regra única de campos obrigatórios** — extrair em `domains/pgr/control-measure.ts`
   `isMeasureMissingRequiredPlanFields(measure, classification)` (aplicável + moderado+ + sem responsável ou
   prazo). O repositório (`applyMeasureStatusRule`) e a cobertura usam a mesma função.
2. **Domínio de cobertura** — novo `domains/pgr/plan-coverage.ts`:
   `RiskPlanCoverage = "not_assessed" | "no_measure" | "incomplete" | "covered"`, rótulos
   "Não avaliado" / "Sem medida" / "Incompleto" / "Coberto", `deriveRiskPlanCoverage(risk)` e
   `summarizePlanCoverage(risks)`. Precedência: sem classificação vigente → `not_assessed`; sem medidas →
   `no_measure`; alguma medida faltando campos obrigatórios → `incomplete`; senão `covered`.
   Premissa: risco moderado+ só com medidas não aplicáveis é `covered` (mesma regra do repositório).
3. **Consolidado** — `ConsolidatedMeasure.status` e `ConsolidatedRisk.planCoverage` (aditivo); repositório
   seleciona `status` e deriva a cobertura na composição. Sem coluna nova. PDF **não** muda.
4. **UI (aba Inventário)** — resumo com contagem por cobertura; coluna "Plano" com badge por risco; no detalhe,
   badge de status por medida e orientação do que corrigir com link para avaliar o risco ou cadastrar/editar
   medida.
5. **Formulário da medida** — páginas `new`/`edit` passam a classificação vigente; com medida aplicável e risco
   moderado+, responsável e prazo ficam marcados obrigatórios com aviso antes do submit. O servidor continua
   a autoridade (422 existente).
6. **Reclassificação** — nenhuma escrita: a cobertura é recalculada na leitura (subir → `incomplete` até
   revisão; descer → dados preservados).

## Arquivos afetados

`src/shared/domains/pgr/{control-measure,plan-coverage,pgr-consolidated}.ts`,
`src/shared/db/repositories/{control-measures,pgr-consolidated}.ts`,
`src/app/(protected)/pgr/[id]/_components/pgr-consolidated-tab.tsx`,
`src/app/(protected)/risks/[id]/control-measures/{new/page,[measureId]/edit/page,_components/control-measure-form}.tsx`,
`docs/api/api-design.md` (shape do consolidado), testes.

## REST

`GET /api/v1/pgr/{id}/consolidated` ganha campos (aditivo). Nenhum endpoint novo; medidas inalteradas.

## Migration

Nenhuma. Se surgir necessidade real: parar só #42 e documentar.

## Testes

- **UNIT** — grupos A/B; as 4 coberturas; precedência; transição tolerável→moderado (incompleto) e
  moderado→tolerável (coberto, dados intactos); `isMeasureMissingRequiredPlanFields`; resumo.
- **INTEGRATION** — consolidado retorna todos os riscos (inclusive sem medida) com `planCoverage`; `status`
  das medidas presente; nova avaliação moderada sobre risco tolerável → `incomplete` sem alterar a medida;
  nova avaliação tolerável → dados preservados; risco excluído some do consolidado (cascade); isolamento.
- **REST/ACTION** — shape do consolidado; 9 testes da regra seguem verdes.
- **E2E** — evidência Playwright da aba Inventário e do formulário (375/768/1440) se o ambiente permitir.

## Riscos

Divergência de rótulos entre a aba (que já mapeia classes para "Baixo/Moderado/Alto/Crítico") e a
cobertura — usar vocabulário próprio da cobertura, sem mexer no badge de nível existente.

## DoD

Check, integração, build e regressão verdes; api-design atualizado; ficha `tasks/042` atualizada; PDF
explicitamente adiado para o Lote 2 no REVIEW.
