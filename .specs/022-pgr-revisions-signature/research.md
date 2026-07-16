# Research — Feature 022 · Revisões, consolidada e assinatura pública do PGR

Todas as decisões abaixo foram tomadas **depois** de ler o código real. Cada uma cita o arquivo/linha
que a sustenta. Nenhum contrato foi inventado.

---

## D1 — Por que o editor em abas está órfão, e qual é a correção mínima

**Achado.** `git grep -n "PgrEditorTabs" -- src` retorna **uma única linha**: a própria declaração em
`src/app/(protected)/pgr/[id]/_components/pgr-editor-tabs.tsx:27`. O commit da Feature 019
(`ae34bff`) criou os 5 componentes de aba, os domínios, repositórios, actions, REST e testes — mas
**não inclui `page.tsx`** na lista de arquivos. O último (e único) commit de `page.tsx` é `0adf3ca`,
da Feature 013. Enquanto isso, `.specs/019-pgr-consolidated-view/tasks.md:137` diz:

```
- [x] T022 [US1] Reescrever `src/app/(protected)/pgr/[id]/page.tsx` como **shell** do editor …
```

**A T022 foi marcada como concluída e a edição nunca entrou no commit.** O `plan.md:99` da 019
também declara `page.tsx  # EDIT — vira o editor com abas`. Não é um bug de design: é uma edição
perdida.

**Decisão.** A montagem em si é **um arquivo** (`page.tsx` como shell). `PgrEditorTabs` já é um
componente puramente apresentacional — não busca nada, recebe tudo por props:

```ts
PgrEditorTabs({
  pgrId,
  pgr,
  companyName,
  workUnitName,
  availableGes,
  gesLinks,
  revisions,
  consolidated,
});
```

O `page.tsx` atual já resolve `pgr`, `companyName` e `workUnitName`. Falta buscar, no mesmo
`Promise.all`: `listPgrGesAction(id)`, `listPgrRevisionsAction(id)`, `getPgrConsolidatedAction(id)`
(→ `res.ok ? res.data : null`) e `availableGes` via `listGesAction({ companyId, pageSize: 100 })`
(idioma da casa, ver `risks/_components/risk-form.tsx:103`). A grade de `Field` da página atual sai —
ela é byte-idêntica à de `pgr-basic-info-tab.tsx`, que passa a renderizá-la.

**Mas a aba de revisões também muda** (achado da review — não estava no plano original).
`pgr-revisions-tab.tsx` hoje tem um **campo de formulário** `<input name="revisionNumber">` (linha 80),
o default `Math.max(...revisions.map(r => r.revisionNumber)) + 1` (linha 35) e envia `revisionNumber`
para a action (linha 52). Com o servidor assumindo a numeração, o componente **deve**:

- **remover** o `<input name="revisionNumber">` e seu `FieldError`;
- **remover** o cálculo client-side `Math.max(...) + 1`;
- **remover** `revisionNumber` do objeto enviado à action;
- manter **apenas** data (`revisedAt`) e notas (`notes`);
- **exibir** o número somente **depois** que o servidor devolver a revisão criada (a coluna da tabela
  de histórico permanece);
- preservar `router.refresh()`, a ordenação e o feedback de erro/sucesso.

**Alternativas rejeitadas.** Reimplementar as abas (desperdício — elas funcionam); adiar a correção
para outra fatia (as US2–US5 desta fatia **vivem dentro** do editor; sem ele nada é alcançável); manter
o campo na UI e ignorá-lo no servidor (**UX inaceitável** — o usuário digitaria um número que não tem
efeito).

---

## D2 — Numeração da revisão no servidor: `FOR UPDATE` na linha do `pgr`

**Achado.** Hoje `pgrRevisionInputSchema` (`domains/pgr/pgr-revision.ts:20-24`) exige
`revisionNumber` **do cliente** (`revisionNumberField`, `int().min(1)`), e
`createPgrRevision` (`repositories/pgr-revisions.ts:40-60`) simplesmente insere o que recebeu. O
`max+1` existe apenas como `defaultValue` de formulário em `pgr-revisions-tab.tsx:34-36`. A única
garantia é o UNIQUE `uq_pgr_revisions_org_pgr_number`.

**Decisão.** O input **deixa de aceitar `revisionNumber`** (contrato novo e limpo — opção 1 do
briefing; nada de campo "interno ignorado", que só convida confusão). O número passa a ser calculado
**dentro da transação**. `withOrg` **já é uma transação** (`db/with-org.ts` → `db.transaction`), então
a atomicidade vem de graça; o que falta é **serializar** criações concorrentes do mesmo PGR.

