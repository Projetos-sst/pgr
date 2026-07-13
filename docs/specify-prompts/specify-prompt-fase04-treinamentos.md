/speckit-specify

GIT_BRANCH_NAME: feature/training-module

NOTA DE BRANCH: spec NOVA (`.specs/NNN-training-module/`) numa **branch NOVA e LIMPA a partir do
`develop` atual** (última migration = `0014_epi_risk_link`; a desta leva é a **`0015`**). Não há
branch anterior de treinamentos — implementar do zero sobre `develop`, reaproveitando os PADRÕES já
mergeados (companies/EPI), nunca copiando código de fatias antigas de outros módulos.

Feature: **Módulo de Treinamentos — Fase 04 completa.** Numa única leva, fechar todas as issues de
treinamentos (label `Fase 04 — Treinamentos`): modelo de dados (#28), CRUD de catálogo (#29), registro
de realização por funcionário (#30), controle de vencimento/reciclagem (#31) e treinamentos
obrigatórios por função com conformidade (#80). **Toda a leva é "zero migration", EXCETO o modelo, que
traz 1 migration `0015`.**

⚠️ AS ISSUES #28/#30/#31/#80 ESTÃO DESATUALIZADAS (pré-Modelo B). Ignore delas: `organization_id`
(Clerk), pasta `features/treinamentos/`, "SQLite em memória", FK para tabela `documents`. Vale o padrão
vigente: `org_id → orgs.id` + `withOrg` + RLS `pgPolicy`; camadas `actions → domains → repositories`;
testes em **Postgres efêmero**; **não existe tabela `documents`**. A issue #29 já está no padrão novo.

═══════════════════════════════════════════════════════════════════════════════════════
ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec)
═══════════════════════════════════════════════════════════════════════════════════════

- docs/briefings/fase04-treinamentos-brainstorming.md
  **Âncora desta leva.** Escopo real, as DECISÕES TRAVADAS D1–D7, o fatiamento (Fundação + US1–US4), o
  mapa de reuso e os riscos. PREVALECE onde houver divergência com qualquer issue ou outro doc.
- docs/briefings/028-modelo-treinamentos.md — Fundação: modelo `0015` + funções puras D1/D2.
- docs/briefings/029-crud-catalogo-treinamentos.md — US1 (CRUD do catálogo).
- docs/briefings/030-registro-treinamento.md — US2 (registro de realização; usa D1).
- docs/briefings/031-controle-vencimento-treinamentos.md — US3 (vencimento; consome D2 + helper D5).
- docs/briefings/080-treinamentos-obrigatorios-funcao.md — US4 (obrigatórios por função + conformidade).

═══════════════════════════════════════════════════════════════════════════════════════
CONTEXTO (leia os padrões vigentes e LISTE os arquivos que vai ler antes de começar)
═══════════════════════════════════════════════════════════════════════════════════════

- src/shared/db/schema/companies.ts — **template de tabela multi-tenant**: `org_id text NOT NULL →
orgs.id`, `pgPolicy(...).enableRLS()` (`org_id = current_setting('app.current_org', true)` p/
  `app_runtime`), GRANT + trigger `set_updated_at` como SQL custom na migration. As 3 tabelas novas
  replicam este molde.
- src/shared/db/schema/epis.ts + migration 0007 — fatia 008: **modelo análogo** (várias tabelas +
  enums tenant-isolados numa migration). Referência de forma para o `0015`.
- src/shared/db/schema/{employees.ts,job-roles.ts,ges-job-roles.ts} — FKs base já existentes
  (`employees.id`, `job_roles.id`, `employees.job_role_id` nullable). Não alterar.
- src/shared/db/with-org.ts — motor de tenant. TODA leitura/escrita passa por `withOrg`; `org_id` vem
  SEMPRE da sessão (`requireTenantContext()`), NUNCA do cliente. RLS `app_runtime` é backstop.
- src/shared/server/{result.ts,office-action.ts,action-error.ts} e src/shared/api/rest.ts — contrato
  `ActionResult<T>`, wrapper `officeAction`, `restHandler`, mapeamento erro→HTTP. Usar os códigos
  EXISTENTES (`VALIDATION`/422, `DUPLICATE`/409, `NOT_FOUND`/404, `FK_NOT_FOUND`/422, `FORBIDDEN`/403).
  **Nenhum código de erro novo nesta fase.**
- src/shared/db/repositories/audited-write.ts — `auditedTenantWrite` p/ toda escrita (create/update/
  delete), com `logTenantEvent` (correlação, sem PII).
- src/shared/pagination.ts — `{rows,total}` na listagem.
- src/shared/server/actions/pgr/companies.ts + src/app/api/v1/companies/** — **CRUD de referência para
  a US1\*\* (copiar 1:1 a estrutura: Server Action + REST mirror + `[id]/dependents`).
- src/shared/domains/pgr/stock-movements.ts — `computeRunningBalance` (exemplo de window function pura
  no repo); molde para o helper D5 ("último registro por funcionário+treinamento").
- src/app/(protected)/\_ui/{list,form}.tsx e as páginas de epi-catalog/epi-stock — molde de UI CRUD.
- src/app/(protected)/employees/[id]/ — ponto de entrada natural do registro (US2), do controle
  (US3) e da aba de obrigatórios (US4).
- docs/api/api-design.md e docs/api/sst-manager.postman_collection.json — registrar TODOS os recursos
  novos (obrigatório pelo checklist de API surface do CLAUDE.md).
- .specify/memory/constitution.md — princípios (I: isolamento; V: testes) que a spec deve honrar.

═══════════════════════════════════════════════════════════════════════════════════════
DECISÕES TRAVADAS (KISS / DRY / YAGNI — não reabrir; detalhe nos briefings)
═══════════════════════════════════════════════════════════════════════════════════════

- **D1 · `computeValidUntil(completedAt, periodicity)`** — função pura em `domains/pgr/trainings.ts`,
  ÚNICA fonte do cálculo de validade: `annual/biennial/triennial/quinquennial = +1/+2/+3/+5 anos`;
  `single → null`. Calculada na APLICAÇÃO no momento da escrita (sem trigger/cron). Consumida por US2.
- **D2 · `classifyTrainingStatus(latest, {today, dueWindowDays})`** — função pura no MESMO módulo,
  ÚNICA fonte do status: `missing | expired | due_soon | ok`. Sem registro → `missing`; `valid_until
null` (single) com registro → `ok`; `< hoje` → `expired`; `<= hoje+janela` → `due_soon`; senão `ok`.
  Date-only, fuso America/Sao_Paulo, inclusiva. **US3 e US4 consomem a MESMA função** — não reimplementar.
- **D3 · Enum `training_periodicity`** = `annual|biennial|triennial|quinquennial|single` (inglês).
  Rótulos PT só na UI.
- **D4 · Certificado = `training_records.certificate_path text` nullable** — **NÃO** criar tabela
  `documents`/GED/upload (1 consumidor, YAGNI; espelha os `*_path` da fatia 006). Vira FK no futuro.
- **D5 · Helper "último registro por (funcionário, treinamento)"** — `ROW_NUMBER() OVER (PARTITION BY
employee_id, training_id ORDER BY completed_at DESC)`, `rn=1`. Compartilhado por US3 e US4.
- **D6 · `valid_until` é COLUNA persistida** (não derivada na leitura): depende do estado do catálogo
  no momento da realização; mudar a periodicidade depois NÃO move realizações passadas.
- **D7 · Sem notificação/cron** nesta fase: US3 só expõe uma query de resumo `{expired, dueSoon}` para
  o dashboard da Fase 7. Central de notificações fica fora.
- **Isolamento** SEMPRE `withOrg` + tenant da sessão; RLS backstop. Escrita via `auditedTenantWrite`.
- **Testes de integração** contra **Postgres efêmero** (`INTEGRATION_*`), **NUNCA SQLite** nem o banco
  de dev. Isolamento multi-tenant é caminho crítico obrigatório em toda US com escrita.

═══════════════════════════════════════════════════════════════════════════════════════
FUNDAÇÃO + USER STORIES (priorizadas, independentemente testáveis; ordem = implementação)
═══════════════════════════════════════════════════════════════════════════════════════

FUNDAÇÃO (#28) — **Migration `0015`.** 3 tabelas tenant-isoladas (`training_catalog`,
`training_records`, `job_role_required_trainings`) + enum `training_periodicity` + as funções puras
D1/D2 já testadas. Sem UI. ON DELETE: employee/job_role → CASCADE; `training_id` → RESTRICT (catálogo em
uso não some). UNIQUE `(org_id,name)` e `(org_id,job_role_id,training_id)`. CHECK `workload_hours > 0`.
Ver briefing 028.

US1 (P1) — CRUD do Catálogo de Treinamentos (#29). Zero migration. list (paginada + busca por
nome/norma) · getById · create · update · delete (com `dependents`). 5 campos ePGR (Nome · Norma Ref. ·
Carga Horária · Periodicidade · Descrição). Ver briefing 029.

US2 (P1) — Registro de treinamento realizado (#30). Zero migration. Form (funcionário + treinamento +
`completed_at` + certificado opcional); `valid_until` recalculado no SERVIDOR via D1; `single→null`;
`completed_at > hoje` bloqueado; escrita simples auditada (sem transação de saldo). Ver briefing 030.

US3 (P1) — Controle de vencimento/reciclagem (#31). Zero migration. Leitura (Server Component) usando
helper D5 + `classifyTrainingStatus` (D2); filtros por funcionário e janela (30/60/90);`single` fora do
cômputo; status visual; query de resumo `{expired,dueSoon}` para o dashboard. Ver briefing 031.

US4 (P2) — Obrigatórios por função + conformidade (#80). Zero migration. CRUD magro de
`job_role_required_trainings` (add idempotente/remove/list) + query de conformidade por funcionário
(reusa D5 + D2, `missing` quando não há registro); aba "Treinamentos Obrigatórios" no perfil +
relatório de não-conformes (mesma query sem filtro). Ver briefing 080.

═══════════════════════════════════════════════════════════════════════════════════════
SUPERFÍCIE DE API — OBRIGATÓRIA (os 4 juntos por recurso: Server Action + REST + api-design.md + Postman)
═══════════════════════════════════════════════════════════════════════════════════════

- `training-catalog` (US1): `GET/POST /api/v1/training-catalog` · `GET/PUT/DELETE
/api/v1/training-catalog/[id]` · `GET /api/v1/training-catalog/[id]/dependents`.
- `training-records` (US2): `GET/POST /api/v1/training-records` · `GET/DELETE
/api/v1/training-records/[id]`.
- `job-role-required-trainings` (US4): `GET/POST /api/v1/job-role-required-trainings` · `DELETE
/api/v1/job-role-required-trainings/[id]`.
- `201` no create, `204` no delete; reusar o MESMO repository/zod/`toActionError` entre Server Action e
  REST — nunca reimplementar a regra. Leituras de conformidade/vencimento podem ser queries de Server
  Component; registrar em api-design/Postman as que tiverem valor de API.

═══════════════════════════════════════════════════════════════════════════════════════
EDGE CASES que a spec MUST cobrir como regra verificável
═══════════════════════════════════════════════════════════════════════════════════════

Modelo / catálogo:

- `workload_hours` zero/negativo/não inteiro → `VALIDATION`. `periodicity` fora do enum → `VALIDATION`.
- Nome de catálogo duplicado no mesmo escritório → `DUPLICATE` (409).
- Excluir item do catálogo COM realizações ou vínculos → bloqueio/aviso via `dependents` (RESTRICT),
  nunca deixa órfão.
- getById/update/delete de catálogo de outro escritório → `NOT_FOUND` (404).

Registro (US2):

- `single` → `valid_until = null` (não expira). `annual/biennial/triennial/quinquennial` → data + N anos.
- `completed_at` no futuro → `VALIDATION`. Certificado ausente é válido (opcional).
- Funcionário/treinamento de outro tenant → erro (RLS + `FK_NOT_FOUND`), nada gravado.

Vencimento (US3):

- Nenhum vencido → estado vazio positivo. `single` (`valid_until null`) NUNCA aparece como vencido.
- Reciclagem: só o ÚLTIMO registro conta (D5) — realização antiga não deixa o status "vencido".
- Fronteiras de janela: hoje (expira hoje = ainda não vencido? definir inclusivo), hoje+30, hoje+90.
- Funcionário com múltiplos treinamentos vencidos ao mesmo tempo.

Obrigatórios / conformidade (US4):

- Função sem treinamentos obrigatórios → aba vazia, não erro.
- Funcionário sem função (`job_role_id` null) → sem obrigatórios → conforme por vacuidade.
- Treinamento `single` obrigatório → realizado 1×, sempre `ok`.
- Mesmo treinamento obrigatório em várias funções.
- Sem registro do obrigatório → `missing` (Ausente) → não-conforme.

Isolamento (todas as US com escrita):

- `app_runtime` só enxerga o próprio tenant; query sem `withOrg` → 0 linhas (RLS backstop).
- Papel `client` (sem office) → `FORBIDDEN` em toda ação de escrita.

═══════════════════════════════════════════════════════════════════════════════════════
MIGRATION 0015 (única da leva — Fundação)
═══════════════════════════════════════════════════════════════════════════════════════

drizzle-kit + SQL custom (padrão `0005`/`0007`): CREATE do enum `training_periodicity`; CREATE das 3
tabelas com `org_id`, timestamps, FKs (ON DELETE conforme acima), CHECK `workload_hours > 0`, UNIQUEs;
GRANT ao `app_runtime`; trigger `set_updated_at`; `pgPolicy` de isolamento por tabela. Aplicada via
conexão direta unpooled (owner). `ADD VALUE` de enum não ocorre aqui (enum novo).

═══════════════════════════════════════════════════════════════════════════════════════
TESTES (constituição — obrigatório; a fatia não fecha sem eles)
═══════════════════════════════════════════════════════════════════════════════════════

- Unit: `computeValidUntil` (5 periodicidades + `single→null`); `classifyTrainingStatus`
  (`missing/expired/due_soon/ok` + `single`=ok + fronteiras de janela); zod do catálogo e do registro
  (obrigatórios, carga horária > 0, `completed_at` não-futuro).
- Integração (Postgres efêmero `INTEGRATION_*`): CRUD do catálogo (5 operações) + 404 cross-tenant +
  409 nome duplicado + `dependents` bloqueia exclusão em uso; registro grava `valid_until` correto e
  `single→null` e barra funcionário/treinamento cross-tenant; controle de vencimento lista/resume por
  status e exclui `single` e respeita último-registro; add/remove de vínculo obrigatório + conformidade
  (`missing`/último-registro) + funcionário sem função; RLS/isolamento e `FORBIDDEN` para `client` em
  toda US com escrita.
- Pipeline mínimo: `npm run check` (format+lint+types+unit) e `npm run test:integration` verdes.

═══════════════════════════════════════════════════════════════════════════════════════
ESCOPO
═══════════════════════════════════════════════════════════════════════════════════════

DENTRO:

- Fundação: modelo `0015` (3 tabelas + enum) + funções puras D1/D2 (#28).
- US1 CRUD do catálogo (#29) — inclui `dependents`.
- US2 registro de realização com validade automática (#30).
- US3 controle de vencimento/reciclagem + query de resumo (#31).
- US4 obrigatórios por função + conformidade + relatório de não-conformes (#80).
- Superfície de API completa (Server Action + REST + api-design.md + Postman) para cada recurso novo.

FORA (YAGNI / dependências):

- Upload/GED de certificado (só `certificate_path` texto — D4).
- Central de notificações / agendador de vencimento (Fase 7 — só a query de resumo — D7).
- Assinatura digital de treinamento (sem requisito nesta fase).
- Trilha de CBO, eSocial, geração de PDF por lib (usar CSS print se imprimir).
- Qualquer alteração de schema fora da migration `0015`; novos códigos de erro.

═══════════════════════════════════════════════════════════════════════════════════════
CRITÉRIOS DE SUCESSO (mensuráveis, tecnologia-agnósticos)
═══════════════════════════════════════════════════════════════════════════════════════

- Cadastrar/editar/listar/excluir treinamentos do catálogo com os 5 campos ePGR; item em uso não é
  excluído sem aviso (US1).
- Registrar um treinamento realizado calcula a validade automaticamente pela periodicidade, sem
  cálculo manual; `single` não expira (US2).
- O gestor vê numa tela todos os treinamentos vencidos e a vencer por funcionário, com status visual,
  e `single` nunca aparece como vencido; existe query de resumo para o dashboard (US3).
- Vincular treinamentos obrigatórios a uma função faz o sistema sinalizar automaticamente funcionários
  não-conformes (obrigatório ausente ou vencido); a aba do perfil reflete exatamente os vínculos (US4).
- Nenhum dado cruza tenant em nenhuma US; `npm run check` e `npm run test:integration` verdes.

NÃO invente solução técnica além das decisões travadas acima — o "como" fino é do /speckit-plan.
Conteúdo da spec em pt-BR; branch e commits em inglês.
