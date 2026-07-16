# Quickstart — Feature 022 · validação manual

Validação **local** contra **Postgres efêmero** (descartável). **Nunca SQLite. Nunca Supabase
compartilhado. Nunca seed destrutivo em banco de dev. Não imprimir secrets** (`.env`, `DATABASE_URL`,
senhas, **tokens de assinatura**).

## 0. Pré-condições

- Branch `feature/pgr-revisions-signature`, com a fatia implementada.
- Docker (Postgres efêmero), role `app_runtime` **não-superuser** → RLS real.
- Dev bypass REST: `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` + headers
  `x-dev-tenant` / `x-dev-role` / `x-dev-user`.
- `NEXT_PUBLIC_APP_URL` definido (é o que `buildPublicSignatureUrl` usa para montar o link público).

## 1. Postgres efêmero + roles

```bash
docker run --name sst-022-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sst_test -p 55433:5432 -d postgres:16
# criar roles anon/authenticated/service_role (NOLOGIN) + app_runtime (LOGIN, NÃO superuser)
# + schema auth + stubs auth.uid()/role()/jwt() — igual às fatias 014/016/018/019.
```

Envs de integração (banco descartável — **não** são secrets de produção):

```bash
export INTEGRATION_DATABASE_URL="postgres://postgres:postgres@localhost:55433/sst_test"
export INTEGRATION_DATABASE_URL_ADMIN="postgres://postgres:postgres@localhost:55433/sst_test"
export INTEGRATION_APP_RUNTIME_URL="postgres://app_runtime:app_runtime@localhost:55433/sst_test"
```

## 2. Migrations + seed

Via `applyMigrations` + `seedPgrBase` (helpers existentes).

> ⚠️ **O seed precisa de um segundo PGR no MESMO tenant.** Hoje ele só cria `pgrA` (org_a) e `pgrB`
> (org_b) — não há como provar que o lock **não é global** sem um `pgrA2` em `org_a`. Usar o `pgrB`
> para isso seria testar paralelismo entre tenants (que o RLS já separa), **não** o comportamento do
> lock. Acrescentar ao `pgr-seed.ts`:

| PGR     | Tenant  | Para que serve                                                       |
| ------- | ------- | -------------------------------------------------------------------- |
| `pgrA`  | `org_a` | concorrência **no mesmo PGR** (201 + 201 consecutivos)               |
| `pgrA2` | `org_a` | provar que o **lock não é global** (PGRs distintos não se bloqueiam) |
| `pgrB`  | `org_b` | isolamento **cross-tenant** (`NOT_FOUND`)                            |

O seed já entrega:

- **`org_a` = plano `free`** (cota 10/mês) e **`org_b` = plano `pro`** (ilimitado) — é exatamente o que
  os testes de cota precisam, sem seed novo.
- `pgrA`@org_a com `pgrGesA` → `gesA` → `riskA` → `riskAssessmentA` (3×3 → `risk_level` 9) →
  `controlMeasureA` (`elimination`, `applicable=false`) e **`epi_risk`** (`epiCatalogA` ↔ `riskA`,
  `neutralizes`).
- `pgrRevisionA` com **`revision_number = 1`** → a próxima revisão criada deve sair **2**.
- `pgrB`/`gesB`/`riskB`@org_b para cross-tenant.

> ⚠️ `seedSignatureOrgs` (de `signatures-seed.ts`) faz `truncate` — **não** o chame depois de
> `seedPgrBase`. Para os testes de assinatura do PGR, use `seedPgrBase` + `seedRequest(admin, {...})`
> (que só insere), passando `targetType: "pgr"` e `targetId: PGR_IDS.pgrA`.

## 3. Testes automatizados

```bash
# unit
npx jest --selectProjects unit --runTestsByPath \
  src/__tests__/unit/domains/pgr/pgr-signature.test.ts \
  src/__tests__/unit/domains/pgr/pgr-consolidated.test.ts \
  src/__tests__/unit/domains/signatures/pgr-payload.test.ts

# integração (--runInBand: as suítes compartilham o banco)
npm run test:integration -- --runInBand --runTestsByPath \
  src/__tests__/integration/pgr-editor/pgr-revisions.test.ts \
  src/__tests__/integration/pgr-editor/pgr-consolidated.test.ts \
  src/__tests__/integration/pgr-editor/pgr-signature.test.ts \
  src/__tests__/integration/signatures/quota.test.ts \
  src/__tests__/integration/auth/proxy-protection.test.ts

# REGRESSÃO do refactor do core genérico — critério de aceite do P1-1:
# as 9 suítes da 010 + as 3 unit devem passar SEM NENHUMA EDIÇÃO.
# Se alguma exigir mudança de EXPECTATIVA (não apenas estrutural), a extração REGREDIU:
#   fluxo demo · cota · hash · token · TTL · URL pública · audit · erros · payload ·
#   target registry · uso único · expiração · replay  → tudo deve permanecer idêntico.
npm run test:integration -- --runInBand --runTestsByPath src/__tests__/integration/signatures
npx jest --selectProjects unit --runTestsByPath \
  src/__tests__/unit/signatures-token.test.ts \
  src/__tests__/unit/signatures-schemas.test.ts \
  src/__tests__/unit/signatures-quota.test.ts
```

