# Lote 1 — TASK

Checklist operacional. Atualizado durante a execução; permite retomar em outra sessão.
Branch: `lot-01-feat/document-versions-risk-plan-coverage` · PR única do lote.

## Preparação do lote

- [x] `develop` atualizada (`690ec1b`, inclui #91)
- [x] Auditoria específica commitada na branch do lote
- [x] Decisões de 2026-09-16 aplicadas nas fichas e visões gerais
- [x] PLAN.md
- [x] TASK.md
- [x] Postgres 16 efêmero local (porta 5433) + bootstrap do CI
- [x] Linha de base de integração: 137/137 (`documents`, `control-measures`, `pgr-editor`)
- [x] PR do lote aberta como rascunho → pronta ao final — #93 aberta como rascunho

## Notas de retomada

- Integração local: `INTEGRATION_*` apontando para `localhost:5433/sst_test`, `--runInBand --testTimeout=60000`.
- O timeout padrão (5s) estoura por lentidão da máquina; não confundir com regressão.

---

## 1A — #56 histórico de versões

- [x] Card #56 → In progress
- [x] Schema — N/A (sem mudança)
- [x] Migration — N/A (sem migration)
- [x] Domain: `domains/documents/versions.ts` (`DocumentVersionItem`, `toDocumentVersionHistory`)
- [x] Errors: `DocumentVersionReadOnlyError` (409) + `DuplicateError` + mapa em `api/rest.ts`
- [x] Repository: `document-versions.ts` (predicate exportado, vigente, listagem)
- [x] Repository: `updateDocument` bloqueia versão não vigente
- [x] Repository: `addDocumentVersion` herda da vigente
- [x] Storage: conflito de objeto → `StorageObjectExistsError` → `DUPLICATE`
- [x] Server Action: `listDocumentVersionsAction`
- [x] REST: `GET /api/v1/documents/{id}/versions`
- [x] Frontend: `version-history-modal.tsx` + botão em `DocumentRowActions`
- [x] Unit — `versions.test.ts` (5) + storage (3)
- [x] Integration (versões, somente leitura, herança, conflito, cross-tenant, RLS) — `documents-versions.test.ts` 8/8
- [x] REST (GET 200/404, PUT antiga 409, POST sem regressão) — `rest-document-versions.test.ts` 4/4
- [x] Regressão GED/worker/download — 13 suítes, 90/90
- [x] Docs: `api-design.md` + Postman
- [x] `npm run check` — 1242 unit, 0 erros de lint (4 warnings pré-existentes)
- [x] Commit `#56` — `aa5605e`
- [x] Ficha `tasks/056` atualizada

## 1C — #33 assinatura de EPI

- [x] Branch funcional — N/A
- [x] Schema / migration / domain / repository / actions / REST / frontend — N/A (sem código)
- [x] Revalidar referências da tabela de critérios no código atual
- [x] Rodar suítes de EPI como evidência — integração 18/18
- [x] Ficha: "Verificação dos critérios de aceite"
- [x] Comentário na issue
- [x] Fechar issue
- [x] Card → Done

## 1B — #42 cobertura do plano do PGR

- [ ] Card #42 → In progress
- [x] Schema — N/A
- [x] Migration — N/A (parar #42 e documentar se surgir necessidade)
- [ ] Domain: `isMeasureMissingRequiredPlanFields` (regra única) + uso no repositório
- [ ] Domain: `plan-coverage.ts` (4 coberturas, rótulos, resumo)
- [ ] Consolidated: `status` e `planCoverage` no DTO + repositório
- [ ] Server Action / REST — N/A novo endpoint; consolidado aditivo
- [ ] Frontend: aba Inventário (resumo, coluna Plano, status por medida, orientação)
- [ ] Frontend: formulário sinaliza prazo/responsável (moderado+ aplicável)
- [ ] Unit
- [ ] Integration (todos os riscos, sem medida, status, reclassificação, exclusão, isolamento)
- [ ] REST/Action (shape; 9 testes da regra verdes)
- [ ] Docs: `api-design.md` (consolidado)
- [ ] `npm run check`
- [ ] Commit `#42`
- [ ] Ficha `tasks/042` atualizada

## Fechamento do lote

- [ ] Rebase em `origin/develop`
- [ ] `npm run check` + integração completa das áreas tocadas + `npm run build`
- [ ] Evidência Playwright (quando o ambiente permitir)
- [ ] Push `--force-with-lease`
- [ ] PR pronta para revisão; cards #56/#42 → In review
- [ ] CI verde
- [ ] REVIEW.md
- [ ] LOTS.md / EXECUTION-PLAN.md atualizados
