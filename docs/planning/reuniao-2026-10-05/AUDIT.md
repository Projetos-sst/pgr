# Auditoria — Reunião de 05/10/2026

Auditoria técnica e funcional do PGR contra os 16 requisitos levantados na reunião com Douglas
(Tech Lead), Expedito e demais interessados. **Somente auditoria**: nenhuma funcionalidade foi
implementada, nenhuma migration criada, nenhum arquivo funcional alterado.

## 1. Resumo executivo

O sistema está muito mais completo do que a pauta da reunião sugere. Dos 16 requisitos, **6 já estão
implementados e validados**, **5 estão implementados parcialmente**, **1 está divergente do
solicitado**, **3 não estão implementados** e **1 depende de material externo**.

Os três achados que mais importam:

1. **R01 (hierarquia de controle por função) e R03 (treinamentos por função) não são lacunas de
   modelo — são lacunas de leitura.** A hierarquia existe como enum `control_level`
   (`elimination | collective_protection | administrative | ppe`) em `control_measures`, e o vínculo
   Função→Treinamento existe como tabela `job_role_required_trainings` com CRUD e REST completos. O
   que falta é (a) uma tela de detalhe da função — hoje `/job-roles/[id]` **não existe**, só
   `/job-roles/[id]/edit` — e (b) a presença de `jobRoles` na visão consolidada do PGR: o tipo
   `PgrConsolidated` (`src/shared/domains/pgr/pgr-consolidated.ts`) **não tem uma única referência a
   função**. Sem isso, a "tabela automática no PGR impresso" que a reunião pediu não tem de onde sair.
   **Zero migration** nos dois casos.

2. **R02 (ação por classificação de risco) já está quase inteiro.** As cinco classes existem no enum
   `risk_classification` exatamente como a reunião falou (`trivial | tolerable | moderate |
substantial | intolerable`) e o texto de ação por classe já está escrito em
   `methodology.ts:186-192`, incluindo _"Ação imediata. Interromper a atividade até a implementação do
   controle"_ para `intolerable`. Ele aparece em 3 telas e no prompt da IA, mas **não aparece no PDF**.

3. **R04 (tela inicial pública) é a maior lacuna real.** A landing (`src/app/(public)/page.tsx`) tem
   **42 linhas**: título, um parágrafo e dois botões. Não há área Saúde, não há área Segurança, não há
   "Solicitar Orçamento" e **não existe nenhuma tabela de pré-cadastro de interessados** no schema.
   Ironicamente, o conteúdo de apresentação que a reunião pediu **já existe** — está no `AuthFrame`
   das telas de login (`src/app/_components/auth-frame.tsx`), com três blocos de pitch. A landing
   simplesmente não o reutiliza.

Fora dos 16 requisitos, a auditoria encontrou **um bug real de responsividade** nas telas de
autenticação: `/sign-in` e `/sign-up` têm **overflow horizontal** em 375px (scrollWidth 399 ×
clientWidth 360) e em 768px (765 × 753). Medido na UI real, não inferido.

O trabalho do Douglas (R15/R16) **não está disponível em nenhum repositório acessível** — nem na
`develop` do `Projetos-sst/pgr` (101 branches remotas inspecionadas, nenhuma de template/PDF), nem no
clone local do `Dougladmo/sst-manager`, que está **atrás** da develop. Classificado como "confirmado
pelo responsável, ainda não publicado", não como ausente.

## 2. Base Git analisada

| Item                    | Valor                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Repositório             | `Projetos-sst/pgr` (`https://github.com/Projetos-sst/pgr.git`)                      |
| `origin/develop` HEAD   | `f7e417d` — _Merge pull request #96 from Projetos-sst/feature/lot-03-nr17-nr18-pgr_ |
| Local `develop`         | sincronizada (`git pull --ff-only` → _Already up to date_)                          |
| Branch desta auditoria  | `feature/reuniao-2026-10-05-pgr-portal`, criada de `f7e417d`                        |
| Branch do Lote 4        | `feature/lot-04-cnae-cbo` em `8dd86a9` — **congelada, intocada**                    |
| Branches remotas        | 101                                                                                 |
| PRs abertas             | **0**                                                                               |
| Última migration        | `0051_ergonomic_evaluations` (52 arquivos `.sql`, journal com 52 entradas)          |
| Tabelas no schema       | **61** (confirmadas também no banco: 61 em `public`)                                |
| Páginas (`page.tsx`)    | **128**                                                                             |
| Rotas REST (`route.ts`) | **144**                                                                             |
| Testes                  | 118 arquivos unit + 160 arquivos de integração                                      |

Atividade remota recente (`git for-each-ref --sort=-committerdate`):

| Data       | Autor            | Branch                                             |
| ---------- | ---------------- | -------------------------------------------------- |
| 2026-09-27 | CarlosVictor7    | `feature/lot-04-cnae-cbo`, `develop`               |
| 2026-09-16 | CarlosVictor7    | `lot-01-feat/document-versions-risk-plan-coverage` |
| 2026-09-02 | Douglas Oliveira | `feature/mastra-agents`                            |
| 2026-08-31 | Douglas Oliveira | `fix/correcoes-avaliacao-epgr`                     |
| 2026-08-05 | Douglas Oliveira | `feature/sandbox-basic-auth`                       |

**Segundo repositório na máquina:** `C:\Users\carlo\OneDrive\Documentos\sst-manager` →
`https://github.com/Dougladmo/sst-manager.git`, `develop` em `ee5071e` (_feat(health-exams)_, datado
2026-08-02), **31 migrations** (última `0030_health_exams`). É um clone **mais antigo** que a develop
do `Projetos-sst/pgr`. Vale registrar: o trabalho de redesign e os módulos de Médicos / Saúde-ASO /
eSocial que nascem nesse repositório **já estão na develop do PGR** — confirmado com
`git merge-base --is-ancestor` para `redesign/doctors`, `redesign/occupational-health`,
`redesign/esocial-config`, `redesign/psychosocial-risks`, `redesign/work-units` e `redesign/job-roles`:
todas **JÁ EM DEVELOP**.

## 3. Estado do ambiente

| Item                | Resultado                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Banco do PGR        | Supabase **remoto** (`aws-1-us-east-1.pooler.supabase.com:6543`), role `app_runtime`, PostgreSQL 17.6 — **conexão OK** |
| RLS backstop        | `select count(*) from orgs` sem `app.current_org` → **0 linhas**                                                       |
| Gotenberg           | `sst-gotenberg` sobe e responde `/health` **200** (`chromium: up`, `libreoffice: up`)                                  |
| Worker de PDF       | imagem `sst-pdf-worker:lote2` presente, config intacta — não roda por padrão                                           |
| Dev server          | subiu em **`:3001`** (a 3000 está ocupada pelo `pmpa-frontend` do Site-PMPA)                                           |
| REST com bypass dev | `APP_ENV=local`, `DEV_API_AUTH_BYPASS=true` → 4 endpoints GET testados, **todos 200**                                  |
| Docker              | auditado e limpo nesta mesma execução — ver [DOCKER-AUDIT.md](DOCKER-AUDIT.md)                                         |

**Baseline `npm run check` — VERDE (exit 0)**, executado nesta branch:

