# Lote 05 — PCMSO · QA

## NÃO INICIADO — nenhum teste executado

Nenhum cenário foi executado. Lote bloqueado pela NOB-98.

## Ambiente previsto

Igual ao [Lote 04](../04-aso/QA.md): unit (`npm run test`), integração em **Postgres efêmero** com `INTEGRATION_*`
(conferir que nada saiu "skipped"), REST no padrão de `rest-health-exams.test.ts`, E2E Playwright protected. Seed
fictício com fontes `medical_risk_*` (depende da #112 mergeada). Nenhum dado clínico real.

## Cenários planejados

Numeração do mapa de [AUDIT-LINEAR-QA §6.1](../../AUDIT-LINEAR-QA.md) entre parênteses.

| # | Cenário | Camada | Resultado esperado |
|---|---|---|---|
| Q05-01 | Emitir com uma fonte `pending` | U + I | recusado; nada gravado (16) |
| Q05-02 | Emitir com fonte `rejected` ou `changed`/`unavailable`/`superseded` | I | recusado (16, 21) |
| Q05-03 | Fonte alterada depois da emissão | I | versão emitida intacta; evento "fonte desatualizada" (21) |
| Q05-04 | Nova versão após emissão | I | exige nova revisão (17) |
| Q05-05 | Coordenador sem designação vigente / revogado | I | `FORBIDDEN` no servidor e recusa no banco (6, 7) |
| Q05-06 | Owner tentando validar/emitir sem vínculo profissional | I | recusado |
| Q05-07 | Empresa sem `medicine` | I | leitura e escrita bloqueadas (2) |
| Q05-08 | Empresa só-Medicina com PGR externo | I | PCMSO usa a fonte `external`, que nunca nasce validada (3, 20) |
| Q05-09 | Cross-tenant por ID | I | `NOT_FOUND`/404 (11) |
| Q05-10 | Versão concorrente | I | UNIQUE(org, program, version) impede duplicidade (15) |
| Q05-11 | Runtime tenta UPDATE do snapshot ou DELETE de versão | I | negado |
| Q05-12 | Periodicidade fora das regras aprovadas | U | `VALIDATION` |
| Q05-13 | Sem dataset Lista C ativo | U + I | seção NTEP omitida com aviso; snapshot sem `dataset_id` |
| Q05-14 | Rascunho com fonte pendente | E | aviso visível; documento não baixável como PCMSO válido (13) |
| Q05-15 | Nenhuma leitura direta de `risks` | revisão de código + I | consultas só em `medical_risk_*` |
| Q05-16 | Erro de leitura | U + E | `ErrorState`, nunca lista vazia (18) |
| Q05-17 | Regressão do GED do PGR | I | inalterado |

## Evidências a registrar

Comando, ambiente, contagens (passados/falhos/skipped), saída relevante, data, commit testado.
