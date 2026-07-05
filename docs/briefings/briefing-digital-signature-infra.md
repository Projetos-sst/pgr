# Briefing — Infraestrutura de assinatura digital (links públicos com token + QR + captura)

> Issue: **#67** · `[Fase 00] 05` · Milestone "Fase 00 — Fundação" · branch `feature/digital-signature-infra`
> Labels: `tipo: infra`, `módulo: assinatura-digital`
> Origem deste documento: sessão de brainstorming (skill `superpowers:brainstorming`).
> Conteúdo em PT-BR; código/identificadores em inglês.

---

## 1. Resumo

Construir a **infraestrutura transversal e reutilizável** de assinatura/coleta por link público
com token. É uma **camada de plataforma** consumida por múltiplos módulos (entrega de EPI, Ordem
de Serviço, inspeção de segurança, PGR, foto 3×4, questionário psicossocial). Construir **uma vez**
(DRY) e plugar em cada módulo.

O núcleo entregue: gerar token único e seguro por evento, gerar QR Code/link, expor uma **rota
pública sem login** que valida o token e captura a assinatura (canvas → imagem), persistir o
resultado vinculado ao registro de origem, e refletir o status ("Aguardando" → "Assinado") no
painel interno **em tempo real**. Tudo **isolado por tenant** e respeitando o **plano free/pro**
(spec 005).

---

## 2. Decisões do brainstorming (travadas)

| #   | Tema                         | Decisão                                                                                                           | Motivo                                                                                                                                                               |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Localização**              | `src/shared/{db/schema,db/repositories,domains,server/actions}` + `src/app/(public)` + `src/shared/ui`            | Seguir a convenção real do repo (camadas), **não** `features/` como sugeria a issue.                                                                                 |
| 2   | **Modelagem**                | Tabela **genérica polimórfica** (`signature_requests` + `signature_captures`), discriminada por `target_type`     | DRY pedido pela issue; nesta branch não há código de EPI para refatorar → caminho mais simples e escalável (novo módulo = +1 `target_type`, zero mudança de schema). |
| 3   | **Colunas dormentes de EPI** | `epi_deliveries.auth_token` / `signature_status` ficam **intocadas** nesta fatia                                  | YAGNI; sem sincronização nem migração. Futuro: a integração de EPI lê status de `signature_requests` (fonte única).                                                  |
| 4   | **Tempo real**               | **Polling ~3s** (não SSE)                                                                                         | Simples, robusto, sem conexão persistente, atende o critério `<5s`; bom em serverless.                                                                               |
| 5   | **Lib de QR**                | `qrcode` no **servidor** (gera data-URL)                                                                          | Sem componente React → sem risco de peer-dependency com React 19.                                                                                                    |
| 6   | **Lib de canvas**            | `signature_pad` (vanilla) embrulhada em client component                                                          | Sem peer-dependency de React (imune ao React 19); leve; exporta PNG/data-URL pronto.                                                                                 |
| 7   | **Consumidor #1**            | **Demo auto-contido** (`target_type: 'demo'`)                                                                     | Entrega de EPI vive na branch irmã `ppe-delivery-with-signature` (não mergeada); demo prova o contrato ponta-a-ponta sem conflito/retrabalho.                        |
| 8   | **Token**                    | Aleatório forte (≥256 bits), armazenado **hasheado** (sha-256); TTL curto configurável; **uso único** (`used_at`) | Se o banco vazar, links não são reutilizáveis.                                                                                                                       |
| 9   | **Storage da imagem**        | **base64 (data-URL) no Postgres**, em tabela separada `signature_captures`                                        | Sob RLS por tenant (mais seguro que bucket/ACL); sem infra de storage nova; assinatura PNG é pequena (~5–50 KB).                                                     |
| 10  | **Plano (free/pro)**         | PRO **ilimitado**; free = **10 pedidos criados/mês**; gate na **criação**                                         | Conformidade com spec 005 (ver §7).                                                                                                                                  |

---

## 3. Escopo

