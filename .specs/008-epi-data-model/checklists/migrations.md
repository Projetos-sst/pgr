# Migration Safety Requirements Quality Checklist: Modelo de dados do módulo de EPIs

**Purpose**: Validar a **qualidade dos requisitos** relativos à(s) migration(s) desta fatia —
ordenação, segurança, reversibilidade, idempotência e operação — não a implementação. São "unit
tests for English": testam se o que está escrito na spec/plan/data-model/contracts é completo,
claro, consistente e mensurável o suficiente para uma migration ser executada com confiança.
**Created**: 2026-06-29
**Feature**: [spec.md](../spec.md)
**Depth**: Gate de PR (rigor médio)
**Audience**: Revisor (PR) / autor antes de aplicar a migration

**Note**: marque `[x]` quando o **requisito** estiver bem escrito — não quando a migration rodar.
`[Gap]` = aspecto possivelmente ausente que merece decisão explícita; `[Conflict]` = divergência
entre artefatos. Itens com `≈Ix` referem-se aos achados do `/speckit-analyze`.

## Requirement Completeness — Escopo da migration

- [ ] CHK001 - O número e a identidade das migrations desta fatia estão enumerados explicitamente (quais objetos cada uma cria/altera)? [Completeness, Plan §Scale/Scope]
- [ ] CHK002 - A alteração **aditiva** em `categories` (`UNIQUE(id, type)`) está documentada como um requisito/assunção, e não apenas como detalhe de implementação? [Completeness, data-model §"Alteração aditiva", Spec §FR-002a]
- [ ] CHK003 - Está documentado que cada tabela exige **GRANT explícito** + **trigger `set_updated_at`** como SQL custom dentro da migration (não auto-emitidos pelo drizzle-kit)? [Completeness, Plan §Constitution Check]
- [ ] CHK004 - Os 2 enums novos (`stock_movement_type`, `epi_signature_status`) e seus membros completos estão especificados como parte do escopo da migration? [Completeness, data-model §Enums]
- [ ] CHK005 - O escopo lista as 6 tabelas + índices (`org_id` e FKs) + políticas RLS como artefatos que a migration deve criar? [Completeness, data-model §Convenções]

## Requirement Clarity — Ordenação e termos inequívocos

- [ ] CHK006 - Está claramente especificado que o `UNIQUE(id, type)` em `categories` deve ser criado **antes** da FK composta que o referencia (senão o Postgres rejeita)? [Clarity, Gap, Spec §FR-002a]
- [ ] CHK007 - A FK composta `(category_id, type) → categories(id, type)` está descrita de forma inequívoca quanto a alvo, colunas e `ON DELETE RESTRICT`? [Clarity, data-model §epi_catalog]
- [ ] CHK008 - O termo "aditivo e seguro / sem mudança de dados" para a alteração de `categories` está definido de forma verificável (nenhuma linha existente afetada)? [Clarity, data-model §"Alteração aditiva"]
- [ ] CHK009 - Está claro qual **conexão/role** aplica a migration (owner via conexão direta unpooled) vs. a role de runtime (`app_runtime`, pooler)? [Clarity, Plan §Storage/§Technical Context]

## Requirement Consistency — Alinhamento entre artefatos

- [ ] CHK010 - O número de migrations é **consistente** entre plan, tasks e contracts? (Plan §Scale/Scope diz "1 migration 0007", mas a fatia entregou 0007 **+** 0008 do FR-002a.) [Conflict, ≈I1, Plan §Scale/Scope vs tasks §T026]
- [ ] CHK011 - A nota de "estado atual / as-built" do plan é consistente com o status real do FR-002a (já implementado/mergeado), sem afirmar que ainda não está no código? [Conflict, ≈I2, Plan §Summary]
- [ ] CHK012 - O contrato `contracts/schema-and-migrations.md` referencia o mesmo conjunto de migrations (0007 + 0008) descrito em tasks? [Consistency, contracts/, tasks §T009/§T026]
- [ ] CHK013 - As regras `ON DELETE` (RESTRICT/CASCADE/SET NULL) na migration são as mesmas descritas em Requirements e Edge Cases? [Consistency, Spec §FR-011..015/§Edge Cases]

## Acceptance Criteria Quality — Verificabilidade da migration

- [ ] CHK014 - Existe um critério de aceite **mensurável** para a "forma" pós-migration (RLS habilitado, policy `app_runtime`, GRANT, trigger, `org_id` NOT NULL+indexado, enums, FK composta)? [Measurability, tasks §T018]
- [ ] CHK015 - O critério de conclusão exige rodar a integração contra **Postgres efêmero** (não SQLite) para provar a migration? [Measurability, Spec §SC-007, Plan §Testing]
- [ ] CHK016 - Há critério rastreável que confirme que `auth_token` único usa **índice parcial** (`WHERE auth_token IS NOT NULL`), e não UNIQUE simples? [Measurability, data-model §epi_deliveries, Spec §FR-008]

## Scenario & Edge Case Coverage — Caminhos de falha da migration

- [ ] CHK017 - Os requisitos abordam **reversibilidade/rollback** da migration (down-migration ou estratégia equivalente), ou declaram explicitamente que não há down? [Coverage, Gap]
- [ ] CHK018 - Está especificado o comportamento de **re-execução/idempotência** da migration no harness de teste (split em `--> statement-breakpoint`, cada statement aplicado separadamente)? [Coverage, Gap, Plan §Testing]
- [ ] CHK019 - O caso de **falha no meio** da migration (parcialmente aplicada) está considerado nos requisitos (atomicidade por statement vs. transação)? [Edge Case, Gap]
- [ ] CHK020 - O cenário de **ordenação reordenada à mão** da 0008 (UNIQUE antes da FK) está registrado como requisito/assunção e não como achado tácito? [Edge Case, Gap, tasks §T026]

## Non-Functional / Operational — Governança da migration

- [ ] CHK021 - Há requisito explícito de **nunca aplicar a migration ao banco real/dev** — apenas gerar o `.sql` offline e aplicar em ambiente controlado/efêmero? [Completeness, Gap]
- [ ] CHK022 - Está documentado o **esquema de numeração** das migrations para evitar colisão entre branches empilhadas (0007/0008 aqui; 0009 em fatias seguintes)? [Gap, Consistency]
- [ ] CHK023 - O requisito de a migration não **enfraquecer o isolamento** (RLS continua na role `app_runtime` após o GRANT) está declarado? [Consistency, Plan §Constitution Check, Spec §FR-016]

## Dependencies & Assumptions — Pré-requisitos da migration

- [ ] CHK024 - A dependência da fatia 006 (`categories`/`employees`/`ges` já existentes) como pré-condição da migration está documentada? [Dependency, Spec §Assumptions]
- [ ] CHK025 - A assunção de que o `balance` é apenas valor + `CHECK ≥ 0` nesta migration (automação de saldo é Fase 2) está registrada para não induzir lógica de saldo na migration? [Assumption, Spec §Assumptions, data-model §Estados]

## Notes

- Itens de maior valor (gaps reais): CHK006 (ordenação UNIQUE→FK), CHK017 (rollback), CHK018
  (idempotência no harness), CHK021 (não aplicar ao dev/prod), CHK022 (numeração entre branches).
- CHK010/CHK011 espelham os achados `I1`/`I2` do `/speckit-analyze` — corrigi-los no `plan.md`
  fecha a inconsistência de contagem/estado das migrations.
- Esta lista valida **requisitos**, não a execução: rodar a migration em Postgres efêmero é a
  tarefa T035 (pendente), não um item desta checklist.

```

```
