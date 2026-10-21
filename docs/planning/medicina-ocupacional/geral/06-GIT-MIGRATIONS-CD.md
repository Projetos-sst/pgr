# 06 — Git, migrations e CD

> Documento permanente. Workflows relidos em 2026-10-21 no checkout em `d6b787c` (= `origin/develop`).
> Fontes: `.github/workflows/cd.yml`, `.github/workflows/ci.yml`, `docs/deploy/vercel.md`,
> [AUDIT-ARCHITECTURE.md](../AUDIT-ARCHITECTURE.md) §4.8, [AUDIT-DATABASE.md](../AUDIT-DATABASE.md) §4.1 e §10.6.

> ## ALERTA OBRIGATÓRIO
>
> **Merge em `develop` aplica a migration no banco de HOMOLOGAÇÃO. Merge em `main` aplica a migration no banco de
> PRODUÇÃO.** Não existe passo manual pós-merge: o próprio CD roda `drizzle-kit migrate` antes do deploy.
> Não existe rollback de schema: correção é sempre **uma nova migration para frente**.
> Toda migration precisa estar pronta para produção **no momento em que a PR é aprovada para develop**.

## 1. Evidência no `cd.yml`

| Linhas | O que faz |
|---|---|
| `cd.yml:5-8` | `on: push: branches: [develop, main]` (+ `workflow_dispatch` manual) |
| `cd.yml:19-22` | job `ci` reusa `ci.yml` sobre o commit integrado |
| `cd.yml:24-26` | job `deploy` com `needs: ci` |
| `cd.yml:30-34` | escolhe os secrets pela branch: `main` → produção; `develop` → `VERCEL_DEVELOP_*` (homologação); sem fallback entre eles |
| `cd.yml:64-65` | `vercel pull` baixa as variáveis reais do projeto da branch |
| **`cd.yml:67-75`** | **"Aplica as migrations no banco do ambiente"**: exige `DATABASE_URL_UNPOOLED` e roda `node --env-file=… node_modules/drizzle-kit/bin.cjs migrate` |
| `cd.yml:77-78` | `vercel build` (só depois das migrations) |
| `cd.yml:82-106` | `vercel deploy --prebuilt` |

Mapeamento de ambientes (`docs/deploy/vercel.md`, tabela inicial e §"Pipeline"): `develop` → projeto `develop-pgr-e`,
Supabase e Clerk de testes, `APP_ENV=sandbox`; `main` → `pgr-e-production`, Supabase próprio, `APP_ENV=production`.
O drizzle aplica as pendentes **numa transação**; migration que falha interrompe o CD antes do deploy, mas não desfaz
o que deploys anteriores já aplicaram.

Estado em 21/10/2026: develop em `0053_company_module_access`; `origin/main` em `0052_platform_leads`. O próximo release
`develop → main` levará a 0053 **e tudo o que entrar em develop até lá** para produção de uma vez (ensaiar o lote).

## 2. Branches, PR e CI

