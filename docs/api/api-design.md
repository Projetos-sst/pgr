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

| Recurso                                                                                                                                                        | Verbos                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/companies` · `/companies/{id}` · `/companies/{id}/dependents`                                                                                                | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/work-units` · `/work-units/{id}` · `/work-units/{id}/dependents`                                                                                             | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/job-roles` · `/job-roles/{id}` · `/job-roles/{id}/dependents`                                                                                                | GET, POST · GET, PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/ges` · `/ges/{id}` · `/ges/{id}/dependents`                                                                                                                  | GET, POST · GET (inclui `exposedWorkers`), PUT, DELETE · GET                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/ges/{id}/job-roles` · `/ges/{id}/job-roles/{linkId}`                                                                                                         | GET (`?available=true` p/ não vinculadas), POST · PUT, DELETE                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/ges/{id}/risk-suggestions` · `/ges/{id}/risk-suggestions/accept`                                                                                             | POST (sugere riscos por IA — não persiste) · POST (persiste selecionados como rascunho, `201`)                                                                                                                                                                                                                                                                                                                                                                   |
| `/employees` · `/employees/{id}` · `/employees/{id}/epi-record`                                                                                                | GET, POST · GET, PUT, DELETE · GET (ficha de EPI, read-only)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/pgr` · `/pgr/{id}`                                                                                                                                           | GET, POST · GET, PUT, DELETE (documento PGR; sem `/dependents`). **`PUT` em PGR assinado ou publicado → `409 ALREADY_SIGNED`** (trava imposta no servidor, não só na UI)                                                                                                                                                                                                                                                                                         |
| `/pgr/{id}/revisions`                                                                                                                                          | GET (histórico, mais recente primeiro), POST (número **server-side**; `revisionNumber` no body → `422`; `201`; PGR assinado/publicado → `409 ALREADY_SIGNED`)                                                                                                                                                                                                                                                                                                    |
| `/pgr/{id}/ges` · `/pgr/{id}/ges/{gesId}`                                                                                                                      | GET (GES vinculados ao PGR), POST (vincula GES; `201`) · DELETE (desvincula; `204`); ambas as escritas em PGR assinado/publicado → `409 ALREADY_SIGNED`                                                                                                                                                                                                                                                                                                          |
| `/pgr/{id}/consolidated`                                                                                                                                       | GET (visão consolidada read-only: GES → riscos → avaliação vigente → medidas 5W2H → EPIs; campos eSocial S-2240)                                                                                                                                                                                                                                                                                                                                                 |
| `/pgr/{id}/signature`                                                                                                                                          | POST (cria solicitação; body só `ttlSeconds?`; `201` com `publicUrl`+`qrCodeDataUrl`) · GET (estado derivado; **nunca** token/URL)                                                                                                                                                                                                                                                                                                                               |
| `/pgr/{id}/pdf`                                                                                                                                                | GET (gera o PDF do PGR via Gotenberg; `?color=` opcional para a capa; `application/pdf`; PGR inexistente/cross-tenant → 404; serviço de PDF ausente → 503)                                                                                                                                                                                                                                                                                                       |
| `/risks` · `/risks/{id}`                                                                                                                                       | GET, POST · GET, PUT, DELETE (inventário de risco do GES; filtros `companyId`/`workUnitId`/`gesId`; sem `/dependents`, sem 409)                                                                                                                                                                                                                                                                                                                                  |
| `/risks/{id}/epis` · `/risks/{id}/epis/{linkId}`                                                                                                               | GET (`?available=true&search=` p/ EPIs não vinculados), POST · PUT (neutralização), DELETE (vínculo EPI × risco)                                                                                                                                                                                                                                                                                                                                                 |
| `/risks/{id}/assessments` · `/risk-assessments/{id}`                                                                                                           | GET, POST (avaliação 5×5 do risco; 201) · GET, PUT, DELETE (histórico 1:N; `riskLevel`/`result` calculados; sem `/dependents`, sem 409)                                                                                                                                                                                                                                                                                                                          |
| `/risks/{id}/control-measures` · `/control-measures/{id}`                                                                                                      | GET, POST (plano de ação 5W2H por nível NR-01; 201) · GET, PUT, DELETE (nível imutável; **DUPLICATE/409** se nível repetido; sem `/dependents`)                                                                                                                                                                                                                                                                                                                  |
| `/categories` · `/categories/{id}`                                                                                                                             | GET, POST · GET, PUT, DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/medicos` · `/medicos/{id}`                                                                                                                                   | GET (`?search=` nome/CRM, `?status=active\|inactive`), POST (`201`) · GET, PUT, DELETE (`204`) — CRM único por org (`DUPLICATE`); sem `/dependents`                                                                                                                                                                                                                                                                                                              |
| `/health-exams` · `/health-exams/{id}`                                                                                                                         | GET (`?search=` funcionário, `?examType=`), POST (`201`) · GET, PUT, DELETE (`204`) — exames ocupacionais/ASO; validade **derivada** na leitura; funcionário/médico cross-tenant → `422 FK_NOT_FOUND`; sem `/dependents`                                                                                                                                                                                                                                         |
| `/risk-methodology`                                                                                                                                            | GET, PUT (singleton por org — sem `list`/`{id}`/`dependents`)                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/epi-catalog` · `/epi-catalog/{id}` · `/epi-catalog/{id}/dependents`                                                                                          | GET (`?search=` nome/CA/categoria, `?type=epi\|machine`), POST · GET, PUT, DELETE (em uso → `409 IN_USE`) · GET (`{stock, risk, deliveryItems}`)                                                                                                                                                                                                                                                                                                                 |
| `/epi-deliveries` · `/epi-deliveries/{id}` · `/epi-deliveries/{id}/sign` · `/epi-deliveries/{id}/return`                                                       | GET, POST (baixa transacional) · GET, DELETE (só `pending`; **sem PUT** — entrega imutável) · POST (assinatura manual) · POST (devolução de item)                                                                                                                                                                                                                                                                                                                |
| `/training-catalog` · `/training-catalog/{id}` · `/training-catalog/{id}/dependents`                                                                           | GET (`?search=` nome/norma), POST · GET, PUT, DELETE (em uso → `409 IN_USE`) · GET (`{records, requiredLinks}`)                                                                                                                                                                                                                                                                                                                                                  |
| `/training-records` · `/training-records/{id}`                                                                                                                 | GET (`?employeeId=`), POST (`valid_until` calculado no servidor; **sem PUT** — realização imutável) · GET, DELETE                                                                                                                                                                                                                                                                                                                                                |
| `/job-role-required-trainings` · `/job-role-required-trainings/{id}`                                                                                           | GET (`?jobRoleId=`), POST (add **idempotente** por UNIQUE) · DELETE (sem GET/PUT de item — vínculo magro)                                                                                                                                                                                                                                                                                                                                                        |
| `/profile`                                                                                                                                                     | GET, PUT (perfil do **usuário logado** — self; edita só campos app-managed `phone`/`cpf`/`jobTitle`; nome/e-mail/foto são do Clerk)                                                                                                                                                                                                                                                                                                                              |
| `/team` · `/team/{userId}` · `/team/invitations`                                                                                                               | GET (roster do tenant; `?search=`) · PUT, DELETE (papel / remoção — **owner**; via Clerk; barra o último owner) · POST (convite — **PRO**, `201`)                                                                                                                                                                                                                                                                                                                |
| `/pending-items`                                                                                                                                               | GET (read-model das pendências sem página própria: PGRs vencidos, controles em atraso, EPIs abaixo do mínimo — top 5 cada, com link à origem)                                                                                                                                                                                                                                                                                                                    |
| `/dashboard/summary`                                                                                                                                           | GET (agregações read-model do tenant: KPIs, riscos por agente, planos por nível, pendências/vencimentos; **sem tabelas novas**)                                                                                                                                                                                                                                                                                                                                  |
| `/schedule-events` · `/schedule-events/{id}`                                                                                                                   | GET (`?eventType=&from=&to=`), POST · GET, PUT, DELETE (agenda: CRUD de compromissos de SST; `201`/`204`)                                                                                                                                                                                                                                                                                                                                                        |
| `/vehicles` · `/vehicles/{id}`                                                                                                                                 | GET (`?search=` placa/modelo/marca), POST · GET, PUT, DELETE (frota; placa BR/Mercosul; `UNIQUE(org,placa)`→`DUPLICATE`; `201`/`204`)                                                                                                                                                                                                                                                                                                                            |
| `/inspection-plans` · `/inspection-plans/{id}`                                                                                                                 | GET (`?search=` título, `?type=vehicular\|equipment`), POST · GET (inclui `items[]`), PUT, DELETE (`204`)                                                                                                                                                                                                                                                                                                                                                        |
| `/vehicular-inspections` · `/vehicular-inspections/{id}` · `/vehicular-inspections/{id}/checklist`                                                             | GET (`?status=`/`?search=`), POST (cabeçalho → `in_progress`, `201`) · GET (inclui itens+respostas), PUT (cabeçalho), DELETE (`204`) · PUT (respostas → `completed`)                                                                                                                                                                                                                                                                                             |
| `/equipment-inspections` · `/equipment-inspections/{id}` · `/equipment-inspections/{id}/checklist`                                                             | GET (`?status=`), POST (cabeçalho equipamento → `in_progress`, `201`) · GET, PUT, DELETE (`204`) · PUT (respostas → `completed`)                                                                                                                                                                                                                                                                                                                                 |
| `/safety-inspections` · `/safety-inspections/{id}` · `/safety-inspections/{id}/occurrences`                                                                    | GET (`?status=`/`?category=`/`?companyId=`/`?search=`), POST (cabeçalho → `in_progress`, `201`) · GET (inclui `occurrences[]`), PUT, DELETE (`204`) · PUT (ocorrências → `completed`)                                                                                                                                                                                                                                                                            |
| `/work-permits` · `/work-permits/{id}`                                                                                                                         | GET (`?search=`/`?status=`/`?type=`), POST (`201`) · GET, PUT, DELETE (`204`) — nº único por org (`DUPLICATE`), empresa opcional                                                                                                                                                                                                                                                                                                                                 |
| `/psychosocial-campaigns` · `/{id}` · `/{id}/status` · `/{id}/questions(/{qid}(/reorder))` · `/{id}/stats` · `/{id}/risks(/{rid}/register)` · `/{id}/conclude` | GET (`?status=`/`?workUnitId=`), POST · GET (inclui `questions[]`), PUT, DELETE · PUT (transição) · POST perguntas + PUT/DELETE + POST reorder · GET agregações · GET/POST derivar + POST registrar no PGR · POST encerrar                                                                                                                                                                                                                                       |
| `/esocial-events` · `/{id}` · `/esocial-batches` · `/esocial-batches/{id}/return`                                                                              | GET (`?status=`/`?eventType=`/`?dateFrom=`/`?dateTo=`), POST (gera+persiste, `201`) · GET · GET (lotes), POST (envia pending, `201`) · POST (consulta retorno)                                                                                                                                                                                                                                                                                                   |
| `/onboarding`                                                                                                                                                  | GET (progresso de primeiros-passos DERIVADO dos KPIs do tenant; sem tabela; read-only)                                                                                                                                                                                                                                                                                                                                                                           |
| `/service-orders` · `/service-orders/{id}` · `/service-orders/{id}/status` · `/service-orders/{id}/signature`                                                  | GET, POST (número **server-side**; itens na mesma tx; `201`) · GET (inclui itens), PUT (itens imutáveis se assinada), DELETE (`204`; só não-assinada + open/in_progress) · PUT (transição; terminal não volta) · GET (estado derivado, **sem** token/URL), POST (cria solicitação; `201` com `publicUrl`+`qrCodeDataUrl`; cota compartilhada)                                                                                                                    |
| `/incidents` (tabela `accidents`) · `/incidents/{id}` · `/incidents/{id}/status`                                                                               | GET, POST · GET, PUT, DELETE (`204`) · PUT (state machine `registered→awaiting_planning→awaiting_completion→completed`/`cancelled`; conclusão exige justificativa **e** sem plano ativo → `422`)                                                                                                                                                                                                                                                                 |
| `/action-plans` · `/action-plans/{id}` · `/action-plans/{id}/status`                                                                                           | GET, POST (origem `risk\|incident` validada → `422 FK_NOT_FOUND` se inválida/cross-tenant; `201`) · GET, PUT, DELETE (`204`; física só `planned`, senão `409 IN_USE` → cancelar) · PUT (`planned→in_progress→completed`/`cancelled`; terminal não volta)                                                                                                                                                                                                         |
| `/risk-audits` · `/risk-audits/{id}` · `/risk-audits/{id}/status` · `/risk-audits/{id}/suggest-action-plan`                                                    | GET, POST (uma ativa por origem → `409 IN_USE`; `201`) · GET (inclui planos da origem) · PUT (transição explícita `awaiting_analysis→planning_actions→completed`; conclusão exige justificativa; inválida → `422`) · POST (sugestão 5W2H por IA; `200`; `402 QUOTA_EXCEEDED` / `502 AI_UNAVAILABLE`)                                                                                                                                                             |
| `/form-controls` · `/form-controls/{id}`                                                                                                                       | GET (`?search=`/`?formType=`/`?companyId=`), POST (`201`) · GET, PUT, DELETE (`204`) — código FRM único por org (`DUPLICATE`), empresa/GES opcionais                                                                                                                                                                                                                                                                                                             |
| `/documents` · `/documents/{id}` · `/documents/{id}/versions` · `/documents/{id}/move` · `/documents/{id}/download`                                            | GET (`?folderId=`/`?search=`/`?docType=`/`?validity=`/`?relatedEntityType=`+`?relatedEntityId=`; versão corrente + KPIs + árvore de pastas + breadcrumb), POST (multipart; `201`) · GET, PUT, DELETE (`204`; remove TODAS as versões do grupo) · POST (nova versão MAX+1, multipart; corrida → `409 DUPLICATE`; `201`) · POST (mover entre pastas; pasta cross-tenant → `422 FK_NOT_FOUND`) · GET (URL assinada de download, TTL 60s; `{url, expiresInSeconds}`) |
| `/folders` · `/folders/{id}`                                                                                                                                   | GET (`?parentId=`; filhas diretas + breadcrumb), POST (`201`) · PUT (renomear; irmã duplicada → `409 DUPLICATE`; pai inválido → `422 FK_NOT_FOUND`)                                                                                                                                                                                                                                                                                                              |

- **Filtros (query)**: list de cada recurso aceita `search`, `page`, `pageSize` + os filtros do
  recurso (`companyId`, `workUnitId`, `status`, `type`). Body de create/update = o mesmo `*Input`
  das actions. **`/categories`** filtra por `search` + `type` (`epi`|`machine`); **PUT exige corpo
  completo `CategoryInput`** (espelho de companies, sem `.partial()`); **não há `/dependents`**.
- **`/risk-methodology`** é um **singleton por organização** (issue #76): `GET` devolve a metodologia
  ativa **ou** o padrão derivado (`configured:false`) quando nenhuma foi salva; `PUT` faz **upsert** do
  corpo completo `RiskMethodologyInput` (gradações 1–5 + faixas que particionam 1–25). Sem `list`,
  `{id}` nem `dependents`.
- **`/ges/{id}/risk-suggestions`** (sugestão de riscos por IA): `POST` monta o contexto **não-PII** do
  GES (processo, ambiente, títulos de função) e consulta o LLM (Anthropic/Claude, chave só no servidor),
  devolvendo uma lista de riscos sugeridos (`{ suggestions: [{ agentType, hazard?, description, sources? }] }`)
  — **nada é persistido**. GES de outra org → `422 FK_NOT_FOUND`; cota mensal do plano free estourada →
  `402 QUOTA_EXCEEDED`; falha/timeout do LLM → `502 AI_UNAVAILABLE` (nunca bloqueia o cadastro). `POST