Como `pgr_revisions` não tem contador para travar e `SELECT max(...)` **não trava nada**, travamos a
**linha-pai** `pgr` com `.for("update")` — espelhando `lockStockRow` de
`repositories/stock-movements.ts:39-52`, que é o precedente da casa para read-compute-write atômico:

```ts
// dentro de withOrg(orgId, async (tx) => { ... })
await tx
  .select({ id: pgr.id })
  .from(pgr)
  .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
  .for("update")
  .limit(1); // serializa concorrentes do MESMO pgr
const [{ next }] = await tx
  .select({
    next: sql<number>`coalesce(max(${pgrRevisions.revisionNumber}), 0)::int + 1`,
  })
  .from(pgrRevisions)
  .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)));
// insert com revisionNumber: next
```

O agregado escalar usa o idioma da casa (`sql<number>` com cast `::int`, ver
`stock-movements.ts:284-287`). O UNIQUE permanece como **backstop de banco**, exatamente como o
`CHECK balance >= 0` é backstop em `stock-movements.ts:147-148`.

### Comportamento concorrente — **decisão fechada (spec emendada em 2026-07-14)**

Com o lock, duas criações concorrentes no mesmo PGR **serializam e ambas têm sucesso**, com números
distintos e consecutivos (1 e 2). **Nenhuma revisão é perdida.** É o comportamento desejável, e a
**FR-006** / **US2.3** / **SC-002** foram emendadas para descrevê-lo (antes diziam que a corrida
resultaria em `DUPLICATE` — texto herdado do comportamento antigo, com o número vindo do cliente).

Sequência normativa (7 passos):

1. abrir a operação dentro de `withOrg` (que **já é** uma transação);
2. travar a linha do `pgr` com `SELECT … FOR UPDATE`;
3. o próprio lock **valida que o PGR pertence ao tenant** (sem linha → `NotFoundError`);
4. calcular `COALESCE(MAX(revision_number), 0) + 1` para aquele `(org_id, pgr_id)`;
5. inserir a revisão com o número calculado;
6. concluir a transação;
7. manter a UNIQUE como **backstop defensivo**.

Notas de desenho:

- **O lock é por PGR, nunca global.** PGRs diferentes **não se bloqueiam** entre si (o `FOR UPDATE`
  incide numa única linha de `pgr`).
- **`revisionNumber` é PROIBIDO no input público.** O schema é **`.strict()`**: um número enviado pelo
  cliente é **rejeitado com `VALIDATION` (422)**, não ignorado. O `z.object()` padrão do Zod
  **removeria** a chave em silêncio, deixando um cliente antigo **acreditando que controla o número** —
  falha invisível. Com `.strict()`, o contrato quebrado **aparece** (FR-005). Consequência de UI: o
  campo de número **desaparece do formulário** (`pgr-revisions-tab.tsx`) — enviar campo desconhecido e
  ignorá-lo não é UX aceitável.
- **Sem retry.** O lock já serializa; não há loop de retry (nem finito nem infinito) — introduzir um
  só se algum padrão real do repositório o justificasse, e nenhum justifica.
- **A UNIQUE não é removida.** `DUPLICATE` (409) continua mapeado e testado, mas como **colisão
  inesperada** (ex.: linha legada gravada fora do fluxo), **não** como desfecho da concorrência normal.

---

## D3 — Extensão read-only da consolidada: 5 → 6 queries, sem N+1

**Achado.** `repositories/pgr-consolidated.ts` monta tudo em **5 queries em lote** dentro de um único
`withOrg`: head (`:50-71`), GES (`:86-91`), riscos (`:96-104`), avaliação vigente por
`DISTINCT ON` em SQL cru (`:107-126`) e medidas (`:129-160`), com composição em memória (`:162-184`).
Guardas de vazio já existem (`gesRows.length === 0` → retorno antecipado; `riskIds.length > 0` nas
queries 4 e 5).

**Decisão.** Acrescentar **uma sexta query em lote**, imediatamente após o bloco de medidas e antes da
composição, guardada por `if (riskIds.length > 0)`:

```ts
// epi_risk ⨝ epi_catalog — mesma forma de listRiskEpis (repositories/epi-risk.ts:52-70)
.select({ id: epiRisk.id, catalogId: epiRisk.catalogId, name: epiCatalog.name,
          ca: epiCatalog.ca, neutralization: epiRisk.neutralization })
.from(epiRisk).innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
.where(and(eq(epiRisk.orgId, orgId), inArray(epiRisk.riskId, riskIds)))
.orderBy(asc(epiCatalog.name))
```

