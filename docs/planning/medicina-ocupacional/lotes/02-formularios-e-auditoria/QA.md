# Lote 02 — QA

> [README do lote](README.md)

## Estado

**NÃO INICIADO — nenhum teste executado.**

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
