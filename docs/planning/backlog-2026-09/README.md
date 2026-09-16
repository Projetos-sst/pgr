# Backlog 2026-09 — memória de planejamento

Memória técnica para executar em lotes as 19 issues que estão em **Backlog** no GitHub Project
**Projetos-sst #1**. Não é uma spec: é o mapa usado para decidir _o que_ atacar, _em que ordem_ e
_com que premissas_, e para retomar o trabalho em qualquer sessão futura.

| Campo       | Valor                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Projeto     | [Projetos-sst #1](https://github.com/orgs/Projetos-sst/projects/1/views/1) |
| Repositório | `Projetos-sst/pgr`, base `develop`                                         |
| Auditoria   | 2026-09-16, `develop` @ `b3b738e`                                          |
| Escopo      | 19 issues (status Backlog no Project; 42 itens já em Done)                 |
| Responsável | `CarlosVictor7` (19/19 atribuídas em 2026-09-16)                           |

## Origem

As issues #2–#62 nasceram do documento do cliente **"Avaliação do e-Pgr REV01"**. Os lotes de
correção `.specs/028-correcoes-avaliacao-epgr` e `.specs/029-correcoes-avaliacao-epgr-lote2`
fecharam 42 delas. As 19 restantes são as que esses lotes classificaram como "fatia própria":
integrações de catálogo, NR-09/17/18, estrutura do PDF do PGR e o épico de Qualidade/GED.

## Documentos

| Arquivo                                      | Para que serve                                                     |
| -------------------------------------------- | ------------------------------------------------------------------ |
| [AUDIT.md](AUDIT.md)                         | Snapshot do Backlog, matriz master, dificuldade, cobertura, riscos |
| [DEPENDENCIES.md](DEPENDENCIES.md)           | Grafo de dependências, módulos compartilhados, ordem obrigatória   |
| [REQUIREMENTS-GAPS.md](REQUIREMENTS-GAPS.md) | Prontidão por issue + perguntas objetivas para o Tech Lead         |
| [LOTS.md](LOTS.md)                           | Divisão completa em lotes, com DoD de cada um                      |
| [EXECUTION-PLAN.md](EXECUTION-PLAN.md)       | Estratégia, workflow PLAN → TASK → IMPLEMENTAÇÃO → REVIEW, gates   |
| [tasks/](tasks/)                             | Uma ficha técnica por issue — atualizar ao concluir                |
| `lots/lot-XX/`                               | Criado **no início de cada lote** (PLAN, TASK, REVIEW)             |

## Convenções

- **Lote** = 2–5 issues com contexto técnico próximo, executadas com um único PLAN/TASK/REVIEW.
  Um lote pode gerar mais de uma PR quando as issues forem independentes.
- **Dificuldade** 1–5 e **prontidão** (READY, READY COM PREMISSAS, NEEDS CONTEXT, NEEDS PRODUCT
  DECISION, NEEDS EXTERNAL INFO, BLOCKED) são classificação técnica deste documento — **não**
  alteram o Status do card no Project.
- **Cobertura** usa a escala 0/25/50/75/100% medida no código de `develop`, não no texto da issue.
- Ao concluir uma issue, atualizar a ficha em `tasks/` com branch, PR, migration, testes, CI,
  decisão e status final.

## Workflow resumido

```
PLAN.md  →  TASK.md  →  implementação (TASK.md atualizado)  →  REVIEW.md
```

Detalhes, regras de branch/rebase/migration e gates em [EXECUTION-PLAN.md](EXECUTION-PLAN.md).
