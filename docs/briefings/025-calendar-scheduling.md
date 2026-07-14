# Briefing — Fatia 025: Agenda / agendamentos

**Issue**: #82 · `[Fase 07] 03 · Agenda / agendamentos`
**Branch**: `feature/025-calendar-scheduling` (base: `develop`)
**Data**: 2026-07-14

## 1. A task

Agenda dos compromissos de SST da organização — inspeções, treinamentos, exames médicos e vencimentos —
em visão lista, com CRUD manual, filtro por tipo/período e link à origem. Escopado ao tenant.

## 2. Decisão de escopo

- **MVP = visão lista + CRUD manual** (a issue sugere lista como MVP e calendário como incremento).
  Visão calendário fica como follow-up.
- **Eventos manuais persistidos** em tabela nova. A integração de "eventos virtuais" (vencimentos dos
  módulos aparecendo na agenda) fica como evolução — os vencimentos já são visíveis em Pendências (#61)
  e Notificações (#81); duplicá-los aqui agora seria redundante.

## 3. Implementação (as-built)

- **Migration `0018_schedule_events`**: tabela `schedule_events` (tenant) — `event_type` (enum
  `inspection/training/exam/document_expiry/other`), `title`, `event_date`, `description`,
  `reference_url` — com RLS `app_runtime`, GRANT e trigger `set_updated_at` (SQL custom, padrão do repo).
- **Domínio** `domains/platform/scheduling.ts`: `scheduleEventInputSchema` (Zod), rótulos pt-BR,
  `toScheduleEventListItem`.
- **Repositório** `repositories/schedule-events.ts`: CRUD completo com `withOrg` + `auditedTenantWrite`
  - paginação; filtros `eventType`/`from`/`to`. Espelha o padrão `companies`.
- **Superfícies (mandato de 4 partes)**: Server Actions (`officeAction`) + REST
  `/api/v1/schedule-events(/[id])` (`201`/`204`) + api-design + Postman.
- **UI**: `/agenda` (lista + filtro por tipo + paginação), `/agenda/new`, `/agenda/[id]/edit`,
  remoção inline; entrada no nav.
- **Testes**: unit (`scheduleEventInputSchema`, rótulos) + **integração em Postgres efêmero** (CRUD +
  isolamento cross-tenant: `org_b` não vê/atualiza/deleta evento de `org_a` + filtro por tipo).
  `typecheck`/`lint`/`build` verdes; `db:generate` "No schema changes".

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/025-calendar-scheduling

Feature: Agenda / agendamentos

CONTEXTO:
SST Manager — SaaS B2B de SST. CRUD de agendamentos com visão lista (MVP). Seguir CLAUDE.md
(tabela tenant com RLS/withOrg; Postgres efêmero nos testes).

User stories:
- (P1) Como gestor, quero ver todos os compromissos da empresa em um lugar.
- (P2) Como gestor, quero criar/editar agendamentos manuais.
- (P3) Como gestor, quero filtrar a agenda por tipo e período.

Success criteria:
- O gestor visualiza os eventos de SST sem consultar cada módulo.

Edge cases:
- Organização sem agendamentos (estado vazio).

Restrições (constituição):
- Escopado ao tenant ativo. Zod em toda Server Action.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
