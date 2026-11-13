# NOB-131 — Oferta, regras comerciais e provedor de pagamento

Escrito em 13/11/2026. Registra o que o código já faz com o Stripe, o que falta para homologar e as decisões que o comercial ainda não tomou.

**Situação da issue: parcial.** O aceite pede decisão de provedor registrada, oferta aprovada sem valor fictício e ambiente de teste definido. Nada disso foi aprovado por alguém do comercial. Este documento não substitui a ata. O que está pronto é a base técnica para validar com catálogo fictício identificado.

**Fontes.** Só o código da branch. O documento "Assinatura Pro — telas, APIs e pesquisa de gateways" do Linear, com a comparação entre Stripe, Asaas e Mercado Pago, não pôde ser lido (Linear desconectado). Tarifa, prazo de liquidação e elegibilidade de conta não aparecem aqui com número: estão marcados "a verificar".

## Stripe já integrado × necessidades

| Necessidade          | O que o código faz hoje                                                                                                  | Situação                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Cartão               | Checkout hospedado em modo assinatura (`createProCheckoutSession`). O cartão nunca passa pela aplicação                  | Implementado. Não homologado: não há registro de execução com conta real ou de teste                        |
| Recorrência          | Uma assinatura por escritório, um preço (`STRIPE_PRICE_ID_PRO`), teste de 7 dias                                         | Implementado só para o Pro. Não cobre PGR e Medicina por empresa nem mais de um item                        |
| Portal               | Portal hospedado (`createBillingPortalSession`) para cartão, faturas e cancelamento. Exige cliente já criado no provedor | Implementado. A configuração do Portal na conta (o que o cliente pode fazer) não está registrada            |
| Eventos              | Webhook com assinatura verificada. Trata `checkout.session.completed` e `customer.subscription.created/updated/deleted`  | Implementado. Sem caixa de eventos: repetição e ordem dependem de a escrita ser idempotente por natureza    |
| Estado local         | `planFromSubscriptionStatus`: `active` e `trialing` viram `pro`, o resto vira `free`                                     | Implementado. Atraso (`past_due`) tira o Pro na hora. Não há política de tolerância                         |
| Pix                  | Nada                                                                                                                     | **A verificar** se a conta e o país permitem Pix e se há Pix recorrente. Sem fonte conferida nesta etapa    |
| Cobrança por empresa | Nada. O cliente no provedor é o escritório (`orgs.stripe_customer_id`)                                                   | Depende da decisão de pagador. Desenho no plano do lote (`billing_provider_customers`)                      |
| Avulso               | Nada                                                                                                                     | Depende do catálogo de avulsos                                                                              |
| Nota fiscal          | Nada                                                                                                                     | Fora do escopo declarado. **A verificar** com o comercial e a contabilidade                                 |
| Tarifa e liquidação  | Não se aplica ao código                                                                                                  | **A verificar** na fonte oficial do provedor, para a conta e o país do contratante                          |
| Outro provedor       | Nada. Não há interface de gateway: o código chama o SDK do Stripe em `integrations/stripe/client.ts`                     | A issue cita Asaas se Pix automático for requisito. **A verificar.** Só criar a interface se houver segundo |

## Homologado e não homologado

Não há evidência, no repositório, de nenhum fluxo de pagamento executado contra o Stripe, nem em modo de teste. Os testes existentes simulam o SDK (`billing-core.test.ts`, `orgs-billing.test.ts`). Portanto:

- **Homologado:** nada.
- **Coberto por teste automatizado, com o SDK simulado:** checkout e portal só para o owner, portal sem cliente no provedor respondendo `BILLING_UNAVAILABLE`, sincronização de `orgs.plan` a partir de três eventos (checkout concluído, assinatura em teste, assinatura excluída) e unicidade de `stripe_customer_id` por escritório.
- **Sem teste automatizado:** a rota do webhook (assinatura ausente ou inválida) e a resposta `503` sem `STRIPE_SECRET_KEY`.
- **Não homologado:** checkout real com cartão de teste, renovação, falha de pagamento, recuperação, cancelamento, Portal, Pix, mais de um item por assinatura.

## Credenciais e ambiente de teste necessários

