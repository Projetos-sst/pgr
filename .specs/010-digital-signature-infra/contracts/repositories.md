# Contract — Repositórios e helpers de acesso a dados

Arquivos: `src/shared/db/repositories/signature-requests.ts` · `src/shared/db/with-signature-token.ts`. Repositório é o **único** dono do SQL (actions nunca tocam Drizzle direto). Escritas passam por `auditedTenantWrite`.

---

## Helper `withSignatureToken` (novo) — `src/shared/db/with-signature-token.ts`

```ts
withSignatureToken<T>(rawToken: string, fn: (tx: TenantTransaction) => Promise<T>): Promise<T>;
```

- Abre transação e `set_config('app.signature_token', sha256(rawToken), true)` (espelha `withOrg`, escopo transacional → não vaza no pool).
- Habilita a leitura via **policy de capability** sem tenant ambiente. Para gravar, o chamador deriva `org_id` e entra em `withOrg(orgId, …)`.

## Repositório `signature-requests.ts`

```ts
// CRIAÇÃO (interno; dentro de withOrg(ctx.tenantId))
createRequest(tx, input: {
  orgId: string; targetType: string; targetId?: string;
  tokenHash: string; payload: unknown; expiresAt: Date;
}): Promise<{ id: string }>;

// QUOTA (interno) — contagem derivada por mês corrente (D8)
countRequestsInCurrentMonth(tx, orgId: string): Promise<number>;
//   SELECT count(*) FROM signature_requests
//   WHERE org_id = $1 AND created_at >= date_trunc('month', now());

// STATUS (interno; withOrg) — para polling
getRequestStatusById(tx, id: string):
  Promise<{ status: 'pending'|'signed'|'cancelled'; expiresAt: Date; signedAt: Date | null } | null>;
//   null → NOT_FOUND. "expired" é derivado na action a partir de status+expiresAt.

// LEITURA PÚBLICA (withSignatureToken) — policy de capability
getRequestByTokenCapability(tx):
  Promise<{ id: string; orgId: string; targetType: string; payload: unknown;
            status: 'pending'|'signed'|'cancelled'; expiresAt: Date; usedAt: Date | null } | null>;
//   SELECT ... FROM signature_requests LIMIT 1;  -- a policy de capability restringe à única linha do token
//   null → token inexistente (NOT_FOUND).

// CONSUMO + CAPTURA (público; dentro de withOrg(orgId) após derivar do token)
markSignedWithCapture(tx, input: {
  requestId: string; orgId: string; imageData: string; signerName: string;
  method: 'qr'|'link'|'manual';
}): Promise<void>;
//   UPDATE signature_requests SET status='signed', used_at=now() WHERE id=$ AND used_at IS NULL;  -- uso único
//   INSERT INTO signature_captures (...);  -- UNIQUE(request_id) garante 1:1
//   Se 0 linhas no UPDATE → já utilizado (estado "já utilizado").

// MANUAL (interno; withOrg)
markSignedManually(tx, input: { requestId: string; orgId: string; signerName: string }): Promise<void>;
```

### Regras transversais

- **Isolamento (FR-023)**: toda query escopada por `org_id` (policy de tenant) ou por token (policy de capability). Sem token/sem tenant → 0 linhas (nunca tudo).
- **Uso único (FR-005)**: o `UPDATE ... WHERE used_at IS NULL` é a guarda atômica contra reuso/corrida; 0 linhas afetadas ⇒ "já utilizado".
- **`{rows,total}`**: leituras paginadas (se o painel demo listar pedidos) usam `src/shared/pagination.ts`; a contagem de quota usa `count(*)` direto (não paginação).
- **Auditoria**: escritas via `auditedTenantWrite(orgId, operation, write)`.
