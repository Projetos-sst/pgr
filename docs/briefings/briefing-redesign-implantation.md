# Briefing — Implantação do redesign visual (design system `sst-project/redesign`)

> Origem deste documento: sessão de brainstorming (skill `superpowers:brainstorming`).
> Fonte visual: `sst-project/redesign/*.dc.html` (40 mockups estáticos, gerados a partir da
> referência ePGR — ver `sst-project/redesign/uploads/PAGINAS.md` e `ePGR-design-referencia.md`).
> Conteúdo em PT-BR; código/identificadores em inglês.

---

## 1. Resumo

Aplicar o sistema visual dos mockups `.dc.html` (paleta indigo `#5b63f5`, tipografia Manrope +
mono, cards com glass/blur, raio ~12–13px, sombras suaves) ao sst-manager, que hoje **não tem
tema definido** (`globals.css` só tem `--background`/`--foreground` em preto/branco, fonte Arial).

Escopo restrito às telas **já implementadas** — nenhuma das ~20 telas que os mockups descrevem
mas que não existem no sistema (médicos, veículos, inspeções, eSocial, GED, treinamentos, riscos
psicossociais, gestão de saúde, gestão de OS, planos de assinatura, controle de formulários,
perfil) entra nesta fatia. Elas ficam catalogadas em `docs/briefings/redesign-backlog-telas.md`
para virarem specs próprias quando forem construídas.

Exceção combinada: a página de **boas-vindas** pós-login (`home.dc.html`) é criada nesta fatia
como rota nova, porque é só uma reorganização do que `/dashboard` já faz hoje (lista de módulos)
sob o layout do mockup — não exige dado ou lógica nova.

---

## 2. Decisões do brainstorming (travadas)

| #   | Tema                          | Decisão                                                                                                                                                                                                                                                                                    | Motivo                                                                                                                                           |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Escopo**                    | Só redesign de telas já implementadas. Telas novas viram backlog documentado, não código.                                                                                                                                                                                                  | Os 40 mockups cobrem ~20 módulos que não existem no sst-manager (eSocial, veículos, GED etc.) — construí-los é escopo de várias specs futuras.   |
| 2   | **Fidelidade visual**         | Fiel ao mockup, adaptado ao Tailwind v4 — tokens extraídos para `@theme`, sem copiar inline styles dos `.dc.html`.                                                                                                                                                                         | Os `.dc.html` são protótipos com estilo inline (ferramenta de design-comp); o produto usa Tailwind + primitives compartilhadas.                  |
| 3   | **Fundação**                  | Tokens no `@theme inline` do `globals.css` (cor primária, neutros, radius, sombra, fontes) + troca de fonte (Geist → Manrope/mono).                                                                                                                                                        | Ponto único de verdade visual — evita hex espalhado pelas páginas.                                                                               |
| 4   | **Reuso**                     | Restyle concentrado em 5 arquivos `_ui` (`list.tsx`, `form.tsx`, `field-hint.tsx`, `confirm-delete-button.tsx`, `address-fields.tsx`) + shell (header/nav).                                                                                                                                | Toda página de CRUD já renderiza através dessas primitives — restylá-las cascade automaticamente pras ~13 telas sem mockup direto também.        |
| 5   | **Navegação**                 | Mega-menu (Módulos / Cadastro / Gestão / Qualidade) só com rotas implementadas, sem itens "em breve".                                                                                                                                                                                      | Menu atual é uma lista plana de 14 links; mockup organiza por categoria mas lista telas inexistentes — não expor roadmap no menu real.           |
| 6   | **Auth (Clerk)**              | Envolver `<SignIn/>`/`<SignUp/>`/`<CreateOrganization/>` do Clerk no layout do mockup (painel lateral) + customizar via `appearance`.                                                                                                                                                      | Clerk é o provedor de auth (não reimplementar); `appearance` cobre cor/fonte/radius do form embutido.                                            |
| 7   | **Dashboard**                 | `/dashboard` atual (lista de módulos) vira o mockup `dashboard.dc.html` (KPI cards + grid de widgets); KPIs com dados reais via `COUNT`; widgets sem dado (incidentes, OS) usam o padrão empty-state do próprio mockup.                                                                    | `dashboard.dc.html` é mais rico que a tela atual; contagens simples não são feature nova, e o empty-state do mockup já resolve o que não existe. |
| 8   | **Boas-vindas**               | Nova rota `/boas-vindas` (mapeando `home.dc.html`), reaproveitando o conteúdo (lista de módulos) que hoje está em `/dashboard`.                                                                                                                                                            | Pedido explícito durante o brainstorming; única exceção ao "sem rota nova" porque não exige dado/lógica nova.                                    |
| 9   | **Perfil / Primeiros passos** | `perfil.dc.html` não tem página real hoje (Clerk `UserButton` só abre o modal padrão) → vai para o backlog, não nesta fatia. `primeiros-passos.dc.html` mapeia o onboarding atual (`CreateOrganization`/`OrganizationList` do Clerk) — mesma abordagem do item 6 (moldura + `appearance`). | Evita inventar uma tela de perfil custom fora do escopo combinado.                                                                               |
| 10  | **Verificação de fidelidade** | Por tela: screenshot comparativo manual via Playwright MCP (mockup vs. página real) em 3 breakpoints — 375px, 768px, 1440px. Sem diff de pixel automatizado.                                                                                                                               | Julgamento visual é suficiente pro objetivo; diff de pixel adiciona atrito de configuração sem ganho proporcional aqui.                          |

