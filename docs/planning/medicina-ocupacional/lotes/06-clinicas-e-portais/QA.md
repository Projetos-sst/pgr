# Lote 06 — Profissionais, clínicas e portais · QA

## NÃO INICIADO — nenhum teste executado

Nenhum cenário foi executado. Lote bloqueado.

## Ambiente previsto

Unit + integração em **Postgres efêmero** (`INTEGRATION_*`, conferir "skipped") + E2E Playwright protected com um
usuário por perfil (escritório, RH, clínica, profissional). Seed fictício com duas empresas no mesmo escritório, uma
clínica vinculada e outra não. Nenhum dado clínico real. `portal.py` do protótipo serve **só como roteiro**; não é executado.

## Cenários planejados

Numeração do mapa de [AUDIT-LINEAR-QA §6.1](../../AUDIT-LINEAR-QA.md) entre parênteses.

| #      | Cenário                                                                | Camada | Resultado esperado                                             |
| ------ | ---------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Q06-01 | Clínica consulta trabalhador de empresa não vinculada                  | I + E  | negado no servidor e no banco (9)                              |
| Q06-02 | Clínica consulta trabalhador de empresa vinculada, mas não encaminhado | I      | negado ou mínimo, conforme matriz aprovada                     |
| Q06-03 | RH da empresa A consulta dado da empresa B do mesmo escritório         | I + E  | negado (8)                                                     |
| Q06-04 | RH consulta resultado clínico/prontuário                               | I + E  | negado                                                         |
| Q06-05 | Clínica recebe dado financeiro da empresa                              | I      | ausente na resposta                                            |
| Q06-06 | Vínculo revogado                                                       | I      | novos encaminhamentos recusados; histórico preservado          |
| Q06-07 | Transição de status inválida do encaminhamento                         | U + I  | recusada                                                       |
| Q06-08 | Agendamento com data passada                                           | U      | `VALIDATION`                                                   |
| Q06-09 | Profissional sem vínculo concluindo encaminhamento                     | I      | `FORBIDDEN` (7)                                                |
| Q06-10 | Cross-tenant por ID em clínica, vínculo, encaminhamento                | I      | `NOT_FOUND`/404 (11)                                           |
| Q06-11 | Troca de organização com sessão de clínica/RH                          | I + E  | nenhum dado da organização anterior (10)                       |
| Q06-12 | Usuário `client` sem escopo definido                                   | I      | sem acesso a nada (comportamento atual preservado)             |
| Q06-13 | Leitura de dado clínico gera evento de auditoria                       | I      | evento na mesma transação, sem conteúdo clínico                |
| Q06-14 | Aba/rota fora do perfil                                                | E      | redireciona/nega no servidor (roteiro `portal.py`)             |
| Q06-15 | Responsividade e acessibilidade dos portais                            | E      | 375/768/1440 sem rolagem horizontal; alvos ≥ 44px; `aria-live` |

## Evidências a registrar

Comando, ambiente, perfis usados, contagens (passados/falhos/skipped), saída relevante, data, commit testado.
