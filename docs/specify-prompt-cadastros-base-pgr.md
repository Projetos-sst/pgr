/speckit-specify

GIT_BRANCH_NAME: feature/cadastros-base-pgr

Feature: Cadastros base do PGR — fundação de dados da cadeia Empresa → Unidade de Obra →
GES → Função → Funcionário. Modela e migra as 7 tabelas base (estendendo `companies`,
criando `work_units`, `ges`, `job_roles`, `categories`, `employees` e a junção
`ges_job_roles`), com isolamento multi-tenant por RLS, constraints de integridade
(FK, UNIQUE, CHECK, enums) e o nº de trabalhadores expostos por GES derivado da
associação Função↔GES. Esta é a PRIMEIRA fatia de dados de domínio e fixa o precedente
de nomes e padrões para todo o PGR.

ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec):
- docs/briefing-cadastros-base-pgr.md
Ele contém as decisões travadas no brainstorming, as divergências entre a issue original
e o estado real do repo, o mapa de nomes (inglês), a reconciliação com o doc 02, o
modelo de colunas MVP por tabela, as regras de RLS/integridade e o escopo in/out. A spec
NÃO pode reintroduzir as premissas erradas da issue original (tenant = org do Clerk,
tabelas em PT, criar `empresas` nova) — todas já corrigidas pela fatia 005.

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (inspirado no
ePGR). Antes de escrever a spec, leia os padrões já vigentes no repo e LISTE os arquivos
que vai ler. No mínimo:
- `.specs/005-modelo-tenant-gate-pro/` (spec, data-model, contracts) — o Modelo B de
  tenant que esta fatia OBRIGATORIAMENTE segue.
- `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md` — o motor de
  isolamento (`withOrg` + `set_config`) e o padrão de RLS.
- `src/shared/db/schema/companies.ts` e `src/shared/db/schema/tenant-probe.ts` — padrão
  canônico de tabela com `org_id` + RLS `app_runtime`.
- `src/shared/db/migrations/0004_modelo_tenant_gate_pro.sql` — referência de migration
  com enum/policy/GRANT custom.
- `docs/architecture/02-modelagem-de-dados.md` — convenções de modelagem (esta fatia
  SUPERA o esboço de `sectors` desse doc; ver briefing §4).

Esta fatia é puramente de FUNDAÇÃO DE DADOS. NÃO inclui UI/formulários, lookup de CNPJ,
ViaCEP, upload de logo/foto, tabela de referência de CBO, nem vínculo com treinamentos
(ver "Fora de escopo").

═══════════════════════════════════════════════════════════════════════════════════════
REGRA DE NEGÓCIO ATUAL — JÁ IMPLEMENTADA NA FATIA 005 (fundação que esta fatia herda)
═══════════════════════════════════════════════════════════════════════════════════════
A spec deve tratar o seguinte como CONTRATO VIGENTE e NÃO o reabrir:

1. MODELO B DE TENANT. O tenant é o **escritório** (nosso `orgs.id`), NÃO a organização
   do Clerk. Toda tabela de dados de negócio é uma **dimensão dentro do tenant** e MUST
   carregar `org_id text NOT NULL → orgs.id` (indexado). A empresa-cliente (`companies`)
   já é modelada assim — não é fronteira de isolamento.

2. ORIGEM DO TENANT ATIVO. O tenant ativo vem de `requireTenantContext()` (resolvido das
   nossas `org_memberships` pelo `userId` da sessão), NUNCA de input do cliente nem de
   `session.orgId`. Toda leitura/escrita de cadastro MUST ser escopada pelo tenant ativo.

3. MOTOR DE ISOLAMENTO (herdado da 004, intacto). `withOrg` fixa o tenant por transação
   via `set_config('app.current_org', …)`. As policies de RLS leem
   `current_setting('app.current_org', true)`, no papel restrito `app_runtime` (a app
   NÃO conecta como owner). RLS é **backstop** (defesa em profundidade), nunca a única
   barreira. Toda tabela nova MUST replicar o padrão `tenant_probe`/`companies`:
     ENABLE ROW LEVEL SECURITY; POLICY "<t>_isolation" FOR ALL TO app_runtime
     USING/WITH CHECK (org_id = current_setting('app.current_org', true));
     GRANT SELECT,INSERT,UPDATE,DELETE ON public.<t> TO app_runtime;

4. PLANO É DO TENANT. `orgs.plan` `free|pro` (NOT NULL DEFAULT 'free' CHECK) já existe; é
   propriedade do tenant (Inv-1), sem enforcement nesta fatia. Esta fatia NÃO toca o
   plano nem o gate.

5. EMPRESA-CLIENTE = `companies` JÁ EXISTE. Colunas atuais: `id`, `org_id`, `cnpj`,
   `razao_social`, `created_at`; com RLS e `uq_companies_org_id_cnpj`. "Empresas" da
   issue = **ALTER em `companies`**, jamais uma tabela nova. O mesmo CNPJ pode existir
   como empresas distintas em tenants distintos — CNPJ **não** é único global (FR-018 da
   005). Esta unicidade-por-tenant MUST ser preservada e replicada onde fizer sentido.

6. PAPÉIS EM INGLÊS. `org_memberships.role` persiste `owner | collaborator | client`;
   `scoped_company_id` (FK→`companies`) já existe para o futuro papel `client`. Esta
   fatia não cria papéis nem vínculos.

7. AUDITORIA E VALIDAÇÃO (transversais, padrão 004/005). Eventos de fronteira de tenant
   geram log com correlação (`requestId`, `orgId`, `userId`, operação) e SEM PII/segredos
   (`logTenantEvent`). Toda Server Action/Route Handler valida entrada por schema (zod)
   antes da regra de negócio.

