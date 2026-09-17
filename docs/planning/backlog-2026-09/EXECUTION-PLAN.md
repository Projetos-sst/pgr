# Plano de execução

## Estratégia escolhida

As três issues mais fáceis (#33, #42, #56) estão em **três módulos diferentes**. Comparação:

| Estratégia                   | Lote 1 seria       | Issues fecháveis | Risco |
| ---------------------------- | ------------------ | ---------------- | ----- |
| A — quick wins puros         | #42, #56, #33      | 3                | Baixo |
| B — coesão por domínio (PGR) | #42 + parte de #47 | 1                | Médio |

**Escolha: A no Lote 1, B a partir do Lote 2.** As três quick wins não compartilham arquivos, não têm
migration e são pequenas o bastante para que a troca de contexto custe pouco. Coesão por domínio só
compensa quando as tarefas mexem nos mesmos arquivos — que é exatamente o caso de PGR (2–3) e GED (5–7).

**Revisão após auditoria específica e decisões (2026-09-16):** o Lote 1 segue a ordem **1A (#56) → 1C (#33) →
1B (#42)**. #42 subiu para dificuldade 3, mas as decisões de produto já foram tomadas; #33 é fechada sem código.
As mudanças de PDF que #42 implica migram para o Lote 2, junto de #47. **Exceção à regra de PR:** por decisão do
responsável, o Lote 1 é entregue numa PR única, com commits separados por issue.

## Ordem geral e por quê

1. **Lote 1 (1A → 1C → 1B)** — entrega rápida, zero migration, e valida o workflow PLAN → TASK → REVIEW.
2. **Lote 2** — maior valor para o cliente (NR-09 + PDF é o entregável regulatório) e está pronto com premissas.
3. **Lote 3** — fecha o PGR; depende das respostas de #40.
4. **Lote 4** — independente; pode correr em paralelo a 2/3 se houver capacidade.
5. **Lotes 5 → 6 → 7** — GED só começa com spec e decisões; é o maior bloco e o de maior risco.
6. **Lote 8** — decisão; pode ser resolvido a qualquer momento por comentário, sem código.

Enquanto os lotes 1–4 andam, as perguntas de [REQUIREMENTS-GAPS.md](REQUIREMENTS-GAPS.md) seguem para o
Tech Lead, para o GED não travar quando chegar a vez dele.

## Workflow obrigatório de cada lote

Artefatos em `docs/planning/backlog-2026-09/lots/lot-XX/`.

### Fase 1 — PLAN (`PLAN.md`)

Objetivos · issues · arquitetura · arquivos afetados · backend · frontend · migrations · dependências ·
riscos · sequência · testes · Definition of Done. Escrito **depois** de reler o código atual da `develop`
— as fichas de `tasks/` são ponto de partida, não verdade.

### Fase 2 — TASK (`TASK.md`)

Checklist operacional que permite retomar o lote em outra sessão. Itens não aplicáveis ficam como `N/A`
com motivo, nunca apagados:

```markdown
- [ ] Preparação (sync develop, branch, card → In progress)
- [ ] Schema
- [ ] Migration
- [ ] Domain (Zod + regras puras)
- [ ] Repository (withOrg)
- [ ] Server Actions (officeAction)
- [ ] REST (restHandler)
- [ ] Frontend
- [ ] Testes (unit / integration / REST / RLS / E2E)
- [ ] Docs (api-design.md + Postman)
- [ ] Rebase em origin/develop
- [ ] CI
- [ ] Validação final (Playwright 375/768/1440 quando houver UI)
```

### Fase 3 — Implementação

Só começa com PLAN e TASK escritos. `TASK.md` é atualizado conforme os itens fecham.

### Fase 4 — REVIEW (`REVIEW.md`)

Planejado × realizado · diferenças e decisões · migrations · testes · CI · riscos residuais · dívida ·
regressões verificadas · PRs · próximos passos. O lote só está encerrado com REVIEW escrito e as fichas de
`tasks/` atualizadas.

## Branches e PRs

Antes de cada lote:

```bash
git fetch origin --prune
git checkout develop
git pull --ff-only origin develop
```

- Nome segue `docs/pr-patterns.MD`: `<issue>-<tipo>/<descricao-kebab>` (ex.: `42-feat/risk-action-plan-coverage`).
  Uma PR cobrindo o lote inteiro usa `lot-XX-<tipo>/<descricao>`.
- Commits: `#<issue> <tipo>: <descrição no imperativo>`.
- Issues independentes dentro do lote podem ter PRs separadas, compartilhando PLAN/TASK/REVIEW.
- PR com template do repo (objetivo, o que mudou, como testar, riscos, checklist) e `Closes #N` só quando
  **todos** os critérios de aceite da issue forem atendidos (ex.: #47 não fecha no Lote 2).
- Card: Backlog → **In progress** ao iniciar o lote; → **In review** ao abrir a PR. **Merge é do responsável
  humano** — nunca automático.

## Rebase antes de toda PR

```bash
git fetch origin --prune
git rebase origin/develop
```

Depois do rebase: reexecutar testes e build, revalidar migrations e recapturar evidências. `--force-with-lease`,
nunca `--force`. Nunca descartar código de terceiros para resolver conflito.

## Migrations

Desenvolvimento paralelo já causou três colisões de número neste repo. Antes de **qualquer** migration:

1. `git fetch origin --prune` e rebase na `develop`.
2. `gh pr list --state open` — alguma PR aberta traz migration?
3. Conferir a maior migration em `src/shared/db/migrations/` e o `meta/_journal.json`.
4. Só então `npm run db:generate`, renomear o `.sql`, ajustar a tag no journal e adicionar GRANT, policy e
   trigger `set_updated_at` como SQL custom.

Se a colisão aparecer no rebase: aceitar o `_journal.json` da `develop`, apagar o `.sql` órfão, rodar
`db:generate` de novo, renomear, corrigir a tag e fazer amend. **Nunca reservar número de migration em
documento.**

## Gates por lote

| Gate                                          | Quando                                |
| --------------------------------------------- | ------------------------------------- |
| `npm run check`                               | Sempre                                |
| `npm run build`                               | Sempre                                |
| `npm run test:integration` (Postgres efêmero) | Server Action, REST, RLS ou migration |
| Teste negativo cross-tenant                   | Toda consulta ou tabela nova          |
| Testes REST (status HTTP por código de erro)  | Todo endpoint novo                    |
| Playwright 375/768/1440                       | Toda UI tocada                        |
| Regressão dos módulos tocados                 | Sempre (ex.: PDF pelos 2 chamadores)  |
| api-design.md + Postman                       | Todo endpoint novo                    |

## Princípios que valem para todos os lotes

- **Solução mínima correta.** Issue de nível 1–2 não vira arquitetura nova.
- **Derivar antes de persistir.** JOIN/COUNT/agregação antes de coluna nova (#42 é o exemplo).
- **Não fabricar dado.** Sem placeholder que pareça registro real (motivo da premissa de #42).
- **Não reimplementar o que já existe.** Issue possivelmente resolvida vira evidência + decisão (#33).
- **Não esconder dado existente.** Mudanças de modelo no GED precisam de plano para os documentos atuais.
