# Lote 02 — QA

> [README do lote](README.md)

## Estado

**02A testado em 2026-10-22 (unit + integração + typecheck + lint + build). QA no navegador pendente.** Cenários com migration
(Q02–Q11) não iniciados.

## 02A — execução (2026-10-22)

Base: branch `feature/NOB-112-lote-02a-validacoes-exames` sobre `origin/develop` = `e6f2542` (migrations 0000–0059). Integração em
Postgres 16 **efêmero** no container local `qa-pg16` (porta 5433): banco `sst_test` **recriado do zero** e inicializado com
`scripts/ci-integration-bootstrap.sql`, runtime como `app_runtime` (RLS aplicada). Nunca dev, homologação ou produção.

| Comando                                                          | Resultado literal                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test` (unit)                                            | `Test Suites: 188 passed, 188 total` · `Tests: 1838 passed, 1838 total`                                                                                                                                                                                                     |
| Integração completa (`--selectProjects integration --runInBand`) | `Test Suites: 178 passed, 5 skipped, 183 total` · `Tests: 1418 passed, 14 skipped, 1432 total` · 0 falhas                                                                                                                                                                   |
| Suítes skipped                                                   | `pdf/pgr-docx-live`, `platform/team`, `webhooks/clerk-membership`, `pdf/gotenberg-e2e`, `shared/db/smoke`: as mesmas do Lote 01, nenhuma da Medicina                                                                                                                        |
| Suíte nova `medicine/health-exams-lote02a`                       | 24 passed, 0 skipped                                                                                                                                                                                                                                                        |
| Regressão Medicina (Lote 01 + NOB-98)                            | `health-exams-filters` 11 · `medicine-employees` 11 · `rest-medicine` 14 · `overview` 11 · `health-exams-isolation` 6 · `medical-risk-sources` 9 · `risk-authorizations` 13 · `company-modules` 5 · `pgr/health-exams` 6 · `pgr/rest-health-exams` 8 → 94 passed, 0 skipped |
| `npm run typecheck`                                              | exit 0                                                                                                                                                                                                                                                                      |
| `npm run lint`                                                   | `✖ 4 problems (0 errors, 4 warnings)` (os mesmos `no-img-element` de antes)                                                                                                                                                                                                 |
| `npm run build`                                                  | exit 0 · `✓ Compiled successfully`                                                                                                                                                                                                                                          |

Cobertura dos pontos do 02A:

| Ponto                                                                                                                                               | Onde                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vencimento posterior / igual / anterior / ausente / formato inválido; criação e edição                                                              | unit `domains/pgr/health-exams` + integração `health-exams-lote02a` (Action e REST) |
| Exame legado com datas invertidas: lido intacto; edição exige corrigir                                                                              | integração `health-exams-lote02a`                                                   |
| Tipo válido / inválido no corpo e no filtro `?examType=` → `422` com mensagem                                                                       | unit + integração                                                                   |
| Edição normal; troca de `employeeId` (mesmo escritório e outro escritório) → `422`, nada muda                                                       | integração                                                                          |
| Exame de outra organização → `404`; funcionário de outra organização → `422 FK_NOT_FOUND`                                                           | integração                                                                          |
| `notes` 2.000 ok / 2.001 recusado sem ecoar; `certificatePath` 500 ok / 501 recusado                                                                | unit + integração                                                                   |
| Observações ausentes dos logs (sucesso, rejeição, bloqueio); log de 500 sem `params`                                                                | integração (spy de `console`) + unit `audit-log`                                    |
| Medicina habilitada cria; desabilitada → `FORBIDDEN`/`403`; exame de empresa sem Medicina → `404`                                                   | integração                                                                          |
| Papel `client` → `403`/`FORBIDDEN`; isolamento `org_b` × `org_a`                                                                                    | integração                                                                          |
| Formulário: aviso de datas e limites, funcionário fixo na edição, erros junto aos campos, sem código cru, digitado preservado, status de salvamento | unit `medicine/health-exam-form-validation` + `error-messages`                      |

Contrato alterado de propósito (regressão esperada, não falha): `health-exams-filters` "mover exame para funcionário de companyA3"
agora espera `VALIDATION` (troca de funcionário) em vez de `FORBIDDEN`, e confirma que o exame não mudou.

**Não executado nesta rodada:** QA no navegador (precisa do login do Carlos no Clerk de desenvolvimento) e CI da PR.

## Cenários planejados

| #   | Cenário                                                      | Camada | Esperado                                                |
| --- | ------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| Q01 | `valid_until` anterior a `performed_at` (se T02-A2 aprovada) | U + I  | `VALIDATION`                                            |
| Q02 | Backfill de `company_id` reexecutado                         | I      | sem efeito na 2ª vez                                    |
| Q03 | Funcionário transferido de empresa                           | I      | exames antigos mantêm a empresa original                |
| Q04 | Empresa sem Medicina                                         | I      | exames, procedimentos e auditoria invisíveis ao runtime |
| Q05 | Runtime tenta UPDATE/DELETE em `medical_audit_events`        | I      | negado (42501 → `FORBIDDEN`)                            |
| Q06 | Falha ao gravar auditoria                                    | I      | operação inteira desfeita                               |
| Q07 | `metadata` da auditoria                                      | U + I  | sem campos clínicos (`notes`, aptidão, CID)             |
| Q08 | Procedimento com valor de resultado                          | U      | recusado pelo schema (não existe campo)                 |
| Q09 | Catálogo de procedimentos com dependentes                    | I      | `/dependents` lista; exclusão bloqueada (`IN_USE`)      |
| Q10 | `runIsolationSuite` nas tabelas novas                        | I      | 6 asserções                                             |
| Q11 | Exclusão de funcionário com exame (após MED-DEC-15)          | I      | arquivamento ou recusa, nunca perda                     |
| Q12 | Regressão do Lote 01 e das suítes de exames/módulos          | I      | sem falha nova                                          |

Ambiente: Postgres efêmero com `INTEGRATION_APP_RUNTIME_URL` + `INTEGRATION_DATABASE_URL`; conferir zero skipped. Migration ensaiada
no efêmero antes do merge (o merge aplica na homologação).
