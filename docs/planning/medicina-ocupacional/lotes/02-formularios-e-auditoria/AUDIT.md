# Lote 02 — AUDIT

> HEAD `d6b787c`. Leitura de código pontual; o restante referencia a Fase 0. [README do lote](README.md)

## 1. Situação existente

| Aspecto                  | Fato                                                                                                                                                                                  | Evidência                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Registro de exame        | `health_exams`: `employee_id`, `doctor_id`, `exam_type`, `performed_at`, `valid_until`, `aptitude`, `notes`, `certificate_path`                                                       | `src/shared/db/schema/health-exams.ts:41-60`                                                              |
| Empresa do exame         | **não existe coluna**; visibilidade segue `employees.company_id` atual                                                                                                                | policy `health_exams_module_access`, `schema/health-exams.ts:63-70`                                       |
| Tipo de exame            | enum `exam_type` (5 valores) **compartilhado** com `service_orders.os_type`                                                                                                           | `schema/health-exams.ts:19`; `schema/service-orders.ts:23,46`                                             |
| Exclusão                 | `employee_id` com `ON DELETE CASCADE` (l.50); `doctor_id` `SET NULL` (l.51); `employees.company_id` `CASCADE` (`schema/employees.ts:46`) → apagar empresa ou funcionário apaga exames | idem                                                                                                      |
| DELETE físico            | `deleteHealthExam` apaga a linha                                                                                                                                                      | `src/shared/db/repositories/health-exams.ts:178-188`                                                      |
| Auditoria                | `auditedTenantWrite` + `logTenantEvent` → **console**, sem trilha persistida                                                                                                          | `src/shared/db/repositories/audited-write.ts`; [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §4.5  |
| Precedente append-only   | `company_module_events` (GRANT S/I, motivo obrigatório)                                                                                                                               | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.2                                                 |
| Procedimentos            | inexistentes; o ASO não registra exames complementares                                                                                                                                | GAP-MATRIX MED-09                                                                                         |
| Validações atuais        | `performed_at` não-futura (`domains/pgr/health-exams.ts:79-83`); `valid_until` só formato (l.90)                                                                                      | código                                                                                                    |
| Campo livre clínico      | `notes` sem classificação; `employees.blood_type` no cadastro comum                                                                                                                   | AUDIT-SECURITY R7                                                                                         |
| Formulários do protótipo | abas com funções/riscos/exames **dentro** da empresa, duplicando cadastros                                                                                                            | [`../../AUDIT-UX.md`](../../AUDIT-UX.md) §4.5; [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.2 |

## 2. Lacunas

1. Sem mapa campo → entidade → documento (critério da NOB-112).
2. Sem procedimentos por exame (P4).
3. Sem trilha de auditoria de leitura e escrita de dado de saúde (P9; AUDIT-SECURITY R3, **P0 para dado clínico**).
4. Exame "muda de empresa" quando o funcionário é transferido (sem `company_id` próprio).
5. Exames apagados por DELETE físico e por CASCADE (AUDIT-SECURITY R4, P1).
6. **Coerência de datas não validada:** `valid_until` anterior a `performed_at` é aceito (achado desta organização; regra técnica, não
   clínica).
7. Tipos de exame presos a um enum compartilhado; acrescentar valor afeta OS e esbarra em `ALTER TYPE … ADD VALUE` no lote
   transacional do drizzle ([`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §7, R3).
8. "Salvar e retomar" (rascunho) inexistente; estados de documento dependem de A-09 (Lote 04).

## 3. Riscos

| Risco                                                             | Impacto                                                                  | Mitigação                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Migration mergeada antes da #112                                  | Rikelvin regera `0054`/`0055`                                            | Nenhuma migration até MED-DEC-08                                                  |
| Merge em develop aplica migration na homologação (`cd.yml:67-75`) | Mudança de schema imediata, sem rollback                                 | Revisão de TL **antes** do merge; migrations aditivas; ensaio em Postgres efêmero |
| Trocar a policy de `health_exams` para o `company_id` próprio     | Exames somem ou aparecem para outra empresa se o backfill estiver errado | Backfill idempotente e conferido; troca de policy em passo separado               |
| Guardar resultado clínico sem perfil clínico                      | Exposição a todo o escritório                                            | Só `pending/done/not_done`; nada de valor                                         |
| Arquivar sem prazo definido                                       | Decisão jurídica tomada por código                                       | Esperar MED-DEC-15                                                                |
| Auditoria com conteúdo clínico em `metadata`                      | Vazamento pelo próprio log                                               | `metadata` sem conteúdo clínico, testado                                          |

## 4. Dependências

Ver [README](README.md#bloqueios-e-dependências). Cadeia: MED-DEC-08 → (company_id, P9, P4) → Lote 04 (ASO usa procedimentos e
auditoria) → Lote 05. MED-DEC-15 → arquivamento.

## 5. Decisões técnicas já registradas que este lote respeita

- Uma migration por PR, `drizzle-kit generate` após rebase, `when` maior que o último, aditiva, estados em `text` + CHECK
  ([`../../IMPLEMENTATION-PLAN.md`](../../IMPLEMENTATION-PLAN.md), última seção).
- Toda tabela nova de Medicina: FK composta `(company_id, org_id)`, `*_isolation` + `*_module_access` RESTRICTIVE `medicine`,
  `runIsolationSuite` ([`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §4).
- Cadastros comuns sem cópia (NOB-99).
