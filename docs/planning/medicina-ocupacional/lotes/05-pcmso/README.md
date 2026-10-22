# Lote 05 — PCMSO

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo                 | Valor                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status do lote**    | **BLOQUEADO** — pela NOB-98 (validação técnica de riscos sem validador definido)                                                                                      |
| Issue                 | [NOB-109 — Geração automática do PCMSO](https://linear.app/nobuggy/issue/NOB-109) — Backlog no Linear (21/10), milestone "4. Medicina Ocupacional — PCMSO e ASO"      |
| Bloqueio principal    | [NOB-98 — Integração riscos PGR → PCMSO](https://linear.app/nobuggy/issue/NOB-98) (Rikelvin, In Progress; PR #112 aberta, sem CI)                                     |
| Responsável no Linear | Carlos                                                                                                                                                                |
| Branch                | nenhuma criada                                                                                                                                                        |
| PR                    | nenhuma                                                                                                                                                               |
| Migrations            | nenhuma criada; proposta P6 (+ consumo de P1, P4, P5, P7, P8)                                                                                                         |
| Próxima ação          | **Nenhuma implementação.** Aguardar a NOB-98 completa (fontes mergeadas, validador definido, revisão implementada) e a periodicidade aprovada pelo Dr. Alcides (A-06) |

## Objetivo

Programa de Controle Médico de Saúde Ocupacional **por empresa-cliente**: coordenador designado, riscos validados (de
PGR interno ou externo), plano de exames por GES/função com periodicidade aprovada, versões com revisão, emissão com
snapshot imutável, documento no GED e assinatura técnica do coordenador.

## Por que está bloqueado

1. `canUseMedicalRisk` (PR #112) só libera riscos `validated` e frescos; a `0054` só aceita INSERT `pending`; não há fluxo
   de revisão. **Hoje nenhum risco é utilizável pelo PCMSO** — comportamento correto.
2. A pergunta "quem valida e como identificar o profissional" teve resposta **PARCIALMENTE_RESPONDIDA** do Expedito em
   21/10/2026: a empresa define quem autoriza e os dados do profissional validador devem ser registrados. Continuam em
   aberto: qual usuário indica o autorizador, se o autorizador também valida, categorias profissionais, comprovação de
   identidade, profissionais externos, escopo, revogação, efeito da revogação sobre validações anteriores, justificativa de
   rejeição, modelo técnico Clerk/banco. **Ambiguidade:** "empresa" = empresa-cliente (`companies`) ou escritório
   (`orgs`)? Hoje nenhum usuário de empresa-cliente acessa o sistema. Detalhe em
   [04-DECISOES-E-BLOQUEIOS](../../geral/04-DECISOES-E-BLOQUEIOS.md) e no [Lote 03](../03-identidade-e-riscos/README.md).
3. Regra: **não gerar PCMSO válido com riscos pendentes.** No máximo um rascunho interno com aviso de "fonte pendente de
   validação", nunca emitido.

## Responsáveis por frente

| Frente                                                                                            | Quem                                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Implementação do PCMSO (domínio, telas, documento, testes)                                        | Carlos                                                                             |
| Fontes de risco e revisão (P5)                                                                    | Rikelvin (NOB-98), com apoio do Carlos                                             |
| Identidade + designação do coordenador (P1)                                                       | dono a decidir (D-03); planejado no [Lote 03](../03-identidade-e-riscos/README.md) |
| Periodicidade, plano de exames, critérios clínicos (A-06), o que é validar (A-01), estados (A-09) | Dr. Alcides                                                                        |
| Quem concede/revoga autorização (E-01)                                                            | Expedito (resposta parcial em 21/10)                                               |
| Camada de emissão (P7) e template                                                                 | Douglas decide (D-06); compartilhada com o [Lote 04](../04-aso/README.md)          |
| Provedor de assinatura (P8)                                                                       | Expedito + Douglas (E-07)                                                          |

## Dependências

| Depende de                                                                        | Situação em 21/10                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| PR #112 mergeada (fontes `medical_risk_*`)                                        | aberta, base errada, conflito no Postman, nunca rodou CI     |
| P1 identidade + designação de coordenador                                         | bloqueada por decisão                                        |
| P5 revisão de riscos append-only                                                  | bloqueada por decisão                                        |
| P4 catálogo de procedimentos ([Lote 02](../02-formularios-e-auditoria/README.md)) | planejado                                                    |
| P7 camada de emissão ([Lote 04](../04-aso/README.md))                             | aguarda Douglas                                              |
| P8 assinatura técnica                                                             | aguarda provedor                                             |
| Lista C oficial (P2, [Lote 03](../03-identidade-e-riscos/README.md))              | **só** para a seção de vigilância NTEP; aguarda fonte (A-02) |
| Periodicidade aprovada                                                            | A-06, Dr. Alcides                                            |

Linear: NOB-109 é bloqueada por NOB-98, NOB-101, NOB-111, NOB-112 e NOB-113 e bloqueia NOB-118, NOB-125, NOB-128 e
NOB-129 ([AUDIT-LINEAR-QA §4.3](../../AUDIT-LINEAR-QA.md)). NOB-98 também bloqueia NOB-130.

## Documentos do lote

| Arquivo                          | Conteúdo                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| [AUDIT.md](AUDIT.md)             | Existente, código da #112, lacunas, riscos                      |
| [PLAN.md](PLAN.md)               | Arquitetura, P6, segurança, sequência e dependências de decisão |
| [TASK.md](TASK.md)               | Tarefas (não iniciadas)                                         |
| [WALKTHROUGH.md](WALKTHROUGH.md) | NÃO INICIADO                                                    |
| [QA.md](QA.md)                   | NÃO INICIADO — cenários planejados                              |
| [REVIEW.md](REVIEW.md)           | NÃO INICIADO — checklist                                        |

## Fontes da Fase 0

- [IMPLEMENTATION-PLAN.md — Lote 5](../../IMPLEMENTATION-PLAN.md)
- [GAP-MATRIX.md — MED-13, MED-14, MED-15, MED-16, MED-22, MED-23](../../GAP-MATRIX.md)
- [DEPENDENCIES.md §1, §3](../../DEPENDENCIES.md)
- [DECISIONS.md — A-01, A-02, A-06, A-09, E-01, D-03, D-06, R-02](../../DECISIONS.md)
- [AUDIT-DATABASE.md §4.4, §4.5, §10.1, §10.3, §10.4 (P5, P6), §10.5](../../AUDIT-DATABASE.md)
- [AUDIT-SECURITY.md §10](../../AUDIT-SECURITY.md)
- [AUDIT-PROTOTYPE.md §5.5, §5.6 (PCMSO), §5.13 (P-16, C-03)](../../AUDIT-PROTOTYPE.md)
- [AUDIT-UX.md §5 (tela 11), §10.2, §10.4](../../AUDIT-UX.md)
- [AUDIT-LINEAR-QA.md §4.7, §6.1](../../AUDIT-LINEAR-QA.md)
