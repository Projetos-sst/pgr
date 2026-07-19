# Issue #35 · Download de documento via URL assinada

**Objetivo:** download seguro — verificar tenant → gerar signed URL curta do Supabase
Storage → redirecionar. Fatia pequena, cola logo após o #34.

**Depende de:** #33, #34 (UI), helper de Storage (#37).

## ⚠️ Tradução para o Modelo B

- `lib/storage.ts` / `features/documentos/` não existem → helper em `src/shared/storage/`
  (criado no #37); `organization_id` → `org_id`. Testes: Postgres efêmero/mocks, nunca SQLite.

## Decisões a cravar

1. **Superfície:** download é `GET` navegável — encaixe natural é Route Handler
   `GET /api/v1/documents/[id]/download` via `restHandler`:
   resolve tenant → `getDocumentById` (404 cross-tenant de graça via `withOrg`) →
   `createSignedUrl(storage_path, ttl)` → `307` para a URL.
   A Server Action que retorna a URL para a UI custa pouco (mesmo core) — fazer ambas.
2. **Propriedade de segurança inteira da fatia:** o input é só o `id` do documento;
   o `storage_path` vem da linha do banco (já filtrada por RLS). **Nunca** aceitar path
   do cliente.
3. **TTL:** 60–300s; nada persistido, URL descartável.
4. **Trade-off consciente:** signed URL do Supabase é _bearer_ — quem tiver o link baixa
   dentro do TTL. Padrão de mercado; TTL curto mitiga; registrar no spec.

## Testes

- Integração cobre o gate: 404 cross-tenant, 401 sem sessão.
- Assinatura mockada (não bater no Supabase real no CI).
- Edge: linha no banco sem objeto no Storage (órfão) → erro tratado, não 500 cru.

## Insumos para o /speckit-specify

- **Branch:** `feature/document-download` (da issue)
- **User story (P1):** como gestor de SST, quero baixar um documento com segurança.
- **Success criteria:** download só para usuários da org dona; URL expira em janela
  curta; buckets permanecem privados.
- **Edge cases:** documento de outra org (404); link expirado; registro órfão no Storage.
