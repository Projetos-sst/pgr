# Lote 00 — QA

> [README do lote](README.md)

## Estado

**NÃO INICIADO — nenhum teste executado.** Este lote não produz código; o "QA" é conferência de coerência documental e
do estado externo (Linear, GitHub).

## Verificações planejadas

| #     | Verificação                                                                                                  | Como                                                                                     | Evidência esperada                      |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| Q00-1 | Toda decisão citada nos lotes existe no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md) com o mesmo ID e estado | leitura cruzada dos README/PLAN dos lotes                                                | lista sem divergência                   |
| Q00-2 | Nenhuma decisão `PARCIALMENTE_RESPONDIDA` aparece como regra implementada em algum PLAN                      | busca por MED-DEC-01 nos PLAN                                                            | ocorrências só como pendência           |
| Q00-3 | Estado da #112 confere com o GitHub                                                                          | `gh pr view 112 --json baseRefName,state,isDraft` e `gh pr checks 112` (somente leitura) | base, estado e checks anotados com data |
| Q00-4 | Status do Linear confere com o [02](../../geral/02-ROADMAP-E-STATUS.md)                                      | consulta de leitura via MCP                                                              | divergências listadas                   |
| Q00-5 | Nenhum dado pessoal (telefone, e-mail) nos documentos da frente                                              | busca por padrões de e-mail/telefone na pasta                                            | zero ocorrências                        |
| Q00-6 | Links relativos válidos                                                                                      | conferência dos links dos lotes 00–03                                                    | sem link quebrado                       |

Ambiente: somente leitura. Comandos que escrevem (comentar, mudar status, retarget) **não** fazem parte do QA.
