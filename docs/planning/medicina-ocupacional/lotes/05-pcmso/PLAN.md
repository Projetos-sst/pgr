# Lote 05 — PCMSO · PLAN

> **Plano, não decisão. Lote BLOQUEADO (NOB-98).** Nomes de tabela, rota e arquivo são indicativos.
> [README do lote](README.md) · [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md)

## 1. Resultado esperado

Para cada empresa-cliente com `medicine`: um **programa** com vigência e coordenador designado; **versões** numeradas
com estado; cada versão congela num snapshot as fontes de risco **validadas** usadas, o plano de exames por GES/função e
a periodicidade aprovada; a emissão gera documento no GED com hash e é assinada tecnicamente pelo coordenador. Uma
mudança na fonte depois da emissão não altera a versão emitida; gera aviso e exige nova versão com nova revisão.

## 2. Escopo

| Bloco | Conteúdo | Depende de |
|---|---|---|
| Dados por empresa | empresa, CNAE/GR, estabelecimento (cadastros comuns; nada duplicado) | — |
| Coordenador | designação `pcmso_coordinator` vigente (P1) | [Lote 03](../03-identidade-e-riscos/README.md), decisão NOB-98 |
| Riscos | entries de `medical_risk_*` com última revisão `validated` (P5) e frescor válido | #112 + P5 |
| Origem | `kind` `internal` (PGR da plataforma) ou `external` (PGR fornecido pela empresa, NOB-111 reescopada) | #112, D-04 |
| Plano de exames | por GES/função: procedimento (P4), admissional, periódico (meses), retorno, mudança de função, demissional | P4 + **A-06** |
| Periodicidade | somente a aprovada pelo Dr. Alcides; nada de 12/24 do protótipo sem aprovação | A-06 |
| Programa e revisões | `pcmso_programs` + `pcmso_versions` (estado, snapshot, sha) | P6 |
| Emissão, snapshot, documento | camada P7 compartilhada com o Lote 04; template no padrão `scripts/pgr-docx` | D-06 |
| Assinatura | técnica do coordenador (P8) | E-07 |
| GED | grupo de documentos por PCMSO da empresa | P7 |
| Vigilância NTEP | grupos da Lista C para a classe CNAE | dataset oficial P2 (Lote 03), A-02 |

Fora do lote: relatório analítico com dados individuais (depende de afastamentos, FORA do MVP), psicossocial no PCMSO
(E-04/MED-28), IA (NOB-125, D-08).

## 3. Arquitetura (PROPOSTO — [AUDIT-DATABASE §10.3, P6](../../AUDIT-DATABASE.md))

```
criar/editar versão (draft)  → seleciona fontes (source_id) e monta plano de exames
enviar para revisão          → in_review (snapshot congelado; devolução volta a draft com evento)
emitir [withOrg, lock do programa]
  1. coordenador com designação vigente (P1)
  2. para cada entry usada: última revisão = validated E frescor ∈ {current, external_reference}   ← verificação transacional
     senão: VALIDATION/erro de domínio "fonte não validada", nada emitido
  3. snapshot (empresa, coordenador CRM/UF, fontes com source_id+entry_id+fingerprint+versão, plano de exames,
     dataset_id/version da Lista C se usada, template_sha) + snapshot_sha256
  4. emissão P7 + documents + jobs{kind:'pcmso'}
fonte muda depois  → evento "fonte desatualizada" ligado às versões que a usam; versão emitida intacta
```

Superfície obrigatória (CLAUDE.md): Server Action `officeAction` + REST `restHandler` + `docs/api/api-design.md` +
coleção Postman. Rotas indicativas (HIPÓTESE): `GET/POST /api/v1/companies/[id]/pcmso`,
`GET/PUT /api/v1/pcmso/[programId]/versions/[versionId]`, `POST .../submit`, `POST .../issue`. Sem `DELETE` de versão
emitida. UI indicativa: `/companies/[id]/pcmso` com `FormSteps` (fontes → plano → revisão → emissão), padrão
`/companies/[id]/medical-risks` da #112 ([AUDIT-UX §10.2](../../AUDIT-UX.md)).

