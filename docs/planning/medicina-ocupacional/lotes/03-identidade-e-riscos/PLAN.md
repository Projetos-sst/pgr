# Lote 03 — PLAN

> **Plano condicionado.** Nenhuma tabela, API ou migration foi criada. Os desenhos abaixo são **PROPOSTOS** a partir de
> [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.4–10.5 e só avançam com as decisões citadas. Nada aqui concede
> permissão a ninguém. [README do lote](README.md) · [AUDIT](AUDIT.md) · [TASK](TASK.md)

## 1. Resultado esperado (quando desbloqueado)

| Frente | Resultado | Critério de aceite (proposto) |
|---|---|---|
| 3a | Profissional identificado (dados mínimos decididos), opcionalmente ligado a um usuário autenticado, e **designado por empresa** com vigência, concessor registrado e revogação | profissional sem designação vigente é recusado **no servidor e no banco**; revogação preserva o histórico |
| 3b | Validação/rejeição de entradas de risco append-only, só por profissional designado | sem designação → `FORBIDDEN`; conteúdo da fonte imutável; nova decisão após revogação recusada |
| 3c | PGR externo com UX no padrão `_ui`, documento no GED vinculado à fonte, sobre o contrato da #112 | externo nunca nasce validado; documento acessível só a quem acessa a fonte |
| 3d | Ajustes de rastreabilidade **aceitos pelo Rikelvin** e implementados no contrato dele | nenhum contrato paralelo |
| 3e | Lista C oficial versionada, com procedência e importador idempotente | reimportar o mesmo arquivo não muda nada; versão anterior preservada |

## 2. Frente 3a — identidade, vínculo e designação (P1, proposta)

### 2.1 O que a resposta do Expedito permite e o que não permite

- **Permite** desenhar a designação **por empresa** e prever o registro estruturado dos dados do profissional.
- **Escolhe** a opção 3. As opções 1 ("o escritório/owner autoriza por padrão") e 2 não são a regra padrão, **sujeito à
  MED-DEC-02**: se "empresa" significar o escritório, a leitura muda.
- **Não permite** escolher quem, na empresa, registra a indicação, nem quem valida, nem o que acontece na revogação.

### 2.2 Opções para "a empresa define quem autoriza" (HIPÓTESES, nenhuma escolhida)

| Opção | Como funcionaria | Pré-requisito | Risco |
|---|---|---|---|
| I | O escritório **registra** a indicação feita pela empresa-cliente, com evidência (documento de indicação no GED, nome e cargo de quem indicou na empresa) | MED-DEC-02 = empresa-cliente; aceite de Expedito e Dr. Alcides de que registrar indicação ≠ aprovar em nome de terceiros | Prova frágil se a evidência for só declaratória |
| II | Usuário da empresa-cliente faz a indicação no próprio sistema (perfil/portal de empresa) | MED-DEC-21 (portais); escopo por empresa aplicado (`scoped_company_id`) | Depende do Lote 06; maior superfície de segurança |
| III | "Empresa" = escritório; um papel do escritório indica | MED-DEC-02 = escritório | Parece contrariar a escolha da opção 3 em vez da 1; precisa de confirmação explícita |

### 2.3 Desenho técnico de referência (AUDIT-DATABASE §10.4 P1)

- ALTER `medicos`: `crm_uf` (nullable), `rqe` (nullable), `user_id` (nullable, id do Clerk, sem FK) + UNIQUE parcial
  `(org_id, user_id) WHERE user_id IS NOT NULL`; novo UNIQUE `(org_id, crm, crm_uf)` mantendo o antigo até saneamento.
- Nova `company_medical_assignments` (`org_id`, `company_id`, `medico_id` RESTRICT, papel em `text` + CHECK — valores dependem de
  MED-DEC-03 —, `valid_from`, `valid_to`, `granted_by`, `granted_at`, `revoked_by`, `revoked_at`, `reason`, evidência opcional → GED).
- Runtime: SELECT/INSERT; UPDATE só em colunas de revogação/vigência; sem DELETE. RLS isolation + `medicine` RESTRICTIVE.
- **Campos de identificação obrigatórios, comprovação e uso de CPF: MED-DEC-04** (minimização LGPD).
- Profissional externo (sem membership no escritório): MED-DEC-05; afeta convite e membership no Clerk.
- Psicólogos: decidir se `medicos` vira cadastro genérico de profissionais (NOB-121; MED-27) — não decidir aqui.

### 2.4 Gate no servidor (proposta)

`requireOfficeStaff()` continua sendo o gate de acesso. Ações técnicas (validar risco, futuramente assinar) ganham um segundo gate
`requireDesignatedProfessional(ctx, companyId, papel)` que verifica, na mesma transação, designação vigente do usuário logado para
aquela empresa. Owner/colaborador sem designação: **recusado**.

## 3. Frente 3b — validação técnica de riscos (P5, dono: Rikelvin)

- Persistência recomendada na Fase 0: `medical_risk_entry_reviews` append-only (decisão `validated`/`rejected`, revisor = médico
  designado com FK RESTRICT, usuário revisor, nota, data); estado vigente = última decisão. Alternativa: `GRANT UPDATE` por coluna +
  trigger. **Escolha do Rikelvin (R-02), com aprovação do Douglas.**
- Policy RESTRICTIVE de INSERT exigindo designação vigente (`exists` em `company_medical_assignments`) + verificação na aplicação.
- Nota obrigatória e motivo de rejeição: MED-DEC-07. Efeito da revogação sobre decisões antigas: MED-DEC-06.
- Papel do Carlos: apoiar com P1 e com os testes de integração da Medicina; **não** implementar a revisão por fora da NOB-98.

## 4. Frente 3c — PGR externo (NOB-111 reescopada, proposta)

- Base: fonte `external` da #112 (já mergeada, condição).
- Escopo proposto: tela no padrão `_ui` (`ListCard`/`DataGrid`/`ListFooter`, erro ≠ vazio) para registrar e consultar fontes externas;
  upload do PDF do PGR externo no GED; vínculo `reference_document_id` (FK opcional → `documents`) **proposto ao Rikelvin** como
  ajuste da #112 ou migration posterior.
- O GED hoje não tem `company_id` nem policy de módulo ([`../../geral/03-ARQUITETURA-E-CONTRATOS.md`](../../geral/03-ARQUITETURA-E-CONTRATOS.md) §8):
  documento de PGR externo de empresa só-Medicina precisa de regra de acesso decidida com o Douglas (MED-DEC-12 relacionada).
- 4 superfícies para qualquer HTTP novo.

## 5. Frente 3d — fontes de risco e rastreabilidade (propostas ao Rikelvin)

| Ajuste proposto | Motivo | Fonte |
|---|---|---|
| Capturar função, CBO e nº de expostos (`ges_job_roles`) no snapshot interno | PCMSO planeja exames por função; risco é por GES | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.1 |
| Campo opcional de classificação/nível na fonte externa | Externa hoje não tem classificação | idem |
| Fingerprint sem `pgr.updated_at` | Edição do cabeçalho marca a fonte como `changed` sem mudança de risco | idem §4.5 |
| `reference_document_id` → GED | Procedência do documento externo | idem §10.1 |
| Evento "fonte desatualizada" ligado às versões de PCMSO que a usam | Rastreabilidade pós-emissão | idem §10.1 |

Nenhum é implementado pelo Carlos sem aceite do Rikelvin. A Medicina não lê `risks` diretamente.

## 6. Frente 3e — Lista C (P2, proposta)

- Tabela global `reference_datasets` (código, versão, nome e URL da fonte, referência legal, `source_sha256`, `row_count`, status
  `active`/`superseded`/`draft`) + `ref_lista_c_entries` (intervalo CID, início, fim, rótulo do grupo, classe CNAE), RLS com leitura
  global, runtime só SELECT, escrita via owner — padrão `caepi_certificates` ([`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.5).
- Importador `scripts/reference-sync.ts` no padrão `caepi-sync`/`caepi-upsert`: idempotente por hash do arquivo; nova versão nunca apaga a
  anterior; documentos emitidos referenciam `dataset_id`/versão.
- **Pré-requisitos (MED-DEC-13, Dr. Alcides):** confirmação de que "Lista C" = Anexo II do Decreto 3.048/99; fonte oficial e redação vigente;
  classe ou subclasse CNAE; tratamento de entradas fora do formato `X00-X00`; regra de agravamento "mental" (decisão clínica).
- A base do protótipo (18 grupos, sem M e S/T) **não** é carga oficial; pode servir só de fixture de teste do importador.
- Se confirmado, pedir ao Douglas a remoção da dependência NOB-110 → NOB-113 no Linear (D-10).
- Opcional (MED-17): NR-4 e eSocial tabela 24 com o mesmo padrão, como sugestão e nunca bloqueio.

## 7. Segurança

- Nenhuma concessão, papel clínico ou fluxo de validação antes das decisões.
- Toda tabela nova: isolation + `medicine` RESTRICTIVE + FK composta + `runIsolationSuite`; datasets globais: leitura global, escrita owner.
- Auditoria das concessões e revogações (append-only, com motivo), alinhada à P9 do [Lote 02](../02-formularios-e-auditoria/PLAN.md).
- Dados pessoais do profissional: mínimos (MED-DEC-04). Nada em IA.

## 8. Testes (quando houver implementação)

Revisor sem designação → `FORBIDDEN` (aplicação e banco); revogação impede nova decisão; dois coordenadores vigentes recusados (se a regra
existir); conteúdo da fonte imutável; externo sempre `pending`; reimportação idempotente da Lista C; runtime não escreve em dataset
global; cross-tenant e módulo desligado em toda tabela nova. Cenários 6, 7, 16, 20 e 21 de [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §6.1.

## 9. Sequência

1. Decisões: MED-DEC-02…07, 10 (Lote 00); MED-DEC-13 (Lista C); #112 mergeada com MED-DEC-09; MED-DEC-08 (numeração).
2. Proposta técnica de P1 pelo Carlos (documento), revisada por Douglas e Rikelvin (próxima ação de MED-DEC-04).
3. 3a (P1) → 3b (P5, Rikelvin) em paralelo com 3c e 3d (sobre a #112 mergeada).
4. 3e quando a fonte da Lista C chegar (independente de 3a).