/accept` recebe os riscos selecionados/revisados e os grava como **rascunho** em `risks` (reusa a regra
  de `createRisk`), `201` com `{ created }`.
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
- **Treinamentos (fatia 017)**: **`/training-catalog`** — os 5 campos ePGR
  (`name`, `referenceNorm?`, `workloadHours` inteiro > 0, `periodicity` enum
  `annual|biennial|triennial|quinquennial|single`, `description?`); nome duplicado no escritório →
  `409 DUPLICATE`; exclusão de item com realizações/vínculos → `409 IN_USE` (cheque `/dependents`
  antes). **`/training-records`** — `{ employeeId, trainingId, completedAt, certificatePath? }`;
  `valid_until` é **calculado no servidor** pela periodicidade do catálogo (`single` → `null`) e
  nunca vem do cliente; `completedAt` futuro → `422 VALIDATION`; funcionário/treinamento de outro
  tenant → `422 FK_NOT_FOUND`. **`/job-role-required-trainings`** — `{ jobRoleId, trainingId }`;
  POST repetido devolve o vínculo existente (idempotente). Leituras de vencimento/conformidade
  (US3/US4) são consultas de Server Component, sem endpoint próprio nesta fase.
- **Planos de inspeção (fatia 036)**: **`/inspection-plans`** — checklist reutilizável das inspeções
- **Inspeções veiculares (fatia 037)**: **`/vehicular-inspections`** — fluxo em **2 passos**. Passo 1 (`POST`): cabeçalho `{ vehicleId, planId, inspectedAt, responsible?, driverName?, driverLicense?, currentKm?, route?, notes? }` cria a inspeção `type=vehicular` em `in_progress` (`201`). `vehicleId`/`planId` devem ser do tenant e o plano ser **veicular** — senão `422 FK_NOT_FOUND`. Passo 2 (`PUT /{id}/checklist`): `{ responses: [{ planItemId, value: true|false|null, observation? }] }` **substitui** as respostas e conclui (`status=completed`); respostas de `planItemId` fora do plano são ignoradas. `GET /{id}` devolve `{ inspection, vehicle, plan, items }` (itens do plano + resposta atual). Plano imutável do lado do item — só o plano edita seus itens (fatia 036).
- **Inspeções de equipamentos (fatia 038)**: **`/equipment-inspections`** — mesmo fluxo em 2 passos da veicular, mas o cabeçalho referencia um **equipamento do catálogo** (`epi_catalog` tipo `machine`) + um **plano de equipamento**. `POST`: `{ equipmentCatalogId, planId, inspectedAt, responsible?, notes? }`. Equipamento não-`machine`/cross-tenant ou plano não-`equipment` → `422 FK_NOT_FOUND`. Checklist (`PUT /{id}/checklist`) reusa o contrato tri-state da veicular. `GET /{id}` = `{ inspection, equipment, plan, items }`.
- **Inspeções de segurança (fatia 039)**: **`/safety-inspections`** — inspeção **livre** (sem plano/checklist). `POST`: `{ category, inspectedAt, planned?, area?, companyId?, responsible?, notes? }` cria `type=safety` em `in_progress`. `companyId` opcional; se informado, deve ser do tenant → senão `422 FK_NOT_FOUND`. `PUT /{id}/occurrences`: `{ occurrences: [{ description, severity: low|medium|high|null }] }` **substitui** as ocorrências e conclui (`completed`). `GET /{id}` = `{ inspection, company, occurrences }`. **Assinatura digital** reusa a infra de assinaturas (fatia 010) com `target_type: "inspection"` — via a Server Action `requestInspectionSignatureAction` (mesma superfície das assinaturas: sem espelho REST de criação; a rota pública `/sign/{token}` é a superfície testável).
- **Permissões de trabalho (fatia 040)**: **`/work-permits`** — PT autorizando trabalho de risco (NR-33/35/10/18). Body `{ number, type (hot_work|confined_space|height|electrical|excavation|cold_work|other), status?, companyId?, area?, description, validFrom, validUntil, requestedBy?, approvedBy?, precautions?, notes? }`. `number` **único por org** → `409 DUPLICATE`; `validUntil >= validFrom` (Zod + CHECK no banco) → `422`; empresa opcional cross-tenant → `422 FK_NOT_FOUND`. **Migration `0020_work_permits`** (1 tabela + 2 enums, isolada por tenant). Módulo independente da cadeia de inspeções.
- **Controle de formulário — ISO (fatia 042, issue #88)**: **`/form-controls`** — metadados de cabeçalho estilo ISO (Tipo de Formulário, Empresa, Código FRM, REV, Data, N.C., GES/Setor, Posicionamento) injetados nos documentos gerados (PGR, OS, fichas, inspeções); a injeção em si é fronteira de outra fatia (cliente/template Gotenberg). Body `{ formType, companyId?, frmCode, revision, issueDate (AAAA-MM-DD), nonConformityNumber?, gesId?, position (top|bottom|both), notes? }`. `frmCode` **único por org** → `409 DUPLICATE` (mesmo código aceito em orgs distintas); `companyId`/`gesId` opcionais, cross-tenant → `422 FK_NOT_FOUND`. **Migration `0027_form_controls`** (1 tabela + 1 enum, isolada por tenant). UI com preview em tempo real do cabeçalho.
- **Documentos (GED) — fatia 024, issue #34**: **`/documents`** — acervo de documentos com versionamento (schema/RLS da fatia 023, zero migration nesta fatia). Um "documento lógico" (`document_group_id`) agrupa N versões físicas; a listagem/KPIs sempre mostram a **versão corrente** (`MAX(version)` do grupo). `POST` é **multipart** (`file` + `name`, `docType`, `validUntil?`, `folderId?`, `relatedEntityType?`, `relatedEntityId?`) — tipo/tamanho validados **antes** do upload (PDF/PNG/JPG/DOC/DOCX/XLS/XLSX, máx. 25 MB) via `validateFile`; vínculo polimórfico é completo-ou-vazio (CHECK do banco). Upload no Storage (bucket privado `documents`, path `<org_id>/documentos/<group_id>/v<version>-<slug>`) acontece **antes** do INSERT; falha do INSERT compensa removendo o objeto órfão. `POST /documents/{id}/versions` publica nova versão (`MAX+1` no grupo, herda metadados, histórico preservado); corrida na mesma versão → `409 DUPLICATE` (UNIQUE do banco). `POST /documents/{id}/move` move **todas as versões** do grupo entre pastas; pasta cross-tenant → `422 FK_NOT_FOUND`. `DELETE` remove o documento lógico inteiro (todas as versões, uma transação); os objetos do Storage são removidos **pós-commit**, best-effort — falha de Storage é logada e **não reverte** a exclusão. O par `?relatedEntityType=`+`?relatedEntityId=` filtra o acervo pelo **vínculo polimórfico** (ex.: `?relatedEntityType=pgr&relatedEntityId=<uuid>` devolve só os anexos daquele PGR) — é o que alimenta a etapa "Documentos e PDF" da tela `/pgr/{id}`. Validade (`validUntil`) é **derivada na leitura** (`ok`/`due_soon`/`expired`/`no_expiry`, janela fixa de 30 dias — mesmo padrão de `classifyTrainingStatus`/`classifyDocumentValidity`), nunca coluna de status. **`/folders`** — hierarquia de pastas (`GET ?parentId=` filhas diretas + breadcrumb raiz→atual); nome duplicado entre irmãs (incl. raiz, `NULLS NOT DISTINCT`) → `409 DUPLICATE`; pai inválido/cross-tenant → `422 FK_NOT_FOUND`; renome de pasta de outro escritório → `404`.
- **Download de documento — URL assinada (fatia 024, issue #35)**: **`GET /documents/{id}/download`** — devolve `{ url, expiresInSeconds }` (mesmo padrão de `POST /pgr/{id}/signature`/`POST /service-orders/{id}/signature`: JSON com a URL, nunca `302`, o cliente decide o que fazer — abrir aba, `<a download>`, etc). O tenant é resolvido via `getDocumentById` (mesmo caminho do `GET /documents/{id}`) **antes** de assinar; `storage_path` nunca vem do cliente — documento de outro escritório → `404` (nunca revela o path nem chega a assinar). URL expira em **60s** (`SIGNED_DOWNLOAD_URL_TTL_SECONDS`, `createSignedUrl` do Supabase Storage com `download` = nome de exibição do documento + extensão real do arquivo). Bucket `documents` permanece privado (sem acesso público permanente).
- **Riscos psicossociais (Fase 09)**: **`/psychosocial-campaigns`** — campanha de mapeamento (NR-01/GRO). CRUD da campanha + **sub-entidade `questions`** (add/update/remove/reorder, sempre escopada ao `campaign_id`). `POST` body `{ name, companyId, workUnitId, startsAt?, endsAt?, themeColor?, coverPath?, workerDescription? }`; empresa/obra cross-tenant → `422 FK_NOT_FOUND`; ativar sem perguntas → `422 VALIDATION`. `/{id}/status` transiciona (`draft→active→closed`, `archived` terminal). Dashboard: `/{id}/stats` (média Likert + participação). Riscos: `POST /{id}/risks` **deriva** (upsert idempotente); `POST /{id}/risks/{rid}/register` cria risco no inventário/PGR (agente `psychosocial`) no GES informado. **Rota pública anônima** `/psychosocial-response/{campaignId}/{token}` (fora de `/api/v1`, sem sessão): resolve a campanha pela **policy de capability** do token; respostas gravadas sem vínculo nominal; campanha fechada/fora do período → mensagem amigável. **Migration `0021_psychosocial`** (5 tabelas + 2 enums, tenant-isoladas).
- **eSocial SST (Fase 10)**: **`/esocial-events`** — eventos S-2190..S-2300. `POST` `{ type, input, referenceId? }` valida o `input` pelo schema do tipo (builder), monta o **XML** (`ambientePadrao="Producao"` fixo) e persiste com status `pending`. Geração a partir de fontes existentes via Server Action (`generateS2200FromEmployee`, `generateS2240FromRisk` — usa código do agente nocivo + unidade do inventário de riscos); origem cross-tenant → `422 FK_NOT_FOUND`. **`/esocial-batches`**: `POST { eventIds }` agrupa os `pending` do tenant num lote (protocolo persistido) e marca `sent` (ids não-pending/cross-tenant são ignorados); `POST /{id}/return` consulta o retorno (**simulado** — sem transmissão externa real) e atualiza cada evento (`accepted`). UI `/esocial` (lista+filtros+seleção múltipla+lote) e `/esocial/detalhe/{id}`. **Migration `0022_esocial`** (2 tabelas + 3 enums; `reference_id` polimórfico; payload XML como texto).
- **Fase 06 — Ordens de Serviço (fatia 023)**: **`/service-orders`** — OS de SST com itens. `POST`
  `{ title, openedAt (AAAA-MM-DD), assignedEmployeeId?, dueDate?, items?: [{ description, done? }] }`;
  `status` inicial é sempre `open` (não configurável); o **número** é gerado no servidor (`FOR UPDATE` na
  linha do tenant + `max+1`, `UNIQUE(org,number)` backstop) e OS+itens gravam na **mesma transação**.
  `assignedEmployeeId` cross-tenant → `422 FK_NOT_FOUND`; OS cross-tenant → `404`. `PUT /{id}` (corpo
  completo `{ title, openedAt, status, items, … }`) bloqueia edição de itens se a OS estiver assinada
  (imutável); `DELETE` só se **não** assinada e status ∈ {open, in_progress}, senão erro de estado. `PUT
