# Lote 03 — Identidade profissional, validação de riscos, PGR externo e Lista C

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo              | Valor                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status do lote** | **BLOQUEADO (parcial)** — identidade e validação aguardam decisões (autorização parcialmente respondida); Lista C aguarda fonte oficial; PGR externo aguarda o merge da #112                                                                                                                                       |
| Issues (Carlos)    | [NOB-111 — PGR fornecido pela empresa](https://linear.app/nobuggy/issue/NOB-111) (Backlog) · [NOB-113 — Completar "Lista C"](https://linear.app/nobuggy/issue/NOB-113) (In Progress) · [NOB-121 — Médicos/psicólogos internos e externos](https://linear.app/nobuggy/issue/NOB-121) (Backlog; parte de identidade) |
| Integração         | [NOB-98 — Integração riscos PGR → PCMSO](https://linear.app/nobuggy/issue/NOB-98) (**Rikelvin**, In Progress) e PR #112 (aberta, sem CI, reserva `0054`/`0055`)                                                                                                                                                    |
| Responsáveis       | Carlos (NOB-111/113/121) · **Rikelvin é dono da validação técnica de riscos (P5, NOB-98)** · Douglas decide o dono da identidade (MED-DEC-10) e o modelo (MED-DEC-04) · Expedito e Dr. Alcides respondem as regras                                                                                                 |
| Branch             | nenhuma                                                                                                                                                                                                                                                                                                            |
| PR                 | nenhuma deste lote (a #112 é do Rikelvin)                                                                                                                                                                                                                                                                          |
| Migrations         | nenhuma criada; propostas P1, P2 e P5 descritas em [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.4–10.5, **não aprovadas**; numeração não definida                                                                                                                                                      |
| Próxima ação       | Coletar MED-DEC-02…07 e MED-DEC-10 ([Lote 00](../00-alinhamento-e-contratos/TASK.md)); pedir a fonte da Lista C (MED-DEC-13)                                                                                                                                                                                       |

## Objetivo

Permitir, quando as decisões existirem, que o sistema saiba **quem é o profissional**, **em qual empresa ele está designado** e
**o que ele pode fazer**, para que riscos (do PGR interno ou de PGR externo) possam ser validados com rastreabilidade e usados
depois pelo ASO e pelo PCMSO; e carregar a Lista C oficial como dado de referência versionado.

## Resposta parcial do Expedito (21/10/2026)

Pergunta do Rikelvin (20/10): quem concede a autorização para validar tecnicamente os riscos do PGR (1. administrador do
sistema/escritório; 2. responsável técnico da empresa; 3. outro profissional ou setor definido pela empresa) e se os dados de quem
valida devem ser registrados. Resposta: _"Opção 03. A empresa mesmo define quem vai autorizar. E sim; é importante registrar os dados
desse profissional."_ (Resposta de Expedito no grupo, 21/10/2026.) Status: **PARCIALMENTE_RESPONDIDA** (MED-DEC-01).

| Confirmado                                                   | Falta definir (entrada no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md))                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| A empresa define quem concede a autorização                  | "Empresa" = empresa-cliente ou escritório? Qual usuário indica o autorizador? (MED-DEC-02) |
| Os dados de identificação do validador devem ser registrados | O autorizador também valida? Quais categorias validam? (MED-DEC-03)                        |
| —                                                            | Quais dados identificam e como comprovar; ligação Clerk ↔ profissional (MED-DEC-04)        |
| —                                                            | Profissional externo (MED-DEC-05)                                                          |
| —                                                            | Escopo, revogação, validações anteriores (MED-DEC-06)                                      |
| —                                                            | Nota/motivo obrigatórios (MED-DEC-07)                                                      |

**Nada disso vira regra completa neste lote, e nenhuma concessão de permissão é implementada.**

## Frentes do lote

| Frente                                                                         | Dono                                                    | Estado    | Bloqueio                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- | --------- | --------------------------------------- |
| 3a Identidade profissional + vínculo autenticado + designação por empresa (P1) | Carlos, **se** MED-DEC-10 confirmar a NOB-121 como dona | BLOQUEADO | MED-DEC-02…06, 10                       |
| 3b Validação técnica de riscos (P5)                                            | **Rikelvin** (NOB-98), com apoio do Carlos              | BLOQUEADO | 3a + merge da #112 + MED-DEC-03/06/07   |
| 3c PGR externo (NOB-111 reescopada sobre a #112)                               | Carlos                                                  | BLOQUEADO | merge da #112 + MED-DEC-10 (reescopo)   |
| 3d Fontes de risco e rastreabilidade (ajustes ao contrato da #112)             | **propostas ao Rikelvin**                               | PROPOSTO  | aceite do Rikelvin                      |
| 3e Lista C (P2: NTEP, CID × CNAE; **não** é catálogo de exames)                | Carlos (carga)                                          | BLOQUEADO | MED-DEC-13 (fonte oficial, Dr. Alcides) |

## Regras do lote

1. **Não criar contrato de riscos alternativo** ao do Rikelvin: o único contrato PGR → Medicina é `medical_risk_*` (#112).
2. Owner/colaborador **não** são responsáveis técnicos presumidos; ninguém aprova em nome de terceiros.
3. Fonte externa nunca nasce validada.
4. **Não importar a base parcial da Lista C do protótipo como oficial** (18 grupos, A15–K46, sem M e S/T).
5. QR/rabisco não é assinatura técnica (assinatura técnica é do Lote 04, MED-DEC-19).

## Documentos da Fase 0 pertinentes

[`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.5, §4.7 · [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4, §4.5, §10.1, §10.4 (P1, P2, P5),
§10.5 · [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §1, §3 · [`../../AUDIT-PROTOTYPE.md`](../../AUDIT-PROTOTYPE.md) §5.12 · [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md)
§10.2–10.3 · [`../../GAP-MATRIX.md`](../../GAP-MATRIX.md) MED-03, 04, 13, 14, 15, 16, 17 · [`../../DECISIONS.md`](../../DECISIONS.md) D-03, D-04, E-01, A-01, A-02, R-02

## Arquivos do lote

[AUDIT](AUDIT.md) · [PLAN](PLAN.md) · [TASK](TASK.md) · [WALKTHROUGH](WALKTHROUGH.md) · [QA](QA.md) · [REVIEW](REVIEW.md)
