# Contract — REST & rota pública (Feature 022)

Decisão-chave (research D10), tomada **depois** de auditar a infra: **o fluxo protegido ganha REST; o
fluxo público não.** Razões factuais:

1. `restHandler` (`api/rest.ts:85`) chama `resolveContext` → `requireOfficeStaff()`. Ele **não pode**
   embrulhar uma rota pública — exigiria sessão.
2. Os códigos que `submitPublicSignature` devolve (`ALREADY_USED`, `EXPIRED`) **não existem** em
   `HTTP_BY_CODE` — cairiam num 400 silencioso.
3. **Precedente da casa** (fatia 012, `api-design.md:54-69`): o fluxo público é documentado como
   **página**, e o Postman registra o `GET` da página deixando claro que a confirmação é Server Action.

---

## 1. Protegido — `src/app/api/v1/pgr/[id]/signature/route.ts` (**NOVO**)

`export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
Aninhamento igual ao já usado em `/pgr/[id]/revisions`, `/pgr/[id]/consolidated`, `/risks/[id]/epis`.

| Verbo  | Rota                         | Body                                   | Sucesso                                           |
| ------ | ---------------------------- | -------------------------------------- | ------------------------------------------------- |
| `POST` | `/api/v1/pgr/{id}/signature` | `{ "ttlSeconds"?: number }` (opcional) | **201** `{ signature, publicUrl, qrCodeDataUrl }` |
| `GET`  | `/api/v1/pgr/{id}/signature` | —                                      | **200** `PgrSignatureView` (sem token, sem URL)   |

```ts
// POST — cria a solicitação. Payload montado NO SERVIDOR (nunca vem do cliente).
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id: pgrId } = await params; // pgrId vem do PATH, nunca do body
      const body = await req.json().catch(() => ({}));
      const opts = pgrSignatureRequestSchema.parse(body); // .strict()
      return createPgrSignature(ctx, pgrId, opts); // MESMO core da Server Action
    },
    { status: 201 },
  );
}