| Item                                    | Para quê                                                 | Quem fornece  |
| --------------------------------------- | -------------------------------------------------------- | ------------- |
| Conta Stripe em nome do contratante     | Elegibilidade, país e meios de pagamento                 | Comercial     |
| Chave secreta do modo de teste          | `STRIPE_SECRET_KEY` no ambiente de homologação           | Dono da conta |
| Segredo do webhook de teste             | `STRIPE_WEBHOOK_SECRET`; endpoint `/api/webhooks/stripe` | Dono da conta |
| Produto e preço de teste do Pro         | `STRIPE_PRICE_ID_PRO`                                    | Dono da conta |
| Configuração do Portal no modo de teste | O que o cliente pode alterar e cancelar                  | Dono da conta |
| URL pública do ambiente de homologação  | `NEXT_PUBLIC_APP_URL` para os retornos do checkout       | Engenharia    |

Nenhuma chave, preço ou produto real entra nesta etapa. As variáveis continuam vazias no `.env.example`, e sem `STRIPE_SECRET_KEY` o código responde `503 BILLING_UNAVAILABLE`.

## Conflito registrado: teste de 15 dias × 7 dias

As issues NOB-131, NOB-115 e NOB-118 falam em teste de 15 dias. O código cobra o Pro com teste de 7 dias (`TRIAL_DAYS = 7` em `domains/platform/billing.ts`, enviado ao Stripe no checkout). **Nada foi alterado.** Mudar o número muda a cobrança de quem assinar depois, então é decisão do comercial. O simulador (#128) criou um teste de 15 dias por empresa, separado do teste do Stripe; essa separação também precisa ser decidida.

## Decisões pendentes do comercial

| #   | Decisão              | O que precisa ser respondido                                                         | Padrão conservador aplicado até lá                                                      |
| --- | -------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | Catálogo             | Quais ofertas existem: PGR, Medicina, os dois, Pro, e quais avulsos                  | Só catálogo fictício (`ficticio-*`), fora de produção                                   |
| 2   | Pagador              | A empresa paga, a consultoria paga, ou os dois modelos convivem                      | O modelo aceita os dois, por vínculo explícito. Nenhum é cobrado                        |
| 3   | Periodicidade        | Mensal, anual, avulso; desconto anual                                                | O catálogo aceita `monthly`, `annual` e `one_time`. Nenhuma regra de desconto           |
| 4   | Valores              | Preço de cada item, em reais                                                         | Valores de teste repetitivos (R$ 111,11, R$ 222,22). Não são proposta                   |
| 5   | Unidade de cobrança  | Por escritório, por empresa, por funcionário, por documento; faixas                  | O item guarda unidade e valor unitário. Nenhum cálculo de total                         |
| 6   | Cotas                | Limites por plano (empresas, funcionários, sugestões de IA, assinaturas)             | Cotas atuais do código inalteradas (IA 20/mês e assinatura 10/mês no gratuito)          |
| 7   | Troca de plano       | Na hora ou no fim do período; rateio                                                 | Não implementado. Trocar é contratar de novo                                            |
| 8   | Cancelamento         | Na hora ou no fim do período; reembolso                                              | Só o que o Portal do Stripe já oferece para o Pro                                       |
| 9   | Atraso               | Tolerância, suspensão, o que acontece com documentos já emitidos                     | Comportamento atual inalterado: fora de `active` e `trialing`, o plano volta a gratuito |
| 10  | Teste                | 7 ou 15 dias, com ou sem cartão, por escritório ou por empresa, o que fica bloqueado | 7 dias do código atual. Sem mudança                                                     |
| 11  | Contratos existentes | Como ficam o Pro atual e as empresas com serviço ligado à mão                        | Continuam valendo. Nenhuma revogação                                                    |
| 12  | Provedor e conta     | Stripe confirmado, ou outro por causa do Pix; conta e país                           | Stripe, por já estar integrado. Sem interface para segundo provedor                     |
| 13  | Nota fiscal          | Quem emite e por onde                                                                | Fora do escopo                                                                          |

Cada linha respondida deve virar ata ou tabela versionada com a referência da aprovação. Essa referência é o campo `approvalReference` exigido para publicar uma oferta não fictícia.

## O que esta etapa entregou em código

Só contrato de domínio, sem rede e sem banco, em `src/shared/domains/commercial/`:

- `offer.ts`: formato da versão de oferta (itens, valor em centavos, moeda, unidade, periodicidade, cotas, vigência), regra de identificação do fictício (flag e prefixo juntos; oferta real exige referência de aprovação), estado da versão, oferta vigente por código e as duas travas de ambiente (`COMMERCIAL_CATALOG_ENABLED`; fictício nunca em produção nem com `APP_ENV` vazio).
- `fictitious-catalog.ts`: cinco ofertas de teste, todas marcadas como fictícias.

Testes em `src/__tests__/unit/domains/commercial/offer.test.ts`.
