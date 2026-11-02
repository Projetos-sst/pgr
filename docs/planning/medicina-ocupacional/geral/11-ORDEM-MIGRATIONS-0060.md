# 11 · Ordem das migrations: Medicina (0060) antes da pilha comercial

> Registro da decisão de prioridade e da verificação técnica da migration `0060_medical_professional_identity`
> (PR #138, NOB-144). Complementa o checklist de `06-GIT-MIGRATIONS-CD.md` §3.4 e as decisões MED-DEC-08/26 de
> `04-DECISOES-E-BLOQUEIOS.md`, que não foram alterados.

## 1. Decisão

| Campo        | Valor                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisão      | As migrations da Medicina entram na `develop` antes das migrations comerciais ainda não integradas. A precificação ficou para o fim do desenvolvimento (reunião com o Expedito).                  |
| Quem decidiu | Carlos (responsável pela frente de Medicina e pelos merges), em 02/11/2026                                                                                                                        |
| Consequência | A PR #138 usa a `0060`. As PRs comerciais (#123–#135, #137) **regeneram** as migrations delas sobre a `develop` depois da Medicina: 0061 em diante, com `when` novo e snapshot encadeado na 0060. |
| Comunicação  | Douglas e Rikelvin, com a mensagem do §5                                                                                                                                                          |

## 2. Estado verificado (02/11/2026)

| Onde                                         | Última migration                                | `when`                        |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| `origin/develop` (`731f498`, depois da #140) | `0059_pgr_document_reviews`                     | 1792608470913                 |
| PR #138                                      | `0060_medical_professional_identity`            | 1793569620172                 |
| `origin/main` (produção)                     | `0052_platform_leads`                           | 1791521827882                 |
| PRs comerciais (abertas, cumulativas)        | `0060`–`0063` comerciais; a #137 chega a `0068` | 1792675195470 a 1793116025722 |

**Atualização (02/11/2026, NOB-152):** a Medicina seguiu na frente da pilha comercial. Estado das migrations:

- já na `develop`: `0061_medico_user_links` (NOB-149, #143) e `0062_medical_exam_plans` (NOB-150, #144);
- em PR: `0063_pcmso_documents` (NOB-151, #145) e `0064_aso_previews` (NOB-152), empilhada na #145.

As comerciais continuam regenerando com `npm run db:generate` depois da última migration da Medicina que estiver na `develop`. A regra do §3 não muda.

**Homologação:** o CD (`.github/workflows/cd.yml`) roda só em `develop` e `main`.

- Nenhuma branch comercial passou pelo CD (`gh run list --workflow CD`: apenas `develop` e `main`). Logo, a homologação recebeu o journal da `develop`: 0000 a 0059.
- O log do passo `drizzle-kit migrate` não lista as migrations ("migrations applied successfully"). Para confirmar no próprio banco, quem tiver acesso roda a consulta abaixo, só leitura. O esperado é 60 linhas e `max(created_at)` = 1792608470913.

```sql
select count(*) as aplicadas, max(created_at) as ultima from drizzle.__drizzle_migrations;
```

Mesmo que alguém tivesse aplicado à mão uma migration comercial na homologação, a 0060 ainda seria aplicada: o `when` dela (1793569620172) é o maior de todos. As tabelas não se sobrepõem, porque a pilha comercial não toca `medicos` nem cria tabela da Medicina.

## 3. Por que regenerar e não só renomear

O migrator do drizzle (`drizzle-orm` 0.45.2, `pg-core/dialect.js`, usado pelo `drizzle-kit migrate` do CD):

- lê a última linha de `drizzle.__drizzle_migrations` por `created_at`;
- aplica só a migration cujo `when` for **maior**.

As migrations comerciais têm `when` menor que o da 0060. Se forem só renomeadas para 0061+, o CD da homologação termina verde **sem aplicá-las**.

- O teste `src/__tests__/unit/shared/db/migration-order.test.ts` reproduz essa regra.
- Ele falha se uma migration nova tiver `when` fora de ordem, se houver SQL fora do journal ou se a cadeia de snapshots quebrar.

Procedimento para a pilha comercial, depois do merge da #138:

1. Atualizar a branch com a `develop` (merge, sem force-push destrutivo).
2. Remover do branch os arquivos `0060`–`0063`/`0068` comerciais e as entradas correspondentes do journal e dos snapshots.
3. Rodar `npm run db:generate` (gera 0061+ com `when` atual e snapshot encadeado no `0060_snapshot`).
4. Reaplicar o SQL custom (GRANT, trigger, policies) nos arquivos novos.
5. Rodar `npm run check` (inclui o teste de ordem) e a integração do zero.

**Nada disso foi feito nas branches do Rikelvin.**

## 4. Evidência da 0060

- **Journal:** idx contínuo 0–60; tags com o número do idx; SQL de cada entrada presente; nenhum SQL órfão. O `when` da 0060 supera o de todas as anteriores.
  - Herança anterior: `0026_user_is_master` tem `when` escrito à mão, maior que o da 0027. Afeta só um banco parado exatamente na 0026; produção e homologação já passaram da 0027.
- **Snapshot:** `0060_snapshot.prevId` = id do `0059_snapshot`. `drizzle-kit generate` contra o schema da branch: "No schema changes".
  - Herança anterior: a cadeia quebra na 0019, e não existem os snapshots 0001, 0002 e 0026.
- **Migrator real em Postgres 16 descartável (`qa-pg16`):**
  - banco limpo → 61 migrations aplicadas;
  - banco migrado só com a pasta da `develop` (60) → depois com a branch → aplica só a 0060 (61);
  - nova execução → nada aplicado.
- **Objetos criados, idênticos nos dois bancos:**
  - enums `medical_profession` e `medical_affiliation`;
  - 4 colunas em `medicos` e as checks `ck_medicos_registration_uf` e `ck_medicos_rqe_physician`;
  - índice único `uq_medicos_id_org`;
  - tabela `pcmso_coordinator_assignments`, com FK composta para `companies` (CASCADE) e para `medicos` (RESTRICT), checks de período e de motivo, e índice único parcial `uq_pcmso_coordinators_open`;
  - RLS ligada;
  - policies `pcmso_coordinators_isolation` (permissiva), `pcmso_coordinators_module_access`, `pcmso_coordinators_owner_insert` e `pcmso_coordinators_owner_close` (restritivas);
  - `app_runtime` com SELECT e INSERT, UPDATE só em `ends_on`, `end_reason`, `ended_by` e `updated_at`, e sem DELETE;
  - trigger `set_updated_at_pcmso_coordinator_assignments`.
- Migration só aditiva: nada é removido ou renomeado.

## 5. Mensagem para Douglas e Rikelvin

> A PR #138 (Medicina, NOB-144) entra antes da pilha comercial, por decisão do Carlos: a precificação ficou para o
> fim. Ela usa a migration `0060_medical_professional_identity`, só aditiva e testada com o migrator do drizzle em banco
> limpo e em banco na 0059.
>
> Depois do merge, as PRs comerciais (#123–#135 e #137) precisam **regenerar** as migrations delas sobre a `develop`
> com `npm run db:generate` (0061 em diante). Não basta renomear: o drizzle pula migrations cujo `when` seja menor que
> o da última aplicada, e o CD termina verde sem criar as tabelas. O novo teste
> `src/__tests__/unit/shared/db/migration-order.test.ts` acusa esse caso no `npm run check`.
>
> Douglas: se possível, confirme na homologação com
> `select count(*), max(created_at) from drizzle.__drizzle_migrations;` (esperado: 60 e 1792608470913).
> Procedimento completo: `docs/planning/medicina-ocupacional/geral/11-ORDEM-MIGRATIONS-0060.md`.

## 6. Situação do checklist (`06` §3.4)

| Item do checklist                                               | Situação                                                                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Última migration da `develop` conferida                         | Feito: 0059                                                                                                                                                                         |
| Journal e snapshots coerentes                                   | Feito (§4), com teste automatizado                                                                                                                                                  |
| Branches e PRs concorrentes com migration                       | Feito (§2)                                                                                                                                                                          |
| Rikelvin e Douglas avisados e de acordo                         | **Aviso pendente de envio** (§5). Ordem decidida pelo Carlos. O checklist está marcado como PROPOSTO até a MED-DEC-26, e a branch `develop` não tem revisão obrigatória configurada |
| Ambiente afetado pelo CD                                        | Merge na `develop` aplica a 0060 na homologação; o release para `main` aplica 0053–0060 em produção (sequência sem `when` fora de ordem a partir da 0027)                           |
| Ensaio em Postgres efêmero, do zero, sem suíte pulada           | Feito (§4) + integração completa                                                                                                                                                    |
| RLS isolamento + módulo, GRANTs mínimos, índices, FKs compostas | Feito (§4)                                                                                                                                                                          |
