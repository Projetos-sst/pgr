# NOB-132, NOB-133 e NOB-116 — checkout, eventos do provedor, licenças e fatura por serviço

Etapa 2 do lote comercial (plano geral em `nob-115-plano-comercial.md`). Entrega o caminho entre a contratação registrada na etapa 1 e a licença: checkout hospedado, caixa de eventos, assinatura espelhada, direito de uso com motivo e fatura com PGR e Medicina separados.

## O que esta etapa não faz

- **Não habilita cobrança real.** O checkout comercial só chama o provedor com chave de teste (`sk_test_` ou `rk_test_`); com chave de produção ou sem chave responde `503 BILLING_UNAVAILABLE`. Evento com `livemode: true` não entra no fluxo comercial.
- **Não cria produto, preço nem chave.** A tabela item → preço do provedor nasce vazia. Sem preço cadastrado, o checkout recusa com `422`.
- **Não foi validada contra o Stripe.** Não há credencial neste ambiente. Todos os testes usam dublê do cliente Stripe e eventos montados no formato do SDK 22.3.1.
- **Não muda nada com a flag desligada.** Sem `COMMERCIAL_CATALOG_ENABLED=true`, toda rota nova responde `403` e o webhook segue o caminho antigo sem carregar código novo de banco.
- **Não tem tela.** As telas são das NOB-134 a 137.

## Caminho completo

1. O owner registra a contratação (etapa 1) e chama `POST /commercial-contracts/{id}/checkout` com uma chave de idempotência.
2. O servidor lê os itens copiados no contrato, resolve o preço do provedor de cada item em `billing_provider_prices` e calcula a quantidade. Preço e quantidade nunca vêm do cliente.
3. O provedor devolve a página de pagamento hospedada. A sessão fica em `billing_checkout_sessions` com o pagador e os direitos de uso que o contrato dá (empresa × serviço, ou Pro do escritório).
4. O provedor avisa pelo webhook `/api/webhooks/stripe` (o mesmo de hoje, com a mesma verificação de assinatura).
5. O webhook descobre o escritório pelo vínculo gravado no banco, grava o evento na caixa, atualiza o espelho da assinatura e os direitos de uso, e a função de reconciliação liga ou desliga a licença.
6. Os eventos de fatura gravam a fatura espelhada com uma linha por item, cada linha com o serviço.

## Checkout (NOB-132)

- **Identificador.** O id do checkout é derivado de `sha256(escritório + chave de idempotência)`. Ele vai para o provedor em `client_reference_id`, em `metadata.commercialCheckoutId` (sessão e assinatura) e na chave de idempotência do provedor. O `org_id` não vai para o provedor.
- **Repetição.** A mesma chave devolve a mesma sessão, sem chamar o provedor de novo. A mesma chave em outra contratação é `422`. Contratação com checkout aberto ou com assinatura já espelhada é `409`.
- **Quantidade.** Unidade `organization` cobra 1. Unidade `company` cobra o número de empresas do contrato. Unidades `employee` e `document` são recusadas (`422`) até a regra comercial ser aprovada.
- **Recusas (`422`).** Oferta avulsa (`one_time`, NOB-117); catálogo fictício em produção; vigência encerrada; contrato sem empresa para cobrar; item sem preço no provedor.

## Estados da assinatura (NOB-133)

O espelho (`billing_subscriptions`, uma linha por contrato) guarda o estado que o provedor informou. O banco nunca decide que algo foi pago.

| Estado               | Dá acesso | Motivo gravado no direito de uso  |
| -------------------- | --------- | --------------------------------- |
| `incomplete`         | Não       | `subscription_incomplete`         |
| `trialing`           | Sim       | `subscription_trialing`           |
| `active`             | Sim       | `subscription_active`             |
| `past_due`           | Não\*     | `payment_past_due`                |
| `unpaid`             | Não       | `subscription_unpaid`             |
| `paused`             | Não       | `subscription_paused`             |
| `canceled`           | Não       | `subscription_canceled`           |
| `incomplete_expired` | Não       | `subscription_incomplete_expired` |

\* Ver política de atraso.

