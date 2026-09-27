# #40 — [PGR] Integração com NR-17 (avaliação ergonômica)

https://github.com/Projetos-sst/pgr/issues/40

### Objetivo

Registrar avaliação ergonômica (postura, movimentos, carga física/mental, organização do trabalho,
ambiente físico) vinculada a risco do inventário; avaliar formato para instrumentos psicossociais (COPSOQ).

### Estado atual no código

- Nenhuma referência a NR-17, AEP ou AET. `ergonomic` existe só como valor de `riskAgentType` (`schema/risks.ts:35`).
- COPSOQ aparece apenas como texto de exemplo (`schema/psychosocial.ts:240-242`, `risk-factor-form.tsx:118`).
- Módulo psicossocial (`schema/psychosocial.ts`): campanhas (`:63`), perguntas ad-hoc likert/múltipla/livre (`:104`), respostas anônimas (`:130,153`), `psychosocial_risks` ligado a `risks` (`:184,202`), catálogo `psychosocial_risk_factors` por GES sem vínculo com risco (`:223,236`). Ponte campanha→risco em `repositories/psychosocial-campaigns.ts:703-747`.
- Nada psicossocial/ergonômico no consolidado nem no PDF.

### O que já existe

Infra de questionário e ponte campanha→risco (psicossocial), tipo de agente ergonômico.

### O que falta

Modelo da AEP (5–6 dimensões), eventual registro de AET, modelo de instrumento (COPSOQ), seção no PDF.

### Arquivos/domínios provavelmente afetados

Novo `schema/ergonomics.ts`, `domains/pgr/ergonomics.ts`, repositório/actions/REST, UI a partir do risco ou GES, `pgr-consolidated.ts`, template PDF.

### Backend / Frontend

A definir após contexto — não há campos especificados.

### Migration

SIM — tabela de avaliação ergonômica com RLS.

### Testes necessários

Unit (regras do modelo), integração (CRUD + cross-tenant), template PDF.

### Dependências

Desbloqueia #47 (seção 4).

### Riscos

Modelar errado a AEP gera retrabalho em schema; licença do COPSOQ.

### Requisitos faltantes

Q1 (tabela dedicada × colunas em `risk_assessments`), Q2 (enum de adequação + observação × texto ×
escala) e Q3 (COPSOQ como referência agregada × método em texto). Resolvidos na auditoria do Lote 3:
**AET = laudo anexado** pelo GED (não formulário); **granularidade por risco** (critério de aceite da
issue); **sem conclusão global** (a issue não pede); **responsável em texto** (não há cadastro de
profissional — #36).

### Dificuldade

4/5 — módulo novo com modelo indefinido e possível acoplamento ao psicossocial.

### Prontidão

NEEDS PRODUCT DECISION (Q1 modelo, Q2 formato das dimensões, Q3 COPSOQ) — ver
[../lots/lot-03/AUDIT.md](../lots/lot-03/AUDIT.md)

### Cobertura atual

25% — fundação psicossocial reaproveitável; ergonomia em si 0%.

### Lote recomendado

3

### Auditoria do Lote 3 (27/09/2026)

Detalhe em [../lots/lot-03/AUDIT.md](../lots/lot-03/AUDIT.md); plano em
[../lots/lot-03/PLAN.md](../lots/lot-03/PLAN.md).

- Nada de NR-17/AEP/AET existe; `ergonomic` é só agente de risco.
- O módulo psicossocial é questionário genérico Likert com respostas **anônimas** (sem vínculo com
  funcionário) e derivação por limiar **do projeto** — **não** é metodologia COPSOQ e não pode ser
  apresentada como tal no PGR.
- Modelo recomendado: **tabela dedicada** `ergonomic_evaluations` (1:N por risco, vigente = mais
  recente), com seis dimensões, método, responsável e data.
- Migration: **SIM** (tabela + enum, se Q2 = enum). Nenhuma criada ainda.
- UI: seção no **detalhe do risco**, no padrão visual global (`data-list` + `_ui/form`).

## Execução

| Branch                         | PR  | Migration | Testes | CI  | Decisão          | Status  |
| ------------------------------ | --- | --------- | ------ | --- | ---------------- | ------- |
| `feature/lot-03-nr17-nr18-pgr` | —   | prevista  | —      | —   | Q1/Q2/Q3 abertas | Backlog |
