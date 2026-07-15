# Briefing — Fatia 024: Central de notificações

**Issue**: #81 · `[Fase 07] 02 · Central de notificações`
**Branch**: `feature/024-notifications-center` (base: `develop`, com #47 mergeada)
**Data**: 2026-07-14

## 1. A task

Central de alertas acionáveis da organização — prazos de planos de ação, EPIs abaixo da mínima,
documentos/treinamentos a vencer — com marcação de lido e badge de não lidas. Escopado ao tenant.

## 2. Decisão (com o usuário)

**Canal = in-app derivado (KISS, zero infra nova).** As notificações são **geradas sob demanda** das
mesmas contagens de vencimento do dashboard (`getDashboardSummary`), sem tabela e sem e-mail (e-mail
exigiria emenda de constituição). Consequência: o estado **"lido" é client-side** (localStorage,
per-browser) — não há histórico persistido. Badge de não lidas = total de alertas − lidos localmente.

## 3. Implementação (as-built)

- **`domains/platform/notifications.ts`**: `buildNotifications(pending)` (puro) — um alerta-resumo por
  categoria com contagem > 0, chave estável, link à origem, severidade (`high`/`medium`).
- **`server/platform/notifications-core.ts`**: `getNotifications(orgId)` = `getDashboardSummary` →
  `buildNotifications`. Server Action `listNotificationsAction` + REST `GET /api/v1/notifications`.
- **UI**: `/notificacoes` (lista + "marcar como lida"/"marcar todas") · `useReadNotifications`
  (`useSyncExternalStore` sobre localStorage — evita hydration mismatch e o `set-state-in-effect`) ·
  `NotificationsBell` no header (badge de não lidas, link à central).
- **Sem migration, sem tabela nova.** Docs + Postman. Reusa só o read-model já testado da #47.
- **Testes**: unit de `buildNotifications` (categorias > 0, chaves, severidade). A agregação por trás
  já é coberta por integração na #47. `typecheck`/`lint`/`build` verdes.

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/024-notifications-center

Feature: Central de notificações

CONTEXTO:
SST Manager — SaaS B2B de SST. Central de alertas derivada das pendências (sem persistência, KISS).
Seguir CLAUDE.md.

User stories:
- (P1) Como gestor, quero ver todos os alertas da organização em um lugar.
- (P2) Como gestor, quero ir direto à origem a partir de uma notificação.
- (P3) Como gestor, quero marcar notificações como lidas.

Success criteria:
- Todos os tipos de alerta relevantes são surfaceados sem visitar cada módulo.

Edge cases:
- Organização sem notificações (estado vazio).

Restrições (constituição):
- Escopado ao tenant ativo. Sem serviço externo novo (sem e-mail → sem emenda): canal in-app derivado.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
