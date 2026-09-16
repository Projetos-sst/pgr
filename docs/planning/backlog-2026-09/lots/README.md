# Lotes em execução

Cada lote ganha uma pasta `lot-XX/` **quando começa** — nunca antes. Regras completas em
[../EXECUTION-PLAN.md](../EXECUTION-PLAN.md); composição dos lotes em [../LOTS.md](../LOTS.md).

```
lot-XX/
├── PLAN.md     # fase 1 — antes de qualquer código
├── TASK.md     # fase 2 — checklist operacional, atualizado durante a implementação
└── REVIEW.md   # fase 4 — só depois da(s) PR(s) abertas
```

## Esqueleto do PLAN.md

```markdown
# Lote XX — <nome>

Base: develop @ <sha> · Data: AAAA-MM-DD

## Objetivos

## Issues (critérios de aceite copiados)

## Arquitetura e decisões

## Arquivos afetados

## Backend

## Frontend

## Migrations (número definido só na hora de gerar)

## Dependências e premissas

## Riscos

## Sequência

## Testes

## Definition of Done
```

## Esqueleto do TASK.md

```markdown
# Lote XX — TASK

- [ ] Preparação (fetch, develop atualizada, branch, cards → In progress)
- [ ] Schema
- [ ] Migration
- [ ] Domain
- [ ] Repository
- [ ] Server Actions
- [ ] REST
- [ ] Frontend
- [ ] Testes (unit / integration / REST / RLS / E2E)
- [ ] Docs (api-design.md + Postman)
- [ ] Rebase em origin/develop
- [ ] CI
- [ ] Validação final

## Notas de retomada
```

Item que não se aplica: `- [x] N/A — <motivo>`.

## Esqueleto do REVIEW.md

```markdown
# Lote XX — REVIEW

## Planejado × realizado

## Diferenças e decisões

## Migrations

## Testes e CI

## Regressões verificadas

## Riscos residuais e dívida

## PRs

## Próximos passos
```
