# Lote 00 — Alinhamento e contratos

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo                     | Valor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status do lote**        | **EM_EXECUCAO** — frente contínua de decisões, em paralelo ao [Lote 01](../01-ficha-saude-ocupacional/README.md), **sem bloqueá-lo**                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Natureza                  | Documental e de alinhamento. **Nenhum código, nenhuma migration, nenhuma escrita no Linear** sem autorização do Carlos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Issues                    | [NOB-98](https://linear.app/nobuggy/issue/NOB-98) (Rikelvin, In Progress, 0 comentários) · afeta [NOB-108](https://linear.app/nobuggy/issue/NOB-108), [NOB-109](https://linear.app/nobuggy/issue/NOB-109), [NOB-110](https://linear.app/nobuggy/issue/NOB-110), [NOB-111](https://linear.app/nobuggy/issue/NOB-111), [NOB-112](https://linear.app/nobuggy/issue/NOB-112), [NOB-113](https://linear.app/nobuggy/issue/NOB-113), [NOB-121](https://linear.app/nobuggy/issue/NOB-121) · coerência do backlog: [NOB-93](https://linear.app/nobuggy/issue/NOB-93), [NOB-94](https://linear.app/nobuggy/issue/NOB-94) |
| PR relacionada            | #112 (NOB-98, Rikelvin): **aberta**, base = branch do NOB-100 (já mergeada), **nunca rodou CI**, conflito em `docs/api/sst-manager.postman_collection.json`, reserva `0054`/`0055`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Responsável pelo registro | Carlos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Quem decide               | Douglas (técnica, ordem de merge, arquitetura) · Expedito (produto) · Dr. Alcides (clínica) · Rikelvin (contrato de riscos, #112)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Branch                    | nenhuma própria; os documentos vivem na branch do Lote 01 (`feature/NOB-108-ficha-saude-ocupacional`), conforme MED-DEC-22                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Próxima ação              | Carlos decidir se autoriza publicar o comentário de atualização na NOB-98 ([04 §3](../../geral/04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado)). Ver [TASK](TASK.md)                                                                                                                                                                                                                                                                                                                                                                                                              |

## Objetivo

Fechar, com dono e fonte, as decisões que destravam os Lotes 02 a 05, e manter coerentes os contratos entre a
Segurança (PGR, Rikelvin) e a Medicina (Carlos). Este lote **não cria um registro de decisões paralelo**: o registro vivo
é [`../../geral/04-DECISOES-E-BLOQUEIOS.md`](../../geral/04-DECISOES-E-BLOQUEIOS.md) (IDs `MED-DEC-NN`) e o histórico da
Fase 0 é [`../../DECISIONS.md`](../../DECISIONS.md) (IDs `D-`, `E-`, `A-`, `R-`, `C-`). Aqui ficam só o recorte, a
auditoria do estado e as ações de alinhamento.

## Escopo

| Tema                                            | Onde está detalhado                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| NOB-98 e a pergunta de autorização              | [AUDIT §2](AUDIT.md#2-nob-98-e-a-pergunta-de-autorização) · [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.7 |
| PR #112: retarget, CI, merge, efeito da `0055`  | [AUDIT §3](AUDIT.md#3-pr-112) · [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4–4.5                           |
| Relação com o Rikelvin (regras de convivência)  | [PLAN §3](PLAN.md#3-convivência-com-o-trabalho-do-rikelvin) · [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §3       |
| Arquitetura multi-tenant (A × B × C)            | [AUDIT §4](AUDIT.md#4-arquitetura-multi-tenant) · [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §10.3            |
| Identidade profissional                         | [AUDIT §5](AUDIT.md#5-identidade-profissional)                                                                          |
| Contrato de riscos Segurança → Medicina         | [`../../geral/03-ARQUITETURA-E-CONTRATOS.md`](../../geral/03-ARQUITETURA-E-CONTRATOS.md) §5                             |
| Decisões do Expedito e validação do Dr. Alcides | [`../../geral/04-DECISOES-E-BLOQUEIOS.md`](../../geral/04-DECISOES-E-BLOQUEIOS.md)                                      |
| Fluxo ASO/PCMSO                                 | [AUDIT §7](AUDIT.md#7-fluxo-asopcmso) · [Lote 04](../04-aso/README.md) · Lote 05                                        |
| Ordem de migrations e dependências              | [PLAN §4](PLAN.md#4-ordem-de-migrations-proposta-não-decidida) · [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §1    |

## Estado das decisões (recorte; o registro vivo é o [04](../../geral/04-DECISOES-E-BLOQUEIOS.md))

### CONFIRMADO

| Fato                                                                                                                          | Fonte                                                  | Estado                                    |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| A **empresa** escolhe quem concede a autorização para validar tecnicamente os riscos do PGR (opção 3 da pergunta do Rikelvin) | Resposta de Expedito no grupo, 21/10/2026 — MED-DEC-01 | `PARCIALMENTE_RESPONDIDA`                 |
| Os **dados de identificação do profissional** que valida devem ser registrados                                                | Mesma resposta — MED-DEC-01                            | `PARCIALMENTE_RESPONDIDA`                 |
| PGR e Medicina são **módulos independentes por empresa-cliente**                                                              | NOB-97/NOB-100 — PRs #109 e #111 (mergeadas)           | decisão tomada                            |
| Cadastros (empresa, funcionário, função, GES) são **compartilhados**, sem cópia por módulo                                    | NOB-99 — PR #110 (mergeada)                            | decisão tomada                            |
| Riscos de fonte externa (e interna) entram **pendentes** e imutáveis                                                          | `0054` da PR #112 (**ainda não mergeada**)             | decisão do desenho, condicionada ao merge |
| Owner/colaborador **não** são responsáveis técnicos presumidos                                                                | spec NOB-98 e corpo da PR #112                         | decisão tomada                            |

### PENDENTE

| Pendência                                                                                                                                                                                                                     | Entrada no registro    | Quem responde                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| Autorização técnica completa (quem valida, categorias, se o autorizador também valida)                                                                                                                                        | MED-DEC-03             | Dr. Alcides                                      |
| Identidade Clerk ↔ profissional (`medicos`) e comprovação                                                                                                                                                                     | MED-DEC-04             | Douglas (com Rikelvin)                           |
| Designação por empresa e escopo da autorização                                                                                                                                                                                | MED-DEC-06             | Dr. Alcides + Expedito                           |
| Revogação e destino das validações anteriores                                                                                                                                                                                 | MED-DEC-06             | Dr. Alcides + Expedito                           |
| Política de validação (nota obrigatória, motivo de rejeição)                                                                                                                                                                  | MED-DEC-07             | Dr. Alcides                                      |
| Profissional externo (clínica parceira)                                                                                                                                                                                       | MED-DEC-05             | Expedito                                         |
| PR #112: retarget, CI, merge, aceite da `0055`                                                                                                                                                                                | MED-DEC-08, MED-DEC-09 | Rikelvin (execução), Douglas + Expedito (aceite) |
| Assinatura técnica (provedor ICP-Brasil)                                                                                                                                                                                      | MED-DEC-19             | Expedito + Douglas                               |
| Arquitetura clínica aprovada pelo Douglas (A × B × C)                                                                                                                                                                         | MED-DEC-11             | Douglas                                          |
| Dono da identidade profissional (NOB-121 × NOB-98) e reescopo da NOB-111                                                                                                                                                      | MED-DEC-10             | Douglas                                          |
| **Ambiguidade:** "empresa" na resposta do Expedito é a empresa-cliente (`companies`) ou o escritório (`orgs`)? Hoje nenhum usuário da empresa-cliente acessa o sistema (`client` bloqueado; `scoped_company_id` não aplicado) | MED-DEC-02             | Expedito                                         |

Lista completa, com IDs, fontes e próximas ações: [`../../geral/04-DECISOES-E-BLOQUEIOS.md`](../../geral/04-DECISOES-E-BLOQUEIOS.md)
e [`../../DECISIONS.md`](../../DECISIONS.md).

## Comentário proposto para a NOB-98

O texto está em [`../../geral/04-DECISOES-E-BLOQUEIOS.md` §3](../../geral/04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado).
**Não publicado.** Publicar exige autorização do Carlos (MED-DEC-22); o comentário não muda responsável nem status da
NOB-98, que é do Rikelvin.

## O que este lote não faz

- Não implementa concessão de permissões, papel clínico, fluxo de validação nem identidade profissional.
- Não transforma a resposta parcial do Expedito em regra completa.
- Não decide por Douglas, Expedito, Dr. Alcides ou Rikelvin, e não atribui trabalho a eles sem aceite.
- Não bloqueia o Lote 01 (zero migration, não lê riscos).

## Documentos da Fase 0 pertinentes

[`../../DECISIONS.md`](../../DECISIONS.md) · [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) ·
[`../../IMPLEMENTATION-PLAN.md`](../../IMPLEMENTATION-PLAN.md) (Lote 0) · [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.3–4.7 ·
[`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4, §10.4, §10.6 · [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §10.3 ·
[`../../AUDIT-ARCHITECTURE.md`](../../AUDIT-ARCHITECTURE.md) §4.8, §5.3

## Arquivos do lote

[AUDIT](AUDIT.md) · [PLAN](PLAN.md) · [TASK](TASK.md) · [WALKTHROUGH](WALKTHROUGH.md) · [QA](QA.md) · [REVIEW](REVIEW.md)
