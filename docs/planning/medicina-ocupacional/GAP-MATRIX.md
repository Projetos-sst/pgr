# GAP-MATRIX: matriz mestra da Medicina Ocupacional

> Síntese do coordenador, 2026-10-21. Base: `origin/develop` = `d6b787c`, PR #112 aberta (`ebfbac3`) e o
> protótipo V17 (14/10/2026). As fontes de cada linha estão nos relatórios `AUDIT-*.md` desta pasta.
> Linear lido em 21/10. NOB-xx = issue do Linear; #nnn = PR do GitHub. **NOB-98 ≠ PR #98.**

**Legenda de estado:**

| Sigla | Significado |
|---|---|
| EV | existe e está validado |
| EP | existe parcialmente |
| PROTO | existe só no protótipo |
| NI | não implementado |
| DIV | divergente |
| EXT | depende de decisão externa |
| FORA | fora do MVP |

"Validado" exige CRUD mergeado com testes. **Nenhuma** tela de Medicina tem validação clínica registrada.

**Legenda de responsável:** C = Carlos · R = Rikelvin · D = Douglas · E = Expedito · A = Dr. Alcides. "sem" = issue sem
responsável. Quando o responsável proposto difere do responsável no Linear, a célula indica isso.

**Fontes (siglas):**

| Sigla | Fonte |
|---|---|
| PROTO | `Projeto-SST-Ocupacional/app/saude-ocupacional.html`; telas P-xx em AUDIT-PROTOTYPE §5.13 |
| SPEC | especificação do protótipo |
| PLAN | planilhas do protótipo |
| LIN | Linear |
| P1…P9 | propostas de migration de AUDIT-DATABASE §10.4, só descritas |

## Contagem

| Estado principal | Linhas |
|---|---|
| Existe e validado (EV) | 2 (MED-01, MED-02) |
| Parcial (EP) | 7 (MED-03, 05, 08, 13, 15, 28, 36) |
| Só no protótipo / não implementado (PROTO, NI) | 18 (MED-04, 06, 07, 09–12, 14, 16–24, 27) |
| Só decisão externa (EXT), sem código | 2 (MED-25, 26) |
| Divergente + externo (DIV+EXT) | 1 (MED-34, comercial) |
| Fora do MVP (FORA) | 7 (MED-29–33, 35, 37) |
| **Total** | **37 funcionalidades** |

Bloqueios (contados à parte, sobrepostos às linhas acima):
- **10 por decisão externa direta:** MED-04, 11, 14, 16, 19, 20, 24, 25, 26, 28.
- **2 bloqueadas em cadeia pela NOB-98:** MED-22, 23.

## Matriz

