# Lote 02 — PLAN

> **(atualizado em 2026-10-21)** `0054`–`0056` estão reservadas pela #112 (draft, base `develop`, CI verde, não mergeada) e `0057`–`0059` pela pilha
> #119/#116/#117. Maior `when` reservado: 1792608470913. A proposta executável está em [PROPOSTA-EXECUCAO](PROPOSTA-EXECUCAO.md).
>
> **Proposta.** Nenhuma migration foi criada e a **numeração não está definida** (MED-DEC-08, MED-DEC-26). Os nomes de tabela e coluna são
> indicativos, vindos de [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.4. Nenhuma permissão clínica definitiva é
> desenhada aqui. [README do lote](README.md) · [AUDIT](AUDIT.md) · [TASK](TASK.md)

## 1. Resultado esperado

| Fase | Resultado                                                                                                                      | Migration? | Pode começar                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------- |
| 2a   | Mapa campo → entidade → documento das abas do protótipo, com destino de cada campo (reutilizar / estender / novo / fora)       | não        | **sim**                                         |
| 2a   | Validação de coerência `valid_until >= performed_at` no schema zod de exames (técnica, sem regra clínica), se o Carlos aprovar | não        | sim                                             |
| 2b   | `health_exams.company_id` = empresa na data do exame                                                                           | sim        | após MED-DEC-08                                 |
| 2c   | Trilha de auditoria clínica append-only (P9)                                                                                   | sim        | após MED-DEC-08; desenho revisado pelo Rikelvin |
| 2d   | Catálogo de procedimentos + procedimentos por exame, **sem valores de resultado** (P4)                                         | sim        | após MED-DEC-08 e conteúdo do Dr. Alcides       |
| 2e   | Arquivamento no lugar de DELETE físico/CASCADE                                                                                 | sim        | após MED-DEC-15                                 |

## 2. Fase 2a — mapa de campos (sem migration)

Entregável da NOB-112, em `docs/planning/medicina-ocupacional/lotes/02-formularios-e-auditoria/`. **(atualizado em 2026-10-21)** Há um rascunho em
[PROPOSTA-EXECUCAO](PROPOSTA-EXECUCAO.md) §a, aguardando a revisão do Carlos. Ele foi construído a partir de [`../../AUDIT-PROTOTYPE.md`](../../AUDIT-PROTOTYPE.md) §5.2 e
[`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.2. Colunas mínimas:

| Aba/tela do protótipo (ID P-xx) | Campo | Destino | Entidade/tabela | Documento que consome (ASO, PCMSO, PPP…) | Sensibilidade | Decisão pendente |
| ------------------------------- | ----- | ------- | --------------- | ---------------------------------------- | ------------- | ---------------- |

Regras do mapa: funções, GES e riscos **nunca** viram campo da Medicina (vêm dos cadastros e de `medical_risk_*`); campo sem dono
fica "fora do MVP"; campo clínico sensível fica marcado e sem destino até MED-DEC-11/14.

## 3. Fase 2b — `company_id` histórico do exame

| Aspecto                          | Proposta                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mudança                          | ALTER `health_exams` ADD `company_id uuid` **nullable** + FK composta `(company_id, org_id) → companies(id, org_id)` (há `uq_companies_id_org` desde a 0053)                                                                                          |
| Backfill                         | `company_id = employees.company_id` do momento da migration, idempotente (`WHERE company_id IS NULL`)                                                                                                                                                 |
| Aplicação                        | create/update gravam `company_id` = empresa do funcionário **na data do registro**; editar o exame não muda a empresa                                                                                                                                 |
| Policy                           | troca de `health_exams_module_access` para usar o `company_id` próprio **em migration separada**, depois de conferido o backfill                                                                                                                      |
| NOT NULL                         | só em migration posterior (regra aditiva)                                                                                                                                                                                                             |
| Pergunta de produto/clínica nova | Depois de uma transferência, a empresa nova vê os exames feitos na anterior? **(atualizado em 2026-10-21)** Registrada como MED-DEC-23 (`PENDENTE`) no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md). ON DELETE da FK nova: ver PROPOSTA-EXECUCAO §e.1 |
| Testes                           | backfill; transferência não move exame; empresa sem Medicina continua sem ver; isolamento; filtro do Lote 01 passa a usar o campo próprio                                                                                                             |

## 4. Fase 2c — trilha de auditoria clínica (P9)

| Aspecto                                       | Proposta                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabela                                        | `medical_audit_events` (`org_id`, `company_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `at`, `metadata jsonb`)                           |
| Conteúdo                                      | **sem conteúdo clínico** em `metadata` (só IDs, campos alterados por nome, motivo quando houver)                                                         |
| Acesso                                        | runtime só `SELECT`/`INSERT`; sem `UPDATE`/`DELETE` (precedente `company_module_events`)                                                                 |
| Escrita                                       | na **mesma transação** da operação; falha da auditoria desfaz a operação (padrão de `company-module-management.test.ts`)                                 |
| Leitura auditada                              | registrar leitura de exame individual (ficha, edição); listas agregadas: decidir volume (HIPÓTESE: não auditar contagens)                                |
| Retenção                                      | SPEC do protótipo fala em 5 anos (HIPÓTESE; validar com jurídico)                                                                                        |
| Quem vê a trilha                              | **não definido** (MED-DEC-11/21); até lá, sem tela                                                                                                       |
| Revisão                                       | Rikelvin (R-05), com aceite dele                                                                                                                         |
| Precedente na #112 (atualizado em 2026-10-21) | `app.current_actor` + `REVOKE UPDATE, DELETE` em trilhas append-only (`0056_company_risk_authorizations`, não mergeada). Reusar depende do merge da #112 |

## 5. Fase 2d — procedimentos do exame (P4)

| Aspecto       | Proposta                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catálogo      | `exam_procedures` (`org_id`, `name`, `code` nullable, `kind` CHECK `clinical`/`complementary`, `active`), `UNIQUE(org_id, name)`                                                           |
| Por exame     | `health_exam_procedures` (`org_id`, `company_id`, `health_exam_id`, `procedure_id`, `performed_at`, `result_status` CHECK `pending`/`done`/`not_done`)                                     |
| Sem resultado | nenhum valor, laudo ou interpretação (decisão do Dr. Alcides; AUDIT-DATABASE §10.4 P4)                                                                                                     |
| RLS           | isolation + `medicine` RESTRICTIVE; `health_exam_id` CASCADE (revisar junto com a fase 2e)                                                                                                 |
| Perguntas     | catálogo por escritório ou referência global (ex.: tabela do eSocial)? quais procedimentos iniciais? (Dr. Alcides) **(atualizado em 2026-10-21)** Registradas como MED-DEC-24 (`PENDENTE`) |
| Superfícies   | CRUD do catálogo com as 4 superfícies (Action, REST, api-design, Postman) + `/dependents` (o catálogo terá FK de entrada)                                                                  |

## 6. Fase 2e — preservação de registros

Só depois de MED-DEC-15. Direção técnica (AUDIT-DATABASE §10.4; AUDIT-SECURITY R4): `archived_at`/`archived_by`/`archive_reason` em
`health_exams`; troca de `ON DELETE CASCADE` por `RESTRICT` em `health_exams.employee_id`; exclusão de funcionário ou empresa com
exame vira arquivamento ou é recusada com mensagem clara. Prazo, exceções (amianto, radiação) e quem pode arquivar: **não definidos**.

## 7. Persistência, histórico e validação

- **Validação técnica proposta (zero migration):** `valid_until >= performed_at` quando informado, com mensagem "Vencimento anterior à
  realização". Não é regra clínica; precisa do OK do Carlos (pode entrar como PR pequeno, separado do Lote 01).
- **Histórico:** a trilha P9 cobre "quem alterou o quê e quando"; versionamento de conteúdo do exame (snapshot) é do Lote 04 (emissão).
- **Salvar e retomar:** só se o mapa da fase 2a mostrar formulário longo que precise de rascunho; estados de documento continuam
  dependentes de A-09.
- **Tipo de exame:** se for preciso tipo novo, propor ao Douglas (D-13) tipo próprio em `text` + CHECK, sem mexer no enum compartilhado.

## 8. Segurança

- Nenhum papel clínico ou perfil novo é criado neste lote; owner/collaborator continuam como hoje (MED-DEC-11, MED-DEC-21).
- Nada de valor de resultado clínico; nada de CID; nada em IA (MED-DEC-20).
- Toda tabela nova: RLS isolation + `medicine` RESTRICTIVE + FK composta + `runIsolationSuite` + teste "módulo desligado".
- Auditoria sem conteúdo clínico; teste que falha se `metadata` contiver campos clínicos.

## 9. Testes (quando houver implementação)

Unit (zod, funções puras), integração em Postgres efêmero (isolamento, módulo desligado, runtime tentando UPDATE/DELETE proibido na
auditoria, rollback quando a auditoria falha, backfill idempotente, transferência de funcionário), regressão do Lote 01 e de
`health-exams`/`company-modules`. Nenhum dado clínico real.

## 10. Sequência

1. 2a: mapa de campos (agora) e validação de datas (se aprovada).
2. Aguardar MED-DEC-08 e MED-DEC-26; combinar numeração com o Rikelvin, considerando a #112 (0054–0056) e a pilha 0057–0059 **(atualizado em 2026-10-21)**.
3. 2b → 2c → 2d, uma migration por PR, cada uma com as 4 superfícies quando houver HTTP.
4. 2e após MED-DEC-15.
