# #39 — [PGR] Integração com NR-09 (avaliação de agentes físicos/químicos/biológicos)

https://github.com/Projetos-sst/pgr/issues/39

### Objetivo

Registrar avaliação NR-09 (tipo de agente, método, resultado, limite de tolerância, conclusão) vinculada a
um risco do inventário e levá-la ao PGR.

### Estado atual no código

- Nenhuma referência a NR-09 / 9.4.3.
- `risks` (`schema/risks.ts:105-129`): `agentType` (7 valores, `:31-39`), `noxiousAgentCode`, `measurementUnit` (enum `:59-70`), `concentrationIntensity` numeric (`:126`). Regra: concentração exige unidade quantitativa (`domains/pgr/risk.ts:62-73`).
- `risk_assessments` (`:147-191`): `criterion` qualitative|quantitative, P×S, `uncertaintyDegree`, `toleranceLimit` **texto livre** (`:164`), `result` = **classificação do risco** (não valor medido, `risk-assessment.ts:88-94`), histórico por risco.
- Consolidado já carrega LT, código eSocial, unidade e concentração (`domains/pgr/pgr-consolidated.ts:68,96-98`), mas o PDF não imprime (`pgr-pdf-template.ts:145-161`).

### O que já existe

Critério quantitativo, unidade, intensidade (no risco), LT textual, histórico de avaliações.

### O que falta

Método de avaliação, valor medido **por avaliação**, LT numérico, conclusão, seção NR-09 na UI e no PDF.

### Arquivos/domínios provavelmente afetados

`schema/risks.ts`, `domains/pgr/risk-assessment.ts`, `repositories/risk-assessments.ts`, actions/REST de avaliações, `risks/[id]/assessments/_components/assessment-form.tsx`, `pgr-consolidated.ts`, `pgr-pdf-template.ts`.

### Backend

Colunas quantitativas na avaliação (ou tabela filha 1:N), Zod com regra "quantitativo exige método + valor + unidade", conclusão derivada quando LT numérico.

### Frontend

Bloco NR-09 no formulário de avaliação quando `criterion = quantitative`; exibição no consolidado.

### Migration

SIM — colunas em `risk_assessments` ou tabela `risk_quantitative_evaluations` com RLS.

### Testes necessários

Unit (conclusão acima/abaixo do LT, validações), integração (CRUD + cross-tenant), template PDF.

### Dependências

Desbloqueia #47.

### Riscos

Conflito conceitual com `result` (classificação) e com `concentrationIntensity` já no risco — definir fonte única no PLAN.

### Requisitos faltantes

Q1 (uma avaliação NR-09 por linha de `risk_assessments` × tabela dedicada) e Q2 (conclusão informada ×
calculada). Resolvidos na auditoria do Lote 2: **vigente** é a regra do PGR (igual ao #42); LT fica
numérico **e** textual; anexo de laudo já funciona (documento vinculado ao risco).

### Dificuldade

3/5 — migration simples + regras + 4 camadas, em domínio conhecido.

### Prontidão

NEEDS PRODUCT DECISION (Q1 cardinalidade, Q2 conclusão) — vira READY assim que respondidas

### Cobertura atual

25% — campos brutos existem; avaliação NR-09 estruturada não.

### Lote recomendado

2

### Auditoria do Lote 2 (26/09/2026)

Detalhe completo em [../lots/lot-02/AUDIT.md](../lots/lot-02/AUDIT.md); plano em
[../lots/lot-02/PLAN.md](../lots/lot-02/PLAN.md).

- Modelo recomendado: **colunas em `risk_assessments`** (`evaluation_method`, `measured_value`,
  `measured_unit` reusando o enum existente, `tolerance_limit_value`, `nr09_conclusion`), válidas só
  no critério `quantitative`.
- `agent_type` e o enum `measurement_unit` são reusados — nada de enum duplicado.
- Fonte única do valor exibido: a **avaliação**; `risks.concentration_intensity` continua sendo
  "concentração de referência" do risco.
- UI: bloco condicional no formulário de avaliação; nenhuma tela nova.
- Migration: **sim** (colunas + enum + CHECK), sem policy nova.

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
