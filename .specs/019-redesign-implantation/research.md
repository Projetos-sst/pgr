# Research — Fase 0: Implantação do redesign visual

Todas as decisões de abordagem já vinham travadas do briefing
(`docs/briefings/briefing-redesign-implantation.md`). Este documento resolve os poucos pontos abertos
com valores concretos extraídos dos mockups e do código atual. **Nenhum NEEDS CLARIFICATION remanescente.**

---

## D1 — Tokens de fundação visual (`@theme inline`)

**Decision**: Extrair os tokens abaixo (medidos em `dashboard.dc.html`/`login.dc.html`) para o bloco
`@theme inline` de `src/app/globals.css`. Nenhuma página/componente usa hex cru.

| Token (proposto)         | Valor do mockup                                                          | Uso                                       |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------- |
| `--color-primary`        | `#5b63f5`                                                                | cor primária (indigo), CTAs, links ativos |
| `--color-primary-strong` | `#4f46e5`                                                                | hover/estado escuro                       |
| `--color-primary-ring`   | `rgba(91,99,245,.12)`                                                    | anel de foco / borda interna sutil        |
| `--color-bg`             | `#eae9e8`                                                                | fundo da aplicação (neutro quente)        |
| `--color-surface`        | `#ffffff` / glass                                                        | superfície de card                        |
| `--color-text`           | `#1b1f2e`                                                                | texto primário                            |
| `--color-text-muted`     | `#52576e`                                                                | texto secundário                          |
| `--color-text-subtle`    | `#8c91a8`                                                                | texto terciário/placeholder               |
| `--color-accent-green`   | `#0e9f6e`                                                                | badges de sucesso/positivo                |
| `--color-accent-amber`   | `#f5a524`                                                                | badges de alerta                          |
| `--radius-card`          | `12px` (11–15 no mockup)                                                 | cards/inputs                              |
| `--radius-pill`          | `30px`                                                                   | CTAs primários (pílula)                   |
| `--shadow-card`          | `0 14px 34px rgba(50,55,100,.16), inset 0 1px 1px rgba(255,255,255,.85)` | cards glass                               |
| `--shadow-primary`       | `0 8px 20px rgba(91,99,245,.35)`                                         | botão primário                            |

**Rationale**: ponto único de verdade visual (decisão #3 do briefing) — evita hex espalhado e permite
que as primitives consumam `var(--color-*)` via utilitários Tailwind v4 (`bg-primary`, etc.).

**Alternatives considered**: (a) copiar os inline styles dos `.dc.html` — rejeitado: são protótipos de
design-comp, não seguem Tailwind nem as primitives; (b) usar um `tailwind.config` — impossível/rejeitado:
Tailwind v4 é CSS-first, sem config JS (constituição).

**Nota sobre tema claro único**: `globals.css` já neutraliza o `dark:` via
`@custom-variant dark (&:where(.dark, .dark *))`. Mantido — a fatia entrega **um** tema claro; as
classes `dark:` espalhadas nas primitives ficam inertes (não removê-las agora evita ruído de diff, mas
o restyle deve garantir contraste correto no tema claro independentemente delas).

---

## D2 — Tipografia

**Decision**: Trocar **Geist Sans → Manrope** e **Geist Mono → JetBrains Mono**, ambos via
`next/font/google` em `src/app/layout.tsx`, mapeados para `--font-sans`/`--font-mono` no `@theme`. Remover
o `font-family: Arial` hardcoded do `body` em `globals.css` (passa a herdar `--font-sans`).

**Rationale**: fidelidade ao mockup (`font-family:'Manrope'` e `'JetBrains Mono'` confirmados em
`dashboard.dc.html`). Mesmo mecanismo `next/font/google` já usado (zero dependência nova de categoria).

**Alternatives considered**: manter Geist Mono para os poucos usos monospace — rejeitado: diferença
visual perceptível nos badges/valores numéricos do dashboard; o custo de trocar é trivial.

---

## D3 — 4º KPI do dashboard (slot que no mockup era "OS Funcional")

**Decision**: **"EPIs abaixo da mínima"** — `COUNT` de itens de `epi_stock` com `balance < min_quantity`,
escopado por tenant. Os outros 3 KPIs: **Empresas** (`companies`), **PGRs** (`pgr`), **Equipe**
(`employees`).

**Rationale**: é uma métrica **real, acionável e já modelada** — o schema tem `balance` e `min_quantity`
(`epis.ts`), e o domínio já define `computeEpiStockStatus` com o estado `abaixo_minima`
(`domains/pgr/epi-stock.ts`). Contagem simples com `WHERE`, sem lógica de negócio nova. Nunca inventa OS.

**Alternatives considered**: (a) total do catálogo de EPI — rejeitado: menos acionável; (b) inventar
métrica de OS — proibido (FR-008); (c) deixar o slot vazio — desperdiça um KPI com dado real disponível.

---

## D4 — Widgets de gráfico do dashboard (grid inferior)

**Decision**: Usar **empty-state do próprio mockup** (ícone "i" + frase) para os widgets cujas agregações
não existem prontas: Status/Tipo de OS e Categorias de Incidentes (módulos inexistentes) e também
**Riscos por Categoria** e **Planos de Ação** — pois os repositórios `risks.ts`/`control-measures.ts` só
expõem `list...`/`total`, sem agregação por categoria/status. Nenhuma agregação nova entra nesta fatia.

**Rationale**: regra "nunca inventar dado" (FR-008) + YAGNI (agregações são lógica de negócio nova, fora
de escopo). O empty-state do mockup já resolve visualmente a ausência.

**Alternatives considered**: implementar agregação por categoria de risco agora — rejeitado: é lógica de
negócio nova (escopo de fatia futura), viola o limite "só contagens simples" (FR-014).

---

## D5 — Navegação (mega-menu)

**Decision**: Reorganizar a nav plana atual (14 links em `(protected)/layout.tsx`) em **mega-menu por
categoria** — **Módulos / Cadastro / Gestão / Qualidade** (categorias confirmadas em `dashboard.dc.html`)
— listando **somente rotas implementadas**. Mapa proposto no contrato `contracts/navigation.md`. Colapso
mobile (375px) via componente client dedicado se o CSS puro não bastar.

**Rationale**: decisão #5 do briefing; não expor no menu real telas de módulos que não existem (o mockup
lista telas inexistentes — filtrá-las).