### Dentro (MVP desta fatia)

- Geração de token único e seguro por registro/evento (TTL configurável, uso único).
- Geração de **QR Code** a partir do link público com token.
- **Rota pública** `app/(public)/assinar/[token]` que valida o token e exibe o formulário correto
  (por `target_type`).
- **Captura de assinatura** (canvas → PNG base64) e persistência vinculada ao registro de origem.
- Painel interno "Aguardando confirmação" com **status em tempo real (polling)**.
- **Copiar link / exibir QR** na tela interna.
- Suporte à **assinatura manual** (fallback) registrado no sistema.
- **Contrato/registry** de consumo que qualquer módulo importa para gerar seu link e QR.
- **Consumidor de demonstração** (`target_type: 'demo'`) que exercita o contrato ponta-a-ponta.
- **Gate de plano**: free limitado, pro ilimitado (§7).
- **Isolamento multi-tenant** em toda gravação/consulta.

### Fora (adiado — pontos de extensão documentados, sem retrabalho)

- **Envio do link por WhatsApp/SMS/e-mail** → depende da **issue #66** (camada de integrações
  externas, em progresso por outro dev).
- **Storage externo (Backblaze)** para a imagem → exige camada de storage inexistente no repo.
- **Integração com o consumidor real** (entrega de EPI) → vive na branch irmã; documentado o
  caminho de plug-in (registrar `target_type: 'epi_delivery'` + um renderizador de formulário).
- **SSE** (usamos polling).
- **Contador/cron de quota** (usamos contagem derivada).

---

## 4. Modelo de dados

> **Sem SQLite** em lugar nenhum (corrige a issue): integração roda contra **Postgres efêmero**
> (`INTEGRATION_*`), conforme CLAUDE.md.

### `signature_requests` — pedido de assinatura de qualquer módulo

| Coluna                      | Tipo                                  | Notas                                                                   |
| --------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `id`                        | `uuid` PK                             | `defaultRandom()`                                                       |
| `org_id`                    | `text` NOT NULL → `orgs.id` (cascade) | índice; **RLS**                                                         |
| `target_type`               | `text` NOT NULL                       | `'demo'`, futuro `'epi_delivery'`, `'work_order'`, …                    |
| `target_id`                 | `uuid` NULL                           | registro de origem (null no demo)                                       |
| `token_hash`                | `text` NOT NULL **UNIQUE**            | sha-256 do token cru; token cru nunca persiste                          |
| `payload`                   | `jsonb` NOT NULL                      | dados que o formulário renderiza/mostra ao signatário                   |
| `status`                    | enum `signature_request_status`       | `pending \| signed \| cancelled`                                        |
| `expires_at`                | `timestamptz` NOT NULL                | "expirado" é **derivado na leitura** (`expires_at < now()` e `pending`) |
| `used_at`                   | `timestamptz` NULL                    | marca uso único                                                         |
| `created_at` / `updated_at` | `timestamptz`                         | trigger `set_updated_at`                                                |

Índices: `idx_signature_requests_org_id`, `idx_signature_requests_org_id_created_at` (para a
contagem de quota), `uq_signature_requests_token_hash`, `idx_signature_requests_target` (`target_type`,`target_id`).

### `signature_captures` — resultado (1:1 com o request)

| Coluna                      | Tipo                                                           | Notas                  |
| --------------------------- | -------------------------------------------------------------- | ---------------------- |
| `id`                        | `uuid` PK                                                      |                        |
| `org_id`                    | `text` NOT NULL → `orgs.id` (cascade)                          | índice; **RLS**        |
| `request_id`                | `uuid` NOT NULL **UNIQUE** → `signature_requests.id` (cascade) | 1 captura por request  |
| `image_data`                | `text` NOT NULL                                                | data-URL base64 (PNG)  |
| `signer_name`               | `text` NOT NULL                                                |                        |
| `method`                    | enum `signature_method`                                        | `qr \| link \| manual` |
| `signed_at`                 | `timestamptz` NOT NULL                                         | default `now()`        |
| `created_at` / `updated_at` | `timestamptz`                                                  |                        |