// GET — estado derivado. Nunca lê o `pgr` em busca de status (não existe coluna).
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id: pgrId } = await params;
    return getPgrSignatureView(ctx, pgrId); // MESMO core da Server Action
  });
}
```

> `createPgrSignature` / `getPgrSignatureView` são declaradas em
> **`src/shared/server/pgr/pgr-signature-core.ts`** (ver `contracts/server-actions.md` §3) e são
> compartilhadas com as Server Actions. O handler REST **não** re-implementa guard, montagem de payload,
> cota nem derivação de estado — **a regra vive uma única vez**.

### Body do `POST` — campos permitidos e proibidos

`pgrSignatureRequestSchema` é **`.strict()`**:

```json
{ "ttlSeconds": 86400 }
```

| Campo                                          | Permitido?  | Observação                                                                           |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `ttlSeconds`                                   | ✅ opcional | Reusa a regra da infra (`int().positive()`, default 72 h). **Sem máximo inventado.** |
| `payload`                                      | ❌          | Montado **no servidor** — jamais aceito do cliente                                   |
| `pgrId`                                        | ❌          | Vem do **path**                                                                      |
| `targetType` / `targetId`                      | ❌          | Definidos pelo core (`"pgr"` / `pgrId`)                                              |
| `orgId` / `organizationId` / `organization_id` | ❌          | Tenant **sempre** da sessão                                                          |

Qualquer campo extra → **`VALIDATION` (422)** pelo `.strict()`.

### Resposta

- **`POST` → 201**: `{ signature: PgrSignatureView, publicUrl, qrCodeDataUrl }`.
  ⚠️ `publicUrl` existe **apenas nesta resposta** — o token cru não é persistido (D12) e a URL **não é
  reconstruível** depois.
- **`GET` → 200**: `PgrSignatureView` — **nunca** contém token nem URL.

### Erros (todos reusados — nenhum código novo)

| Situação                                 | Código           | HTTP    |
| ---------------------------------------- | ---------------- | ------- |
| PGR inexistente ou de **outro tenant**   | `NOT_FOUND`      | **404** |
| Papel `client`                           | `FORBIDDEN`      | **403** |
| **Cota mensal do plano `free` esgotada** | `QUOTA_EXCEEDED` | **402** |
| `ttlSeconds` inválido                    | `VALIDATION`     | **422** |
| Sem sessão / sem bypass dev              | `UNAUTHORIZED`   | 401     |

Todos já em `HTTP_BY_CODE` (`api/rest.ts:14-30`).

---

## 2. Protegido — rotas existentes que mudam de **contrato de entrada**

### `POST /api/v1/pgr/{id}/revisions` — **BREAKING (intencional)**

`src/app/api/v1/pgr/[id]/revisions/route.ts` **não muda de código** (ele já faz
`pgrRevisionInputSchema.parse(await req.json())`), mas o **schema muda** e o contrato acompanha:

| Antes                                                              | Depois                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| `{ "revisionNumber": 2, "revisedAt": "2026-07-14", "notes": "…" }` | `{ "revisedAt": "2026-07-14", "notes": "…" }`        |
| Número **vinha do cliente**                                        | Número **calculado no servidor** (`max+1`, sob lock) |

- **201** com a revisão criada, **incluindo o `revisionNumber` calculado pelo servidor**.
- `revisionNumber` enviado pelo cliente → **`VALIDATION` (422)**. O schema é **`.strict()`**: o campo é
  **proibido**, não ignorado. Um cliente desatualizado **falha visivelmente** em vez de acreditar que
  controla o número (FR-005).
- **Concorrência**: duas requisições `POST` paralelas para o **mesmo** PGR devolvem **`201` + `201`**,
  com números **consecutivos**. **Não esperar `409` neste cenário.**
- **409 `DUPLICATE`**: permanece mapeado, mas **apenas como backstop defensivo** da UNIQUE (colisão
  inesperada) — não é o desfecho do fluxo concorrente normal.
- **404** PGR inexistente/cross-tenant · **422** validação (`revisedAt`) · **403** papel `client`.
- `GET /api/v1/pgr/{id}/revisions` — **sem mudança** (200, lista ordenada por número desc).

### `GET /api/v1/pgr/{id}/consolidated` — **sem mudança de contrato de entrada**

Continua **200** com `PgrConsolidated`. O **payload de saída engorda**: cada risco passa a trazer
`epis[]`, `assessment` detalhada e os campos eSocial; cada medida, o **5W2H completo**. Nenhum campo é
removido (a 019 continua satisfeita).

---

## 3. Público — **página, não REST**

| Rota                   | Auth           | Comportamento                                                                                                                   |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /assinar/{token}` | **só o token** | Renderiza o formulário do `target_type` pelo registry · `invalid` / `expired` / `used` viram **páginas de negócio** (nunca 500) |
| (submissão)            | **só o token** | Server Action `submitPublicSignature(token, { signerName, imageDataUrl })` — POST-only por design do Next, não é REST           |

- **Sem sessão Clerk. Sem bypass dev. Sem checagem de plano.**
- Tenant derivado **do token** (policy de capability), nunca de `orgId`/`organizationId` do cliente.
- **Anti-enumeração**: token inexistente e token adulterado → **ambos** `invalid`, mesma mensagem.
- **Uso único / replay**: `consumeAndCapture` faz `UPDATE … WHERE used_at IS NULL` → segundo envio
  devolve `ALREADY_USED`, **sem escrita**.
- `cancelled` aparece como `used` (comportamento real do resolvedor — mantido).
- A página **não consulta o PGR ao vivo**: renderiza o `payload` congelado. Nenhuma consulta a
  `employees`, GES, riscos ou consolidada.

### Pré-requisito bloqueante — `src/proxy.ts` (**EDIT**)

Hoje o matcher público cobre **só** `/sign/(.*)` (do EPI). Sem esta correção a rota é interceptada por
`auth.protect()` e a US5 é inalcançável:

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sign/(.*)", // EPI (fatia 012)
  "/assinar/(.*)", // ← NOVO: assinatura genérica (fatia 010) — credencial é o token
  "/api/webhooks/(.*)",
  ...(devApiBypass ? ["/api/v1/(.*)"] : []),
]);

