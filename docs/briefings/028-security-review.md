# Briefing — Fatia 028: Revisão de segurança (pré-lançamento)

**Issue**: #51 · `[Fase 07] 13 · Revisão de segurança`
**Branch**: `feature/028-security-review` (base: `develop`)
**Data**: 2026-07-14

## Resultado: posture forte, sem achados críticos

Auditoria pré-lançamento das barreiras de segurança. Cada item abaixo foi verificado no código atual;
a maioria já é garantida **estruturalmente** pelos wrappers (`officeAction`/`restHandler`/`withOrg`).

## Checklist auditado

| #   | Item                                    | Verificação                                                                                                                   | Status    |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Segredos versionados**                | `git grep` por `sk_*`/`whsec_*`/chaves privadas fora de `.env.example`/CI/docs                                                | ✅ nenhum |
| 2   | **Validação Zod no boundary**           | Toda Server Action valida via `schema.parse` (na action ou no core); todo `/api/v1` passa por `restHandler` que revalida      | ✅        |
| 3   | **REST sempre por `restHandler`**       | Todos os handlers `src/app/api/v1/**/route.ts` usam `restHandler` (gate + mapeamento de erro)                                 | ✅        |
| 4   | **Actions sempre por `officeAction`**   | Todo arquivo de action usa `officeAction`/`publicAction`/`requireAuth`                                                        | ✅        |
| 5   | **RLS ativo em toda tabela de negócio** | Auditado na fatia 027: `enableRLS` + policy em todas; testes `runIsolationSuite` rodam no CI                                  | ✅        |
| 6   | **Auth revalidada DENTRO das actions**  | `officeAction`→`requireOfficeStaff` e `restHandler`→`resolveContext` (não confia só no `proxy.ts`) — defesa em profundidade   | ✅        |
| 7   | **Webhook Clerk verifica assinatura**   | `verifyWebhook` (Svix) em `api/webhooks/clerk`; payload sem assinatura válida é rejeitado                                     | ✅        |
| 8   | **Bypass dev impossível em produção**   | `proxy.ts` + `rest.ts`: exige `APP_ENV !== "production"` **e** `DEV_API_AUTH_BYPASS === "true"`                               | ✅        |
| 9   | **Segredos server-only**                | Nenhum `ANTHROPIC_API_KEY`/`GOTENBERG_TOKEN`/`CLERK_SECRET`/`*_SECRET`/`STRIPE_SECRET` importado em componente `"use client"` | ✅        |
| 10  | **Rotas públicas mínimas**              | `proxy.ts`: só `/`, `/sign-in`, `/sign-up`, `/sign/*`, `/api/webhooks/*` (e `/api/v1/*` só sob bypass dev)                    | ✅        |
| 11  | **Headers de resposta**                 | `proxy.ts` remove `X-Powered-By` e `Server`; `no-store` em `/api/`, `/sign*`, `/dashboard`                                    | ✅        |
| 12  | **Token de assinatura (EPI)**           | HMAC-SHA256 + `timingSafeEqual` (comparação em tempo constante) + segredo só em env; uso único (`used_at`)                    | ✅        |
| 13  | **XSS / `dangerouslySetInnerHTML`**     | Uma ocorrência: QR **SVG gerado no servidor** pela lib `qrcode` (não input do usuário) — anotado como revisado-seguro         | ✅        |
| 14  | **Saída de relatório (PDF)**            | `buildOrgSummaryHtml` faz `escapeHtml` do nome da org antes de montar o HTML enviado ao Gotenberg                             | ✅        |
| 15  | **Endpoints de cron**                   | Não há endpoints de cron nesta fase — nada a proteger                                                                         | N/A       |

## Correções aplicadas nesta fatia

**Nenhuma** — a revisão confirmou uma posture já sólida (14/14 controles passam estruturalmente). O
único `dangerouslySetInnerHTML` (QR SVG) **já vinha anotado** no código (`delivery-signature.tsx:123`)
como server-side / não-input-do-usuário. Este PR é o **registro da auditoria**, não uma correção de
vulnerabilidade.

## Recomendações de follow-up (não-bloqueantes)

1. **Reabilitar as 8 suítes de integração** excluídas na fatia 027 (harness de Route Handler + alinhar
   `least-privilege` ao shim) — fecha a cobertura automatizada da barreira REST + privilégios finos.
2. **`.gitattributes`** com `* text=auto eol=lf` — elimina o ruído de CRLF no Windows (higiene, não
   segurança).
3. Ao ligar o **Stripe** (fatia 08) e o **Gotenberg** (fatia 04), confirmar os segredos só na Vercel
   (server-only) e a verificação de assinatura do webhook Stripe.