→ `episByRisk: Map<string, ConsolidatedEpi[]>`, lido no laço `for (const r of riskRows)` (`:164`).
`inArray` e `asc` **já estão importados** (`:3`). Continua **O(1) queries** — 6, independentemente da
quantidade de GES/riscos.

As queries 3 e 4 **ampliam a lista de colunas selecionadas** (não são novas queries):

- **Riscos** (query 3) passa a trazer também: `hazard`, `sources`, `propagation`, `exposureTime`,
  `possibleInjuries`, `noxiousAgentCode`, `measurementUnit`, `concentrationIntensity`.
- **Avaliação vigente** (query 4, SQL cru) passa a trazer também: `criterion`, `probability`,
  `severity`, `uncertainty_degree`, `tolerance_limit`, `assessed_at`.
- **Medidas** (query 5) passa a trazer também: `justification`, `monitoring`, `actionWhat`,
  `actionHow`, `actionTracking`, `actionMeasurement` — completando o **5W2H** (hoje só chegam
  `actionResponsible` e `actionDeadline`).

**Campos eSocial S-2240**: são exatamente os quatro já persistidos em `risks` e comentados como tal em
`schema/risks.ts:111` e `:114` — `noxious_agent_code`, `measurement_unit`, `concentration_intensity`,
`exposure_time`. **Nenhum campo eSocial é inventado.**

**Armadilha de tipo**: `risks.concentration_intensity` é `numeric` → o Drizzle devolve **`string`**,
não `number`. O tipo do domínio deve ser `string | null`. `risk_assessments.result` é **`text`** (não
enum) e carrega um `RiskClassification` (`trivial|tolerable|moderate|substantial|intolerable`,
`domains/pgr/methodology.ts:18-24`).

**Alternativa rejeitada**: buscar EPIs por risco chamando `listRiskEpis` num laço — seria N+1 exato,
contra a FR-017.

---

## D4 — Assinatura do PGR = **+1 entrada no registry**, zero migration

**Achado.** `signature_requests.target_type` é **`text`** (não enum) e `target_id` é `uuid` nullable
(`schema/signatures.ts`); existe até o índice `idx_signature_requests_target (target_type, target_id)`.
O teste `src/__tests__/integration/signatures/extensibility.test.ts` **já prova** que um
`target_type` arbitrário (`"work_order"`) atravessa as mesmas tabelas e assina, sem migration.

Os únicos conjuntos fechados são de **TypeScript**:
`SIGNATURE_TARGET_TYPES = ["demo"] as const` (`domains/signatures/contract.ts:10`), o
`signatureTargetRegistry: Record<SignatureTargetType, …>` (`:23-25`) e o
`signatureFormRegistry: Record<SignatureTargetType, …>` (`ui/signature/form-registry.tsx:18`) — ambos
`Record` exaustivos, então o compilador **obriga** a entrada nova.

**Decisão.** Plugar o PGR com 4 edições de código e **zero** de schema:

1. `domains/signatures/targets/pgr.ts` — **NOVO**: `pgrSignaturePayloadSchema`.
2. `domains/signatures/contract.ts` — `SIGNATURE_TARGET_TYPES = ["demo", "pgr"]` + entrada no registry.
3. `ui/signature/PgrSignatureForm.tsx` — **NOVO** (client), espelhando `DemoSignatureForm` e reusando
   `SignaturePad`.
4. `ui/signature/form-registry.tsx` — `pgr: PgrSignatureForm`.

**A página pública `/assinar/[token]` NÃO é tocada** — ela já resolve o formulário pelo registry
(`page.tsx:43-52`). `target_id` guarda o `pgrId` (`createSignatureRequestSchema` já aceita
`targetId: z.string().uuid().optional()`).

**Alternativa rejeitada**: replicar o token HMAC inline do EPI (`epi_deliveries.auth_token`) — seria
infraestrutura paralela (proibido pela Inv-4) e, pior, o EPI guarda o token **em texto puro** e
**descarta a imagem** da assinatura.

---

## D5 — Payload público: mínimo, montado no servidor, congelado

**Achado.** O `payload` é `jsonb` gravado **na criação** e devolvido cru por `resolvePublicSignature`
(`actions/public-signatures.ts:61-74`). A página pública **nunca consulta o PGR** — ela renderiza o
payload. Ou seja: o payload **é** toda a superfície de exposição pública, e ele **congela** no instante
da criação (FR-023).

