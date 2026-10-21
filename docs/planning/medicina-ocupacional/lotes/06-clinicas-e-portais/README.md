# Lote 06 — Profissionais, clínicas e portais

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo | Valor |
|---|---|
| **Status do lote** | **BLOQUEADO** — escopo de portais e perfis da V1 depende do Expedito (E-02) |
| Issues | [NOB-121 — Cadastro de médicos/psicólogos internos e externos](https://linear.app/nobuggy/issue/NOB-121) · [NOB-122 — Portal empresa ↔ clínica](https://linear.app/nobuggy/issue/NOB-122) · [NOB-123 — Conectar protótipo ao front-end](https://linear.app/nobuggy/issue/NOB-123) |
| Status no Linear (21/10) | as três em Backlog, milestone "6. Teleconsultas e portal de clínicas" |
| Responsável no Linear | Carlos (as três) |
| Branch | nenhuma criada |
| PR | nenhuma |
| Migrations | nenhuma criada; nenhuma proposta detalhada (entidades a definir após E-02) |
| Próxima ação | **Nenhuma implementação.** Obter E-02 (perfis/portais da V1) e D-05 (arquitetura de segregação clínica) |

## Divisão com o Lote 03

A parte de **identidade profissional** da NOB-121 (vínculo `medicos` ↔ usuário, CRM + UF, RQE, designação por empresa —
proposta P1) está planejada no [Lote 03 — identidade e riscos](../03-identidade-e-riscos/README.md), porque trava a
NOB-98, a NOB-110 e a NOB-109. **Este lote não a replaneja**; consome o que o Lote 03 entregar. Aqui fica o restante da
NOB-121 (psicólogos, profissionais externos e permissões por vínculo além da designação) e as NOB-122/123.

## Objetivo

Levar para a plataforma, com autorização real, o que no protótipo é simulado: psicólogos, clínicas parceiras, vínculo
empresa ↔ clínica, encaminhamentos com guia e agendamento, e — **somente se o Expedito confirmar** — portais da empresa
(RH) e da clínica, com status e permissões específicas.

## Regras invioláveis

1. Clínica **não** consulta trabalhadores de empresas não vinculadas a ela.
2. RH da empresa **não** consulta prontuários nem resultados clínicos; no máximo a conclusão do ASO, se A-03 permitir.
3. **Não assumir todos os portais na V1** antes da confirmação do Expedito.
4. Nenhum resultado clínico novo (sinais vitais, audiometria, espirometria) é armazenado antes de perfil clínico +
   auditoria de leitura ([AUDIT-SECURITY R2/R3, P0](../../AUDIT-SECURITY.md)).
5. Não copiar a segurança simulada do protótipo ("Ver como", projeção por tela, `exigirVinculo` desligado, dados de todas
   as empresas no navegador). Nada entre organizações; nada em `localStorage`; nenhum dado de saúde em IA.
6. Não duplicar cadastro de empresa ou funcionário: tudo usa os cadastros comuns (NOB-99).

## Responsáveis por frente

| Frente | Quem |
|---|---|
| Implementação | Carlos |
| Perfis da V1, portais, profissional externo | Expedito (E-02, E-01) |
| Arquitetura de segregação clínica (A/B/C), escopo por empresa, MFA | Douglas (D-05, D-12), com Rikelvin |
| O que a empresa/RH pode ver; o que é dado clínico | Dr. Alcides (A-03) |
| Modelo de papéis × serviços (estender `company_modules`) | Rikelvin (revisão) |

## Dependências

| Depende de | Situação |
|---|---|
| E-02 perfis/portais da V1 | pendente |
| D-05 arquitetura A/B/C | pendente (recomendação da Fase 0: A agora, evoluindo para B na camada clínica) |
| P1 identidade profissional ([Lote 03](../03-identidade-e-riscos/README.md)) | bloqueada por decisão |
| Escopo por empresa (`org_memberships.scoped_company_id` existe e não é aplicado) | não implementado |
| Papel clínico + auditoria de leitura (P9, [Lote 02](../02-formularios-e-auditoria/README.md)) | planejado |
| ASO emitido ([Lote 04](../04-aso/README.md)) | planejado — a guia termina em ASO |

Linear: NOB-121 ← NOB-97, bloqueia NOB-120 e NOB-122; NOB-122 ← NOB-99, NOB-108, NOB-121, bloqueia NOB-123 e NOB-130;
NOB-123 ← NOB-108, NOB-112, NOB-122, bloqueia NOB-128 ([AUDIT-LINEAR-QA §4.3](../../AUDIT-LINEAR-QA.md)).

## Documentos do lote

| Arquivo | Conteúdo |
|---|---|
| [AUDIT.md](AUDIT.md) | Existente, protótipo, lacunas, riscos |
| [PLAN.md](PLAN.md) | Escopo condicionado a E-02, segurança, sequência |
| [TASK.md](TASK.md) | Tarefas (não iniciadas) |
| [WALKTHROUGH.md](WALKTHROUGH.md) | NÃO INICIADO |
| [QA.md](QA.md) | NÃO INICIADO — cenários planejados |
| [REVIEW.md](REVIEW.md) | NÃO INICIADO — checklist |

## Fontes da Fase 0

- [IMPLEMENTATION-PLAN.md — Lote 6](../../IMPLEMENTATION-PLAN.md)
- [GAP-MATRIX.md — MED-03, MED-04, MED-24, MED-25, MED-26, MED-27](../../GAP-MATRIX.md)
- [DEPENDENCIES.md §1](../../DEPENDENCIES.md)
- [DECISIONS.md — E-01, E-02, D-03, D-05, D-12, A-03](../../DECISIONS.md)
- [AUDIT-SECURITY.md §6 (L1, L2, L6), §7 (R2), §10.1–§10.3](../../AUDIT-SECURITY.md)
- [AUDIT-PROTOTYPE.md §5.1, §5.4, §5.7, §5.8, §5.13 (P-06…P-10, P-42/43, P-59…P-63), §5.14 (J-01, J-02), §7 (R-01…R-05)](../../AUDIT-PROTOTYPE.md)
- [AUDIT-UX.md §5 (telas 8, 15, 16, 17)](../../AUDIT-UX.md)
- [AUDIT-LINEAR-QA.md §4.5, §5.7 (`portal.py`), §6.1 (cenário 9)](../../AUDIT-LINEAR-QA.md)