## 4. Tabelas e migrations

| Proposta | Detalhe | Estado |
|---|---|---|
| P6 `pcmso_programs` | org, company (FK composta), `coordinator_assignment_id`, vigência, UNIQUE de vigência por empresa | PROPOSTO |
| P6 `pcmso_versions` | program, version, status CHECK (`draft\|in_review\|issued\|signed\|rectified\|cancelled`, A-09), snapshot, snapshot_sha256, fontes (array ou junção `pcmso_version_sources` com FK composta), issuance_id → P7; UNIQUE(org, program, version) | PROPOSTO |
| Plano de exames | no snapshot (preferível) ou tabela filha imutável | aberto |
| Consumidas | P1, P4, P5, P7, P8, P2 (opcional, NTEP) | outros lotes |

Numeração indicativa (P6 = `0061_*` na [AUDIT-DATABASE §10.4](../../AUDIT-DATABASE.md)); real depende de D-01/D-07.
Regras de migration: uma por PR, aditiva, `when` crescente, `text` + CHECK, ensaio em Postgres efêmero. Merge em develop
aplica em homologação; merge em main aplica em produção.

## 5. Segurança

| Item | Rotulagem |
|---|---|
| RLS isolation + RESTRICTIVE `medicine` + FK composta `(company_id, org_id)` | PROPOSTO |
| Snapshot imutável após `issued` (trigger); runtime sem DELETE | PROPOSTO |
| Apenas coordenador designado submete/emite/assina; owner não presumido médico | BLOQUEADO (decisão NOB-98 / P1) |
| Nenhuma leitura direta de `risks` pela Medicina | regra ([DEPENDENCIES](../../DEPENDENCIES.md), convivência com o Rikelvin) |
| Sem dados individuais no snapshot se o cronograma individual não for aprovado | PENDENTE (A-09) |
| Nenhum dado de saúde em IA; nada em `localStorage`; erro ≠ vazio | regra permanente |

## 6. Validações

| Validação | Estado |
|---|---|
| Emissão recusada se qualquer fonte usada não estiver `validated` e fresca no momento | PROPOSTO (critério da NOB-109) |
| Emissão recusada sem coordenador vigente | PROPOSTO |
| Periodicidade dentro das regras aprovadas | PENDENTE (A-06) |
| Seção NTEP só com dataset oficial ativo; sem ele, omitida com aviso | PROPOSTO |
| Nova versão exige nova revisão | PROPOSTO |

## 7. Sequência (quando desbloquear)

1. #112 mergeada (R-01, D-01, D-02) e P1 + P5 entregues (Lote 03 / NOB-98).
2. A-06 respondida; P4 entregue (Lote 02); desenho P7 aprovado (Lote 04).
3. P6 (migration) + domínio de versões + verificação transacional de fontes.
4. Telas por etapas e rascunho.
5. Template + emissão (P7) + GED.
6. Assinatura do coordenador (P8).
7. Seção NTEP quando P2 tiver a Lista C oficial.

## 8. O que depende de decisão

| Bloco | Decisão | Quem |
|---|---|---|
| Quem valida / concede / revoga; escopo; validações após troca de coordenador | A-01, E-01 (parcial), D-03 | Dr. Alcides, Expedito, Douglas |
| "Empresa" que define o autorizador = `companies` ou `orgs` | ambiguidade registrada | Expedito |
| Persistência da revisão | R-02 | Rikelvin + Carlos |
| Efeito da 0055 | D-02 | Douglas (+ Expedito ciente) |
| Periodicidade e regras clínicas | A-06 | Dr. Alcides |
| Risco por GES × por função no PCMSO | regra clínica | Dr. Alcides |
| Estados do documento e conteúdo do snapshot | A-09 | Dr. Alcides |
| Camada de emissão | D-06 | Douglas |
| Lista C | A-02 | Dr. Alcides |
| Provedor de assinatura | E-07 | Expedito + Douglas |
