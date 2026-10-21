# Lote 04 — ASO · QA

## NÃO INICIADO — nenhum teste executado

Nenhum cenário abaixo foi executado. Nenhum resultado existe. Os cenários são o plano de testes do lote.

## Ambiente previsto

| Camada | Onde | Observação |
|---|---|---|
| Unit | `npm run test` (jsdom) | schema do ASO, máquina de estados, canonicalização do snapshot |
| Integração | `npm run test:integration` com `INTEGRATION_DATABASE_URL` (+ `_ADMIN`) apontando para **Postgres efêmero** | sem as variáveis as suites saem como "skipped" e parecem verdes ([AUDIT-LINEAR-QA §5.3](../../AUDIT-LINEAR-QA.md)): conferir a contagem de skipped |
| REST | padrão de `rest-health-exams.test.ts` (roda no Jest), não o dos `rest-*` excluídos em `jest.config.ts` | — |
| E2E | Playwright projeto protected (`E2E_PROTECTED=1`) | Playwright não roda no CI hoje |
| Dados | seed fictício de Medicina (Lote 01/02) | nenhum dado clínico real |

## Cenários planejados

Numeração do mapa de [AUDIT-LINEAR-QA §6.1](../../AUDIT-LINEAR-QA.md) entre parênteses.

| # | Cenário | Camada | Resultado esperado |
|---|---|---|---|
| Q04-01 | Campo obrigatório ausente (A-03) | U + I | `VALIDATION`; nada gravado (14) |
| Q04-02 | ASO sem médico examinador | U + I | bloqueado (roteiro `flow.py`) |
| Q04-03 | Emissor sem designação vigente / owner sem vínculo profissional | I | `FORBIDDEN` no servidor e recusa no banco (6, 7) |
| Q04-04 | Empresa sem módulo `medicine` | I | emissão e leitura bloqueadas (2) |
| Q04-05 | Cross-tenant por ID na emissão e no download | I | `NOT_FOUND`/404, sem assinar path (11, 12) |
| Q04-06 | Trabalhador de outra empresa do mesmo escritório | I | recusado (8) |
| Q04-07 | Snapshot imutável: alterar empresa/função/risco depois da emissão | I | documento e snapshot inalterados (21; roteiro `flow.py`) |
| Q04-08 | Retry do job de render | I | snapshot inalterado; `output_sha256` confere com o objeto |
| Q04-09 | Runtime tenta UPDATE do snapshot ou DELETE da emissão | I | negado pelo banco |
| Q04-10 | Retificação | I | nova emissão; anterior consultável (17) |
| Q04-11 | Cancelamento sem motivo | I | `VALIDATION` |
| Q04-12 | Emissão concorrente do mesmo exame | I | uma vence, sem duplicar versão (15) |
| Q04-13 | Falha na auditoria/evento | I | rollback da emissão (19) |
| Q04-14 | Ciência do trabalhador | I | ligada ao arquivo emitido; não muda o estado para `signed` |
| Q04-15 | Estado `signed` sem assinatura técnica válida | I | impossível |
| Q04-16 | Seção de riscos com fonte não validada | U + I | conforme A-04; se proibido, emissão sem a seção ou bloqueada (16) |
| Q04-17 | Prévia | E | faixa "PRÉVIA — sem validade legal" visível; não baixa como ASO emitido |
| Q04-18 | Regressão do GED do PGR | I | geração/versão/download do PGR inalterados |
| Q04-19 | Erro de leitura | U + E | `ErrorState`, nunca lista vazia (18) |
| Q04-20 | Acessibilidade e responsividade do formulário | E | rótulos em linhas repetíveis, foco, 375/768/1440 |

Os scripts do protótipo (`flow.py`, `portal.py`) servem **só como roteiro** de cenários; não são executados.

## Evidências a registrar

Comando executado, ambiente, contagem de testes (passados/falhos/skipped), saída relevante, data, commit testado.
