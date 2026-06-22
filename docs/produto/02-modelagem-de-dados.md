# 02 — Modelagem de Dados

Banco: **PostgreSQL gerenciado pelo Supabase**. ORM: **Drizzle**. Migrations:
**Drizzle Kit**, versionadas em `lib/db/migrations/`.

O PostgreSQL é a **fonte de verdade** (constituição, Princípio V): constraints
de banco (FK, NOT NULL, UNIQUE, CHECK) refletem as regras de dados. A validação
Zod na aplicação complementa — não substitui — essas garantias.

> Escopo: este documento modela **apenas** os 9 módulos definidos na
> constituição. Não inventa entidades além disso. Campos específicos de cada
> módulo serão refinados na `spec.md`/`data-model.md` de cada fatia.

## Estratégia multi-tenant (Princípio I)

O _tenant_ é a **organização do Clerk**. As regras de modelagem:

1. **Toda tabela de dados de negócio tem `organization_id`** — coluna `text`,
   `NOT NULL`, contendo o `org_*` id do Clerk. Sempre indexada.
2. **Índice composto**: todo índice de busca frequente começa por
   `organization_id` (ex.: `(organization_id, cpf)`), porque toda query filtra
   por tenant primeiro.
3. **RLS habilitado** em toda tabela com `organization_id` — como _backstop_,
   nunca a única barreira (ver seção RLS abaixo).
4. **UNIQUE sempre escopado por tenant**: nunca `UNIQUE(cpf)`; sempre
   `UNIQUE(organization_id, cpf)`. Empresas diferentes podem ter o mesmo CPF.

## Convenções comuns a todas as tabelas

| Coluna            | Tipo          | Observação                                                |
| ----------------- | ------------- | --------------------------------------------------------- |
| `id`              | `uuid`        | PK, default `gen_random_uuid()`                           |
| `organization_id` | `text`        | NOT NULL, indexado (exceto tabelas de referência globais) |
| `created_at`      | `timestamptz` | NOT NULL, default `now()`                                 |
| `updated_at`      | `timestamptz` | NOT NULL, default `now()`, atualizado na escrita          |
| `created_by`      | `text`        | nullable — id do usuário Clerk (entidades principais)     |

- **Soft-delete**: **não** no MVP (YAGNI). Exclusão é física. Registrado como
  melhoria futura (doc 05) caso o domínio exija histórico legal.
- **Enums**: usar `pgEnum` do Drizzle (enum nativo do Postgres) para conjuntos
  fechados de valores. Isso põe a regra no banco, não só na aplicação.
- **Dinheiro/quantidades**: `integer` ou `numeric` — nunca `float`.

## Tabelas por módulo

Notação: `PK` chave primária, `FK→` chave estrangeira, `*` NOT NULL,
`U(...)` constraint UNIQUE. `organization_id`, `created_at`, `updated_at`
omitidos das listas (presentes em todas, conforme convenção acima).

### Núcleo

**`user_profiles`** — espelho mínimo dos usuários do Clerk (para exibir nomes e
referenciar autoria sem chamar a API do Clerk a cada render). Sincronizado por
webhook (doc 04). É dado de referência: **não** tem `organization_id` (o vínculo
usuário↔organização vive no Clerk).

| Coluna      | Tipo      | Notas                  |
| ----------- | --------- | ---------------------- |
| `id`        | `text` PK | id do usuário no Clerk |
| `email`     | `text` \* |                        |
| `full_name` | `text`    |                        |

### Funcionários

**`sectors`** (setores) — `id` PK · `name` \* · `U(organization_id, name)`

**`job_roles`** (cargos/funções) — `id` PK · `title` \* · `U(organization_id, title)`

**`employees`** (funcionários geridos — trabalhadores das empresas, **não** são
usuários do sistema):

| Coluna           | Tipo                   | Notas                              |
| ---------------- | ---------------------- | ---------------------------------- |
| `id`             | `uuid` PK              |                                    |
| `full_name`      | `text` \*              |                                    |
| `cpf`            | `text` \*              | `U(organization_id, cpf)`          |
| `sector_id`      | `uuid` FK→`sectors`    | nullable                           |
| `job_role_id`    | `uuid` FK→`job_roles`  | nullable                           |
| `admission_date` | `date`                 |                                    |
| `status`         | enum `employee_status` | `ativo` \| `inativo` \| `afastado` |

