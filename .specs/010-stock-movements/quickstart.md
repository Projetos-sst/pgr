# Quickstart — Movimentações de estoque e histórico (`stock_movements`)

Guia de validação da fatia 010. Pressupõe que a **base 008/009 está presente** (ver o gate de
pré-condição de branch no `plan.md`) — sem ela, os arquivos de `epi-stock`/`epis.ts` não existem.

## Pré-condições

1. **Branch com a base**: `feature/stock-movements` rebaseada sobre `feature/epi-stock-crud` (008+009)
   ou sobre `develop` após o merge da 009. Conferir que existem:
   `src/shared/db/schema/epis.ts`, `src/shared/db/repositories/epi-stock.ts`,
   `src/app/(protected)/epi-stock/`.
2. **Env de integração**: `INTEGRATION_DATABASE_URL` e `INTEGRATION_APP_RUNTIME_URL` apontando para um
   **Postgres efêmero** (branch descartável). **NUNCA** o banco de dev — as suítes fazem `TRUNCATE`.

## Rodar a aplicação

```bash
npm run dev        # http://localhost:3000
```

Fluxo manual (UI):
1. Abrir `/epi-stock` (lista da 009) e escolher um item.
2. **Registrar entrada**: abrir o modal, informar data + quantidade (+ NF opcional) → confirmar.
   Esperado: saldo do item aumenta na lista; status derivado recalculado.
3. **Registrar saída**: abrir o modal de saída, escolher Ajuste/Descarte + quantidade → confirmar.
   Esperado: saldo diminui. Tentar saída maior que o saldo → erro "Saldo insuficiente…" e nada muda.
4. **Histórico**: abrir `/epi-stock/[id]/history`. Esperado: tabela ordenada por data (desc) com Saldo
   Resultante por linha batendo com o saldo atual; item sem movimentos → estado vazio.

## REST (Postman / curl) — via bypass dev

Com `APP_ENV != production` e `DEV_API_AUTH_BYPASS=true`, usar headers `x-dev-tenant`/`x-dev-role`:

```bash
# Entrada
curl -X POST localhost:3000/api/v1/epi-stock/$STOCK_ID/movements \
  -H 'content-type: application/json' -H 'x-dev-tenant: org_a' -H 'x-dev-role: owner' \
  -d '{"kind":"entry","quantity":10,"movementDate":"2026-06-26","invoiceNumber":"NF-123"}'   # 201

# Saída (ajuste)
curl -X POST localhost:3000/api/v1/epi-stock/$STOCK_ID/movements \
  -H 'content-type: application/json' -H 'x-dev-tenant: org_a' -H 'x-dev-role: owner' \
  -d '{"kind":"exit","quantity":3,"movementDate":"2026-06-26","type":"adjustment"}'          # 201

# Saída maior que o saldo
# → 422 {"error":{"code":"INSUFFICIENT_STOCK",...}}

# Histórico
curl localhost:3000/api/v1/epi-stock/$STOCK_ID/movements?page=1&pageSize=20 \
  -H 'x-dev-tenant: org_a' -H 'x-dev-role: owner'                                            # 200
```

## Testes (quality gate)

```bash
npm run lint
npm run test               # unit: computeRunningBalance, sinal por tipo, schemas zod, mapeamento de erro
npm run test:integration   # Postgres efêmero: entrada/saída/rollback/histórico/404 cross-tenant/FORBIDDEN
```

Cenários de integração que MUST passar (ver `spec.md` §"Definição de pronto"):
- entrada incrementa o saldo e cria `purchase`;
- saída decrementa e cria `adjustment`/`discard`;
- **saída > saldo → `INSUFFICIENT_STOCK` e nada gravado** (saldo + contagem de movimentos inalterados);
- histórico ordenado com saldo resultante correto; estado vazio;
- **404 cross-tenant** ao registrar/consultar; `FORBIDDEN` para papel `client`;
- isolamento multi-tenant (dados não cruzam organizações).
