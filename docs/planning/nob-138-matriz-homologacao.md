# NOB-138 — Matriz de homologação da cobrança, das telas e do isolamento

## Situação

**A homologação no provedor não foi executada.** Não há conta de teste do Stripe nem usuário de teste do Clerk neste ambiente. Nenhuma tela foi aberta em navegador e nenhuma chamada foi feita ao provedor.

O que existe hoje é a prova automatizada: 202 testes de integração do lote comercial rodando em Postgres real e efêmero, com o provedor substituído por dublê e os eventos entregues pelo mesmo caminho do webhook. Eles cobrem a regra do servidor. Não cobrem o formato real dos eventos do provedor, o checkout hospedado, o portal nem o comportamento das telas no navegador.

A coluna "Provedor (teste)" abaixo fica em branco até a execução. A cobrança real continua desligada.

## Como rodar a prova automatizada

```bash
INTEGRATION_DATABASE_URL=<postgres efêmero> npx jest --selectProjects integration --runInBand src/__tests__/integration/platform
```

Arquivos: `commercial-catalog`, `commercial-checkout`, `commercial-billing-events`, `commercial-invoices`, `commercial-one-off-orders`, `commercial-trials`, `commercial-interests`, `commercial-plans-overview`, `commercial-subscription-sheet` e `commercial-admin-subscriptions` (todos `.test.ts` em `src/__tests__/integration/platform/`).

## Matriz

| #   | Cenário                                    | Prova automatizada (arquivo: teste)                                                                                                                           | Provedor (teste) |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Sucesso: checkout pago libera o contratado | `billing-events`: "registra o motivo da licença no histórico do serviço e o cliente do provedor do pagador"                                                   | pendente         |
| 2   | Ação adicional (3DS) antes de pagar        | `billing-events`: "o retorno do checkout sem evento de assinatura não libera nada"                                                                            | pendente         |
| 3   | Recusa de pagamento                        | `invoices`: "falha de pagamento mantém a fatura aberta e a fatura sozinha não liga nem desliga licença"                                                       | pendente         |
| 4   | Checkout abandonado ou expirado            | `billing-events`: "checkout expirado fecha a sessão e não cria assinatura"                                                                                    | pendente         |
| 5   | Renovação                                  | `billing-events`: "falha e atraso suspendem, recuperação religa, renovação mantém, cancelamento agendado mantém e cancelamento encerra"                       | pendente         |
| 6   | Atraso                                     | mesmo teste do item 5 (política provisória de atraso)                                                                                                         | pendente         |
| 7   | Recuperação após atraso                    | mesmo teste do item 5                                                                                                                                         | pendente         |
| 8   | Cancelamento agendado e imediato           | item 5 e `subscription-sheet` (unitário): cancelamento agendado mantém acesso até o fim do período                                                            | pendente         |
| 9   | Reativação pelo portal                     | sem prova própria: depende do evento real do provedor                                                                                                         | pendente         |
| 10  | Evento duplicado                           | `billing-events`: "evento repetido é registrado uma vez" e "o mesmo evento entregue em paralelo é processado uma única vez"                                   | pendente         |
| 11  | Evento fora de ordem                       | `billing-events`: "assinatura que chega antes do retorno do checkout", "evento antigo entregue depois não desfaz o estado mais novo"                          | pendente         |
| 12  | Requisição repetida no checkout            | `checkout`: "a mesma chave devolve a mesma sessão sem chamar o provedor de novo, inclusive em paralelo"                                                       | pendente         |
| 13  | Provedor indisponível                      | `checkout`: "falha do provedor não grava sessão e a mesma chave pode ser repetida depois"; `admin-subscriptions`: "sem a fonte grava source_unavailable"      | pendente         |
| 14  | Reconciliação                              | `admin-subscriptions`: "corrige a divergência, liga o serviço uma vez e audita", "é repetível", "não cria cobrança, checkout nem fatura"                      | pendente         |
| 15  | Teste de 15 dias e emissão                 | `trials`: "teste ativo ou expirado sem direito pago bloqueia a emissão final", "a prévia segue livre durante o teste", "direito pago de PGR libera"           | não se aplica    |
| 16  | PGR e Medicina independentes               | `trials`: "só Medicina paga e Pro do escritório não liberam o PGR"; `invoices`: "PGR e Medicina para duas empresas traz os dois valores separados"            | pendente         |
| 17  | Pedido avulso                              | `one-off-orders`: "o pagamento confirmado marca o pedido como pago uma única vez", "pedido pago não liga módulo, não altera o plano"                          | pendente         |
| 18  | Legado e cortesia nunca revogados          | `billing-events`: "Pro legado continua pro depois de qualquer evento", "serviço ligado à mão antes da contratação continua ligado"                            | não se aplica    |
| 19  | Isolamento entre dois escritórios          | `billing-events`: "outra organização não consulta a cobrança nem enxerga espelho, eventos ou direitos no banco"; idem em `invoices`, `checkout`, `one-off`    | pendente         |
| 20  | Escritório nunca vem do evento             | `billing-events`: "o escritório vem do checkout registrado, nunca do que o evento diz"                                                                        | pendente         |
| 21  | Sessão de usuário não forja cobrança       | `billing-events`: "sessão de usuário, mesmo do administrador, não forja assinatura, direito, evento nem cliente do provedor"                                  | não se aplica    |
| 22  | Evento de produção ignorado                | `billing-events`: "evento de produção (livemode) nunca entra no fluxo comercial"                                                                              | pendente         |
| 23  | Papéis                                     | `subscription-sheet`, `plans-overview`, `invoices`: colaborador e cliente sem dado financeiro; `admin-subscriptions`: só `is_master`, conferido no banco      | pendente         |
| 24  | Flag desligada                             | todos os arquivos têm o caso "flag desligada": `FORBIDDEN`, nada gravado, webhook no caminho antigo                                                           | não se aplica    |
| 25  | Telas responsivas (celular, tablet, mesa)  | só teste de componente em jsdom (`plans-commercial`, `plans-subscription-invoices`, `admin-subscriptions-screens`). **Nenhuma tela foi aberta em navegador.** | pendente         |

