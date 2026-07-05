# Phase 0 — Research: Infraestrutura de assinatura digital

Esta fatia entra no `/speckit-plan` **sem NEEDS CLARIFICATION**: o briefing (fonte da verdade) já travou as decisões no brainstorming. Este documento registra cada decisão no formato Decisão / Racional / Alternativas, mais as verificações de dependência a confirmar no `/speckit-implement`.

## D1 — Modelagem genérica polimórfica (não acoplada a EPI)

- **Decisão**: duas tabelas — `signature_requests` (pedido de qualquer módulo) + `signature_captures` (resultado 1:1), discriminadas por `target_type` (`'demo'`, futuro `'epi_delivery'`, `'work_order'`, …).
- **Racional**: a issue pede reuso (DRY). Nesta branch não há código de EPI a refatorar → o caminho genérico é o mais simples e o mais escalável: novo módulo consumidor = +1 `target_type` no registry, **zero mudança de schema** (atende SC-004/FR-016).
- **Alternativas**: (a) colunas dedicadas em `epi_deliveries` (`auth_token`/`signature_status` já dormem lá) — rejeitada por acoplar a infra a um módulo e violar DRY; (b) uma tabela única com a captura embutida — rejeitada para manter o request leve (consultado em polling) e a captura (imagem) separada.
- **Colunas dormentes de EPI** (`epi_deliveries.auth_token`/`signature_status`): **intocadas** nesta fatia (YAGNI). Futuro: a integração de EPI lê o status de `signature_requests` (fonte única).

## D2 — Isolamento da rota pública sem sessão (policy de capability)

- **Decisão**: a rota pública não tem `requireOfficeStaff()` nem tenant ambiente. O isolamento vem **do token**, dentro do modelo RLS, sem `SECURITY DEFINER`:
  1. `signature_requests` recebe **duas** policies PERMISSIVE: a de tenant (`FOR ALL ... org_id = current_setting('app.current_org', true)`) e a de capability (`FOR SELECT ... token_hash = current_setting('app.signature_token', true)`).
  2. Helper `withSignatureToken(rawToken, fn)` abre transação e faz `set_config('app.signature_token', sha256(rawToken), true)`; lê o request pela policy de capability.
  3. Para **gravar**, deriva `org_id` da linha lida e usa `withOrg(orgId, …)` (policy de tenant) para `update status='signed', used_at=now()` + `insert` em `signature_captures`.
- **Racional**: policies PERMISSIVE combinam por **OR**. No contexto público, `app.current_org` não está setado (→ NULL, a policy de tenant não casa) e só a de capability casa **a única linha cujo token o cliente possui**. No contexto interno, só `app.current_org` está setado e a policy de tenant funciona normalmente. `token_hash` é `NOT NULL` e único; sem token setado, `= NULL` não retorna nada (sem vazamento). **Tenant vem do token, nunca do cliente** (Princípio I, FR-008).
- **Alternativas**: (a) função `SECURITY DEFINER` que ignora RLS — rejeitada por reduzir a defesa em profundidade; (b) endpoint que recebe `orgId` do cliente — proibido pela constituição.

## D3 — Token: entropia, hash, TTL, uso único

- **Decisão**: token aleatório forte (≥256 bits, `crypto.randomBytes`/base64url), persistido **apenas hasheado** (sha-256) em `token_hash` (UNIQUE). O token cru só vive no link/QR; **nunca** é retornado após a criação nem gravado em claro. `expires_at` (TTL configurável) + `used_at` (uso único). "Expirado" é **derivado na leitura** (`expires_at < now()` e `status='pending'`), não um estado persistido.
- **Racional**: se o banco vazar, links não são reutilizáveis (só o hash está lá). Uso único + expiração fecham reuso/replay (SC-002, FR-005/FR-011/FR-012). Derivar "expirado" evita job de varredura (YAGNI).
- **TTL padrão**: constante configurável; **default travado: 72 h (259200 s)** (assinatura tipicamente presencial/curto prazo). Decisão de valor, não de arquitetura — ajustável sem migração.
- **Alternativas**: guardar token em claro (rejeitado — risco de vazamento); JWT assinado sem persistência (rejeitado — dificulta revogação/uso único e exige segredo extra).

## D4 — Tempo real por polling (~3 s), não SSE

- **Decisão**: a tela interna consulta `getSignatureStatus` por polling a cada ~3 s.
- **Racional**: simples, robusto, sem conexão persistente; atende `<5 s` (SC-001/FR-013) e funciona bem em serverless (Vercel). SSE/WebSocket adicionariam complexidade sem ganho nesta escala (YAGNI, Princípio II).
- **Alternativas**: SSE (Out of Scope), WebSocket (infra extra), Supabase Realtime (acoplaria a um recurso não usado no resto do app nesta fase).

## D5 — Storage da imagem: base64 no Postgres

- **Decisão**: `signature_captures.image_data text NOT NULL` com data-URL base64 (PNG), sob RLS por tenant.
- **Racional**: mais seguro que bucket/ACL (herda o isolamento por tenant), sem infra de storage nova (Princípio II); a imagem é pequena (~5–50 KB). Atende SC-003/FR-009.
- **Alternativas**: Backblaze/Supabase Storage (Out of Scope — exige camada de storage inexistente e particionamento por tenant adicional).

