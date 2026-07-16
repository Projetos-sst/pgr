---
description: "Task list — Implantação do design system do redesign visual"
---

# Tasks: Implantação do design system do redesign visual

**Input**: Design documents from `.specs/019-redesign-implantation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `feature/redesign-implantation`

**Tests**: incluídos **apenas** onde há lógica (helper de contagem do dashboard, US4) — exigência da
constituição (unit p/ regra + integração p/ isolamento multi-tenant). O resto da fatia é CSS/markup,
validado por comparação visual (Playwright MCP), não por teste automatizado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US4 (mapeia as user stories da spec)
- Todo caminho de arquivo é relativo à raiz do repo

## Convenção de verificação visual (todas as tarefas de tela)

Playwright MCP: abrir `file://…/sst-project/redesign/<mockup>.dc.html` e a rota real em
`http://localhost:3000/<rota>`, `browser_resize` + `browser_take_screenshot` em **375 / 768 / 1440px**,
revisão lado a lado. Contratos: `contracts/screen-mockup-map.md`, `contracts/design-tokens.md`,
`contracts/navigation.md`.

---

## Phase 1: Setup (baseline)

**Purpose**: material de referência para a comparação visual das fases seguintes

- [ ] T001 [P] Capturar screenshots de referência dos mockups-chave (`login`, `home`, `dashboard`, `empresas`, `empresa-form`, `estoque-epi`, `pgrs`) em 375/768/1440px via Playwright MCP (`file://` em `sst-project/redesign/*.dc.html`), salvando no scratchpad da sessão para comparação posterior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: fundação visual — **bloqueia todas as user stories** (tokens + fontes que todo restyle consome)

**⚠️ CRITICAL**: nenhuma US pode começar antes desta fase

- [x] T002 Adicionar os tokens de design ao bloco `@theme inline` de `src/app/globals.css` (cor primária/variações, neutros, acentos, `--radius-card`/`--radius-pill`, `--shadow-card`/`--shadow-primary`) conforme `contracts/design-tokens.md`; remover o `font-family: Arial` hardcoded do `body` (passa a herdar `--font-sans`)
- [x] T003 Trocar as fontes em `src/app/layout.tsx`: `Geist`→`Manrope` e `Geist_Mono`→`JetBrains_Mono` via `next/font/google`, expor as variáveis no `<html>` e mapeá-las para `--font-sans`/`--font-mono` no `@theme` de `src/app/globals.css`

**Checkpoint**: fundação pronta — US1–US4 podem começar (US1 e US2 em paralelo)

---

## Phase 3: User Story 1 — Identidade visual nos cadastros (Priority: P1) 🎯 MVP

**Goal**: as telas de CRUD da cadeia do PGR e o shell adotam a identidade do redesign, fiéis aos mockups.
As primitives `_ui` são a alavanca de cascata (as telas sem mockup herdam o tema sem trabalho individual).

**Independent Test**: abrir empresas/unidades/funções/GES/funcionários/categorias/EPI (listas e forms) e
comparar com os `.dc.html` em 375/768/1440px — paleta indigo, Manrope, cards glass, sem quebra de layout.

> **Nota dashboard (spec US1)**: em US1 o `/dashboard` já adota tokens/fontes por herança; o **rebuild
> visual completo** (KPI cards + widgets) é entregue na US4 (que traz os dados reais).

### Restyle das primitives (cascata) — arquivos independentes

