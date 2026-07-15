---
description: "Task list — Revisões do PGR, revisão consolidada e assinatura pública"
---

# Tasks: Revisões do PGR, revisão consolidada e assinatura pública

**Feature**: 022 · **Branch**: `feature/pgr-revisions-signature` · **Spec**: [spec.md](./spec.md) ·
**Plan**: [plan.md](./plan.md)

**Contratos**: [repositories](./contracts/repositories.md) · [server-actions](./contracts/server-actions.md) ·
[rest-endpoints](./contracts/rest-endpoints.md) · [data-model](./data-model.md) · [research](./research.md)

---

## Invariantes (valem para TODAS as tasks)

- **ZERO migration, ZERO schema.** Nada em `src/shared/db/schema/**` nem `src/shared/db/migrations/**`.
  `npm run db:generate` deve reportar **"No schema changes"**.
- **Tenant sempre da sessão** (`withOrg` + RLS). **Nunca** aceitar `orgId`/`organizationId`/`organization_id`
  do cliente.
- **Token cru nunca** é persistido, logado ou colocado em metadata de auditoria.
- **Fora do escopo**: PDF · Gotenberg · GED · storage · autor persistido · snapshot de versionamento ·
  revisão automática · status no `pgr` · CPF/IP/user-agent · cota nova · billing/plans.

## ⚠️ Acoplamento de compilação (ler ANTES da Phase 2)

`signatureTargetRegistry` (`domains/signatures/contract.ts:23`) e `signatureFormRegistry`
(`ui/signature/form-registry.tsx:18`) são **`Record<SignatureTargetType, …>` exaustivos**. Adicionar
`"pgr"` a `SIGNATURE_TARGET_TYPES` **quebra o typecheck** enquanto qualquer um dos dois registries não
tiver a entrada. Portanto **T020, T021 e T022 formam um bloco atômico** — não podem ser divididos entre
commits nem paralelizados entre si.

---

## Estado da implementação (2026-07-14)

**Progresso: 16/64 tasks concluídas** — **US1 editor + US2 revisões server-side + US3 consolidada
ampliada**, todas **verificadas em Postgres real**. Marcadas `[x]`: T005, T006, T007, T013, T030, T035,
T036, T037, T038, **T045, T046, T047, T048**, **T085, T086, T088**.

**Verificação executada (Postgres efêmero em Docker, `--forceExit`):**

- **`pgr-revisions.test.ts` → 9/9 verdes** (T085/T086): schema estrito (`revisionNumber` → `VALIDATION`),
  número server-side (vazio → 1; com histórico → MAX+1), **concorrência no mesmo PGR → 201+201
  consecutivos, nenhuma perdida**, **lock não-global** (`pgrA` × `pgrA2`), cross-tenant → `NOT_FOUND`,
  **UNIQUE ativa** (insert duplicado → 23505).
- **`pgr-consolidated.test.ts` → 9/9 verdes** (T088): agrega GES→riscos→avaliação→medidas; **EPIs por
  risco**; **5W2H completo** + avaliação detalhada; **campos eSocial S-2240** (`concentration_intensity`
  como string); **fallbacks** (risco sem avaliação/medida/EPI, GES sem riscos, PGR sem GES); cross-tenant.
- **`pgr-isolation.test.ts` → 6/6 verdes** (sem regressão de contagem).
- Unit: 73 suítes / **565** testes; typecheck/lint verdes; build verde; `db:generate` → "No schema changes".

**🔧 Duas armadilhas encontradas e resolvidas (auto-revisão):**

1. **Regressão de seed:** a 1ª versão do T005 inseria `pgrA2` no **seed base**, fazendo `public.pgr` ter
   2 linhas em org_a e quebrando `pgr-isolation` (`seededCountA: 1`). Corrigido: `pgrA2` saiu do seed
   base (mantém 1 pgr/tenant) e é inserido no `beforeEach` da própria suíte de revisões.
2. **Corrupção de migration por `taskkill`:** matar o jest no meio da fase de migrations deixa o Postgres
   efêmero meio-migrado (`type "epi_signature_status" already exists`) e **todas** as suítes falham. **Não
   matar o jest durante migrations**; usar `--forceExit` (o jest trava ao sair por handles abertos do
   `postgres`). Após recriar o DB do zero, a US3 passou 24/24 (3 suítes juntas).

**⚠️ T087 (REST) permanece `[ ]`:** `rest-pgr-editor.test.ts` retorna **500 em toda chamada** —
limitação **pré-existente** do harness REST-via-Jest (os endpoints GES/consolidada não-tocados, no mesmo
arquivo, também dão 500). Precisa de **cURL contra servidor real** (T095), indisponível aqui (sem Clerk).

**⚠️ Nota de ambiente:** o Postgres efêmero foi provisionado **manualmente** (roles + stub `auth.jwt()`),
pois não há script oficial commitado. Não é idêntico ao setup Supabase real — por isso a suíte completa
acusa falhas **também no baseline (HEAD)** em `least-privilege`, `clerk-membership`, `pgr.test.ts` e nas
6 suítes `rest-*`. **Não são regressão desta fatia** (reproduzidas com as mudanças revertidas).

**Pendente (não iniciado):** stack de assinatura US4/US5 (T008–T027, T055–T067, T089–T092); docs/Postman
US6 (T075–T081); validações manuais e gates finais (T095–T105). É a maior parte do trabalho restante.

---

## Phase 1 — Setup e guarda-corpos

**Objetivo**: garantir o ponto de partida e travar os invariantes antes de tocar qualquer código.

- [ ] T001 Confirmar baseline: `git branch --show-current` = `feature/pgr-revisions-signature`;
      `cat .specify/feature.json` = `.specs/022-pgr-revisions-signature`; working tree sem produto
      alterado. **Critério**: os três comandos batem.
