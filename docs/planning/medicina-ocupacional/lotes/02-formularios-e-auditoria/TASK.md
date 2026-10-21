# Lote 02 — TASK

> **Status real: PLANEJADO. Nenhuma tarefa iniciada.** Sem branch, PR ou migration. **Numeração de migration não definida.**
> Responsável padrão: Carlos. [README](README.md) · [PLAN](PLAN.md)

## A. Sem migration (pode começar)

- [ ] **T02-A1** Mapa campo → entidade → documento (PLAN §2).
  - Critério de aceite: todas as abas/telas de Medicina do protótipo mapeadas com destino, sensibilidade e decisão pendente;
    nenhum campo de função/GES/risco como campo da Medicina; revisado pelo Carlos.
  - Responsável: Carlos. Dependências: nenhuma (NOB-93 ajudaria). Status: não iniciado.
- [ ] **T02-A2** Decidir e, se aprovado, implementar a validação `valid_until >= performed_at` (PLAN §7).
  - Critério de aceite: decisão registrada; se implementada, unit + integração (`VALIDATION`) e as 4 superfícies inalteradas no contrato.
  - Responsável: Carlos. Dependências: decisão do Carlos. Status: não iniciado.
- [ ] **T02-A3** Levar ao coordenador as perguntas novas para o [04](../../geral/04-DECISOES-E-BLOQUEIOS.md): visibilidade de exames
  após transferência; catálogo de procedimentos por escritório ou global; procedimentos iniciais.
  - Critério de aceite: entradas `MED-DEC-NN` criadas pelo coordenador. Responsável: Carlos. Status: não iniciado.

## B. Aguardando decisões

- [ ] **T02-B1** MED-DEC-08 (ordem e numeração). Aguardando: **Douglas** (+ Rikelvin).
- [ ] **T02-B2** MED-DEC-15 (prazo de guarda). Aguardando: **Dr. Alcides + jurídico**.
- [ ] **T02-B3** MED-DEC-11 (arquitetura clínica). Aguardando: **Douglas**.
- [ ] **T02-B4** D-13 (tipo de exame próprio), só se o mapa exigir tipo novo. Aguardando: **Douglas**.

## C. Com migration (bloqueado até T02-B1)

- [ ] **T02-C1** `health_exams.company_id` (PLAN §3): migration aditiva + backfill + escrita na aplicação; troca de policy em passo
  separado.
  - Critério de aceite: backfill idempotente; transferência não move exame; isolamento e "módulo desligado" testados em Postgres efêmero;
    filtro do Lote 01 ajustado. Dependências: T02-B1, Lote 01 mergeado. Status: não iniciado.
- [ ] **T02-C2** Trilha de auditoria P9 (PLAN §4).
  - Critério de aceite: append-only (UPDATE/DELETE negados ao runtime, testado); mesma transação com rollback; `metadata` sem conteúdo
    clínico (testado); desenho revisado pelo Rikelvin. Dependências: T02-B1, T02-B3 (onde vive). Status: não iniciado.
- [ ] **T02-C3** Procedimentos P4 (PLAN §5).
  - Critério de aceite: sem valores de resultado; CRUD do catálogo com as 4 superfícies + `/dependents`; `runIsolationSuite`; módulo
    desligado esconde. Dependências: T02-B1, T02-A3 respondida. Status: não iniciado.

## D. Bloqueado até T02-B2

- [ ] **T02-D1** Arquivamento no lugar de DELETE/CASCADE (PLAN §6).
  - Critério de aceite: regra de retenção aprovada citada; exclusão com exame vira arquivamento ou recusa; teste de DELETE bloqueado.
  - Dependências: T02-B2, T02-C1. Status: não iniciado.

## E. Fechamento (para cada PR do lote)

- [ ] **T02-E1** Review, QA, PR, CI, aceite, merge **com autorização** (lembrando que o merge aplica a migration na homologação) e
  homologação, no mesmo formato do [TASK do Lote 01](../01-ficha-saude-ocupacional/TASK.md) itens 14–20. Status: não iniciado.
