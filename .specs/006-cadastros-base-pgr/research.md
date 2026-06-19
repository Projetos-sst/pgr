# Research — Cadastros base do PGR (Phase 0)

Decisões técnicas que resolvem os pontos em aberto antes do design. A stack é fixa
(constituição §II) e o motor de isolamento é herdado da `004`/`005` — então não há
`NEEDS CLARIFICATION` de stack; o foco é **como** modelar os dados de domínio sobre o
padrão existente. Cada item: Decisão · Rationale · Alternativas consideradas.

---

## R1 — Nº de trabalhadores expostos por GES: derivado por agregação na leitura

- **Decisão**: **Não** persistir. Calcular por agregação na leitura —
  `SELECT ges_id, COALESCE(SUM(worker_count), 0) FROM ges_job_roles WHERE org_id = $active GROUP BY ges_id`
  — numa função de repositório (`countExposedWorkersByGes`). GES sem associação →
  `COALESCE(…, 0)` retorna **0**; nunca nulo nem erro.
- **Rationale**: Fonte única de verdade (`ges_job_roles`), zero drift, zero trigger oculto.
  KISS/DRY (CODE_STANDARDS §0). Testável diretamente. Os índices em `org_id` e `ges_id`
  cobrem o `WHERE`/`GROUP BY`; custo desprezível no volume MVP.
- **Alternativas**: (a) coluna `n_trabalhadores_expostos` em `ges` recalculada na Server
  Action que escreve `ges_job_roles` — introduz denormalização e risco de drift,
  desnecessário sem demanda de UI/export por coluna persistida (YAGNI); (b) trigger no
  Postgres recalculando a coluna — lógica escondida, difícil de testar, **descartada** pelo
  briefing §6.3. Resolve a decisão aberta A2 do spec.

## R2 — Enums fechados: `pgEnum` para domínios categóricos; `CHECK` para faixa numérica

- **Decisão**: Os 4 domínios categóricos viram **`pgEnum`**: `category_type`
  (`epi｜machine`), `employee_sex` (`male｜female｜not_informed`), `marital_status`
  (`single｜married｜divorced｜widowed｜stable_union`), `employee_status`
  (`active｜on_leave｜dismissed`). `risk_grade` é `smallint` com
  `CHECK (risk_grade between 1 and 4)` (grau numérico NR-04, não categórico).
  `worker_count` é `integer` com `CHECK (worker_count > 0)`.
- **Rationale**: `pgEnum` dá domínio fechado no banco **e** inferência de tipo no Drizzle
  (alinhado a Princípio V e ao TS `strict`). `risk_grade` é uma faixa ordenada de inteiros —
  `smallint + CHECK` é o ajuste natural (e barato de estender se a NR mudar). Valores
  membros vêm das Clarifications 2026-06-19 (Q employee_status/sex/marital).
- **Alternativas**: `text + CHECK (… in (…))` para os categóricos — funciona, mas perde a
  inferência de tipo e a semântica de enum; rejeitado. Enum nativo para `risk_grade` —
  rejeitado por ser faixa numérica, não rótulos.
- **Custo de evolução registrado**: alterar membros de um `pgEnum` depois exige
  `ALTER TYPE … ADD VALUE` (migration) — por isso os conjuntos foram fixados no
  `/speckit-clarify` antes do design.

## R3 — `ON DELETE` por FK (cascade vs set null vs restrict)

- **Decisão** (resolve A4 + Clarify Q1):
  - **Cascade descendo a cadeia da empresa**: `companies → work_units → ges → ges_job_roles`
    e `companies → employees`. Apagar uma empresa remove toda a sua subárvore no tenant.
  - `ges_job_roles.ges_id → ges` e `ges_job_roles.job_role_id → job_roles`: **CASCADE**
    (a associação não faz sentido sem qualquer das pontas; apagar um GES ou uma função
    remove suas linhas de junção).
  - `employees.ges_id → ges` e `employees.job_role_id → job_roles`: **SET NULL** (nullable).
    Apagar um GES/função **não** apaga o funcionário — apenas o desvincula.
  - `employees.company_id → companies`: **NOT NULL + CASCADE** (Clarify Q1 — todo
    funcionário tem empregador).
- **Rationale**: A subárvore da empresa é dado dependente; cascade dá deleção previsível e
  testável (SC-009). Já o funcionário é um registro de identidade que sobrevive à remoção
  de um GES/função (`SET NULL`), mas não existe fora de uma empresa (cascade).
- **Alternativas**: `RESTRICT` em tudo — mais seguro contra perda acidental, mas
  inviabiliza deleção da empresa sem limpeza manual da subárvore; rejeitado para o MVP (a
  proteção contra deleção acidental fica a cargo da UI/regra de negócio em fatia futura).

## R4 — Endereço estruturado: colunas inline por tabela (sem tabela `addresses`)

