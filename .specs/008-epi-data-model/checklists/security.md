# Security & Multi-Tenant Isolation Checklist: Modelo de dados do módulo de EPIs

**Purpose**: Validar a **qualidade dos requisitos** de isolamento multi-tenant / RLS (Princípio I
da constituição) — completude, clareza, consistência e mensurabilidade. NÃO testa implementação;
testa se os requisitos estão bem escritos e prontos para implementação/revisão.
**Created**: 2026-06-24
**Feature**: [spec.md](../spec.md)
**Depth**: Gate de PR (rigor médio)
**Audience**: Revisor (PR)

## Requirement Completeness — Cobertura de isolamento

- [ ] CHK001 - Os requisitos especificam que **todas as 6 tabelas** novas (catálogo, estoque, movimentos, entregas, itens de entrega, risco) são escopadas por tenant, sem exceção? [Completeness, Spec §FR-016, §SC-002]
- [ ] CHK002 - Está documentado o requisito de que **leituras** só enxergam o tenant ativo? [Completeness, Spec §FR-016, §US1]
- [ ] CHK003 - Está documentado o requisito de que **escritas** para outro tenant são rejeitadas? [Completeness, Spec §FR-016, §US1 AC-2]
- [ ] CHK004 - Os requisitos cobrem o caso de **referência cruzada por identificador** de outro tenant (não tornar dados visíveis)? [Coverage, Spec §US1 AC-3]
- [ ] CHK005 - Há requisito explícito de que o tenant vem **sempre da sessão**, nunca de input do cliente? [Completeness, Spec §FR-016, §Assumptions]
- [ ] CHK006 - O requisito define a **origem canônica** do tenant (escritório de SST = `orgs.id`), distinguindo-o de org do Clerk / empresa-cliente? [Clarity, Spec §Assumptions]

## Requirement Clarity — Termos mensuráveis e inequívocos

- [ ] CHK007 - O critério "nenhum dado aparece/vaza para outro escritório" é **objetivamente verificável** (ex.: 0 linhas retornadas)? [Measurability, Spec §SC-002]
- [ ] CHK008 - Está definido o comportamento esperado quando o **contexto de tenant está ausente** (sem `app.current_org`)? Os requisitos dizem se isso retorna vazio, erro ou bloqueio? [Clarity, Gap]
- [ ] CHK009 - O requisito de `auth_token` único distingue claramente **escopo global** vs. escopo por tenant, com a justificativa (link público sem contexto de tenant)? [Clarity, Spec §FR-008, §SC-005]
- [ ] CHK010 - Está claro que **múltiplas** entregas **sem** token coexistem (unicidade só vale para token preenchido)? [Clarity, Spec §FR-008, §Edge Cases]

## Requirement Consistency — Alinhamento entre seções

- [ ] CHK011 - O escopo por tenant é descrito de forma **consistente** entre FR-016, US1 e SC-002 (mesmos termos, sem divergência)? [Consistency, Spec §FR-016/§US1/§SC-002]
- [ ] CHK012 - A regra de `auth_token` global é consistente entre FR-008, SC-005 e a seção de Edge Cases (sem contradição com o isolamento por tenant)? [Consistency, Spec §FR-008/§SC-005]
- [ ] CHK013 - Os requisitos deixam claro que `auth_token` único global **não** enfraquece o isolamento (RLS continua barrando leitura cross-tenant; o índice só evita colisão de token)? [Consistency, Conflict-check, Spec §FR-008]
- [ ] CHK014 - A terminologia "tenant / escritório / org" é usada de forma uniforme, sem sinônimos ambíguos que confundam a fronteira de isolamento? [Consistency]

## Acceptance Criteria Quality — Critérios de aceite testáveis

- [ ] CHK015 - Cada cenário de aceite de US1 é **independentemente testável** com dois tenants semeados (org_a/org_b)? [Measurability, Spec §US1]
- [ ] CHK016 - O critério SC-002 quantifica a cobertura ("100% das 6 tabelas") de forma verificável? [Measurability, Spec §SC-002]
- [ ] CHK017 - Há critério de aceite que exija a verificação do isolamento **na role de runtime** (`app_runtime`), não apenas na role owner? [Coverage, Gap]

## Scenario & Edge Case Coverage — Caminhos negativos

- [ ] CHK018 - Os requisitos cobrem a tentativa de **gravar linha marcada como de outro tenant** (escrita maliciosa explícita)? [Coverage, Spec §US1 AC-2]
- [ ] CHK019 - Os requisitos cobrem **leitura sem filtro de tenant explícito** retornando apenas o tenant ativo (defesa em profundidade pela RLS)? [Coverage, Spec §US1 AC-1]
- [ ] CHK020 - Está especificado o comportamento de **FKs que cruzam tenants** (ex.: associar um `epi_stock` a um catálogo de outro tenant) — é bloqueado? [Edge Case, Gap]
- [ ] CHK021 - Os requisitos abordam o caso de um **token de assinatura duplicado** entre tenants diferentes (deve falhar por ser global)? [Edge Case, Spec §FR-008, §Edge Cases]

## Non-Functional / Governance — Constituição

- [ ] CHK022 - Os requisitos referenciam explicitamente o **Princípio I** (isolamento não-negociável) como fonte da regra? [Traceability, Constitution §Princípio I]
- [ ] CHK023 - Está documentado o requisito de **GRANT explícito** + RLS na role `app_runtime` (não só a existência da coluna `org_id`)? [Completeness, Plan §Constitution Check]
- [ ] CHK024 - Os requisitos exigem **índice** em `org_id` em todas as tabelas (suporte às leituras escopadas)? [Completeness, Plan §Technical Context]
- [ ] CHK025 - Está claro que o isolamento deve ser provado contra **Postgres efêmero** (não SQLite), por depender de RLS/policies reais? [Clarity, Plan §Testing, Spec §SC-007]

## Dependencies & Assumptions — Riscos documentados

- [ ] CHK026 - A premissa "tenant = `orgs.id`, resolvido da sessão" está registrada e validada como fronteira de isolamento? [Assumption, Spec §Assumptions]
- [ ] CHK027 - O vínculo interino `epi_risk → ges` está documentado de forma que **não** crie um caminho de vazamento cross-tenant (o GES também é escopado por tenant)? [Assumption, Dependency, Spec §Assumptions]
- [ ] CHK028 - O reuso de `categories` (006) como taxonomia mantém a mesma garantia de isolamento, e isso está declarado? [Dependency, Spec §FR-002]

## Notes

- Marque `[x]` quando o **requisito** estiver completo/claro/consistente — não quando o código passar.
- `[Gap]` = aspecto possivelmente ausente na spec que merece decisão explícita.
- Itens CHK008, CHK017, CHK020 são os `[Gap]` de maior valor: comportamento sem contexto de tenant,
  verificação na role de runtime e FK cross-tenant — confirme se estão cobertos na spec ou nos testes.