- [ ] T002 Registrar a baseline de testes ANTES de qualquer mudança: rodar `npm run test` e
      `npm run test:integration` (com Postgres efêmero) e **anotar o número de suítes verdes**.
      **Critério**: baseline anotada — é o que provará, no gate final, que o refactor do core não regrediu.
- [ ] T003 Confirmar zero-schema: `npm run db:generate` → **"No schema changes"** e
      `git diff --name-status -- src/shared/db/schema src/shared/db/migrations` → **vazio**.
      **Critério**: ambos confirmados. **Esta task se repete no gate final (T104).**
- [ ] T004 [P] Subir Postgres efêmero e exportar `INTEGRATION_DATABASE_URL`,
      `INTEGRATION_DATABASE_URL_ADMIN`, `INTEGRATION_APP_RUNTIME_URL` conforme
      [quickstart](./quickstart.md) §1. **Critério**: `npm run test:integration` roda sem `describe.skip`.
      **Nunca** usar SQLite nem Supabase compartilhado.

---

## Phase 2 — Fundação (bloqueia US2, US4 e US5)

**Objetivo**: seed, domínio e infraestrutura de assinatura — tudo que mais de uma história precisa.

### 2.1 Seed (bloqueia os testes de concorrência)

- [x] T005 Adicionar **`pgrA2`** (2º PGR em **`org_a`**) ao `PGR_IDS`. **AJUSTE na implementação:** o
      `pgrA2` **não** entra no `seedPgrBase` (isso deixaria `public.pgr` com 2 linhas em org_a e
      quebraria `pgr-isolation` `seededCountA: 1`) — é inserido no **`beforeEach` da suíte de revisões**,
      onde prova o lock-não-global. **Por quê**: usar `pgrB` testaria o RLS, não o lock.

### 2.2 Domínio das revisões (TDD — teste vermelho primeiro)

- [x] T006 [US2] Reescrever `src/__tests__/unit/domains/pgr/pgr-editor-schemas.test.ts` para o contrato
      novo: (a) input **válido sem `revisionNumber`**; (b) **`revisionNumber` presente → `success:false`**
      (schema `.strict()`); (c) `revisedAt` inválido → falha; (d) `notes` opcional.
      **Critério**: suíte **VERMELHA** (o schema ainda exige `revisionNumber`).
- [x] T007 [US2] Em `src/shared/domains/pgr/pgr-revision.ts`: remover `revisionNumberField` e o campo
      `revisionNumber` do `pgrRevisionInputSchema`; aplicar **`.strict()`**; manter `revisedAt`
      (`z.iso.date`) e `notes` (`optionalString` — **sem inventar `.max()`**, o helper real não tem);
      manter `revisionNumber` **apenas** em `PgrRevisionListItem` (output). **Critério**: T006 **VERDE**.
      **Depende de**: T006.

### 2.3 Payload e domínio da assinatura do PGR

- [ ] T008 [P] [US4] Criar `src/__tests__/unit/domains/signatures/pgr-payload.test.ts` (**vermelho**):
      payload mínimo válido; **rejeita** campos proibidos (`orgId`, `pgrId`, ids de GES/risco,
      `employees`, CPF, e-mail, telefone, matrícula, listas de riscos/medidas/EPIs, dados de plano);
      `workUnitName`/`responsibleName`/`issuedAt`/`validUntil`/`revisionNumber` aceitam `null`.
      **Critério**: suíte vermelha (o schema não existe).
- [ ] T009 [P] [US4] Criar `src/__tests__/unit/domains/pgr/pgr-signature.test.ts` (**vermelho**):
      `buildPgrDocumentTitle` (com e sem `workUnitName`); `pgrSignatureRequestSchema` aceita
      `{}` e `{ttlSeconds: 3600}`, **rejeita** `{ttlSeconds: 0}`, `{ttlSeconds: -1}` e **qualquer campo
      extra** (`.strict()`); derivação de estado (`none` sem linha; `expired` quando `pending` +
      `expiresAt` no passado; senão o próprio status). **Critério**: suíte vermelha.
- [ ] T010 [US4] Criar `src/shared/domains/signatures/targets/pgr.ts` com `pgrSignaturePayloadSchema`
      (`documentTitle`, `companyName`, `workUnitName`, `responsibleName`, `issuedAt`, `validUntil`,
      `revisionNumber` — **sem `pgrId`**, que vive em `target_id`; **sem `orgId`**; datas como
      `z.iso.date()` porque as colunas são `date`). **Critério**: T008 **VERDE**. **Depende de**: T008.
- [ ] T011 [US4] Criar `src/shared/domains/pgr/pgr-signature.ts` com `PgrSignatureStatus`
      (= `SignatureStatusView`), `PgrSignatureState` (`"none" | PgrSignatureStatus`), `PgrSignatureView`,
      `pgrSignatureRequestSchema` (`.strict()`, `ttlSeconds: z.number().int().positive().optional()` —
      **sem máximo inventado**: a infra também não tem, só o default de 72 h),
      `PgrSignatureRequestInput` e `buildPgrDocumentTitle`. **Nenhum enum persistido.**
      **Critério**: T009 **VERDE**. **Depende de**: T009.

### 2.4 Repositórios da assinatura

- [ ] T012 [P] [US4] Criar `src/shared/db/repositories/pgr-signature.ts` com
      `getPgrSignatureSource(orgId, pgrId)`: **uma** query `pgr` ⨝ `companies` ⟕ `work_units` filtrando
      `org_id` + `id`, `limit 1`, dentro de `withOrg`. Retorna a fonte mínima
      (companyName · workUnitName · responsible · issuedAt · validUntil) ou `null`.
      **NUNCA** lê `employees`, GES, riscos ou medidas.
      **Critério**: `null` para PGR inexistente/cross-tenant.