- **Decisão**: Replicar as colunas de endereço (`zip_code`, `street`, `number`,
  `complement`, `district`, `city`, `state`) **inline** em `companies`, `work_units` e
  `employees`. `number` é `text` (aceita `S/N`, letras). Sem tabela `addresses` compartilhada.
- **Rationale**: YAGNI — há 3 consumidores hoje, mas o endereço é um value-object simples
  sem ciclo de vida próprio nem reuso entre linhas; uma tabela `addresses` adicionaria join
  e FK sem ganho real no MVP. Se surgir necessidade (histórico de endereço, geocoding),
  extrai-se depois.
- **Alternativas**: tabela `addresses` normalizada (1:1) — abstração precoce; `jsonb` único
  — perde constraints/índices por campo. Ambos rejeitados.

## R5 — `companies.razao_social` passa a `NOT NULL`

- **Decisão**: `ALTER COLUMN razao_social SET NOT NULL` (resolve A3). A migration assume a
  tabela praticamente vazia (sem backfill); se houver linha com `razao_social` nula em
  ambiente real, ela é corrigida antes do `SET NOT NULL` (passo documentado no quickstart).
- **Rationale**: Empresa sem razão social não é cadastro válido (Princípio V). Custo de
  migração trivial dado o estado atual da tabela.
- **Alternativas**: manter nullable e validar só na app — deixa o banco aceitar dado
  inválido, contra Princípio V; rejeitado.

## R6 — `categories`: unicidade `UNIQUE(org_id, type, name)`

- **Decisão**: Adicionar `UNIQUE(org_id, type, name)` (nome único dentro do tipo, por
  tenant). **Confirmado** e registrado como requisito (spec Clarifications 2026-06-19 +
  FR-017) — não é mais decisão em aberto.
- **Rationale**: Mantém o catálogo limpo (sem "Capacete" duplicado) e é consistente com a
  unicidade-por-tenant (`UNIQUE(org_id, …)`) das demais tabelas.
- **Alternativas**: `UNIQUE(org_id, name)` (ignora tipo — impediria um EPI e uma máquina
  homônimos, improvável mas possível); sem unicidade (permite duplicatas — adia o problema
  para a UI). Ambos preteridos.

## R7 — Geração e aplicação da migration `0005_*`

- **Decisão**: `drizzle-kit generate` produz o SQL a partir dos schemas (CREATE TYPE dos
  enums, ALTER `companies`, CREATE das 6 tabelas, índices, `UNIQUE`, `CHECK`, `ENABLE RLS`,
  `CREATE POLICY`). **GRANTs** e **triggers `set_updated_at`** são **adicionados como SQL
  custom** ao arquivo gerado (drizzle-kit não gera nenhum dos dois — padrão já usado em
  `0003`/`0004` para GRANT e `0001` para o trigger). Aplicação via conexão direta/unpooled
  como **owner** (`DATABASE_URL_UNPOOLED`, ver `drizzle.config.ts`).
- **Rationale**: Mantém Drizzle como dono code-first sem perder os artefatos que ele não
  cobre. Replica exatamente o que já funciona no repo.
- **Ordem de statements**: enums → ALTER `companies` → `work_units` → `ges` → `job_roles` →
  `categories` → `employees` → `ges_job_roles` (respeita dependências de FK), depois
  índices/constraints, policies, GRANTs e triggers. A função `set_updated_at()` já existe
  (criada em `0001`) — os triggers novos apenas a referenciam.
- **Alternativas**: SQL 100% manual — perde o code-first e diverge do schema; rejeitado.

## R8 — Harness de teste de RLS/integridade: Postgres efêmero (nunca SQLite)

- **Decisão**: Testes de isolamento, FK, `ON DELETE`, `UNIQUE` e da agregação rodam no
  projeto `integration` (node) contra **Postgres efêmero**, reutilizando `_helpers/db`
  (`adminClient`, `applyMigrations`, `withOrgTx`) e o formato de `companies-isolation.test.ts`
  (`describe.skip` quando `INTEGRATION_*` ausente). Unitários de validação zod e da
  agregação (com dados mockados) rodam no projeto `unit`.
- **Rationale**: SQLite não tem RLS/policies/`current_setting` — o backstop só é provável
  contra Postgres real (constituição §Quality Gates, exceção de Postgres efêmero; Princípio
  I). Reuso direto do harness existente reduz risco e custo.
- **Alternativas**: SQLite em memória para tudo — **proibido** para RLS pela constituição;
  rejeitado.

---

### Itens sem pendência

`work_units`/`ges_job_roles` (nomes), `razao_social`, `ON DELETE`, `U(org_id, company_id,
title)` e a derivação do nº de expostos foram fechados nas Clarifications/Assumptions do
spec. Nenhum `NEEDS CLARIFICATION` permanece para o design.
