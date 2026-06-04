# Quickstart — Trabalhando com o layout `src/`

## Onde as coisas ficam

| Quero…                                               | Vá para                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Rotas, layouts, páginas                              | `src/app/`                                                                   |
| Middleware (Next 16)                                 | `src/proxy.ts`                                                               |
| Auth (guards, policy, sessão, erros)                 | `src/lib/auth/`                                                              |
| Persistência (Drizzle, schema, repos, migrations)    | `src/lib/db/`                                                                |
| Clients Supabase (admin/RLS-bypass, server, browser) | `src/lib/supabase/`                                                          |
| Mappers de eventos do Clerk                          | `src/lib/clerk/`                                                             |
| Headers HTTP compartilhados (`no-store`)             | `src/lib/http/`                                                              |
| Server Actions                                       | `src/lib/server/actions/`                                                    |
| Validação (zod)                                      | `src/lib/validation/`                                                        |
| Testes                                               | `src/__tests__/{unit,integration}/` (+ colocados em `src/lib/**/__tests__/`) |
| Operar o banco                                       | comandos `drizzle-kit` (`npm run db:*`)                                      |
| Config/tooling                                       | raiz (`tsconfig`, `jest.config`, `drizzle.config`, `next.config`, …)         |

## Mapa da migração (raiz → `src/`)

```text
app/         → src/app/
lib/         → src/lib/
proxy.ts     → src/proxy.ts
__tests__/   → src/__tests__/
```

Imports **não mudaram**: `@/*` agora resolve para `./src/*`.

## Configs tocadas pela migração

- `tsconfig.json` — `paths."@/*"` → `["./src/*"]`
- `jest.config.ts` — `moduleNameMapper` e `swc.paths` → `src/`; `testMatch` → `src/**`
- `drizzle.config.ts` — `schema`/`out` → `src/lib/db/...`
- `src/__tests__/integration/_helpers/db.ts` — `applyMigrations` lê `src/lib/db/migrations`
- `.prettierignore` — `src/lib/db/migrations`

## Comandos

```bash
npm run dev               # dev server (http://localhost:3000)
npm run lint              # eslint (inclui a regra anti-leak no-restricted-imports)
npx tsc --noEmit          # typecheck
npm run test              # unitários (Jest)
npm run test:integration  # integração (requer INTEGRATION_DATABASE_URL — Postgres efêmero)
npm run db:generate       # gera migration a partir do schema (drizzle-kit)
npm run db:migrate        # aplica migrations journaladas (drizzle-kit migrate)
npm run db:studio         # drizzle studio
```

## Variáveis de ambiente (banco)

| Variável               | Usuário        | Porta | Uso                                          |
| ---------------------- | -------------- | ----- | -------------------------------------------- |
| `DATABASE_URL`         | `app_runtime`  | 6543  | App em runtime (pooler, sujeito a RLS)       |
| `DATABASE_URL_UNPOOLED`| `postgres`     | 5432  | `drizzle-kit` (migrate, generate, studio)    |
| `INTEGRATION_DATABASE_URL` | qualquer   | —     | Testes de integração (branch efêmero)        |

**`drizzle.config.ts` lê `DATABASE_URL_UNPOOLED`** — conexão direta necessária para DDL.

## Passo de infra: criar o role `app_runtime` (Supabase SQL Editor — uma vez por projeto)

```sql
create role app_runtime login password '<senha>' nobypassrls noinherit;
```

Execute no **SQL Editor do Supabase** (não vai para versionamento). Depois, `npm run db:migrate`
aplica os grants de `0002_app_runtime_role.sql` normalmente.

## Gotchas

- **Cache do Next**: após mover pastas, limpe `.next/` (`rm -rf .next`) — tipos gerados antigos
  podem apontar para `app/` e falhar o typecheck até regenerar.
- **Guard de bundle (ESLint)**: importar `@/lib/db` em `src/app`/`src/components` falha o lint
  (`no-restricted-imports`), exceto em route handlers / `src/app/api/**`. Acesso a DB vai por
  repositório server-only chamado de route handler ou Server Action.
- **`app_runtime` deve existir antes de `db:migrate`**: a migration `0002` aplica grants ao role;
  se o role não existir, o `GRANT` falha. Execute o passo de infra acima antes do primeiro migrate.
- **Padrões de engenharia**: regras de Clean Code/KISS/YAGNI/DRY/Fowler em `~/.claude/CODE_STANDARDS.md`.

## Validação desta fatia (estado entregue)

`npx tsc --noEmit` · `npm run lint` · `npx prettier --check` · `npm run test` → todos verdes
(0 erros, 34/34 testes). `next build` completo não foi executado (depende de ambiente/rede);
recomenda-se um `npm run dev` para confirmar runtime.