- [x] T013 [P] [US2] Adicionar `getLatestRevisionNumber(orgId, pgrId): Promise<number | null>` em
      `src/shared/db/repositories/pgr-revisions.ts` (`max(revision_number)` sob `withOrg`; `null` se não
      houver revisão). **Critério**: alimenta `payload.revisionNumber`.
- [ ] T014 [US4] Adicionar `getLatestRequestByTarget(orgId, targetType, targetId)` em
      `src/shared/db/repositories/signature-requests.ts`: `withOrg` + LEFT JOIN `signature_captures` +
      `ORDER BY created_at DESC LIMIT 1`; retorna `{id, status, expiresAt, signedAt, signerName}` ou
      `null`. Servida pelo índice **já existente** `idx_signature_requests_target`. **Leitura → sem
      `auditedTenantWrite`.** **Não** criar `cancelRequest` nem `listRequests`.
      **Critério**: zero migration; a função é a única adição ao arquivo.

### 2.5 Registro do target type `"pgr"` — **BLOCO ATÔMICO** (ver aviso no topo)

- [ ] T020 [US4] Em `src/shared/domains/signatures/contract.ts`: `SIGNATURE_TARGET_TYPES = ["demo", "pgr"]` + entrada `pgr: { payloadSchema: pgrSignaturePayloadSchema }` no `signatureTargetRegistry`.
      **Depende de**: T010. **NÃO commitar sem T021 e T022** (o `Record` exaustivo quebra o typecheck).
- [ ] T021 [US5] Criar `src/shared/ui/signature/PgrSignatureForm.tsx` (`"use client"`), espelhando
      `DemoSignatureForm`: `safeParse` do payload → exibe **título, empresa, unidade (se houver),
      responsável (se houver), datas (se houver), nº da revisão (se houver)**; input de nome
      (`maxLength=120`); reusa `SignaturePad`; chama `submitPublicSignature(token, {signerName,
imageDataUrl})`; tela de sucesso. **NUNCA** consulta PGR/consolidada/`employees` ao vivo — só o
      payload. **NÃO** exibe IDs internos. **Depende de**: T010.
- [ ] T022 [US5] Em `src/shared/ui/signature/form-registry.tsx`: `pgr: PgrSignatureForm`.
      **Depende de**: T020 + T021. **Critério do bloco**: `npm run typecheck` **verde** e
      `src/app/(public)/assinar/[token]/page.tsx` **NÃO é tocada** (ela resolve o form pelo registry).

### 2.6 Núcleo genérico da assinatura (refactor sem mudança de comportamento)

- [ ] T023 [US4] Criar `src/shared/server/signatures/create-request-core.ts` com
      `createSignatureRequestCore(ctx, {targetType, targetId?, payload, ttlSeconds?})`, movendo de
      `actions/signatures.ts:36-69`: validação pelo registry → **gate de cota** (`countRequestsInCurrentMonth` + `isSignatureAvailable` → `QuotaExceededError`) → `generateToken` → `repo.createRequest(hashToken)`
      → `buildPublicSignatureUrl` → `QRCode.toDataURL`. **A regra de cota passa a existir UMA vez.**
- [ ] T024 [US4] Refatorar `src/shared/server/actions/signatures.ts`: `createSignatureRequest` passa a
      **delegar** ao core (mantém `officeAction("signatures.create", …, {audit:true})` e
      `revalidatePath("/signatures")`). `getSignatureStatus` e `signManually` **inalterados**.
      **Depende de**: T023.
- [ ] T025 [US4] **Gate de regressão do refactor**: rodar as **9 suítes** de
      `src/__tests__/integration/signatures/*.test.ts` e as **3 unit**
      (`signatures-{token,schemas,quota}.test.ts`) **SEM EDITAR NENHUMA**.
      **Critério**: todas verdes. Se alguma exigir mudança de **expectativa** (não apenas estrutural), o
      refactor **regrediu** — reverter e refazer. **Depende de**: T024.

### 2.7 Núcleo do domínio PGR (adaptador)

- [ ] T026 [US4] Criar `src/shared/server/pgr/pgr-signature-core.ts` (espelha
      `server/pgr/ai-risk-suggestion-core.ts`) com `createPgrSignature(ctx, pgrId, {ttlSeconds?})`:
      (1) `getPgrSignatureSource` → `null` ⇒ `NotFoundError` **antes de qualquer escrita ou consumo de
      cota**; (2) `getLatestRevisionNumber`; (3) `buildPgrDocumentTitle` **no servidor**; (4) monta o
      `PgrSignaturePayload` mínimo; (5) **delega** a `createSignatureRequestCore` com
      `targetType:"pgr"`, `targetId: pgrId`; (6) retorna `{signature, publicUrl, qrCodeDataUrl}`.
      **NUNCA** aceita payload do cliente. **NUNCA** loga o token.
      **Depende de**: T010, T011, T012, T013, T023.
- [ ] T027 [US4] No mesmo arquivo, `getPgrSignatureView(ctx, pgrId)`: guard (`getPgrById` →
      `NotFoundError`) → `getLatestRequestByTarget(ctx.tenantId, "pgr", pgrId)` → **estado derivado**
      (reusa `isExpired`): sem linha → `none`; `pending` expirado → `expired`; senão o `status`.
      **NUNCA** reconstrói token/URL. **NUNCA** escreve no `pgr`.
      **Depende de**: T011, T014.

**Checkpoint da Phase 2**: `npm run typecheck` verde · T025 verde · zero diff em schema/migrations.

---

## Phase 3 — US1 · Editor em abas efetivamente montado (P1)