---

## 3. Escopo

### Dentro (esta fatia)

**Fundação (bloqueante para tudo abaixo):**

- Tokens de design em `globals.css` (`@theme inline`): cor primária + variações, neutros, radius,
  sombra.
- Troca de fonte via `next/font/google` (Manrope no lugar de Geist Sans; manter/replicar um mono
  para os poucos usos monospace).
- Restyle de `src/app/(protected)/_ui/{list,form,field-hint,confirm-delete-button,address-fields}.tsx`.
- Restyle do header raiz (`src/app/layout.tsx`) e da nav (`src/app/(protected)/layout.tsx`) →
  mega-menu por categoria, só com rotas implementadas.

**Telas com mockup direto (restyle 1:1, fiel ao `.dc.html`):**

| Mockup                                                      | Rota(s) real(is)                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `login.dc.html`                                             | `(public)/sign-in` (moldura + `appearance` do Clerk)                              |
| _(sem mockup próprio de cadastro — reusa o mesmo padrão)_   | `(public)/sign-up`                                                                |
| `home.dc.html`                                              | `/boas-vindas` (**nova rota**, ver decisão #8)                                    |
| `dashboard.dc.html`                                         | `/dashboard` (rebuild como KPI + widgets, ver decisão #7)                         |
| `empresas.dc.html` / `empresa-form.dc.html`                 | `/companies`, `/companies/new`, `/companies/[id]/edit`                            |
| `unidades-obra.dc.html` / `unidade-obra-form.dc.html`       | `/work-units`, `/work-units/new`, `/work-units/[id]/edit`                         |
| `funcoes.dc.html` / `funcao-form.dc.html`                   | `/job-roles`, `/job-roles/new`, `/job-roles/[id]/edit`                            |
| `ges-setores.dc.html`                                       | `/ges`, `/ges/new`, `/ges/[id]/edit`                                              |
| `funcionarios.dc.html` / `funcionario-form.dc.html`         | `/employees`, `/employees/new`, `/employees/[id]/edit`                            |
| `categorias.dc.html`                                        | `/categories`, `/categories/new`, `/categories/[id]/edit`                         |
| `equipamentos-epi.dc.html` / `equipamento-epi-form.dc.html` | `/epi-catalog`, `/epi-catalog/new`, `/epi-catalog/[id]/edit`                      |
| `estoque-epi.dc.html`                                       | `/epi-stock`, `/epi-stock/new`, `/epi-stock/[id]/edit`, `/epi-stock/[id]/history` |
| `pgrs.dc.html`                                              | `/pgr`                                                                            |
| `pgr-editor.dc.html`                                        | `/pgr/[id]`, `/pgr/[id]/edit`, `/pgr/new`                                         |
| `planos-acao.dc.html`                                       | `/risks/[id]/control-measures` (+ `new`/`[measureId]/edit`)                       |
| `primeiros-passos.dc.html`                                  | `/onboarding` (moldura + `appearance` do Clerk, ver decisão #9)                   |

**Telas sem mockup próprio (herdam o restyle via `_ui` primitives, sem trabalho individual):**
`/risk-methodology`, `/risks` (+ `new`/`[id]`/`edit`/`assessments`), `/signatures`,
`/epi-returns`. Verificação nestas é de consistência com as primitives restyladas, não
comparação com um `.dc.html` (não existe).

### Fora (backlog — ver `docs/briefings/redesign-backlog-telas.md`)

Todas as telas cujos módulos não existem hoje no sst-manager: médicos, veículos (+ form),
inspeções veiculares, inspeções de segurança, planos de inspeção, incidentes, gestão de
incidentes, riscos psicossociais, gestão de saúde, gestão de OS (+ nova OS), GED, controle de
formulários, treinamentos, eSocial (dashboard/config/eventos), planos de assinatura, e a tela de
perfil de usuário (`perfil.dc.html`).

---

## 4. Fundação de design (detalhe técnico)

- **Cor primária**: indigo `#5b63f5` (+ hover/focus, ex.: `#4f46e5` para estados escuros, anel de
  foco `rgba(91,99,245,.12)` como no mockup).
- **Neutros**: fundo `#eae9e8`/`#f7f8f9`, texto `#1b1f2e`/`#52576e`/`#8c91a8`, bordas
  `rgba(255,255,255,.6-.85)` sobre glass, `rgba(0,0,0,.06-.1)` sobre claro.
- **Radius**: ~12–13px em cards/inputs, botões arredondados (pill em CTAs primários, como no
  mockup de login).
- **Sombra**: suave, sem skeuomorfismo (`box-shadow` leve tipo `0 12px 28px rgba(...)`).
- **Tipografia**: Manrope (400/500/600/700/800) para texto geral; manter um mono para badges/
  código (pode reaproveitar `Geist Mono` já carregado, ou trocar por JetBrains Mono se a
  diferença visual justificar).
- Tudo entra no bloco `@theme inline` de `src/app/globals.css`, como `--color-primary`,
  `--radius-card`, etc. — nenhuma página usa hex cru.

---

## 5. Dashboard — o que fica real vs. empty-state

`dashboard.dc.html` tem 4 KPI cards + grid de 4 widgets de gráfico. Mapeamento:

| Widget do mockup                | Dado real disponível?                                        | Tratamento                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI "Empresas"                  | Sim (`companies` do tenant)                                  | `COUNT` real via repositório existente                                                                                                                      |
| KPI "PGRs"                      | Sim (`pgr`)                                                  | `COUNT` real                                                                                                                                                |
| KPI "Equipe"                    | Sim (`employees`)                                            | `COUNT` real                                                                                                                                                |
| KPI "OS Funcional"              | Não (módulo OS não existe)                                   | Substituir por uma 4ª métrica real disponível (ex.: EPIs em estoque abaixo do mínimo, ou catálogo de EPI) — decidir no plano/implementação, não inventar OS |
| Riscos por Categoria            | Parcial (`risks` existe, sem agregação por categoria pronta) | Se a agregação for uma query simples, popular; senão empty-state do mockup                                                                                  |
| Planos de Ação                  | Sim (`control-measures`/`risks` action plan)                 | Popular se a agregação for direta                                                                                                                           |
| Status/Tipo de OS               | Não                                                          | Empty-state do mockup (ícone "i" + frase)                                                                                                                   |
| Status/Categorias de Incidentes | Não                                                          | Empty-state do mockup                                                                                                                                       |

Regra geral: **nunca inventar dado**. Se a agregação exigir lógica de negócio nova (não uma
query simples sobre tabela existente), o widget usa o padrão de empty-state do próprio mockup.

---

## 6. Verificação de fidelidade (workflow)

Por tela, nesta ordem:

1. Abrir o `.dc.html` correspondente via Playwright MCP (`file://` local).
2. Abrir a página real no dev server (`npm run dev`).
3. Screenshot dos dois em **375px, 768px e 1440px**.
4. Revisão visual (Claude) comparando lado a lado antes de marcar a tela como concluída.
5. Telas sem mockup (`risk-methodology`, `risks`, `signatures`, `epi-returns`): mesma checagem
   de responsividade nos 3 breakpoints, validando consistência com as primitives restyladas.

Sem threshold de diff de pixel — julgamento visual por tela, dado que dados reais vs. mock e
pequenas variações de conteúdo (nomes, contagens) sempre vão diferir do protótipo estático.

---

## 7. Testes

Esta fatia é majoritariamente CSS/markup — não deve tocar Server Actions, repositórios ou schema
(exceto queries `COUNT` simples pro dashboard, que já existem via repositórios existentes ou são
triviais o bastante para não precisar de migration). Ainda assim:

- **Unit**: nenhum esperado além do que já cobre as queries de contagem, se novas funções puras
  forem extraídas (ex.: agregação de widget).
- **Integração**: se o dashboard passar a chamar novas queries de contagem, cobrir com teste de
  integração (Postgres efêmero) garantindo isolamento multi-tenant (contagem não vaza entre orgs).
- **Lint/typecheck/format**: `npm run check` verde é o principal gate desta fatia.
- **Visual**: workflow da seção 6 substitui teste automatizado de snapshot visual (não há infra
  de visual regression no projeto hoje — fora de escopo introduzir uma).

---

## 8. Critérios de aceite

- [ ] `globals.css` tem tokens de design extraídos do mockup (`@theme inline`), sem hex cru em
      páginas/componentes.
- [ ] As 5 primitives de `_ui/` e o shell (header + nav) estão restyladas e usadas por todas as
      telas de CRUD (implícito, sem mudança de import).
- [ ] Nav vira mega-menu por categoria, listando somente rotas implementadas.
- [ ] Cada tela listada na seção 3 (com mockup) foi comparada visualmente ao `.dc.html` em 3
      breakpoints e aprovada.
- [ ] `/boas-vindas` existe, reaproveita a lista de módulos de hoje, layout de `home.dc.html`.
- [ ] `/dashboard` mostra KPIs reais onde há dado, empty-state do mockup onde não há.
- [ ] Login/cadastro/onboarding mantêm o Clerk funcional, com moldura + `appearance` aplicados.
- [ ] `docs/briefings/redesign-backlog-telas.md` existe e cataloga as ~20 telas fora de escopo.
- [ ] `npm run check` verde.

---

## 9. Referências

- `sst-project/redesign/*.dc.html` — 40 mockups (fonte visual).
- `sst-project/redesign/uploads/PAGINAS.md` e `ePGR-design-referencia.md` — catálogo/contexto da
  referência original (ePGR).
- `docs/briefings/redesign-backlog-telas.md` — catálogo das telas fora de escopo (companion deste
  briefing).
- `CLAUDE.md` — convenções de camadas, `_ui/list`/`_ui/form`, testes.

---

## 10. Prompt pronto para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/redesign-implantation

Feature: Implantação do design system do redesign visual nas telas já implementadas

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho. Esta é uma fatia de
DESIGN/UI transversal (não introduz módulo de negócio novo). Use como fonte da verdade o
briefing anexado (docs/briefings/briefing-redesign-implantation.md), que já consolidou as
decisões de brainstorming, e o catálogo de backlog (docs/briefings/redesign-backlog-telas.md).
A fonte visual são os mockups estáticos em sst-project/redesign/*.dc.html. Antes de escrever a
spec, liste os arquivos que vai ler.

User stories (P1 = mais crítica):
- (P1) Como usuário do escritório, quero que as telas de cadastro (empresas, unidades, funções,
  GES, funcionários, categorias, EPI) e o dashboard tenham a identidade visual do redesign
  (paleta indigo, tipografia Manrope, cards com glass/blur), fiel aos mockups .dc.html.
- (P1) Como usuário, quero uma navegação em mega-menu agrupada por categoria em vez da lista
  plana atual, mostrando só as rotas que realmente existem.
- (P2) Como usuário recém-logado, quero uma página de boas-vindas com ações rápidas e visão geral
  dos módulos, separada do dashboard operacional.
- (P2) Como usuário, quero um dashboard com KPIs reais (empresas, PGRs, equipe) e widgets que
  mostrem um estado vazio claro quando o dado ainda não existe no sistema (incidentes, OS).

Success criteria mensuráveis (tecnologia-agnósticos):
- Cada tela com mockup correspondente aprovada visualmente contra o .dc.html em 375px/768px/1440px.
- Nenhuma tela nova de módulo de negócio é criada além de /boas-vindas.
- Menu de navegação não lista nenhuma rota inexistente.
- npm run check permanece verde; nenhuma Server Action/repositório de negócio é alterado além de
  contagens simples para o dashboard.

Edge cases a considerar:
- Widgets de dashboard sem dado real disponível (usar empty-state do mockup, nunca dado fictício).
- Telas sem mockup próprio (risk-methodology, risks, signatures, epi-returns) — devem herdar o
  restyle via as primitives compartilhadas, sem virar trabalho individual.
- Componentes controlados pelo Clerk (login, cadastro, onboarding) — customização via `appearance`,
  sem reimplementar autenticação.

Restrições obrigatórias (constituição):
- Não introduzir nenhuma tela/rota de módulo de negócio fora de /boas-vindas.
- Não alterar RLS, schema (exceto se uma migration trivial for necessária para uma contagem —
  improvável) ou contrato de Server Actions existentes.
- Seguir a arquitetura em camadas do CLAUDE.md; toda mudança de UI passa pelas primitives em
  src/app/(protected)/_ui/.

NÃO invente solução técnica fora do que o briefing já decidiu — o "como" central já está em
docs/briefings/briefing-redesign-implantation.md.
O conteúdo da spec é em português brasileiro; branch e commits em inglês.
```
