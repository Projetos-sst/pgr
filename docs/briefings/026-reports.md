# Briefing — Fatia 026: Relatórios

**Issue**: #83 · `[Fase 07] 04 · Relatórios`
**Branch**: `feature/026-reports` (base: `develop`)
**Data**: 2026-07-14

## 1. A task

Geração de relatórios/arquivos consolidados da organização (PDF), com infraestrutura de geração
reutilizável pelos módulos. Escopado ao tenant.

## 2. Decisão (com o usuário)

**Gotenberg não está confirmado no ar** → entrego a **infraestrutura** e um relatório demonstrável,
com o PDF **atrás de env** (`GOTENBERG_URL`/`GOTENBERG_TOKEN`). Sem configuração, a geração retorna
`REPORT_UNAVAILABLE` (503) e a UI mostra aviso — a estrutura liga sozinha quando o serviço existir.
Ampara-se na **emenda 1.4.0** da constituição (Gotenberg autorizado sob salvaguardas).

## 3. Implementação (as-built)

- **`integrations/pdf/config.ts`** (server-only): lê `GOTENBERG_URL`/`GOTENBERG_TOKEN`;
  `isPdfGenerationEnabled()`. Segredo só em env.
- **`integrations/pdf/gotenberg.ts`** (server-only): `htmlToPdf(html)` — **ponto único de rede**
  (POST `/forms/chromium/convert/html`, `Authorization: Bearer`); ausente/falho → `ReportUnavailableError`
  (503, sem vazar detalhe do provedor). Stateless: retorna o PDF, não persiste.
- **`domains/platform/reports.ts`**: registro de tipos (`organization-summary` disponível;
  `esocial-events`/`onboarding-manual` planejados) + `buildOrgSummaryHtml` (puro — HTML com escape,
  montado no servidor **após** o gate de tenant → Princípio I).
- **`server/platform/reports-core.ts`**: `generateReport(orgId, orgName, type)` — resumo da org
  (`getDashboardSummary` → HTML → `htmlToPdf`); tipo inexistente → `NOT_FOUND`; planejado/ausente →
  `REPORT_UNAVAILABLE`.
- **REST** `GET /api/v1/reports/{type}` — resposta **binária** `application/pdf` (não usa `restHandler`
  por isso); erros conhecidos como JSON. Novo código `REPORT_UNAVAILABLE` (503) em `rest.ts`.
- **UI** `/relatorios`: cards dos tipos; "Gerar PDF" (link de download) quando disponível **e**
  configurado; "Em breve" nos planejados; banner quando o PDF não está configurado. Entrada no nav.
  `.env.example` com `GOTENBERG_URL`/`GOTENBERG_TOKEN`.
- **Testes**: unit (registro + `buildOrgSummaryHtml`: KPIs, data, **escape anti-injeção**). A rede
  (Gotenberg) é isolada e não é chamada nos testes. `typecheck`/`lint`/`build` verdes; zero migration.

## 4. Follow-up

Ligar o Gotenberg (deploy + `GOTENBERG_URL`/token) habilita o PDF ponta-a-ponta sem mudança de código.
Relatórios `esocial-events` e `onboarding-manual` são plugados no mesmo `reports-core` quando modelados.

## 5. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/026-reports

Feature: Relatórios

CONTEXTO:
SST Manager — SaaS B2B de SST. Infraestrutura de geração de PDF (Gotenberg, emenda 1.4.0)
reutilizável + relatório de resumo da organização. Seguir CLAUDE.md (segredo server-only;
geração isolada; PDF atrás de env enquanto o serviço não está no ar).

User stories:
- (P1) Como gestor, quero gerar e baixar um relatório consolidado da organização.
- (P2) Como gestor, quero que a infraestrutura de PDF seja reutilizável pelos módulos.

Success criteria:
- O relatório é gerado com os dados corretos da organização e baixado.
- Falha/ausência do serviço não quebra a página (aviso claro).

Edge cases:
- Serviço de PDF indisponível/timeout. Organização sem dados.

Restrições (constituição):
- Escopado ao tenant. Segredo do Gotenberg só no servidor (emenda 1.4.0). HTML montado após checar o tenant.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
