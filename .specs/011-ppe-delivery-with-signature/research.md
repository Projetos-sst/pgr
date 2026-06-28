# Research — Entrega de EPI com assinatura digital (011)

Fase 0. Resolve as escolhas técnicas antes do design. As três decisões de produto já foram fechadas
no `/speckit-clarify` (ver `spec.md` › Clarifications); aqui ficam as decisões **de implementação**.

## D1 — Momento da baixa de estoque

- **Decisão**: criar a entrega **pendente** (itens + token) sem mexer no saldo; a **baixa ocorre na
  confirmação** (assinatura), numa transação `withOrg`, com `SELECT … FOR UPDATE` por linha de
  `epi_stock` e revalidação `balance - quantity >= 0`.
- **Rationale**: o saldo só some quando há comprovação; a fonte da verdade é a baixa no momento da
  assinatura (revalidada com lock), eliminando over-promise. Reusa o transacional já provado na 010.
- **Alternativas**: reservar na criação (estoque "preso" se a assinatura não vier; exige
  cancelamento/estorno) — rejeitada para o MVP.

## D2 — Expiração do token (sem migration)

- **Decisão**: token expira **72h após `epi_deliveries.created_at`**, calculado em runtime
  (`created_at + 72h < now()` → expirado). Sem coluna nova.
- **Rationale**: zero migration (modelo 008 intacto); janela suficiente para o funcionário assinar;
  função pura testável (`isTokenExpired(createdAt, now)`).
- **Alternativas**: coluna `auth_token_expires_at` (mais explícita, mas exige migration — rejeitada);
  token sem expiração (menos seguro — rejeitada).

## D3 — Leitura do token sem tenant (caminho público)

- **Decisão**: a leitura inicial por `auth_token` ocorre por uma consulta server-side que **não
  depende de `current_setting('app.current_org')`** e retorna **uma** entrega; o `org_id` é então
  derivado dessa linha e toda escrita subsequente roda via `withOrg(delivery.orgId, …)`.
- **Rationale**: o visitante não tem sessão/tenant; o token É a capacidade. O `auth_token` é único
  (índice parcial), então a busca resolve para no máximo uma entrega. A baixa volta ao caminho
  org-scopado normal (RLS ativo) assim que o `org_id` é conhecido.
- **Risco/Mitigação**: é o ponto crítico de segurança. Mitigação: a leitura pública seleciona
  **somente** colunas mínimas e pela igualdade exata do token; teste de isolamento prova que um token
  de outra org não vaza dados e que a confirmação só afeta a entrega do token.
- **Alternativas**: expor uma view/RPC pública (mais superfície — rejeitada); reaproveitar o bypass
  dev de `/api/v1` (inseguro — rejeitado).

## D4 — Tempo real do painel "Aguardando confirmação…"

- **Decisão**: **polling** curto (~5s) de uma action/endpoint interno que lê `signature_status`.
- **Rationale**: simples, sem dependência nova, funciona com `officeAction`/`restHandler` existentes
  (Princípio II/YAGNI).
- **Alternativas**: Supabase Realtime (`@supabase/supabase-js` já nas deps) — instantâneo, porém canal
  + auth + RLS no realtime adicionam complexidade. Fora do MVP.

## D5 — "Enviar Link" (sem provider)

- **Decisão**: MVP **gera e exibe/copia** o link do token; **não** dispara e-mail/SMS. Se o
  funcionário não tem e-mail/telefone, a UI orienta completar o cadastro.
- **Rationale**: não há provider configurado (constatado no repo); gerar o link é viável e entrega
  valor. Disparo real = fatia futura.

## D6 — Geração do QR Code

- **Decisão**: gerar o QR **no client** a partir da URL pública do token, com uma lib mínima dedicada
  (ex. `qrcode`/`qrcode.react`) **ou** via endpoint que devolve SVG — escolher a opção sem peso de
  runtime no servidor. Confirmar a menor dependência no momento da implementação (Princípio II).
- **Rationale**: o QR é só o encoding da URL pública; não precisa de serviço externo.
- **Alternativas**: serviço externo de QR (viola Stack Fixa — rejeitado).

## D7 — Reuso transacional da 010 (helper de baixa)

- **Decisão**: extrair de `stock-movements.ts` um **helper interno de baixa por item**
  (`SELECT … FOR UPDATE` → valida `>= 0` → `INSERT stock_movements` → `UPDATE balance`) reutilizável
  para `type = 'employee_delivery'` com `delivery_id`, mantendo o comportamento atual da 010 e seus
  testes verdes.
- **Rationale**: evita duplicar a lógica sensível do lock; uma única fonte da verdade para a baixa.

## D8 — Novos códigos de erro do token

- **Decisão**: adicionar ao mapa `HTTP_BY_CODE` (`src/shared/api/rest.ts`): `ALREADY_SIGNED → 409`
  (entrega já assinada / token usado) e `TOKEN_EXPIRED → 410`. `NOT_FOUND → 404` (token inexistente)
  e `INSUFFICIENT_STOCK → 422` (já existe da 010) reaproveitados. Classes `AlreadySignedError` /
  `TokenExpiredError` estendendo `AppError`.
- **Rationale**: mantém o padrão de mapeamento automático de `AppError` da 009/010.

## Decisões herdadas (não reabrir)

- Modelo B (tenant da sessão no caminho interno) e estrutura real do projeto (`src/shared/...`).
- Enums em inglês no banco; rótulos pt-BR só em DTO/UI.
- Integração contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite nem banco de dev.
- Zero migration (modelo 008 já cobre tudo).