/{id}/status` transiciona (terminal não volta). **Assinatura**: `POST /{id}/signature` monta o payload
  público **no servidor** e delega a `createSignatureRequestCore` (cota de assinatura compartilhada →
  `402 QUOTA_EXCEEDED`), devolvendo `{ signature, requestId, publicUrl, qrCodeDataUrl }` (`publicUrl`/token
  **só** na criação); exige **funcionário atribuído** (senão `422 VALIDATION` — sem `employeeName`/
  `companyName` no payload). `GET /{id}/signature` devolve o estado derivado
  (`none|pending|signed|expired|cancelled`), **nunca** token/URL. Só office staff; `client` → `403`.
  **Zero** upload/base64 aqui.
- **Fase 06 — Incidentes/Acidentes (fatia 023)**: **`/incidents`** (tabela canônica `accidents`, rótulo de
  UI "Incidentes/Acidentes") — registro com enums fechados (`type`, `category`, `severity`) e campos CAT
  **textuais opcionais** (registro **interno**; **sem** S-2210/`esocial_events`). Dado de saúde é **P0**:
  só office staff (`client` → `403 FORBIDDEN`), nunca em log/audit/erro. Cross-tenant → `404`. `PUT
/{id}/status` aplica a state machine (`incident-lifecycle`, fonte única); **conclusão** exige justificativa
  e é **bloqueada** enquanto houver plano de ação ativo (→ `422 VALIDATION`). Sem upload de fotos (a aba
  "Fotos" da UI é placeholder).
- **Fase 06 — Planos de Ação 5W2H (fatia 023)**: **`/action-plans`** — central multiorigem. `POST`
  `{ originType: risk|incident, originId, what, why, who, where, how, when?, howMuch?, priority? }`;
  `origin_type` é **TEXT** validado na app (V1 só `risk|incident`; `inspection`/`non_conformity` **não**
  são aceitos). Origem inválida/inexistente/cross-tenant → `422 FK_NOT_FOUND`; plano cross-tenant → `404`.
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
```