## 4. Revisão com número no servidor

```bash
# 1ª revisão após a seed (que já tem a nº 1) → deve sair 2, SEM enviar número
curl -i -X POST "$BASE/api/v1/pgr/$PGR_A/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  -d '{"revisedAt":"2026-07-14","notes":"Revisão anual"}'
# → 201 { "revisionNumber": 2, ... }

# repetir → 3 (nunca colide, nunca depende do cliente)

# enviar "revisionNumber" no body → 422 (schema .strict(): o campo é PROIBIDO, não ignorado)
curl -i -X POST "$BASE/api/v1/pgr/$PGR_A/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  -d '{"revisedAt":"2026-07-14","revisionNumber":99}'
# → 422 VALIDATION  (um cliente desatualizado FALHA VISIVELMENTE, em vez de achar que controla o número)

# histórico ordenado (número desc)
curl -s "$BASE/api/v1/pgr/$PGR_A/revisions" -H "x-dev-tenant: org_a" -H "x-dev-role: owner"

# cross-tenant → 404
curl -i -X POST "$BASE/api/v1/pgr/$PGR_B/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  -d '{"revisedAt":"2026-07-14"}'      # → 404 NOT_FOUND

# papel client → 403
curl -i -X POST "$BASE/api/v1/pgr/$PGR_A/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: client" \
  -d '{"revisedAt":"2026-07-14"}'      # → 403 FORBIDDEN
```

**Concorrência — mesmo PGR** (o `FOR UPDATE` serializa: **ambas** são criadas, com números
consecutivos):

```bash
for i in 1 2; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/pgr/$PGR_A/revisions" \
    -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
    -d '{"revisedAt":"2026-07-14"}' &
done; wait
# ESPERADO: 201 e 201 — NUNCA 409.
# Conferir na listagem que os números são DISTINTOS e CONSECUTIVOS, e que nenhuma revisão se perdeu:
curl -s "$BASE/api/v1/pgr/$PGR_A/revisions" -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  | jq '[.[].revisionNumber]'
```

**Concorrência — PGRs diferentes do MESMO tenant** (`pgrA` × `pgrA2`): o lock é **por PGR**, não
global, então não há bloqueio entre eles. É por isso que o seed precisa do `pgrA2` — usar o `pgrB`
(outro tenant) testaria o RLS, não o lock.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/pgr/$PGR_A/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  -d '{"revisedAt":"2026-07-14"}' &
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/pgr/$PGR_A2/revisions" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" \
  -d '{"revisedAt":"2026-07-14"}' &
wait   # → 201 e 201, sem espera mútua
```

> A UNIQUE `(org_id, pgr_id, revision_number)` **continua ativa**: uma colisão inesperada (linha legada
> gravada fora do fluxo) ainda vira **409 `DUPLICATE`** — backstop defensivo, não o desfecho da
> concorrência normal.

## 5. Consolidada ampliada

```bash
curl -s "$BASE/api/v1/pgr/$PGR_A/consolidated" \
  -H "x-dev-tenant: org_a" -H "x-dev-role: owner" | jq '.ges[0].risks[0]'
