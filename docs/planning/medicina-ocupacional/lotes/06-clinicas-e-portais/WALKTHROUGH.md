# Lote 06 — Profissionais, clínicas e portais · WALKTHROUGH

## NÃO INICIADO

Lote BLOQUEADO pelo escopo de portais (Expedito). Nenhuma implementação, branch, commit, PR ou migration existe.

## O que deverá ser registrado quando o lote começar

| Item                       | O que anotar                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- |
| Escopo confirmado          | resposta de E-02 com fonte: quais portais entram e quais ficam fora           |
| Arquitetura                | decisão D-05 aplicada (A, B ou C) e como o contexto de papel chega ao banco   |
| Identidade consumida       | o que veio do [Lote 03](../03-identidade-e-riscos/README.md) e como foi usado |
| Modelagem de profissionais | `medicos` estendido × `health_professionals`, e a decisão que a fundamenta    |
| Migrations                 | nome real, número, `when`, ensaio em Postgres efêmero                         |
| Arquivos e superfície      | por camada; Action + REST + api-design + Postman por CRUD                     |
| Matriz de acesso efetiva   | o que cada perfil vê, verificado em teste                                     |
| Desvios e limitações       | ex.: resultados clínicos fora até a camada clínica existir                    |

Regra: não escrever PASS, SHA, PR, data de conclusão ou aprovação que não existam.