**Meta**: `/pgr/{id}` serve o editor. **É pré-requisito visual de US2/US3/US4.**
**Teste independente**: abrir `/pgr/{id}` e navegar as 4 abas.

**Causa-raiz** (research D1): a task **T022 da Feature 019 está marcada `[x]` e a edição nunca entrou no
commit** — `ae34bff` não toca `page.tsx`, cujo último commit é `0adf3ca` (Feature 013).

- [x] T030 [US1] Reescrever `src/app/(protected)/pgr/[id]/page.tsx` como **shell** do editor:
      `requireOfficeStaffPage()` → `getPgrAction(id)` → `!ok ⇒ notFound()` → **um** `Promise.all` com as
      chamadas **independentes**: `getCompanyAction(doc.companyId)`,
      `doc.workUnitId ? getWorkUnitAction(...) : Promise.resolve(null)`, `listPgrGesAction(id)`,
      `listPgrRevisionsAction(id)`, `getPgrConsolidatedAction(id)` e
      `listGesAction({companyId: doc.companyId, pageSize: 100})` → renderiza `<PgrEditorTabs …/>`.
      **Remover** a grade de `Field` da página (é byte-idêntica à de `pgr-basic-info-tab.tsx`).
      **NÃO** reimplementar nenhum componente da 019.
      **Critério**: as 4 abas (Informações básicas · GES · Revisões · Consolidada) renderizam e navegam;
      Cor/Sumário e GED continuam **desabilitadas**; PGR cross-tenant → `notFound()`.
      **Depende de**: nada (os componentes já existem).

---

## Phase 4 — US2 · Revisões com numeração no servidor (P1)

**Meta**: o número da revisão deixa de vir do cliente. **Teste independente**: criar revisão sem enviar
número e ver a sequência correta.

- [x] T035 [US2] Reescrever `createPgrRevision` em `src/shared/db/repositories/pgr-revisions.ts`
      (contrato: [repositories.md](./contracts/repositories.md) §1), dentro do `withOrg` (que **já é**
      transação — `db/with-org.ts`):
      (1) `SELECT id FROM pgr WHERE org_id=? AND id=? FOR UPDATE LIMIT 1` — espelha `lockStockRow`
      (`stock-movements.ts:39-52`); **serializa** concorrentes do MESMO pgr e **é o guard de
      existência/tenant** (sem linha ⇒ `NotFoundError`);
      (2) `coalesce(max(revision_number),0)::int + 1` (idioma de agregado escalar da casa);
      (3) `INSERT … RETURNING` com o número calculado.
      **`values` não traz mais `revisionNumber`.** UNIQUE permanece como **backstop**.
      **SEM retry. SEM update/delete.** **Depende de**: T007.
- [x] T036 [US2] Ajustar `createPgrRevisionAction` em
      `src/shared/server/actions/pgr/pgr-revisions.ts`: `pgrRevisionInputSchema.parse(input)` (o
      `.strict()` faz `revisionNumber` virar `VALIDATION`), delega ao repo, `revalidatePath(\`/pgr/${pgrId}\`)`,
`{audit: true}`. O `getPgrById`prévio **sai do create** (o`FOR UPDATE`já é o guard); **permanece
no list**.`listPgrRevisionsAction` **inalterada**. **Depende de**: T035.
- [x] T037 [US2] Verificar `src/app/api/v1/pgr/[id]/revisions/route.ts`: o handler **não muda de código**
      (já faz `pgrRevisionInputSchema.parse(await req.json())`), mas o **contrato muda**.
      **Critério**: `POST` sem `revisionNumber` → **201** com o número do servidor; `POST` **com**
      `revisionNumber` → **422 `VALIDATION`**; `GET` inalterado. **Depende de**: T007, T035.
- [x] T038 [US2] Ajustar `src/app/(protected)/pgr/[id]/_components/pgr-revisions-tab.tsx`:
      **remover** o `<input name="revisionNumber">` (linha 80) e seu `<FieldError>` (85); **remover** o
      `Math.max(...revisions.map(r => r.revisionNumber)) + 1` (35); **remover** `revisionNumber` do objeto
      enviado à action (52). **Manter** data e notas; **manter** a coluna do número na tabela de histórico
      (119) — o número passa a ser **exibido** só depois que o servidor o devolve. Preservar
      `router.refresh()`, a ordenação e as mensagens de erro/sucesso.
      **Critério**: a UI **não oferece** campo de número. **Depende de**: T007, T036.

---

## Phase 5 — US3 · Consolidada ampliada (P2)

**Meta**: EPIs por risco + 5W2H completo + campos eSocial já persistidos. **Read-only, sem N+1, sem PDF.**
**Teste independente**: abrir a aba Consolidada de um PGR com dados completos.

- [x] T045 [P] [US3] Ampliar `src/shared/domains/pgr/pgr-consolidated.ts`: `ConsolidatedEpi`
      (`{id, catalogId, name, ca, neutralization}` — mesma forma de `EpiRiskLinkItem`);
      `ConsolidatedAssessment` (`criterion, probability, severity, riskLevel, uncertaintyDegree,
toleranceLimit, result, assessedAt`); `ConsolidatedMeasure` ganha `justification`, `monitoring`,
      `actionWhat`, `actionHow`, `actionTracking`, `actionMeasurement`; `ConsolidatedRisk` ganha `hazard`,
      `sources`, `propagation`, `exposureTime`, `possibleInjuries`, **`noxiousAgentCode`,
      `measurementUnit`, `concentrationIntensity` (eSocial S-2240 — os 4 já persistidos, nenhum
      inventado)**, `assessment` e `epis`.
      ⚠️ `concentrationIntensity` é **`numeric`** no banco → tipar **`string | null`**, não `number`.
      `sortConsolidatedRisks` continua válida (`riskLevel` permanece no tipo).
