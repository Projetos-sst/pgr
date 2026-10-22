# Lote 04 — ASO · PLAN

> **Plano, não decisão.** Tudo marcado PROPOSTO depende de aprovação; nomes de arquivo, tabela e rota são indicativos.
> [README do lote](README.md) · [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md)

## 1. Resultado esperado

Um usuário autorizado registra o exame com procedimentos e médico identificado, gera uma **prévia** do ASO, envia para
revisão (se o fluxo aprovado exigir), **emite** um documento imutável que fica no GED com hash e versão, colhe a
**ciência do trabalhador** e, quando houver provedor, a **assinatura técnica** do médico. Cada etapa deixa evento
append-only. Retificar gera nova emissão; a anterior continua consultável.

Entregas internas sugeridas:

| Fase | Entrega                                                                        | Condição                                            |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 4a   | Formulário definitivo + prévia/rascunho identificada                           | A-03, P1 (Lote 03), P4 (Lote 02)                    |
| 4b   | Emissão com snapshot imutável no GED, estado "emitido, sem assinatura técnica" | D-06 + desenho P7 aprovado pelo Douglas + A-05/A-09 |
| 4c   | Ciência do trabalhador (registry `aso`)                                        | 4b                                                  |
| 4d   | Assinatura técnica ICP-Brasil                                                  | E-07 (provedor) + P8                                |
| —    | Seção de riscos no ASO                                                         | NOB-98 com revisão (P5) **ou** resposta A-04        |

**Entrega independente do PCMSO:** 4a–4c não exigem versão de PCMSO. Só a seção de riscos depende da cadeia NOB-98.
Quando o PCMSO existir (Lote 05), o snapshot do ASO poderá referenciar a versão vigente.

## 2. Arquitetura (PROPOSTO — [AUDIT-DATABASE §10.3](../../AUDIT-DATABASE.md))

```
emitir ASO [officeAction/restHandler → domínio → repositório; withOrg; lock do health_exam]
  1. verifica: módulo medicine (assertCompanyModuleTx), emissor com designação vigente (P1), campos obrigatórios (A-03)
  2. monta snapshot jsonb: empresa (razão, CNPJ, CNAE, GR), trabalhador mínimo (A-03 decide CPF/nascimento),
     função/GES na data (P3), exame, procedimentos com data (P4), aptidão, examinador e coordenador com CRM/UF,
     riscos com source_id+entry_id+fingerprint (só se A-04/NOB-98 permitirem), template_id+sha
  3. snapshot_sha256 = sha256(JSON canônico)  (mesma canonicalização da #112)
  4. INSERT emissão {status, snapshot, snapshot_sha256, supersedes_id?} + evento
  5. INSERT documents{generating, version N+1, company_id} + jobs{pdf_batch, payload{kind:'aso', issuanceId}}
worker: renderiza DO SNAPSHOT (template DOCX do ASO) → Gotenberg → upload upsert:false → grava output_sha256 → ready
ciência: signature_requests target_type 'aso' (+ document_sha256 opcional)
assinatura técnica: tabela própria ligada ao output_sha256 (P8)
```

Camadas seguem o padrão do repositório: página orquestra → Server Action (`officeAction`) → domínio (zod + regras puras
em `src/shared/domains/medicine/*`) → repositório (`withOrg`, `auditedTenantWrite`) → schema.

**Superfície obrigatória (CLAUDE.md) para toda operação exposta:** Server Action + mirror REST em `src/app/api/v1/**`
com `restHandler` + registro em `docs/api/api-design.md` + requests na coleção `docs/api/sst-manager.postman_collection.json`.
Rotas indicativas (HIPÓTESE): `POST /api/v1/health-exams/[id]/aso-issuances` (emitir), `GET` (histórico),
`POST .../[issuanceId]/cancel` e `.../rectify`. Sem `DELETE` (documento emitido não se apaga).

## 3. Arquivos (indicativos)

| Camada      | Arquivo provável                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domínio     | `src/shared/domains/medicine/aso.ts` (schema do formulário, campos obrigatórios, máquina de estados)                                                 |
| Repositório | `src/shared/db/repositories/aso-issuances.ts` (ou o repositório genérico de emissões, se D-06 escolher a camada genérica)                            |
| Action      | `src/shared/server/actions/medicine/aso.ts`                                                                                                          |
| REST        | `src/app/api/v1/health-exams/[id]/aso-issuances/**`                                                                                                  |
| Worker      | novo `kind: 'aso'` em `src/shared/domains/documents/pdf-batch.ts:9` e ramo em `pdf-batch-core.ts` — **somente com o aceite do Douglas**              |
| Template    | `scripts/aso-docx/*` + `templates/aso/` no padrão de `scripts/pgr-docx` (HIPÓTESE de nome)                                                           |
| Registry    | `src/shared/domains/signatures/targets/aso.ts` + entrada em `contract.ts`                                                                            |
| UI          | `/health-exams/[id]` (visualizar/emitir), prévia com faixa "PRÉVIA — sem validade legal"; primitives `_ui`, Manrope/JetBrains Mono, indigo `#5B63F5` |

## 4. Tabelas e migrations (propostas de [AUDIT-DATABASE §10.4](../../AUDIT-DATABASE.md))

