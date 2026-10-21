# Lote 02 — REVIEW

> [README do lote](README.md)

## Estado

**NÃO INICIADO — nenhuma revisão realizada.**

## Checklist do que revisar

- [ ] MED-DEC-08 respondida antes de qualquer migration; numeração gerada por `drizzle-kit generate`, `when` maior que o último.
- [ ] Uma migration por PR; aditiva; estados em `text` + CHECK; GRANT e triggers como SQL custom no padrão do repositório.
- [ ] FK composta `(company_id, org_id)`; `*_isolation` + `*_module_access` RESTRICTIVE `medicine` em toda tabela nova.
- [ ] Auditoria append-only, na mesma transação, sem conteúdo clínico; revisada pelo Rikelvin.
- [ ] Procedimentos sem valor de resultado.
- [ ] Nenhum papel clínico ou permissão definitiva criados sem MED-DEC-11/21.
- [ ] Arquivamento só com MED-DEC-15 citada; nenhum DELETE de exame sem avaliar retenção.
- [ ] Troca de policy de `health_exams` em passo separado do backfill.
- [ ] 4 superfícies para todo HTTP novo; `/dependents` quando houver FK de entrada.
- [ ] Testes em Postgres efêmero, zero skipped; regressão do Lote 01.
- [ ] Revisão de TL **antes** do merge (o merge muda o banco de homologação).
