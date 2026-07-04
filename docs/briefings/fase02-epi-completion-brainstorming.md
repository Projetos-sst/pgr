# Fase 02 (módulo EPI) — brainstorming de conclusão

> **Objetivo**: fechar **toda a Fase 02** (o módulo operacional de EPI) numa única leva, a partir do
> `develop` atual, para o Fable implementar via `/speckit-specify`. Este documento é o **brainstorming
> âncora**: escopo real, decisões travadas (KISS/DRY/YAGNI), mapa de reuso e fatiamento. Os fluxos
> narrados estão em [`epi-fluxos-panorama.md`](./epi-fluxos-panorama.md) (F1–F7) — **não** os repetimos
> aqui; referenciamos.

Data: 2026-07-03 · Branch base: `develop` · Constituição: `.specify/memory/constitution.md`.

---

## 1. O que a Fase 02 é (e o que já está pronto)

Fase 02 = módulo de EPI ponta a ponta. As issues (label `Fase 02 — EPIs`):

| # | Fatia | Estado real (em `develop`) |
| --- | --- | --- |
| #17 | Modelo de dados EPI (008) | ✅ mergeado / issue CLOSED |
| #73 | CRUD de Categorias | ✅ mergeado / issue CLOSED |
| #18 | CRUD de Catálogo de EPI | ✅ código mergeado — **falta plugar o CA/CAEPI no form** |
| #70 | CRUD de Estoque | ✅ mergeado — só fechar issue |
| #72 | Movimentações de estoque | ✅ mergeado — só fechar issue |
| #75 / #115 | Validação/consulta de CA (CAEPI) | ✅ backend mergeado — **não plugado ao form do #18** |
| #19 | Entrega de EPI + assinatura digital | ⏳ implementar |
| #20 | Devolução de EPI | ⏳ implementar (**1 migration**) |
| #21 | Ficha/histórico de EPI por funcionário | ⏳ implementar |
| #78 | EPI × risco (neutralização) | ⛔ **Fase 03** — fora (sem módulo de Riscos) |

**Descoberta que enxuga o escopo**: a fatia 008 (mergeada) já criou `epi_deliveries`
(com `signature_status` + `auth_token`), `epi_delivery_items` e o enum `epi_signature_status`
(`pending`, `signed_qr`, `signed_link`, `signed_manual`). O enum `stock_movement_type` já tem
`employee_delivery`. Ou seja: **entrega, assinatura e ficha são "zero migration"**; só a **devolução**
precisa de migration. **Fase 02 inteira = 1 migration nova (`0010`).**

---

## 2. O gap concreto que motivou tudo (evidência)

