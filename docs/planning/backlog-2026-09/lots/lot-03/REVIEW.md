# Lote 3 — Review

Revisão técnica do diff completo (`git diff origin/develop...HEAD`) depois dos gates técnicos e do
QA. Escopo: **#40** (NR-17), **#47** (fechamento do PDF) e **#48** (NR-18 + relação de EPIs).

Diff: **63 arquivos**, +18 418 / −85 (11 463 dessas linhas são o snapshot da migration gerado pelo
drizzle-kit).

## Arquitetura final

### #40 — NR-17

| Camada      | Arquivo                                                  | Papel                                                                      |
| ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Schema      | `db/schema/ergonomics.ts`                                | enum `ergonomic_adequacy` + tabela `ergonomic_evaluations` (1:N por risco) |
| Migration   | `db/migrations/0051_ergonomic_evaluations.sql`           | tipo, tabela, FKs, 4 índices, RLS, GRANT e trigger `set_updated_at`        |
| Domínio     | `domains/pgr/ergonomics.ts`                              | Zod, rótulos, vigência determinística, resumos, rótulo do agregado         |
| Repositório | `db/repositories/ergonomic-evaluations.ts`               | CRUD sob `withOrg`, asserts de tenant, leitura em lote p/ o consolidado    |
| Actions     | `server/actions/pgr/ergonomic-evaluations.ts`            | list/get/current/campanhas/create/update/delete via `officeAction`         |
| REST        | `api/v1/risks/[id]/ergonomic-evaluations` + `/[id]`      | espelho com `restHandler` (GET/POST 201 · GET/PUT/DELETE 204)              |
| UI          | `risks/[id]/ergonomic-evaluations/**` + seção no detalhe | histórico em `data-list`, formulário em `_ui/form` no wrapper de 940 px    |

### #47 — PDF

`domains/pgr/pgr-pdf-template.ts` ganhou a seção `nr17` (entre `nr09` e `actionPlan`) e
`pgr-consolidated` (domínio + repositório) passou a trazer a avaliação vigente por risco com o
agregado da campanha. Os **dois chamadores** (`pgr-pdf-core` da rota e `pdf-batch-core` do worker)
continuam compartilhando template e leitura — provado por teste de integração e pelo QA.

### #48 — NR-18 e EPIs

`domains/documents/nr18.ts` (vocabulário + checklist) e `domains/pgr/epi-relation.ts` (relação
deduplicada + situação do CA), lidos por `getPgrNr18ChecklistAction`/`getPgrEpiRelationAction` e
pelos espelhos `GET /api/v1/pgr/{id}/nr18-checklist` e `/epi-relation`. A UI são dois painéis na aba
"Documentos e PDF"; o PDF ganhou a seção `epiRelation`.

## Migration

| Item              | Situação                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Arquivo           | `0051_ergonomic_evaluations.sql` (renumerado? **não** — `0050` era a última real em `develop`)  |
| Journal           | entrada `idx 51` com `tag` descritiva; snapshot `0051_snapshot.json` gerado pelo drizzle-kit    |
| Conteúdo          | `CREATE TYPE` + `CREATE TABLE` + 3 FKs + 4 índices + `ENABLE RLS` + policy + GRANT + trigger    |
| Aplicação do zero | Postgres efêmero recriado do zero (`template0`, UTF-8): **todas** as migrations em ordem, verde |
| Reversibilidade   | tabela nova e enum novo; nenhuma coluna existente foi alterada, nenhum backfill                 |

## Decisões Q1–Q4 (como ficaram no código)

| Decisão | Implementação                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------- |
| Q1 = B  | tabela dedicada `ergonomic_evaluations`; `risk_assessments` **intocada**                          |
| Q2 = A  | enum de 3 estados + observação por dimensão; **sem** escala, score ou conclusão global            |
| Q3 = A  | `psychosocial_campaign_id` nullable (`ON DELETE SET NULL`) + validação de tenant/unidade/`closed` |
| Q4 = A  | seção "Relação de EPIs" no PDF, além do painel na tela                                            |

## Diferenças em relação ao PLAN

| Diferença                                                                          | Por quê                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A #48 ganhou **dois endpoints REST de leitura** (o PLAN dizia "sem endpoint novo") | A regra das 4 superfícies vale para qualquer coisa exposta por HTTP; sem o espelho as duas leituras novas não seriam testáveis no Postman. Custo: 2 handlers de GET, mesma função do repositório. |
| `EPI_CA_DUE_WINDOW_DAYS` saiu do `dashboard.ts` para o domínio                     | O KPI de EPI já usava 30 dias; duas constantes para a mesma pergunta divergiriam.                                                                                                                 |
| Upload do GED aceita `docType` e ficou centralizado                                | Era pré-requisito do atalho de AET e do checklist; a tela estava em `max-w-2xl` encostado à esquerda, o que o próprio padrão do lote proíbe.                                                      |
| `runIsolationSuite` ganhou `extraSeedSql`                                          | A tabela nova não está no seed base; sem isso a suíte de RLS ficaria vazia (falso verde).                                                                                                         |

