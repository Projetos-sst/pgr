# Implementation Plan: Conclusão da Fase 02 — Módulo Operacional de EPI

**Branch**: `feature/epi-module-completion` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/012-epi-module-completion/spec.md`

## Summary

Fechar a Fase 02 do módulo de EPI em cinco histórias priorizadas sobre o `develop` atual: (US1)
plugar o `CaField`/CAEPI já pronto no formulário de catálogo; (US2) entrega de EPI com baixa
transacional de estoque e assinatura manual; (US3) assinatura pública por QR/link via rota
`/sign/[token]`; (US4) devolução com reposição de saldo; (US5) ficha de EPI por funcionário. O modelo
de dados da fatia 008 já cobre entregas/itens/assinatura — **toda a leva é zero migration exceto a
devolução (migration `0010`)**. A abordagem reusa integralmente os motores existentes (`withOrg` + RLS,
`officeAction`/`restHandler`, `toActionError`, `auditedTenantWrite`, paginação, `_ui`) e **extrai**
`applyStockExit`/`applyStockEntry` de `stock-movements.ts` (D2), preservando o comportamento e os testes
da #72. A assinatura é **inline** (D1): token HMAC-assinado com validade de 72h e método (QR/link) embutidos
— stateless para o TTL, ancorado no `auth_token` armazenado para unicidade/revogação —, sem coluna
nova e sem infra polimórfica.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres; Clerk (auth);
Zod v4 (validação); Tailwind v4. Novas: nenhuma dependência de runtime obrigatória — geração de QR pode
usar SVG/data-URL nativo (ver research); assinatura via `<canvas>` nativo (signature-pad manual, sem
lib).

**Storage**: PostgreSQL (Supabase). Runtime conecta como `app_runtime` (pooler 6543, `prepare:false,
max:1`); `drizzle-kit` usa conexão direta owner (`DATABASE_URL_UNPOOLED`). Fonte de verdade do schema =
`src/shared/db/schema/epis.ts`.

**Testing**: Jest — unit (`--selectProjects unit`, jsdom) e integração (`--selectProjects integration`,
node) contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL`), nunca SQLite (dependência de RLS/policy
— exceção do Princípio da constituição, §"Fluxo de Desenvolvimento").

**Target Platform**: Vercel serverless (App Router: Server Components, Server Actions, Route Handlers).

**Project Type**: Web app fullstack no Next.js (backend e frontend unificados; sem API separada).

**Performance Goals**: CRUD e regras síncronos (< limites serverless). Baixa/reposição de saldo com
`SELECT … FOR UPDATE` na mesma transação `withOrg`. Painel de assinatura por **polling** (sem SSE).

**Constraints**: Isolamento multi-tenant não-negociável (`withOrg` + RLS `app_runtime`); tenant sempre
da sessão (`requireTenantContext`/`requireOfficeStaff`), nunca de input do cliente — **exceto** a rota
pública `/sign/[token]`, que resolve o tenant a partir do token. Escrita só por `owner`/`collaborator`
(papel `client` → `FORBIDDEN`). Segredos só em env (`EPI_SIGN_TOKEN_SECRET`).