- [x] T046 [US3] Ampliar `src/shared/db/repositories/pgr-consolidated.ts` (contrato §2):
      queries 3/4/5 **só ganham colunas** (riscos: campos eSocial + hazard/sources/propagation/
      possibleInjuries; avaliação `DISTINCT ON`: criterion/probability/severity/uncertainty_degree/
      tolerance_limit/assessed_at; medidas: os 4 campos 5W2H faltantes + justification/monitoring).
      **Query 6 NOVA** (após as medidas, antes da composição, guardada por `if (riskIds.length > 0)`):
      `epi_risk` ⨝ `epi_catalog` com `inArray(epiRisk.riskId, riskIds)`, `orderBy(asc(epiCatalog.name))`
      → `episByRisk`. `inArray`/`asc` **já estão importados**; acrescentar
      `import { epiRisk, epiCatalog } from "../schema/epis";`.
      **Critério**: **6 queries fixas**, independentes da quantidade de GES/riscos (**sem N+1**);
      assinatura de `getPgrConsolidated` **inalterada**; **nada é persistido**. **Depende de**: T045.
- [x] T047 [US3] Ampliar `src/app/(protected)/pgr/[id]/_components/pgr-consolidated-tab.tsx` para exibir
      os EPIs por risco e o **5W2H completo** (hoje só mostra responsável e prazo).
      **Critério**: os 6 campos do plano de ação e a lista de EPIs aparecem. **Depende de**: T045.
- [x] T048 [P] [US3] Ampliar `src/__tests__/unit/domains/pgr/pgr-consolidated.test.ts`: ordenação
      (avaliados por `riskLevel` desc; **sem avaliação por último**); mapeamento de EPIs; mapeamento dos
      6 campos 5W2H. **Depende de**: T045.

---

## Phase 6 — US4 · Solicitação protegida de assinatura (P2)

**Meta**: gerar link e acompanhar o estado **derivado**. **Teste independente**: criar a solicitação e ver
o estado mudar de `none` → `pending`.

- [ ] T055 [US4] Criar `src/shared/server/actions/pgr/pgr-signature.ts` (casca fina —
      [server-actions.md](./contracts/server-actions.md) §4):
      `createPgrSignatureRequestAction({pgrId, ttlSeconds?})` → `officeAction("pgr.signature.create", …,
{audit:true})` → `pgrSignatureRequestSchema.parse` → **delega** a `createPgrSignature` →
      `revalidatePath(\`/pgr/${pgrId}\`)`;
`getPgrSignatureViewAction({pgrId})`→`officeAction("pgr.signature.get", …)`**sem audit** →
delega a`getPgrSignatureView`.
      **A Action não monta payload, não toca Drizzle, não re-implementa cota.** Token **fora** do audit.
      **Depende de**: T026, T027.
- [ ] T056 [US4] Criar `src/app/api/v1/pgr/[id]/signature/route.ts` (`runtime="nodejs"`,
      `dynamic="force-dynamic"`): `POST` → `restHandler` → `pgrSignatureRequestSchema.parse(body)` →
      `createPgrSignature(ctx, pgrId, opts)` → **201** `{signature, publicUrl, qrCodeDataUrl}`;
      `GET` → `restHandler` → `getPgrSignatureView(ctx, pgrId)` → **200** `PgrSignatureView`
      (**nunca** token nem URL). `pgrId` vem **do path**. Body: só `ttlSeconds?` — `payload`/`pgrId`/
      `targetType`/`targetId`/`orgId` → **422** pelo `.strict()`.
      **Chama o MESMO core da Action.** **Depende de**: T026, T027.
- [ ] T057 [US4] Criar `src/app/(protected)/pgr/[id]/_components/pgr-signature-panel.tsx` (`"use client"`,
      espelhando `signatures/_components/signature-panel.tsx`): exibe o **estado atual**
      (`none|pending|signed|expired|cancelled`); botão **Solicitar assinatura**; ao criar, mostra o
      **link + QR** (`QrCode`) e o botão **Copiar**, com o aviso **literal**:
      **"Copie este link agora. Por segurança, ele não poderá ser exibido novamente."**
      Após **reload**, mostra **apenas o estado** — **nunca** o link (o token cru não é persistido, D12).
      **Não** persistir o token no browser. Sinalizar que **gerar outro link consome outra unidade da
      cota**. Polling de status ~3 s enquanto `pending`. **Depende de**: T055.
- [ ] T058 [US4] Adicionar suporte **opcional** `signature?: PgrSignatureView` a
      `src/app/(protected)/pgr/[id]/_components/pgr-editor-tabs.tsx` e repassá-lo a
      `pgr-basic-info-tab.tsx`, que renderiza `<PgrSignaturePanel pgrId signature />` **somente quando a
      prop é fornecida**. A prop **MUST** ser opcional — assim `PgrEditorTabs` continua compilável sem
      ela: T030 monta o editor **sem** assinatura e T059 conecta o estado real depois, **sem janela de
      typecheck vermelho** entre as duas. **Não** usar `signature: PgrSignatureView` obrigatória; **não**
      depender de commit atômico T058↔T059. **Depende de**: T057.
      **Critério**: `npm run typecheck` verde com e sem a prop.
- [ ] T059 [US4] Acrescentar `getPgrSignatureViewAction({pgrId: id})` ao `Promise.all` de
      `src/app/(protected)/pgr/[id]/page.tsx` e passar o resultado a `PgrEditorTabs`.
      **Critério**: ao recarregar, o painel reflete o estado do banco. **Depende de**: T030, T055, T058.

---

## Phase 7 — US5 · Assinatura pública (P2)

**Meta**: assinar sem conta. **Teste independente**: abrir o link em janela anônima e assinar.

