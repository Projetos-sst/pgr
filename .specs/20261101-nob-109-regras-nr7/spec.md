# NOB-109 (parcial) — Sugestões de prazo da NR-7 (MED-19, MED-20 regras 2 e 3)

Fonte: Word de Medicina do Dr. Alcides (MED-19 alternativas 2 e 3 marcadas; MED-20 regras 2 e 3 "Vale") e texto
oficial da NR-7 ("NR-07 atualizada 2022", Portaria MTP n.º 567/2022, consultado em 2026-11-01). Zero migration.

## Regras (`src/shared/domains/medicine/nr7-schedule-rules.ts`)

| Função                    | Item da NR-7 | Regra                                                                                                                            |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `suggestDismissalExam`    | 7.5.11       | Demissional até 10 dias após o término; dispensável se o último clínico foi há **menos** de 135 dias (GR 1–2) ou 90 (GR 3–4)     |
| `suggestReturnToWorkExam` | 7.5.9        | Retorno obrigatório antes de reassumir quando a ausência é **igual ou superior** a 30 dias (contagem inclusiva)                  |
| `suggestPeriodicInterval` | 7.5.8, II    | Até 12 meses para expostos ou portadores de doença crônica; 24 meses para não expostos; exposição desconhecida não gera sugestão |

Tudo retorna `requiresMedicalConfirmation: true`: o sistema sugere e o médico confirma (MED-19). A observação da
MED-19 cita 120 dias para GR 1–2; prevalece a norma (135), conforme a MED-20 regra 2.

Interpretação registrada: a contagem dos 135/90 dias usa o término do contrato como data de referência.

## Integração nesta fatia

Ficha do funcionário (seção Saúde ocupacional): com data de desligamento informada e sem demissional registrado,
mostra prazo e sugestão de dispensa, usando o grau de risco da empresa (`companies.risk_grade`). Sem grau de risco,
não sugere dispensa. Regras 7.5.9 e 7.5.8 ficam prontas para os fluxos de afastamento e PCMSO (ainda sem dados de
afastamento nem exposição consolidada).

## Fora do escopo

Regras 4 e 5 (audiometria, espirometria: interpretação clínica, não automatizar), 6 (toxicológico, legislação
específica), 7 (psicossocial no ASO), e regras 1, 8, 9 e 10 (não aprovadas).
