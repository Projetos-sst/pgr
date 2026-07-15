# Briefing — Fatia 033: Deploy em produção (preparação)

**Issue**: #52 · `[Fase 07] 14 · Deploy em produção e smoke test`
**Branch**: `feature/033-deploy-checklist` (base: `develop`)
**Data**: 2026-07-15

## Papéis

**Eu preparo, você executa.** O deploy real (Vercel/Cloudflare/Supabase/Clerk/Stripe de produção,
env vars de prod, aplicar migrations no banco de prod) exige **suas credenciais** e são ações
irreversíveis — não posso (nem devo) executar. Esta fatia entrega tudo que precede o clique.

## Entregáveis

- **[`docs/deploy/deploy-checklist.md`](../deploy/deploy-checklist.md)** — passo a passo: banco
  (migrations owner), **matriz completa de env vars** (obrigatórias × por-feature; segredos server-only;
  `APP_ENV=production` e `DEV_API_AUTH_BYPASS` ausente), Clerk, Stripe, Gotenberg, Vercel + Cloudflare
  (DNS/WAF/cache), primeiro superadmin.
- **[`docs/deploy/smoke-test.md`](../deploy/smoke-test.md)** — roteiro dos 10 fluxos críticos
  (login/provisionamento, isolamento, cadastro base, dashboard, EPI+assinatura pública, PDF, billing,
  superadmin, segurança) + verificações técnicas + rollback.

## Notas

- A **matriz de env** foi derivada do código (`process.env.*`) + das emendas (Anthropic 1.3.0, Gotenberg
  1.4.0, Stripe 1.5.0). As features externas (IA/PDF/billing) são **env-gated**: ausentes ⇒ a feature
  fica off com aviso, o resto do app funciona.
- **Migrations aditivas**: rollback de app não quebra o banco; sem `down` em produção.
- Confirmado localmente que as migrations aplicam limpas (fatia 027 roda a suíte de integração contra
  Postgres real, incluindo o `applyMigrations` de todas).

## Como fechar a issue #52

Rodar o checklist ponta a ponta em produção e marcar o smoke test. A engenharia acompanha e ajusta
qualquer env/rota que o smoke test revelar.