- [x] T004 [P] [US1] Restyle `src/app/(protected)/_ui/list.tsx` (PageHeader, PrimaryLink→pílula indigo, EmptyState, SearchForm, Pagination, Table) consumindo os tokens; sem hex cru
- [x] T005 [P] [US1] Restyle `src/app/(protected)/_ui/form.tsx` (TextField, SelectField, SubmitButton→pílula, FieldError, FormError, `inputClass`) com tokens (borda/foco `--color-primary-ring`)
- [x] T006 [P] [US1] Restyle `src/app/(protected)/_ui/field-hint.tsx` (dica) com tokens de texto sutil
- [x] T007 [P] [US1] Restyle `src/app/(protected)/_ui/confirm-delete-button.tsx` (botão + modal/overlay) com tokens; manter o comportamento de dependentes intacto
- [x] T008 [P] [US1] Restyle `src/app/(protected)/_ui/address-fields.tsx` com tokens, consistente com `form.tsx`
- [x] T009 [US1] Restyle do header raiz em `src/app/layout.tsx` (superfície/bordas/CTA "Entrar" via tokens), preservando `ClerkProvider`, `Show`, `TenantSwitcher`, `UserButton` (a nav do menu é US2)

### Ajuste fino 1:1 das telas com mockup (herdam das primitives; verificar e corrigir divergências)

- [x] T010 [P] [US1] `/companies` (+ `new`, `[id]/edit`) vs `empresas.dc.html` / `empresa-form.dc.html`
- [x] T011 [P] [US1] `/work-units` (+ `new`, `[id]/edit`) vs `unidades-obra.dc.html` / `unidade-obra-form.dc.html`
- [x] T012 [P] [US1] `/job-roles` (+ `new`, `[id]/edit`) vs `funcoes.dc.html` / `funcao-form.dc.html`
- [x] T013 [P] [US1] `/ges` (+ `new`, `[id]/edit`) vs `ges-setores.dc.html`
- [x] T014 [P] [US1] `/employees` (+ `new`, `[id]/edit`) vs `funcionarios.dc.html` / `funcionario-form.dc.html`
- [x] T015 [P] [US1] `/categories` (+ `new`, `[id]/edit`) vs `categorias.dc.html`
- [x] T016 [P] [US1] `/epi-catalog` (+ `new`, `[id]/edit`) vs `equipamentos-epi.dc.html` / `equipamento-epi-form.dc.html`
- [x] T017 [P] [US1] `/epi-stock` (+ `new`, `[id]/edit`, `[id]/history`) vs `estoque-epi.dc.html`
- [x] T018 [P] [US1] `/pgr` e `/pgr/[id]` (+ `edit`, `new`) vs `pgrs.dc.html` / `pgr-editor.dc.html`
- [x] T019 [P] [US1] `/risks/[id]/control-measures` (+ `new`, `[measureId]/edit`) vs `planos-acao.dc.html`

### Verificação da US1

- [ ] T020 [US1] Verificação visual (Playwright MCP) de T010–T019 nos 3 breakpoints; aprovar cada tela (C-SCR-1/C-SCR-4)
- [x] T021 [US1] Grep de conformidade C-TOK-1: 0 hex de cor em `src/app/**/*.tsx` fora de `globals.css` (corrigir violações remanescentes das primitives/telas)

**Checkpoint**: MVP entregável — cadastros com a nova identidade, tema herdado pelas telas sem mockup

---

## Phase 4: User Story 2 — Navegação em mega-menu por categoria (Priority: P1)

**Goal**: nav plana → mega-menu (Início/Cadastro/Módulos/Gestão·Qualidade), só com rotas implementadas.

**Independent Test**: percorrer o menu — itens agrupados por categoria, todo item leva a rota existente,
nenhum item de backlog, colapso acessível em 375px.

- [x] T022 [P] [US2] Criar componente client de menu (colapso mobile com `aria-expanded`) em `src/app/(protected)/_components/nav-menu.tsx` (se o CSS puro não bastar para 375px)
- [x] T023 [US2] Reescrever a nav em `src/app/(protected)/layout.tsx` como mega-menu por categoria conforme `contracts/navigation.md` (usar o `nav-menu.tsx` se criado), listando **somente** rotas reais
- [x] T024 [US2] Verificar C-NAV-1..5: cruzar cada `href` do menu com diretórios em `src/app/(protected)/**` (nenhum 404), nenhuma tela do backlog, agrupamento fiel ao mockup, colapso 375px sem rolagem horizontal

**Checkpoint**: navegação reorganizada e sem rotas fantasmas

---

