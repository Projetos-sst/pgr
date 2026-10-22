# Lote 02 — WALKTHROUGH

> Só fatos de implementação. [README do lote](README.md)

## Estado

**02A IMPLEMENTADO (sem migration), em PR. (atualizado em 2026-10-22)** O restante do lote (com migration) não foi iniciado.

## 02A — fatos de implementação (2026-10-22)

- Branch `feature/NOB-112-lote-02a-validacoes-exames`, criada de `origin/develop` = `e6f2542` (inclui a #120 do Lote 01 e a #121
  com as migrations 0057–0059). Nenhum cherry-pick.
- **Zero migration**: nenhum arquivo em `src/shared/db/migrations/`, nenhuma mudança em `src/shared/db/schema/`, RLS, FKs ou policies.
- Regras (todas no mesmo `healthExamInputSchema`, usado pelas Server Actions e pelo REST):
  - `validUntil >= performedAt`: função pura `isValidUntilBeforePerformedAt` (texto AAAA-MM-DD, sem `Date`), `refine` com `when`
    para a mensagem aparecer mesmo com erro em outro campo;
  - limites `HEALTH_EXAM_NOTES_MAX = 2000` e `HEALTH_EXAM_CERTIFICATE_PATH_MAX = 500`, contados após `trim`;
  - filtro `examType` validado em `healthExamListFiltersSchema` (REST, Action e página `/health-exams`).
- Identidade: `updateHealthExam` lê o exame com `SELECT … FOR UPDATE` (org + RLS), recusa `employeeId` diferente com
  `ValidationError` e não grava mais `employee_id` no `UPDATE`. A checagem de módulo por empresa (`assertCompanyModuleTx`) segue igual.
- Mensagens: helper puro `domains/medicine/error-messages.ts` (`medicineErrorLabel`, `healthExamFormFeedback`). `ReferenceNotFoundError`
  dos exames ganhou frase em PT. REST de exames usa `readJsonBody` (JSON malformado → `422`). `restHandler` passou a logar
  `safeErrorMessage(error)` (omite os `params` do erro do Drizzle).
- Formulário (`health-exam-form.tsx`): funcionário só leitura na edição (`lockedEmployee`), observações em `textarea` com a
  orientação de não registrar dado clínico, aviso imediato de datas/limites, resumo "Revise os campos destacados.", status
  "Exame salvo. Voltando…", campos não controlados (o digitado não se perde em erro).
- Contrato alterado de propósito: o teste do Lote 01 "mover exame para funcionário de companyA3" passou a esperar `VALIDATION`
  (a troca é recusada antes da checagem de módulo); o exame continua com o funcionário original (verificado no teste).
- Dado legado: exame antigo com vencimento anterior à realização continua legível e intacto; a edição exige corrigir as datas
  (fixture `seedLegacyInvalidDateExam`, teste de integração).

## O que deverá ser registrado aqui

## O que deverá ser registrado aqui

- Entrega do mapa de campos (arquivo, data, revisão do Carlos).
- Decisão sobre a validação de datas e, se feita, o commit.
- Data e fonte de MED-DEC-08 e o número de migration efetivamente gerado por `drizzle-kit generate` (nunca escolhido à mão).
- Para cada migration: arquivo, `when`, PR, SHA do merge e **data em que o CD a aplicou na homologação**.
- Resultado do backfill de `company_id` (contagens antes/depois, sem dado pessoal).
- Revisão do Rikelvin sobre a trilha P9.
- Decisão de retenção (MED-DEC-15) e o que foi implementado a partir dela.