- [ ] T065 [US5] Em `src/proxy.ts`: acrescentar **`"/assinar/(.*)"`** a `isPublicRoute` e **`"/assinar/"`**
      a `NO_STORE_PATH_PREFIXES`. **Não** abrir `/api/**`; **não** mexer em `/sign/(.*)` (do EPI); **não**
      afrouxar nenhum outro matcher.
      **Por quê**: hoje `buildPublicSignatureUrl` emite `/assinar/{token}` mas o proxy só libera `/sign/` —
      **a rota pública cai no `auth.protect()`** e a US5 é inalcançável. Os 9 testes da 010 chamam as
      actions direto e por isso nunca pegaram isso.
- [ ] T066 [US5] Estender `src/__tests__/integration/auth/proxy-protection.test.ts`: `/assinar/<token>` é
      **pública** (não redireciona); `/pgr` **continua protegida**; `/api/v1/**` **continua protegido**
      (sem o bypass dev); `no-store` aplicado a `/assinar/`. **Depende de**: T065.
- [ ] T067 [US5] Confirmar que **`src/app/(public)/assinar/[token]/page.tsx` NÃO precisa ser tocada** —
      ela resolve o formulário pelo `signatureFormRegistry` (`page.tsx:43-52`). Idem
      `actions/public-signatures.ts`, `SignaturePad.tsx`, `QrCode.tsx`.
      **Critério**: `git diff --name-status` **não** lista esses 4 arquivos. Só criar task de edição se
      surgir necessidade **real e explícita** durante a implementação. **Depende de**: T021, T022.

---

## Phase 8 — US6 · Docs e Postman (backfill da 019 + a superfície da 022)

**Meta**: a coleção volta a ser a superfície testável — e passa a documentar o que a 019 nunca documentou.

**Achado**: `api-design.md` tem **apenas** `` `/pgr` · `/pgr/{id}` `` (linha 122). **Não existe** linha para
`revisions`, `ges` ou `consolidated`. O Postman, na pasta `PGR`, tem **só os 5 requests do CRUD base**.
Ou seja: **4 Route Handlers da 019 foram entregues com zero documentação**. O verbo é **ADICIONAR**.

- [ ] T075 [US6] Em `docs/api/api-design.md`, **ADICIONAR** à tabela "Recursos" as linhas ausentes da
      **Feature 019** (semântica **inalterada**): `GET`/`POST /pgr/{id}/revisions` ·
      `GET`/`POST /pgr/{id}/ges` · `DELETE /pgr/{id}/ges/{gesId}` (**204**) ·
      `GET /pgr/{id}/consolidated`. **Depende de**: T037, T046.
- [ ] T076 [US6] No mesmo arquivo, **DOCUMENTAR** o contrato novo das revisões: `POST` **não aceita**
      `revisionNumber` (schema estrito) → enviá-lo é **`VALIDATION`/422**; número calculado **só no
      servidor**; concorrência no mesmo PGR → **201 + 201** consecutivos; **409 `DUPLICATE` apenas como
      backstop**. **Depende de**: T075.
- [ ] T077 [US6] No mesmo arquivo, **ADICIONAR** `/pgr/{id}/signature` (`POST` 201, **402** na cota do
      `free`; `GET` estado derivado `none|pending|signed|expired|cancelled`, **sem coluna no `pgr`**), a
      seção **"Rota pública de assinatura do PGR — `/assinar/{token}`"** (espelhando a da fatia 012,
      `:54-69`: token de 256 bits só como hash, TTL 72 h, uso único, anti-enumeração, `no-store`,
      submissão por **Server Action — sem espelho REST de propósito**) e o sumário de actions
      (`Assinatura do PGR` → `actions/pgr/pgr-signature.ts`). **PRESERVAR** Perfil, Equipe e Dashboard.
      **Depende de**: T056.
- [ ] T078 [US6] Em `docs/api/sst-manager.postman_collection.json`, **RESTAURAR** a pasta
      **`Dashboard (plataforma)`** com `GET /dashboard/summary (agregacoes do tenant)` — conteúdo literal
      de `git show 4601035:docs/api/sst-manager.postman_collection.json` (**verificado: o commit existe e
      contém o request**). Posição: **depois de `Equipe (plataforma)`**, antes de `Integracoes externas`.
      **PRESERVAR** `Perfil (plataforma)` (2 requests) e `Equipe (plataforma)` (4 requests) **intactos**.
      **Por quê**: a pasta foi descartada pelo _Accept current change_ no merge da PR #146.
- [ ] T079 [US6] No mesmo arquivo, **ADICIONAR** à pasta `PGR` já existente os subgrupos e requests
      (sem quebrar a estrutura atual):
      `PGR · GES` (`GET`, `POST` 201, `DELETE` 204) · `PGR · Revisões` (`GET`, `POST` 201 **e o request
      negativo `POST … revisionNumber → 422`** com body `{"revisedAt":"2026-07-14","notes":"Cliente
antigo","revisionNumber":99}`) · `PGR · Consolidada` (`GET`) · `PGR · Assinatura`
      (`POST` 201, `GET`, `POST` cota esgotada → **402**). **Depende de**: T075, T077.
- [ ] T080 [US6] No mesmo arquivo, **ADICIONAR** `GET /assinar/:token (pagina publica)` — **sem** headers
      de tenant/role, com descrição explicando que a credencial é o token e que a confirmação é **Server
      Action**. Variável nova `pgrSignToken`. **NÃO inventar endpoint REST público.**
      **Depende de**: T065.