A fatia 011 (CAEPI) entregou `CaField`, `useCaepiValidation`, `lookupCa` (Server Action) e o REST
`GET /api/integrations/caepi/[ca]` — **testados isoladamente** (36 unit + 14 integração contra
Postgres efêmero, verdes). Mas `grep -rn "CaField" src/app` retorna **vazio**: o formulário real
`epi-catalog-form.tsx` (#18) usa `TextField` manual nos campos `ca`, `caValidUntil`, `manufacturer`,
`norm`. A **User Story 1 da spec 011** ("autopreencher o cadastro de EPI") **não é satisfeita hoje** —
faltou o wiring, porque #18 foi feita antes da CAEPI existir. É a US1 desta leva.

---

## 3. Decisões travadas (KISS / DRY / YAGNI)

### D1 — Assinatura **inline**, não infra genérica (**sobrescreve a §5 do panorama**)

O `epi-fluxos-panorama.md §5` assume a infra genérica polimórfica (`signature_requests`/`captures`,
issue #67) como camada transversal. **Nesta leva NÃO adotamos essa infra.** Usamos o gancho **inline
que já existe** em `develop`: `epi_deliveries.auth_token` (único) + `epi_deliveries.signature_status`
(enum com `signed_qr/link/manual`). Razões:

- **Já está no develop e zero migration** — a 008 modelou exatamente para isto.
- **`CODE_STANDARDS.md`**: *"abstraia quando houver 2+ consumidores reais, não antes"*. Hoje **só** a
  entrega de EPI assina. Quando o PGR (Fase 03+) precisar assinar, aí sim extrai-se a infra genérica —
  com 2 consumidores reais. Construir a tabela polimórfica agora, para 1 consumidor, fere YAGNI.
- Salvamos as **ideias** da branch `feature/digital-signature-infra` (token 72h, QR, rota pública,
  signature-pad) como **referência de implementação**, sem a tabela genérica.

Consequência: a rota pública de assinatura é **`/sign/[token]`** (adicionada ao `isPublicRoute` do
`proxy.ts`, padrão de `sign-in`/`webhooks`), e a captura grava direto no `epi_deliveries`
(`signature_status` + timestamp de assinatura + imagem).

### D2 — Extrair `applyStockExit` (correção verificada)

O `applyStockExit` **não existe em `develop`** (só na branch de entrega). Em `develop`, a baixa está
inline no `registerStockExit` (`repositories/stock-movements.ts`: `SELECT … FOR UPDATE` → valida
`balance >= 0` → `InsufficientStockError` → INSERT movimento + UPDATE saldo). A entrega (US2)
**extrai** `applyStockExit(tx, {stockId, quantity, deliveryId, type})` desse corpo e o reusa; o
`registerStockExit` da #72 passa a chamar o helper (comportamento e testes da #72 **preservados**).
A devolução (US4) usa o espelho `applyStockEntry` para repor saldo. DRY: uma função de saída, uma de
entrada, ambas transacionais.

### D3 — Baixa na confirmação; assinatura pode chegar depois (panorama §9.3)

O EPI **sai do estoque no ato de confirmar a entrega** (transação `withOrg`); a assinatura é a **prova
de recebimento** e pode completar minutos depois (`pending` → `signed_*`). A entrega não fica "presa"
esperando assinatura para dar baixa. Excluir entrega assinada é **proibido** (§9.5) — o caminho de
retorno de saldo é a **devolução** (US4), nunca um estorno silencioso.

### D4 — Devolução: migration `0010` mínima

Adicionar valor **`employee_return`** ao enum `stock_movement_type` (nome consistente com
`employee_delivery`; o panorama cita `return`, mas seguimos `employee_return`) + coluna **`returned_at`**
(`timestamptz`, nullable) em `epi_delivery_items`. Devolver = preencher `returned_at` + criar movimento
`employee_return` (`+ balance`) na mesma transação. Devolução é **por item**, **total** (sem devolução
parcial de quantidade nesta fatia — YAGNI; `returned_at IS NULL` = pendente). Reentrada não pode
devolver 2× (guard por `returned_at`).

### D5 — Ficha (#21) é **só leitura**, zero migration

Join `employees × epi_deliveries × epi_delivery_items × epi_catalog`, escopado por tenant, com o saldo
resultante e status. Sem tabela nem coluna nova. Impressão via CSS print.

### D6 — CA no catálogo: wiring, **sem tocar o modelo**

US1 só troca os `TextField` de `ca`/`caValidUntil`/`manufacturer`/`norm` do `epi-catalog-form.tsx` pelo
`CaField` + `useCaepiValidation` já prontos (autofill no blur, badge, aviso). O `epiCatalogInputSchema`
e o schema `epis.ts` ficam **intactos**. Estado `expired`/`not_found`/erro **nunca bloqueia** o salvar.

---

## 4. Fatiamento em User Stories (para o `/speckit-specify`)

Uma spec, uma branch limpa a partir de `develop`, implementada de uma vez — mas internamente em
histórias priorizadas e independentemente testáveis:

| US | Título | Issues | Prioridade | Migration | Depende |
| --- | --- | --- | --- | --- | --- |
| **US1** | Plugar CAEPI no catálogo (autofill CA) | #18, #75, #115 | P1 | — | base CAEPI + #18 (prontos) |
| **US2** | Entrega + baixa de estoque + assinatura manual | #19 (core) | P1 | — | `applyStockExit` (D2) |
| **US3** | Assinatura pública por QR/link da entrega | #19 (assinatura) | P1 | — | US2 + rota pública |
| **US4** | Devolução + reposição de saldo | #20 | P2 | **0010** | US2 |
| **US5** | Ficha/histórico de EPI por funcionário | #21 | P2 | — | US2 (US4 enriquece) |

Housekeeping (não é código): fechar #70, #72 (já mergeadas) e #75 como duplicada de #115.

Ordem de dependência (panorama §8): US1 é ortogonal; US2 destrava US3/US4/US5.

---

## 5. Mapa de reuso (nada reinventado)

| Precisa | Reusa (já em `develop`) | Onde |
| --- | --- | --- |
| Gate + `ActionResult` + erro→HTTP | `officeAction`, `restHandler`, `toActionError`, `result.ts` | `src/shared/server/*`, `src/shared/api/rest.ts` |
| Tenant | `withOrg` + RLS `app_runtime` | `src/shared/db/with-org.ts`, schema `epis.ts` |
| Baixa/reposição de saldo | `registerStockExit`/`Entry` → **extrair** `applyStockExit`/`Entry` | `repositories/stock-movements.ts` |
| Saldo resultante (histórico) | window function + `computeRunningBalance` | `domains/pgr/stock-movements.ts` |
| Erro de saldo | `InsufficientStockError` → `INSUFFICIENT_STOCK` (422) | `api/rest.ts` |
| Autofill de CA | `CaField` + `useCaepiValidation` + `lookupCa` + REST CAEPI | `src/shared/integrations/caepi/**` |
| Rota pública | `createRouteMatcher`/`isPublicRoute` (add `/sign/(.*)`) | `src/proxy.ts` |
| Paginação | `{rows,total}` via `pagination.ts` | `src/shared/pagination.ts` |
| UI CRUD | `_ui/list`, `_ui/form`, páginas do catálogo/estoque | `src/app/(protected)/_ui/*` |
| QR/token/signature-pad | **referência** da branch `feature/digital-signature-infra` | (não mergear) |

---

## 6. Superfície de API obrigatória (checklist do `CLAUDE.md`)

Cada CRUD/recurso HTTP-exposto entrega **os quatro juntos** no mesmo PR: Server Action
(`officeAction`) + Route Handler REST espelho (`restHandler`, verbos reais) + doc em
`docs/api/api-design.md` + requests no `docs/api/sst-manager.postman_collection.json`. Recursos novos
desta leva:

- `POST/GET /api/v1/epi-deliveries` · `GET/PUT/DELETE /api/v1/epi-deliveries/[id]` (DELETE bloqueado se
  assinada) · `POST /api/v1/epi-deliveries/[id]/sign` (manual) · `POST /api/v1/epi-deliveries/[id]/return`.
- Rota **pública** (fora do `/api/v1`, sem tenant): `GET/POST /sign/[token]` (assinatura QR/link).
- Ficha: `GET /api/v1/employees/[id]/epi-record` (read-only).

---

## 7. Testes (constituição — obrigatório)

- **Unit**: `applyStockExit`/`Entry` (extração preserva comportamento), regra de devolução
  (`returned_at` guard, não devolver 2×), derivação de status da entrega, `CaField` wiring (autofill
  não bloqueia), schemas Zod.
- **Integração (Postgres efêmero `INTEGRATION_*`, nunca SQLite)**: entrega dá baixa atômica +
  `INSUFFICIENT_STOCK` no rollback; assinatura pública muda `signature_status` sem tenant vazar;
  devolução repõe saldo e barra 2ª devolução; ficha não cruza tenant; `NOT_FOUND` cross-tenant;
  `FORBIDDEN` para papel `client`; DELETE de entrega assinada barrado.
- **Isolamento multi-tenant** é caminho crítico obrigatório em toda US com escrita.

---

## 8. Riscos e lacunas (herdados do panorama §9 + novos)

1. **Saldo transacional** é o ponto mais perigoso — `FOR UPDATE` + validação `>= 0` na **mesma**
   transação `withOrg`; `CHECK balance >= 0` é só backstop.
2. **Rota pública de assinatura** amplia a superfície: o token é a **única** credencial → curto,
   imprevisível, expira (72h), rate-limit e sem enumeração. Não vaza dados de outro tenant.
3. **Fonte da verdade = schema** (`src/shared/db/schema/epis.ts`), não texto de issue antiga (campos
   como `standard`/`ca_expires_at`/`current_balance`/`organization_id`/SQLite estão **desatualizados**).
4. **#78 fora**: `epi_risk` existe no schema mas referencia `ges` interino; sem módulo de Riscos, é
   Fase 03. Não gerar código especulativo.

---

## 9. Referências

- Fluxos narrados: [`epi-fluxos-panorama.md`](./epi-fluxos-panorama.md) (F4 entrega, F5 devolução, F6 ficha).
- CA/CAEPI: [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md), [`caepi-logica-de-negocio.md`](./caepi-logica-de-negocio.md).
- Briefings por fatia desta leva: [`018-catalogo-caepi-wiring.md`](./018-catalogo-caepi-wiring.md),
  [`019-entrega-epi-assinatura.md`](./019-entrega-epi-assinatura.md),
  [`020-devolucao-epi.md`](./020-devolucao-epi.md), [`021-ficha-epi-funcionario.md`](./021-ficha-epi-funcionario.md).
- Prompt executável: `docs/specify-prompts/specify-prompt-fase02-epi-completion.md`.
- Modelo real: `src/shared/db/schema/epis.ts` · Padrões: `CLAUDE.md`.
