# Quickstart — Document (GED) CRUD

## Pré-requisitos

- Schema da fatia 023 aplicado (migration `0025_documents_data_model`). **Sem migration nova.**
- Bucket privado **`documents`** no Supabase (provisionado). Envs: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (server-only).
- `next.config`: `experimental.serverActions.bodySizeLimit = "25mb"` **e**
  `experimental.proxyClientMaxBodySize = "25mb"` (para uploads até 25 MB). O segundo é
  necessário porque toda request passa por `src/proxy.ts` (middleware) antes da Server
  Action, e o Next clona o corpo nesse ponto com um teto próprio de **10 MB por padrão**
  — sem ele, upload entre 10–25 MB é bloqueado no proxy (bug corrigido na fatia).

## Rodar

```bash
npm run dev            # http://localhost:3000/documents
```

## Verificação (quality gate — antes de 'done')

```bash
npm run check          # format:check + lint + typecheck + unit
npm run test:integration   # Postgres efêmero (INTEGRATION_DATABASE_URL)
```

## Testar a API (Postman/cURL, dev bypass)

Com `DEV_API_AUTH_BYPASS=true` (não-prod) e headers `x-dev-tenant`/`x-dev-role`/`x-dev-user`:

```bash
# listar raiz
curl "$baseUrl/api/v1/documents" -H "x-dev-tenant: $devTenant" -H "x-dev-role: owner"
# criar pasta
curl -X POST "$baseUrl/api/v1/folders" -H "x-dev-tenant: $devTenant" -H "x-dev-role: owner" \
  -H 'content-type: application/json' -d '{"name":"Laudos","parentId":null}'
# upload
curl -X POST "$baseUrl/api/v1/documents" -H "x-dev-tenant: $devTenant" -H "x-dev-role: owner" \
  -F file=@laudo.pdf -F name="LTCAT" -F docType="LTCAT" -F validUntil="2027-01-01"
```

## Critérios de pronto (resumo)

- 5 ops de documento + criar/renomear/navegar pasta implementadas e testadas.
- KPIs corretos (Documentos=grupos, Pastas, Vencem 30d, Vencidos); validade derivada.
- Isolamento: cross-tenant → 404; unicidade → 409; pasta inválida → 422; validação → 400/422.
- Upload grava no Storage particionado + registro (v1); nova versão incrementa e preserva histórico; falha de INSERT não deixa binário órfão.
- Superfície completa: Server Actions + REST + api-design.md + Postman.
- `npm run check` e `npm run test:integration` verdes.
