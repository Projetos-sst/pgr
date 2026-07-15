# Briefing — Fatia 022: Dashboard principal (KPIs e gráficos)

**Issue**: #48 · `[Fase 07] 07 · Dashboard principal (KPIs e gráficos)`
**Branch**: `feature/022-main-dashboard` (base: `develop`, já com a #47 mergeada)
**Data**: 2026-07-14

## 1. A task

Tela inicial (`/dashboard`) com KPIs, gráficos e pendências da organização ativa, consumindo o
read-model da fatia #47 (`getDashboardSummary`). Visão geral em poucos segundos.

## 2. Decisões

- **Gráficos = barras CSS puras** (divs com `width %`), **sem adicionar lib de chart**. O repo não tem
  Recharts/Chart.js; introduzir uma agora seria dependência nova sem necessidade (YAGNI). Um gráfico de
  barras horizontal cobre bem "por agente" e "por nível". Lib de chart fica como melhoria futura.
- **Escopo MVP (P1)**: KPIs + 2 gráficos + painel de pendências com links para a origem + estados
  vazios + responsivo. Consome `getDashboardSummaryAction` (já testado na #47).
- **Adiado (sinalizado)**: "Personalizar Visão" (widgets persistidos por usuário — exigiria
  tabela/coluna de preferências) e "filtro por empresa (Ativos/Inativos)" (o summary é org-wide;
  `companies` não tem status ativo/inativo no schema). São P2/P3 e viram follow-up.

## 3. Implementação (as-built)

- **`domains/platform/dashboard.ts`**: `withBarPercents` (puro — percentual relativo ao maior valor,
  sem divisão por zero).
- **`app/(protected)/dashboard/_components/dashboard-widgets.tsx`**: `StatCard`, `BarChart`,
  `PendingPanel` (server components, display-only).
- **`app/(protected)/dashboard/page.tsx`**: substitui o placeholder — guard `requireOfficeStaffPage`,
  KPIs (6 cards com link), 2 gráficos (`withBarPercents`), painel de pendências (6 indicadores →
  `/pgr`, `/risks`, `/epi-stock`, `/epi-returns`, `/training-expiry`), estado vazio, atalhos.
- **Sem novo recurso HTTP** (consome `/api/v1/dashboard/summary` da #47) → nada a mudar em
  api-design/Postman. **Zero migration.**
- **Testes**: unit de `withBarPercents` (percentuais + série zerada). Suite 566/566.
  `typecheck`/`lint`/`build` verdes.

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/022-main-dashboard

Feature: Dashboard principal (KPIs e gráficos)

CONTEXTO:
SST Manager — SaaS B2B de SST. Fatia de tela que consome o read-model da agregação (#47). Seguir
CLAUDE.md (Server Component + _ui; sem dependência de chart nova).

User stories:
- (P1) Como gestor, quero ver KPIs e gráficos da empresa ao entrar.
- (P2) Como gestor, quero escolher quais widgets exibir. [adiado — persistência de preferência]
- (P3) Como gestor, quero filtrar por empresa. [adiado — sem status ativo/inativo no schema]

Success criteria:
- O gestor entende a situação geral em poucos segundos.
- Todos os KPIs/gráficos com dado modelado aparecem; estado vazio tratado.

Edge cases:
- Organização recém-criada sem dados (tudo zero). Tela pequena (responsiva).

Restrições (constituição):
- Indicadores escopados ao tenant ativo. Sem infra nova (barras CSS, sem lib de chart).

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