Regras de transição (`domains/commercial/subscription.ts`):

- `canceled` e `incomplete_expired` são finais. Nenhum evento tira a assinatura deles.
- Nenhum estado volta para `incomplete`.
- Evento com data anterior ao último aplicado é descartado como `stale`.
- Evento de outra assinatura do provedor para o mesmo contrato é `ignored`.
- Cancelamento agendado (`cancel_at_period_end`) mantém o acesso até o provedor mandar `canceled`.

## Evento → efeito

| Evento do provedor                                                                                        | Efeito                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`                                                                              | Sessão `completed`; guarda o cliente do provedor do pagador; cria o espelho em `incomplete` e os direitos de uso inativos. **Não libera licença.**                |
| `checkout.session.expired`                                                                                | Sessão aberta vira `expired`. Nada mais muda.                                                                                                                     |
| `customer.subscription.created` / `updated`                                                               | Atualiza o espelho (estado, período, cancelamento agendado). Direito de uso segue a tabela de estados. Se o direito mudou de situação, reconcilia a licença.      |
| `customer.subscription.deleted`                                                                           | Espelho `canceled`; direitos inativos; reconcilia a licença.                                                                                                      |
| `invoice.finalized` / `paid` / `payment_failed` / `voided` / `marked_uncollectible`                       | Grava ou atualiza a fatura espelhada (`open`, `paid`, `void`, `uncollectible`) e, na primeira vez, os itens por serviço. **Fatura não liga nem desliga licença.** |
| Qualquer evento sem vínculo registrado, com `livemode: true`, de tipo não listado ou com a flag desligada | Segue o caminho antigo do webhook, igual a antes desta etapa.                                                                                                     |

Cada evento aplicado, descartado ou ignorado fica em `billing_events` (só inclusão) com resultado e detalhe. `UNIQUE(provider, provider_event_id)` e uma trava por contrato na mesma transação dos efeitos garantem que evento repetido ou entregue em paralelo não ativa duas vezes. O conteúdo bruto do evento não é guardado.

**Como o webhook acha o escritório.** O webhook não tem sessão e não confia em `org_id` do evento. Ele procura o id do checkout (do `metadata`) em `billing_checkout_sessions` ou a assinatura do provedor em `billing_subscriptions`. Essa leitura usa uma policy de capacidade (precedente: assinatura digital): a transação informa a referência em `app.billing_reference` e só enxerga a linha que tem exatamente esse valor, e só sem usuário na sessão. Achado o escritório, toda escrita passa por `withOrg(orgId)`.

**Quem grava o espelho.** As tabelas de espelho só aceitam escrita em transação sem usuário (`app.current_actor` vazio), que é o contexto do webhook. Nenhuma sessão de usuário, nem a do owner, grava pagamento, assinatura, direito de uso ou fatura. Owner e `org:admin` leem.

## Reconciliação e regra do legado

A licença continua sendo aplicada em `company_modules` (PGR e Medicina por empresa) e `orgs.plan` (Pro). O direito de uso (`commercial_entitlements`) é o motivo.

A única porta de escrita é a função `public.commercial_reconcile_grant(id do direito de uso)`:

- **Concede** só se a licença está desligada e nenhum outro direito já a concedeu. Marca `applied = true` no direito e grava o motivo em `company_module_events` com autor `system:commercial-billing`.
- **Não toca no que já estava ligado.** Empresa com serviço ligado à mão ou escritório já `pro` fica com `applied = false`: a licença é legado ou cortesia.
- **Revoga** só se algum direito do mesmo alvo tem `applied = true` e nenhum direito do alvo está ativo. **Linha sem direito de uso registrado, ou com `applied = false`, nunca é revogada.**
- Recusa quando há usuário na sessão ou quando o direito não é do escritório da transação.

A função é `SECURITY DEFINER` (a primeira do repositório) porque `company_modules` exige owner na policy e `orgs` não dá `UPDATE` ao `app_runtime`. Foi a alternativa a alterar policies existentes: nenhuma policy antiga, `with-org.ts` ou `module-policy.ts` mudou.

A reconciliação roda só quando o direito muda de situação. Consequência: se o owner desligar à mão um serviço concedido pela assinatura, ele fica desligado até a próxima mudança de situação da assinatura.

## Política provisória de atraso

`PROVISIONAL_DELINQUENCY_POLICY = { graceDays: 0 }`: `past_due` suspende na hora, igual ao Pro de hoje. É o padrão mais conservador para a receita e está pendente de aprovação comercial.

A função de acesso já aceita carência (`graceDays > 0` com o vencimento informado pelo provedor), coberta por teste de unidade. Para ligar a carência falta: passar o vencimento da fatura aberta ao cálculo e um job agendado que corte o acesso no fim da carência (sem evento novo do provedor, nada dispara o corte).

## Fatura por serviço (NOB-116)

- `billing_invoices` guarda cabeçalho (situação, moeda, total, vencimento, pagamento, período). `billing_invoice_items` guarda uma linha por item, só inclusão.
- O serviço de cada linha vem do preço do provedor da linha, pela tabela `billing_provider_prices` → item do catálogo. Linha de preço desconhecido fica `unclassified`, nunca somada a PGR ou Medicina.
- Se a soma das linhas difere do total (imposto, crédito, linha que o provedor não enviou), a diferença vira uma linha `unclassified` "Valor não discriminado pelo provedor". Assim PGR + Medicina + Pro + não classificado sempre fecha com o total.
- Fatura `paid` ou `void` não volta a `open`. Evento mais antigo que o último aplicado é `stale`.
- Consulta: `GET /commercial-invoices` (`?contractId`, paginada) e `GET /commercial-invoices/{id}`, com `totalsByService` e, no detalhe, `items`. Nenhum identificador do provedor sai na resposta.

## Superfície

| Rota                                       | Action                          |
| ------------------------------------------ | ------------------------------- |
| `POST /commercial-contracts/{id}/checkout` | `startCommercialCheckoutAction` |
| `GET /commercial-contracts/{id}/billing`   | `getCommercialBillingAction`    |
| `GET /commercial-invoices`                 | `listCommercialInvoicesAction`  |
| `GET /commercial-invoices/{id}`            | `getCommercialInvoiceAction`    |

Todas exigem owner e a flag. Detalhe em `docs/api/api-design.md`; requisições na coleção do Postman.

## Banco

Migration `0091_commercial_billing`, aditiva: oito tabelas novas e uma função. Nenhuma tabela, coluna ou policy existente foi alterada.

| Tabela                       | Escopo     | Escrita pelo `app_runtime`                                               |
| ---------------------------- | ---------- | ------------------------------------------------------------------------ |
| `billing_provider_prices`    | Global     | Nenhuma (só conexão owner, comando `map-price`)                          |
| `billing_provider_customers` | Escritório | Inclusão, só pelo webhook                                                |
| `billing_checkout_sessions`  | Escritório | Inclusão pelo owner; `status` e `completed_at` pelo webhook              |
| `billing_subscriptions`      | Escritório | Inclusão e colunas de estado, só pelo webhook                            |
| `billing_events`             | Escritório | Só inclusão, só pelo webhook                                             |
| `commercial_entitlements`    | Escritório | Inclusão, `status` e `reason`, só pelo webhook; `applied` só pela função |
| `billing_invoices`           | Escritório | Inclusão e colunas de situação, só pelo webhook                          |
| `billing_invoice_items`      | Escritório | Só inclusão, só pelo webhook                                             |

RLS com `USING` e `WITH CHECK` em todas. `commercial_entitlements` tem `company_id` e leva a policy de escopo por empresa da NOB-175. Sem `DELETE` em nenhuma.

## Pedido avulso (NOB-117)

**Regra.** Pedido avulso é a contratação de uma oferta `one_time` com itens `one_off` para uma única empresa. Não exige Pro nem assinatura prévia e vale também para empresa que já assina. O pagamento confirmado libera somente aquele pedido, para aquela empresa: nunca o módulo inteiro nem outro serviço.

**Criação.** `POST /commercial-one-off-orders` com `{offerId, companyId}` (só owner). A oferta precisa estar à venda, ser `one_time`, ter todos os itens `one_off` e escopo por empresa. O pagador é o cliente do escritório, que precisa estar cadastrado. Contrato (com cópia imutável de preço) e pedido nascem na mesma transação; `UNIQUE(org_id, contract_id)` garante um pedido por contratação.

**Checkout.** Mesma rota do contrato. A contratação `one_time` só abre checkout se tiver pedido e se todos os itens forem `one_off`; `employee` e `document` seguem recusados. A quantidade é sempre 1 (o pedido cobre uma empresa). A sessão é criada no modo de pagamento único, sem dados de assinatura, com o mesmo vínculo no `metadata` e a mesma chave de idempotência. Preço vem de `billing_provider_prices`. Só chave de teste; sem chave ou com chave de produção, `BILLING_UNAVAILABLE`. Pedido já pago recusa novo checkout (`409`) e pedido cancelado, `422`.

**Estados.**

| Estado      | Transições permitidas | Observação                                      |
| ----------- | --------------------- | ----------------------------------------------- |
| `pending`   | `paid`, `cancelled`   | nasce assim                                     |
| `paid`      | nenhuma               | gravado só pelo webhook (transação sem usuário) |
| `cancelled` | nenhuma               | sem operação para cancelar nesta etapa          |

**Evento → efeito.**

| Evento do provedor                                                         | Efeito                                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed` em modo `payment` com `payment_status = paid` | Fecha a sessão de checkout e marca o pedido como `paid` se ainda estiver `pending`. Repetição ou evento posterior não muda nada. |
| `checkout.session.async_payment_succeeded` em modo `payment`               | Mesmo efeito (pagamento assíncrono confirmado depois).                                                                           |
| `checkout.session.completed` em modo `payment` sem pagamento confirmado    | Ignorado; a sessão continua aberta até a confirmação.                                                                            |
| Qualquer evento com `livemode: true`                                       | Ignorado, como no fluxo recorrente.                                                                                              |

