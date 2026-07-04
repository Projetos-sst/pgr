# Briefing US5 — Ficha/histórico de EPI por funcionário

> Issue **#21**. Fluxo narrado em panorama **F6**. Decisão-mãe: **D5** do
> [brainstorming](./fase02-epi-completion-brainstorming.md). **Zero migration — só leitura.**

## Escopo

Visão **somente leitura** da "ficha de EPI" de um funcionário: todos os EPIs entregues a ele, com
data de entrega, data de devolução e status de assinatura. Impressão da ficha de controle.

## Alvo

- **`getEmployeeEpiRecord`** (repository, `withOrg`): join
  `epi_deliveries × epi_delivery_items × epi_catalog` filtrado por `employee_id` (do tenant), colunas:
  `CA · EPI (nome) · Tam. · Data de Entrega · Data de Devolução · Status de Assinatura`. Ordenar por
  `delivery_date` desc. Paginação offset (`{rows,total}`, padrão do repo).
- **Filtros**: período (intervalo de datas) e status (`pendente` = `returned_at IS NULL` · `devolvido` =
  `returned_at` preenchido · `todos`).
- **UI**: aba/seção na página do funcionário `employees/[id]` (reusar `_ui/list`). Botão **Imprimir**
  (CSS `@media print` — sem lib de PDF; YAGNI).

## Regras verificáveis

- A ficha só mostra entregas do **próprio tenant** e do funcionário pedido (`withOrg` + RLS); funcionário
  de outro tenant → `NOT_FOUND`.
- Filtro `pendente`/`devolvido` bate com `returned_at` (coerência com US4).
- Ficha de funcionário sem entregas → lista vazia, não erro.

## Superfície de API

`GET /api/v1/employees/[id]/epi-record` (read-only; query `?status=&from=&to=&page=`). Server Action de
leitura espelho (ou a própria page consome o repo). Doc `api-design.md` + Postman.

## Testes

- Unit: montagem do filtro (status→`returned_at`, período), formatação de status de assinatura.
- Integração (Postgres efêmero): ficha não cruza tenant; filtros retornam o subconjunto correto;
  funcionário sem entregas → vazio; `FORBIDDEN` para `client`.

## Dependência

US2 (entrega) precisa existir para haver o que listar; US4 (devolução) **enriquece** a coluna "Data de
Devolução" mas a ficha funciona sem ela (mostra tudo como pendente).
