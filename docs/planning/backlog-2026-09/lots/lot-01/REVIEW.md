# Lote 1 — REVIEW

Data: 2026-09-16 · Base: `develop` @ `690ec1b` (sem mudanças até o fechamento; rebase sem conflito)
Branch: `lot-01-feat/document-versions-risk-plan-coverage` · PR única: **Projetos-sst/pgr#93**

## Planejado × realizado

| Sub-lote | Planejado                                                                                                                            | Realizado                                                        | Status                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| 1A — #56 | Histórico de versões, vigente centralizada, somente leitura no backend, herança da vigente, conflito de upload → erro de domínio, UI | Tudo entregue (`aa5605e`) + correção visual do modal (`ee2be9b`) | Implementada, em revisão |
| 1C — #33 | Evidência dos critérios, comentário, fechamento, card Done, sem código                                                               | Tudo entregue; suítes de EPI 18/18                               | **Fechada**              |
| 1B — #42 | Cobertura derivada, status no consolidado, aba Inventário, aviso no formulário, sem PDF/migration                                    | Tudo entregue (`c75fc51`)                                        | Implementada, em revisão |

## Diferenças em relação ao PLAN

1. **Entrega numa PR única**, por decisão do responsável durante o lote (o PLAN previa uma PR por
   sub-lote). Os commits continuam separados por issue. A PR #92, aberta só para a auditoria, foi fechada
   ao renomear a branch e substituída pela #93.
2. **Somente leitura via erro novo** `DOCUMENT_VERSION_READ_ONLY` (409), mapeado em `api/rest.ts` e
   registrado na tabela de códigos do `api-design.md`.
3. **Conflito de upload** usa a comparação pelo nome do erro (`StorageObjectExistsError`) no repositório,
   em vez de `instanceof`, porque suítes existentes mockam o módulo de Storage inteiro.
4. **Formulário da medida** passou a receber a classificação vigente validada por
   `riskClassificationSchema` (a coluna `risk_assessments.result` é texto).
5. **Defeito encontrado na validação visual:** o modal de histórico herdava `text-right` da célula de ações.
   Corrigido e recapturado.

## Decisões aplicadas (não reabrir)

- #42: plano do PGR = `control_measures`; garantia suave; sem bloqueio de assinatura; reclassificação
  não escreve nada; PDF no Lote 2; sem migration.
- #33: funcionalmente resolvida; não migrar para `signature_requests` (cota do plano free, dados
  históricos não migráveis sem fabricação, links de 72h).
- #56: vigente = maior versão do grupo até #54; regra centralizada em
  `db/repositories/document-versions.ts`.

## Migrations

Nenhuma.

## Testes

Ambiente local: Postgres 16 efêmero (binários portáteis, porta 5433, bootstrap do CI, `fsync=off`),
`--runInBand --testTimeout=60000`. Com o timeout padrão de 5s a máquina estoura tempo em testes que já
passavam na `develop` — não é regressão.

| Camada                                                                              | Resultado                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Linha de base antes do código (`documents`, `control-measures`, `pgr-editor`)       | 137/137                                                                |
| `npm run check` final (format + lint + typecheck + unit)                            | 138 suítes, **1256/1256**; 0 erros de lint (4 warnings pré-existentes) |
| #56 integração (`documents-versions`)                                               | 8/8                                                                    |
| #56 REST (`rest-document-versions`)                                                 | 4/4                                                                    |
| #56 regressão GED + worker + isolamento                                             | 13 suítes, 90/90                                                       |
| #33 evidência (`epi-sign-public` + `epi-deliveries`)                                | 18/18                                                                  |
| #42 integração (`pgr-plan-coverage`)                                                | 8/8                                                                    |
| #42 regressão (editor PGR, medidas, riscos, relatórios/PDF, worker, planos de ação) | 49 suítes, **454/454**                                                 |
| `npm run build`                                                                     | ok                                                                     |

## Validação visual (Playwright, 1440/768/375)

Evidência em `redesign/validacao_full/056-ged-historico-versoes/` e `042-pgr-cobertura-plano/`, com
`NOTAS.md`. Dados sintéticos criados pela API real na organização de desenvolvimento, **removidos depois**
(contagem zero verificada no banco) e sessão do navegador devolvida à organização original.

Confirmado ao vivo: histórico `[v3 vigente, v2, v1]`; `PUT` na v1 → 409; resumo "Não avaliado 1 · Sem
medida 1 · Incompleto 1 · Coberto 1"; reclassificação real deixou o risco incompleto com status "Manter"
preservado; formulário bloqueou o envio sem responsável/prazo antes de qualquer requisição.

## CI

A PR #93 roda o CI completo (format, lint, typecheck, unit, integração em Postgres 16 e build). Resultado
registrado na descrição da PR.

## Regressões verificadas

- Worker de PDF e geração síncrona: sem mudança de template; testes `pdf-batch-core`, `jobs-worker` e rota
  de PDF verdes.
- Download de documentos: inalterado; agora também usado por versão no histórico.
- Regra de status/prazo das medidas: os 9 testes originais continuam verdes com a regra extraída.
- Ponte `control_measure → action_plan` (#51): testes de planos de ação verdes.

## Riscos residuais e dívida

1. **Ponte #51 grava texto padrão** em `action_plans` (`who = "Responsável não definido"`, `why` gerado) e
   transforma medida "Manter" em plano "planejado". Não foi expandida; precisa de decisão antes de #47.
2. **Planos espelhados ficam ativos** quando a medida ou o risco é excluído (origem marcada como removida).
   Pré-existente, fora do escopo.
3. **Sem UNIQUE** em `action_plans(org_id, origin_type, origin_id)` para a ponte; endurecimento opcional com
   migration.
4. **`signedAt` do EPI deriva de `updated_at`** — seguro enquanto nenhuma escrita tocar entregas assinadas;
   `signed_at` próprio é melhoria separada.
5. **Vigência = maior versão** será errada quando existir aprovação; #54 deve trocar a regra em
   `document-versions.ts`.
6. **Bypass de desenvolvimento ligado no `.env` local** faz a REST sem headers `x-dev-*` usar o
   `DEV_TENANT_ID`, não a sessão — relevante para quem testar a API manualmente.

## Pendências

- Merge da PR #93 (responsável humano).
- #56 e #42 fecham com o merge (`Closes`).

## Próximos passos

**Lote 2 — NR-09 + PDF do PGR (parte 1): #39 e #47.** Inclui renderizar no PDF o status e a cobertura
introduzidos pelo #42 e decidir a dívida 1 (ponte #51) antes de mexer na seção de plano de ação.