# conferir: epis[] (Capacete do seed), assessment{criterion,probability,severity,...},
#           measures[0] com os 6 campos 5W2H, campos eSocial (noxiousAgentCode, measurementUnit,
#           concentrationIntensity, exposureTime).
```

**Sem N+1**: subir o Postgres com `-c log_statement=all` e conferir que a consolidada emite **6**
queries, independentemente da quantidade de GES/riscos.

**Fallbacks**: remover o `pgr_ges` (→ `ges: []`), o `epi_risk` (→ `epis: []`), a avaliação
(→ `assessment: null`, risco vai para o fim da ordenação) e a medida (→ `measures: []`) — nenhum
deve gerar erro.

## 6. Assinatura — solicitação protegida

```bash
# criar solicitação → 201
curl -i -X POST "$BASE/api/v1/pgr/$PGR_A/signature" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" -d '{}'
# → 201 { "requestId": "...", "publicUrl": "https://.../assinar/<TOKEN>", "qrCodeDataUrl": "data:image/png;..." }
#
#   ⚠️ COPIE O LINK AGORA. O token cru NÃO é persistido (só o hash sha-256) — ele não poderá ser
#      exibido novamente (D12). A UI mostra literalmente:
#         "Copie este link agora. Por segurança, ele não poderá ser exibido novamente."
#      Ao recarregar /pgr/[id], o painel mostra APENAS o estado — nunca o link.
#      Gerar outro link cria NOVA solicitação e consome MAIS UMA unidade da cota (FR-037).
#      O token nunca aparece em logs nem em metadata de auditoria.

# estado derivado → pending (o `pgr` NÃO tem coluna de status)
curl -s "$BASE/api/v1/pgr/$PGR_A/signature" -H "x-dev-tenant: org_a" -H "x-dev-role: owner"
# → { "state": "pending", "requestId": "...", "expiresAt": "...", "signedAt": null, "signerName": null }

# cross-tenant → 404 (antes de qualquer escrita)
curl -i -X POST "$BASE/api/v1/pgr/$PGR_B/signature" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" -d '{}'   # 404

# papel client → 403
curl -i -X POST "$BASE/api/v1/pgr/$PGR_A/signature" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: client" -d '{}'  # 403
```

**Payload público — conferir que não vaza PII** (via conexão admin, no banco efêmero):

```sql
select payload from public.signature_requests where target_type = 'pgr' order by created_at desc limit 1;
-- DEVE ter apenas: documentTitle, companyName, workUnitName, responsibleName, issuedAt, validUntil, revisionNumber
-- NÃO PODE ter: orgId, pgrId, ids de GES/riscos, employees, CPF, e-mail, telefone, matrícula,
--               listas de riscos/medidas/EPIs, dados de plano.
```

## 7. Cota compartilhada → **402**

```bash
# org_a é `free` (limite 10/mês) e o contador NÃO filtra target_type:
# pedidos de PGR e de `demo` somam no MESMO contador.
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/pgr/$PGR_A/signature" \
    -H 'content-type: application/json' -H "x-dev-tenant: org_a" -H "x-dev-role: owner" -d '{}'
done
# → dez 201 e depois 402 (QUOTA_EXCEEDED)

# org_b é `pro` → nunca bloqueia
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/pgr/$PGR_B/signature" \
  -H 'content-type: application/json' -H "x-dev-tenant: org_b" -H "x-dev-role: owner" -d '{}'   # 201
```

## 8. Rota pública — **sem Clerk**

```bash
# 1) a rota TEM de ser pública (é a correção do proxy.ts — sem ela, 307 para o sign-in)
curl -i -s -o /dev/null -w "%{http_code}\n" "$BASE/assinar/$TOKEN"      # → 200 (não 307)

# 2) no-store
curl -sI "$BASE/assinar/$TOKEN" | grep -i cache-control                 # → no-store

# 3) token inválido ≡ inexistente (anti-enumeração): MESMA página "Link inválido"
curl -s "$BASE/assinar/token-que-nao-existe" | grep -o "Link inválido"

# 4) demais rotas continuam protegidas
curl -i -s -o /dev/null -w "%{http_code}\n" "$BASE/pgr"                 # → 307 (sign-in)
```

Assinar: abrir `$BASE/assinar/$TOKEN` **em janela anônima** (sem sessão Clerk), conferir que a página
mostra **apenas** o resumo mínimo (título, empresa, obra, responsável, datas, nº da revisão) — **nenhum
funcionário, nenhum risco, nenhuma medida** —, desenhar a assinatura, informar o nome e confirmar.

**Replay**: recarregar o mesmo link → "Link já utilizado"; reenviar → `ALREADY_USED`, **sem escrita**.

**Expirado**: criar um pedido com `ttlSeconds: 1`, esperar, abrir → "Link expirado", **sem escrita**.

**Estado após assinar**:

```bash
curl -s "$BASE/api/v1/pgr/$PGR_A/signature" -H "x-dev-tenant: org_a" -H "x-dev-role: owner"
# → { "state": "signed", "signedAt": "...", "signerName": "..." }
```

E confirmar que o `pgr` **não mudou**:

```sql
select * from public.pgr where id = '<PGR_A>';   -- 11 colunas, nenhuma de status/assinatura
```

## 9. Playwright MCP (UI)

- **Protegida** (`/pgr/[id]`): editor em abas montado; navegar Informações básicas · GES · Revisões ·
  Consolidada; abas Cor/Sumário e GED **desabilitadas**; criar revisão (número aparece sozinho);
  gerar link de assinatura e copiar; estado `Aguardando`.
  → **Pode ficar bloqueada sem credencial Clerk** — se for o caso, **documentar** e validar por cURL.
- **Pública** (`/assinar/[token]`): **testável sem Clerk** — abrir, ver o resumo mínimo, assinar; depois
  token usado → "Link já utilizado"; token expirado → "Link expirado".

## 10. Postman — validação automática

```bash
node -e "JSON.parse(require('fs').readFileSync('docs/api/sst-manager.postman_collection.json','utf8')); console.log('Postman JSON OK')"