### Enums e migration

- 2 `pgEnum`: `signature_request_status`, `signature_method`.
- Migration `0010_digital_signature_infra.sql` (drizzle-kit) com **GRANT** ao `app_runtime` e
  triggers `set_updated_at` como **SQL custom** (padrão `0001`/`0005`), aplicada via conexão
  direta unpooled (owner).

### RLS (dois tipos de policy em `signature_requests`)

1. **Policy de tenant** (padrão do repo, em ambas as tabelas):
   `FOR ALL TO app_runtime USING/ WITH CHECK (org_id = current_setting('app.current_org', true))`.
2. **Policy de capability** (apenas em `signature_requests`, para a rota pública sem sessão):
   `FOR SELECT TO app_runtime USING (token_hash = current_setting('app.signature_token', true))`.
   Sem org no contexto, o `app_runtime` só lê **a única linha cujo token ele possui**.

---

## 5. Contrato de consumo (DRY)

```ts
// Qualquer módulo importa e chama:
createSignatureRequest(input: {
  targetType: SignatureTargetType;   // 'demo' | 'epi_delivery' | ...
  targetId?: string;                 // uuid do registro de origem
  payload: unknown;                  // validado pelo payloadSchema do target_type
  ttlSeconds?: number;               // default configurável
}): Promise<ActionResult<{ requestId: string; publicUrl: string; qrCodeDataUrl: string }>>;
// token cru só vive na URL/QR — nunca retornado/persistido em claro.

getSignatureStatus(requestId: string):
  Promise<ActionResult<{ status: 'pending'|'signed'|'expired'|'cancelled'; signedAt?: string }>>;

signManually(requestId: string, input: { signerName: string }):
  Promise<ActionResult<void>>;   // fallback impresso, lado interno

// Superfície pública (SEM gate de office staff):
submitPublicSignature(token: string, input: { signerName: string; imageDataUrl: string }):
  Promise<ActionResult<void>>;

// Registry: cada target_type registra { payloadSchema (Zod), FormRenderer (React) }.
// Adicionar OS/EPI/etc depois = +1 entrada no registry. ZERO mudança de schema.
```

### Camadas (arquivos previstos)

```
src/shared/db/schema/signatures.ts                 → tabelas + enums + RLS
src/shared/db/migrations/0010_digital_signature_infra.sql
src/shared/domains/signatures/
  ├── contract.ts     → tipos + registry de target_type
  ├── schemas.ts      → Zod (input do request, payload por tipo, captura)
  └── token.ts        → geração/hash/validação de token + regra de expiração (puro)
src/shared/db/repositories/signature-requests.ts   → queries (withOrg / withSignatureToken)
src/shared/server/actions/signatures.ts            → officeAction: create, getStatus, signManually
src/shared/server/actions/public-signatures.ts     → submitPublicSignature (sem gate de office)
src/app/(public)/assinar/[token]/page.tsx          → rota pública de captura
src/app/(protected)/signatures/page.tsx            → painel demo (gerar / QR / status polling)
src/shared/ui/signature/{SignaturePad,QrCode}.tsx  → componentes reutilizáveis
src/shared/tenant/plan.ts                          → getSignatureQuota / isSignatureAvailable
```

---

## 6. Rota pública e isolamento (ponto sensível)

O funcionário **não tem login** → não há `requireOfficeStaff()` nem tenant ambiente. O isolamento
vem **do próprio token**, dentro do modelo RLS (sem `SECURITY DEFINER`):

1. Cliente apresenta o token (na URL). App calcula `sha256(token)`.
2. Helper `withSignatureToken(rawToken, fn)`: `set_config('app.signature_token', sha256(rawToken), true)`
   e lê o request via **policy de capability**. Valida existência / expiração / `used_at`.
3. Para **gravar**: deriva `org_id` daquela linha e usa `withOrg(orgId, …)` (RLS de tenant) para
   `update status='signed', used_at=now()` + `insert` em `signature_captures`.