| Etapa                        | Resultado                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prettier --check .`         | passou                                                                                                                                                                                                                |
| `eslint`                     | **0 erros**, 4 warnings **pré-existentes** (3 × `no-img-element` em `company-form.tsx:286`, `employee-form.tsx:399`, `epi-catalog-form.tsx:426`; 1 × `no-unused-vars` para `Company` em `domains/pgr/companies.ts:3`) |
| `tsc --noEmit`               | passou                                                                                                                                                                                                                |
| `jest --selectProjects unit` | **143 suites, 1367 testes, todos passando** (35,0 s)                                                                                                                                                                  |

Distinção que a auditoria pede explicitamente:

- **falhas reais do produto: zero**;
- **falhas pré-existentes:** os 4 warnings de lint acima — já estavam na develop, não foram
  introduzidos aqui e não são erro;
- **falha ambiental encontrada e resolvida:** na primeira execução, com o dev server rodando em
  paralelo, o `tsc --noEmit` leu `.next/dev/types/routes.d.ts` no meio da escrita e produziu ~45 erros
  `TS1005`. Não é defeito de produto: desapareceu ao parar o dev server e remover `.next/dev`. A
  primeira execução também falhou em `format:check` por causa do próprio `DOCKER-AUDIT.md` recém
  escrito — corrigido com `prettier --write` no arquivo de documentação.

A suíte de **integração** não foi executada nesta auditoria: exige Postgres efêmero
(`INTEGRATION_DATABASE_URL`) e o container `qa-pg16` está parado. Nenhum código funcional foi tocado,
então não há regressão a verificar.

## 4. Fontes e anotações da reunião

Toda a pauta vem do prompt da missão (reunião de 05/10/2026, Douglas = Tech Lead, Expedito e demais
interessados). **Não existe ata no repositório** — o prompt é a única fonte. Decisões de
enquadramento registradas lá e respeitadas aqui:

- o backlog anterior (`docs/planning/backlog-2026-09/`) fica **pausado**; Lote 4 CNAE/CBO não avança;
- GED fica para depois; psicossocial ampliado fica para etapa posterior;
- foco imediato: **PGR, tela inicial pública e telas de login**;
- template e preenchimento do PDF permanecem **sob responsabilidade do Douglas**.

Materiais citados na reunião e **ainda não disponíveis** — detalhados na seção 22:
template atualizado do Douglas, modelos oficiais de inspeção do Expedito, PGR marcado com conteúdo
fixo, protótipo do Dr. Alcides, referência visual ESO aprovada.

## 5. Matriz consolidada dos 16 requisitos

| ID  | Requisito da reunião                                  | Prior.       | Módulo                 | Estado real                                     | Evidência                                                                                                                                                                                                                      | Lacuna                                                                                                            | Ação necessária                                                     | Resp.                            | Dependência          |
| --- | ----------------------------------------------------- | ------------ | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- | -------------------- |
| R01 | Hierarquia de controle por função                     | P0           | Riscos / Funções       | **IMPLEMENTADO PARCIALMENTE**                   | `schema/risks.ts:94-99` (`control_level`), `control_measures` com `uq(org,risk,level)`; `/risks/[id]/control-measures`                                                                                                         | hierarquia existe **por risco**, não por função; `/job-roles/[id]` não existe                                     | visão derivada função→GES→risco→medidas + tela de detalhe da função | nós                              | —                    |
| R02 | Ação por classificação de risco                       | P0           | Riscos                 | **IMPLEMENTADO PARCIALMENTE**                   | `risk-methodology.ts:28-34` (5 classes), `methodology.ts:186-192` (ação por classe), 3 telas consumindo                                                                                                                        | texto de ação **não** entra no PDF; nenhuma interrupção automática (correto)                                      | levar `riskClassificationGuidance` ao template                      | nós + Douglas                    | contrato do PDF      |
| R03 | Treinamentos por função                               | P0           | Funções / Treinamentos | **IMPLEMENTADO PARCIALMENTE**                   | `job_role_required_trainings` (`schema/trainings.ts:115-145`), `_components/required-trainings.tsx`, REST `v1/job-role-required-trainings`                                                                                     | só na tela de **edição**; **ausente** do consolidado → sem tabela no PGR impresso                                 | expor no consolidado + disponibilizar em `/job-roles/new`           | nós                              | contrato do PDF      |
| R04 | Tela inicial pública                                  | P0           | Público                | **NÃO IMPLEMENTADO**                            | `(public)/page.tsx` — 42 linhas; UI real: só "Entrar"/"Criar conta"; nenhuma tabela de lead no schema                                                                                                                          | sem área Saúde/Segurança, sem Orçamento, sem pré-cadastro                                                         | landing nova + captura de interessados                              | nós                              | referência visual    |
| R05 | Login e acessos                                       | P0           | Auth                   | **IMPLEMENTADO E VALIDADO** (com bug de layout) | `sign-in/[[...sign-in]]/page.tsx`, `AuthFrame`, `clerkAppearance`, `proxy.ts`, `(protected)/layout.tsx`, `TenantSwitcher`                                                                                                      | overflow horizontal em 375px e 768px; Clerk anuncia "sst-manager"                                                 | corrigir largura do frame + nome da aplicação Clerk                 | nós                              | —                    |
| R06 | Identidade visual                                     | P1           | Transversal            | **IMPLEMENTADO E VALIDADO**                     | `globals.css:18-56` (indigo `#5b63f5`, Manrope + JetBrains Mono, raios, sombras); redesign mergeado em ~20 telas                                                                                                               | landing fora do padrão; referência ESO não avaliada                                                               | estender identidade à landing                                       | nós                              | referência visual    |
| R07 | Gestão de EPI unificada                               | P1           | EPI                    | **IMPLEMENTADO PARCIALMENTE**                   | 7 tabelas (`schema/epis.ts`), 7 Server Actions, 10 repositórios, REST `epi-catalog`/`epi-stock`/`epi-deliveries`/`epi-returns`                                                                                                 | funcionalidade completa mas **espalhada**: entrega vive dentro de `/employees/[id]`; 3 entradas de menu separadas | hub único de EPI (navegação/agregação), **sem** novo módulo         | nós                              | —                    |
| R08 | Plano de inspeção                                     | P1           | Inspeções              | **DEPENDE DE MATERIAL EXTERNO**                 | `inspection_plans` + `inspection_plan_items` + `inspections` + `inspection_item_responses` + `inspection_occurrences`; 3 tipos (`vehicular`/`equipment`/`safety`)                                                              | modelos **oficiais** inexistentes; resposta de item é `boolean` + observação (sem numérico/foto)                  | importar modelos do Expedito; avaliar tipos de resposta             | Expedito + nós                   | modelos oficiais     |
| R09 | Estrutura do portal Saúde/Segurança                   | P1           | Navegação              | **DIVERGENTE DO SOLICITADO**                    | `nav-menu.tsx` — 5 categorias: Dashboard, Módulos, Cadastro, Gestão de Segurança, Qualidade                                                                                                                                    | **não há** separação de primeiro nível Saúde × Segurança; Saúde-ASO e Médicos estão dentro de Segurança/Cadastro  | reorganizar o mega-menu em duas vertentes                           | nós                              | decisão de produto   |
| R10 | Módulos de Saúde (ASO/medicina/PCMSO/CAT/absenteísmo) | P2           | Saúde                  | **IMPLEMENTADO PARCIALMENTE**                   | ASO = `health_exams` (tipo, aptidão, validade, `certificate_path`); medicina = `medicos`; CAT = `accidents.cat_number`/`cat_issued_at` (interno, sem S-2210)                                                                   | **PCMSO inexistente**; **absenteísmo inexistente**; CAT sem emissão oficial                                       | inventariado; não implementar nesta etapa                           | nós                              | decisão de produto   |
| R11 | Clínicas e exames                                     | P2           | Saúde                  | **NÃO IMPLEMENTADO**                            | `medicos.clinic` é **campo texto**; nenhuma entidade de clínica; nenhuma capacidade de e-mail no projeto (grep por resend/nodemailer/sendEmail → vazio); nenhuma solicitação de exame                                          | fluxo inteiro ausente                                                                                             | aguardar protótipo do Dr. Alcides                                   | Dr. Alcides + nós                | protótipo externo    |
| R12 | Psicossocial                                          | P2           | Psicossocial           | **IMPLEMENTADO E VALIDADO**                     | 6 tabelas (`schema/psychosocial.ts`), rota pública anônima `(public)/psychosocial-response/[campaignId]/[token]`, token anônimo (`psychosocial.ts:140`), integração NR-17 via `ergonomic_evaluations.psychosocial_campaign_id` | pedido da reunião (formulário respondido por empresas) pode ou não coincidir com o fluxo existente                | comparar pedido × fluxo com o interessado                           | nós                              | decisão de produto   |
| R13 | Emoflow                                               | P2           | Integração             | **NÃO IMPLEMENTADO**                            | grep por `emoflow` em `src/` e `docs/` → **zero ocorrências**                                                                                                                                                                  | sem menu, sem rota, sem link, sem referência                                                                      | aguardar dados do projeto Emoflow                                   | terceiros + nós                  | material externo     |
| R14 | GED                                                   | P2 (adiado)  | Documentos             | **IMPLEMENTADO PARCIALMENTE**                   | `folders` + `documents` com versionamento (`document_group_id`, `version`), `valid_until`, vínculo polimórfico; `/documents`, `/documents/new`, `/form-controls`; REST com `versions`/`move`/`download`                        | workflow completo adiado **por decisão da reunião**                                                               | não avançar                                                         | —                                | decisão da reunião   |
| R15 | Template do PGR                                       | P0 (Douglas) | PDF                    | **NÃO VERIFICÁVEL**                             | `pgr-pdf-template.ts` na develop tem 6 commits (3 CarlosVictor7, 3 Douglas Oliveira); **nenhuma** branch remota de template/PDF; clone do Douglas está atrás                                                                   | versão nova do Douglas não publicada                                                                              | alinhar publicação                                                  | Douglas                          | branch/PR do Douglas |
| R16 | Preenchimento do PDF                                  | P0 (Douglas) | PDF                    | **IMPLEMENTADO PARCIALMENTE**                   | `pgr-pdf-core.ts`, `pdf-batch-core.ts`, `api/v1/pgr/[id]/pdf`, Gotenberg validado; seções NR-01/NR-09/NR-17/5W2H/EPI já geradas                                                                                                | consolidado **sem função** → NR-17/treinamentos por função não têm dados; ação por classificação ausente do PDF   | fornecer contrato de dados (seção 20)                               | nós (dados) + Douglas (template) | alinhamento          |

