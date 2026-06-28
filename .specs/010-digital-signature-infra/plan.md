# Implementation Plan: Infraestrutura de assinatura digital (links públicos com token + QR + captura)

**Branch**: `feature/digital-signature-infra` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/010-digital-signature-infra/spec.md`

**Fonte da verdade técnica**: `docs/briefings/briefing-digital-signature-infra.md` (decisões de brainstorming). Em conflito, o briefing prevalece.

## Summary

Camada de plataforma transversal e reutilizável (DRY) para coleta de assinatura por **link público com token**. Um membro do escritório gera, a partir de um registro de qualquer módulo, um pedido de assinatura → token único (armazenado **hasheado**), link público e QR Code. Um terceiro **sem login** abre a rota pública, o token resolve o tenant (via **policy de capability** RLS, nunca input do cliente), e a assinatura (canvas → PNG base64) é persistida vinculada ao registro de origem. O status reflete na tela interna **em tempo real por polling (<5s)**. Gate de plano free/pro aplicado **na criação** (lado interno), com contagem **derivada por mês corrente**; a rota pública nunca checa plano.

**Abordagem técnica**: modelagem **genérica polimórfica** (`signature_requests` + `signature_captures`, discriminada por `target_type`) com **registry** de tipos de alvo (novo consumidor = +1 entrada, zero mudança de schema). Reuso integral da infraestrutura existente: camadas (página/handler → action → domínio → repositório → schema), `ActionResult`/`officeAction`/`restHandler`, `withOrg` + RLS backstop, helpers de tenant/plano. Consumidor de demonstração (`target_type: 'demo'`) prova o contrato ponta a ponta.

## Technical Context

**Language/Version**: TypeScript `strict` (ESNext) · Next.js 16.2.6 (App Router) · React 19.2.4

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) · Zod v4 · Clerk (auth) · **novas**: `qrcode` (geração server-side, data-URL) e `signature_pad` (captura vanilla, embrulhada em client component)

**Storage**: Supabase PostgreSQL. Imagem da assinatura como **base64 (data-URL PNG) em coluna `text`** sob RLS por tenant (sem storage externo nesta fatia). Runtime via `app_runtime` (pooler 6543, `prepare:false, max:1`); migrations via owner unpooled.

**Testing**: Jest — unit (jsdom) + **integração contra Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite** (fatia RLS-dependente → exceção obrigatória da constituição §Fluxo).

**Target Platform**: Vercel (serverless). Rota pública em `src/app/(public)/` (fora do layout protegido).

**Project Type**: Web application (Next.js fullstack — Server Actions + Route Handlers, sem API separada).

**Performance Goals**: Atualização de status na tela interna em **< 5 s** após a assinatura (polling ~3 s). Assinatura PNG pequena (~5–50 KB).

**Constraints**: Isolamento multi-tenant em toda gravação/consulta; rota pública resolve tenant **do token**, nunca do cliente. Token ≥256 bits, hasheado (sha-256), TTL configurável, uso único. Erros como códigos de domínio. Zod em toda Server Action.

**Scale/Scope**: 2 tabelas novas + 2 enums + 1 migration (`0009`); 1 contrato/registry; 1 rota pública + 1 painel interno demo; 2 componentes UI reutilizáveis; helper de quota. Gate free = 10 pedidos criados/mês; pro ilimitado.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                        | Veredito | Como o plano cumpre                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I — Isolamento Multi-Tenant (não-negociável)** | ✅ PASS  | Toda tabela com `org_id NOT NULL → orgs.id`, RLS `app_runtime` (`current_setting('app.current_org', true)`). Rota pública sem sessão isolada por **policy de capability** (`token_hash = current_setting('app.signature_token', true)`) — tenant derivado do token, escrita via `withOrg(orgId)`. Sem token/sem tenant → zero linhas. |
| **II — Stack Fixa e Simplicidade (YAGNI)**       | ✅ PASS  | Sem nova infraestrutura (não há AWS/fila/serviço pago/novo banco → sem emenda). `qrcode`/`signature_pad` são **bibliotecas**, não infra. Polling em vez de SSE; base64 no Postgres em vez de storage novo; contagem derivada em vez de contador/cron — todas as escolhas mais simples que atendem o requisito.                        |
| **III — Fatias Verticais**                       | ✅ PASS  | Fatia de infra auto-contida, demonstrável via consumidor `demo`; segue o ciclo Spec Kit; P1 (gerar+capturar+status) entregue antes de P2/P3.                                                                                                                                                                                          |
| **IV — Operações Pesadas Assíncronas**           | ✅ PASS  | Geração de token/QR e gravação de captura são rápidas e síncronas. Nenhuma operação pesada (sem PDF em lote/notificação em massa nesta fatia — envio externo é Out of Scope).                                                                                                                                                         |
| **V — Segurança e Integridade**                  | ✅ PASS  | TS `strict` (sem `any`); Zod em toda Server Action; constraints no banco (UNIQUE `token_hash`, FK 1:1 `request_id`, NOT NULL, enums). Token nunca persiste em claro (sha-256); segredos só em env.                                                                                                                                    |
| **Quality gate (testes)**                        | ✅ PASS  | Unit (token/expiração/quota/Zod) + integração em **Postgres efêmero** cobrindo isolamento cross-tenant, expiração, reuso, quota. `lint` + `typecheck` verdes na conclusão.                                                                                                                                                            |

**Resultado**: nenhuma violação. **Complexity Tracking** vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/010-digital-signature-infra/
├── spec.md              # /speckit-specify
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/           # Phase 1 (/speckit-plan)
│   ├── server-actions.md
│   ├── repositories.md
│   └── public-route.md
├── checklists/
│   └── requirements.md  # /speckit-specify
└── tasks.md             # /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── signatures.ts                 # signature_requests + signature_captures + 2 enums + RLS (tenant + capability)
│   │   │   └── index.ts                       # re-export (ALTER)
│   │   ├── migrations/
│   │   │   └── 0009_digital_signature_infra.sql   # drizzle-kit + GRANT + triggers set_updated_at + policy de capability (SQL custom)
│   │   └── repositories/
│   │       └── signature-requests.ts          # queries (withOrg + withSignatureToken), {rows,total} p/ quota
│   ├── db/with-signature-token.ts             # helper: set_config('app.signature_token', sha256, true) por transação
│   ├── domains/
│   │   └── signatures/
│   │       ├── contract.ts                     # tipos + registry de target_type (payloadSchema + FormRenderer)
│   │       ├── schemas.ts                      # Zod: input do request, payload por tipo, captura, assinatura pública
│   │       └── token.ts                        # geração/hash/validação de token + regra de expiração (puro)
│   ├── server/
│   │   └── actions/
│   │       ├── signatures.ts                   # officeAction: create, getStatus, signManually
│   │       └── public-signatures.ts            # submitPublicSignature (SEM gate de office staff)
│   ├── tenant/
│   │   └── plan.ts                             # (ALTER) getSignatureQuota / isSignatureAvailable + FREE_SIGNATURE_MONTHLY_QUOTA
│   └── ui/
│       └── signature/
│           ├── SignaturePad.tsx                # wrapper client de signature_pad
│           └── QrCode.tsx                       # exibe data-URL gerado no servidor
├── app/
│   ├── (public)/
│   │   └── assinar/[token]/page.tsx            # rota pública de captura (sem auth)
│   └── (protected)/
│       └── signatures/page.tsx                 # painel demo: gerar / copiar link / QR / status (polling)
└── __tests__/
    ├── unit/ (token, expiração, quota, schemas Zod)
    └── integration/ (create, submitPublic, expirado, reuso, quota, signManually, cross-tenant)
```

**Structure Decision**: Web app Next.js em camadas (a convenção real do repo). O domínio `signatures` segue o padrão de `domains/pgr/*` (Zod + regras puras) → repositório (dono do SQL, `withOrg`/`withSignatureToken`) → Server Actions (`officeAction` interno; ação pública dedicada sem gate) → UI. Rota pública isolada em `(public)` para ficar fora do layout protegido. **Não** se usa `features/` (a issue sugeria; rejeitado em favor da convenção vigente).

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável.