- Em produção, `isDevAuthBypassEnabled()` é sempre `false` (checa `APP_ENV !== "production"`),
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
| Agenda (plataforma)          | `actions/platform/scheduling.ts`             | list, get, create, update, delete + REST `/api/v1/schedule-events/**` (CRUD de agendamentos; migration `0023_schedule_events`; filtros tipo/período)                                                                                                                                                                                                                                   |
| Ve�culos (inspe��es)         | `actions/inspections/vehicles.ts`            | list, get, create, update, delete + REST `/api/v1/vehicles/**` (frota; base das inspe��es veiculares; modelo na fatia 034)                                                                                                                                                                                                                                                             |
| Unidade de Obra              | `actions/pgr/work-units.ts`                  | list, get, create, update, delete, dependents                                                                                                                                                                                                                                                                                                                                          |
| Função (Cargo)               | `actions/pgr/job-roles.ts`                   | list, get, create, update, delete, dependents                                                                                                                                                                                                                                                                                                                                          |
| GES + vínculos               | `actions/pgr/ges.ts`                         | list, get, create, update, delete, dependents + gestão de `ges_job_roles`                                                                                                                                                                                                                                                                                                              |
| Funcionário                  | `actions/pgr/employees.ts`                   | list, get, create, update, delete + picker de função                                                                                                                                                                                                                                                                                                                                   |
| PGR (documento)              | `actions/pgr/pgr.ts`                         | list, get, create, update, delete, publish + REST `/api/v1/pgr/**` (aceite NR-01 não persistido; escrita em PGR assinado/publicado → `409 ALREADY_SIGNED`; publicar sem assinatura → `422 VALIDATION`)                                                                                                                                                                                 |
| PGR · Revisões               | `actions/pgr/pgr-revisions.ts`               | list, create (número **server-side**, `.strict()`) + REST `/api/v1/pgr/{id}/revisions` (GET, POST 201; `revisionNumber` no body → 422)                                                                                                                                                                                                                                                 |
| PGR · GES (escopo)           | `actions/pgr/pgr-ges.ts`                     | list, add, remove + REST `/api/v1/pgr/{id}/ges` · `/{gesId}` (GET, POST 201, DELETE 204)                                                                                                                                                                                                                                                                                               |
| PGR · Consolidada            | `actions/pgr/pgr-consolidated.ts`            | get (read-only; GES→riscos→avaliação→5W2H→EPIs; S-2240) + REST `GET /api/v1/pgr/{id}/consolidated`                                                                                                                                                                                                                                                                                     |
| PGR · Assinatura             | `actions/pgr/pgr-signature.ts`               | createPgrSignatureRequestAction, getPgrSignatureViewAction + REST `/api/v1/pgr/{id}/signature` (POST 201 payload server-side; GET estado, sem token/URL; cota compartilhada 402)                                                                                                                                                                                                       |
| PGR · PDF                    | `server/platform/pgr-pdf-core.ts`            | generatePgrPdf (reusa a consolidada; template `domains/pgr/pgr-pdf-template.ts`, cor parametrizável com default) + REST `GET /api/v1/pgr/{id}/pdf` (binário; `?color=`; 404/503)                                                                                                                                                                                                       |
| Riscos (GES)                 | `actions/pgr/risks.ts`                       | list, get, create, update, delete + REST `/api/v1/risks/**` (regra `qualitative_na`; reuso por prefill; sem 409)                                                                                                                                                                                                                                                                       |
| Perfil (plataforma)          | `actions/platform/profile.ts`                | getProfile, updateProfile (self) + REST `/api/v1/profile` (campos app-managed; nome/e-mail/foto delegados ao Clerk)                                                                                                                                                                                                                                                                    |
| Equipe (plataforma)          | `actions/platform/team.ts`                   | listTeamMembers, inviteMember, changeMemberRole, removeMember + REST `/api/v1/team/**` (multiusuário **PRO** via Clerk Org; owner-only; protege o último owner)                                                                                                                                                                                                                        |
| Dashboard (plataforma)       | `actions/platform/dashboard.ts`              | getDashboardSummaryAction + REST `GET /api/v1/dashboard/summary` (read-model agregado por tenant; sem tabelas novas)                                                                                                                                                                                                                                                                   |
| EPI × risco (vínculo)        | `actions/pgr/epi-risk.ts`                    | list, available (busca nome/CA), add, update (neutralização), remove + REST `/api/v1/risks/{id}/epis/**`                                                                                                                                                                                                                                                                               |
| Avaliação de risco (5×5)     | `actions/pgr/risk-assessments.ts`            | list, get, getCurrent, create, update, delete + REST `/api/v1/risks/{id}/assessments` · `/risk-assessments/{id}` (histórico 1:N; snapshot de `result`; sem 409)                                                                                                                                                                                                                        |
| Medidas de controle (5W2H)   | `actions/pgr/control-measures.ts`            | list, get, create, update, delete + REST `/api/v1/risks/{id}/control-measures` · `/control-measures/{id}` (1 por nível NR-01; estados derivados; **409** por UNIQUE)                                                                                                                                                                                                                   |
| Categoria                    | `actions/pgr/categories.ts`                  | list, get, create, update, delete (catálogo `epi`/`machine`)                                                                                                                                                                                                                                                                                                                           |
| Médico                       | `actions/pgr/medicos.ts`                     | list (busca nome/CRM, filtro status), options, get, create, update, delete + REST `/api/v1/medicos/**` (cadastro de médicos do trabalho; CRM único por org → `DUPLICATE`; sem `/dependents`)                                                                                                                                                                                           |
| Exame ocupacional (ASO)      | `actions/pgr/health-exams.ts`                | list (busca funcionário, filtro tipo), get, create, update, delete + REST `/api/v1/health-exams/**` (validade derivada na leitura; funcionário/médico cross-tenant → `FK_NOT_FOUND`; sem `/dependents`)                                                                                                                                                                                |
| Controle de formulário (ISO) | `actions/documents/form-controls.ts`         | list, get, create, update, delete + REST `/api/v1/form-controls/**` (código FRM único por org → `DUPLICATE`; empresa/GES opcionais)                                                                                                                                                                                                                                                    |
| Documentos (GED)             | `actions/documents/documents.ts`             | list (versão corrente + KPIs + árvore + breadcrumb), get, create (multipart), update, addVersion (MAX+1; corrida → `DUPLICATE`), move, delete (grupo inteiro) + REST `/api/v1/documents/**`                                                                                                                                                                                            |
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