## Segurança, isolamento e privacidade

- **RLS**: `ergonomic_evaluations` nasce com `ENABLE ROW LEVEL SECURITY` + policy
  `org_id = current_setting('app.current_org', true)` para `app_runtime`, e GRANT explícito. A suíte
  `runIsolationSuite` roda as 6 provas padrão sobre ela (sem tenant → 0 linhas; tenant errado → 0
  linhas; `WITH CHECK` recusa escrita cross-tenant; sem vazamento após `withOrg`).
- **App layer**: todo acesso passa por `withOrg`; `assertRiskInTenant` (join com `ges` para obter a
  unidade) transforma risco de outro tenant em `FK_NOT_FOUND` **antes** de qualquer escrita. As
  escritas usam `auditedTenantWrite`.
- **Vínculo de campanha**: validado no servidor em três níveis (tenant → `FK_NOT_FOUND`; unidade
  diferente → `VALIDATION`; não encerrada → `VALIDATION`), tanto no create quanto no update. A tela
  só oferece as compatíveis, mas não é ela que decide.
- **Privacidade psicossocial**: o view model tem apenas `PsychosocialAggregate` (nome, status,
  período, contagem, fatores derivados). `getPsychosocialAggregatesTx` **nunca** consulta
  `psychosocial_answers` e só faz `count(*)` em `psychosocial_responses` — não há caminho para uma
  resposta individual chegar à tela ou ao PDF. Há teste unitário, teste de integração (serializa o
  consolidado e procura os ids das respostas) e prova no PDF real.
- **Nada de metodologia inventada**: o texto "COPSOQ" só existe como sugestão de preenchimento e
  como o que o profissional digitou em `method`. O rótulo do bloco é "Resultado agregado da campanha
  psicossocial"; a busca por `/escore/i` no PDF gerado não casa em nenhum ponto.
- **Papel `client`**: 403 em todas as rotas novas (leitura e escrita), verificado por HTTP real.

## Performance

- O consolidado ganhou **2 queries em lote** (avaliação vigente por `DISTINCT ON` sobre
  `inArray(riskIds)` e, só quando há campanha vinculada, 3 leituras agregadas). Nenhuma consulta por
  risco — não há N+1.
- A relação de EPIs é **derivada em memória** da visão consolidada que a página já carrega: zero
  query adicional na tela do PGR. Os campos técnicos entraram no **mesmo join** com `epi_catalog`.
- O checklist NR-18 é **uma** query com `currentVersionPredicate` e filtro por `lower(doc_type)`.
- Índices novos: `org_id`, `risk_id`, `(org_id, risk_id, assessed_at)` (leitura de vigente/histórico)
  e `psychosocial_campaign_id`.

## PDF

- Ordem final: Identificação · NR-01 · NR-09 · **NR-17** · 5W2H · **Relação de EPIs** · Hierarquia.
  A numeração é sequencial pelo que está ligado; desligar uma seção renumera as demais.
- Layout da NR-17 é **vertical por risco** (cabeçalho + tabela rótulo/valor + tabela de dimensões):
  seis dimensões com observação numa tabela horizontal não caberia em A4.
- A relação de EPIs agrupa material/tamanho/unidade/vida útil numa coluna "Especificações" pelo
  mesmo motivo.
- Estados honestos em todos os pontos: risco sem avaliação é **nomeado**; dimensão em branco é
  "Não avaliado"; `not_applicable` é "Não aplicável"; PGR sem EPI diz que não há EPI vinculado.
- Os **documentos** da NR-18 continuam anexos no GED — nenhum binário é concatenado ao PDF.

## UI e padrão visual

- Nenhum componente novo de lista: tudo é `ListCard`/`ListToolbar`/`DataGrid`/`GridHeader`/
  `GridRow`/`Cell`/`StatusBadge`/`RowActions`/`ListFooter`/`EmptyState`/`PageHeader`.
- A única mudança de foundation é `align: "center"` em `Cell`/`GridColumn`/`MonoCell`/`RowActions`
  (com teste), justamente para **não** espalhar `text-center` nas telas. O default continua `left`
  nas células e `right` nas ações, então as listas existentes não mudam.