**Scale/Scope**: 5 user stories; 1 migration (`0010`); ~6 recursos HTTP novos (Server Action + REST
espelho + api-design.md + Postman por recurso); 1 rota pública nova; 1 refactor (extração de helpers de
estoque).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                       | Conformidade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento Multi-Tenant (não-negociável)** | ✅ Toda leitura/escrita de EPI via `withOrg` + RLS `app_runtime`; tenant da sessão. **Ponto de atenção**: rota pública `/sign/[token]` opera sem sessão — mitigado resolvendo o `orgId` a partir do token assinado e executando o acesso sob `withOrg(orgId)`, de modo que o RLS ainda valida a posse da entrega; a rota nunca enxerga outra entrega/tenant (ver research R1). Não é violação: o tenant não vem de input livre do cliente, e sim de um token HMAC-assinado emitido pelo próprio tenant. |
| **II. Stack Fixa & YAGNI**                      | ✅ Zero nova infraestrutura. Assinatura inline (D1) em vez de infra genérica; QR/signature-pad sem lib nova quando possível (research R4). Sem features especulativas (#78 fora).                                                                                                                                                                                                                                                                                                                       |
| **III. Fatias Verticais**                       | ✅ 5 US independentemente testáveis; US1 ortogonal, US2 destrava US3/US4/US5; MVP = US1+US2 (P1).                                                                                                                                                                                                                                                                                                                                                                                                       |
| **IV. Operações Pesadas Assíncronas**           | ✅ Todas as operações são CRUD/regra rápida e síncrona. Nenhuma geração de PDF em lote (impressão é CSS no cliente). Painel por polling, não bloqueante.                                                                                                                                                                                                                                                                                                                                                |
| **V. Segurança & Integridade**                  | ✅ TS strict, sem `any`; toda Server Action/Route Handler valida entrada com Zod antes do banco; constraints no banco (`CHECK balance >= 0`, `quantity > 0`, FKs, unique de token) como fonte de verdade; migration `0010` reversível (enum forward-only documentado). Segredo do token em env.                                                                                                                                                                                                         |

**Verificação de teste (exceção de Postgres efêmero)**: esta fatia depende de RLS/policy/`current_setting`
— usa Postgres efêmero em integração, exatamente a exceção prevista na constituição. Sem violação.

**Resultado do gate**: PASS. Nenhuma entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
.specs/012-epi-module-completion/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan)
├── quickstart.md        # Fase 1 (/speckit-plan)
├── contracts/           # Fase 1 (/speckit-plan)
│   ├── rest-epi-deliveries.md
│   ├── rest-employee-epi-record.md
│   ├── public-sign-route.md
│   └── server-actions.md
├── checklists/
│   └── requirements.md  # já criado no /speckit-specify
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── db/
│   │   ├── schema/
│   │   │   └── epis.ts                     # US4: +returnedAt em epiDeliveryItems; +'employee_return' no enum
│   │   ├── migrations/
│   │   │   └── 0011_epi_delivery_return.sql # US4: ALTER TYPE ADD VALUE + ADD COLUMN (SQL custom, padrão 0005)
│   │   └── repositories/
│   │       ├── stock-movements.ts          # D2: extrair applyStockExit/applyStockEntry; registerStock* passam a chamá-los
│   │       ├── epi-deliveries.ts           # NOVO: createDelivery, getDelivery, listDeliveries, deleteDelivery(guard), signManual, signByToken, returnDeliveryItem
│   │       └── employee-epi-record.ts      # NOVO (US5): getEmployeeEpiRecord (join escopado + filtros + paginação)
│   ├── domains/pgr/
│   │   ├── stock-movements.ts              # tipos StockExit/EntryValues reusados
│   │   ├── epi-deliveries.ts               # NOVO: zod (createDeliverySchema, signSchema, returnSchema) + regras puras
│   │   └── epi-record.ts                   # NOVO (US5): filtros (status/período) + formatação de status
│   ├── errors/
│   │   ├── already-signed-error.ts         # NOVO (code ALREADY_SIGNED)
│   │   ├── already-returned-error.ts       # NOVO (code ALREADY_RETURNED)
│   │   └── token-error.ts                  # NOVO (TokenInvalidError/TokenExpiredError)
│   ├── integrations/
│   │   └── epi-signature/
│   │       └── token.ts                     # NOVO: sign/verify token HMAC stateless (orgId+deliveryId+method+iat, TTL 72h)
│   ├── server/
│   │   └── actions/pgr/
│   │       └── epi-deliveries.ts            # NOVO: Server Actions (officeAction) espelho do repo
│   ├── api/
│   │   └── rest.ts                          # editar HTTP_BY_CODE: +ALREADY_SIGNED/RETURNED, +TOKEN_INVALID/EXPIRED
│   └── integrations/caepi/client/…          # US1: reuso sem alteração (CaField/useCaepiValidation)
├── proxy.ts                                 # US3: +"/sign/(.*)" em isPublicRoute
└── app/
    ├── (protected)/
    │   ├── epi-catalog/_components/
    │   │   └── epi-catalog-form.tsx         # US1: trocar TextField de ca por CaField; ca/caValidUntil/manufacturer/norm controlados
    │   └── employees/[id]/
    │       ├── page.tsx                      # US2/US5: seção "Entregas de EPI" + "Ficha de EPI"
    │       └── _components/
    │           ├── deliver-epi.tsx           # NOVO (US2): seleção de itens com saldo + modal + confirmar
    │           ├── delivery-signature.tsx    # NOVO (US2/US3): assinatura manual + gerar QR/link + painel polling
    │           └── epi-record-table.tsx      # NOVO (US5): ficha read-only + filtros + botão imprimir (CSS print)
    ├── (public)/
    │   └── sign/[token]/
    │       └── page.tsx                      # NOVO (US3): rota pública de assinatura (sem tenant/Clerk)
    └── api/
        ├── v1/
        │   ├── epi-deliveries/
        │   │   ├── route.ts                  # GET (list) + POST (create) → restHandler
        │   │   └── [id]/
        │   │       ├── route.ts              # GET + DELETE(guard assinada; sem PUT — edição fora de escopo)
        │   │       ├── sign/route.ts         # POST (assinatura manual)
        │   │       └── return/route.ts       # POST (devolver item)
        │   └── employees/[id]/epi-record/
        │       └── route.ts                  # GET (ficha read-only) → restHandler
        └── (sign público via app/(public)/sign/[token] — POST server action interno, NÃO em /api/v1)

src/__tests__/
├── unit/                                     # applyStockExit/Entry, token, guards, filtros ficha, CaField wiring
└── integration/                              # baixa atômica, INSUFFICIENT_STOCK rollback, assinatura pública,
                                              #   devolução 2×, isolamento cross-tenant, DELETE assinada, GRANT/RLS

docs/api/
├── api-design.md                             # registrar recursos novos (Recursos + Sumário)
└── sst-manager.postman_collection.json       # 1 pasta por recurso, reusando Variables
```

**Structure Decision**: mantém a arquitetura em camadas vigente (Page/Route → Server Action/domínio →
repository (`withOrg`) → Drizzle), reusando os diretórios reais listados. Nada de nova top-level
structure. A referência de cópia é **companies** (Server Action + `api/v1/companies/**` + api-design +
Postman) e **stock-movements** (transação de saldo). A única entidade nova de fluxo é `epi-deliveries`
(repo + domínio + actions + REST + UI); ficha e assinatura reusam-na.

## Complexity Tracking

> Constitution Check passou sem violações — seção não aplicável.
