# AUDIT-ARCHITECTURE — Arquitetura do PGR-e vista pela frente de Medicina Ocupacional

> Agente 1 (Arquitetura) · Fase 0, somente leitura · 2026-10-21
> Base auditada: worktree de `origin/develop` em **`d6b787c`** (merge da PR #118). O `develop` local do
> usuário (`e1e3112`) está **36 commits atrás** e não foi usado como referência.

---

## 1. Escopo analisado

- Versões reais de dependências, estrutura de `src/app` (grupos, layouts, `proxy.ts`), domínios, schemas
  Drizzle, migrations (lista/numeração/última), repositories, Server Actions, REST `/api/v1`, primitives
  `_ui`, shell/menu.
- Modelo atual de tenancy e autorização: escritório (`orgs`), empresa-cliente (`companies`), papéis,
  plano free/pro, `requireTenantContext` / `requireOfficeStaff` / `officeAction` / `restHandler`.
- Tudo o que já existe de Medicina: `medicos`, `health_exams`/ASO, psicossocial, PCMSO, eSocial S-2220/S-2221,
  CID/CNAE/CBO, Lista C.
- PRs do Rikelvin já mergeadas (#108, #109, #110, #111, #113, #114, #118), a PR aberta #112 (NOB-98) e as
  drafts #115/#116/#117.
- Trabalho do Douglas (#99–#106): DOCX/PDF do PGR, GED, worker, CI/CD Vercel com migrations automáticas.
- Branches remotas `codex/NOB-*` e outras não mergeadas que tocam Medicina.

Fora do escopo: protótipo `Projeto-SST-Ocupacional` (outros agentes), UX visual, validação clínica.

## 2. Fontes consultadas

| Fonte                                                              | Como                                                                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Código em `origin/develop` `d6b787c`                               | leitura direta na worktree `scratchpad/develop-ro`                                                                                            |
| Branch `origin/codex/NOB-98-feat/riscos-para-medicina` (`ebfbac3`) | `git show` / `git diff origin/develop...` / `git merge-tree`                                                                                  |
| PRs #99–#118                                                       | `gh pr view` (corpo, arquivos, base, merge SHA) e `gh pr checks 112`                                                                          |
| Execuções do workflow CD                                           | `gh run list --workflow cd.yml` e `gh run view 39467946613` (jobs + log)                                                                      |
| Linear                                                             | `get_issue` NOB-109, NOB-130 (somente leitura). NOB-98 conforme o BRIEF                                                                       |
| Docs no repo                                                       | `.specs/20261020-nob-97/spec.md`, `docs/produto/08-fluxos-emissao-assinatura.md` (NOB-101), `docs/deploy/vercel.md`, `docs/api/api-design.md` |

## 3. Arquivos reais (os principais pontos para a Medicina)

**Plataforma / tenancy**

- `src/proxy.ts` — `clerkMiddleware`, rotas públicas, Basic Auth de sandbox.
- `src/shared/auth/require-tenant-context.ts`, `require-office-staff.ts`, `page-guards.ts`, `require-master.ts`
- `src/shared/tenant/roles.ts`, `plan.ts`, `active-tenant.ts`, `audit-log.ts`
- `src/shared/server/office-action.ts`, `server/action-error.ts`, `server/result.ts`
- `src/shared/api/rest.ts`, `src/shared/api/read-json-body.ts`
- `src/shared/db/with-org.ts`, `src/shared/db/index.ts` (`prepare:false, max:1`)

**Módulo por empresa (NOB-97/99/100)**

- `src/shared/domains/platform/company-modules.ts` — catálogo `["pgr","medicine"]`, Zod, `moduleIsEnabled`
- `src/shared/db/schema/company-modules.ts` — `company_modules`, `company_module_events`
- `src/shared/db/schema/module-policy.ts` — `companyModuleScope(orgId, companyId, module)`
- `src/shared/db/repositories/company-modules.ts` — `assertCompanyModuleTx`, `getCompanyModules`, `setCompanyModule`, `listCompanyModuleEvents`
- `src/shared/server/platform/company-module-core.ts`, `src/shared/server/actions/platform/company-modules.ts`
- `src/app/api/v1/companies/[id]/modules/route.ts`, `src/app/(protected)/companies/[id]/services/{page,module-controls}.tsx`
- `src/shared/db/migrations/0053_company_module_access.sql`

**Medicina existente**

- `src/shared/db/schema/{medicos,health-exams}.ts`, `src/shared/domains/pgr/{medicos,health-exams}.ts`
- `src/shared/db/repositories/{medicos,health-exams}.ts`, `src/shared/server/actions/pgr/{medicos,health-exams}.ts`
- `src/app/api/v1/{medicos,health-exams}/**`, `src/app/(protected)/{medicos,health-exams}/**`
- `src/shared/domains/esocial/{builders,events}.ts`, `src/shared/db/schema/esocial.ts`

**Geração documental (Douglas)**

- `src/shared/server/platform/pgr-docx-core.ts`, `pgr-pdf-core.ts`, `pdf-batch-core.ts`
- `src/shared/integrations/docx/template-engine.ts`, `integrations/pdf/gotenberg.ts`, `integrations/google/*`
- `src/shared/domains/pgr/pgr-docx/*` (17 arquivos), `scripts/pgr-docx/*`, `templates/pgr/*`
- `src/shared/db/schema/{documents,jobs}.ts`, `repositories/{documents,document-versions,folders,pdf-batch}.ts`
- `worker/index.ts`, `worker/owner-db.ts`, `Dockerfile.gotenberg`, `Dockerfile.worker`, `gotenberg-proxy/Caddyfile`
- `.github/workflows/{ci,cd,changelog}.yml`, `docs/deploy/vercel.md`

## 4. Evidências

### 4.1 Versões reais (`package.json`)

| Pacote                              | Versão                                  |
| ----------------------------------- | --------------------------------------- |
| next                                | **16.2.6** (exata)                      |
| react / react-dom                   | **19.2.4** (exata)                      |
| @clerk/nextjs                       | ^7.4.1 (+ @clerk/localizations ^4.6.8)  |
| drizzle-orm / drizzle-kit           | ^0.45.2 / ^0.31.10                      |
| postgres (postgres-js)              | ^3.4.9                                  |
| zod                                 | ^4.4.3                                  |
| @supabase/supabase-js               | ^2.106.1                                |
| docxtemplater / pizzip / docx (dev) | ^3.71.0 / ^3.3.0 / ^9.8.1               |
| @googleapis/docs / drive            | ^14.0.1 / ^26.0.1                       |
| @mastra/core                        | ^1.63.2                                 |
| stripe                              | ^22.3.1                                 |
| qrcode / signature_pad              | ^1.5.4 / ^5.1.3                         |
| jest / playwright                   | ^30.4.2 / ^1.61.1                       |
| tailwindcss                         | ^4 · typescript ^5 · node no CI/CD = 24 |

Scripts novos que não estão no CLAUDE.md: `worker`, `deploy:setup`, `deploy:validate`, `test:deploy`,
`pgr-docx:template`, `pgr-docx:samples`.

### 4.2 Migrations — última real é `0053_company_module_access`

`src/shared/db/migrations/` tem 54 arquivos `.sql` (`0000`…`0053`), e o `meta/_journal.json` tem as 54
tags na mesma ordem. As faixas relevantes para Medicina são `0021_psychosocial`, `0022_esocial`,
`0029_medicos`, `0030_health_exams`, `0046_psychosocial_risk_factors`, `0047_esocial_config`,
`0051_ergonomic_evaluations` e `0053_company_module_access`.
**O CLAUDE.md (seção SPECKIT) ainda diz que a última migration é `0030_health_exams`, o que está desatualizado.**
Em `origin/main` a última é `0052_platform_leads` (`git ls-tree origin/main`). A próxima livre em develop é a
`0054`, que a PR #112 já ocupa com `0054` e `0055`.

### 4.3 Estrutura `src/app`

- `(protected)/` tem 44 rotas de módulo, entre elas `health-exams`, `medicos`, `psychosocial/{campaigns,risk-factors}`,
  `esocial`, `companies/[id]/services` (NOB-100), `admin-global` (master) e `welcome`/`getting-started`.
  O `layout.tsx` chama `requireTenantContext()`, redireciona para `/sign-in` ou `/no-organization` e monta header + `NavMenu` + `TenantSwitcher`.
- `(public)/` contém `(marketing)` (landing, `/seguranca-do-trabalho`, `/medicina-do-trabalho`, `/orcamento`),
  `sign`, `signature-requests`, `psychosocial-response`, `sign-in`, `sign-up` e `_portal`.
- `api/` tem 148 `route.ts`: `v1/**` (tenant), `integrations/{caepi,cep,cnpj}`, `me`, `webhooks/{clerk,stripe}`.
- `src/proxy.ts` define as rotas públicas `/`, as 3 de marketing, `/sign-in`, `/sign-up`, `/sign/*`, `/signature-requests/*`,
  `/psychosocial-response/*`, `/api/webhooks/*` e `/api/v1/*` (só com bypass dev). Com `APP_ENV=sandbox`, aplica HTTP Basic
  em todo o ambiente (exceto webhooks), e isso **não está no CLAUDE.md**.

### 4.4 Domínios, schemas, repositories, actions

- `src/shared/domains/` tem `documents`, `esocial`, `inspections`, `pgr` (≈45 arquivos, **incluindo `medicos.ts` e
  `health-exams.ts`**), `platform` (incl. `company-modules.ts`), `psychosocial`, `safety`, `signatures`, `work-permits`.
  **Não existe `domains/medicine` em develop** (só na branch da #112).
- `src/shared/db/schema/` tem 38 arquivos, com `company-modules.ts` e `module-policy.ts` novos.
- `src/shared/db/repositories/` tem 72 arquivos. `src/shared/server/actions/` está em `pgr/` (32), `platform/` (10), `safety/`,
  `inspections/`, `documents/`, `esocial/`, `psychosocial/`, `work-permits/` e `epi/`. **Medicina vive hoje em
  `actions/pgr/medicos.ts` e `actions/pgr/health-exams.ts`**, ou seja, no namespace do PGR.
- `_ui` (`src/app/(protected)/_ui/`) traz `list.tsx`, `data-list.tsx`, `form.tsx`, `form-steps.ts`, `row-actions.tsx`,
  `confirm-delete-button.tsx`, `confirm-modal.tsx`, `status-badge.tsx`, `training-status-badge.tsx`, `field-hint.tsx`,
  `address-fields.tsx`, `skeleton.tsx`, `agent-progress.tsx`, `notifications-bell.tsx`, `auto-submit-select.tsx`.

### 4.5 Tenancy e autorização atuais

| Conceito                      | Implementação                                                                                                                                                                                                                    | Evidência                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Tenant = escritório           | `orgs.id` (text). `plan in ('free','pro')`, campos Stripe/trial                                                                                                                                                                  | `schema/orgs.ts:12-39`                   |
| Empresa-cliente               | `companies` (dado do tenant). `uq_companies_id_org (id, org_id)` foi criado na 0053 para FKs compostas                                                                                                                           | `0053:1`                                 |
| Papéis                        | `org:admin→owner`, `org:member→collaborator`, `org:client→client`. Papel desconhecido vira `client`                                                                                                                              | `tenant/roles.ts:5-22`                   |
| Contexto                      | `TenantContext = {userId, tenantId, plan, role}`, com tenant vindo do cookie `ACTIVE_ORG_COOKIE` + `org_memberships`                                                                                                             | `require-tenant-context.ts:13-57`        |
| Gate equipe                   | `requireOfficeStaff()` admite só `owner`/`collaborator`. `client` é negado em tudo                                                                                                                                               | `require-office-staff.ts:6-13`           |
| Server Action                 | `officeAction(op, fn, {audit})` → `ActionResult<T>`. "Auditoria" = `logTenantEvent` em **console**, não persistida                                                                                                               | `office-action.ts:18-55`, `audit-log.ts` |
| REST                          | `restHandler` → `resolveContext` (bypass dev só se `APP_ENV!=production` e `DEV_API_AUTH_BYPASS=true`. **O contexto dev é fixo em `plan:"free"`**)                                                                               | `api/rest.ts:53-75`                      |
| Erros → HTTP                  | VALIDATION 422, DUPLICATE 409, FK_NOT_FOUND 422, IN_USE 409, FORBIDDEN 403, NOT_FOUND 404, QUOTA_EXCEEDED 402, AI_UNAVAILABLE 502, REPORT_UNAVAILABLE 503 etc. A NOB-97 acrescentou SQLSTATE `42501`→FORBIDDEN (violação de RLS) | `rest.ts:14-33`, `action-error.ts`       |
| Plano                         | free/pro só controla equipe, cota de assinatura (10/mês) e cota de IA (20/mês). **Não controla módulos**                                                                                                                         | `tenant/plan.ts`                         |
| Master                        | `users.is_master`, `requireMaster()` (cross-tenant, `/admin-global`)                                                                                                                                                             | `require-master.ts`                      |
| Escopo por empresa do usuário | `org_memberships.scoped_company_id` (FK companies) existe e é lido no repo, mas **não entra no `TenantContext`** e não há portal do cliente                                                                                      | `schema/org-memberships.ts:27`, grep     |
| Isolamento                    | `withOrg(orgId, tx => …)` faz `set_config('app.current_org', …, true)`, com RLS `app_runtime` por tabela                                                                                                                         | `db/with-org.ts`                         |

### 4.6 Modelo "módulo/serviço habilitado por empresa" (em develop, NOB-97 + NOB-100)

- **Catálogo** em código: `COMPANY_MODULES = ["pgr","medicine"]`, rótulos "PGR / Segurança do Trabalho" e
  "Medicina do Trabalho". O comentário diz "Independent of the office's free/pro plan" (`domains/platform/company-modules.ts:3-9`).
- **Tabelas** (0053):
  - `company_modules(id, org_id, company_id, module text CHECK in ('pgr','medicine'), enabled bool default false, updated_at)`,
    `UNIQUE(org_id, company_id, module)`, FK composta `(company_id, org_id) → companies(id, org_id) ON DELETE CASCADE`.
    O runtime tem GRANT `SELECT, INSERT, UPDATE` (sem DELETE).
  - `company_module_events(..., previous_enabled, enabled, changed_by, reason, changed_at)`, **append-only**
    (GRANT só `SELECT, INSERT`), com índice `(org_id, company_id)`.
  - As duas têm RLS PERMISSIVE de isolamento por `app.current_org`.
- **Backfill**: todas as empresas existentes ganharam `pgr` e `medicine` = true, com evento `changed_by='migration:0053'` (`0053:43-48`).
- **Negação por padrão**: `createCompany` (`repositories/companies.ts:175-188`) **não cria habilitação**. Toda empresa
  criada depois da 0053 começa sem PGR e sem Medicina, e um owner precisa habilitar em `/companies/[id]/services`.
- **Barreira DB (RLS RESTRICTIVE)** via `companyModuleScope()`:
  - `pgr_module_access` (pgr.company_id), mais `pgr_ges_module_access` e `pgr_revisions_module_access` (herdam do pai `pgr`).
  - `health_exams_module_access`: `exists(employee e where e.id = employee_id and exists(company_modules … e.company_id, 'medicine', enabled))`.
    **A restrição é derivada do `employees.company_id` atual**, porque `health_exams` não tem `company_id`.
- **Barreira app**: `assertCompanyModuleTx(tx, orgId, companyId, module)` lança `ForbiddenError` e é chamado em
  `pgr.ts` (assertCompanyInTenant), `health-exams.ts` (assertRefsInTenant, via `emp.companyId`) e `risks.ts` (NOB-103, via `ges.companyId`).
- **Gestão (NOB-100)**: core único `company-module-core.ts`. Só **owner** altera (`ctx.role !== "owner"` → FORBIDDEN) e o motivo
  é obrigatório (1–500). O lock `FOR UPDATE` na linha da empresa serializa a alteração, e estado e evento são gravados na mesma
  transação. Repetir o estado atual não grava evento. Superfícies: `getCompanyModuleOverviewAction`/`changeCompanyModuleAction`
  e `GET|PUT /api/v1/companies/{id}/modules` (o JSON malformado vira 422 via `readJsonBody`). A tela é `companies/[id]/services`
  (o colaborador só consulta).
- **Leitura auxiliar**: `listCompanies` devolve `pgrEnabled`/`medicineEnabled` por linha e aceita `?module=`.

### 4.7 "Cadastros compartilhados" (NOB-99, em develop)

- Não existem cópias por módulo. `companies` e `employees` (e funções/GES/documentos) são **um único cadastro do tenant**.
- Há um filtro opcional `module=pgr|medicine` validado por Zod em `listCompanies`, `listCompanyOptions` e `listEmployees`
  (`companyModuleScope(employees.orgId, employees.companyId, module)`), exposto em `GET /api/v1/companies?module=` e `GET /api/v1/employees?module=`.
- Os formulários do PGR listam empresas com `module="pgr"`. Os formulários de exame (`health-exams/new`, `[id]/edit`) listam
  funcionários com `module:"medicine"`, rotulados "Nome — Empresa", com **`pageSize: 200`** fixo (limite silencioso).
- `medicos` **não** tem restrição por módulo: o catálogo é do escritório (decisão registrada em `.specs/20261020-nob-97/spec.md`).
- `employees`, `companies`, `ges`, `job_roles` e `risks` (em develop) **não** têm policy de módulo e continuam acessíveis por tenant.

### 4.8 CI/CD: o deploy aplica migrations automaticamente (evidência)

- `.github/workflows/cd.yml:5-7` dispara em `on: push: branches: [develop, main]`. O job `deploy` (`needs: ci`) executa
  `vercel pull` e depois **"Aplica as migrations no banco do ambiente"** com `node --env-file=.vercel/.env.production.local node_modules/drizzle-kit/bin.cjs migrate` (`cd.yml:67-75`),
  seguido de `vercel build` e `vercel deploy --prebuilt`.
- O mapeamento (`docs/deploy/vercel.md:8-9, 95-96`) é: `develop` → projeto `develop-pgr-e`, **Supabase de testes**
  (`APP_ENV=sandbox`); `main` → `pgr-e-production`, **Supabase de produção** (`APP_ENV=production`, Clerk ainda de testes).
- Execução comprovada: run `39467946613` (push `ca364d8` = merge da #109, que contém a 0053), com step "Aplica as
  migrations no banco do ambiente" = **success** e log `drizzle-kit migrate … applying migrations` em 2026-10-20T17:47Z.
  Todas as 7 execuções de develop entre 20 e 21/10 terminaram em `success`. Em `main`, o run `38675289234` (`094af88`, release #102 em 2026-10-15) também aplicou migrations com sucesso.
- **Conclusão**: a 0053 foi aplicada **automaticamente ao banco de testes no merge** (o log mostra o passo, mas não a lista das
  migrations aplicadas; que a 0053 está entre elas é inferência forte, já que era a única pendente). Produção (`main`) está em 0052, e o
  próximo PR `develop → main` aplicará a 0053 (e o que vier depois) em produção sem passo manual.
  A frase "Nenhuma migration aplicada em produção" da #109 é verdadeira, mas **não houve revisão manual em staging antes da aplicação**:
  o merge em develop _é_ a aplicação.
- O CI (`ci.yml:3-5`) roda só em `pull_request` para `develop`/`main`. PRs empilhadas (base ≠ develop) **não rodam CI**.
- `jest.config.ts` exclui 8 suítes de integração (`rest-companies`, `rest-pgr`, `rest-pgr-editor`, `rest-risk-assessments`,
  `rest-ergonomic-evaluations`, `rest-control-measures`, `least-privilege`, `companies-scope-model`) por limitação do harness. A #113 reabilitou `rest-risks`.

## 5. Funcionalidades existentes

### 5.1 Medicina no develop

| Item                                 | Status                     | O que faz de fato                                                                                                                                                                                                                                                                                                                                                     | Caminho                                       |
| ------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Médicos (`medicos`)                  | **em develop**             | CRUD completo (Action + REST + UI). `crm` único por org, `specialty/clinic/phone` texto livre, `status active/inactive`. **Não vincula a usuário autenticado** nem tem UF do CRM/RQE/assinatura                                                                                                                                                                       | `schema/medicos.ts` (mig. 0029)               |
| Exames/ASO (`health_exams`)          | **em develop**             | CRUD por funcionário. `exam_type` enum (admissional, periodic, change_of_function, return_to_work, dismissal), `performed_at` não futura, `valid_until` opcional, `aptitude` (fit, fit_with_restrictions, unfit), `notes`, `certificate_path` (texto, sem upload/GED). Validade derivada (`classifyDocumentValidity`). `doctor_id SET NULL`. RLS de módulo `medicine` | `schema/health-exams.ts` (0030 + policy 0053) |
| Enum `exam_type` reaproveitado em OS | **em develop**             | `service_orders.os_type` usa o enum `exam_type`, então **alterar o enum afeta Ordens de Serviço**                                                                                                                                                                                                                                                                     | `schema/service-orders.ts:20-46`              |
| Menu "Medicina do Trabalho"          | **em develop**             | Grupo com "Exames e ASO" e "Médicos" (NOB-97). Menu estático, sem esconder itens por módulo                                                                                                                                                                                                                                                                           | `nav-menu.tsx:102-110`                        |
| Psicossocial                         | **em develop**             | Campanhas por `company_id` + questionário público por token + fatores por GES. Está no grupo "Gestão de Segurança" e **não é restrito por módulo**                                                                                                                                                                                                                    | `schema/psychosocial.ts`, mig. 0021/0046      |
| Ergonomia                            | **em develop**             | `ergonomic_evaluations` por risco (0051)                                                                                                                                                                                                                                                                                                                              | `schema/ergonomics.ts`                        |
| eSocial S-2220 / S-2221              | **em develop (stub)**      | Builders XML simplificados (`cpf, dataAso, tipoExame default "0", resultado`). **Não lê `health_exams`**, sem layout oficial completo, sem transmissão                                                                                                                                                                                                                | `domains/esocial/builders.ts:61-91`           |
| PCMSO                                | **não implementado**       | Só aparece como sugestão de `docType` no GED, em textos fixos do DOCX do PGR e no marketing. Confirmado por NOB-101 §2                                                                                                                                                                                                                                                | `domains/documents/documents.ts:73`           |
| CID-10                               | **não implementado**       | Nenhuma ocorrência em `src`                                                                                                                                                                                                                                                                                                                                           | grep                                          |
| Lista C                              | **não implementado**       | Nenhuma ocorrência. Linear NOB-113 trata de completar a tabela. **Correção da revisão cruzada:** no protótipo, a "Lista C" é a do Anexo II do Decreto 3.048/99 (NTEP: intervalos de CID × classes CNAE), não um catálogo de exames por agente (ver AUDIT-PROTOTYPE §5.12). O catálogo de exames é outra lacuna, sem tabela própria (AUDIT-DATABASE P4)                | grep, Linear NOB-109                          |
| CNAE / CBO                           | parcial em develop         | `companies.cnae` e `job_roles.cbo` são texto livre, sem tabela de referência. Plano em `origin/feature/lot-04-cnae-cbo` (só docs)                                                                                                                                                                                                                                     | `schema/companies.ts:36`, `job-roles.ts:30`   |
| Assinatura de ASO                    | **não implementado**       | O registry de assinatura tem `demo`, `inspection`, `pgr` e `service-order`, e **nenhum** alvo `aso`/`health_exam`                                                                                                                                                                                                                                                     | `domains/signatures/targets/`                 |
| Fontes de risco para PCMSO           | **só em PR aberta (#112)** | ver 5.3                                                                                                                                                                                                                                                                                                                                                               | branch NOB-98                                 |

### 5.2 Contribuições do Rikelvin mergeadas

| PR (Linear)         | Merge     | Conteúdo efetivo em develop                                                                                                                                                                                                                     | Pontos de integração para a Medicina                                                                                                                                       |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #108 (NOB-101) docs | `cd09031` | `docs/produto/08-fluxos-emissao-assinatura.md`: levantamento de emissão/assinatura. PCMSO inexistente, ASO sem assinatura, auditoria só em console e decisões pendentes                                                                         | Fonte das decisões de fluxo (quem elabora/revisa/emite/assina)                                                                                                             |
| #109 (NOB-97)       | `ca364d8` | Migration 0053, `company_modules` + eventos, RLS restritiva em `pgr`/`pgr_ges`/`pgr_revisions`/`health_exams`, `assertCompanyModuleTx` em PGR/exames, SQLSTATE 42501→FORBIDDEN, menu Medicina separado. 11.869 das 12.383 linhas são o snapshot | **Toda tabela nova de Medicina com `company_id` deve ter a policy RESTRICTIVE `companyModuleScope(..., "medicine")` + `assertCompanyModuleTx(...,"medicine")` na escrita** |
| #110 (NOB-99)       | `954e53f` | Filtro `module=` em empresas/funcionários (repo + REST + Postman). Formulários de PGR/exames filtrados                                                                                                                                          | Usar `listEmployees({module:"medicine"})` e `listCompanyOptions(orgId,"medicine")` e não criar cadastro paralelo                                                           |
| #111 (NOB-100)      | `88a131b` | Gestão de habilitação (owner + motivo + histórico), tela `companies/[id]/services`, `GET/PUT /companies/{id}/modules`, `read-json-body.ts`                                                                                                      | Habilitar Medicina por empresa antes de operar. `readJsonBody` para REST                                                                                                   |
| #113 (NOB-103)      | `51eac8f` | Escrita de risco valida `companyId`/`workUnitId` opcionais contra o GES e exige o módulo PGR. Reabilita `rest-risks` no CI                                                                                                                      | Riscos (`risks`) são escritos só com PGR habilitado. A leitura ainda não é restrita (a #112 muda isso)                                                                     |
| #114 (NOB-104) docs | `da2c68a` | `docs/planning/nob-104-revisao-maquinas.md` (máquinas)                                                                                                                                                                                          | Irrelevante para Medicina                                                                                                                                                  |
| #118 (NOB-102)      | `d6b787c` | `domains/pgr/cnpj.ts`: CNPJ alfanumérico (algoritmo oficial), DUPLICATE/409 com `fields.cnpj`, JSON malformado → 422 em empresas/funcionários                                                                                                   | Validação única de CNPJ para qualquer cadastro de clínica/laboratório futuro                                                                                               |

Nenhuma das PRs mergeadas cria tabela clínica, coluna nova em `health_exams` ou guard de papel técnico (médico).

### 5.3 PR #112 aberta (NOB-98) — "Fontes rastreáveis de riscos para Medicina"

- **Base** `codex/NOB-100-feat/servicos-por-empresa` (já mergeada; o merge-base é `044334e`). **Não tem as #113, #114 e #118.**
  `git merge-tree` contra develop dá **1 conflito** (`docs/api/sst-manager.postman_collection.json`).
  Estado: `draft=false`, `mergeable=MERGEABLE`, sem review. **`gh pr checks 112` → "no checks reported"**: nunca passou por CI
  (CI só roda com base develop/main). Commits `7c9adb3`, `ebfbac3`. +26.684/−34 em 29 arquivos (≈24.760 linhas são snapshots).
- **Migration 0054_medical_risk_sources**:
  - `medical_risk_sources(id, org_id, company_id, kind CHECK internal|external, title, version, reference, origin_pgr_id, origin_revision, fingerprint, supersedes_source_id, registered_by, registered_at)`
    com `UNIQUE(id,org_id,company_id)`, `UNIQUE(org_id,company_id,fingerprint)`, `UNIQUE(org_id,company_id,supersedes_source_id)`,
    CHECK de origem (internal ⇔ origin_pgr_id). **`origin_pgr_id` sem FK** (sobrevive à exclusão do PGR).
  - `medical_risk_entries(…, source_id, content jsonb CHECK object, status pending|validated|rejected, reviewed_by, reviewed_at, review_note)` com CHECK de coerência do revisor.
  - `medical_risk_events(…, actor, event, created_at)`.
  - FKs compostas `(source_id, org_id, company_id)`. RLS: isolamento + **RESTRICTIVE `medicine`** nas 3 + RESTRICTIVE INSERT só `pending`.
    `GRANT SELECT, INSERT` e **`REVOKE UPDATE, DELETE`**: imutável e sem caminho de validação no runtime.
- **Migration 0055_pgr_inventory_module_access**: policies RESTRICTIVE novas em **`risks`** (via `ges.company_id` + módulo `pgr`),
  `risk_assessments`, `control_measures`, `ergonomic_evaluations` e `epi_risk` (via pai `risks`). **Empresa sem PGR habilitado deixa de ler o inventário de riscos.**
- **Contratos**: `domains/medicine/risk-sources.ts` (`medicalRiskContentSchema {agentType, description, exposureGroup, jobRole?, possibleInjuries?, exposureDescription?}`, lista ≤500,
  `medicalSourceInputSchema` discriminado `external{title,version,reference,risks}` | `internal{pgrId}`, `SourceFreshness`, `medicalSourceWarnings`, `canUseMedicalRisk` = validated ∧ (current ∨ external_reference)).
  `server/medicine/risk-source-core.ts` faz o fingerprint SHA-256 canônico, o snapshot interno via SQL único (PGR → pgr_ges → ges → risks + última avaliação em `originalData`)
  e a frescura comparando o fingerprint atual. A resposta traz `validationAvailable:false` e o aviso de que a autorização de validadores está indefinida.
- **APIs/UI**: `GET|POST /api/v1/companies/{id}/medical-risk-sources`, Actions `server/actions/medicine/risk-sources.ts`, telas `/medical-risks` e
  `/companies/[id]/medical-risks` (+ `source-form.tsx`), item de menu "Riscos para PCMSO".
- **Pressupõe**: #109→#110→#111 integradas (já estão) e definição de negócio pendente sobre **quem valida** (médico ≠ usuário). Não
  há aprovar/rejeitar. A importação é JSON estruturado (sem PDF). O merge em develop aplicará 0054+0055 **automaticamente no banco de testes** (4.8).

### 5.4 Trabalho do Douglas (#99–#106) — reaproveitável, não reconstruir

| Peça                                                                                                                                                                                                        | Status                      | Reuso para PCMSO/ASO                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template DOCX gerado por código (`scripts/pgr-docx`, lib `docx`, Manrope embutida, `font-metrics`/`text-fit`) + `templates/pgr/*`                                                                           | em develop (#100, #106)     | Copiar o **padrão** (template-kit) para um `templates/pcmso/`. Nunca editar `.docx` à mão                                                                                                                                 |
| Motor `integrations/docx/template-engine.ts` (docxtemplater, delimitadores `{{ }}`, `listTemplateTags`, `findLeftoverMarkers`)                                                                              | em develop                  | Genérico: reutilizar direto                                                                                                                                                                                               |
| PDF: `integrations/pdf/gotenberg.ts` (`docxToPdf`, `htmlToPdf`) + `Dockerfile.gotenberg` com as fontes + proxy Caddy com Bearer; alternativa Google Docs (`integrations/google/*`, `PGR_DOCX_PDF_PROVIDER`) | em develop                  | Genérico: reutilizar                                                                                                                                                                                                      |
| `pgr-docx-core.ts` (consolidado → content → data → DOCX → PDF; erros NOT_FOUND / REPORT_UNAVAILABLE 503)                                                                                                    | em develop                  | Modelo de orquestração. Hoje é **específico do PGR**                                                                                                                                                                      |
| REST binário `GET/POST /api/v1/pgr/{id}/docx` (sem `restHandler`, reusa `resolveContext` + `restStatusForCode`)                                                                                             | em develop                  | Precedente para `/pcmso/{id}/docx`                                                                                                                                                                                        |
| GED: `documents` (versão por `document_group_id`, `UNIQUE(org,group,version)`, vínculo polimórfico `related_entity_type/id`), `folders`, Storage privado particionado por org                               | em develop (023/024, #106)  | Arquivar PCMSO/ASO como documento versionado. **`documentRelatedEntityTypeSchema` é enum fechado em código** (`pgr`, `responsible_technician`, `ges`, `risk`, …), então incluir `pcmso`/`health_exam` é mudança só de Zod |
| Fila `jobs` (`job_type` enum só `pdf_batch`) + worker standalone (`worker/index.ts`, claim `FOR UPDATE SKIP LOCKED`, owner-db)                                                                              | em develop (025, #106)      | Gerar PCMSO em lote exige **valor novo no enum `job_type` (migration)** ou payload `kind` (`pdfBatchKindSchema = ["pgr"]`)                                                                                                |
| CI/CD Vercel com migrations automáticas                                                                                                                                                                     | em develop/main (#101–#104) | Ver riscos (seção 7)                                                                                                                                                                                                      |
| PR #115 (NOB-105, draft): SHA-256 do template/dados/arquivo em headers da geração do PGR                                                                                                                    | só em PR aberta             | Bom padrão de rastreabilidade para documento médico                                                                                                                                                                       |

### 5.5 Branches remotas não mergeadas

| Branch                                       | À frente / atrás | Conteúdo                                                                                                           |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `codex/NOB-98-feat/riscos-para-medicina`     | +2               | = PR #112 (5.3)                                                                                                    |
| `codex/NOB-105-feat/rastreabilidade-geracao` | +1               | = PR #115 draft (hash/identificação da geração do PGR + doc de lacunas)                                            |
| `codex/NOB-106-docs/proposta-pgr-basico`     | +1               | = PR #116 draft (doc de oferta de PGR básico, sem cobrança)                                                        |
| `codex/NOB-107-test/amostras-revisao`        | +3               | = PR #117 draft (protocolo de revisão + teste de amostras do PDF)                                                  |
| `codex/NOB-97/99/100/101/102/103/104`        | 0                | já mergeadas                                                                                                       |
| `feature/gestao-saude`                       | +1 / −194        | Commit antigo (2026-08-02) do módulo ASO. Parece substituído pelo que entrou na 0030 (não comparado linha a linha) |
| `feature/lot-04-cnae-cbo`                    | +1 / −49         | Só docs de planejamento de autocomplete CNAE/CBO                                                                   |
| `feature/pgr-docx-templates`                 | +4 / −49         | Commits originais da fatia 030. O conteúdo parece ter entrado via #100 (não verificado arquivo a arquivo)          |

## 6. Lacunas (relevantes para a Medicina)

1. **Não existe entidade PCMSO** (programa, versão, médico coordenador, vigência, vínculo empresa/unidade), nem matriz
   risco→exame→periodicidade, nem Lista C, nem CID-10.
2. `health_exams` **não tem `company_id`**: o exame "muda de empresa" (e de visibilidade RLS) se o funcionário for transferido, e não existe snapshot
   de empresa/função/GES/riscos na data do exame.
3. `health_exams` sem lista de procedimentos/exames complementares, sem resultado por procedimento, sem PCMSO de origem, sem
   assinatura e sem arquivo gerado (`certificate_path` é texto solto, sem GED/Storage).
4. `medicos` sem vínculo a `users`, sem UF do CRM e sem papel de "médico coordenador/examinador". A #112 trava exatamente nisso
   (não há quem possa validar risco).
5. Não existe papel técnico no modelo de autorização: só `owner`/`collaborator`/`client`. O `scoped_company_id` não é usado no contexto.
6. Menu estático: não reflete módulo habilitado (a habilitação é por empresa, não por escritório; a UI de listas confia na RLS).
7. eSocial S-2220 é stub desconectado dos exames. O enum de evento já tem S-2220/S-2221.
8. Auditoria de escrita é só `console` (`logTenantEvent`). O único histórico persistido do domínio é `company_module_events` (e, na #112, `medical_risk_events`).
9. Formulário de exame limita a 200 funcionários (`pageSize: 200`) sem paginação nem busca no servidor.
10. Duas coleções Postman: `docs/api/sst-manager.postman_collection.json` (canônica, 278 KB) e `postman/sst-manager.postman_collection.json`
    (6,7 KB, última alteração 2026-06-28, obsoleta). Isso contraria a regra de "um arquivo só".
11. CLAUDE.md desatualizado: última migration (diz 0030, real 0053), rotas públicas, Basic Auth sandbox, CD com migrations, scripts novos.

## 7. Riscos

| #   | Risco                                                                                                                                                                                                                                                                                | Severidade         | Evidência                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------- |
| R1  | **Merge em develop = migration aplicada no Supabase de testes. Merge develop→main = aplicada em produção, sem passo manual.** Qualquer migration de Medicina (incl. 0054/0055 da #112) precisa estar pronta para produção no momento do merge, e rollback de schema não é automático | Alta               | `cd.yml:5-7,67-75`, run 39467946613                |
| R2  | 0055 (#112) passa a esconder `risks`/avaliações/medidas/EPI-risco de empresas sem PGR. Empresas criadas depois da 0053 não têm PGR por padrão, e telas/relatórios que leem riscos sem filtrar empresa podem "perder" linhas silenciosamente                                          | Média              | `0055` (branch)                                    |
| R3  | Empresas novas nascem sem Medicina: o cadastro de exame falha com FORBIDDEN e o funcionário some do seletor até um owner habilitar. Colaborador não consegue habilitar                                                                                                               | Média (UX/suporte) | `companies.ts:175`, `company-module-core.ts:19-23` |
| R4  | RLS de `health_exams` depende de `employees.company_id` mutável: transferir o funcionário pode ocultar/expor histórico clínico entre empresas com módulos diferentes                                                                                                                 | Média              | `schema/health-exams.ts:117-123`                   |
| R5  | A #112 nunca passou por CI, está desatualizada em relação a develop (sem #113/#118) e tem conflito em Postman. A numeração 0054/0055 colide com qualquer migration de Medicina criada em paralelo                                                                                    | Média              | `gh pr checks 112`, merge-tree                     |
| R6  | Alterar o enum `exam_type` impacta `service_orders.os_type`                                                                                                                                                                                                                          | Baixa/Média        | `schema/service-orders.ts:23-46`                   |
| R7  | Dado de saúde (P0) sem trilha persistida de acesso/alteração. `logTenantEvent` vai para console                                                                                                                                                                                      | Média (LGPD)       | `audit-log.ts`, NOB-101 §4                         |
| R8  | 8 suítes REST/privilégio excluídas do CI, então rotas REST novas de Medicina podem não ser exercidas por teste automatizado se seguirem o harness atual                                                                                                                              | Média              | `jest.config.ts:27-36`                             |
| R9  | Bypass dev REST sempre com `plan:"free"`: testes de Postman de recursos com cota (assinatura/IA) se comportam como free                                                                                                                                                              | Baixa              | `rest.ts:64`                                       |

## 8. Dependências

- Medicina (PCMSO/NOB-109, Linear: Backlog, Carlos) é **bloqueada por** NOB-98 (#112), NOB-112 (abas/formulários), NOB-101 (fluxos),
  NOB-113 (Lista C) e NOB-111 (PGR externo), e bloqueia NOB-118 (trial 15 dias com restrição de impressão), NOB-125 (IA), NOB-128 e NOB-129.
- Técnicas: `company_modules`/`companyModuleScope`/`assertCompanyModuleTx` (develop), cadastros comuns com filtro `module` (develop),
  `medical_risk_sources` (#112), GED + worker + template engine + Gotenberg (develop), registry de assinatura (develop, +1 `target_type`).
- Operacionais: CD Vercel (Douglas), projeto Supabase de testes/produção, role `app_runtime` pré-criada em banco novo (`vercel.md:103-105`).

## 9. Decisões pendentes

| Decisão                                                                                                                                                        | Para quem                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Quem valida riscos/PCMSO e como o médico é identificado (vincular `medicos` a `users`? papel técnico novo? CRM+UF?). Destrava a #112                           | **Dr. Alcides + Expedito** (regra), **Rikelvin** (modelo de autorização) |
| Integrar a #112 como está (imutável, sem validação) ou esperar a definição acima. Ordem de merge e numeração 0054/0055 versus migrations de Medicina do Carlos | **Rikelvin + Douglas + Carlos**                                          |
| Aceitar a 0055 (riscos escondidos sem PGR) antes de ir para `main`                                                                                             | **Douglas (TL) + Rikelvin**                                              |
| `health_exams` ganha `company_id` (snapshot) e vínculo a PCMSO? Evoluir a tabela ou criar `aso` novo?                                                          | **Carlos** (proposta) → **Douglas**                                      |
| Habilitação de Medicina na criação da empresa (default, wizard, ou continua manual por owner)                                                                  | **Expedito**                                                             |
| Estratégia de migrations com CD automático: staging intermediário, feature flag, migrations só aditivas, janela develop→main                                   | **Douglas**                                                              |
| Medicina reusa o enum `exam_type` (compartilhado com OS) ou cria o seu?                                                                                        | **Carlos + Douglas**                                                     |
| Escopo eSocial S-2220 real (layout S-1.3, transmissão) nesta frente ou depois                                                                                  | **Expedito + Douglas**                                                   |
| Trilha de auditoria persistida para dado de saúde                                                                                                              | **Rikelvin** (segurança)                                                 |
| Remover a coleção Postman obsoleta `postman/` e atualizar o CLAUDE.md                                                                                          | **Douglas**                                                              |

## 10. Recomendações

1. **Padrão obrigatório para cada tabela nova de Medicina**: `org_id` + `company_id` com FK composta `(company_id, org_id) → companies(id, org_id)`
   (o índice `uq_companies_id_org` já existe), policy PERMISSIVE de isolamento + RESTRICTIVE `companyModuleScope(orgId, companyId, "medicine")`
   em `pgPolicy` no schema, `assertCompanyModuleTx(tx, orgId, companyId, "medicine")` em toda escrita, GRANT explícito na migration,
   e tabelas filhas herdando pelo pai (padrão `pgr_ges_module_access`).
2. Mover Medicina para namespaces próprios (`domains/medicine`, `server/actions/medicine`, `server/medicine/*-core.ts`), como a #112 já faz,
   em vez de continuar em `actions/pgr/`. Os rótulos/URLs existentes (`/health-exams`, `/medicos`) podem ficar.
3. Consumir riscos **somente via `medical_risk_sources/entries`** (snapshot + fingerprint), nunca lendo `risks` diretamente, para funcionar
   com PGR externo e com a 0055.
4. Reaproveitar sem reconstruir: `template-engine`, `gotenberg`, `google`, GED (`documents` + versões + `related_entity`), worker/`jobs`,
   registry de assinatura e `readJsonBody`. Gerar o template do PCMSO/ASO por script, como `scripts/pgr-docx`.
5. Toda migration de Medicina deve ser **aditiva e retrocompatível**, já que o merge em develop aplica no banco de testes e o release em produção.
   Ensaiar `drizzle-kit migrate` num Postgres efêmero com dump de testes antes do merge e coordenar a numeração com a #112.
6. Antes de modelar o ASO: decidir `company_id` (snapshot) em `health_exams` e um enum próprio de tipo de exame/ASO para desacoplar das OS.
7. Antes de alterar o código: rebasear a #112 sobre develop, resolver o conflito do Postman e retargetar para develop para rodar o CI.

## 11. Nível de confiança

- **Alto**: versões, migrations/journal, schema e RLS de `company_modules`/`health_exams`/`medicos`, guards e wrappers, conteúdo das
  PRs mergeadas (diffs lidos), conteúdo da #112 (SQL e core lidos), definição do CD e execução bem-sucedida do passo de migrations.
- **Médio**: que a 0053 foi efetivamente aplicada no banco de testes (o log mostra o passo, não a lista aplicada), e a equivalência entre as
  branches `feature/gestao-saude`/`feature/pgr-docx-templates` e o que está em develop.
- **Baixo**: nenhuma afirmação deste relatório depende de suposição não marcada.

## 12. O que não foi possível verificar

- O estado real dos bancos de testes e de produção (não houve acesso, por regra): quais migrations estão aplicadas, contagens de
  `company_modules` e quantas empresas pós-0053 estão sem habilitação.
- A execução de testes: **nenhuma suíte foi rodada** nesta auditoria. Os números de testes citados vêm dos corpos das PRs, sem verificação própria.
- O comportamento em runtime das telas (sem navegador) e o QA autenticado com Clerk.
- A comparação arquivo a arquivo de `feature/gestao-saude` e `feature/pgr-docx-templates` com develop.
- O conteúdo das issues Linear além de NOB-109 e NOB-130 (NOB-98 conforme o BRIEF; NOB-111/112/113 só pelos títulos).
- Nota de transparência: durante a auditoria executei `git fetch -q origin` na worktree. Isso atualiza apenas as referências remotas
  (`origin/*`) do repositório compartilhado, sem tocar no working tree nem no branch `develop` local do usuário. `origin/develop`
  continuou em `d6b787c`.
