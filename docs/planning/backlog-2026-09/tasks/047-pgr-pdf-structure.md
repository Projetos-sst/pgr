# #47 — [PGR] Montar estrutura completa do PDF do PGR (NR-01/09/17)

https://github.com/Projetos-sst/pgr/issues/47

### Objetivo

PDF com 5 seções na ordem: 1) Identificação (empresa, unidade/obra, responsável técnico, preposto); 2) Inventário de riscos; 3) NR-09; 4) NR-17; 5) Plano de ação 5W2H — com dado real.

### Estado atual no código

- Pipeline pronto: `integrations/pdf/gotenberg.ts`, `server/platform/pgr-pdf-core.ts:34-46`, rota `api/v1/pgr/[id]/pdf/route.ts` (só `?color=`), e worker via `server/platform/pdf-batch-core.ts:32` — **dois chamadores**.
- Seções: `PgrPdfSectionKey = "risks" | "actionPlan" | "controlHierarchy"` (`domains/pgr/pgr-pdf-template.ts:26`).
- Ordem de `buildPgrHtml` (`:229-272`): capa (empresa, site, unidade, responsável técnico `pgr.responsible`, ART, registro, emissão/validade) → cabeçalho ISO opcional de `form_controls` (`:119-126`) → sumário → por GES: inventário, plano, hierarquia.
- **Preposto não sai no PDF**: existe como `work_units.managerName/managerRole` (`schema/work-units.ts:47-50`, rótulo "Gestor/Preposto"), mas o consolidado só lê `workUnits.name` (`repositories/pgr-consolidated.ts:66-77`).
- **Plano não é 5W2H**: lê `control_measures` e imprime Nível/O quê/Como/Responsável/Prazo/Situação (`:163-184`); `action_plans` tem os 7 campos (`schema/action-plans.ts:45-51`).
- Inventário não imprime LT/concentração/unidade (já no consolidado). EPIs por risco estão no consolidado, não no PDF.
- Testes: `domains/pgr/__tests__/pgr-pdf-template.test.ts` (10 casos), `__tests__/integration/reports/pgr-pdf-route.test.ts`, `server/platform/__tests__/pdf-batch-core.test.ts`.

### O que já existe

Pipeline, capa com identificação parcial, inventário, plano parcial, cabeçalho ISO.

### O que falta

Seção de identificação explícita com preposto; dados quantitativos no inventário; seções NR-09 e NR-17; plano 5W2H completo.

### Arquivos/domínios provavelmente afetados

`pgr-pdf-template.ts`, `domains/pgr/pgr-consolidated.ts`, `repositories/pgr-consolidated.ts`, testes do template e da rota.

### Backend

Ampliar o consolidado (unidade com preposto, avaliações NR-09/NR-17, `action_plans` por risco/medida). Derivação pura, sem coluna nova.

### Frontend

Nenhum obrigatório (opcional: refletir na aba consolidada).

### Migration

NÃO.

### Testes necessários

Template (ordem das 5 seções, empty states honestos), integração da rota, `pdf-batch-core`.

### Dependências

#39 (seção 3) e #40 (seção 4). Seções 1, 2 e 5 liberadas já.

### Riscos

PDF é entregável ao cliente; não quebrar cabeçalho ISO nem o worker; empty state não pode parecer dado.

### Requisitos faltantes

Confirmar preposto = `managerName/managerRole`; confirmar fonte 5W2H = `action_plans`.

### Dificuldade

3/5 — sem migration, mas contrato visível, dois chamadores e dependência de duas issues.

### Prontidão

BLOCKED (por #39 e #40), parcialmente desbloqueável

### Cobertura atual

50% — pipeline, capa e inventário prontos; faltam preposto, NR-09, NR-17 e 5W2H.

### Lote recomendado

2 (seções 1, 2, 3, 5) → 3 (seção 4 e fechamento)

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