const NO_STORE_PATH_PREFIXES = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/sign/",
  "/assinar/", // ← NOVO: nunca cachear o estado do pedido
  "/dashboard",
];
```

Nenhuma abertura ampla: o matcher é exatamente o prefixo da rota pública. Teste obrigatório em
`src/__tests__/integration/auth/proxy-protection.test.ts` provando que `/assinar/x` é pública **e** que
as demais continuam protegidas.

---

## 4. Documentação obrigatória — **backfill da 019 + a superfície nova da 022**

> ⚠️ **Achado da review final.** A superfície REST da **Feature 019 nunca foi documentada**. O
> `api-design.md` tem **apenas** `` `/pgr` · `/pgr/{id}` `` (linha 122) — **não existe** linha para
> `revisions`, `ges` ou `consolidated`. O Postman, na pasta `PGR`, tem **só os 5 requests do CRUD base**.
> Ou seja: 4 Route Handlers foram entregues com **zero** documentação e **zero** Postman.
>
> Portanto o verbo correto é **ADICIONAR**, não "atualizar" — **não há linha existente para atualizar**.

### Endpoints reais (auditados no código — nenhum inventado)

| Método   | Endpoint                        | Handler real                      | Contrato                                                                           |
| -------- | ------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/pgr/{id}/revisions`    | `revisions/route.ts`              | **200** — lista ordenada por número **desc**; sem paginação                        |
| `POST`   | `/api/v1/pgr/{id}/revisions`    | `revisions/route.ts`              | **201** — body `{revisedAt, notes?}`; nº **calculado no servidor** _(muda na 022)_ |
| `GET`    | `/api/v1/pgr/{id}/ges`          | `ges/route.ts`                    | **200** — vínculos PGR↔GES (`pgr_ges` ⨝ `ges`), ordenados por nome                 |
| `POST`   | `/api/v1/pgr/{id}/ges`          | `ges/route.ts`                    | **201** — body `{gesId}`; duplicado → **409**; GES de outro tenant → **422**       |
| `DELETE` | `/api/v1/pgr/{id}/ges/{gesId}`  | `ges/[gesId]/route.ts`            | **204** — remove só o vínculo; inexistente → **404**                               |
| `GET`    | `/api/v1/pgr/{id}/consolidated` | `consolidated/route.ts`           | **200** — `PgrConsolidated`; inexistente/cross-tenant → **404**                    |
| `POST`   | `/api/v1/pgr/{id}/signature`    | `signature/route.ts` _(**NOVO**)_ | **201** — body `{ttlSeconds?}`; cota esgotada → **402**                            |
| `GET`    | `/api/v1/pgr/{id}/signature`    | `signature/route.ts` _(**NOVO**)_ | **200** — `PgrSignatureView`                                                       |

Todos sob `restHandler` (office staff; bypass dev fora de produção). Nenhum aceita `orgId` do cliente.

### `docs/api/api-design.md` — **EDIT**

1. **ADICIONAR** à tabela "Recursos" as linhas **ausentes da Feature 019** (backfill):
   `/pgr/{id}/revisions` · `/pgr/{id}/ges` · `/pgr/{id}/ges/{gesId}` · `/pgr/{id}/consolidated`,
   com os verbos e códigos da tabela acima.
2. **DOCUMENTAR**, na linha de `/pgr/{id}/revisions`, o **contrato novo**: o `POST` **não aceita**
   `revisionNumber` (schema **estrito**) — enviá-lo → **`VALIDATION` / 422**; o número é calculado
   **exclusivamente no servidor** (`max+1` sob lock). Concorrência no mesmo PGR → **201 + 201**, números
   **distintos e consecutivos**. **409 `DUPLICATE`** permanece apenas como **backstop inesperado**.
3. **ADICIONAR** a linha nova da 022: `/pgr/{id}/signature` → `POST` (cria solicitação; **402**
   `QUOTA_EXCEEDED` na cota do `free`) · `GET` (estado **derivado**
   `none|pending|signed|expired|cancelled`; **sem coluna no `pgr`**).
4. **ADICIONAR** a seção **"Rota pública de assinatura do PGR — `/assinar/{token}`"**, espelhando a da
   fatia 012 (`:54-69`): credencial = token de 256 bits **persistido só como hash**; TTL 72 h; uso
   único; estados `signable|invalid|expired|used`; anti-enumeração; `Cache-Control: no-store`; a
   submissão é **Server Action** (**sem espelho REST de propósito** — o token é credencial de escrita).
5. **ADICIONAR** ao sumário de actions: `Assinatura do PGR` → `actions/pgr/pgr-signature.ts`.
6. **PRESERVAR** tudo o que já existe (Perfil, Equipe, Dashboard e as demais linhas).

