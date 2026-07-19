# Contract — Document Storage (`integrations/storage/documents-storage.ts`)

Wrapper server-only sobre o Supabase Storage. Cliente **admin** (`getRlsBypassingSupabaseClient`, `SUPABASE_SECRET_KEY`). Bucket privado **`documents`** (provisionado). Nenhuma leitura de dado de negócio no DB passa por aqui — só o binário.

## Path

```
<org_id>/documentos/<document_group_id>/v<version>-<slug(name)>
```

`org_id` **sempre** de `requireOfficeStaff()` (nunca do input). `slug(name)` normaliza o nome do arquivo (sem acentos/espaços) preservando a extensão.

## Funções

| Função                 | Assinatura                                                     | Comportamento                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `putDocumentObject`    | `(orgId, groupId, version, file) → { storagePath, sizeBytes }` | valida já feita a montante; faz `upload` no path; retorna referência e tamanho. Erro do provedor → propaga (mapeado a erro genérico, sem vazar detalhe). |
| `removeDocumentObject` | `(storagePath) → void`                                         | remove 1 objeto (compensação quando o INSERT falha; e futura exclusão de documento se desejado).                                                         |

## Regras

- **Bucket privado**: sem URL pública; download por URL assinada é a #35 (fora de escopo). Este contrato não expõe leitura de conteúdo.
- **Compensação**: o repositório chama `removeDocumentObject` no `catch` do INSERT (consistência — research §4).
- **Segredo server-only**: `SUPABASE_SECRET_KEY` só no servidor (Constituição, Princípio V). O módulo é `import "server-only"`.
- **Testes**: unit com o client mockado (ordem upload→insert→compensação); integração mocka este wrapper (não bate no Storage real).
