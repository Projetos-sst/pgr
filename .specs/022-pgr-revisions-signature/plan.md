# Implementation Plan: Revisões do PGR, revisão consolidada e assinatura pública

**Branch**: `feature/pgr-revisions-signature` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/022-pgr-revisions-signature/spec.md`

## Summary

Fatia **zero-migration** que faz três coisas sobre tabelas já existentes:

1. **Conserta o que a 019 não plugou.** `PgrEditorTabs` e as 5 abas existem mas **não são importadas
   por lugar nenhum** — a task `T022` da 019 está marcada `[x]` e a edição **nunca entrou no commit**
   (`ae34bff` não toca `page.tsx`, cujo último commit é `0adf3ca`, da Feature 013). A correção é
   **um arquivo**: reescrever `src/app/(protected)/pgr/[id]/page.tsx` como shell do editor.
2. **Numeração de revisão no servidor.** Hoje `revisionNumber` é **input obrigatório do cliente**
   (`pgrRevisionInputSchema`) e o único guarda-costas é o UNIQUE. Passa a ser calculado dentro da
   transação, com `SELECT … FOR UPDATE` na linha do `pgr` (espelha `lockStockRow` de
   `stock-movements.ts`), **serializando** criações concorrentes do mesmo PGR: duas requisições
   simultâneas devolvem **201 + 201** com números **consecutivos** (nenhuma revisão perdida). O lock é
   **por PGR** — PGRs distintos não se bloqueiam. A UNIQUE permanece como **backstop defensivo**;
   `DUPLICATE` (409) **não** é o desfecho da concorrência normal. Sem retry.
3. **Assinatura pública do PGR** plugando no registry polimórfico da Fase 0 (`target_type` é `text`,
   não enum → **zero migration**, comprovado por `extensibility.test.ts`), com **payload público
   mínimo montado no servidor** e **estado derivado** (o `pgr` não ganha coluna).

Mais a **extensão read-only da consolidada** (EPIs por risco + 5W2H completo + campos eSocial já
persistidos) e a **reconciliação documental**, que tem **duas frentes**:

- **restaurar** `Dashboard (plataforma)` no Postman (perdido no merge da PR #146);
- **backfill da Feature 019**: `/pgr/{id}/revisions`, `/pgr/{id}/ges`, `/pgr/{id}/ges/{gesId}` e
  `/pgr/{id}/consolidated` foram entregues como Route Handlers e **nunca documentados** — não existem
  nem no `api-design.md` (que só tem `` `/pgr` · `/pgr/{id}` ``) nem no Postman (pasta `PGR` com só os
  5 requests do CRUD base). Como esta fatia **muda o contrato** da criação de revisão e já edita esses
  dois arquivos, os quatro endpoints são **adicionados** aqui (sem alterar a semântica de nenhum deles).

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16.2.6 App Router; React 19.2.4; Node runtime.

**Primary Dependencies**: Drizzle ORM + postgres-js, Zod v4, Clerk, Tailwind v4. `qrcode` e
`signature_pad` **já instalados** (fatia 010). **Nenhuma dependência nova.**

**Storage**: Postgres (Supabase). Tabelas **existentes**: `pgr`, `pgr_revisions`, `pgr_ges`
(migration `0012`); `risks`, `risk_assessments`, `control_measures` (`0012`); `epi_risk`, `epi_catalog`
(`0007`/`0014`); `signature_requests`, `signature_captures` (`0010`). RLS `app_runtime` já ativa em
todas. **Nenhuma migration; nenhuma alteração de `schema/**`.** Última migration do repo:
`0017_user_profile_fields`.

**Testing**: Jest — unit (jsdom) + integração (node) contra **Postgres efêmero**
(`INTEGRATION_DATABASE_URL` + `INTEGRATION_APP_RUNTIME_URL` + `INTEGRATION_DATABASE_URL_ADMIN`), RLS
real. **Nunca SQLite.** REST validado por **cURL** quando o harness REST-via-Jest esbarrar no 500
pré-existente (documentado em `rest-pgr-editor.test.ts:5-6`). Playwright MCP para UI (a pública é
testável **sem Clerk**).

**Target Platform**: Web (App Router) + REST `/api/v1/*` + **1 rota pública** (`/assinar/[token]`).

**Project Type**: Web app multi-tenant (SST SaaS).

**Performance Goals**: consolidada em **6 queries em lote** (hoje são 5) — sem N+1, independente da
quantidade de GES/riscos. Polling de status da assinatura a ~3 s (padrão do painel demo).

**Constraints**: zero-migration; tenant sempre da sessão (`withOrg` + RLS); no fluxo público o token é
a **única** credencial; payload público **mínimo, sem PII e congelado**; sem autor persistido; sem
status no `pgr`; sem PDF.

**Scale/Scope**: 1 página reescrita + 1 aba corrigida (`pgr-revisions-tab`) + 1 painel novo + 2
domínios estendidos + 2 domínios novos (payload + view do PGR) + 3 repositórios estendidos + 1
repositório novo + **2 núcleos** (genérico de assinatura + adaptador do PGR) + 2 Server Actions novas +
1 rota REST nova + `proxy.ts` + docs/Postman + unit & integração (incl. 3 suítes existentes acopladas a
`revisionNumber`).

## Constitution Check

_GATE — reavaliado após o design (Phase 1)._

| Princípio                                              | Situação nesta fatia                                                                                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I — Isolamento multi-tenant (não-negociável)**       | ✅ Fluxo protegido: `requireOfficeStaff()` → `officeAction`/`restHandler` → `withOrg` → RLS. Fluxo público: tenant derivado do **token** via policy de capability (`withSignatureToken`), nunca do input. |
| **II — Stack fixa / serviço externo**                  | ✅ N/A. Nenhuma dependência nova, nenhum serviço externo. Gotenberg/PDF **fora** (Fase 05).                                                                                                               |
| **III — Fatia vertical**                               | ✅ banco (reuso) → domínio → repositório → action → REST → UI → docs/Postman → testes.                                                                                                                    |
| **IV — Operações pesadas assíncronas**                 | ✅ N/A. Nenhuma operação pesada (a geração de PDF, que seria o caso, está fora de escopo).                                                                                                                |
| **V — Segurança e integridade**                        | ✅ Token só **hasheado** (`token_hash`), cru só na URL/QR e **nunca em log**; uso único atômico; payload público sem PII; Zod em toda entrada.                                                            |
| **Camadas (page→action→domain→repo→drizzle)**          | ✅ Repositórios são os únicos a tocar Drizzle. A regra de cota vive **uma vez** (core compartilhado — ver D6).                                                                                            |
| **Superfície de API (Action + REST + docs + Postman)** | ✅ Assinatura protegida ganha as 4. O **fluxo público não tem REST** — segue o precedente da fatia 012 (`api-design.md:54-69`), documentado como página no Postman.                                       |
| **Testabilidade (unit + integração Postgres efêmero)** | ✅ Unit (numeração, payload, título, estado derivado, cota) + integração (RLS, cross-tenant, cota, token, replay).                                                                                        |
| **Zero migration / schema code-first**                 | ✅ `target_type` é `text`; `pgr`/`pgr_revisions` intactos. `npm run db:generate` deve reportar "No schema changes".                                                                                       |

**Resultado do gate**: **PASS**. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/022-pgr-revisions-signature/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{repositories,server-actions,rest-endpoints}.md
├── checklists/requirements.md   # (do /speckit-specify)
└── tasks.md                     # (Phase 2 — /speckit-tasks)
```

### Source Code (repository root)

**CRIAR**

```text
src/shared/domains/pgr/pgr-signature.ts            # PgrSignatureView/Status + pgrSignatureRequestSchema (.strict) + buildPgrDocumentTitle
src/shared/domains/signatures/targets/pgr.ts       # pgrSignaturePayloadSchema (zod)
src/shared/server/signatures/create-request-core.ts # núcleo GENÉRICO: cota+token+hash+TTL+persistência+URL
src/shared/server/pgr/pgr-signature-core.ts        # adaptador do DOMÍNIO PGR: guard + payload + delega + deriva estado
src/shared/server/actions/pgr/pgr-signature.ts     # createPgrSignatureRequestAction + getPgrSignatureViewAction
src/shared/db/repositories/pgr-signature.ts        # getPgrSignatureSource (head do PGR p/ o payload)
src/shared/ui/signature/PgrSignatureForm.tsx       # (client) formulário público do PGR
src/app/api/v1/pgr/[id]/signature/route.ts         # POST 201 + GET 200 (delegam ao pgr-signature-core)
src/app/(protected)/pgr/[id]/_components/pgr-signature-panel.tsx  # (client) gerar/copiar link + QR + estado
```

**MODIFICAR**

```text
src/shared/domains/pgr/pgr-revision.ts             # input .strict() SEM revisionNumber (enviado → 422)
src/shared/domains/pgr/pgr-consolidated.ts         # +ConsolidatedEpi/Assessment, +campos risco/5W2H
src/shared/domains/signatures/contract.ts          # SIGNATURE_TARGET_TYPES += "pgr"; registry += pgr
src/shared/ui/signature/form-registry.tsx          # registry += pgr
src/shared/server/actions/signatures.ts            # createSignatureRequest delega ao core genérico
src/shared/server/actions/pgr/pgr-revisions.ts     # create sem revisionNumber
src/shared/db/repositories/pgr-revisions.ts        # MAX+1 sob FOR UPDATE + getLatestRevisionNumber
src/shared/db/repositories/pgr-consolidated.ts     # +query 6 (epi_risk ⨝ epi_catalog) + colunas
src/shared/db/repositories/signature-requests.ts   # +getLatestRequestByTarget
src/app/(protected)/pgr/[id]/page.tsx              # (a correção-chave) shell do editor em abas
src/app/(protected)/pgr/[id]/_components/pgr-revisions-tab.tsx  # ⚠️ REMOVE o <input name="revisionNumber"> e o Math.max
src/app/(protected)/pgr/[id]/_components/pgr-editor-tabs.tsx    # +prop `signature`
src/app/(protected)/pgr/[id]/_components/pgr-basic-info-tab.tsx # +prop `signature` → renderiza o painel
src/proxy.ts                                       # "/assinar/(.*)" público + "/assinar/" no no-store
docs/api/api-design.md                             # BACKFILL da 019 (revisions/ges/consolidated NUNCA documentados)
                                                   #  + contrato server-side das revisões (revisionNumber → 422)
                                                   #  + /pgr/{id}/signature + seção da rota pública
docs/api/sst-manager.postman_collection.json       # RESTAURA Dashboard + BACKFILL da 019 na pasta PGR
                                                   #  + requests da 022 + exemplo negativo 422
```

**SOMENTE LER (não editar — reuso comprovado)**

```text
src/app/(public)/assinar/[token]/page.tsx          # já é genérica: resolve o form pelo registry
src/shared/server/actions/public-signatures.ts     # resolvePublicSignature/submitPublicSignature reusadas
src/shared/ui/signature/{SignaturePad,QrCode}.tsx  # reusados pelo PgrSignatureForm
```

**TESTES**

```text
# criar
src/__tests__/unit/domains/pgr/pgr-signature.test.ts            # estado derivado, título composto, ttl schema
src/__tests__/unit/domains/signatures/pgr-payload.test.ts       # payload mínimo, sem PII, sem consolidada
src/__tests__/integration/pgr-editor/pgr-signature.test.ts      # target "pgr", payload congelado, cota, cross-tenant

# modificar (⚠️ TODAS acopladas a `revisionNumber` — quebram sem ajuste)
src/__tests__/unit/domains/pgr/pgr-editor-schemas.test.ts       # ⚠️ input sem revisionNumber; extra → VALIDATION
src/__tests__/integration/pgr-editor/pgr-revisions.test.ts      # ⚠️ helper rev(); +concorrência; +lock não global
src/__tests__/integration/pgr-editor/rest-pgr-editor.test.ts    # ⚠️ body sem revisionNumber; +POST c/ número → 422

# modificar (ampliação)
src/__tests__/unit/domains/pgr/pgr-consolidated.test.ts         # EPIs, 5W2H, ordenação
src/__tests__/integration/pgr-editor/pgr-consolidated.test.ts   # EPIs + 5W2H
src/__tests__/integration/auth/proxy-protection.test.ts         # /assinar público; demais protegidas
src/__tests__/integration/_helpers/pgr-seed.ts                  # ⚠️ +pgrA2 (2º PGR em org_a — lock não global)

# REGRESSÃO (devem passar SEM edição — é o critério de que o refactor do core não regrediu)
src/__tests__/integration/signatures/*.test.ts   # 9 suítes
src/__tests__/unit/signatures-{token,schemas,quota}.test.ts
```

**Structure Decision**: a assinatura do PGR **não** ganha infraestrutura própria — ela é **+1 entrada
no registry** da Fase 0 (`contract.ts` + `form-registry.tsx` + `targets/pgr.ts`), exatamente o caminho
que `extensibility.test.ts` já prova ser zero-migration. A página pública `/assinar/[token]` **não é
tocada**: ela resolve o formulário pelo registry.

**Dois núcleos, com papéis distintos** (espelhando `server/pgr/ai-risk-suggestion-core.ts` e
`server/platform/{profile,team}-core.ts`, que já existem):

| Núcleo                                     | Papel                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `server/signatures/create-request-core.ts` | **Infra genérica** — cota · token · hash · TTL · persistência · URL pública               |
| `server/pgr/pgr-signature-core.ts`         | **Adaptador do domínio PGR** — guard de tenant · monta o payload · delega · deriva estado |

Consumidores do core do PGR: as **duas Server Actions** e as **duas rotas REST**. Assim o guard, a
montagem do payload público e a cota vivem **uma única vez** — e o Route Handler **não** duplica a
composição do payload (que é justamente onde um vazamento de PII nasceria).

## Complexity Tracking

Sem violações de constituição. Tabela vazia.

## Fora do escopo (reafirmado)

Migration; alteração de schema; `author_id`/autor persistido; snapshot de versionamento; comparação;
restauração; revisão automática; status/`signed_at` no `pgr`; CPF/IP/user-agent; **ação de revogação**
(o estado `cancelled` é apenas **exibido**, nunca escrito — não há quem o escreva hoje); PDF;
Gotenberg; GED; storage; upload; download; URL assinada de documento; capa/cor/sumário; cota exclusiva
de PGR; alteração em billing/plans.

## Formatação / gates finais

Prettier **dirigido** nos arquivos da feature + em `.specs/022-pgr-revisions-signature/**/*.md`. **Não
formatar repo-wide às cegas.** Gate final: `npm run format:check` · `npm run lint` · `npm run typecheck`
· `npm run test` · `npm run test:integration` · `npm run build` · validação do JSON do Postman +
presença das pastas Perfil/Equipe/Dashboard · `git diff --check` · **diff vazio** em
`src/shared/db/schema` e `src/shared/db/migrations` · `npm run db:generate` → "No schema changes".
