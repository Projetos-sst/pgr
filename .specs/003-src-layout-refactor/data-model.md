# Data Model — Reorganização `src/` e refatoração

Esta fatia **não altera o schema do banco**. As entidades de persistência permanecem exatamente
como em [`002-drizzle-memberships/data-model.md`](../002-drizzle-memberships/data-model.md).

## Entidades de persistência (inalteradas — referência)

| Entidade          | Resumo                                                             | RLS                                              |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `users`           | Usuário sincronizado do Clerk (id, email, first/last name, image). | Select self (`auth.jwt() ->> 'sub'`).            |
| `orgs`            | Organização do Clerk (id, name, slug, image).                      | Select da org ativa (`auth.jwt() ->> 'org_id'`). |
| `org_memberships` | Vínculo usuário×organização (PK composta `org_id,user_id`, role).  | Select da org ativa.                             |

Detalhes de colunas, triggers (`set_updated_at`), papel `app_runtime` e políticas RLS em `002`.

## Tipos de código introduzidos nesta fatia

Não são entidades de banco — são contratos internos pequenos criados pela refatoração:

- **`NO_STORE_HEADERS`** (`src/lib/http/no-store.ts`): registro imutável de cabeçalhos
  (`Cache-Control`, `Pragma`, `Expires`) — fonte única para respostas não-cacheáveis.

## Modelo de layout de módulos (entregável estrutural)

A "estrutura" é o entregável central desta fatia:

- **Aplicação** sob `src/` — `app/` (rotas), `lib/` (agrupamento técnico), `proxy.ts`, `__tests__/`.
- **Raiz** — apenas configuração, tooling (`.scripts/`), assets (`public/`) e documentação.
- **Alias** `@/*` → `./src/*` (único ponto de resolução; imports inalterados).
- **Guard de bundle** — regra ESLint `no-restricted-imports` impede `@/lib/db` em
  `src/app`/`src/components` (exceto route handlers / `src/app/api/**`).
- **Banco** — operado por Drizzle nativo (`drizzle-kit migrate`); sem scripts em `.scripts/`.
