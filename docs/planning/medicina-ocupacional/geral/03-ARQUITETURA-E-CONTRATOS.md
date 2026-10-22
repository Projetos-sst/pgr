# 03 — Arquitetura e contratos

> Documento permanente. Base: `origin/develop` = `d6b787c` (2026-10-21) e PR #112 aberta (`ebfbac3`).
> Cada contrato tem um rótulo: **IMPLEMENTADO** (em develop, com evidência), **EM DESENVOLVIMENTO** (só na PR #112,
> não mergeada), **BLOQUEADO** (depende de decisão) ou **PROPOSTO** (P1–P9 da auditoria; nenhum arquivo criado).
> **Nenhuma proposta deste documento está implementada.**
> Fontes principais: [AUDIT-ARCHITECTURE.md](../AUDIT-ARCHITECTURE.md), [AUDIT-DATABASE.md](../AUDIT-DATABASE.md),
> [DEPENDENCIES.md](../DEPENDENCIES.md). Contexto: [01](01-CONTEXTO-E-ESCOPO.md) · decisões: [04](04-DECISOES-E-BLOQUEIOS.md).

## 1. Stack (IMPLEMENTADO)

| Camada     | Tecnologia                                                        | Observação para a Medicina                                                                                                                 |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | Next.js **16.2.6** App Router + React **19.2.4** (versões exatas) | Major com breaking changes: consultar `node_modules/next/dist/docs/` antes de código de framework. `src/proxy.ts` é o middleware renomeado |
| Auth       | Clerk (`@clerk/nextjs` ^7)                                        | `clerkMiddleware` + `auth.protect()`; não há `middleware.ts`. Sandbox aplica HTTP Basic antes de tudo                                      |
| Banco      | Postgres (Supabase), `postgres-js`                                | runtime como `app_runtime` (pooler 6543, `prepare:false, max:1`)                                                                           |
| ORM        | Drizzle **code-first** (`drizzle-orm` ^0.45, `drizzle-kit` ^0.31) | schema em `src/shared/db/schema`; migrations geradas; GRANTs/triggers como SQL custom dentro da migration                                  |
| Validação  | Zod v4                                                            | schemas de domínio em `src/shared/domains/*`                                                                                               |
| Documentos | docxtemplater, Gotenberg/Google, GED, `jobs` + worker (Douglas)   | ver §8                                                                                                                                     |

**Duas conexões.** `app_runtime` (sem BYPASSRLS) para a aplicação; owner (`DATABASE_URL_UNPOOLED`) só para
`drizzle-kit` e jobs administrativos (precedente `caepi-upsert`, worker). A Medicina **nunca** usa a conexão owner
para ler dado de tenant.

## 2. Tenancy: escritório × empresa-cliente (IMPLEMENTADO)

| Conceito                      | Implementação                                                                           | Evidência                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Tenant = **escritório**       | `orgs.id`; `app.current_org` via `withOrg(orgId, tx => …)`                              | `src/shared/db/with-org.ts:13`              |
| **Empresa-cliente**           | `companies` é dado do tenant; `uq_companies_id_org (id, org_id)` sustenta FKs compostas | migration 0053                              |
| Papéis                        | `owner` / `collaborator` / `client` (desconhecido → `client`)                           | `src/shared/tenant/roles.ts`                |
| Gate                          | `requireOfficeStaff()` admite owner e collaborator; `client` é negado em tudo           | `src/shared/auth/require-office-staff.ts:8` |
| Escopo por empresa do usuário | `org_memberships.scoped_company_id` existe e **não é aplicado**                         | AUDIT-SECURITY E8                           |

Consequência: **hoje nenhum usuário da empresa-cliente acessa o sistema.** Todo acesso é de equipe do escritório.

## 3. Módulos por empresa: `company_modules` (IMPLEMENTADO)

| Peça                                                  | O que faz                                                                                                        | Onde                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `company_modules`                                     | `org_id`, `company_id`, `module` ∈ {`pgr`, `medicine`}, `enabled`, FK composta → `companies`, runtime sem DELETE | schema `company-modules.ts`; 0053                    |
| `company_module_events`                               | histórico append-only (ator, motivo, estado anterior/novo)                                                       | idem                                                 |
| `companyModuleScope(orgId, companyId, module)`        | expressão usada nas policies **RESTRICTIVE**                                                                     | `src/shared/db/schema/module-policy.ts:5`            |
| `assertCompanyModuleTx(tx, orgId, companyId, module)` | barreira na aplicação; lança `ForbiddenError`                                                                    | `src/shared/db/repositories/company-modules.ts:16`   |
| `health_exams_module_access`                          | RESTRICTIVE derivada de `employees.company_id` atual (exame **não** tem `company_id`)                            | `schema/health-exams.ts`; AUDIT-ARCHITECTURE R4      |
| Gestão                                                | só owner altera, motivo obrigatório, lock na empresa, evento na mesma transação                                  | `company-module-core.ts`; `/companies/[id]/services` |
| Negação por padrão                                    | `createCompany` não cria habilitação: empresa nova nasce sem PGR e sem Medicina                                  | AUDIT-ARCHITECTURE §4.6 (E-03 pendente)              |

