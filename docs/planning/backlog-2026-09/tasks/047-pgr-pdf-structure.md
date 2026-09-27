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

Preposto: **confirmado** = `work_units.manager_name`/`manager_role` (o formulário rotula
"Gestor/Preposto"). Fonte do 5W2H: **`control_measures`** — `action_plans` foi descartada (a ponte #51
fabrica `who`/`why`/`where`). Q3 decidida em 27/09: **7 de 7**, com
`action_why` e `action_cost` novos em `control_measures`.

### Dificuldade

3/5 — sem migration, mas contrato visível, dois chamadores e dependência de duas issues.

### Prontidão

Partes A (identificação + inventário), B (NR-09, após #39) e D (5W2H **7 de 7**, decidido em 27/09)
**READY**; Parte C (NR-17) **BLOCKED por #40** → Lote 3

### Cobertura atual

50% — pipeline, capa e inventário prontos; faltam preposto, NR-09, NR-17 e 5W2H.

### Lote recomendado

2 (seções 1, 2, 3, 5) → 3 (seção 4 e fechamento)

### Auditoria do Lote 2 (26/09/2026)

Detalhe completo em [../lots/lot-02/AUDIT.md](../lots/lot-02/AUDIT.md).

| Parte | Conteúdo                                  | Situação                 |
| ----- | ----------------------------------------- | ------------------------ |
| A     | Seção 1 (identificação) + Seção 2 (NR-01) | READY agora              |
| B     | Seção 3 (NR-09)                           | READY após #39           |
| C     | Seção 4 (NR-17)                           | BLOCKED por #40 → Lote 3 |
| D     | Seção 5 (5W2H)                            | Depende de Q3            |

- 5 dos 7 elementos 5W2H já existem em `control_measures` (o quê, como, quem, quando + "onde"
  derivado do GES); faltam **por quê** e **quanto**.
- Identificação: consolidado precisa carregar empresa e unidade completas (sem migration).
- Inventário: LT, concentração, unidade, código eSocial, EPIs e cobertura #42 já estão no consolidado
  e só não são impressos.
- O template tem **dois chamadores** (rota e worker) — ambos precisam ser conferidos.
- #47 **não fecha** neste lote.

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