### EPIs

**`epi_catalog`** — catálogo de EPIs:

| Coluna      | Tipo      | Notas                    |
| ----------- | --------- | ------------------------ |
| `id`        | `uuid` PK |                          |
| `name`      | `text` \* |                          |
| `ca_number` | `text`    | Certificado de Aprovação |
| `type`      | `text`    |                          |

**`epi_deliveries`** — entregas/devoluções de EPI a funcionários:

| Coluna               | Tipo                       | Notas                              |
| -------------------- | -------------------------- | ---------------------------------- |
| `id`                 | `uuid` PK                  |                                    |
| `employee_id`        | `uuid` FK→`employees` \*   |                                    |
| `epi_id`             | `uuid` FK→`epi_catalog` \* |                                    |
| `quantity`           | `integer` \*               | `CHECK (quantity > 0)`             |
| `delivered_at`       | `date` \*                  |                                    |
| `expected_return_at` | `date`                     | nullable                           |
| `returned_at`        | `date`                     | nullable — preenchido na devolução |

### PGR / Gestão de Riscos

**`pgr_documents`** — `id` PK · `title` \* · `reference_year` `integer` · `status`
enum `pgr_status` (`rascunho` \| `vigente` \| `arquivado`)

**`risks`** (perigos/riscos identificados):

| Coluna            | Tipo                         | Notas                                                      |
| ----------------- | ---------------------------- | ---------------------------------------------------------- |
| `id`              | `uuid` PK                    |                                                            |
| `pgr_document_id` | `uuid` FK→`pgr_documents` \* |                                                            |
| `sector_id`       | `uuid` FK→`sectors`          | nullable                                                   |
| `description`     | `text` \*                    |                                                            |
| `risk_type`       | enum `risk_type`             | `fisico`\|`quimico`\|`biologico`\|`ergonomico`\|`acidente` |

**`risk_assessments`** (avaliação probabilidade × severidade):

| Coluna        | Tipo                 | Notas                                 |
| ------------- | -------------------- | ------------------------------------- |
| `id`          | `uuid` PK            |                                       |
| `risk_id`     | `uuid` FK→`risks` \* |                                       |
| `probability` | `integer` \*         | `CHECK (probability BETWEEN 1 AND 5)` |
| `severity`    | `integer` \*         | `CHECK (severity BETWEEN 1 AND 5)`    |
| `risk_level`  | `integer` \*         | persistido = `probability * severity` |
| `assessed_at` | `date` \*            |                                       |

> `risk_level` é calculado na aplicação no momento da escrita e persistido — é o
> critério de ordenação/priorização dos dashboards. A regra exata da matriz de
> risco é definida na spec do módulo PGR.

**`control_measures`** (medidas de controle / plano de ação):

| Coluna                    | Tipo                  | Notas                                   |
| ------------------------- | --------------------- | --------------------------------------- |
| `id`                      | `uuid` PK             |                                         |
| `risk_id`                 | `uuid` FK→`risks` \*  |                                         |
| `description`             | `text` \*             |                                         |
| `responsible_employee_id` | `uuid` FK→`employees` | nullable                                |
| `due_date`                | `date`                | nullable                                |
| `status`                  | enum `measure_status` | `pendente`\|`em_andamento`\|`concluida` |

### Treinamentos

**`training_catalog`** — `id` PK · `name` \* · `nr_reference` `text` (ex.:
`NR-35`) · `workload_hours` `integer` · `validity_months` `integer` (0 = sem
validade)

**`training_records`** — registro de treinamento realizado por funcionário:

| Coluna                    | Tipo                            | Notas                                     |
| ------------------------- | ------------------------------- | ----------------------------------------- |
| `id`                      | `uuid` PK                       |                                           |
| `employee_id`             | `uuid` FK→`employees` \*        |                                           |
| `training_id`             | `uuid` FK→`training_catalog` \* |                                           |
| `completed_at`            | `date` \*                       |                                           |
| `expires_at`              | `date`                          | nullable — calculado de `validity_months` |
| `certificate_document_id` | `uuid` FK→`documents`           | nullable                                  |

