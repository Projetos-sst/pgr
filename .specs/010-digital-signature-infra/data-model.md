# Phase 1 — Data Model: Infraestrutura de assinatura digital

Migration: `0009_digital_signature_infra` (drizzle-kit + SQL custom). Schema: `src/shared/db/schema/signatures.ts`. Padrão de tabela/RLS herdado de `companies.ts`/`epis.ts`.

## Enums

| Enum                       | Valores                            | Uso                                                                                                                                    |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `signature_request_status` | `pending` · `signed` · `cancelled` | Estado persistido do pedido. **`expired` NÃO é valor persistido** — é derivado na leitura (`expires_at < now()` e `status='pending'`). |
| `signature_method`         | `qr` · `link` · `manual`           | Como a captura foi coletada.                                                                                                           |

## Tabela `signature_requests`

Pedido de assinatura emitido por qualquer módulo consumidor.

| Coluna        | Tipo                       | Constraints                                | Notas                                                                                 |
| ------------- | -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `id`          | `uuid`                     | PK, `defaultRandom()`                      |                                                                                       |
| `org_id`      | `text`                     | NOT NULL, FK → `orgs.id` ON DELETE CASCADE | tenant; indexado; RLS                                                                 |
| `target_type` | `text`                     | NOT NULL                                   | discriminador (`'demo'`, futuro `'epi_delivery'`…); validado pelo registry no domínio |
| `target_id`   | `uuid`                     | NULL                                       | registro de origem (NULL no demo)                                                     |
| `token_hash`  | `text`                     | NOT NULL, **UNIQUE**                       | sha-256 do token cru; token cru nunca persiste                                        |
| `payload`     | `jsonb`                    | NOT NULL                                   | dados que o `FormRenderer` do `target_type` exibe ao signatário                       |
| `status`      | `signature_request_status` | NOT NULL, DEFAULT `'pending'`              |                                                                                       |
| `expires_at`  | `timestamptz`              | NOT NULL                                   | TTL; base da derivação "expirado"                                                     |
| `used_at`     | `timestamptz`              | NULL                                       | marca uso único (set no `signed`)                                                     |
| `created_at`  | `timestamptz`              | NOT NULL, DEFAULT `now()`                  | base da contagem de quota                                                             |
| `updated_at`  | `timestamptz`              | NOT NULL, DEFAULT `now()`                  | trigger `set_updated_at`                                                              |

**Índices**:

- `idx_signature_requests_org_id` (`org_id`)
- `idx_signature_requests_org_id_created_at` (`org_id`, `created_at`) — contagem de quota por mês corrente
- `uq_signature_requests_token_hash` (UNIQUE `token_hash`)
- `idx_signature_requests_target` (`target_type`, `target_id`) — lookup pelo registro de origem

**RLS** (2 policies PERMISSIVE, `app_runtime`):

1. `signature_requests_isolation` — `FOR ALL USING/WITH CHECK (org_id = current_setting('app.current_org', true))` (padrão de tenant).
2. `signature_requests_token_capability` — `FOR SELECT USING (token_hash = current_setting('app.signature_token', true))` (rota pública sem sessão; só lê a linha cujo token o cliente possui).

## Tabela `signature_captures`

Resultado coletado (1:1 com o request).

| Coluna        | Tipo               | Constraints                                                          | Notas                      |
| ------------- | ------------------ | -------------------------------------------------------------------- | -------------------------- |
| `id`          | `uuid`             | PK, `defaultRandom()`                                                |                            |
| `org_id`      | `text`             | NOT NULL, FK → `orgs.id` ON DELETE CASCADE                           | tenant; indexado; RLS      |
| `request_id`  | `uuid`             | NOT NULL, **UNIQUE**, FK → `signature_requests.id` ON DELETE CASCADE | 1 captura por request      |
| `image_data`  | `text`             | NOT NULL                                                             | data-URL base64 (PNG)      |
| `signer_name` | `text`             | NOT NULL                                                             | nome do signatário         |
| `method`      | `signature_method` | NOT NULL                                                             | `qr` \| `link` \| `manual` |
| `signed_at`   | `timestamptz`      | NOT NULL, DEFAULT `now()`                                            |                            |
| `created_at`  | `timestamptz`      | NOT NULL, DEFAULT `now()`                                            |                            |
| `updated_at`  | `timestamptz`      | NOT NULL, DEFAULT `now()`                                            | trigger `set_updated_at`   |

**Índices**: `idx_signature_captures_org_id` (`org_id`); `uq_signature_captures_request_id` (UNIQUE `request_id`).

**RLS** (1 policy, `app_runtime`): `signature_captures_isolation` — `FOR ALL USING/WITH CHECK (org_id = current_setting('app.current_org', true))`. (Sem policy de capability: a captura é sempre gravada via `withOrg(orgId)` após o token resolver o tenant.)

## Relacionamentos

```
orgs (1) ──< signature_requests (N) ──(1:1)── signature_captures
                     │
                     └─ target_type/target_id → registro de origem (lógico, sem FK física — polimórfico)
```

- `signature_requests.org_id` → `orgs.id` (CASCADE).
- `signature_captures.request_id` → `signature_requests.id` (CASCADE, UNIQUE → 1:1).
- `target_id` **não** tem FK física (é polimórfico por `target_type`); a integridade do alvo é responsabilidade do módulo consumidor.

## Regras de estado e transições

| De                                   | Para                 | Gatilho                                                      | Efeitos                                                                               |
| ------------------------------------ | -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| —                                    | `pending`            | `createSignatureRequest`                                     | gera token, `expires_at`, `payload`                                                   |
| `pending`                            | `signed`             | `submitPublicSignature` (token válido) **ou** `signManually` | set `used_at=now()`; insert `signature_captures` (`method` = `qr`/`link` ou `manual`) |
| `pending`                            | `cancelled`          | (futuro; fora do MVP de transições automáticas)              | nenhuma captura                                                                       |
| `pending` (com `expires_at < now()`) | _derivado_ `expired` | leitura                                                      | **não** é persistido; bloqueia gravação na rota pública                               |

**Invariantes**:

- Um request `signed` tem exatamente uma `signature_capture` (UNIQUE `request_id`).
- `used_at IS NOT NULL` ⇔ `status='signed'` (uso único; gravação rejeitada se já usado).
- Gravação cross-tenant rejeitada pelo `WITH CHECK` da policy de tenant.

## Validação (Zod — `src/shared/domains/signatures/schemas.ts`)

- `createSignatureRequestSchema`: `targetType` (enum do registry), `targetId?` (uuid), `payload` (validado pelo `payloadSchema` do `target_type`), `ttlSeconds?` (int positivo; **default 72 h = 259200 s** — research D3).
- `publicSignatureSchema`: `signerName` (string não vazia, trim, **máx. 120 chars**), `imageDataUrl` (string data-URL PNG; **tamanho máx. 256 KB** — limite fixo contra abuso/DoS, coerente com PNG de assinatura de ~5–50 KB do briefing).
- `signManuallySchema`: `signerName` (string não vazia, trim, **máx. 120 chars**).
- `payloadSchema` por `target_type` (demo: campos mínimos do formulário de demonstração).

> **Nota — `cancelled` dormente nesta fatia**: o valor de enum `cancelled` existe e é aceito como saída de `getSignatureStatus` (FR-014), mas **nenhuma transição automática o produz** no MVP (sem ação de cancelamento). Reservado para fatia futura; documentado para evitar leitura como lacuna.