**Tenant vem do token, nunca do cliente.** Um token de `org_a` jamais lê/grava em `org_b`; quem
não tem token não lê nada.

---

## 7. Conformidade com a spec 005 (plano free/pro)

Fonte: `.specs/005-modelo-tenant-gate-pro/spec.md` (FR-011/012/013, Inv-1) e
`src/shared/tenant/{active-tenant,plan}.ts`.

- **Inv-1 — plano é do tenant, nunca do usuário.** O gate lê `requireTenantContext().plan`
  (plano do **tenant ativo**), no padrão de `isTeamManagementAvailable(plan)`.
- A 005 **não** define assinatura como recurso PRO — decisão de produto desta fatia:
  **PRO ilimitado; free = 10 pedidos criados/mês.**
- **Contagem derivada na leitura** (padrão do projeto, como o nº de trabalhadores por GES):
  ```sql
  SELECT count(*) FROM signature_requests
  WHERE org_id = $1 AND created_at >= date_trunc('month', now());
  ```
  O "reset mensal" é **implícito** (filtro pelo mês corrente). **Sem tabela de contador, sem cron.**
- **Gate na criação** (`createSignatureRequest`, lado interno com sessão): se `plan = 'free'` e
  `count >= 10` → erro `QUOTA_EXCEEDED` (mensagem de upgrade). `plan = 'pro'` → ilimitado.
- **A rota pública nunca checa plano/quota** — não há tenant de sessão ali; checar violaria Inv-1.
- Helpers em `src/shared/tenant/plan.ts`: `getSignatureQuota(plan)` e/ou `isSignatureAvailable(plan)`.
  Constante `FREE_SIGNATURE_MONTHLY_QUOTA = 10`.

---

## 8. Erros (reusa o padrão do repo)

`ActionResult<T>` (`{ok:true,data}` | `{ok:false,error}`) + códigos de domínio (não HTTP cru):

| Código           | Quando                                     | REST (via `restHandler`)      |
| ---------------- | ------------------------------------------ | ----------------------------- |
| `VALIDATION`     | input/payload Zod inválido                 | 422                           |
| `NOT_FOUND`      | token inexistente / request não encontrado | 404                           |
| `FORBIDDEN`      | papel `client` no lado interno             | 403                           |
| `QUOTA_EXCEEDED` | free atingiu 10/mês na criação             | 402 (Payment Required)        |
| (estado público) | token **expirado** / **já utilizado**      | página amigável, não erro cru |

---

## 9. Testes (obrigatório — Postgres efêmero, nunca SQLite)

- **Unit** (lógica pura): geração/entropia/hash do token; regra de expiração; **regra de quota**;
  schemas Zod (input do request + payload por tipo + captura).
- **Integração** (Server Actions / Route Handlers / queries, `INTEGRATION_*`):
  - `createSignatureRequest` persiste escopado ao org.
  - `submitPublicSignature` via token grava captura + status vira `signed`.
  - token **expirado** rejeitado; token **reutilizado** rejeitado.
  - `getSignatureStatus` transiciona `pending → signed`.
  - **quota**: free é bloqueado na **11ª** criação no mês (`QUOTA_EXCEEDED`); pro nunca.
  - `signManually` registra captura com `method='manual'`.
- **Multi-tenant crítico**: token de `org_a` não lê/grava em `org_b` (policy de capability +
  `withOrg`); ausência de token não retorna nada.
- `npm run test` e `npm run test:integration` verdes; `lint` + `typecheck` verdes.

---

## 10. Critérios de aceite

- [ ] Token gerado é único, seguro e expira no tempo configurado.
- [ ] QR Code aponta para a rota pública com o token embutido.
- [ ] Rota pública valida o token e exibe o formulário de captura correto (por `target_type`).
- [ ] Assinatura capturada (PNG base64) é persistida e vinculada ao registro de origem.
- [ ] Status "Aguardando" → "Assinado" atualiza na tela interna sem recarregar (polling, `<5s`).
- [ ] Token expirado ou já utilizado retorna estado adequado na rota pública.
- [ ] Pelo menos um consumidor (demo) integrado via o contrato definido.
- [ ] Gate de plano: free bloqueado ao exceder 10 pedidos/mês; pro ilimitado; plano lido do
      tenant ativo (Inv-1).