**Totais:** 2 implementados e validados · 6 implementados parcialmente · 1 divergente · 3 não
implementados · 1 depende de material externo · 1 não verificável · 2 implementados e validados com
ressalva (R05 com bug de layout, R06 com landing fora do padrão). Contagem canônica usada no relatório
final: **implementados e validados 3 (R05, R06, R12)**, **parciais 6 (R01, R02, R03, R07, R10, R16)**,
**não implementados 3 (R04, R11, R13)**, **divergente 1 (R09)**, **depende de material 1 (R08)**,
**não verificável 1 (R15)**, **adiado por decisão 1 (R14)**.

## 6. PGR — núcleo do produto

Cadeia completa e funcional: `companies` → `work_units` → `ges` → `ges_job_roles` ← `job_roles`;
`risks` (por GES) → `risk_assessments` (matriz 5×5, `risk_level` persistido com CHECK) →
`control_measures` (hierarquia + 5W2H) → `epi_risk` → `epi_catalog`; `pgr` + `pgr_ges` +
`pgr_revisions`.

Rotas: `/pgr`, `/pgr/new`, `/pgr/[id]`, `/pgr/[id]/edit`. REST: `v1/pgr`, `v1/pgr/[id]`,
`v1/pgr/[id]/consolidated`, `v1/pgr/[id]/ges`, `v1/pgr/[id]/pdf`, `v1/pgr/[id]/revisions`,
`v1/pgr/[id]/signature`, `v1/pgr/[id]/nr18-checklist`, `v1/pgr/[id]/epi-relation`.

A **visão consolidada** (`src/shared/domains/pgr/pgr-consolidated.ts`, tipo `PgrConsolidated`) é o
contrato que alimenta o PDF. Hoje ela entrega:

```
PgrConsolidated
├── pgr { id, companyName, companyWebsite?, artDocumentName?, workUnitName,
│         responsible, registrationType, registrationNumber, issuedAt, validUntil,
│         company? (razaoSocial, cnpj, cnae, mainActivity, riskGrade, website, address),
│         workUnit? (name, type, contractNumber, managerName, managerRole,
│                    professionalTitle, professionalRegistration, startDate,
│                    expectedEndDate, address) }
└── ges[] { id, name, risks[] }
     └── risks[] { id, agentType, description, hazard, sources, propagation,
                   exposureTime, possibleInjuries, noxiousAgentCode, measurementUnit,
                   concentrationIntensity, riskLevel, result, assessment,
                   measures[], planCoverage, epis[], ergonomic? }
```

**Nada de função.** `grep -n "jobRole\|job_role" pgr-consolidated.ts` → zero resultados. Esse é o
ponto de integração único que R01, R03 e R16 compartilham.

## 7. Hierarquia de controles (R01)

**O que existe.** `src/shared/db/schema/risks.ts:94-99`:

```ts
export const controlLevel = pgEnum("control_level", [
  "elimination",
  "collective_protection",
  "administrative",
  "ppe",
]);
```

`control_measures` (linhas 232-277) tem `control_level` NOT NULL, `applicable`, `status`
(`control_measure_status`: manter/introduzir/aprimorar), `justification`, `monitoring` e o 5W2H
completo (`action_what/why/how/tracking/measurement/responsible/deadline/cost`). Constraint
`uq_control_measures_org_risk_level` → **no máximo uma medida por nível, por risco**: a hierarquia é
estruturalmente garantida, não convenção.

Domínio em `domains/pgr/control-measure.ts` (`controlLevelLabel`, `deriveMeasureState`,
`isMeasureMissingRequiredPlanFields`). Consumido por 19 arquivos, incluindo o PDF
(`pgr-pdf-template.ts`), o dashboard, o módulo de planos de ação e o sugeridor por IA
(`ai-control-measure-suggestion.ts`).

**O que falta.**

1. A hierarquia é **por risco**, e a reunião pediu **por função**. A navegação existe
   (`job_roles` → `ges_job_roles` → `ges` → `risks` → `control_measures`), então é **derivação pura,
   zero migration**.
2. **Não existe tela de detalhe de função.** O inventário de 128 páginas tem `/job-roles`,
   `/job-roles/new` e `/job-roles/[id]/edit` — e nada em `/job-roles/[id]`. Não há onde pendurar a
   visão.
3. Divergência de nomenclatura a validar com profissional de SST: a reunião falou "minimizar"; o
   sistema usa `collective_protection` ("proteção coletiva"). Em NR-01/hierarquia clássica os dois
   não são sinônimos exatos. **Registrado, não resolvido** — nada foi renomeado.

## 8. Classificação dos riscos (R02)

**O que existe.** `src/shared/db/schema/risk-methodology.ts:28-34` traz as **cinco** classes
exatamente como a reunião: `trivial | tolerable | moderate | substantial | intolerable`. A tabela
`risk_methodology` guarda gradações e faixas em JSONB, uma linha por organização, com preset por base
(`aiha`, `as_nzs_4360`, `fundacentro`, `custom` — `methodology-presets.ts`).