| code                  | Origem                                   | HTTP equiv. | Quando                                                                                                 |
| --------------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `VALIDATION`          | `ZodError` (com `fields`); CHECK `23514` | 422         | Entrada inválida                                                                                       |
| `DUPLICATE`           | UNIQUE `23505`                           | 409         | CNPJ/CPF/título/vínculo duplicado no escritório                                                        |
| `FK_NOT_FOUND`        | FK `23503`; referência fora do tenant    | 422         | Empresa/obra/GES/função inexistente no escritório                                                      |
| `FORBIDDEN`           | papel `client`                           | 403         | Membro não-equipe tentou operar                                                                        |
| `NOT_FOUND`           | `getById` → `null`                       | 404         | Registro inexistente no escritório (inclui cross-tenant)                                               |
| `NO_TENANT_CONTEXT`   | sem escritório ativo                     | 403         | Sessão sem tenant resolvido                                                                            |
| `INSUFFICIENT_STOCK`  | `InsufficientStockError` (repositório)   | 422         | Saída/entrega maior que o saldo disponível (rollback total)                                            |
| `ALREADY_SIGNED`      | `AlreadySignedError` (repositório)       | 409         | Assinar entrega que já saiu de `pending` (one-shot)                                                    |
| `ALREADY_RETURNED`    | `AlreadyReturnedError` (repositório)     | 409         | Devolver item de entrega já devolvido (saldo intacto)                                                  |
| `TOKEN_INVALID`       | `TokenInvalidError` (rota pública)       | 404         | Token de assinatura ausente/adulterado/inexistente                                                     |
| `TOKEN_EXPIRED`       | `TokenExpiredError` (rota pública)       | 410         | Token com HMAC válido porém além do TTL de 72h                                                         |
| `IN_USE`              | `EntityInUseError` (repositório)         | 409         | Excluir item de catálogo com dependentes (pré-check + RESTRICT backstop)                               |
| `QUOTA_EXCEEDED`      | `QuotaExceededError` (cota do plano)     | 402         | Cota mensal do plano `free` esgotada (sugestão IA; assinatura — contador compartilhado por tenant/mês) |
| `BILLING_UNAVAILABLE` | `BillingUnavailableError`                | 503         | Provedor de pagamento (Stripe) não configurado neste ambiente — degradação graciosa, nunca crash       |

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

