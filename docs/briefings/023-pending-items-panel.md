# Briefing — Fatia 023: Painel de pendências e vencimentos

**Issue**: #61 · `[Fase 07] 05 · Painel de pendências e vencimentos`
**Branch**: `feature/023-pending-items-panel` (base: `develop`, com #47 mergeada)
**Data**: 2026-07-14

## 1. A task

Tela transversal (`/pendencias`) que reúne o que precisa de atenção — treinamentos vencidos/a vencer,
EPIs a devolver, PGRs vencidos, controles em atraso, EPIs abaixo do mínimo — agrupado por tipo, cada
item com link para a origem. Escopado ao tenant. **Sem tabelas novas.**

## 2. Decisão de escopo

Duas categorias já têm **página dedicada** que lista os itens em detalhe: treinamentos (`/training-expiry`)
e devoluções de EPI (`/epi-returns`). Para não duplicar essas queries, o painel:

- Mostra a **contagem** de todas as 6 categorias (reusa `pending` do `getDashboardSummary` da #47).
- Renderiza **listas inline (top 5)** das 3 categorias **sem tela própria** — PGRs vencidos, controles
  em atraso, EPIs abaixo do mínimo — cada item linkando à origem (`/pgr/{id}`, `/risks/{riskId}`,
  `/epi-stock`).
- Para treinamentos e devoluções, um link "ver todos →" para a tela dedicada.

## 3. Implementação (as-built)

- **`repositories/pending-items.ts`** `getPendingItems(orgId)`: 1 `withOrg` com 3 queries (join +
  `action_deadline`/`valid_until`/`balance < min` + `order by` + `limit 5`), **filtro `org_id`
  explícito**. Data via `todayInSaoPaulo()`.
- **Tipos** em `domains/platform/pending-items.ts` (client-safe — a página importa de lá, não do
  repositório, respeitando a regra de não vazar Drizzle pro bundle).
- **Superfícies**: Server Action `getPendingItemsAction` + REST `GET /api/v1/pending-items` + docs +
  Postman.
- **Página** `/pendencias`: contagens (summary) + listas inline (pending-items) + links; estado vazio
  ("tudo em dia"); guard `requireOfficeStaffPage`; entrada no nav.
- **Testes**: **integração em Postgres efêmero** — semeia pendências vencidas em `org_a` e prova que
  `org_b` não as vê (isolamento). `typecheck`/`lint`/`build` verdes; `db:generate` "No schema changes".

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/023-pending-items-panel

Feature: Painel de pendências e vencimentos

CONTEXTO:
SST Manager — SaaS B2B de SST. Tela transversal que reúne pendências dos módulos, reusando as
agregações da fatia de dashboard. Seguir CLAUDE.md (read-model withOrg; Postgres efêmero nos testes).

User stories:
- (P1) Como gestor, quero ver tudo que está vencido ou a vencer em um só lugar.
- (P2) Como gestor, quero ir direto ao registro de origem de uma pendência.

Success criteria:
- O gestor identifica todas as pendências da empresa em uma única tela.

Edge cases:
- Organização sem pendências (estado vazio). Itens sem validade não contam como vencidos.

Restrições (constituição):
- Todas as consultas escopadas ao tenant ativo.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