- Cabeçalhos e valores estruturados centralizados; a coluna descritiva principal (documento, EPI,
  responsável, método) fica à esquerda por legibilidade.
- Badges só com `StatusBadge` e os tons existentes; nenhuma cor nova, nenhum hex solto na UI (o
  único hex do lote está no CSS de impressão do PDF, que é um documento à parte e já era assim).
- Formulários no wrapper central de 940 px com `_ui/form`; botão Voltar pelo `PageHeader`; ações no
  rodapé com `FormActions`; exclusão pelo `ConfirmDeleteButton` padrão.

## Testes

| Suíte                                                          | Resultado                                                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (format + lint + tsc + unit)                   | **PASS** — 143 suítes, 1 367 testes; 4 warnings **pré-existentes**                                                                                                     |
| `npm run test:integration` (Postgres efêmero recriado do zero) | 153 suítes / 1 206 testes verdes; **1 suíte pré-existente** (`signatures/quota`) estoura o timeout de 5 s sob a carga do run local e passa em isolamento — ver dívidas |
| `npm run build`                                                | **PASS** — todas as rotas novas presentes no manifesto                                                                                                                 |
| Gotenberg e2e (serviço real)                                   | **PASS** — 2 testes (pulado no run completo por falta de env)                                                                                                          |
| Playwright / QA                                                | **PASS** — ver [QA.md](QA.md)                                                                                                                                          |

Testes novos: 27 unit de `ergonomics`, 13 unit de `nr18`, 12 unit de `epi-relation`, 6 unit das
primitives de alinhamento, 13 no template do PDF, 4 no consolidado, 18 de integração da NR-17, 6 de
RLS da tabela nova, 13 de integração da NR-18/EPI e 9 provando os **dois** chamadores do PDF.

## Bugs encontrados e corrigidos

Todos no QA, todos corrigidos nesta branch (commit `fix(ui)`), todos de layout — nenhum de dado, de
isolamento ou de conteúdo do documento. Detalhe e evidências em [QA.md](QA.md#bugs-encontrados-e-corrigidos-todos-do-lote-na-mesma-branch).

## Dívidas pré-existentes (revalidadas, **não** corrigidas aqui)

| Dívida                                                                                                 | Situação em 27/09/2026                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal do banco de **desenvolvimento** defasado desde 02/09 (`0046`–`0048` aplicadas fora do drizzle) | Continua. A `0051` foi aplicada no dev pela conexão owner, como no Lote 2. Não afeta CI nem produção.                                                                                                                                                                 |
| `rest-*.test.ts` fora do CI (o `NextRequest` do Jest quebra em `resolveContext`)                       | Continua; `rest-ergonomic-evaluations.test.ts` entrou na mesma lista, com o motivo confirmado na execução. O REST foi validado por HTTP real no QA.                                                                                                                   |
| Ponte #51 (`action_plans`) com `who`/`why`/`where` gerados                                             | Continua fora do PDF; a busca por literais da ponte no documento não retorna nada.                                                                                                                                                                                    |
| Contêiner `sst-pdf-worker` roda a imagem do Lote 2 e o DNS do Supabase falha de forma intermitente     | Continua. O worker do lote foi executado pelo script oficial no host (`npm run worker`).                                                                                                                                                                              |
| `signatures/quota.test.ts` estoura o timeout padrão de 5 s no run **completo** desta máquina           | Investigado: a falha é `Exceeded timeout of 5000 ms`, não asserção errada — os dois testes criam 10 e 13 pedidos de assinatura em laço e, sob a carga das 158 suítes locais, passam de 5 s. Em isolamento passam (3/3). Suíte da fatia 010, não tocada por este lote. |
| Rodar a suíte completa **repetidas vezes** no mesmo banco local produz falhas variáveis                | Confirmado e explicado: com o banco recriado do zero o run é verde (à parte do timeout acima). É acúmulo de estado local, não código — em CI o banco é novo a cada job.                                                                                               |

## Estado das issues

| Issue | Estado        | Base                                                                                   |
| ----- | ------------- | -------------------------------------------------------------------------------------- |
| #40   | **Concluída** | modelo, migration, domínio, repositório, Actions, REST, docs, Postman, UI, testes e QA |
| #47   | **Concluída** | seção NR-17 entregue; documento com as 7 seções na ordem, pelos dois chamadores        |
| #48   | **Concluída** | tipos, checklist informativo, versionamento, relação derivada e seção no PDF           |

## Veredito

**APROVADO.** Todos os gates técnicos, visuais e de QA passaram; os únicos achados foram de layout e
já estão corrigidos e reverificados na mesma branch.