| Action                       | Entrada                         | Retorno (`data`)                              |
| ---------------------------- | ------------------------------- | --------------------------------------------- |
| `listCompaniesAction`        | `{ search?, page?, pageSize? }` | `{ rows: CompanyListItem[]; total }`          |
| `listCompanyOptionsAction`   | —                               | `CompanyOption[]` (id, razaoSocial, endereço) |
| `getCompanyAction`           | `id`                            | `Company` (null → `NOT_FOUND`)                |
| `createCompanyAction`        | `CompanyInput`                  | `Company` (CNPJ dup → `DUPLICATE`)            |
| `updateCompanyAction`        | `id, CompanyInput`              | `Company`                                     |
| `deleteCompanyAction`        | `id`                            | `{ id }` (cascata pelo banco)                 |
| `getCompanyDependentsAction` | `id`                            | `{ workUnits, ges, jobRoles, employees }`     |

**`CompanyInput`**: `razaoSocial*`, `riskGrade*` (1–4), `cnpj?` (14 díg. se preenchido),
`nomeFantasia?`, `phone?`, `email?`, `cnae?`, `mainActivity?`, `logoPath?`,
`zipCode? street? number? complement? district? city? state?`.
**`CompanyListItem`**: `{ id, razaoSocial, cnpj, city, state }`.

