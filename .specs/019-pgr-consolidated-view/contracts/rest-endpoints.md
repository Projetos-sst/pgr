# Contract — REST (PGR editor: GES-link, revisões, consolidada)

Arquivos NOVOS sob `src/app/api/v1/pgr/[id]/**`. Todos via `restHandler` (auth real ou bypass dev;
mapeia código→HTTP; 201/204). Cada handler declara `runtime="nodejs"` e `dynamic="force-dynamic"`.
Reutilizam os **mesmos** repositórios/validação das Server Actions; **não** chamam `revalidatePath`.
Verbos **reduzidos e justificados** (associação / append-only / read-only) — ver research D9.

## Endpoints

| Método · Rota | Ação | Sucesso |
| --- | --- | --- |
| `GET /api/v1/pgr/{id}/ges` | lista GES vinculados | 200 `PgrGesLinkItem[]` |
| `POST /api/v1/pgr/{id}/ges` | adiciona vínculo (corpo `{ gesId }`) | 201 `PgrGes` |
| `DELETE /api/v1/pgr/{id}/ges/{gesId}` | remove o vínculo (não apaga o GES) | 204 |
| `GET /api/v1/pgr/{id}/revisions` | lista revisões | 200 `PgrRevisionListItem[]` |
| `POST /api/v1/pgr/{id}/revisions` | cria revisão (append-only) | 201 `PgrRevision` |
| `GET /api/v1/pgr/{id}/consolidated` | visão consolidada read-only | 200 `PgrConsolidated` |

**Sem** PUT em `ges` (vínculo sem campos). **Sem** PUT/DELETE em `revisions` (append-only). `{id}`
= **pgrId**; `{gesId}` = **gesId** (par do vínculo). Sem endpoint de dependentes.

## `src/app/api/v1/pgr/[id]/ges/route.ts`

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export function GET(req, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    return listPgrGes(tenantId, pgrId);
  });
}
export function POST(req, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    const { gesId } = pgrGesInputSchema.parse(await req.json());
    return addGesToPgr(tenantId, pgrId, gesId);
  }, { status: 201 });
}
```

## `src/app/api/v1/pgr/[id]/ges/[gesId]/route.ts`

```ts
type Ctx = { params: Promise<{ id: string; gesId: string }> };
export function DELETE(req, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId, gesId } = await params;
    const deleted = await removeGesFromPgr(tenantId, pgrId, gesId);
    if (!deleted) throw new NotFoundError();
  }, { status: 204 });
}
```

## `src/app/api/v1/pgr/[id]/revisions/route.ts`

```ts
export function GET(req, { params }) { /* getPgrById→404; return listPgrRevisions */ }
export function POST(req, { params }) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    const values = pgrRevisionInputSchema.parse(await req.json());
    return createPgrRevision(tenantId, pgrId, values);
  }, { status: 201 });
}
```

## `src/app/api/v1/pgr/[id]/consolidated/route.ts`

```ts
export function GET(req, { params }) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    const data = await getPgrConsolidated(tenantId, pgrId);
    if (!data) throw new NotFoundError();
    return data;
  });
}
```

## Contratos de payload

### Body `POST /ges`

```json
{ "gesId": "11111111-1111-1111-1111-1111111111a2" }
```

### Body `POST /revisions`

```json
{ "revisionNumber": 2, "revisedAt": "2026-07-12", "notes": "Revisão anual" }
```

`revisionNumber` inteiro ≥1; `revisedAt` `AAAA-MM-DD`; `notes` opcional. **Não** enviar `orgId`/
`pgrId` (sessão/rota). Campos extras ignorados.

### Respostas

- 200 (list/consolidada), 201 (add vínculo/create revisão) → JSON. 204 (remove vínculo) → sem corpo.
- Erro → `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

## Mapeamento código → HTTP (`HTTP_BY_CODE`)

| Situação | Código | HTTP |
| --- | --- | --- |
| PGR inexistente/cross-tenant | `NOT_FOUND` | **404** |
| GES inexistente/cross-tenant (POST /ges) | `FK_NOT_FOUND` | **422** |
| vínculo GES duplicado (POST /ges) | `DUPLICATE` | **409** |
| revisão nº duplicado (POST /revisions) | `DUPLICATE` | **409** |
| `gesId`/`revisionNumber`/`revisedAt` inválidos | `VALIDATION` | **422** |
| papel `client` | `FORBIDDEN` | **403** |
| sem tenant | `NO_TENANT_CONTEXT` | **403** |

> `DUPLICATE`/409 vem **automaticamente** do 23505 das UNIQUE `uq_pgr_ges_*` / `uq_pgr_revisions_*`
> (mapeado por `toActionError`) — os handlers não tratam explicitamente.

## Auth (herdada de `restHandler`)

- Produção: `requireOfficeStaff()`.
- Dev/homolog: bypass `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` + headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`. Usado nos testes REST e no cURL.

## Limitação conhecida (harness REST-via-Jest)

Pode falhar com 500 (pré-existente; provado em 014/016/018). Se ocorrer, documentar e validar o REST
**autoritativamente por cURL** contra o dev server no Postgres efêmero (ver `quickstart.md`).
