# DEPENDENCIES: dependências e contrato Segurança → Medicina

> Coordenador, 2026-10-21. As dependências do Linear foram lidas via MCP (AUDIT-LINEAR-QA §4.3). As técnicas foram
> verificadas no código de `d6b787c` e na PR #112.

## 1. Cadeia crítica (o que trava o quê)

```
Pergunta NOB-98 (Expedito + Dr. Alcides + Douglas)   ← sem registro no Linear; só no corpo da #112
        │
        ▼
Identidade profissional + designação por empresa (P1)   ← dono a decidir: NOB-121 × NOB-98
        │
        ├──► Revisão de riscos (P5, NOB-98 Rikelvin) ──► riscos "validated" ──► PCMSO (NOB-109) ──► NOB-128/129/130
        ├──► Emissão/assinatura de ASO (NOB-110)
        └──► Permissões por vínculo (NOB-121) ──► Clínica / portal (NOB-122) ──► NOB-123

PR #112 (retarget + CI + merge) ──► 0054/0055 aplicadas em homolog pelo CD ──► numeração livre para a Medicina (0056+)

Fonte oficial da Lista C (Dr. Alcides) ──► dataset P2 ──► NTEP / seção de vigilância do PCMSO
Prazo de guarda (Dr. Alcides + jurídico) ──► arquivamento no lugar de CASCADE
Provedor ICP-Brasil (Expedito + Douglas) ──► assinatura técnica (P8)
Desenho da camada de emissão (Douglas) ──► P7 ──► ASO/PCMSO como documento
```

**Fora da cadeia (pode andar já):** Lote 1 do FIRST-MVP; o mapa de campos da NOB-112; testes de isolamento das tabelas de
saúde existentes.

## 2. Dependências do Linear × realidade

| Relação no Linear | Situação real | Ação sugerida |
|---|---|---|
| NOB-108 bloqueada por NOB-94 | NOB-94 em **Backlog** e sem evidência, mas também bloqueia NOB-97 e NOB-101, que estão **Done** | Douglas decide: fechar, reescopar ou remover a relação |
| NOB-110 e NOB-109 bloqueadas por NOB-113 (Lista C) | "Lista C" = NTEP (CID × CNAE) no protótipo; não bloqueia o registro nem a emissão de ASO | Confirmar o significado (A-02) e, se for isso, remover NOB-110 → NOB-113 |
| NOB-100 Done | O critério "Medicina com PGR externo" é entregue pela #112, que está aberta | Registrar no Linear |
| NOB-98 bloqueia NOB-109 e NOB-130 | Correto. Bloqueio por decisão, não por código | — |
| NOB-121 em milestone 6 (Teleconsultas) | A identidade profissional da NOB-121 é pré-requisito da NOB-98 e da NOB-110 | Antecipar a parte de identidade para o Lote 3 (D-03) |
| NOB-93 sem responsável, In Review, bloqueia NOB-112/113 | O "modelo completo do Dr. Alcides" não diz onde está; pode ser o pacote `Projeto-SST-Ocupacional` | Confirmar com o Douglas |

## 3. Contrato de riscos Segurança → Medicina (classificação pedida no enunciado, §10)

Validação campo a campo da lista-hipótese em AUDIT-DATABASE §10.1. Resumo:

### 3.1 Contrato já implementado (develop `d6b787c`)

| Elemento | Onde |
|---|---|
| Empresa → GES → risco | `risks.ges_id`, `ges.company_id` |
| Avaliação P×S, NR-09 | `risk_assessments` |
| Medidas | `control_measures` |
| Vínculo GES ↔ função (N:N) | `ges_job_roles` |
| Escrita de risco exige o módulo PGR (aplicação) | #113 |
| Leitura de risco | **não** é restrita por módulo |

O risco é **por GES**, não por função. O protótipo modela por função.

### 3.2 Contrato em desenvolvimento (PR #112, aberta, sem CI)

| Elemento | Detalhe |
|---|---|
| Tabelas | `medical_risk_sources` / `entries` / `events` |
| Origem | `kind` `internal` \| `external`; `version` em texto |
| Integridade | `fingerprint` SHA-256 canônico; `supersedes_source_id`; frescor `current` \| `changed` \| `unavailable` \| `superseded` |
| Imutabilidade | runtime sem UPDATE/DELETE; INSERT só `pending` |
| Uso | `canUseMedicalRisk` = `validated` ∧ fresco |
| Efeito colateral | 0055 esconde o inventário de empresas sem PGR |
| Não cobre | função na captura interna; classificação na fonte externa; medidas/EPI; fluxo de validação |

### 3.3 Contrato pendente de resposta (bloqueado por decisão)

| Elemento | Decisão |
|---|---|
| Quem valida | A-01, E-01 |
| Como o profissional é identificado | E-01, D-03 |
| Escopo da autorização (empresa × escritório) | A-01 |
| Validade das validações após troca de coordenador | A-01 |
| Riscos não validados aparecem no ASO? | A-04 |

### 3.4 Contrato proposto para aprovação (AUDIT-DATABASE §10.4, nada criado)

| Proposta | Origem |
|---|---|
| `medicos.crm_uf`, `rqe`, `user_id` + `company_medical_assignments` (coordenador/examinador com vigência) | P1 |
| `medical_risk_entry_reviews` append-only, revisor = médico designado | P5 |
| Capturar função (`ges_job_roles`: função, CBO, expostos) no snapshot interno | ajuste na #112 ou depois |
| Campo opcional de classificação na fonte externa; FK opcional para o documento externo no GED | ajuste na #112 ou depois |
| Fingerprint sem `pgr.updated_at` (hoje qualquer edição do cabeçalho do PGR marca a fonte como "changed") | ajuste na #112 |
| PCMSO referencia `source_id` + `entry_id` + fingerprint no snapshot; **nunca** lê `risks` direto | P6 |

### Regras de convivência com o trabalho do Rikelvin

1. A Medicina **não** cria leitura paralela de `risks`. O único contrato é `medical_risk_*`.
2. A Medicina **não** cria um segundo cadastro de PGR externo. A NOB-111 é reescopada sobre a #112.
3. Ajustes no contrato (função, classificação, fingerprint) são **propostos ao Rikelvin**, não implementados por fora.
4. Riscos de PGR externo nunca nascem validados (já garantido pela 0054).
5. Empresa só com Medicina **não** precisa contratar PGR: a fonte externa cobre. Os cadastros comuns continuam
   disponíveis (`shared-company-records.test.ts`).

## 4. Dependências técnicas reaproveitáveis (não reconstruir)

| Peça | Dono | Uso pela Medicina |
|---|---|---|
| `company_modules` + `companyModuleScope` + `assertCompanyModuleTx` | Rikelvin | Toda tabela nova de Medicina: FK composta `(company_id, org_id)` + RESTRICTIVE `medicine` |
| `listCompanyOptions(orgId, "medicine")`, `listEmployees({module})` | Rikelvin | Seletores e listas |
| `template-engine`, Gotenberg/Google, GED versionado, `jobs` + worker | Douglas | ASO/PCMSO no Lote 4, com o desenho aprovado por ele |
| Registry de assinatura (`target_type`) | — (fatia 010) | Só ciência do trabalhador. **Não** é assinatura técnica |
| `runIsolationSuite`, `pgr-seed.ts`, padrão `rest-health-exams.test.ts` | — | Testes de toda tabela/rota nova |
| `caepi-sync` / `caepi-upsert` (tabela global + importador owner) | — | Lista C e demais datasets |