**Alternatives considered**: manter lista plana só reestilizada — rejeitado: diverge do mockup e não
escala com o crescimento de módulos.

---

## D6 — Telas Clerk (login, cadastro, onboarding)

**Decision**: Envolver `<SignIn/>`/`<SignUp/>`/`<CreateOrganization/>`/`<OrganizationList/>` na **moldura**
dos mockups (`login.dc.html` split 1fr/1fr; `primeiros-passos.dc.html`) e customizar cor/fonte/raio via a
prop **`appearance`** do Clerk (`ClerkProvider` e/ou por componente). Não reimplementar autenticação.

**Rationale**: decisões #6 e #9 do briefing; Clerk é o provedor (Princípio II/estack fixa). `appearance`
cobre a superfície visual do form embutido; a moldura (painel lateral) é markup nosso.

**Alternatives considered**: form de auth próprio estilizado 1:1 — rejeitado: reimplementaria auth, risco
de segurança e retrabalho, fora de escopo.

---

## D7 — Verificação de fidelidade

**Decision**: Por tela com mockup: abrir `.dc.html` via Playwright MCP (`file://`) e a página real
(`npm run dev`), screenshot em **375/768/1440px**, revisão visual lado a lado antes de concluir. Telas sem
mockup: só checagem de responsividade/consistência com as primitives nos 3 breakpoints. Sem diff de pixel.

**Rationale**: decisão #10 do briefing; julgamento visual é suficiente (dados reais vs. mock sempre
divergem do protótipo estático); não há infra de regressão visual e introduzir uma está fora de escopo.

**Alternatives considered**: snapshot/pixel-diff automatizado (ex.: Playwright toHaveScreenshot) —
rejeitado: atrito de setup e flakiness sem ganho proporcional para esta fatia.

---

## Resumo de impacto em dados/testes

- **Schema/migration**: nenhum.
- **Leitura nova**: 4 contagens tenant-escopadas (3 reaproveitam `total`/list existente; "EPIs abaixo da
  mínima" pode exigir 1 helper `countEpiStockBelowMinimum(orgId)` no padrão `withOrg`).
- **Testes**: unit para helper puro de KPI (se extraído); integração (Postgres efêmero) provando que
  cada contagem só enxerga o próprio tenant. Gate final: `npm run check` verde.
