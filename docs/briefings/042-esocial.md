# Briefing — Fase 10: eSocial SST

PR única consolidando as 3 fatias da Fase 10 (issues #96, #100, #103). Base
`feature/fase-09-psicossocial` (empilhada p/ chainar a migration `0022` e herdar o `.gitattributes`
LF). **Migration nova `0022_esocial`.**

## Módulo

Ciclo completo dos eventos SST do eSocial: **gerar** (a partir dos dados do SST Manager) → **enviar
em lote** → **consultar retorno**. 7 eventos: S-2190, S-2200, S-2210, S-2220, S-2221, S-2240, S-2300.

## 01 (#96) — Modelo de dados

Migration `0022_esocial`: 3 enums (`esocial_event_type`, `esocial_event_status`
`draft|pending|sent|accepted|rejected|error`, `esocial_batch_status`) + 2 tabelas tenant-isoladas
(RLS `app_runtime`): `esocial_events` (`event_type`, `reference_id` **polimórfico** — sem FK física,
pois as tabelas de origem variam e algumas ainda não existem; `payload` **texto** com o XML;
`status`; `batch_id → esocial_batches`; `government_response`) e `esocial_batches` (`protocol_number`,
`status`, `sent_at`, `response_received_at`, `raw_response`). Índices `(org_id, status)` e
`(org_id, event_type)`.

## 02 (#100) — Geração de eventos

- **Builders puros** por tipo em `domains/esocial/builders.ts` (registry `esocialBuilders`): cada um
  tem schema **zod** de entrada + monta o XML. Cabeçalho `ideEvento` com **`ambientePadrao="Producao"`**
  fixo (`tpAmb=1`). Helper `xml.ts` (escape + envelope).
- Server Actions: `generateEventAction(type, input)` (genérica, valida pelo schema do tipo) +
  `generateS2200FromEmployeeAction(employeeId)` e `generateS2240FromRiskAction(riskId, employeeId,
dataInicio)` — leem a fonte **no tenant** (funcionário/inventário de riscos: código do agente nocivo
  - unidade de medida eSocial). Fonte cross-tenant ou agente sem código → `422 FK_NOT_FOUND`. Evento
    persiste com status `pending`.

## 03 (#103) — Envio/consulta em lote + UI

- Repositório: `listEvents` (filtros `status`/`eventType`/`dateFrom`/`dateTo` + paginação),
  `sendBatch(eventIds)` (transação: agrupa só os `pending` do tenant, cria lote com protocolo, marca
  `sent`; ids não-pending/cross-tenant **ignorados**), `queryBatchReturn(batchId)` (**simulado** — sem
  transmissão externa real; marca eventos `accepted` + lote `processed`), `generateReport(filters)`.
- UI `/esocial`: filtros (Data Inicial/Final/Status) + tabela com **seleção múltipla** (só `pending`) +
  ações de lote (Enviar selecionados / Consultar retorno) + relatório; `/esocial/detalhe/[id]` mostra o
  payload XML + retorno do governo.

## Superfície (mandato de 4 partes)

Server Actions (`officeAction`) + REST `/api/v1/esocial-events(/{id})` + `/esocial-batches(/{id}/
return)` + `api-design.md` + Postman ("eSocial (SST)").

## Nota de escopo

O **envio/consulta ao governo é simulado** (stub de protocolo/retorno) — não há chamada externa real,
portanto **sem emenda de constituição** (Princípio II). A integração real com o webservice do eSocial
fica para uma fatia futura, plugando no mesmo fluxo de lote.

## Erros

Reusa `VALIDATION` (zod dos builders/filtros), `FK_NOT_FOUND` (fonte cross-tenant/agente sem código),
`NOT_FOUND`, `FORBIDDEN`. Sem novos códigos.

## Testes

- **Unit**: 7 builders geram XML com `ambientePadrao=Producao`; zod rejeita CPF/CNPJ inválidos e
  campos faltantes; escape XML; regras de status; filtros; projeção.
- **Integração** (Postgres efêmero): create+get+isolamento, fontes funcionário/risco escopadas ao
  tenant (cross-tenant → null), envio de lote (só `pending`, ids de outro tenant ignorados), consulta
  de retorno (`accepted`), filtro por status. Migration validada **0000→0022** em banco limpo.