> **Semântica intocada**: os endpoints da 019 (GES e consolidada) são **apenas documentados** — nenhum
> deles muda de comportamento nesta fatia. A **única** mudança de contrato é a criação de revisão.

### `docs/api/sst-manager.postman_collection.json` — **EDIT**

**Ordem final das pastas de plataforma**: `Perfil (plataforma)` → `Equipe (plataforma)` →
`Dashboard (plataforma)` → … → `Assinatura do PGR (022)` → `Integracoes externas`.

1. **PRESERVAR** `Perfil (plataforma)` (2 requests) e `Equipe (plataforma)` (4 requests).
2. **RESTAURAR** `Dashboard (plataforma)` com `GET /dashboard/summary (agregacoes do tenant)` —
   conteúdo literal recuperável de `git show 4601035:docs/api/sst-manager.postman_collection.json`:

```json
{
  "name": "Dashboard (plataforma)",
  "item": [
    {
      "name": "GET /dashboard/summary (agregacoes do tenant)",
      "request": {
        "method": "GET",
        "header": [
          { "key": "x-dev-tenant", "value": "{{devTenant}}" },
          { "key": "x-dev-role", "value": "{{devRole}}" }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/v1/dashboard/summary",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "dashboard", "summary"]
        }
      }
    }
  ]
}
```

3. **ADICIONAR (backfill da 019)** — na **pasta `PGR` já existente** (que hoje só tem os 5 requests do
   CRUD base), organizados em subgrupos, sem quebrar a estrutura atual da coleção:

   | Subgrupo            | Requests a adicionar                                                                                                           |
   | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
   | `PGR · GES`         | `GET /pgr/:id/ges` · `POST /pgr/:id/ges (201)` · `DELETE /pgr/:id/ges/:gesId (204)`                                            |
   | `PGR · Revisões`    | `GET /pgr/:id/revisions` · `POST /pgr/:id/revisions (201)` · **`POST /pgr/:id/revisions (revisionNumber proibido → 422)`**     |
   | `PGR · Consolidada` | `GET /pgr/:id/consolidated`                                                                                                    |
   | `PGR · Assinatura`  | `POST /pgr/:id/signature (201)` · `GET /pgr/:id/signature (estado derivado)` · `POST /pgr/:id/signature (cota esgotada → 402)` |

   Body do `POST /pgr/:id/revisions` **válido** (sem `revisionNumber`):

   ```json
   { "revisedAt": "2026-07-14", "notes": "Revisão anual" }
   ```

   Body do request **negativo** (exemplo de cliente desatualizado) → **422 `VALIDATION`**:

   ```json
   { "revisedAt": "2026-07-14", "notes": "Cliente antigo", "revisionNumber": 99 }
   ```

4. **ADICIONAR** o fluxo público como **página** (espelhando a pasta do EPI, sem inventar endpoint):
   `GET /assinar/:token (pagina publica)` — **sem** headers de tenant/role, com descrição explicando que
   a credencial é o token e que a confirmação é **Server Action**. Variável nova: `pgrSignToken`.
   **Nenhum Route Handler REST público é criado.**
5. **JSON válido**, arquivo **único**, **zero marcadores de conflito**.

---

## 5. Códigos HTTP em jogo

| Código  | Onde                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| **200** | `GET` de `/revisions`, `/ges`, `/consolidated`, `/signature`                                                        |
| **201** | `POST` de `/revisions`, `/ges`, `/signature`                                                                        |
| **204** | `DELETE /pgr/{id}/ges/{gesId}` (backfill da 019 — nenhum delete **novo** nesta fatia)                               |
| **402** | `QUOTA_EXCEEDED` — cota mensal de assinaturas do plano `free`                                                       |
| **403** | `FORBIDDEN` — papel `client`                                                                                        |
| **404** | `NOT_FOUND` — PGR inexistente/cross-tenant; vínculo GES inexistente                                                 |
| **409** | `DUPLICATE` — vínculo GES repetido; **e**, em revisões, **apenas backstop defensivo** (nunca da concorrência)       |
| **422** | `VALIDATION` (Zod: `ttlSeconds`, `revisedAt`, **`revisionNumber` proibido**) · `FK_NOT_FOUND` (GES de outro tenant) |

**Nenhum código novo.** Os estados do fluxo público (`invalid`/`expired`/`used`) **não são HTTP** —
são páginas de negócio.
