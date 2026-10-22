# AUDIT-UX — UX e Design System para Medicina Ocupacional (Agente 5, Fase 0, somente leitura)

Data: 2026-10-21 · Código auditado: `origin/develop` = `d6b787c` (worktree somente leitura `scratchpad/develop-ro`) ·
Protótipo: `Projeto-SST-Ocupacional/app/saude-ocupacional.html` (pacote de 14/10/2026, "versão 17").
Nenhum código, schema, migration ou config foi alterado. Os caminhos de código abaixo são relativos ao worktree.

---

## 1. Escopo analisado

- Design system real do PGR-e: tokens (`src/app/globals.css`), primitives `src/app/(protected)/_ui/*`, shell/header/mega-menu
  (`src/app/(protected)/layout.tsx`, `_components/nav-menu.tsx`) e a mudança de menu e de módulos feita pelo Rikelvin
  (#109 NOB-97, #110 NOB-99, #111 NOB-100; PR aberta #112 NOB-98).
- Telas de Medicina e afins que já existem: `/health-exams`, `/medicos`, `/psychosocial/*`, `/companies/[id]/services`,
  `/employees/[id]` e as telas da PR #112 (`/medical-risks`, `/companies/[id]/medical-risks`).
- Protótipo: CSS, estrutura, navegação e as 14 abas do provedor, mais os portais da empresa e da clínica, o quiosque do questionário,
  as subabas do Psicossocial e os documentos (ASO/PCMSO/PPP). Vi o render em 1440 e 375 px (Playwright).
- Mapeamento tela a tela, a identidade visual com o teal como acento e a acessibilidade, responsividade e semântica do protótipo.
- Fora do escopo: regras clínicas e normativas (são de outros agentes e do Dr. Alcides), schema/migrations e segurança.

## 2. Fontes consultadas

| Fonte                                                                                       | Como                |
| ------------------------------------------------------------------------------------------- | ------------------- |
| `git log`/`git show --stat` de `0c8f9ff` (NOB-97), `f5b8b85` (NOB-99), `044334e` (NOB-100)  | worktree            |
| `git diff origin/develop...origin/codex/NOB-98-feat/riscos-para-medicina` (PR #112)         | worktree, só UI     |
| `gh pr list --state open` (#112, #115, #116, #117)                                          | GitHub CLI, leitura |
| `.specs/20261020-nob-97/spec.md`                                                            | leitura integral    |
| Protótipo `saude-ocupacional.html` (2976 linhas): CSS l.1–168, views l.526–2955             | leitura + render    |
| Render do protótipo: Chromium do Playwright MCP, uma instância, já fechada                  | ver a nota em §12   |
| Cálculo de contraste WCAG 2.x (fórmula de luminância relativa), script stdlib no scratchpad | executado           |

## 3. Arquivos reais (verificados)

**Tokens e shell**

- `src/app/globals.css` (336 l.) — `@theme inline` l.18–56; superfícies glass l.86–146; `prefers-reduced-motion` l.295–322.
- `src/app/layout.tsx` l.2,10–16 — `Manrope` (`--font-manrope`) e `JetBrains_Mono` (`--font-jetbrains-mono`) via `next/font/google`.
- `src/app/(protected)/layout.tsx` — header sticky de 72px (l.45), logo "P / PGR-e" com hex cru `#5b63f5` (l.51), `NavMenu` (l.58).
- `src/app/(protected)/_components/nav-menu.tsx` — `NAV` estático (l.25–123) e `NavMenu` (l.439+).

**Primitives (`src/app/(protected)/_ui/`)**

- `list.tsx`: `PageHeader`, `PrimaryLink`, `EmptyState`, `SearchForm`, `Pagination`, `ListCard`, `ListToolbar`, `Table`.
- `data-list.tsx`: `ListCard`, `ListToolbar`, `ToolbarSearch`, `ToolbarSelect`, `SegmentedFilter`, `ToolbarButton`, `DataGrid`,
  `GridHeader`, `GridRow`, `Cell`, `MonoCell`, `AvatarBadge`, `StatusBadge` (6 tons), `ListFooter`, `RowActions`, `EditIconLink`, `ViewIcon`.
- `form.tsx`: `fieldClass`, `FieldError`, `FormError` (`role="alert"`), `FormSection`, `FormSteps`, `TextField`, `TextAreaField`,
  `SelectField`, `FormActions`, `CancelLink`, `StepBack/NextButton`, `SubmitButton`.
- `status-badge.tsx` (4 tons, via tokens), `confirm-modal.tsx`, `confirm-delete-button.tsx`, `row-actions.tsx`, `skeleton.tsx`,
  `agent-progress.tsx`, `field-hint.tsx`, `address-fields.tsx`, `training-status-badge.tsx`, `notifications-bell.tsx`.

**Medicina hoje**

- `src/app/(protected)/health-exams/{page.tsx, new/, [id]/edit/, _components/health-exam-form.tsx, health-exam-filters.tsx, delete-health-exam.tsx}`.
- `src/app/(protected)/medicos/{page.tsx, new/, [id]/edit/, _components/*}`.
- `src/app/(protected)/psychosocial/{campaigns/**, risk-factors/**}` e `src/app/(public)/psychosocial-response/[campaignId]/[token]`.
- `src/app/(protected)/companies/[id]/services/{page.tsx, module-controls.tsx}` (NOB-100).
- `src/shared/domains/platform/company-modules.ts`, `src/shared/db/schema/{company-modules.ts, module-policy.ts, health-exams.ts}`.
- PR #112 (não mergeada): `src/app/(protected)/medical-risks/page.tsx`, `companies/[id]/medical-risks/{page.tsx, source-form.tsx}`.

## 4. Evidências

### 4.1 Tokens do PGR (`globals.css` l.12–56)

| Grupo    | Valor                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primária | `--color-primary #5b63f5`, `--color-primary-strong #4f46e5`, `--color-primary-ring rgba(91,99,245,.12)`                           |
| Neutros  | `--color-bg #eae9e8`, `--color-surface #fff`, `--color-text #1b1f2e`, `--color-text-muted #52576e`, `--color-text-subtle #8c91a8` |
| Status   | `--color-danger #d33a3f`, `--color-accent-green #0e9f6e`, `--color-accent-amber #f5a524`, `--color-accent-amber-strong #c9820a`   |
| Raios    | `--radius-field 11px`, `--radius-card 12px`, `--radius-glass 18px`, `--radius-pill 30px`                                          |
| Sombras  | `--shadow-card`, `--shadow-primary`                                                                                               |
| Fontes   | `--font-sans: var(--font-manrope)`, `--font-mono: var(--font-jetbrains-mono)`                                                     |
| Tema     | só claro: o `dark:` foi neutralizado por `@custom-variant dark (&:where(.dark, .dark *))` (l.10)                                  |

Não existe token de acento por módulo, nem token "info" ou azul. O tom `blue` do `data-list.tsx` l.354 usa hex cru (`#0284c7`/`#0ea5e9`).

### 4.2 Dívidas do DS que pesam na Medicina

- **Primitives duplicadas**: `StatusBadge` existe em `status-badge.tsx` (4 tons, classes de token) e em `data-list.tsx` l.347–380 (6 tons, `style` com hex cru).
  `ListCard`/`ListToolbar` também existem em dobro (`list.tsx` l.263–278 e `data-list.tsx` l.15–19). As telas de Medicina usam a versão do `data-list`.
- **Hex cru fora dos tokens**: `nav-menu.tsx` (`#5b63f5`, `#7a7f97`, `#9095ad`, `#1b1f2e`), `layout.tsx` l.51/54 e `health-exams/page.tsx` l.35–40 (`VALIDITY_COLOR`).
- **Não há `loading.tsx`** em nenhuma rota, só o `src/app/error.tsx` raiz (`find src/app -name loading.tsx` não retorna nada).
- **Erro vira lista vazia**: `health-exams/page.tsx` l.64 e `medicos/page.tsx` fazem `result.ok ? result.data : { rows: [], total: 0 }`.
  Uma falha de leitura, ou um bloqueio por módulo/RLS, aparece como "Nenhum exame registrado."
- **`ConfirmModal` sem semântica de diálogo**: não tem `role="dialog"`, `aria-modal` nem `aria-labelledby`, e não prende nem devolve o foco (`confirm-modal.tsx` l.33–105).
- **Tabelas com `div role=table`** (`DataGrid`/`GridRow`/`Cell`): são semânticas por ARIA, mas não têm `aria-rowcount` nem cabeçalho de linha.
  O `Table` de `list.tsx` usa `<table>` sem `scope`.

### 4.3 Menu e módulos (Rikelvin)

- **#109 NOB-97** (`0c8f9ff`): tirou `Médicos` de "Cadastro" e `Gestão de Saúde (ASO)` de "Gestão de Segurança", e criou o grupo
  **"Medicina do Trabalho"** (`nav-menu.tsx` l.101–109) com `Exames e ASO` → `/health-exams` e `Médicos` → `/medicos`.
- A **"Gestão de Riscos Psicossociais"** e os **"Fatores de Risco Psicossocial"** continuam em **"Gestão de Segurança"** (l.83–93), não na Medicina.
- **O gating por módulo é por empresa-cliente, não por menu.** `company_modules(org_id, company_id, module ∈ {pgr, medicine})` vem com
  policy RESTRICTIVE de RLS (`module-policy.ts`), e `health_exams` só é visível com `medicine` habilitado na empresa do funcionário
  (`health-exams.ts` l.67–68). O **`NAV` é estático** e o `NavMenu` não recebe módulos nem papel (`nav-menu.tsx` l.439–443).
  O grupo Medicina aparece para todo office staff, mesmo quando nenhuma empresa tem Medicina. A spec NOB-97 admite que "telas sem
  empresa selecionada podem continuar mostrando o catálogo comum".
- **#110 NOB-99**: o formulário de exame lista só funcionários de empresas com Medicina (`health-exams/new/page.tsx` l.14,
  `listEmployeesAction({ pageSize: 200, module: "medicine" })`). Médicos são um catálogo do escritório (spec NOB-97).
- **#111 NOB-100**: `/companies/[id]/services` mostra cartões "PGR / Segurança do Trabalho" e "Medicina do Trabalho" com motivo
  obrigatório. Só o `owner` altera (`services/page.tsx` l.39), e o histórico é append-only.
  O link fica na listagem de empresas (`companies/page.tsx` l.145).
- **PR #112 NOB-98** (aberta): acrescenta `Riscos para PCMSO` → `/medical-risks` no grupo Medicina e cria `/companies/[id]/medical-risks`.
  **A UI diverge do DS**: usa `<ul>`/`<li class="glass-card">` em vez de `ListCard`/`DataGrid`, paginação com links "Anterior/Próxima"
  em vez de `ListFooter`, aviso `bg-amber-50 text-amber-900` (classes Tailwind cruas, fora dos tokens) e `<p role="alert">` solto para erro.
  `/companies/[id]/services` (#111) segue o mesmo padrão "cru".

### 4.4 Padrão visual das telas de Medicina existentes

- `/health-exams`: `PageHeader` (com ícone) + `ListCard` → `ListToolbar` (`HealthExamFilters` + `ToolbarButton "Novo Exame"`) + `DataGrid`
  (7 colunas, `minWidth 900`) + `StatusBadge` derivado por `examBadge` (validade + aptidão; `domains/pgr/health-exams.ts` l.62–74) + `ListFooter`.
  Ações: link ver/editar + `DeleteHealthExam`. **Não há filtro por empresa.**
- O formulário (`health-exam-form.tsx`) tem uma `FormSection` com funcionário, tipo, médico, aptidão, datas, `certificatePath` em texto livre
  (placeholder "/docs/aso/joao-2026.pdf") e "Observações" livres ("Restrições, recomendações…"), um campo clínico sensível sem nenhum aviso.
- Guarda: `requireOfficeStaffPage()` (owner/collaborator). O papel `client` recebe `forbidden()`.
- `/employees/[id]` tem `Placeholder` "Histórico" e "Ordens de serviço" (l.314–317), e **nenhuma seção de saúde**.

### 4.5 Protótipo — CSS e estrutura (l.1–168)

- **Fontes**: `Bricolage Grotesque` (display), `Atkinson Hyperlegible` (corpo, 15px) e `JetBrains Mono`, pelo Google Fonts (l.3).
  Só a mono coincide com o PGR.
- **Paleta**: `--accent #0d6b63` (teal), `--accent-soft #d6ece8`, `--bg #f3f6f5`, `--line #d3dcd9`; status `--ok #1f7a3a`, `--warn #9a5b00`,
  `--crit #b3261e`; `--psi #5b4bb0` (violeta, usado no Psicossocial e na IA). Documento: `#0d4f49`.
  Tem tema escuro completo (l.15–24), e o PGR não tem.
- **Componentes**: `.panel` (cartão branco com borda de 1px e raio de 8px; nada de glass), `.kpis/.kpi` com borda esquerda colorida,
  `.tablewrap` + `<table>`, `.pill.{ok,warn,crit,acc,psi}`, `.gr1–4` (grau de risco), `.nv1–4` (nível), `.alert.{crit,warn,ok,info,psi}`,
  `.seg` (segmentado), `.subtabs`, `.empty`, `.chips`, `.matrix` 5×5, `.dimbar/.stack` (COPSOQ), `.opts` (Likert), `.doc` (documento imprimível),
  `.toast`, `.confirm` (confirmação inline na linha).
- **Navegação**: uma barra de abas horizontal (`nav.tabs`, `<button data-tab>` com `aria-current="page"`), com **14 abas** para o provedor (l.527),
  13 para o portal da empresa (l.569), 3 para o portal da clínica (l.570) e 7 subabas no Psicossocial (l.528).
  O estado fica em memória; a URL só lê o `#hash` na carga (l.530).
- **Arquitetura**: SPA vanilla que re-renderiza `#app.innerHTML` inteiro a cada ação (l.602–630). Dados em `localStorage` ou `window.claude.use("db")`
  (l.2959–2960). "Ver como" simula os portais no cliente (l.597, l.583–590). O isolamento é declaradamente só de tela (comentário l.555).
- **Modelo de dados embutido na Empresa**: funções, GHE, riscos, exames e periodicidade ficam **dentro** do cadastro da empresa
  (`fEmpresa` l.689–747), duplicando `job_roles`/`ges`/`ges_job_roles`/`risks` do PGR.

### 4.6 Render do protótipo (Playwright, com dados de EXEMPLO do próprio protótipo)

| Medida                                     | 1440 px                                                                                                                  | 375 px                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Abas visíveis                              | 14 abas: as últimas ("Afastamentos e…", "Tabelas") ficam cortadas, com `scrollbar-width:none` e sem indicação de rolagem | `#tabs` com scrollWidth 1268 para 328 visíveis (~25%) |
| Altura do header sticky                    | ~130 px                                                                                                                  | **157 px** (19% da altura de 812)                     |
| Overflow horizontal da página              | não                                                                                                                      | não (as tabelas rolam dentro de `.tablewrap`)         |
| Botões com menos de 44 px de altura        | —                                                                                                                        | 53 de 53 em Funcionários; 12 de 20 no Painel          |
| Controles sem rótulo acessível             | Empresa (edição): **20 de 116**; ASO (emissão): **8 de 15**                                                              | —                                                     |
| `aria-live` / `role=status` / `role=alert` | **0** no documento inteiro                                                                                               | 0                                                     |
| `<caption>` / `th[scope]`                  | 0 / 0 em 6 tabelas (PCMSO)                                                                                               | —                                                     |
| `<title>`                                  | dentro do `<body>` (l.1)                                                                                                 | —                                                     |

Capturas (prefixo `proto-`, em `capturas/`): `proto-painel-1440.png`, `proto-empresa-form-1440.png`, `proto-aso-form-1440.png`,
`proto-psicossocial-1440.png`, `proto-painel-375.png`, `proto-funcionarios-375.png`. **Ressalva**: bloqueei as requisições externas,
então Google Fonts e html2pdf não carregaram. Nas capturas as fontes são o fallback (`Segoe UI`/system-ui), não Bricolage/Atkinson.

### 4.7 Contraste WCAG (calculado; fundos reais do PGR; glass composto sobre `#eae9e8`, sem os gradientes radiais do body)

| Cor (texto)                       | sobre `#fff` | sobre `bg #eae9e8` | sobre glass-card (≈`#efeeee`) | sobre glass-input (≈`#f6f5f5`) |
| --------------------------------- | ------------ | ------------------ | ----------------------------- | ------------------------------ |
| **teal `#0d6b63` (proposto)**     | **6,36**     | **5,25**           | **5,49**                      | **5,85**                       |
| teal-700 `#0f766e`                | 5,47         | 4,51               | 4,73                          | 5,03                           |
| teal-600 `#0d9488`                | 3,74 ✗       | 3,09 ✗             | 3,23 ✗                        | 3,44 ✗                         |
| teal-500 `#14b8a6`                | 2,49 ✗       | 2,05 ✗             | 2,15 ✗                        | 2,29 ✗                         |
| teal-escuro `#0d4f49`             | 9,41         | 7,76               | 8,13                          | 8,65                           |
| indigo `#5b63f5` (primária atual) | 4,62         | **3,81 ✗**         | **3,99 ✗**                    | 4,24 ✗                         |
| `#4f46e5` primary-strong          | 6,29         | 5,19               | 5,43                          | 5,78                           |
| `text-subtle #8c91a8`             | **3,12 ✗**   | **2,57 ✗**         | 2,69 ✗                        | 2,87 ✗                         |
| nav inativo `#7a7f97`             | 3,95 ✗       | 3,26 ✗             | 3,42 ✗                        | 3,63 ✗                         |

Branco sobre fundo sólido: `#0d6b63` 6,36 · `#0f766e` 5,47 · `#5b63f5` 4,62 · `#4f46e5` 6,29.
Pílula (texto da matiz sobre 12–16% da mesma matiz) sobre branco / glass: teal `#0d6b63` **5,16 / 4,52** · teal-700 4,50 / 3,92 ✗ ·
**verde atual 2,90 / 2,53 ✗ · âmbar atual 2,66 / 2,34 ✗ · neutro 2,79 / 2,44 ✗ · vermelho 3,85 / 3,38 ✗ · indigo 3,95 / 3,44 ✗**.
O texto das pílulas tem 11px e peso 700, então não conta como "texto grande": vale 4,5:1.

## 5. Funcionalidades existentes (estado real × protótipo)

Legenda: **EV** existe e está validado · **EP** existe parcialmente · **PROTO** só no protótipo · **NI** não implementado · **DIV** divergente ·
**EXT** depende de decisão externa · **FORA** fora do MVP. "Validado" só quando há CRUD mergeado com testes no repo e nenhuma pendência clínica conhecida.
Nenhuma tela de Medicina tem validação clínica registrada, então nenhuma recebe EV pleno.

Rotas propostas: seguem o padrão já em uso (top-level em inglês, como `/health-exams`, e escopo por empresa em `/companies/[id]/…`,
como a #111/#112) e ficam todas no grupo "Medicina do Trabalho" do `NAV`. **São propostas, não decisões.**

| #   | Tela do protótipo                                                                                                 | Status                  | Rota Next.js proposta                                                                                                                          | Reutilizar                                                                                                                       | Novo necessário                                                                                                                                                                           | Entidades                                                         | Ações / validações                                                                                                    | Loading / erro / vazio                                                                               | Permissões                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Painel (KPIs + alertas + "Exames a realizar" + matriz empresa×CNAE×NTEP)                                          | PROTO                   | `/medicine` (painel do módulo); widgets também no `/dashboard` (`dashboard-widgets.tsx`)                                                       | `PageHeader`, `StatCard`/`PendingPanel` de `dashboard/_components/dashboard-widgets.tsx` (l.6, l.472), `StatusBadge`, `DataGrid` | promover `StatCard` para `_ui` (hoje é local do dashboard), `AlertBanner` tokenizado (substitui `bg-amber-50` cru da #112)                                                                | health_exams, employees, companies(+modules), afastamentos (NI)   | atalhos "Novo exame"/"Encaminhar"; KPIs só com dado real (regra da fatia 019: nunca fictício)                         | skeleton por KPI; erro ≠ vazio; vazio sem empresa com Medicina → CTA para `/companies/[id]/services` | office staff; KPIs só de empresas com `medicine`        |
| 2   | Assinaturas (planos Essencial/Completo, equipe designada, proposta)                                               | DIV + EXT               | —                                                                                                                                              | `/plans`, `/planos-de-assinatura` existentes                                                                                     | —                                                                                                                                                                                         | —                                                                 | o protótipo cobra por empresa; a NOB-97 diz "Pro, preços e Stripe independentes"                                      | —                                                                                                    | Expedito/Douglas                                        |
| 3   | Serviços avulsos (pedidos, teleconsulta, auditoria, catálogo)                                                     | FORA                    | —                                                                                                                                              | —                                                                                                                                | —                                                                                                                                                                                         | —                                                                 | **colisão de nome** com `/companies/[id]/services` (habilitação de módulos)                                           | —                                                                                                    | —                                                       |
| 4   | Absenteísmo (taxa, por função, por CID, >15 d)                                                                    | NI / FORA               | `/medicine/absenteeism` (futuro)                                                                                                               | `SegmentedFilter`, `ToolbarSelect`, `DataGrid`                                                                                   | gráfico de barras acessível (`dataviz`); depende de afastamentos e salário                                                                                                                | afastamentos (NI), employees                                      | filtros de empresa/função/granularidade                                                                               | vazio explicativo                                                                                    | CID = dado de saúde: só profissional habilitado (EXT)   |
| 5   | FAP e RAT (simulador, índices, aposentadoria especial)                                                            | FORA                    | —                                                                                                                                              | —                                                                                                                                | —                                                                                                                                                                                         | companies (+RAT/FAP/folha: NI)                                    | —                                                                                                                     | —                                                                                                    | Expedito                                                |
| 6   | Empresas (CNAE, GR, médico PCMSO, funções+riscos+exames embutidos, RAT/FAP, responsáveis PPP)                     | **EP + DIV**            | **reutilizar `/companies`** + aba/seção de Medicina em `/companies/[id]/…`                                                                     | `companies` já tem `cnae`, `risk_grade` (schema l.36–38); `company-form.tsx`; `/companies/[id]/services`                         | só os campos próprios da Medicina: médico coordenador do PCMSO (FK → `medicos`), data-base do PCMSO                                                                                       | companies, medicos, job_roles, ges, risks                         | **não** recriar funções/riscos dentro da empresa: vêm de `job_roles`/`ges`/`risks` e, na Medicina, das fontes da #112 | —                                                                                                    | owner/collaborator                                      |
| 7   | Funcionários (lista com próximo periódico + ASO/PPP por linha; form com NIT, CTPS, matrícula, salário)            | **EP**                  | **reutilizar `/employees`**; nova seção "Saúde ocupacional" em `/employees/[id]` (já há `Placeholder`)                                         | `employee-form.tsx`, `DataGrid`, `StatusBadge`                                                                                   | coluna/badge "próximo periódico" (derivado), seção de saúde condicionada a `medicine`                                                                                                     | employees, health_exams                                           | NIT/CTPS/salário **não existem** em `employees` (schema l.51–67): decisão de dado (EXT)                               | vazio "sem exames" com CTA                                                                           | ver saúde: perfil clínico (EXT)                         |
| 8   | Exames e clínicas (encaminhamentos, guia, ficha de coleta, clínicas parceiras)                                    | NI                      | `/exam-referrals` (lista/novo/[id]) e `/clinics` (catálogo do escritório, como `/medicos`)                                                     | padrão CRUD de `/medicos` (lista + filtros + form + delete)                                                                      | entidade clínica; encaminhamento com status (solicitado → agendado → realizado → concluído); documento da guia                                                                            | clinics, referrals, employees, health_exams                       | filtro "abertos"; bloquear exclusão de clínica com encaminhamento aberto (protótipo l.548)                            | estados por status; `ConfirmModal` acessível                                                         | office staff; clínica externa = EXT                     |
| 9   | ASO (lista, emissão com procedimentos, riscos impressos, aviso de dispensa do demissional, documento ASO)         | **EP**                  | **`/health-exams`** (manter a rota; renomear o rótulo para "ASO e exames" se o produto quiser); documento em `/health-exams/[id]` (visualizar) | `HealthExamForm`, `examBadge`, `DataGrid`, pipeline DOCX/PDF do PGR + GED (#99–#106, Douglas)                                    | lista de procedimentos (linhas repetíveis com rótulo), bloco "riscos do trabalhador" vindo das fontes da #112, snapshot no documento, filtro por empresa, `/health-exams/[id]` só leitura | health_exams, medicos, employees, medical risk sources (#112)     | data não-futura já existe; médico examinador × coordenador; "Observações/restrições" = dado clínico                   | hoje erro → vazio (corrigir)                                                                         | P0 clínico (EXT: Dr. Alcides)                           |
| 10  | PPP (histórico laboral, exposição com EPC/EPI, CAT, monitoração biológica)                                        | NI / EXT                | `/employees/[id]/ppp` (documento por funcionário)                                                                                              | GED, pipeline de documento                                                                                                       | histórico de função (não existe), LTCAT                                                                                                                                                   | employees, risks, epi deliveries, accidents                       | depende de eSocial (S-2240) e de responsável ambiental                                                                | —                                                                                                    | Douglas/Expedito                                        |
| 11  | PCMSO (documento gerado: identificação, riscos por função, planejamento, cronograma, NTEP, relatório analítico)   | **EP (PR #112 aberta)** | `/companies/[id]/pcmso` (+ entrada `/pcmso` com seleção de empresa, padrão de `/medical-risks`)                                                | fontes de risco da #112; pipeline DOCX/PDF + GED; `FormSteps`                                                                    | planejamento de exames por função/GES (matriz), cronograma, barra de validação                                                                                                            | companies, ges, job_roles, risks/medical sources, health_exams    | o protótipo inclui psicossociais ≥ médio no PCMSO (regra clínica: EXT)                                                | aviso de validação técnica pendente (a #112 já tem `validationNotice`)                               | médico coordenador assina (EXT)                         |
| 12  | Psicossocial NR-01 (COPSOQ II, levantamentos, entrevistas, indicadores, inventário P×S, plano, fadiga, relatório) | **DIV**                 | **reutilizar `/psychosocial/*`** (hoje em "Gestão de Segurança")                                                                               | campanhas + resposta pública `(public)/psychosocial-response/[campaignId]/[token]` + fatores de risco                            | se aprovado: instrumento COPSOQ fixo, limiar de anonimato por GHE, mapa por GES                                                                                                           | psychosocial\_\* (schema existente: perguntas livres, sem COPSOQ) | o protótipo mistura NR-01 (PGR) com dado individual clínico ("resultado individual COPSOQ, sigilo médico", l.825)     | —                                                                                                    | **dono do módulo: EXT** (Expedito/Dr. Alcides/Rikelvin) |
| 13  | Afastamentos e NTEP (registro, cruzamento CID×CNAE, kit INSS)                                                     | NI / EXT                | `/sick-leaves` (futuro); kit INSS FORA                                                                                                         | `FormSection`, `DataGrid`                                                                                                        | entidade afastamento; consulta CID×CNAE                                                                                                                                                   | afastamentos, companies.cnae, tabela Lista C                      | CID é dado de saúde sensível                                                                                          | —                                                                                                    | perfil clínico (EXT)                                    |
| 14  | Tabelas normativas (Lista C NTEP, NR-4 Anexo I, backup)                                                           | NI                      | sem tela no MVP: tabela **global** semeada por script, padrão `caepi_certificates`                                                             | precedente CAEPI (tabela global, leitura `app_runtime`)                                                                          | —                                                                                                                                                                                         | tabelas de referência                                             | o protótipo deixa "colar texto oficial": não copiar; o backup/restore é da plataforma                                 | —                                                                                                    | Douglas/Rikelvin                                        |
| 15  | Portal da empresa (13 abas)                                                                                       | EXT                     | — (papel `client` existe mas é barrado por `requireOfficeStaff`)                                                                               | resolução de papéis em `active-tenant.ts`                                                                                        | —                                                                                                                                                                                         | —                                                                 | decisão de produto e de segurança                                                                                     | —                                                                                                    | Rikelvin/Expedito                                       |
| 16  | Portal da clínica (agenda, guias, ASOs emitidos)                                                                  | EXT / FORA              | —                                                                                                                                              | —                                                                                                                                | novo tipo de ator externo                                                                                                                                                                 | —                                                                 | —                                                                                                                     | —                                                                                                    | Rikelvin/Expedito                                       |
| 17  | Acesso pendente / "Ver como"                                                                                      | DIV                     | —                                                                                                                                              | `/no-organization`, Clerk orgs                                                                                                   | —                                                                                                                                                                                         | —                                                                 | "Ver como" é simulação no cliente: **não copiar**                                                                     | —                                                                                                    | —                                                       |
| 18  | Quiosque do questionário                                                                                          | EP                      | `(public)/psychosocial-response/...` existente                                                                                                 | rota pública com token                                                                                                           | —                                                                                                                                                                                         | psychosocial_responses                                            | o protótipo usa `fieldset/legend` (bom, l.1003)                                                                       | —                                                                                                    | público com token                                       |
| 19  | Fadiga, prontuário, consultas, teleconsulta, auditoria SST                                                        | FORA                    | —                                                                                                                                              | —                                                                                                                                | —                                                                                                                                                                                         | —                                                                 | dado clínico ou escopo novo                                                                                           | —                                                                                                    | —                                                       |
| —   | Médicos (não é aba do protótipo; lá são campos livres de médico/CRM)                                              | **EP (CRUD mergeado)**  | `/medicos`                                                                                                                                     | —                                                                                                                                | —                                                                                                                                                                                         | medicos                                                           | `UNIQUE(org_id, crm)`                                                                                                 | erro → vazio (corrigir)                                                                              | office staff                                            |

## 6. Lacunas

1. **Gating de navegação**: o menu Medicina não reflete `company_modules`. Falta estado vazio de módulo ("nenhuma empresa com Medicina
   habilitada", com link para `/companies/[id]/services`) em `/health-exams` e `/medicos`. A #112 já faz isso em `/medical-risks`, só que sem o DS.
2. **Erro e vazio misturados** em toda listagem de Medicina, e nenhuma rota com `loading.tsx` ou skeleton.
3. **Sem filtro por empresa** em `/health-exams`, apesar de o módulo ser contratado por empresa.
4. **Nenhuma visão por funcionário** (`/employees/[id]` não tem seção de saúde) e nenhum documento ASO visualizável.
5. **Sem token de acento** para diferenciar o módulo e **sem token de status "info"**.
6. **Primitives duplicadas** (`StatusBadge`, `ListCard`, `ListToolbar`): a próxima tela de Medicina não sabe qual usar.
7. **Pílulas de status abaixo de AA** (verde 2,90, âmbar 2,66, neutro 2,79 sobre branco), justamente as usadas para "Apto"/"A vencer".
8. `text-subtle #8c91a8` (descrições do `PageHeader`, cabeçalhos de tabela, "—") fica abaixo de 4,5 em todos os fundos.
9. As telas da #111/#112 não seguem as primitives (lista crua, paginação própria, cores cruas).

## 7. Riscos

| Risco                                                       | Impacto                                                                                                                                                 | Evidência                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Copiar a navegação de 14 abas para o mega-menu              | o grupo Medicina passa a ter mais itens que todo o resto e dilui o produto                                                                              | protótipo l.527 × `NAV` l.101–109                            |
| Recriar Empresas/Funções/Riscos dentro da Medicina          | dado duplicado e divergente, quebrando a decisão NOB-97/NOB-99 ("não criar cópias por módulo")                                                          | `fEmpresa` l.689–747; spec NOB-97                            |
| Erro tratado como vazio em tela clínica                     | o usuário conclui "funcionário sem ASO" quando houve falha ou bloqueio de RLS (falso negativo clínico ou legal)                                         | `health-exams/page.tsx` l.64                                 |
| Trazer o teal como primária na Medicina                     | dois produtos visuais e quebra da diretriz de identidade                                                                                                | protótipo `--accent` l.11                                    |
| Usar teal claro (teal-500/600) em texto                     | reprova AA (2,05–3,74)                                                                                                                                  | §4.7                                                         |
| Exibir dado clínico em lista e documento sem perfil clínico | o office staff (inclusive colaborador) vê aptidão/restrições; o protótipo põe riscos psicossociais com nível no ASO                                     | `health-exam-form.tsx` "Observações"; protótipo l.824, l.844 |
| "Serviços" com dois sentidos                                | confusão entre habilitação de módulo (#111) e venda avulsa (protótipo)                                                                                  | `services/page.tsx` × protótipo `vServ`                      |
| Re-render total do DOM                                      | perda de foco e contexto para leitor de tela; não é transferível para React, mas o padrão de UX (confirmação inline, toast) pode ser copiado sem querer | protótipo l.602–630                                          |

## 8. Dependências

- **PR #112 (NOB-98)**: fonte de riscos do PCMSO e do bloco de riscos do ASO. As telas 9 e 11 dependem dela.
- **Pipeline de documentos DOCX/PDF + GED** (Douglas, #99–#106): base para ASO, PCMSO e guia de encaminhamento.
- **`company_modules`** (#109/#111): o gating de UI e os estados vazios de módulo dependem de expor os módulos habilitados ao shell
  (hoje o `NavMenu` não recebe esse dado).
- **Decisão de perfil clínico** (quem vê dado de saúde): afeta colunas, seções e documentos.
- **Correção de tokens de status** (AA) antes de multiplicar badges de saúde.

## 9. Decisões pendentes

| Decisão                                                                                                                                        | Para quem                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| O Psicossocial NR-01 fica no PGR ("Gestão de Segurança") ou passa para a Medicina? O instrumento COPSOQ II fixo substitui as perguntas livres? | Expedito + Dr. Alcides + Rikelvin |
| O ASO imprime riscos psicossociais com nível (P×S)? O que do resultado individual fica sob sigilo médico?                                      | Dr. Alcides                       |
| Existe perfil "clínico" (médico/enfermagem) distinto de owner/collaborator para ver aptidão/restrições/CID?                                    | Rikelvin + Dr. Alcides            |
| O menu Medicina deve sumir/desabilitar quando nenhuma empresa tem `medicine`, ou só mostrar um estado vazio?                                   | Rikelvin (gating) + Carlos (UX)   |
| Rótulo do grupo e dos itens ("Medicina do Trabalho" × "Saúde Ocupacional"; "Exames e ASO" × "ASO")                                             | Expedito                          |
| Token de acento por módulo (teal `#0d6b63`) aprovado como padrão de DS?                                                                        | Douglas (DS) + Carlos             |
| Unificar `StatusBadge`/`ListCard` duplicados e corrigir o contraste das pílulas (afeta todas as telas)                                         | Douglas                           |
| Portais da empresa e da clínica: entram no roadmap? Com que papel?                                                                             | Expedito + Rikelvin               |
| Campos NIT/CTPS/salário em `employees` (exigidos por PPP/absenteísmo)                                                                          | Expedito + Rikelvin               |
| Assinaturas por empresa (protótipo) × módulos independentes de Pro/Stripe (NOB-97)                                                             | Expedito + Douglas                |

## 10. Recomendações

### 10.1 Identidade: teal como acento controlado (proposta, não aplicada)

Tokens novos no `@theme inline`, com nomes de módulo e não de cor:

```
--color-module-medicine:        #0d6b63;                 /* texto/ícone: 5,25–6,36 em todos os fundos do PGR */
--color-module-medicine-strong: #0d4f49;                 /* hover / texto sobre soft */
--color-module-medicine-soft:   rgba(13, 107, 99, 0.12); /* fundo de chip/ícone */
```

(Se a convenção pedir `accent-*`, use `--color-accent-medicine*`. O ponto é ter um token só, consumido por classe.)

**Onde aplicar**: o quadrado do ícone do `PageHeader` nas telas de Medicina (hoje `bg-primary`; virar prop `tone="medicine"`), o ícone do
grupo no mega-menu e um marcador de 3–4px no item ativo do grupo, o chip "Medicina" em cartões de empresa e em `/companies/[id]/services`,
e o tag de origem em listas compartilhadas (ex.: um exame aparecendo na ficha do funcionário).

**Onde NÃO aplicar**: botão primário, foco (`--color-primary-ring`), links, paginação ativa, `SubmitButton`, item de menu ativo "Dashboard",
cores de status (apto/vencido continuam verde/âmbar/vermelho, corrigidos para AA), gráficos de severidade e documentos oficiais
(ASO/PCMSO saem com a identidade do documento, não do app). Nunca usar teal-500/600 em texto (2,05–3,74). O violeta `--psi #5b4bb0`
do protótipo **não** entra: ficaria perto demais do indigo e criaria um terceiro acento.

**Tipografia**: Manrope + JetBrains Mono. Descartar Bricolage Grotesque e Atkinson Hyperlegible, que são o principal fator de "outro produto"
no protótipo. A legibilidade que a Atkinson traz se obtém com corpo ≥ 13px e o `text-muted` (7,13), em vez do `text-subtle`.

### 10.2 Estrutura e reutilização

- Manter o grupo "Medicina do Trabalho" com **no máximo 5–6 itens no MVP**: Painel (opcional), ASO e exames, Encaminhamentos/Clínicas,
  PCMSO (com "Riscos para PCMSO" da #112 como subpasso, não item próprio), Médicos. O resto entra depois, por fatia.
- **Empresas, Funcionários, Funções, GES e Riscos: sempre os cadastros compartilhados.** A Medicina acrescenta seções e abas, nunca CRUD paralelo.
- Por empresa, seguir o padrão já iniciado por Rikelvin (`/companies/[id]/services`, `/companies/[id]/medical-risks`) e acrescentar
  `/companies/[id]/pcmso`. Por funcionário, a seção "Saúde ocupacional" em `/employees/[id]`.
- Antes de novas telas: (a) unificar `StatusBadge`/`ListCard`; (b) criar `AlertBanner` tokenizado e promover `StatCard` do dashboard para `_ui`; (c) padronizar
  "erro ≠ vazio" (`result.ok === false` → `ErrorState` de `src/app/_components/error-state.tsx`, que já existe); (d) `loading.tsx` com `Skeleton` por rota;
  (e) `ConfirmModal` com `role="dialog"`, `aria-modal`, foco preso e devolvido.
- Reescrever as telas da #111/#112 com `ListCard`/`DataGrid`/`ListFooter`/`AlertBanner`. É dívida pequena, e convém pagar antes que vire o template da Medicina.

### 10.3 O que NÃO copiar do protótipo (a11y, responsividade, semântica)

1. Abas de navegação como `<button>` sem URL (estado só em memória; o `#hash` só é lido na carga): no Next, cada tela é rota com `<Link>`.
2. 14 abas em faixa horizontal com scrollbar escondida (no 375 só ~25% é visível, sem affordance de rolagem). Header sticky de 157px no mobile.
3. Re-render total via `innerHTML` (perde foco e estado de leitor de tela; a restauração de foco por `id` é paliativa, l.628–629).
4. **Nenhuma região `aria-live`**: o toast (l.171) e os alertas dinâmicos não são anunciados. No PGR, usar `role="status"`/`role="alert"`, como já faz o `FormError`.
5. Linhas repetíveis com inputs sem rótulo (20 de 116 na Empresa, 8 de 15 no ASO; só `placeholder`), botões "×" com `aria-label="Remover"` sem dizer o quê.
6. Tabelas sem `<caption>`/`scope` e o PCMSO na tela com dois `<h1>` (tela + documento).
7. `<title>` dentro do `<body>`. Confirmação de exclusão inline na linha, sem diálogo (aqui vale o `ConfirmModal` corrigido).
8. Alvos de toque pequenos: todos os botões da linha em Funcionários têm menos de 44px no 375.
9. Barras de cor (COPSOQ `.stack`) com significado só por cor, e `nv`/`gr` (texto branco sobre `#a58a00`/`#8a7a12`, que precisam ser medidos).
   A `.stack` tem `role="img"` com `aria-label` (bom), mas a matriz 5×5 depende de cor.
10. Dependências externas em runtime (Google Fonts, html2pdf no cdnjs, `window.claude.use("sample")` para IA). Isolamento "de tela" e "Ver como" no cliente.
11. Pontos bons, que valem como referência de conteúdo: o `fieldset/legend` no questionário, o `prefers-reduced-motion`, `font-variant-numeric: tabular-nums`
    nas métricas, os avisos normativos contextuais (ex.: dispensa do demissional, NR-7 7.5.11) e o limiar de anonimato no Psicossocial.

### 10.4 Telas que mais se beneficiam de composição no Claude Design depois (não feito agora)

1. **Painel da Medicina** (`/medicine`): densidade de KPIs + alertas + fila de exames. É onde o protótipo mais "grita" (4 alertas empilhados).
2. **Emissão/visualização de ASO** (`/health-exams/new` e `[id]`): procedimentos repetíveis, bloco de riscos herdado e prévia do documento.
3. **PCMSO por empresa** (`/companies/[id]/pcmso`): fluxo em etapas (fontes → planejamento → cronograma → emissão) com `FormSteps`.
4. **Seção "Saúde ocupacional" na ficha do funcionário**: linha do tempo de exames e próximo periódico.
5. **Encaminhamentos** (kanban ou lista por status), se entrar no MVP.

## 11. Nível de confiança

- Tokens, primitives, menu e gating: **alta** (código lido em `d6b787c`, com linhas citadas).
- Leitura do protótipo (CSS, estrutura, abas, formulários): **alta**. As medições de render são **média-alta**, porque foram feitas com fontes fallback.
- Contraste: **alta** para fundos sólidos; **média** para glass (composição aproximada sobre `#eae9e8`, sem os gradientes radiais e o blur do body).
- Rotas propostas e classificação MVP/FORA: **média**. São propostas de UX que dependem das decisões da §9.

## 12. O que não foi possível verificar

- **Render com as fontes reais do protótipo**: o Playwright MCP bloqueia `file:`, então carreguei o HTML local via `setInputFiles` → `page.setContent`,
  com **todas as requisições http(s) abortadas** (para não acessar site externo). Google Fonts e html2pdf não carregaram, e nenhum PDF ou IA foi acionado.
  Usei o botão do próprio protótipo "Carregar dados de exemplo" (dados marcados EXEMPLO, gravados só no `localStorage` da instância temporária).
  Nenhum formulário foi submetido. O navegador foi fechado.
- Portais da empresa e da clínica, quiosque e subabas do Psicossocial: lidos no código e **não navegados** visualmente.
- Os mockups `sst-project/redesign/*.dc.html` citados no CLAUDE.md (ex.: `gestao-saude.dc.html`) **não estão no repositório**
  (`git ls-files` não retorna nada). Não comparei as telas com eles. NÃO VERIFICADO.
- Render real das telas Next (não abri `localhost:3000`, por instrução). Os achados de UI do PGR vêm só da leitura de código.
- Contraste de `.nv2`/`.gr2` do protótipo e de todos os ícones (critério 1.4.11): não medidos.
- Conteúdo das PRs #115/#116/#117 (só títulos): sem impacto de UI identificado. HIPÓTESE.
- Validação clínica ou normativa de qualquer regra mencionada: fora do escopo deste agente.
