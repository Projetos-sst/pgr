# Contrato — Mapa tela ↔ mockup ↔ verificação

Critério de aceite visual da fatia. Cada tela **com mockup direto** é aprovada por comparação lado a lado
com seu `.dc.html` em **375 / 768 / 1440px** (Playwright MCP, `file://` vs. `npm run dev`). Telas **sem
mockup** só passam por checagem de responsividade/consistência com as primitives.

## Telas com mockup direto (restyle 1:1)

| Mockup (`sst-project/redesign/`)                            | Rota(s) real(is)                                             | Tipo                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `login.dc.html`                                             | `(public)/sign-in`                                           | Clerk moldura + `appearance`               |
| _(reusa padrão do login)_                                   | `(public)/sign-up`                                           | Clerk moldura + `appearance`               |
| `home.dc.html`                                              | `/boas-vindas` (**nova**)                                    | página nova (reusa lista de módulos)       |
| `dashboard.dc.html`                                         | `/dashboard`                                                 | rebuild (KPIs reais + widgets empty-state) |
| `empresas.dc.html` / `empresa-form.dc.html`                 | `/companies` (+ `new`, `[id]/edit`)                          | CRUD via `_ui`                             |
| `unidades-obra.dc.html` / `unidade-obra-form.dc.html`       | `/work-units` (+ `new`, `[id]/edit`)                         | CRUD via `_ui`                             |
| `funcoes.dc.html` / `funcao-form.dc.html`                   | `/job-roles` (+ `new`, `[id]/edit`)                          | CRUD via `_ui`                             |
| `ges-setores.dc.html`                                       | `/ges` (+ `new`, `[id]/edit`)                                | CRUD via `_ui`                             |
| `funcionarios.dc.html` / `funcionario-form.dc.html`         | `/employees` (+ `new`, `[id]/edit`)                          | CRUD via `_ui`                             |
| `categorias.dc.html`                                        | `/categories` (+ `new`, `[id]/edit`)                         | CRUD via `_ui`                             |
| `equipamentos-epi.dc.html` / `equipamento-epi-form.dc.html` | `/epi-catalog` (+ `new`, `[id]/edit`)                        | CRUD via `_ui`                             |
| `estoque-epi.dc.html`                                       | `/epi-stock` (+ `new`, `[id]/edit`, `[id]/history`)          | CRUD via `_ui`                             |
| `pgrs.dc.html`                                              | `/pgr`                                                       | via `_ui`                                  |
| `pgr-editor.dc.html`                                        | `/pgr/[id]` (+ `edit`, `new`)                                | editor                                     |
| `planos-acao.dc.html`                                       | `/risks/[id]/control-measures` (+ `new`, `[measureId]/edit`) | via `_ui`                                  |
| `primeiros-passos.dc.html`                                  | `/onboarding`                                                | Clerk moldura + `appearance`               |

## Telas sem mockup próprio (herdam restyle via `_ui`)

`/risk-methodology`, `/risks` (+ `new`/`[id]`/`edit`/`assessments`), `/signatures`, `/epi-returns`.
Verificação: responsividade nos 3 breakpoints + consistência visual com as primitives restiladas.

## Fora de escopo (backlog — não tocar)

Todas as demais `.dc.html` (medicos, veiculos, inspecoes-_, incidentes, gestao-_, esocial-\*, ged,
controle-formularios, treinamentos, riscos-psicossociais, planos-inspecao, planos-assinatura,
`perfil.dc.html`, `os-nova.dc.html`). Catalogadas em `docs/briefings/redesign-backlog-telas.md`.

## Regras de conformidade

- **C-SCR-1**: 100% das telas com mockup aprovadas visualmente nos 3 breakpoints (SC-001).
- **C-SCR-2**: nenhuma rota nova de módulo de negócio além de `/boas-vindas` (SC-002 / FR-013).
- **C-SCR-3**: formulários preservam campos, validação e comportamento atuais — só muda o visual.
- **C-SCR-4**: nenhuma tela redesenhada gera rolagem horizontal do corpo em 375px (SC-006).
