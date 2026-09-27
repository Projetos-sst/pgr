# Lotes

Ordem recomendada: **1 → 2 → 3**, com **4** podendo rodar em paralelo a 2/3; GED em **5 → 6 → 7**
depois das decisões de produto; **8** é um lote de decisão. Estimativa relativa: S < M < L < XL.

---

# Lote 1 — #56, #33, #42 (auditoria específica + decisões de 2026-09-16)

A auditoria específica (fichas em `tasks/`) e as decisões de 2026-09-16 **prevalecem** sobre a composição
inicial. Planejamento operacional em [lots/lot-01/PLAN.md](lots/lot-01/PLAN.md) e
[lots/lot-01/TASK.md](lots/lot-01/TASK.md).

| Ordem | Sub-lote | Issue | Dificuldade | Prontidão           | Migration | Entregável                          |
| ----- | -------- | ----- | ----------- | ------------------- | --------- | ----------------------------------- |
| 1     | **1A**   | #56   | 2           | READY COM PREMISSAS | Não       | Código (commits #56)                |
| 2     | **1C**   | #33   | 1           | RESOLVIDA — FECHAR  | Não       | Evidência + comentário + fechamento |
| 3     | **1B**   | #42   | 3           | READY COM PREMISSAS | Não       | Código (commits #42)                |

**Entrega:** uma **PR única do Lote 1** (decisão do responsável, 2026-09-16), com PLAN/TASK/REVIEW e commits
separados por issue — em vez de uma PR por sub-lote.

