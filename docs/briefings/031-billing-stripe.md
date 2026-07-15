# Briefing — Fatia 031: Billing / assinatura (Stripe)

**Issue**: #86 · `[Fase 07] 08 · Planos de assinatura / billing / trial`
**Branch**: `feature/031-billing-stripe` (base: `develop`)
**Data**: 2026-07-15

## 1. A task

Página de planos + fluxo de trial + integração com provedor de pagamento (Stripe) + exibição do plano
ativo. Decisão do usuário: **Stripe completo**.

## 2. Governança (Constitution Check)

Princípio II exige emenda formal para serviço externo pago → **emenda 1.5.0** (espelha 1.3.0 LLM e 1.4.0
Gotenberg): autoriza provedor de pagamento sob salvaguardas — chaves server-only, webhook assinado,
**Checkout hospedado (cartão nunca toca a app, PCI SAQ-A)**, `orgs.plan` como espelho local
sincronizado por webhook, cobrança não bloqueia o free.

## 3. Implementação (as-built)

- **Migration `0018_org_billing`**: `orgs` + `stripe_customer_id`, `stripe_subscription_id`,
  `trial_ends_at` + unique index no customer. ⚠️ **Renumerar no rebase** se colidir com
  `0018_schedule_events` (fatia 025, ainda não mergeada) — procedimento padrão.
- **`integrations/stripe/{config,client}`** (server-only): `getStripeConfig` (env; ausente ⇒ billing
  off), `createProCheckoutSession` (mode subscription, trial 7d, metadata orgId) e
  `constructWebhookEvent` (verifica assinatura) — **ponto único de rede**.
- **`domains/platform/billing`**: `PLAN_FEATURES` (tabela comparativa), `planFromSubscriptionStatus`
  (puro: active/trialing → pro), `TRIAL_DAYS = 7`.
- **`server/platform/billing-core`**: `startProCheckout` (**owner-only**) + `handleStripeEvent`
  (checkout.session.completed → pro; subscription.created/updated/deleted → sincroniza plano/trial;
  resolve org por metadata ou por customer).
- **Repo `orgs`**: `updateOrgBilling` + `getOrgByStripeCustomerId` (via service client).
- **Superfícies**: Server Action `startProCheckoutAction` (Checkout é redirect, não REST) + **webhook**
  `POST /api/webhooks/stripe` (público — credencial é a assinatura). Novo erro `BILLING_UNAVAILABLE`
  (503). Docs (api-design) + `.env.example`.
- **UI** `/planos`: tabela comparativa + plano atual + botão "Assinar o Pro" (owner, se billing on) +
  aviso quando não configurado + nav.
- **Testes**: unit `planFromSubscriptionStatus` + `handleStripeEvent` (pro/free/trial, resolve por
  customer) + guard owner do checkout (Stripe/repo mockados; **nenhuma chamada de rede** nos testes).
  `typecheck`/`lint`/`build` verdes.

## 4. Para ir ao ar (você)

Provisionar na Vercel (server-only): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`
(preço recorrente do Pro), `NEXT_PUBLIC_APP_URL`. Registrar o endpoint de webhook no Stripe apontando
para `/api/webhooks/stripe` (eventos `checkout.session.completed`, `customer.subscription.*`). Sem env,
a página mostra "assinatura não configurada" e o checkout retorna `BILLING_UNAVAILABLE` — **o código já
está pronto**, liga sozinho quando as chaves existirem.

## 5. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/031-billing-stripe

Feature: Planos de assinatura / billing / trial (Stripe)

CONTEXTO:
SST Manager — SaaS B2B de SST. Billing via provedor gerenciado (Stripe, emenda 1.5.0), Checkout
hospedado — cartão nunca toca a app. Plano do tenant em orgs.plan, sincronizado por webhook assinado.
Seguir CLAUDE.md (segredo server-only).

User stories:
- (P1) Como owner, quero assinar o plano Pro (com trial) e ver meu plano atual.
- (P2) Como sistema, quero sincronizar o plano por webhook do provedor.

Success criteria:
- O owner assina/upgrada sem que dado de cartão passe pela aplicação.
- O plano local reflete o status da assinatura no provedor.

Edge cases:
- Provedor não configurado (billing off). Cancelamento/inadimplência → volta a free.

Restrições (constituição):
- Emenda 1.5.0: chaves server-only, webhook assinado, Checkout hospedado, orgs.plan como espelho.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
