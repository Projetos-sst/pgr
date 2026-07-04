# Research — Fase 02 (módulo EPI): decisões técnicas

Resolve os pontos abertos do plano antes do design. Cada item: **Decisão · Justificativa ·
Alternativas rejeitadas**. As decisões de negócio já travadas (D1–D6) estão no
[brainstorming](../../docs/briefings/fase02-epi-completion-brainstorming.md); aqui ficam só as
resoluções técnicas que o plano precisa fixar.

---

## R1 — Rota pública de assinatura resolvendo tenant sem sessão (Princípio I)

**Problema**: `/sign/[token]` é pública (sem Clerk, sem tenant de sessão). Mas o runtime conecta como
`app_runtime`, cujo RLS força `org_id = current_setting('app.current_org', true)`. Sem `orgId` no
contexto, qualquer `SELECT` em `epi_deliveries` por token volta **vazio** (RLS). Como resolver a entrega
e seu tenant a partir só do token, sem elevar privilégio nem furar o isolamento?

**Decisão**: o **token carrega o `orgId` e o `deliveryId`** de forma assinada (ver R2). A rota pública:
(1) verifica a assinatura HMAC e a validade do token → obtém `{orgId, deliveryId}` confiáveis; (2)
executa o acesso sob `withOrg(orgId, tx => …)`, carregando a entrega `WHERE id = deliveryId AND
auth_token = <token>`. O RLS então **valida** que a entrega pertence àquele `orgId` (defesa em
profundidade preservada); o `auth_token` armazenado confirma que o token é o ativo daquela entrega.

**Justificativa**: mantém o Princípio I intacto — o `orgId` não vem de input livre do cliente, e sim de
um token HMAC-assinado emitido pelo próprio tenant no ato de gerar o QR/link; o RLS continua sendo o
backstop. Zero privilégio novo no banco (não precisa de role owner nem `SECURITY DEFINER`). Reusa
`withOrg` sem exceção de infra.

**Alternativas rejeitadas**:
- _Função `SECURITY DEFINER` `resolve_org_by_token`_: adiciona superfície de SQL privilegiado e uma
  migration só para isso; mais risco de isolamento do que ganho. Rejeitada por YAGNI/segurança.
- _Conexão owner na rota pública_: violaria "runtime = least-privilege `app_runtime`"; expõe leitura
  cross-tenant caso o handler tenha bug. Rejeitada.
- _Token opaco aleatório + índice global sem org_: exigiria ler `epi_deliveries` sem `orgId` (RLS
  bloqueia) — inviável sem elevar privilégio. Rejeitada.

---

## R2 — TTL de 72h do token **sem** coluna nova (US3 zero migration)

**Problema**: o schema `epi_deliveries` tem `auth_token text` mas **não** tem coluna de expiração nem de
emissão. Um TTL de 72h precisa de um instante de referência. Adicionar coluna violaria "US3 é zero
migration".

**Decisão**: **token stateless HMAC-assinado** que embute `{orgId, deliveryId, iat}` (issued-at). O
valor é `base64url(payload) + "." + base64url(HMAC-SHA256(payload, EPI_SIGN_TOKEN_SECRET))`. A validade
(72h) é verificada **na aplicação** comparando `now - iat`. O mesmo valor é gravado em
`epi_deliveries.auth_token` para: (a) garantir **um token ativo por entrega** (índice único parcial já
existente), e (b) permitir invalidar o token (a entrega assinada tem `signature_status != pending`, o
que já barra reassinatura; opcionalmente `auth_token = NULL` na assinatura).

**Justificativa**: mantém US3 **zero migration** (D1); o segredo mora em env (`EPI_SIGN_TOKEN_SECRET`),
conforme Princípio V; o token é curto, imprevisível (HMAC) e à prova de adulteração (mudar `iat`/`orgId`
quebra a assinatura). Alinha-se à referência da branch `digital-signature-infra` (token 72h) sem herdar
a tabela genérica.

**Alternativas rejeitadas**:
- _Coluna `auth_token_expires_at`_: transformaria US3 em "com migration", contrariando o fatiamento e
  D1. Rejeitada.
- _JWT com lib nova_: dependência extra para um caso de uso trivial (um HMAC). Rejeitada por YAGNI —
  `crypto.createHmac` do Node basta.
- _Token puramente aleatório com expiração em store externo (Redis)_: nova infra proibida pela
  constituição (Princípio II). Rejeitada.

**Notas de segurança**: rate-limit por IP na rota pública (contagem em memória do handler / cabeçalho de
borda Cloudflare); resposta uniforme para token inválido vs. inexistente (sem enumeração); nunca 500 em
token expirado/entrega assinada — sempre mensagem de negócio.

---

## R3 — Extração de `applyStockExit`/`applyStockEntry` preservando a #72

**Problema**: a baixa está inline em `registerStockExit` (`repositories/stock-movements.ts`). US2 e US4
precisam da mesma mecânica (com `deliveryId`), sem duplicar e sem quebrar os testes existentes da #72.

