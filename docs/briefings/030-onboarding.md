# Briefing — Fatia 030: Onboarding guiado (primeiros passos)

**Issue**: #90 · `[Fase 07] 10 · Primeiros passos / onboarding guiado`
**Branch**: `feature/030-onboarding` (base: `develop`)
**Data**: 2026-07-15

## 1. A task

Experiência de onboarding para novos usuários: boas-vindas + guia de primeiros passos com progresso.

## 2. Decisão de escopo

- **Progresso DERIVADO dos dados reais** (não persistido): um passo está "concluído" quando o dado
  correspondente existe (empresa cadastrada → `companies > 0`, etc.). Mais significativo que um checkbox
  manual e **sem tabela/coluna nova** (KISS). Reusa `getDashboardSummary` (fatia 021).
- **MVP** = tela de primeiros passos (`/primeiros-passos`): saudação + barra de progresso + lista de
  passos (na ordem da cadeia do PGR) com link "Começar"/estado "Concluído" + ações rápidas.
- **Fora do MVP (sinalizado)**: cards de novidades, tutoriais no YouTube e o **manual de onboarding em
  PDF** — este último já está **registrado como tipo de relatório** (`onboarding-manual`, planejado) na
  fatia 026, plugável no `reports-core` quando o Gotenberg estiver ativo.

## 3. Implementação (as-built)

- **`domains/platform/onboarding.ts`**: `ONBOARDING_STEPS` + `deriveOnboardingProgress(kpis)` (puro) →
  passos com `done`, `completed/total/percent`, `allDone`.
- **Server Action** `getOnboardingProgressAction` + **REST** `GET /api/v1/onboarding` (ambos derivam de
  `getDashboardSummary`) + docs + Postman.
- **UI** `/primeiros-passos`: saudação com nome da org, barra de progresso, passos (✓/número + link),
  ações rápidas; entrada no nav. **Zero migration.**
- **Testes**: unit de `deriveOnboardingProgress` (vazio → 0%, parcial, tudo → 100%). A agregação por
  trás já é coberta por integração na fatia 021. `typecheck`/`lint`/`build` verdes.

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/030-onboarding

Feature: Onboarding guiado / primeiros passos

CONTEXTO:
SST Manager — SaaS B2B de SST. Guia de primeiros passos com progresso DERIVADO dos dados do tenant
(sem persistência). Seguir CLAUDE.md.

User stories:
- (P1) Como novo usuário, quero um guia de primeiros passos para configurar minha organização.
- (P2) Como usuário, quero ver meu progresso e ir direto ao próximo passo.

Success criteria:
- O usuário entende o que fazer primeiro e acompanha o progresso sem suporte.

Edge cases:
- Organização recém-criada (0%). Organização já configurada (100%).

Restrições (constituição):
- Escopado ao tenant ativo. Sem tabela nova (progresso derivado dos KPIs).

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