## Roteiro da execução no provedor

Pré-requisitos, na ordem:

1. Conta de teste do Stripe; `STRIPE_SECRET_KEY` com chave `sk_test_` ou `rk_test_` e `STRIPE_WEBHOOK_SECRET` do endpoint de teste.
2. Produtos e preços de teste criados no provedor e mapeados com `scripts/commercial-catalog.ts` (o checkout recusa item sem mapeamento).
3. `COMMERCIAL_CATALOG_ENABLED=true` só no ambiente de homologação.
4. Dois escritórios com dados fictícios e um usuário de teste do Clerk em cada; um usuário com `is_master` para o painel.
5. Endpoint do webhook de teste com os eventos de checkout, assinatura e fatura, incluindo `checkout.session.async_payment_succeeded`.

Execução: para cada linha da matriz, usar os cartões de teste do provedor (sucesso, 3DS, recusa) e os relógios de teste para renovação, atraso e recuperação. Conferir, a cada passo, a ficha `/plans/subscription`, as faturas `/plans/invoices`, o painel `/admin-global/subscriptions` e a habilitação real do serviço na empresa. Reenviar eventos pelo painel do provedor para as linhas 10 e 11.

## Registro da execução

Preencher quando a homologação rodar:

| Campo                       | Valor                                    |
| --------------------------- | ---------------------------------------- |
| Versão (commit)             |                                          |
| Ambiente                    |                                          |
| Data                        |                                          |
| Resultado por linha         | (na coluna "Provedor (teste)" da matriz) |
| Falhas e defeitos           |                                          |
| Aprovador comercial         |                                          |
| Aprovador técnico/segurança |                                          |

## Riscos de migração a conferir antes de produção

1. Escritório já `pro` pelo fluxo antigo que contrate o Pro novo fica com duas assinaturas no provedor.
2. Empresas com serviço ligado à mão viram direito legado: nunca são desligadas pelo fluxo novo. Conferir a lista antes de ligar a flag.
3. O prazo do teste por empresa é 15 dias em constante provisória; o teste do Pro antigo segue com 7.
4. A política de atraso é provisória. Mudar a carência depois altera quando o acesso é suspenso.
5. Revisão de segurança pendente: função `SECURITY DEFINER` `commercial_reconcile_grant` e as policies de leitura do operador da plataforma (`*_platform_operator`).
6. Migrations `0090` a `0095` são aditivas, mas a `0095` altera duas policies existentes de `commercial_contracts` e `commercial_contract_items` para o operador ler.
