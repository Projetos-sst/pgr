# Dependências entre as 19 issues

## Grafo

```
INDEPENDENTES (auditoria específica do Lote 1 — sem arquivos em comum entre si)
├── #56  GED — histórico de versões + somente leitura   (READY COM PREMISSAS)
├── #42  Plano do PGR — cobertura por risco             (READY COM PREMISSAS)
└── #33  EPI — funcionalmente resolvida                  (fechar sem código)

#42 decidido: plano do PGR = control_measures ──► #47 lê o 5W2H das medidas (7/7 após o Lote 2)

PGR — inventário → PDF
#39 NR-09 ─────────────┐
                        ├──► #47 PDF do PGR (seções 3 e 4 só existem depois)
#40 NR-17 ─────────────┘          ▲
                                   │ seções 1, 2 e 5 não dependem de nada
#48 NR-18 ── usa relação de EPIs derivada ──┘ (anexo no PDF, opcional)

CATÁLOGOS
#3 CNAE ── cria o CatalogCombobox (`_ui/`) ──► #10 CBO reaproveita   [auditado: lots/lot-04]

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

| Antes           | Depois         | Motivo                                                                              |
| --------------- | -------------- | ----------------------------------------------------------------------------------- |
| #40 (só ela)    | fechar #47     | NR-09 entregue no Lote 2; falta a seção NR-17 para o critério de aceite completo    |
| #42 (cobertura) | seção 5 de #47 | Plano do PGR = `control_measures` (decidido); PDF mostra cobertura/status no Lote 2 |
| #58             | #52–#55, #57   | Autor/Revisor/Aprovador/Leitor/Administrador são papéis de #58                      |
| #52             | #53            | Revisão opera sobre documento com metadados e status de workflow                    |
| #53             | #54            | Aprovação vem depois da revisão                                                     |
| #54             | #55            | "Documento só é publicável após aprovação"                                          |
| #59 (tabela)    | #55, #57       | Log de acesso (#55) e auditoria de descarte (#57) gravam na trilha                  |
| #52–#57         | fechar #62     | #62 são invariantes sobre o que as outras criarem                                   |
| #3              | #10 (UI)       | Mesmo componente de autocomplete; fazer duas vezes é retrabalho                     |
| decisão de #60  | parte de #61   | Sem backup automatizado não há e-mail de backup                                     |

## Compartilhamento de código (risco de conflito)

| Área                                                   | Issues             | Regra                                                        |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| `risks.ts` / `risk_assessments` / `risk-assessment.ts` | #39, #40, #42      | Não rodar #39 e #40 em branches paralelas                    |
| `pgr-consolidated.ts` + `pgr-pdf-template.ts`          | #39, #40, #47, #48 | Um lote por vez; o template tem 2 chamadores (rota + worker) |
| `documents` (schema, repo, actions, UI)                | #52–#57, #59, #62  | Épico em branches sequenciais, nunca paralelas               |
| `_ui/` (novo `CatalogCombobox`)                        | #3, #10            | Mesmo lote e mesma branch (`feature/lot-04-cnae-cbo`)        |
| `src/shared/tenant/roles.ts` / guards de auth          | #58                | Isolado; revisão com atenção dobrada                         |
| `control-measures` / `control-measure-bridge.ts`       | #42                | Isolado                                                      |

## Paralelismo permitido

- **Lote 4 (catálogos)** não toca PGR nem GED e pode rodar em paralelo com os lotes 2/3, **desde que as
  migrations sejam serializadas**: quem mergear primeiro fica com o número; o outro rebaseia e
  regenera (procedimento em [EXECUTION-PLAN.md](EXECUTION-PLAN.md)).
- **Lote 1** tem sub-lotes 1A (#56), 1C (#33) e 1B (#42), sem arquivo em comum nem migration. Por decisão do
  responsável (2026-09-16), são entregues numa **PR única do Lote 1**, com commits separados por issue. As
  mudanças de template do plano ficam no Lote 2 (#47), não em #42.
- Lotes do GED (5 → 6 → 7) são estritamente sequenciais.

## Não compartilhar branch

- #33 com qualquer outra (se virar migração de dados, é fatia isolada).
- #58 com funcionalidades de GED que dependem dela — a base de permissões merece PR própria e revisão focada.
- #60/#61 com código de GED — são decisões de plataforma.
