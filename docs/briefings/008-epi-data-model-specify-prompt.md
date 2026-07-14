# Prompt DETALHADO para `/speckit-specify` — Modelo de dados do módulo de EPIs (008)

> Prompt remontado no **esqueleto do exemplo** (`/speckit-specify` + `GIT_BRANCH_NAME` + `Feature` +
> `CONTEXTO` + `User stories` P1/P2/P3 + `Success criteria` + `Edge cases`), com todo o detalhamento
> da fatia **008-epi-data-model** embutido no bloco `CONTEXTO`. Conteúdo da spec em **pt-BR**; branch e
> commits em **inglês**. Fonte: `.specs/008-epi-data-model/` (spec, data-model, contracts, research).
> Copie do `/speckit-specify` até o fim.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/epi-data-model

Feature: EPI data model (modelo de dados do módulo de EPIs — fundação da Fase 2 / paridade com o ePGR)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). Entrega a FUNDAÇÃO de dados do módulo de EPIs e de Máquinas/Equipamentos:
6 tabelas novas + 2 enums novos, todas isoladas por tenant, ANÁLOGA à fatia 006 (modelagem pura). É a
base sobre a qual as fatias de CRUD (#18), movimentação (#72/010) e entrega com assinatura (#19/011)
serão construídas na Fase 2.
ESCOPO É MODELAGEM PURA: schema (Drizzle) + migration + RLS + testes de isolamento/integridade.
FORA DE ESCOPO: UI, formulários, Server Actions, repositórios de CRUD, fluxo de assinatura (QR/link),
manutenção/automação de saldo, relatórios/histórico, tabela `risks` dedicada e integrações externas
(lookup de CA). Esses entram nas fatias seguintes.
ATENÇÃO — esta fatia EXIGE migration (drizzle-kit `db:generate`, aplicada pela conexão direta unpooled
como owner): cria 6 tabelas, 2 enums e UMA alteração ADITIVA em `categories` (UNIQUE(id, type)).
Migração esperada: 0007_epi_data_model. Não aplicar ao banco real/dev — só gerar o .sql offline.

RECONCILIAÇÃO CARD × REPO (termos genéricos do card que NÃO batem — resolver na spec):
- "features/epis/" NÃO existe -> schema em src/shared/db/schema/ (Drizzle é dono code-first); migration
  em src/shared/db/migrations/; validação zod em src/shared/domains/pgr/validation.ts.
- "organization_id (Clerk)" como escopo -> tenant = orgs.id; RLS app_runtime backstop
  (current_setting('app.current_org', true)) + acesso via withOrg(). NUNCA Clerk org / input do cliente.
- "SQLite em memória" -> integração/RLS contra Postgres EFÊMERO (INTEGRATION_*); NÃO há caminho SQLite.
- "categoria de EPI" -> REUSA a tabela `categories` (006) como taxonomia; NÃO cria tabela dedicada.
- "risco" -> NÃO existe tabela `risks`; epi_risk vincula-se ao `ges` (006) de forma INTERINA (dívida técnica).
- "sectors" do doc antigo -> substituído por `ges` desde a 006.

ANTES DE ESCREVER A SPEC, leia e liste (dizendo o que extraiu de cada):
- src/shared/db/schema/companies.ts (TEMPLATE de tabela tenant: org_id, índice, pgPolicy(...).enableRLS(),
  GRANT, trigger set_updated_at) — replicar o padrão em todas as 6 tabelas.
- src/shared/db/schema/categories.ts (taxonomia epi|machine; enum category_type) — será REUSADA + ganha UNIQUE(id, type).
- src/shared/db/schema/* das entidades da 006 (employees, ges) referenciadas por FK.
- src/shared/db/with-org.ts (transação + set_config app.current_org) e src/shared/db/index.ts (conexão app_runtime pooler).
- migrations existentes (0001/0003/0005) — padrão de GRANT + triggers set_updated_at como SQL custom dentro da migration.
- src/shared/domains/pgr/validation.ts (onde entram stockMovementTypeSchema, epiSignatureStatusSchema, epiQuantitySchema).
- src/__tests__/integration/_helpers/{db,pgr-seed}.ts (applyMigrations split em "--> statement-breakpoint"; seed org_a/org_b).
- .specify/memory/constitution.md (Princípio I: isolamento multi-tenant não-negociável) e CLAUDE.md.

MODELO (6 tabelas novas + 2 enums + 1 alteração aditiva). Convenções herdadas em TODA tabela: PK uuid
defaultRandom; org_id text NOT NULL -> orgs.id ON DELETE CASCADE, indexado idx_<t>_org_id; created_at/
updated_at timestamptz NOT NULL DEFAULT now() + trigger set_updated_at_<t>; RLS habilitado + policy
<t>_isolation (app_runtime, org_id = current_setting('app.current_org', true) em USING e WITH CHECK);
GRANT SELECT,INSERT,UPDATE,DELETE TO app_runtime.

Enums novos:
- stock_movement_type = (purchase, employee_delivery, adjustment, discard).
- epi_signature_status = (pending, signed_qr, signed_link, signed_manual).
Enum reusado: category_type (epi, machine).

Alteração ADITIVA em categories (006) — habilita FR-002a:
- novo UNIQUE(id, type) -> uq_categories_id_type (id já é PK, então é seguro/sem mudança de dados);
  necessário para a FK COMPOSTA de epi_catalog garantir que tipo do item == tipo da categoria.

1) epi_catalog (raiz da cadeia): type category_type NOT NULL; category_id uuid NOT NULL indexado;
   FK COMPOSTA (category_id, type) -> categories(id, type) ON DELETE RESTRICT (FR-002a: o banco impede
   item epi em categoria machine); name NOT NULL; ca, ca_valid_until (date), manufacturer, norm, size,
   unit_of_measure (TEXTO LIVRE opcional), description, photo_path — todos nullable (campos condicionais).
2) epi_stock: catalog_id -> epi_catalog ON DELETE CASCADE indexado; balance integer NOT NULL DEFAULT 0
   CHECK >= 0 (saldo MATERIALIZADO); min_quantity integer NOT NULL DEFAULT 0 CHECK >= 0;
   UNIQUE(org_id, catalog_id) (um estoque por item por tenant).
3) stock_movements: stock_id -> epi_stock ON DELETE CASCADE indexado; delivery_id NULLABLE -> epi_deliveries
   ON DELETE SET NULL indexado (o movimento SOBREVIVE à exclusão da entrega); type stock_movement_type NOT NULL;
   quantity integer NOT NULL CHECK > 0 (SEMPRE positivo; sentido entrada/saída é DERIVADO do tipo, não armazenado);
   movement_date date NOT NULL DEFAULT now(); invoice_number nullable.
4) epi_deliveries: employee_id -> employees ON DELETE CASCADE indexado; delivery_date date NOT NULL DEFAULT now();
   signature_status epi_signature_status NOT NULL DEFAULT pending; auth_token nullable, ÚNICO GLOBAL via índice
   PARCIAL WHERE auth_token IS NOT NULL (FR-008: resolve link público de assinatura sem contexto de tenant;
   várias entregas SEM token coexistem).
5) epi_delivery_items: delivery_id -> epi_deliveries ON DELETE CASCADE indexado; catalog_id -> epi_catalog
   ON DELETE RESTRICT indexado (preserva histórico de entrega — bloqueia excluir item do catálogo entregue);
   quantity integer NOT NULL CHECK > 0.
6) epi_risk (interino): catalog_id -> epi_catalog ON DELETE CASCADE indexado; ges_id -> ges ON DELETE CASCADE
   indexado (vínculo INTERINO ao GES enquanto não há tabela risks); neutralizes boolean NOT NULL DEFAULT false;
   UNIQUE(org_id, catalog_id, ges_id) (não duplica par item×GES no tenant).

Validação zod (src/shared/domains/pgr/validation.ts), espelhando os CHECKs do banco:
- stockMovementTypeSchema = enum(purchase, employee_delivery, adjustment, discard).
- epiSignatureStatusSchema = enum(pending, signed_qr, signed_link, signed_manual).
- epiQuantitySchema = inteiro positivo (espelha CHECK quantity > 0).

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Tenant = orgs.id, sempre da sessão; a empresa-cliente é DIMENSÃO de dados dentro do tenant, nunca
  fronteira de isolamento. NUNCA Clerk org / organization_id / input do cliente.
- DOIS níveis de isolamento: (1) app — todo acesso via withOrg() (set_config app.current_org); (2) banco —
  RLS app_runtime em TODAS as 6 tabelas (backstop: query sem withOrg retorna vazio, não vaza).
- O BANCO é a fonte de verdade das regras (FKs, NOT NULL, UNIQUE, CHECK de quantidade/saldo, conjuntos de
  estados via enum), complementado — não substituído — pela validação na aplicação.
- Saldo (balance) é apenas valor + CHECK >= 0 nesta fatia; sua automação a partir de movimentos é da Fase 2.

ESTADOS / TRANSIÇÕES:
- signature_status inicia pending; transições (-> signed_qr|signed_link|signed_manual) são da Fase 2 (fluxo
  de assinatura), FORA desta fatia. Aqui só o enum + default.
- balance alterado pelos movimentos na Fase 2; aqui só o valor + CHECK >= 0.

DECISÕES TRAVADAS (clarificadas): banco impede item de tipo diferente da categoria (FK composta);
unit_of_measure é TEXTO LIVRE opcional (sem lista fixa); auth_token único GLOBAL (não por tenant);
reuso de categories (sem taxonomia dedicada); epi_risk -> ges interino (dívida técnica registrada);
enums em inglês; photo_path só guarda referência (upload é futuro).
FORA DE ESCOPO: UI/formulários, Server Actions, repositórios de CRUD, fluxo de assinatura/geração de token,
manutenção/automação de saldo, relatórios/histórico, obrigatoriedade condicional de campos por tipo
(fica na aplicação na Fase 2), tabela risks dedicada, integrações externas (lookup de CA).

TESTES (quality gate; Postgres EFÊMERO via INTEGRATION_*, NUNCA SQLite nem banco de dev):
- unit: schemas zod (stockMovementTypeSchema, epiSignatureStatusSchema, epiQuantitySchema rejeitando <= 0).
- integração/RLS/integridade nas 6 tabelas: dois tenants (org_a/org_b) — leitura sem filtro só traz tenant
  ativo; escrita cross-tenant rejeitada; referência cruzada por id de outra org não traz dado; quantidade <= 0
  rejeitada; saldo/min negativos rejeitados; valor fora do enum rejeitado; item epi em categoria machine
  rejeitado (FK composta); RESTRICT bloqueia excluir categoria/item em uso; CASCADE remove estoque/movimentos
  e itens de entrega; SET NULL preserva movimento ao excluir entrega; auth_token único global / múltiplos NULL
  coexistem. migration-shape (split em --> statement-breakpoint). npm run test, npm run test:integration,
  lint e tsc --noEmit verdes.

User stories (P1 = mais crítica):
- (P1) Isolamento por tenant em TODO o domínio de EPIs: um escritório só vê/altera seus próprios itens,
  estoque, movimentos, entregas, itens de entrega e vínculos de risco — nada de outro tenant aparece, vaza
  ou pode ser alterado, mesmo referenciando ids de outra organização. Cobre as 6 tabelas.
- (P1) Catálogo de EPIs/Máquinas com TODOS os campos do ePGR (tipo, categoria, CA, validade do CA, fabricante,
  norma, tamanho, unidade de medida, descrição, foto) persistido e recuperado fielmente; item "máquina"
  aceito sem CA/norma/validade (campos condicionais vazios). É a raiz da cadeia (estoque/movimentos/itens/risco dependem dele).
- (P2) Estoque (saldo + mínimo), movimentos TIPADOS (compra/entrega/ajuste/descarte, quantidade positiva, data)
  e entregas com status de assinatura (pending/QR/link/manual) — camada de operação, depende do catálogo.
- (P3) Vínculo EPI × risco do GES (interino) com flag de neutralização, sem duplicar o par item×GES no tenant —
  enriquecimento para relatório de adequação; não bloqueia catálogo/estoque/entregas.

Success criteria (mensuráveis, tecnologia-agnósticos):
- As 6 tabelas (catálogo, estoque, movimentos, entregas, itens de entrega, vínculo de risco) existem após a
  migration, e NENHUMA tabela de categorias de EPI dedicada é criada (taxonomia reusada).
- Em 100% das 6 tabelas, nenhum dado de um escritório aparece para outro e TODA escrita cross-tenant é rejeitada
  (verificado com dois tenants).
- O catálogo armazena e recupera fielmente todos os campos do ePGR, incluindo itens "máquina" com campos condicionais vazios.
- 100% das tentativas de gravar quantidade <= 0 e de deixar saldo/mínimo negativos são rejeitadas.
- Um auth_token preenchido NUNCA se repete em todo o sistema; múltiplas entregas sem token coexistem.
- As regras de exclusão se comportam conforme especificado em 100% dos casos (categoria/item em uso bloqueiam;
  cadeia de posse remove junto; movimento sobrevive à exclusão da entrega).
- As suítes (unit + integração de isolamento em Postgres efêmero), lint e tipos passam.

Edge cases:
- Excluir categoria EM USO por um item -> bloqueado (RESTRICT; preserva taxonomia em uso).
- Excluir item de catálogo COM entregas registradas -> bloqueado (RESTRICT; preserva histórico).
- Excluir item de catálogo SEM entregas -> estoque e movimentos vão junto (CASCADE — cadeia de posse).
- Excluir entrega que originou um movimento -> movimento PERMANECE, sem o vínculo (delivery_id SET NULL).
- Excluir funcionário -> suas entregas vão junto (CASCADE).
- Duas entregas sem token ao mesmo tempo -> coexistem; token preenchido nunca se repete (índice parcial único global).
- Item "máquina" sem CA/validade/norma -> aceito (campos condicionais opcionais no banco).
- Gravar valor fora do conjunto de movement_type ou signature_status -> rejeitado (enum).
- Gravar quantidade <= 0 em movimento ou item de entrega -> rejeitado (CHECK > 0).
- Associar item a categoria de TIPO diferente (epi em machine) -> rejeitado pelo banco (FK composta).

Conteúdo da spec em pt-BR; branch e commits em inglês. NÃO invente solução técnica não descrita aqui —
descreva o "o quê" e o "porquê". A migration é necessária (6 tabelas + 2 enums + UNIQUE(id,type) em
categories); marque claramente quaisquer DECISÕES A CLARIFICAR para o /speckit-clarify.
```
