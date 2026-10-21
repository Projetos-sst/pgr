# Lote 03 — QA

> [README do lote](README.md)

## Estado

**NÃO INICIADO — nenhum teste executado.**

## Cenários planejados (dependem das decisões)

| # | Cenário | Camada | Esperado |
|---|---|---|---|
| Q01 | Owner/colaborador sem designação tenta validar risco | I | `FORBIDDEN` na aplicação **e** no banco |
| Q02 | Profissional designado valida entrada `pending` | I | revisão append-only gravada; conteúdo da fonte inalterado |
| Q03 | Designação revogada; nova decisão | I | recusada; histórico preservado |
| Q04 | Validações anteriores após revogação | I | conforme MED-DEC-06 (regra a definir) |
| Q05 | Dois coordenadores vigentes na mesma empresa (se a regra existir) | I | recusado |
| Q06 | Profissional designado na empresa A tenta validar na empresa B | I | `FORBIDDEN` |
| Q07 | Cross-tenant e módulo `medicine` desligado em toda tabela nova | I | invisível / recusado |
| Q08 | Fonte externa importada | U + I | sempre `pending`; JSON com status/aprovador rejeitado |
| Q09 | Documento de PGR externo no GED | I | acessível só a quem acessa a fonte; download cross-tenant → 404 |
| Q10 | Reimportar o mesmo arquivo da Lista C | U + I | sem efeito |
| Q11 | Nova versão da Lista C | I | anterior `superseded`, preservada |
| Q12 | Runtime tenta escrever em dataset global | I | negado |
| Q13 | Concessão e revogação auditadas | I | evento append-only com motivo |

Ambiente: Postgres efêmero (`INTEGRATION_APP_RUNTIME_URL` + `INTEGRATION_DATABASE_URL`), zero skipped; dados fictícios; nenhum dado de
profissional real.