- [ ] T081 [US6] Validar a coleção com os scripts de [quickstart](./quickstart.md) §10:
      `JSON.parse` OK · `Perfil`/`Equipe`/`Dashboard` como **pastas reais** no array principal ·
      todos os endpoints PGR presentes (regex ancorada em `/api/v1/pgr/{id}/…`) · **exatamente 1**
      `POST /revisions` com `revisionNumber` no body (o exemplo de 422) · **zero** marcadores de conflito.
      **Depende de**: T078, T079, T080.

---

## Phase 9 — Testes de integração, cota e segurança

**Postgres efêmero, RLS real. Nunca SQLite. Nunca Supabase compartilhado.**

- [x] T085 [US2] Reescrever `src/__tests__/integration/pgr-editor/pgr-revisions.test.ts`: helper `rev()`
      **sem `revisionNumber`**; substituir o teste "revisionNumber < 1 → VALIDATION" por
      **"`revisionNumber` no input → `VALIDATION`"**; histórico vazio → **1**; histórico com a nº 1 do seed
      → **2**; cross-tenant (`pgrB` com tenant A) → `NOT_FOUND`; papel `client` → `FORBIDDEN`.
      **Depende de**: T035, T036.
- [x] T086 [US2] Acrescentar à mesma suíte os **testes de concorrência**:
      (a) duas criações simultâneas em **`pgrA`** → **ambas persistidas**, números **distintos e
      consecutivos**, **nenhuma perdida** (**não** esperar 409);
      (b) criações paralelas em **`pgrA` × `pgrA2`** (mesmo tenant) → **sem bloqueio mútuo** (o lock é
      **por PGR**, não global);
      (c) a **UNIQUE continua ativa**: insert direto via admin com número repetido → 23505.
      **Depende de**: T005, T035.
- [ ] T087 [US2] Atualizar `src/__tests__/integration/pgr-editor/rest-pgr-editor.test.ts`: bodies de
      revisão **sem `revisionNumber`**; acrescentar `POST` **com** `revisionNumber` → **422**.
      ⚠️ Se o harness REST-via-Jest devolver **500** (limitação **pré-existente**, documentada em
      `rest-pgr-editor.test.ts:5-6`), **registrar a baseline e validar por cURL real** (T095) — comparar
      com o comportamento em `develop` antes de chamar de regressão. **Depende de**: T037.
- [x] T088 [P] [US3] Ampliar `src/__tests__/integration/pgr-editor/pgr-consolidated.test.ts`: consolidada
      com **EPIs** (o seed já tem `epi_risk` ligando `epiCatalogA` ↔ `riskA`) e com **5W2H completo**;
      **fallbacks**: PGR sem GES → `ges: []`; GES sem riscos → `risks: []`; risco sem avaliação →
      `assessment: null` e vai para o **fim** da ordenação; risco sem medidas → `measures: []`; risco sem
      EPI → `epis: []`. **Depende de**: T046.
- [ ] T089 [US4] Criar `src/__tests__/integration/pgr-editor/pgr-signature.test.ts` (mocks do harness:
      `@/shared/db/env`, `next/cache`, `@/shared/auth/require-office-staff`; seed via `seedPgrBase` +
      `seedRequest` — **não** chamar `seedSignatureOrgs`, que faz `truncate`):
      criar solicitação → `target_type='pgr'`, `target_id=pgrA`; **payload sem PII** (assert por SQL admin:
      só as 7 chaves permitidas; **nenhuma** de `orgId`/`pgrId`/`employees`/CPF/listas);
      **payload congelado** — editar o `pgr` depois **não altera** o payload da solicitação já criada;
      `getPgrSignatureView` → `none` → `pending` → `signed`; cross-tenant (`pgrB` com tenant A) →
      `NOT_FOUND` **sem escrita**; papel `client` → `FORBIDDEN`; **o `pgr` permanece com 11 colunas
      intactas**. **Depende de**: T026, T027, T055.
- [ ] T090 [US4] Criar `src/__tests__/integration/pgr-editor/pgr-signature-quota.test.ts`:
      `org_a` é **`free`** (limite 10/mês) e `org_b` é **`pro`** (ilimitado) — já vêm do seed.
      (a) **contador compartilhado**: criar N solicitações de **`demo`** e depois uma de **`pgr`** →
      a de PGR **é bloqueada** quando o total do mês estoura o limite (prova que
      `countRequestsInCurrentMonth` **não filtra `target_type`**);
      (b) `free` acima da cota → **`QUOTA_EXCEEDED`**; (c) `pro` → **nunca bloqueado**.
      **Nenhuma cota nova, nenhum bypass, nada em billing/plans.** **Depende de**: T023, T026.
- [ ] T091 [P] [US5] Criar `src/__tests__/integration/pgr-editor/pgr-public-signature.test.ts`:
      `resolvePublicSignature` de um token de `target_type='pgr'` → `signable` com o payload mínimo;
      token **inválido** ≡ **inexistente** → ambos `invalid` (**anti-enumeração**); **expirado** → `expired`
      **sem escrita**; **usado** → `used` **sem escrita**; **replay** (2º `submitPublicSignature` com o
      mesmo token) → `ALREADY_USED`, **no máximo 1 captura**; **cross-tenant** — token de `org_a` nunca lê
      nem escreve em `org_b`. **Depende de**: T020, T021, T022.
- [ ] T092 [P] Criar/ampliar testes unitários de **cota** e **estado derivado** já cobertos pelos arquivos
      de T008/T009 — confirmar que `isSignatureAvailable` (free/pro) e a derivação `none|pending|signed|
expired|cancelled` têm cobertura. **Depende de**: T011.

---

## Phase 10 — Validação manual (cURL + Playwright) e gates finais

### 10.1 cURL (a superfície REST realmente testável)