**Decisão — contrato final** (`domains/signatures/targets/pgr.ts`):

```ts
export const pgrSignaturePayloadSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
  workUnitName: z.string().trim().max(200).nullable(),
  responsibleName: z.string().trim().max(200).nullable(),
  issuedAt: z.iso.date().nullable(),
  validUntil: z.iso.date().nullable(),
  revisionNumber: z.number().int().min(1).nullable(),
});
```

- **Datas como `z.iso.date()`** (`AAAA-MM-DD`): é o tipo real — `pgr.issued_at`/`valid_until` são
  colunas `date`, que o Drizzle devolve como `string`. Mesmo idioma de `pgrRevisionInputSchema`.
- **`responsibleName` é `nullable`**: `pgr.responsible` é `text` **NULL**.
- **`documentTitle` é composto no servidor** — **não existe coluna de título no `pgr`**. Função pura
  `buildPgrDocumentTitle({ companyName, workUnitName })` em `domains/pgr/pgr-signature.ts` (unit).
- **`pgrId` NÃO entra no payload** — ele já vive em `signature_requests.target_id`. Duplicá-lo seria
  ruído e mais superfície pública.
- **Proibidos** (e o schema, sendo `z.object` estrito no que declara, não os carrega): `orgId`, ids de
  GES/riscos, `employees`/trabalhadores expostos, CPF, e-mail, telefone, matrícula, listas completas de
  riscos/medidas/EPIs, dados de plano/billing, token cru, consolidada completa.

**O payload é montado exclusivamente por código servidor** (ver D6) — o cliente **nunca** o envia.

---

## D6 — Núcleo compartilhado: a regra de cota vive **uma vez**

**Problema.** A action genérica `createSignatureRequest` (`actions/signatures.ts:36`) recebe o
`payload` **do chamador**. Se a UI do PGR chamasse essa action direto, **o cliente estaria montando o
payload público** — poderia injetar PII ou mentir sobre a empresa. Inaceitável (FR-023/FR-027).

Por outro lado, uma action nova do PGR que refizesse o gate de cota **duplicaria a regra** — contra o
princípio de que a regra vive uma vez.

**Decisão.** Extrair o núcleo, espelhando o padrão da fatia 016
(`server/pgr/ai-risk-suggestion-core.ts` consumido por Server Action + REST):

```
src/shared/server/signatures/create-request-core.ts   (NOVO)
  createSignatureRequestCore(ctx: TenantContext, input: { targetType, targetId?, payload, ttlSeconds? })
    → valida payload pelo registry
    → gate de cota:  countRequestsInCurrentMonth(ctx.tenantId) + isSignatureAvailable(ctx.plan, n)
                     → QuotaExceededError  (QUOTA_EXCEEDED → 402)
    → generateToken() → repo.createRequest(hashToken(raw)) → buildPublicSignatureUrl → QRCode
    → { requestId, publicUrl, qrCodeDataUrl }
```

Consumidores:

- `createSignatureRequest` (action existente) — passa a **delegar** ao core. Comportamento inalterado;
  os 9 testes de integração da 010 seguem valendo.
- `requestPgrSignatureAction` (nova) — monta o payload **no servidor** e chama o core.
- `POST /api/v1/pgr/[id]/signature` (novo) — chama o **mesmo** core.

**Cota compartilhada, de graça.** `countRequestsInCurrentMonth(orgId)`
(`repositories/signature-requests.ts:49-62`) conta `count(*)` de `signature_requests` do tenant no mês
corrente **sem filtrar `target_type`**. Logo, pedidos de PGR **já** consomem o mesmo contador que os de
`demo` — não é promessa, é consequência do reuso. `free` = `FREE_SIGNATURE_MONTHLY_QUOTA = 10`
(`tenant/plan.ts`), `pro` ilimitado. **Nenhuma cota nova, nenhum bypass, nada em billing/plans.**

---

## D7 — Estado da assinatura: derivado, e uma função nova de repositório

**Achado.** O painel demo (`signatures/_components/signature-panel.tsx`) guarda o `requestId` **em
estado React** — ele nunca consulta "qual é o pedido deste alvo". Para o PGR isso não serve: ao
recarregar `/pgr/[id]`, o estado precisa vir do banco. E **não existe** função de "buscar pedido por
alvo" — a lista de exports do repositório é fechada (`createRequest`,
`countRequestsInCurrentMonth`, `getRequestStatusById`, `getRequestByToken`, `consumeAndCapture`,
`signManually`).