# Pastas de plataforma preservadas/restauradas
node -e "
const c=JSON.parse(require('fs').readFileSync('docs/api/sst-manager.postman_collection.json','utf8'));
const folders=c.item.map(x=>x.name);
for (const f of ['Perfil (plataforma)','Equipe (plataforma)','Dashboard (plataforma)']) {
  console.log(folders.includes(f) ? 'OK    '+f : 'FALTA '+f);
}
"

# Todos os endpoints (backfill da 019 + os novos da 022) presentes na coleção
node -e "
const fs=require('fs');
const c=JSON.parse(fs.readFileSync('docs/api/sst-manager.postman_collection.json','utf8'));
const reqs=[];
(function walk(items,p){p=p||[];for(const i of items||[]){const cur=p.concat([i.name||'(sem nome)']);
  if(i.request) reqs.push({m:i.request.method,path:cur.join(' > '),raw:(i.request.url&&i.request.url.raw)||'',
                           body:(i.request.body&&i.request.body.raw)||''});
  if(i.item) walk(i.item,cur);}})(c.item);
// Regex, nao substring: '/ges' casaria com o recurso /api/v1/ges (13 requests), que e OUTRO.
const expected=[
  ['/api/v1/profile',            /\/api\/v1\/profile/],
  ['/api/v1/team',               /\/api\/v1\/team/],
  ['/api/v1/dashboard/summary',  /\/api\/v1\/dashboard\/summary/],
  ['PGR revisions',              /\/api\/v1\/pgr\/[^/]+\/revisions/],
  ['PGR ges (vinculo)',          /\/api\/v1\/pgr\/[^/]+\/ges/],
  ['PGR consolidated',           /\/api\/v1\/pgr\/[^/]+\/consolidated/],
  ['PGR signature',              /\/api\/v1\/pgr\/[^/]+\/signature/],
  ['pagina publica /assinar',    /\/assinar\//],
];
for (const [label, re] of expected) {
  const m=reqs.filter(r=>re.test(r.raw));
  console.log(label.padEnd(28), m.length ? 'OK ('+m.length+')' : 'MISSING');
}
// O body VALIDO de criacao de revisao NAO pode conter revisionNumber.
// Deve existir EXATAMENTE 1 request negativo que o contenha (o exemplo de 422).
const revPosts=reqs.filter(r=>r.m==='POST' && r.raw.includes('/revisions'));
const withNum=revPosts.filter(r=>r.body.includes('revisionNumber'));
console.log('POST /revisions:', revPosts.length, '| com revisionNumber (esperado 1 = exemplo 422):', withNum.length);
"

# nenhum marcador de conflito
git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- docs/api/ || echo 'sem marcadores OK'
```

## 11. Gates finais

```bash
npx prettier --check "src/**/*.{ts,tsx}" "docs/api/*" ".specs/022-pgr-revisions-signature/**/*.md"
npm run lint && npm run typecheck && npm run test && npm run test:integration && npm run build
npm run db:generate      # → "No schema changes"  (prova do zero-migration)
git diff --check
git diff --name-status -- src/shared/db/schema src/shared/db/migrations   # → VAZIO
```

> Se o harness **REST-via-Jest** devolver 500 (limitação **pré-existente**, documentada em
> `rest-pgr-editor.test.ts:5-6`), registrar a baseline e **validar por cURL real** (§4–§8). Não é
> regressão desta fatia — comparar com o comportamento em `develop` antes de concluir isso.

## 12. Limpeza

```bash
docker rm -f sst-022-pg
```
