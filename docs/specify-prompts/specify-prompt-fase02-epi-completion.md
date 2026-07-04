/speckit-specify

GIT_BRANCH_NAME: feature/epi-module-completion

NOTA DE BRANCH: spec NOVA (`.specs/NNN-epi-module-completion/`) numa **branch NOVA e LIMPA a partir
do `develop` atual**. Todo o conteúdo já mergeado está em `develop`; as branches antigas
(`feature/ppe-delivery-with-signature`, `feature/ppe-return-record`, `feature/digital-signature-infra`)
são **APENAS REFERÊNCIA de conhecimento** — NÃO mergear, NÃO rebasear, NÃO herdar commits delas
(têm commits duplicados, numeração de fatia conflitante e colisão de migration `0009`). Partir do
`develop` (última migration = `0009_caepi_certificates`) e implementar do zero, reaproveitando a
LÓGICA das branches onde for sólida.

Feature: **Conclusão da Fase 02 — módulo operacional de EPI.** Numa única leva, fechar todas as issues
de EPI ainda abertas: plugar a validação de CA (CAEPI) já pronta no formulário de catálogo (#18/#115/#75),
entrega de EPI com baixa transacional de estoque e assinatura digital de recebimento (#19), devolução
de EPI com reposição de saldo (#20) e ficha/histórico de EPI por funcionário (#21). Fora: #78 (EPI×risco,
Fase 03 — depende do módulo de Riscos que não existe). O modelo de dados já existe (fatia 008 em
`develop`): **toda a leva é "zero migration", EXCETO a devolução (1 migration `0010`).**

═══════════════════════════════════════════════════════════════════════════════════════
ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec)
═══════════════════════════════════════════════════════════════════════════════════════

- docs/briefings/fase02-epi-completion-brainstorming.md
  **Âncora desta leva.** Escopo real, as DECISÕES TRAVADAS D1–D6, o fatiamento em US1–US5, o mapa de
  reuso e os riscos. PREVALECE onde houver divergência com qualquer outro doc.
- docs/briefings/epi-fluxos-panorama.md
  Panorama de TODOS os fluxos do módulo (F1–F7), a camada de assinatura (§5), quem mexe no saldo (§6),
  isolamento (§7), ordem de implementação (§8) e lacunas (§9). ⚠️ A **§5 (infra genérica #67) é
  SOBRESCRITA pela decisão D1** do brainstorming: usamos assinatura INLINE, não a tabela polimórfica.
- docs/briefings/018-catalogo-caepi-wiring.md — briefing da US1 (wiring do CA no catálogo).
- docs/briefings/019-entrega-epi-assinatura.md — briefing das US2+US3 (entrega + assinatura inline).
- docs/briefings/020-devolucao-epi.md — briefing da US4 (devolução + migration `0010`).
- docs/briefings/021-ficha-epi-funcionario.md — briefing da US5 (ficha só-leitura).
- docs/briefings/115-caepi-validacao-ca.md e caepi-logica-de-negocio.md — contexto do CA (só a US1
  consome; NÃO reabrir o job de ingestão nem a tabela `caepi_certificates`).

═══════════════════════════════════════════════════════════════════════════════════════
CONTEXTO (leia os padrões vigentes e LISTE os arquivos que vai ler)
═══════════════════════════════════════════════════════════════════════════════════════

- src/shared/db/schema/epis.ts — **FONTE DA VERDADE do modelo.** Já contém (fatia 008): `epi_catalog`,
  `epi_stock`, `stock_movements` (com `delivery_id`), `epi_deliveries` (com `signature_status` +
  `auth_token`), `epi_delivery_items`, `epi_risk`; enums `stock_movement_type`
  (`purchase/employee_delivery/adjustment/discard`) e `epi_signature_status`
  (`pending/signed_qr/signed_link/signed_manual`). **NÃO alterar**, exceto a migration `0010` da US4.
  Ignorar campos citados em issues antigas que NÃO existem no schema (`standard`, `ca_expires_at`,
  `current_balance`, `organization_id`, SQLite) — desatualizados.
- src/shared/db/repositories/stock-movements.ts — a transação de saldo (`SELECT … FOR UPDATE` → valida
  `balance >= 0` → `InsufficientStockError` → INSERT movimento + UPDATE saldo). **US2 EXTRAI daqui**
  `applyStockExit(tx, {stockId, quantity, deliveryId, type})` a partir do corpo de `registerStockExit`,
  e cria o espelho `applyStockEntry` para a US4. `registerStockExit`/`Entry` passam a chamar os helpers;
  **comportamento e testes da #72 preservados** (é refactor sem mudança de contrato).
- src/shared/domains/pgr/stock-movements.ts — `computeRunningBalance` (window function) para saldo
  resultante no histórico; reusar na ficha se precisar.
- src/shared/integrations/caepi/** — `CaField`, `useCaepiValidation`, `lookupCa` (Server Action),
  `GET /api/integrations/caepi/[ca]` — TUDO PRONTO. US1 só **pluga** o `CaField` no form do catálogo.
- src/app/(protected)/epi-catalog/_components/epi-catalog-form.tsx — o form onde o `CaField` entra
  (troca os `TextField` de `ca`/`caValidUntil`/`manufacturer`/`norm`).
- src/app/(protected)/employees/[id]/page.tsx — ponto de entrada da entrega (US2/US3) e da ficha (US5).
- src/proxy.ts — `createRouteMatcher`/`isPublicRoute`. **US3 adiciona `/sign/(.*)`** à lista pública
  (padrão de `sign-in`/`sign-up`/`api/webhooks`): a rota de assinatura é pública, sem Clerk, sem tenant.
- src/shared/server/{result.ts,office-action.ts,action-error.ts} e src/shared/api/rest.ts — contrato
  `ActionResult<T>`, wrapper `officeAction`, `restHandler`, mapeamento erro→HTTP (já tem
  `INSUFFICIENT_STOCK`→422). Adicionar códigos novos: `ALREADY_SIGNED`→409, `ALREADY_RETURNED`→409,
  `TOKEN_EXPIRED`→410 (ou 404), `TOKEN_INVALID`→404.
- src/shared/db/with-org.ts — o motor de tenant. TODA escrita/leitura de EPI passa por `withOrg`;
  `org_id` vem SEMPRE da sessão (`requireTenantContext()`), NUNCA do cliente. RLS `app_runtime` é
  backstop. **Exceção**: a rota pública `/sign/[token]` NÃO tem tenant de sessão — resolve o tenant da
  entrega **a partir do token** e opera só naquela entrega (ver EDGE CASES).
- src/shared/db/schema/companies.ts — template de tabela/RLS (referência; não há tabela nova nesta leva).
- src/app/(protected)/_ui/{list,form}.tsx e as páginas de `epi-stock`/`epi-catalog` — molde de UI CRUD.
- docs/api/api-design.md e docs/api/sst-manager.postman_collection.json — registrar TODOS os recursos
  novos (obrigatório pelo checklist de API surface do CLAUDE.md).

═══════════════════════════════════════════════════════════════════════════════════════
DECISÕES TRAVADAS (KISS / DRY / YAGNI — não reabrir)
═══════════════════════════════════════════════════════════════════════════════════════

- **D1 · Assinatura INLINE**, não infra genérica. Usar `epi_deliveries.auth_token` +
  `signature_status` (já no develop). NÃO criar `signature_requests`/`signature_captures`. Motivo:
  1 consumidor real hoje (só EPI); abstração genérica só quando o PGR também assinar (Fase 03+),
  conforme CODE_STANDARDS ("abstrair com 2+ consumidores reais"). Salvar QR/token/signature-pad da
  branch `digital-signature-infra` como referência, sem a tabela polimórfica.
- **D2 · Extrair `applyStockExit`/`applyStockEntry`** de stock-movements (o helper NÃO existe em
  develop; refactor preserva a #72). Entrega usa exit; devolução usa entry. Uma saída, uma entrada,
  ambas transacionais (`FOR UPDATE`).
- **D3 · Baixa na confirmação da entrega**; assinatura pode chegar depois (`pending`→`signed_*`). EPI
  sai do estoque no ato; assinatura é prova de recebimento. Excluir entrega assinada é PROIBIDO;
  retorno de saldo só via devolução (US4).
- **D4 · Devolução = migration `0010`**: valor `employee_return` no enum `stock_movement_type` +
  coluna `returned_at` (`timestamptz` nullable) em `epi_delivery_items`. Devolução por item, total
  (sem parcial). Guard: não devolver 2× (`returned_at IS NULL`).
- **D5 · Ficha só-leitura**, zero migration (join escopado por tenant + impressão CSS).
- **D6 · US1 = wiring puro**: NÃO tocar `epis.ts` nem `epiCatalogInputSchema`; estado da CAEPI nunca
  bloqueia o salvar.
- **Escrita de saldo** SEMPRE `SELECT … FOR UPDATE` + valida `>= 0` na app + INSERT+UPDATE na MESMA
  transação `withOrg`. `CHECK balance >= 0` é só backstop.
- **Testes de integração** contra **Postgres efêmero** (`INTEGRATION_*`), **NUNCA SQLite** nem o banco
  de dev. Isolamento multi-tenant é caminho crítico obrigatório em toda US com escrita.

═══════════════════════════════════════════════════════════════════════════════════════
USER STORIES (priorizadas, independentemente testáveis)
═══════════════════════════════════════════════════════════════════════════════════════

US1 (P1) — Plugar CAEPI no catálogo (#18/#115/#75). Zero migration. `CaField` no
`epi-catalog-form.tsx`; autofill de fabricante/norma/validade no blur; badge/aviso por estado; NUNCA
bloqueia o salvar. Ver briefing 018.

US2 (P1) — Entrega + baixa + assinatura manual (#19 core). Zero migration. Extrair `applyStockExit`;
`createDelivery` transacional (deliveries + items + baixa por item, rollback total); `signDeliveryManual`
(`pending`→`signed_manual`); UI na página do funcionário. Ver briefing 019.

US3 (P1) — Assinatura pública QR/link (#19 assinatura). Zero migration. Token 72h em `auth_token`;
rota pública `/sign/[token]` (add ao `isPublicRoute`); captura → `signed_qr`/`signed_link`; painel
"aguardando confirmação" por polling. Ver briefing 019.

US4 (P2) — Devolução + reposição (#20). **Migration `0010`.** `applyStockEntry` com `employee_return`;
`returnDeliveryItem` seta `returned_at` + repõe saldo; guard `ALREADY_RETURNED`. Ver briefing 020.

US5 (P2) — Ficha/histórico por funcionário (#21). Zero migration. `getEmployeeEpiRecord` (join
escopado, filtros período/status, paginação); UI na página do funcionário + impressão. Ver briefing 021.

═══════════════════════════════════════════════════════════════════════════════════════
SUPERFÍCIE DE API — OBRIGATÓRIA (os 4 juntos por recurso: Server Action + REST + api-design.md + Postman)
═══════════════════════════════════════════════════════════════════════════════════════

- `GET/POST /api/v1/epi-deliveries` (listar/criar) · `GET/PUT/DELETE /api/v1/epi-deliveries/[id]`
  (DELETE **barrado se assinada** → `FORBIDDEN`) · `POST /api/v1/epi-deliveries/[id]/sign` (manual) ·
  `POST /api/v1/epi-deliveries/[id]/return` (devolver item(ns)).
- `GET /api/v1/employees/[id]/epi-record` (ficha, read-only, `?status=&from=&to=&page=`).
- Rota **PÚBLICA** (fora do `/api/v1`, sem tenant, sem dev-bypass): `GET/POST /sign/[token]`.
- `201` no create, `204` no delete; reusar o MESMO repository/zod/`toActionError` entre Server Action e
  REST — nunca reimplementar a regra.

═══════════════════════════════════════════════════════════════════════════════════════
EDGE CASES que a spec MUST cobrir como regra verificável
═══════════════════════════════════════════════════════════════════════════════════════

Entrega / estoque:
- Saldo insuficiente em QUALQUER item da entrega → rollback TOTAL, nada gravado, `INSUFFICIENT_STOCK`
  (422). Saldo permanece intacto.
- Duas entregas/saídas concorrentes do mesmo estoque → serializadas por `FOR UPDATE`; saldo nunca fura.
- Baixa acontece na confirmação; assinatura pendente NÃO impede a baixa (D3).
- Excluir entrega assinada → `FORBIDDEN` (usar devolução para retornar saldo).
- Entrega só vê funcionários/estoque do próprio tenant (`withOrg`+RLS); alvo de outro tenant →
  `NOT_FOUND`.

Assinatura (inline):
- `pending` → `signed_manual/qr/link` uma única vez; reassinar → `ALREADY_SIGNED` (409).
- Rota pública `/sign/[token]`: token inexistente → `TOKEN_INVALID` (404); expirado (>72h) →
  `TOKEN_EXPIRED`; entrega já assinada → mensagem clara, sem 500. O token resolve a entrega e o tenant
  dela; a rota NÃO enxerga nenhuma outra entrega/tenant. Sem enumeração; rate-limit.

Devolução:
- Item já devolvido (`returned_at` preenchido) → `ALREADY_RETURNED` (409); saldo intacto.
- Devolução repõe saldo exatamente (`+ quantity` do item) atômico; item de outro tenant → `NOT_FOUND`.
- Devolver independe de a entrega estar assinada.

Ficha:
- Só entregas do próprio tenant e do funcionário pedido; funcionário de outro tenant → `NOT_FOUND`.
- Filtro `pendente` = `returned_at IS NULL`; `devolvido` = preenchido; funcionário sem entregas → vazio.

CA (US1):
- válido/vigente → autofill + badge verde; vencido → aviso distinto + AINDA autofill; não encontrado →
  aviso inline; base CAEPI vazia → "não sincronizada" (não erro); formato inválido → não dispara; digitação
  rápida → aborta anterior; QUALQUER desfecho NUNCA bloqueia o salvar.

Isolamento (todas as US com escrita):
- `app_runtime` só enxerga o próprio tenant; query sem `withOrg` → 0 linhas (RLS backstop).
- `client` (papel sem office) → `FORBIDDEN` em todas as ações de escrita.

═══════════════════════════════════════════════════════════════════════════════════════
MIGRATION 0010 (única da leva — US4)
═══════════════════════════════════════════════════════════════════════════════════════

drizzle-kit + SQL custom (padrão `0005`): `ALTER TYPE stock_movement_type ADD VALUE 'employee_return'`
+ `ALTER TABLE epi_delivery_items ADD COLUMN returned_at timestamptz` (nullable). Sem GRANT/RLS novos
(herdados da tabela). Aplicada via conexão direta unpooled (owner). Documentar como forward-only no
ponto do enum (não remover valor no rollback).

═══════════════════════════════════════════════════════════════════════════════════════
TESTES (constituição — obrigatório; a fatia não fecha sem eles)
═══════════════════════════════════════════════════════════════════════════════════════

- Unit: `applyStockExit`/`applyStockEntry` (extração preserva #72), rollback de item insuficiente,
  transições de assinatura + `ALREADY_SIGNED`, token (geração/expiração), guard de devolução
  (`ALREADY_RETURNED`), filtros da ficha, `CaField` (autofill em valid/expired, não em not_found, salvar
  nunca bloqueia).
- Integração (Postgres efêmero `INTEGRATION_*`): baixa atômica multi-item + `INSUFFICIENT_STOCK` deixa
  saldo intacto; assinatura pública muda status sem tenant e sem vazar entre orgs; devolução repõe saldo
  e barra 2ª devolução; ficha e entrega não cruzam tenant; DELETE de entrega assinada barrado;
  `NOT_FOUND` cross-tenant; `FORBIDDEN` para `client`; GRANT/RLS por papel.
- Pipeline mínimo: `npm run check` (format+lint+types+unit) e `npm run test:integration` verdes.

═══════════════════════════════════════════════════════════════════════════════════════
ESCOPO
═══════════════════════════════════════════════════════════════════════════════════════

DENTRO:
- US1 wiring CAEPI no catálogo (#18/#115; fecha #75 como duplicada).
- US2 entrega + baixa transacional + assinatura manual (#19 core) — inclui extrair `applyStockExit`.
- US3 assinatura pública QR/link (#19 assinatura) — rota pública `/sign/[token]`, token 72h inline.
- US4 devolução + reposição (#20) — migration `0010`.
- US5 ficha/histórico por funcionário (#21).
- Superfície de API completa (Server Action + REST + api-design.md + Postman) para cada recurso novo.
- Fechar #70 e #72 (já mergeadas) no housekeeping.

FORA (YAGNI / dependências):
- #78 EPI×risco (Fase 03 — sem módulo de Riscos; `epi_risk` referencia `ges` interino).
- Infra de assinatura genérica `signature_requests`/`captures` (adiada para 2º consumidor — PGR).
- Job/tabela de ingestão CAEPI (já entregue; não reabrir), agendador do job.
- Devolução parcial de quantidade, SSE (usar polling), upload de imagem além da assinatura, geração
  de PDF por lib (usar CSS print).
- Alterar o modelo 008 fora da migration `0010`.

═══════════════════════════════════════════════════════════════════════════════════════
CRITÉRIOS DE SUCESSO
═══════════════════════════════════════════════════════════════════════════════════════

- Cadastrar EPI com um CA vigente autopreenche fabricante/norma/validade; CA vencido/inexistente avisa
  sem bloquear (US1).
- Entregar N EPIs a um funcionário dá baixa atômica no estoque e cria a entrega `pending`; saldo
  insuficiente não grava nada (US2).
- Funcionário assina por QR/link na rota pública e o painel do gestor reflete `signed_*`; ou o gestor
  registra assinatura manual (US2/US3).
- Devolver um EPI repõe o saldo e marca `returned_at`; 2ª devolução é barrada (US4).
- A ficha do funcionário lista entregas/devoluções com filtros e imprime (US5).
- Nenhum dado cruza tenant em nenhuma US; `npm run check` e `npm run test:integration` verdes.