**Status (2026-09-16):** tecnicamente encerrado — #33 fechada; #56 e #42 implementadas na PR #93, aguardando
merge. Detalhes em [lots/lot-01/REVIEW.md](lots/lot-01/REVIEW.md). Próximo: **Lote 2 (#39 + #47)**.

## 1A — #56 versionamento

**Escopo:** listar versões do grupo (repositório + Server Action + `GET /api/v1/documents/{id}/versions` +
api-design + Postman); UI de histórico com badge vigente e download de versões antigas; somente leitura no
**backend**; nova versão sempre deriva da vigente; conflito de upload de mesmo nome → erro de domínio; definição
de "vigente" centralizada. **Não** implementar revisão/aprovação (#54).

## 1C — #33 assinatura de EPI

**Escopo:** revalidar critérios com evidência concreta; comentar; fechar; card → Done. Sem código.

## 1B — #42 plano do PGR

**Escopo:** cobertura derivada por risco no consolidado; status da medida exposto; indicador/badge/contador na
aba Inventário; formulário sinaliza prazo/responsável obrigatórios para moderado+ antes do submit (backend
continua autoridade). Sem PDF (Lote 2), sem migration, sem bloqueio de assinatura.

**DoD do lote:** `npm run check`, integração, build e regressão verdes; 4 superfícies de API do endpoint novo;
evidência Playwright das telas; #33 fechada; REVIEW.md escrito; fichas atualizadas.

---

# Lote 2 — NR-09 + PDF do PGR (parte 1)

**Status (27/09/2026):** implementado e testado na branch `feature/lot-02-nr09-pgr-pdf`, aguardando PR/merge.
#39 completa; #47 entregue nas seções 1, 2, 3 e 5 (NR-17 segue bloqueada pela #40). Detalhes em
[lots/lot-02/REVIEW.md](lots/lot-02/REVIEW.md) e [lots/lot-02/QA.md](lots/lot-02/QA.md).

**Issues:** #39, #47 (seções 1, 2, 3 e 5)

| Item                | Valor     |
| ------------------- | --------- |
| Dificuldade média   | 3         |
| Migration           | Sim (#39) |
| Estimativa relativa | L         |

**Por que juntas:** o dado que #39 cria só tem valor se aparecer no PGR, e #47 é o lugar. Ambas tocam
`pgr-consolidated.ts` e o template — separá-las geraria dois rebases no mesmo arquivo.

**Escopo:** avaliação quantitativa NR-09 por avaliação de risco; identificação no PDF com responsável
técnico e **preposto** (`work_units.managerName/managerRole`, já existe); inventário exibindo LT,
concentração e unidade (já estão no consolidado, só não são impressos); seção NR-09; plano de ação 5W2H
lido de **`control_measures`** — a auditoria do lote (lots/lot-02/AUDIT.md) descartou `action_plans` como
fonte: três dos sete campos lá são texto gerado pela ponte #51.

**Dependências:** nenhuma pendente — Q1/Q2/Q3 decididas em 27/09 ([lots/lot-02/AUDIT.md](lots/lot-02/AUDIT.md)). Execução em **branch única** `feature/lot-02-nr09-pgr-pdf`, com **uma PR** ao final.

**Definition of Done:** migration com RLS/GRANT/trigger validada em Postgres efêmero; testes unitários do
template atualizados para a nova ordem; teste de integração da rota de PDF; PDF gerado pelos **dois**
chamadores (rota síncrona e worker) conferido; #47 permanece aberta até o Lote 3.

---

# Lote 3 — NR-17 + NR-18 + fechamento do PDF

**Status (27/09/2026):** **implementado, revisado e com QA aprovado** em
[lots/lot-03/](lots/lot-03/); branch única `feature/lot-03-nr17-nr18-pgr`, uma PR aguardando merge.
Q1–Q4 decididas. #40, #47 e #48 concluídas.

**Issues:** #40, #48, #47 (seção 4 e fechamento)

| Item                | Valor                    |
| ------------------- | ------------------------ |
| Dificuldade média   | 3,3                      |
| Migration           | Sim (#40); incerta (#48) |
| Estimativa relativa | L                        |

**Por que juntas:** fecham o conjunto normativo do PGR e a estrutura final do PDF de uma vez.

**Dependências:** Q1–Q4 resolvidas. Ordem interna: #40 → seção NR-17 no PDF (fecha #47) → #48
(tipos NR-18 + relação de EPIs, que também entra no PDF).

**Definition of Done:** as 5 seções do PDF na ordem da issue, com dado real; checklist NR-18 para
unidades `site`; relação de EPIs derivada do cadastro; #47 fechável.

---

# Lote 4 — Catálogos oficiais (CNAE e CBO)

**Status (27/09/2026):** auditado e planejado em [lots/lot-04/](lots/lot-04/); branch única
`feature/lot-04-cnae-cbo` criada. Implementação **não** iniciada — aguarda só o arquivo oficial do CBO.

**Issues:** #3, #10

| Item                | Valor                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Dificuldade média   | 3                                                                       |
| Migration           | Provável (tabelas globais, padrão `caepi_certificates`)                 |
| Integração          | IBGE (CNAE, reverificada em 27/09) e arquivo MTE (CBO, download manual) |
| Estimativa relativa | M                                                                       |

**Por que juntas:** o projeto não tem componente de autocomplete (só `<datalist>` estático). Fazer #3 e
#10 juntas cria o componente uma vez. O padrão de espelho global + script de sync já existe no CAEPI.

**Paralelismo:** pode rodar junto com os Lotes 2/3 (sem arquivos em comum); serializar as migrations.

**Dependências:** #3 está **READY** e cria o `CatalogCombobox`; #10 reaproveita e precisa do arquivo
oficial de CBO. Se o arquivo não chegar, entregar #3 e manter #10 aberta (`Partially addresses #10`).

**Definition of Done:** busca por código e descrição nos dois formulários; cadastro manual continua
funcionando com base vazia ou falha; tabelas globais com policy de leitura global; testes de busca e de
fallback; script de sync documentado.

---

# Lote 5 — GED: fundação (spec + perfis + elaboração + trilha)

**Issues:** #58, #52, #59

| Item                | Valor            |
| ------------------- | ---------------- |
| Dificuldade média   | 3,7              |
| Migration           | Sim (várias)     |
| Estimativa relativa | XL (inclui spec) |

**Por que juntas:** são a base que todas as outras issues do GED pressupõem — quem pode fazer o quê
(#58), o documento com metadados e status (#52), e onde fica registrado o que aconteceu (#59).

**Pré-requisito:** decisões de #52 e #58 respondidas **e** uma spec própria (`.specs/03X-ged-workflow/`)
com state machine, papéis e plano de migração dos documentos já existentes. Sem isso, não iniciar.

**Definition of Done:** checagem de papel no servidor com teste de integração negativo por papel; leitor
de um setor não enxerga outro setor; documentos existentes continuam visíveis; trilha persistida
exportável.

---

# Lote 6 — GED: revisão, aprovação e publicação

**Issues:** #53, #54, #55

| Item                | Valor |
| ------------------- | ----- |
| Dificuldade média   | 3,7   |
| Migration           | Sim   |
| Estimativa relativa | L     |

**Por que juntas:** são as transições consecutivas da mesma state machine; testá-las separadas deixaria
estados intermediários sem saída.

**Dependências:** Lote 5 mergeado; decisão de #54 (assinatura vs. aceite autenticado).

---

# Lote 7 — GED: descarte e regras de negócio

**Issues:** #57, #62 (+ alertas de revisão de #59, se ficarem pendentes no Lote 5)

| Item                | Valor |
| ------------------- | ----- |
| Dificuldade média   | 3,5   |
| Migration           | Sim   |
| Estimativa relativa | M     |

**Por que juntas:** #62 só fecha quando o ciclo completo existe; #57 é a última transição. Aqui entram os
CHECKs/invariantes finais e os testes de ponta a ponta do workflow.

---

# Lote 8 — Decisões de plataforma

**Issues:** #60, #61

| Item                | Valor                                                    |
| ------------------- | -------------------------------------------------------- |
| Dificuldade         | 5 e 4 **se implementadas**; S se a decisão for não fazer |
| Migration           | Incerta                                                  |
| Estimativa relativa | S (decisão) a XL (implementação)                         |

**Por que juntas:** ambas exigem decisão de infraestrutura e, provavelmente, emenda ao Princípio II
(serviço externo pago). Entregável mínimo: decisão registrada na issue com justificativa. Implementação
só vira lote de código depois da decisão.