- [ ] T095 Rodar o roteiro de cURL de [quickstart](./quickstart.md) §4–§8:
      revisão válida (**201**, número do servidor) · revisão **com `revisionNumber` → 422** ·
      **duas revisões paralelas no mesmo PGR → 201 + 201** consecutivos ·
      **paralelo `pgrA` × `pgrA2` → sem espera mútua** · cross-tenant → **404** · `client` → **403** ·
      GES (`GET`/`POST` 201/`DELETE` 204; duplicado → **409**; GES de outro tenant → **422**) ·
      consolidada (**200**, com EPIs e 5W2H) · criar assinatura (**201**) · consultar estado (**200**) ·
      **cota esgotada → 402** · página pública (**200**, não 307) · `no-store` · token usado → replay
      bloqueado. **Critério**: todos os códigos conferem. **Depende de**: T037, T046, T056, T065.
- [ ] T096 Confirmar por SQL (banco efêmero) que o `payload` da solicitação **não contém PII** e que a
      tabela `pgr` **continua com 11 colunas** (nenhuma de status/assinatura). **Depende de**: T095.

### 10.2 Playwright MCP

- [ ] T097 [US1][US2][US3] UI **protegida** (`/pgr/[id]`): as 4 abas montam e navegam · aba **Revisões**
      **sem campo de número** · criar revisão → número aparece sozinho · Consolidada mostra **EPIs e
      5W2H** · placeholders Cor/Sumário e GED **desabilitados**.
      **Se faltar credencial Clerk**, a UI protegida pode ficar bloqueada — **documentar** e validar por
      cURL (T095). **Depende de**: T030, T038, T047.
- [ ] T098 [US4][US5] Fluxo de assinatura: gerar link → **aviso de cópia única** visível → copiar →
      **recarregar e confirmar que o link sumiu** (só o estado) · abrir `/assinar/{token}` **em janela
      anônima, sem Clerk** → resumo **mínimo** (sem funcionário, sem risco, sem medida) → assinar →
      estado vira **`signed`** · reabrir o link → **"Link já utilizado"** · token **expirado** →
      **"Link expirou"**. **A UI pública DEVE ser testável sem credencial Clerk.**
      **Depende de**: T057, T065, T021.

### 10.3 Gates de qualidade (nesta ordem)

- [ ] T100 Prettier **dirigido** nos arquivos tocados pela feature + em
      `.specs/022-pgr-revisions-signature/**/*.md`. **Não** formatar repo-wide às cegas.
- [ ] T101 `npm run format:check`. Ao falhar, **separar**: (a) falhas reais da feature → corrigir;
      (b) ruído CRLF pré-existente → ignorar; (c) arquivos fora do escopo → não tocar.
- [ ] T102 `npm run lint` · `npm run typecheck` · `npm run build`.
- [ ] T103 `npm run test` e `npm run test:integration` (Postgres efêmero) **comparando com a baseline de
      T002**. **Critério**: nenhuma regressão; as 9 suítes de `signatures/` + as 3 unit passam **sem
      edição** (T025). **Depende de**: T002, T025.
- [ ] T104 **Prova do zero-migration**: `npm run db:generate` → **"No schema changes"** e
      `git diff --name-status -- src/shared/db/schema src/shared/db/migrations` → **VAZIO**.
- [ ] T105 `git diff --check` · `git status --short` · `git diff --name-status` · `git diff --stat`.
      **Critério**: nenhum whitespace error; apenas os arquivos previstos aparecem.

---

## Dependências entre user stories

```txt
Phase 2 (fundação)  → bloqueia US2, US4, US5
  ├─ T005 seed pgrA2        → bloqueia T086 (lock não global)
  ├─ T007 schema strict     → bloqueia T035/T036/T037/T038
  ├─ T020+T021+T022 (bloco) → bloqueia US4 e US5   ⚠️ atômico (Record exaustivo)
  ├─ T023/T024/T025 core genérico → bloqueia T026
  └─ T026/T027 core PGR     → bloqueia US4

US1 (editor montado)  → habilita VISUALMENTE US2/US3/US4; não bloqueia o backend de nenhuma
US2 (revisões)        → independente da assinatura; a última revisão ALIMENTA o payload público (T013)
US3 (consolidada)     → independente da assinatura; NÃO entra no payload público (payload é mínimo)
US4 (solicitação)     → depende do target "pgr", dos 2 cores e do repositório de assinatura
US5 (pública)         → depende do target "pgr", do form-registry e do proxy (T065 é BLOQUEANTE)
US6 (docs/Postman)    → depois dos contratos finais (T037, T046, T056, T065); não depende de PDF
```

**Ordem crítica (caminho mais longo)**:
`T007 → T035 → T036 → T037` (revisões) e
`T010 → T020/T021/T022 → T023 → T024 → T025 → T026 → T055 → T056 → T075…T081` (assinatura + docs).

## Paralelismo

Marcadas `[P]` (arquivos distintos, sem dependência pendente): **T004, T008, T009, T012, T013, T045,
T048, T088, T091, T092**.

**Não** paralelizar: T020/T021/T022 (bloco atômico); qualquer par que toque `page.tsx` (T030 e T059),
`pgr-consolidated.ts` (T045→T046), `pgr-revisions.ts` (T013 e T035 tocam o mesmo arquivo — sequenciar) ou
o Postman (T078/T079/T080 → mesmo arquivo, sequenciais).

## Estratégia de entrega

- **MVP mínimo**: Phase 1 + Phase 2 (só T005–T007) + **Phase 3 (US1)** + **Phase 4 (US2)** — já entrega o
  editor alcançável e a numeração no servidor, que são as duas correções de dívida.
- **Incremento 2**: Phase 5 (US3 consolidada).
- **Incremento 3**: Phase 2 (assinatura) + Phase 6 (US4) + Phase 7 (US5).
- **Fechamento**: Phase 8 (docs/Postman) + Phase 9 + Phase 10.