O escritório vem do vínculo do checkout gravado no banco, nunca do `org_id` do evento. O pedido pago não chama `commercial_reconcile_grant`, não grava `company_modules`, não altera `orgs.plan` e não cria espelho de assinatura nem direito de uso. Com a flag desligada o webhook segue o caminho antigo e o evento de pagamento único é ignorado.

**Autorização para os consumidores.** `requirePurchasedOneOff(ctx, orderId, companyId)` devolve o pedido pago daquela empresa ou lança `PaymentRequiredError` (`PAYMENT_REQUIRED`, `402`). Pedido de uma empresa não autoriza outra; pedido de outro escritório dá `404`. `isOneOffPurchased` é a versão booleana. `owner` gerencia o financeiro; `collaborator` só consulta a autorização (`GET /commercial-one-off-orders/{id}/authorization`); `client` recebe `403`.

**Pendências.**

1. Quais serviços avulsos existem e seus preços dependem de aprovação comercial. O catálogo usado nos testes é fictício (`ficticio-avulso-laudo`); nenhum preço real foi definido.
2. `checkout.session.async_payment_failed` ainda não é tratado: o pedido fica `pending`.
3. Cancelamento de pedido e estorno/reembolso não têm operação; o estado `cancelled` existe só no modelo.
4. Os consumidores (emissão de laudo, ASO etc.) ainda não chamam `requirePurchasedOneOff`; cada módulo decide onde aplicar.
5. Migration da tabela `commercial_one_off_orders` com GRANT por coluna (`SELECT`, `INSERT`, `UPDATE` só de `status`, `provider_payment_ref` e `paid_at`) é gerada pelo drizzle-kit à parte.
6. Adicionar `checkout.session.async_payment_succeeded` ao endpoint do webhook de teste do provedor.

