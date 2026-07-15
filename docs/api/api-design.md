# API Design â SST Manager (estado atual)

> **Natureza da "API".** HÃ¡ **duas** superfÃ­cies:
>
> 1. **Server Actions** (App Router) â a interface usada pela UI do app. SÃ£o funÃ§Ãµes `"use server"`
>    invocadas via **POST** pelo framework (header `Next-Action: <id de build>` + payload do React);
>    **POST-only por design do Next** e **nÃ£o** chamÃ¡veis "cruas" por Postman/cURL.
> 2. **REST API `/api/v1`** (Route Handlers) â superfÃ­cie HTTP RESTful de verdade
>    (GET/POST/PUT/DELETE), testÃ¡vel por Postman. Reusa os mesmos repositÃ³rios/validaÃ§Ã£o/erros das
>    actions. **Ã o que estÃ¡ na coleÃ§Ã£o Postman** (`sst-manager.postman_collection.json`).
>
> Este documento descreve o contrato lÃ³gico (assinaturas, entradas, retornos, erros) de tudo que
> existe hoje.

Atualizado conforme o cÃ³digo em `src/shared/server/actions/` e `src/app/api/`.

## AutenticaÃ§Ã£o, identidade e tenant (PRÃ-REQUISITO)

> **NÃ£o hÃ¡ API prÃ³pria de cadastro/login.** A identidade vive no **Clerk** (provedor de auth),
> conforme a fatia 005 (Modelo B). Operar qualquer CRUD exige: (1) ter conta no Clerk, (2) ter um
> tenant/escritÃ³rio ativo. Ambos sÃ£o resolvidos fora das nossas Server Actions.

**Fluxo de prÃ©-requisito (estado atual):**

1. **Cadastro / login** â componentes **hospedados do Clerk** (`<SignUp>` / `<SignIn>`) nas
   pÃ¡ginas `/(public)/sign-up` e `/(public)/sign-in`. Ã o fluxo/Frontend API do Clerk â **nÃ£o**
   um endpoint nosso. NÃ£o Ã© chamÃ¡vel pela nossa API (nem por Postman como "API nossa").
2. **Provisionamento do escritÃ³rio (free)** â no evento `user.created`, o Clerk dispara o
   **webhook** `POST /api/webhooks/clerk` â `handleClerkEvent` â `provisionPersonalTenant`, que
   cria o **tenant pessoal** (`orgs`, plano `free`) + **membership `owner`**. Toda identidade
   ganha um escritÃ³rio prÃ³prio automaticamente, **mesmo free** (nÃ£o vira organizaÃ§Ã£o no Clerk
   enquanto free â isso Ã© futuro, no upgrade PRO). NÃ£o hÃ¡ passo manual de "criar org" para free.
3. **SincronizaÃ§Ã£o** â o mesmo webhook trata `user.{created,updated,deleted}`,
   `organization.{created,updated,deleted}` e `organizationMembership.{created,updated,deleted}`,
   mantendo `users` e `org_memberships` em dia.
4. **Org ativa** â definida pelo cookie **`tenant_active_org`** e reconciliada por
   `reconcileActiveOrg` (Inv-2: a lista/seleÃ§Ã£o de tenant Ã© dirigida pelos nossos vÃ­nculos, nÃ£o
   pelo Clerk). NÃ£o hÃ¡ endpoint dedicado de troca nesta fatia.
5. **Onboarding** (`/(protected)/onboarding`) â usa componentes Clerk
   (`<CreateOrganization>` / `<OrganizationList>`) para o caminho de organizaÃ§Ã£o Clerk (multi-org/PRO).

### Endpoints HTTP de verdade (Route Handlers)

Estes **sÃ£o** HTTP estÃ¡vel e chamÃ¡veis por Postman/cURL (ao contrÃ¡rio das Server Actions):

| MÃ©todo | Rota                  | Auth                                                                | Retorno                                                                            |
| ------- | --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`   | `/api/me`             | cookie de sessÃ£o Clerk                                             | `200 { userId, orgId }` Â· `401` (sem sessÃ£o) Â· `403 { error: "NO_ACTIVE_ORG" }` |
| `POST`  | `/api/webhooks/clerk` | assinatura **Svix** (`svix-id`, `svix-timestamp`, `svix-signature`) | `200 ok\|ignored` Â· `400 invalid_payload\|invalid signature` Â· `500 db error`    |

> `GET /api/me` Ã© o equivalente REST da Server Action `meAction`. O webhook **rejeita** payloads
> sem assinatura Svix vÃ¡lida (`verifyWebhook`), entÃ£o sÃ³ dispara com o signing secret do Clerk.

### Rota pÃºblica de assinatura â `/sign/{token}` (fatia 012)

PÃ¡gina pÃºblica (fora de `/api/v1`, **sem Clerk, sem tenant de sessÃ£o, sem bypass dev**): a
credencial Ã© o **token HMAC** de 72h gerado por `generateSignTokenAction` (Server Action interna,
office staff â a geraÃ§Ã£o NÃO tem espelho REST de propÃ³sito: o token Ã© credencial de escrita e a
superfÃ­cie pÃºblica testÃ¡vel Ã© a prÃ³pria rota). O token embute `{ orgId, deliveryId, method, iat }`
assinados; a rota resolve o tenant do payload e roda sob `withOrg(orgId)` (RLS backstop).

| AÃ§Ã£o | Rota            | Auth        | Desfecho                                                                                                                                                                                      |
| ------ | --------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/sign/{token}` | sÃ³ o token | pÃ¡gina com itens + assinatura Â· "link invÃ¡lido" (`TOKEN_INVALID`, uniforme p/ adulterado/inexistente) Â· "link expirado" (`TOKEN_EXPIRED`, >72h) Â· "jÃ¡ confirmado" (negÃ³cio, nÃ£o erro) |
| `POST` | `/sign/{token}` | sÃ³ o token | Server Action `submitSignatureAction`: `pending â signed_qr\|signed_link` (o `method` vem do payload assinado, nunca do cliente) Â· repetida â `ALREADY_SIGNED` (mensagem, nunca 500)         |

- Anti-enumeraÃ§Ã£o: espaÃ§o de chave HMAC-SHA256 + resposta uniforme; rate-limit por IP Ã© controle
  complementar na **borda** (Cloudflare/WAF â infra, fora do app). `Cache-Control: no-store`.
- O painel interno da entrega reflete a assinatura por **polling** do `signature_status`.

### IntegraÃ§Ãµes externas (`/api/integrations`) â Route Handlers de consulta

Camada de plataforma reutilizÃ¡vel (autofill de formulÃ¡rios). **SÃ³ sessÃ£o** (`requireAuth()`) â CEP e
CNPJ sÃ£o **dados pÃºblicos**, nÃ£o do tenant; logo **sem** tenant/papel e **sem** bypass dev. Resposta
no mesmo envelope `ActionResult<T>`. Falha externa **nunca** bloqueia o form (o hook trata em silÃªncio).

