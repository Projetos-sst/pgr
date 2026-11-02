# Lote 02 — TASK

> **Status real: 02A IMPLEMENTADO (sem migration), em PR; o restante do lote segue PLANEJADO.** **(atualizado em 2026-10-22)**
> Branch `feature/NOB-112-lote-02a-validacoes-exames` (base `origin/develop` = `e6f2542`). Detalhes em §A2 e no [QA](QA.md) §02A.
> Nenhuma migration criada; **numeração de migration não definida.**
> **(atualizado em 2026-10-21)** `0054`–`0059` estão reservadas (#112 e a pilha #119/#116/#117). Há rascunhos de mapa, formulários e contratos
> em [PROPOSTA-EXECUCAO](PROPOSTA-EXECUCAO.md), que só contam como entregues depois da revisão do Carlos.
> Responsável padrão: Carlos. [README](README.md) · [PLAN](PLAN.md)

## A. Sem migration (pode começar)

- [ ] **T02-A1** Mapa campo → entidade → documento (PLAN §2).
  - Critério de aceite: todas as abas/telas de Medicina do protótipo mapeadas com destino, sensibilidade e decisão pendente;
    nenhum campo de função/GES/risco como campo da Medicina; revisado pelo Carlos.
  - Responsável: Carlos. Dependências: nenhuma (NOB-93 ajudaria). Status: não iniciado. **(atualizado em 2026-10-21)** Há um rascunho em
    PROPOSTA-EXECUCAO §a, aguardando a revisão do Carlos.
- [x] **T02-A2** Decidir e, se aprovado, implementar a validação `valid_until >= performed_at` (PLAN §7).
  - Critério de aceite: decisão registrada; se implementada, unit + integração (`VALIDATION`) e as 4 superfícies inalteradas no contrato.
  - Responsável: Carlos. **(atualizado em 2026-10-22)** Decisão do Carlos: implementar no Lote 02A (missão de execução de 22/10).
    Implementada e testada (§A2). Status: **feito, em PR**.
- [ ] **T02-A3** Levar ao coordenador as perguntas novas para o [04](../../geral/04-DECISOES-E-BLOQUEIOS.md): visibilidade de exames
      após transferência; catálogo de procedimentos por escritório ou global; procedimentos iniciais.
  - Critério de aceite: entradas `MED-DEC-NN` criadas pelo coordenador. Responsável: Carlos. Status: não iniciado.
  - **(atualizado em 2026-10-21)** MED-DEC-23 (transferência) e MED-DEC-24 (catálogo) já existem no 04, ambas `PENDENTE`; falta perguntar.
    Há perguntas novas em PROPOSTA-EXECUCAO §d.3.

## A2. Lote 02A — validações e mensagens sem migration (executado em 2026-10-22)

Escopo fechado pelo Carlos: só banco e schema existentes; nenhuma regra clínica nova; nenhuma validade calculada.

- [x] **T02A-1** Vencimento não anterior à realização (`validUntil >= performedAt`, igual permitido, ausente permitido), no schema Zod
      usado por criação, edição, REST e Server Actions; datas comparadas como texto AAAA-MM-DD (sem fuso). Mensagem
      "Vencimento anterior à realização." no campo `validUntil`. Aviso imediato também no formulário.
- [x] **T02A-2** Tipo de exame inválido recusado com `422 VALIDATION` ("Tipo de exame inválido"), inclusive no filtro `?examType=` da
      listagem (REST, Action e página), que antes era ignorado em silêncio. Enum inalterado.
- [x] **T02A-3** Identidade do exame: no `PUT`/`updateHealthExamAction`, o `employeeId` precisa ser o funcionário atual do exame;
      troca → `422 VALIDATION` antes de qualquer consulta ao funcionário pedido. O `UPDATE` deixa de gravar `employee_id`. Na edição,
      o formulário mostra o funcionário só para leitura. Transferência de empresa e `company_id` histórico continuam fora (T02-C1).
- [x] **T02A-4** Limites de entrada: `notes` ≤ 2.000 e `certificatePath` ≤ 500 caracteres (após `trim`), sem mudar colunas nem dados
      antigos. Orientação no formulário: "Não registre diagnósticos, CID ou informações clínicas sensíveis neste campo."
- [x] **T02A-5** Mensagens: o formulário e as telas da Medicina não mostram mais código cru (`FORBIDDEN` etc.); referência inexistente
      vira frase em PT; corpo JSON malformado → `422` (antes `500`); o log de erro inesperado do REST omite os `params` da query
      (podiam conter `notes`).
- [x] **T02A-6** Testes unit + integração (Postgres efêmero) e documentação mínima (`api-design.md`, Postman, este TASK, QA,
      WALKTHROUGH, REVIEW).
- [ ] **T02A-7** QA no navegador (criação/edição/erros/responsividade) com login do Carlos. **Não executado nesta rodada.**
- [ ] **T02A-8** Review do TL, CI da PR, merge **com autorização** e homologação.

## B. Aguardando decisões

- [ ] **T02-B1** MED-DEC-08 (ordem e numeração) e MED-DEC-26 (estratégia de migrations com CD). Aguardando: **Douglas** (+ Rikelvin).
      **(atualizado em 2026-10-21)** A #112 está aberta, em draft, base `develop`, CI verde, não mergeada; a pilha 0057–0059 está empilhada sobre ela.
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
