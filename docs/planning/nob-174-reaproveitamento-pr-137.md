# NOB-174 — Reaproveitamento da PR #137 na develop

Comparação feita em 13/11/2026 entre `origin/develop` (`53c75d6`, migrations até 0082) e `origin/codex/alinhamento-questionario-expedito` (head da PR #137, commit `2709236e`). Só leitura de código: nada da #137 foi executado sobre a develop atual.

## Resumo

- O merge-base é `e6f2542` (merge da #121, migration 0059). A develop avançou 136 commits desde então.
- Quase todo o código de PGR da #137 está em um commit, o `2709236e`. Ele depende da pilha comercial simulada em dois pontos (`requirePgrBillingPreview` e `billing_trial_claims`), então não entra por cherry-pick.
- A #137 não tem nada para as NOB-176, 177, 178, 180, 181 e 182.
- **Decisão:** a pilha antiga não é integrada direto. Cada trecho aproveitável é reescrito sobre a develop, na issue correspondente, com migration nova a partir da 0083.

## Decisão por trecho de PGR

| Trecho da #137                                                                                             | Situação na develop                                                                            | Decisão                                                                                             | Issue             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------- |
| Menu: Incidentes/CAT e Psicossocial também em Medicina                                                     | Não existia                                                                                    | Reaproveitado, com a correção da DT-03 (menu reflete permissão)                                     | NOB-172, NOB-175  |
| Seleção de módulos no cadastro da empresa (`initialModules`, `moduleReason`)                               | Não existe; a develop liga o módulo depois do cadastro (`companies/[id]/services`)             | Reaproveitar com adaptação: gravar o evento com `app.current_actor`, exigido pelas policies da 0078 | NOB-175           |
| Revisão por documento (`pgr_document_approvals`, `document-approval-core.ts`, telas em `pgr/[id]/reviews`) | A develop só tem amostras e pareceres recebidos (`pgr_review_samples`, `pgr_review_decisions`) | Reaproveitar com adaptação, sem o código `billing`                                                  | NOB-179           |
| Revisor restrito (funções `add_restricted_pgr_reviewer` / `revoke_...`, `reviewer-account.ts`)             | Não existe                                                                                     | Reaproveitar o desenho; depende de conta Clerk real para homologar                                  | NOB-179, NOB-175  |
| Bloqueio da emissão por aprovação + hash do snapshot e do modelo                                           | Não existe                                                                                     | Reaproveitar com adaptação, separado do `requirePgrBillingPreview`                                  | NOB-179           |
| Trigger que obriga revisão em todo PGR novo (`technical_review_required`)                                  | Não existe                                                                                     | Reaproveitar só com ativação explícita: muda o fluxo de assinatura e a DT-04 ainda não foi aprovada | NOB-179           |
| Conferência (readiness) com aviso no lugar de bloqueio                                                     | Não existe                                                                                     | Reaproveitar junto com a revisão                                                                    | NOB-179           |
| Marca de demonstração no PDF/DOCX                                                                          | Não existe; o teste na develop dura 7 dias (`TRIAL_DAYS = 7`)                                  | Fica com o comercial (NOB-118)                                                                      | NOB-118           |
| Alerta "PGR a vencer em 30 dias"                                                                           | Não localizado na develop                                                                      | Reaproveitável como está                                                                            | NOB-182 (parcial) |
| Documento `docs/qa/questionnaire/2026-10-27-alinhamento.md`                                                | —                                                                                              | Obsoleto (C-20); vale `docs/planning/questionario-v3/`                                              | —                 |

## Migrations da #137

Os números 0060 a 0068 da #137 colidem com as migrations de Medicina da develop. Nenhum SQL, journal ou snapshot é copiado.

| Nº na #137      | Conteúdo                                                             | Destino                                     |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| 0060–0063, 0065 | 12 tabelas `billing_*` e funções de acesso comercial, teste por CNPJ | Frente comercial (NOB-114 a 119, 131 a 138) |
| 0064            | `pgr_document_approvals`                                             | NOB-179, regenerada                         |
| 0066            | `pgr.technical_review_required` + trigger                            | NOB-179, regenerada                         |
| 0067            | revisor restrito (SECURITY DEFINER)                                  | NOB-179, regenerada                         |
| 0068            | escopo de leitura das revisões                                       | NOB-179, regenerada                         |

## Frente comercial simulada (para decisão do Douglas)

A pilha das PRs #122 a #135 é um simulador com gateway falso (`integrations/billing/mock-gateway.ts`) e rotas em `src/app/api/billing/*`. A develop já tem Stripe de verdade: `integrations/stripe/`, `server/platform/billing-core.ts`, `api/webhooks/stripe/route.ts`, telas em `plans/` e a oferta de PGR básico (migration 0058). Não existem tabelas `billing_*` na develop.

| Issue            | O que o simulador traz                                                            |
| ---------------- | --------------------------------------------------------------------------------- |
| NOB-131          | contratos e políticas (`domains/billing/contracts.ts`)                            |
| NOB-114          | clientes e catálogo versionado (`schema/billing.ts`, repos de customers e offers) |
| NOB-132          | checkout idempotente com gateway simulado                                         |
| NOB-133          | eventos, faturas, licenças; altera `module-policy.ts` e `with-org.ts`             |
| NOB-116          | cobranças por serviço                                                             |
| NOB-117          | pedidos avulsos                                                                   |
| NOB-118          | teste de 15 dias e bloqueio de exportação                                         |
| NOB-119          | interesse comercial e alertas                                                     |
| NOB-134 a 137    | telas de planos, assinatura, faturas e administração                              |
| NOB-115, NOB-138 | Pro simulado em `require-tenant-context.ts`; matriz de validação                  |

## Riscos de trazer o código direto

1. Journal e snapshots de migration corrompidos pela colisão de numeração.
2. `pgr-pdf-core.ts` e `pgr-docx-core.ts` da #137 importam módulos comerciais que não existem na develop.
3. O `createCompany` da #137 grava eventos de módulo sem definir o ator; pelas policies da 0078 isso deve falhar (inferido, não testado).
4. A trigger de revisão obrigatória quebra a assinatura genérica do PGR.
5. As policies de escopo de leitura da 0068 podem esconder amostras de quem vê hoje (não verificado).