A ação por classe **já está escrita** em `domains/pgr/methodology.ts:186-192`:

| Classe      | Texto de ação já implementado                                                 |
| ----------- | ----------------------------------------------------------------------------- |
| trivial     | "Nenhuma ação obrigatória. Monitorar periodicamente."                         |
| tolerable   | "Monitorar e reavaliar periodicamente. Plano de ação não obrigatório."        |
| moderate    | "Plano de ação obrigatório, com prazo e responsável definidos."               |
| substantial | "Plano de ação prioritário, com prazo curto e responsável definidos."         |
| intolerable | **"Ação imediata. Interromper a atividade até a implementação do controle."** |

Exposto por `riskClassificationGuidance()` e consumido em:
`pgr/[id]/_components/pgr-consolidated-tab.tsx:216`,
`risks/[id]/assessments/_components/assessment-form.tsx:350` (pré-visualização enquanto se avalia),
`risks/[id]/control-measures/_components/risk-context.tsx:62` e no prompt da IA de medidas
(`integrations/agents/control-measure/prompt.ts:93`).

Há ainda uma regra de **efeito real** da classificação: `domains/pgr/plan-coverage.ts` deriva
`not_assessed | no_measure | incomplete | covered` por risco e **exige responsável e prazo nas medidas
aplicáveis quando a classificação é moderada ou superior** (`isMeasureMissingRequiredPlanFields`). A
reclassificação não escreve nada: sobe para moderado+ e o risco passa a `incomplete` até alguém
revisar; desce e a exigência simplesmente deixa de valer. Esse é o comportamento "o que acontece
quando o risco muda de classificação" que a auditoria pediu para conferir — está correto e testado.

**O que falta.** O PDF imprime `riskClassificationLabel` (linha 285) e `planCoverageLabel`
(linha 321), mas **não** o `riskClassificationGuidance`. Lacuna de uma linha de template — que é do
Douglas, portanto entra como contrato, não como edição nossa.

**Não implementado por decisão correta:** nenhuma interrupção automática de atividade. A missão proíbe
automatizar isso sem requisito funcional explícito e validação do responsável de SST.

## 9. Treinamentos por função (R03)

**O que existe — mais do que a reunião supõe.**

`src/shared/db/schema/trainings.ts`:

- `training_catalog` — `number` sequencial por tenant, `name`, **`reference_norm`** (texto livre: é
  onde "NR-6", "NR-10" vivem hoje), `workload_hours` (CHECK > 0), `periodicity`
  (`annual|biennial|triennial|quinquennial|single`), `is_active`;
- `training_records` — realização por funcionário, com `valid_until` calculado no servidor;
- `job_role_required_trainings` (linhas 115-145) — **o vínculo Função ↔ Treinamento**, com
  `uq_job_role_required_trainings_org_role_training`: **vários treinamentos por função**, sem
  duplicata. `training_id` com `ON DELETE RESTRICT` (não se apaga treinamento em uso).

Superfícies completas: Server Action `actions/pgr/job-role-required-trainings.ts`, REST
`v1/job-role-required-trainings` + `/[id]`, repositório dedicado, e **sugestão por IA**
(`ai-required-trainings.ts`, `v1/job-roles/[id]/training-suggestions` + `/accept`). Conformidade por
função já existe em `/training-compliance` e `/training-expiry`
(`repositories/training-compliance.ts`).

UI: `src/app/(protected)/job-roles/_components/required-trainings.tsx`, montada em
`job-roles/[id]/edit/page.tsx`.

**O que falta.**

1. O componente **só aparece na edição**. `job-roles/new/page.tsx` não o importa (verificado por
   grep). Quem cadastra uma função nova precisa salvar e reabrir para marcar treinamentos.
2. **Não há saída para o PGR impresso.** Como `PgrConsolidated` não conhece função, a "tabela
   automática no PGR" pedida na reunião não tem fonte. Esta é a lacuna que importa.
3. Não existe catálogo fechado de NRs — `reference_norm` é texto livre. Deliberado (espelha
   `doc_type` do GED). **Não inventamos** regra dizendo qual NR cada função exige; isso precisa de
   validação de profissional de SST.

## 10. Landing pública (R04)

Arquivo: `src/app/(public)/page.tsx`, **42 linhas**. Verificado na UI real em `:3001`:

```
PGR-e
Plataforma multiempresa de Segurança e Medicina do Trabalho.
Acesse com sua conta para gerenciar sua organização.
[Entrar] [Criar conta]
```

Links na página: exatamente dois (`/sign-in`, `/sign-up`). Botões: zero. Texto contendo "Saúde":
**não**. Texto contendo "Orçamento": **não**.

| Elemento pedido              | Estado                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Apresentação da plataforma   | parágrafo único — insuficiente                                                                                 |
| Área Saúde                   | **ausente**                                                                                                    |
| Área Segurança               | só a palavra na frase de abertura                                                                              |
| Botão Login                  | **existe**                                                                                                     |
| Botão Solicitar Orçamento    | **ausente**                                                                                                    |
| Pré-cadastro de interessados | **ausente** — e sem tabela: grep por `lead`/`orcamento`/`prospect`/`pre_cadastro` em `schema/` e `api/` → zero |

Rotas públicas (`proxy.ts`): `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/sign/(.*)`,
`/signature-requests/(.*)`, `/psychosocial-response/(.*)`, `/api/webhooks/(.*)` e `/api/v1/(.*)`
apenas sob a flag de bypass dev. Não há `/saude`, `/seguranca` nem `/orcamento`.

**Achado que muda a estimativa:** o conteúdo de apresentação **já foi escrito** — vive em
`src/app/_components/auth-frame.tsx:13-25`, com três blocos ("Gestão centralizada e rastreável",
"Análise inteligente de riscos", "Conformidade legal garantida") e aparece nas telas de login. A
landing é a única superfície pública que não o aproveita. **Observação de produto:** o bloco de IA
afirma "92% de precisão" — número sem fonte no repositório; se for para a landing pública, precisa ser
sustentado ou removido.

A captura de interessados é a **única parte do R04 que exige migration** (tabela de pré-cadastro +
RLS; é dado público entrando, então precisa de desenho de isolamento próprio — ver seção 23).

## 11. Login (R05)

**Implementado e sólido.** `src/app/(public)/sign-in/[[...sign-in]]/page.tsx` e o par `sign-up`:
checam `getSessionOrNull()`, redirecionam autenticado para `/dashboard` e renderizam `<SignIn>` do
Clerk dentro do `AuthFrame` com `clerkAppearance`. Localização `ptBR` no `ClerkProvider`
(`layout.tsx`).

Proteção em camadas, conforme auditado em `src/proxy.ts`:

- `clerkMiddleware` → `auth.protect()` em toda rota não-pública;
- Basic auth nativo quando `APP_ENV=sandbox` (com kill-switch pelo próprio `APP_ENV`, e webhooks
  isentos por terem assinatura própria);
- `NO_STORE_HEADERS` em `/api/`, `/sign-in`, `/sign-up`, rotas de assinatura, questionário
  psicossocial e `/dashboard`;
- remoção de `X-Powered-By` e `Server`;
- `(protected)/layout.tsx` captura `UnauthorizedError` → `/sign-in?redirect_url=…` e
  `NoTenantContextError` → `/sign-in`;