### Documentos

**`documents`** — repositório de arquivos com validade:

| Coluna                | Tipo                 | Notas                                      |
| --------------------- | -------------------- | ------------------------------------------ |
| `id`                  | `uuid` PK            |                                            |
| `title`               | `text` \*            |                                            |
| `document_type`       | enum `document_type` | tipos de documento de SST                  |
| `storage_path`        | `text` \*            | chave do objeto no Supabase Storage        |
| `valid_from`          | `date`               | nullable                                   |
| `valid_until`         | `date`               | nullable                                   |
| `related_entity_type` | `text`               | nullable — ex.: `employee`, `pgr_document` |
| `related_entity_id`   | `uuid`               | nullable                                   |

> `related_entity_*` é um vínculo polimórfico **leve e sem FK**. Trade-off
> consciente: ganha-se flexibilidade para anexar documentos a qualquer entidade
> sem N tabelas de junção; perde-se a integridade referencial nesse vínculo. É
> aceitável porque o documento é um anexo, não um dado crítico de cadeia. A
> integridade aqui fica a cargo da aplicação.

### Ordens de Serviço

**`service_orders`**:

| Coluna                 | Tipo                        | Notas                                                     |
| ---------------------- | --------------------------- | --------------------------------------------------------- |
| `id`                   | `uuid` PK                   |                                                           |
| `number`               | `integer` \*                | sequencial por organização — `U(organization_id, number)` |
| `title`                | `text` \*                   |                                                           |
| `description`          | `text`                      |                                                           |
| `status`               | enum `service_order_status` | `aberta`\|`em_andamento`\|`concluida`\|`cancelada`        |
| `assigned_employee_id` | `uuid` FK→`employees`       | nullable                                                  |
| `opened_at`            | `date` \*                   |                                                           |
| `due_date`             | `date`                      | nullable                                                  |
| `closed_at`            | `date`                      | nullable                                                  |

**`service_order_items`** — itens/checklist da OS — `id` PK ·
`service_order_id` FK→`service_orders` _ · `description` `text` _ · `done`
`boolean` default `false`

### Acidentes

**`accidents`**:

| Coluna                | Tipo                     | Notas                                          |
| --------------------- | ------------------------ | ---------------------------------------------- |
| `id`                  | `uuid` PK                |                                                |
| `employee_id`         | `uuid` FK→`employees` \* |                                                |
| `occurred_at`         | `timestamptz` \*         |                                                |
| `accident_type`       | enum `accident_type`     | `tipico`\|`trajeto`\|`doenca_ocupacional`      |
| `severity`            | enum `accident_severity` | `leve`\|`moderado`\|`grave`\|`fatal`           |
| `description`         | `text` \*                |                                                |
| `cat_number`          | `text`                   | nullable — Comunicação de Acidente de Trabalho |
| `cat_issued_at`       | `date`                   | nullable                                       |
| `investigation_notes` | `text`                   | nullable                                       |

### Dashboards

**Sem tabelas próprias.** Os dashboards são _read models_ construídos por
queries de agregação (`COUNT`, `GROUP BY`, filtros por data) sobre as tabelas
acima — sempre escopadas por `organization_id`. Ficam em
`features/dashboard/queries.ts`.

### Jobs assíncronos

**`jobs`** — fila leve para operações pesadas (Princípio IV):

| Coluna                | Tipo              | Notas                                            |
| --------------------- | ----------------- | ------------------------------------------------ |
| `id`                  | `uuid` PK         |                                                  |
| `type`                | enum `job_type`   | ex.: `pdf_generation`                            |
| `status`              | enum `job_status` | `pendente`\|`processando`\|`concluido`\|`falhou` |
| `payload`             | `jsonb` \*        | dados de entrada do job                          |
| `result_storage_path` | `text`            | nullable — resultado (ex.: PDF) no Storage       |
| `error`               | `text`            | nullable                                         |
| `attempts`            | `integer` \*      | default `0`                                      |
| `processed_at`        | `timestamptz`     | nullable                                         |

