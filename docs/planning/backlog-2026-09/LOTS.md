# Lotes

Ordem recomendada: **1 → 2 → 3**, com **4** podendo rodar em paralelo a 2/3; GED em **5 → 6 → 7**
depois das decisões de produto; **8** é um lote de decisão. Estimativa relativa: S < M < L < XL.

---

# Lote 1 — dividido após auditoria específica (2026-09-16)

A auditoria específica de #42, #56 e #33 (fichas em `tasks/`) **prevalece** sobre a composição inicial. As
três não compartilham arquivos nem migration, mas têm prontidões diferentes — executá-las como um pacote
atrasaria a pronta (#56) à espera da decisão de #42.

| Sub-lote | Issue | Dificuldade | Prontidão                 | Migration         | Entregável                          |
| -------- | ----- | ----------- | ------------------------- | ----------------- | ----------------------------------- |
| **1A**   | #56   | 2           | READY COM PREMISSAS       | Não               | Código + PR                         |
| **1B**   | #42   | 3           | NEEDS PRODUCT DECISION    | Não (recomendado) | Código + PR após decisão            |
| **1C**   | #33   | 1           | Confirmação de fechamento | Não               | Comentário de evidência, sem código |

Um único `lots/lot-01/` (PLAN/TASK/REVIEW) com seções 1A/1B/1C; uma PR por sub-lote com código.

## 1A — #56 versionamento

**Escopo:** listar versões do grupo (repositório + Server Action + `GET /api/v1/documents/{id}/versions` +
api-design + Postman); UI de histórico com badge vigente e download de versões antigas; somente leitura no
**backend** (PUT em versão não vigente → 409; nova versão via id antigo herda da vigente); conflito de upload
do Storage → `DUPLICATE`; definição de "vigente" centralizada.

**DoD:** integração (listagem ordenada, vigente única, PUT antigo 409 sem mutação, herança da vigente,
cross-tenant 404, race existente); REST GET; regressão do worker de PDF; Playwright 375/768/1440; ficha atualizada.

## 1B — #42 plano de ação do PGR

**Pré-requisito:** resposta à pergunta 1 da ficha (qual "plano de ação").

**Escopo recomendado:** cobertura derivada por risco (`not_assessed | no_measure | incomplete | covered`);
`status` da medida exposto no consolidado; indicador + badge na aba Inventário; formulário da medida sinaliza
responsável/prazo obrigatórios para moderado+ (validação segue no servidor). **PDF fica para o Lote 2 (#47)**
para não editar o template duas vezes.

**DoD:** unit (4 coberturas, grupos A/B, transições de classificação); integração (consolidado com status e
cobertura, reclassificação altera cobertura sem mutar medidas, exclusão documentada); regras existentes
(9 casos) verdes; api-design do consolidado; Playwright; ficha atualizada.

## 1C — #33 assinatura de EPI

**Escopo:** comentário na issue com a tabela critério × código × teste e a comparação A×B; obter confirmação
de fechamento. Endurecimento `signed_at` só como issue separada, se pedido.

**DoD:** comentário publicado; decisão registrada na ficha.

## Ordem

1. **1A** imediatamente.
2. **1C** em paralelo (não consome tempo de implementação).
3. **1B** assim que a pergunta 1 de #42 for respondida.

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
