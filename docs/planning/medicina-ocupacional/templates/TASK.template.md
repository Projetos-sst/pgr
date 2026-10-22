# TASK — Lote <preencher: NN> <preencher: nome>

<!-- Modelo. Copiar para lotes/<NN-slug>/TASK.md (links já relativos a essa pasta). Checkboxes SEMPRE vazios ao criar. Marcar [x] só quando houver evidência (commit real, teste executado).
     Nunca inventar commit, SHA ou data. -->

> Status real do lote: <preencher: estado controlado> · Atualizado em: <preencher: AAAA-MM-DD>

## Tarefas

| #   | Tarefa      | Critério de aceite       | Responsável       | Depende de  | Status real                                                                       |
| --- | ----------- | ------------------------ | ----------------- | ----------- | --------------------------------------------------------------------------------- |
| T1  | <preencher> | <preencher: verificável> | <preencher: nome> | <preencher> | <preencher: não iniciada / em andamento / bloqueada (motivo) / feita (evidência)> |

## Checklist

- [ ] T1 <preencher>
- [ ] T2 <preencher>

## DoD geral ([07](../../geral/07-CRITERIOS-DE-ENTREGA.md) §2)

- [ ] Requisito rastreável (issue / MED-xx / decisão)
- [ ] Permissões no servidor e no banco
- [ ] Regras S-01…S-13 conferidas
- [ ] Migrations conforme [06](../../geral/06-GIT-MIGRATIONS-CD.md) (ou "nenhuma")
- [ ] 4 superfícies para CRUD/HTTP
- [ ] Unit
- [ ] Integração em Postgres efêmero, sem suíte skipped
- [ ] `runIsolationSuite` para toda tabela nova
- [ ] Chrome DevTools (console/network)
- [ ] Playwright
- [ ] Revisão por subagente independente
- [ ] QA registrado
- [ ] TASK/WALKTHROUGH/QA/REVIEW atualizados
- [ ] `npm run check` verde
- [ ] CI verde
- [ ] Aprovação e merge com autorização

## DoD específica do lote

- [ ] <preencher a partir de ../../geral/07-CRITERIOS-DE-ENTREGA.md §3>

## Bloqueios registrados

- <preencher: teste ou tarefa impossível + motivo + quem destrava, ou "nenhum">