Funcionamento detalhado no doc 04.

## Relacionamentos (visão textual)

```
organizations (Clerk — não é tabela do nosso banco)
  └── tudo abaixo é filtrado por organization_id

sectors ──┐
job_roles ─┴──< employees >──┬──< epi_deliveries >── epi_catalog
                              ├──< training_records >── training_catalog
                              ├──< accidents
                              └──  control_measures.responsible_employee_id

pgr_documents ──< risks ──< risk_assessments
                      └──< control_measures

service_orders ──< service_order_items

documents  (vínculo polimórfico leve: related_entity_type + related_entity_id)
jobs       (independente; payload em jsonb)
user_profiles (referência global, sincronizada do Clerk)
```

## Integridade transacional (ACID)

Operações que tocam mais de uma tabela rodam dentro de `db.transaction()` do
Drizzle — ou commitam tudo, ou nada. Exemplos no domínio:

- **Abrir uma OS com itens**: inserir `service_orders` + N `service_order_items`
  na mesma transação.
- **Registrar uma avaliação de risco**: inserir/atualizar `risk_assessments` e,
  se a regra exigir, atualizar o status do `risks` associado.
- **Concluir um PGR**: mudar `pgr_documents.status` e validar consistência das
  medidas de controle vinculadas.

As constraints do Postgres (FK, CHECK, UNIQUE) garantem integridade mesmo sob
concorrência — a validação na aplicação é a primeira linha, não a única.

## Row Level Security (RLS) — backstop real

A constituição exige RLS habilitado como **defesa em profundidade**. Para que o
RLS seja um backstop _de verdade_ (e não decorativo) com um ORM, a aplicação
**não** se conecta com um papel que ignora RLS.

Padrão adotado:

1. A aplicação conecta ao Postgres com um **papel restrito**, sujeito a RLS
   (não `postgres`, não `service_role`).
2. **RLS habilitado** em toda tabela com `organization_id`.
3. As policies leem a organização ativa de uma **variável de sessão**:

   ```sql
   ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON employees
     USING (organization_id = current_setting('app.current_org', true))
     WITH CHECK (organization_id = current_setting('app.current_org', true));
   ```

4. A aplicação, no início de **cada transação**, fixa o tenant:

   ```sql
   SET LOCAL app.current_org = '<org_id da sessão Clerk>';
   ```

`SET LOCAL` é escopado à transação — compatível com o pooler em _transaction
mode_ usado em serverless. Isso significa que **mesmo que uma query esqueça o
`WHERE organization_id = ...`, o RLS ainda filtra**. O escopo na aplicação
(doc 03) é a primeira barreira; o RLS é a rede de segurança contra bugs.

O wrapper que aplica o `SET LOCAL` automaticamente é descrito no doc 03
(`orgScopedDb`).

> **Exemplo canônico implementado** (fatia 004): a tabela de referência
> permanente `tenant_probe` (`src/shared/db/schema/tenant-probe.ts`) demonstra o
> padrão completo — policy `USING`/`WITH CHECK` com
> `current_setting('app.current_org', true)` `TO app_runtime`, índice e migration
> Drizzle Kit. Todo novo módulo com `organization_id` MUST replicar esse padrão.
> Contrato completo:
> `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md`.

## Conexão e migrations

- **Driver**: `postgres-js` (compatível serverless).
- **Conexão**: pooler do Supabase em _transaction mode_ (porta `6543`) para a
  aplicação na Vercel; conexão direta apenas para rodar migrations.
- **Migrations**: `drizzle-kit generate` cria a migration a partir do schema TS;
  `drizzle-kit migrate` aplica. Arquivos versionados em `lib/db/migrations/` e
  commitados. Nunca alterar o banco manualmente fora de migration.
- **Schema**: definido em `lib/db/schema/`, um arquivo por módulo, re-exportado
  por `lib/db/schema/index.ts`. As policies de RLS entram como SQL nas
  migrations (Drizzle Kit suporta SQL custom na migration).