## Telas de assinatura e faturas (NOB-135, NOB-136)

Entregue, atrás da mesma flag e só para o owner:

- `/plans/subscription`: ficha por contratação com oferta, itens e valores do snapshot, empresas atendidas e teste da empresa. **Pagamento** (situação espelhada do provedor, período, renovação, cancelamento agendado) e **Acesso** (direitos de uso) aparecem em blocos separados.
- Acesso tem quatro estados: liberado (direito ativo aplicado), legado ou cortesia (direito ativo com `applied=false`), suspenso e sem direito registrado. Direito inativo com `applied=false` conta como suspenso, porque toda contratação ainda não paga nasce assim.
- Cancelamento agendado não remove acesso antes do fim do período: a ficha mostra "mantido até" a data de fim.
- As ações vêm do servidor: `manage_in_portal` (há cliente no provedor) e `resume_checkout` (há checkout aberto). Sem pagamento disponível no ambiente, nenhuma ação.
- `/plans/invoices`: faturas espelhadas, paginadas, com valor em reais, competência, vencimento, situação e valor por serviço. Texto fixo: fatura de cobrança não é nota fiscal.
- Portal do provedor: `POST /api/v1/commercial-contracts/{id}/portal-session` devolve só a URL temporária. O cliente do provedor é resolvido no servidor pelo pagador da contratação; só funciona com chave de teste.
- Método de pagamento: nada de cartão é guardado nem exibido. A tela diz "Gerenciado no portal do provedor".

