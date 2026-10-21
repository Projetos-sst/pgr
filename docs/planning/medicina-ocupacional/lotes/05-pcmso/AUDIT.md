# Lote 05 — PCMSO · AUDIT

> Base: `origin/develop` = `d6b787c` + PR #112 aberta (21/10/2026). Resume a Fase 0; não a repete.
> [README do lote](README.md)

## 1. Situação existente

**Não existe PCMSO na plataforma.** Nenhuma tabela, rota, domínio ou template. Fonte: [GAP-MATRIX MED-22, MED-23](../../GAP-MATRIX.md);
NOB-101 confirma "PCMSO: fluxo ainda não implementado" (`docs/produto/08-fluxos-emissao-assinatura.md`, ver
[AUDIT-LINEAR-QA §4.5](../../AUDIT-LINEAR-QA.md)).

| Peça que o PCMSO consumiria | Estado | Evidência |
|---|---|---|
| Empresa, GES, função, vínculo GES↔função | implementado (cadastros comuns, NOB-99) | `companies`, `ges`, `job_roles`, `ges_job_roles` ([AUDIT-DATABASE §4.2](../../AUDIT-DATABASE.md)) |
| Risco por **GES** (não por função) | implementado | `risks.ges_id`; o protótipo modela por função |
| Fontes de risco para Medicina (interna/externa, imutáveis, fingerprint) | **só na PR #112** | `0054_medical_risk_sources`; [AUDIT-DATABASE §4.4](../../AUDIT-DATABASE.md) |
| Uso no PCMSO | `canUseMedicalRisk` = `validated` ∧ fresco | `domains/medicine/risk-sources.ts:88-96` (PR #112) |
| Fluxo de validação | **inexistente**; `validationAvailable: false` | `risk-source-core.ts:131` (PR #112) |
| Persistência de revisão | banco nega UPDATE (`REVOKE`) e só aceita INSERT `pending` | `0054_medical_risk_sources.sql:59,66-68` (PR #112) |
| Coordenador do PCMSO | inexistente; `medicos` sem usuário/UF | `src/shared/db/schema/medicos.ts:33,43` |
| Procedimentos / plano de exames | inexistente | MED-09 |
| Emissão com snapshot | inexistente; worker lê dados vivos | `src/shared/server/platform/pdf-batch-core.ts:34` |
| Lista C (vigilância NTEP) | inexistente; protótipo parcial (18 grupos, sem M e S/T) | [AUDIT-PROTOTYPE §5.12](../../AUDIT-PROTOTYPE.md) |

### Efeito da `0055` (PR #112)

Empresa só-Medicina, ou com PGR desligado, deixa de ver `risks`, avaliações, medidas, AEP e vínculo EPI pelo runtime. O
PCMSO dependerá **exclusivamente** de `medical_risk_*`. Decisão D-02 (Douglas, com ciência do Expedito) pendente.

### O que a #112 não cobre (relevante ao PCMSO)

Função e número de expostos na captura interna; classificação na fonte externa; medidas e EPIs; fluxo de validação;
fingerprint inclui `pgr.updated_at` (falso "changed"). Ajustes são **propostos ao Rikelvin**, não feitos por fora
([DEPENDENCIES §3.4](../../DEPENDENCIES.md)).

## 2. O que o protótipo faz (referência de comportamento)

Fonte: [AUDIT-PROTOTYPE §5.5, §5.6, §5.13](../../AUDIT-PROTOTYPE.md); pacote Projeto-SST-Ocupacional V17 (fora do repositório).

- Documento `docPCMSO` com identificação, objetivos, riscos por função (PGR + psicossocial ≥ médio), planejamento de
  exames por tipo, cronograma individual, vigilância NTEP (grupos da Lista C para a classe CNAE), relatório analítico.
  Vigência = data-base + 12 meses (**HIPÓTESE** normativa).
- **Gerado ao vivo, sem versão.** Não reproduzir.
- Validação (`barraValidacao`, C-03): um registro por empresa e tipo, estados `rascunho|revisao|aprovado|ajustes`, e
  **"Aprovar como \<médico\>"** clicado pelo editor (R-04). Não reproduzir.
- Periodicidade: `fn.periodicidade` ou 12/24 meses conforme haver riscos (**regra clínica não validada**, A-06, X-7).

## 3. Lacunas

| # | Lacuna |
|---|---|
| L1 | Programa, versão, vigência e coordenador por empresa |
| L2 | Plano de exames por GES/função com periodicidade aprovada |
| L3 | Revisão de riscos com identidade do revisor (P5) |
| L4 | Mapeamento risco-por-GES → exames-por-função (N:N via `ges_job_roles`) — regra clínica (Dr. Alcides) |
| L5 | Snapshot com `source_id` + `entry_id` + fingerprint e bloqueio de emissão com fonte não validada |
| L6 | Tratamento de PCMSO emitido sobre fonte que depois mudou (evento "fonte desatualizada") |
| L7 | Documento (template), emissão, assinatura do coordenador, GED |
| L8 | Seção NTEP sem dataset oficial |

## 4. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Emitir PCMSO com risco não validado | verificação transacional na emissão: toda fonte usada `validated` no momento |
| R2 | PCMSO "ao vivo" sem versão (como no protótipo) | versões imutáveis após `issued` |
| R3 | Leitura paralela de `risks` contornando a #112 | contrato único `medical_risk_*` |
| R4 | Aprovação em nome de terceiro | P1 + verificação no servidor e no banco |
| R5 | Seção NTEP com a Lista C parcial do protótipo | só com dataset oficial (P2); sem ele, seção omitida com aviso |
| R6 | Periodicidade do protótipo virando requisito sem validação | A-06 obrigatória antes de codificar |
| R7 | Colisão de migrations / aplicação automática em homologação | D-01/D-07; uma migration por PR |

## 5. Decisões técnicas (estado)

| Tema | Estado |
|---|---|
| PCMSO referencia `source_id`/`entry_id`/fingerprint no snapshot; nunca lê `risks` direto | **PROPOSTO** ([DEPENDENCIES §3.4](../../DEPENDENCIES.md)) |
| Plano de exames dentro do snapshot (preferível) × tabela filha imutável | **PROPOSTO**, aberto ([AUDIT-DATABASE P6](../../AUDIT-DATABASE.md)) |
| Revisão append-only (`medical_risk_entry_reviews`) × GRANT UPDATE por coluna | **PENDENTE** (R-02, Rikelvin + Carlos) |
| Quem valida / quem concede | **PARCIALMENTE_RESPONDIDA** (Expedito, 21/10) + A-01 pendente |
| Estados do documento | **PROPOSTO**, depende de A-09 |
