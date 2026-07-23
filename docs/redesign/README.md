# Mockups do redesign visual

Mockups estáticos (HTML auto-contido) de todas as telas do sistema, usados como **fonte da
verdade visual** do redesign. Cada arquivo `*.dc.html` abre direto no navegador; a única
dependência é o `support.js` desta mesma pasta.

Os tokens já implantados a partir destes mockups (indigo `#5b63f5`, Manrope + JetBrains Mono,
cards glass, raio ~12px, sombras suaves) vivem no bloco `@theme inline` de
`src/app/globals.css` — **não crie tokens novos nem hardcode hex** quando já houver token.

## Mapa mockup → tela real

| Mockup                        | Rota(s) no app                                       | Situação      |
| ----------------------------- | ---------------------------------------------------- | ------------- |
| `home.dc.html`                | `/welcome`                                           | rota existe   |
| `dashboard.dc.html`           | `/dashboard`                                         | rota existe   |
| `primeiros-passos.dc.html`    | `/getting-started`                                   | rota existe   |
| `login.dc.html`               | `/sign-in`, `/sign-up` (Clerk + `auth-frame.tsx`)    | rota existe   |
| `perfil.dc.html`              | `/profile`, `/team`                                  | rota existe   |
| `planos-assinatura.dc.html`   | `/plans`                                             | rota existe   |
| `empresas.dc.html`            | `/companies`                                         | rota existe   |
| `empresa-form.dc.html`        | `/companies/new`, `/companies/[id]/edit`             | rota existe   |
| `unidades-obra.dc.html`       | `/work-units`                                        | rota existe   |
| `unidade-obra-form.dc.html`   | `/work-units/new`, `/work-units/[id]/edit`           | rota existe   |
| `categorias.dc.html`          | `/categories` (+ `new`, `[id]/edit`)                 | rota existe   |
| `funcoes.dc.html`             | `/job-roles`                                         | rota existe   |
| `funcao-form.dc.html`         | `/job-roles/new`, `/job-roles/[id]/edit`             | rota existe   |
| `funcionarios.dc.html`        | `/employees`                                         | rota existe   |
| `funcionario-form.dc.html`    | `/employees/new`, `/employees/[id]/edit`             | rota existe   |
| `ges-setores.dc.html`         | `/ges` (+ `new`, `[id]/edit`)                        | rota existe   |
| `pgrs.dc.html`                | `/pgr`                                               | rota existe   |
| `pgr-editor.dc.html`          | `/pgr/[id]`, `/pgr/[id]/edit`                        | rota existe   |
| `equipamentos-epi.dc.html`    | `/epi-catalog`                                       | rota existe   |
| `equipamento-epi-form.dc.html`| `/epi-catalog/new`, `/epi-catalog/[id]/edit`         | rota existe   |
| `estoque-epi.dc.html`         | `/epi-stock` (+ `[id]/history`)                      | rota existe   |
| `treinamentos.dc.html`        | `/training-catalog`, `/training-expiry`, `/training-compliance` | rota existe |
| `gestao-os.dc.html`           | `/service-orders`                                    | rota existe   |
| `os-nova.dc.html`             | `/service-orders/new`, `/service-orders/[id]/edit`   | rota existe   |
| `incidentes.dc.html`          | `/incidents` (+ `new`, `[id]`)                       | rota existe   |
| `gestao-incidentes.dc.html`   | `/incidents/management`                              | rota existe   |
| `planos-acao.dc.html`         | `/action-plans` (+ `new`, `[id]`)                    | rota existe   |
| `planos-inspecao.dc.html`     | `/inspection-plans`                                  | rota existe   |
| `inspecoes-veiculares.dc.html`| `/vehicular-inspections`                             | rota existe   |
| `inspecoes-seguranca.dc.html` | `/safety-inspections`                                | rota existe   |
| `veiculos.dc.html`            | `/vehicles`                                          | rota existe   |
| `veiculo-form.dc.html`        | `/vehicles/new`, `/vehicles/[id]/edit`               | rota existe   |
| `riscos-psicossociais.dc.html`| `/psychosocial/campaigns`                            | rota existe   |
| `ged.dc.html`                 | `/documents` (+ `new`)                               | rota existe   |
| `controle-formularios.dc.html`| `/form-controls` (+ `new`, `[id]/edit`)              | rota existe   |
| `esocial-eventos.dc.html`     | `/esocial`                                           | rota existe   |
| `esocial.dc.html`             | painel eSocial — sem rota                            | **tela nova** |
| `esocial-config.dc.html`      | configuração do eSocial — sem rota                   | **tela nova** |
| `gestao-saude.dc.html`        | saúde ocupacional / exames (ASO) — sem rota          | **tela nova** |
| `medicos.dc.html`             | cadastro de médicos — sem rota                       | **tela nova** |

## Convenção ao usar um mockup

1. O mockup define **layout, hierarquia visual, espaçamento, cor e estados** — não define dado.
   Coluna/KPI do mockup sem fonte de dado real vira **empty state**, nunca dado fictício.
2. Padrão transversal (tabela, cabeçalho de página, formulário, badge) se resolve na primitive
   de `src/app/(protected)/_ui/`, não replicando estilo tela a tela.
3. Comparação visual em 375 / 768 / 1440px contra o `.dc.html`; sem pixel-diff.
