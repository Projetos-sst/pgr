# Deploy em produção — checklist (Fase 07 · 14)

**Papéis**: este documento é preparado pela engenharia; **a execução é sua** (credenciais e ações
irreversíveis em produção). Siga na ordem. Marque cada item.

## 0. Pré-requisitos

- [ ] Todas as PRs da Fase 07 mergeadas no `develop` e o `develop` promovido para `main` (ou o branch
      de produção configurado na Vercel).
- [ ] Migrations renumeradas se houve colisão de `0018` (schedule_events / org_billing / user_is_master
      são fatias paralelas — a última a mergear renumera).

## 1. Banco (Supabase produção)

- [ ] Projeto Supabase de **produção** criado (separado do dev).
- [ ] Role `app_runtime` criada (least-privilege) + `set_updated_at()` — as migrations `0001`/`0002`
      cobrem; garanta que o `app_runtime` existe antes (passo de infra do Supabase SQL Editor).
- [ ] Aplicar migrations: `DATABASE_URL_UNPOOLED=<owner> npm run db:migrate` (conexão **owner** direta,
      não o pooler). Confirmar `db:generate` → "No schema changes".
- [ ] RLS ativo em todas as tabelas de negócio (event trigger `ensure_rls` de produção + policies das
      migrations). Conferir na fatia 027 (auditoria).

## 2. Variáveis de ambiente (Vercel) — matriz

> **Todos os segredos são server-only.** `NEXT_PUBLIC_*` vão ao cliente (só chaves públicas).
> **`DEV_API_AUTH_BYPASS` e `DEV_*` NÃO podem existir em produção** (o bypass exige `APP_ENV !==
"production"`, mas não configure de forma alguma).

| Variável                               | Escopo | Obrigatória     | Observação                                                 |
| -------------------------------------- | ------ | --------------- | ---------------------------------------------------------- |
| `APP_ENV`                              | server | ✅              | **`production`** (desabilita o bypass dev)                 |
| `NEXT_PUBLIC_APP_URL`                  | client | ✅              | URL pública (redirects do Stripe Checkout)                 |
| `DATABASE_URL`                         | server | ✅              | `app_runtime` via **pooler 6543** (`prepare:false, max:1`) |
| `DATABASE_URL_UNPOOLED`                | server | ✅ (migrations) | conexão **owner** direta (drizzle-kit)                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`    | client | ✅              | Clerk (instância de produção)                              |
| `CLERK_SECRET_KEY`                     | server | ✅              | Clerk                                                      |
| `CLERK_WEBHOOK_SIGNING_SECRET`         | server | ✅              | verificação do webhook `/api/webhooks/clerk` (Svix)        |
| `NEXT_PUBLIC_SUPABASE_URL`             | client | ✅              | Supabase                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | ✅              | Supabase (chave pública)                                   |
| `SUPABASE_URL`                         | server | ✅              | Supabase (service)                                         |
| `SUPABASE_SECRET_KEY`                  | server | ✅              | Supabase **service role** (bypassa RLS — só server)        |
| `EPI_SIGN_TOKEN_SECRET`                | server | ✅              | HMAC do link público de assinatura (≥256 bits)             |
| `ANTHROPIC_API_KEY`                    | server | ⚠️ (IA)         | sugestão de riscos por IA; ausente → feature off           |
| `AI_SUGGESTION_MODEL`                  | server | opcional        | default `claude-opus-4-8`                                  |
| `GOTENBERG_URL`                        | server | ⚠️ (PDF)        | serviço de PDF (fatia 026); ausente → relatórios off       |
| `GOTENBERG_TOKEN`                      | server | ⚠️ (PDF)        | token do Gotenberg                                         |
| `STRIPE_SECRET_KEY`                    | server | ⚠️ (billing)    | Stripe (fatia 031); ausente → billing off                  |
| `STRIPE_WEBHOOK_SECRET`                | server | ⚠️ (billing)    | verificação do webhook `/api/webhooks/stripe`              |
| `STRIPE_PRICE_ID_PRO`                  | server | ⚠️ (billing)    | preço recorrente do plano Pro                              |

- [ ] Todas as **obrigatórias** preenchidas. As ⚠️ ligam a feature correspondente quando presentes.
- [ ] Confirmar que **nenhum** `DEV_API_AUTH_BYPASS`/`DEV_*` está definido.

## 3. Clerk (produção)

- [ ] Instância de produção + domínio configurado.
- [ ] Webhook → `https://<domínio>/api/webhooks/clerk` (eventos `user.*`, `organization.*`,
      `organizationMembership.*`); copiar o **signing secret** para `CLERK_WEBHOOK_SIGNING_SECRET`.
- [ ] URLs de redirect (sign-in/up) apontando para o domínio de produção.

## 4. Stripe (produção — se billing)

- [ ] Produto + **preço recorrente** do Pro criados → `STRIPE_PRICE_ID_PRO`.
- [ ] Webhook → `https://<domínio>/api/webhooks/stripe` (eventos `checkout.session.completed`,
      `customer.subscription.created|updated|deleted`); copiar o secret → `STRIPE_WEBHOOK_SECRET`.

## 5. Gotenberg (se relatórios PDF)

- [ ] Container Gotenberg publicado (Railway/Render/Fly.io), endpoint **não-público** protegido por
      token → `GOTENBERG_URL` + `GOTENBERG_TOKEN`.

## 6. Vercel + Cloudflare

- [ ] Projeto Vercel conectado ao repo; framework Next.js; branch de produção.
- [ ] Build de produção verde na Vercel.
- [ ] Cloudflare: DNS → Vercel; WAF ativo; cache de borda respeitando `Cache-Control: no-store` nas
      rotas sensíveis (`/api/`, `/sign*`, `/dashboard`).

## 7. Primeiro superadmin

- [ ] Definir o primeiro master:
      `update public.users set is_master = true where id = '<clerk_user_id>';`

## 8. Smoke test pós-deploy

Ver [`smoke-test.md`](./smoke-test.md). Só considere o deploy concluído quando os fluxos críticos
passarem.
