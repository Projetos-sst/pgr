# 06 — Inventário de Entregáveis

Este documento é a ponte entre o roadmap (macro) e o Spec Kit (execução). Ele
lista, de ponta a ponta, **todos os entregáveis** do sistema — o nível certo
para virar cards de um Kanban e ser trabalhado pelo time.

## Para que serve

O doc 05 define 8 fases — granularidade de **épico**, boa para visão, ruim para
puxar trabalho. As tasks de implementação, por outro lado, só existem depois do
`specify` + `plan` de cada fatia. Faltava o nível do meio: o **entregável**.

Um entregável é uma capacidade conhecível e estável **agora**: uma tela, um
fluxo, uma peça de infraestrutura. A tela de listagem de funcionários _vai_
existir, independentemente do que o spec detalhe. Por isso o inventário pode ser
montado de antemão — sem cair em waterfall.

## O modelo de 3 níveis

```
ÉPICO            →  Milestone no GitHub   →  as 8 fases do doc 05
  └── ENTREGÁVEL  →  Issue no GitHub       →  uma tela / fluxo / peça de infra  ◀── este doc
        └── TASK   →  gerada pelo Spec Kit  →  /speckit-tasks, just-in-time
```

| Nível | Onde vive | Quem cria | Quando |
|---|---|---|---|
| Épico | Milestone | Roadmap (doc 05) | já definido |
| **Entregável** | **Issue** | **Este inventário** | **agora** |
| Task | `tasks.md` / issues filhas | `/speckit-tasks` | por fatia, just-in-time |

Regra: **não** quebre os entregáveis em tasks de implementação à mão. Isso é
trabalho do `/speckit-tasks`, feito quando a fatia começa — com o spec e o plan
já prontos. Criar antes é chutar.

## Milestones (as 8 fases)

| Milestone | Dias | Depende de |
|---|---|---|
| Fase 0 — Fundação | 1–5 | — |
| Fase 1 — Funcionários | 6–12 | Fase 0 |
| Fase 2 — EPIs | 13–19 | Fase 1 |
| Fase 3 — PGR / Gestão de Riscos | 20–27 | Fase 1 |
| Fase 4 — Treinamentos | 28–33 | Fase 1 |
| Fase 5 — Documentos + Geração de PDF | 34–38 | Fases 3, 4 |
| Fase 6 — Ordens de Serviço + Acidentes | 39–42 | Fase 1 |
| Fase 7 — Dashboards + Hardening | 43–45 | Fases 1–6 |

## Entregáveis por fase

Cada linha abaixo vira uma **issue** no GitHub, vinculada ao milestone da fase.

### Fase 0 — Fundação (9 entregáveis)

| Entregável | Tipo |
|---|---|
| Integração do Clerk (autenticação + organizações) | infra |
| Telas de autenticação (login, cadastro, recuperação de senha) | tela |
| Onboarding e troca de organização | tela |
| Setup do banco de dados (Supabase + Drizzle) | dados |
| Padrão de RLS e isolamento multi-tenant | dados |
| Helpers de autenticação e contexto de tenant | infra |
| Shell da aplicação (layout, sidebar, navegação) | tela |
| Biblioteca de componentes de UI base | tela |
| Quality gates (lint, typecheck, CI) | qualidade |

> Login, cadastro e recuperação de senha são **componentes do Clerk** — o
> entregável é configurá-los e estilizá-los, não construí-los do zero.

### Fase 1 — Funcionários (6 entregáveis)

| Entregável | Tipo |
|---|---|
| Modelagem de dados — Funcionários, Setores e Cargos | dados |
| CRUD de Setores | tela |
| CRUD de Cargos/Funções | tela |
| Listagem de funcionários | tela |
| Cadastro e edição de funcionário | tela |
| Detalhe do funcionário | tela |

### Fase 2 — EPIs (5 entregáveis)

