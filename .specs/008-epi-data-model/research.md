# Phase 0 — Research: Modelo de dados do módulo de EPIs

Esta fatia tem o contexto técnico totalmente resolvido pela spec + clarificações; não restou
nenhum `NEEDS CLARIFICATION`. Abaixo, as decisões consolidadas (Decision / Rationale /
Alternatives) e o estado "as-built" do que já existe na branch.

## D1 — Reuso de `categories` em vez de `epi_categories`

- **Decision**: Não criar tabela de categorias dedicada de EPIs; usar `categories` (006) e
  apontar `epi_catalog.category_id → categories.id`.
- **Rationale**: `categories` já é a taxonomia `epi`/`machine` (`type`, `name`, `note`,
  `UNIQUE(org_id, type, name)`), com repositório, validação, seed e testes de isolamento. Evita
  duplicação (YAGNI, Princípio II).
- **Alternatives**: tabela `epi_categories` dedicada — rejeitada por redundância sem requisito
  de separar taxonomias por módulo.

## D2 — Consistência de tipo item↔categoria (FR-002a) — **delta desta fatia**

- **Decision**: Garantir no banco que `epi_catalog.type == categories.type` via **FK composta**
  `(category_id, type) → categories(id, type)`, exigindo um `UNIQUE(id, type)` em `categories`.
- **Rationale**: Declarativo, sem trigger; o banco é fonte de verdade (Princípio V). `id` já é
  PK (único), então `UNIQUE(id, type)` é aditivo e seguro; habilita a FK composta. Mantém
  `ON DELETE RESTRICT` (categoria em uso não some).
- **Alternatives**: (a) trigger `BEFORE INSERT/UPDATE` comparando os tipos — mais código e mais
  difícil de testar; (b) validar só na aplicação — rejeitado por violar "banco como fonte de
  verdade"; (c) não enforçar — rejeitado pela clarificação Q1=A.

## D3 — `epi_risk` vinculado ao `ges` (interino)

- **Decision**: `epi_risk` referencia `ges` (`catalog_id × ges_id` + flag `neutralizes`),
  `UNIQUE(org_id, catalog_id, ges_id)`.
- **Rationale**: Não existe tabela `risks` nem vínculo GES↔risco; o `ges` é a entidade portadora
  de risco na cadeia atual. Dívida técnica registrada (migra a FK quando houver modelo de risco).
- **Alternatives**: modelar `risks` agora (aumenta escopo — rejeitado); postergar `epi_risk`
  (rejeitado: relatório de adequação da Fase 2 precisa do vínculo).

## D4 — Saldo de estoque materializado (não derivado)

- **Decision**: `epi_stock.balance` é coluna materializada (default 0), sem trigger nesta fatia;
  a manutenção a partir dos movimentos é da Fase 2. `CHECK (balance >= 0)` e `min_quantity >= 0`.
- **Rationale**: o ePGR exibe saldo direto; materializar simplifica leitura. A automação de
  saldo é responsabilidade da camada de fluxo (#72), fora do escopo de modelagem.
- **Alternatives**: derivar por agregação dos movimentos (como nº de expostos na 006) —
  adequado para contagem, mas saldo é consultado com frequência e tem semântica de entrada/saída.

## D5 — `unit_of_measure` texto livre (FR-001 / clarify Q2=A)

- **Decision**: `text` opcional, sem lista fixa.
- **Rationale**: o ePGR admite muitas unidades; texto livre não trava o cadastro e mantém a
  modelagem simples; um conjunto controlado pode vir depois sem migração dolorosa.
- **Alternatives**: enum no banco — rejeitado por enrijecer cedo demais.

## D6 — `auth_token` único global (FR-008 / clarify Q3=A)

- **Decision**: índice **único parcial** sobre `auth_token` onde `auth_token IS NOT NULL`
  (escopo global, não por tenant). Vários `NULL` coexistem.
- **Rationale**: o token resolve um link/QR público de assinatura sem contexto de tenant; deve
  apontar para exatamente uma entrega no sistema inteiro e evitar colisão entre escritórios. Não
  enfraquece o isolamento — RLS continua barrando leitura cross-tenant.
- **Alternatives**: único por tenant (`org_id, auth_token`) — rejeitado: link público não carrega
  tenant; colisão entre orgs seria possível.

## D7 — Política de `ON DELETE`

- **Decision**: `CASCADE` na cadeia de posse (`epi_catalog → epi_stock → stock_movements`;
  `epi_deliveries → epi_delivery_items`; `employees → epi_deliveries`; `epi_risk` junção);
  `SET NULL` em `stock_movements.delivery_id`; `RESTRICT` em `epi_catalog.category_id →
categories` e `epi_delivery_items.catalog_id → epi_catalog`.
- **Rationale**: cascata remove dependentes sem órfãos; SET NULL preserva o movimento ao excluir
  a entrega; RESTRICT protege taxonomia em uso e histórico de entregas (desvio consciente do
  "CASCADE em tudo" do card original).
- **Alternatives**: CASCADE em tudo — rejeitado por perda silenciosa de histórico/catálogo.

## D8 — Migration drizzle-kit + SQL custom

- **Decision**: `0007_epi_data_model.sql` gerada por `drizzle-kit generate`; `GRANT … TO
app_runtime` e `CREATE TRIGGER set_updated_at_<t>` adicionados à mão (a função `set_updated_at`
  existe desde a 0001), padrão idêntico ao da 0005. Aplicada via conexão direta unpooled (owner).
- **Rationale**: o gerador não emite GRANT/trigger; replicar o padrão consolidado da 0005.
- **Alternatives**: nenhuma — é o padrão do repo.

## As-built (já presente na branch)

| Artefato                                                          | Estado                                     |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `src/shared/db/schema/epis.ts` (6 tabelas + 2 enums)              | ✅ implementado                            |
| Export em `src/shared/db/schema/index.ts`                         | ✅                                         |
| `src/shared/db/migrations/0007_epi_data_model.sql` (+ meta)       | ✅                                         |
| `validation.ts` (3 schemas zod)                                   | ✅                                         |
| Testes unit + constraints + migration-shape + 6 isolamento + seed | ✅                                         |
| **FK composta de consistência de tipo (FR-002a)**                 | ❌ **pendente (delta)**                    |
| `npm run test:integration` executado contra Postgres efêmero      | ⏳ pendente (ambiente sem Docker/Postgres) |

> O `epi_catalog.category_id` hoje é FK simples `→ categories.id`. O delta é torná-la composta
> `(category_id, type) → categories(id, type)` e adicionar `UNIQUE(id, type)` em `categories`,
> com a migration correspondente.
