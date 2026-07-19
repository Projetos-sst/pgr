# Contract — REST API mirror (`/api/v1`)

Envolvido por `restHandler` (gate `requireOfficeStaff` + dev-bypass não-prod; mapa `HTTP_BY_CODE`). Reutiliza os **mesmos** repositórios, zod e `toActionError` das Server Actions — sem re-implementar regra. `201` create, `204` delete. Só superfície testável por Postman/cURL.

## `/api/v1/documents`

| Método   | Rota                                                        | Ação                                                                       | Sucesso               | Corpo                                                       |
| -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `GET`    | `/documents?folderId&search&docType&validity&page&pageSize` | listar (1 linha/grupo) + KPIs + breadcrumb + pastas filhas                 | `200`                 | `{ rows, total, kpis, breadcrumb, folders }`                |
| `POST`   | `/documents`                                                | criar/upload                                                               | `201`                 | `multipart/form-data` (file + metadados) → `DocumentDetail` |
| `GET`    | `/documents/[id]`                                           | detalhar                                                                   | `200` / `404`         | `DocumentDetail`                                            |
| `PUT`    | `/documents/[id]`                                           | editar metadados                                                           | `200` / `404`         | `updateDocumentSchema` → `DocumentDetail`                   |
| `DELETE` | `/documents/[id]`                                           | excluir (grupo inteiro — todas as versões; Storage best-effort pós-commit) | `204` / `404`         | —                                                           |
| `POST`   | `/documents/[id]/versions`                                  | publicar nova versão                                                       | `201` / `404` / `409` | `multipart/form-data` (file) → `DocumentDetail`             |
| `POST`   | `/documents/[id]/move`                                      | mover                                                                      | `200` / `404` / `422` | `{ folderId: uuid\|null }`                                  |

## `/api/v1/folders`

| Método | Rota                | Ação                         | Sucesso               | Corpo                               |
| ------ | ------------------- | ---------------------------- | --------------------- | ----------------------------------- |
| `GET`  | `/folders?parentId` | árvore (filhas + breadcrumb) | `200`                 | `{ folders, breadcrumb }`           |
| `POST` | `/folders`          | criar                        | `201` / `409` / `422` | `createFolderSchema` → `FolderNode` |
| `PUT`  | `/folders/[id]`     | renomear                     | `200` / `404` / `409` | `renameFolderSchema` → `FolderNode` |

## Mapa de erros (já em `api/rest.ts`)

`VALIDATION`→422 · `DUPLICATE`→409 · `FK_NOT_FOUND`→422 · `NOT_FOUND`→404 · `FORBIDDEN`→403 · `NO_TENANT_CONTEXT`→403 · `UNAUTHORIZED`→401. Nenhum código novo.

**Nota**: upload REST lê `await req.formData()`. `bodySizeLimit` de Server Actions elevado para 25mb (Route Handlers não têm o mesmo limite, mas mantém-se a validação de 25 MB no servidor). Não há endpoint de download (URL assinada = #35). `/documents/[id]/dependents` **não** se aplica (documento não é referenciado por FK de entrada nesta fatia).