| Proposta                                                                                     | Uso no ASO                                         | Lote dono                                          | Depende de         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ------------------ |
| P1 identidade + designação                                                                   | emissor/assinante identificado                     | [Lote 03](../03-identidade-e-riscos/README.md)     | decisão NOB-98     |
| P3 `employee_job_assignments`                                                                | função na data do exame                            | este lote (ou antes, é independente)               | —                  |
| P4 procedimentos                                                                             | procedimentos do ASO, **sem valores de resultado** | [Lote 02](../02-formularios-e-auditoria/README.md) | —                  |
| P7 `document_issuances` + eventos + ALTER `documents` (`company_id`, `sha256`, `created_by`) | emissão com snapshot                               | este lote                                          | **D-06 (Douglas)** |
| P8 `technical_signatures` (+ `signature_requests.document_sha256` opcional)                  | assinatura técnica                                 | este lote (4d)                                     | E-07               |
| P9 auditoria clínica                                                                         | eventos de leitura/escrita                         | Lote 02                                            | —                  |

Numeração (0056+) é **indicativa**: depende de D-01 (ordem da #112) e D-07. Regra para cada migration: uma por PR,
`drizzle-kit generate` após rebase, `when` maior que o último, aditiva, estados em `text` + CHECK, ensaio em Postgres
efêmero. **Merge em develop aplica em homologação; merge em main aplica em produção** (`cd.yml`, passo `drizzle-kit migrate`).

## 5. Segurança

| Item                                                                                                                          | Rotulagem                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| RLS isolation + RESTRICTIVE por módulo conforme `kind` (`aso` → `medicine`) em toda tabela nova                               | PROPOSTO                                                 |
| Policy nova em `documents`: linhas `related_entity_type = 'aso'` exigem `medicine` (muda o GED; regressão do PGR obrigatória) | PROPOSTO                                                 |
| Runtime sem DELETE em emissões; UPDATE só por coluna; trigger impede alterar `snapshot` após `issued`                         | PROPOSTO                                                 |
| Emissor/assinante com designação vigente verificada no servidor **e** no banco (P1)                                           | BLOQUEADO (decisão NOB-98)                               |
| Download do ASO só por action autorizada, URL curta, auditada                                                                 | PROPOSTO ([AUDIT-SECURITY R11](../../AUDIT-SECURITY.md)) |
| Conclusão (aptidão) × dado clínico sigiloso (restrições detalhadas, observações)                                              | BLOQUEADO (A-03)                                         |
| Nenhum dado de saúde em IA; nada em `localStorage`; erro de leitura ≠ lista vazia                                             | regra permanente                                         |
| Assinatura QR/rabisco só para ciência do trabalhador                                                                          | regra permanente                                         |

## 6. Validações

| Validação                                                                                           | Estado                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funcionário e médico examinador obrigatórios; data não-futura (já existe no registro)               | existente/estender                                                                                                                                                                                                                                         |
| Lista de campos obrigatórios do documento                                                           | **PENDENTE** (A-03). Candidatos do protótipo, como HIPÓTESE: empresa (razão, CNPJ, CNAE/GR), trabalhador (nome, CPF, nascimento), função/setor, tipo de exame, data, procedimentos com data, conclusão, médico examinador com CRM/UF, coordenador do PCMSO |
| Emissor autorizado                                                                                  | **PENDENTE** (A-05 + P1)                                                                                                                                                                                                                                   |
| Riscos listados                                                                                     | **PENDENTE** (A-04); se permitido, apenas via `medical_risk_*`, nunca leitura direta de `risks`                                                                                                                                                            |
| Transições de estado                                                                                | **PENDENTE** (A-09)                                                                                                                                                                                                                                        |
| Snapshot igual ao documento; retry do job não altera snapshot; `output_sha256` confere com o objeto | PROPOSTO                                                                                                                                                                                                                                                   |

## 7. Sequência

1. Registrar as perguntas A-03, A-04, A-05, A-09 e D-06 (Lote 00) — sem decidir por ninguém.
2. Aguardar P1 (Lote 03) e P4/P9 (Lote 02).
3. Sessão de desenho P7 com o Douglas; registrar o desenho aprovado neste lote antes de qualquer código.
4. 4a: formulário + prévia (zero emissão oficial).
5. 4b: P7 + template + worker `kind: 'aso'` + testes de regressão do PGR.
6. 4c: registry `aso` para ciência.
7. 4d: P8 quando houver provedor.
8. Seção de riscos quando NOB-98 (P5) ou A-04 permitir.

## 8. O que depende de decisão (resumo)

| Bloco                            | Decisão                                                      | Quem                           |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| Campos obrigatórios e sigilo     | A-03                                                         | Dr. Alcides                    |
| Riscos no ASO                    | A-04                                                         | Dr. Alcides                    |
| Quem emite                       | A-05                                                         | Dr. Alcides + Expedito         |
| Estados e conteúdo do snapshot   | A-09                                                         | Dr. Alcides                    |
| Camada de emissão                | D-06                                                         | Douglas                        |
| Ordem e estratégia de migrations | D-01, D-07                                                   | Douglas                        |
| Provedor de assinatura           | E-07                                                         | Expedito + Douglas             |
| Identidade profissional          | NOB-98 / D-03 (resposta do Expedito PARCIALMENTE_RESPONDIDA) | Expedito, Dr. Alcides, Douglas |
| Dependência NOB-110 → NOB-113    | A-02 + D-10                                                  | Dr. Alcides + Douglas          |