**Padrão obrigatório para toda tabela nova de Medicina** (AUDIT-ARCHITECTURE §10.1): `org_id` + `company_id` com FK
composta `(company_id, org_id) → companies(id, org_id)`; policy PERMISSIVE de isolamento + RESTRICTIVE
`companyModuleScope(…, 'medicine')` declaradas no schema (`pgPolicy`); `assertCompanyModuleTx(…, 'medicine')` em toda
escrita; GRANT explícito na migration; filhas herdam pelo pai.

## 4. Cadastros compartilhados (IMPLEMENTADO, NOB-99)

- Empresa, funcionário, função, GES: **um** cadastro do tenant. Filtro opcional `module=pgr|medicine` (UX, não
  autorização) em `listCompanies`, `listCompanyOptions` (`repositories/companies.ts:133`) e `listEmployees`.
- `medicos` é catálogo do escritório, **sem** restrição por módulo (decisão da spec NOB-97).
- Limitações conhecidas: `UNIQUE(org_id, cpf)` em `employees` (E-06); formulário de exame com `pageSize: 200` fixo
  (corrigido no Lote 1).

## 5. Contratos Segurança → Medicina

Resumo por estado. A validação campo a campo está em [AUDIT-DATABASE.md](../AUDIT-DATABASE.md) §10.1 e a
classificação consolidada em [DEPENDENCIES.md](../DEPENDENCIES.md) §3. Não copiar daqui para lá: atualizar lá.

### 5.1 CONTRATOS EXISTENTES (IMPLEMENTADO)