Pendências:

- Mudança de plano com cotação própria (`quoteId`, proporcionalidade, efeito imediato ou no fim do ciclo): não implementada, a política não foi aprovada. Hoje a troca é feita no portal.
- Cancelamento e reativação próprios: idem, ficam no portal.
- Método de pagamento mascarado: depende de leitura na API do provedor.
- O que o cliente altera no portal chega pelos eventos já tratados (assinatura e fatura); não há sincronização extra.
- Nenhuma das telas foi aberta em navegador nem contra o provedor: falta conta de teste.

## O que falta para ligar o modo de teste do provedor

1. **Conta de teste do Stripe** e as chaves no ambiente: `STRIPE_SECRET_KEY` com chave `sk_test_` (ou restrita `rk_test_`) e `STRIPE_WEBHOOK_SECRET` do endpoint de teste.
2. **Produtos e preços recorrentes de teste** no painel do Stripe, um por item do catálogo, na mesma periodicidade da oferta.
3. **Mapear cada item:** `COMMERCIAL_CATALOG_OPERATOR=<quem> npx tsx scripts/commercial-catalog.ts map-price <id-da-versao> <posicao-do-item> <price_...>`.
4. **Endpoint do webhook** `https://<host>/api/webhooks/stripe` com os eventos: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`.
5. **Flags** no ambiente de teste: `COMMERCIAL_CATALOG_ENABLED=true` e `APP_ENV` diferente de `production` enquanto o catálogo for fictício.
6. **Rodar a matriz da NOB-138** com cartões de teste e conferir, contra o provedor real, o formato dos eventos (em especial `invoice.parent.subscription_details` e o preço de cada linha).

Produção fica bloqueada no código pela checagem da chave de teste. Liberar produção é uma mudança de código à parte, depois da aprovação comercial e da homologação.

## Pendências

Para o comercial decidir:

1. Política de atraso: carência em dias e o que o cliente vê durante o atraso. Hoje 0 dias.
2. Quantidade para itens por funcionário e por documento (faixas, medição, arredondamento). Hoje o checkout recusa.
3. Convivência do Pro novo com o Pro antigo: um escritório `pro` pelo fluxo antigo que contrate o Pro novo fica com as duas assinaturas no provedor. O fluxo antigo não foi alterado.
4. Se o owner pode desligar à mão um serviço pago e por quanto tempo isso vale.

Técnicas:

1. Validar o formato real dos eventos no modo de teste do provedor (item 6 acima).
2. O webhook do provedor traz no máximo 10 linhas por fatura. Fatura maior fica com a diferença como "não discriminado" até existir a busca das linhas restantes na API do provedor.
3. Job agendado para o corte ao fim da carência, se a carência for aprovada.
4. Imposto destacado por serviço: hoje entra como diferença não classificada.
5. Quem é o operador da plataforma (NOB-137): segue sendo quem tem a conexão owner.
6. Revisão de segurança da função `SECURITY DEFINER` antes de produção.