- [ ] Isolamento multi-tenant garantido em todas as gravações/consultas.

---

## 11. Dependências e novas libs

- `qrcode` (geração de QR no servidor).
- `signature_pad` (captura de assinatura, vanilla).
- Verificar compatibilidade com React 19 / Next 16 antes de fixar versões.

---

## 12. Referências

- Issue **#67** (este briefing).
- `.specs/005-modelo-tenant-gate-pro/spec.md` — regras de plano (FR-011/012/013, Inv-1).
- `.specs/004-epgr-feature-parity/07-plataforma.md` §11 — páginas públicas de assinatura (na
  branch `feature/epgr-feature-parity`).
- `CLAUDE.md` — camadas, `withOrg`, RLS, `officeAction`/`restHandler`, política de testes.
- `src/shared/db/schema/companies.ts` — template de tabela com RLS.
- `src/shared/db/schema/epis.ts` — `epi_deliveries` (colunas dormentes), enum `epi_signature_status`.
- Branch irmã `feature/ppe-delivery-with-signature` — futuro consumidor real (entrega de EPI).

---

## 13. Prompt pronto para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/digital-signature-infra

Feature: Digital signature infrastructure (public token links)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Esta issue (#67) é uma fatia própria de INFRAESTRUTURA transversal: gera o seu próprio spec
(1 issue = 1 branch = 1 spec). Use como fonte da verdade o briefing anexado
(docs/briefings/briefing-digital-signature-infra.md), que já consolidou as decisões de
brainstorming. Antes de escrever a spec, liste os arquivos que vai ler.

User stories (P1 = mais crítica):
- (P1) Como gestor, quero gerar um QR Code ou link para que o funcionário assine digitalmente
  (ex.: entrega de EPI) sem precisar de login.
- (P1) Como gestor, quero ver em tempo real se o funcionário já assinou, para confirmar.
- (P2) Como produto, quero que a mesma infraestrutura sirva a vários módulos (EPI, OS, inspeção,
  PGR, foto 3x4, psicossocial) via um único contrato (DRY).

Success criteria mensuráveis (tecnologia-agnósticos):
- Link/QR gerado; funcionário acessa sem login e assina; status atualiza para "Assinado" em
  menos de 5 segundos na tela interna.
- Token expirado ou reutilizado retorna mensagem de erro clara.
- O mecanismo funciona para pelo menos um módulo consumidor (demo) via o contrato, com caminho
  documentado para plugar novos módulos sem mudar o schema.

Regras de plano (conformidade com spec 005):
- Plano é do tenant ativo (Inv-1), nunca do usuário.
- PRO: assinaturas ilimitadas. FREE: até 10 pedidos criados por mês (contagem derivada por
  mês corrente; sem contador/cron). Gate avaliado na CRIAÇÃO (lado interno); a rota pública
  nunca checa plano.

Edge cases a considerar:
- Token expirado antes de o funcionário assinar.
- Token já utilizado (tentativa de reuso).
- Funcionário sem smartphone (fallback de assinatura manual).
- Perda de conexão durante a captura.
- Free excede a quota mensal.

Restrições obrigatórias (constituição):
- Todo acesso a dados escopado pela organização ativa; rota pública resolve o tenant a partir
  do token (nunca do cliente).
- Validação de schema (Zod) em toda Server Action.
- Testes contra Postgres efêmero (NÃO SQLite), incluindo o caminho crítico de isolamento
  multi-tenant.

NÃO invente solução técnica fora do que o briefing já decidiu — o "como" central já está em
docs/briefings/briefing-digital-signature-infra.md.
O conteúdo da spec é em português brasileiro; branch e commits em inglês.
```