| Contrato                          | Detalhe                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Empresa → GES → risco             | `risks.ges_id`, `ges.company_id`. **Risco é por GES**, não por função (o protótipo modela por função) |
| Avaliação e medidas               | `risk_assessments` (P×S, NR-09), `control_measures`                                                   |
| GES ↔ função                      | `ges_job_roles` (N:N, `worker_count`)                                                                 |
| Escrita de risco exige módulo PGR | aplicação (NOB-103, #113)                                                                             |
| Leitura de risco                  | **não** restrita por módulo em develop                                                                |

A Medicina **não consome** esses dados diretamente (regra de convivência, DEPENDENCIES §3).

### 5.2 EM DESENVOLVIMENTO (PR #112, NOB-98, Rikelvin; não mergeada, sem CI)

| Elemento         | Detalhe                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Migrations       | `0054_medical_risk_sources` (3 tabelas) e `0055_pgr_inventory_module_access`                                                                                             |
| Fontes           | `medical_risk_sources` com `kind` = `internal` / `external`, `fingerprint` SHA-256, `supersedes_source_id`, frescor `current` / `changed` / `unavailable` / `superseded` |
| Imutabilidade    | runtime com SELECT/INSERT e `REVOKE UPDATE, DELETE`; INSERT só `pending`                                                                                                 |
| Uso              | `canUseMedicalRisk` = `validated` ∧ fresco → **hoje nada é utilizável** (sem fluxo de validação)                                                                         |
| Efeito colateral | 0055 esconde riscos/avaliações/medidas/EPI de empresas **sem PGR** em todo o app (D-02, R-03)                                                                            |
| Superfícies      | `GET                                                                                                                                                                     | POST /api/v1/companies/{id}/medical-risk-sources`, telas `/medical-risks`, `/companies/[id]/medical-risks` |
| Situação da PR   | base = branch do NOB-100 (já mergeada), nunca rodou CI, conflito no Postman, reserva 0054/0055                                                                           |

### 5.3 BLOQUEADOS (decisão)

| Contrato                                               | Bloqueio                             | Decisão            |
| ------------------------------------------------------ | ------------------------------------ | ------------------ |
| Quem valida um risco para o PCMSO                      | sem validador                        | A-01 (Dr. Alcides) |
| Quem concede e revoga a autorização                    | **PARCIALMENTE_RESPONDIDA** (ver §6) | E-01               |
| Como o profissional é identificado (Clerk ↔ `medicos`) | sem modelo                           | E-01, D-03         |
| Escopo da autorização e efeito de troca de coordenador | indefinido                           | A-01               |
| Riscos não validados no ASO (com aviso)?               | indefinido                           | A-04               |
| Dono da identidade profissional (NOB-121 × NOB-98)     | indefinido                           | D-03               |

### 5.4 PROPOSTOS (AUDIT-DATABASE §10.4; nenhum arquivo criado)

| ID  | Proposta (nome indicativo)                                                                  | Depende da NOB-98?        | Lote         |
| --- | ------------------------------------------------------------------------------------------- | ------------------------- | ------------ |
| P1  | identidade profissional: `medicos.crm_uf/rqe/user_id` + designação por empresa com vigência | não (mas a destrava)      | 3            |
| P2  | datasets globais com procedência (Lista C, NR-4, eSocial 24)                                | não                       | 3            |
| P3  | histórico de função (`employee_job_assignments`)                                            | não                       | 4            |
| P4  | catálogo de procedimentos + procedimentos por exame (sem valores de resultado)              | não                       | 2            |
| P5  | revisão de riscos append-only                                                               | **sim**                   | 3 (Rikelvin) |
| P6  | PCMSO (programa, versões, plano de exames)                                                  | **sim**                   | 5            |
| P7  | emissão genérica com snapshot + hash (decisão do Douglas)                                   | parcial                   | 4            |
| P8  | assinatura técnica ICP-Brasil                                                               | não (depende de provedor) | 4b/backlog   |
| P9  | trilha de auditoria clínica append-only                                                     | não                       | 2            |

Ajustes **propostos ao Rikelvin** (não implementar por fora): capturar função/CBO/expostos no snapshot interno;
classificação opcional e FK de documento na fonte externa; fingerprint sem `pgr.updated_at` (DEPENDENCIES §3.4).
A numeração das propostas (0056+) é **indicativa e não está reservada**: ver [06](06-GIT-MIGRATIONS-CD.md) §3.2.

## 6. Modelo de autorização profissional: impacto da resposta do Expedito

**Fato registrado.** Em 20/10/2026 Rikelvin perguntou ao grupo quem deve conceder a autorização para um profissional
validar tecnicamente os riscos do PGR (1. administrador do sistema/escritório; 2. responsável técnico da empresa; 3. outro profissional ou setor definido pela empresa) e se é necessário registrar os dados de identificação de quem
valida. Em 21/10/2026 o Expedito respondeu: _"Opção 03. A empresa mesmo define quem vai autorizar. E sim; é importante
registrar os dados desse profissional."_ Fonte: resposta de Expedito no grupo, 21/10/2026.

**Status da decisão: PARCIALMENTE_RESPONDIDA.** Registro vivo em [04](04-DECISOES-E-BLOQUEIOS.md).

| Confirmado                                                                    | Ainda não definido                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A **empresa** define quem concede a autorização de validação                  | Qual usuário da empresa indica o autorizador                   |
| Os dados de identificação do profissional validador **devem ser registrados** | Se o autorizador também valida                                 |
| —                                                                             | Categorias profissionais admitidas                             |
| —                                                                             | Comprovação de identidade                                      |
| —                                                                             | Profissionais externos (clínica parceira)                      |
| —                                                                             | Escopo (por empresa, por fonte, por período)                   |
| —                                                                             | Revogação e o destino das validações anteriores após revogação |
| —                                                                             | Justificativa obrigatória de rejeição                          |
| —                                                                             | Modelo técnico (Clerk, banco)                                  |

**Ambiguidade a resolver antes de modelar.** "Empresa" pode ser a **empresa-cliente** (`companies`) ou o **escritório**
(`orgs`). Se for a empresa-cliente, hoje **nenhum usuário dela acessa o sistema** (papel `client` bloqueado em tudo;
`scoped_company_id` não aplicado), então "a empresa define" exigiria um ator que ainda não existe ou um registro feito
pelo escritório em nome da empresa (o que esbarra na regra "não aprovar em nome de terceiros").

**Impacto técnico (sem virar regra).**

- Reforça que a designação é **por empresa-cliente** e que o dado do profissional precisa de registro estruturado:
  é compatível com a direção de P1 (identidade + designação com vigência), **sem** confirmar P1.
- Descarta, para a pergunta feita, a leitura "o escritório/owner autoriza por padrão". Continua valendo
  "owner/colaborador não são presumidos responsáveis técnicos".
- **Não autoriza** implementar concessão de permissões, papel clínico ou fluxo de validação. P1 e P5 continuam
  **BLOQUEADOS** até os itens da coluna da direita e a ambiguidade acima serem respondidos.

## 7. APIs e Server Actions (IMPLEMENTADO: padrão do repositório)

| Superfície         | Wrapper                                | Retorno                                                                                                                                                    | Evidência                               |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Server Action (UI) | `officeAction(operation, fn, {audit})` | `ActionResult<T>` (`{ok:true,data}` \| `{ok:false,error}`)                                                                                                 | `src/shared/server/office-action.ts:18` |
| REST `/api/v1/**`  | `restHandler(...)`                     | mesmos códigos mapeados para HTTP                                                                                                                          | `src/shared/api/rest.ts:97`             |
| Erros              | `toActionError` compartilhado          | `VALIDATION` 422, `DUPLICATE` 409, `NOT_FOUND`/`FK_NOT_FOUND` 404/422, `FORBIDDEN`/`NO_TENANT_CONTEXT` 403, `UNAUTHORIZED` 401, SQLSTATE 42501 → FORBIDDEN | `CLAUDE.md`; AUDIT-ARCHITECTURE §4.5    |

**Regra das 4 superfícies (CLAUDE.md, obrigatória para todo CRUD/HTTP).** Na mesma PR: (1) Server Action com
`officeAction`; (2) Route Handler REST em `src/app/api/v1/<recurso>/**` com `restHandler` e verbos reais (201 no
create, 204 no delete, `/[id]/dependents` se houver FK de entrada), reusando repositório, zod e `toActionError`;
(3) registro em `docs/api/api-design.md`; (4) requests na coleção única `docs/api/sst-manager.postman_collection.json`.
Referência: o recurso **companies**.

Notas para a Medicina:

- Namespace novo: `domains/medicine`, `server/actions/medicine`, `server/medicine/*-core.ts` (como a #112). Rotas e
  rótulos existentes (`/health-exams`, `/medicos`) ficam onde estão (AUDIT-ARCHITECTURE §10.2).
- Testar REST no padrão de `rest-health-exams.test.ts` (roda no Jest), **não** no harness das 8 suítes `rest-*`
  excluídas (`jest.config.ts`).
- Bypass dev do REST: só fora de produção, contexto fixo `plan:"free"`; ver [05](05-SEGURANCA-E-DADOS.md).
- Dados de saúde: auditoria do `officeAction` hoje é `console` (`logTenantEvent`), **não** trilha persistida.

## 8. GED e geração documental do Douglas (IMPLEMENTADO para o PGR)

| Peça                                                                  | Situação                                                             | Uso pela Medicina                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `integrations/docx/template-engine.ts` (docxtemplater)                | genérico                                                             | reutilizar direto                                              |
| `integrations/pdf/gotenberg.ts` / Google                              | genérico                                                             | reutilizar direto                                              |
| `scripts/pgr-docx` + `templates/pgr/*` (template gerado por código)   | específico do PGR                                                    | copiar o **padrão** para ASO/PCMSO; nunca editar `.docx` à mão |
| `pgr-docx-core.ts`                                                    | específico do PGR                                                    | modelo de orquestração                                         |
| GED `documents` (versão por `document_group_id`, vínculo polimórfico) | sem `company_id`, sem hash, sem policy de módulo, runtime com DELETE | ASO/PCMSO como documento só após P7 (decisão D-06)             |
| `jobs` (`pdf_batch`) + worker                                         | lê **dados vivos** no processamento (`pdf-batch-core.ts:34`)         | ASO/PCMSO exigem render **do snapshot**                        |
| Registry de assinatura (`target_type`)                                | captura nome + PNG                                                   | só **ciência do trabalhador**, nunca assinatura técnica        |

## 9. Snapshot de emissão (PROPOSTO)

Princípio (AUDIT-DATABASE §10.3): separar **dado-fonte vivo** de **documento emitido**. O snapshot jsonb de entrada é
gravado na mesma transação da emissão, com `snapshot_sha256`; o worker renderiza do snapshot; o arquivo emitido é
imutável (`upsert:false`) e tem `output_sha256`; a assinatura técnica referencia esse hash. Estados propostos
(`draft → in_review → issued → signed → rectified|cancelled`) dependem do Dr. Alcides (A-09). O snapshot de PCMSO/ASO
referencia `source_id` + `entry_id` + `fingerprint` das fontes da #112 e `dataset_id`/versão da Lista C, **nunca**
`risks` direto. Precedente de snapshot imutável já testado no repo: Ordens de Serviço (`service-orders.test.ts`).

## 10. O que muda este documento

Atualizar quando: a #112 for mergeada (mover §5.2 para §5.1); qualquer P1–P9 virar migration (mudar o rótulo para
IMPLEMENTADO com arquivo e PR); a decisão do §6 avançar; o Douglas decidir D-05/D-06/D-07.
