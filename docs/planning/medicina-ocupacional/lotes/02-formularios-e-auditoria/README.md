# Lote 02 — Formulários, persistência e auditoria clínica

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status do lote** | **02A IMPLEMENTADO (sem migration), em PR** — validações e mensagens dos exames ([TASK](TASK.md) §A2). O restante segue **PLANEJADO**, aguardando MED-DEC-08 e MED-DEC-26 para qualquer migration **(atualizado em 2026-10-22)**                                                                                                                                                            |
| Issue              | [NOB-112 — Abas/formulários que alimentam documentos](https://linear.app/nobuggy/issue/NOB-112) (Carlos, In Progress no Linear desde 20/10, sem artefato além da auditoria)                                                                                                                                                                                                                 |
| Relação no Linear  | NOB-112 é "bloqueada por" NOB-93 (modelo completo do Dr. Alcides, In Review, **sem responsável**) e NOB-108; bloqueia NOB-109, NOB-110, NOB-123                                                                                                                                                                                                                                             |
| Responsável        | Carlos (implementação) · Rikelvin revisa a trilha de auditoria (R-05, aceite dele necessário) · Douglas decide ordem de migrations e arquitetura clínica                                                                                                                                                                                                                                    |
| Branch             | `feature/NOB-112-lote-02a-validacoes-exames` (02A, base `origin/develop` = `e6f2542`)                                                                                                                                                                                                                                                                                                       |
| PR                 | [#136](https://github.com/Projetos-sst/pgr/pull/136) (02A, base `develop`, aberta, **sem merge**)                                                                                                                                                                                                                                                                                           |
| Migrations         | **nenhuma criada; numeração NÃO definida.** Propostas descritas em [PLAN](PLAN.md) (P4, P9, ALTER de `health_exams`, arquivamento). **(atualizado em 2026-10-21)** `0054`–`0056` estão reservadas pela #112 e `0057`–`0059` pela pilha #119/#116/#117 (a #115 não tem migration). A próxima livre seria `0060` **se** todas entrarem antes, o que depende da ordem de merge (MED-DEC-08/26) |
| Próxima ação       | Sem migration: o Carlos revisa o rascunho do **mapa campo → entidade → documento** ([PROPOSTA-EXECUCAO](PROPOSTA-EXECUCAO.md) §a; [TASK](TASK.md) T02-A1, ainda não concluída). Com migration: aguardar MED-DEC-08 e MED-DEC-26 **(atualizado em 2026-10-21)**                                                                                                                              |

## Objetivo

Dar estrutura e rastreabilidade ao **registro** de exames, sem ainda emitir documento:

- formulários e dados estruturados a partir do mapa das abas do protótipo (entregável da NOB-112);
- procedimentos do exame (P4), **sem valores de resultado**;
- persistência, histórico e validações coerentes;
- trilha de auditoria clínica append-only (P9);
- `company_id` histórico do exame (a empresa da data do exame, não a empresa atual do funcionário);
- preservação de registros (arquivamento no lugar de DELETE físico e CASCADE), **depois** do prazo de guarda (MED-DEC-15).

## Bloqueios e dependências

| Item                                                                           | Depende de                                                                                                                                        | Estado       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Qualquer migration deste lote                                                  | MED-DEC-08 (ordem de merge da #112 e da pilha 0057–0059, numeração) e MED-DEC-26 (estratégia de migrations com CD) **(atualizado em 2026-10-21)** | `PENDENTE`   |
| Arquivamento de exames                                                         | MED-DEC-15 (prazo de guarda: Dr. Alcides + jurídico)                                                                                              | `PENDENTE`   |
| Onde guardar dado clínico além da conclusão (camada/schema)                    | MED-DEC-11 (A × B × C, Douglas)                                                                                                                   | `PENDENTE`   |
| Catálogo de procedimentos (por escritório ou referência global; sem resultado) | MED-DEC-24 (Dr. Alcides + Carlos) **(atualizado em 2026-10-21)**                                                                                  | `PENDENTE`   |
| Regra de leitura de `health_exams.company_id` após transferência               | MED-DEC-23 (Dr. Alcides + Expedito) **(atualizado em 2026-10-21)**                                                                                | `PENDENTE`   |
| Destino do campo livre `notes`                                                 | MED-DEC-14 (A-03)                                                                                                                                 | `PENDENTE`   |
| Enum próprio de tipo de exame (hoje compartilhado com OS)                      | D-13 (Douglas)                                                                                                                                    | `PENDENTE`   |
| Mapa de campos (sem migration)                                                 | nada bloqueante; NOB-93 ajudaria (modelo do Dr. Alcides)                                                                                          | pode começar |

## O que este lote não faz

- Não cria migration sem MED-DEC-08 e não reserva numeração.
- Não desenha permissão clínica definitiva (papel clínico, perfis) sem aprovação (MED-DEC-11, MED-DEC-21).
- Não armazena valor de resultado de exame complementar (audiometria, espirometria etc.).
- Não emite ASO nem gera documento (Lote 04).
- Não apaga nem arquiva exames antes da decisão de retenção.

## Documentos da Fase 0 pertinentes

[`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.2, §6, §10.2, §10.4 (P4, P9), §10.6 · [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md)
§7 (R3, R4, R7), §10.1 · [`../../GAP-MATRIX.md`](../../GAP-MATRIX.md) MED-05, 09, 10, 11, 12 · [`../../IMPLEMENTATION-PLAN.md`](../../IMPLEMENTATION-PLAN.md)
(Lote 2) · [`../../AUDIT-PROTOTYPE.md`](../../AUDIT-PROTOTYPE.md) §5.2–5.5 (abas, formulários, validações) · [`../../DECISIONS.md`](../../DECISIONS.md)
D-01, D-07, D-13, A-03, A-07, R-05

## Arquivos do lote

[AUDIT](AUDIT.md) · [PLAN](PLAN.md) · [TASK](TASK.md) · [PROPOSTA-EXECUCAO](PROPOSTA-EXECUCAO.md) (atualizado em 2026-10-21) · [WALKTHROUGH](WALKTHROUGH.md) · [QA](QA.md) · [REVIEW](REVIEW.md)
