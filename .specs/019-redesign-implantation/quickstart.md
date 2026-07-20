# Quickstart — Implantação do redesign visual

Como validar a fatia localmente. É majoritariamente CSS/markup + navegação + 4 contagens de dashboard.

## Pré-requisitos

- `npm install` feito; `.env.local` com credenciais de dev (Clerk + `DATABASE_URL`).
- Para os testes de integração: um **Postgres efêmero** com `INTEGRATION_DATABASE_URL` (o projeto não
  usa SQLite — ver CLAUDE.md).

## Rodar

```bash
npm run dev          # http://localhost:3000
```

## Ordem de implementação (P1 → P2)

1. **Fundação** (bloqueante): tokens `@theme` em `globals.css` + fontes Manrope/JetBrains Mono em
   `layout.tsx` + remover `font-family: Arial`.
2. **Primitives** `_ui/{list,form,field-hint,confirm-delete-button,address-fields}.tsx` — restyle
   consumindo os tokens. (Cascateia para ~13 telas sem mockup.)
3. **Shell**: header raiz (`layout.tsx`) + nav protegida (`(protected)/layout.tsx`) → mega-menu
   (contrato `contracts/navigation.md`).
4. **Telas com mockup direto**: ajuste fino 1:1 (contrato `contracts/screen-mockup-map.md`).
5. **P2** — `/boas-vindas` (reusa lista de módulos de hoje) + `/dashboard` rebuild (4 KPIs reais +
   widgets empty-state) + Clerk moldura/`appearance` (login/cadastro/onboarding).

## Verificação visual (por tela com mockup)

Para cada tela do contrato `screen-mockup-map.md`:

```
1. Playwright MCP → abrir file:///…/sst-project/redesign/<mockup>.dc.html
2. Playwright MCP → abrir http://localhost:3000/<rota>
3. Screenshot dos dois em 375px, 768px e 1440px (browser_resize + browser_take_screenshot)
4. Revisão lado a lado: paleta, tipografia, cards/glass, espaçamento, responsividade
5. Só marcar a tela como concluída quando aprovada nos 3 breakpoints
```

Telas sem mockup (`risk-methodology`, `risks`, `signatures`, `epi-returns`): repetir só os passos 2–4,
validando consistência com as primitives (não há `.dc.html` para comparar).

## Checagens automáticas (gate)

```bash
npm run check              # format:check + lint + typecheck + unit — MUST verde (SC-007)
npm run test:integration   # se houver contagem nova de dashboard: prova isolamento multi-tenant
```

- **Unit**: helper puro de KPI (se extraído, ex.: derivar "abaixo da mínima").
- **Integração** (Postgres efêmero): com 2 tenants semeados, cada contagem do dashboard só enxerga o
  próprio `org_id` (Empresas/PGRs/Equipe/EPIs-abaixo-da-mínima) — nunca vaza entre orgs.
- **Grep de conformidade** (`contracts/design-tokens.md` C-TOK-1): 0 hex de cor em UI fora de
  `globals.css`.

## Critérios de "pronto" (resumo)

- [ ] Tokens no `@theme`; sem hex cru em páginas/componentes.
- [ ] 5 primitives + shell restilados; CRUDs herdam sem mudança de import.
- [ ] Mega-menu por categoria, só rotas reais (contrato de navegação).
- [ ] Telas com mockup aprovadas nos 3 breakpoints.
- [ ] `/boas-vindas` existe (layout `home.dc.html`), separada do `/dashboard`.
- [ ] Dashboard: 4 KPIs reais + empty-state onde não há dado; contagens isoladas por tenant.
- [ ] Login/cadastro/onboarding com Clerk funcional + moldura + `appearance`.
- [ ] `npm run check` verde.
