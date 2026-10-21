# Lote 04 — ASO · AUDIT

> Base: `origin/develop` = `d6b787c` (21/10/2026). Não repete a Fase 0: resume e aponta a seção de origem.
> [README do lote](README.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

## 1. Situação existente

**O ASO hoje é registro, não emissão.** Existe o CRUD de exames (fatia 027, migration `0030_health_exams`, RLS de módulo
`medicine` desde a `0053`). Não existe documento de ASO, snapshot, estado de emissão, nem assinatura do médico.
Fonte: [GAP-MATRIX MED-05, MED-19](../../GAP-MATRIX.md); [AUDIT-DATABASE §5](../../AUDIT-DATABASE.md).

| Peça | Estado | Evidência (arquivo:linha em `d6b787c`) |
|---|---|---|
| Registro de exame (tipo, data, validade, aptidão, médico, observações, caminho do certificado) | implementado | `src/shared/db/schema/health-exams.ts:19-57` |
| RLS de módulo no exame | implementado (RESTRICTIVE via `employees.company_id` + `medicine`) | `health-exams.ts:63` (`health_exams_module_access`) |
| Exame apagado junto com o funcionário | **CASCADE** | `health-exams.ts:50` |
| Autoria do médico | **SET NULL** ao apagar o médico | `health-exams.ts:51` |
| `notes` livre (canal de dado clínico sem classificação) | implementado | `health-exams.ts:56`; campo "Observações" em `src/app/(protected)/health-exams/_components/health-exam-form.tsx:159-163` |
| Certificado | texto digitado, sem GED | `health-exams.ts:57` (`certificate_path`) |
| Médico | catálogo do escritório; CRM sem UF; sem vínculo a usuário | `src/shared/db/schema/medicos.ts:33,43` (`uq_medicos_org_crm`) |
| Fila de documentos | só `pgr` | `src/shared/domains/documents/pdf-batch.ts:9` (`z.enum(["pgr"])`) |
| Worker | renderiza **dados vivos** no processamento | `src/shared/server/platform/pdf-batch-core.ts:34` (`generatePgrDocx`) |
| GED | status só `generating\|ready`; sem hash, sem `company_id`, sem policy de módulo; runtime com UPDATE/DELETE | `src/shared/db/schema/documents.ts:23,64-71`; [AUDIT-DATABASE §4.6](../../AUDIT-DATABASE.md) |
| Registry de assinatura | `demo`, `inspection`, `pgr`, `service_order` — **sem `aso`** | `src/shared/domains/signatures/contract.ts:13-18` |
| Template DOCX | só PGR, gerado por script | `scripts/pgr-docx/*`, `templates/pgr/` |
| Fluxo de emissão/assinatura | só documentado; quem elabora/revisa/emite/assina explicitamente pendente | `docs/produto/08-fluxos-emissao-assinatura.md` (NOB-101; ver [AUDIT-LINEAR-QA §4.5](../../AUDIT-LINEAR-QA.md)) |

## 2. O que o protótipo faz (referência de comportamento, não de código)

Fonte: [AUDIT-PROTOTYPE §5.6, §5.13, §5.14](../../AUDIT-PROTOTYPE.md), pacote Projeto-SST-Ocupacional V17 (fora do repositório).

- Telas P-11 (lista), P-12 (form) e P-13 (documento). O formulário tem funcionário, tipo, data, conclusão, médico
  examinador + CRM, procedimentos com data e observações.
- **Snapshot parcial** (`snapASO`): congela empresa, CNAE/GR, função/setor, riscos e médico do PCMSO, **mas** o documento
  lê nome, CPF e nascimento **ao vivo**. Na plataforma o snapshot precisa ser completo.
- Validação: ASO sem funcionário ou sem médico é bloqueado; o CRM não é validado.
- "Assinatura": linhas de assinatura manuscrita ("Médico examinador", "Ciente — trabalhador"); nenhum documento tem
  assinatura eletrônica ou digital.
- A empresa consegue emitir e editar ASO próprio (R-05). "Aprovar como \<médico\>" é clicado pelo editor (R-04).
  **Ambos não devem ser reproduzidos.**
- Jornadas: J-01 (empresa solicita exame), J-02 (clínica conclui e emite ASO), J-03 (médico **sem jornada própria**).

## 3. Lacunas

| # | Lacuna | Fonte |
|---|---|---|
| L1 | Médico sem identidade (UF do CRM, RQE, usuário) e sem designação por empresa: ninguém pode emitir ou assinar como médico | [AUDIT-DATABASE §6.1](../../AUDIT-DATABASE.md); MED-04 |
| L2 | Campos obrigatórios do ASO e fronteira conclusão × dado sigiloso não definidos | A-03; [AUDIT-SECURITY §10.1](../../AUDIT-SECURITY.md) |
| L3 | Quem pode emitir (só médico/clínica × escritório × empresa) não definido | A-05 |
| L4 | Sem procedimentos por exame | MED-09 (Lote 02, P4) |
| L5 | Sem histórico de função: o ASO não sabe a função na data do exame | MED-12 (P3) |
| L6 | Sem snapshot de entrada; o worker lê dados vivos | [AUDIT-DATABASE §4.6 item 1](../../AUDIT-DATABASE.md) |
| L7 | GED sem hash, sem estado de emissão, sem `company_id` e sem restrição de módulo; ASO no GED ficaria visível ao escritório inteiro e apagável | [AUDIT-DATABASE R7](../../AUDIT-DATABASE.md) |
| L8 | Sem assinatura técnica (hash do documento, identidade verificada, evidências, ICP-Brasil) | [AUDIT-DATABASE §4.6 itens 5-6](../../AUDIT-DATABASE.md) |
| L9 | Sem consumidor `aso` no registry de assinatura (ciência do trabalhador) | `contract.ts:13-18` |
| L10 | `health_exams` sem `company_id`: a visibilidade segue `employees.company_id`, que muda na transferência | MED-05 (Lote 02) |
| L11 | Sem trilha de auditoria persistida de leitura/escrita do ASO | MED-10 (P9, Lote 02) |
| L12 | Exclusão física/CASCADE do exame; prazo de guarda não decidido | MED-11, A-07 |

## 4. Riscos

| # | Risco | Severidade | Mitigação prevista |
|---|---|---|---|
| R1 | Captura simples (nome + PNG) apresentada como assinatura técnica do médico | Alta (jurídico) | separar ciência do trabalhador (registry) de assinatura técnica (P8); estado "emitido, sem assinatura técnica" |
| R2 | ASO refletindo dado alterado entre o enfileiramento e o render | Alta | render **do snapshot**, nunca de dados vivos (P7) |
| R3 | Regressão no GED do PGR ao mudar `documents` ou o worker | Alta | desenho aprovado pelo Douglas; teste de regressão do PGR obrigatório |
| R4 | ASO listando risco não validado como se fosse validado | Alta (clínico) | aguardar A-04; só `medical_risk_*` com `canUseMedicalRisk` |
| R5 | Owner/colaborador "emitindo" como médico | Alta | P1 + verificação no servidor e no banco |
| R6 | Dado clínico (restrições, observações) visível a toda a equipe do escritório | Alta (P0 para dado clínico) | A-03 + camada clínica ([AUDIT-SECURITY §10.3](../../AUDIT-SECURITY.md)) |
| R7 | Colisão de migrations com a PR #112 e aplicação automática em homologação no merge | Alta | uma migration por PR, depois da decisão D-01/D-07 |

## 5. Dependências

Ver a seção "Dependências" do [README](README.md), o [PLAN §4 e §8](PLAN.md) e [DEPENDENCIES.md §1](../../DEPENDENCIES.md). Peças
reaproveitáveis (não reconstruir): `documents`/`document_group_id`, `jobs` `pdf_batch` com `kind` novo no payload,
worker, Gotenberg, `docxtemplater`, padrão `scripts/pgr-docx`, registry de assinatura (só ciência)
([DEPENDENCIES.md §4](../../DEPENDENCIES.md)).

## 6. Decisões técnicas (estado)

| Tema | Estado | Fonte |
|---|---|---|
| Separar dado-fonte vivo de documento emitido (snapshot imutável na mesma transação da emissão) | **PROPOSTO** | [AUDIT-DATABASE §10.3](../../AUDIT-DATABASE.md) |
| Estender `documents` × tabelas próprias de Medicina | **PENDENTE** (D-06, Douglas) | DECISIONS |
| Estados `draft → in_review → issued → signed → rectified/cancelled` | **PROPOSTO**, depende de A-09 | AUDIT-DATABASE §10.3 |
| Registry `aso` só para ciência do trabalhador | **PROPOSTO** | MED-21 |
| Remover NOB-110 → NOB-113 no Linear | **PENDENTE** (A-02 + D-10) | DECISIONS |
| Não reconstruir o gerador do PGR | **decisão tomada** (respeitar) | [DECISIONS §3](../../DECISIONS.md) |
