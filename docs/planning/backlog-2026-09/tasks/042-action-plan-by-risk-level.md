# #42 — [PGR] Regras de vinculação do Plano de Ação por nível de risco

https://github.com/Projetos-sst/pgr/issues/42

### Objetivo

(a) Status da medida MANTER/INTRODUZIDA/APRIMORADA por nível de risco — **pronto**. (b) Todo risco do
inventário com entrada correspondente no plano de ação — **falta**.

### Estado atual no código (confirmado)

- Enum `maintain|introduced|improved` e coluna `control_measures.status` (`schema/risks.ts:94-98,211`; migration `0031_epgr_correcoes_grupo_a.sql`).
- Regra: `defaultMeasureStatusForClassification` (`domains/pgr/control-measure.ts:82-87`), moderado+ exige responsável e prazo em `applyMeasureStatusRule` (`repositories/control-measures.ts:92-109`), aplicada em create/update. **Não age em risco nunca avaliado.**
- Testes: `__tests__/unit/domains/pgr/control-measure.test.ts:107-164`, `__tests__/integration/control-measures/control-measure-status-rule.test.ts` (9 casos).
- Ponte `control_measure → action_plan` (`repositories/control-measure-bridge.ts:51-120`): só dispara com `applicable` e `actionWhat` + `actionHow` preenchidos; `origin_type = control_measure`.
- Origens aceitas: `risk | incident | control_measure` (`domains/safety/action-plan-origin.ts:11`).
- `action_plans.what/why/who/where/how` NOT NULL (`schema/action-plans.ts:45-50`).
- Nenhuma consulta/indicador de "risco sem plano". Sinais próximos: empty state por risco (`pgr-consolidated-tab.tsx:143-147`), `pendingMeasuresCount` (`pgr-editor-tabs.tsx:110-114`), `controlsOverdue` no dashboard (`repositories/dashboard.ts:157-167`).

### O que falta

Consulta derivada de cobertura + indicador + atalho para criar o plano.

### Premissa

Indicador derivado + ação "Criar plano" (`origin_type = risk`), **sem** gerar registro automático — geração
automática exigiria texto fictício nos campos NOT NULL.

### Arquivos/domínios provavelmente afetados

`repositories/pgr-consolidated.ts` (ou `risks.ts`), domínio puro de cobertura, action + REST GET, `pgr-consolidated-tab.tsx`, `risks/page.tsx`, formulário de plano de ação (pré-preenchimento de origem).

### Backend

Risco coberto = existe `action_plans` não cancelado com origem `(risk, risk.id)` **ou** `(control_measure, medida do risco)`. Uma query com `NOT EXISTS`, dentro de `withOrg`.

### Frontend

Contador "N riscos sem plano de ação" na aba Inventário e na lista de riscos; badge por risco; botão "Criar plano".

### Migration

NÃO.

### Testes necessários

Unit (função de cobertura), integração (plano direto, plano via ponte, plano cancelado não cobre, cross-tenant), REST.

### Dependências

Nenhuma.

### Riscos

Definição de "coberto" divergir da expectativa do cliente — mitigado pelas perguntas em REQUIREMENTS-GAPS.

### Requisitos faltantes

Indicador vs. geração automática; risco via ponte conta; risco nunca avaliado conta.

### Dificuldade

2/5 — consulta derivada em domínio conhecido, sem migration.

### Prontidão

READY COM PREMISSAS

### Cobertura atual

50% — regra de status completa e testada; cobertura por risco inexistente.

### Lote recomendado

1

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
