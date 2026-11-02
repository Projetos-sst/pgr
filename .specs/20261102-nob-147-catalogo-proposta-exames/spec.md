# NOB-147 — Catálogo de procedimentos (Tabela 27) e proposta de exames

Fatia da NOB-109 (geração do PCMSO), **sem migration**. Linear: NOB-147. Base: respostas MED-05, MED-14 e
MED-15 do Dr. Alcides (Word final), NR-7 e eSocial.

## Fontes

| Fonte                                          | Versão / data                                                   | Uso                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| eSocial, Anexo I dos leiautes — `tabelas.html` | S-1.3, NT 07/2026 rev. 20/10/2026; SHA-256 `19abfe05…a607c2347` | Tabela 27 (1450 procedimentos) e Tabela 24 (códigos de agentes)                             |
| NR-7 (texto oficial, Portaria MTP nº 567/2022) | consultado em 01/11/2026                                        | Itens 7.5.6, 7.5.7; Anexo II itens 2 e 4; Anexo III item 1, Quadro 1, itens 2.17, 3.1 e 3.5 |

A Tabela 27 entra **verbatim** (inclusive a grafia "neurológca" do código 0290). Dois parsers independentes
(o script TS do repositório e uma extração em Python) produziram as mesmas 1450 linhas.

## Escopo entregue

1. **Catálogo** (`domains/medicine/procedure-catalog.ts` + `procedures/esocial-table-27.json`): busca por código
   ou descrição sem acento, paginada; código fora da tabela recusado; `9999` exige descrição; a linha do ASO só
   leva indicação e data (`toAsoProcedureLine`), sem resultado clínico (MED-05).
2. **Regras risco → exame** (`domains/medicine/exam-rules.ts`): só agentes nomeados pela própria NR-7.
   - Ruído (`02.01.001`) → audiometria `0281` (Anexo II).
   - Sílica (`01.18.001`), asbesto (`01.02.001`) e carvão mineral (`01.07.001`) → radiografia de tórax OIT `1078`
     e espirometria `1057` (Anexo III).
   - A periodicidade é citada da norma, não calculada. O Quadro 1 depende de medições (LSC × LEO) e do tempo de
     exposição, que o médico avalia.
3. **Proposta** (`domains/medicine/exam-proposal.ts`), só leitura:
   - lê todas as fontes do inventário da Medicina (NOB-98);
   - só riscos validados de fonte vigente geram sugestão;
   - pendentes, rejeitados, desatualizados e sem regra ficam separados;
   - sugestões sem duplicidade, com risco de origem, fonte e versão;
   - avisos de que inventário vazio não é ausência de risco;
   - `requiresMedicalReview: true`.
4. **Superfícies**:
   - Server Actions `actions/medicine/exam-proposal.ts`;
   - REST `GET /api/v1/medicine/procedures(/{code})` e `GET /api/v1/companies/{id}/exam-proposal`;
   - telas `/medicine/procedures` e `/companies/{id}/exam-proposal`, só de leitura e sem botões de aprovar;
   - api-design e Postman.

## Achado sobre a MED-19 (120 dias)

A observação da MED-19 cita 120 dias para o demissional dos graus de risco 1 e 2. O texto da NR-7 dá 135 dias
para o **exame clínico** (7.5.11), e 135 foi o que entrou na NOB-145. O número 120 aparece na NR-7 em outro
lugar: no **Anexo II, item 4.1.1**, como prazo de aceitação da **audiometria** na demissão. Isso provavelmente
explica a resposta do Dr. Alcides, e a regra de audiometria desta fatia cita o item 4.1.1. Vale confirmar com ele.

## Fora desta fatia (próxima, depende de migration e da NOB-121)

Revisão do plano pelo coordenador (MED-15) e geração do PCMSO (MED-14). Proposta de schema **aditivo**, a gerar
depois que a numeração da 0060 for acertada com Douglas e Rikelvin:

- `medical_exam_plans`:
  - colunas: `id`, `org_id`, `company_id`, `version` (int), `status` (`draft|approved|superseded`), `based_on` (jsonb com ids e versões das fontes), `rules_version`, `catalog_version`, `prepared_by`, `approved_by_medico_id`, `approved_by_user`, `approved_at`, `supersedes_plan_id`;
  - `UNIQUE(org_id, company_id, version)` e índice único parcial de um plano `approved` por empresa;
  - FKs compostas `(company_id, org_id)` e `(approved_by_medico_id, org_id)`;
  - RLS de tenant e módulo `medicine`.
- `medical_exam_plan_items`:
  - colunas: `plan_id`, `exposure_group`, `job_role`, `procedure_code` (`CHECK ~ '^\d{4}$'`, validado contra o catálogo no app), `other_description`, `origin` (`suggested|added`), `rule_id`, `decision` (`kept|removed`), `removal_reason` (obrigatório quando `removed`), `periodicity_text`, `created_by`;
  - imutáveis depois da aprovação: sem UPDATE/DELETE para o `app_runtime` em plano aprovado.
- **Aprovação:** policy RLS que exige que `app.current_actor` seja o usuário vinculado ao médico com designação **aberta** em `pcmso_coordinator_assignments` (0060). Isso depende do vínculo médico ↔ usuário (critério pendente da NOB-121). Sem ele, a aprovação não pode ser feita pelo login administrativo.
- **Mudança de risco depois da aprovação:** nova versão em rascunho, que substitui a anterior. Nada é atualizado em silêncio.

## Testes

- Unit:
  - `procedure-catalog.test.ts`: fonte, unicidade, busca, código inventado, 9999, ASO sem resultado;
  - `exam-proposal.test.ts`: códigos das regras existem nas Tabelas 24/27, referências, deduplicação, exclusões, grupos, avisos.
- Integração (`integration/medicine/exam-proposal.test.ts`, Postgres efêmero, 9 casos):
  - pendente × validado;
  - PGR alterado → fonte desatualizada;
  - fonte externa sem código;
  - sem fonte;
  - isolamento entre tenants;
  - Medicina desligada;
  - ID malformado;
  - catálogo pelas Actions;
  - REST com owner, collaborator, client e outro tenant.
