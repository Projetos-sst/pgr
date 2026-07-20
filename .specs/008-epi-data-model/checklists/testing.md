# Testing & Quality-Gates Requirements Quality Checklist: Modelo de dados do módulo de EPIs

**Purpose**: Validar a **qualidade dos requisitos de teste e dos quality gates** desta fatia
(completude, clareza, consistência e mensurabilidade) — NÃO executar testes nem validar o código.
São "unit tests for English": testam se o que a spec/plan/tasks escrevem sobre _o que deve ser
testado e quando se considera concluído_ é completo, claro, consistente e mensurável.
**Created**: 2026-06-30
**Feature**: [spec.md](../spec.md)
**Depth**: Gate de PR (rigor médio)
**Audience**: Revisor (PR) / autor antes de marcar a fatia como concluída

**Note**: marque `[x]` quando o **requisito de teste** estiver bem escrito — não quando o teste
passar. `[Gap]` = aspecto possivelmente ausente que merece decisão explícita; `[Conflict]` =
divergência entre artefatos. Itens com `≈Cx`/`≈Ix` referem-se aos achados do `/speckit-analyze`.

## Requirement Completeness — O que deve ser testado

- [ ] CHK001 - Os requisitos especificam que TODA tabela do domínio (6) exige cobertura de teste de isolamento por tenant? [Completeness, Spec §SC-002/§SC-007, tasks §T012–T018]
- [ ] CHK002 - Está documentado o requisito de cobrir unit (lógica/validação zod) E integração (RLS/constraints) — as duas camadas, não só uma? [Completeness, Constitution §Quality Gates, Plan §Testing]
- [ ] CHK003 - Para uma fatia de **modelagem pura** (sem Server Actions/Route Handlers), está claro o que substitui o "teste de integração de Server Action" da constituição (i.e., RLS/constraints/forma-da-migration contra Postgres)? [Clarity, Gap, Constitution §Quality Gates]
- [ ] CHK004 - Os requisitos exigem teste para cada classe de constraint (CHECK de quantidade/saldo, UNIQUE de estoque/risco/token, enums fechados, FK composta de tipo)? [Completeness, Spec §SC-004, §FR-002a/§FR-017]
- [ ] CHK005 - Há requisito de teste para cada regra de `ON DELETE` (RESTRICT, CASCADE, SET NULL) descrita nos Requirements/Edge Cases? [Completeness, Spec §FR-011..015, tasks §T039–T041]
- [ ] CHK006 - O requisito de verificação da "forma" pós-migration (RLS, policy, GRANT, trigger, `org_id` NOT NULL+indexado, enums, FK) está enumerado? [Completeness, tasks §T018]

## Requirement Clarity — Termos de teste inequívocos

- [ ] CHK007 - Está inequívoco que a integração roda contra **Postgres efêmero** (`INTEGRATION_*`) e **nunca SQLite** nem o banco de dev/prod real? [Clarity, Spec §SC-007, Plan §Testing, Constitution §Quality Gates]
- [ ] CHK008 - A distinção entre os projetos de teste (unit jsdom vs integration node) está clara como requisito, e não só como detalhe de configuração? [Clarity, Plan §Testing]
- [ ] CHK009 - "As suítes passam" (SC-007) está definido de forma verificável — inclui o que conta como passar quando o ambiente efêmero não está disponível (suíte `skip` ≠ suíte verde)? [Clarity, Gap, ≈C1, Spec §SC-007]
- [ ] CHK010 - O requisito de provar o isolamento na role de **runtime** (`app_runtime`), não na role owner, está explícito? [Clarity, Gap, security.md §CHK017]

## Requirement Consistency — Alinhamento entre artefatos

- [ ] CHK011 - O critério de teste em SC-007 é consistente com a política de testes da constituição (unit + integração; isolamento/autorização/constraint em Postgres efêmero)? [Consistency, Spec §SC-007, Constitution §Quality Gates]
- [ ] CHK012 - As tarefas de teste em tasks.md (T012–T022, T028, T033, T039–T041) cobrem exatamente os SC/FR que dizem precisar de teste, sem requisito órfão? [Consistency, tasks §Phase 3–7 vs Spec §SC/§FR]
- [ ] CHK013 - O status de SC-007 é consistente entre artefatos? (tasks marca T038 unit/lint/tipos ✅ mas T035 integração `[ ]`; o plan não deve afirmar SC-007 plenamente satisfeito.) [Conflict, ≈C1, Spec §SC-007 vs tasks §T035/§T038]
- [ ] CHK014 - A terminologia de teste ("isolamento", "constraints", "forma da migration", "as-built") é usada de forma uniforme entre plan, tasks e checklists? [Consistency]