## Phase 5: User Story 3 — Página de boas-vindas (Priority: P2)

**Goal**: nova rota `/boas-vindas` no layout de `home.dc.html`, separada do dashboard operacional.

**Independent Test**: acessar `/boas-vindas` — visão geral de módulos + ações rápidas (layout do mockup),
atalhos levam aos módulos existentes, sem dado/lógica nova; `/dashboard` continua distinto.

- [x] T025 [US3] Criar `src/app/(protected)/boas-vindas/page.tsx` no layout de `home.dc.html`, reaproveitando a lista de módulos (`PGR_MODULES`) hoje em `src/app/(protected)/dashboard/page.tsx` (extrair para constante/módulo compartilhável se ajudar, sem duplicar)
- [x] T026 [US3] Tornar `/boas-vindas` o destino padrão pós-login: ajustar `signInFallbackRedirectUrl` e `signUpFallbackRedirectUrl` de `/dashboard` para `/boas-vindas` no `ClerkProvider` em `src/app/layout.tsx`; garantir o acesso pelo menu (item "Início → Boas-vindas" do `contracts/navigation.md`). O `/dashboard` continua acessível pelo menu (FR-006)
- [ ] T027 [US3] Verificação visual `/boas-vindas` vs `home.dc.html` nos 3 breakpoints

**Checkpoint**: boas-vindas disponível, coexistindo com o dashboard

---

## Phase 6: User Story 4 — Dashboard com KPIs reais e estados vazios (Priority: P2)

**Goal**: `/dashboard` no layout de `dashboard.dc.html` — 4 KPIs reais tenant-escopados + widgets em
empty-state onde não há dado. **Nunca dado fictício.**

**Independent Test**: em tenant com dados conhecidos, os KPIs Empresas/PGRs/Equipe/EPIs-abaixo-da-mínima
batem com a contagem esperada e não vazam entre orgs; widgets sem fonte mostram o empty-state do mockup.

- [x] T028 [P] [US4] Adicionar `countEpiStockBelowMinimum(orgId)` em `src/shared/db/repositories/epi-stock.ts` (dentro de `withOrg`; `COUNT(*) WHERE balance < min_quantity`), seguindo o padrão dos demais repositórios
- [x] T029 [US4] Rebuild de `src/app/(protected)/dashboard/page.tsx` conforme `dashboard.dc.html`: 4 KPI cards (Empresas/PGRs/Equipe via `total` dos `list*` ou helper; EPIs-abaixo-da-mínima via T028) + grid de widgets em empty-state do mockup (Riscos por Categoria, Planos de Ação, Status/Tipo de OS, Categorias de Incidentes) — sem inventar dado (FR-008/D4)
- [x] T030 [P] [US4] SE o rebuild extrair um novo helper puro (ex.: montagem do view-model dos KPIs), cobri-lo com unit test em `src/**/__tests__/`; caso contrário marcar **N/A** — a regra "abaixo da mínima" já é coberta pelos testes de `computeEpiStockStatus`, e correção/isolamento da contagem são provados por T031 (não criar teste só-por-cobertura — CODE_STANDARDS §5)
- [x] T031 [US4] Teste de integração (Postgres efêmero, `INTEGRATION_*`) em `src/__tests__/integration/`: 2 tenants semeados → cada contagem do dashboard só enxerga o próprio `org_id` (Empresas/PGRs/Equipe/EPIs-abaixo-da-mínima), provando isolamento (Princípio I / FR-009 / SC-005)
- [ ] T032 [US4] Verificação visual `/dashboard` vs `dashboard.dc.html` nos 3 breakpoints (KPIs reais + empty-states)

**Checkpoint**: dashboard operacional com dados reais e ausências honestas

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: telas Clerk, telas sem mockup e gate final