| ID | Área | Funcionalidade | Origem do requisito | Arquivo/fonte | Issue | Status Linear | Resp. | Código atual | Tabela atual | Lacuna | Contrato necessário | Migration proposta | Permissões | Risco | Dependências | Critério de aceite | Teste recomendado | Lote |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MED-01 | Plataforma | Habilitar Medicina por empresa-cliente | NOB-97/100 | `company-modules.ts`, `/companies/[id]/services` | NOB-97, NOB-100 | Done | R | EV (#109, #111) | `company_modules`, `company_module_events` | Empresas criadas após a 0053 nascem **sem módulo** (`createCompany` não habilita). O menu é estático | — | — | só owner altera (aplicação); RLS RESTRICTIVE na leitura | empresa nova sem Medicina → FORBIDDEN/sumiço silencioso | — | estado vazio explícito nas telas de Medicina | `company-modules.test.ts` (existe) | 1 (só UX) |
| MED-02 | Cadastro | Empresa, funcionário, função e GES compartilhados | NOB-99 | `repositories/{companies,employees}.ts` (`?module=`) | NOB-99 | Done | R | EV (#110) | `companies`, `employees`, `job_roles`, `ges` | Sem NIT/CTPS. `UNIQUE(org,cpf)` impede o mesmo trabalhador em duas empresas do escritório | reutilizar; **nunca** CRUD paralelo | NIT: ALTER futuro (PPP/eSocial) | escritório | protótipo embute funções/riscos dentro da empresa (duplicação) | — | Medicina usa os mesmos IDs | `shared-company-records.test.ts` (existe) | 1 |
| MED-03 | Profissionais | Catálogo de médicos | PROTO P-42/43 | `/medicos` | NOB-121 | Backlog | C | EP (CRUD 0029) | `medicos` | Sem UF do CRM, RQE nem `user_id`. `UNIQUE(org,crm)` colide entre UFs. Sem psicólogos | identidade profissional | P1 (ALTER `medicos`) | escritório | autoria vira nula (SET NULL em `health_exams`) | MED-04 | CRM+UF únicos; vínculo opcional a usuário | `medicos.test.ts` (existe) + UF | 3 |
| MED-04 | Profissionais | Identidade do profissional + designação por empresa (coordenador/examinador) | NOB-98 (spec:55), NOB-121 crit. 3 | — | NOB-121 (C) / NOB-98 (R) | Backlog / In Progress | **EXT** (A+E regra, D modelo) | NI | — | Ninguém pode validar risco, assinar ASO ou coordenar PCMSO | `company_medical_assignments` + `medicos.user_id` | P1 | concede: a definir (E); valida: a definir (A) | "aprovar como" do protótipo (aprovação em nome de terceiro) | **decisão NOB-98** | profissional sem designação vigente é recusado no servidor **e** no banco | integração: revisor sem designação → FORBIDDEN | 3 |
| MED-05 | ASO | Registro de exame/ASO (não emissão) | PROTO P-11/12, NOB-110 | `/health-exams`, `repositories/health-exams.ts` | NOB-110, NOB-108 | Backlog / In Progress | C | EP (0030 + RLS 0053) | `health_exams` | Sem `company_id` (visibilidade segue `employees.company_id` mutável). Sem procedimentos. `notes` livre. DELETE físico + CASCADE. Erro aparece como lista vazia. Sem filtro por empresa. Formulário limitado a 200 funcionários | snapshot da empresa no exame | ALTER `health_exams` ADD `company_id` (Lote 2) | escritório; RLS medicine | perda de histórico; falso negativo clínico | — | exame mantém a empresa da data do exame; erro ≠ vazio | `health-exams.test.ts` + transferência de funcionário | 1 (UI) + 2 (schema) |
| MED-06 | ASO | Ficha "Saúde ocupacional" do funcionário (linha do tempo, validade) | PROTO P-04/05, P-59 | `/employees/[id]` (placeholder l.314) | NOB-108 | In Progress | C | NI | `health_exams` | Não existe visão por funcionário | leitura existente | nenhuma | escritório; seção só se `medicine` habilitado | mostrar periodicidade calculada = regra clínica não validada | — | seção lista exames e validade **informada** (`valid_until`), sem regra 12/24 | integração: empresa sem medicine não exibe seção | **1 (MVP)** |
| MED-07 | Navegação | Painel da Medicina (KPIs reais, pendências) | PROTO P-01 | `dashboard-widgets.tsx` (StatCard local) | NOB-108 | In Progress | C | PROTO | — | Sem `/medicine` | contagens `withOrg` | nenhuma | escritório | KPI fictício (proibido pela fatia 019) | MED-08 | só dado real; vazio com CTA para habilitar | unit do helper de KPI | 1 |
| MED-08 | Navegação | Gating, estados vazio/erro/loading nas telas de Medicina | AUDIT-UX §6 | `nav-menu.tsx` l.101, `health-exams/page.tsx` l.64 | NOB-108 | In Progress | C | EP | — | `NAV` estático; nenhum `loading.tsx`; erro vira vazio | expor módulos habilitados ao shell | nenhuma | — | usuário conclui "sem ASO" quando houve falha | — | erro mostra `ErrorState`; "nenhuma empresa com Medicina" com link | unit/RTL dos estados | **1 (MVP)** |
| MED-09 | ASO | Catálogo de procedimentos + procedimentos por exame | PROTO P-07/12, NOB-112 | — | NOB-112 | In Progress | C | NI | — | ASO não registra exames complementares | `exam_procedures`, `health_exam_procedures` | P4 | RLS medicine | guardar **resultado** clínico sem perfil clínico | MED-10 | MVP sem valores de resultado (só realizado/pendente) | `runIsolationSuite` + módulo off | 2 |
| MED-10 | Segurança | Trilha de auditoria persistida de dado de saúde | AUDIT-SECURITY R3, SPEC:215 | `audit-log.ts` (console) | — (sem issue) | — | C implementa no escopo Medicina; R revisa | NI | — | "Quem viu ou alterou o ASO X?" sem resposta | `medical_audit_events` append-only | P9 | runtime: só INSERT/SELECT | log com conteúdo clínico | — | toda leitura/escrita de exame gera evento sem conteúdo clínico | integração: evento na mesma transação; rollback | 2 |
| MED-11 | Segurança | Retenção: sem DELETE físico nem CASCADE de exames | AUDIT-SECURITY R4, PROTO `bloqueioExclusao` | FKs CASCADE (`health-exams.ts:48-50`) | — (sem issue) | — | **EXT** (A + jurídico: prazo); C implementa | NI | `health_exams`, `employees` | Excluir funcionário ou empresa apaga exames | arquivamento | ALTER (soft-archive) + troca de FK para RESTRICT | — | perda dentro do prazo de guarda (HIPÓTESE: 20/30 anos) | decisão de prazo | exclusão com exame vira arquivamento | integração: DELETE bloqueado | 2 (após decisão) |
| MED-12 | Cadastro | Histórico de função do trabalhador | PROTO `historico`, PPP | — | NOB-112 (parcial) | In Progress | C | NI | — | Exame de mudança de função e ASO com a função da data | `employee_job_assignments` | P3 | escritório (cadastro comum) | backfill impreciso (data de admissão) | — | um período aberto por funcionário | integração: sobreposição recusada | 4 |
| MED-13 | Integração | Fontes de risco para Medicina (interna/externa, imutáveis, fingerprint) | NOB-98 | branch `codex/NOB-98-…` | NOB-98 | In Progress | R | EP (**só PR #112 aberta**) | `medical_risk_*` (0054, não mergeada) | Base errada (branch do NOB-100); conflito no Postman; **nunca passou por CI**; 0055 esconde riscos de empresa sem PGR | **único contrato PGR→Medicina** | 0054/0055 (#112) | RLS medicine + INSERT só `pending` | merge = migration em homolog (CD) | retarget + decisão sobre a 0055 | PCMSO/ASO nunca leem `risks` direto | `medical-risk-sources.test.ts` (#112) | 0 |
| MED-14 | Integração | Validação/rejeição de risco para uso no PCMSO | NOB-98 crit. 1 | `canUseMedicalRisk` (#112) | NOB-98 | In Progress | R | NI — **BLOQUEADO POR DECISÃO** | — | Banco nega UPDATE; não há validador | revisões append-only | P5 | só profissional designado | owner "atestando" sem habilitação | MED-04 | sem validador, nenhum risco é "utilizável" (comportamento atual correto) | integração: revogação impede nova decisão | 3 (após decisão) |
| MED-15 | Integração | PGR externo (cadastro, documento no GED, UX) | NOB-111 | #112 já tem a fonte `external` | NOB-111 | Backlog | C | EP via #112 | `medical_risk_sources` | Sobreposição forte com a #112; sem upload; `reference` texto | FK opcional `reference_document_id` | ALTER na #112 ou depois | RLS medicine | dois contratos de PGR externo | MED-13 | **reescopar NOB-111 sobre a #112** | integração: externo nunca nasce validado | 3 |
| MED-16 | Referência | Lista C (NTEP: CID × CNAE, Anexo II do Decreto 3.048/99) | NOB-113, PROTO l.182 | — | NOB-113 | In Progress | C (carga) / **EXT** (A: fonte) | PROTO parcial (18 grupos, sem M e S/T) | — | Fonte oficial e versão não confirmadas. **Não é catálogo de exames** | dataset global com procedência | P2 | leitura global; escrita owner | importar a base parcial como oficial | resposta do Dr. Alcides | importador idempotente; base do protótipo só como teste de regressão | unit: reimportação idempotente | 3 |
| MED-17 | Referência | NR-4 (CNAE → grau) e eSocial tabela 24 | PROTO P-38 | `companies.risk_grade`, `risks.noxious_agent_code` (texto) | — (sem issue) | — | C | NI | — | Grau digitado; agente nocivo em texto livre | datasets globais | P2 | idem MED-16 | — | fonte oficial | sugestão, nunca bloqueio (padrão CAEPI) | idem | 3 (opcional) |
| MED-18 | Documentos | Emissão genérica com snapshot imutável + hash | AUDIT-DATABASE §10.3 | worker lê dados vivos (`pdf-batch-core.ts:34`) | NOB-110/109 (+ trabalho do Douglas) | Backlog | **D decide**; C implementa a parte de Medicina | NI | `documents` (sem hash, sem `company_id`, DELETE liberado) | Documento emitido pode refletir dado alterado | `document_issuances` + eventos | P7 | RLS por kind (aso/pcmso → medicine) | regressão no GED do PGR | aceite do Douglas | retry do job não altera o snapshot | integração: risco alterado após emissão não muda documento | 4 |
| MED-19 | ASO | Emissão de ASO (template, PDF, GED) | NOB-110, PROTO P-13 | — | NOB-110 | Backlog | C | NI | — | Campos obrigatórios e quem emite não decididos (NOB-101 deixou pendente) | snapshot do ASO | P7 | emite: a definir (A+E) | empresa emitindo ASO "próprio" (R-05 do protótipo) | MED-04, MED-18, decisão D4 | campos validados; documento imutável após emissão | E2E de emissão + download autorizado | 4 |
| MED-20 | Documentos | Assinatura técnica do médico (ICP-Brasil) | SPEC:195/257 | assinatura atual = nome + PNG | NOB-101 (docs), NOB-110 | Done (docs) / Backlog | **EXT** (E+D: provedor) | NI | `signature_*` | Sem hash do documento, sem identidade verificada | `technical_signatures` | P8 | médico designado | apresentar rabisco como assinatura técnica | provedor | assinatura vinculada ao `output_sha256` | integração com provedor mockado | 4b / backlog |
| MED-21 | ASO | Ciência do trabalhador no ASO | PROTO "Ciente" | registry de assinatura (sem alvo `aso`) | NOB-110 | Backlog | C | NI | `signature_requests` | Falta `target_type` | +1 entrada no registry (zero schema) | opcional: `document_sha256` | token de uso único | confundir com assinatura técnica | MED-19 | ciência ligada ao arquivo emitido | integração no padrão da 010 | 4 |
| MED-22 | PCMSO | Programa, versão, plano de exames por GES/função | NOB-109, PROTO P-16 | — | NOB-109 | Backlog | C | NI — **BLOQUEADO** (NOB-98) | — | Tudo | `pcmso_programs`, `pcmso_versions` | P6 | coordenador designado | PCMSO "ao vivo", sem versão (como no protótipo) | MED-04, 09, 13, 14, 18 | fonte usada precisa estar validada na emissão | integração: nova versão exige nova revisão | 5 |
| MED-23 | PCMSO | Documento do PCMSO | NOB-109 | pipeline DOCX do Douglas | NOB-109 | Backlog | C | NI | — | Template, seções (inclui vigilância NTEP → MED-16) | template-kit no padrão de `scripts/pgr-docx` | — | idem | — | MED-22 | documento igual ao snapshot | amostra de render | 5 |
| MED-24 | Clínica | Clínicas e encaminhamentos (guia → ASO) | PROTO P-06..P-10, P-62 | — | NOB-122 | Backlog | C | NI — **EXT** | — | Entidade clínica, status da guia | a definir | futura | clínica só vê guias próprias | resultados clínicos expostos à empresa (R-02) | MED-04, decisão de portal | — | `portal.py` como roteiro | 6 |
| MED-25 | Portais | Portal da empresa/RH | PROTO P-59..61 | `scoped_company_id` existe e não é usado | NOB-122/123 | Backlog | **EXT** (E) | EXT | `org_memberships` | Escopo por empresa inexistente; `client` é bloqueado em tudo | escopo por empresa (servidor + RLS) | futura | RH vê só a própria empresa e só a conclusão do ASO | expor resultado clínico ao RH | decisão D3 | — | — | 6+ |
| MED-26 | Portais | Portal da clínica | PROTO P-62 | — | NOB-122 | Backlog | **EXT** (E) | EXT | — | Ator externo novo | — | futura | — | clínica recebendo dado financeiro (R-03) | MED-24 | — | — | 6+ |
| MED-27 | Profissionais | Psicólogos (cadastro) | NOB-121 | — | NOB-121 | Backlog | C | NI | — | `medicos` não comporta | `health_professionals`? (decisão) | P1 estendida | — | — | MED-04 | — | — | 6 |
| MED-28 | Psicossocial | COPSOQ, grupo mínimo, dono do módulo | PROTO P-17..P-30 | `/psychosocial/*` (em "Gestão de Segurança") | — (sem issue de Medicina) | — | **EXT** (E+A+R) | EP + DIV | `psychosocial_*` | Média com n=1; link sem limite de envios; fora do gate medicine | a definir | — | agregado só com n ≥ mínimo | reidentificação | decisão de dono | — | — | fora dos lotes de Carlos até decidir |
| MED-29 | Afastamentos | Afastamentos, NTEP, kit INSS | PROTO P-31..P-35 | — | — (sem issue) | — | — | FORA | — | CID = dado sensível | — | — | perfil clínico | — | MED-16, MED-04 | — | — | backlog |
| MED-30 | Documentos | PPP (espelho) | PROTO P-14/15 | — | — (sem issue) | — | — | FORA | — | Histórico de função, LTCAT | — | — | — | — | MED-12 | — | — | backlog |
| MED-31 | Indicadores | Absenteísmo, FAP/RAT | PROTO P-36/37 | — | — | — | E | FORA | — | Salário, afastamentos | — | — | — | — | MED-29 | — | — | backlog |
| MED-32 | Serviços | Teleconsulta avulsa | NOB-120 | — | NOB-120 | Backlog | C | FORA | — | — | — | — | — | Res. CFM (HIPÓTESE) | NOB-117, NOB-121 | — | — | backlog |
| MED-33 | IA | IA assistiva para documentos de Medicina | NOB-125 | infra de IA (Mastra/OpenRouter `:free`) | NOB-125 | Backlog | C | FORA | — | **Nenhum dado de saúde em prompt**; política do provedor não verificada | — | — | — | o protótipo envia laudo com CPF à IA | decisão D8 | — | — | backlog |
| MED-34 | Comercial | Teste grátis, contratos, preços duplos, serviços avulsos | PLAN, PROTO P-39..P-61 | `/plans` (Pro/Stripe) | NOB-116/117/118 | Backlog | E / sem | DIV + EXT | — | Colisão de nome "Serviços" com `/companies/[id]/services` | — | — | — | restrição de impressão só no front (protótipo) | Expedito | — | — | fora da frente de Medicina |
| MED-35 | eSocial | S-2220 real a partir dos exames | — | builders stub (`esocial/builders.ts:61-91`) | — (sem issue) | — | E+D | FORA | `esocial_events` | Desligado de `health_exams` | — | — | — | — | — | — | — | backlog |
| MED-36 | QA | Isolation suite de saúde, seed de Medicina, E2E | NOB-128/129 | `runIsolationSuite` (20 tabelas, nenhuma de saúde) | NOB-128, NOB-129 | Backlog | sem | EP | — | Playwright fora do CI; falso verde sem `INTEGRATION_*` | — | — | — | regressão de isolamento | — | toda tabela nova de Medicina na isolation suite | ver AUDIT-LINEAR-QA §6.1 | contínuo (desde o 1) |
| MED-37 | Clínico | Fadiga, programa de crônicos, prontuário | PROTO P-27..29, P-50..52 | — | — | — | — | FORA | — | Prontuário exige papel clínico (R2, P0) | camada clínica (AUDIT-SECURITY §10.3) | — | só equipe de saúde | — | MED-04, MED-10 | — | — | backlog |

## Respostas que a matriz permite dar

- **O que já existe:** MED-01 e MED-02 (base do Rikelvin), e de forma parcial MED-03, 05, 08, 13, 15, 28, 36.
- **O que falta para a primeira entrega útil:** MED-06, 07 e 08 (Lote 1, zero migration). Ver FIRST-MVP.md.
- **O que está bloqueado:**
  - por decisão: MED-04, MED-14 → MED-22/23 (cadeia NOB-98);
  - pela fonte oficial: MED-16;
  - por prazo de guarda: MED-11;
  - por quem emite e campos do ASO: MED-19;
  - por provedor: MED-20;
  - por produto: MED-24/25/26/28.
- **O que roda em paralelo sem conflito:**
  - Carlos: Lote 1 (UI, zero migration);
  - Rikelvin: retarget e CI da #112;
  - Douglas: tokens/AA e primitives duplicadas;
  - Dr. Alcides: a Lista C.
- **O que exige decisão do Douglas:** ordem de merge e numeração de migrations; efeito da 0055; camada de emissão (MED-18); arquitetura A/B/C; dono da identidade profissional (NOB-121 × NOB-98); IA × saúde.
- **O que exige decisão do Expedito/Dr. Alcides:** validador (MED-04/14); campos e emissor do ASO (MED-19); prazo de guarda (MED-11); Lista C (MED-16); portais (MED-25/26); psicossocial (MED-28); habilitação de Medicina na criação da empresa (MED-01).