**Decisão.** Uma função nova, **zero migration** (o índice
`idx_signature_requests_target (target_type, target_id)` já existe e a serve):

```ts
getLatestRequestByTarget(orgId, targetType, targetId): Promise<LatestRequestRow | null>
// withOrg; LEFT JOIN signature_captures; ORDER BY created_at DESC; LIMIT 1
// → { id, status, expiresAt, signedAt, signerName }
```

O estado do PGR é **derivado na leitura**, reusando `isExpired` (`domains/signatures/token.ts`) — o
`pgr` **não ganha coluna**:

| Situação real                             | Estado exibido           |
| ----------------------------------------- | ------------------------ |
| nenhuma linha                             | `none` (sem solicitação) |
| `status = 'pending'` e não expirou        | `pending`                |
| `status = 'pending'` e `expires_at` < now | `expired` (derivado)     |
| `status = 'signed'`                       | `signed`                 |
| `status = 'cancelled'`                    | `cancelled`              |

`PgrSignatureView` é um tipo do **domínio do PGR** (`"none" | SignatureStatusView`) — **não** um enum
novo no banco nem na infra. Os quatro estados internos são exatamente os de
`SignatureStatusView` (`domains/signatures/types.ts`).

---

## D8 — Revogação: fora. E `cancelled` colapsa em `used` no público

**Achado.** O valor `cancelled` existe no enum, mas **nenhuma action ou função de repositório o
escreve** — é dormente. E `resolvePublicSignature` (`actions/public-signatures.ts:66`) trata
`request.status !== "pending"` como **`used`** — ou seja, um pedido `cancelled` aparece publicamente
como "Link já utilizado".

**Decisão.** Não implementar revogação (Out of Scope da spec). `cancelled` é apenas **exibido** no
fluxo protegido, se algum dia existir. O colapso em `used` no público é **seguro** (estado terminal,
zero escrita) e **não será alterado silenciosamente** — fica registrado aqui e no `data-model.md`.

---

## D9 — Rota pública no `proxy.ts`: a correção bloqueante

**Achado.** `buildPublicSignatureUrl` emite `/assinar/{token}` (`domains/signatures/public-url.ts`),
mas `src/proxy.ts:11-20` só libera `"/sign/(.*)"` (que é do **EPI**). `NO_STORE_PATH_PREFIXES` (`:23`)
idem. Hoje a página pública genérica cai no `auth.protect()` — **o signatário sem conta é redirigido
para o login**. Os 9 testes da 010 chamam as Server Actions direto e por isso nunca pegaram isso.

**Decisão.** Duas linhas, cirúrgicas:

```ts
const isPublicRoute = createRouteMatcher([ …, "/sign/(.*)", "/assinar/(.*)", … ]);
const NO_STORE_PATH_PREFIXES = ["/api/", "/sign-in", "/sign-up", "/sign/", "/assinar/", "/dashboard"];
```

Nenhuma abertura ampla: o matcher é exatamente o prefixo da rota pública, e a credencial continua sendo
o token. A página já é `dynamic = "force-dynamic"` (`assinar/[token]/page.tsx:5`); o `no-store` fecha o
cache de borda. **Teste obrigatório**: `proxy-protection.test.ts` (já existe) ganha caso provando que
`/assinar/x` é pública **e** que as demais rotas continuam protegidas.

---

## D10 — Superfície REST: protegida sim, pública não

**Achado.** (a) **Não existe nenhuma rota REST de assinatura** — a infra 010 é Server-Actions-only.
(b) `restHandler` (`api/rest.ts:85`) chama `resolveContext` → `requireOfficeStaff()`: ele **não pode**
embrulhar uma rota pública. (c) Os códigos que `submitPublicSignature` devolve — `ALREADY_USED` e
`EXPIRED` — **não estão** em `HTTP_BY_CODE` (cairiam em 400). (d) O precedente da casa para fluxo
público é a fatia 012: `api-design.md:54-69` documenta `/sign/{token}` como **página**, e o Postman
documenta o `GET` da página, deixando explícito que a confirmação é uma Server Action.

**Decisão.**

- **Protegido → REST completo** (regra obrigatória das 4 entregas):
  `src/app/api/v1/pgr/[id]/signature/route.ts` — `POST` cria (**201**) e `GET` devolve o estado
  (**200**), ambos por `restHandler` + o **mesmo core**. Segue o aninhamento já usado
  (`/pgr/[id]/revisions`, `/pgr/[id]/consolidated`, `/risks/[id]/epis`).
