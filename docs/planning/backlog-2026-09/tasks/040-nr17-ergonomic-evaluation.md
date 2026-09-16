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

Formato de cada dimensão; AET formulário vs. anexo; COPSOQ via campanhas vs. resultado agregado; granularidade (risco vs. GES).

### Dificuldade

4/5 — módulo novo com modelo indefinido e possível acoplamento ao psicossocial.

### Prontidão

NEEDS CONTEXT

### Cobertura atual

25% — fundação psicossocial reaproveitável; ergonomia em si 0%.

### Lote recomendado

3

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
