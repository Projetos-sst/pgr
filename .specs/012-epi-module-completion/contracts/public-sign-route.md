# Contract — Rota pública de assinatura `/sign/[token]` (US3)

**Fora** do `/api/v1`, **sem** tenant de sessão, **sem** Clerk. Vive em
`src/app/(public)/sign/[token]/page.tsx`. Requer adicionar `"/sign/(.*)"` ao `isPublicRoute` em
`src/proxy.ts` (padrão de `sign-in`/`sign-up`/`api/webhooks`). O tenant é resolvido **a partir do
token** (research R1/R2), nunca de input livre.

## Token (stateless, HMAC — research R2)
`token = base64url({ orgId, deliveryId, iat }) + "." + base64url(HMAC_SHA256(payload, EPI_SIGN_TOKEN_SECRET))`.
Gerado no ato de escolher QR/link (Server Action interna de `epi-deliveries`, autenticada); gravado em
`epi_deliveries.auth_token`. Válido ⇔ HMAC confere **e** `now - iat ≤ 72h` **e** casa com `auth_token`
do registro **e** entrega `pending`.

## `GET /sign/[token]` (renderiza a página)
- Verifica o token → `{ orgId, deliveryId }`. Executa `withOrg(orgId)` para carregar a entrega + itens
  (`WHERE id = deliveryId AND auth_token = token`). Mostra itens e o `<canvas>` de assinatura.
- Token inválido/inexistente → página "link inválido" (`TOKEN_INVALID`, sem enumeração, sem 500).
- Token expirado (>72h) → página "link expirado" (`TOKEN_EXPIRED`).
- Entrega já assinada → página "recebimento já confirmado" (mensagem de negócio, não erro).
- **Só** enxerga a entrega do token; nenhum outro tenant/entrega é acessível.

## `POST /sign/[token]` (confirma a assinatura)
Recebe `{ method: 'qr' | 'link' }` (+ imagem opcional, **não** persistida nesta fatia — R4). Reverifica o
token; sob `withOrg(orgId)`, transição `pending → signed_qr | signed_link` + timestamp; opcionalmente
`auth_token = NULL` (invalida o link). Idempotência: se já assinada → resposta clara (não reassina). O
painel interno da entrega reflete via **polling** do `signature_status`.

## Segurança
- Token é a **única** credencial → curto, imprevisível (HMAC), expira em 72h, **um** por entrega.
- **Rate-limit** por IP no handler (mitiga enumeração); resposta uniforme p/ inválido vs. inexistente.
- Nunca vaza dados de outro tenant; nunca 500 em desfecho de negócio.
- `NO_STORE` na resposta (evita cache do estado de assinatura).

## Docs & Postman
Registrar a rota pública em `docs/api/api-design.md` (seção de integrações/rotas públicas) e no Postman
(pasta própria; o GET/POST usam `{token}` como variável de coleção).