## Acceptance Criteria Quality — Critérios de conclusão mensuráveis

- [ ] CHK015 - SC-007 é objetivamente verificável (lint, tipos e suítes — todas, não-`skip` — verdes), com um sinal claro de "feito"? [Measurability, Spec §SC-007]
- [ ] CHK016 - Cada User Story declara um **Independent Test** mensurável e executável isoladamente via seed (org_a/org_b)? [Measurability, Spec §US1–US4]
- [ ] CHK017 - O critério de cobertura de isolamento quantifica "100% das 6 tabelas" de forma checável (uma suíte por tabela)? [Measurability, Spec §SC-002, tasks §T012–T018]
- [ ] CHK018 - Há critério mensurável para a contagem de testes esperada (ex.: nº de suítes de isolamento/constraints) ou isso fica implícito? [Gap, Measurability]

## Scenario & Edge Case Coverage — Caminhos negativos exigidos

- [ ] CHK019 - Os requisitos exigem teste para os caminhos NEGATIVOS (quantidade ≤ 0, saldo/mínimo negativos, valor fora do enum, escrita cross-tenant)? [Coverage, Spec §SC-004/§Edge Cases]
- [ ] CHK020 - Há requisito de teste para o caso de **FK cruzando tenants** (ex.: `epi_stock` apontando catálogo de outro tenant) — deve ser bloqueado? [Edge Case, Gap, security.md §CHK020]
- [ ] CHK021 - Há requisito de teste para `auth_token` duplicado entre tenants distintos (deve falhar por ser único global) e para múltiplos `NULL` coexistindo? [Edge Case, Spec §FR-008/§SC-005]
- [ ] CHK022 - Está coberto por requisito o caso do item "máquina" sem CA/validade/norma (campos condicionais vazios aceitos)? [Coverage, Spec §FR-003/§Edge Cases]

## Non-Functional / Governance — Política de testes & segurança do harness

- [ ] CHK023 - Há requisito explícito de **nunca** rodar a integração (que pode truncar dados) contra o banco real/dev — apenas Postgres efêmero `INTEGRATION_*`? [Completeness, Gap, Plan §Testing]
- [ ] CHK024 - O requisito referencia a política de testes da constituição como fonte (testes obrigatórios por feature; isolamento/autorização/constraint em Postgres efêmero)? [Traceability, Constitution §Quality Gates]
- [ ] CHK025 - Está documentado o requisito do harness aplicar a migration por split em `--> statement-breakpoint` (forma como a integração monta o schema efêmero)? [Completeness, Gap, Plan §Testing]

## Dependencies & Assumptions — Pré-requisitos de teste

- [ ] CHK026 - A dependência do seed multi-tenant (`pgr-seed.ts`, cadeia EPI por tenant, org_a/org_b) está documentada como pré-condição dos testes de isolamento? [Dependency, tasks §T011]
- [ ] CHK027 - As variáveis de ambiente de integração (`INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL`) estão registradas como pré-requisito para SC-007? [Dependency, tasks §T035]
- [ ] CHK028 - Está registrada a assunção/risco de que T035 (integração) fica pendente sem Docker/Postgres efêmero, e que isso mantém SC-007 formalmente não-validado até ser executado? [Assumption, ≈C1, tasks §Notes/§T035]

## Notes

- Itens de maior valor (gaps reais): CHK003 (o que é "integração" numa fatia de dados pura),
  CHK009/CHK013/CHK028 (SC-007 não-validado enquanto T035 está pendente — `skip` ≠ verde),
  CHK020 (FK cross-tenant), CHK023 (nunca testar contra o banco real).
- CHK009/CHK013/CHK028 espelham o achado **C1** do `/speckit-analyze`: a cobertura de teste
  existe e está mapeada (T035), mas a **execução** contra Postgres efêmero ainda não ocorreu.
- Esta lista valida **requisitos de teste**, não a execução: rodar `npm run test:integration` é a
  tarefa T035 (pendente), não um item desta checklist.