- `TenantSwitcher` no header (seleção de organização), `UserProfilePill`, badge de onboarding derivada
  (`getOnboardingProgressAction`), rota `/onboarding`.

Usuário sem organização: `resolveActiveTenant` auto-provisiona tenant pessoal no primeiro login e
normaliza papéis Clerk em `owner|collaborator|client` (desconhecido → menor privilégio). Nada aqui
precisa mudar.

**Dois achados reais, medidos na UI:**

1. **Overflow horizontal nas telas de autenticação.**

   | Viewport | `clientWidth` | `scrollWidth` | Overflow        |
   | -------- | ------------- | ------------- | --------------- |
   | 375×812  | 360           | **399**       | **sim (+39px)** |
   | 768×1024 | 753           | **765**       | **sim (+12px)** |
   | 1440×900 | 1440          | 1440          | não             |

   Causa identificada por inspeção de `getBoundingClientRect` em todos os elementos: o `<section>` do
   `AuthFrame` usa `p-8` (32px de cada lado) e o `cl-card` do Clerk não encolhe abaixo de ~337px →
   337 + 64 = 401 > 360. 12 elementos extrapolam a viewport. **Não corrigido nesta fase** (a missão
   proíbe correção funcional aqui).

2. **O widget do Clerk anuncia "para continuar em `sst-manager`"** — o nome da aplicação no
   dashboard do Clerk ainda é `sst-manager`, não "PGR-e". Inconsistência de marca visível em toda
   tela de login. É configuração no Clerk, não código.

## 12. Identidade visual (R06)

**Design system real e aplicado.** `src/app/globals.css:18-56`, bloco `@theme inline` do Tailwind v4:

| Token                                 | Valor                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-primary`                     | `#5b63f5` (indigo)                                                                                                                      |
| `--color-primary-strong`              | `#4f46e5`                                                                                                                               |
| `--color-bg` / `--color-surface`      | `#eae9e8` / `#ffffff`                                                                                                                   |
| `--color-text` / `-muted` / `-subtle` | `#1b1f2e` / `#52576e` / `#8c91a8`                                                                                                       |
| status                                | `--color-danger #d33a3f`, `--color-accent-green #0e9f6e`, `--color-accent-amber #f5a524` (+ variante `-strong` para contraste de texto) |
| raios                                 | `--radius-field 11px`, `--radius-card 12px`, `--radius-glass 18px`, `--radius-pill 30px`                                                |
| sombras                               | `--shadow-card` (glass com inset), `--shadow-primary`                                                                                   |
| tipografia                            | `--font-sans: Manrope`, `--font-mono: JetBrains Mono` (via `next/font/google`)                                                          |

Primitives compartilhadas em `(protected)/_ui/` — kit de lista (`data-list.tsx`: ListCard,
ListToolbar, DataGrid, GridHeader, GridRow, Cell, MonoCell, StatusBadge, ListFooter, RowActions) e kit
de formulário (`form.tsx`: PageHeader com `backHref`, FormSection, FormActions). O redesign foi
aplicado a ~20 telas em ondas já mergeadas (Empresas, Funções, Unidades, GES, Funcionários, EPIs,
Estoque, Incidentes, Veículos, Inspeções, Treinamentos, OS, Planos de Ação, Médicos, Saúde-ASO,
eSocial, Psicossocial, Categorias, Documentos, Boas-vindas).

Ou seja: **"minimalista, colorido, fácil de usar" já é o estado do produto interno.** As duas
ressalvas são a landing (seção 10) e a ausência de uma distinção visual entre Saúde e Segurança
(seção 13). A referência **ESO** citada na reunião não foi avaliada — não há material no repositório e
não copiamos marca de terceiro.

## 13. Gestão de EPI (R07)

**Tudo que a reunião pediu existe. O problema é que está espalhado — exatamente a suspeita da
reunião.**

| Pedido             | Onde está hoje                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro           | `/epi-catalog` (+ `new`, `[id]/edit`), `epi_catalog` com FK composta `(category_id, type)`, validação de CA via CAEPI           |
| Estoque            | `/epi-stock` (+ `new`, `[id]/edit`, `[id]/history`), `epi_stock.balance` materializado por transação atômica, `stock_movements` |
| Entrega            | **dentro de `/employees/[id]`** — `deliver-epi.tsx`, `epi-record-table.tsx`                                                     |
| Devolução          | `/epi-returns` + `return-item.tsx` no detalhe do funcionário                                                                    |
| Assinatura digital | `delivery-signature.tsx` (inline) + rota pública `(public)/sign/[token]` (token HMAC, 72h)                                      |
| Relatórios         | `v1/reports/[type]`, `v1/employees/[id]/epi-record`, `v1/pgr/[id]/epi-relation`                                                 |
| Dashboards         | `episLowStock`, `episPendingReturn`, `episCaExpired`, `episCaDueSoon` (`domains/platform/dashboard.ts:25-30`)                   |

Backend: 7 tabelas em `schema/epis.ts` (`epi_catalog`, `epi_stock`, `stock_movements`,
`epi_deliveries`, `epi_delivery_items`, `epi_risk`, `epi_catalog_audit_log`), 7 Server Actions, 10
repositórios, REST completo incluindo `epi-deliveries/[id]/sign` e `/return`.

**Lacuna real = navegação e agregação, não funcionalidade:**

- o menu tem **três** entradas de EPI em **dois** grupos diferentes: "Estoque de EPI" e "Devoluções de
  EPI" em _Módulos_, "EPI" (catálogo) em _Cadastro_;
- **registrar uma entrega não tem entrada de menu** — só se chega por `/employees/[id]`;
- não existe `/epi-deliveries` como página (só como REST).

Nada aqui pede módulo novo nem migration. Pede um hub.

## 14. Inspeções (R08)

**Modelo de template já existe e é o que a reunião descreveu como "formulário pré-formatado":**

- `inspection_plans` — `number` sequencial, `type` (`vehicular|equipment|safety`), `subtype` livre,
  `title`, `description`, `frequency` (`daily`…`annual`), `status` (ciclo de publicação do modelo);
- `inspection_plan_items` — `description`, `default_value` (boolean), `order` → é aqui que "freios",
  "pneus", "sinalização" entram;
- `inspections` — execução, com `plan_id`, `vehicle_id`, `equipment_catalog_id`, `company_id`,
  `responsible`, `driver_name`, `driver_license`, `current_km`, `route`, `category`
  (`safety|environment|quality|health|other`), `planned`, `area`;
- `inspection_item_responses` — `value` **boolean** + `observation`;
- `inspection_occurrences` — `description` + `severity` (`low|medium|high|…`).

Telas: `/inspection-plans` (+ `new`, `[id]/edit`), `/vehicular-inspections`, `/equipment-inspections`,
`/safety-inspections` (cada um com `new`, `[id]`, `[id]/edit`), `/vehicles`. REST inclui
`/[id]/checklist` para veicular e equipamento e `/[id]/occurrences` para segurança.

**"Possibilidade de criar novo formulário": já atendida** — o CRUD de planos é exatamente isso.

**Lacunas:**

1. **Modelos oficiais não existem no sistema.** Expedito ficou de enviar. Não criamos modelos
   fictícios (proibido pela missão e, mais importante, um checklist de inspeção errado é risco real).
2. **Resposta de item é booleana.** Serve para conforme/não-conforme, mas não cobre leitura numérica
   (pressão de pneu, km), seleção múltipla, nem **foto por item**. Se os modelos do Expedito exigirem
   isso, é mudança de schema — a decidir **depois** de ver os modelos.

## 15. Portal Saúde / Segurança (R09)

