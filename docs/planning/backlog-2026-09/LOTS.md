# Lotes

Ordem recomendada: **1 → 2 → 3**, com **4** podendo rodar em paralelo a 2/3; GED em **5 → 6 → 7**
depois das decisões de produto; **8** é um lote de decisão. Estimativa relativa: S < M < L < XL.

---

# Lote 1 — Quick wins sem migration

**Issues:** #42 (parte restante), #56, #33

| Item                | Valor                                                    |
| ------------------- | -------------------------------------------------------- |
| Dificuldade média   | 1,7 (níveis 2, 2, 1)                                     |
| Migration           | Nenhuma                                                  |
| Integração externa  | Nenhuma                                                  |
| Estimativa relativa | S–M                                                      |
| PRs                 | até 2 (#42 e #56 são independentes); #33 não gera código |

**Por que juntas:** são as únicas três issues do backlog que fecham sem migration, sem integração e sem
decisão estrutural. Não compartilham arquivos, então não há conflito entre elas, e cada uma reaproveita
um fluxo que já existe e tem testes (ponte `control_measure → action_plan`, `addDocumentVersion` +
`currentVersionPredicate`, fluxo de assinatura do EPI).

**Escopo mínimo:**

- **#42** — consulta derivada "riscos do inventário sem plano de ação" (sem coluna nova), indicador na aba
  Inventário do editor de PGR e na lista de riscos, ação "Criar plano" com `origin_type = risk`
  pré-preenchido. Server Action + REST GET + api-design + Postman.
- **#56** — leitura do histórico de versões do grupo (`GET /api/v1/documents/{id}/versions`, hoje só existe
  POST), destaque da versão vigente e download de versões antigas na UI do GED. Server Action + REST +
  api-design + Postman.
- **#33** — anexar à issue a evidência de que os critérios de aceite já são atendidos e obter a decisão
  (fechar ou abrir fatia de unificação). Sem código.

**Dependências:** nenhuma externa ao lote. #42 depende das respostas 1–3 da seção #42 em
REQUIREMENTS-GAPS (a premissa segue se não houver objeção).

**Definition of Done:**

- [ ] `npm run check` e `npm run build` verdes; `npm run test:integration` cobrindo as consultas novas
      (isolamento cross-tenant, risco coberto por plano direto e por ponte, histórico preserva versões)
- [ ] 4 superfícies de API completas para os dois endpoints novos
- [ ] Evidência Playwright 375/768/1440 das telas tocadas
- [ ] Comentário de evidência na #33 com decisão registrada
- [ ] Fichas `tasks/42`, `tasks/56`, `tasks/33` atualizadas; `lots/lot-01/REVIEW.md` escrito

---

# Lote 2 — NR-09 + PDF do PGR (parte 1)

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
lido de `action_plans`.

**Dependências:** respostas de #39 e da linha #47 em REQUIREMENTS-GAPS.

**Definition of Done:** migration com RLS/GRANT/trigger validada em Postgres efêmero; testes unitários do
template atualizados para a nova ordem; teste de integração da rota de PDF; PDF gerado pelos **dois**
chamadores (rota síncrona e worker) conferido; #47 permanece aberta até o Lote 3.

---

# Lote 3 — NR-17 + NR-18 + fechamento do PDF

**Issues:** #40, #48, #47 (seção 4 e fechamento)

| Item                | Valor                    |
| ------------------- | ------------------------ |
| Dificuldade média   | 3,3                      |
| Migration           | Sim (#40); incerta (#48) |
| Estimativa relativa | L                        |

**Por que juntas:** fecham o conjunto normativo do PGR e a estrutura final do PDF de uma vez.

**Dependências:** #40 está em NEEDS CONTEXT — **não iniciar o Lote 3 sem as respostas de #40**. Se elas
atrasarem, #48 pode ser antecipada sozinha.

**Definition of Done:** as 5 seções do PDF na ordem da issue, com dado real; checklist NR-18 para
unidades `site`; relação de EPIs derivada do cadastro; #47 fechável.

---

# Lote 4 — Catálogos oficiais (CNAE e CBO)

**Issues:** #3, #10

| Item                | Valor                                                   |
| ------------------- | ------------------------------------------------------- |
| Dificuldade média   | 3                                                       |
| Migration           | Provável (tabelas globais, padrão `caepi_certificates`) |
| Integração          | IBGE (CNAE, verificada) e arquivo MTE (CBO, pendente)   |
| Estimativa relativa | M                                                       |

**Por que juntas:** o projeto não tem componente de autocomplete (só `<datalist>` estático). Fazer #3 e
#10 juntas cria o componente uma vez. O padrão de espelho global + script de sync já existe no CAEPI.

**Paralelismo:** pode rodar junto com os Lotes 2/3 (sem arquivos em comum); serializar as migrations.

**Dependências:** #10 precisa do arquivo oficial de CBO. Se não chegar, entregar #3 e manter #10 aberta.

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
