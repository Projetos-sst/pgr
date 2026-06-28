# Quickstart — Infraestrutura de assinatura digital

Como exercitar a fatia ponta a ponta (consumidor `demo`) e rodar os testes.

## Pré-requisitos

- `.env.local` com `DATABASE_URL` (pooler 6543), `DATABASE_URL_UNPOOLED` (owner) e Clerk.
- Novas libs instaladas: `qrcode`, `signature_pad` (verificar compat. React 19/Next 16 — research D6).
- Migration aplicada: `npm run db:generate` (emite `0009_digital_signature_infra`) → `npm run db:migrate`.

## Fluxo manual (demo)

1. `npm run dev` → autenticar como office staff (owner/collaborator).
2. Acessar `/signatures` (painel demo). Gerar um pedido (`target_type: demo`).
3. Copiar o **link** ou ler o **QR Code** com outro dispositivo/aba **sem sessão**.
4. Abrir `/(public)/assinar/[token]` → preencher nome + desenhar a assinatura → enviar.
5. Voltar ao `/signatures`: o status vira **"Assinado"** sozinho em `<5s` (polling).
6. Testar estados: reabrir o mesmo link → **"já utilizado"**; gerar pedido com TTL curto e esperar → **"expirado"**; abrir link adulterado → **"link inválido"**.
7. Testar **assinatura manual**: em um pedido `pending`, usar o botão de assinatura manual.

## Verificação de plano (free/pro)

- Tenant `free`: criar 10 pedidos no mês → a 11ª criação retorna `QUOTA_EXCEEDED`.
- Tenant `pro`: criar acima de 10 → sem bloqueio.
- A rota pública **nunca** bloqueia por plano.

## Testes (gate de conclusão)

```bash
npm run test            # unit: token (entropia/hash), expiração, quota, schemas Zod
npm run test:integration  # Postgres efêmero (INTEGRATION_*): create, submitPublic, expirado, reuso, quota, signManually, cross-tenant
npm run check           # format:check + lint + typecheck + unit
```

### Casos de integração obrigatórios (Postgres efêmero — nunca SQLite)

- `createSignatureRequest` persiste escopado ao org; `submitPublicSignature` grava captura e vira `signed`.
- Token **expirado** rejeitado; token **reutilizado** rejeitado (uso único atômico).
- `getSignatureStatus` transiciona `pending → signed`.
- **Quota**: free bloqueado na 11ª criação no mês (`QUOTA_EXCEEDED`); pro nunca.
- `signManually` registra captura com `method='manual'`.
- **Multi-tenant crítico (manual)**: token de `org_a` não lê/grava em `org_b` (policy de capability + `withOrg`); ausência de token → nada retornado.

## Definição de pronto

`npm run test`, `npm run test:integration`, `lint` e `typecheck` verdes — incluindo o caminho crítico de isolamento multi-tenant em Postgres efêmero (constituição §Fluxo / Princípio I).
