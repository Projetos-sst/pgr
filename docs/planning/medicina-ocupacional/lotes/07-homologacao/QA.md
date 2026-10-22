# Lote 07 — Homologação · QA

## NÃO INICIADO — nenhum teste executado

Nenhum cenário foi executado. Os resultados por lote ficam nos `QA.md` de cada lote; este arquivo registra a visão
consolidada e as jornadas ponta a ponta.

## Ambientes

| Ambiente                      | Uso                                   | Observação                                                             |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Local + Postgres efêmero      | unit, integração, E2E                 | `INTEGRATION_*` obrigatórias; conferir skipped                         |
| CI (`ci.yml`)                 | gate de PR                            | não roda Playwright hoje                                               |
| Homologação (CD de `develop`) | smoke e validação dos interessados    | `APP_ENV=sandbox` + Basic Auth; **migrations já aplicadas pelo merge** |
| Cópia da produção             | ensaio de migrations antes do release | a providenciar (Douglas)                                               |
| Produção (CD de `main`)       | só verificação pós-deploy             | nunca testar com dado clínico real                                     |

## Jornadas ponta a ponta planejadas

Derivadas de [AUDIT-PROTOTYPE §5.14](../../AUDIT-PROTOTYPE.md) e adaptadas ao que a plataforma terá; scripts do protótipo
usados só como roteiro.

| #      | Jornada                                                                                               | Lotes              | Resultado esperado                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| E2E-01 | Escritório habilita Medicina na empresa, cadastra funcionário, registra exame, vê na ficha, recarrega | 01                 | dado persistido; nada em `localStorage`; erro ≠ vazio                                 |
| E2E-02 | Empresa sem Medicina: telas mostram estado vazio explicativo, sem dado                                | 01                 | sem vazamento; CTA correto por papel                                                  |
| E2E-03 | Exame → prévia → emissão do ASO → download autorizado → ciência do trabalhador                        | 04                 | documento imutável; prévia identificada; sem estado "assinado" sem assinatura técnica |
| E2E-04 | Risco alterado no PGR após emissão                                                                    | 04, 05             | documento emitido inalterado (roteiro `flow.py`)                                      |
| E2E-05 | PCMSO: fontes validadas → plano → emissão                                                             | 05                 | emissão recusada com fonte pendente                                                   |
| E2E-06 | Empresa solicita exame → clínica agenda → conclui → ASO                                               | 06 (se confirmado) | clínica só vê o que é dela (roteiro `portal.py`)                                      |
| E2E-07 | Download por usuário de outra organização                                                             | 04, 05             | 404 sem assinar path                                                                  |

## Verificações transversais planejadas

Responsividade (375/768/1440), acessibilidade (AA, `aria-live`, foco, rótulos), regressão do PGR, isolamento
(`runIsolationSuite` em todas as tabelas de saúde), ausência de PII em logs.

## Evidências a registrar

Ambiente, commit, comando, contagens (passados/falhos/skipped), capturas quando E2E, run do CD correspondente, data.
