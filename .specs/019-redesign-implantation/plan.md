# Implementation Plan: Implantação do design system do redesign visual

**Branch**: `feature/redesign-implantation` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/019-redesign-implantation/spec.md`

**Fonte da verdade do "como"**: `docs/briefings/briefing-redesign-implantation.md` (decisões travadas de
brainstorming) + `docs/briefings/redesign-backlog-telas.md` (telas fora de escopo).

## Summary

Fatia de **design/UI transversal**: aplicar o sistema visual dos mockups `sst-project/redesign/*.dc.html`
(indigo `#5b63f5`, Manrope + JetBrains Mono, cards glass/blur, raio 11–13px, sombras suaves) às telas
**já implementadas** do sst-manager, que hoje não têm tema (fundo/foreground preto-branco, fonte Arial).

Abordagem técnica: extrair a fundação visual para tokens no bloco `@theme inline` de
`src/app/globals.css` + trocar a fonte via `next/font/google` (Geist→Manrope; Geist Mono→JetBrains
Mono), depois restylar as **5 primitives** de `src/app/(protected)/_ui/` e o **shell** (header raiz +
nav protegida → mega-menu por categoria). Como toda tela de CRUD renderiza por essas primitives, o tema
cascateia para ~13 telas sem trabalho individual. Telas com mockup direto recebem ajuste 1:1; o
dashboard vira KPI cards (4 contagens reais, tenant-escopadas) + widgets em empty-state onde não há
dado; nova rota `/boas-vindas` reaproveita a lista de módulos de hoje sob o layout de `home.dc.html`.
Auth/onboarding (Clerk) recebem moldura do mockup + `appearance`, sem reimplementar autenticação.
Verificação por comparação visual (Playwright MCP) tela-real vs. `.dc.html` em 375/768/1440px.

Sem migration, sem mudança de RLS/schema/contrato de Server Actions. A única lógica nova são
**contagens simples** (COUNT tenant-escopado) para os 4 KPIs do dashboard.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16.2.6 (App Router), React 19.2.4

**Primary Dependencies**: Tailwind CSS v4 (CSS-first, `@theme inline`), `next/font/google` (Manrope +
JetBrains Mono), Clerk (`appearance` prop para telas embutidas), Drizzle ORM (só leitura/COUNT nesta fatia)

**Storage**: Supabase Postgres — **sem alteração de schema**. Leituras de contagem via repositórios
existentes, escopadas por `withOrg` (RLS backstop `app.current_org`)

**Testing**: Jest (unit, jsdom) + integração (Postgres efêmero, `INTEGRATION_*`); verificação visual
manual via Playwright MCP (não automatizada). Gate: `npm run check` (format:check + lint + typecheck + unit)

**Target Platform**: Web (Vercel serverless), navegadores modernos; responsivo 375/768/1440px

**Project Type**: Web application (Next.js fullscreen unificado — Server Components/Actions + Route Handlers)

**Performance Goals**: N/A específico — fatia de apresentação. Dashboard não pode introduzir query pesada
(contagens simples indexadas por `org_id`)

**Constraints**: nenhum hex cru fora de `@theme`; nenhuma tela nova de módulo além de `/boas-vindas`;
nenhum item de menu para rota inexistente; nunca exibir dado fictício; tema claro único (o `dark:` do
projeto é inerte por `@custom-variant dark`); isolamento multi-tenant nas contagens

**Scale/Scope**: ~16 telas com mockup direto (+ formulários) + ~13 telas herdando o restyle via
primitives; 5 primitives `_ui` + 2 arquivos de shell; 1 rota nova (`/boas-vindas`); 1 rebuild
(`/dashboard`)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                       | Situação           | Nota                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento Multi-Tenant (não-negociável)** | ✅ PASS            | Contagens do dashboard passam por `withOrg` + RLS. Nenhuma leitura de negócio sem filtro de tenant. Nenhuma tabela nova.                                                                                                                    |
| **II. Stack Fixa & YAGNI**                      | ✅ PASS            | Zero nova infra. Manrope/JetBrains Mono usam o mesmo `next/font/google` já no projeto (não é serviço externo pago). Tailwind v4 `@theme` já é a stack. Escopo restrito ao redesign do que existe; backlog fica documentado, não codificado. |
| **III. Fatias Verticais**                       | ✅ PASS (com nota) | Fatia transversal de design (não um módulo de negócio), mas testável/demonstrável isoladamente e entregue no ciclo Spec Kit. P1 (fundação + primitives + nav) funcional antes de P2 (boas-vindas, KPIs).                                    |
| **IV. Operações Pesadas Assíncronas**           | ✅ N/A             | Nenhuma operação pesada; contagens são leituras rápidas síncronas.                                                                                                                                                                          |
| **V. Segurança & Integridade**                  | ✅ PASS            | TS `strict` mantido, sem `any`. Sem mudança de schema/constraint. Contagens são reads validadas por tenant; sem segredo novo.                                                                                                               |

**Testing gate**: se as contagens forem novas funções de repositório, exigem teste de integração
(Postgres efêmero) provando que a contagem **não vaza entre orgs** (Princípio I) — o projeto não usa
SQLite (ver CLAUDE.md). Qualquer helper puro de agregação (ex.: derivar "abaixo da mínima") ganha unit
test. **Nenhuma violação a justificar** → Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/019-redesign-implantation/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (/speckit-specify)
├── research.md          # Fase 0 — decisões de fundação visual, fontes, KPIs, verificação
├── data-model.md        # Fase 1 — read model das contagens (sem entidade nova)
├── quickstart.md        # Fase 1 — workflow de verificação visual + gate
├── contracts/
│   ├── design-tokens.md        # tokens @theme (cor/raio/sombra/fonte) — contrato de fundação
│   ├── navigation.md           # contrato do mega-menu (categorias × rotas reais)
│   └── screen-mockup-map.md    # contrato tela↔mockup↔breakpoints (critério de aceite visual)
└── checklists/
    └── requirements.md  # checklist de qualidade da spec (já criado)
```

### Source Code (repository root)

```text
src/app/
├── globals.css                         # [EDIT] fundação: @theme inline (cor/raio/sombra/fonte) + body
├── layout.tsx                          # [EDIT] fontes Manrope/JetBrains Mono; header restilizado
├── (public)/
│   ├── sign-in/[[...sign-in]]/page.tsx # [EDIT] moldura login.dc.html + Clerk appearance
│   └── sign-up/[[...sign-up]]/page.tsx # [EDIT] mesma moldura (reusa padrão do login)
└── (protected)/
    ├── layout.tsx                      # [EDIT] nav plana → mega-menu por categoria (só rotas reais)
    ├── _ui/
    │   ├── list.tsx                    # [EDIT] PageHeader/PrimaryLink/EmptyState/SearchForm/Pagination/Table
    │   ├── form.tsx                    # [EDIT] TextField/SelectField/SubmitButton/FieldError/FormError
    │   ├── field-hint.tsx              # [EDIT] estilo da dica
    │   ├── confirm-delete-button.tsx   # [EDIT] botão + modal
    │   └── address-fields.tsx          # [EDIT] campos de endereço
    ├── _components/                    # [MAYBE] mega-menu client component, se necessário (colapso mobile)
    ├── dashboard/page.tsx              # [REBUILD] KPI cards (4 counts reais) + widgets empty-state
    ├── boas-vindas/page.tsx            # [NEW] home.dc.html; reusa a lista de módulos de hoje
    ├── onboarding/                     # [EDIT] moldura primeiros-passos.dc.html + Clerk appearance
    └── (companies|work-units|job-roles|ges|employees|categories|epi-catalog|epi-stock|pgr|risks|…)
                                        # herdam o restyle via _ui — telas com mockup ganham ajuste fino 1:1

src/shared/db/repositories/            # [MAYBE EDIT] count helpers tenant-escopados p/ dashboard
├── companies.ts   (listCompanies já expõe total)
├── pgr.ts / employees.ts / epi-stock.ts (add countX(orgId) enxuto se `total` não bastar)

src/__tests__/                         # [ADD] unit (helper de KPI) + integração (contagem isolada por org)
```

**Structure Decision**: Web app Next.js único (já existente). A fatia concentra edições em `globals.css`

- `layout.tsx` (raiz) + `(protected)/layout.tsx` + 5 primitives `_ui` (a alavanca de cascata) e nos
  pontos de tela com mockup direto. Novidade estrutural mínima: rota `/boas-vindas` e, se preciso, um
  componente client de mega-menu para o colapso mobile. Contagens do dashboard reaproveitam repositórios
  existentes; helpers novos, se houver, seguem o padrão `withOrg`.

## Complexity Tracking

> Sem violações constitucionais. Nada a justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