| Item | Regra |
|---|---|
| `develop` | integração; cada merge = deploy + migration em homologação |
| `main` | produção; recebe release por PR `develop → main` |
| Branch de lote | `feature/NOB-XXX-<slug>`, criada a partir de **`origin/develop` atualizado** (`git fetch` antes). Um lote = uma branch = uma PR |
| Branch já criada | Lote 1: `feature/NOB-108-ficha-saude-ocupacional` (sem código em 21/10) |
| PR | base **`develop`** sempre. PR empilhada (base = outra branch) **não roda CI**, porque `ci.yml:3-5` só dispara em `pull_request` para `develop`/`main` (foi o que aconteceu com a #112) |
| CI (`ci.yml`) | `quality` (Prettier, ESLint, typecheck), `test` (Postgres 16 efêmero, `npm run test`, `test:deploy`, `test:integration`), `build`. Envs de Clerk/Supabase são placeholders |
| Playwright | **não roda no CI**; E2E é local (projeto `protected` com `E2E_PROTECTED=1`) |
| Proteção de branch / checks obrigatórios | NÃO_VERIFICADO (API de rulesets indisponível no plano) |
| `changelog.yml` | reescreve o CHANGELOG em push na develop via GitHub App |
| Merge | só com aprovação e autorização explícita; MERGED ≠ HOMOLOGADO ≠ PUBLICADO ([07](07-CRITERIOS-DE-ENTREGA.md)) |

### 2.1 Atualizar a base da branch

1. Preferir **merge de `origin/develop` na branch** (`git fetch origin` → `git merge origin/develop`). Não reescreve
   histórico e dispensa `push --force`.
2. `git push --force` é proibido. `--force-with-lease` só se for indispensável (ex.: rebase pedido na revisão) e com
   aviso a quem revisa.
3. Se a branch tiver migration e a develop tiver ganhado outra: ver §3.3 (regerar, nunca editar o journal à mão).
4. Conflito em `docs/api/sst-manager.postman_collection.json` é o mais comum (aconteceu na #112): resolver mantendo as
   pastas de todos os recursos e validar o JSON.

## 3. Migrations (Drizzle)

### 3.1 Regras

> **Estado: PROPOSTO.** "Uma migration por PR", "aditiva" e a janela de release dependem da **MED-DEC-26** (Douglas), que
> está pendente em [04](04-DECISOES-E-BLOQUEIOS.md). As linhas sobre `when`, journal, snapshots, transação e ausência de
> rollback descrevem o **comportamento verificado** da ferramenta, não proposta.

| Regra | Motivo |
|---|---|
| **Uma migration por PR** | revisão e recuperação simples |
| Gerada com `npm run db:generate` (drizzle-kit) a partir do schema; GRANTs, triggers `set_updated_at` e policies especiais como SQL custom dentro do arquivo gerado | Drizzle é dono code-first (CLAUDE.md) |
| **Aditiva**: sem DROP, sem rename destrutivo, sem `NOT NULL` em coluna existente no mesmo passo | é aplicada em homologação no merge e em produção no release |
| Estados novos em **`text` + CHECK**, não `ALTER TYPE … ADD VALUE` | o lote de pendentes roda numa transação; usar o valor novo do enum no mesmo lote falha (AUDIT-DATABASE R3) |
| Backfill idempotente e rápido (lock) | roda no banco real |
| `when` do journal **maior que o maior `when` existente** | o migrator do drizzle-orm 0.45 pula sem erro migration com `when` menor que o último aplicado (AUDIT-DATABASE §4.1, `dialect.js`). Precedente: `0026_user_is_master` tem `when` 1784600000000, maior que o da `0027` (1784448304145) |
| Nunca editar `meta/_journal.json` nem snapshots à mão | snapshots encadeiam a partir do anterior |
| Ensaio em Postgres efêmero antes do merge | o helper de integração aplica os `.sql` em **ordem alfabética** e não lê o journal (`_helpers/db.ts`); conferir que nome, ordem e journal concordam |
| Sem rollback: correção = migration nova para frente | não existe "down" no drizzle-kit |

Referências de `when` em 21/10: maior da develop = `1792509152595` (0053); se a #112 entrar, `1792515723005` (0055).

### 3.2 Numeração

- A PR #112 (NOB-98, Rikelvin) **reservou `0054` e `0055`**, sujeito ao estado do repositório no momento do merge.
- A numeração futura da Medicina **NÃO está definida**. Os números "0056–0064" da auditoria são **indicativos**.
- Antes de gerar qualquer migration: **coordenar com Rikelvin e Douglas** (MED-DEC-08 e MED-DEC-26 em
  [04](04-DECISOES-E-BLOQUEIOS.md); correspondem a D-01 e D-07 de `../DECISIONS.md`). Se outra migration entrar antes da #112, alguém precisa regerar a dela.

### 3.3 Branch com migration ficou atrás da develop (procedimento PROPOSTO, confirmar com o Douglas)

1. Atualizar a base (§2.1).
2. Descartar a própria migration gerada (o `.sql`, o `meta/NNNN_snapshot.json` e a entrada no journal), restaurando
   `meta/_journal.json` da versão de `origin/develop` (restaurar arquivo, não editar à mão).
3. Rodar `npm run db:generate` de novo: o drizzle-kit gera o próximo número, o `when` atual e o snapshot encadeado.
4. Reaplicar o SQL custom (GRANT, triggers, policies) no arquivo novo e reensaiar no Postgres efêmero.

### 3.4 Checklist antes de qualquer lote com migration

Copiar para o PLAN.md do lote e preencher. Nenhum item pode ficar sem resposta.

- [ ] **Última migration** em `origin/develop` conferida (`ls src/shared/db/migrations`) e registrada no PLAN
- [ ] **Journal e snapshots** coerentes: nome, ordem, `when` maior que o último, snapshot encadeado
- [ ] **Branches e PRs concorrentes** com migration verificadas (`gh pr list`; hoje: #112 com 0054/0055)
- [ ] **Rikelvin e Douglas** avisados e de acordo com o número e a ordem de merge (registro em [04](04-DECISOES-E-BLOQUEIOS.md))
- [ ] **Ambiente afetado pelo CD** registrado: merge em develop → homologação; release → produção (com o que mais estiver pendente em develop)
- [ ] **Ensaio em Postgres efêmero** (`INTEGRATION_*`) com todas as migrations do zero, sem suíte "skipped"
- [ ] **RLS**: isolamento PERMISSIVE + RESTRICTIVE `medicine` declaradas no schema (`pgPolicy(...).enableRLS()`)
- [ ] **GRANTs** mínimos para `app_runtime` (sem DELETE onde houver retenção; append-only onde for trilha)
- [ ] **Índices** para `org_id`, `company_id` e as consultas do lote
- [ ] **FKs**: composta `(company_id, org_id)`; `ON DELETE` decidido (RESTRICT onde houver histórico clínico)
- [ ] **Dados antigos**: efeito em linhas existentes, backfill idempotente ou nenhum, política para dados inválidos
- [ ] **Falha e recuperação**: o que acontece se o CD falhar no meio; qual migration para frente corrige
- [ ] **Rollout aditivo**: código novo funciona com o schema antigo e vice-versa durante a janela develop → main

## 4. Nota operacional (ambiente local do Carlos)

- O checkout principal roda `next dev`. **Trocar de branch com o servidor no ar** causa erro 500 transitório do Clerk
  na primeira requisição (artefato de cache do dev server, não bug de código).
- Tentativas anteriores de build em **worktree** falharam no Windows (limite de comprimento de caminho e Turbopack
  rejeitando `node_modules` por junção).
- Por isso o **Lote 1 deve ser implementado no checkout principal**, com o **dev server parado durante trocas de
  branch** e reiniciado depois.
- Atualizar a develop local antes de abrir branch (a Fase 0 encontrou a develop local 36 commits atrás).
