# Dependências entre as 19 issues

## Grafo

```
INDEPENDENTES (auditoria específica do Lote 1 — sem arquivos em comum entre si)
├── #56  GED — histórico de versões + somente leitura   (READY COM PREMISSAS)
├── #42  Plano do PGR — cobertura por risco             (aguarda decisão; influencia #47)
└── #33  EPI — funcionalmente resolvida                  (confirmação de fechamento)

#42 decisão "qual é o plano de ação" ──► #47 fonte da seção 5 (medidas de controle vs. action_plans)

PGR — inventário → PDF
#39 NR-09 ─────────────┐
                        ├──► #47 PDF do PGR (seções 3 e 4 só existem depois)
#40 NR-17 ─────────────┘          ▲
                                   │ seções 1, 2 e 5 não dependem de nada
#48 NR-18 ── usa relação de EPIs derivada ──┘ (anexo no PDF, opcional)

CATÁLOGOS
#3 CNAE ── cria o componente de autocomplete ──► #10 CBO reaproveita

GED (épico)
#58 Perfis/setor ──┬──► #52 Elaboração ──► #53 Revisão ──► #54 Aprovação ──► #55 Publicação
                   │                                                              │
#59 Trilha de auditoria (tabela) ─────────────────────────────────────────────────┤
                   │                                                              ▼
                   └──────────────────────────────────────► #57 Descarte ──► #62 Regras (fecha o épico)
#56 Versões (leitura) ─────────────────────────────────────────────────────────────┘ (gate de aprovação)

PLATAFORMA
#60 AD/backup ──► #61 E-mail (e-mails de backup/AD)
#58 Perfis ─────► #61 E-mail (e-mail de mudança de permissão)
```

## Ordem obrigatória

| Antes          | Depois         | Motivo                                                                 |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| #39 e #40      | fechar #47     | Critério de aceite exige as seções NR-09 e NR-17 com dado real         |
| decisão de #42 | seção 5 de #47 | Define se o plano 5W2H do PDF lê medidas de controle ou `action_plans` |
| #58            | #52–#55, #57   | Autor/Revisor/Aprovador/Leitor/Administrador são papéis de #58         |
| #52            | #53            | Revisão opera sobre documento com metadados e status de workflow       |
| #53            | #54            | Aprovação vem depois da revisão                                        |
| #54            | #55            | "Documento só é publicável após aprovação"                             |
| #59 (tabela)   | #55, #57       | Log de acesso (#55) e auditoria de descarte (#57) gravam na trilha     |
| #52–#57        | fechar #62     | #62 são invariantes sobre o que as outras criarem                      |
| #3             | #10 (UI)       | Mesmo componente de autocomplete; fazer duas vezes é retrabalho        |
| decisão de #60 | parte de #61   | Sem backup automatizado não há e-mail de backup                        |

## Compartilhamento de código (risco de conflito)

| Área                                                   | Issues             | Regra                                                        |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| `risks.ts` / `risk_assessments` / `risk-assessment.ts` | #39, #40, #42      | Não rodar #39 e #40 em branches paralelas                    |
| `pgr-consolidated.ts` + `pgr-pdf-template.ts`          | #39, #40, #47, #48 | Um lote por vez; o template tem 2 chamadores (rota + worker) |
| `documents` (schema, repo, actions, UI)                | #52–#57, #59, #62  | Épico em branches sequenciais, nunca paralelas               |
| `_ui/form.tsx` (novo combobox)                         | #3, #10            | Mesmo lote                                                   |
| `src/shared/tenant/roles.ts` / guards de auth          | #58                | Isolado; revisão com atenção dobrada                         |
| `control-measures` / `control-measure-bridge.ts`       | #42                | Isolado                                                      |

## Paralelismo permitido

- **Lote 4 (catálogos)** não toca PGR nem GED e pode rodar em paralelo com os lotes 2/3, **desde que as
  migrations sejam serializadas**: quem mergear primeiro fica com o número; o outro rebaseia e
  regenera (procedimento em [EXECUTION-PLAN.md](EXECUTION-PLAN.md)).
- **Lote 1** foi dividido em 1A (#56), 1B (#42) e 1C (#33): nenhum arquivo em comum, nenhuma migration,
  PRs independentes. Única ligação externa: a decisão de #42 muda a fonte do plano no PDF (#47), então as
  mudanças de template do plano ficam no Lote 2, não em #42.
- Lotes do GED (5 → 6 → 7) são estritamente sequenciais.

## Não compartilhar branch

- #33 com qualquer outra (se virar migração de dados, é fatia isolada).
- #58 com funcionalidades de GED que dependem dela — a base de permissões merece PR própria e revisão focada.
- #60/#61 com código de GED — são decisões de plataforma.
