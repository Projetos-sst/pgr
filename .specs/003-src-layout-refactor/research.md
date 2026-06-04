# Research — Reorganização `src/` e refatoração

Decisões técnicas tomadas e resolvidas nesta fatia. Formato: Decisão · Rationale · Alternativas.

## R1 — Layout `src/` para o App Router

- **Decisão**: Mover `app/`, `lib/`, `proxy.ts` e `__tests__/` para `src/`. A raiz fica só com
  configuração e tooling.
- **Rationale**: O Next.js suporta `src/app` nativamente (doc oficial `02-project-structure.md`,
  `src-folder`). Separa código de aplicação de configuração, reduzindo o ruído na raiz — a motivação
  original do usuário.
- **Alternativas**:
  - _Manter tudo na raiz_: rejeitado — não resolve a "bagunça" relatada.
  - _Reorganização DDD (`domains/`, `shared/`)_: rejeitado por YAGNI — existe ~1 domínio real
    (memberships); criar fronteiras de domínio agora é abstração prematura.

## R2 — Reapontar o alias `@/*` para `./src/*`

- **Decisão**: `tsconfig.paths`, `jest` (moduleNameMapper + swc paths) passam `@/*` → `./src/*`.
- **Rationale**: Como todo import já usa `@/...`, reapontar o alias faz a migração de pastas sem
  alterar **nenhuma** linha de import. O impacto fica contido em 4 configs.
- **Alternativas**: _Imports relativos_: rejeitado — quebraria muitos arquivos e reduz legibilidade.
- **Consequência**: conflita com a Constituição (que diz `@/*` → raiz). Registrado no plano para
  emenda PATCH.

## R3 — Localização do `proxy.ts` (middleware Next 16) com `src/`

- **Decisão**: Mover para `src/proxy.ts`.
- **Rationale**: Doc oficial (`16-proxy.md`): o arquivo deve ficar na raiz do projeto **ou** dentro
  de `src`, no mesmo nível de `app`. Como `app` foi para `src/app`, `proxy.ts` acompanha.
- **Alternativas**: _Deixar na raiz_: válido pela doc, mas inconsistente com `app` em `src`.

## R4 — Remover comentários convertendo "porquê" em código (Fowler)

- **Decisão**: Eliminar os três comentários de "porquê" do código de produção, preservando a
  informação em identificadores:
  - opções não óbvias do pooler → constante `SUPAVISOR_TRANSACTION_POOLER_OPTIONS`;
  - ordem de upsert dependente de FK no webhook → função `upsertMembershipWithParents()`;
  - client Supabase que ignora RLS → rename `getSupabaseAdminClient` → `getRlsBypassingSupabaseClient`.
- **Rationale**: Refatoração de Fowler — preferir tornar o código óbvio a comentá-lo. O nome carrega
  a intenção e não envelhece como um comentário paralelo.
- **Alternativas**: _Apagar os comentários sem refatorar_: rejeitado — perderia conhecimento; o
  comportamento deixaria de ser óbvio. _Manter os comentários_: contraria o objetivo do usuário.

## R5 — Remover os scripts pontuais (`.scripts/`) e o backfill

- **Decisão**: Remover a pasta `.scripts/` inteira (db-migrate, db-reset, backfill CLI, guard de
  bundle) e também a lógica de backfill (`src/lib/clerk/backfill-memberships.ts`) + seu teste de
  integração + o script `db:backfill`.
- **Rationale**: Eram operações pontuais (one-off) já executadas — o papel `app_runtime`, os triggers
  e o backfill de orgs/memberships já foram aplicados no banco e não se repetem. YAGNI: manter código
  one-off concluído é dívida morta.
- **Alternativas**: _Manter a lógica de backfill testada em `src/lib`_: rejeitado pelo usuário — a
  operação não será reexecutada. _Manter os scripts de DB_: rejeitado — DB passa a ser operado por
  comandos nativos do Drizzle (ver R8).

## R8 — Guard anti-leak de bundle como regra ESLint

- **Decisão**: Substituir o shell `check-no-db-in-client.sh` por uma regra `no-restricted-imports` na
  `eslint.config.mjs`, banindo `@/lib/db`/`@/lib/db/**` em `src/app`/`src/components`, com exceção
  para route handlers e `src/app/api/**`.
- **Rationale**: Mantém a proteção (Drizzle/Postgres fora do bundle do cliente) sem depender de um
  script em `.scripts/`; nativo do lint, roda no mesmo gate.
- **Diferença**: O shell liberava qualquer arquivo com diretiva `use server`/`server-only`; a regra
  ESLint libera por padrão de caminho (route/api). Hoje só o webhook importa `@/lib/db` (sob `api/`),
  então é equivalente. Um futuro Server Component que precise de DB direto deve ir via Server Action
  ou ser explicitamente isento.

## R9 — Migrations via Drizzle nativo

- **Decisão**: `db:migrate` passa a ser `drizzle-kit migrate` (remove o runner custom).
- **Rationale**: Operar o banco com o comando nativo do Drizzle. As migrations de schema futuras são
  geradas por `drizzle-kit generate` e aplicadas por `drizzle-kit migrate`.
- **Nota (caveat honesto)**: Apenas `0000` está no journal do Drizzle; os SQLs `0001` (triggers) e
  `0002` (papel `app_runtime`) **não** são aplicados por `drizzle-kit migrate`. Eles já foram
  aplicados no banco (one-off) e permanecem como `.sql` históricos usados pelo setup dos testes de
  integração (`applyMigrations` lê todos os `.sql`). Um banco novo do zero exigiria aplicá-los à parte.

## R6 — Fonte única para headers `no-store`

- **Decisão**: Centralizar em `src/lib/http/no-store.ts` (`NO_STORE_HEADERS`), consumido por
  `proxy.ts` e pela rota `whoami`.
- **Rationale**: DRY de configuração relevante para segurança/caching — uma definição evita
  divergência entre os pontos que a aplicam.
- **Alternativas**: _Unificar também o `next.config.ts`_: não feito — formato diferente (array de
  `{key,value}`) e acoplar a config de framework ao código de app traz risco sem ganho claro.

## R7 — Documento global de padrões de engenharia

- **Decisão**: Consolidar Clean Code, KISS, YAGNI, DRY, Fowler + padrões de código/arquitetura/IA/
  banco/testes/documentação em `~/.claude/CODE_STANDARDS.md`, referenciado no `CLAUDE.md` global.
- **Rationale**: Carregar as regras em toda sessão garante aplicação consistente.
- **Alternativas**: _Documento por repositório_: rejeitado — as regras são transversais a projetos.
