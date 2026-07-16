# Briefing — Fatia 021: Queries de agregação do dashboard

**Issue**: #47 · `[Fase 07] 06 · Queries de agregação do dashboard`
**Branch**: `feature/021-dashboard-aggregation-queries` (base: `develop`)
**Data**: 2026-07-14

> Hints da issue desatualizados (`features/dashboard/queries.ts`, SQLite). Segue o CLAUDE.md:
> repositório read-model em `src/shared/db/repositories/`, `withOrg` + RLS, integração em Postgres efêmero.

## 1. A task

Camada de leitura (read-model, **sem tabelas novas**) que alimenta os KPIs, gráficos e indicadores de
vencimento do dashboard, **tudo escopado ao tenant ativo**. É backend puro (consumido pela fatia #48).

## 2. Escopo REAL (só o que tem dado)

Levantamento do schema confirmou que **OS Funcional, Incidentes-evento e Monitoramento Psicossocial
NÃO existem** (sem tabela/módulo). "Acidentes" e "psicossocial" existem apenas como grupos de
`risks.agent_type`. Portanto:

- **KPIs**: Empresas, Funcionários, Unidades de obra, GES, Riscos, PGRs.
- **Gráficos**: Riscos por agente (**7 grupos** — inclui `accident`/`psychosocial`), Planos de ação por
  nível de controle NR-01 (`control_measures` aplicáveis).
- **Pendências/vencimentos**: PGRs vencidos (`valid_until < hoje`), controles em atraso
  (`applicable AND action_deadline < hoje`), EPIs abaixo do mínimo (`balance < min_quantity`), EPIs a
  devolver (`epi_delivery_items.returned_at IS NULL` em entregas assinadas), treinamentos vencidos/a
  vencer (**reusa** `getTrainingDueSummary`).
- **Fora (sinalizado)**: OS, Incidentes-evento, Psicossocial-monitoramento — sem schema; só entram como
  contagem de `agent_type`.

## 3. Implementação (as-built)

- **Domínio** `domains/platform/dashboard.ts`: tipos (`DashboardSummary`) + `zeroFillCounts` (puro,
  garante 1 linha por grupo do enum) + `fillRisksByAgentType`/`fillActionPlansByLevel` (reusam
  `riskAgentTypeLabel`/`controlLevelLabel`).
- **Repositório** `repositories/dashboard.ts`: `getDashboardSummary(orgId)` — 1 `withOrg` com
  `count(*)::int` / `group by` / joins, **todas filtrando `org_id` explicitamente** (defesa em
  profundidade sobre o RLS). Datas via `todayInSaoPaulo()`.
- **Superfícies**: Server Action `getDashboardSummaryAction` (`officeAction`) + REST
  `GET /api/v1/dashboard/summary` (`restHandler`) — ambos chamam o mesmo repositório. Docs + Postman.
- **Testes**: unit do `zeroFillCounts`/zero-fill dos 7 grupos + ordem dos níveis; **integração em
  Postgres efêmero** provando isolamento (summary de `org_a` não conta dados de `org_b`; pendências de
  EPI só no tenant certo). Tabelas do dashboard são `withOrg`/Drizzle → integração real (diferente da
  fatia 020, cujas tabelas de identidade ficam fora desse caminho).
- **Gates**: `typecheck` · `lint` · `test` · `build` · `db:generate` "No schema changes" (zero migration).

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/021-dashboard-aggregation-queries

Feature: Queries de agregação do dashboard

CONTEXTO:
SST Manager — SaaS B2B de SST. Fatia própria (backend read-model, sem tabelas novas). Seguir
CLAUDE.md (repositório com withOrg + RLS; Postgres efêmero nos testes — nunca SQLite).

User stories:
- (P1) Como sistema, preciso de agregações por organização para alimentar KPIs e gráficos.
- (P2) Como sistema, preciso de indicadores de vencimentos/pendências para o painel de alertas.

Success criteria (agnósticos):
- Indicadores de uma empresa nunca incluem dados de outra.
- Todo KPI/gráfico com dado modelado tem query correspondente (OS/Incidentes/Psicossocial não têm
  schema → só contagem por agent_type).

Edge cases:
- Organização recém-criada sem dados (tudo zero). Itens sem validade não contam como vencidos.

Restrições (constituição):
- Todas as agregações escopadas ao tenant ativo (orgs.id da sessão).

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