| MÃ©todo | Rota                            | Auth          | Retorno                                                                                               |
| ------- | ------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/integrations/cep/{cep}`   | sessÃ£o Clerk | `200 ok(endereÃ§o)` Â· `404 NOT_FOUND` Â· `422 VALIDATION` (formato) Â· `502 UPSTREAM_ERROR` Â· `401` |
| `GET`   | `/api/integrations/cnpj/{cnpj}` | sessÃ£o Clerk | `200 ok(empresa+endereÃ§o)` Â· `404` Â· `422` Â· `502` Â· `401`                                       |
| `GET`   | `/api/integrations/caepi/{ca}`  | sessÃ£o Clerk | `200 ok(CaLookupResult)` â 3 estados como payload Â· `422 VALIDATION` (formato) Â· `401`              |

- Provedores: **ViaCEP** (`viacep.com.br/ws`) e **BrasilAPI** (`brasilapi.com.br/api/cnpj/v1`), sem API
  key. `src/shared/integrations/**` valida formato antes de chamar (evita request inÃºtil), aplica
  timeout (`AbortController`) e cacheia sÃ³ o sucesso.
- â ï¸ **Gotcha**: a BrasilAPI responde **403** ao User-Agent padrÃ£o do runtime â o cliente HTTP interno
  manda um `User-Agent` identificÃ¡vel (`providers/http.ts`). Ao testar via cURL, o UA do curl jÃ¡ passa.
- **CAEPI Ã© 100% local** (fatia 011): a consulta lÃª a tabela global `caepi_certificates` (espelho da
  base pÃºblica do MTE, alimentada pelo job `scripts/caepi-sync.ts`) â **nenhum fetch externo por
  request**. Contrato `CaLookupResult`: `{ status: "valid" | "expired", ca, manufacturer, norm,
validUntil, equipmentName? }` ou `{ status: "not_found", ca, baseUnsynced? }`.
  **DivergÃªncia consciente do 404 de CEP/CNPJ**: os 3 estados voltam como **payload 200** â
  `not_found`/`expired` sÃ£o resultado informativo de negÃ³cio (aviso na UI, nunca bloqueia o
  cadastro), nÃ£o falha de transporte; Ã© o que permite ao hook `use-caepi-validation` reusar o
  `useLookup` (que sÃ³ entrega dado em `response.ok && body.ok`). Sem cache (`Cache-Control:
no-store`): a resposta depende de "hoje" (um CA que vence hoje muda de estado amanhÃ£).

## REST API (`/api/v1`) â CRUD por HTTP

Camada **RESTful** sobre Route Handlers (`src/app/api/v1/...`), com **verbos de verdade**
(GET/POST/PUT/DELETE) â esta Ã© a superfÃ­cie testÃ¡vel por Postman/cURL. Reusa os mesmos
repositÃ³rios, schemas zod e mapeamento de erro das Server Actions (sem duplicar regra).
ColeÃ§Ã£o (arquivo **Ãºnico**): `sst-manager.postman_collection.json` â as variÃ¡veis (`baseUrl`,
`devTenant`, `devRole`, ids) ficam na prÃ³pria coleÃ§Ã£o (Variables); troque `baseUrl` para alternar
entre local/homolog/prod. (Mantemos sÃ³ **um** arquivo Postman de propÃ³sito.)

> **Por que existe alÃ©m das Server Actions?** Server Actions sÃ£o **POST-only** por design do Next
> (doc oficial) e exigem o header `Next-Action` (hash de build) â logo, nÃ£o-RESTful e nÃ£o testÃ¡veis
> em Postman. Os Route Handlers sÃ£o a forma Next-nativa de expor REST.

**Recursos** (todos sob `/api/v1`, escopados ao tenant ativo):

| Recurso                                                                                                     | Verbos                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/companies` Â· `/companies/{id}` Â· `/companies/{id}/dependents`                                           | GET, POST Â· GET, PUT, DELETE Â· GET                                                                                                                     |
| `/work-units` Â· `/work-units/{id}` Â· `/work-units/{id}/dependents`                                        | GET, POST Â· GET, PUT, DELETE Â· GET                                                                                                                     |
| `/job-roles` Â· `/job-roles/{id}` Â· `/job-roles/{id}/dependents`                                           | GET, POST Â· GET, PUT, DELETE Â· GET                                                                                                                     |
| `/ges` Â· `/ges/{id}` Â· `/ges/{id}/dependents`                                                             | GET, POST Â· GET (inclui `exposedWorkers`), PUT, DELETE Â· GET                                                                                           |
| `/ges/{id}/job-roles` Â· `/ges/{id}/job-roles/{linkId}`                                                     | GET (`?available=true` p/ nÃ£o vinculadas), POST Â· PUT, DELETE                                                                                          |
| `/ges/{id}/risk-suggestions` Â· `/ges/{id}/risk-suggestions/accept`                                         | POST (sugere riscos por IA â nÃ£o persiste) Â· POST (persiste selecionados como rascunho, `201`)                                                         |
| `/employees` Â· `/employees/{id}` Â· `/employees/{id}/epi-record`                                           | GET, POST Â· GET, PUT, DELETE Â· GET (ficha de EPI, read-only)                                                                                           |
| `/pgr` Â· `/pgr/{id}`                                                                                       | GET, POST Â· GET, PUT, DELETE (documento PGR; sem `/dependents`, sem 409)                                                                                |
| `/risks` Â· `/risks/{id}`                                                                                   | GET, POST Â· GET, PUT, DELETE (inventÃ¡rio de risco do GES; filtros `companyId`/`workUnitId`/`gesId`; sem `/dependents`, sem 409)                        |
| `/risks/{id}/epis` Â· `/risks/{id}/epis/{linkId}`                                                           | GET (`?available=true&search=` p/ EPIs nÃ£o vinculados), POST Â· PUT (neutralizaÃ§Ã£o), DELETE (vÃ­nculo EPI Ã risco)                                    |
| `/risks/{id}/assessments` Â· `/risk-assessments/{id}`                                                       | GET, POST (avaliaÃ§Ã£o 5Ã5 do risco; 201) Â· GET, PUT, DELETE (histÃ³rico 1:N; `riskLevel`/`result` calculados; sem `/dependents`, sem 409)              |
| `/risks/{id}/control-measures` Â· `/control-measures/{id}`                                                  | GET, POST (plano de aÃ§Ã£o 5W2H por nÃ­vel NR-01; 201) Â· GET, PUT, DELETE (nÃ­vel imutÃ¡vel; **DUPLICATE/409** se nÃ­vel repetido; sem `/dependents`)   |
| `/categories` Â· `/categories/{id}`                                                                         | GET, POST Â· GET, PUT, DELETE                                                                                                                            |
| `/risk-methodology`                                                                                         | GET, PUT (singleton por org â sem `list`/`{id}`/`dependents`)                                                                                            |
| `/epi-deliveries` Â· `/epi-deliveries/{id}` Â· `/epi-deliveries/{id}/sign` Â· `/epi-deliveries/{id}/return` | GET, POST (baixa transacional) Â· GET, DELETE (sÃ³ `pending`; **sem PUT** â entrega imutÃ¡vel) Â· POST (assinatura manual) Â· POST (devoluÃ§Ã£o de item) |
| `/training-catalog` Â· `/training-catalog/{id}` Â· `/training-catalog/{id}/dependents`                      | GET (`?search=` nome/norma), POST Â· GET, PUT, DELETE (em uso â `409 IN_USE`) Â· GET (`{records, requiredLinks}`)                                        |
| `/training-records` Â· `/training-records/{id}`                                                             | GET (`?employeeId=`), POST (`valid_until` calculado no servidor; **sem PUT** â realizaÃ§Ã£o imutÃ¡vel) Â· GET, DELETE                                    |
| `/job-role-required-trainings` Â· `/job-role-required-trainings/{id}`                                       | GET (`?jobRoleId=`), POST (add **idempotente** por UNIQUE) Â· DELETE (sem GET/PUT de item â vÃ­nculo magro)                                              |
| `/vehicles` · `/vehicles/{id}`                                                                              | GET (`?search=` placa/modelo/marca), POST · GET, PUT, DELETE (frota; placa BR/Mercosul; `UNIQUE(org,placa)`→`DUPLICATE`; `201`/`204`)                    |
| `/profile`                                                                                                  | GET, PUT (perfil do **usuÃ¡rio logado** â self; edita sÃ³ campos app-managed `phone`/`cpf`/`jobTitle`; nome/e-mail/foto sÃ£o do Clerk)                   |
| `/team` Â· `/team/{userId}` Â· `/team/invitations`                                                          | GET (roster do tenant; `?search=`) Â· PUT, DELETE (papel / remoÃ§Ã£o â **owner**; via Clerk; barra o Ãºltimo owner) Â· POST (convite â **PRO**, `201`)   |
| `/dashboard/summary`                                                                                        | GET (agregaÃ§Ãµes read-model do tenant: KPIs, riscos por agente, planos por nÃ­vel, pendÃªncias/vencimentos; **sem tabelas novas**)                      |

- **Filtros (query)**: list de cada recurso aceita `search`, `page`, `pageSize` + os filtros do
  recurso (`companyId`, `workUnitId`, `status`, `type`). Body de create/update = o mesmo `*Input`
  das actions. **`/categories`** filtra por `search` + `type` (`epi`|`machine`); **PUT exige corpo
  completo `CategoryInput`** (espelho de companies, sem `.partial()`); **nÃ£o hÃ¡ `/dependents`**.
- **`/risk-methodology`** Ã© um **singleton por organizaÃ§Ã£o** (issue #76): `GET` devolve a metodologia
  ativa **ou** o padrÃ£o derivado (`configured:false`) quando nenhuma foi salva; `PUT` faz **upsert** do
  corpo completo `RiskMethodologyInput` (gradaÃ§Ãµes 1â5 + faixas que particionam 1â25). Sem `list`,
  `{id}` nem `dependents`.
- **`/ges/{id}/risk-suggestions`** (sugestÃ£o de riscos por IA): `POST` monta o contexto **nÃ£o-PII** do
  GES (processo, ambiente, tÃ­tulos de funÃ§Ã£o) e consulta o LLM (Anthropic/Claude, chave sÃ³ no servidor),
  devolvendo uma lista de riscos sugeridos (`{ suggestions: [{ agentType, hazard?, description, sources? }] }`)
  â **nada Ã© persistido**. GES de outra org â `422 FK_NOT_FOUND`; cota mensal do plano free estourada â
  `402 QUOTA_EXCEEDED`; falha/timeout do LLM â `502 AI_UNAVAILABLE` (nunca bloqueia o cadastro). `POST
/accept` recebe os riscos selecionados/revisados e os grava como **rascunho** em `risks` (reusa a regra
  de `createRisk`), `201` com `{ created }`.
- **`/epi-deliveries`** (fatia 012): list filtra por `employeeId` + `search` (nome do funcionÃ¡rio).
  Create: `{ employeeId, deliveryDate, items: [{ stockId, quantity }] }` â `201` com a baixa
  aplicada por item; qualquer item sem saldo â `422 INSUFFICIENT_STOCK` com **rollback total**.
  `DELETE` de entrega assinada â `403 FORBIDDEN` (nÃ£o estorna saldo). `POST /{id}/sign` (body `{}`)
  transiciona `pending â signed_manual`; repetida â `409 ALREADY_SIGNED`. Sem `PUT`: entregas sÃ£o
  imutÃ¡veis apÃ³s a criaÃ§Ã£o (Ã© o que torna o `updated_at` da assinatura um timestamp legal).
  `POST /{id}/return` (body `{ itemId }`) devolve UM item: seta `returned_at` (one-shot; repetida â
  `409 ALREADY_RETURNED`) e repÃµe o saldo via movimento `employee_return`; independe do status de
  assinatura.
- **`/employees/{id}/epi-record`** (fatia 012): ficha de EPI do funcionÃ¡rio, **read-only** (GET).
  Query `?status=pendente|devolvido|todos&from=&to=&page=&pageSize=` â `status` mapeia para
  `returned_at` (`pendente` â NULL, `devolvido` â NOT NULL); perÃ­odo filtra `delivery_date`.
  FuncionÃ¡rio cross-tenant â `404 NOT_FOUND`; sem entregas â `{ rows: [], total: 0 }`.
- **Treinamentos (fatia 017)**: **`/training-catalog`** â os 5 campos ePGR
  (`name`, `referenceNorm?`, `workloadHours` inteiro > 0, `periodicity` enum
  `annual|biennial|triennial|quinquennial|single`, `description?`); nome duplicado no escritÃ³rio â
  `409 DUPLICATE`; exclusÃ£o de item com realizaÃ§Ãµes/vÃ­nculos â `409 IN_USE` (cheque `/dependents`
  antes). **`/training-records`** â `{ employeeId, trainingId, completedAt, certificatePath? }`;
  `valid_until` Ã© **calculado no servidor** pela periodicidade do catÃ¡logo (`single` â `null`) e
  nunca vem do cliente; `completedAt` futuro â `422 VALIDATION`; funcionÃ¡rio/treinamento de outro
  tenant â `422 FK_NOT_FOUND`. **`/job-role-required-trainings`** â `{ jobRoleId, trainingId }`;
  POST repetido devolve o vÃ­nculo existente (idempotente). Leituras de vencimento/conformidade
  (US3/US4) sÃ£o consultas de Server Component, sem endpoint prÃ³prio nesta fase.
- **Respostas**: recurso no corpo (`200`), `201` no create, `204` no delete. Erros:
  `{ error: { code, message, fields? } }` com HTTP `422 VALIDATION` Â· `409 DUPLICATE` Â·
  `409 IN_USE` Â· `422 FK_NOT_FOUND` Â· `404 NOT_FOUND` Â· `403 FORBIDDEN`/`NO_TENANT_CONTEXT` Â·
  `401 UNAUTHORIZED`.

### AutenticaÃ§Ã£o da REST API (2 modos) e os 3 ambientes

| Modo                  | Quando                                                         | Como                                                                                         | Tenant/papel                                    |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Auth real (Clerk)** | qualquer ambiente, **default**; **obrigatÃ³rio em produÃ§Ã£o** | cookie `__session` (ou `Authorization: Bearer <session token>`) + cookie `tenant_active_org` | resolvidos por `requireOfficeStaff()` (sessÃ£o) |
| **Bypass DEV**        | sÃ³ local/homolog, opt-in                                      | headers `x-dev-tenant`, `x-dev-role` (`owner\|collaborator\|client`), `x-dev-user`           | injetados; **nÃ£o** toca no Clerk               |

O bypass Ã© ligado por **env** e tem **kill-switch duro em produÃ§Ã£o**:

```bash
# local / homolog (.env.local)
APP_ENV=local              # ou: homolog
DEV_API_AUTH_BYPASS=true   # libera /api/v1 sem token Clerk
DEV_TENANT_ID=<orgId>      # tenant injetado (pode vir do header x-dev-tenant)
DEV_ROLE=owner

# produÃ§Ã£o
APP_ENV=production         # DEV_API_AUTH_BYPASS Ã© IGNORADO; /api/v1 exige sessÃ£o Clerk
```

- Em produÃ§Ã£o, `isDevAuthBypassEnabled()` Ã© sempre `false` (checa `APP_ENV !== "production"`),
  e o middleware (`proxy.ts`) **nÃ£o** torna `/api/v1` pÃºblico â Clerk protege normalmente.
- Em local/homolog com a flag, o middleware libera `/api/v1` e o handler resolve o contexto pelos
  headers `x-dev-*` (ou envs `DEV_*`). Permite testar isolamento trocando `x-dev-tenant` e o gate
  de papel com `x-dev-role: client` (â `403`).
- **Auth real** (`/api/me` e o caminho default) usa a **org ativa do Clerk** via `requireOrgContext`
  para `/api/me`, enquanto `/api/v1` usa o **tenant interno** (Modelo B) via `requireOfficeStaff`.

## SumÃ¡rio das actions/endpoints existentes

| DomÃ­nio                    | Arquivo                                      | SuperfÃ­cie                                                                                                                                                                       |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST API (Route Handlers)   | `app/api/v1/**`                              | CRUD HTTP de companies/work-units/job-roles/ges(+vÃ­nculos)/employees                                                                                                             |
| Auth (Route Handler)        | `app/api/me/route.ts`                        | `GET /api/me`                                                                                                                                                                     |
| Webhook (Route Handler)     | `app/api/webhooks/clerk/route.ts`            | `POST /api/webhooks/clerk` (provisiona tenant/sync)                                                                                                                               |
| SessÃ£o / Identidade        | `actions/me.ts`                              | `meAction` (Server Action)                                                                                                                                                        |
| Empresa                     | `actions/pgr/companies.ts`                   | list, options, get, create, update, delete, dependents                                                                                                                            |
| Unidade de Obra             | `actions/pgr/work-units.ts`                  | list, get, create, update, delete, dependents                                                                                                                                     |
| FunÃ§Ã£o (Cargo)            | `actions/pgr/job-roles.ts`                   | list, get, create, update, delete, dependents                                                                                                                                     |
| GES + vÃ­nculos             | `actions/pgr/ges.ts`                         | list, get, create, update, delete, dependents + gestÃ£o de `ges_job_roles`                                                                                                        |
| FuncionÃ¡rio                | `actions/pgr/employees.ts`                   | list, get, create, update, delete + picker de funÃ§Ã£o                                                                                                                            |
| PGR (documento)             | `actions/pgr/pgr.ts`                         | list, get, create, update, delete + REST `/api/v1/pgr/**` (aceite NR-01 nÃ£o persistido; sem 409)                                                                                 |
| Riscos (GES)                | `actions/pgr/risks.ts`                       | list, get, create, update, delete + REST `/api/v1/risks/**` (regra `qualitative_na`; reuso por prefill; sem 409)                                                                  |
| Ve�culos (inspe��es)        | `actions/inspections/vehicles.ts`            | list, get, create, update, delete + REST `/api/v1/vehicles/**` (frota; base das inspe��es veiculares; modelo na fatia 034)                                                        |
| Perfil (plataforma)         | `actions/platform/profile.ts`                | getProfile, updateProfile (self) + REST `/api/v1/profile` (campos app-managed; nome/e-mail/foto delegados ao Clerk)                                                               |
| Equipe (plataforma)         | `actions/platform/team.ts`                   | listTeamMembers, inviteMember, changeMemberRole, removeMember + REST `/api/v1/team/**` (multiusuÃ¡rio **PRO** via Clerk Org; owner-only; protege o Ãºltimo owner)                 |
| Dashboard (plataforma)      | `actions/platform/dashboard.ts`              | getDashboardSummaryAction + REST `GET /api/v1/dashboard/summary` (read-model agregado por tenant; sem tabelas novas)                                                              |
| EPI Ã risco (vÃ­nculo)      | `actions/pgr/epi-risk.ts`                    | list, available (busca nome/CA), add, update (neutralizaÃ§Ã£o), remove + REST `/api/v1/risks/{id}/epis/**`                                                                        |
| AvaliaÃ§Ã£o de risco (5Ã5)  | `actions/pgr/risk-assessments.ts`            | list, get, getCurrent, create, update, delete + REST `/api/v1/risks/{id}/assessments` Â· `/risk-assessments/{id}` (histÃ³rico 1:N; snapshot de `result`; sem 409)                 |
| Medidas de controle (5W2H)  | `actions/pgr/control-measures.ts`            | list, get, create, update, delete + REST `/api/v1/risks/{id}/control-measures` Â· `/control-measures/{id}` (1 por nÃ­vel NR-01; estados derivados; **409** por UNIQUE)            |
| Categoria                   | `actions/pgr/categories.ts`                  | list, get, create, update, delete (catÃ¡logo `epi`/`machine`)                                                                                                                     |
| Metodologia de Risco        | `actions/pgr/risk-methodology.ts`            | get (config ou padrÃ£o), save (upsert) + `GET`/`PUT /api/v1/risk-methodology`                                                                                                     |
| SugestÃ£o de riscos (IA)    | `actions/pgr/ai-risk-suggestion.ts`          | suggest (LLM, nÃ£o persiste), accept (grava rascunhos) + REST `POST /api/v1/ges/{id}/risk-suggestions(/accept)`                                                                   |
| CAEPI (consulta de CA)      | `actions/epi/lookup-ca.ts`                   | `lookupCa` (Server Action, sÃ³ sessÃ£o) + `GET /api/integrations/caepi/{ca}`                                                                                                      |
| Entrega de EPI              | `actions/pgr/epi-deliveries.ts`              | create (baixa transacional), list, get, delete (guard), signManual, returnItem + REST `/api/v1/epi-deliveries/**`                                                                 |
| Ficha de EPI                | `actions/pgr/epi-record.ts`                  | `getEmployeeEpiRecordAction` (read-only) + REST `GET /api/v1/employees/{id}/epi-record`                                                                                           |
| Treinamento (catÃ¡logo)     | `actions/pgr/training-catalog.ts`            | list, options, get, create, update, delete, dependents + REST `/api/v1/training-catalog/**`                                                                                       |
| RealizaÃ§Ã£o de treinamento | `actions/pgr/training-records.ts`            | list (por funcionÃ¡rio), get, create (`valid_until` via D1 no servidor), delete + vencimento (`listTrainingExpiry`, `getTrainingDueSummary`) + REST `/api/v1/training-records/**` |
| ObrigatÃ³rios por funÃ§Ã£o  | `actions/pgr/job-role-required-trainings.ts` | list, add (idempotente), remove + conformidade (`getEmployeeCompliance`, `listNonCompliance`) + REST `/api/v1/job-role-required-trainings/**`                                     |

---

## Contrato de retorno â `ActionResult<T>`

Local: `src/shared/server/result.ts`. **Todas as actions de CRUD** retornam este envelope;
nenhuma exceÃ§Ã£o crua chega Ã  UI.

```ts
type ActionError = {
  code: string; // ver tabela abaixo
  message: string; // mensagem curta exibÃ­vel
  fields?: Record<string, string>; // erros por campo (origem zod)
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
```

> A `meAction` Ã© anterior a este contrato e usa um envelope prÃ³prio (ver seÃ§Ã£o SessÃ£o).

### CÃ³digos de erro (canÃ´nicos)

Mapeados por `toActionError` (`src/shared/server/action-error.ts`). Erro inesperado Ã©
**relanÃ§ado** (nunca silenciado), caindo no error boundary do Next.

| code                 | Origem                                   | HTTP equiv. | Quando                                                                     |
| -------------------- | ---------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `VALIDATION`         | `ZodError` (com `fields`); CHECK `23514` | 422         | Entrada invÃ¡lida                                                          |
| `DUPLICATE`          | UNIQUE `23505`                           | 409         | CNPJ/CPF/tÃ­tulo/vÃ­nculo duplicado no escritÃ³rio                         |
| `FK_NOT_FOUND`       | FK `23503`; referÃªncia fora do tenant   | 422         | Empresa/obra/GES/funÃ§Ã£o inexistente no escritÃ³rio                       |
| `FORBIDDEN`          | papel `client`                           | 403         | Membro nÃ£o-equipe tentou operar                                           |
| `NOT_FOUND`          | `getById` â `null`                       | 404         | Registro inexistente no escritÃ³rio (inclui cross-tenant)                  |
| `NO_TENANT_CONTEXT`  | sem escritÃ³rio ativo                    | 403         | SessÃ£o sem tenant resolvido                                               |
| `INSUFFICIENT_STOCK` | `InsufficientStockError` (repositÃ³rio)  | 422         | SaÃ­da/entrega maior que o saldo disponÃ­vel (rollback total)              |
| `ALREADY_SIGNED`     | `AlreadySignedError` (repositÃ³rio)      | 409         | Assinar entrega que jÃ¡ saiu de `pending` (one-shot)                       |
| `ALREADY_RETURNED`   | `AlreadyReturnedError` (repositÃ³rio)    | 409         | Devolver item de entrega jÃ¡ devolvido (saldo intacto)                     |
| `TOKEN_INVALID`      | `TokenInvalidError` (rota pÃºblica)      | 404         | Token de assinatura ausente/adulterado/inexistente                         |
| `TOKEN_EXPIRED`      | `TokenExpiredError` (rota pÃºblica)      | 410         | Token com HMAC vÃ¡lido porÃ©m alÃ©m do TTL de 72h                          |
| `IN_USE`             | `EntityInUseError` (repositÃ³rio)        | 409         | Excluir item de catÃ¡logo com dependentes (prÃ©-check + RESTRICT backstop) |

## PrÃ©-condiÃ§Ãµes comuns (toda action de CRUD)

Encapsuladas em `officeAction(operation, fn, { audit? })` (`src/shared/server/office-action.ts`):

1. **Gate de papel** (`requireOfficeStaff`): apenas `owner`/`collaborator`; papel `client` â
   `FORBIDDEN`. Vale para leitura e escrita.
2. **Tenant da sessÃ£o**: `tenantId` vem de `requireTenantContext()`, **nunca** de input do
   cliente. Todo acesso roda em `withOrg(tenantId, â¦)` + RLS backstop por `org_id`.
3. **ValidaÃ§Ã£o**: escrita faz `schema.parse(input)` (zod) antes do repositÃ³rio â falha vira
   `VALIDATION` com `fields`.
4. **Auditoria**: escritas emitem evento de fronteira sem PII; leituras nÃ£o emitem em sucesso.
5. **RevalidaÃ§Ã£o**: mutaÃ§Ãµes chamam `revalidatePath` da(s) rota(s) afetada(s).

## PaginaÃ§Ã£o

`src/shared/pagination.ts`. Entrada `{ page?, pageSize? }` (default `pageSize = 20`, clamp a
`PAGE_SIZE_MAX = 100`, `page >= 1`; invÃ¡lidos caem nos defaults). Listas retornam
`Paginated<T> = { rows: T[]; total: number }`.

---

## SessÃ£o / Identidade â `actions/me.ts`

| Action     | Entrada | Retorno                                                                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------ |
| `meAction` | â       | `{ ok: true; userId; orgId }` \| `{ ok: false; error: "UNAUTHORIZED" \| "NO_ACTIVE_ORG" }` |

Resolve o usuÃ¡rio autenticado e a org ativa da sessÃ£o (Clerk). Envelope prÃ³prio (nÃ£o
`ActionResult`).

## Empresa â `actions/pgr/companies.ts`

| Action                       | Entrada                         | Retorno (`data`)                               |
| ---------------------------- | ------------------------------- | ---------------------------------------------- |
| `listCompaniesAction`        | `{ search?, page?, pageSize? }` | `{ rows: CompanyListItem[]; total }`           |
| `listCompanyOptionsAction`   | â                               | `CompanyOption[]` (id, razaoSocial, endereÃ§o) |
| `getCompanyAction`           | `id`                            | `Company` (null â `NOT_FOUND`)                 |
| `createCompanyAction`        | `CompanyInput`                  | `Company` (CNPJ dup â `DUPLICATE`)             |
| `updateCompanyAction`        | `id, CompanyInput`              | `Company`                                      |
| `deleteCompanyAction`        | `id`                            | `{ id }` (cascata pelo banco)                  |
| `getCompanyDependentsAction` | `id`                            | `{ workUnits, ges, jobRoles, employees }`      |

**`CompanyInput`**: `razaoSocial*`, `riskGrade*` (1â4), `cnpj?` (14 dÃ­g. se preenchido),
`nomeFantasia?`, `phone?`, `email?`, `cnae?`, `mainActivity?`, `logoPath?`,
`zipCode? street? number? complement? district? city? state?`.
**`CompanyListItem`**: `{ id, razaoSocial, cnpj, city, state }`.

## Unidade de Obra â `actions/pgr/work-units.ts`

| Action                        | Entrada                                     | Retorno                                              |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `listWorkUnitsAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: WorkUnit[]; total }`                        |
| `getWorkUnitAction`           | `id`                                        | `WorkUnit`                                           |
| `createWorkUnitAction`        | `WorkUnitInput`                             | `WorkUnit` (empresa fora do tenant â `FK_NOT_FOUND`) |
| `updateWorkUnitAction`        | `id, WorkUnitInput`                         | `WorkUnit`                                           |
| `deleteWorkUnitAction`        | `id`                                        | `{ id }`                                             |
| `getWorkUnitDependentsAction` | `id`                                        | `{ ges }`                                            |

**`WorkUnitInput`**: `companyId*`, `name*`, `description*`, `contractNumber?`, endereÃ§o (`zipCode?â¦state?`).

## FunÃ§Ã£o (Cargo) â `actions/pgr/job-roles.ts`

| Action                       | Entrada                                     | Retorno                                          |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `listJobRolesAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: JobRole[]; total }`                     |
| `getJobRoleAction`           | `id`                                        | `JobRole`                                        |
| `createJobRoleAction`        | `JobRoleInput`                              | `JobRole` (tÃ­tulo dup na empresa â `DUPLICATE`) |
| `updateJobRoleAction`        | `id, JobRoleInput`                          | `JobRole`                                        |
| `deleteJobRoleAction`        | `id`                                        | `{ id }`                                         |
| `getJobRoleDependentsAction` | `id`                                        | `{ gesLinks, employees }`                        |

**`JobRoleInput`**: `companyId*`, `title*`, `cbo?`, `workSchedule?`, `description?`.

## GES + vÃ­nculos â `actions/pgr/ges.ts`

| Action                        | Entrada                                                  | Retorno                                                   |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `listGesAction`               | `{ companyId?, workUnitId?, search?, page?, pageSize? }` | `{ rows: GesListItem[]; total; totalWorkers }`            |
| `getGesAction`                | `id`                                                     | `{ ges: Ges; exposedWorkers }`                            |
| `createGesAction`             | `GesInput`                                               | `Ges` (obra fora da empresa/tenant â `FK_NOT_FOUND`)      |
| `updateGesAction`             | `id, GesInput`                                           | `Ges`                                                     |
| `deleteGesAction`             | `id`                                                     | `{ id }` (cascata em vÃ­nculos; funcionÃ¡rios â GES nulo) |
| `getGesDependentsAction`      | `id`                                                     | `{ jobRoleLinks, employees }`                             |
| `listGesJobRolesAction`       | `gesId`                                                  | `GesJobRoleItem[]`                                        |
| `listAvailableJobRolesAction` | `gesId`                                                  | `JobRoleOption[]` (funÃ§Ãµes da empresa nÃ£o vinculadas)  |
| `addGesJobRoleAction`         | `{ gesId, jobRoleId, workerCount, workSchedule? }`       | `{ gesId }` (â¤0 â `VALIDATION`; dup â `DUPLICATE`)       |
| `updateGesJobRoleAction`      | `id, gesId, { workerCount, workSchedule? }`              | `{ id }`                                                  |
| `removeGesJobRoleAction`      | `id, gesId`                                              | `{ id }`                                                  |

**`GesInput`**: `companyId*`, `workUnitId*`, `name*`, `processDescription? constructionType?
ceilingHeight? floor? roof? lighting? ventilation? otherCharacteristics?`.
**`GesListItem`**: `{ id, name, processDescription, exposedWorkers }` â `exposedWorkers` Ã©
**derivado** (`SUM(worker_count)` das funÃ§Ãµes vinculadas), somente leitura, 0 sem vÃ­nculos.
**`GesJobRoleItem`**: `{ id, jobRoleId, title, workerCount, workSchedule }`.
**`JobRoleOption`**: `{ jobRoleId, title }`.

## FuncionÃ¡rio â `actions/pgr/employees.ts`

| Action                   | Entrada                                              | Retorno                                                     |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------- |
| `listEmployeesAction`    | `{ companyId?, status?, search?, page?, pageSize? }` | `{ rows: EmployeeListItem[]; total }`                       |
| `getEmployeeAction`      | `id`                                                 | `Employee`                                                  |
| `createEmployeeAction`   | `EmployeeInput`                                      | `Employee` (CPF dup â `DUPLICATE`)                          |
| `updateEmployeeAction`   | `id, EmployeeInput`                                  | `Employee`                                                  |
| `deleteEmployeeAction`   | `id`                                                 | `{ id }`                                                    |
| `listGesFunctionsAction` | `gesId`                                              | `JobRoleOption[]` (picker: sÃ³ funÃ§Ãµes vinculadas ao GES) |

**`EmployeeInput`**: `companyId*`, `fullName*`, `cpf*` (11 dÃ­g.), `gesId?`, `jobRoleId?`
(exige `gesId` e vÃ­nculo existente no GES), `status?` (`active`|`on_leave`|`dismissed`, default
`active`), `sex?` (`male`|`female`|`not_informed`), `maritalStatus?`
(`single`|`married`|`divorced`|`widowed`|`stable_union`), `birthDate? admissionDate?
dismissalDate? badgeValidUntil?` (datas), `phone? email? rg? badgeNumber? registration?
bloodType? photoPath?`, endereÃ§o (`zipCode?â¦state?`).
**`EmployeeListItem`**: `{ id, fullName, status, companyName, gesName }`.

## Categoria â `actions/pgr/categories.ts`

CatÃ¡logo de categorias de `epi`/`machine` (fatia 009). Sem `/dependents` (catÃ¡logo sem FK de
entrada). REST espelho em `/api/v1/categories` (GET, POST) Â· `/api/v1/categories/{id}` (GET, PUT, DELETE).

| Action                 | Entrada                                | Retorno (`data`)                            |
| ---------------------- | -------------------------------------- | ------------------------------------------- |
| `listCategoriesAction` | `{ search?, type?, page?, pageSize? }` | `{ rows: Category[]; total }`               |
| `getCategoryAction`    | `id`                                   | `Category` (null â `NOT_FOUND`)             |
| `createCategoryAction` | `CategoryInput`                        | `Category` (nome dup no tipo â `DUPLICATE`) |
| `updateCategoryAction` | `id, CategoryInput`                    | `Category`                                  |
| `deleteCategoryAction` | `id`                                   | `{ id }`                                    |

**`CategoryInput`**: `type*` (`epi`|`machine`), `name*`, `note?`. Unicidade por
`UNIQUE(org_id, type, name)` â duplicidade no mesmo escritÃ³rio+tipo vira `DUPLICATE`; o mesmo nome
Ã© aceito entre tipos distintos. **PUT (REST) exige corpo completo** (sem `.partial()`).

---

## PGR â `actions/pgr/pgr.ts`

Documento PGR (NR-01/GRO) vinculado a Empresa (obrigatÃ³ria) e Obra/Contrato (opcional). Fatia 013,
**zero-migration** (tabela `pgr` da migration `0012`). REST espelho em `/api/v1/pgr` (GET, POST) Â·
`/api/v1/pgr/{id}` (GET, PUT, DELETE). **Sem `/dependents` e sem 409** (a tabela nÃ£o tem unique).

| Action            | Entrada                                                  | Retorno (`data`)                                |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `listPgrAction`   | `{ companyId?, workUnitId?, search?, page?, pageSize? }` | `{ rows: PgrListItem[]; total }`                |
| `getPgrAction`    | `id`                                                     | `Pgr` (inexistente/cross-tenant â `NOT_FOUND`)  |
| `createPgrAction` | `PgrCreateInput`                                         | `Pgr` (empresa/obra invÃ¡lida â `FK_NOT_FOUND`) |
| `updatePgrAction` | `id, PgrInput`                                           | `Pgr` (corpo completo, sem aceite)              |
| `deletePgrAction` | `id`                                                     | `{ id }`                                        |

**`PgrCreateInput`**: `companyId*` (uuid), `workUnitId?` (uuid da obra da empresa), `responsible?`,
`registrationType*` (`crm`|`crea`|`mte`|`not_applicable`), `registrationNumber?` (obrigatÃ³rio p/
CRM/CREA/MTE, proibido p/ "nÃ£o aplicÃ¡vel"), `issuedAt*` (AAAA-MM-DD), `validUntil*` (â¥ `issuedAt`),
`declarationAccepted*` (`true`) â **aceite validado no servidor e NÃO persistido** (a tabela `pgr`
nÃ£o tem coluna de aceite; persistÃªncia legal Ã© #79). **`PgrInput`** (update / PUT REST): igual,
**sem** `declarationAccepted` (corpo completo). **`PgrListItem`**: `{ id, companyId, companyName,
workUnitId, workUnitName, responsible, registrationType, registrationNumber, issuedAt, validUntil }`.
**Erros REST**: 422 (validaÃ§Ã£o/aceite ausente/FK), 404 (cross-tenant/inexistente), 403 (`client`);
**nunca 409**. "UsuÃ¡rio autor" fora de escopo (modelo sem `created_by`).

---

## Riscos (GES) â `actions/pgr/risks.ts`

InventÃ¡rio de risco por Grupo de ExposiÃ§Ã£o Similar (NR-01/GRO + eSocial S-2240). Fatia 014,
**zero-migration** (tabela `risks` da migration `0012`; escopo restrito Ã s suas colunas â **nÃ£o**
toca `risk_assessments`/`control_measures`). REST espelho em `/api/v1/risks` (GET, POST) Â·
`/api/v1/risks/{id}` (GET, PUT, DELETE). **Sem `/dependents` e sem 409** (a tabela nÃ£o tem unique).

| Action             | Entrada                                                          | Retorno (`data`)                                |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| `listRisksAction`  | `{ companyId?, workUnitId?, gesId?, search?, page?, pageSize? }` | `{ rows: RiskListItem[]; total }`               |
| `getRiskAction`    | `id`                                                             | `Risk` (inexistente/cross-tenant â `NOT_FOUND`) |
| `createRiskAction` | `RiskInput`                                                      | `Risk` (`gesId` invÃ¡lido â `FK_NOT_FOUND`)     |
| `updateRiskAction` | `id, RiskInput`                                                  | `Risk` (corpo completo)                         |
| `deleteRiskAction` | `id`                                                             | `{ id }`                                        |

**`RiskInput`** (mesmo corpo para create e PUT): `gesId*` (uuid do GES do tenant), `agentType*`
(`physical`|`chemical`|`biological`|`ergonomic`|`mechanical`|`accident`|`psychosocial`),
`description*`, `hazard?`, `sources?`, `propagation?`, `exposureTime?` (8 faixas), `possibleInjuries?`,
`noxiousAgentCode?` (S-2240, texto), `measurementUnit?` (10 unidades, incl. `qualitative_na`),
`concentrationIntensity?` (string decimal). **Regra `qualitative_na`**: concentraÃ§Ã£o sÃ³ Ã© aceita com
unidade **quantitativa** (com `qualitative_na` ou sem unidade â 422 `VALIDATION`). **`RiskListItem`**:
`{ id, gesId, gesName, agentType, description, exposureTime, measurementUnit }`. **ReutilizaÃ§Ã£o** Ã© por
**prefill de UI** (`/risks/new?from=<id>` â `getRiskAction` â `createRiskAction`; novo `id`), **sem**
action de clone. **Erros REST**: 422 (validaÃ§Ã£o/`qualitative_na`/FK `gesId`), 404
(cross-tenant/inexistente), 403 (`client`); **nunca 409**. "UsuÃ¡rio autor" fora de escopo (modelo sem
`created_by`).

---

## AvaliaÃ§Ã£o de risco (5Ã5) â `actions/pgr/risk-assessments.ts`

AvaliaÃ§Ã£o de risco pela matriz 5Ã5 (probabilidade Ã severidade). Fatia 016, **zero-migration**
(tabela `risk_assessments` da migration `0012`; escopo restrito Ã s suas colunas â **nÃ£o** toca
`control_measures`/`risk_methodology`, que Ã© apenas **lida**). **HistÃ³rico 1:N** por risco (sem
unique â **sem 409**; avaliaÃ§Ã£o vigente = Ãºltima por `assessedAt desc`, `createdAt desc`).
`riskLevel = probability Ã severity` Ã© **calculado e persistido**; `result` Ã© a **classificaÃ§Ã£o
snapshot** pela metodologia da org (`getRiskMethodologyView` + `classify`, com fallback padrÃ£o). REST
espelho: `/api/v1/risks/{id}/assessments` (GET, POST 201) Â· `/api/v1/risk-assessments/{id}` (GET, PUT,
DELETE 204).

| Action                           | Entrada                           | Retorno (`data`)                                                                  |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `listRiskAssessmentsAction`      | `riskId, { page?, pageSize? }`    | `{ rows: RiskAssessmentListItem[]; total }` (`riskId` invÃ¡lido â `FK_NOT_FOUND`) |
| `getRiskAssessmentAction`        | `id`                              | `RiskAssessment` (inexistente/cross-tenant â `NOT_FOUND`)                         |
| `getCurrentRiskAssessmentAction` | `riskId`                          | `RiskAssessment \| null` (null se risco sem avaliaÃ§Ãµes)                         |
| `createRiskAssessmentAction`     | `riskId, RiskAssessmentInput`     | `RiskAssessment` (201; `riskId` invÃ¡lido â `FK_NOT_FOUND`)                       |
| `updateRiskAssessmentAction`     | `riskId, id, RiskAssessmentInput` | `RiskAssessment` (corpo completo; recalcula `riskLevel`/`result`)                 |
| `deleteRiskAssessmentAction`     | `riskId, id`                      | `{ id }` (delete fÃ­sico)                                                         |

**`RiskAssessmentInput`** (mesmo corpo para create e PUT): `criterion*` (`qualitative`|`quantitative`),
`probability*` (1â5), `severity*` (1â5), `uncertaintyDegree` (0â2, default 0), `assessedAt*`
(`AAAA-MM-DD`), `toleranceLimit?`. **NÃ£o** aceita `riskLevel`/`result` (calculados no servidor),
`riskId` (vem da rota) nem `orgId` (sessÃ£o). **Erros REST**: 422 (validaÃ§Ã£o/FK `riskId`), 404
(cross-tenant/inexistente), 403 (`client`); **nunca 409**.

---

## Medidas de controle (5W2H) â `actions/pgr/control-measures.ts`

Plano de aÃ§Ã£o 5W2H por risco, uma medida por **nÃ­vel da hierarquia NR-01** (`control_level`:
`elimination`/`collective_protection`/`administrative`/`ppe`). Fatia 018, **zero-migration** (tabela
`control_measures` da migration `0012`; escopo restrito Ã s suas colunas â **nÃ£o** toca
`risk_methodology`/`risk_assessments`, apenas **lidos** como contexto). A **UNIQUE
`(org_id, risk_id, control_level)`** faz a duplicidade de nÃ­vel virar **`DUPLICATE`/409** (no mÃ¡x. 4
medidas por risco). **Sem coluna de status**: `Sem plano`/`Planejada`/`Vencida` sÃ£o **derivados** na
leitura (vencida â `applicable` + `actionDeadline < hoje`, fuso America/Sao_Paulo). ResponsÃ¡vel Ã©
**texto** (`action_responsible`; combobox de funcionÃ¡rios grava `fullName`, sem FK). O contexto do
risco e a avaliaÃ§Ã£o vigente (`riskLevel`/`result`) sÃ£o exibidos **derivados** (sem snapshot). REST
espelho: `/api/v1/risks/{id}/control-measures` (GET, POST 201) Â· `/api/v1/control-measures/{id}`
(GET, PUT, DELETE 204).

| Action                       | Entrada                           | Retorno (`data`)                                                                           |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `listControlMeasuresAction`  | `riskId, { page?, pageSize? }`    | `{ rows: ControlMeasureListItem[]; total }` (`riskId` invÃ¡lido â `FK_NOT_FOUND`)          |
| `getControlMeasureAction`    | `id`                              | `ControlMeasure` (inexistente/cross-tenant â `NOT_FOUND`)                                  |
| `createControlMeasureAction` | `riskId, ControlMeasureInput`     | `ControlMeasure` (201; `riskId` invÃ¡lido â `FK_NOT_FOUND`; nÃ­vel repetido â `DUPLICATE`) |
| `updateControlMeasureAction` | `riskId, id, ControlMeasureInput` | `ControlMeasure` (corpo completo; `control_level` imutÃ¡vel)                               |
| `deleteControlMeasureAction` | `riskId, id`                      | `{ id }` (delete fÃ­sico)                                                                  |

**`ControlMeasureInput`** (mesmo corpo para create e PUT): `controlLevel*` (enum NR-01; ignorado na
escrita do PUT â imutÃ¡vel), `applicable` (bool), `actionWhat`/`actionHow` (**obrigatÃ³rios quando
`applicable=true`**), `actionTracking?`/`actionMeasurement?`/`actionResponsible?`/`actionDeadline?`
(`AAAA-MM-DD`)/`justification?`/`monitoring?`. **NÃ£o** aceita `riskId` (rota) nem `orgId` (sessÃ£o).
**Erros REST**: 422 (validaÃ§Ã£o/FK `riskId`), 404 (cross-tenant/inexistente), **409** (nÃ­vel
duplicado), 403 (`client`).

---

## Rotas de UI (superfÃ­cie HTTP navegÃ¡vel)

Ãrea autenticada `(protected)` â layout aplica `requireTenantContext`; cada pÃ¡gina de CRUD
aplica `requireOfficeStaffPage()` (papel `client` â `forbidden()`); detalhe/ediÃ§Ã£o por id
inexistente ou de outro escritÃ³rio â `notFound()`.

| Rota                                                                            | DescriÃ§Ã£o                                                                                                                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                                    | Painel (Ã¡rea autenticada)                                                                                                                               |
| `/companies` Â· `/companies/new` Â· `/companies/[id]/edit`                      | Empresa (lista paginada / criar / detalhe=ediÃ§Ã£o)                                                                                                      |
| `/work-units` Â· `/work-units/new` Â· `/work-units/[id]/edit`                   | Unidade de obra (+ copiar endereÃ§o da empresa)                                                                                                          |
| `/job-roles` Â· `/job-roles/new` Â· `/job-roles/[id]/edit`                      | FunÃ§Ã£o                                                                                                                                                 |
| `/ges` Â· `/ges/new` Â· `/ges/[id]/edit`                                        | GES (lista + card "Total"; ediÃ§Ã£o gerencia vÃ­nculos e expostos)                                                                                       |
| `/employees` Â· `/employees/new` Â· `/employees/[id]` Â· `/employees/[id]/edit` | FuncionÃ¡rio (lista filtrÃ¡vel / criar / ficha / editar)                                                                                                 |
| `/pgr` Â· `/pgr/new` Â· `/pgr/[id]` Â· `/pgr/[id]/edit`                         | PGR (lista + filtro EmpresaâObra / criar com aceite NR-01 / detalhe / editar)                                                                            |
| `/risks` Â· `/risks/new` Â· `/risks/[id]` Â· `/risks/[id]/edit`                 | Riscos do GES (lista + filtro EmpresaâObraâGES / criar / detalhe / editar / reutilizar por prefill)                                                      |
| `/risks/[id]/assessments` Â· `.../new` Â· `.../[assessmentId]/edit`             | AvaliaÃ§Ãµes 5Ã5 do risco (histÃ³rico + vigente / criar com preview / editar) â atalho no detalhe do risco                                               |
| `/risks/[id]/control-measures` Â· `.../new` Â· `.../[measureId]/edit`           | Medidas de controle 5W2H por nÃ­vel NR-01 (lista + estado derivado/vencida + contexto/avaliaÃ§Ã£o vigente / criar / editar) â atalho no detalhe do risco |
| `/categories` Â· `/categories/new` Â· `/categories/[id]/edit`                   | Categoria (catÃ¡logo `epi`/`machine`; detalhe=ediÃ§Ã£o)                                                                                                  |

## Invariantes de isolamento (multi-tenant)

- Tenant ativo sempre da sessÃ£o; nunca de input do cliente.
- Detalhe/ediÃ§Ã£o/exclusÃ£o de id de outro escritÃ³rio â `NOT_FOUND` (nunca dado alheio).
- Papel `client` â `FORBIDDEN`/`forbidden()` em qualquer operaÃ§Ã£o.
- `UNIQUE(org_id, cpf)` / `(org_id, cnpj)`: mesmo valor aceito entre escritÃ³rios, bloqueado no
  mesmo escritÃ³rio.
- NÂº de expostos do GES Ã© derivado e somente leitura.

## Protocolo de testes com cURL (para o time)

Roteiro reproduzÃ­vel para validar endpoints **sem** UI. Regra: teste sempre o **status HTTP** e o
**corpo** (`ActionResult`). Server Actions **nÃ£o** sÃ£o testÃ¡veis por cURL (POST-only + header
`Next-Action`); teste sempre pelo **espelho REST** `/api/v1`.

### 0. PrÃ©-requisitos

```bash
npm run dev                 # sobe em http://localhost:3000 (lÃª .env.local)
# jq opcional, sÃ³ p/ ler o corpo bonito. Em .env.local (local/homolog):
#   APP_ENV=local
#   DEV_API_AUTH_BYPASS=true      # libera /api/v1 sem sessÃ£o Clerk
#   DEV_TENANT_ID=<orgId de teste>
export BASE=http://localhost:3000
```

### 1. `/api/v1` (CRUD) â via **bypass DEV** (sem login)

O tenant/papel vÃªm dos headers `x-dev-*`. Padronize um helper:

```bash
api() { curl -s -w '\n[HTTP %{http_code}]\n' \
  -H 'content-type: application/json' \
  -H 'x-dev-tenant: org_a' -H 'x-dev-role: owner' "$@"; }

# Fluxo CRUD completo (esperado ao lado):
api "$BASE/api/v1/companies"                                   # 200 { rows, total }
api -X POST "$BASE/api/v1/companies" \
  -d '{"razaoSocial":"Teste Ltda","riskGrade":3}'             # 201 (recurso)
api "$BASE/api/v1/companies/<id>"                              # 200
api -X PUT "$BASE/api/v1/companies/<id>" \
  -d '{"razaoSocial":"Teste 2","riskGrade":2}'                # 200
api -X DELETE "$BASE/api/v1/companies/<id>"                    # 204 (sem corpo)
```

**Casos obrigatÃ³rios** (todo CRUD): valide os 4xx canÃ´nicos, nÃ£o sÃ³ o caminho feliz:

```bash
# 422 VALIDATION (zod)      â campo fora do domÃ­nio
api -X POST "$BASE/api/v1/companies" -d '{"razaoSocial":"X","riskGrade":9}'
# 409 DUPLICATE             â repete valor Ãºnico no mesmo tenant (ex.: cnpj)
# 404 NOT_FOUND cross-tenant â id de OUTRO escritÃ³rio:
api -H 'x-dev-tenant: org_a' "$BASE/api/v1/companies/<id_do_org_b>"   # 404
# 403 FORBIDDEN             â papel client:
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'x-dev-tenant: org_a' -H 'x-dev-role: client' "$BASE/api/v1/companies"  # 403
```

> **Isolamento** Ã© o caso crÃ­tico: trocar `x-dev-tenant` NUNCA pode devolver dado de outro escritÃ³rio
> (id alheio â 404, list â sÃ³ o tenant do header).

### 2. `/api/integrations/*` â exige **sessÃ£o Clerk real**

NÃ£o hÃ¡ bypass aqui (o `proxy.ts` protege e nÃ£o hÃ¡ dado de tenant). Sem sessÃ£o â **307/redirect** para
o sign-in (nunca Ã© proxy aberto). Para testar o caminho feliz, copie o cookie `__session` do navegador
logado (DevTools â Application â Cookies) e mande no header:

```bash
SESSION='<valor do cookie __session>'
curl -s -w '\n[HTTP %{http_code}]\n' -H "cookie: __session=$SESSION" \
  "$BASE/api/integrations/cep/01001000"      # 200 ok(endereÃ§o)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/integrations/cep/99999999"  # 404 (autenticado) / 307 (sem sessÃ£o)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/integrations/cep/123"       # 422 formato / 307 sem sessÃ£o
```

### 3. Provedores externos direto (isola "Ã© a API deles ou o nosso cÃ³digo?")

```bash
curl -s "https://viacep.com.br/ws/01001000/json/" | jq .
# BrasilAPI 403 sem User-Agent â sempre mande um:
curl -s -A 'sst-manager/1.0' "https://brasilapi.com.br/api/cnpj/v1/00000000000191" | jq '.razao_social'
```

### 4. Checklist antes de abrir PR de CRUD

- [ ] `/api/v1/<resource>` responde GET/POST e `/[id]` responde GET/PUT/DELETE (201/204 corretos).
- [ ] 422 / 409 / 404 cross-tenant / 403 (papel client) reproduzidos por cURL.
- [ ] Recurso documentado neste arquivo (tabelas "Recursos" + "SumÃ¡rio").
- [ ] Requests adicionados ao `sst-manager.postman_collection.json` (pasta do recurso).
