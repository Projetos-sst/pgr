# API Design — SST Manager (estado atual)

> **Natureza da "API".** Há **duas** superfícies:
>
> 1. **Server Actions** (App Router) — a interface usada pela UI do app. São funções `"use server"`
>    invocadas via **POST** pelo framework (header `Next-Action: <id de build>` + payload do React);
>    **POST-only por design do Next** e **não** chamáveis "cruas" por Postman/cURL.
> 2. **REST API `/api/v1`** (Route Handlers) — superfície HTTP RESTful de verdade
>    (GET/POST/PUT/DELETE), testável por Postman. Reusa os mesmos repositórios/validação/erros das
>    actions. **É o que está na coleção Postman** (`sst-manager.postman_collection.json`).
>
> Este documento descreve o contrato lógico (assinaturas, entradas, retornos, erros) de tudo que
> existe hoje.

Atualizado conforme o código em `src/shared/server/actions/` e `src/app/api/`.

## Autenticação, identidade e tenant (PRÉ-REQUISITO)

> **Não há API própria de cadastro/login.** A identidade vive no **Clerk** (provedor de auth),
> conforme a fatia 005 (Modelo B). Operar qualquer CRUD exige: (1) ter conta no Clerk, (2) ter um
> tenant/escritório ativo. Ambos são resolvidos fora das nossas Server Actions.

**Fluxo de pré-requisito (estado atual):**

1. **Cadastro / login** — componentes **hospedados do Clerk** (`<SignUp>` / `<SignIn>`) nas
   páginas `/(public)/sign-up` e `/(public)/sign-in`. É o fluxo/Frontend API do Clerk — **não**
   um endpoint nosso. Não é chamável pela nossa API (nem por Postman como "API nossa").
2. **Provisionamento do escritório (free)** — no evento `user.created`, o Clerk dispara o
   **webhook** `POST /api/webhooks/clerk` → `handleClerkEvent` → `provisionPersonalTenant`, que
   cria o **tenant pessoal** (`orgs`, plano `free`) + **membership `owner`**. Toda identidade
   ganha um escritório próprio automaticamente, **mesmo free** (não vira organização no Clerk
   enquanto free — isso é futuro, no upgrade PRO). Não há passo manual de "criar org" para free.
3. **Sincronização** — o mesmo webhook trata `user.{created,updated,deleted}`,
   `organization.{created,updated,deleted}` e `organizationMembership.{created,updated,deleted}`,
   mantendo `users` e `org_memberships` em dia.
4. **Org ativa** — definida pelo cookie **`tenant_active_org`** e reconciliada por
   `reconcileActiveOrg` (Inv-2: a lista/seleção de tenant é dirigida pelos nossos vínculos, não
   pelo Clerk). Não há endpoint dedicado de troca nesta fatia.
5. **Onboarding** (`/(protected)/onboarding`) — usa componentes Clerk
   (`<CreateOrganization>` / `<OrganizationList>`) para o caminho de organização Clerk (multi-org/PRO).

### Endpoints HTTP de verdade (Route Handlers)

Estes **são** HTTP estável e chamáveis por Postman/cURL (ao contrário das Server Actions):

| Método | Rota                   | Auth                                                                | Retorno                                                                                                |
| ------ | ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/me`              | cookie de sessão Clerk                                              | `200 { userId, orgId }` · `401` (sem sessão) · `403 { error: "NO_ACTIVE_ORG" }`                        |
| `POST` | `/api/webhooks/clerk`  | assinatura **Svix** (`svix-id`, `svix-timestamp`, `svix-signature`) | `200 ok\|ignored` · `400 invalid_payload\|invalid signature` · `500 db error`                          |
| `POST` | `/api/webhooks/stripe` | assinatura **Stripe** (`stripe-signature`; emenda 1.5.0)            | `200 ok` · `400 missing\|invalid signature` (sincroniza `orgs.plan` free/pro por evento de assinatura) |

> `GET /api/me` é o equivalente REST da Server Action `meAction`. O webhook **rejeita** payloads
> sem assinatura Svix válida (`verifyWebhook`), então só dispara com o signing secret do Clerk.

### Rota pública de assinatura — `/sign/{token}` (fatia 012)

Página pública (fora de `/api/v1`, **sem Clerk, sem tenant de sessão, sem bypass dev**): a
credencial é o **token HMAC** de 72h gerado por `generateSignTokenAction` (Server Action interna,
office staff — a geração NÃO tem espelho REST de propósito: o token é credencial de escrita e a
superfície pública testável é a própria rota). O token embute `{ orgId, deliveryId, method, iat }`
assinados; a rota resolve o tenant do payload e roda sob `withOrg(orgId)` (RLS backstop).

| Ação   | Rota            | Auth       | Desfecho                                                                                                                                                                              |
| ------ | --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/sign/{token}` | só o token | página com itens + assinatura · "link inválido" (`TOKEN_INVALID`, uniforme p/ adulterado/inexistente) · "link expirado" (`TOKEN_EXPIRED`, >72h) · "já confirmado" (negócio, não erro) |
| `POST` | `/sign/{token}` | só o token | Server Action `submitSignatureAction`: `pending → signed_qr\|signed_link` (o `method` vem do payload assinado, nunca do cliente) · repetida → `ALREADY_SIGNED` (mensagem, nunca 500)  |

- Anti-enumeração: espaço de chave HMAC-SHA256 + resposta uniforme; rate-limit por IP é controle
  complementar na **borda** (Cloudflare/WAF — infra, fora do app). `Cache-Control: no-store`.
- O painel interno da entrega reflete a assinatura por **polling** do `signature_status`.

### Integrações externas (`/api/integrations`) — Route Handlers de consulta

Camada de plataforma reutilizável (autofill de formulários). **Só sessão** (`requireAuth()`) — CEP e
CNPJ são **dados públicos**, não do tenant; logo **sem** tenant/papel e **sem** bypass dev. Resposta
no mesmo envelope `ActionResult<T>`. Falha externa **nunca** bloqueia o form (o hook trata em silêncio).