## Unidade de Obra — `actions/pgr/work-units.ts`

| Action                        | Entrada                                     | Retorno                                              |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `listWorkUnitsAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: WorkUnit[]; total }`                        |
| `getWorkUnitAction`           | `id`                                        | `WorkUnit`                                           |
| `createWorkUnitAction`        | `WorkUnitInput`                             | `WorkUnit` (empresa fora do tenant → `FK_NOT_FOUND`) |
| `updateWorkUnitAction`        | `id, WorkUnitInput`                         | `WorkUnit`                                           |
| `deleteWorkUnitAction`        | `id`                                        | `{ id }`                                             |
| `getWorkUnitDependentsAction` | `id`                                        | `{ ges }`                                            |

**`WorkUnitInput`**: `companyId*`, `name*`, `description*`, `contractNumber?`, endereço (`zipCode?…state?`).

## Função (Cargo) — `actions/pgr/job-roles.ts`

| Action                       | Entrada                                     | Retorno                                         |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `listJobRolesAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: JobRole[]; total }`                    |
| `getJobRoleAction`           | `id`                                        | `JobRole`                                       |
| `createJobRoleAction`        | `JobRoleInput`                              | `JobRole` (título dup na empresa → `DUPLICATE`) |
| `updateJobRoleAction`        | `id, JobRoleInput`                          | `JobRole`                                       |
| `deleteJobRoleAction`        | `id`                                        | `{ id }`                                        |
| `getJobRoleDependentsAction` | `id`                                        | `{ gesLinks, employees }`                       |

**`JobRoleInput`**: `companyId*`, `title*`, `cbo?`, `workSchedule?`, `description?`.

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

| Action                   | Entrada                                              | Retorno                                                  |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| `listEmployeesAction`    | `{ companyId?, status?, search?, page?, pageSize? }` | `{ rows: EmployeeListItem[]; total }`                    |
| `getEmployeeAction`      | `id`                                                 | `Employee`                                               |
| `createEmployeeAction`   | `EmployeeInput`                                      | `Employee` (CPF dup → `DUPLICATE`)                       |
| `updateEmployeeAction`   | `id, EmployeeInput`                                  | `Employee`                                               |
| `deleteEmployeeAction`   | `id`                                                 | `{ id }`                                                 |
| `listGesFunctionsAction` | `gesId`                                              | `JobRoleOption[]` (picker: só funções vinculadas ao GES) |

**`EmployeeInput`**: `companyId*`, `fullName*`, `cpf*` (11 díg.), `gesId?`, `jobRoleId?`
(exige `gesId` e vínculo existente no GES), `status?` (`active`|`on_leave`|`dismissed`, default
`active`), `sex?` (`male`|`female`|`not_informed`), `maritalStatus?`
(`single`|`married`|`divorced`|`widowed`|`stable_union`), `birthDate? admissionDate?
dismissalDate? badgeValidUntil?` (datas), `phone? email? rg? badgeNumber? registration?
bloodType? photoPath?`, endereço (`zipCode?…state?`).
**`EmployeeListItem`**: `{ id, fullName, status, companyName, gesName }`.

## Categoria — `actions/pgr/categories.ts`

Catálogo de categorias de `epi`/`machine` (fatia 009). Sem `/dependents` (catálogo sem FK de
entrada). REST espelho em `/api/v1/categories` (GET, POST) · `/api/v1/categories/{id}` (GET, PUT, DELETE).

| Action                 | Entrada                                | Retorno (`data`)                            |
| ---------------------- | -------------------------------------- | ------------------------------------------- |
| `listCategoriesAction` | `{ search?, type?, page?, pageSize? }` | `{ rows: Category[]; total }`               |
| `getCategoryAction`    | `id`                                   | `Category` (null → `NOT_FOUND`)             |
| `createCategoryAction` | `CategoryInput`                        | `Category` (nome dup no tipo → `DUPLICATE`) |
| `updateCategoryAction` | `id, CategoryInput`                    | `Category`                                  |
| `deleteCategoryAction` | `id`                                   | `{ id }`                                    |

## Médico — `actions/pgr/medicos.ts`

Cadastro de médicos do trabalho responsáveis por exames/ASO (catálogo do escritório, isolado por
tenant). `clinic` ("Empresa" na listagem) é a clínica/empregador do médico — **texto livre**, não a
empresa-cliente do tenant. CRM único por org (`UNIQUE(org_id, crm)` → `DUPLICATE`). Sem `/dependents`
(o vínculo de exames/ASO usa `ON DELETE SET NULL`, não bloqueia a exclusão). REST espelho em
`/api/v1/medicos` (GET, POST) · `/api/v1/medicos/{id}` (GET, PUT, DELETE).

| Action                    | Entrada                                  | Retorno (`data`)                            |
| ------------------------- | ---------------------------------------- | ------------------------------------------- |
| `listMedicosAction`       | `{ search?, status?, page?, pageSize? }` | `{ rows: Medico[]; total }`                 |
| `listMedicoOptionsAction` | —                                        | `MedicoOption[]` (só `active`, id+nome+crm) |
| `getMedicoAction`         | `id`                                     | `Medico` (null → `NOT_FOUND`)               |
| `createMedicoAction`      | `MedicoInput`                            | `Medico` (CRM dup → `DUPLICATE`)            |
| `updateMedicoAction`      | `id, MedicoInput`                        | `Medico`                                    |
| `deleteMedicoAction`      | `id`                                     | `{ id }`                                    |

