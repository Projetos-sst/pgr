# Lote 04 — ASO (emissão, snapshot, GED e assinatura técnica)

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo                 | Valor                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status do lote**    | **PLANEJADO** — depende do [Lote 03](../03-identidade-e-riscos/README.md) (identidade profissional) e do desenho da camada de emissão aprovado pelo Douglas  |
| Issue                 | [NOB-110 — Fluxo de geração do ASO](https://linear.app/nobuggy/issue/NOB-110) — Backlog no Linear (21/10), milestone "4. Medicina Ocupacional — PCMSO e ASO" |
| Responsável no Linear | Carlos                                                                                                                                                       |
| Branch                | nenhuma criada                                                                                                                                               |
| PR                    | nenhuma                                                                                                                                                      |
| Migrations            | nenhuma criada; propostas P3, P7 e P8 (ver [PLAN](PLAN.md))                                                                                                  |
| Próxima ação          | **Nenhuma implementação.** Coletar as decisões A-03, A-04, A-05, A-09 (Dr. Alcides), D-06 (Douglas) e E-07 (Expedito + Douglas) e aguardar o Lote 03         |

## Objetivo

Sair do **registro** de exame que existe hoje (`health_exams`) para a **emissão** de um ASO: formulário definitivo, dados
obrigatórios validados, procedimentos, médico identificado, revisão, snapshot imutável, documento no GED, histórico de
versões e assinatura técnica do médico. Até que o fluxo oficial seja aprovado, o sistema só pode produzir **prévia ou
rascunho claramente identificados** (ver regras abaixo).

## Responsáveis por frente

| Frente                                                                           | Quem                           | Observação                                                             |
| -------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Implementação da parte de Medicina (domínio, telas, testes)                      | Carlos                         | issue atribuída                                                        |
| Camada de emissão genérica (snapshot, `documents`, worker, template-engine)      | **Douglas decide** (D-06)      | dono do pipeline DOCX/PDF/GED; o gerador do PGR **não** é reconstruído |
| Campos obrigatórios, conclusão × dado sigiloso, quem emite, estados do documento | Dr. Alcides (A-03, A-05, A-09) | regras clínicas; nada é inventado                                      |
| Riscos que o ASO pode listar                                                     | Dr. Alcides (A-04)             | ver "Pergunta A-04"                                                    |
| Provedor ICP-Brasil e modalidade                                                 | Expedito + Douglas (E-07)      | bloqueia só a assinatura técnica                                       |
| Revisão de autorização e auditoria clínica                                       | Rikelvin (R-05)                | revisão, não implementação                                             |

## Dependências (resumo; detalhe em [PLAN](PLAN.md))

| Depende de                                                                                                 | Situação em 21/10                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Identidade profissional + designação por empresa (P1, [Lote 03](../03-identidade-e-riscos/README.md))      | bloqueada por decisão (NOB-98 / resposta parcial do Expedito)                       |
| Procedimentos por exame (P4) e auditoria clínica (P9) — [Lote 02](../02-formularios-e-auditoria/README.md) | planejados, aguardam ordem de migrations                                            |
| Riscos **validados** via `medical_risk_*` (PR #112 + revisão P5)                                           | PR #112 aberta, sem CI; revisão inexistente                                         |
| Desenho P7 aprovado pelo Douglas                                                                           | não discutido                                                                       |
| Provedor de assinatura técnica (P8)                                                                        | não escolhido                                                                       |
| Lista C (NOB-113)                                                                                          | **não** bloqueia o ASO se o Dr. Alcides confirmar que "Lista C" = NTEP (A-02, D-10) |

Linear: NOB-110 é bloqueada por NOB-101, NOB-108, NOB-112 e NOB-113 e bloqueia NOB-118, NOB-125, NOB-128 e NOB-129
([AUDIT-LINEAR-QA §4.3](../../AUDIT-LINEAR-QA.md)).

## Regras invioláveis deste lote

1. A assinatura simples por QR/link/rabisco (`signature_requests` / `signature_captures`) **não substitui** a assinatura
   técnica do médico. Ela pode servir, no máximo, para a **ciência do trabalhador**.
2. Nenhum documento é marcado como **oficialmente assinado** sem assinatura técnica válida, vinculada ao hash do arquivo
   emitido. Sem provedor, o estado máximo é "emitido, sem assinatura técnica".
3. Até a aprovação do fluxo oficial (A-09), só **prévia/rascunho** com identificação visível ("PRÉVIA — sem validade
   legal"), nunca um ASO apresentado como válido.
4. Não reproduzir do protótipo: "Aprovar como \<médico\>" (aprovação em nome de terceiro), empresa emitindo ASO próprio
   (R-05), `docASO` lendo CPF/nascimento ao vivo, IA com laudo, `localStorage`.
5. Owner/colaborador não são médicos presumidos. Nenhum dado de saúde em prompt de IA. Nenhum dado clínico real em teste.

## Pergunta A-04 (registrada, sem resposta)

> **O ASO pode listar riscos ainda não validados (com aviso), ou só riscos validados?** — destinatário: Dr. Alcides.
> Fonte: [DECISIONS.md A-04](../../DECISIONS.md), [IMPLEMENTATION-PLAN.md, Lote 4](../../IMPLEMENTATION-PLAN.md).

**Entrega independente do PCMSO:** tecnicamente o ASO pode ter uma primeira entrega **sem** o PCMSO completo (o snapshot
registra exame, aptidão, médico e procedimentos sem versão de PCMSO). A **exceção é a seção de riscos**: ela depende de
fonte validada da NOB-98 ou de decisão clínica explícita (A-04). Até lá, a seção de riscos fica fora do documento ou
aparece só em prévia, marcada como não validada.

## Documentos do lote

| Arquivo                          | Conteúdo                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- |
| [AUDIT.md](AUDIT.md)             | O que existe hoje, código, lacunas e riscos                                       |
| [PLAN.md](PLAN.md)               | Arquitetura proposta, migrations, segurança, sequência e o que depende de decisão |
| [TASK.md](TASK.md)               | Tarefas implementáveis (todas não iniciadas)                                      |
| [WALKTHROUGH.md](WALKTHROUGH.md) | NÃO INICIADO                                                                      |
| [QA.md](QA.md)                   | NÃO INICIADO — cenários planejados                                                |
| [REVIEW.md](REVIEW.md)           | NÃO INICIADO — checklist de revisão                                               |

## Fontes da Fase 0

- [IMPLEMENTATION-PLAN.md — Lote 4](../../IMPLEMENTATION-PLAN.md)
- [GAP-MATRIX.md — MED-05, MED-09, MED-12, MED-18, MED-19, MED-20, MED-21](../../GAP-MATRIX.md)
- [DEPENDENCIES.md §1 e §4](../../DEPENDENCIES.md)
- [DECISIONS.md — A-03, A-04, A-05, A-09, D-06, D-10, E-07](../../DECISIONS.md)
- [AUDIT-DATABASE.md §4.6, §10.3, §10.4 (P3, P7, P8)](../../AUDIT-DATABASE.md)
- [AUDIT-SECURITY.md §10](../../AUDIT-SECURITY.md)
- [AUDIT-PROTOTYPE.md §5.6, §5.13 (P-11, P-12, P-13), §5.14 (J-01, J-02, J-03)](../../AUDIT-PROTOTYPE.md)
- [AUDIT-UX.md §5 (tela 9), §10.4](../../AUDIT-UX.md)
- [AUDIT-LINEAR-QA.md §4.5, §6.1](../../AUDIT-LINEAR-QA.md)