| Método | Rota                            | Auth         | Retorno                                                                                          |
| ------ | ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/integrations/cep/{cep}`   | sessão Clerk | `200 ok(endereço)` · `404 NOT_FOUND` · `422 VALIDATION` (formato) · `502 UPSTREAM_ERROR` · `401` |
| `GET`  | `/api/integrations/cnpj/{cnpj}` | sessão Clerk | `200 ok(empresa+endereço)` · `404` · `422` · `502` · `401`                                       |
| `GET`  | `/api/integrations/caepi/{ca}`  | sessão Clerk | `200 ok(CaLookupResult)` — 3 estados como payload · `422 VALIDATION` (formato) · `401`           |

- Provedores: **ViaCEP** (`viacep.com.br/ws`) e **BrasilAPI** (`brasilapi.com.br/api/cnpj/v1`), sem API
  key. `src/shared/integrations/**` valida formato antes de chamar (evita request inútil), aplica
  timeout (`AbortController`) e cacheia só o sucesso.
- ⚠️ **Gotcha**: a BrasilAPI responde **403** ao User-Agent padrão do runtime — o cliente HTTP interno
  manda um `User-Agent` identificável (`providers/http.ts`). Ao testar via cURL, o UA do curl já passa.
- **CAEPI é 100% local** (fatia 011): a consulta lê a tabela global `caepi_certificates` (espelho da
  base pública do MTE, alimentada pelo job `scripts/caepi-sync.ts`) — **nenhum fetch externo por
  request**. Contrato `CaLookupResult`: `{ status: "valid" | "expired", ca, manufacturer, norm,
validUntil, equipmentName? }` ou `{ status: "not_found", ca, baseUnsynced? }`.
  **Divergência consciente do 404 de CEP/CNPJ**: os 3 estados voltam como **payload 200** —
  `not_found`/`expired` são resultado informativo de negócio (aviso na UI, nunca bloqueia o
  cadastro), não falha de transporte; é o que permite ao hook `use-caepi-validation` reusar o
  `useLookup` (que só entrega dado em `response.ok && body.ok`). Sem cache (`Cache-Control:
no-store`): a resposta depende de "hoje" (um CA que vence hoje muda de estado amanhã).

## REST API (`/api/v1`) — CRUD por HTTP

**Serviços por empresa (NOB-100):** `GET /api/v1/companies/{id}/modules` consulta habilitações e histórico paginado; `PUT` altera um serviço, exclusivamente para owner. Ver seção Serviços por empresa abaixo.

Camada **RESTful** sobre Route Handlers (`src/app/api/v1/...`), com **verbos de verdade**
(GET/POST/PUT/DELETE) — esta é a superfície testável por Postman/cURL. Reusa os mesmos
repositórios, schemas zod e mapeamento de erro das Server Actions (sem duplicar regra).
Coleção (arquivo **único**): `sst-manager.postman_collection.json` — as variáveis (`baseUrl`,
`devTenant`, `devRole`, ids) ficam na própria coleção (Variables); troque `baseUrl` para alternar
entre local/homolog/prod. (Mantemos só **um** arquivo Postman de propósito.)

> **Por que existe além das Server Actions?** Server Actions são **POST-only** por design do Next
> (doc oficial) e exigem o header `Next-Action` (hash de build) — logo, não-RESTful e não testáveis
> em Postman. Os Route Handlers são a forma Next-nativa de expor REST.

**Recursos** (todos sob `/api/v1`, escopados ao tenant ativo):

| Recurso                                                                                                                                                        | Verbos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/companies` · `/companies/{id}` · `/companies/{id}/dependents`                                                                                                | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/companies/{id}/modules`                                                                                                                                      | GET (habilitações + histórico), PUT (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/companies/{id}/medical-risk-sources`                                                                                                                         | GET (fontes/riscos paginados), POST (registrar fonte pendente)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/companies/{id}/exam-proposal`                                                                                                                                | GET (proposta **só leitura** de exames complementares a partir dos riscos **validados** de fonte vigente, com a referência da NR-7; `requiresMedicalReview: true`; nada é aprovado; `404` empresa de outro tenant, `403` sem Medicina/`client`) — NOB-147                                                                                                                                                                                                                                                                                                                                                                                       |
| `/companies/{id}/pcmso-readiness`                                                                                                                              | GET (conferência **só leitura** dos dados do PCMSO: itens `blocking`, `warning` e `not_available`, com referência NR-7/MED e link; `ready` só sem bloqueio nem etapa inexistente; não gera, aprova nem assina; `404` outro tenant, `403` sem Medicina/`client`) — NOB-148                                                                                                                                                                                                                                                                                                                                                                       |
| `/medicine/procedures` · `/medicine/procedures/{code}`                                                                                                         | GET (`?search=` código ou descrição sem acento, `?page=`/`?pageSize=` ≤ 100; catálogo da **Tabela 27 do eSocial**, só leitura) · GET (`404` para código fora da tabela) — NOB-147                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/medicine/ntep` · `/companies/{id}/ntep`                                                                                                                      | GET (`?cid=` CID-10 e/ou `?cnae=` classe de 4 dígitos ou subclasse, `?version=`; **Lista C do Anexo II do Decreto 3.048/1999 (NTEP)**, só leitura; código malformado → `422`; `kind`: `match` \| `no_match` \| `unavailable` \| `unvalidated` \| `version_not_available`) · GET (classe do CNAE cadastrado da empresa; Medicina habilitada; `status`: `ok` \| `missing_cnae` \| `invalid_cnae`) — informativo, não conclui nexo individual — NOB-113                                                                                                                                                                                            |
| `/companies/{id}/machines`                                                                                                                                     | GET/POST; `/{machineId}` GET/PUT/DELETE lógico; `/options` GET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/pgr/{id}/readiness`                                                                                                                                          | GET conferência de preenchimento/consistência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/pgr/{id}/reviews`                                                                                                                                            | GET/POST amostras; `/{sampleId}` GET; `/{sampleId}/decisions` POST                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/pgr-basic-offers`                                                                                                                                            | GET/POST versões; `/{id}` GET; `/{id}/publication` PUT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/work-units` · `/work-units/{id}` · `/work-units/{id}/dependents`                                                                                             | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/job-roles` · `/job-roles/{id}` · `/job-roles/{id}/dependents`                                                                                                | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/ges` · `/ges/{id}` · `/ges/{id}/dependents`                                                                                                                  | GET, POST · GET (inclui `exposedWorkers`), PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/ges/{id}/job-roles` · `/ges/{id}/job-roles/{linkId}`                                                                                                         | GET (`?available=true` p/ não vinculadas), POST · PUT, DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/ges/{id}/risk-suggestions` · `/ges/{id}/risk-suggestions/accept`                                                                                             | POST (sugere riscos por IA — não persiste) · POST (persiste selecionados como rascunho, `201`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/risks/{id}/control-measure-suggestions` · `/risks/{id}/control-measure-suggestions/accept`                                                                   | POST (propõe medidas de controle por IA na hierarquia da NR-01 — não persiste) · POST (grava as aceitas em `control_measures`, `201`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/job-roles/{id}/training-suggestions` · `/job-roles/{id}/training-suggestions/accept`                                                                         | POST (propõe treinamentos obrigatórios por IA, já casados com o catálogo — não persiste) · POST (vincula; cria no catálogo o que faltar, `201`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/service-orders/{id}/instruction-suggestions`                                                                                                                 | POST (redige instruções de segurança da OS por IA, NR-01 1.4.1 — não persiste)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/employees` · `/employees/{id}` · `/employees/{id}/epi-record`                                                                                                | GET, POST · GET, PUT, DELETE · GET (ficha de EPI, read-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/pgr` · `/pgr/{id}`                                                                                                                                           | GET (`?search=` empresa/obra/responsável, `?registrationType=crm\|crea\|mte\|not_applicable`, `?companyId=`, `?workUnitId=`; resposta inclui `createdBy`), POST (persiste `created_by` = autor) · GET, PUT, DELETE (documento PGR; sem `/dependents`). **`PUT` em PGR assinado ou publicado → `409 ALREADY_SIGNED`** (trava imposta no servidor, não só na UI)                                                                                                                                                                                                                                                                                  |
| `/pgr/{id}/revisions` · `/pgr/{id}/revisions/{revisionId}/archive`                                                                                             | GET (histórico, mais recente primeiro), POST (número **server-side**; `revisionNumber` no body → `422`; `201`; PGR assinado/publicado → `409 ALREADY_SIGNED`) · PUT (arquiva a revisão, #46; idempotente — repetir não é erro; revisão inexistente/cross-tenant → `404`; PGR assinado/publicado → `409 ALREADY_SIGNED`)                                                                                                                                                                                                                                                                                                                         |
| `/pgr/{id}/ges` · `/pgr/{id}/ges/{gesId}`                                                                                                                      | GET (GES vinculados ao PGR), POST (vincula GES; `201`) · DELETE (desvincula; `204`); ambas as escritas em PGR assinado/publicado → `409 ALREADY_SIGNED`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/pgr/{id}/consolidated`                                                                                                                                       | GET (visão consolidada read-only: GES → riscos → avaliação vigente → medidas 5W2H + status → EPIs; campos eSocial S-2240; `planCoverage` por risco, #42)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/pgr/{id}/signature`                                                                                                                                          | POST (cria solicitação; body só `ttlSeconds?`; `201` com `publicUrl`+`qrCodeDataUrl`) · GET (estado derivado; **nunca** token/URL)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/pgr/{id}/pdf`                                                                                                                                                | GET (gera o PDF do PGR via Gotenberg; `?color=` opcional para a capa; `application/pdf`; PGR inexistente/cross-tenant → 404; serviço de PDF ausente → 503)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/pgr/{id}/docx`                                                                                                                                               | GET (`?format=docx\|pdf`, default `docx`; PGR preenchido pelo template `templates/pgr/pgr-template.docx` com os semi-fixos padrão) · POST (body `{format?, overrides?}` — semi-fixos alterados: `labels`/`titles`/`texts`/`campaigns`, chave desconhecida → 422); binário com `Content-Disposition`; headers `X-Pgr-Docx-Missing-Tags`, `X-Pgr-Generated-At`, `X-Pgr-Template-Sha256`, `X-Pgr-Source-Sha256`, `X-Pgr-File-Sha256` (identificadores técnicos, sem assinatura/parecer); PDF pelo provedor `PGR_DOCX_PDF_PROVIDER` (`gotenberg` padrão \| `google`); PGR inexistente/cross-tenant → 404; template/provedor ausente → 503           |
| `/risks` · `/risks/{id}`                                                                                                                                       | GET, POST · GET, PUT, DELETE (inventário de risco do GES; filtros `companyId`/`workUnitId`/`gesId`; sem `/dependents`, sem 409)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/risks/{id}/epis` · `/risks/{id}/epis/{linkId}`                                                                                                               | GET (`?available=true&search=` p/ EPIs não vinculados), POST · PUT (neutralização), DELETE (vínculo EPI × risco)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/risks/{id}/assessments` · `/risk-assessments/{id}`                                                                                                           | GET, POST (avaliação 5×5 do risco + bloco NR-09 opcional; 201) · GET, PUT, DELETE (histórico 1:N; `riskLevel`/`result` calculados; sem `/dependents`, sem 409)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/risks/{id}/ergonomic-evaluations` · `/ergonomic-evaluations/{id}`                                                                                            | GET, POST (avaliação ergonômica NR-17 do risco; 201) · GET, PUT, DELETE (histórico 1:N; vigente = `assessedAt` mais recente; sem `/dependents`, sem 409)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/pgr/{id}/nr18-checklist` · `/pgr/{id}/epi-relation`                                                                                                          | GET (leituras **derivadas** do PGR: checklist informativo dos projetos da NR-18 por `doc_type` e relação deduplicada de EPIs; somente leitura — sem POST/PUT/DELETE)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/risks/{id}/control-measures` · `/control-measures/{id}`                                                                                                      | GET, POST (plano de ação 5W2H por nível NR-01; 201) · GET, PUT, DELETE (nível imutável; **DUPLICATE/409** se nível repetido; sem `/dependents`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/categories` · `/categories/{id}`                                                                                                                             | GET, POST · GET, PUT, DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/medicos` · `/medicos/{id}`                                                                                                                                   | GET (`?search=` nome/CRM, `?clinic=` empresa/clínica, `?status=active\|inactive`), POST (`201`) · GET, PUT, DELETE (`204`) — CRM único por org (`DUPLICATE`, inclusive formato equivalente na mesma categoria+UF → `fields.crm`); sem `/dependents`                                                                                                                                                                                                                                                                                                                                                                                             |
| `/medicos/{id}/user-links(/{linkId})` · `/medicos/{id}/user-link-invitations(/{inv}/{ação})` · `/me/professional(-invitations)`                                | GET histórico de vínculos · PUT só revoga (`{ reason }`; sem DELETE) · GET convites, POST convidar (`201`, só `owner`) · POST `accept`/`decline` (só a conta convidada), `approve` (outro `owner`, no autovínculo), `cancel` (`owner`) · GET perfil da sessão e convites pendentes — NOB-149/NOB-157                                                                                                                                                                                                                                                                                                                                            |
| `/me/professional-identity(/requests)` · `/me/medico-links/{id}/reconfirm` · `/admin/identity-verifications(…)`                                                | GET situação da identidade e do acesso clínico, POST pedido (`201`, só a própria conta) · POST reconfirmação de vínculo legado (`201`) · GET fila, POST aprovação (`201`), POST recusa/revogação — só master pela sessão real **e** designado (banco), nunca pelo bypass dev; demais → `403` — NOB-158/159/160                                                                                                                                                                                                                                                                                                                                  |
| `/companies/{id}/exam-plans` · `/exam-plans/{id}` · `/exam-plans/{id}/items(/{itemId})` · `/exam-plans/{id}/approval`                                          | GET versões, POST rascunho (`201`) · GET detalhe · POST acrescentar (`201`), PUT decidir · POST aprovar — decisões e aprovação só da coordenadora vinculada (RLS); sem DELETE — NOB-150                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/companies/{id}/pcmso-documents` · `/pcmso-documents/{id}`                                                                                                    | GET versões, POST gerar prévia (`201`, `{ cycleStart }`; só sem bloqueio na conferência) · GET versão arquivada — sem PUT/DELETE; só `preview` (sem assinatura não há emissão) — NOB-151                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/companies/{id}/signed-pcmsos` · `/signed-pcmsos/{id}/download`                                                                                               | GET PCMSOs assinados + vigente + alertas · POST multipart (`201`; `file` PDF ≤ 25 MB + `{ origin*, previewDocumentId*, signatureMethod*, verificationReference*, signerName*, signerRegistration*, signerUf*, signedOn*, replacesId?, changeKind?, replaceReason? }`) · GET URL assinada curta — sem PUT/DELETE; conferência documental, sem validação criptográfica — NOB-166                                                                                                                                                                                                                                                                  |
| `/companies/{id}/interpretation-criteria` · `/companies/{id}/interpretation-criteria/{code}`                                                                   | GET exames do plano aprovado com o critério vigente e os que faltam, POST nova versão (`201`, `{ code*, otherDescription?, criteria*, conduct* }`; só o coordenador vinculado, demais → `403`) · GET histórico do procedimento (código inválido → `422`) — só inclusão; NR-7 7.5.4 c — NOB-153                                                                                                                                                                                                                                                                                                                                                  |
| `/companies/{id}/analytical-reports` · `/companies/{id}/analytical-reports/context` · `/analytical-reports/{id}`                                               | GET versões, POST elaborar (`201`, `{ periodStart*, periodEnd*, simplified?, variationDiscussion?, insufficiencyNote? }`; só o coordenador vinculado, demais → `403`; período/simplificação/discussão inválidos → `422`) · GET contexto (período sugerido, anterior, 7.6.6, totais; `?periodStart&periodEnd`) · GET versão arquivada — só `preview`, sem UPDATE/DELETE; NR-7 7.6.2–7.6.6 — NOB-154                                                                                                                                                                                                                                              |
| `/companies/{id}/analytical-report-events` · `/analytical-reports/{id}/events` · `/analytical-report-events/{id}/void`                                         | GET eventos + versão vigente + situação · POST `{ kind: finalized \| presented \| discussed, ... }` (`201`; finalizar só o médico responsável autor; apresentar só versão finalizada; discutir só depois de apresentar; versão vigente) · POST correção (`{ reason* }`, `201`) — NR-7 7.6.5 — NOB-168                                                                                                                                                                                                                                                                                                                                           |
| `/health-exams` · `/health-exams/{id}`                                                                                                                         | GET (`?search=` funcionário ou tipo de exame, `?examType=`, `?employeeId=`, `?companyId=` = empresa **atual** do funcionário; ID malformado ou tipo inválido → `422 VALIDATION`), POST (`201`) · GET, PUT, DELETE (`204`) — exames ocupacionais/ASO; validade **derivada** na leitura; `validUntil < performedAt` e troca de `employeeId` no PUT → `422 VALIDATION`; funcionário/médico cross-tenant → `422 FK_NOT_FOUND`; sem `/dependents`                                                                                                                                                                                                    |
| `/health-exams/{id}/procedures` · `/health-exams/{id}/procedures/{procedureId}`                                                                                | GET, POST (`201`, `{ code*, otherDescription?, performedAt* }`; Tabela 27; data não futura; duplicado → `409`) · DELETE (`204`) — exames complementares realizados (NR-7 7.5.19.1 d), sem resultado clínico — NOB-152                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/health-exams/{id}/aso-readiness` · `/health-exams/{id}/aso-documents` · `/aso-documents/{id}`                                                                | GET conferência 7.5.19.1 a–g · GET prévias, POST gerar (`201`, sem corpo; só sem bloqueio) · GET prévia arquivada — sem PUT/DELETE; só `preview` (sem assinatura do examinador não há ASO emitido) — NOB-152                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/health-exams/{id}/company-origin` · `/health-exams/{id}/examiner-conclusions`                                                                                | POST confirma origem de exame antigo (`{ justification* }`, owner, `200`) · GET confirmações, POST apto/inapto para “apto com restrição” (`{ conclusion* }`, só o examinador vinculado, `201`) — NOB-152                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/health-exams/{id}/signed-asos` · `/signed-asos/{id}/download`                                                                                                | GET ASOs assinados (cadeia de substituição) · POST multipart (`201`; `file` PDF ≤ 25 MB + `{ origin*, previewDocumentId?, signatureMethod*, verificationReference*, signerName*, signerRegistration*, signerUf*, conclusion*, signedOn*, replacesId?, replaceReason? }`) · GET URL assinada curta (`{ url, expiresInSeconds, sha256 }`) — sem PUT/DELETE; o sistema não assina — NOB-163                                                                                                                                                                                                                                                        |
| `/health-exams/{id}/aso-deliveries` · `/health-exams/{id}/aso-deliveries/{deliveryId}/void` · `/aso-deliveries/{id}/evidence`                                  | GET entregas + situação do ASO vigente · POST multipart (`201`; `{ kind*, method?, channelDescription?, occurredAt*, evidenceReference?, evidenceKind? }` + `evidence?` PDF/JPEG/PNG ≤ 10 MB) · POST correção (`{ reason* }`, `201`) · GET URL assinada curta do comprovante — sem PUT/DELETE; só ASO assinado vigente; recebimento só com recibo assinado — NOB-165                                                                                                                                                                                                                                                                            |
| `/health-exams/{id}/aso-deliveries/{deliveryId}/review`                                                                                                        | POST conferência humana do comprovante (`201`, `{ method* (documentary\|signature_witnessed), result* (confirmed\|rejected), reference* }`; revisor = usuário da sessão; uma por comprovante) — NOB-167                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/health-exams/{id}/clinical-notes` · `/health-exams/{id}/work-restrictions` · `/health-exams/{id}/clinical-access-events`                                     | GET prontuário (leitura auditada), POST observação (`201`, `{ content* }`) — só a conta vinculada ao examinador ou ao coordenador, demais → `403` · GET restrições (RH lê), POST (`201`, `{ kind: restriction                                                                                                                                                                                                                                                                                                                                                                                                                                   | withdrawal, restriction? }`, sem CID → senão `422`; só o médico vinculado) · GET trilha de acesso (owner) — NOB-155                                                                                                                         |
| `/employees/{id}/absences` · `/absences/{id}(/return                                                                                                           | /cancel)`·`/absences/{id}/clinical-notes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | GET afastamentos com avaliação (retorno NR-7 7.5.9, sinalização 7.5.19.5 c), POST (`201`) · GET/PUT previsão do fim · POST retorno confirmado e cancelamento · GET/POST área clínica (atestado e CID), só o coordenador vinculado — NOB-139 |
| `/companies/{id}/risk-absence-declarations`                                                                                                                    | GET declarações e permissão (equipe do escritório; cliente só com autorização ativa) · POST declarar (`201`, `{ sourceId*, gesId*, jobRoleId?, justification* }`; só o profissional com autorização ativa de validação de riscos, demais → `403`; fonte substituída ou grupo/função com risco pendente/validado ou `jobRoleId` fora das funções vinculadas ao GES → `422`; `jobRole` texto não é mais aceito → `422`) — NOB-156/NOB-112                                                                                                                                                                                                         |
| `/medicine/overview` · `/medicine/employees`                                                                                                                   | GET (read-model do painel da Medicina: empresas com Medicina habilitada + contagem pela validade **informada** do último exame de cada funcionário) · GET (`?companyId=` **obrigatório**, `?search=`, `?page=`/`?pageSize=` ≤ 100; funcionários da empresa + último exame; `422` sem/má `companyId`, `404` empresa de outro tenant, `403` empresa sem Medicina); só GET, sem `/dependents` — não são entidades                                                                                                                                                                                                                                  |
| `/companies/{id}/pcmso-coordinators` · `/pcmso-coordinators/{id}`                                                                                              | GET (histórico, mais recente primeiro), POST (`201`, designa; a designação aberta é encerrada na véspera) · GET, PUT (só encerra: `{ endsOn, endReason }`) — **sem DELETE** (histórico preservado, `405`); escrita só `owner`; empresa com Medicina habilitada                                                                                                                                                                                                                                                                                                                                                                                  |
| `/risk-methodology`                                                                                                                                            | GET, PUT (singleton por org — sem `list`/`{id}`/`dependents`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/epi-catalog` · `/epi-catalog/{id}` · `/epi-catalog/{id}/dependents`                                                                                          | GET (`?search=` nome/CA/**fabricante**/categoria, `?type=epi\|machine\|supply`, `?categoryId=`), POST · GET, PUT, DELETE (em uso → `409 IN_USE`) · GET (`{stock, risk, deliveryItems}`). Body aceita `companyId?` (Empresa do EPI, #201/R1 — nullable, cross-tenant → `422 FK_NOT_FOUND`) e `usefulLifeMonths?` (inteiro > 0). Migration `0038_epi_company_useful_life`.                                                                                                                                                                                                                                                                        |
| `/epi-deliveries` · `/epi-deliveries/{id}` · `/epi-deliveries/{id}/sign` · `/epi-deliveries/{id}/return`                                                       | GET, POST (baixa transacional) · GET, DELETE (só `pending`; **sem PUT** — entrega imutável) · POST (assinatura manual) · POST (devolução de item)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/training-catalog` · `/training-catalog/{id}` · `/training-catalog/{id}/dependents`                                                                           | GET (`?search=` nome/norma, `?norm=`), POST · GET, PUT, DELETE (em uso → `409 IN_USE`) · GET (`{records, requiredLinks}`) — redesign: `number` (`TR-0201`) + `is_active` (Vigente/Inativo); Validade derivada da periodicidade; migration `0044`                                                                                                                                                                                                                                                                                                                                                                                                |
| `/training-records` · `/training-records/{id}`                                                                                                                 | GET (`?employeeId=`), POST (`valid_until` calculado no servidor; **sem PUT** — realização imutável) · GET, DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/job-role-required-trainings` · `/job-role-required-trainings/{id}`                                                                                           | GET (`?jobRoleId=`), POST (add **idempotente** por UNIQUE) · DELETE (sem GET/PUT de item — vínculo magro)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/profile`                                                                                                                                                     | GET, PUT (perfil do **usuário logado** — self; edita só campos app-managed `phone`/`cpf`/`jobTitle`; nome/e-mail/foto são do Clerk)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/team` · `/team/{userId}` · `/team/invitations`                                                                                                               | GET (roster do tenant; `?search=`) · PUT, DELETE (papel / remoção — **owner**; via Clerk; barra o último owner) · POST (convite — **PRO**, `201`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/pending-items`                                                                                                                                               | GET (read-model das pendências sem página própria: PGRs vencidos, controles em atraso, EPIs abaixo do mínimo — top 5 cada, com link à origem)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/dashboard/summary`                                                                                                                                           | GET (agregações read-model do tenant: KPIs, riscos por agente, planos por nível, pendências/vencimentos; **sem tabelas novas**)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/schedule-events` · `/schedule-events/{id}`                                                                                                                   | GET (`?eventType=&from=&to=`), POST · GET, PUT, DELETE (agenda: CRUD de compromissos de SST; `201`/`204`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/vehicles` · `/vehicles/{id}`                                                                                                                                 | GET (`?search=` placa/modelo/marca, `?companyId=`), POST · GET, PUT, DELETE (frota; placa BR/Mercosul; `UNIQUE(org,placa)`→`DUPLICATE`; empresa/unidade/plano cross-tenant→`FK_NOT_FOUND`; `201`/`204`; migration `0041`)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/vehicles/photo` · `/vehicles/{id}/photo`                                                                                                                     | POST multipart (`file`, PNG/JPG até 5 MB) → `{path,url}`, `201`; GET → `{url}` (URL assinada por 1h; veículo de outro tenant → `404`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/inspection-plans` · `/inspection-plans/{id}`                                                                                                                 | GET (`?search=` título, `?type=vehicular\|equipment`, `?status=active\|draft\|inactive`, `?category=`), POST · GET (inclui `items[]`), PUT, DELETE (`204`) — código sequencial `PI-NNNN` server-side; migration `0042`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/vehicular-inspections` · `/vehicular-inspections/{id}` · `/vehicular-inspections/{id}/checklist`                                                             | GET (`?status=`/`?search=`), POST (cabeçalho → `in_progress`, `201`) · GET (inclui itens+respostas), PUT (cabeçalho), DELETE (`204`) · PUT (respostas → `completed`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/equipment-inspections` · `/equipment-inspections/{id}` · `/equipment-inspections/{id}/checklist`                                                             | GET (`?status=`), POST (cabeçalho equipamento → `in_progress`, `201`) · GET, PUT, DELETE (`204`) · PUT (respostas → `completed`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/safety-inspections` · `/safety-inspections/{id}` · `/safety-inspections/{id}/occurrences`                                                                    | GET (`?status=`/`?category=`/`?companyId=`/`?search=`), POST (cabeçalho → `in_progress`, `201`) · GET (inclui `occurrences[]`), PUT, DELETE (`204`) · PUT (ocorrências → `completed`)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/work-permits` · `/work-permits/{id}`                                                                                                                         | GET (`?search=`/`?status=`/`?type=`), POST (`201`) · GET, PUT, DELETE (`204`) — nº único por org (`DUPLICATE`), empresa opcional                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/psychosocial-campaigns` · `/{id}` · `/{id}/status` · `/{id}/questions(/{qid}(/reorder))` · `/{id}/stats` · `/{id}/risks(/{rid}/register)` · `/{id}/conclude` | GET (`?status=`/`?workUnitId=`), POST · GET (inclui `questions[]`), PUT, DELETE · PUT (transição) · POST perguntas + PUT/DELETE + POST reorder · GET agregações · GET/POST derivar + POST registrar no PGR · POST encerrar                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/psychosocial-risk-factors` · `/{id}`                                                                                                                         | GET (`?search=` fator, `?level=` `low`\|`medium`\|`high`), POST (`201`) · GET, PUT, DELETE (`204`) — catálogo de fatores por GES (NR-01); código sequencial `number` (`PS-07`, `UNIQUE(org,number)`, backfill); GES cross-tenant → `422 FK_NOT_FOUND`; GES exibido via JOIN; migration `0045`                                                                                                                                                                                                                                                                                                                                                   |
| `/esocial-events` · `/{id}` · `/esocial-batches` · `/esocial-batches/{id}/return`                                                                              | GET (`?status=`/`?eventType=`/`?dateFrom=`/`?dateTo=`), POST (gera+persiste, `201`) · GET · GET (lotes), POST (envia pending, `201`) · POST (consulta retorno)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/esocial-config`                                                                                                                                              | GET (config do tenant; `null` se nunca salva) · PUT (upsert — **singleton por tenant**, sem coleção/`[id]`). Campos: `environment` (`production`\|`homologation`), `employerCnpj`, `taxClassification`, `certificateName`/`certificateExpiresAt` (informativos), `enabledEvents[]`, `autoSend`, `checkFrequencyHours`. Migration `0047`. **Persistência de preferência — não dispara transmissão.**                                                                                                                                                                                                                                             |
| `/esocial-dashboard`                                                                                                                                           | GET — painel agregado do eSocial (#218), **somente leitura**: KPIs (`transmitted`/`pending`/`failed`/`total`), `conformityPercent` (aceitos ÷ eventos com veredito; `null` sem veredito), `byType[]` (catálogo completo com contagem) e `recent[]` (6 últimos). **Zero migration** — tudo derivado de `esocial_events`.                                                                                                                                                                                                                                                                                                                         |
| `/onboarding`                                                                                                                                                  | GET (progresso de primeiros-passos DERIVADO dos KPIs do tenant; sem tabela; read-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/service-orders` · `/service-orders/{id}` · `/service-orders/{id}/status` · `/service-orders/{id}/signature`                                                  | GET, POST (número **server-side**; itens na mesma tx; `201`) · GET (inclui itens), PUT (itens imutáveis se assinada), DELETE (`204`; só não-assinada + open/in_progress) · PUT (transição; terminal não volta) · GET (estado derivado, **sem** token/URL), POST (cria solicitação; `201` com `publicUrl`+`qrCodeDataUrl`; cota compartilhada)                                                                                                                                                                                                                                                                                                   |
| `/incidents` (tabela `accidents`) · `/incidents/{id}` · `/incidents/{id}/status`                                                                               | GET, POST · GET, PUT, DELETE (`204`) · PUT (state machine `registered→awaiting_planning→awaiting_completion→completed`/`cancelled`; conclusão exige justificativa **e** sem plano ativo → `422`)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/action-plans` · `/action-plans/{id}` · `/action-plans/{id}/status`                                                                                           | GET (`?type=corrective\|preventive`, `?status`, `?origin_type`, `?overdue`…; Empresa derivada; KPIs), POST (origem `risk\|incident` → `422 FK_NOT_FOUND` se inválida/cross-tenant; `201`) · GET, PUT, DELETE (`204`; física só `planned`, senão `409 IN_USE` → cancelar) · PUT (`planned→in_progress→completed`/`cancelled`; terminal não volta) · migration `0042`                                                                                                                                                                                                                                                                             |
| `/risk-audits` · `/risk-audits/{id}` · `/risk-audits/{id}/status` · `/risk-audits/{id}/suggest-action-plan`                                                    | GET, POST (uma ativa por origem → `409 IN_USE`; `201`) · GET (inclui planos da origem) · PUT (transição explícita `awaiting_analysis→planning_actions→completed`; conclusão exige justificativa; inválida → `422`) · POST (sugestão 5W2H por IA; `200`; `402 QUOTA_EXCEEDED` / `502 AI_UNAVAILABLE`)                                                                                                                                                                                                                                                                                                                                            |
| `/form-controls` · `/form-controls/{id}`                                                                                                                       | GET (`?search=`/`?formType=`/`?companyId=`/`?status=`/`?type=`), POST (`201`) · GET, PUT, DELETE (`204`) — código FRM único por org (`DUPLICATE`), empresa/GES opcionais; redesign: `type` (ficha\|checklist\|documento) + `status` (draft\|published\|archived), migration `0048`                                                                                                                                                                                                                                                                                                                                                              |
| `/documents` · `/documents/{id}` · `/documents/{id}/versions` · `/documents/{id}/move` · `/documents/{id}/download`                                            | GET (`?folderId=`/`?search=`/`?docType=`/`?validity=`/`?relatedEntityType=`+`?relatedEntityId=`; versão corrente + KPIs + árvore de pastas + breadcrumb), POST (multipart; `201`) · GET, PUT (só a versão vigente; versão antiga → `409 DOCUMENT_VERSION_READ_ONLY`), DELETE (`204`; remove TODAS as versões do grupo) · GET (histórico: mais nova primeiro, `isCurrent` em exatamente uma) + POST (nova versão = vigente+1, herda metadados da vigente, multipart; corrida → `409 DUPLICATE`; `201`) · POST (mover entre pastas; pasta cross-tenant → `422 FK_NOT_FOUND`) · GET (URL assinada de download, TTL 60s; `{url, expiresInSeconds}`) |
| `/folders` · `/folders/{id}`                                                                                                                                   | GET (`?parentId=`; filhas diretas + breadcrumb), POST (`201`) · PUT (renomear; irmã duplicada → `409 DUPLICATE`; pai inválido → `422 FK_NOT_FOUND`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

- **Filtros (query)**: list de cada recurso aceita `search`, `page`, `pageSize` + os filtros do
  recurso (`companyId`, `workUnitId`, `status`, `type`). Body de create/update = o mesmo `*Input`
  das actions. **`/categories`** filtra por `search` + `type` (`epi`|`machine`); **PUT exige corpo
  completo `CategoryInput`** (espelho de companies, sem `.partial()`); **não há `/dependents`**.
- **`/risk-methodology`** é um **singleton por organização** (issue #76): `GET` devolve a metodologia
  ativa **ou** o padrão derivado (`configured:false`) quando nenhuma foi salva; `PUT` faz **upsert** do
  corpo completo `RiskMethodologyInput` (gradações 1–5 + faixas que particionam 1–25). Sem `list`,
  `{id}` nem `dependents`.
- **`/ges/{id}/risk-suggestions`** (sugestão de riscos por IA): `POST` monta o contexto **não-PII** do
  GES (processo, ambiente, títulos de função) e consulta o LLM via OpenRouter (chave só no servidor),
  devolvendo uma lista de riscos sugeridos (`{ suggestions: [{ agentType, hazard?, description, sources? }] }`)
  — **nada é persistido**. GES de outra org → `422 FK_NOT_FOUND`; cota mensal do plano free estourada →
  `402 QUOTA_EXCEEDED`; falha/timeout do LLM → `502 AI_UNAVAILABLE` (nunca bloqueia o cadastro). `POST
/accept` recebe os riscos selecionados/revisados e os grava como **rascunho** em `risks` (reusa a regra
  de `createRisk`), `201` com `{ created }`.
- **`/risks/{id}/control-measure-suggestions`** (medidas de controle por IA): `POST` monta o contexto
  **não-PII** do risco (o risco, o ambiente do GES, títulos de função, classificação vigente e os
  níveis já cadastrados) e devolve `{ suggestions: [{ controlLevel, actionWhat, actionHow, monitoring?,
justification? }] }`, ordenadas pela hierarquia da NR-01 — **nada é persistido**. No máximo **uma
  medida por nível** (`uq_control_measures_org_risk_level`), e os níveis que o risco já tem são
  descartados antes de responder. A resposta traz `requiresResponsibleAndDeadline`: risco
  **moderado ou superior** exige `actionResponsible` + `actionDeadline` em cada medida
  aplicável (regra da issue #42) — a IA não os preenche (são compromisso de pessoa), então
  o aceite tem de trazê-los ou o servidor recusa com `422 VALIDATION`.
  `POST /accept` grava as aceitas reusando `createControlMeasure`
  (que aplica a regra de status pela classificação e espelha no Plano de Ação), `201` com `{ created }`.
  Risco de outra org → `422 FK_NOT_FOUND`; cota → `402`; falha do LLM → `502 AI_UNAVAILABLE`.
- **`/job-roles/{id}/training-suggestions`** (treinamentos obrigatórios por IA): `POST` envia cargo,
  GES, riscos da exposição e o **catálogo da organização**, e devolve `{ suggestions: [{ name,
referenceNorm?, periodicity, workloadHours, rationale?, trainingId, alreadyRequired }] }`. O catálogo
  entra no prompt para reconciliar nomes: `trainingId` vem preenchido quando o curso já existe
  (comparação por tokens, então "Trabalho em Altura" casa com "NR-35 — Trabalho em Altura") e `null`
  quando o aceite terá de criá-lo. `POST /accept` **cria no catálogo o que faltar** e vincula,
  `201` com `{ linked, createdInCatalog }`; o vínculo é idempotente.
- **`/service-orders/{id}/instruction-suggestions`** (instruções de segurança da OS, NR-01 1.4.1):
  `POST` envia função, GES, unidade, riscos e EPIs da atividade e devolve `{ suggestions: [{
description }] }` na voz imperativa, sem repetir os itens que a OS já tem. **Não há `/accept` de
  propósito**: a coleção de itens é substituída em bloco por `PUT /service-orders/{id}`, que guarda as
  regras de OS assinada (imutável) e estado terminal — um caminho de escrita próprio duplicaria essas
  guardas. O trabalhador designado entra apenas pelo **título da função**: nome, CPF e matrícula nunca
  saem do servidor.
- **`/epi-deliveries`** (fatia 012): list filtra por `employeeId` + `search` (nome do funcionário).
  Create: `{ employeeId, deliveryDate, items: [{ stockId, quantity }] }` → `201` com a baixa
  aplicada por item; qualquer item sem saldo → `422 INSUFFICIENT_STOCK` com **rollback total**.
  `DELETE` de entrega assinada → `403 FORBIDDEN` (não estorna saldo). `POST /{id}/sign` (body `{}`)
  transiciona `pending → signed_manual`; repetida → `409 ALREADY_SIGNED`. Sem `PUT`: entregas são
  imutáveis após a criação (é o que torna o `updated_at` da assinatura um timestamp legal).
  `POST /{id}/return` (body `{ itemId }`) devolve UM item: seta `returned_at` (one-shot; repetida →
  `409 ALREADY_RETURNED`) e repõe o saldo via movimento `employee_return`; independe do status de
  assinatura.
- **`/employees/{id}/epi-record`** (fatia 012): ficha de EPI do funcionário, **read-only** (GET).
  Query `?status=pendente|devolvido|todos&from=&to=&page=&pageSize=` — `status` mapeia para
  `returned_at` (`pendente` ⇒ NULL, `devolvido` ⇒ NOT NULL); período filtra `delivery_date`.
  Funcionário cross-tenant → `404 NOT_FOUND`; sem entregas → `{ rows: [], total: 0 }`.
- **Treinamentos (fatia 017; redesign fatia 045 — migration `0044_training_catalog_fields`)**: **`/training-catalog`** — os 5 campos ePGR + código sequencial `number` (`TR-0201`, server-side, `UNIQUE(org,number)`, backfill), `is_active` (Vigente/Inativo) e filtro `?norm=`; "Validade" da lista é derivada da periodicidade (12/24/36/60 meses; Única). Demais 5 campos ePGR
  (`name`, `referenceNorm?`, `workloadHours` inteiro > 0, `periodicity` enum
  `annual|biennial|triennial|quinquennial|single`, `description?`); nome duplicado no escritório →
  `409 DUPLICATE`; exclusão de item com realizações/vínculos → `409 IN_USE` (cheque `/dependents`
  antes). **`/training-records`** — `{ employeeId, trainingId, completedAt, certificatePath? }`;
  `valid_until` é **calculado no servidor** pela periodicidade do catálogo (`single` → `null`) e
  nunca vem do cliente; `completedAt` futuro → `422 VALIDATION`; funcionário/treinamento de outro
  tenant → `422 FK_NOT_FOUND`. **`/job-role-required-trainings`** — `{ jobRoleId, trainingId }`;
  POST repetido devolve o vínculo existente (idempotente). Leituras de vencimento/conformidade
  (US3/US4) são consultas de Server Component, sem endpoint próprio nesta fase.
- **Planos de inspeção (fatia 036; redesign fatia 043 — migration `0042_inspection_plan_fields`)**:
  **`/inspection-plans`** — checklist reutilizável das inspeções. Redesign acrescenta **código
  sequencial por tenant** (`number` → exibido `PI-0014`, server-side, `UNIQUE(org,number)`, backfill),
  **status** `active|draft|inactive` (Ativo/Rascunho/Inativo, default `active`) e **frequência**
  recomendada (reusa o enum `inspection_frequency`, agora com `biweekly`/Quinzenal). "Categoria" reusa
  o campo `subtype` (texto livre). `GET` aceita `?search=` (título), `?type=`, `?status=` e `?category=`
  (subtype exato); `itemCount` derivado por subconsulta. `POST`/`PUT` corpo
  `{ type, subtype?, title, description?, frequency?, status?, items[] }`.
- **Veículos — frota (fatia 034; redesign fatia 042 — migration `0041_vehicles_company_inspection`)**:
  **`/vehicles`** — CRUD da frota. `POST`/`PUT`
  `{ plate*, renavam?, brand?, model?, type?, year?, color?, owner?, companyId?, workUnitId?, inspectionPlanId?, inspectionFrequency?, initialKm?, photoPath?, notes? }`.
  Novos campos do redesign: `company_id`/`work_unit_id`/`inspection_plan_id` (FKs, `ON DELETE SET NULL` — cross-tenant → `422 FK_NOT_FOUND`), `renavam`, `year` (CHECK 1900–2100) e `inspection_frequency`
  (`daily|weekly|monthly|quarterly|semiannual|annual`). **`GET /vehicles`** aceita `?search=` (placa/modelo/marca) e `?companyId=`.
  A lista **deriva** `companyName` (via `company_id`), **Últ. Inspeção** (`MAX(inspected_at)` das inspeções
  veiculares `completed`) e o **Status** Regular/A vencer/Vencida (`classifyDocumentValidity` sobre
  `última + intervalo da frequência`; sem inspeção → "Sem inspeção") — nenhuma coluna de status persistida.
  **Foto do veículo:** `POST /vehicles/photo` recebe multipart com `file` (PNG/JPG, até 5 MB) e devolve `{ path, url }`; o formulário envia `path` como `photoPath` no CRUD. `GET /vehicles/{id}/photo` devolve a URL assinada (1h) após consultar o veículo no tenant ativo. Campo `photoPath` vazio limpa o vínculo (`NULL`) ao salvar. O binário usa o bucket privado `documents`, path `<org_id>/vehicles/<uuid>/foto.<png|jpg>`; upload/troca/remoção do vínculo seguem o padrão do catálogo de EPI, sem apagar os objetos antigos do Storage. Foto de outro tenant/caminho inválido → `422 VALIDATION`.
- **Inspeções veiculares (fatia 037)**: **`/vehicular-inspections`** — fluxo em **2 passos**. Passo 1 (`POST`): cabeçalho `{ vehicleId, planId, inspectedAt, responsible?, driverName?, driverLicense?, currentKm?, route?, notes? }` cria a inspeção `type=vehicular` em `in_progress` (`201`). `vehicleId`/`planId` devem ser do tenant e o plano ser **veicular** — senão `422 FK_NOT_FOUND`. Passo 2 (`PUT /{id}/checklist`): `{ responses: [{ planItemId, value: true|false|null, observation? }] }` **substitui** as respostas e conclui (`status=completed`); respostas de `planItemId` fora do plano são ignoradas. `GET /{id}` devolve `{ inspection, vehicle, plan, items }` (itens do plano + resposta atual). Plano imutável do lado do item — só o plano edita seus itens (fatia 036).
- **Inspeções de equipamentos (fatia 038)**: **`/equipment-inspections`** — mesmo fluxo em 2 passos da veicular, mas o cabeçalho referencia um **equipamento do catálogo** (`epi_catalog` tipo `machine`) + um **plano de equipamento**. `POST`: `{ equipmentCatalogId, planId, inspectedAt, responsible?, notes? }`. Equipamento não-`machine`/cross-tenant ou plano não-`equipment` → `422 FK_NOT_FOUND`. Checklist (`PUT /{id}/checklist`) reusa o contrato tri-state da veicular. `GET /{id}` = `{ inspection, equipment, plan, items }`.
- **Inspeções de segurança (fatia 039)**: **`/safety-inspections`** — inspeção **livre** (sem plano/checklist). `POST`: `{ category, inspectedAt, planned?, area?, companyId?, responsible?, notes? }` cria `type=safety` em `in_progress`. `companyId` opcional; se informado, deve ser do tenant → senão `422 FK_NOT_FOUND`. `PUT /{id}/occurrences`: `{ occurrences: [{ description, severity: low|medium|high|null }] }` **substitui** as ocorrências e conclui (`completed`). `GET /{id}` = `{ inspection, company, occurrences }`. **Assinatura digital** reusa a infra de assinaturas (fatia 010) com `target_type: "inspection"` — via a Server Action `requestInspectionSignatureAction` (mesma superfície das assinaturas: sem espelho REST de criação; a rota pública `/sign/{token}` é a superfície testável).
- **Permissões de trabalho (fatia 040)**: **`/work-permits`** — PT autorizando trabalho de risco (NR-33/35/10/18). Body `{ number, type (hot_work|confined_space|height|electrical|excavation|cold_work|other), status?, companyId?, area?, description, validFrom, validUntil, requestedBy?, approvedBy?, precautions?, notes? }`. `number` **único por org** → `409 DUPLICATE`; `validUntil >= validFrom` (Zod + CHECK no banco) → `422`; empresa opcional cross-tenant → `422 FK_NOT_FOUND`. **Migration `0020_work_permits`** (1 tabela + 2 enums, isolada por tenant). Módulo independente da cadeia de inspeções.
- **Controle de formulário — ISO (fatia 042, issue #88)**: **`/form-controls`** — metadados de cabeçalho estilo ISO (Tipo de Formulário, Empresa, Código FRM, REV, Data, N.C., GES/Setor, Posicionamento) injetados nos documentos gerados (PGR, OS, fichas, inspeções); a injeção em si é fronteira de outra fatia (cliente/template Gotenberg). Body `{ formType, companyId?, frmCode, revision, issueDate (AAAA-MM-DD), nonConformityNumber?, gesId?, position (top|bottom|both), type (ficha|checklist|documento), status (draft|published|archived), notes? }`. `frmCode` **único por org** → `409 DUPLICATE` (mesmo código aceito em orgs distintas); `companyId`/`gesId` opcionais, cross-tenant → `422 FK_NOT_FOUND`. **Migration `0027_form_controls`** (1 tabela + 1 enum, isolada por tenant). **Redesign (migration `0048_form_control_type_status`)**: adiciona `type` (categoria) e `status` (situação real — substitui o "Ativo" fixo da lista) + 2 enums; filtros `?status=`/`?type=`; **o pipeline ISO/Gotenberg é preservado** (usa `frm_code`/`revision`/`position` — os novos campos são só metadados de catálogo). UI com preview em tempo real do cabeçalho + filtro de situação.
- **Documentos (GED) — fatia 024, issue #34**: **`/documents`** — acervo de documentos com versionamento (schema/RLS da fatia 023, zero migration nesta fatia). Um "documento lógico" (`document_group_id`) agrupa N versões físicas; a listagem/KPIs sempre mostram a **versão corrente** (`MAX(version)` do grupo). `POST` é **multipart** (`file` + `name`, `docType`, `validUntil?`, `folderId?`, `relatedEntityType?`, `relatedEntityId?`) — tipo/tamanho validados **antes** do upload (PDF/PNG/JPG/DOC/DOCX/XLS/XLSX, máx. 25 MB) via `validateFile`; vínculo polimórfico é completo-ou-vazio (CHECK do banco). Upload no Storage (bucket privado `documents`, path `<org_id>/documentos/<group_id>/v<version>-<slug>`) acontece **antes** do INSERT; falha do INSERT compensa removendo o objeto órfão. `POST /documents/{id}/versions` publica nova versão (vigente+1 no grupo, herda metadados **da versão vigente**, histórico preservado); corrida na mesma versão → `409 DUPLICATE` (UNIQUE do banco, ou objeto já existente no Storage quando o nome do arquivo coincide). **Histórico (#56)**: `GET /documents/{id}/versions` lista todas as versões do documento lógico (qualquer versão do grupo serve de entrada), mais nova primeiro, com `isCurrent` em exatamente uma; versão antiga é **somente leitura** — `PUT /documents/{idAntigo}` → `409 DOCUMENT_VERSION_READ_ONLY`, nada gravado. A regra de vigência (hoje a maior versão; com aprovação #54, a maior aprovada) vive só em `db/repositories/document-versions.ts`. `POST /documents/{id}/move` move **todas as versões** do grupo entre pastas; pasta cross-tenant → `422 FK_NOT_FOUND`. `DELETE` remove o documento lógico inteiro (todas as versões, uma transação); os objetos do Storage são removidos **pós-commit**, best-effort — falha de Storage é logada e **não reverte** a exclusão. O par `?relatedEntityType=`+`?relatedEntityId=` filtra o acervo pelo **vínculo polimórfico** (ex.: `?relatedEntityType=pgr&relatedEntityId=<uuid>` devolve só os anexos daquele PGR) — é o que alimenta a etapa "Documentos e PDF" da tela `/pgr/{id}`. Validade (`validUntil`) é **derivada na leitura** (`ok`/`due_soon`/`expired`/`no_expiry`, janela fixa de 30 dias — mesmo padrão de `classifyTrainingStatus`/`classifyDocumentValidity`), nunca coluna de status. **`/folders`** — hierarquia de pastas (`GET ?parentId=` filhas diretas + breadcrumb raiz→atual); nome duplicado entre irmãs (incl. raiz, `NULLS NOT DISTINCT`) → `409 DUPLICATE`; pai inválido/cross-tenant → `422 FK_NOT_FOUND`; renome de pasta de outro escritório → `404`.
- **Download de documento — URL assinada (fatia 024, issue #35)**: **`GET /documents/{id}/download`** — devolve `{ url, expiresInSeconds }` (mesmo padrão de `POST /pgr/{id}/signature`/`POST /service-orders/{id}/signature`: JSON com a URL, nunca `302`, o cliente decide o que fazer — abrir aba, `<a download>`, etc). O tenant é resolvido via `getDocumentById` (mesmo caminho do `GET /documents/{id}`) **antes** de assinar; `storage_path` nunca vem do cliente — documento de outro escritório → `404` (nunca revela o path nem chega a assinar). URL expira em **60s** (`SIGNED_DOWNLOAD_URL_TTL_SECONDS`, `createSignedUrl` do Supabase Storage com `download` = nome de exibição do documento + extensão real do arquivo). Bucket `documents` permanece privado (sem acesso público permanente).
- **Fatores de risco psicossocial (catálogo; redesign fatia 046 — migration `0045_psychosocial_risk_factors`)**: **`/psychosocial-risk-factors`** — catálogo **standalone** de fatores mapeados por GES (NR-01), **distinto** das campanhas (que não foram alteradas). Campos: fator (nome), `gesId` (FK ao GES do tenant; cross-tenant → `422 FK_NOT_FOUND`), `level` (`low`/`medium`/`high` → Baixo/Médio/Alto), `assessmentMethod` (texto livre — Questionário COPSOQ/Escuta ativa/Entrevista), `status` (`in_action`/`monitored`/`controlled` → Em ação/Monitorado/Controlado; default `monitored`), descrição. Código sequencial `number` gerado no servidor (`PS-07`, `UNIQUE(org,number)`, sob lock de `orgs`); nome do GES **derivado por JOIN** na leitura. Filtros `?search=` (fator) e `?level=`. Sem FK de entrada → exclusão direta.
- **Riscos psicossociais (Fase 09)**: **`/psychosocial-campaigns`** — campanha de mapeamento (NR-01/GRO). CRUD da campanha + **sub-entidade `questions`** (add/update/remove/reorder, sempre escopada ao `campaign_id`). `POST` body `{ name, companyId, workUnitId, startsAt?, endsAt?, themeColor?, coverPath?, workerDescription? }`; empresa/obra cross-tenant → `422 FK_NOT_FOUND`; ativar sem perguntas → `422 VALIDATION`. `/{id}/status` transiciona (`draft→active→closed`, `archived` terminal). Dashboard: `/{id}/stats` (média Likert + participação). Riscos: `POST /{id}/risks` **deriva** (upsert idempotente); `POST /{id}/risks/{rid}/register` cria risco no inventário/PGR (agente `psychosocial`) no GES informado. **Rota pública anônima** `/psychosocial-response/{campaignId}/{token}` (fora de `/api/v1`, sem sessão): resolve a campanha pela **policy de capability** do token; respostas gravadas sem vínculo nominal; campanha fechada/fora do período → mensagem amigável. **Migration `0021_psychosocial`** (5 tabelas + 2 enums, tenant-isoladas).
- **eSocial SST (Fase 10)**: **`/esocial-events`** — eventos S-2190..S-2300. `POST` `{ type, input, referenceId? }` valida o `input` pelo schema do tipo (builder), monta o **XML** (`ambientePadrao="Producao"` fixo) e persiste com status `pending`. Geração a partir de fontes existentes via Server Action (`generateS2200FromEmployee`, `generateS2240FromRisk` — usa código do agente nocivo + unidade do inventário de riscos); origem cross-tenant → `422 FK_NOT_FOUND`. **`/esocial-batches`**: `POST { eventIds }` agrupa os `pending` do tenant num lote (protocolo persistido) e marca `sent` (ids não-pending/cross-tenant são ignorados); `POST /{id}/return` consulta o retorno (**simulado** — sem transmissão externa real) e atualiza cada evento (`accepted`). UI `/esocial` (lista+filtros+seleção múltipla+lote) e `/esocial/detalhe/{id}`. **Migration `0022_esocial`** (2 tabelas + 3 enums; `reference_id` polimórfico; payload XML como texto).
- **eSocial — Configuração (redesign; migration `0047_esocial_config`)**: **`/esocial-config`** — tabela `esocial_config` **singleton por tenant** (`UNIQUE(org_id)`, upsert) com os parâmetros de transmissão: ambiente (Produção/Homologação), CNPJ empregador, classificação tributária, certificado (nome + validade **informativos** — sem upload do `.pfx` nem credencial de transmissão), eventos SST habilitados (`enabled_events text[]`), envio automático e frequência de verificação. **Fatia de persistência de configuração apenas**: `auto_send`/`check_frequency_hours` registram a **preferência** do usuário; nenhum worker/scheduler é acionado e nenhuma integração externa é simulada como funcional. A tela `/esocial/config` mostra ainda contagens **reais** de eventos (pendentes/enviados/total) derivadas de `esocial_events`. Enum novo `esocial_environment`.
- **eSocial — Painel (#218) e Eventos (#217) (redesign; ZERO migration)**: **`/esocial-dashboard`** entrega o painel agregado — KPIs por _bucket_ de status (`pending`=draft+pending · `transmitted`=sent+accepted · `failed`=rejected+error, partição completa dos 6 status), **conformidade** = aceitos ÷ (aceitos+rejeitados+erro) arredondado, **`null`** quando nenhum evento teve veredito (sem divisão por zero; a UI mostra "—"), contagem **por tipo** (catálogo real do enum, sem inventar S-2245) e **6 eventos recentes**. A listagem **`/esocial-events`** ganha as colunas do mockup: `description` (derivada do tipo, fonte única em `EVENT_TYPE_DESCRIPTIONS`), `employeeName`, `sentAt` e `protocolNumber`. `sentAt`/`protocolNumber` vêm de **LEFT JOIN** em `esocial_batches` (relação **many-to-one** → não duplica a linha do evento); `employeeName` vem de LEFT JOIN em `employees` **escopado ao tenant** e só é exposto quando o tipo de evento de fato referencia um funcionário — `reference_id` é **polimórfico**: em **S-2240 aponta para um risco**, então a coluna fica vazia em vez de exibir dado inventado. "Transmitir Lote" reusa a capacidade real já existente (`sendBatch`: agrupa `pending`, gera protocolo e marca `sent`) — **sem worker/scheduler e sem simular transmissão externa**.
- **Fase 06 — Ordens de Serviço (fatia 023; redesign fatia 040 — migration `0039_service_order_type`)**:
  **`/service-orders`** — OS de SST com itens. `POST`
  `{ title, osType?, openedAt (AAAA-MM-DD), assignedEmployeeId?, workUnitId?, dueDate?, items?: [{ description, done? }] }`;
  `osType` reusa o enum **`exam_type`** (`admissional|periodic|change_of_function|return_to_work|dismissal`)
  para o "Tipo de OS" do mockup; `workUnitId` é a unidade/obra (FK `work_units`, `ON DELETE SET NULL`).
  `status` inicial é sempre `open` (não configurável); o **número** é gerado no servidor (`FOR UPDATE` na
  linha do tenant + `max+1`, `UNIQUE(org,number)` backstop) e OS+itens gravam na **mesma transação**.
  `assignedEmployeeId`/`workUnitId` cross-tenant → `422 FK_NOT_FOUND`; OS cross-tenant → `404`.
  **`GET /service-orders`** aceita `?search=` (nome do funcionário, empresa/razão social, título ou nº exato),
  `?status=` (workflow) e **`?signed=true|false`** (abas "OS Assinadas"/"OS Abertas" — assinatura concluída).
  A lista deriva `companyName` (funcionário → empresa) e `signatureState`
  (`none|pending|signed|…` da última solicitação, exibido como Pendente/Enviada/Assinada), sem colunas novas
  para isso. `PUT /{id}` (corpo completo `{ title, osType?, workUnitId?, openedAt, status, items, … }`)
  bloqueia edição de itens se a OS estiver assinada
  (imutável); `DELETE` só se **não** assinada e status ∈ {open, in_progress}, senão erro de estado. `PUT
/{id}/status` transiciona (terminal não volta). **Assinatura**: `POST /{id}/signature` monta o payload
  público **no servidor** e delega a `createSignatureRequestCore` (cota de assinatura compartilhada →
  `402 QUOTA_EXCEEDED`), devolvendo `{ signature, requestId, publicUrl, qrCodeDataUrl }` (`publicUrl`/token
  **só** na criação); exige **funcionário atribuído** (senão `422 VALIDATION` — sem `employeeName`/
  `companyName` no payload). `GET /{id}/signature` devolve o estado derivado
  (`none|pending|signed|expired|cancelled`), **nunca** token/URL. Só office staff; `client` → `403`.
  **Zero** upload/base64 aqui.
- **Fase 06 — Incidentes/Acidentes (fatia 023; redesign fatia 041 — migration
  `0040_accidents_number_severity`)**: **`/incidents`** (tabela canônica `accidents`, rótulo de
  UI "Incidentes/Acidentes") — registro com enums fechados (`type`, `category`, `severity`) e campos CAT
  **textuais opcionais** (registro **interno**; **sem** S-2210/`esocial_events`). Cada incidente tem um
  **número sequencial por tenant** (`number`, `max+1` sob lock da linha de `orgs`, `UNIQUE(org_id,number)`),
  exibido como `INC-0001`; `number` é **server-side** (nunca aceito do cliente). `severity` ganhou o nível
  **`no_injury`** ("Sem lesão") para quase-acidentes. Dado de saúde é **P0**: só office staff (`client` →
  `403 FORBIDDEN`), nunca em log/audit/erro. **`GET /incidents`** aceita `?search=` (busca **apenas** em
  campos não-sensíveis: número do incidente, `location`, `responsible_area`, `cat_number` — **nunca** por
  nome de funcionário/PII, por privacidade) e os filtros `?status`, `?type`, `?category`, `?severity`,
  `?company_id`, `?employee_id`, `?occurred_from`/`?occurred_to`. Cross-tenant → `404`. `PUT
/{id}/status` aplica a state machine (`incident-lifecycle`, fonte única); **conclusão** exige justificativa
  e é **bloqueada** enquanto houver plano de ação ativo (→ `422 VALIDATION`). Sem upload de fotos (a aba
  "Fotos" da UI é placeholder).
- **Fase 06 — Planos de Ação 5W2H (fatia 023; redesign fatia 044 — migration `0042_action_plan_type`)**:
  **`/action-plans`** — central multiorigem. `POST`
  `{ originType: risk|incident, originId, type?, what, why, who, where, how, when?, howMuch?, priority? }`;
  `type` é o enum novo **`action_plan_type`** (`corrective|preventive` — Corretiva/Preventiva).
  `origin_type` é **TEXT** validado na app (V1 só `risk|incident`; `inspection`/`non_conformity` **não**
  são aceitos). Origem inválida/inexistente/cross-tenant → `422 FK_NOT_FOUND`; plano cross-tenant → `404`.
  A lista **deriva Empresa** da origem (risco→GES→empresa; incidente→empresa) — sem coluna própria — e
  expõe **KPIs** derivados (planejados/em andamento/concluídos + a vencer em ≤30d) via ação dedicada.
  **`GET`** aceita `?status`, **`?type`**, `?priority`, `?origin_type`, `?origin_id`, `?overdue`,
  `?when_from`/`?when_to`, `?search`.
  O **primeiro** plano ativo de um incidente avança `awaiting_planning → awaiting_completion` (acoplamento
  unidirecional, mesma transação). `overdue` é **derivado** (prazo vencido + não terminal). `DELETE` físico
  só em `planned`; iniciado/finalizado → `409 IN_USE` (usar cancelamento). Filtros: `status`, `origin_type`,
  `origin_id`, `overdue`, `page`.
- **Fase 06 — Auditorias de Risco / Kanban + IA (fatia 023)**: **`/risk-audits`** — análise por origem em
  kanban de 3 estados. `POST` `{ originType: risk|incident, originId }`; origem inválida/cross-tenant →
  `422 FK_NOT_FOUND`; **uma auditoria ativa por origem** (UNIQUE parcial `WHERE status <> 'completed'` como
  backstop) → segunda ativa devolve `409 IN_USE`. `PUT /{id}/status` faz a transição **explícita**
  (`awaiting_analysis → planning_actions → completed`; sem reabrir/pular; conclusão exige justificativa;
  transição inválida → `422 VALIDATION`); `started_at`/`completed_at` são preenchidos no servidor.
  `GET /{id}` inclui os planos vinculados **à origem** (não à auditoria — sem `risk_audit_id`). `POST
/{id}/suggest-action-plan` sugere um plano 5W2H por IA: input **sanitizado** por allowlist não-PII
  (nunca nome/CPF/hospital/lesão/testemunhas/CAT), saída 5W2H validada por Zod, uso registrado em
  `ai_usage_events` (`kind = action_plan_suggestion`, coluna TEXT → **zero migration**); cota `free` 20/mês
  (`pro` ilimitado) → `402 QUOTA_EXCEEDED`; falha/timeout do LLM → `502 AI_UNAVAILABLE` (**degradação
  graciosa** — nunca persiste plano nem bloqueia o CRUD; a sugestão só **preenche** o formulário, que é
  confirmado pelo fluxo normal de `action-plans`).
- **Assinatura pública da OS**: reusa a **página** (não-REST) `/signature-requests/{token}` (fatia 022) —
  ver a seção dedicada abaixo. **Não** há endpoint REST público de assinatura, nem rota `/assinar/{token}`.
- **Respostas**: recurso no corpo (`200`), `201` no create, `204` no delete. Erros:
  `{ error: { code, message, fields? } }` com HTTP `422 VALIDATION` · `409 DUPLICATE` ·
  `409 IN_USE` · `422 FK_NOT_FOUND` · `404 NOT_FOUND` · `403 FORBIDDEN`/`NO_TENANT_CONTEXT` ·
  `401 UNAUTHORIZED` · `402 QUOTA_EXCEEDED` · `502 AI_UNAVAILABLE`.

### Autenticação da REST API (2 modos) e os 3 ambientes

| Modo                  | Quando                                                      | Como                                                                                         | Tenant/papel                                   |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Auth real (Clerk)** | qualquer ambiente, **default**; **obrigatório em produção** | cookie `__session` (ou `Authorization: Bearer <session token>`) + cookie `tenant_active_org` | resolvidos por `requireOfficeStaff()` (sessão) |
| **Bypass DEV**        | só local/homolog, opt-in                                    | headers `x-dev-tenant`, `x-dev-role` (`owner\|collaborator\|client`), `x-dev-user`           | injetados; **não** toca no Clerk               |

O bypass é ligado por **env** e tem **kill-switch duro em produção**:

```bash
# local / homolog (.env.local)
APP_ENV=local              # ou: homolog
DEV_API_AUTH_BYPASS=true   # libera /api/v1 sem token Clerk
DEV_TENANT_ID=<orgId>      # tenant injetado (pode vir do header x-dev-tenant)
DEV_ROLE=owner

# produção
APP_ENV=production         # DEV_API_AUTH_BYPASS é IGNORADO; /api/v1 exige sessão Clerk

# APP_ENV ausente ou vazio  # DEV_API_AUTH_BYPASS também é IGNORADO (falha fechada)
```

- O predicado é único (`src/shared/api/dev-bypass.ts`, usado pelo `proxy.ts` e pelo
  `restHandler`): liga só com `APP_ENV` **definido e não vazio**, diferente de `production`
  (sem diferenciar maiúsculas, ignorando espaços), **e** `DEV_API_AUTH_BYPASS=true` exato.
- Em produção, ou com `APP_ENV` ausente/vazio, `isDevAuthBypassEnabled()` é sempre `false`,
  e o middleware (`proxy.ts`) **não** torna `/api/v1` público — Clerk protege normalmente.
- Em local/homolog com a flag, o middleware libera `/api/v1` e o handler resolve o contexto pelos
  headers `x-dev-*` (ou envs `DEV_*`). Permite testar isolamento trocando `x-dev-tenant` e o gate
  de papel com `x-dev-role: client` (→ `403`).
- **Auth real** (`/api/me` e o caminho default) usa a **org ativa do Clerk** via `requireOrgContext`
  para `/api/me`, enquanto `/api/v1` usa o **tenant interno** (Modelo B) via `requireOfficeStaff`.

## Sumário das actions/endpoints existentes

| Domínio                      | Arquivo                                      | Superfície                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST API (Route Handlers)    | `app/api/v1/**`                              | CRUD HTTP de companies/work-units/job-roles/ges(+vínculos)/employees                                                                                                                                                                                                                                                                                                                   |
| Auth (Route Handler)         | `app/api/me/route.ts`                        | `GET /api/me`                                                                                                                                                                                                                                                                                                                                                                          |
| Webhook (Route Handler)      | `app/api/webhooks/clerk/route.ts`            | `POST /api/webhooks/clerk` (provisiona tenant/sync)                                                                                                                                                                                                                                                                                                                                    |
| Sessão / Identidade          | `actions/me.ts`                              | `meAction` (Server Action)                                                                                                                                                                                                                                                                                                                                                             |
| Empresa                      | `actions/pgr/companies.ts`                   | list, options, get, create, update, delete, dependents                                                                                                                                                                                                                                                                                                                                 |
| Serviços por empresa         | `actions/platform/company-modules.ts`        | getCompanyModuleOverviewAction, changeCompanyModuleAction; REST GET/PUT modules                                                                                                                                                                                                                                                                                                        |
| Riscos para Medicina         | `actions/medicine/risk-sources.ts`           | getMedicalRiskInventoryAction, registerMedicalRiskSourceAction; REST GET/POST medical-risk-sources                                                                                                                                                                                                                                                                                     |
| Medicina — exames (NOB-147)  | `actions/medicine/exam-proposal.ts`          | searchProceduresAction, getProcedureAction, getExamProposalAction + REST `GET /api/v1/medicine/procedures(/{code})` · `GET /api/v1/companies/{id}/exam-proposal` (core `server/medicine/exam-proposal-core.ts`; só leitura, sem migration)                                                                                                                                             |
| Medicina — Lista C (NOB-113) | `actions/medicine/ntep.ts`                   | lookupNtepAction, getCompanyNtepAction + REST `GET /api/v1/medicine/ntep` · `GET /api/v1/companies/{id}/ntep` (core `server/medicine/ntep-core.ts`; só leitura, sem migration)                                                                                                                                                                                                         |
| Medicina — PCMSO (NOB-148)   | `actions/medicine/pcmso-readiness.ts`        | getPcmsoReadinessAction + REST `GET /api/v1/companies/{id}/pcmso-readiness` (core `server/medicine/pcmso-readiness-core.ts`; só leitura, sem migration)                                                                                                                                                                                                                                |
| Agenda (plataforma)          | `actions/platform/scheduling.ts`             | list, get, create, update, delete + REST `/api/v1/schedule-events/**` (CRUD de agendamentos; migration `0023_schedule_events`; filtros tipo/período)                                                                                                                                                                                                                                   |
| Ve�culos (inspe��es)         | `actions/inspections/vehicles.ts`            | list, get, create, update, delete, uploadVehiclePhotoAction, getVehiclePhotoUrlAction + REST `/api/v1/vehicles/**` (frota; base das inspe��es veiculares; modelo na fatia 034)                                                                                                                                                                                                         |
| Unidade de Obra              | `actions/pgr/work-units.ts`                  | list, get, create, update, delete, dependents                                                                                                                                                                                                                                                                                                                                          |
| Função (Cargo)               | `actions/pgr/job-roles.ts`                   | list, get, create, update, delete, dependents                                                                                                                                                                                                                                                                                                                                          |
| GES + vínculos               | `actions/pgr/ges.ts`                         | list, get, create, update, delete, dependents + gestão de `ges_job_roles`                                                                                                                                                                                                                                                                                                              |
| Funcionário                  | `actions/pgr/employees.ts`                   | list, get, create, update, delete + picker de função                                                                                                                                                                                                                                                                                                                                   |
| PGR (documento)              | `actions/pgr/pgr.ts`                         | list, get, create, update, delete, publish + REST `/api/v1/pgr/**` (aceite NR-01 não persistido; escrita em PGR assinado/publicado → `409 ALREADY_SIGNED`; publicar sem assinatura → `422 VALIDATION`)                                                                                                                                                                                 |
| PGR · Revisões               | `actions/pgr/pgr-revisions.ts`               | list, create (número **server-side**, `.strict()`), archive (#46, `null → archived_at`, idempotente) + REST `/api/v1/pgr/{id}/revisions` (GET, POST 201; `revisionNumber` no body → 422) · `/api/v1/pgr/{id}/revisions/{revisionId}/archive` (PUT 200)                                                                                                                                 |
| PGR · GES (escopo)           | `actions/pgr/pgr-ges.ts`                     | list, add, remove + REST `/api/v1/pgr/{id}/ges` · `/{gesId}` (GET, POST 201, DELETE 204)                                                                                                                                                                                                                                                                                               |
| PGR · Consolidada            | `actions/pgr/pgr-consolidated.ts`            | get (read-only; GES→riscos→avaliação→5W2H + status→EPIs; S-2240; `planCoverage` por risco) + REST `GET /api/v1/pgr/{id}/consolidated`                                                                                                                                                                                                                                                  |
| PGR · Assinatura             | `actions/pgr/pgr-signature.ts`               | createPgrSignatureRequestAction, getPgrSignatureViewAction + REST `/api/v1/pgr/{id}/signature` (POST 201 payload server-side; GET estado, sem token/URL; cota compartilhada 402)                                                                                                                                                                                                       |
| PGR · PDF                    | `server/platform/pgr-pdf-core.ts`            | generatePgrPdf (reusa a consolidada; template `domains/pgr/pgr-pdf-template.ts`, cor parametrizável com default) + REST `GET /api/v1/pgr/{id}/pdf` (binário; `?color=`; 404/503)                                                                                                                                                                                                       |
| PGR · DOCX (template)        | `server/platform/pgr-docx-core.ts`           | generatePgrDocx (consolidada + `repositories/pgr-docx-extras.ts` → `domains/pgr/pgr-docx/from-consolidated.ts` → `build-data.ts` → docxtemplater; logo da empresa no cabeçalho; PDF via Gotenberg/LibreOffice ou Google Docs por Service Account) + REST `GET`/`POST /api/v1/pgr/{id}/docx` (binário; 404/422/503). Sem Server Action: download binário, mesmo precedente do `/pdf`    |
| Riscos (GES)                 | `actions/pgr/risks.ts`                       | list, get, create, update, delete + REST `/api/v1/risks/**` (regra `qualitative_na`; reuso por prefill; sem 409)                                                                                                                                                                                                                                                                       |
| Perfil (plataforma)          | `actions/platform/profile.ts`                | getProfile, updateProfile (self) + REST `/api/v1/profile` (campos app-managed; nome/e-mail/foto delegados ao Clerk)                                                                                                                                                                                                                                                                    |
| Equipe (plataforma)          | `actions/platform/team.ts`                   | listTeamMembers, inviteMember, changeMemberRole, removeMember + REST `/api/v1/team/**` (multiusuário **PRO** via Clerk Org; owner-only; protege o último owner)                                                                                                                                                                                                                        |
| Dashboard (plataforma)       | `actions/platform/dashboard.ts`              | getDashboardSummaryAction + REST `GET /api/v1/dashboard/summary` (read-model agregado por tenant; sem tabelas novas)                                                                                                                                                                                                                                                                   |
| EPI × risco (vínculo)        | `actions/pgr/epi-risk.ts`                    | list, available (busca nome/CA), add, update (neutralização), remove + REST `/api/v1/risks/{id}/epis/**`                                                                                                                                                                                                                                                                               |
| Avaliação de risco (5×5)     | `actions/pgr/risk-assessments.ts`            | list, get, getCurrent, create, update, delete + REST `/api/v1/risks/{id}/assessments` · `/risk-assessments/{id}` (histórico 1:N; snapshot de `result`; sem 409)                                                                                                                                                                                                                        |
| Avaliação ergonômica (NR-17) | `actions/pgr/ergonomic-evaluations.ts`       | list, get, getCurrent, listLinkableCampaigns, create, update, delete + REST `/api/v1/risks/{id}/ergonomic-evaluations` · `/ergonomic-evaluations/{id}` (histórico 1:N; seis dimensões opcionais; vínculo opcional com campanha psicossocial encerrada)                                                                                                                                 |
| NR-18 + relação de EPIs      | `actions/pgr/pgr-nr18.ts`                    | getPgrNr18Checklist, getPgrEpiRelation + REST `GET /api/v1/pgr/{id}/nr18-checklist` · `GET /api/v1/pgr/{id}/epi-relation` (derivados; nenhuma escrita, nenhuma tabela nova)                                                                                                                                                                                                            |
| Medidas de controle (5W2H)   | `actions/pgr/control-measures.ts`            | list, get, create, update, delete + REST `/api/v1/risks/{id}/control-measures` · `/control-measures/{id}` (1 por nível NR-01; estados derivados; **409** por UNIQUE)                                                                                                                                                                                                                   |
| Categoria                    | `actions/pgr/categories.ts`                  | list, get, create, update, delete (catálogo `epi`/`machine`)                                                                                                                                                                                                                                                                                                                           |
| Médico                       | `actions/pgr/medicos.ts`                     | list (busca nome/CRM, filtro empresa/clínica e status), options, clinics, get, create, update, delete + REST `/api/v1/medicos/**` (cadastro de médicos do trabalho; CRM único por org → `DUPLICATE`; sem `/dependents`)                                                                                                                                                                |
| Coordenador do PCMSO         | `actions/medicine/pcmso-coordinators.ts`     | list (histórico por empresa), designate, close + REST `/api/v1/companies/{id}/pcmso-coordinators` e `/api/v1/pcmso-coordinators/{id}` (MED-02/NOB-121; escrita só `owner`, policy RLS de ator; sem DELETE)                                                                                                                                                                             |
| Vínculo profissional         | `actions/medicine/professional-links.ts`     | list, invite, accept/decline/approve/cancel, revoke, perfil e convites da sessão + REST (NOB-149/NOB-157; vínculo só por aceite)                                                                                                                                                                                                                                                       |
| Identidade profissional      | `actions/medicine/professional-identity.ts`  | pedido, reconfirmação, fila, aprovação, recusa, revogação + REST (NOB-158/159/160; operador independente; acesso clínico só com verificação)                                                                                                                                                                                                                                           |
| Plano de exames              | `actions/medicine/exam-plans.ts`             | list, get, draft, decide, add, approve + REST (NOB-150; coordenadora vinculada no app e na RLS; versões; sem DELETE)                                                                                                                                                                                                                                                                   |
| PCMSO (prévias)              | `actions/medicine/pcmso-documents.ts`        | list, get, generate + REST (NOB-151; prévia composta do plano aprovado, arquivada com SHA-256; imutável)                                                                                                                                                                                                                                                                               |
| PCMSO assinado (oficial)     | `actions/medicine/pcmso-documents.ts`        | registro do PDF da prévia assinado pelo médico responsável, conferência documental, substituição com tipo de mudança (MED-14) e download + REST (NOB-166)                                                                                                                                                                                                                              |
| Critérios de interpretação   | actions/medicine/interpretation-criteria.ts  | list, history, define + REST (NOB-153; NR-7 7.5.4 c; texto do coordenador vinculado; versões só inclusão)                                                                                                                                                                                                                                                                              |
| Relatório analítico          | actions/medicine/analytical-reports.ts       | list, get, context, generate + REST (NOB-154; NR-7 7.6.2–7.6.6; coordenador vinculado; dados consolidados)                                                                                                                                                                                                                                                                             |
| Apresentação do relatório    | actions/medicine/analytical-reports.ts       | finalização pelo médico, apresentação e discussão com SST/CIPA, correção + REST (NOB-168; NR-7 7.6.5)                                                                                                                                                                                                                                                                                  |
| Exame ocupacional (ASO)      | `actions/pgr/health-exams.ts`                | list (busca funcionário ou tipo de exame, filtros tipo/funcionário/empresa), get, create, update, delete + REST `/api/v1/health-exams/**` (validade derivada na leitura; funcionário/médico cross-tenant → `FK_NOT_FOUND`; sem `/dependents`)                                                                                                                                          |
| ASO (conferência e prévias)  | `actions/medicine/aso.ts`                    | readiness, procedimentos, prévias, origem do exame e confirmação do examinador + REST (NOB-152; NR-7 7.5.19.1; sem assinatura)                                                                                                                                                                                                                                                         |
| ASO assinado (oficial)       | `actions/medicine/aso.ts`                    | registro do PDF assinado (examinador ou clínica externa), conferência da assinatura, substituição com motivo e download + REST (NOB-163; MED-01/11/12)                                                                                                                                                                                                                                 |
| Entrega do ASO               | `actions/medicine/aso.ts`                    | disponibilização (via física ou cópia digital por canal informado), comprovante, pedido de via física e correção + REST (NOB-165; MED-13; NR-7 7.5.19)                                                                                                                                                                                                                                 |
| Prontuário segregado         | actions/medicine/clinical-record.ts          | access, read, addNote, restrictions, accessEvents + REST (NOB-155; DT-21; examinador ou coordenador vinculado; leitura auditada)                                                                                                                                                                                                                                                       |
| Afastamentos                 | actions/medicine/absences.ts                 | list, get, create, end, return, cancel, área clínica + REST (NOB-139; administrativo sem CID; NR-7 7.5.9)                                                                                                                                                                                                                                                                              |
| Inexistência de riscos       | actions/medicine/risk-absence.ts             | list, declare + REST (NOB-156; DT-12; profissional autorizado; por versão da fonte)                                                                                                                                                                                                                                                                                                    |
| Medicina — painel            | `actions/medicine/overview.ts`               | getMedicineOverviewAction, listMedicineEmployeesAction + REST `GET /api/v1/medicine/overview` · `GET /api/v1/medicine/employees` (read-models; core `server/medicine/overview-core.ts`; validade informada, sem periodicidade; sem `notes`/CPF)                                                                                                                                        |
| Controle de formulário (ISO) | `actions/documents/form-controls.ts`         | list, get, create, update, delete + REST `/api/v1/form-controls/**` (código FRM único por org → `DUPLICATE`; empresa/GES opcionais)                                                                                                                                                                                                                                                    |
| Documentos (GED)             | `actions/documents/documents.ts`             | list (versão corrente + KPIs + árvore + breadcrumb), get, create (multipart), update (só a vigente; antiga → `DOCUMENT_VERSION_READ_ONLY`), addVersion (vigente+1, herda da vigente; corrida → `DUPLICATE`), versions (histórico, #56), move, delete (grupo inteiro) + REST `/api/v1/documents/**`                                                                                     |
| Documento · Download         | `actions/documents/download.ts`              | download (URL assinada, TTL 60s; tenant via `getDocumentById` antes de assinar) + REST `GET /api/v1/documents/{id}/download`                                                                                                                                                                                                                                                           |
| Planos / Billing (Stripe)    | `actions/platform/billing.ts`                | startProCheckoutAction (Checkout hospedado, `owner`-only, trial 7d), openBillingPortalAction (Portal hospedado — cartão/fatura/cancelamento, exige customer existente) — **sem REST mirror** (redirect de navegador, não é fluxo Postman-testável; webhook `/api/webhooks/stripe` sincroniza `orgs.plan`); vazio `STRIPE_SECRET_KEY` ⇒ `503 BILLING_UNAVAILABLE` gracioso, nunca crash |
| Pastas (GED)                 | `db/repositories/folders.ts`                 | createFolder, renameFolder, listFolderTree (sem Server Action própria ainda) + REST `/api/v1/folders/**` (irmã duplicada → `DUPLICATE`; pai inválido → `FK_NOT_FOUND`)                                                                                                                                                                                                                 |
| Metodologia de Risco         | `actions/pgr/risk-methodology.ts`            | get (config ou padrão), save (upsert) + `GET`/`PUT /api/v1/risk-methodology`                                                                                                                                                                                                                                                                                                           |
| Sugestão de riscos (IA)      | `actions/pgr/ai-risk-suggestion.ts`          | suggest (LLM, não persiste), accept (grava rascunhos) + REST `POST /api/v1/ges/{id}/risk-suggestions(/accept)`                                                                                                                                                                                                                                                                         |
| CAEPI (consulta de CA)       | `actions/epi/lookup-ca.ts`                   | `lookupCa` (Server Action, só sessão) + `GET /api/integrations/caepi/{ca}`                                                                                                                                                                                                                                                                                                             |
| Catálogo de EPI              | `actions/pgr/epi-catalog.ts`                 | list, get, create, update, delete (em uso → `409 IN_USE`), dependents + REST `/api/v1/epi-catalog/**` (FK composta categoria+tipo → `422 FK_NOT_FOUND`)                                                                                                                                                                                                                                |
| Entrega de EPI               | `actions/pgr/epi-deliveries.ts`              | create (baixa transacional), list, get, delete (guard), signManual, returnItem + REST `/api/v1/epi-deliveries/**`                                                                                                                                                                                                                                                                      |
| Ficha de EPI                 | `actions/pgr/epi-record.ts`                  | `getEmployeeEpiRecordAction` (read-only) + REST `GET /api/v1/employees/{id}/epi-record`                                                                                                                                                                                                                                                                                                |
| Treinamento (catálogo)       | `actions/pgr/training-catalog.ts`            | list, options, get, create, update, delete, dependents + REST `/api/v1/training-catalog/**`                                                                                                                                                                                                                                                                                            |
| Realização de treinamento    | `actions/pgr/training-records.ts`            | list (por funcionário), get, create (`valid_until` via D1 no servidor), delete + vencimento (`listTrainingExpiry`, `getTrainingDueSummary`) + REST `/api/v1/training-records/**`                                                                                                                                                                                                       |
| Fator de risco psicossocial  | `actions/psychosocial/risk-factors.ts`       | list (`?search=`/`?level=`, GES via JOIN), get, create (código `PS-07` server-side + `assertGesInTenant`), update, delete + REST `/api/v1/psychosocial-risk-factors/**`                                                                                                                                                                                                                |
| Obrigatórios por função      | `actions/pgr/job-role-required-trainings.ts` | list, add (idempotente), remove + conformidade (`getEmployeeCompliance`, `listNonCompliance`) + REST `/api/v1/job-role-required-trainings/**`                                                                                                                                                                                                                                          |
| Ordem de Serviço (023)       | `actions/safety/service-orders.ts`           | list, get, create, update, delete + REST `/api/v1/service-orders/**` (número server-side; itens na mesma tx; itens imutáveis se assinada)                                                                                                                                                                                                                                              |
| OS · Assinatura (023)        | `actions/safety/service-order-signature.ts`  | create (payload server-side; `publicUrl`/QR só na criação), get (estado derivado) + REST `/api/v1/service-orders/{id}/signature` (cota compartilhada 402)                                                                                                                                                                                                                              |
| Incidentes/Acidentes (023)   | `actions/safety/accidents.ts`                | list, get, create, update, delete, setStatus (incident-lifecycle) + REST `/api/v1/incidents/**` (dado de saúde P0; `client`→403; CAT interno, sem S-2210)                                                                                                                                                                                                                              |
| Planos de Ação 5W2H (023)    | `actions/safety/action-plans.ts`             | list, get, create, update, setStatus, delete + REST `/api/v1/action-plans/**` (origem `risk\|incident`→422; overdue derivado; física só `planned`, senão `409 IN_USE`)                                                                                                                                                                                                                 |
| Auditorias de Risco (023)    | `actions/safety/risk-audits.ts`              | list, get, create, setStatus, suggestActionPlan (IA) + REST `/api/v1/risk-audits/**` (uma ativa/origem→409; `suggest-action-plan` allowlist não-PII, `kind=action_plan_suggestion`)                                                                                                                                                                                                    |

---

## Contrato de retorno — `ActionResult<T>`

Local: `src/shared/server/result.ts`. **Todas as actions de CRUD** retornam este envelope;
nenhuma exceção crua chega à UI.

```ts
type ActionError = {
  code: string; // ver tabela abaixo
  message: string; // mensagem curta exibível
  fields?: Record<string, string>; // erros por campo (origem zod)
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
```

> A `meAction` é anterior a este contrato e usa um envelope próprio (ver seção Sessão).

### Códigos de erro (canônicos)

Mapeados por `toActionError` (`src/shared/server/action-error.ts`). Erro inesperado é
**relançado** (nunca silenciado), caindo no error boundary do Next.

| code                         | Origem                                       | HTTP equiv. | Quando                                                                                                 |
| ---------------------------- | -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `VALIDATION`                 | `ZodError` (com `fields`); CHECK `23514`     | 422         | Entrada inválida                                                                                       |
| `DUPLICATE`                  | UNIQUE `23505`                               | 409         | CNPJ/CPF/título/vínculo duplicado no escritório                                                        |
| `FK_NOT_FOUND`               | FK `23503`; referência fora do tenant        | 422         | Empresa/obra/GES/função inexistente no escritório                                                      |
| `FORBIDDEN`                  | papel `client`                               | 403         | Membro não-equipe tentou operar                                                                        |
| `NOT_FOUND`                  | `getById` → `null`                           | 404         | Registro inexistente no escritório (inclui cross-tenant)                                               |
| `NO_TENANT_CONTEXT`          | sem escritório ativo                         | 403         | Sessão sem tenant resolvido                                                                            |
| `INSUFFICIENT_STOCK`         | `InsufficientStockError` (repositório)       | 422         | Saída/entrega maior que o saldo disponível (rollback total)                                            |
| `ALREADY_SIGNED`             | `AlreadySignedError` (repositório)           | 409         | Assinar entrega que já saiu de `pending` (one-shot)                                                    |
| `ALREADY_RETURNED`           | `AlreadyReturnedError` (repositório)         | 409         | Devolver item de entrega já devolvido (saldo intacto)                                                  |
| `DOCUMENT_VERSION_READ_ONLY` | `DocumentVersionReadOnlyError` (repositório) | 409         | Editar metadados de versão de documento que não é a vigente (#56)                                      |
| `TOKEN_INVALID`              | `TokenInvalidError` (rota pública)           | 404         | Token de assinatura ausente/adulterado/inexistente                                                     |
| `TOKEN_EXPIRED`              | `TokenExpiredError` (rota pública)           | 410         | Token com HMAC válido porém além do TTL de 72h                                                         |
| `IN_USE`                     | `EntityInUseError` (repositório)             | 409         | Excluir item de catálogo com dependentes (pré-check + RESTRICT backstop)                               |
| `QUOTA_EXCEEDED`             | `QuotaExceededError` (cota do plano)         | 402         | Cota mensal do plano `free` esgotada (sugestão IA; assinatura — contador compartilhado por tenant/mês) |
| `BILLING_UNAVAILABLE`        | `BillingUnavailableError`                    | 503         | Provedor de pagamento (Stripe) não configurado neste ambiente — degradação graciosa, nunca crash       |

## Pré-condições comuns (toda action de CRUD)

Encapsuladas em `officeAction(operation, fn, { audit? })` (`src/shared/server/office-action.ts`):

1. **Gate de papel** (`requireOfficeStaff`): apenas `owner`/`collaborator`; papel `client` →
   `FORBIDDEN`. Vale para leitura e escrita.
2. **Tenant da sessão**: `tenantId` vem de `requireTenantContext()`, **nunca** de input do
   cliente. Todo acesso roda em `withOrg(tenantId, …)` + RLS backstop por `org_id`.
3. **Validação**: escrita faz `schema.parse(input)` (zod) antes do repositório → falha vira
   `VALIDATION` com `fields`.
4. **Auditoria**: escritas emitem evento de fronteira sem PII; leituras não emitem em sucesso.
5. **Revalidação**: mutações chamam `revalidatePath` da(s) rota(s) afetada(s).

## Paginação

`src/shared/pagination.ts`. Entrada `{ page?, pageSize? }` (default `pageSize = 20`, clamp a
`PAGE_SIZE_MAX = 100`, `page >= 1`; inválidos caem nos defaults). Listas retornam
`Paginated<T> = { rows: T[]; total: number }`.

---

## Sessão / Identidade — `actions/me.ts`

| Action     | Entrada | Retorno                                                                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------ |
| `meAction` | —       | `{ ok: true; userId; orgId }` \| `{ ok: false; error: "UNAUTHORIZED" \| "NO_ACTIVE_ORG" }` |

Resolve o usuário autenticado e a org ativa da sessão (Clerk). Envelope próprio (não
`ActionResult`).

## Empresa — `actions/pgr/companies.ts`

**Validação cadastral (NOB-102):** CNPJ permanece opcional para preservar os
cadastros atuais. Quando informado, aceita os 14 caracteres numéricos ou
alfanuméricos (12 posições A–Z/0–9 e dois DVs numéricos), com máscara opcional;
normaliza letras ASCII para maiúsculas e valida o DV pelo algoritmo da Receita.
Formato/checksum inválido → `422 VALIDATION`, com erro no campo. Duplicidade no
mesmo escritório, inclusive após normalização ou envio concorrente, →
`409 DUPLICATE` e `fields.cnpj`. O mesmo CNPJ pode existir em outro escritório.
JSON malformado em POST/PUT de empresas ou funcionários → `422 VALIDATION`.
Funcionários continuam exigindo empresa do tenant e GES/função coerentes; CPF
mantém a unicidade por escritório já existente. Autofill externo é auxiliar:
falha de consulta não impede preenchimento manual nem confirma cadastro oficial.

**Cadastros comuns (NOB-99):** PGR e Medicina reutilizam a mesma empresa e os
mesmos funcionários do tenant. `GET /api/v1/companies?module=pgr|medicine` e
`GET /api/v1/employees?module=pgr|medicine` filtram por serviço habilitado sem
duplicar registros. O parâmetro opcional é validado (valor desconhecido → 422).
Sem `module`, as consultas comuns mantêm o comportamento existente. O filtro
não substitui o gate de papel, a validação de referências nem as policies de RLS.
`listCompanyOptionsAction(module?)` oferece o mesmo contrato aos formulários.

| Action                       | Entrada                                          | Retorno (`data`)                              |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `listCompaniesAction`        | `{ search?, state?, status?, page?, pageSize? }` | `{ rows: CompanyListItem[]; total }`          |
| `listCompanyOptionsAction`   | —                                                | `CompanyOption[]` (id, razaoSocial, endereço) |
| `getCompanyAction`           | `id`                                             | `Company` (null → `NOT_FOUND`)                |
| `createCompanyAction`        | `CompanyInput`                                   | `Company` (CNPJ dup → `DUPLICATE`)            |
| `updateCompanyAction`        | `id, CompanyInput`                               | `Company`                                     |
| `deleteCompanyAction`        | `id`                                             | `{ id }` (cascata pelo banco)                 |
| `getCompanyDependentsAction` | `id`                                             | `{ workUnits, ges, jobRoles, employees }`     |

**`CompanyInput`**: `razaoSocial*`, `riskGrade*` (1–4), `cnpj?` (14 díg. se preenchido),
`nomeFantasia?`, `phone?`, `email?`, `cnae?`, `mainActivity?`, `status` (`active|pending|inactive`,
default `active`), `taxClassification?` (código eSocial S-1000 `classTrib`, texto livre), `logoPath?`,
`zipCode? street? number? complement? district? city? state?`. **`CompanyListItem`** inclui `status` +
contagens derivadas `employeeCount`/`gesCount` (COUNT por tenant, sem coluna). Filtros do GET:
`?search=` (razão social/CNPJ), `?state=` (UF), `?status=`. Certificado digital A1 (.pfx) do card
eSocial fica para fatia futura (credencial — exige armazenamento seguro). Migration
`0034_companies_status_esocial` (enum `company_status` + `status` + `tax_classification`).
**`CompanyListItem`**: `{ id, razaoSocial, cnpj, city, state }`.

## Unidade de Obra — `actions/pgr/work-units.ts`

| Action                        | Entrada                                              | Retorno                                              |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `listWorkUnitsAction`         | `{ companyId?, status?, search?, page?, pageSize? }` | `{ rows: WorkUnitListItem[]; total }`                |
| `getWorkUnitAction`           | `id`                                                 | `WorkUnit`                                           |
| `createWorkUnitAction`        | `WorkUnitInput`                                      | `WorkUnit` (empresa fora do tenant → `FK_NOT_FOUND`) |
| `updateWorkUnitAction`        | `id, WorkUnitInput`                                  | `WorkUnit`                                           |
| `deleteWorkUnitAction`        | `id`                                                 | `{ id }`                                             |
| `getWorkUnitDependentsAction` | `id`                                                 | `{ ges }`                                            |

**`WorkUnitInput`**: `companyId*`, `name*`, `description*`, `contractNumber?`, `type?`
(`site|branch|workfront`), `status` (`active|suspended|closed`, default `active`), `startDate?`,
`expectedEndDate?` (datas ISO AAAA-MM-DD), responsável técnico (`managerName?`, `managerRole?`,
`professionalTitle?`, `professionalRegistration?`), endereço (`zipCode?…state?`). **`WorkUnitListItem`**
= `WorkUnit` + `companyName` (join). Filtros do GET: `?companyId=`, `?status=`, `?search=`
(nome/contrato/objeto). Migration `0035_work_units_type_status_dates` (2 enums + 4 colunas).

## Função (Cargo) — `actions/pgr/job-roles.ts`

| Action                       | Entrada                                                        | Retorno                                         |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `listJobRolesAction`         | `{ companyId?, gesId?, isActive?, search?, page?, pageSize? }` | `{ rows: JobRoleListItem[]; total }`            |
| `getJobRoleAction`           | `id`                                                           | `JobRole`                                       |
| `createJobRoleAction`        | `JobRoleInput`                                                 | `JobRole` (título dup na empresa → `DUPLICATE`) |
| `updateJobRoleAction`        | `id, JobRoleInput`                                             | `JobRole`                                       |
| `deleteJobRoleAction`        | `id`                                                           | `{ id }`                                        |
| `getJobRoleDependentsAction` | `id`                                                           | `{ gesLinks, employees }`                       |

**`JobRoleInput`**: `companyId*`, `title*`, `cbo?`, `sector?` (texto livre, #193), `workSchedule?`,
`description?`, `isActive` (default `true`), e **GES-inline** `gesId?` + `workerCount?` (default 1) —
cria/atualiza o vínculo `ges_job_roles` de forma **aditiva** (nunca remove; a gestão M:N completa fica
em `/ges`). **`JobRoleListItem`** = `JobRole` + `gesNames` (nomes de GES agregados) + `employeeCount`
(derivados). Filtros do GET: `?companyId=`, `?gesId=` (EXISTS), `?isActive=`, `?search=`. Migration
`0037_job_roles_status_sector` (colunas `sector` + `is_active`).

## GES + vínculos — `actions/pgr/ges.ts`

| Action                        | Entrada                                                  | Retorno                                                 |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `listGesAction`               | `{ companyId?, workUnitId?, search?, page?, pageSize? }` | `{ rows: GesListItem[]; total; totalWorkers }`          |
| `getGesAction`                | `id`                                                     | `{ ges: Ges; exposedWorkers }`                          |
| `createGesAction`             | `GesInput`                                               | `Ges` (obra fora da empresa/tenant → `FK_NOT_FOUND`)    |
| `updateGesAction`             | `id, GesInput`                                           | `Ges`                                                   |
| `deleteGesAction`             | `id`                                                     | `{ id }` (cascata em vínculos; funcionários → GES nulo) |
| `getGesDependentsAction`      | `id`                                                     | `{ jobRoleLinks, employees }`                           |
| `listGesJobRolesAction`       | `gesId`                                                  | `GesJobRoleItem[]`                                      |
| `listAvailableJobRolesAction` | `gesId`                                                  | `JobRoleOption[]` (funções da empresa não vinculadas)   |
| `addGesJobRoleAction`         | `{ gesId, jobRoleId, workerCount, workSchedule? }`       | `{ gesId }` (≤0 → `VALIDATION`; dup → `DUPLICATE`)      |
| `updateGesJobRoleAction`      | `id, gesId, { workerCount, workSchedule? }`              | `{ id }`                                                |
| `removeGesJobRoleAction`      | `id, gesId`                                              | `{ id }`                                                |

**`GesInput`**: `companyId*`, `workUnitId*`, `name*`, `processDescription? constructionType?
ceilingHeight? floor? roof? lighting? ventilation? otherCharacteristics?`.
**`GesListItem`**: `{ id, name, processDescription, exposedWorkers }` — `exposedWorkers` é
**derivado** (`SUM(worker_count)` das funções vinculadas), somente leitura, 0 sem vínculos.
**`GesJobRoleItem`**: `{ id, jobRoleId, title, workerCount, workSchedule }`.
**`JobRoleOption`**: `{ jobRoleId, title }`.

## Funcionário — `actions/pgr/employees.ts`

| Action                   | Entrada                                                      | Retorno                                                  |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------------------- |
| `listEmployeesAction`    | `{ companyId?, gesId?, status?, search?, page?, pageSize? }` | `{ rows: EmployeeListItem[]; total }`                    |
| `getEmployeeAction`      | `id`                                                         | `Employee`                                               |
| `createEmployeeAction`   | `EmployeeInput`                                              | `Employee` (CPF dup → `DUPLICATE`)                       |
| `updateEmployeeAction`   | `id, EmployeeInput`                                          | `Employee`                                               |
| `deleteEmployeeAction`   | `id`                                                         | `{ id }`                                                 |
| `listGesFunctionsAction` | `gesId`                                                      | `JobRoleOption[]` (picker: só funções vinculadas ao GES) |

**`EmployeeInput`**: `companyId*`, `fullName*`, `cpf*` (11 díg.), `gesId?`, `jobRoleId?`
(exige `gesId` e vínculo existente no GES), `status?` (`active`|`on_leave`|`dismissed`, default
`active`), `sex?` (`male`|`female`|`not_informed`), `maritalStatus?`
(`single`|`married`|`divorced`|`widowed`|`stable_union`), `birthDate? admissionDate?
dismissalDate? badgeValidUntil?` (datas), `phone? email? rg? badgeNumber? registration?
bloodType? photoPath?`, endereço (`zipCode?…state?`).
**`EmployeeListItem`**: `{ id, fullName, status, companyName, gesName, jobRoleTitle, serviceOrderCount }`
(`jobRoleTitle` = função por join; `serviceOrderCount` = nº de OS do funcionário, derivado por COUNT,
sem coluna). Zero migration.

## Categoria — `actions/pgr/categories.ts`

Catálogo de categorias de `epi`/`machine`/`supply` (Insumo, #192). Sem `/dependents` (catálogo sem FK
de entrada). REST espelho em `/api/v1/categories` (GET, POST) · `/api/v1/categories/{id}` (GET, PUT, DELETE).

| Action                 | Entrada                                           | Retorno (`data`)                            |
| ---------------------- | ------------------------------------------------- | ------------------------------------------- |
| `listCategoriesAction` | `{ search?, type?, isActive?, page?, pageSize? }` | `{ rows: CategoryListItem[]; total }`       |
| `getCategoryAction`    | `id`                                              | `Category` (null → `NOT_FOUND`)             |
| `createCategoryAction` | `CategoryInput`                                   | `Category` (nome dup no tipo → `DUPLICATE`) |
| `updateCategoryAction` | `id, CategoryInput`                               | `Category`                                  |
| `deleteCategoryAction` | `id`                                              | `{ id }`                                    |

## Médico — `actions/pgr/medicos.ts`

Cadastro de profissionais de saúde — médicos (CRM) e psicólogos (CRP), da equipe ou externos (NOB-121) —
responsáveis por exames/ASO e pelo PCMSO (catálogo do escritório, isolado por tenant). `clinic` ("Empresa" na listagem) é a clínica/empregador do médico — **texto livre**, não a
empresa-cliente do tenant. CRM único por org (`UNIQUE(org_id, crm)` → `DUPLICATE`). Sem `/dependents`.
Exclusão recusada → `IN_USE` (409), o cadastro deve ser inativado: **examinador de exames registrados**
(`health_exams.doctor_id`, inclusive ASO/ASO assinado do exame, ou `aso_examiner_conclusions.examiner_medico_id`
— conferido antes da exclusão; a FK `health_exams.doctor_id` passou de `SET NULL` para `NO ACTION` na 0081 e
segura também exame que a RLS esconde, ex.: empresa sem o módulo de Medicina) ou histórico de coordenação do
PCMSO (FK `RESTRICT`). Antes, excluir o médico apagava em silêncio o examinador dos exames. REST espelho em
`/api/v1/medicos` (GET, POST) · `/api/v1/medicos/{id}` (GET, PUT, DELETE).

| Action                    | Entrada                                           | Retorno (`data`)                            |
| ------------------------- | ------------------------------------------------- | ------------------------------------------- |
| `listMedicosAction`       | `{ search?, status?, clinic?, page?, pageSize? }` | `{ rows: Medico[]; total }`                 |
| `listMedicoOptionsAction` | —                                                 | `MedicoOption[]` (só `active`, id+nome+crm) |
| `listMedicoClinicsAction` | —                                                 | `string[]` (clínicas distintas do tenant)   |
| `getMedicoAction`         | `id`                                              | `Medico` (null → `NOT_FOUND`)               |
| `createMedicoAction`      | `MedicoInput`                                     | `Medico` (CRM dup → `DUPLICATE`)            |
| `updateMedicoAction`      | `id, MedicoInput`                                 | `Medico` (CRM equivalente → `DUPLICATE`)    |
| `deleteMedicoAction`      | `id`                                              | `{ id }`                                    |

**`MedicoInput`**: `{ name*, crm*, registrationUf*, profession, rqe?, affiliation, specialty?, clinic?, phone?, status }`
(`crm` = número do registro no conselho, CRM ou CRP, até 20 caracteres; `registrationUf*` = UF do conselho, sigla
válida, normalizada para maiúsculas — **obrigatória desde a migration 0060**; `profession` = `physician|psychologist`,
default `physician`; `rqe` = RQE em Medicina do Trabalho, só para `physician`; `affiliation` = `internal|external`,
default `internal`; `status` = `active|inactive`, default `active`). Registros antigos ficam com UF nula até a
próxima edição, que passa a exigi-la. Filtro de listagem por **Empresa/clínica** (`?clinic=`, valores de
`listMedicoClinicsAction` = `SELECT DISTINCT clinic` do tenant) — fiel ao mockup "Todas as Empresas";
`clinic` é texto livre (empregador do médico), não a empresa-cliente do tenant. `?status=` continua
suportado no backend/REST.

**Registro duplicado por formatação (NOB-110/NOB-112)**: além do índice bruto, criar (POST/`createMedicoAction`)
ou editar (PUT/`updateMedicoAction`) um profissional com registro **equivalente** a outro do mesmo escritório
→ `DUPLICATE` (409) com `fields.crm`. Equivalente = mesma categoria (`profession`; CRM ≠ CRP) + mesma UF (sem
diferenciar maiúsculas) + mesmo número canônico (`canonicalRegistrationNumber`: tira ponto, hífen, barra e
espaços; zeros à esquerda contam, `012345` ≠ `12345`; número com letras fica fora da conferência). UF diferente,
categoria diferente ou outro escritório **não** são duplicata. Cadastro antigo **sem UF** com o mesmo número e
categoria bloqueia um novo (mensagem pede completar a UF dele). A conferência roda na mesma transação da
gravação com `pg_advisory_xact_lock` por (escritório, categoria, UF, número canônico) — duas gravações
concorrentes: só uma passa. **Sem índice canônico** (duplicatas antigas da homologação fariam a
migration falhar): o legado não é juntado, apagado nem corrigido; editar um cadastro antigo sem mudar o registro
(número canônico, categoria, UF já informada — completar UF nula não conta como mudança) continua permitido.
Texto de registro idêntico (índice bruto `uq_medicos_org_crm`, mesmo em outra UF/categoria) → `DUPLICATE` com
`fields.crm`. Leitura operacional: `countMedicoRegistrationDuplicateGroups(orgId)` (repositório, só a contagem
de grupos, sem dado pessoal; não exposto em HTTP). **Backstop no banco (migration 0081):** o trigger
`medicos_registration_guard` (BEFORE INSERT OR UPDATE OF `crm`, `profession`, `registration_uf`; SECURITY INVOKER)
aplica a mesma regra a **gravações novas por qualquer caminho**, inclusive INSERT/UPDATE direto por SQL como
`app_runtime`: forma canônica em `public.medico_registration_canonical(text)` (mesma do TS: ponto, hífen, barra e
os espaços do `\s` do JavaScript; teste de paridade), mesma chave de `pg_advisory_xact_lock` da aplicação
(reentrante na mesma transação) e recusa `23505` com constraint `medicos_registration_equivalent` e DETAIL
`same_uf`/`missing_uf` — o repositório traduz para `DUPLICATE` com `fields.crm` e a mensagem correspondente.
Edição que não muda o registro (mesma regra de `registrationIdentityChanged`) não é conferida. **Limites:** as
duplicatas antigas continuam no banco (não há índice canônico); número com letras ou cadastro sem UF não é
conferido (como na aplicação); o owner do banco ainda pode desligar o trigger. O CRM nunca autoriza nada (NOB-158).

**`CategoryInput`**: `type*` (`epi`|`machine`|`supply`), `name*`, `note?`, `isActive` (default `true`).
Unicidade por `UNIQUE(org_id, type, name)` → duplicidade no mesmo escritório+tipo vira `DUPLICATE`; o
mesmo nome é aceito entre tipos distintos. **PUT (REST) exige corpo completo** (sem `.partial()`).
**`CategoryListItem`** = `Category` + `itemCount` (nº de itens `epi_catalog` vinculados, derivado por
COUNT, sem coluna). Filtros do GET: `?search=`, `?type=`, `?isActive=`. Migration
`0036_category_supply_status` (enum `ADD VALUE 'supply'` + coluna `is_active`).

## Coordenador do PCMSO — `actions/medicine/pcmso-coordinators.ts`

Designação do médico responsável pelo PCMSO por empresa e período (MED-02; NR-7 item 7.4.1, alínea c).
Tabela `pcmso_coordinator_assignments` (migration `0060_medical_professional_identity`): FKs compostas
`(company_id, org_id)` e `(medico_id, org_id)`, no máximo **uma designação aberta por empresa** (índice
único parcial → `DUPLICATE`), períodos sem sobreposição. **Histórico imutável**: o `app_runtime` não tem
DELETE e só altera as colunas de encerramento de uma designação **aberta** (policy de UPDATE). Escrita só pelo
`owner`, conferida no app e por policy RLS com `app.current_actor` (padrão 0056). Exige Medicina habilitada
na empresa (`FORBIDDEN`).

Regras (`domains/medicine/pcmso-coordinators.ts`): só médico ativo, com UF do CRM; sem RQE em Medicina do
Trabalho, exige `rqeExceptionReason` (exceção do NR-7 item 7.5.2: inexistência de médico do trabalho na
localidade). Trocar de coordenador encerra a designação aberta na véspera do início da nova, na mesma transação.

**Aberta × vigente (NOB-109):** designação aberta (`ends_on` nulo) não é o mesmo que designação vigente. A data de início pode ser futura (sucessor agendado) e o encerramento pode ser agendado. A conferência e a prévia do PCMSO usam o coordenador **vigente hoje** (`coordinatorInForceOn`, America/Sao_Paulo).

**Permissão = designação vigente hoje (America/Sao_Paulo); sobreposição nega.** Os atos do coordenador (decidir e aprovar o plano de exames, critérios de interpretação, relatório analítico e sua finalização, PCMSO assinado, prontuário e área clínica do afastamento como coordenador) exigem a designação **em vigor hoje** (`starts_on <= hoje` e `ends_on` nulo ou `>= hoje`, fim inclusivo), não a "aberta": encerramento agendado mantém o poder até o fim; sucessor agendado só o tem a partir do início; no dia da troca só a nova vale (a anterior termina na véspera). Duas designações em vigor no mesmo dia (só alcançável fora do app) → ninguém age (`403`/`422`), sem escolher uma. Mesma regra no app (`coordinatorInForceTodayTx`, `repositories/pcmso-coordinator-in-force.ts`) e na RLS (fragmento único `coordinatorAssignmentInForceToday`, `schema/coordinator-in-force.ts`). Vínculo aberto, identidade verificada (NOB-158), profissional ativo, associação viva e módulo seguem exigidos; owner sem identidade médica não substitui o coordenador. Quem era o coordenador na data de um documento (prévia, ASO) é conteúdo do documento, não permissão.

| Action                            | Entrada                                                    | Retorno (`data`)             |
| --------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `listPcmsoCoordinatorsAction`     | `companyId`                                                | `CoordinatorAssignmentRow[]` |
| `designatePcmsoCoordinatorAction` | `companyId, { medicoId*, startsOn*, rqeExceptionReason? }` | `PcmsoCoordinatorAssignment` |
| `closePcmsoCoordinatorAction`     | `companyId, assignmentId, { endsOn*, endReason* }`         | `PcmsoCoordinatorAssignment` |

REST: `GET|POST /api/v1/companies/{id}/pcmso-coordinators` · `GET|PUT /api/v1/pcmso-coordinators/{id}`
(PUT só encerra; sem DELETE). Tela: `/companies/{id}/pcmso-coordinator`.

---

## Vínculo profissional ↔ conta — `actions/medicine/professional-links.ts`

Dá ao profissional cadastrado uma identidade autenticada (NOB-149, critério de permissões da NOB-121). Tabela `medico_user_links` (migration `0061_medico_user_links`):

- FK composta `(medico_id, org_id)` → `medicos` (RESTRICT);
- no máximo **um vínculo aberto por profissional** e **um por conta** no escritório (índices únicos parciais → `DUPLICATE`);
- revogação com motivo, sem DELETE;
- RLS de tenant + policies restritivas: inserção só a partir de convite aceito (NOB-157, abaixo), com `linked_by` = ator; revogação só de vínculo aberto, com `revoked_by` = ator;
- `app_runtime` com UPDATE só nas colunas de revogação.

A conta precisa ser membro do escritório e o profissional precisa estar ativo (`VALIDATION`). Não há FK para `org_memberships`: a saída da conta não apaga o histórico, e a autorização exige a associação viva no uso.

**Autorização por vínculo:** `assertActorIsCompanyCoordinator(tx, ctx, companyId)` (`repositories/medico-user-links.ts`) só aceita a conta da sessão vinculada ao profissional da designação de coordenador da empresa **em vigor hoje** e única (NOB-144/NOB-109), com profissional ativo e associação viva. O papel no escritório (owner, colaborador) não substitui o vínculo. É a base para os atos do coordenador (revisão do plano de exames).

| Action                           | Entrada                          | Retorno (`data`)                                               |
| -------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `listMedicoUserLinksAction`      | `medicoId`                       | `MedicoUserLink[]`                                             |
| `inviteMedicoUserAction`         | `medicoId, { userId*, reason* }` | `InvitationView` (não cria vínculo)                            |
| `revokeMedicoUserLinkAction`     | `medicoId, linkId, { reason* }`  | `MedicoUserLink`                                               |
| `getMyProfessionalProfileAction` | —                                | `ProfessionalProfile \| null` (inclui as empresas coordenadas) |

REST: `GET /api/v1/medicos/{id}/user-links` · `PUT /api/v1/medicos/{id}/user-links/{linkId}` · `GET /api/v1/me/professional`. Tela: seção "Acesso do profissional" em `/medicos/{id}/edit`.

### Convite e aceite — NOB-157 (anti-autoconcessão clínica)

O vínculo dá acesso clínico (prontuário, atos de examinador e coordenador), e por isso não nasce mais por ato do owner sozinho. Migration `0069_medico_link_invitations`.

1. **Convite** (`medico_link_invitations`): o `owner` convida uma conta do escritório para o profissional, com motivo. Validade de 7 dias. Um convite em aberto por profissional; profissional já vinculado não recebe convite (`422`).
2. **Aceite pela própria conta convidada** (evento `accepted`):
   - só a conta convidada aceita ou recusa, com login próprio; owner e colaborador não aceitam por ela (`403`);
   - o aceite grava a declaração "sou {nome}, {registro}" do cadastro;
   - sem autovínculo, o vínculo nasce aqui, com `linked_by` = a conta e `invitation_id` preenchido.
3. **Autovínculo** (quem convida = conta convidada):
   - o aceite deixa o convite "aguardando aprovação";
   - só **outra** conta `owner` aprova (evento `approved`), e aí o vínculo nasce;
   - quem se convidou não aprova (`403`);
   - o owner legitimamente médico exerce a função depois dessa segunda aprovação.
4. **Fim do convite:** `declined` (conta convidada), `cancelled` (owner) e expiração encerram o convite sem vínculo.
5. **Banco:**
   - eventos só inclusão (um de cada tipo por convite), com a autoria conferida pela RLS;
   - a inserção em `medico_user_links` exige convite aberto, aceito pela própria conta e, no autovínculo, aprovado por outro owner;
   - um convite gera no máximo um vínculo (`uq_medico_user_links_invitation`);
   - o vínculo direto do fluxo antigo é recusado (`42501`), inclusive por SQL com o papel do app;
   - convites e eventos sem UPDATE/DELETE.

**O que a fatia não faz:**

- O aceite é uma declaração autenticada, **não verificação do conselho profissional**: não há integração com o CFM/CRM nem conferência de documento.
- Escritório com um único owner médico fica com o autovínculo pendente até haver segundo aprovador ou verificação externa (decisão de produto na NOB-157).
- Vínculos anteriores à 0069 continuam valendo e aparecem como "anteriores ao convite com aceite" na tela.

| Action                                | Entrada                                                    | Retorno (`data`)                      |
| ------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `listMedicoLinkInvitationsAction`     | `medicoId`                                                 | `InvitationView[]` (com `status`)     |
| `actOnMedicoLinkInvitationAction`     | `medicoId, invitationId, accept\|decline\|approve\|cancel` | `InvitationView`                      |
| `listMyProfessionalInvitationsAction` | —                                                          | convites aguardando o aceite da conta |

REST: `GET|POST /api/v1/medicos/{id}/user-link-invitations` · `POST /api/v1/medicos/{id}/user-link-invitations/{invitationId}/{accept|decline|approve|cancel}` · `GET /api/v1/me/professional-invitations`.

### Verificação independente de identidade — NOB-158, NOB-159, NOB-160

Migration `0071_professional_identity_verifications`. Provisionamento e procedimento: `docs/deploy/identity-verifier.md`.

**Regra central.** O acesso clínico (prontuário, examinador do ASO, coordenador do PCMSO, plano de exames, critérios, relatório analítico, área clínica dos afastamentos) passa a depender da função **`public.actor_clinical_medico_ids(org)`** (SECURITY INVOKER, `search_path` fixo, EXECUTE só para o `app_runtime`). Ela exige ao mesmo tempo:

- vínculo ativo da conta da sessão, profissional ativo (médico) e associação viva ao escritório;
- vínculo criado por convite (NOB-157) **ou** legado reconfirmado pela própria conta (NOB-159);
- **identidade verificada** por operador designado: não revogada, dentro da validade e com CRM/UF conferidos iguais ao cadastro atual.

Todas as policies clínicas e as checagens do servidor (`repositories/clinical-actor.ts`) usam essa função; nenhuma confia só em `medico_user_links`.

**Quem verifica.**

- Operador designado da plataforma, registrado em `identity_verifiers`. A designação não tem caminho pela aplicação: só provisionamento no banco.
- Ele usa uma conexão própria (`IDENTITY_VERIFIER_DATABASE_URL`, papel `identity_verifier`), separada do `app_runtime` e da conta de migrations.
- O banco recusa operador membro do escritório, operador verificando a própria conta, pedido que não seja da própria conta, CRM/UF divergente e checklist incompleto.
- O `app_runtime` não grava verificações nem decisões e não lê a designação.
- Sem conexão ou segredo configurados, a verificação fica indisponível e o acesso continua bloqueado.

**Fluxo.**

1. A própria conta pede a verificação. Isso exige vínculo ativo ou autovínculo aceito.
2. A tela mostra a ela um código de controle (HMAC, janela de 5 min; vale no máximo ~10 min, janela atual ou anterior — NOB-164).
3. O operador confere documentos, registro em fonte oficial e o código ao vivo, presencial ou por vídeo sem gravação.
   - Cada código conferido fica em `identity_challenge_attempts` (migration `0072`), só inclusão, sem o código. Só o operador grava e lê; o `app_runtime` não tem acesso.
   - Limites de códigos errados: 5 por pedido, no total (depois só resta recusar o pedido, e o profissional abre outro); 10 por conta do profissional em 24 h, somando pedidos e operadores; 10 por operador em 1 h. Esgotado, nem o código certo é conferido (`VALIDATION`).
   - Pedido já aprovado ou recusado não aceita conferência.
4. O operador registra método, fonte e referência (sem documento bruto). A validade é de 12 meses (decisão NOB-158): a configuração só pode encurtar, e o banco recusa mais que `verified_at + 12 meses` (`ck_identity_verifications_validity`, migration `0083`, `NOT VALID`: não revalida linhas antigas). A data de vencimento é calculada no banco (`now() + make_interval(months => n)`), com a mesma aritmética de mês do CHECK.
   - Na tela do operador, **CRM conferido** e **UF conferida** começam vazios: o cadastro aparece só como contexto ("Cadastro informa: …") e o operador digita o que encontrou na fonte oficial. Campo vazio → `VALIDATION` pelo schema da aprovação; divergente do cadastro → o banco recusa.
5. Recusa e revogação ficam em `professional_identity_review_events`, só inclusão. A revogação corta o acesso na hora.

**NOB-159.** O vínculo legado (sem convite) só dá acesso com verificação **e** a reconfirmação explícita da própria conta (`medico_link_reconfirmations`). Nenhum vínculo é alterado ou revogado pela migration.

**NOB-160.** No autovínculo do único owner médico, a verificação independente substitui a segunda aprovação. A conta conclui o vínculo (ação `complete`) só depois de verificada. A policy de inclusão do vínculo confere a mesma condição; sem verificação, a falha continua fechada.

| Action                              | Entrada                                                                                                     | Retorno                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `getMyProfessionalIdentityAction`   | —                                                                                                           | situação por cadastro, acesso clínico e código |
| `requestIdentityVerificationAction` | `{ medicoId* }`                                                                                             | pedido                                         |
| `reconfirmLegacyLinkAction`         | `linkId`                                                                                                    | reconfirmação                                  |
| `getVerificationQueueAction`        | — (master + designado)                                                                                      | pedidos em aberto e verificações vigentes      |
| `approveIdentityVerificationAction` | `{ requestId*, method*, crm*, registrationUf*, registrySource*, evidenceRef?, challengeCode*, checklist* }` | verificação                                    |
| `rejectIdentityRequestAction`       | `requestId, { reason* }`                                                                                    | decisão                                        |
| `revokeIdentityVerificationAction`  | `verificationId, { reason* }`                                                                               | decisão                                        |

REST:

- `GET /api/v1/me/professional-identity` · `POST /api/v1/me/professional-identity/requests`;
- `POST /api/v1/me/medico-links/{linkId}/reconfirm`;
- `GET|POST /api/v1/admin/identity-verifications`;
- `POST /api/v1/admin/identity-verifications/requests/{id}/reject` · `POST /api/v1/admin/identity-verifications/{id}/revoke`;
- as rotas `/admin/identity-verifications(…)` exigem o mesmo gate das Server Actions: **master pela sessão Clerk real** (`requireMaster`) **e** designação no banco. A conta do operador vem da sessão de master, nunca do header `x-dev-user`; o bypass dev não substitui a sessão (sem master → `403`);
- com o bypass dev ligado, `GET /me/professional-identity` devolve `challengeCode: null`: a conta vem de headers forjáveis, e o código de controle só aparece na sessão real (`/professional-identity`);
- `POST /api/v1/medicos/{id}/user-link-invitations/{inv}/complete`.

Telas: `/professional-identity` (profissional) e `/admin-global/identity-verifications` (operador).

## Plano de exames — `actions/medicine/exam-plans.ts`

Plano de exames por grupo de exposição (NOB-150, MED-15). Migration `0062_medical_exam_plans`, com três tabelas.

- **`medical_exam_plans`:**
  - versões por empresa; status `draft` → `approved` → `superseded`;
  - um rascunho aberto e um aprovado por empresa (índices parciais → `DUPLICATE`);
  - proveniência em `based_on` (fontes e versões e, desde o lote 3, `riskIds`: o conjunto exato de riscos validados utilizáveis sobre o qual o médico decidiu), mais `rules_version` e `catalog_version`.
- **`medical_exam_plan_items`:**
  - procedimento da Tabela 27 (`CHECK ^[0-9]{4}$`; `9999` exige descrição);
  - origem `suggested` (com `rule_id`) ou `added`;
  - decisão `kept` ou `removed`; retirar e acrescentar exigem justificativa (`CHECK`);
  - periodicidade em texto, definida pelo médico.
- **`medical_exam_plan_events`:** trilha append-only (`draft_created`, `item_decided`, `item_added`, `approved`, `superseded`, `draft_discarded`).

| Regra                                                      | App                                         | Banco (RLS e grants)                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A equipe prepara o rascunho a partir da proposta (NOB-147) | `createDraft`                               | insert só com `status='draft'` e `prepared_by` = ator                                                                           |
| Só a coordenadora vinculada decide, acrescenta e aprova    | `assertActorIsCompanyCoordinator` (NOB-149) | `actorCoordinatesCompany`: designação vigente hoje + vínculo aberto + médico ativo + associação viva; `approved_by_user` = ator |
| Aprovado e substituído não mudam                           | `assertDraft`                               | itens só mudam com plano em rascunho; UPDATE só nas colunas de decisão e aprovação                                              |
| Nada é apagado                                             | sem rota DELETE                             | `REVOKE DELETE` nas três tabelas; eventos sem UPDATE                                                                            |

Ao aprovar, o aprovado anterior vira `superseded` na mesma transação. Para mudar um plano aprovado, prepara-se nova versão; nada é atualizado em silêncio.

**Plano preso ao conjunto de riscos validados (lote 3).** Validar ou rejeitar um risco na mesma fonte (mesmo id e versão) muda o conjunto e desatualiza o plano.

- `GET /exam-plans/{id}` devolve `basis`: `current` (mesmas fontes, versões e `riskIds` de hoje), `outdated` ou `legacy` (plano anterior ao controle, sem `riskIds`).
- **Aprovar** (sob a trava da base de riscos) só aceita rascunho `current`; `outdated`/`legacy` → `422 VALIDATION` **antes** de substituir o aprovado vigente, que fica intacto.
- **Preparar rascunho** com um rascunho aberto `outdated`/`legacy` arquiva o antigo como `superseded` **sem aprovação** (evento `draft_discarded`; na tela, "Rascunho descartado") e cria o novo; rascunho aberto `current` continua `DUPLICATE`. Se a base mudar durante a preparação → `422`. A RLS permite à equipe só esse descarte (rascunho → substituído sem nenhum dado de aprovação); o `CHECK ck_exam_plans_approval` passou a admitir substituído sem aprovação.
- Plano **aprovado legado** não é bloqueado só por isso: a conferência confere as fontes e avisa (`exam_plan_legacy_basis`).

**Aprovação presa ao ator e imutável (lote 3).** A policy `exam_plans_coordinator_transition` exige, para `approved`, `approved_by_user` = ator **e** `approved_by_medico_id` = o médico da conta verificada do ator que é o coordenador em vigor hoje da empresa (`actorMedicoCoordinatesCompany`) — aprovar em nome de outro médico → `42501`. O gatilho `medical_exam_plans_transition_guard` (SQL custom da 0081) vê a linha antiga e só admite rascunho → aprovado, aprovado → substituído **sem alterar** `approved_by_user`, `approved_by_medico_id`, `approved_at` e `approval_note`, e nada a partir de substituído; identificação e proveniência (`based_on`, versões) nunca mudam (`42501`).

| Action                      | Entrada                                                                                        | Retorno (`data`)                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `listExamPlansAction`       | `companyId`                                                                                    | `MedicalExamPlan[]` (versões)            |
| `getExamPlanAction`         | `planId`                                                                                       | plano + `items` + `events` + `canDecide` |
| `createExamPlanDraftAction` | `companyId`                                                                                    | `MedicalExamPlan` (rascunho)             |
| `decideExamPlanItemAction`  | `planId, itemId, { decision*, periodicity*, justification? }`                                  | `MedicalExamPlanItem`                    |
| `addExamPlanItemAction`     | `planId, { exposureGroup*, jobRole?, code*, otherDescription?, periodicity*, justification* }` | `MedicalExamPlanItem`                    |
| `approveExamPlanAction`     | `planId, { note? }`                                                                            | `MedicalExamPlan` (aprovado)             |

REST: `GET|POST /api/v1/companies/{id}/exam-plans` · `GET /api/v1/exam-plans/{id}` · `POST /api/v1/exam-plans/{id}/items` · `PUT /api/v1/exam-plans/{id}/items/{itemId}` · `POST /api/v1/exam-plans/{id}/approval`. Tela: `/companies/{id}/exam-plan`.

**Decisão do item é retomada sem perda (NOB-112, lote 02B).** `PUT .../items/{itemId}` grava a decisão inteira: `justification` ausente vira `null`.

**Exame repetido ao acrescentar (NOB-112).** O mesmo procedimento no mesmo grupo de exposição e função (índice único `uq_exam_plan_items_procedure`, inclusive item retirado) é recusado com `DUPLICATE` (409 no `POST .../items`) e a mensagem "Este exame já está no plano para este grupo de exposição e função…"; nada é inserido. Para mudar o item existente, use a decisão (`PUT .../items/{itemId}`). Na tela, o formulário só é limpo após o sucesso confirmado; erro e falha de rede mantêm o que foi digitado.

- A tela abre cada item com a decisão, a periodicidade e a **justificativa já registradas**. Mudar só a periodicidade reenvia a justificativa salva; apagá-la é um ato deliberado.
- Exame **acrescentado** pelo médico (`origin = 'added'`) sem justificativa → `VALIDATION` (`422`) com a mensagem "Exame acrescentado pelo médico exige justificativa…", conferida antes do `CHECK` (antes da correção, a tela só mostrava "Valor fora do permitido."). Nada é alterado.
- Retirada sem justificativa continua → `VALIDATION` no campo `justification`. Item sugerido e mantido: justificativa opcional.

## PCMSO composto (prévias) — `actions/medicine/pcmso-documents.ts`

Composição do PCMSO (NOB-151) a partir do que já foi validado e aprovado (`domains/medicine/pcmso-composition.ts`):

- empresa (razão social, CNPJ, CNAE, ramo, grau de risco, empregados);
- coordenador (NR-7 7.4.1 c; 7.5.2);
- fontes de risco com versões (7.5.1);
- por grupo de exposição: riscos validados com possíveis agravos (7.5.4 a) e exames **mantidos no plano aprovado pelo coordenador**, com a periodicidade definida por ele (7.5.4 b; NOB-150);
- exame clínico (7.5.6, 7.5.7);
- médicos examinadores;
- ciclo de planejamento de 12 meses a partir da data-base (MED-14), que não é prazo de validade normativo (a NR-7 não fixa validade do PCMSO);
- gatilhos de revisão (7.5.1, 7.5.5), troca de coordenador como atualização administrativa (MED-14) e relatório analítico anual a partir do último relatório (7.6.2, ainda pendente);
- **seções pendentes**: etapas que a conferência marca como `not_available`, sem texto inventado.

Tabela `pcmso_documents` (migration `0063_pcmso_documents`):

- cada geração é uma versão **arquivada e imutável**, com conteúdo JSON e `content_sha256` (JSON com chaves ordenadas);
- RLS: a versão só nasce de um plano `approved` da mesma empresa, com `generated_by` = ator;
- `CHECK status = 'preview'`: sem assinatura médica verificável (MED-12) não há emissão oficial;
- `app_runtime` só com SELECT e INSERT.

A geração exige a conferência (NOB-148) **sem bloqueios**: inclui coordenador, riscos validados e plano aprovado sobre a fonte atual. O coordenador da prévia é o vigente na data da geração, a mesma data usada na conferência (NOB-109). Prévias já arquivadas não são recompostas. A conferência passa a bloquear quando:

- não há plano aprovado (`exam_plan`);
- o plano aprovado foi feito sobre outra fonte de riscos ou sobre outro conjunto de riscos validados — "riscos validados mudaram desde o plano" (`exam_plan_outdated`);
- e avisa quando existe nova versão em rascunho (`exam_plan_draft`) ou quando o plano aprovado é legado, sem o conjunto de riscos (`exam_plan_legacy_basis`: só as fontes são conferidas).

| Action                        | Entrada                      | Retorno (`data`)                       |
| ----------------------------- | ---------------------------- | -------------------------------------- |
| `listPcmsoDocumentsAction`    | `companyId`                  | versões sem conteúdo                   |
| `getPcmsoDocumentAction`      | `id`                         | versão com `content` e `contentSha256` |
| `generatePcmsoDocumentAction` | `companyId, { cycleStart* }` | versão arquivada (`preview`)           |

`cycleStart` é uma data de calendário real (`AAAA-MM-DD`, dia existente no mês; `2026-02-31` → `422 VALIDATION`, não `500`).

REST: `GET|POST /api/v1/companies/{id}/pcmso-documents` · `GET /api/v1/pcmso-documents/{id}`. Tela: `/companies/{id}/pcmso`. O leiaute final (DOCX/PDF) depende do modelo do Dr. Alcides (MED-08), ainda não recebido.

### PCMSO assinado (versão oficial) — NOB-166

> **Vigência única (lote 4, migration 0082):** por empresa há no máximo **um** PCMSO assinado vigente; nova versão (inclusive de novo ciclo) é sempre substituição. Gatilho `pcmso_signed_current_guard` (AFTER INSERT, mesma trava do app). Conflito → `DUPLICATE` (409). Legado ambíguo → `currentId: null`, aviso `signed_current_ambiguous` e nova versão bloqueada até a regularização.

O médico responsável pelo PCMSO (NR-7 7.4.1 c) responde pelo programa (7.5.4). A NR-7 **não** traz, para o PCMSO, uma exigência de assinatura documental idêntica à do ASO (7.5.19.1 g): o fluxo de assinatura e arquivo vem do requisito aprovado em MED-12. Migration `0075_pcmso_signed_documents`; core `server/medicine/pcmso-signed-core.ts`; regras puras em `domains/medicine/pcmso-signed.ts`.

- **O que vira oficial:** o PDF da **prévia mais recente** da empresa (com o mesmo hash), ligada ao **plano de exames aprovado vigente**, assinado pelo **coordenador designado vigente** (CRM/UF do cadastro).
  - Prévia antiga, de outra empresa ou de plano superado é recusada.
  - Uma versão antiga não é reescrita para parecer atual.
- **Base de riscos (NR-7 7.5.1 e 7.5.5; SEG-21):** a prévia (`content.riskBasis.sources`) e o plano aprovado (`based_on.sources`) precisam ter exatamente as **fontes de riscos vigentes** da empresa (não substituídas), com as mesmas versões. O registro é recusado, falhando fechado, quando:
  - o PGR interno de origem mudou ou ficou indisponível (impressão digital recalculada na transação);
  - os riscos validados mudaram depois da prévia (validação ou rejeição na mesma fonte);
  - os riscos validados mudaram depois da aprovação do plano (`based_on.riskIds` ≠ conjunto vigente; plano legado sem `riskIds` só é conferido pelas fontes);
  - a fonte foi substituída ou removida;
  - não há fonte conferível.
  - Nenhuma classificação clínica automática: qualquer divergência exige nova conferência, novo plano (se for o caso) e nova prévia. Não existe justificativa livre que libere o bloqueio.
  - **Concorrência:** registro de fonte, revisão técnica de risco e registro do PCMSO assinado tomam a mesma trava transacional da base de riscos da empresa (`pg_advisory_xact_lock`).
  - **Banco:** a policy de inclusão confere fontes e versões dos snapshots da prévia e do plano contra as fontes vigentes. Também confere o **resumo da base de riscos** calculado no próprio banco, que precisa ser igual ao gravado na prévia.
    - O resumo vem de `public.medical_risk_basis_digest(org, empresa)`: SECURITY INVOKER, `search_path` fixo, EXECUTE só para o `app_runtime`.
    - Ele cobre as fontes vigentes com versão, a situação de cada risco e o conteúdo atual do PGR interno de origem (data, revisão e riscos com a última avaliação).
    - A prévia grava esse resumo na geração (`pcmso_documents.risk_basis_digest`), e a policy da prévia impede forjá-lo.
    - Mudança de conteúdo do PGR sem nova versão da fonte, ou risco validado depois da prévia, é recusada também por INSERT direto (`42501`).
    - Prévias anteriores à 0075 não têm resumo e precisam ser geradas de novo.
  - Depois de registrado, se a base mudar, o vigente ganha o alerta `risk_basis_changed`.
- **Hash da prévia × hash do PDF:** `previewSha256` identifica o snapshot JSON da prévia que fundamentou o documento. `fileSha256` identifica os bytes do PDF assinado. Os dois são diferentes por natureza, e a diferença não é motivo de recusa.
- **Quem registra:**
  - `coordinator`: o próprio médico responsável, pela conta vinculada e com identidade verificada (`actor_clinical_medico_ids`, NOB-158);
  - `office_received`: a equipe do escritório arquiva o documento que o médico responsável assinou.
  - O owner não vira signatário por escolher um nome. Colaborador e coordenador de outra empresa são barrados.
- **Signatário (NOB-110):** o CRM/UF informado é conferido com o coordenador designado vigente pela forma canônica do número (só separadores `.`, `-`, `/` e espaço são ignorados; zeros à esquerda contam; UF sem diferenciar maiúsculas). É conferência de consistência: no fluxo `coordinator`, quem registra continua decidido pela conta vinculada e verificada. O documento grava o CRM/UF como estão no cadastro; CRM do cadastro com letras é recusado até a correção do cadastro. O alerta de médico responsável trocado usa a mesma conferência (reformatar o CRM não é troca).
- **Prévia nomeia quem assina:** o médico responsável impresso na prévia (`content.coordinator`, CRM/UF) precisa ser o coordenador em vigor hoje, pela mesma forma canônica. Depois de uma troca, a prévia antiga (que nomeia o anterior) é recusada (`422`: "a prévia nomeia outro médico responsável; gere nova prévia"); a policy de inclusão repete a regra (INSERT direto → `42501`). A data mínima da assinatura é o início mais recente entre a designação impressa na prévia e a vigente. Documento já registrado nessa situação ganha o alerta `preview_coordinator_mismatch`.
- **Conferência:** só **documental**:
  - `verificationKind = 'documentary'`, o único valor que o CHECK aceita;
  - `verificationReference`: relatório do validador, código da plataforma ou guarda do original físico.
  - O sistema não valida assinatura criptograficamente. O hash e o cabeçalho do PDF provam integridade, não autoria. A tela diz "conferida documentalmente (sem validação criptográfica)".
- **Datas:** a assinatura não é futura, não é anterior à prévia nem à designação do médico, e fica dentro do ciclo da prévia.
- **Versões (MED-11 e MED-14):**
  - um PCMSO assinado vigente por empresa; o novo substitui o vigente com `changeKind` e motivo;
  - tipos: `administrative` (ex.: troca do médico responsável), `documentary_update`, `clinical_revision` ou `correction`;
  - substituição só dentro da mesma empresa e tenant (FK composta);
  - cada documento é substituído no máximo uma vez;
  - registros concorrentes da mesma empresa são serializados.
- **Alertas** (derivados, sem reescrever nada): base de riscos alterada, prévia mais recente que a assinada, plano aprovado trocado, médico responsável trocado, prévia que nomeia outro médico que o signatário (`preview_coordinator_mismatch`) e ciclo encerrado.
- **Arquivo:**
  - PDF conferido pelo cabeçalho, até 25 MB;
  - SHA-256 no servidor;
  - bucket privado `documents`, caminho `{org}/pcmso-assinados/{empresa}/{id}.pdf`, que nunca sai na API;
  - URL assinada de 60 s;
  - se o registro falha, o arquivo é removido.
- **Só inclusão:** sem UPDATE ou DELETE para o `app_runtime`. O papel `identity_verifier` não tem acesso.

| Action                         | Entrada                                       | Retorno                             |
| ------------------------------ | --------------------------------------------- | ----------------------------------- |
| `listSignedPcmsosAction`       | `companyId`                                   | `{ items, currentId, warnings }`    |
| `registerSignedPcmsoAction`    | `companyId, FormData` (`file` + campos acima) | documento registrado                |
| `getSignedPcmsoDownloadAction` | `id`                                          | `{ url, expiresInSeconds, sha256 }` |

REST: `GET|POST /api/v1/companies/{id}/signed-pcmsos` (POST multipart, `201`) · `GET /api/v1/signed-pcmsos/{id}/download`. Tela: seção "PCMSO assinado (versão oficial)" em `/companies/{id}/pcmso`.

## Critérios de interpretação e condutas — `actions/medicine/interpretation-criteria.ts`

Critérios de interpretação dos achados e planejamento das condutas por exame (NOB-153, NR-7 7.5.4 c), em `domains/medicine/interpretation-criteria.ts` e `server/medicine/interpretation-criteria-core.ts`. Migration `0065_pcmso_interpretation_criteria`.

**Autoria médica.**

- O texto é do médico coordenador. O sistema não gera, não sugere e não completa texto clínico (DT-23, MED-19/20).
- Só a conta vinculada (NOB-149) ao coordenador com designação em vigor hoje (NOB-109) registra, e a versão fica em nome desse médico (`authored_by_medico_id`).
- Equipe, owner, vínculo revogado ou designação encerrada → `403`. A RLS repete a regra.

**Versões (`pcmso_interpretation_criteria`).**

- Cada registro é uma versão por procedimento (código da Tabela 27; o 9999 casa pela descrição).
- `app_runtime` só com SELECT e INSERT. A vigente é a mais recente, e as anteriores ficam no histórico.
- Critério e conduta são obrigatórios, até 5.000 caracteres.

**PCMSO.**

- A conferência deixou de marcar o item `interpretation_criteria` como etapa inexistente. Ele passa a ser aviso, com a lista dos exames do plano aprovado sem critério. Sem plano aprovado, o item não aparece.
- A composição (conteúdo v2) traz a seção `interpretation`: por exame mantido, o critério e a conduta vigentes, com autor e versão, ou "pendente de definição pelo médico coordenador".
- Prévias v1 já arquivadas continuam como estão.

| Action                                | Entrada                                                        | Retorno (`data`)                         |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `listInterpretationCriteriaAction`    | `companyId`                                                    | `{ approvedPlanVersion, rows, missing }` |
| `interpretationCriteriaHistoryAction` | `companyId, code`                                              | versões, da mais recente à mais antiga   |
| `defineInterpretationCriteriaAction`  | `companyId, { code*, otherDescription?, criteria*, conduct* }` | nova versão (só o coordenador vinculado) |

REST: `GET|POST /api/v1/companies/{id}/interpretation-criteria` · `GET /api/v1/companies/{id}/interpretation-criteria/{code}`. Tela: `/companies/{id}/interpretation-criteria`.

## Relatório analítico anual — `actions/medicine/analytical-reports.ts`

Relatório analítico anual do PCMSO (NOB-154, NR-7 7.6.2 a 7.6.6), em `domains/medicine/analytical-report.ts` e `server/medicine/analytical-report-core.ts`. Migration `0066_pcmso_analytical_reports`.

**Elaboração (7.6.2).**

- Só a conta vinculada (NOB-149) ao coordenador com designação em vigor hoje (NOB-109) elabora, e a versão fica em nome desse médico.
- Owner, colaborador, cliente e vínculo revogado → `403`. A RLS repete a regra.

**Período.**

- Anual a partir do último relatório: começa no dia seguinte ao fim do anterior, vai até 12 meses e não termina no futuro.
- O primeiro relatório tem início livre.
- Período fora da regra → `422`. O contexto sugere o próximo período.

**Conteúdo, só com dados reais e consolidados** (nenhum nome, CPF, número de CAT ou resultado individual):

- a) exames clínicos com data no período, realizados nesta empresa (origem registrada ou confirmada, MED-07):
  - registros repetidos (funcionário, tipo e data) contam uma vez;
  - por tipo de exame;
  - exames sem origem comprovada ficam fora e são informados à parte;
- b) exames complementares do período por procedimento (código e descrição da Tabela 27);
- c) resultados anormais e d) doenças relacionadas ao trabalho: o sistema não registra resultados nem diagnósticos, então o item sai como **informação insuficiente** (7.6.4), nunca zero, e nada é inferido;
- e) CAT com número registrado no módulo de incidentes, não canceladas, com emissão no período, por tipo (típico, trajeto, doença ocupacional):
  - CAT sem data de emissão são informadas à parte;
  - a plataforma não emite CAT nem integra com o eSocial, e zero não comprova ausência;
- f) comparação com o relatório anterior do sistema, só de indicadores equivalentes (CAT só se os dois relatórios a tiverem):
  - com relatório anterior, a **discussão das variações é obrigatória e escrita pelo coordenador**;
  - sem anterior, o item registra que não há comparação.

**Demais itens da NR-7.**

- 7.6.3: o sistema não registra transferência de prontuários, e isso fica declarado.
- 7.6.4: campo de insuficiência preenchido pelo coordenador.
- 7.6.5: a apresentação a SST e CIPA fica como pendência explícita.
- 7.6.6: relatório simplificado (só a e b) apenas para GR 1–2 com até 25 empregados ou GR 3–4 com até 10, contados no cadastro na data da geração. Fora disso → `422`.
- 7.7.4: porte e dispensa de PCMSO não são cadastrados, então a dispensa sai como "não verificável", nunca presumida.

**Arquivo.**

- `pcmso_analytical_reports`: versão imutável com `content_sha256`, `CHECK status = 'preview'` e referência ao relatório anterior (FK composta).
- `app_runtime` só com SELECT e INSERT.

**PCMSO.**

- A conferência deixou de marcar `analytical_report` como etapa inexistente. Sem relatório elaborado, vira aviso, com link para a tela.
- A composição (conteúdo v3) referencia o último relatório (versão, período e SHA-256) ou registra a pendência.
- Documentos já arquivados não mudam.

| Action                             | Entrada                                                                                          | Retorno (`data`)                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `listAnalyticalReportsAction`      | `companyId`                                                                                      | versões sem conteúdo                                                 |
| `getAnalyticalReportAction`        | `id`                                                                                             | versão com `content` e `contentSha256`                               |
| `getAnalyticalReportContextAction` | `companyId, { periodStart, periodEnd }?`                                                         | `{ previous, suggestedPeriod, period, issues, eligibility, totals }` |
| `generateAnalyticalReportAction`   | `companyId, { periodStart*, periodEnd*, simplified?, variationDiscussion?, insufficiencyNote? }` | versão arquivada (só o coordenador vinculado)                        |

REST:

- `GET|POST /api/v1/companies/{id}/analytical-reports`;
- `GET /api/v1/companies/{id}/analytical-reports/context`;
- `GET /api/v1/analytical-reports/{id}`.

### Finalização, apresentação e discussão — NOB-168

NR-7 7.6.5: o relatório analítico deve ser apresentado e discutido com os responsáveis por segurança e saúde no trabalho da organização, incluindo a CIPA, quando existente. Migration `0077_pcmso_report_presentation`; tabela `pcmso_analytical_report_events`, só de inclusão; core `server/medicine/analytical-report-presentation-core.ts`; regras em `domains/medicine/analytical-report-presentation.ts`.

- **Versão finalizada:** a NOB-154 só gera prévias. O evento `finalized` é feito pelo médico responsável que elaborou a versão, com conta vinculada e verificada e ainda designado. Só uma versão finalizada é apresentada; prévia sozinha não.
- **Apresentação (`presented`):** ato já realizado, com data não futura e não anterior à versão, modalidade, participantes por função (nome opcional, sem dado pessoal além disso), situação da CIPA e referência da ata.
  - Agendar, gerar ou baixar o arquivo não conta.
- **Discussão (`discussed`):** síntese agregada e medidas e encaminhamentos propostos, com responsável e prazo só quando definidos. Ficam como **propostos**, não executados. Exige apresentação vigente.
- **CIPA:**
  - `participated` exige o representante da CIPA entre os participantes;
  - `not_constituted` exige a referência da verificação (cadastro vazio não prova nada);
  - `exists_not_participated` e `unknown` impedem declarar a exigência atendida (`cipaRequirementMet = false`).
  - SESMT não é obrigatório.
- **Situação derivada:** sem relatório, não finalizada, apresentação pendente, discussão pendente, apresentação e discussão registradas. Nova versão não herda a apresentação anterior (aviso `previousVersionPresented`).
- **Correção (`voided`):** com motivo; o registro corrigido perde efeito e fica no histórico. A finalização só é corrigida pelo médico autor.
- **Cronologia (datas civis, America/Sao_Paulo):** cada apresentação guarda a finalização em que se apoia e cada discussão guarda a apresentação (`basis_id`). A apresentação não pode ser anterior ao dia da finalização e a discussão não pode ser anterior à apresentação, mesmo que o registro seja inserido depois. Corrigida a finalização (ou a apresentação), os atos que dependiam dela perdem efeito e não são reaproveitados por uma nova finalização; continuam no histórico.
- **Banco:**
  - a policy de inclusão exige ator como autor, versão exata (hash) da empresa, versão vigente (exceto correção), finalização só pelo médico autor verificado e demais registros só pela equipe do escritório;
  - o trigger `pcmso_report_event_guard` (SECURITY INVOKER, `search_path` fixo) exige que o ato de base (`basis_id`) seja a finalização vigente (apresentar) ou uma apresentação vigente com finalização vigente (discutir), data não anterior ao ato de base, nenhuma finalização dupla e correção válida;
  - sem UPDATE ou DELETE para o `app_runtime`.
- **Privacidade:** nenhum dado clínico individual; o relatório já é agregado. Não há anexos nesta fatia: a ata entra como referência textual.

| Action                         | Entrada                              | Retorno                        |
| ------------------------------ | ------------------------------------ | ------------------------------ |
| `listReportPresentationAction` | `companyId`                          | `{ current, summary, events }` |
| `registerReportEventAction`    | `companyId, reportId, { kind, ... }` | evento registrado              |
| `voidReportEventAction`        | `companyId, eventId, { reason* }`    | evento de correção             |

REST:

- `GET /api/v1/companies/{id}/analytical-report-events`;
- `POST /api/v1/analytical-reports/{id}/events` (`201`);
- `POST /api/v1/analytical-report-events/{id}/void` (`201`).

Tela: seção "Apresentação e discussão (NR-7 7.6.5)" em `/companies/{id}/analytical-report`.

Tela: `/companies/{id}/analytical-report`.

## Gestão de Saúde Ocupacional (ASO) — `actions/pgr/health-exams.ts`

Exames ocupacionais/ASO por funcionário (fatia 027). Cada exame liga-se a um **funcionário**
(`ON DELETE CASCADE`) e, opcionalmente, ao **médico responsável** (FK → `medicos`,
`ON DELETE NO ACTION` desde a 0081, antes `SET NULL` — excluir o médico examinador é recusado com `IN_USE`;
o exame mantém quem examinou). O status de **validade**
(vigente/a vencer/vencido) é **derivado na leitura** de `valid_until` (nullable), via
`classifyDocumentValidity`; o badge da tela combina validade + **aptidão** (apto / apto c/ restrição /
inapto — `examBadge`). Sem `/dependents`. **`GET`** aceita `?search=` (nome do funcionário **ou**
rótulo do tipo de exame — ex.: "periód" casa exames `periodic`), `?examType=`, `?employeeId=` e
`?companyId=` (empresa **atual** do funcionário — `employees.company_id`). Desde a NOB-152 o exame
guarda também a empresa onde foi realizado (`health_exams.company_id`, MED-07), usada pelo ASO. Os filtros são **somados** ao tenant da
sessão: ID de outro tenant → lista vazia; ID malformado → `VALIDATION` (`422`), nunca lista vazia.
Janela de "a vencer": `EXAM_DUE_WINDOW_DAYS = 30` (`domains/pgr/health-exams.ts`). REST espelho em
`/api/v1/health-exams` (GET, POST) · `/api/v1/health-exams/{id}` (GET, PUT, DELETE).

**Médico responsável na edição:** o `PUT` (e a Action) recusa **apagar** o médico (`doctorId`
ausente) de exame que já tem prévia de ASO, ASO assinado ou confirmação do examinador → `422
VALIDATION`; trocar por outro médico continua permitido. A tela de edição lista só médicos ativos e
acrescenta o médico gravado no exame quando ele não está na lista (rótulo "· CRM (inativo)"), para
que salvar não apague o examinador.

**Validações de entrada (Lote 02A, NOB-112; mesmas regras na Action e no REST, `422 VALIDATION`):**
`validUntil` (opcional) não pode ser anterior a `performedAt` (igual é permitido; datas comparadas
como calendário, sem fuso) → `fields.validUntil = "Vencimento anterior à realização."`; `examType`
fora do enum é recusado (no corpo e no filtro `?examType=`, que antes era ignorado);
`certificatePath` ≤ 500 caracteres (após `trim`; limite só da aplicação, colunas inalteradas); corpo
JSON malformado → `422`. No `PUT`, `employeeId` precisa ser o funcionário atual do exame: troca →
`422 VALIDATION` (o exame não muda de funcionário). Nenhuma validade é calculada: o vencimento continua
informado.

| Action                   | Entrada                                                             | Retorno (`data`)                                                       |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `listHealthExamsAction`  | `{ search?, examType?, employeeId?, companyId?, page?, pageSize? }` | `{ rows: HealthExamListItem[]; total }` (ID malformado → `VALIDATION`) |
| `getHealthExamAction`    | `id`                                                                | `HealthExam` (null → `NOT_FOUND`)                                      |
| `createHealthExamAction` | `HealthExamInput`                                                   | `HealthExam` (FK inválida → `FK_NOT_FOUND`)                            |
| `updateHealthExamAction` | `id, HealthExamInput`                                               | `HealthExam`                                                           |
| `deleteHealthExamAction` | `id`                                                                | `{ id }`                                                               |

**`HealthExamInput`**: `{ employeeId*, doctorId?, examType*, performedAt* (não-futura), validUntil?,
aptitude*, certificatePath? }`. `examType` = `admissional|periodic|change_of_function|
return_to_work|dismissal`; `aptitude` = `fit|fit_with_restrictions|unfit`.

**Observações clínicas (NOB-155).** Saíram do cadastro de exames e ficam no prontuário segregado:

- `notes` preenchido no corpo → `422 VALIDATION` (`fields.notes`), sem ecoar o texto; vazio ou `null` é ignorado.
- Nenhuma leitura do exame (Action, REST, listas, painel, ASO) devolve `notes`.
- Exame ou funcionário com prontuário ou comunicação de restrição não é excluído → `409 IN_USE`.

## Afastamentos — `actions/medicine/absences.ts`

Afastamentos e alertas de exame de retorno (NOB-139, MED-23), em `domains/medicine/absences.ts`, `server/medicine/absence-core.ts` e `repositories/employee-absences.ts`. Migration `0070_medical_employee_absences`. Seção "Afastamentos" na ficha do funcionário (`/employees/{id}`), visível com Medicina habilitada.

**Registro administrativo** (`employee_absences`): nunca guarda CID, diagnóstico ou atestado.

- **Campos:** causa (`illness` | `accident` | `other`), relação com o trabalho só se informada (`occupational` | `non_occupational` | `not_determined`; o sistema não decide nexo), início, último dia quando conhecido (`endsOn`) e retorno confirmado (`returnedOn`).
- **Empresa:** a do vínculo atual do funcionário, definida no servidor.
- **Validações (`422`):** fim anterior ao início; período que se sobrepõe a outro afastamento não cancelado do funcionário (fim desconhecido conta como em aberto; checagem serializada por funcionário); retorno no futuro ou antes do início.
- **Mudanças:**
  - o afastamento aberto aceita a previsão do fim (`PUT`), a confirmação do retorno (o último dia passa a ser a véspera) e o cancelamento com motivo;
  - com retorno confirmado ou cancelado, não muda mais;
  - sem DELETE: cada mudança fica em `employee_absence_events`, só inclusão;
  - o `app_runtime` só tem UPDATE nas colunas de previsão, retorno e cancelamento, e as policies conferem o autor.

**Avaliação (derivada na leitura; é sugestão, não decisão):**

- **Exame de retorno (NR-7 7.5.9, reaproveita `suggestReturnToWorkExam`):**
  - 29 dias: não exigido;
  - 30 dias ou mais: sugerido antes de reassumir as funções;
  - em andamento sem fim: "acompanhar" até somar 30 dias, sem presumir data final;
  - "outro motivo": a regra não se aplica automaticamente;
  - o retorno só conta como realizado com a data confirmada;
  - o exame de retorno conta como registrado quando há exame `return_to_work` a partir do início;
  - o agendamento não é controlado aqui;
  - nenhum ASO é emitido ou alterado, e a aptidão e o retorno gradativo (7.5.9.1) são do médico.
- **NR-7 7.5.19.5 c (sinalização informativa):**
  - só para doença ou acidente informado como relacionado ao trabalho e com mais de 15 dias;
  - o sistema não decide nexo ou incapacidade, não emite CAT e não registra o encaminhamento como feito;
  - fora desse contexto, não sinaliza.

**Área clínica** (`employee_absence_clinical_notes`):

- Atestado e CID; só a conta vinculada ao coordenador do PCMSO com designação em vigor hoje (NOB-109) lê e grava (servidor e RLS).
- O CID exige a autorização do trabalhador registrada (referência do termo); o formato CID-10 é conferido também no banco.
- Só inclusão. Funcionário com área clínica de afastamento não é excluído (`409`).
- Cada leitura e gravação vai para `absence_clinical_access_events`, sem conteúdo.
- Owner, colaborador, RH e outros médicos → `403`; cliente → `403`; outro tenant → `404`.

| Action                           | Entrada                                                     | Retorno (`data`)                      |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `listAbsencesAction`             | `employeeId`                                                | afastamentos com `assessment`         |
| `getAbsenceAction`               | `id`                                                        | afastamento, `assessment` e `events`  |
| `createAbsenceAction`            | `employeeId, { cause*, workRelation?, startsOn*, endsOn? }` | afastamento                           |
| `updateAbsenceEndAction`         | `id, { endsOn \| null }`                                    | afastamento                           |
| `confirmAbsenceReturnAction`     | `id, { returnedOn* }`                                       | afastamento                           |
| `cancelAbsenceAction`            | `id, { reason* }`                                           | afastamento                           |
| `readAbsenceClinicalNotesAction` | `id`                                                        | registros clínicos (leitura auditada) |
| `addAbsenceClinicalNoteAction`   | `id, { content?, cid?, workerAuthorization? }`              | registro clínico                      |

REST:

- `GET|POST /api/v1/employees/{id}/absences`;
- `GET|PUT /api/v1/absences/{id}`;
- `POST /api/v1/absences/{id}/return` · `POST /api/v1/absences/{id}/cancel`;
- `GET|POST /api/v1/absences/{id}/clinical-notes`.

Tela clínica: `/absences/{id}/clinical`.

## Prontuário segregado — `actions/medicine/clinical-record.ts`

Prontuário clínico do exame (NOB-155, DT-21, MED-10/17), em `domains/medicine/clinical-record.ts`, `server/medicine/clinical-record-core.ts` e `repositories/clinical-records.ts`. Migration `0067_health_exam_clinical_records`.

**Quem acessa.**

- Só a conta vinculada (NOB-149) ao médico ativo que é:
  - o examinador do exame; ou
  - o coordenador com designação em vigor hoje (NOB-109) da empresa onde o exame foi realizado (MED-07). Exame sem origem comprovada → só o examinador.
- Owner, colaborador, médico sem relação com o exame, vínculo revogado, designação encerrada, profissional inativo e conta fora do escritório → `403`. Cliente → `403`; outro tenant → `404`.
- As policies da 0067 repetem a regra no banco, para o papel `app_runtime`, com o ator da sessão.

**Observações clínicas** (`health_exam_clinical_notes`).

- Só inclusão, sem UPDATE nem DELETE: uma correção entra como nova observação.
- A autoria (médico e conta) vem do servidor.
- As antigas `health_exams.notes` foram migradas como `legacy_exam_notes`:
  - na mesma transação, com conferência de integridade;
  - com a data da última alteração do exame e sem autoria médica presumida.
- O campo antigo ficou vazio, e o CHECK `ck_health_exams_notes_retired` impede gravar nele, inclusive pelo `app_runtime`. A remoção física da coluna fica para uma migration posterior.

**Comunicação de restrição ao RH** (`health_exam_work_restrictions`).

- É o único texto do médico que o RH lê: a restrição funcional ao trabalho, sem diagnóstico.
- Texto com código CID ou com a palavra "CID" → `422`.
- Fica fora do ASO.
- Só inclusão; a vigente é a mais recente. `withdrawal` registra que as restrições deixaram de valer.

**CID.** O sistema não coleta nem guarda CID, então nada clínico vai para o ASO ou para o RH.

**Auditoria** (`clinical_record_access_events`).

- Cada leitura e cada gravação registra o exame, o médico, a base (examinador ou coordenador), a ação, a conta e a data, nunca o conteúdo.
- Só inclusão, e só em nome da própria conta autorizada.
- Leem a trilha o owner e a própria conta.
- Negativas vão para o log de eventos do tenant, sem conteúdo.

| Action                           | Entrada                           | Retorno (`data`)                           |
| -------------------------------- | --------------------------------- | ------------------------------------------ |
| `getClinicalAccessAction`        | `examId`                          | `{ allowed, basis }` (não registra acesso) |
| `readClinicalRecordAction`       | `examId`                          | `{ basis, notes[] }` (leitura auditada)    |
| `addClinicalNoteAction`          | `examId, { content* }`            | observação criada                          |
| `listWorkRestrictionsAction`     | `examId`                          | comunicações, da vigente à mais antiga     |
| `recordWorkRestrictionAction`    | `examId, { kind*, restriction? }` | comunicação criada (só o médico vinculado) |
| `listClinicalAccessEventsAction` | `examId`                          | trilha sem conteúdo (só owner)             |

REST:

- `GET|POST /api/v1/health-exams/{id}/clinical-notes`;
- `GET|POST /api/v1/health-exams/{id}/work-restrictions`;
- `GET /api/v1/health-exams/{id}/clinical-access-events`.

Telas:

- `/health-exams/{id}/clinical-record` (médico vinculado);
- `/health-exams/{id}/edit` mostra ao RH só a restrição vigente e, ao owner, a trilha de acesso.

## ASO — conferência e prévias — `actions/medicine/aso.ts`

Primeira entrega do ASO (NOB-152, filha da NOB-110), em `domains/medicine/aso.ts` e `server/medicine/aso-core.ts`. Migration `0064_aso_previews`.

**Empresa do exame (MED-07).**

- `health_exams.company_id` guarda a empresa onde o exame foi realizado, com `company_origin`:
  - `registered`: gravada pelo servidor na criação, a partir do vínculo do funcionário. O cliente nunca informa. Um INSERT sem a coluna é preenchido pelo trigger `health_exams_set_company`;
  - `confirmed`: exame antigo confirmado pelo responsável (`owner`), com justificativa (10 a 1.000 caracteres). Ficam registrados autor, data e motivo;
  - nula: exame anterior à 0064. **Sem backfill**, porque a empresa atual do funcionário pode não ser a do exame (transferência). A origem não comprovada bloqueia o ASO (`exam_company_unverified`), os exames complementares e a prévia (também pela RLS).
- Depois de registrada, a empresa não muda: o trigger recusa com `23514`.
- A transferência do funcionário não leva o exame junto. Exame de outra empresa bloqueia o ASO da empresa atual (`exam_other_company`).

**Exames complementares realizados (`health_exam_procedures`).**

- Cada registro tem o código da Tabela 27 e a data, que não pode ser futura. O código 9999 exige descrição.
- O resultado clínico não é registrado.
- Herdam a empresa do exame. `app_runtime` tem SELECT, INSERT e DELETE; não tem UPDATE.

**Conferência (NR-7 7.5.19.1).** Cada bloqueio ou aviso aponta para um item de a a g:

- a) razão social e CNPJ (o CAEPF ainda não é aceito);
- b) nome, CPF e função;
- c) riscos validados de fonte vigente, do GES e da função. Os casos são distintos:
  - riscos pendentes bloqueiam (`risks_pending`);
  - sem fonte utilizável bloqueia (`risk_source`);
  - sem risco validado para o grupo bloqueia (`risks_absence_not_declared`). A ausência de cadastro não comprova ausência de risco; a declaração de inexistência (DT-12) ainda não existe;
- d) exame clínico e complementares com data. Exame do plano aprovado sem registro gera aviso; a indicação é do médico;
- e) apto ou inapto. Sem examinador, bloqueia (MED-01).
  - "Apto" e "inapto" registrados valem como estão.
  - "Apto com restrição" **não é convertido**: bloqueia (`aptitude_confirmation_required`) até o médico examinador do exame confirmar apto ou inapto pela conta vinculada a ele (NOB-149). Ver `aso_examiner_conclusions` abaixo.
  - O registro original do exame não muda, e a descrição da restrição fica fora do ASO (MED-10, DT-21);
- f) médico responsável pelo PCMSO vigente na data do exame. Gera aviso se não houver;
- g) examinador médico com CRM e UF. Há sempre o aviso de assinatura indisponível (MED-12).

**Prévias (`aso_documents`).**

- Cada versão é imutável, com `content_sha256`.
- `CHECK status = 'preview'`. A RLS exige exame com examinador e `generated_by` = ator.
- `app_runtime` só com SELECT e INSERT.
- O conteúdo nunca inclui `notes` nem `certificatePath`.
- Excluir exame ou funcionário com prévia → `409 IN_USE` (o histórico é preservado).

**Confirmação do examinador (`aso_examiner_conclusions`).**

- Só inclusão: `app_runtime` com SELECT e INSERT.
- Só a conta vinculada ao médico examinador do exame confirma: vínculo aberto, médico ativo, CRM e membro do escritório. O papel no escritório (owner, colaborador, coordenador) não substitui o vínculo → `403`. A RLS repete a regra.
- Só vale para exame registrado como "apto com restrição" (`CHECK recorded_aptitude`); outros → `422`.
- A confirmação vigente é a mais recente do examinador atual sobre o registro atual. Trocar o examinador ou a aptidão a invalida.

| Action                            | Entrada                                              | Retorno (`data`)                                          |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `getAsoReadinessAction`           | `examId`                                             | `{ items, checklist }`                                    |
| `listExamProceduresAction`        | `examId`                                             | procedimentos realizados                                  |
| `addExamProcedureAction`          | `examId, { code*, otherDescription?, performedAt* }` | procedimento (`DUPLICATE` se repetido)                    |
| `removeExamProcedureAction`       | `examId, procedureId`                                | —                                                         |
| `listAsoDocumentsAction`          | `examId`                                             | versões sem conteúdo                                      |
| `getAsoDocumentAction`            | `id`                                                 | versão com `content` e `contentSha256`                    |
| `generateAsoDocumentAction`       | `examId`                                             | versão arquivada (`preview`); com bloqueio → `VALIDATION` |
| `confirmExamCompanyOriginAction`  | `examId, { justification* }`                         | `{ id, companyId, companyOrigin: "confirmed" }` (owner)   |
| `listExaminerConclusionsAction`   | `examId`                                             | confirmações, da mais recente à mais antiga               |
| `confirmExaminerConclusionAction` | `examId, { conclusion* }` (`fit` \| `unfit`)         | confirmação (só o examinador vinculado)                   |

REST:

- `GET|POST /api/v1/health-exams/{id}/procedures` · `DELETE /api/v1/health-exams/{id}/procedures/{procedureId}`;
- `GET /api/v1/health-exams/{id}/aso-readiness`;
- `POST /api/v1/health-exams/{id}/company-origin` (`200`, owner);
- `GET|POST /api/v1/health-exams/{id}/examiner-conclusions` (`201`, examinador vinculado);
- `GET|POST /api/v1/health-exams/{id}/aso-documents` · `GET /api/v1/aso-documents/{id}`.

Tela: `/health-exams/{id}/aso`.

Ficam fora (NOB-110):

- leiaute final (MED-08);
- entrega digital pelo portal do trabalhador (NOB-122).

### ASO assinado (documento oficial) — NOB-163

> **Vigência única (lote 4, migration 0082):** por exame há no máximo **um** ASO assinado vigente (o que nenhum outro substitui). O banco impõe a regra também para SQL direto da role da aplicação e sob concorrência: gatilho `aso_signed_current_guard` (AFTER INSERT, depois da RLS, com `pg_advisory_xact_lock` do exame). Nova raiz com vigente existente → `DUPLICATE` (409) "Já existe um documento assinado vigente…"; use a substituição. Legado com mais de uma vigente (anterior à 0082) → nenhuma é escolhida: listagem sem vigente, substituição e entrega → `DUPLICATE` (409) pedindo regularização autorizada. Quem não pode gravar continua recebendo `FORBIDDEN` antes do conflito.

O ASO oficial é o PDF **assinado pelo médico examinador** (NR-7 7.5.19.1 g). O sistema **não assina** e não presume assinatura: registra o documento, o método e a conferência. Migration `0073_aso_signed_documents`; core `server/medicine/aso-signed-core.ts`; regras puras em `domains/medicine/aso-signed.ts`.

- **Fluxo A (`examiner`):**
  - só a conta do médico examinador do exame, com identidade verificada (`actor_clinical_medico_ids`, NOB-158);
  - CRM/UF do signatário iguais ao cadastro do examinador — conferência de **consistência**, que nunca autoriza sozinha (quem registra vem do `doctorId` do exame + conta vinculada e verificada);
  - prévia (`previewDocumentId`) do mesmo exame, com a mesma conclusão;
  - a prévia precisa ser a **mais recente** do exame **e** ainda a composição atual: o `content_sha256` dela tem de ser igual ao SHA-256 de `composeAso` sobre os dados de hoje (mesma montagem de `generateDocument`), sem bloqueio na conferência (espelho da regra do PCMSO assinado). Prévia antiga, exame editado depois da prévia (aptidão, data, tipo, examinador, exames complementares) ou conferência com bloqueio → `VALIDATION` "A prévia escolhida não corresponde mais ao exame (ou não é a mais recente). Gere uma nova prévia e assine-a." A conferência roda **antes do upload** (nada vai ao storage) e de novo no registro, com o exame travado (`FOR UPDATE`). A tela oferece só a prévia mais recente; as anteriores ficam em "Versões arquivadas".
- **Formato do CRM (NOB-110):**
  - `signerRegistration` aceita dígitos com ponto, hífen, barra ou espaço (até 10 dígitos); letras são recusadas (a UF vai em `signerUf`, sem diferenciar maiúsculas);
  - a conferência com o cadastro usa a forma canônica (`canonicalRegistrationNumber` em `domains/pgr/medicos.ts`): tira só os separadores e mantém os dígitos como estão — `12.345` = `12345`, mas `012345` ≠ `12345`;
  - no fluxo A, o documento grava o CRM/UF **como estão no cadastro** do examinador (o que a prévia imprime e o que a RLS confere por igualdade exata). O cadastro nunca é reescrito;
  - cadastro com letras ou outros caracteres no CRM (ex.: `12345-MA`, `CRM 12.345/MA`) não é adivinhado: o registro é recusado (`VALIDATION`) até o escritório corrigir o cadastro — o que, pela NOB-158, exige nova verificação de identidade;
  - a verificação de identidade (NOB-158) continua comparando o CRM conferido com o cadastro por igualdade exata.
- **Fluxo B (`external_clinic`):** a equipe do escritório (owner ou colaborador) arquiva o ASO assinado entregue pela clínica, com o signatário como consta no documento. Sem prévia.
- **Conferência obrigatória (`verificationReference`):**
  - ICP-Brasil ou plataforma: referência do validador (ex.: Verificador ITI);
  - manual: local de guarda do original físico.
- **Integridade:** PDF conferido pelo cabeçalho, até 25 MB. SHA-256 calculado no servidor. Bucket privado `documents`, caminho `{org}/aso-assinados/{exame}/{id}.pdf`, nunca vindo do cliente. Se o registro falha, o arquivo é removido.
- **Substituição (MED-11):**
  - com documento vigente, o novo registro precisa de `replacesId` (o vigente) e `replaceReason` (pelo menos 10 caracteres);
  - cada documento é substituído no máximo uma vez (índice único);
  - a substituição fica no mesmo exame (FK composta);
  - o anterior continua acessível.
- **ASO vigente divergente do exame (MED-11):** a edição do exame (aptidão, data, tipo, examinador) e dos exames complementares continua livre — bloquear impediria a própria correção, que exige nova prévia. Em vez disso, `listSignedAsos` marca o **vigente** com `outdated` (`signedAsoOutdated` em `domains/medicine/aso-signed.ts`):
  - fluxo A: `true` quando o SHA-256 da prévia assinada difere da composição atual (ou a conferência tem bloqueio hoje);
  - fluxo B (sem prévia): `true` só quando o exame tem apto/inapto efetivo (registrado ou confirmado pelo examinador) diferente da conclusão do documento; "apto com restrição" sem confirmação não é comparado;
  - os substituídos não levam o campo. A tela mostra "Os dados do exame mudaram depois do ASO assinado vigente. Gere nova prévia, colha a assinatura e registre a substituição." O documento assinado nunca é alterado.
- **Só inclusão:** sem UPDATE ou DELETE para o `app_runtime`. Conclusão só `fit` ou `unfit`. O histórico bloqueia a exclusão do exame e do funcionário (`IN_USE`).
- **RLS:** isolamento por tenant, módulo Medicina da empresa e policy de inclusão por fluxo (a mesma regra do servidor).

| Action                       | Entrada                                    | Retorno                                                        |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `listSignedAsosAction`       | `examId`                                   | documentos com `replacedById` (cadeia) e `outdated` no vigente |
| `registerSignedAsoAction`    | `examId, FormData` (`file` + campos acima) | documento registrado                                           |
| `getSignedAsoDownloadAction` | `id`                                       | `{ url, expiresInSeconds, sha256 }`                            |

REST:

- `GET|POST /api/v1/health-exams/{id}/signed-asos` (POST multipart, `201`);
- `GET /api/v1/signed-asos/{id}/download`.

Tela: seção "ASO assinado (documento oficial)" em `/health-exams/{id}/aso`.

### Entrega do ASO ao trabalhador — NOB-165

NR-7 7.5.19: o ASO é disponibilizado ao empregado, com comprovação, e fornecido em meio físico quando ele pedir (MED-13). Migration `0074_aso_deliveries`; core `server/medicine/aso-delivery-core.ts`; regras puras em `domains/medicine/aso-delivery.ts`.

- **Vínculo:** cada evento aponta o ASO **assinado vigente** e o SHA-256 dele, lidos do banco. A prévia nunca é entregue. A FK composta prende o evento ao exame e ao tenant; a policy confere trabalhador do exame, hash e documento não substituído.
- **Eventos (só inclusão):**
  - `made_available`: via física ou cópia digital (canal informado), com referência da evidência;
  - `physical_copy_requested`: pedido de via física;
  - `voided`: correção de um registro, com motivo de pelo menos 10 caracteres. Um registro é corrigido no máximo uma vez, e a correção não é corrigida.
- **Situação do ASO vigente** (derivada dos eventos, nunca presumida; NOB-167):
  - **entrega registrada:** entrega sem comprovante;
  - **comprovante aguardando conferência:** comprovante anexado e ainda não conferido. O tipo escolhido ("recibo assinado") não confirma nada;
  - **comprovante recusado na conferência;**
  - **comprovante conferido documentalmente:** conferência `documentary` com resultado `confirmed`. Não confirma a autoria da assinatura;
  - **recebimento confirmado:** só com recibo assinado pelo trabalhador conferido como `signature_witnessed` (assinado na presença do revisor, identidade conferida em documento).
  - Mais dois avisos: via física pedida e ainda não entregue depois do pedido; versão anterior entregue e a vigente não, quando a substituição exige nova entrega.
- **Conferência humana (NOB-167):** evento `evidence_reviewed`, separado do upload e só de inclusão.
  - O revisor é o usuário da sessão (`recorded_by`), nunca vem do cliente; data e hora do servidor.
  - Fica ligado ao comprovante exato por FK composta (id, exame, tenant, `evidence_sha256` e `evidence_kind`), com método, resultado e referência de auditoria.
  - Uma conferência por comprovante (índice único).
  - Comprovante corrigido não é conferível: o servidor e o trigger `aso_deliveries_review_guard` (SECURITY INVOKER) recusam.
  - A conferência de comprovante ou ASO substituído é recusada pela policy de documento vigente.
  - Conferência ou comprovante corrigidos deixam de valer, mas ficam no histórico.
  - Registros anteriores à 0076 não têm conferência e ficam "aguardando conferência"; nada é promovido retroativamente.
- **Comprovante:**
  - PDF, JPEG ou PNG conferido pelos bytes, até 10 MB;
  - SHA-256 no servidor;
  - caminho `{org}/aso-entregas/{exame}/{id}.{ext}` no bucket privado, que nunca sai na API;
  - se o registro falha, o arquivo é removido.
- **Quem registra:** a equipe do escritório (owner ou colaborador). O cliente recebe `FORBIDDEN`. Nenhuma conclusão médica é criada e nenhum dado clínico é exposto.
- **Data e hora** em horário de Brasília (`AAAA-MM-DDTHH:mm`): não futura e não anterior à assinatura do ASO.
- **Fora desta fatia:** entrega digital autenticada ao trabalhador (portal, NOB-122). Não há integração de e-mail, WhatsApp ou assinatura simulada.

| Action                            | Entrada                                                | Retorno                                            |
| --------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `listAsoDeliveriesAction`         | `examId`                                               | `{ currentSignedDocumentId, summary, deliveries }` |
| `registerAsoDeliveryAction`       | `examId, FormData` (campos acima + `evidence?`)        | evento registrado                                  |
| `voidAsoDeliveryAction`           | `examId, deliveryId, { reason* }`                      | evento de correção                                 |
| `getAsoDeliveryEvidenceAction`    | `id`                                                   | `{ url, expiresInSeconds, sha256 }`                |
| `reviewAsoDeliveryEvidenceAction` | `examId, deliveryId, { method*, result*, reference* }` | evento de conferência (NOB-167)                    |

REST:

- `GET|POST /api/v1/health-exams/{id}/aso-deliveries` (POST multipart, `201`);
- `POST /api/v1/health-exams/{id}/aso-deliveries/{deliveryId}/void` (`201`);
- `GET /api/v1/aso-deliveries/{id}/evidence`;
- `POST /api/v1/health-exams/{id}/aso-deliveries/{deliveryId}/review` (`201`, NOB-167).

Tela: seção "Entrega ao trabalhador (NR-7 7.5.19)" em `/health-exams/{id}/aso`.

## Medicina — painel — `actions/medicine/overview.ts`

Painel da Medicina do Trabalho (NOB-108, Lote 01). Dois **read-models** (só `GET`, sem tabela nova,
sem migration), servidos pelo core `server/medicine/overview-core.ts` compartilhado entre Server
Actions (`officeAction`) e REST (`restHandler`). Acesso: owner/collaborator (`client` → `FORBIDDEN`).
Tenant sempre da sessão; `companyId` é só filtro.

| Action                        | Entrada                                           | Retorno (`data`)                          |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `getMedicineOverviewAction`   | —                                                 | `MedicineOverview`                        |
| `listMedicineEmployeesAction` | `{ companyId*, search?, page?, pageSize? ≤ 100 }` | `{ rows: MedicineEmployeeItem[]; total }` |

REST: `GET /api/v1/medicine/overview` · `GET /api/v1/medicine/employees?companyId=&search=&page=&pageSize=`.

**`MedicineOverview`** (`domains/medicine/overview.ts`): `{ today, dueWindowDays, companies:
MedicineCompanySummary[], totals: { companies, employees, ok, dueSoon, expired, noExpiry, withoutExam } }`;
`MedicineCompanySummary` = `{ companyId, companyName, employeeCount, validity: { ok, dueSoon, expired,
noExpiry, withoutExam } }`. Só empresas com Medicina habilitada (`companyModuleScope(…, "medicine")`
em `companies` **e** em `employees`), ordenadas por razão social. Conta a situação do **último exame
de cada funcionário** (não todos os exames), classificada por `classifyDocumentValidity` com janela de
30 dias; `withoutExam` = funcionários sem exame. Funcionários contados em todos os status.

**`MedicineEmployeeItem`** (`domains/medicine/employees.ts`): `{ id, fullName, status, jobRoleTitle,
gesName, latestExam: { examType, performedAt, validUntil, aptitude } | null }` — sem CPF, sem `notes`,
sem `certificatePath`, sem nome da empresa. Busca (`?search=`) em nome, GES e função; paginação no
servidor.

Erros de `listMedicineEmployees*`: `companyId` ausente/malformado ou `pageSize` > 100 → `VALIDATION`
(`422`); empresa inexistente ou de outro tenant → `NOT_FOUND` (`404`); empresa sem Medicina habilitada
→ `FORBIDDEN` (`403`, explícito — nunca lista vazia).

Regras: status = validade **informada** (`valid_until`), **sem periodicidade calculada**; nenhum dado
clínico livre (`notes`/`certificatePath`) nem CPF nos contratos; leituras não emitem auditoria
(`officeAction` só registra operação/resultado em caso de erro, sem payload).

**Datas exibidas (civil × instante, NOB-112/109/110).** Os contratos não mudam: data civil (coluna
`date`, `YYYY-MM-DD` — realização e validade do exame, assinatura, ciclo, período, afastamento) e
instante (`timestamptz`, ISO com hora — registro, geração, aprovação, confirmação, declaração,
autoria, trilhas). Nas telas, a data civil aparece **como está** (`formatCivilDate`, sem passar por
`Date`/UTC) e o instante aparece pelo **dia de Brasília** (`formatInstantDate` /
`formatInstantDateTime`, `America/Sao_Paulo` via `Intl`, mesmo texto no servidor e no navegador) — nunca
por `iso.slice(0, 10)`, que entre 21h e 23h59 de Brasília mostraria o dia seguinte. Instantes guardados
no `content` arquivado (ex.: `examPlan.approvedAt` do PCMSO) seguem a mesma regra na exibição, sem
alterar o conteúdo nem o hash. Helpers em `src/shared/dates.ts`.

---

## Controle de formulário (ISO) — `actions/documents/form-controls.ts`

Metadados de cabeçalho estilo ISO (Tipo de Formulário, Empresa, Código FRM, REV, Data, N.C.,
GES/Setor, Posicionamento) injetados nos documentos gerados (PGR, OS, fichas, inspeções) — a
injeção em si é fronteira de outra fatia (cliente/template Gotenberg). Sem `/dependents`
(configuração isolada, sem cadeia descendente). REST espelho em `/api/v1/form-controls` (GET,
POST) · `/api/v1/form-controls/{id}` (GET, PUT, DELETE).

| Action                                                                    | Entrada                                                | Retorno (`data`)                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `listFormControlsAction`                                                  | `{ search?, formType?, companyId?, page?, pageSize? }` | `{ rows: FormControlListItem[]; total }`             |
| `getFormControlAction`                                                    | `id`                                                   | `{ control, company, ges }` (null → `NOT_FOUND`)     |
| `createFormControlAction`                                                 | `FormControlInput`                                     | `{ id }` (código FRM dup → `DUPLICATE`)              |
| `updateFormControlAction`                                                 | `id, FormControlInput`                                 | `{ id }`                                             |
| `deleteFormControlAction`                                                 | `id`                                                   | `{ id }`                                             |
| `listFormControlCompanyOptionsAction` / `listFormControlGesOptionsAction` | —                                                      | `{ value, label }[]` (para os selects do formulário) |

**`FormControlInput`**: `formType*`, `companyId?` (empresa), `frmCode*` (código FRM), `revision*`
(REV), `issueDate*` (AAAA-MM-DD), `nonConformityNumber?` (N.C.), `gesId?` (GES/Setor
responsável), `position*` (`top`|`bottom`|`both`), `notes?`. Unicidade por
`UNIQUE(org_id, frm_code)` → código FRM duplicado no mesmo escritório vira `DUPLICATE`; o mesmo
código é aceito em escritórios distintos. `companyId`/`gesId` inválidos ou de outro escritório →
`422 FK_NOT_FOUND`. **PUT (REST) exige corpo completo** (sem `.partial()`).

---

## Documentos (GED) — `actions/documents/documents.ts` + `db/repositories/folders.ts`

Acervo de documentos versionado (schema/RLS da fatia 023, zero migration nesta fatia). Um
"documento lógico" (`document_group_id`) agrupa N versões físicas; listagem/detalhe sempre
refletem a **versão corrente** (`MAX(version)` do grupo) — a exceção é a exclusão, que remove o
grupo inteiro. REST espelho em `/api/v1/documents` (GET, POST) · `/api/v1/documents/{id}` (GET,
PUT, DELETE) · `/api/v1/documents/{id}/versions` (GET, POST) · `/api/v1/documents/{id}/move` (POST) ·
`/api/v1/folders` (GET, POST) · `/api/v1/folders/{id}` (PUT).

| Action                                                                           | Entrada                                                         | Retorno (`data`)                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `listDocumentsAction`                                                            | `{ folderId?, search?, docType?, validity?, page?, pageSize? }` | `{ rows, total, kpis, folders, breadcrumb }`                                                                |
| `getDocumentAction`                                                              | `id`                                                            | `DocumentDetail` (null → `NOT_FOUND`)                                                                       |
| `createDocumentAction`                                                           | `FormData` (`file` + metadados)                                 | `DocumentDetail` (v1/novo grupo; tipo/tamanho inválido → `VALIDATION`; pasta cross-tenant → `FK_NOT_FOUND`) |
| `updateDocumentAction`                                                           | `id, UpdateDocumentInput` (parcial)                             | `DocumentDetail` (só a versão vigente; versão antiga → `DOCUMENT_VERSION_READ_ONLY`)                        |
| `addDocumentVersionAction`                                                       | `id, FormData` (`file`)                                         | `DocumentDetail` (versão vigente+1, metadados herdados da vigente; corrida → `DUPLICATE`)                   |
| `listDocumentVersionsAction`                                                     | `id` (qualquer versão do grupo)                                 | `DocumentVersionItem[]` (mais nova primeiro, `isCurrent` em exatamente uma; outro escritório → `NOT_FOUND`) |
| `moveDocumentAction`                                                             | `id, { folderId }`                                              | `DocumentDetail` (todas as versões do grupo; pasta inválida → `FK_NOT_FOUND`)                               |
| `deleteDocumentAction`                                                           | `id`                                                            | `{ groupId, deletedVersions }` (remove todas as versões do grupo)                                           |
| `createFolder`/`renameFolder`/`listFolderTree` (repo, sem Server Action própria) | `orgId, values` / `orgId, id, values` / `orgId, parentId?`      | `Folder` / `Folder \| null` / `{ folders, breadcrumb }`                                                     |

**`DocumentMetadataInput`** (criação, multipart): `name*`, `docType*`, `validUntil?`
(AAAA-MM-DD), `folderId?` (`null`/ausente = raiz), `relatedEntityType?`/`relatedEntityId?`
(vínculo polimórfico — conjunto fechado `pgr`; **completo-ou-vazio**, refine espelha o CHECK do
banco). Upload validado **antes** de tocar Storage/DB — PDF/PNG/JPG/DOC/DOCX/XLS/XLSX, máx.
25 MB (`validateFile`) → `422 VALIDATION` se inválido, **nada é gravado**. Ordem de escrita:
`putDocumentObject` (Storage, path `<org_id>/documentos/<group_id>/v<version>-<slug>`) → `INSERT`;
falha do INSERT compensa removendo o objeto (nunca deixa órfão). **`UpdateDocumentInput`**: mesmos
campos, todos opcionais (não troca arquivo — isso é `addDocumentVersionAction`).
**`MoveDocumentInput`**: `{ folderId }` (`null` = raiz).

Validade (`validUntil`) é **derivada na leitura** (`ok`/`due_soon`/`expired`/`no_expiry`, janela
fixa de 30 dias, mesmo padrão de `classifyTrainingStatus`), nunca coluna de status — os KPIs
(`documents`/`folders`/`dueSoon`/`expired`) usam a mesma fronteira de data do filtro da listagem
(`validityDateBounds`), para nunca divergirem entre o card e o filtro.

**Pastas**: unicidade de nome entre irmãs **incluindo a raiz** (`UNIQUE ... NULLS NOT DISTINCT`)
→ `409 DUPLICATE`; pai inválido/de outro escritório → `422 FK_NOT_FOUND`; renome de pasta de
outro escritório → `null`/`404`. `deleteDocument` remove **todas as versões do grupo numa
transação**; os objetos do Storage são removidos **pós-commit**, best-effort — falha de Storage é
logada (`logTenantEvent`) e **não reverte** a exclusão do registro.

---

## PGR — `actions/pgr/pgr.ts`

Documento PGR (NR-01/GRO) vinculado a Empresa (obrigatória) e Obra/Contrato (opcional). Fatia 013,
**zero-migration** (tabela `pgr` da migration `0012`). REST espelho em `/api/v1/pgr` (GET, POST) ·
`/api/v1/pgr/{id}` (GET, PUT, DELETE). **Sem `/dependents` e sem 409** (a tabela não tem unique).

| Action            | Entrada                                                  | Retorno (`data`)                               |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `listPgrAction`   | `{ companyId?, workUnitId?, search?, page?, pageSize? }` | `{ rows: PgrListItem[]; total }`               |
| `getPgrAction`    | `id`                                                     | `Pgr` (inexistente/cross-tenant → `NOT_FOUND`) |
| `createPgrAction` | `PgrCreateInput`                                         | `Pgr` (empresa/obra inválida → `FK_NOT_FOUND`) |
| `updatePgrAction` | `id, PgrInput`                                           | `Pgr` (corpo completo, sem aceite)             |
| `deletePgrAction` | `id`                                                     | `{ id }`                                       |

**`PgrCreateInput`**: `companyId*` (uuid), `workUnitId?` (uuid da obra da empresa), `responsible?`,
`registrationType*` (`crm`|`crea`|`mte`|`not_applicable`), `registrationNumber?` (obrigatório p/
CRM/CREA/MTE, proibido p/ "não aplicável"), `issuedAt*` (AAAA-MM-DD), `validUntil*` (≥ `issuedAt`),
`declarationAccepted*` (`true`) — **aceite validado no servidor e NÃO persistido** (a tabela `pgr`
não tem coluna de aceite; persistência legal é #79). **`PgrInput`** (update / PUT REST): igual,
**sem** `declarationAccepted` (corpo completo). **`PgrListItem`**: `{ id, companyId, companyName,
workUnitId, workUnitName, responsible, registrationType, registrationNumber, issuedAt, validUntil }`.
**Erros REST**: 422 (validação/aceite ausente/FK), 404 (cross-tenant/inexistente), 403 (`client`);
**nunca 409**. "Usuário autor" fora de escopo (modelo sem `created_by`).

### Editor do PGR — revisões, GES, consolidada e assinatura (fatias 019 + 022)

Sub-recursos do documento PGR, todos **zero-migration** (tabelas `pgr_revisions`, `pgr_ges`,
`signature_requests`/`signature_captures` já existentes). Todos escopados ao tenant da sessão; PGR
inexistente/de outro escritório → `404 NOT_FOUND` **antes** de qualquer efeito.

- **`/pgr/{id}/revisions`** (revisões manuais, fatia 022): `GET` lista o histórico (mais recente
  primeiro). `POST` **cria** uma revisão cujo **número é atribuído exclusivamente no servidor** —
  o repositório trava a linha do PGR (`SELECT … FOR UPDATE` em `withOrg`) e calcula
  `COALESCE(MAX(revision_number), 0) + 1` na mesma transação, então duas criações concorrentes no
  mesmo PGR resultam em `201` + `201` com números **distintos e consecutivos** (nenhuma perdida);
  PGRs diferentes não compartilham lock. O body aceita **somente** `{ revisedAt*, notes? }` e o
  schema é **`.strict()`**: enviar `revisionNumber` (ou qualquer campo extra) → **`422 VALIDATION`**
  (nunca ignorado em silêncio). A `UNIQUE(org_id, pgr_id, revision_number)` é backstop defensivo
  (colisão inesperada → `409 DUPLICATE`); não há retry, update nem delete de revisão.
  - Body válido: `{ "revisedAt": "2026-07-14", "notes": "Descrição da revisão" }` → `201`.
  - Body inválido: `{ "revisedAt": "2026-07-14", "notes": "Cliente antigo", "revisionNumber": 99 }`
    → **`422 VALIDATION`**.
  - **`/pgr/{id}/revisions/{revisionId}/archive`** (arquivamento, issue #46): `PUT` sem body marca
    `archived_at = now()` (coluna já existente desde a `0031`; `null` = ativa). **Idempotente**:
    arquivar uma revisão já arquivada devolve `200` com a linha **sem** trocar o timestamp original
    (não é erro repetir). Revisão inexistente ou de outro tenant → `404 NOT_FOUND`. Segue a mesma
    trava de edição do PGR (`assertPgrEditable`): PGR assinado/publicado → `409 ALREADY_SIGNED`.
    Sem máquina de estados — é só `null → timestamp`, sem "desarquivar".
- **`/pgr/{id}/ges` · `/pgr/{id}/ges/{gesId}`** (GES do escopo do PGR, fatia 019): `GET` lista os GES
  vinculados; `POST` vincula um GES (`{ gesId }`, `201`); `DELETE` desvincula (`204`; vínculo
  inexistente → `404`). GES de outro tenant → falha de FK/isolamento (nunca vincula alheio).
- **`/pgr/{id}/consolidated`** (visão consolidada, fatias 019 + 022): `GET` read-only que agrega, em
  ~6 queries em lote (sem N+1), a cadeia GES → riscos → **avaliação vigente** → **medidas 5W2H** →
  **EPIs por risco**, incluindo os campos **eSocial S-2240** persistidos (`concentration_intensity`
  como **string**). Riscos ordenados por `risk_level` desc, sem avaliação por último; arrays vazios
  tratados (PGR sem GES, GES sem riscos, risco sem avaliação/medida/EPI). Sem PDF/GED.
  **Plano do PGR (#42, aditivo):** cada medida traz `status` (`maintain|introduced|improved` ou
  `null`) e cada risco traz `planCoverage` — `not_assessed` (sem classificação vigente),
  `no_measure` (avaliado, sem medidas), `incomplete` (moderado+ com medida aplicável sem
  responsável/prazo) ou `covered`. Derivado na leitura com a mesma regra de escrita das medidas;
  nada é criado automaticamente (nenhuma medida ou `action_plan`). Reclassificar o risco muda a
  cobertura sem alterar as medidas. O PDF ainda não usa esses campos (Lote 2, #47).
- **`/pgr/{id}/signature`** (assinatura pública do PGR, fatia 022): `POST` (office staff) **cria** a
  solicitação — o **payload público mínimo é montado NO SERVIDOR** (título/empresa/obra/responsável/
  datas/nº revisão; **sem PII**, sem IDs internos), o body só aceita `{ ttlSeconds? }` (inteiro
  positivo; schema `.strict()` → outro campo é `422`). Retorna `201` com `{ signature, publicUrl,
qrCodeDataUrl }` — o **`publicUrl` só existe nesta resposta** (o token cru nunca é persistido nem
  logado). `GET` devolve **somente** o estado derivado (`PgrSignatureView`:
  `none|pending|signed|expired|cancelled` + metadados seguros) e **nunca** token ou URL. A **cota é
  compartilhada** com os demais `target_type` (contador por tenant/mês, sem filtro): `free` limitado
  → `402 QUOTA_EXCEEDED`, `pro` ilimitado. Cross-tenant → `404`. **Não** é um Route Handler REST
  público — a superfície pública é a página `/signature-requests/{token}` (abaixo).

### Rota pública de assinatura do PGR — `/signature-requests/{token}` (fatia 022)

Página pública (fora de `/api/v1`, **sem Clerk, sem tenant de sessão, sem bypass dev**) da
**infraestrutura genérica de assinatura** (fatia 010): a credencial é o **token** persistido só
hasheado; o `target_type` `"pgr"` resolve o formulário via registry, que exibe **apenas** o snapshot
mínimo congelado no `payload` da solicitação. A página **não** consulta o PGR/consolidada/
funcionários ao vivo — alterar o PGR depois **não** muda um link já emitido.

| Ação   | Rota                          | Auth       | Desfecho                                                                                                  |
| ------ | ----------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/signature-requests/{token}` | só o token | página com o snapshot + captura de assinatura · inválido/expirado/usado → estado seguro (nunca vaza dado) |
| `POST` | `/signature-requests/{token}` | só o token | Server Action `submitPublicSignature`: registra a captura (nome + PNG) · uso único / **replay bloqueado** |

`Cache-Control: no-store` (proxy). `cancelled` aparece como `used` no público (comportamento herdado
da infra). Não descrever como REST público — é a página genérica reutilizada.

---

## Riscos (GES) — `actions/pgr/risks.ts`

**Contexto dos riscos (NOB-103):** `POST /risks` e `PUT /risks/{id}` aceitam
`companyId` e `workUnitId` opcionais. Quando enviados, devem corresponder ao GES
do mesmo tenant, ou a operação retorna `422 FK_NOT_FOUND`. A empresa é derivada
do GES no servidor; PGR desabilitado impede criar/editar (`403 FORBIDDEN`). O
formulário envia os três identificadores. Clientes antigos podem enviar apenas
`gesId`; nenhum contexto adicional é duplicado na tabela `risks`. As categorias
e as escalas existentes permanecem iguais, pendentes de revisão técnica.

Inventário de risco por Grupo de Exposição Similar (NR-01/GRO + eSocial S-2240). Fatia 014,
**zero-migration** (tabela `risks` da migration `0012`; escopo restrito às suas colunas — **não**
toca `risk_assessments`/`control_measures`). REST espelho em `/api/v1/risks` (GET, POST) ·
`/api/v1/risks/{id}` (GET, PUT, DELETE). **Sem `/dependents` e sem 409** (a tabela não tem unique).

| Action             | Entrada                                                          | Retorno (`data`)                                |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| `listRisksAction`  | `{ companyId?, workUnitId?, gesId?, search?, page?, pageSize? }` | `{ rows: RiskListItem[]; total }`               |
| `getRiskAction`    | `id`                                                             | `Risk` (inexistente/cross-tenant → `NOT_FOUND`) |
| `createRiskAction` | `RiskInput`                                                      | `Risk` (`gesId` inválido → `FK_NOT_FOUND`)      |
| `updateRiskAction` | `id, RiskInput`                                                  | `Risk` (corpo completo)                         |
| `deleteRiskAction` | `id`                                                             | `{ id }`                                        |

**`RiskInput`** (mesmo corpo para create e PUT): `gesId*` (uuid do GES do tenant), `agentType*`
(`physical`|`chemical`|`biological`|`ergonomic`|`mechanical`|`accident`|`psychosocial`),
`description*`, `hazard?`, `sources?`, `propagation?`, `exposureTime?` (8 faixas), `possibleInjuries?`,
`noxiousAgentCode?` (S-2240, texto), `measurementUnit?` (10 unidades, incl. `qualitative_na`),
`concentrationIntensity?` (string decimal). **Regra `qualitative_na`**: concentração só é aceita com
unidade **quantitativa** (com `qualitative_na` ou sem unidade → 422 `VALIDATION`). **`RiskListItem`**:
`{ id, gesId, gesName, agentType, description, exposureTime, measurementUnit }`. **Reutilização** é por
**prefill de UI** (`/risks/new?from=<id>` → `getRiskAction` → `createRiskAction`; novo `id`), **sem**
action de clone. **Erros REST**: 422 (validação/`qualitative_na`/FK `gesId`), 404
(cross-tenant/inexistente), 403 (`client`); **nunca 409**. "Usuário autor" fora de escopo (modelo sem
`created_by`).

---

## Avaliação de risco (5×5) — `actions/pgr/risk-assessments.ts`

Avaliação de risco pela matriz 5×5 (probabilidade × severidade). Fatia 016, **zero-migration**
(tabela `risk_assessments` da migration `0012`; escopo restrito às suas colunas — **não** toca
`control_measures`/`risk_methodology`, que é apenas **lida**). **Histórico 1:N** por risco (sem
unique → **sem 409**; avaliação vigente = última por `assessedAt desc`, `createdAt desc`).
`riskLevel = probability × severity` é **calculado e persistido**; `result` é a **classificação
snapshot** pela metodologia da org (`getRiskMethodologyView` + `classify`, com fallback padrão). REST
espelho: `/api/v1/risks/{id}/assessments` (GET, POST 201) · `/api/v1/risk-assessments/{id}` (GET, PUT,
DELETE 204).

| Action                           | Entrada                           | Retorno (`data`)                                                                 |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `listRiskAssessmentsAction`      | `riskId, { page?, pageSize? }`    | `{ rows: RiskAssessmentListItem[]; total }` (`riskId` inválido → `FK_NOT_FOUND`) |
| `getRiskAssessmentAction`        | `id`                              | `RiskAssessment` (inexistente/cross-tenant → `NOT_FOUND`)                        |
| `getCurrentRiskAssessmentAction` | `riskId`                          | `RiskAssessment \| null` (null se risco sem avaliações)                          |
| `createRiskAssessmentAction`     | `riskId, RiskAssessmentInput`     | `RiskAssessment` (201; `riskId` inválido → `FK_NOT_FOUND`)                       |
| `updateRiskAssessmentAction`     | `riskId, id, RiskAssessmentInput` | `RiskAssessment` (corpo completo; recalcula `riskLevel`/`result`)                |
| `deleteRiskAssessmentAction`     | `riskId, id`                      | `{ id }` (delete físico)                                                         |

**`RiskAssessmentInput`** (mesmo corpo para create e PUT): `criterion*` (`qualitative`|`quantitative`),
`probability*` (1–5), `severity*` (1–5), `uncertaintyDegree` (0–2, default 0), `assessedAt*`
(`AAAA-MM-DD`), `toleranceLimit?` (referência normativa em texto, ex.: "NR-15 Anexo 1"). **Não** aceita
`riskLevel`/`result` (calculados no servidor), `riskId` (vem da rota) nem `orgId` (sessão).
**Erros REST**: 422 (validação/FK `riskId`), 404 (cross-tenant/inexistente), 403 (`client`);
**nunca 409**.

### Bloco NR-09 (issue #39, migration `0049_nr09_evaluation`)

Campos **opcionais** do mesmo corpo, para a avaliação quantitativa da NR-09 (item 9.4.3):
`evaluationMethod?` (texto livre; a UI sugere NHO/NIOSH), `measuredValue?` (decimal em string),
`measuredUnit?` (enum `measurement_unit`, **sem** `qualitative_na`), `toleranceLimitValue?` (decimal em
string) e `nr09Conclusion?` (`below_limit` | `above_limit` | `not_applicable`).

Regras (422 quando violadas — a aplicação valida e o banco também tem CHECK):

1. qualquer campo do bloco exige `criterion = "quantitative"`;
2. `measuredValue` exige `measuredUnit` quantitativa;
3. o bloco só é aceito em risco de agente **físico, químico ou biológico** — os demais recebem
   `VALIDATION` mesmo chamando a API direto.

A **conclusão é informada pelo profissional**: o servidor nunca a deriva nem a sobrescreve. A tela
sugere um valor quando há medição e limite comparáveis, e quem confirma é o usuário.

---

## Avaliação ergonômica (NR-17) — `actions/pgr/ergonomic-evaluations.ts`

Avaliação ergonômica preliminar (**AEP**) vinculada a um risco do inventário — issue #40, migration
`0051_ergonomic_evaluations` (tabela `ergonomic_evaluations` + enum `ergonomic_adequacy`). **Histórico
1:N** por risco (sem unique → **sem 409**); a **vigente** é a de `assessedAt` mais recente, com
desempate determinístico por `createdAt` e `id`. Criar avaliação nova **nunca** sobrescreve a
anterior. REST espelho: `/api/v1/risks/{id}/ergonomic-evaluations` (GET, POST 201) ·
`/api/v1/ergonomic-evaluations/{id}` (GET, PUT, DELETE 204).

| Action                                | Entrada                                | Retorno (`data`)                                                              |
| ------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `listErgonomicEvaluationsAction`      | `riskId, { page?, pageSize? }`         | `{ rows: ErgonomicEvaluation[]; total }` (`riskId` inválido → `FK_NOT_FOUND`) |
| `getErgonomicEvaluationAction`        | `id`                                   | `ErgonomicEvaluation` (inexistente/cross-tenant → `NOT_FOUND`)                |
| `getCurrentErgonomicEvaluationAction` | `riskId`                               | `ErgonomicEvaluation \| null` (null = risco sem avaliação ergonômica)         |
| `listLinkableCampaignsAction`         | `riskId`                               | campanhas psicossociais **encerradas** da unidade do GES do risco             |
| `createErgonomicEvaluationAction`     | `riskId, ErgonomicEvaluationInput`     | `ErgonomicEvaluation` (201; `riskId` inválido → `FK_NOT_FOUND`)               |
| `updateErgonomicEvaluationAction`     | `riskId, id, ErgonomicEvaluationInput` | `ErgonomicEvaluation` (corpo completo; campo omitido é apagado)               |
| `deleteErgonomicEvaluationAction`     | `riskId, id`                           | `{ id }` (delete físico; não afeta as demais avaliações do histórico)         |

**`ErgonomicEvaluationInput`** (mesmo corpo para create e PUT):

- `assessedAt*` (`AAAA-MM-DD`) — **único obrigatório**, porque é o que define a vigência;
- `responsible?`, `method?` (texto, até 255; `method` é o instrumento informado pelo profissional);
- `notes?` (observação geral);
- `psychosocialCampaignId?` (uuid — vínculo **opcional** com campanha psicossocial);
- as **seis dimensões**, todas opcionais, cada uma com adequação + observação:
  `posture`/`postureNotes`, `movements`/`movementsNotes`, `physicalLoad`/`physicalLoadNotes`,
  `mentalLoad`/`mentalLoadNotes`, `workOrganization`/`workOrganizationNotes`,
  `physicalEnvironment`/`physicalEnvironmentNotes`.

A adequação é o enum **`adequate` | `inadequate` | `not_applicable`**. **Não existe escala numérica,
score nem conclusão global** — a NR-17 não fixa nenhum e o sistema não inventa norma. **Ausente
(`null`) ≠ `not_applicable`**: nulo é "não avaliado" (avaliação parcial é válida), `not_applicable` é
uma declaração do profissional. Nenhum dos dois é apresentado como conformidade.

**Vínculo com campanha psicossocial** (opcional). Validado **no servidor**, não só na tela:

1. a campanha precisa existir **no tenant ativo** → senão `FK_NOT_FOUND` (422);
2. precisa ser da **mesma unidade** do GES do risco → senão `VALIDATION` (422);
3. precisa estar **`closed`** → senão `VALIDATION` (422).

Quando há vínculo, a tela e o PDF mostram **apenas o agregado** da campanha (nome, período, nº de
respostas e fatores derivados com nível), sob o rótulo "Resultado agregado da campanha psicossocial".
**Nenhuma resposta individual** é lida ou exibida, e o sistema **não implementa nem calcula escore
COPSOQ** — quando "COPSOQ" aparece, é o texto que o profissional informou em `method`.

A **AET** (análise ergonômica do trabalho) **não** tem entidade própria: é laudo anexado ao risco pelo
GED (`related_entity_type = "risk"`), que já versiona. A tela oferece o atalho com `docType`
pré-preenchido.

**Erros REST**: 422 (validação / FK `riskId` / vínculo de campanha), 404 (cross-tenant/inexistente),
403 (`client`); **nunca 409**.

---

## Medidas de controle (5W2H) — `actions/pgr/control-measures.ts`

Plano de ação 5W2H por risco, uma medida por **nível da hierarquia NR-01** (`control_level`:
`elimination`/`collective_protection`/`administrative`/`ppe`). Fatia 018, **zero-migration** (tabela
`control_measures` da migration `0012`; escopo restrito às suas colunas — **não** toca
`risk_methodology`/`risk_assessments`, apenas **lidos** como contexto). A **UNIQUE
`(org_id, risk_id, control_level)`** faz a duplicidade de nível virar **`DUPLICATE`/409** (no máx. 4
medidas por risco). **Sem coluna de status**: `Sem plano`/`Planejada`/`Vencida` são **derivados** na
leitura (vencida ⇔ `applicable` + `actionDeadline < hoje`, fuso America/Sao_Paulo). Responsável é
**texto** (`action_responsible`; combobox de funcionários grava `fullName`, sem FK). O contexto do
risco e a avaliação vigente (`riskLevel`/`result`) são exibidos **derivados** (sem snapshot). REST
espelho: `/api/v1/risks/{id}/control-measures` (GET, POST 201) · `/api/v1/control-measures/{id}`
(GET, PUT, DELETE 204).

| Action                       | Entrada                           | Retorno (`data`)                                                                         |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `listControlMeasuresAction`  | `riskId, { page?, pageSize? }`    | `{ rows: ControlMeasureListItem[]; total }` (`riskId` inválido → `FK_NOT_FOUND`)         |
| `getControlMeasureAction`    | `id`                              | `ControlMeasure` (inexistente/cross-tenant → `NOT_FOUND`)                                |
| `createControlMeasureAction` | `riskId, ControlMeasureInput`     | `ControlMeasure` (201; `riskId` inválido → `FK_NOT_FOUND`; nível repetido → `DUPLICATE`) |
| `updateControlMeasureAction` | `riskId, id, ControlMeasureInput` | `ControlMeasure` (corpo completo; `control_level` imutável)                              |
| `deleteControlMeasureAction` | `riskId, id`                      | `{ id }` (delete físico)                                                                 |

**`ControlMeasureInput`** (mesmo corpo para create e PUT): `controlLevel*` (enum NR-01; ignorado na
escrita do PUT — imutável), `applicable` (bool), `actionWhat`/`actionHow` (**obrigatórios quando
`applicable=true`**), `actionWhy?` (motivo real da medida — o "por quê" do 5W2H, issue #47),
`actionCost?` (custo estimado em BRL, decimal em string — o "quanto"),
`actionTracking?`/`actionMeasurement?`/`actionResponsible?`/`actionDeadline?`
(`AAAA-MM-DD`)/`justification?`/`monitoring?`. **Não** aceita `riskId` (rota) nem `orgId` (sessão).
**Erros REST**: 422 (validação/FK `riskId`), 404 (cross-tenant/inexistente), **409** (nível
duplicado), 403 (`client`).

O 5W2H do PGR é **completo** desde a migration `0050_measure_why_cost`: o quê (`actionWhat`), por quê
(`actionWhy`), onde (GES do risco, derivado na leitura), quando (`actionDeadline`), quem
(`actionResponsible`), como (`actionHow`) e quanto (`actionCost`). Nenhum deles é obrigatório
retroativamente — medida antiga sem motivo/custo aparece como "não informado" no PDF. O módulo
`action_plans` (ponte #51) **não** alimenta o PGR.

---

## NR-18 e relação de EPIs do PGR — `actions/pgr/pgr-nr18.ts`

Issue #48, **zero migration**. Duas leituras derivadas do que já existe — nenhuma tabela, nenhum
`doc_type` novo no banco, nenhuma escrita.

### Checklist dos documentos complementares (NR-18, item 18.4.3)

Lista **fechada** de quatro tipos, definida no domínio (`domains/documents/nr18.ts`): projeto da
área de vivência, projeto elétrico das instalações temporárias, projetos de proteção coletiva e
projeto de SPIQ (este último "quando aplicável", como diz a norma). Os rótulos são exatamente o
`doc_type` gravado no GED; o casamento ignora caixa e espaços das pontas e **não** faz adivinhação —
tipo diferente não satisfaz requisito.

- Fonte: documentos do acervo com `related_entity_type = "pgr"` e `related_entity_id = {pgrId}`, na
  **versão vigente** (#56). Nova versão mantém o requisito **anexado** (não conta como anexo novo);
  excluir o grupo devolve o requisito a **faltando**.
- O painel só aparece quando a unidade do PGR é `work_units.type = 'site'` (Obra/Canteiro).
- O checklist é **informativo**: não bloqueia PDF, assinatura, publicação nem arquivamento.
- Documento de outro tenant **nunca** satisfaz o checklist (leitura sob `withOrg` + RLS).

| Action                      | Entrada | Retorno (`data`)                                                                        |
| --------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `getPgrNr18ChecklistAction` | `pgrId` | `{ items[], attachedCount, missingCount, totalCount }` (PGR cross-tenant → `NOT_FOUND`) |

REST espelho: `GET /api/v1/pgr/{id}/nr18-checklist` (200; 404 cross-tenant; 403 `client`).

### Relação de EPIs

**Derivada, nunca digitada**: PGR → GES vinculados → riscos → `epi_risk` → `epi_catalog`, sobre a
mesma visão consolidada já usada pelo PDF (sem query extra, sem N+1). Deduplicada por item de
catálogo: um EPI que atende três riscos vira **uma** linha com os três contextos (risco + GES).

Campos por linha: nome, descrição, CA, validade do CA, situação do CA, fabricante, norma, material,
tamanho, unidade e vida útil em meses — todos vindos de `epi_catalog`. "Especificação técnica" não é
um campo: é esse conjunto. Campo vazio aparece como ausência, nunca como valor inventado.

Situação do CA: `expired` (validade < hoje) · `due_soon` (vence dentro de **30 dias**, a mesma
janela que o KPI de EPI do dashboard já usava) · `valid` · `no_expiry` (validade não informada —
estado próprio, que não vira "válido" nem "vencido"). Fuso `America/Sao_Paulo`, fronteiras
inclusivas.

| Action                    | Entrada | Retorno (`data`)                                                         |
| ------------------------- | ------- | ------------------------------------------------------------------------ |
| `getPgrEpiRelationAction` | `pgrId` | `PgrEpiRelationItem[]` (vazio = PGR sem EPI; cross-tenant → `NOT_FOUND`) |

REST espelho: `GET /api/v1/pgr/{id}/epi-relation` (200; 404 cross-tenant; 403 `client`). **Sem
POST/PUT/DELETE de propósito** — para alterar qualquer dado, edita-se o catálogo de EPI
(`/api/v1/epi-catalog`).

A relação também é **seção do PDF do PGR** (decisão Q4 do Lote 3), com as mesmas colunas agrupadas
para caber em A4. Os documentos da NR-18 continuam **anexos no GED**: o PDF os referencia, não os
incorpora.

---

## Rotas de UI (superfície HTTP navegável)

Área autenticada `(protected)` — layout aplica `requireTenantContext`; cada página de CRUD
aplica `requireOfficeStaffPage()` (papel `client` → `forbidden()`); detalhe/edição por id
inexistente ou de outro escritório → `notFound()`.

| Rota                                                                         | Descrição                                                                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                                 | Painel (área autenticada)                                                                                                                             |
| `/companies` · `/companies/new` · `/companies/[id]/edit`                     | Empresa (lista paginada / criar / detalhe=edição)                                                                                                     |
| `/companies/{id}/modules`                                                    | GET (habilitações + histórico), PUT (owner)                                                                                                           |
| `/companies/{id}/medical-risk-sources`                                       | GET (fontes/riscos paginados), POST (registrar fonte pendente)                                                                                        |
| `/companies/{id}/machines`                                                   | GET/POST; `/{machineId}` GET/PUT/DELETE lógico; `/options` GET                                                                                        |
| `/pgr/{id}/readiness`                                                        | GET conferência de preenchimento/consistência                                                                                                         |
| `/pgr/{id}/reviews`                                                          | GET/POST amostras; `/{sampleId}` GET; `/{sampleId}/decisions` POST                                                                                    |
| `/pgr-basic-offers`                                                          | GET/POST versões; `/{id}` GET; `/{id}/publication` PUT                                                                                                |
| `/work-units` · `/work-units/new` · `/work-units/[id]/edit`                  | Unidade de obra (+ copiar endereço da empresa)                                                                                                        |
| `/job-roles` · `/job-roles/new` · `/job-roles/[id]/edit`                     | Função                                                                                                                                                |
| `/ges` · `/ges/new` · `/ges/[id]/edit`                                       | GES (lista + card "Total"; edição gerencia vínculos e expostos)                                                                                       |
| `/employees` · `/employees/new` · `/employees/[id]` · `/employees/[id]/edit` | Funcionário (lista filtrável / criar / ficha / editar)                                                                                                |
| `/pgr` · `/pgr/new` · `/pgr/[id]` · `/pgr/[id]/edit`                         | PGR (lista + filtro Empresa→Obra / criar com aceite NR-01 / **editor em abas**: Informações + GES + Revisões + Consolidada + Assinatura / editar)     |
| `/signature-requests/[token]`                                                | **Pública** (sem Clerk) — captura de assinatura do PGR pelo token; exibe só o snapshot mínimo (`no-store`)                                            |
| `/risks` · `/risks/new` · `/risks/[id]` · `/risks/[id]/edit`                 | Riscos do GES (lista + filtro Empresa→Obra→GES / criar / detalhe / editar / reutilizar por prefill)                                                   |
| `/risks/[id]/assessments` · `.../new` · `.../[assessmentId]/edit`            | Avaliações 5×5 do risco (histórico + vigente / criar com preview / editar) — atalho no detalhe do risco                                               |
| `/risks/[id]/control-measures` · `.../new` · `.../[measureId]/edit`          | Medidas de controle 5W2H por nível NR-01 (lista + estado derivado/vencida + contexto/avaliação vigente / criar / editar) — atalho no detalhe do risco |
| `/categories` · `/categories/new` · `/categories/[id]/edit`                  | Categoria (catálogo `epi`/`machine`; detalhe=edição)                                                                                                  |
| `/medicos` · `/medicos/new` · `/medicos/[id]/edit`                           | Médicos do trabalho (lista + busca nome/CRM + filtro status / criar / detalhe=edição)                                                                 |
| `/medicine`                                                                  | Painel da Medicina (empresas com Medicina, contagem pela validade informada do último exame, funcionários por empresa)                                |
| `/medicine/procedures` · `/companies/[id]/exam-proposal`                     | Catálogo de procedimentos (Tabela 27, consulta) · proposta de exames da empresa (só leitura, sem aprovar) — NOB-147                                   |
| `/medicine/ntep`                                                             | Consulta à Lista C (NTEP) por CID-10, classe CNAE ou empresa (só leitura, informativa) — NOB-113                                                      |
| `/companies/[id]/pcmso-readiness`                                            | Conferência dos dados do PCMSO (pendências, etapas inexistentes e avisos; só leitura) — NOB-148                                                       |
| `/companies/[id]/interpretation-criteria`                                    | Critérios de interpretação e condutas por exame do plano aprovado (versões; só o coordenador vinculado registra) — NOB-153                            |
| `/companies/[id]/analytical-report`                                          | Relatório analítico anual do PCMSO (contexto do período, elaboração pelo coordenador, prévia e versões) — NOB-154                                     |
| `/health-exams` · `/health-exams/new` · `/health-exams/[id]/edit`            | Gestão de Saúde/ASO (lista + busca + filtros tipo/empresa/funcionário; erro ≠ vazio / criar, `?employeeId=` pré-seleciona / editar)                   |
| `/health-exams/[id]/aso`                                                     | Conferência do ASO (NR-7 7.5.19.1), exames realizados com data e prévias arquivadas — NOB-152                                                         |
| `/health-exams/[id]/clinical-record`                                         | Prontuário clínico do exame (só o médico vinculado) e comunicação de restrição ao RH — NOB-155                                                        |
| `/absences/[id]/clinical`                                                    | Área clínica do afastamento (atestado e CID), só o coordenador do PCMSO — NOB-139                                                                     |
| `/form-controls` · `/form-controls/new` · `/form-controls/[id]/edit`         | Controle de formulário (ISO); form com preview em tempo real do cabeçalho                                                                             |

## Invariantes de isolamento (multi-tenant)

- Tenant ativo sempre da sessão; nunca de input do cliente.
- Detalhe/edição/exclusão de id de outro escritório → `NOT_FOUND` (nunca dado alheio).
- Papel `client` → `FORBIDDEN`/`forbidden()` em qualquer operação.
- `UNIQUE(org_id, cpf)` / `(org_id, cnpj)`: mesmo valor aceito entre escritórios, bloqueado no
  mesmo escritório.
- Nº de expostos do GES é derivado e somente leitura.

## Protocolo de testes com cURL (para o time)

Roteiro reproduzível para validar endpoints **sem** UI. Regra: teste sempre o **status HTTP** e o
**corpo** (`ActionResult`). Server Actions **não** são testáveis por cURL (POST-only + header
`Next-Action`); teste sempre pelo **espelho REST** `/api/v1`.

### 0. Pré-requisitos

```bash
npm run dev                 # sobe em http://localhost:3000 (lê .env.local)
# jq opcional, só p/ ler o corpo bonito. Em .env.local (local/homolog):
#   APP_ENV=local                 # obrigatório: sem APP_ENV o bypass fica desligado
#   DEV_API_AUTH_BYPASS=true      # libera /api/v1 sem sessão Clerk
#   DEV_TENANT_ID=<orgId de teste>
export BASE=http://localhost:3000
```

### 1. `/api/v1` (CRUD) — via **bypass DEV** (sem login)

O tenant/papel vêm dos headers `x-dev-*`. Padronize um helper:

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

**Casos obrigatórios** (todo CRUD): valide os 4xx canônicos, não só o caminho feliz:

```bash
# 422 VALIDATION (zod)      — campo fora do domínio
api -X POST "$BASE/api/v1/companies" -d '{"razaoSocial":"X","riskGrade":9}'
# 409 DUPLICATE             — repete valor único no mesmo tenant (ex.: cnpj)
# 404 NOT_FOUND cross-tenant — id de OUTRO escritório:
api -H 'x-dev-tenant: org_a' "$BASE/api/v1/companies/<id_do_org_b>"   # 404
# 403 FORBIDDEN             — papel client:
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'x-dev-tenant: org_a' -H 'x-dev-role: client' "$BASE/api/v1/companies"  # 403
```

> **Isolamento** é o caso crítico: trocar `x-dev-tenant` NUNCA pode devolver dado de outro escritório
> (id alheio → 404, list → só o tenant do header).

### 2. `/api/integrations/*` — exige **sessão Clerk real**

Não há bypass aqui (o `proxy.ts` protege e não há dado de tenant). Sem sessão → **307/redirect** para
o sign-in (nunca é proxy aberto). Para testar o caminho feliz, copie o cookie `__session` do navegador
logado (DevTools → Application → Cookies) e mande no header:

```bash
SESSION='<valor do cookie __session>'
curl -s -w '\n[HTTP %{http_code}]\n' -H "cookie: __session=$SESSION" \
  "$BASE/api/integrations/cep/01001000"      # 200 ok(endereço)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/integrations/cep/99999999"  # 404 (autenticado) / 307 (sem sessão)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/integrations/cep/123"       # 422 formato / 307 sem sessão
```

### 3. Provedores externos direto (isola "é a API deles ou o nosso código?")

```bash
curl -s "https://viacep.com.br/ws/01001000/json/" | jq .
# BrasilAPI 403 sem User-Agent → sempre mande um:
curl -s -A 'sst-manager/1.0' "https://brasilapi.com.br/api/cnpj/v1/00000000000191" | jq '.razao_social'
```

### 4. Checklist antes de abrir PR de CRUD

- [ ] `/api/v1/<resource>` responde GET/POST e `/[id]` responde GET/PUT/DELETE (201/204 corretos).
- [ ] 422 / 409 / 404 cross-tenant / 403 (papel client) reproduzidos por cURL.
- [ ] Recurso documentado neste arquivo (tabelas "Recursos" + "Sumário").
- [ ] Requests adicionados ao `sst-manager.postman_collection.json` (pasta do recurso).

## Serviços por empresa — NOB-100

GET `/api/v1/companies/{id}/modules?page=1&pageSize=20` retorna `{modules,history:{rows,total}}`. A consulta exige equipe interna. PUT usa `{module:"pgr"|"medicine",enabled:boolean,reason:string}` (motivo obrigatório, até 500 caracteres), exige owner e retorna as habilitações. Ambas as superfícies usam o mesmo core das Actions `getCompanyModuleOverviewAction` e `changeCompanyModuleAction`. Empresa fora do tenant → NOT_FOUND; colaborador tentando alterar → FORBIDDEN; entrada inválida → VALIDATION.

**Consistência e proteção no banco (NOB-170/171):**

- **Uma única fonte de verdade:** `company_modules` com `enabled = true`. A listagem (`pgrEnabled`/`medicineEnabled`), a página de serviços, os seletores (`listCompanyOptionsAction(module)`) e as policies usam o mesmo predicado `companyModuleScope`, que qualifica as colunas pela tabela.
  - Antes, no SELECT da listagem, o drizzle omitia o nome da tabela, e a subconsulta comparava `company_modules` com ela mesma. Resultado: "Sem módulos" para empresas habilitadas.
- **Owner também no banco (migration `0078_company_module_owner_writes`):** policies restritivas aceitam INSERT/UPDATE em `company_modules` e INSERT em `company_module_events` só quando o ator da sessão (`app.current_actor`) é administrador do escritório (`owner`/`org:admin`).
  - O evento registra o próprio ator em `changed_by`.
  - O core passa o ator à sessão.
- **Falhas de leitura** aparecem como erro com "Tentar novamente", nunca como "Desabilitado" ou "Nenhuma empresa".
- **Tela `/companies/{id}/services`:**
  - um cartão por serviço, com status "Habilitado"/"Desabilitado" (texto e ícone);
  - a ação conforme o estado, só para o owner;
  - um diálogo de confirmação com empresa, estado atual e novo, consequência e motivo obrigatório (até 500 caracteres);
  - o estado vem do servidor após a resposta, sem atualização otimista;
  - histórico recolhível, em que eventos de migration aparecem como "Sistema".
- **Listagem `/companies`:** "PGR ativo/desabilitado", "Medicina ativa/desabilitada" ou "Nenhum serviço habilitado".

A mudança de estado e o evento são transacionais. Repetir o estado atual não duplica histórico. Desabilitar preserva registros; RLS bloqueia uso de PGR/exames para a empresa. Não altera Pro, trial, preços ou Stripe. UI: `/companies/{id}/services`, acessível na lista de empresas. Medicina sem PGR e o registro externo são integrados na NOB-98.

## Fontes de riscos para Medicina — NOB-98

GET `/api/v1/companies/{id}/medical-risk-sources?page=1&pageSize=20` retorna `{rows,total,validationAvailable,validationNotice}`. Cada fonte inclui origem/referência/versão/fingerprint, registro por usuário/data, situação de atualização (`current`, `changed`, `unavailable`, `superseded`, `external_reference`), avisos e riscos com estado de revisão. Não exige PCMSO cadastrado.

POST externo: `{kind:"external",title,reference (≥ 5 caracteres),version,documentDate?,preparedBy?,reviewDueOn?,risks:[{agentType,description,exposureGroup,jobRole?,possibleInjuries?,exposureDescription?,noxiousAgentCode?}],supersedesSourceId?}`. POST interno: `{kind:"internal",pgrId,supersedesSourceId?}`. Retorno 201 com os metadados da fonte. Ambos validam empresa/tenant e Medicina habilitada. A origem interna também respeita acesso ao PGR. Apenas funcionários internos owner/collaborator; cliente → 403.

Importação nunca aceita status, aprovador ou dados clínicos não previstos. Os riscos começam pendentes e não são liberados automaticamente para PCMSO. A revisão exige autorização profissional ativa por empresa, conforme o fluxo abaixo.

### PGR externo em empresa só com Medicina — NOB-111

O fluxo da NOB-98 já permitia, com **Medicina habilitada e PGR desabilitado**:

- registrar o PGR de terceiros como fonte externa;
- validar cada risco pelo profissional autorizado pela empresa-cliente;
- usar só os riscos validados no plano e no PCMSO.

A NOB-111 completa as lacunas desse fluxo (migration `0079_external_pgr_provenance`, aditiva):

- **Proveniência do documento.** `documentDate`, `preparedBy` e `reviewDueOn` (colunas em `medical_risk_sources`), só como o documento informa e sempre opcionais.
  - O CHECK as limita a fontes externas e exige revisão ≥ data do documento.
  - Data do documento futura → `422`.
  - A referência exige ≥ 5 caracteres.
  - Avisos: data do documento não informada; data de revisão informada já vencida (nesse caso, registrar a versão revisada como nova fonte).
- **Código do agente nocivo informado na origem.** `noxiousAgentCode` (formato da Tabela 24, `NN.NN.NNN`), pendente de validação como o resto do risco.
  - A proposta de exames passa a aplicar as regras também aos riscos externos validados. Antes, todo risco externo caía em "sem código".
  - Sem código, o coordenador define os exames; nada é inventado.
- **Situação da fonte (derivada, não gravada):** `registered_without_risks`, `awaiting_validation`, `validated`, `rejected`, `superseded`, `origin_changed`. Ausência de riscos nunca é ausência comprovada.
- **Origem no PCMSO.** `riskBasis.origin` ("PGR interno", "PGR externo validado" ou ambos) e, por fonte, `origin`, `reference`, `documentDate`, `preparedBy`, `validatedRisks` e `lastValidatedOn`.
  - Fonte externa sem risco validado nunca recebe o rótulo de validada.
  - Prévias já arquivadas não mudam.
- **Permissões.** O recurso é do escopo Medicina (RLS `medical_sources_module_access`).
  - O módulo PGR continua fechado para a empresa: `pgr_module_access` recusa leitura e escrita de PGR interno.
  - Owner, colaborador e médico coordenador não validam riscos pelo papel.
  - O plano continua dependendo da decisão e aprovação do médico (NOB-150).
- **Fora do escopo.**
  - Upload do arquivo do PGR externo: a referência é textual e não há bucket.
  - Extração automática de PDF e IA.
  - Revogação de fonte sem nova versão: a invalidação é feita por rejeição dos riscos pelo profissional autorizado ou por nova versão. Quem poderia revogar uma fonte inteira não está definido, então o fluxo falha fechado.

## Autorização profissional e revisão de riscos — NOB-98

Área `/risk-authorizations` e `/risk-authorizations/{companyId}`. Reutiliza contas e vínculos existentes na organização. O owner registra a indicação **da empresa-cliente**, com referência à evidência e motivo; o indicado utiliza login próprio para autorizar ou revogar profissionais naquela empresa. Owner/colaborador não recebem esses poderes automaticamente. Os demais endpoints continuam restritos à equipe do escritório.

| Recurso                                                  | Métodos                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/companies/{id}/risk-authorizations?page=1&pageSize=20` | GET: capacidades, candidatos permitidos, autorizações, histórico e inventário; PUT: indicação/revogação pelo owner |
| `/companies/{id}/risk-authorizations/professionals`      | PUT: concessão/revogação somente pelo autorizador atual                                                            |
| `/companies/{id}/medical-risks/{entryId}/review`         | POST: decisão pelo profissional com autorização ativa e Medicina habilitada; retorna 201                           |

Essas rotas usam tenant/usuário da sessão e verificam vínculo e escopo da empresa no core/repositório. Atores e datas são definidos no servidor. GET permite owner, autorizador e profissional ativo. Profissional vê apenas suas próprias autorizações/eventos/decisões, além dos riscos da empresa. Candidatos pertencem à organização e têm vínculo compatível, disponíveis somente a owner/autorizador. A lista visual limita-se a 1.000 contas com aviso de truncamento; histórico/fontes paginados.

PUT indicação: `{userId: "conta-existente" | null, evidence: "referência à indicação da empresa", reason: "motivo"}`. `null` revoga a indicação. Substituir o autorizador remove seu poder imediatamente; concessões profissionais vigentes persistem até revogação explícita. Remover o vínculo com a organização encerra as concessões atuais por FK; histórico permanece. Evidência é referência textual, sem upload novo ou verificação externa de autenticidade.

PUT profissional ativo: `{userId, active:true, identity:{fullName, profession, registration:{kind:"registered",council,number,region?}}, reason}`. Registro não aplicável: `registration:{kind:"not_applicable",reason}`. Declaração pelo cliente/responsável, sem inferir profissão ou conselho obrigatório. Revogação: `{userId,active:false,reason}`. Não se criam contas/convites ou regras comerciais neste fluxo.

POST revisão: `{status:"validated"|"rejected",reason,expectedStatus:"pending"|"validated"|"rejected",expectedReviewedAt:ISO8601|null}`. Utilizar status/data da leitura. Concorrência ou origem interna alterada, indisponível ou substituída na validação → `422 VALIDATION`; conta sem poder → `403 FORBIDDEN`; recurso fora do tenant → `404 NOT_FOUND`. Rejeição pode registrar problema em fonte antiga. Importação sempre inicia pendente; uma nova versão exige nova revisão. Sem aprovação em lote ou inferência técnica automática. Nova decisão registra histórico adicional.

Estado e histórico são transacionais. A decisão guarda usuário, instante, motivo, identificação profissional vigente e fingerprint da fonte. Conteúdo importado é imutável; `app_runtime` atualiza somente os quatro campos de revisão. Eventos/decisões não permitem UPDATE/DELETE pelo runtime. Migration aditiva `0056_company_risk_authorizations`, sem backfill de autorizações técnicas, a aplicar pelo processo normal após revisão.

### Declaração de inexistência de riscos — NOB-156

Em `domains/medicine/risk-absence.ts`, `server/medicine/risk-absence-core.ts` e `repositories/risk-absence-declarations.ts`. Migrations `0068_medical_risk_absence_declarations` e `0080` (função pelo id, NOB-112/NOB-110).

**Quem declara.**

- Só o profissional com autorização ativa de validação de riscos nesta empresa (a mesma desta seção), dentro do escopo da conta. A RLS repete a regra, com o ator da sessão.
- Owner, colaborador, cliente sem autorização e outro tenant → `403`.

**O que declara.** Que o GES, para uma função ou para o grupo todo (função vazia), não tem exposição a riscos que exijam controle médico, numa versão da fonte, com justificativa (mínimo de 20 caracteres).

**Função (NOB-112).**

- A função vai pelo id: `jobRoleId` de uma função cadastrada desta empresa, deste tenant, vinculada ao GES escolhido (`ges_job_roles`). Id de outro GES, de outra empresa, de outro tenant ou inexistente → `422` com a mensagem em `fields.jobRoleId`, e nada é gravado. Sem `jobRoleId` (ou vazio) = grupo todo.
- `jobRole` (texto) não é mais aceito no POST → `422` com a dica em `fields.jobRole`. Texto livre não identifica a função: digitação errada nunca valia, e renomear a função invalidava a declaração.
- O GET devolve `groups[].jobRoles` (`id`, `title`) para quem pode declarar; a tela escolhe a função numa lista do GES e envia o `id`.
- A declaração grava `job_role_id` e, como texto histórico, o título no momento da declaração (`job_role`). O GET devolve `jobRole` (título declarado), `jobRoleId` e `currentJobRole` (título atual, se renomeada; `null` sem id).
- Banco: FK composta `(job_role_id, org_id, company_id)` → `job_roles (id, org_id, company_id)` (mesmo tenant e mesma empresa); `ON DELETE SET NULL (job_role_id)`: excluir a função zera só o id, e a declaração deixa de valer. CHECK: grupo todo nunca tem id. Policy de inclusão: título vazio sem id, ou id vinculado ao GES com o título atual da função; texto sem id não entra mais. Uma declaração por fonte, GES e função (pelo id), mesmo depois de renomeada.

**Nunca automática.**

- Cadastro vazio nunca vira inexistência.
- Fonte substituída, mudada em relação ao PGR ou indisponível → `422`.
- Grupo/função com risco pendente ou validado nessa fonte → `422` (para o grupo todo, risco de qualquer função impede).
- Repetir o escopo na mesma fonte → `422`.

**Vigência.**

- Vale só para a versão da fonte em que foi feita: nova fonte exige nova declaração.
- `medical_risk_absence_declarations` é só inclusão (`app_runtime` com SELECT e INSERT), com autor, data e justificativa.

**ASO (conteúdo v2).**

- Com declaração vigente para o GES/função do funcionário e nenhum risco pendente ou validado, o item c traz `risksAbsence` (texto fixo de inexistência, fonte, versão, autor e data) e não bloqueia.
- Riscos pendentes continuam bloqueando.
- Com riscos validados, valem os riscos, e o aviso `risk_absence_conflict` aparece.
- Sem declaração: `risks_absence_not_declared` ou `risk_source`, como antes.
- A função casa pelo id da função cadastrada do funcionário, e ela precisa continuar vinculada ao GES da declaração. Renomear a função não muda nada. Funcionário trocado de função, ou função desvinculada do GES → não vale, e a mensagem de `risks_absence_not_declared` explica.
- Declarações antigas (só título): a migração `0080` preenche `job_role_id` só quando é inequívoco (exatamente uma função da mesma empresa com exatamente aquele título, vinculada ao GES da declaração). As demais ficam sem id, não valem e a mensagem pede regularização: o profissional autorizado declara de novo escolhendo a função do GES. Nada é associado por semelhança de texto, apagado ou reescrito (autor, data e justificativa ficam).

Telas: seção "Declarações de inexistência de riscos" em `/companies/{id}/medical-risks` e em `/risk-authorizations/{id}`, onde o profissional valida os riscos.

Actions em `actions/medicine/risk-authorizations.ts`: listRiskAuthorizationCompaniesAction, getRiskAuthorizationWorkspaceAction, appointCompanyAuthorizerAction, authorizeCompanyProfessionalAction e decideCompanyRiskAction. Action e REST compartilham core.

Esse registro não verifica conselho profissional nem substitui assinatura do documento, parecer técnico humano ou homologação autenticada.

As fontes são imutáveis; novo registro pode substituir uma fonte anterior da mesma empresa. Fonte repetida → DUPLICATE/409; fonte anterior fora da empresa → FK_NOT_FOUND/422; PGR ausente/de outro tenant → NOT_FOUND/404; Medicina não habilitada → FORBIDDEN/403; JSON/entrada inválidos → VALIDATION/422. Até 500 riscos por fonte. Fonte sem riscos gera aviso explícito e não equivale a ausência de exposição. O fingerprint inclui inventário e avaliação vigente, sem depender apenas do número da revisão. Fonte externa exige referência manual a sua origem; não há extração de PDF, prescrição médica ou geração de PCMSO nesta entrega.

## Catálogo de procedimentos e proposta de exames — NOB-147

Fatia da NOB-109, **sem migration**. Catálogo = **Tabela 27 do eSocial** (S-1.3, NT 07/2026 rev. 20/10/2026), importada verbatim do anexo oficial por `scripts/medicine/import-esocial-table-27.ts` para `domains/medicine/procedures/esocial-table-27.json`, com URL, versão e SHA-256 da fonte. Código fora da tabela → `VALIDATION`/`404`; `9999` ("Outros") exige descrição (`procedureSelectionSchema`). O catálogo não guarda resultado clínico; a linha do ASO leva só indicação e data (`toAsoProcedureLine`).

### Lista C — NTEP (NOB-113, MED-16)

**Sem migration.** É um catálogo global de referência, sem dado de pessoa, **distinto da Tabela 27** (procedimentos, NOB-147).

- **Fonte.** Decreto nº 3.048/1999, Anexo II, **Lista C**, incluída pelo Decreto nº 6.957/2009.
  - Fonte primária: o texto atualizado da Câmara dos Deputados.
  - Conferências: o anexo compilado do Planalto (`D3048anexoii-iii-iv.htm`) e o Decreto 6.957/2009 original (Planalto). As três matrizes são idênticas.
  - A única anotação de redação dentro da Lista C é a inclusão de 2009.
- **Importação.** `scripts/medicine/import-ntep-lista-c.ts` gera `domains/medicine/ntep/lista-c.json` verbatim, sem nada digitado à mão. O arquivo registra:
  - versão, URL e `sha256` da fonte;
  - as conferências, cada uma com seu `sha256`;
  - a data de extração, as contagens e o `normalizedSha256`.
  - Divergência entre as fontes, token inesperado, duplicata, sobreposição ou falta da nota interrompem a importação.
  - Reimportar a mesma fonte gera o mesmo arquivo.
- **Semântica.** Cada linha relaciona um intervalo CID-10 às classes CNAE da própria linha, nunca em produto cartesiano. A Nota 1 inclui "todas as subclasses cujos quatro dígitos iniciais sejam comuns": a subclasse (`4120-4/00`) e a classe com DV (`41.20-4`) valem pelos 4 dígitos iniciais.
- **Consulta (`lookupNtep`).** O snapshot é revalidado ao carregar (formato, contagens e hash).
  - Distingue `match`, `no_match`, código malformado (`422`), `unavailable`, `unvalidated` e `version_not_available`.
  - Nenhum problema de catálogo vira "sem correspondência".
  - O CID-10 é conferido só no formato; a classe, só nos 4 dígitos, sem DV.
- **Limites clínicos.** A resposta traz `notice`: a correspondência é epidemiológica e informativa. Não estabelece nexo individual, doença ocupacional, incapacidade, aptidão, necessidade de CAT nem resultado pericial. Nada é gravado; PCMSO, ASO e prontuário não são alterados.
- **Empresa.** `GET /api/v1/companies/{id}/ntep` usa o CNAE cadastrado (tenant da sessão, Medicina habilitada). Sem CNAE → `missing_cnae`; sem classe identificável → `invalid_cnae`.
- **Atualização futura.**
  1. Baixar as páginas oficiais e rodar o importador com nova `versão`.
  2. Revisar o diff de intervalos e classes.
  3. Uma mudança normativa vira novo snapshot versionado no Git, nunca edição manual.
  - O histórico das versões fica no Git (`lista-c.json`).

| Action                 | Entrada                     | Retorno                                              |
| ---------------------- | --------------------------- | ---------------------------------------------------- |
| `lookupNtepAction`     | `{ cid?, cnae?, version? }` | `NtepLookup` (`kind`, `matches`, `source`, `notice`) |
| `getCompanyNtepAction` | `companyId`                 | `{ company, cnaeClass, status, result }`             |

Tela: `/medicine/ntep`, com link no painel de Medicina.

Proposta (`domains/medicine/exam-proposal.ts`): lê **todas** as fontes do inventário da Medicina (NOB-98). Só riscos `validated` de fonte `current`/`external_reference` geram sugestão. Pendentes, rejeitados e de fonte desatualizada saem em `excluded`, e riscos sem código da Tabela 24 ou sem regra saem em `withoutRule`. Nenhum desses gera exame. Regras (`domains/medicine/exam-rules.ts`), só com respaldo literal da NR-7:

| Agente (Tabela 24)                                                     | Procedimento (Tabela 27)                       | Referência                             |
| ---------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `02.01.001` Ruído                                                      | `0281` Audiometria tonal ocupacional           | NR-7, Anexo II, itens 2 e 4            |
| `01.18.001` Sílica · `01.02.001` Asbestos · `01.07.001` Carvão mineral | `1078` Radiografia de tórax padrão OIT         | NR-7, Anexo III, item 1, a, e Quadro 1 |
| idem                                                                   | `1057` Prova de função pulmonar (espirometria) | NR-7, Anexo III, itens 1, b, e 3.1     |

`ExamProposal`: `{ requiresMedicalReview: true, rulesVersion, clinicalExam, basis[], groups[{ exposureGroup, jobRole, suggestions[{ procedureCode, procedureDescription, reference, condition, periodicity, notes, triggeredBy[] }], withoutRule[] }], excluded{pending,rejected,outdated}, warnings[] }`. A periodicidade é **citada** da norma, não calculada. Inventário vazio nunca vira "sem riscos".

| Action                   | Entrada                      | Retorno (`data`)                       |
| ------------------------ | ---------------------------- | -------------------------------------- |
| `searchProceduresAction` | `search, { page, pageSize }` | `{ rows: Procedure[], total, source }` |
| `getProcedureAction`     | `code`                       | `Procedure & { source }` (`NOT_FOUND`) |
| `getExamProposalAction`  | `companyId`                  | `ExamProposal`                         |

Fora desta fatia: revisão/aprovação do plano pelo médico coordenador (persistência nova + identidade do médico, NOB-121) e geração do PCMSO.

## Conferência dos dados do PCMSO — NOB-148

Fatia da NOB-109, **sem migration**. `checkPcmsoReadiness` (`domains/medicine/pcmso-readiness.ts`) confere o que falta para o PCMSO de uma empresa poder ser gerado, nos moldes da conferência do PGR (NOB-105). Ela não gera, não aprova e não assina.

| Situação        | Itens                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocking`      | razão social/CNPJ, CNAE, ramo de atividade e grau de risco da empresa (MED-08); coordenador do PCMSO vigente hoje, e sem sobreposição (NR-7 7.4.1 c; NOB-109); fonte de riscos (7.5.1); nenhum risco validado em fonte vigente (7.5.1; não comprova ausência de riscos); risco validado em fonte que mudou (7.5.5); nenhum médico ativo (MED-08; 7.5.4 d) |
| `warning`       | sem funcionário ativo (cronograma vazio); coordenador sem RQE (exceção 7.5.2, mostra a justificativa); riscos pendentes; risco sem possível agravo (7.5.4 a); risco sem regra de exame (7.5.4 b)                                                                                                                                                          |
| `not_available` | plano de exames aprovado pelo coordenador (7.5.4 b; MED-15), critérios de interpretação e condutas (7.5.4 c), clínicas (MED-08), campanhas de saúde (MED-08), relatório analítico (7.5.4 e; 7.6.2). São etapas que o sistema ainda não tem; nunca são simuladas                                                                                           |

Retorno: `{ ready, items[{ code, severity, message, reference, href }], counts }`. `ready` só fica `true` sem `blocking` e sem `not_available`.

O core reúne empresa, inventário (`loadProposalSources`, da NOB-147), coordenador (NOB-144), funcionários ativos ou afastados e médicos ativos. Empresa de outro tenant → `NOT_FOUND`; sem Medicina → `FORBIDDEN`.

**Coordenador conferido (NOB-109):** é o **vigente na data da conferência** (hoje em America/Sao_Paulo, calculado no servidor, nunca vindo do cliente), pelo período `starts_on ≤ hoje ≤ ends_on` (ou `ends_on` nulo):

- designação que só começa no futuro não conta (`coordinator`, bloqueio);
- designação encerrada antes de hoje não conta;
- encerramento agendado mantém a coordenadora vigente até a data final;
- mais de uma designação vigente no mesmo dia → `coordinator_overlap` (bloqueio), sem escolher uma. O app impede períodos sobrepostos; a sobreposição só surge por escrita fora do app.

| Action                    | Entrada     | Retorno (`data`) |
| ------------------------- | ----------- | ---------------- |
| `getPcmsoReadinessAction` | `companyId` | `PcmsoReadiness` |

## Máquinas por obra e ambiente — NOB-104

| Recurso                                | Métodos                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `/companies/{id}/machines`             | GET paginado, POST criar vínculo (201)                                          |
| `/pgr/{id}/readiness`                  | GET conferência de preenchimento/consistência                                   |
| `/pgr/{id}/reviews`                    | GET/POST amostras; `/{sampleId}` GET; `/{sampleId}/decisions` POST              |
| `/pgr-basic-offers`                    | GET/POST versões; `/{id}` GET; `/{id}/publication` PUT                          |
| `/companies/{id}/machines/options`     | GET opções compatíveis (obra, GES e catálogo machine)                           |
| `/companies/{id}/machines/{machineId}` | GET detalhe e histórico paginado, PUT alterar, DELETE retirar logicamente (204) |

Somente owner/colaborador; tenant e ator vêm da sessão. PGR deve estar habilitado para a empresa. UI em `/companies/{id}/machines`, acessível por Serviços da empresa.

Entrada estrita: `{workUnitId,gesId:null|uuid,catalogId,mode:"individual"|"group",quantity,identifier?,description,operatingConditions?,safetyMeasures?,maintenanceNotes?,responsible?,reason}`. Individual exige quantidade 1 e identificação; grupo aceita quantidade inteira positiva. Campos de segurança são fatos declarados; não se presume certificação ou neutralização.

PUT recebe `{expectedVersion,data}`; DELETE recebe `{expectedVersion,reason}`. Versão divergente retorna 422 VALIDATION. Referências devem ter mesmo tenant, empresa e obra; catálogo aceita apenas machine global ou da mesma empresa. EPI, GES divergente e referências cruzadas retornam 422 FK_NOT_FOUND. GET aceita page/pageSize; lista aceita includeInactive=true. Retirada preserva catálogo, vínculo e eventos; não há exclusão física pelo runtime.

Estado e evento são transacionais, com snapshot antes/depois, ator, motivo e data. RLS reforça tenant, módulo e contexto; eventos não permitem UPDATE/DELETE. Migration 0057 aditiva, sem atribuição automática de máquinas legadas a ambientes. O DOCX inclui somente vínculos ativos da obra e dos GES selecionados para aquele PGR.

Actions: `actions/pgr/machine-installations.ts`, core compartilhado `server/pgr/machine-installation-core.ts`. Lista de opções limitada a 100 por cadastro, com aviso explícito se houver mais. Histórico paginado.

## Conferência e geração consistente — NOB-105

GET `/api/v1/pgr/{id}/readiness` (Action `getPgrReadinessAction`) retorna `{ready,blockingCount,warningCount,issues:[{code,severity,message,context,href}],sourceSha256,notice}`. Staff apenas, PGR habilitado. Verifica preenchimento e consistência de identificação, vigência, GES/funções, avaliação, produto probabilidade/severidade, classificação na metodologia vigente e cobertura do plano. Ausência de riscos gera aviso, não declaração de levantamento concluído. Os critérios são operacionais do software, não lista normativa exaustiva.

Consolidado, extras (inclusive máquinas) e metodologia são lidos em uma transação repeatable-read/read-only. O token sourceSha256 identifica esses dados. A conferência não grava parecer nem assinatura.

Downloads DOCX/PDF existentes permanecem disponíveis como prévias, com aviso explícito no documento. POST `/api/v1/pgr/{id}/docx` aceita adicionalmente `{purpose:"issue",expectedSourceSha256:"token-da-conferencia",format:"docx"|"pdf",overrides?}`. Releitura transacional e comparação do token impedem gerar usando uma conferência antiga; pendências bloqueantes ou tags sem mapeamento retornam 422 VALIDATION. A geração conferida também não equivale a aprovação técnica ou assinatura.

Headers preservados de template/origem/arquivo e instante. Novo X-Pgr-Snapshot-Sha256 corresponde ao token da conferência; X-Pgr-Source-Sha256 anterior inclui também overrides e hash do logo. X-Pgr-Purpose identifica preview/issue. Nenhum dado sensível é incluído nos headers. A rota binária é exceção documentada ao envelope REST; a conferência tem Action+REST. UI no editor do PGR, aba de documentos.

## Oferta de PGR básico — NOB-106

| Recurso                              | Métodos                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `/pgr-basic-offers`                  | GET versões/histórico paginados; POST nova versão imutável em rascunho (201) |
| `/pgr-basic-offers/{id}`             | GET versão                                                                   |
| `/pgr-basic-offers/{id}/publication` | PUT publicar ou retirar versão                                               |

Owner apenas. UI `/pgr-basic-offer`; Actions `actions/pgr/basic-offers.ts` compartilham core com REST. Não é checkout/contratação: nenhuma operação altera Stripe, Pro, serviços da empresa ou contratos vigentes. Não há oferta inicial/preço predefinido nem isenção por porte.

POST recebe `{name,eligibility,technicalScope,servicesIncluded,limitations,priceCents:null|inteiro,currency:"BRL",billingPeriod:null|"one_time"|"monthly"|"annual",maxEmployees:null|inteiroPositivo,maxWorkUnits:null|inteiroPositivo,maxRevisions:null|inteiroNaoNegativo,reason}`. Campos de texto podem ficar vazios em rascunho. Cada gravação cria nova versão; versões/eventos não aceitam UPDATE/DELETE pelo runtime. Limites são condições comerciais declaradas, sem suprimir o levantamento ou dados do documento.

Publicação PUT: `{active:true,expectedActiveVersionId:uuid|null,commercialApprovalReference,technicalApprovalReference,reason}`. Exige público, escopo, serviços, limitações, preço e periodicidade definidos e referências de aprovação específicas da versão. A evidência é registrada pelo owner; não representa validação automática de autenticidade ou parecer emitido pelo software. Retirada: `{active:false,expectedActiveVersionId:uuid,reason}`. Mudança concorrente retorna 422 VALIDATION. Nova versão em rascunho não substitui publicação vigente.

Numeração e publicação serializadas por tenant; estado/evento transacionais. RLS reforça tenant, vínculo de versões e owner na escrita. Migration 0058 aditiva e sem backfill comercial. Sem exclusão física e sem alterações retroativas. Contratação/cobrança segue na NOB-114 e demais issues comerciais.

## Amostras e pareceres recebidos do PGR — NOB-107

| Recurso                                  | Métodos                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| `/pgr/{id}/reviews`                      | GET amostras paginadas; POST gerar e preservar amostra (201) |
| `/pgr/{id}/reviews/{sampleId}`           | GET detalhe e histórico paginado                             |
| `/pgr/{id}/reviews/{sampleId}/decisions` | POST registrar parecer recebido (201), somente owner         |

Actions `actions/pgr/document-reviews.ts`, mesmo core da API. UI `/pgr/{id}/reviews`, acessível na aba Documentos. Staff opera amostras; apenas owner registra recebimento de parecer externo. Esse papel administrativo não concede competência técnica: avaliador declarado, identidade profissional, data e evidência do parecer ficam separados do usuário que registrou o recebimento. Não há aprovação, assinatura ou envio automático ao profissional.

POST amostra `{reason,supersedesSampleId:null|uuid}` gera DOCX real de prévia usando um snapshot transacional, grava os bytes no Storage privado e cria documento GED/amostra/snapshot em transação. Erro no banco compensa o upload. Amostra guarda hashes de dados, template e arquivo; registro não aceita conteúdo ou hashes fornecidos pelo cliente. O arquivo exato fica protegido contra exclusão; versões antigas e pareceres não são reescritos. Revalidação gera nova amostra ligada à anterior, sem substituir o original.

POST parecer `{expectedLatestDecisionId:null|uuid,status:"accepted"|"changes_requested",reviewer:{fullName,profession,registration},reviewedAt:ISO8601,evidenceReference,reason,findings:[{key,location,description,severity:"blocking"|"observation",resolution:"open"|"resolved",correctionReference:null|string}]}`. Registro profissional segue a mesma identificação declarada das autorizações de riscos, com justificativa se não aplicável. Data futura é rejeitada; ator/data de registro vêm do servidor. Evidência é referência a documento/parecer recebido, sem validação externa de autenticidade.

Parecer favorável registrado não aceita achado impeditivo aberto. Correção exige referência. Revalidação mantém códigos dos achados anteriores e não pode omitir impeditivos nem escondê-los reduzindo severidade. Cada parecer é append-only; token esperado e lock por amostra protegem concorrência. Mudanças atuais do PGR não invalidam ou reescrevem o parecer histórico: a UI sinaliza dados diferentes e oferece nova amostra. Decisões referem-se sempre ao arquivo preservado, inclusive quando o cadastro já mudou.

Migration 0059 aditiva. RLS tenant/módulo e referências, FK composta para amostra anterior do mesmo PGR, restrição owner na inserção de parecer. Runtime não atualiza/exclui amostras/decisões. Histórico e snapshots protegidos no banco; nenhuma evidência de cliente real foi criada por esta execução.