- **Público → sem REST.** A superfície é a **página** `/assinar/[token]` + a Server Action
  `submitPublicSignature` (reusada como está). O Postman documenta o `GET` da página, espelhando a
  pasta "Assinatura publica (sign)" do EPI.
- **Consequência**: como não há REST público, **não é preciso** mapear `ALREADY_USED`/`EXPIRED` em
  `HTTP_BY_CODE`. Fica registrado que, se um dia o fluxo público ganhar REST, esse mapeamento passa a
  ser obrigatório (hoje seria um 400 silencioso).

---

## D11 — Reconciliação documental (Postman + api-design)

**Achado.** A pasta `Dashboard (plataforma)` **existe** no commit `4601035` (Feature 021) e **não
existe** no `HEAD` — foi descartada pelo _Accept current change_ na resolução de conflito da PR #146.
`api-design.md` está íntegro (linhas 133-135 e 223-225 têm os três recursos). A coleção tem 22 pastas e
114 requests, e é JSON válido.

**Decisão.** Nesta mesma branch/PR (sem hotfix separado — decisão aprovada):

1. **Restaurar** a pasta `Dashboard (plataforma)` com o request `GET /dashboard/summary`, recuperada
   literalmente de `git show 4601035:docs/api/sst-manager.postman_collection.json`.
2. **Posição**: depois de `Equipe (plataforma)`, antes de `Integracoes externas` — refletindo a ordem
   Perfil → Equipe → Dashboard do sumário do `api-design.md`.
3. **Preservar** `Perfil (plataforma)` e `Equipe (plataforma)` intactos (2 + 4 requests).
4. **Adicionar** a pasta da Feature 022 (assinatura do PGR: `POST`/`GET /pgr/{id}/signature` +
   `GET /assinar/{token}` como página).
5. Manter **JSON válido**, **zero marcadores de conflito**, arquivo **único**.

**Dívida registrada (P2, fora do escopo)**: a infra genérica 010 **nunca foi documentada** —
`api-design.md` não tem seção `/assinar` e o Postman não tem pasta de `signature_requests` (a pasta
"Assinatura publica (sign)" é a do **EPI**). Esta fatia documenta a superfície **do PGR**; documentar a
010 retroativamente é follow-up.

---

## D12 — O link só pode ser exibido **uma vez** (limitação herdada)

**Achado.** O token cru **não é persistido** — só o `token_hash` (sha-256). `buildPublicSignatureUrl`
só existe no instante da criação. Não há como reconstruir a URL depois.

**Decisão (requisito de UX/segurança — sem migration).** Ao criar a solicitação, a UI mostra o link
**e** o QR imediatamente, com o aviso literal:

> **Copie este link agora. Por segurança, ele não poderá ser exibido novamente.**

Regras que a implementação MUST seguir:

- Ao **recarregar** `/pgr/[id]`, o painel mostra **apenas o estado** da solicitação
  (`none`/`pending`/`signed`/`expired`/`cancelled`) — **nunca** o link.
- **Gerar outro link cria uma nova solicitação** e **consome mais uma unidade da cota** (FR-037).
- **Não** persistir o token cru para "melhorar a conveniência" — seria um retrocesso de segurança.
- **Não** colocar o token em **logs** nem em **metadata de auditoria** (o `officeAction` audita apenas
  `{ operation, outcome, orgId, userId }` — o token nunca entra aí).

Isso é herdado do desenho de segurança da 010 (o token cru só vive na URL/QR) e é **idêntico** ao
comportamento do painel demo (`signatures/_components/signature-panel.tsx`, que guarda a URL só em
estado React).

---

## Resumo das decisões pendentes

| #   | Decisão                                                                    | Estado                                                             |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Corrida na revisão: **serializar** (ambas vencem, números consecutivos)    | ✅ **FECHADA** — spec emendada (FR-006, US2.3, SC-002, edge cases) |
| 2   | Link público exibível **uma única vez** (token cru não persistido — D12)   | ✅ **FECHADA** — requisito de UX/segurança, sem migration          |
| 3   | Documentar retroativamente a infra 010 em api-design/Postman (D11)         | P2 — follow-up fora desta fatia                                    |
| 4   | Mapear `ALREADY_USED`/`EXPIRED` em `HTTP_BY_CODE` se o público ganhar REST | P2 — só se o fluxo público ganhar REST                             |
