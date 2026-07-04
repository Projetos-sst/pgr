# Briefing US2+US3 — Entrega de EPI com assinatura digital

> Issue **#19**. Fluxo narrado em panorama **F4** + camada de assinatura **§5**. Decisões-mãe: **D1**
> (assinatura inline), **D2** (`applyStockExit`), **D3** (baixa na confirmação) do
> [brainstorming](./fase02-epi-completion-brainstorming.md). **Zero migration.**

## Escopo

Entregar N EPIs a um funcionário, dar **baixa transacional** de estoque no ato e capturar a **assinatura
de recebimento** por um de 3 métodos (manual, QR, link). US2 = entrega + baixa + assinatura manual.
US3 = assinatura pública (QR/link).

## Modelo (já em `develop`, fatia 008 — não alterar)

```
epi_deliveries        (employee_id, delivery_date, signature_status, auth_token?)
  └─ epi_delivery_items (delivery_id, catalog_id, quantity)
  └─ stock_movements    (type=employee_delivery, delivery_id=↑, decrementa balance)
```

`epi_signature_status`: `pending → signed_manual | signed_qr | signed_link`. `auth_token` único quando
presente (índice `uq_epi_deliveries_auth_token`).

## US2 — Entrega + baixa + assinatura manual (P1)

1. **Extrair `applyStockExit`** (D2) de `registerStockExit` (`repositories/stock-movements.ts`):
   `applyStockExit(tx, {stockId, quantity, deliveryId, type})` fazendo `SELECT … FOR UPDATE` →
   valida `balance - quantity >= 0` (senão `InsufficientStockError`) → INSERT movimento + UPDATE saldo.
   `registerStockExit` (#72) passa a chamá-lo. **Comportamento e testes da #72 preservados.**
2. **`createDelivery`** (repository, dentro de `withOrg` + transação): cria `epi_deliveries` (`pending`)
   + N `epi_delivery_items` + para cada item `applyStockExit(..., type='employee_delivery')`. Falha em
   qualquer item → **rollback total**. Alerta (não erro) se o saldo cair abaixo da mínima.
3. **`signDeliveryManual`**: seta `signature_status = signed_manual` + timestamp. Só a partir de
   `pending`; reassinar → erro `ALREADY_SIGNED` (409).
4. **UI** (entrada na página do funcionário `employees/[id]`): seleção de itens **com saldo disponível**
   (`checkbox · CA · EPI · Tam. · Und. · Fabricante · Disponível · Quantidade`, busca por CA/nome) →
   modal "Preparar entrega" (data, funcionário) → confirmar. Botão "Registrar assinatura manual".

## US3 — Assinatura pública QR/link (P1)

- **Gerar token** ao escolher QR/link: `auth_token` curto, imprevisível, TTL **72h** (padrão da
  referência #67). QR = data-URL do token; link = mesma rota enviada por contato do funcionário.
- **Rota pública** `app/(public)/sign/[token]/page.tsx` — adicionar `/sign/(.*)` ao `isPublicRoute` do
  `src/proxy.ts` (padrão `sign-in`/`webhooks`, sem tenant, sem Clerk). Valida token (existe, não
  expirado, entrega ainda `pending`), mostra os itens e o **signature-pad**; ao confirmar, grava a
  imagem + `signature_status = signed_qr` (QR) ou `signed_link` (link) + timestamp.
- **Painel interno "Aguardando confirmação"** na página da entrega: polling do `signature_status` até
  `signed_*`. (SSE é YAGNI — polling simples basta.)
- **Segurança**: token é a única credencial → sem enumeração, rate-limit na rota pública, expira,
  1 token por entrega. Não expõe nada de outro tenant.

## Regras verificáveis

- Saldo insuficiente em qualquer item → **rollback total** + `INSUFFICIENT_STOCK` (422); nada é gravado.
- Baixa ocorre na **confirmação** (D3); assinatura pode completar depois (`pending` persiste).
- **Excluir entrega assinada = proibido** (`FORBIDDEN`/regra); retorno de saldo é só via devolução (US4).
- Entrega só enxerga funcionários e estoque do **próprio tenant** (`withOrg` + RLS).
- Token expirado/entrega já assinada na rota pública → mensagem clara, sem 500.

## Superfície de API (os 4 juntos)

`POST/GET /api/v1/epi-deliveries` · `GET/PUT/DELETE /api/v1/epi-deliveries/[id]` (DELETE barrado se
assinada) · `POST /api/v1/epi-deliveries/[id]/sign` (manual). Rota pública `GET/POST /sign/[token]`
(fora do `/api/v1`, sem tenant). Doc em `api-design.md` + Postman.

## Testes

- Unit: `applyStockExit` (extração preserva #72), rollback em item insuficiente, transição
  `pending→signed_*` e `ALREADY_SIGNED`, geração/validação de token (expiração).
- Integração (Postgres efêmero): baixa atômica multi-item; `INSUFFICIENT_STOCK` deixa saldo intacto;
  assinatura pública muda status **sem** tenant no contexto e sem vazar entre orgs; DELETE de entrega
  assinada barrado; `NOT_FOUND` cross-tenant; `FORBIDDEN` para `client`.

## Referência (não mergear)

Branches `feature/ppe-delivery-with-signature` e `feature/digital-signature-infra`: token 72h, QR,
signature-pad, rota pública, wizard. Salvar a **lógica**, reimplementar limpo sobre `develop`.