INVARIANTES que esta fatia MUST honrar (da 005):
- Inv-1 — escopo/permissão sempre pelo **tenant ativo**, nunca atributo global do usuário.
- O backstop de RLS é real: consulta sem filtro só vê o tenant ativo; sem tenant ativo →
  vazio (nunca tudo); escrita cross-tenant é rejeitada pelo banco.

═══════════════════════════════════════════════════════════════════════════════════════
DECISÃO DE MODELO desta fatia (registrar como regra — o "o quê", não a solução técnica)
═══════════════════════════════════════════════════════════════════════════════════════
- A cadeia de dados é: **Empresa (`companies`) → Unidade de Obra (`work_units`) → GES
  (`ges`) → Função (`job_roles`) / Funcionário (`employees`)**, com a junção
  **`ges_job_roles`** (GES↔Função + nº de trabalhadores) e o catálogo **`categories`**
  (EPI | Máquinas).
- `ges` SUBSTITUI o conceito `sectors` do doc 02 (Grupo de Exposição Similar é o
  agrupamento de exposição correto). `employees` vincula `ges_id` + `job_role_id`.
- O **nº de trabalhadores expostos por GES** é um valor DERIVADO da soma de
  `worker_count` em `ges_job_roles` (agrupado por `ges_id`). Recomendação: calcular por
  agregação na leitura (fonte única, sem denormalização nem trigger). Sem tenant/sem
  associações → 0, nunca nulo nem erro.
- Identificadores de código em inglês; termos fiscais/SST intraduzíveis em PT (`cnpj`,
  `razao_social`, `nome_fantasia`, `cnae`, `ges`, `cbo`).
- Grau de Risco NR-04 é `smallint CHECK (1..4)` (grau numérico), não enum.

═══════════════════════════════════════════════════════════════════════════════════════
EDGE CASES que a spec MUST cobrir como regra verificável
═══════════════════════════════════════════════════════════════════════════════════════
Isolamento (herdado, por TABELA nova):
- Dados do escritório A nunca aparecem para B — mesmo numa consulta SEM filtro de tenant
  (backstop RLS), em cada uma das 6 tabelas novas + `companies`.
- Sem tenant ativo fixado na transação → 0 linhas de negócio (nunca tudo).
- Escrita marcada para outro tenant é rejeitada pelo banco (`WITH CHECK`).
- Valor de tenant ativo inválido/inexistente → conjunto vazio.
- Fixação do tenant escopada à transação — fora dela o valor não vaza no pool.

Integridade e unicidade:
- `UNIQUE(org_id, cpf)` em `employees`: mesmo CPF em orgs distintas é permitido; CPF
  duplicado na mesma org é bloqueado.
- CNPJ não é único global (consistente com `companies`/FR-018 da 005).
- FK inválida em qualquer elo da cadeia é rejeitada; `ON DELETE` previsível dentro do
  tenant (definir cascade vs restrict por entidade — ex.: apagar `companies` afeta seus
  `work_units`/`ges`/`employees`).
- Enums fechados: `category_type` (epi|machine), `employee_sex`, `marital_status`,
  `employee_status` — valor fora do conjunto é rejeitado. `risk_grade` fora de 1..4 é
  rejeitado. `worker_count` ≤ 0 em `ges_job_roles` é rejeitado.

Derivação do nº de expostos:
- GES sem nenhuma associação em `ges_job_roles` → nº de expostos = 0.
- Adicionar/remover/alterar `worker_count` numa associação reflete imediatamente no nº de
  expostos do GES (fonte única; sem drift).

═══════════════════════════════════════════════════════════════════════════════════════
ESCOPO
═══════════════════════════════════════════════════════════════════════════════════════
DENTRO:
- Schemas Drizzle das 7 entidades (1 arquivo por tabela em `src/shared/db/schema/`,
  re-exportados pelo index).
- `ALTER` em `companies` (novas colunas do briefing §5.1) + `CREATE` das 6 novas tabelas.
- Migration `0005_*` (Drizzle Kit) com enums, RLS, policies, GRANTs e triggers
  `set_updated_at` (padrão migration 0001), aplicada sem erro.
- Repositórios escopados por `org_id`, incluindo a query de agregação do nº de expostos.
- Testes unitários (regra/validação/agregação) + integração de RLS contra Postgres
  efêmero (`INTEGRATION_*`, NUNCA SQLite). `npm run test`, `npm run test:integration`,
  lint e checagem de tipos verdes.

FORA (fatias futuras / YAGNI — registrar como Out of Scope):
- UI/formulários das 7 entidades; lookup de CNPJ; ViaCEP; upload de logo/foto 3x4 (só os
  campos `*_path` entram agora).
- Tabela de referência de CBO (CBO é campo texto em `job_roles`).
- Vínculo `job_roles` ↔ `training_catalog` (módulo Treinamentos — catálogo ainda não
  existe).
- Contatos de emergência, CNH, passaporte em `employees` (deferidos — confirmar na spec).
- Enforcement de plano/gate; vínculo `employees` ↔ `risks` (módulo PGR).

Decisões em aberto a resolver via Clarifications (ver briefing §10):
1. Nomes `work_units` e `ges_job_roles`.
2. Nº de expostos: agregação na leitura (recomendado) vs coluna recalculada na action.
3. `razao_social` passa a `NOT NULL`?
4. `ON DELETE` (cascade vs restrict) por FK.
5. `U(org_id, company_id, title)` em `job_roles`.

DEFINIÇÃO DE PRONTO: a fatia NÃO conclui sem os testes acima verdes (incluindo o caminho
crítico de isolamento multi-tenant em Postgres efêmero) + lint + tipos. Casos críticos
multi-tenant são escritos/validados à mão, conforme CLAUDE.md e a constituição.