**Decisão**: extrair dois helpers **transacionais internos** (recebem o `tx` já aberto por `withOrg`):

```ts
async function applyStockExit(tx, { orgId, stockId, quantity, deliveryId, type }): Promise<number>
async function applyStockEntry(tx, { orgId, stockId, quantity, deliveryId, type }): Promise<number>
```

Ambos: `SELECT … FOR UPDATE` da linha do estoque (filtro `orgId` + `id`); exit valida `saldo -
quantity >= 0` (`InsufficientStockError`), entry soma; INSERT do movimento (agora com `deliveryId`
opcional); UPDATE do saldo; retornam o novo saldo. `registerStockExit`/`registerStockEntry` passam a ser
finos: abrem `withOrg` + `auditedTenantWrite` e chamam o helper (sem `deliveryId`, `type` atual). O
`createDelivery`/`returnItem` chamam os helpers **dentro da mesma transação** da entrega/devolução.

**Justificativa**: DRY sem mudança de contrato público — a assinatura e o comportamento de
`registerStockExit`/`Entry` ficam idênticos, então os testes da #72 continuam válidos (refactor puro).
Uma saída, uma entrada, ambas com `FOR UPDATE` na mesma transação.

**Alternativas rejeitadas**:
- _Duplicar a lógica no `createDelivery`_: viola DRY e diverge das regras de saldo. Rejeitada.
- _Helper que abre a própria transação_: quebraria a atomicidade multi-item da entrega (cada item em
  transação separada → rollback parcial). Rejeitada — o helper **deve** receber o `tx` da transação-mãe.

---

## R4 — QR Code e captura de assinatura sem dependência nova

**Decisão**: **QR** gerado no servidor como **SVG** via um gerador mínimo (função pura ou dependência
leve sem binário nativo), servido como `data:` URL/inline; alternativamente exibir o **link** como texto
copiável + QR opcional. **Captura de assinatura** na rota pública via `<canvas>` nativo (pointer events)
→ exporta `toDataURL('image/png')`; a imagem é enviada ao endpoint de assinatura e persistida junto ao
status. Persistência da imagem: **texto/base64 no registro da entrega não é ideal**; como o schema não
tem coluna de imagem e US3 é zero-migration, a **prova visual** é opcional nesta fatia — o requisito
legal essencial é `signature_status = signed_*` + timestamp (data/hora). A imagem, se capturada, pode ir
para Storage (particionado por tenant) numa evolução; **não** persistir imagem grande em coluna de texto.

**Justificativa**: mantém zero-migration e YAGNI. O valor jurídico mínimo (quem/quando/por qual método)
é atendido pelo `signature_status` + timestamp já modelados. Signature-pad por `<canvas>` não exige lib.

**Alternativas rejeitadas**:
- _Coluna `signature_image`_: migration extra em US3 (rejeitada por D1/fatiamento). Imagem vai a Storage
  no futuro.
- _Lib pesada de signature-pad_: desnecessária; `<canvas>` nativo cobre o caso. Rejeitada por YAGNI.

> **[NEEDS CLARIFICATION resolvida por default]**: se o negócio exigir persistir a imagem da assinatura
> já nesta fatia, isso vira upload para Supabase Storage particionado por tenant (sem coluna nova) — mas
> por YAGNI o default é **não** persistir imagem agora; o status assinado + timestamp é a prova. Ajustar
> em /speckit-clarify se o requisito legal exigir a imagem.

---

## R5 — Migration `0010`: `ALTER TYPE … ADD VALUE` e o runner de integração

**Problema**: `ALTER TYPE stock_movement_type ADD VALUE 'employee_return'` não pode rodar dentro de um
bloco de transação em algumas versões do Postgres se o valor for **usado** na mesma transação; e o helper
de integração (`_helpers/db.ts`) aplica migrations dividindo cada `.sql` em `--> statement-breakpoint`.

**Decisão**: a migration `0010` terá dois statements separados por `--> statement-breakpoint`:
(1) `ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'employee_return';` e
(2) `ALTER TABLE epi_delivery_items ADD COLUMN returned_at timestamptz;`. O valor de enum **não** é
usado por nenhum DDL da própria migration (só por DML em runtime, depois), evitando o erro de "unsafe use
of new value". Emitida via `npm run db:generate` + SQL custom (padrão da `0005`), aplicada pela conexão
direta unpooled (owner). Sem GRANT/RLS novos — a coluna herda a policy da tabela; `set_updated_at` já
existe em `epi_delivery_items`.

**Justificativa**: `IF NOT EXISTS` torna a migration idempotente/segura; separar os statements evita a
restrição de uso de enum novo na mesma transação; o runner de integração aplica cada statement
isoladamente. Reversão: `DROP COLUMN returned_at`; o valor de enum é **forward-only** (Postgres não
remove valor de enum) — documentado no cabeçalho da migration.

**Alternativas rejeitadas**:
- _Recriar o enum (`CREATE TYPE novo` + swap de colunas)_: destrutivo e arriscado num enum já em uso.
  Rejeitada.