| Entregável | Tipo |
|---|---|
| Modelagem de dados — Catálogo e Entregas de EPI | dados |
| CRUD do catálogo de EPIs | tela |
| Registro de entrega de EPI | tela |
| Registro de devolução de EPI | tela |
| Histórico de entregas por funcionário | tela |

### Fase 3 — PGR / Gestão de Riscos (6 entregáveis)

| Entregável | Tipo |
|---|---|
| Modelagem de dados — PGR, Riscos, Avaliações e Medidas | dados |
| CRUD do documento de PGR | tela |
| Cadastro de riscos no PGR | tela |
| Avaliação de risco (probabilidade × severidade) | tela |
| Plano de ação / medidas de controle | tela |
| Visão consolidada do PGR | tela |

### Fase 4 — Treinamentos (4 entregáveis)

| Entregável | Tipo |
|---|---|
| Modelagem de dados — Catálogo e Registros de Treinamento | dados |
| CRUD do catálogo de treinamentos | tela |
| Registro de treinamento por funcionário | tela |
| Controle de validade de treinamentos | tela |

### Fase 5 — Documentos + Geração de PDF (9 entregáveis)

| Entregável | Tipo |
|---|---|
| Emenda da constituição — adoção do Gotenberg | governança |
| Modelagem de dados — Documentos e Jobs | dados |
| Upload e listagem de documentos | tela |
| Download de documentos via URL assinada | backend |
| Deploy do serviço Gotenberg | infra |
| Cliente de geração de PDF (`lib/pdf.ts`) | backend |
| Geração de PDF de documento único | backend |
| Geração de PDF em lote (jobs + Vercel Cron) | backend |
| Template de PDF do PGR | tela |

### Fase 6 — Ordens de Serviço + Acidentes (6 entregáveis)

| Entregável | Tipo |
|---|---|
| Modelagem de dados — Ordens de Serviço e Acidentes | dados |
| Listagem de ordens de serviço | tela |
| Abertura e edição de OS (com itens) | tela |
| Workflow de status da OS | tela |
| Registro de acidentes | tela |
| Listagem e detalhe de acidentes | tela |

### Fase 7 — Dashboards + Hardening (6 entregáveis)

| Entregável | Tipo |
|---|---|
| Queries de agregação para dashboards | backend |
| Telas de dashboard | tela |
| Teste de isolamento multi-tenant | qualidade |
| Revisão de performance | qualidade |
| Revisão de segurança | qualidade |
| Deploy de produção e smoke test | infra |

**Total: 51 entregáveis em 8 milestones.**

## Como isso vira o board

1. As 8 fases → **milestones** no GitHub.
2. Os 51 entregáveis → **issues**, cada uma no seu milestone.
3. Labels organizam por **módulo** (`módulo: pgr`, ...) e por **tipo**
   (`tipo: tela`, `tipo: dados`, ...).
4. Um **GitHub Project (board)** agrega tudo numa visão Kanban.

## Fluxo de trabalho de um card

Quando o time puxa uma issue (entregável):

```
1. Issue "Cadastro e edição de funcionário"  ──▶  inicia a fatia
2. /speckit-specify  → spec da fatia (o quê / porquê)
3. /speckit-clarify  → remove ambiguidade
4. /speckit-plan     → reusa docs/architecture/01..04
5. /speckit-tasks    → GERA as tasks de implementação
6. /speckit-analyze  → consistência
7. /speckit-implement→ código + commits
8. PR → review → merge → issue fechada
```

As tasks geradas no passo 5 podem virar issues filhas via
`/speckit-taskstoissues` e aparecer no board sob o entregável — detalhe na hora
certa, nunca antes.

## Paralelização

Pelo grafo de dependências: concluídas as Fases 0 e 1, as **Fases 2, 3, 4 e 6**
dependem apenas da Fase 1 — podem ser tocadas **em paralelo** por
desenvolvedores diferentes. O board é o que torna essa paralelização visível.
