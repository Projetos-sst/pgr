# Lote 01 — Ficha de saúde ocupacional (primeiro MVP)

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo              | Valor                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status do lote** | **PR_ABERTA (draft)** — implementado, testado e revisado em 2026-10-21; aguarda CI, revisão do Douglas e aceite                                                                          |
| Issue principal    | [NOB-108 — Módulo de Medicina conforme protótipo](https://linear.app/nobuggy/issue/NOB-108) (Carlos, In Progress no Linear desde 20/10, sem PR anexada)                                  |
| Responsável        | Carlos                                                                                                                                                                                   |
| Branch             | `feature/NOB-108-ficha-saude-ocupacional` (base `origin/develop` = `d6b787c`; commits de código `09bc02d`, `f0e4486`, `8372ec3`)                                                         |
| PR                 | [#120](https://github.com/Projetos-sst/pgr/pull/120) (draft, base `develop`)                                                                                                             |
| Migrations         | **nenhuma** (regra do lote: zero migration)                                                                                                                                              |
| Base obrigatória   | [`../../FIRST-MVP.md`](../../FIRST-MVP.md). Este lote **expande** o FIRST-MVP com o detalhe de implementação; não o contradiz. Toda divergência está marcada como tal no [PLAN](PLAN.md) |
| Bloqueios          | **Nenhum.** MED-DEC-25 `RESPONDIDA` (direcionamento aprovado pelo Douglas, informado pelo Carlos). Spec Playwright automatizado depende de usuário de teste do Clerk                     |
| Próxima ação       | Conferir o CI da #120 após o commit de docs; revisão do Douglas; combinar com o Rikelvin a ordem #112 × #120 (arquivos comuns)                                                           |

## Objetivo

Entregar a jornada **"da empresa com Medicina até o exame do trabalhador, salvo e recuperado"** (FIRST-MVP §2), com dado
real, recarregável e protegido por permissão, **sem migration, sem novo dado clínico sigiloso, sem emissão de ASO e sem
PCMSO**:

1. Painel `/medicine` com as empresas que têm Medicina habilitada e contagens reais por situação de validade informada.
2. Lista de funcionários da empresa escolhida, com busca e paginação no servidor e badge do último exame.
3. Seção "Saúde ocupacional" em `/employees/[id]` (linha do tempo dos exames), visível só se a empresa tiver Medicina.
4. Registrar exame a partir da ficha (formulário existente, funcionário pré-selecionado) e voltar à ficha.
5. Correções transversais: erro ≠ vazio em `/health-exams` e `/medicos`, filtro por empresa em `/health-exams`,
   `loading.tsx` no painel, item "Painel" no grupo Medicina do menu.

## Fora do escopo (inegociável)

- Migration, tabela, coluna ou policy nova.
- Emissão de ASO, documento, PDF, assinatura de qualquer tipo, PCMSO, Lista C, portais.
- Periodicidade calculada (12/24 meses etc.): só a **validade informada** (`valid_until`) é exibida.
- Novo campo clínico, exibição de `notes` em lugar novo, ampliação de quem vê dado de saúde.
- Cadastro paralelo de funcionário ou empresa (a Medicina usa os cadastros comuns da NOB-99).
- Menu dinâmico por módulo (o `NAV` continua estático; o estado vazio do painel cobre o caso).

## Responsáveis e dependências

| Frente                                                                                   | Quem                                                           | Situação                                                                        |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Implementação, testes, documentação de API                                               | Carlos                                                         | a iniciar                                                                       |
| Ordem de merge nos arquivos comuns com a #112 (`nav-menu.tsx`, `api-design.md`, Postman) | Carlos + Rikelvin                                              | a combinar ([Lote 00, T00-E3](../00-alinhamento-e-contratos/TASK.md))           |
| Teal como acento / contraste AA das pílulas                                              | Douglas (MED-DEC-17)                                           | opcional; sem resposta, o lote sai sem teal                                     |
| Aviso "não registre diagnóstico ou CID" em Observações                                   | Dr. Alcides (MED-DEC-18)                                       | opcional                                                                        |
| Aceite do escopo do MVP                                                                  | Carlos (C-01) e Douglas (aceite do Lote 0, conforme FIRST-MVP) | pendente                                                                        |
| Linear: NOB-108 aparece "bloqueada por" NOB-94 (Backlog)                                 | Douglas decide a relação                                       | não bloqueia tecnicamente ([`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §2) |

## Documentos da Fase 0 pertinentes

[`../../FIRST-MVP.md`](../../FIRST-MVP.md) (base) · [`../../IMPLEMENTATION-PLAN.md`](../../IMPLEMENTATION-PLAN.md) (Lote 1) ·
[`../../GAP-MATRIX.md`](../../GAP-MATRIX.md) (MED-01, 02, 05, 06, 07, 08, 36) · [`../../AUDIT-UX.md`](../../AUDIT-UX.md) §4.2–4.4, §6, §10 ·
[`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §5.3–5.5, §6.1 · [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §10.1 ·
[`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.2 (`health_exams`, `employees`)

## Arquivos do lote

[AUDIT](AUDIT.md) · [PLAN](PLAN.md) (base do prompt de implementação) · [TASK](TASK.md) · [WALKTHROUGH](WALKTHROUGH.md) ·
[QA](QA.md) · [REVIEW](REVIEW.md)
