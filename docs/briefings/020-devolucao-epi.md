# Briefing US4 — Devolução de EPI

> Issue **#20**. Fluxo narrado em panorama **F5** (⚠️ "precisa de migração"). Decisão-mãe: **D4** do
> [brainstorming](./fase02-epi-completion-brainstorming.md). **Única fatia da leva com migration.**

## Escopo

Funcionário devolve um EPI já entregue → **movimento de retorno que aumenta o saldo** + marca o item
como devolvido. Impede devolver duas vezes.

## Migration `0010` (drizzle-kit + SQL custom, padrão 0005)

1. Adicionar valor **`employee_return`** ao enum `stock_movement_type` (nome consistente com
   `employee_delivery`; o panorama cita `return`, **usar `employee_return`**).
2. Adicionar coluna **`returned_at`** (`timestamptz`, **nullable**) em `epi_delivery_items`.
3. Sem GRANT/RLS novos (as tabelas já têm; a coluna herda a policy da tabela). `set_updated_at` já
   existe em `epi_delivery_items`.

Reversível: `DROP COLUMN returned_at` + o enum ganha valor (não remover valor de enum no rollback —
documentar como forward-only nesse ponto, padrão do repo).

## Alvo do fluxo

- **`returnDeliveryItem`** (repository, `withOrg` + transação): valida que o item existe no tenant e
  `returned_at IS NULL` (senão `ALREADY_RETURNED`, 409) → seta `returned_at = now()` → `applyStockEntry`
  (espelho do `applyStockExit`, D2) com `type='employee_return'` (**+ balance**) ligado à `delivery_id`.
  Falha → rollback total.
- Devolução é **por item** e **total** (a quantidade inteira do item volta ao estoque). Devolução
  **parcial** de quantidade é YAGNI nesta fatia.
- Atualiza a ficha (US5): item passa a ter data de devolução; listagem de **pendentes** = `returned_at
  IS NULL`.

## Regras verificáveis

- Devolver item já devolvido (`returned_at` preenchido) → `ALREADY_RETURNED` (409); saldo intacto.
- Reposição só afeta o estoque do **próprio tenant** (`withOrg` + RLS); item de outro tenant →
  `NOT_FOUND`.
- Saldo após devolução = saldo anterior **+ quantidade** do item, atômico (`FOR UPDATE`).
- Devolver não requer que a entrega esteja assinada (a devolução é evento independente da assinatura).

## Superfície de API (os 4 juntos)

`POST /api/v1/epi-deliveries/[id]/return` (corpo: item(ns) a devolver) — reusa repo/schema/`toActionError`.
Server Action espelho. Doc `api-design.md` + Postman.

## Testes

- Unit: `applyStockEntry` (reposição), guard `returned_at` (não devolve 2×).
- Integração (Postgres efêmero): devolução repõe saldo exatamente; 2ª devolução barrada; `NOT_FOUND`
  cross-tenant; `FORBIDDEN` para `client`; concorrência de reposição sob `FOR UPDATE`.

## Referência (não mergear)

Branch `feature/ppe-return-record` (fatia 012): já modelou `employee_return` + `returned_at` e a lógica
inversa `employee_return`. Salvar como referência; reimplementar limpo sobre `develop`.