## D6 — Bibliotecas (compatibilidade React 19 / Next 16)

- **Decisão**: `qrcode` (gera data-URL **no servidor**) e `signature_pad` (vanilla) embrulhado em client component.
- **Racional**: `qrcode` é lib Node framework-agnóstica → sem peer-dependency de React; `signature_pad` é vanilla (sem peer-dependency de React) → imune a breaking changes do React 19; exporta PNG/data-URL pronto.
- **A verificar no implement**: fixar versões compatíveis com React 19.2.4 / Next 16.2.6 e a flag de SSR (componente de canvas é client-only, `"use client"` + sem render no servidor). Consultar `node_modules/next/dist/docs/` antes de escrever código de framework (constituição §Restrições).
- **Alternativas**: componentes React de QR/canvas (`react-qr-code`, `react-signature-canvas`) — rejeitados pelo risco de peer-dependency com React 19.

## D7 — Consumidor #1 = demo auto-contido

- **Decisão**: `target_type: 'demo'` com um `FormRenderer` e `payloadSchema` próprios; um painel interno demo exercita criar → QR/link → status; a rota pública captura.
- **Racional**: a entrega de EPI (consumidor real) vive na branch irmã `feature/ppe-delivery-with-signature` (não mergeada). O demo prova o contrato ponta a ponta **sem conflito/retrabalho** (SC-004) e documenta o caminho de plug-in (`'epi_delivery'` = +1 entrada no registry).
- **Alternativas**: integrar direto com EPI — rejeitada (acoplamento entre branches, retrabalho no merge).

## D8 — Plano free/pro: gate na criação + contagem derivada

- **Decisão**: gate em `createSignatureRequest` (lado interno, com sessão) lendo `requireTenantContext().plan` (plano do **tenant ativo**, Inv-1). `pro` ilimitado; `free` = 10 pedidos **criados** por mês corrente → na 11ª, `QUOTA_EXCEEDED`. Contagem derivada: `count(*) WHERE org_id=$1 AND created_at >= date_trunc('month', now())` (reset mensal implícito; **sem contador/cron**). A rota pública **nunca** checa plano.
- **Racional**: alinhado à spec 005 (FR-011/012/013, Inv-1) e ao padrão do projeto (nº de expostos por GES também é derivado). Gatekeeping na criação mantém o gate na superfície com sessão; a superfície pública não tem tenant de sessão → checar violaria Inv-1 (FR-019/FR-022).
- **Helpers** (em `src/shared/tenant/plan.ts`, ao lado de `isTeamManagementAvailable`): `FREE_SIGNATURE_MONTHLY_QUOTA = 10`; `isSignatureAvailable(plan, currentCount)` (puro, testável em unit).
- **Alternativas**: contar assinaturas **concluídas** (rejeitada — empurraria o gate para a superfície pública, péssima UX para o signatário e brecha de links pendentes ilimitados); tabela de contador + cron de reset (rejeitada — YAGNI).

## D9 — Erros como códigos de domínio

- **Decisão**: reutilizar `ActionResult<T>` + `toActionError`. Códigos: `VALIDATION` (Zod), `NOT_FOUND` (token/request inexistente), `FORBIDDEN` (papel `client` no lado interno), `QUOTA_EXCEEDED` (free na 11ª/mês). Estados públicos "expirado"/"já utilizado" são **páginas amigáveis**, não erro cru. `QUOTA_EXCEEDED` será adicionado ao mapa REST (`restHandler`) → **402 Payment Required**.
- **Racional**: consistência com o repo; mapeamento HTTP só no `restHandler`. `QUOTA_EXCEEDED` ainda não existe no `HTTP_BY_CODE` → acréscimo pontual.
- **Alternativas**: HTTP cru nas actions (proibido pela arquitetura do repo).

## D10 — Migration `0009` (drizzle-kit + SQL custom)

- **Decisão**: `0010_digital_signature_infra.sql` gerada por drizzle-kit, complementada com **SQL custom** (padrão `0001`/`0005`): `GRANT SELECT,INSERT,UPDATE,DELETE` ao `app_runtime` nas 2 tabelas; triggers `set_updated_at`; e a **policy de capability** (`FOR SELECT TO app_runtime USING (token_hash = current_setting('app.signature_token', true))`), já que drizzle-kit emite a policy de tenant a partir do schema mas a de capability é adicional. Aplicada via conexão direta unpooled (owner).
- **Racional**: drizzle é dono code-first; GRANT/trigger/policy-extra não são auto-emitidos e seguem o precedente das migrations anteriores.
- **A verificar**: `pgPolicy(...).enableRLS()` no schema cobre a policy de tenant; confirmar se a de capability entra melhor como segundo `pgPolicy` no schema (drizzle a emitiria) ou como SQL custom — preferir declarar **ambas** no schema se o drizzle-kit suportar `for: "select"` com `using` por `current_setting('app.signature_token')`; caso contrário, SQL custom.

## Itens a confirmar no `/speckit-implement` (não bloqueiam o plano)

1. Versões de `qrcode` e `signature_pad` compatíveis com React 19.2.4 / Next 16.2.6.
2. Declaração da policy de capability via `pgPolicy` no schema vs. SQL custom na migration (D10).