**Divergente do solicitado.** `src/app/(protected)/_components/nav-menu.tsx` (916 linhas, mega-menu
por categoria) organiza em cinco grupos de primeiro nível:

| Grupo               | Conteúdo                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | `/dashboard`                                                                                                                                                                |
| Módulos             | PGR, Estoque de EPI, Devoluções de EPI, Inspeções (Veiculares/Segurança/Equipamentos), Permissões de trabalho                                                               |
| Cadastro            | Empresas, Unidades de Obra, Funções, GES, Funcionários, **Médicos**, Categorias, Treinamentos, Controle de Formulários, EPI, Incidentes, Veículos, Planos de Inspeção       |
| Gestão de Segurança | Riscos Psicossociais, Fatores de Risco Psicossocial, **Gestão de Saúde (ASO)**, Gestão de Incidentes, Planos de Ação, OS, Metodologia de Risco, Riscos, Auditorias de Risco |
| Qualidade           | GED                                                                                                                                                                         |

Os itens de Saúde estão **dentro de Segurança** ("Gestão de Saúde (ASO)") e **dentro de Cadastro**
("Médicos"). Não há vertente SAÚDE de primeiro nível, nem separação visual, nem acesso por papel
diferenciado entre as duas áreas.

A reorganização é **de navegação**, não de arquitetura: PGR segue o núcleo de Segurança, as rotas não
mudam, nada de microsserviço ou divisão de repositório (explicitamente fora de escopo). Precisa de
**decisão de produto** sobre onde cai cada módulo ambíguo — Incidentes/CAT, Psicossocial e OS têm
leitura nas duas vertentes.

## 16. Saúde e clínicas (R10, R11)

### R10 — inventário honesto

| Módulo citado          | Estado                | Evidência                                                                                                                                                                                       |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ASO**                | **existe**            | `health_exams` (`employee_id`, `doctor_id`, `exam_type`, `performed_at`, `valid_until`, `aptitude`, `notes`, `certificate_path`); `/health-exams` + `new` + `[id]/edit`; REST `v1/health-exams` |
| **Medicina / médicos** | **existe**            | `medicos` (`name`, `crm`, `specialty`, `clinic`, `phone`, `status`); `/medicos` + `new` + `[id]/edit`; REST `v1/medicos`                                                                        |
| **CAT**                | **parcial — interno** | `accidents.cat_number` + `cat_issued_at`; comentário no schema é explícito: _"CAT é registro INTERNO: campos código/descrição são textuais e opcionais; sem emissão S-2210"_                    |
| **PCMSO**              | **não existe**        | grep por `pcmso` → 1 arquivo (menção isolada), nenhuma tabela, nenhuma rota                                                                                                                     |
| **Absenteísmo**        | **não existe**        | grep por `absente` → **zero** arquivos                                                                                                                                                          |

`accidents` é rico (28 colunas: natureza da lesão, parte do corpo, agente causador, causas, impacto
ambiental, perda material, terceiros, potencial de fatalidade, testemunhas, investigação, afastamento,
horas trabalhadas) — base sólida para CAT e para indicadores de absenteísmo, se e quando forem
priorizados.

### R11 — fluxo inexistente

O fluxo da reunião (empresa solicita exame → clínica recebe e-mail → clínica acessa portal → exame
realizado → ASO anexado) **não existe em nenhuma etapa**:

- **clínica não é entidade** — é o campo texto `medicos.clinic`;
- **não há solicitação de exame** — `health_exams` registra o exame **já realizado**;
- **não há capacidade de e-mail no projeto**: grep por `resend`, `nodemailer`, `sendmail`,
  `sendEmail`, `exam_request` → **zero**. Mandar e-mail é infraestrutura nova, não só uma tela;
- **não há acesso externo de clínica**. O padrão para isso já existe e é reutilizável — rota pública
  por token com policy de capability (`withSignatureToken`, usado em `/sign/[token]`,
  `/signature-requests/[token]`, `/psychosocial-response/[campaignId]/[token]`) — mas nunca foi
  aplicado a clínica.

Depende do protótipo do Dr. Alcides. **Nenhum fluxo clínico foi inventado.**

## 17. Psicossocial (R12)

**Implementado e mais maduro que o pedido da reunião.** `src/shared/db/schema/psychosocial.ts` traz 6
tabelas: `psychosocial_campaigns`, `psychosocial_questions`, `psychosocial_responses`,
`psychosocial_answers`, `psychosocial_risks`, `psychosocial_risk_factors`. Enums:
`psychosocial_campaign_status`, `psychosocial_question_type`, `psychosocial_risk_level`,
`psychosocial_factor_status`.

- **Anonimato real**: `psychosocial.ts:140` — _"Token do participante — anônimo (não vincula ao
  trabalhador), único"_. A resposta não tem FK para `employees`.
- **Coleta pública**: `(public)/psychosocial-response/[campaignId]/[token]`, liberada em `proxy.ts`
  com credencial = token da campanha (policy de capability), **nunca** sessão Clerk.
- **Telas**: `/psychosocial/campaigns` (+ `new`, `[id]`), `/psychosocial/risk-factors` (+ `new`,
  `[id]/edit`).
- **REST**: campanhas, perguntas (com `reorder`), riscos, `register`, `stats`, `status`, `conclude`,
  além de `psychosocial-risk-factors`.
- **Integração NR-17 já existe**: `ergonomic_evaluations.psychosocial_campaign_id`
  (`schema/ergonomics.ts`, `ON DELETE SET NULL`) referencia **campanha agregada encerrada da mesma
  unidade** — e o domínio só expõe `PSYCHOSOCIAL_AGGREGATE_LABEL`, sem pontuação individual. Decisão
  da fatia 017/Lote 3 mantida: **nenhuma pontuação COPSOQ foi inventada**.

**A conferir com o interessado:** a reunião fala de "formulário respondido por empresas em etapa
posterior". O fluxo atual é respondido por **trabalhadores anonimamente**. São coisas diferentes — pode
ser um instrumento novo (autoavaliação da empresa) e não o questionário existente. **Não
reimplementamos nada por suposição.**

## 18. Emoflow (R13)

`grep -rli "emoflow"` em `src/` e `docs/` → **zero ocorrências**. Sem menu, sem rota, sem link, sem
autenticação compartilhada, sem referência ao projeto em qualquer lugar do repositório.

A reunião informa que o Emoflow "já está pronto" e deve entrar como opção na plataforma. Para isso
precisamos, de quem é dono do Emoflow: URL de produção, modelo de autenticação (SSO? Clerk
compartilhado? token?), se é link externo ou embed, e se há dado trafegando. **Nenhuma API foi
inventada.**

## 19. GED (R14)

**Adiado por decisão da reunião** — auditado apenas para registrar impacto sobre os prioritários.

O que já está em pé: `folders` (hierarquia com unicidade de irmão via `UNIQUE … NULLS NOT DISTINCT`) e
`documents` (`document_group_id` + `version` = uma linha por versão, `doc_type` texto livre,
`status`, `storage_path`, `size_bytes`, `valid_until`, vínculo polimórfico
`related_entity_type`/`related_entity_id`), além de `jobs` (fila com claim atômico
`FOR UPDATE SKIP LOCKED`). Telas `/documents`, `/documents/new`, `/form-controls` (+ `new`,
`[id]/edit`). REST com `versions`, `move`, `download`.

**Impacto sobre os prioritários — dois pontos:**

1. O **checklist NR-18** (R16/Lote 3) lê os anexos do GED (`listPgrNr18Documents`). Se o GED parar, o
   checklist continua funcionando, mas permanece vazio enquanto ninguém anexar documento.
