# Smoke test pós-deploy (Fase 07 · 14)

Roteiro manual dos fluxos críticos, a rodar **em produção** logo após o deploy. Cada passo tem o
resultado esperado; qualquer falha = **rollback / investigar antes de anunciar**.

## Fluxos críticos

| #   | Fluxo                       | Passos                                                  | Esperado                                                                                         |
| --- | --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Login / provisionamento** | Criar conta em `/sign-up`                               | Redireciona autenticado; um tenant pessoal (free) é provisionado automaticamente (webhook Clerk) |
| 2   | **Isolamento**              | Logar com 2 contas distintas                            | Cada uma só vê os próprios dados; nada cruza                                                     |
| 3   | **Primeiros passos**        | Abrir `/primeiros-passos`                               | Progresso 0%; ao cadastrar empresa, o passo vira "Concluído"                                     |
| 4   | **Cadastro base**           | Criar empresa → funcionário → GES → risco → PGR         | Cada cadastro salva; aparece nas listagens e no dashboard                                        |
| 5   | **Dashboard**               | Abrir `/dashboard`                                      | KPIs e gráficos refletem os dados; pendências corretas                                           |
| 6   | **EPI**                     | Entregar EPI + assinar via link público `/sign/<token>` | Entrega registra; assinatura pública funciona sem login                                          |
| 7   | **PDF (se Gotenberg)**      | `/relatorios` → "Resumo da organização"                 | Baixa um PDF válido; sem Gotenberg, mostra "não configurado"                                     |
| 8   | **Billing (se Stripe)**     | `/planos` → "Assinar o Pro" (cartão de teste `4242…`)   | Redireciona ao Checkout; após pagar, webhook seta `plan=pro`                                     |
| 9   | **Superadmin**              | Logar como master → `/admin-global`                     | Vê masters + uso de IA; não-master → `forbidden()`                                               |
| 10  | **Segurança**               | Chamar `/api/v1/*` sem sessão                           | `307`/redirect (proxy protege); com bypass off, nunca público                                    |

## Verificações técnicas

- [ ] `GET /api/me` autenticado → `200 { userId, orgId }`.
- [ ] Webhook Clerk recebe eventos (Clerk dashboard → logs) e sincroniza `users`/`org_memberships`.
- [ ] Webhook Stripe (se billing) recebe `checkout.session.completed` e atualiza `orgs.plan`.
- [ ] Headers: `X-Powered-By`/`Server` ausentes; `Cache-Control: no-store` em `/api/` e `/dashboard`.
- [ ] Logs sem segredos vazados; sem 500 inesperado nos fluxos acima.

## Rollback

Vercel mantém deploys anteriores — **promover o deploy anterior** em caso de falha crítica. Migrations
são aditivas (colunas/tabelas novas), então um rollback de app não quebra o banco; evite `down`
migrations em produção.
