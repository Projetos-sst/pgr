# Contract — Server Actions (lado interno + superfície pública)

Todas retornam `ActionResult<T>` (`src/shared/server/result.ts`). Internas envolvidas por `officeAction(operation, fn, {audit})` (gate `requireOfficeStaff` → só `owner`/`collaborator`; papel `client` → `FORBIDDEN`). A pública **não** tem gate de office staff.

Arquivos: `src/shared/server/actions/signatures.ts` (internas) · `src/shared/server/actions/public-signatures.ts` (pública).

---

## `createSignatureRequest` (interna, `audit: true`)

```ts
createSignatureRequest(input: {
  targetType: SignatureTargetType;   // 'demo' | (futuro) 'epi_delivery' | ...
  targetId?: string;                 // uuid do registro de origem (omitido no demo)
  payload: unknown;                  // validado pelo payloadSchema do target_type (registry)
  ttlSeconds?: number;               // default configurável (D3: 72h)
}): Promise<ActionResult<{ requestId: string; publicUrl: string; qrCodeDataUrl: string }>>;
```

- **Gate de plano (FR-019/020)**: lê `ctx.plan`. Se `free` e `count(mês corrente) >= FREE_SIGNATURE_MONTHLY_QUOTA` → `fail("QUOTA_EXCEEDED", …)`. `pro` → ilimitado.
- **Token**: gera token cru (≥256 bits), persiste só `sha256`; o **token cru** entra em `publicUrl`/`qrCodeDataUrl` e **não** é retornado em separado nem logado.
- **QR**: `qrcode` gera data-URL no servidor a partir de `publicUrl`.
- **Erros**: `VALIDATION` (Zod/payload), `QUOTA_EXCEEDED`, `FORBIDDEN` (client).

## `getSignatureStatus` (interna, sem audit — leitura)

```ts
getSignatureStatus(requestId: string):
  Promise<ActionResult<{ status: 'pending'|'signed'|'expired'|'cancelled'; signedAt?: string }>>;
```

- `expired` é **derivado** (`expires_at < now()` e `status='pending'`). Usado pelo polling (~3 s) do painel interno.
- **Erros**: `NOT_FOUND` (request inexistente/cross-tenant), `FORBIDDEN`.

## `signManually` (interna, `audit: true`)

```ts
signManually(requestId: string, input: { signerName: string }):
  Promise<ActionResult<void>>;
```

- Pedido `pending` → `signed`; insere `signature_captures` com `method='manual'`, `image_data` placeholder/sentinela (sem imagem digital). Set `used_at=now()`.
- **Erros**: `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`; rejeita se já `signed` (uso único).

## `submitPublicSignature` (pública — SEM gate de office)

```ts
submitPublicSignature(token: string, input: { signerName: string; imageDataUrl: string }):
  Promise<ActionResult<void>>;
```

- **Fluxo (D2)**: `withSignatureToken(token, …)` lê o request pela policy de capability → valida existência / não expirado / `used_at IS NULL`. Deriva `org_id` → `withOrg(orgId, …)`: `update status='signed', used_at=now()` + `insert signature_captures (method='qr'|'link')`.
- **Nunca** checa plano/quota (FR-022). **Tenant vem do token**, nunca do input (FR-008).
- **Erros / estados**: `VALIDATION` (Zod imagem/nome); token inexistente → `NOT_FOUND`; **expirado**/**já utilizado** → estado próprio para a página renderizar mensagem amigável (não erro cru).

---

## Mapeamento REST (se exposto via `restHandler`)

Acréscimo ao `HTTP_BY_CODE` (`src/shared/api/rest.ts`): `QUOTA_EXCEEDED → 402`. Demais já mapeados (`VALIDATION 422`, `NOT_FOUND 404`, `FORBIDDEN 403`). A rota pública de captura é uma página do App Router, não `/api/v1`.