**`MedicoInput`**: `{ name*, crm*, specialty?, clinic?, phone?, status }` (`status` = `active|inactive`,
default `active`). Filtro de listagem por **Status** (o mockup mostra "Todas as Empresas", mas médico é
cadastro do escritório e não é escopado por empresa-cliente — lacuna registrada).

**`CategoryInput`**: `type*` (`epi`|`machine`), `name*`, `note?`. Unicidade por
`UNIQUE(org_id, type, name)` → duplicidade no mesmo escritório+tipo vira `DUPLICATE`; o mesmo nome
é aceito entre tipos distintos. **PUT (REST) exige corpo completo** (sem `.partial()`).

---

## Gestão de Saúde Ocupacional (ASO) — `actions/pgr/health-exams.ts`

Exames ocupacionais/ASO por funcionário (fatia 027). Cada exame liga-se a um **funcionário**
(`ON DELETE CASCADE`) e, opcionalmente, ao **médico responsável** (FK → `medicos`,
`ON DELETE SET NULL` — excluir o médico não apaga nem bloqueia o exame). O status de **validade**
(vigente/a vencer/vencido) é **derivado na leitura** de `valid_until` (nullable), via
`classifyDocumentValidity`; o badge da tela combina validade + **aptidão** (apto / apto c/ restrição /
inapto — `examBadge`). Sem `/dependents`. REST espelho em `/api/v1/health-exams` (GET, POST) ·
`/api/v1/health-exams/{id}` (GET, PUT, DELETE).

| Action                   | Entrada                                    | Retorno (`data`)                            |
| ------------------------ | ------------------------------------------ | ------------------------------------------- |
| `listHealthExamsAction`  | `{ search?, examType?, page?, pageSize? }` | `{ rows: HealthExamListItem[]; total }`     |
| `getHealthExamAction`    | `id`                                       | `HealthExam` (null → `NOT_FOUND`)           |
| `createHealthExamAction` | `HealthExamInput`                          | `HealthExam` (FK inválida → `FK_NOT_FOUND`) |
| `updateHealthExamAction` | `id, HealthExamInput`                      | `HealthExam`                                |
| `deleteHealthExamAction` | `id`                                       | `{ id }`                                    |

**`HealthExamInput`**: `{ employeeId*, doctorId?, examType*, performedAt* (não-futura), validUntil?,
aptitude*, notes?, certificatePath? }`. `examType` = `admissional|periodic|change_of_function|
return_to_work|dismissal`; `aptitude` = `fit|fit_with_restrictions|unfit`.

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
PUT, DELETE) · `/api/v1/documents/{id}/versions` (POST) · `/api/v1/documents/{id}/move` (POST) ·
`/api/v1/folders` (GET, POST) · `/api/v1/folders/{id}` (PUT).

| Action                                                                           | Entrada                                                         | Retorno (`data`)                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `listDocumentsAction`                                                            | `{ folderId?, search?, docType?, validity?, page?, pageSize? }` | `{ rows, total, kpis, folders, breadcrumb }`                                                                |
| `getDocumentAction`                                                              | `id`                                                            | `DocumentDetail` (null → `NOT_FOUND`)                                                                       |
| `createDocumentAction`                                                           | `FormData` (`file` + metadados)                                 | `DocumentDetail` (v1/novo grupo; tipo/tamanho inválido → `VALIDATION`; pasta cross-tenant → `FK_NOT_FOUND`) |
| `updateDocumentAction`                                                           | `id, UpdateDocumentInput` (parcial)                             | `DocumentDetail`                                                                                            |
| `addDocumentVersionAction`                                                       | `id, FormData` (`file`)                                         | `DocumentDetail` (versão `MAX+1`; corrida na mesma versão → `DUPLICATE`)                                    |
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
- **`/pgr/{id}/ges` · `/pgr/{id}/ges/{gesId}`** (GES do escopo do PGR, fatia 019): `GET` lista os GES
  vinculados; `POST` vincula um GES (`{ gesId }`, `201`); `DELETE` desvincula (`204`; vínculo
  inexistente → `404`). GES de outro tenant → falha de FK/isolamento (nunca vincula alheio).
- **`/pgr/{id}/consolidated`** (visão consolidada, fatias 019 + 022): `GET` read-only que agrega, em
  ~6 queries em lote (sem N+1), a cadeia GES → riscos → **avaliação vigente** → **medidas 5W2H** →
  **EPIs por risco**, incluindo os campos **eSocial S-2240** persistidos (`concentration_intensity`
  como **string**). Riscos ordenados por `risk_level` desc, sem avaliação por último; arrays vazios
  tratados (PGR sem GES, GES sem riscos, risco sem avaliação/medida/EPI). Sem PDF/GED.
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
(`AAAA-MM-DD`), `toleranceLimit?`. **Não** aceita `riskLevel`/`result` (calculados no servidor),
`riskId` (vem da rota) nem `orgId` (sessão). **Erros REST**: 422 (validação/FK `riskId`), 404
(cross-tenant/inexistente), 403 (`client`); **nunca 409**.

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
`applicable=true`**), `actionTracking?`/`actionMeasurement?`/`actionResponsible?`/`actionDeadline?`
(`AAAA-MM-DD`)/`justification?`/`monitoring?`. **Não** aceita `riskId` (rota) nem `orgId` (sessão).
**Erros REST**: 422 (validação/FK `riskId`), 404 (cross-tenant/inexistente), **409** (nível
duplicado), 403 (`client`).

---

## Rotas de UI (superfície HTTP navegável)

Área autenticada `(protected)` — layout aplica `requireTenantContext`; cada página de CRUD
aplica `requireOfficeStaffPage()` (papel `client` → `forbidden()`); detalhe/edição por id
inexistente ou de outro escritório → `notFound()`.

| Rota                                                                         | Descrição                                                                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                                 | Painel (área autenticada)                                                                                                                             |
| `/companies` · `/companies/new` · `/companies/[id]/edit`                     | Empresa (lista paginada / criar / detalhe=edição)                                                                                                     |
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
| `/health-exams` · `/health-exams/new` · `/health-exams/[id]/edit`            | Gestão de Saúde/ASO (lista exames + busca funcionário + filtro tipo + status derivado / criar / editar)                                               |
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
#   APP_ENV=local
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