2. O **ART** do responsável técnico aparece no PDF como `artDocumentName` — vem do GED. Mesma
   observação.

Nenhum trabalho de GED (Lotes 5–7) foi iniciado.

## 20. Dependências com Douglas (R15, R16)

**O que foi verificado, e como.**

- `pgr-pdf-template.ts` na develop tem 6 commits: `faadc91` (Douglas, geração via Gotenberg),
  `2f1eb46` e `d660e33` (Douglas, logo/site e ART), `c74458b`, `d6abdc7`, `6d4bcf3` (CarlosVictor7,
  estrutura #47, NR-17, NR-18+EPI). Autoria: **3 Douglas Oliveira, 3 CarlosVictor7**.
- `git branch -r | grep -iE "template|pdf|douglas|preench"` sobre as **101** branches remotas →
  **nenhuma**.
- `gh pr list --state open` → **0 PRs abertas**.
- Clone local `Dougladmo/sst-manager`: o template está em `faadc91` apenas, **mais antigo** que a
  develop do PGR; nada de novo ali.

**Classificação (como a missão exige):** o template atualizado e a lógica de preenchimento são
**trabalho confirmado pelo responsável, ainda não disponível para revisão no repositório**. Não é
trabalho ausente. **Nada do template foi alterado** — arquivos de PDF intocados nesta branch.

**Contrato mínimo que precisamos fornecer** para que o preenchimento dele consiga atender R01, R02 e
R03. Proposta de extensão **aditiva** de `PgrConsolidated` (campos opcionais, nenhum breaking change,
**zero migration** — tudo derivado):

```ts
// 1. R01 + R03 — funções do GES, com hierarquia e treinamentos
type ConsolidatedJobRole = {
  id: string;
  title: string;
  cbo: string | null;
  sector: string | null;
  workerCount: number; // de ges_job_roles.worker_count
  workSchedule: string | null;
  // R01: hierarquia consolidada dos riscos do GES desta função
  controlsByLevel: {
    level: ControlLevel; // elimination | collective_protection | administrative | ppe
    label: string; // controlLevelLabel(level)
    measures: {
      riskId: string;
      riskDescription: string;
      applicable: boolean;
      status: ControlMeasureStatus | null;
      actionWhat: string | null;
      actionResponsible: string | null;
      actionDeadline: string | null;
    }[];
  }[];
  // R03: treinamentos obrigatórios da função (job_role_required_trainings → training_catalog)
  requiredTrainings: {
    id: string;
    number: number;
    name: string;
    referenceNorm: string | null;
    workloadHours: number;
    periodicity: TrainingPeriodicity;
  }[];
};

// 2. ConsolidatedGes ganha a lista (opcional, para não quebrar fixtures)
type ConsolidatedGes = {
  id: string;
  name: string;
  risks: ConsolidatedRisk[];
  jobRoles?: ConsolidatedJobRole[]; // NOVO
};

// 3. R02 — ação normativa por classificação, já escrita em methodology.ts
type ConsolidatedRisk = {
  /* …campos atuais… */
  resultGuidance?: string | null; // NOVO: riskClassificationGuidance(result)
};
```

Quatro pontos de alinhamento com o Douglas, nenhum deles editável por nós:

1. aceitar os três campos opcionais acima no template;
2. decidir se a tabela de treinamentos por função é **seção própria** ou subtabela dentro do GES;
3. decidir onde a hierarquia por função entra (seção de controles por função × dentro de cada risco);
4. decidir se `resultGuidance` imprime junto da classificação ou em coluna separada.

**Arquivos de maior risco de conflito** (evitar mexer sem combinar): `pgr-pdf-template.ts`,
`pgr-pdf-core.ts`, `pdf-batch-core.ts`, `api/v1/pgr/[id]/pdf/route.ts`, `integrations/pdf/*`.
`pgr-consolidated.ts` é o **ponto de encontro**: nós podemos estender (campos opcionais, aditivos), ele
consome.

## 21. Lacunas confirmadas

Com evidência, prontas para planejamento:

| #   | Lacuna                                                          | Req.        | Evidência                                                        | Migration?                          |
| --- | --------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- | ----------------------------------- |
| 1   | Não existe tela de detalhe de função (`/job-roles/[id]`)        | R01         | inventário de 128 páginas: só `/job-roles`, `/new`, `/[id]/edit` | não                                 |
| 2   | Hierarquia de controles não é consultável por função            | R01         | `control_measures` é por risco; `uq(org,risk,level)`             | não (derivável por `ges_job_roles`) |
| 3   | `PgrConsolidated` não conhece função                            | R01/R03/R16 | `grep jobRole pgr-consolidated.ts` → 0                           | não                                 |
| 4   | Ação por classificação não entra no PDF                         | R02         | `pgr-pdf-template.ts` usa label e coverage, não guidance         | não                                 |
| 5   | Treinamentos por função só na tela de edição                    | R03         | `required-trainings.tsx` ausente de `job-roles/new`              | não                                 |
| 6   | Landing pública sem apresentação, áreas, orçamento              | R04         | `(public)/page.tsx` 42 linhas; UI real verificada                | não                                 |
| 7   | Sem pré-cadastro de interessados                                | R04         | nenhuma tabela de lead no schema                                 | **sim**                             |
| 8   | Overflow horizontal em `/sign-in` e `/sign-up`                  | R05         | 375px: 399>360; 768px: 765>753                                   | não                                 |
| 9   | Clerk anuncia "sst-manager" nas telas de login                  | R05/R06     | texto real do widget                                             | não (config Clerk)                  |
| 10  | EPI espalhado: entrega sem entrada de menu, 3 itens em 2 grupos | R07         | `nav-menu.tsx`; entrega só em `/employees/[id]`                  | não                                 |
| 11  | Resposta de item de inspeção é só booleana                      | R08         | `inspection_item_responses.value: boolean`                       | **possivelmente**                   |
| 12  | Sem vertente SAÚDE de primeiro nível no menu                    | R09         | 5 grupos, Saúde dentro de Segurança/Cadastro                     | não                                 |
| 13  | PCMSO inexistente                                               | R10         | grep: 1 menção, 0 tabelas                                        | sim (quando priorizado)             |
| 14  | Absenteísmo inexistente                                         | R10         | grep: 0 arquivos                                                 | sim (quando priorizado)             |
| 15  | Clínica não é entidade; sem solicitação de exame; sem e-mail    | R11         | `medicos.clinic` texto; grep de e-mail → 0                       | sim (quando priorizado)             |
| 16  | Emoflow sem nenhum ponto de integração                          | R13         | grep → 0                                                         | não                                 |

## 22. Lacunas não verificáveis

Dependem de material ou decisão externa e **não** foram classificadas como ausentes:

| Item                                               | Responsável         | Por que não é verificável aqui                                                                     |
| -------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Template atualizado do PGR                         | Douglas             | não publicado em nenhuma branch/PR acessível (101 branches, 0 PRs); confirmado por ele verbalmente |
| Lógica de preenchimento em evolução                | Douglas             | mesmo motivo; pode estar só na máquina dele                                                        |
| Modelos oficiais de inspeção                       | Expedito            | ficou de enviar; criar modelo fictício seria inventar requisito                                    |
| PGR marcado com conteúdo fixo                      | interessado         | documento não recebido                                                                             |
| Protótipo do fluxo de clínicas                     | Dr. Alcides         | protótipo externo não disponível                                                                   |
| Referência visual ESO                              | interessado         | não há material; não copiamos marca de terceiro                                                    |
| Quais NRs cada função exige                        | profissional de SST | decisão normativa; não inventamos regra                                                            |
| Nomenclatura "minimizar" × `collective_protection` | profissional de SST | divergência registrada, não resolvida                                                              |
| Se o psicossocial da reunião é o fluxo existente   | interessado         | pedido fala de empresa respondendo; fluxo atual é trabalhador anônimo                              |
| Dados de integração do Emoflow                     | dono do Emoflow     | URL, autenticação, embed × link                                                                    |

## 23. Riscos técnicos

1. **`PgrConsolidated` é consumido por dois caminhos** — rota síncrona `api/v1/pgr/[id]/pdf` e worker
   `pdf-batch-core`. Qualquer extensão precisa valer nos dois; um campo opcional lido só num deles
   gera PDF diferente dependendo de como foi gerado.
2. **Conflito de merge no PDF** é o risco mais concreto: Douglas está evoluindo `pgr-pdf-template.ts`
   fora do repositório. Mitigação: só estendemos `pgr-consolidated.ts` com campos **opcionais** e
   deixamos o template para ele.
3. **Pré-cadastro público é uma superfície de escrita não autenticada** — a primeira do produto. Todas
   as rotas públicas existentes hoje são **leitura+escrita por token** (assinatura, psicossocial), com
   isolamento derivado do token. Um formulário de orçamento aberto na internet não tem token: precisa
   de desenho explícito (tabela sem tenant? rate limiting? captcha? o `ensure_rls` de produção exige
   policy mesmo em tabela global — precedente em `caepi_certificates`). **Não decidir isso por
   suposição.**
4. **A derivação por função pode ficar caro**: função → GES (N:N por `ges_job_roles`) → riscos →
   medidas. Um PGR grande multiplica rapidamente. Medir antes de levar ao PDF.
5. **`reference_norm` é texto livre.** Agrupar treinamentos por NR no PGR impresso dependerá de dado
   digitado de forma consistente ("NR-6" × "NR 6" × "NR06"). Normalização na leitura resolve sem
   migration, mas precisa ser decidida.
6. **Divergência de nomenclatura da hierarquia** (item acima): mudar o enum exigiria migration e
   reescrita de 19 arquivos. Rotular na leitura é reversível. Preferir rótulo.
7. **Dois repositórios divergentes na máquina** (`Projetos-sst/pgr` em 52 migrations ×
   `Dougladmo/sst-manager` em 31). Risco de alguém trabalhar no clone errado. A fonte de verdade é
   `Projetos-sst/pgr`.
8. **Conflito de porta 3000** entre o `pmpa-frontend` (Docker) e o `npm run dev` do PGR — ver
   DOCKER-AUDIT §6.4.
9. **Falha ambiental de baseline**: `tsc` lê `.next/dev/types/routes.d.ts` sendo escrito pelo dev
   server e reporta ~45 `TS1005` falsos. Não é defeito de produto; parar o dev server e remover
   `.next/dev` resolve.

## 24. Perguntas de produto

Registradas para decisão — nenhuma foi respondida por suposição:

1. **R09** — onde cai cada módulo ambíguo na divisão Saúde × Segurança (Incidentes/CAT, Psicossocial,
   OS, Treinamentos)? A separação é só de menu ou também de permissão por papel?
2. **R04** — o pré-cadastro de interessados deve virar registro no banco, e-mail para a equipe
   comercial, ou os dois? Que campos são obrigatórios?
3. **R04** — "Solicitar Orçamento" é formulário próprio ou o mesmo pré-cadastro com outra chamada?
4. **R04** — as áreas Saúde e Segurança na landing são seções da mesma página ou rotas próprias
   (`/saude`, `/seguranca`)?
5. **R01** — a hierarquia por função deve mostrar as medidas dos riscos de **todos** os GES da função,
   ou só do GES selecionado?
6. **R01** — "minimizar" da reunião é `collective_protection` do sistema? (precisa de profissional de
   SST)
7. **R03** — no PGR impresso, a tabela de treinamentos é por função, por GES, ou uma tabela geral do
   documento?
8. **R02** — a ação por classificação deve sair impressa em todo risco do PDF, ou só a partir de
   moderado?
9. **R12** — o formulário psicossocial "respondido por empresas" é instrumento novo ou é o
   questionário anônimo existente?
10. **R13** — o Emoflow entra como link externo, embed, ou módulo integrado com sessão compartilhada?
11. **R06** — existe material aprovado da referência ESO que possamos usar sem copiar marca?
12. **R08** — os modelos do Expedito exigem resposta não-booleana (numérica, foto, múltipla escolha)?

## 25. Priorização

**P0 — PGR e acesso (próximos lotes)**

| Item                                                | Req. | Por quê                                                            |
| --------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| Visão de função: detalhe + hierarquia de controles  | R01  | pedido direto; zero migration; destrava R16                        |
| Treinamentos por função no consolidado + na criação | R03  | pedido direto; zero migration; destrava a tabela automática do PGR |
| Contrato de dados para o PDF (campos opcionais)     | R16  | **bloqueia o Douglas**; deve sair antes do resto                   |
| Ação por classificação no PDF                       | R02  | lacuna de uma linha de template                                    |
| Landing pública                                     | R04  | maior lacuna funcional; prioridade da reunião                      |
| Pré-cadastro de interessados                        | R04  | única migration do P0; exige desenho de rota pública de escrita    |
| Correção de overflow no login                       | R05  | bug real medido; telas de login são prioridade da reunião          |

**P1 — organização de módulos**

| Item                                                        | Req.                         |
| ----------------------------------------------------------- | ---------------------------- |
| Hub unificado de EPI (navegação/agregação, sem módulo novo) | R07                          |
| Reorganização do menu em Saúde × Segurança                  | R09                          |
| Identidade visual na landing e nas telas públicas           | R06                          |
| Importar modelos oficiais de inspeção                       | R08 (bloqueado por Expedito) |

**P2 — etapas posteriores (não iniciar)**

Saúde (PCMSO, absenteísmo, CAT oficial) · clínicas e exames · Emoflow · psicossocial adicional · GED.

**Dependência P1 que bloqueia P0:** nenhuma funcionalidade. Mas há uma **dependência de decisão**: a
pergunta 4 da seção 24 (áreas Saúde/Segurança são seções ou rotas) molda a estrutura da landing (P0) e
a reorganização do menu (P1). Responder antes de começar o P0 de R04 evita retrabalho.

## 26. Recomendação final

Começar pelo **contrato de dados do PDF** (R01 + R03 + R02 expostos em `PgrConsolidated` como campos
opcionais). É o único item do P0 que **destrava outra pessoa** — o Douglas precisa dele para
preencher. É também o mais seguro: derivação pura, zero migration, zero mudança de RLS, nenhum arquivo
de template tocado.

Na sequência, a **visão de função** (tela de detalhe `/job-roles/[id]` com hierarquia e treinamentos),
que consome exatamente o mesmo contrato e entrega o pedido R01/R03 na interface.

Depois a **landing pública** — mas só após as respostas das perguntas 2, 3 e 4 da seção 24, porque a
decisão sobre pré-cadastro define se há migration e qual desenho de isolamento a rota pública de
escrita precisa.

A correção do **overflow do login** é pequena e independente: pode entrar como fix no primeiro lote.

**Não começar** por R07/R09: são reorganização de navegação, valem muito em percepção, mas não
destravam ninguém e dependem de decisão de produto sobre a divisão Saúde × Segurança.

Ver [PLAN.md](PLAN.md) para a divisão em lotes e [TASK.md](TASK.md) para o checklist.
