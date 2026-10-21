# Lote 06 — Profissionais, clínicas e portais · PLAN

> **Plano condicionado. Lote BLOQUEADO (E-02).** Nenhuma entidade abaixo está aprovada; nomes são indicativos.
> [README do lote](README.md) · [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md)

## 1. Resultado esperado

Profissionais de saúde (médicos e psicólogos, internos e externos) e clínicas parceiras cadastrados uma vez por
escritório; vínculo autorizado empresa ↔ clínica com vigência; encaminhamento do trabalhador com guia e agendamento até
o ASO; e, **apenas os portais que o Expedito confirmar**, acesso de RH e/ou clínica com escopo verificado no servidor e
no banco.

## 2. Escopo por bloco e condição

| Bloco | Conteúdo | Condição para começar |
|---|---|---|
| 6.1 Profissionais | psicólogos e profissionais externos; categoria profissional; registro (CRM/CRP + UF); vínculo com usuário reaproveitando P1 | P1 entregue ([Lote 03](../03-identidade-e-riscos/README.md)); decisão `medicos` × `health_professionals` |
| 6.2 Clínicas | catálogo de clínicas do escritório (padrão CRUD de `/medicos`); examinadores ligados a profissionais | E-02 confirma clínicas na V1 |
| 6.3 Vínculos | empresa ↔ clínica com vigência, quem concedeu, revogação | 6.2 |
| 6.4 Encaminhamentos e guias | encaminhamento por trabalhador com status (HIPÓTESE: os do protótipo), guia como documento (P7), procedimentos solicitados (P4) | 6.3 + [Lote 04](../04-aso/README.md) (a guia termina em ASO) |
| 6.5 Agendamentos | data/hora pela clínica; avaliar reuso de `schedule_events` (NÃO VERIFICADO) | 6.4 |
| 6.6 Resultados clínicos | sinais vitais, audiometria, espirometria | **somente** após papel clínico + auditoria de leitura + D-05 + A-03 |
| 6.7 Portal da clínica | fila, agenda, registro, conclusão | E-02 + escopo por clínica + papel clínico |
| 6.8 Portal da empresa/RH | pendências, solicitação de exame, conclusão do ASO | E-02 + escopo por empresa (`scoped_company_id` aplicado no servidor e na RLS) + A-03 |
| 6.9 NOB-123 | conectar jornadas do protótipo às telas reais | interpretar como roteiro de jornadas, não como porte de código |

Fora: teleconsulta (NOB-120), psicossocial (E-04/MED-28), comercial (MED-34), portal do trabalhador (não pedido).

## 3. Arquitetura (PROPOSTO)

- Camadas padrão: página → Server Action (`officeAction`) → domínio (zod) → repositório (`withOrg`) → schema; mirror REST
  com `restHandler`; `api-design.md` + Postman para cada CRUD (checklist obrigatório do CLAUDE.md).
- **Escopo por empresa/clínica** em duas camadas: gate no servidor (novo `require*` por perfil) **e** RLS com contexto
  de papel na transação (estender `withOrg` com `app.current_user`/`app.current_role`), conforme
  [AUDIT-SECURITY §10.3](../../AUDIT-SECURITY.md). Hoje o banco não conhece o usuário: isso é pré-requisito, não detalhe.
- Tabelas clínicas (6.6) separadas, idealmente em schema `clinical` (opção B), com auditoria de leitura na mesma transação.
- Toda tabela com `company_id`: FK composta `(company_id, org_id)` + RESTRICTIVE `companyModuleScope(…, 'medicine')`.
- Perfis e o que veem: seguir a matriz proposta em [AUDIT-SECURITY §10.2](../../AUDIT-SECURITY.md) (clínica: mínimo do
  trabalhador encaminhado, riscos da função; RH: própria empresa, só conclusão do ASO; nunca prontuário).

## 4. Tabelas e migrations

Nenhuma proposta detalhada na Fase 0 além de P1 (Lote 03) e P9 (Lote 02). Candidatas, todas **HIPÓTESE** até E-02:

| Candidata | Finalidade |
|---|---|
| `clinics` | catálogo do escritório |
| `company_clinic_links` | vínculo autorizado com vigência e revogação |
| `exam_referrals` (+ eventos) | encaminhamento com status |
| extensão de `medicos` ou `health_professionals` | psicólogos/externos (P1 estendida) |
| tabelas no schema `clinical` | resultados clínicos (6.6), só após D-05 |

Regras: uma migration por PR, aditiva, `when` crescente, `text` + CHECK, ensaio em Postgres efêmero; merge em develop
aplica em homologação, em main aplica em produção.

## 5. Segurança

| Item | Rotulagem |
|---|---|
| Clínica só vê trabalhadores de empresas vinculadas e encaminhados a ela | PROPOSTO |
| RH sem acesso a prontuário/resultado clínico | PROPOSTO (A-03 define a conclusão visível) |
| Escopo por empresa aplicado (hoje `scoped_company_id` não é usado) | BLOQUEADO (E-02/D-05) |
| Papel clínico + RLS com contexto de papel | BLOQUEADO (D-05) |
| Auditoria de leitura de dado de saúde | PROPOSTO (P9) |
| MFA para owner e perfis de saúde | PENDENTE (D-12) |
| Clínica não recebe dado financeiro das empresas (R-03 do protótipo) | regra |
| Nada de "Ver como" no cliente; nada em `localStorage`; nenhum dado de saúde em IA | regra permanente |

## 6. Validações (candidatas)

Vínculo vigente obrigatório para criar encaminhamento; transições de status só por funções de domínio com evento;
conclusão exige médico examinador identificado (P1); data de agendamento não passada; exclusão de clínica bloqueada
com encaminhamento aberto (comportamento do protótipo, a confirmar).

## 7. Sequência (quando desbloquear)

1. E-02 e D-05 decididas; P1 entregue.
2. 6.1 profissionais → 6.2 clínicas → 6.3 vínculos (CRUDs completos com REST/docs/Postman).
3. 6.4/6.5 encaminhamentos e agendamento (após Lote 04 ter emissão de documento).
4. Escopo por empresa/clínica no servidor + RLS (pré-requisito de qualquer portal).
5. 6.7/6.8 portais confirmados.
6. 6.6 resultados clínicos por último, com camada clínica.

## 8. O que depende de decisão

| Bloco | Decisão | Quem |
|---|---|---|
| Perfis/portais da V1 | E-02 | Expedito |
| Profissional externo | E-01 | Expedito |
| Arquitetura A/B/C | D-05 | Douglas |
| Dono da identidade profissional | D-03 | Douglas + Carlos + Rikelvin |
| O que RH/clínica veem | A-03 | Dr. Alcides |
| MFA | D-12 | Douglas |
| `medicos` × `health_professionals` | modelagem | Carlos (proposta) + Douglas |