- _Usar `text` + `CHECK` em vez de enum_: mudaria o modelo 008 além do necessário. Rejeitada.

---

## R6 — Novos códigos de erro no contrato

**Decisão**: acrescentar ao mapa `HTTP_BY_CODE` de `src/shared/api/rest.ts`:
`ALREADY_SIGNED → 409`, `ALREADY_RETURNED → 409`, `TOKEN_INVALID → 404`, `TOKEN_EXPIRED → 410`. Criar as
`AppError` correspondentes em `src/shared/errors/*` (mesmo padrão de `InsufficientStockError`/
`NotFoundError`), cada uma com seu `code`. `toActionError` já converte qualquer `AppError` em
`ActionError` automaticamente — nenhuma mudança nele.

**Justificativa**: reusa o pipeline único de erro (Server Action e REST mapeiam o mesmo código); segue o
padrão de domínio "código de negócio, não HTTP cru". `410 Gone` para token expirado comunica melhor que
`404` (o recurso existiu e caducou); ambos são aceitáveis pela spec — escolhido `410`.

**Alternativas rejeitadas**:
- _Reusar `FORBIDDEN`/`VALIDATION` genéricos_: perde a semântica verificável dos edge cases (a spec pede
  códigos distintos). Rejeitada.

---

## R7 — US1: tornar controlados os campos de CA no formulário do catálogo

**Decisão**: no `epi-catalog-form.tsx`, converter `ca`, `caValidUntil`, `manufacturer`, `norm` de
`TextField` não-controlado (`defaultValue`) para **estado controlado** (`useState`), trocar o
`TextField` de CA pelo `CaField` (`value`/`onChange`/`onFound`), e no callback `onFound` escrever
`manufacturer`/`norm`/`caValidUntil` no estado (cópia por valor). Os quatro campos permanecem editáveis;
o `handleSubmit` passa a ler do estado (não do `FormData`) para esses campos. Nada no `epis.ts`,
`epiCatalogInputSchema` ou nos demais campos muda (D6).

**Justificativa**: `CaField` é controlado por design (já pronto na fatia 011); autofill exige que os três
campos-alvo sejam controlados para refletir o `onFound`. Mudança mínima e localizada no componente.

**Alternativas rejeitadas**:
- _Manipular o DOM via refs para autofdill mantendo `defaultValue`_: frágil e fora do idioma React do
  repo. Rejeitada.
- _Persistir o resultado do CAEPI numa tabela do tenant_: proibido por D6/YAGNI (a base global é a
  fonte). Rejeitada.

---

## R8 — `createDelivery`: como a entrega dá baixa por item

**Decisão**: o input de criação carrega `employeeId`, `deliveryDate` e `items: [{ stockId, quantity }]`
(a UI seleciona itens da **lista de estoque com saldo**, então `stockId` é conhecido). O repositório,
dentro de `withOrg` + transação: insere `epi_deliveries` (`pending`); para cada item faz
`SELECT … FOR UPDATE` do estoque (obtém `catalogId`), insere `epi_delivery_items` com o `catalogId`
derivado e a `quantity`, e chama `applyStockExit(tx, { type: 'employee_delivery', deliveryId })`. Falha
em qualquer item → rollback total (nada persiste). O `stock_movements.deliveryId` liga o movimento à
entrega (já modelado).

**Justificativa**: `epi_stock` é único por `(orgId, catalogId)`, então `stockId` identifica o item de
catálogo sem ambiguidade; derivar `catalogId` do estoque travado garante coerência e evita input
redundante do cliente. Atomicidade multi-item via transação-mãe (R3).

**Alternativas rejeitadas**:
- _Input por `catalogId` e resolver o `stockId` depois_: exigiria uma busca extra e não travaria a linha
  certa cedo; `stockId` direto é mais simples e é o que a UI já tem. Rejeitada.

---

## Resumo das decisões

| # | Decisão |
| --- | --- |
| R1 | Token embute `orgId`+`deliveryId`; rota pública roda sob `withOrg(orgId)`; RLS valida posse. |
| R2 | Token stateless HMAC (`orgId,deliveryId,iat`), TTL 72h em app; segredo em env; **zero migration**. |
| R3 | Extrair `applyStockExit`/`applyStockEntry` recebendo o `tx`; `registerStock*` viram finos (preserva #72). |
| R4 | QR = SVG; assinatura = `<canvas>` nativo; imagem **não** persistida nesta fatia (status+timestamp é a prova). |
| R5 | `0010` = `ADD VALUE IF NOT EXISTS` + `ADD COLUMN returned_at`, statements separados; enum forward-only. |
| R6 | +`ALREADY_SIGNED`(409), `ALREADY_RETURNED`(409), `TOKEN_INVALID`(404), `TOKEN_EXPIRED`(410). |
| R7 | US1: campos de CA controlados; troca só o componente; modelo intacto. |
| R8 | `createDelivery` recebe `items:[{stockId,quantity}]`; deriva `catalogId` da linha travada; baixa por item. |