- [x] T033 [P] Auth: envolver `<SignIn/>`/`<SignUp/>` na moldura de `login.dc.html` (split 1fr/1fr) + `appearance` do Clerk em `src/app/(public)/sign-in/[[...sign-in]]/page.tsx` e `src/app/(public)/sign-up/[[...sign-up]]/page.tsx` (não reimplementar auth; FR-010)
- [x] T034 [P] Onboarding: moldura de `primeiros-passos.dc.html` + `appearance` do Clerk em `src/app/(protected)/onboarding/page.tsx` (`CreateOrganization`/`OrganizationList`)
- [ ] T035 [P] Telas sem mockup (`/risk-methodology`, `/risks` +sub, `/signatures`, `/epi-returns`): checagem de responsividade/consistência com as primitives nos 3 breakpoints (sem `.dc.html` para comparar)
- [x] T036 Conformidade final dos contratos: revisar C-TOK-_, C-NAV-_, C-SCR-\* e a lista de aceite do `quickstart.md`. Checagens concretas: (a) `git diff --stat` sem alteração em `src/shared/db/schema/**` nem nova migration em `drizzle/**` (FR-014); (b) grep de novas rotas `src/app/(protected)/**/page.tsx` — nenhuma rota de módulo novo além de `/boas-vindas` (FR-013/SC-002); (c) grep C-TOK-1 (0 hex de cor fora de `globals.css`)
- [x] T037 Gate: `npm run check` (format:check + lint + typecheck + unit) verde e `npm run test:integration` (contagens) verde (SC-007)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: independente; recomendado antes das verificações visuais.
- **Foundational (Phase 2, T002–T003)**: **bloqueia tudo**. Nenhuma US começa antes.
- **US1 (P1)** e **US2 (P1)**: podem correr em paralelo após a fundação (arquivos distintos — `_ui`/telas vs. `(protected)/layout.tsx`). US1 é o **MVP**.
- **US3 (P2)**: após a fundação; independente (reusa lista de módulos). Idealmente após US2 para o item de menu.
- **US4 (P2)**: após a fundação; T028 (repo) independe; T029 depende de T028; T031 depende de T028/T029.
- **Polish (Phase 7)**: após as US relevantes; T037 é o último (gate).

### Dependências internas por história

- US1: T004–T009 (primitives/shell) antes de T010–T019 (telas herdam) antes de T020–T021 (verificação).
- US2: T022 (se criado) antes de T023 antes de T024.
- US3: T025 antes de T026/T027.
- US4: T028 antes de T029/T031; T030 independe; T032 após T029.

## Parallel Execution Examples

- **Fundação pronta → dois trilhos P1 em paralelo**: um dev/agent em US1 (T004–T008 juntos, pois são 5 arquivos distintos), outro em US2 (T022–T023).
- **US1 telas**: T010–T019 são todas `[P]` (diretórios de rota distintos) — rodam juntas após as primitives.
- **US4**: T028 e T030 `[P]` (repo vs. teste unitário) enquanto T029 aguarda T028.
- **Polish**: T033, T034, T035 `[P]` (superfícies distintas).

## Implementation Strategy

1. **MVP** = Phase 2 (fundação) + Phase 3 (US1). Entrega os cadastros com a nova identidade e, por
   cascata, o tema em todas as telas de CRUD. Demonstrável isoladamente.
2. **Incremento P1** = + US2 (mega-menu) — completa a experiência P1.
3. **Incremento P2** = + US3 (boas-vindas) e US4 (dashboard com dados) — em qualquer ordem.
4. **Fechamento** = Polish (Clerk/telas sem mockup) + gate `npm run check`/integração verde.

Regra de ouro da fatia: **nunca inventar dado** (widgets sem fonte → empty-state do mockup) e **nenhuma
rota nova de módulo de negócio** além de `/boas-vindas`.

> **Verificação visual pendente (manual)**: T001, T020, T027, T032 e T035 exigem `npm run dev`
> **+ sessão autenticada no Clerk** para alcançar as telas protegidas e comparar com os `.dc.html`
> em 375/768/1440px (Playwright MCP), conforme `quickstart.md`. Todo o restante (código, tokens,
> mega-menu, contagens, telas Clerk) está implementado e o gate `npm run check` está verde.
