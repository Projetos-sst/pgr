# AUDIT-DATABASE: banco, migrations e documentos (Medicina Ocupacional, Fase 0)

Agente 4, auditoria somente leitura, feita em 2026-10-21.
Base auditada: `origin/develop` = `d6b787c` (worktree somente leitura `scratchpad/develop-ro`).
PR aberta auditada: #112 (NOB-98), head `ebfbac3`, branch `origin/codex/NOB-98-feat/riscos-para-medicina`.
Nenhum arquivo do repositório foi alterado. Não criei migrations, não conectei em banco nenhum, não executei testes nem scripts do protótipo.

Convenções usadas no texto:

- `S` = schema (`src/shared/db/schema/`)
- `M` = migrations (`src/shared/db/migrations/`)
- `PROTO` = `Projeto-SST-Ocupacional/app/saude-ocupacional.html`
- `SPEC` = `Projeto-SST-Ocupacional/especificacao/Especificacao-da-Plataforma-SST.md`

---

## 1. Escopo analisado

1. Estado atual do banco na develop: numeração das migrations, journal, e as tabelas da cadeia de cadastro e de riscos, de Medicina, do GED e de assinatura. Também as mudanças do Rikelvin já mergeadas (#109, #110, #111, #113, #118).
2. PR #112 (NOB-98): migrations 0054/0055, o contrato de "fontes de riscos" e a classificação do contrato em quatro grupos.
3. Entidades do protótipo (23 coleções) e da especificação, mapeadas para o modelo atual.
4. Como o PGR gera e versiona documentos hoje (DOCX → Gotenberg → GED → worker), e uma proposta de emissão de ASO e PCMSO com snapshot imutável e assinatura técnica.
5. Propostas de migration, apenas descritas, com a ordem e a numeração.
6. Dados de referência (Lista C), com procedência e importador idempotente.
7. Impacto do CD que aplica migrations automaticamente.

## 2. Fontes consultadas

- Git na worktree: `git log`, `git show <sha>` (commits `0c8f9ff` NOB-97, `f5b8b85` NOB-99, `044334e` NOB-100, `5ee2cac` NOB-103, `d19ca85` NOB-102, `71ec980` e `92cee04` do Douglas, `77acd03` NOB-101), `git diff origin/develop...origin/codex/NOB-98-…` e `git merge-tree` (teste de conflito, sem tocar no working tree).
- `gh pr view 112`, `gh pr view 115`, `gh pr list --state open`, `gh run list --workflow cd.yml`.
- Linear, somente leitura: NOB-98, NOB-109 e NOB-130 (título, descrição e status).
- Protótipo: `PROTO` (leitura das linhas citadas abaixo), `LEIAME.txt` e `SPEC` (281 linhas).
- `node_modules/drizzle-orm/pg-core/dialect.js` do repositório local do usuário, só para ler a lógica do migrator. A versão `^0.45.2` é igual à do `package.json` da worktree.

## 3. Arquivos reais (lidos)

**Schema (S):**

- `companies.ts`, `company-modules.ts`, `module-policy.ts`
- `work-units.ts`, `ges.ts`, `ges-job-roles.ts`, `job-roles.ts`, `employees.ts`
- `risks.ts`, `ergonomics.ts`, `psychosocial.ts`
- `medicos.ts`, `health-exams.ts`
- `documents.ts`, `jobs.ts`, `signatures.ts`
- `pgr.ts`, `esocial.ts`, `caepi-certificates.ts`, `users.ts`

**Migrations (M):**

- `0002`, `0005`, `0009`, `0010`, `0012`, `0021`, `0025`, `0029`, `0030`, `0051`, `0053`
- `meta/_journal.json`

**Repositórios:**

- `company-modules.ts`, `pdf-batch.ts`
- `medical-risk-sources.ts` (só existe na PR)

**Núcleos (core):**

- `server/platform/pdf-batch-core.ts`, `server/platform/pgr-docx-core.ts`
- `server/medicine/risk-source-core.ts` (PR)

**Domínios:**

- `domains/platform/company-modules.ts`
- `domains/medicine/risk-sources.ts` (PR)
- `domains/documents/{pdf-batch,documents,validity}.ts`
- `domains/signatures/{contract,targets/pgr}.ts`

**Outros:**

- Storage: `integrations/storage/documents-storage.ts`
- Worker: `worker/index.ts`
- CI/CD: `.github/workflows/{cd,ci}.yml`, `docs/deploy/vercel.md`, `drizzle.config.ts`
- Docs: `docs/produto/08-fluxos-emissao-assinatura.md` (NOB-101), `.specs/20261020-nob-{102,103}/spec.md`
- Na PR: `.specs/20261020-nob-98/spec.md`, `docs/planning/nob-97-100-98-relatorio.md`

## 4. Evidências

### 4.1 Numeração e journal

- **Última migration da develop: `0053_company_module_access`**, idx 53, `when` 1792509152595 (`M/meta/_journal.json`). O `CLAUDE.md` da worktree ainda diz que a última é "0030_health_exams". Está desatualizado em 23 migrations.
- **`origin/main` está em `0052_platform_leads`** (`git ls-tree origin/main`). O último CD de main teve sucesso em 2026-10-15 (`094af88`). HIPÓTESE forte: a produção está em 0052 e a 0053 ainda não chegou lá.
- **Homologação (develop): o CD do merge #109 (`ca364d8`, 2026-10-20 17:39Z) terminou com `success`.** O passo "Aplica as migrations" vem antes do deploy (`cd.yml:67-75`), então a 0053 já foi aplicada no banco do projeto Vercel da develop. É uma inferência pelo resultado do run; não abri o log. Isso contradiz a frase do relatório do Rikelvin "Sem migration em banco real", que valia para o momento da PR, antes do merge.
- **`when` não monotônico no histórico:** `0026_user_is_master` tem `when` 1784600000000, maior que o da `0027` (1784448304145).
  - O migrator do drizzle-orm 0.45 aplica uma migration só se `last.created_at < folderMillis` (`pg-core/dialect.js:57-67`). Uma migration com `when` menor que o último aplicado é **pulada sem erro**.
  - Hoje isso não faz mal, porque os `when` depois da 0027 são todos maiores. Mas é um precedente: **todo `when` novo precisa ser maior que o maior `when` existente** (1792509152595 na develop, 1792515723005 se a #112 entrar).

### 4.2 Tabelas atuais da develop relevantes para Medicina e riscos

Isolamento padrão: policy PERMISSIVE `<t>_isolation` com `org_id = current_setting('app.current_org', true)` para `app_runtime`. GRANT padrão: SELECT/INSERT/UPDATE/DELETE. Trigger `set_updated_at` como SQL custom. Divergências aparecem marcadas na tabela.

| Tabela                                             | Colunas-chave                                                                                                                                                                                                        | FKs / ON DELETE                                                                                                                 | Constraints / índices                                                                                              | RLS extra                                                                                 | GRANT                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `companies` (S/companies.ts)                       | cnpj (opcional), razao_social NOT NULL, cnae, risk_grade, status enum `company_status`, tax_classification, endereço                                                                                                 | org → orgs CASCADE                                                                                                              | `uq_companies_id_org (id,org_id)` (0053, base das FKs compostas); `uq_companies_org_id_cnpj`; CHECK risk_grade 1–4 | —                                                                                         | SIUD                                                   |
| `company_modules` (0053)                           | module text CHECK `pgr\|medicine`, enabled bool default false                                                                                                                                                        | (company_id,org_id) → companies CASCADE (FK composta)                                                                           | UNIQUE(org,company,module)                                                                                         | isolation                                                                                 | **S/I/U, sem DELETE**                                  |
| `company_module_events` (0053)                     | previous_enabled, enabled, changed_by text, reason NOT NULL                                                                                                                                                          | composta → companies CASCADE                                                                                                    | idx (org,company)                                                                                                  | isolation                                                                                 | **S/I (append-only)**                                  |
| `work_units`                                       | name, description NOT NULL, type enum, status enum, datas, profissional (texto)                                                                                                                                      | org CASCADE; company CASCADE (FK simples)                                                                                       | idx org, company                                                                                                   | —                                                                                         | SIUD                                                   |
| `ges`                                              | name, process/ambiente                                                                                                                                                                                               | org/company/work_unit CASCADE (FKs simples)                                                                                     | idx                                                                                                                | —                                                                                         | SIUD                                                   |
| `ges_job_roles`                                    | worker_count > 0, work_schedule                                                                                                                                                                                      | ges CASCADE, job_role CASCADE                                                                                                   | UNIQUE(org,ges,job_role)                                                                                           | —                                                                                         | SIUD                                                   |
| `job_roles`                                        | title, cbo, sector, is_active                                                                                                                                                                                        | company CASCADE                                                                                                                 | UNIQUE(org,company,title)                                                                                          | —                                                                                         | SIUD                                                   |
| `employees`                                        | full_name, **cpf NOT NULL**, birth_date, sex, blood_type, admission/dismissal, status                                                                                                                                | company CASCADE; ges/job_role **SET NULL** (FKs simples, sem garantia de mesma empresa no banco; a NOB-102 valida na aplicação) | **UNIQUE(org_id, cpf)**                                                                                            | —                                                                                         | SIUD                                                   |
| `risks` (S/risks.ts:117)                           | agent_type enum (7), hazard, description NOT NULL, sources, propagation, exposure_time enum, possible_injuries, noxious_agent_code (texto livre), measurement_unit enum, concentration_intensity                     | **ges CASCADE** (risco por GES, nunca por função ou trabalhador)                                                                | idx org, ges                                                                                                       | — (a #112 adiciona restritiva)                                                            | SIUD                                                   |
| `risk_assessments`                                 | criterion, probability/severity 1–5, risk_level = p×s (CHECK), uncertainty 0–2, campos NR-09 (measured_value/unit, tolerance_limit_value, nr09_conclusion), assessed_at                                              | risk CASCADE                                                                                                                    | 5 CHECKs de coerência                                                                                              | —                                                                                         | SIUD                                                   |
| `control_measures`                                 | control_level enum (4), applicable, status enum, 5W2H                                                                                                                                                                | risk CASCADE                                                                                                                    | UNIQUE(org,risk,level)                                                                                             | —                                                                                         | SIUD                                                   |
| `ergonomic_evaluations` (0051)                     | 6 dimensões enum adequate/inadequate/not_applicable, method, **responsible texto digitado**, assessed_at, psychosocial_campaign_id                                                                                   | risk CASCADE; campanha SET NULL                                                                                                 | idx (org,risk,assessed_at)                                                                                         | —                                                                                         | SIUD                                                   |
| `psychosocial_*` (0021, 0046)                      | campanhas (status draft/active/closed/archived, public_token), respostas anônimas por token, `psychosocial_risks` (riskId SET NULL), `psychosocial_risk_factors` (por GES, level low/medium/high, number sequencial) | ges/campanha CASCADE                                                                                                            | uq token                                                                                                           | `psychosocial_campaigns_token_read` (capability)                                          | SIUD                                                   |
| `pgr`                                              | responsible texto, registration_type enum crm/crea/mte/n.a., issued_at, valid_until, published_at, created_by texto                                                                                                  | company CASCADE; work_unit SET NULL                                                                                             | —                                                                                                                  | **`pgr_module_access` RESTRICTIVE (módulo pgr)**, desde a 0053                            | SIUD                                                   |
| `pgr_ges`, `pgr_revisions`                         | revision_number, revised_at, notes, archived_at                                                                                                                                                                      | pgr CASCADE                                                                                                                     | UNIQUE(org,pgr,number)                                                                                             | RESTRICTIVE herda de `pgr` (0053)                                                         | SIUD                                                   |
| `medicos` (0029)                                   | name, **crm texto (sem UF)**, specialty, clinic texto, phone, status                                                                                                                                                 | org CASCADE                                                                                                                     | **UNIQUE(org_id, crm)**                                                                                            | —                                                                                         | SIUD                                                   |
| `health_exams` (0030)                              | exam_type enum (admissional, periodic, change_of_function, return_to_work, dismissal), performed_at, valid_until, aptitude enum (fit, fit_with_restrictions, unfit), **notes texto livre**, certificate_path texto   | employee **CASCADE**; doctor **SET NULL**                                                                                       | idx org, employee, doctor                                                                                          | **`health_exams_module_access` RESTRICTIVE** via `employees.company_id` + medicine (0053) | SIUD                                                   |
| `folders` / `documents` (0025)                     | documents: document_group_id, version ≥ 1, status `generating\|ready`, storage_path, size_bytes, valid_until, related_entity_type/id (polimórfico, CHECK completo-ou-vazio), doc_type texto livre                    | folders RESTRICT; org CASCADE                                                                                                   | UNIQUE(org, group, version); índice parcial do vínculo                                                             | **sem company_id, sem policy de módulo**                                                  | **SIUD (DELETE permitido)**                            |
| `jobs` (0025)                                      | job_type enum `pdf_batch`, status enum, payload jsonb, attempts, locked_at                                                                                                                                           | org CASCADE                                                                                                                     | idx (status, created_at)                                                                                           | —                                                                                         | SIUD                                                   |
| `signature_requests` / `signature_captures` (0010) | requests: target_type texto, target_id, token_hash UNIQUE, payload jsonb, status pending/signed/cancelled, expires_at, used_at. captures: image_data (PNG base64), signer_name, method qr/link/manual, signed_at     | captures → request CASCADE, UNIQUE 1:1                                                                                          | —                                                                                                                  | `signature_requests_token_capability` (SELECT por `app.signature_token`)                  | SIUD                                                   |
| `esocial_events` (0022/0047)                       | event_type enum inclui **S-2220**, reference_id polimórfico, payload XML texto                                                                                                                                       | batch SET NULL                                                                                                                  | —                                                                                                                  | sem policy de módulo                                                                      | (padrão)                                               |
| `caepi_certificates` (0009)                        | tabela GLOBAL, sem org_id; PK `ca`; synced_at                                                                                                                                                                        | —                                                                                                                               | —                                                                                                                  | `global_read USING (true)` (por causa do event trigger `ensure_rls` em produção)          | **somente SELECT** para app_runtime; escrita via owner |
| `users`                                            | id (Clerk), cpf, job_title, is_master                                                                                                                                                                                | —                                                                                                                               | —                                                                                                                  | `users_select_self` (authenticated)                                                       | —                                                      |

Observações estruturais que pesam para Medicina:

- **O risco é vinculado ao GES, não à função.** A função só se liga ao GES por `ges_job_roles`. O protótipo modela riscos **por função** (`empresas.funcoes[].riscos[]`, PROTO:2644-2648). O mapeamento é N:N e não é trivial.
- **Não há histórico de risco.** Só existe `updated_at`, e `risk_assessments` é 1:N datado.
- **`pgr_revisions` não congela conteúdo.** O NOB-101 confirma: "Revisão não contém snapshot integral" (`docs/produto/08…:18-19`).
- **`medicos`:**
  - não tem UF do CRM, nem RQE, nem vínculo com `users`;
  - o UNIQUE(org, crm) colide quando há o mesmo número de CRM em UFs diferentes;
  - o protótipo guarda `crm`+`uf`+`rqe` (PROTO:2685).
- **Retenção.** Apagar a empresa tem efeito CASCADE em `employees`, e daí em `health_exams`. Apagar o funcionário apaga o histórico de exames. Apagar o médico zera a autoria com SET NULL. Isso conflita com a guarda de 20 anos citada na SPEC:51. HIPÓTESE normativa, a confirmar com o Dr. Alcides.
- **Auditoria só em console.** `logTenantEvent` escreve no console; não há trilha persistida (NOB-101 §4). A SPEC:215 pede registro imutável de leitura e alteração de dados clínicos.
- **`employees.UNIQUE(org_id, cpf)`** impede que a mesma pessoa conste em duas empresas-clientes do mesmo escritório. Relevante para consultorias. Decisão pendente.

### 4.3 O que o Rikelvin entregou na develop

| PR / commit            | Banco                                                                                                                                                                                                                                                                                                                                         | Aplicação                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #109 NOB-97 `0c8f9ff`  | **0053**: `uq_companies_id_org`; `company_modules` e `company_module_events`; policies RESTRICTIVE `pgr_module_access`, `pgr_ges_module_access`, `pgr_revisions_module_access` e `health_exams_module_access`; backfill com **as duas habilitações = true para todas as empresas existentes**, mais um evento `migration:0053` (M/0053:43-48) | `assertCompanyModuleTx` (repositórios de PGR e exames); empresas novas começam **sem módulos** (`domains/platform/company-modules.ts:22`)                                                                                      |
| #110 NOB-99 `f5b8b85`  | nenhuma migration                                                                                                                                                                                                                                                                                                                             | filtro `module` em empresas e funcionários (Action e REST); mesmos IDs nos dois módulos                                                                                                                                        |
| #111 NOB-100 `044334e` | nenhuma migration                                                                                                                                                                                                                                                                                                                             | `setCompanyModule` com lock da empresa e evento append-only; UI `/companies/[id]/services`; `GET/PUT /api/v1/companies/[id]/modules`                                                                                           |
| #113 NOB-103 `5ee2cac` | nenhuma migration                                                                                                                                                                                                                                                                                                                             | escrita de risco valida empresa/obra contra o GES e exige o módulo **pgr** na aplicação (`repositories/risks.ts`, `assertGesInTenant`). A spec diz: "Esta PR não afirma que todo o inventário já tem restrição SQL por módulo" |
| #118 NOB-102 `d19ca85` | nenhuma migration                                                                                                                                                                                                                                                                                                                             | CNPJ alfanumérico (DV), mensagem de duplicidade, validação de referências de funcionário. CPF não foi alterado                                                                                                                 |

### 4.4 PR #112 (NOB-98): o que propõe no banco

Situação da PR:

- Base: `codex/NOB-100-feat/servicos-por-empresa`, não develop. O merge-base `044334e` já está na develop.
- Estado: OPEN e não-draft (`isDraft:false`), embora o corpo diga "em rascunho". `reviews: []`, `comments: []`.
- `git merge-tree` contra a develop: **único conflito textual em `docs/api/sst-manager.postman_collection.json`**. Migrations e schema mesclam sem conflito.

**Numeração:**

- A PR adiciona `0054_medical_risk_sources` (`when` 1792513283573) e `0055_pgr_inventory_module_access` (`when` 1792515723005).
- A develop termina em 0053 e não há migration em nenhuma outra PR aberta (#115, #116 e #117 conferidas com `git diff --stat`).
- **Hoje não há colisão.** Colide assim que qualquer outra migration for mergeada antes da #112.
- Os snapshots `meta/0054_snapshot.json` e `meta/0055_snapshot.json` encadeiam a partir do snapshot da 0053. Regerar exige `drizzle-kit generate` depois do rebase; não dá para renomear à mão.

**0054: três tabelas novas, todas com RLS e FKs compostas:**

- `medical_risk_sources`:
  - colunas: id, org_id, company_id, `kind` CHECK `internal|external`, title, version (texto), reference (texto), origin_pgr_id (**sem FK**, preserva a procedência), origin_revision int, `fingerprint` (sha256 do JSON canônico), supersedes_source_id, registered_by (texto, userId), registered_at;
  - UNIQUE (id,org,company) (alvo das FKs), UNIQUE (org,company,fingerprint), UNIQUE (org,company,supersedes_source_id) para impedir dois sucessores;
  - CHECKs: sem auto-sucessão; origem coerente (internal exige origin_pgr_id; external exige nulo);
  - FK (company_id,org_id) → companies **CASCADE**; FK auto-referente de supersedes **NO ACTION**.
- `medical_risk_entries`:
  - colunas: content jsonb (CHECK objeto), status texto CHECK `pending|validated|rejected` default pending, reviewed_by texto, reviewed_at, review_note;
  - CHECK de coerência revisor/estado;
  - FK composta → sources CASCADE.
- `medical_risk_events`: actor, event, created_at. FK composta → sources CASCADE.
- Policies:
  - `*_isolation` PERMISSIVE;
  - `*_module_access` RESTRICTIVE (módulo **medicine** habilitado);
  - `medical_risk_entries_pending_insert` RESTRICTIVE FOR INSERT (só aceita pending sem revisor).
- GRANT: `GRANT SELECT, INSERT … ; REVOKE UPDATE, DELETE` nas três tabelas.

**0055:** policies RESTRICTIVE `risks_module_access`, que exige um GES do mesmo org com a empresa de módulo `pgr` habilitado. Também `risk_assessments_module_access`, `control_measures_module_access`, `ergonomic_evaluations_module_access` e `epi_risk_module_access`, que exigem um `risks` visível.

**Efeito da 0055:** empresa só-Medicina, ou com PGR desligado, **deixa de ver** risco, avaliação, medida, AEP e vínculo EPI pelo runtime. Isso inclui o próprio snapshot interno (`getInternalMedicalSources` lê `risks`) e qualquer leitura futura de risco feita pelo módulo de Medicina. Medicina passa a depender exclusivamente de `medical_risk_*` para empresas sem PGR. É coerente com o desenho, mas é uma decisão de produto e precisa ser explícita.

### 4.5 Contrato de "fontes de riscos": achados de código na PR

- **Captura interna** (`repositories/medical-risk-sources.ts:34-63`, PR):
  - uma única consulta SQL agrega, por PGR, os riscos dos GES vinculados (`pgr_ges`) com `originRiskId`, `originGesId`, `exposureGroup` = **nome** do GES, agentType, description, possibleInjuries e `originalData` = `to_jsonb(risk)` mais a avaliação mais recente;
  - **não captura**: função (`job_roles`/`ges_job_roles`), número de expostos, medidas de controle, EPIs, nem metodologia de risco vigente;
  - o fingerprint inclui `updatedAt` do PGR, então qualquer edição do cabeçalho do PGR marca a fonte como `changed` mesmo sem mudança de risco.
- **Fonte externa** (`domains/medicine/risk-sources.ts:12-23`):
  - campos: `{agentType, description, exposureGroup, jobRole?, possibleInjuries?, exposureDescription?}`, até 500 itens;
  - **sem classificação, nível, avaliação, medidas, profissional responsável pelo PGR externo ou data de emissão do documento externo**;
  - `reference` é texto livre; o "arquivo no GED" não tem FK.
- **Versão:** texto livre. Na interna é "Revisão N" (máximo de `pgr_revisions`), mas a revisão não congela o PGR. O que de fato congela é o snapshot em `content` mais o fingerprint.
- **Validação técnica: não há fluxo.**
  - `validationAvailable: false` (`risk-source-core.ts:131`);
  - o banco **impede UPDATE** em `medical_risk_entries` (REVOKE), então aprovar exige migration nova: GRANT UPDATE por coluna e trigger, ou uma tabela de revisões append-only;
  - `reviewed_by` é texto, sem FK para `medicos`/`users`;
  - a pendência declarada (spec NOB-98, "Decisão técnica ainda pendente"): quem concede autorização e como identificar o profissional.
- **Uso no PCMSO:** `canUseMedicalRisk` exige `validated` e frescor `current|external_reference`. Como nada chega a `validated`, **nenhum risco é utilizável pelo PCMSO enquanto o fluxo de revisão não existir**.
- **Exclusão:** apagar a empresa apaga as fontes e o histórico (CASCADE).

### 4.6 Documentos: como o PGR é gerado e versionado hoje

```
Action enqueuePgrPdf (repositories/pdf-batch.ts:55-107)
  withOrg: lock do pgr → acha grupo atual (doc_type 'PGR', related 'pgr') → documents{status:'generating', version:N+1,
           mesmo document_group_id, storage_path determinístico} + jobs{pdf_batch, payload{documentId,kind:'pgr',pgrId,format}}
worker/index.ts (conexão owner): recoverStale → claimNextJob (FOR UPDATE SKIP LOCKED) → processPdfBatchJob
  pdf-batch-core.ts:34  generatePgrDocx(job.orgId, pgrId)   ← LÊ DADOS VIVOS NO MOMENTO DO PROCESSAMENTO
     pgr-docx-core.ts: getPgrConsolidated + extras + metodologia → docxtemplater (templates/pgr/pgr-template.docx)
                       → PDF via Gotenberg (padrão) ou Google (PGR_DOCX_PDF_PROVIDER)
  putGeneratedDocument: upload {org}/documentos/generated/{documentId}.{fmt} com upsert:true
  UPDATE documents SET status='ready', size_bytes
  falha > MAX_ATTEMPTS → apaga a linha 'generating'
```

Fatos que importam para ASO e PCMSO:

1. **Só o binário de saída é versionado.** Os dados de entrada não. Um retry relê dados vivos, e o PDF da versão N pode refletir dados alterados entre o enfileiramento e o processamento.
2. `documents` não tem hash do arquivo, autor, estado de emissão (só `generating|ready`), `company_id` nem policy de módulo. O runtime tem **UPDATE e DELETE** (M/0025:70). Um ASO salvo no GED fica visível para todo o escritório com acesso ao GED, mesmo com Medicina desligada.
3. Na PR #115 (NOB-105, draft) existem SHA-256 do template, dos dados serializados e dos bytes gerados, mas **só em headers HTTP** da rota `/api/v1/pgr/[id]/docx`. Nada disso é persistido; a própria PR diz "não promete snapshot transacional ou assinatura".
4. O registry de assinatura tem `demo`, `inspection`, `pgr` e `service_order` (`domains/signatures/contract.ts:13-18`). **Não existe `aso`/`health_exam`/`pcmso`.**
5. O que a assinatura genérica oferece:
   - token ≥ 256 bits guardado como hash, uso único e TTL;
   - payload mínimo congelado na criação;
   - captura de nome digitado, mais imagem PNG, mais método e data.
6. O que ela **não** oferece:
   - vínculo com o hash do arquivo emitido (NOB-101 §4: "Sem vínculo criptográfico com arquivo");
   - verificação de identidade do signatário (CPF/CRM);
   - IP e user agent (não encontrei no schema);
   - certificado ICP-Brasil, carimbo de tempo, PAdES.

   A SPEC:156, 158 e 195 exige ICP-Brasil para ASO e PCMSO. **Imprimir o nome do médico, ou capturar um rabisco, não equivale a assinatura técnica.**

### 4.7 Protótipo: coleções e evidências

- `COLS` (PROTO:314): empresas, funcionarios, asos, afastamentos, tabelas, campanhas, respostas, entrevistas, indicadores, riscospsi, clinicas, encaminhamentos, assinaturas, equipe, config, solicitacoes, validacoes, pedidos, programa, consultas, auditorias, prontuario, fadiga.
- Estruturas: seed em `carregarExemplo` (PROTO:2642-2711).
- **ASO com snapshot parcial** (`snapASO`, PROTO:825-828): congela empresa, CNAE/GR, função/setor, riscos `{tipo, agente}`, psicossociais e médico do PCMSO. **Mas** `docASO` lê **ao vivo** o nome, o CPF e o nascimento do trabalhador (PROTO:831, 838).
- **PCMSO gerado ao vivo** (`docPCMSO`, PROTO:869), sem versão.
- **Validação técnica do protótipo** (`barraValidacao`, PROTO:1457-1468; ação `val`, PROTO:2379-2381):
  - um registro por empresa e tipo (`valId = empresa_tipo`, PROTO:1452), sem versão;
  - estados `rascunho|revisao|aprovado|ajustes`;
  - o ADMIN do provedor clica em **"Aprovar como <médico>"** (PROTO:1465). É aprovação em nome de terceiro e **não deve ser reproduzida**.
- **Armadilha de nome:** a coleção `assinaturas` do protótipo é **contrato e cobrança** (plano, pagamentos, médico e psicólogo designados; PROTO:2687-2689), não assinatura de documento.
- **Lista C do protótipo é PARCIAL**, A15–K46 (comentário em PROTO:182). Não pode ser tratada como base oficial.

## 5. Funcionalidades existentes (relevantes)

| Capacidade                                                                        | Estado na develop                                            | Evidência                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| Habilitação por empresa (pgr/medicine) com histórico append-only e RLS restritiva | implementado                                                 | 0053; `company-modules.ts`     |
| Cadastros comuns (empresa, funcionário, GES, função) entre os módulos             | implementado                                                 | NOB-99                         |
| Inventário de riscos por GES + avaliação 5×5 + NR-09 + medidas + AEP              | implementado (escrita exige PGR habilitado na aplicação)     | `risks.ts`; NOB-103            |
| Médicos (catálogo por escritório)                                                 | implementado, identidade incompleta                          | `medicos.ts`                   |
| Exames/ASO como **registro** (não emissão) com validade derivada                  | implementado; RLS de módulo medicine                         | `health-exams.ts`; 0053        |
| GED com versão por `document_group_id` + fila `jobs` + worker                     | implementado para o PGR                                      | 0025; `pdf-batch.ts`; worker   |
| Template DOCX → PDF (Gotenberg/Google)                                            | implementado só para o PGR                                   | `pgr-docx-core.ts`             |
| Assinatura por link/QR/manual (captura simples)                                   | implementado; consumidores demo/inspection/pgr/service_order | 0010; `contract.ts`            |
| Fontes de risco para Medicina (interna/externa, imutáveis, pendentes)             | **só na PR #112**                                            | 0054 da PR                     |
| PCMSO, emissão de ASO, assinatura técnica, Lista C, histórico de função           | **inexistente**                                              | NOB-101 §2-§3; busca no schema |

## 6. Lacunas

1. **Identidade profissional.** O médico não tem vínculo com usuário, não tem UF de CRM nem RQE, e não existe papel técnico. Isso bloqueia a revisão da NOB-98, o PCMSO e a assinatura.
2. **Fluxo de revisão de riscos.** As colunas existem, mas o banco nega UPDATE e não há transição auditada.
3. **Contrato de riscos incompleto:**
   - função não capturada na fonte interna;
   - fonte externa sem classificação;
   - sem medidas e EPIs;
   - "versão" interna sem congelamento real do PGR (só o snapshot da entry congela).
4. **PCMSO** não existe: programa, versão, plano de exames por função/GES e periodicidade, coordenador, vigência.
5. **Catálogo de procedimentos e exames complementares** inexistente. `health_exams` não lista os procedimentos realizados.
6. **Emissão de documentos com snapshot de entrada:** o GED versiona só a saída e não tem hash, estado de emissão, `company_id` nem restrição de módulo.
7. **Assinatura técnica:** sem hash do documento, sem evidências e sem ICP-Brasil.
8. **Histórico de função do trabalhador**, necessário para exame de mudança de risco e para PPP. O protótipo tem `historico` (PROTO:2652).
9. **Trilha de auditoria persistida** para dados clínicos.
10. **Dados de referência:** Lista C, NR-4 (CNAE→grau) e tabelas eSocial (24, 27) não existem. `noxious_agent_code` é texto livre. `caepi_certificates` não registra procedência (versão, hash).
11. **Retenção:** CASCADE e SET NULL destroem histórico clínico e autoria.
12. **Dados sensíveis sem segregação por coluna:** `health_exams.notes` (texto livre clínico), `employees.blood_type` e o payload XML de S-2220 em `esocial_events` não têm policy de módulo.

## 7. Riscos

| #   | Risco                                                                                                                                                                                      | Severidade                 | Evidência                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------- |
| R1  | Colisão de numeração: qualquer migration mergeada antes da #112 obriga a regerar 0054/0055 e seus snapshots                                                                                | Alta                       | journal; PR #112                               |
| R2  | Merge na develop **aplica a migration automaticamente** no banco de homologação; merge em main, na produção. Não existe "down" no drizzle-kit, então rollback = nova migration para frente | Alta                       | `cd.yml:67-75`; `vercel.md:20-26`              |
| R3  | O drizzle aplica as pendentes **numa só transação**. Um `ALTER TYPE … ADD VALUE` seguido do uso do valor no mesmo lote falha. Preferir `text` + CHECK em estados novos, como a #112 fez    | Média                      | `vercel.md:26`; comentário em `risks.ts:55-56` |
| R4  | `when` menor que o último aplicado é pulado silenciosamente                                                                                                                                | Média                      | `dialect.js:62`; caso 0026/0027                |
| R5  | A 0055 esconde todo o inventário de empresas sem PGR. Leituras de Medicina que dependam de `risks` quebram sem erro (retornam vazio)                                                       | Média                      | M 0055 da PR                                   |
| R6  | ASO/PCMSO gerado pelo pipeline atual refletiria dados vivos, e não os do momento da emissão                                                                                                | Alta                       | `pdf-batch-core.ts:34`                         |
| R7  | ASO no GED fica visível a todo o escritório (sem módulo nem papel) e pode ser apagado/editado pelo runtime                                                                                 | Alta                       | `documents.ts`; M/0025:70                      |
| R8  | "Assinatura" atual (nome + PNG) apresentada como assinatura técnica de médico                                                                                                              | Alta (jurídico)            | `signatures.ts`; SPEC:195                      |
| R9  | Exclusão em cascata apaga exames e fontes antes do prazo de guarda                                                                                                                         | Alta (normativo, HIPÓTESE) | FKs CASCADE; SPEC:51                           |
| R10 | Copiar a Lista C parcial do protótipo como se fosse oficial                                                                                                                                | Média                      | PROTO:182                                      |
| R11 | A SPEC recomenda **banco por cliente** (SPEC:30-43); o código é **banco compartilhado + RLS**. Divergência arquitetural não resolvida                                                      | Média (estratégico)        | SPEC; `with-org.ts`                            |

## 8. Dependências

- **NOB-98 (#112)** depende da 0053, já na develop. A revisão de riscos depende da decisão sobre autorização e identidade do profissional (Expedito, Dr. Alcides, Rikelvin).
- **NOB-109 (PCMSO)** depende da NOB-98 (riscos validados), da NOB-101 (fluxo de emissão e assinatura), da Lista C (tarefa 21) e do catálogo de exames.
- **Emissão de ASO** depende da identidade do médico, do catálogo de procedimentos, idealmente da versão de PCMSO vigente (riscos e exames da função) e da camada de emissão com snapshot.
- **Camada de emissão genérica** depende do Douglas (dono do GED, do worker e do template).
- **Assinatura técnica** depende da escolha do provedor ICP-Brasil (decisão em aberto, SPEC:257).

## 9. Decisões pendentes

| Decisão                                                                                                                                    | Para quem                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Quem autoriza a validação de risco e de PCMSO; como o profissional se vincula ao usuário Clerk; se owner/colaborador podem ou não          | **Dr. Alcides + Expedito** (regra); **Rikelvin** (modelo) |
| Revisão de risco: GRANT UPDATE por coluna nas entries da #112 **ou** tabela append-only de revisões                                        | **Rikelvin** + Carlos                                     |
| Ordem de merge: #112 antes de qualquer migration de Medicina? Regerar 0054/0055 se não for assim                                           | **Douglas** (TL) + Rikelvin                               |
| Aceitar o efeito da 0055 (Medicina sem PGR não lê `risks`)                                                                                 | **Expedito** + Douglas                                    |
| Camada de emissão genérica (PGR/ASO/PCMSO) vs. tabelas específicas de Medicina; adicionar `company_id` e hash em `documents`               | **Douglas**                                               |
| Estados de documento: rascunho → em revisão → emitido → assinado; retificado/cancelado                                                     | **Dr. Alcides** (clínico/normativo) + Expedito            |
| O que entra no snapshot do ASO (CPF? nascimento? riscos com nível? procedimentos com data?) e o que a empresa vê (só a conclusão, SPEC:61) | **Dr. Alcides**                                           |
| Provedor de assinatura ICP-Brasil e modalidade (nuvem/A3)                                                                                  | **Expedito** + Douglas                                    |
| Política de retenção vs. CASCADE (soft-delete? bloqueio de exclusão com histórico clínico?)                                                | **Dr. Alcides** (prazo) + Douglas (modelo)                |
| Fonte e versão oficiais da Lista C, NR-4 e eSocial; quem valida códigos ausentes                                                           | **Dr. Alcides** + Carlos                                  |
| `UNIQUE(org, cpf)` em employees vs. trabalhador em várias empresas do mesmo escritório                                                     | **Expedito** + Rikelvin                                   |
| Banco por cliente (SPEC) vs. RLS compartilhado (atual)                                                                                     | **Douglas** + Expedito                                    |

## 10. Recomendações

### 10.1 Classificação do contrato de riscos e validação da lista-hipótese

| Campo da hipótese        | JÁ IMPLEMENTADO (develop)                                              | EM DESENVOLVIMENTO (PR #112)                                                | PENDENTE DE RESPOSTA                                      | PROPOSTO PARA APROVAÇÃO                                                       |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Empresa                  | via `risks.ges_id → ges.company_id`                                    | `medical_risk_sources.company_id` + FK composta                             | —                                                         | —                                                                             |
| Função                   | só `ges_job_roles` (GES↔função); risco **não** se liga à função        | `jobRole?` texto só na fonte externa; interna **não captura**               | regra: risco por função ou por GES no PCMSO (Dr. Alcides) | capturar `ges_job_roles` (função, CBO, expostos) no snapshot interno          |
| Trabalhador              | `employees.ges_id/job_role_id` (nullable)                              | excluído de propósito (sem dados pessoais)                                  | —                                                         | derivar na emissão do ASO via histórico de função; não guardar na fonte       |
| GES                      | `risks.ges_id`                                                         | `exposureGroup` (nome) + `originGesId` (interna)                            | —                                                         | guardar `originGesId` também na externa quando houver correspondência manual  |
| Risco                    | `risks` (agente, descrição, fontes, exposição, lesões, código eSocial) | `content` jsonb (subconjunto) + `originalData` (interna)                    | —                                                         | —                                                                             |
| Classificação            | `risk_assessments` (P×S, nível, NR-09)                                 | só dentro de `originalData.assessment` (interna); **externa sem campo**     | escala e obrigatoriedade (NOB-103 "pendente")             | campo opcional de classificação/nível na externa                              |
| Origem                   | —                                                                      | `kind` internal/external + `reference` + `origin_pgr_id`                    | —                                                         | FK opcional `reference_document_id → documents` para o PDF externo arquivado  |
| Versão                   | `pgr_revisions` (sem congelar)                                         | `version` texto + `fingerprint` + snapshot imutável                         | —                                                         | fingerprint sem `pgr.updated_at` (só dados de risco)                          |
| Estado de validação      | —                                                                      | `status` pending/validated/rejected; INSERT só pending; **sem UPDATE**      | quem pode validar                                         | tabela append-only `medical_risk_entry_reviews`                               |
| Profissional responsável | `pgr.responsible` texto; AEP `responsible` texto                       | `reviewed_by` texto, sem FK                                                 | identidade e autorização (bloqueante)                     | FK para `medicos` + vínculo `medicos.user_id`                                 |
| Data de revisão          | `risk_assessments.assessed_at`, `pgr_revisions.revised_at`             | `reviewed_at` (nunca preenchido)                                            | —                                                         | —                                                                             |
| Alterações posteriores   | só `updated_at`                                                        | `freshness` current/changed/unavailable/superseded + `supersedes_source_id` | o que fazer com PCMSO emitido sobre fonte que mudou       | evento automático "fonte desatualizada" ligado às versões de PCMSO que a usam |
| Fonte interna/externa    | —                                                                      | `kind`                                                                      | —                                                         | —                                                                             |

**Conclusão:** a PR #112 cobre bem origem, versão, imutabilidade e detecção de mudança. **Não cobre** função, classificação na externa nem o fluxo de validação. Sem o fluxo de validação, nada fica utilizável pelo PCMSO (`canUseMedicalRisk`).

### 10.2 Mapeamento das entidades do protótipo

| Coleção / estrutura do protótipo                                                                   | Destino                                                                                                               | Observação                                                                               |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `empresas` (razao, cnpj, cnae, grau, endereço)                                                     | **reaproveitar** `companies`                                                                                          | —                                                                                        |
| `empresas.medico/crm`                                                                              | **entidade nova** `company_medical_assignments`                                                                       | coordenador do PCMSO com vigência                                                        |
| `empresas.vigencia`                                                                                | **entidade nova** `pcmso_programs`                                                                                    | —                                                                                        |
| `empresas.respPGR`                                                                                 | `pgr.responsible` (existe)                                                                                            | —                                                                                        |
| `empresas.rat/fap/rotatividade/raNit/rlNit`                                                        | fora do MVP                                                                                                           | PPP / FAP                                                                                |
| `empresas.psi`                                                                                     | psicossocial existente                                                                                                | —                                                                                        |
| `empresas.funcoes[]` (nome, setor, cbo, atividades)                                                | **reaproveitar** `job_roles` (title, sector, cbo, description)                                                        | —                                                                                        |
| `funcoes[].periodicidade/exames[]`                                                                 | **entidade nova** (itens do plano de exames na versão do PCMSO)                                                       | —                                                                                        |
| `funcoes[].grauExp/fadiga`                                                                         | fora do MVP                                                                                                           | —                                                                                        |
| `funcoes[].riscos[]` (tipo, agente, codigo24, intensidade, tecnica, epc/epi/ca)                    | **reaproveitar** `risks` + `risk_assessments` + `control_measures`/`epi_risk`                                         | mudança de chave: **função → GES**                                                       |
| `funcionarios` (nome, cpf, sexo, nascimento, admissão/demissão, ativo)                             | **reaproveitar** `employees`                                                                                          | —                                                                                        |
| `funcionarios.nit/ctps`                                                                            | **extensão** de `employees` (NIT para S-2220/PPP)                                                                     | —                                                                                        |
| `funcionarios.salario`                                                                             | fora do MVP                                                                                                           | dado sensível sem uso clínico                                                            |
| `funcionarios.historico[]`                                                                         | **entidade nova** `employee_job_assignments`                                                                          | —                                                                                        |
| `asos` (tipo, data, resultado, medico/crm, exames[], obs)                                          | **reaproveitar** `health_exams` (registro) + **entidade nova** `health_exam_procedures` + **emissão nova** (snapshot) | `medico/crm` texto → `doctor_id`                                                         |
| `asos.snap`                                                                                        | **entidade nova** (snapshot de emissão)                                                                               | fazer completo, não parcial como no protótipo                                            |
| `asos.encId/clinica`                                                                               | fora do MVP (fase 2)                                                                                                  | —                                                                                        |
| `afastamentos` (CID, natureza, espécie B31/B91, kit INSS)                                          | fora do MVP de ASO/PCMSO                                                                                              | dispara o exame de retorno; CID é dado sensível; `accidents` (Fase 06) cobre só acidente |
| `tabelas` (listaC, nr4)                                                                            | **referência global nova**                                                                                            | ver §10.5                                                                                |
| `campanhas`/`respostas`/`riscospsi`                                                                | **reaproveitar** `psychosocial_*`                                                                                     | P×S por GHE no protótipo vs. nível por GES na plataforma                                 |
| `entrevistas`                                                                                      | fora do MVP                                                                                                           | —                                                                                        |
| `indicadores`                                                                                      | fora do MVP                                                                                                           | —                                                                                        |
| `clinicas` (+ médicos examinadores, preços)                                                        | fora do MVP (fase 2, portal da clínica)                                                                               | examinador → `medicos` (`clinic` texto)                                                  |
| `encaminhamentos` (guia, sinais vitais, audiometria, espirometria)                                 | fora do MVP (fase 2)                                                                                                  | resultados clínicos de alta sensibilidade                                                |
| `assinaturas`                                                                                      | **não é assinatura de documento**                                                                                     | billing/planos; módulos já em `company_modules`                                          |
| `equipe` (médico/psicólogo, registro, UF, RQE)                                                     | **extensão** de `medicos` (crm_uf, rqe, user_id)                                                                      | psicólogo: decidir se `medicos` vira `health_professionals`                              |
| `validacoes` (pcmso/psicossocial; rascunho/revisao/aprovado/ajustes)                               | **entidade nova**: status na versão do PCMSO + eventos de revisão                                                     | identidade real, sem "aprovar como"                                                      |
| `config`, `solicitacoes`, `pedidos`, `programa`, `consultas`, `auditorias`, `prontuario`, `fadiga` | fora do MVP                                                                                                           | `prontuario`/`programa`: sensíveis, exigem consentimento (SPEC:182)                      |

### 10.3 Emissão de ASO e PCMSO reaproveitando a infraestrutura atual (proposta)

**Princípio:** separar **dado-fonte vivo** de **documento emitido**. O documento emitido é derivado de um **snapshot de entrada imutável**, gravado **na mesma transação** que cria a emissão. O worker passa a renderizar **a partir do snapshot**, nunca de dados vivos.

```
emitir(ASO|PCMSO) [withOrg, lock do alvo]
  1. monta snapshot jsonb (empresa, trabalhador mínimo, função/GES, riscos com source_id+entry_id+fingerprint+versão,
     exames/procedimentos com datas, aptidão, examinador e coordenador com CRM/UF, template_id+sha)
  2. snapshot_sha256 = sha256(JSON canônico)  (mesma canonicalização da #112)
  3. INSERT document_issuances{status:'draft'|'in_review', snapshot, snapshot_sha256, supersedes_id?}
  4. INSERT documents{generating, group = grupo do alvo, version N+1, company_id} + jobs{pdf_batch, payload{kind:'aso'|'pcmso', issuanceId}}
worker: renderiza DO SNAPSHOT (template DOCX próprio de ASO/PCMSO → Gotenberg) → upload com upsert:false (path imutável)
        → UPDATE issuance.output_sha256, documents.ready
assinar: pedido com document_sha256 = output_sha256; evidência técnica (ICP) em tabela própria
```

Estados propostos. São PROPOSTA e dependem de aprovação do Dr. Alcides; não são decisões tomadas.

| Estado      | Significado                                                              | Mutável?                                        |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `draft`     | rascunho; snapshot pode ser recalculado                                  | sim (substitui o snapshot)                      |
| `in_review` | enviado ao responsável técnico                                           | não (pede devolução → volta a draft com evento) |
| `issued`    | emitido; snapshot e PDF congelados; output_sha256 gravado                | **não**                                         |
| `signed`    | assinatura técnica válida ligada ao output_sha256                        | **não**                                         |
| `rectified` | substituído por uma nova emissão (`supersedes_id`); continua consultável | não                                             |
| `cancelled` | anulado com motivo e ator; continua consultável                          | não                                             |

- Transições só por funções de domínio, com evento append-only (ator, data, motivo).
- O runtime não tem DELETE.
- UPDATE só por coluna (`status`, `output_sha256`) e protegido por trigger que impede alterar `snapshot` depois de `issued`.

**Reuso:**

- `documents` / `document_group_id` / versão (um grupo por ASO, ou por PCMSO da empresa);
- `jobs` `pdf_batch` com um `kind` novo no payload jsonb (zero migration de enum, `domains/documents/pdf-batch.ts:9`);
- worker, Gotenberg e `docxtemplater`;
- `signature_requests` com novo `target_type` (registry, zero schema) **apenas** para ciência do trabalhador, nunca como assinatura técnica do médico.

**O que falta na assinatura técnica (§4.6):**

- hash do documento no pedido;
- identidade verificada (usuário vinculado a `medicos` com CRM+UF);
- evidências (IP, user agent, método de autenticação);
- integração com provedor ICP-Brasil (envelope, certificado, carimbo de tempo, PDF assinado com hash próprio, guardado como nova versão no GED).

### 10.4 Propostas de migration (somente descritas, nenhum arquivo criado)

Regras gerais para todas:

- RLS em toda tabela nova (o event trigger `ensure_rls` em produção obriga);
- `*_isolation` PERMISSIVE mais `*_module_access` RESTRICTIVE (`companyModuleScope(…,'medicine')`);
- FK composta `(company_id, org_id) → companies(id, org_id)`, como na #112;
- estados em `text` + CHECK (evita R3);
- GRANT mínimo;
- testes de integração em Postgres efêmero: cross-tenant, módulo desligado, runtime tentando UPDATE/DELETE proibido, concorrência e CASCADE/RESTRICT.

Rollback é sempre uma migration para frente (não existe down). Por isso cada uma deve ser **aditiva**: sem DROP e sem NOT NULL em colunas antigas no mesmo passo.

**Numeração.** A develop está em 0053 e a #112 ocupa 0054/0055. **Recomendação:** mergear ou decidir a #112 primeiro. As propostas abaixo começam em **0056**, uma migration por PR, geradas com `drizzle-kit generate` depois de rebase na develop. Nunca editar o journal à mão; `when` maior que 1792515723005. Se a #112 for adiada, a primeira proposta independente vira 0054 e a #112 precisa regerar as suas.

| Ordem | Migration (nome indicativo)          | Depende da NOB-98?                                                       |
| ----- | ------------------------------------ | ------------------------------------------------------------------------ |
| P1    | `0056_medical_professional_identity` | **Não** (mas desbloqueia a NOB-98)                                       |
| P2    | `0057_reference_datasets`            | Não                                                                      |
| P3    | `0058_employee_job_assignments`      | Não                                                                      |
| P4    | `0059_exam_procedures`               | Não                                                                      |
| P5    | `0060_medical_risk_reviews`          | **Sim** (FK para `medical_risk_entries`; depende de P1)                  |
| P6    | `0061_pcmso_programs`                | **Sim** (usa fontes e revisões validadas; depende de P1, P4, P5)         |
| P7    | `0062_document_issuances`            | Não para o ASO isolado; Sim quando o ASO referenciar uma versão de PCMSO |
| P8    | `0063_technical_signatures`          | Não (depende do provedor)                                                |
| P9    | `0064_medical_audit_log`             | Não                                                                      |

**P1: identidade profissional e responsabilidade técnica**

- **Finalidade:** permitir saber _quem_ é o médico (CRM+UF, RQE), ligar o médico a um usuário autenticado e registrar a designação por empresa (coordenador do PCMSO, examinador) com vigência.
- **Tabelas:**
  - ALTER `medicos`: ADD `crm_uf char(2)` nullable, `rqe text` nullable, `user_id text` nullable (Clerk id, sem FK, como `pgr.created_by`);
  - UNIQUE parcial `(org_id, user_id) WHERE user_id IS NOT NULL`;
  - novo UNIQUE `(org_id, crm, crm_uf)` NULLS NOT DISTINCT, **mantendo** o antigo até saneamento.
  - Nova `company_medical_assignments` (org_id, company_id, medico_id, role CHECK `pcmso_coordinator|examiner`, valid_from date, valid_to date null, granted_by text, granted_at, revoked_by, revoked_at, reason).
- **Escopo de tenant:** org + empresa.
- **Sensibilidade:** dado profissional (baixo/médio).
- **Integridade:** CHECK `valid_to >= valid_from`; EXCLUDE ou UNIQUE parcial impedindo dois coordenadores vigentes por empresa (exige `btree_gist` ou regra por índice parcial `WHERE revoked_at IS NULL AND valid_to IS NULL`). `medico_id` com **RESTRICT** (não deixar a autoria virar nula).
- **Índices:** (org, company, role) e (org, medico).
- **Acesso:** SELECT/INSERT para o runtime; UPDATE só nas colunas `revoked_*` / `valid_to` (GRANT por coluna); sem DELETE.
- **RLS:** isolation + módulo medicine.
- **Backfill:** nenhum automático. `crm` existente pode conter "0000/MA"; saneamento manual assistido.
- **Rollback:** migration que remove as colunas e a tabela novas, sem perda de dados antigos.
- **Testes:** cross-tenant; dois coordenadores vigentes rejeitados; revogação preserva a linha; RESTRICT na exclusão do médico; empresa sem medicine.
- **Decisão pendente:** quem concede (Dr. Alcides/Expedito).

**P2: dados de referência globais com procedência** (detalhada em §10.5).

**P3: histórico de função do trabalhador**

- **Finalidade:** registrar períodos de função/GES do trabalhador, para o exame de mudança de risco, para o ASO com a função vigente na data e para o PPP futuro.
- **Tabela:** `employee_job_assignments` (org_id, company_id, employee_id, job_role_id, ges_id null, started_at date, ended_at date null, source CHECK `manual|migration|import`, created_by).
- **Integridade:** `ended_at >= started_at`; no máximo um período aberto por funcionário (UNIQUE parcial `WHERE ended_at IS NULL`); FK de employee **RESTRICT** (proteger o histórico) ou CASCADE se a decisão de retenção permitir.
- **RLS:** apenas isolation, porque é cadastro comum dos dois módulos (coerente com a NOB-99).
- **Backfill:** um período aberto por funcionário com `job_role_id` atual (`started_at = admission_date`, ou a data da migration), `source='migration'`.
- **Rollback:** DROP da tabela; o dado vivo em `employees` continua.
- **Testes:** período sobreposto, função de outra empresa (FK composta via job_roles exige `uq (id,org_id,company_id)` em job_roles, que hoje não existe; avaliar), backfill idempotente.

**P4: catálogo de procedimentos e procedimentos do exame**

- **Tabelas:**
  - `exam_procedures` (org_id, name, code null, kind CHECK `clinical|complementary`, active), UNIQUE(org, name);
  - `health_exam_procedures` (org_id, company_id, health_exam_id, procedure_id, performed_at date, result_status CHECK `pending|done|not_done`).
- **Não guardar valores de resultado no MVP**: espirometria e audiometria ficam com o médico, conforme SPEC:93. Decisão do Dr. Alcides.
- **Sensibilidade:** média (indica exames feitos).
- **RLS:** módulo medicine; health_exam CASCADE.
- **Testes:** módulo desligado esconde; cross-tenant.

**P5: revisão de riscos da NOB-98** (depende de #112 + P1)

- **Opção A (recomendada):** `medical_risk_entry_reviews` append-only (org_id, company_id, source_id, entry_id, decision CHECK `validated|rejected`, reviewer_medico_id FK RESTRICT, reviewer_user_id text, note, decided_at). O estado vigente é a última decisão.
  - Aposentar o uso de `medical_risk_entries.status/reviewed_*`: deixar como pending permanentemente, ou derivar.
  - INSERT só se existir assignment vigente: verificação na aplicação mais policy RESTRICTIVE com `exists(company_medical_assignments …)`.
- **Opção B:** `GRANT UPDATE (status, reviewed_by, reviewed_at, review_note)` mais trigger que impede alterar `content`/`source_id` e impede voltar de validated para pending.
- **Testes:** revisor sem designação rejeitado (no banco e na aplicação); revogação impede novas decisões; concorrência de duas decisões; content imutável.
- **Decisão:** Rikelvin + Carlos.

**P6: PCMSO** (depende de #112, P1, P4, P5)

- **Tabelas:**
  - `pcmso_programs`: org_id, company_id, coordinator_assignment_id, valid_from, valid_to, UNIQUE de vigência por empresa;
  - `pcmso_versions`: program_id, version int, status CHECK `draft|in_review|issued|signed|rectified|cancelled`, snapshot jsonb, snapshot_sha256, source_ids uuid[] (ou tabela de junção `pcmso_version_sources` com FK composta para `medical_risk_sources`), issuance_id → P7, UNIQUE(org, program, version);
  - `pcmso_exam_plan_items` dentro do snapshot (preferível), ou como tabela filha imutável: ges_id/job_role_id, procedure_id, admissional/periódico (meses)/retorno/mudança/demissional.
- **Integridade:** snapshot imutável depois de `issued` (trigger); fonte usada precisa estar `validated` no momento (verificação transacional).
- **Sensibilidade:** média (sem dados individuais se o cronograma individual não for snapshotado; decisão).
- **Testes:** fonte alterada depois da emissão não altera a versão emitida; nova versão exige nova revisão; empresa sem medicine.

**P7: emissão de documentos (genérica, para Douglas decidir)**

- ALTER `documents` ADD `company_id uuid` null, `sha256 text` null, `created_by text` null. Sem backfill obrigatório; PGR pode preencher depois.
- Nova `document_issuances`: org_id, company_id, kind CHECK `aso|pcmso|pgr`, target_type, target_id, status (estados de §10.3), snapshot jsonb, snapshot_sha256, template_sha256, output_document_id → documents RESTRICT, output_sha256, supersedes_id (auto-FK), issued_by, issued_at, cancelled_reason.
- Nova `document_issuance_events` (append-only).
- **RLS:** isolation, mais RESTRICTIVE por módulo **conforme o kind** (`aso|pcmso` → medicine; `pgr` → pgr).
- **Política nova para `documents`:** linhas com `related_entity_type in ('aso','pcmso')` exigem medicine. É mudança de comportamento do GED; teste de regressão do PGR é obrigatório.
- **Acesso:** sem DELETE; UPDATE por coluna; trigger de imutabilidade.
- **Worker:** `upsert:false` para emissões (o path imutável impede sobrescrita).
- **Rollback:** colunas nullable e tabelas novas, removíveis por migration para frente.
- **Testes:** retry do job não altera o snapshot; output_sha256 confere com o objeto; retificação mantém a anterior consultável; cancelamento exige motivo; GED do PGR sem regressão.

**P8: assinatura técnica**

- **Tabela:** `technical_signatures` (org_id, company_id, issuance_id, signer_medico_id RESTRICT, signer_user_id, document_sha256, provider, provider_envelope_id, certificate_subject, certificate_serial, signed_document_id → documents, signed_sha256, signed_at, timestamp_token, ip, user_agent, auth_method).
- Opcional: ALTER `signature_requests` ADD `document_sha256 text` null (para a ciência do trabalhador ficar ligada ao arquivo).
- **Sensibilidade:** média.
- **Acesso:** append-only.
- **Depende:** escolha do provedor ICP-Brasil (SPEC:195/257). NÃO VERIFICADO quais campos o provedor devolve.

**P9: trilha de auditoria clínica**

- **Tabela:** `medical_audit_events` (org_id, company_id, actor_user_id, action, entity_type, entity_id, at, metadata jsonb sem conteúdo clínico).
- Append-only, sem UPDATE/DELETE, com retenção definida (SPEC:215 fala em 5 anos).
- Atende "registro de leituras" exigido pela SPEC. Volume a avaliar.

### 10.5 Lista C e dados de referência (proposta P2, sem importar nada)

- `reference_datasets` (GLOBAL, sem org_id):
  - colunas: id, code CHECK (`lista_c_dec3048`, `nr4_cnae_grau`, `esocial_tab24`, …), version text, source_name, source_url, legal_reference (ex.: "Decreto 3.048/99, Anexo II, redação Dec. 6.957/2009"; a confirmar), published_at date null, imported_at, imported_by, source_sha256 (do arquivo bruto), row_count, status CHECK `active|superseded|draft`, notes;
  - UNIQUE(code, version) e UNIQUE(code, source_sha256).
- `ref_lista_c_entries`:
  - colunas: dataset_id FK RESTRICT, cid_range text (ex.: "J40-J47"), cid_start, cid_end, group_label, cnae_class char(4);
  - PK (dataset_id, cid_range, cnae_class), uma linha por par. O protótipo guarda os CNAEs como string separada por espaço (PROTO:183-201).
- Análogos: `ref_nr4_cnae_risk_grades` e `ref_esocial_tab24` (agente nocivo; hoje `risks.noxious_agent_code` é texto livre). A validação seria só sugestão, nunca bloqueio, no padrão do CAEPI.
- **RLS:** habilitado com policy única `USING (true)` FOR SELECT (padrão `caepi_certificates`, exigido pelo `ensure_rls`). GRANT apenas SELECT para `app_runtime`; escrita só via owner.
- **Importador:**
  - `scripts/reference-sync.ts --dataset lista_c --file <csv> --version <v> --source-url <url>`, no padrão de `scripts/caepi-sync.ts` + `repositories/caepi-upsert.ts` (handle owner injetado);
  - calcula o sha256 do arquivo; se `(code, source_sha256)` já existe, sai sem efeito (idempotente);
  - senão, numa transação: cria dataset `draft`, insere as entries com `ON CONFLICT DO NOTHING`, confere `row_count`, promove para `active` e marca o anterior `superseded`;
  - nunca apaga versões anteriores, porque documentos emitidos podem citar `dataset_id`;
  - **não usar a base parcial do protótipo (A15–K46) como fonte oficial.**
- **Snapshot:** PCMSO e ASO devem gravar `dataset_id`/`version` da referência usada (por exemplo, a vigilância NTEP do PCMSO, PROTO:897-899).
- **Testes:** reimportar o mesmo arquivo não muda nada; nova versão preserva a anterior; app_runtime não escreve; leitura global funciona com RLS forçado.

### 10.6 CD e migrations automáticas

- `cd.yml` (push em develop/main): CI → `vercel pull` → **`drizzle-kit migrate` com `DATABASE_URL_UNPOOLED` do projeto Vercel da branch** → build → deploy (linhas 64-78).
- Merge na **develop** muda o banco de **homologação** na hora. Merge em **main** muda a **produção**.
- Consequências:
  1. Toda migration de Medicina precisa passar por revisão de DBA/TL **antes do merge na develop**, e não "na homologação".
  2. Policies RESTRICTIVE (como 0053 e 0055) mudam a visibilidade imediatamente após o merge.
  3. Backfills rodam no banco real. Precisam ser idempotentes e rápidos (lock).
  4. Falha aborta o deploy, mas não reverte o que já tinha sido aplicado em deploys anteriores.
  5. Hoje a produção está em 0052 (HIPÓTESE): 0053, 0054 e 0055 chegarão juntas ao fazer o PR develop → main. Ensaiar esse lote em cópia da produção.

### 10.7 Ordem recomendada (sem implementar)

1. Decidir a identidade e autorização profissional, e a ordem de merge da #112.
2. Resolver o conflito do Postman e mergear a #112, aceitando conscientemente o efeito da 0055.
3. P1 → P5: a NOB-98 fica completa.
4. P2, P3 e P4 em paralelo (independentes).
5. P7 (com Douglas) → P6 → emissão de ASO/PCMSO.
6. P8 quando houver provedor.
7. P9 junto da primeira tela de dado clínico novo.

## 11. Nível de confiança

| Afirmação                                                                          | Confiança                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Schema, migrations, journal, policies e GRANTs da develop e da #112                | **Alta** (lidos diretamente)                                                                            |
| Pipeline de documentos lê dados vivos; GED sem hash nem módulo                     | **Alta**                                                                                                |
| 0053 aplicada em homologação                                                       | **Média-alta** (inferida do run de CD com `success`; log não aberto)                                    |
| Produção em 0052                                                                   | **Média** (inferida de `origin/main` e do último CD de main)                                            |
| Mapeamento do protótipo                                                            | **Média-alta** (seed e funções de documento lidos; não percorri todas as 2976 linhas)                   |
| Requisitos normativos (guarda de 20 anos, ICP-Brasil obrigatória, conteúdo do ASO) | **Baixa / HIPÓTESE**. Vêm da SPEC, que admite citações de memória (SPEC:281); validar com o Dr. Alcides |

## 12. O que não foi possível verificar

- Estado real dos bancos de homologação e produção (`__drizzle_migrations`): não conectei, por regra.
- Logs do passo "Aplica as migrations" nos runs de CD.
- Versão do Postgres de produção. A existência de `NULLS NOT DISTINCT` em migrations indica PG ≥ 15 (HIPÓTESE).
- Execução de qualquer teste, unitário ou de integração, da develop ou da #112. Os números citados são os declarados pelo autor da PR.
- Comportamento da 0055 com dados reais, e desempenho das policies correlacionadas (`exists` aninhado por linha) em volume.
- Campos devolvidos por provedores ICP-Brasil; texto oficial da NR-7 e do Decreto 3.048/99 (Lista C completa).
- Planilhas em `Projeto-SST-Ocupacional/planilhas/` (fora do meu escopo; outro agente).
- As 9 suítes excluídas no `jest.config.ts` mencionadas pela PR.
