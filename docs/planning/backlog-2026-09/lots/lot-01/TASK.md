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
- [ ] PR do lote aberta como rascunho → pronta ao final

## Notas de retomada

- Integração local: `INTEGRATION_*` apontando para `localhost:5433/sst_test`, `--runInBand --testTimeout=60000`.
- O timeout padrão (5s) estoura por lentidão da máquina; não confundir com regressão.

---

## 1A — #56 histórico de versões

- [ ] Card #56 → In progress
- [x] Schema — N/A (sem mudança)
- [x] Migration — N/A (sem migration)
- [ ] Domain: `domains/documents/versions.ts` (`DocumentVersionItem`, `toDocumentVersionHistory`)
- [ ] Errors: `DocumentVersionReadOnlyError` (409) + `DuplicateError` + mapa em `api/rest.ts`
- [ ] Repository: `document-versions.ts` (predicate exportado, vigente, listagem)
- [ ] Repository: `updateDocument` bloqueia versão não vigente
- [ ] Repository: `addDocumentVersion` herda da vigente
- [ ] Storage: conflito de objeto → `StorageObjectExistsError` → `DUPLICATE`
- [ ] Server Action: `listDocumentVersionsAction`
- [ ] REST: `GET /api/v1/documents/{id}/versions`
- [ ] Frontend: `version-history-modal.tsx` + botão em `DocumentRowActions`
- [ ] Unit
- [ ] Integration (versões, somente leitura, herança, conflito, cross-tenant, RLS)
- [ ] REST (GET 200/404, PUT antiga 409, POST sem regressão)
- [ ] Regressão GED/worker/download
- [ ] Docs: `api-design.md` + Postman
- [ ] `npm run check`
- [ ] Commit `#56`
- [ ] Ficha `tasks/056` atualizada

## 1C — #33 assinatura de EPI

- [x] Branch funcional — N/A
- [x] Schema / migration / domain / repository / actions / REST / frontend — N/A (sem código)
- [ ] Revalidar referências da tabela de critérios no código atual
- [ ] Rodar suítes de EPI como evidência
- [ ] Ficha: "Verificação dos critérios de aceite"
- [ ] Comentário na issue
- [ ] Fechar issue
- [ ] Card → Done

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
