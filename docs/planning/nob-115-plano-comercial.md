# NOB-115 — Plano de integração do lote comercial

Escrito em 13/11/2026 sobre a branch `NOB-172-feat/menus-cadastro-seguranca` (migrations até `0090`). É o mapa das 14 issues comerciais (NOB-114 a 119 e NOB-131 a 138) para que as próximas etapas usem o mesmo modelo.

**Limite desta leitura.** O Linear estava desconectado. O texto integral existe só para NOB-114, NOB-131 e NOB-115. Das outras onze, o escopo abaixo vem do título no handoff da NOB-96 e do corpo da PR de simulação correspondente (#122 a #135, todas em rascunho). Antes de implementar cada uma, confira a descrição no Linear.

## O que nunca muda neste lote

- Nenhuma cobrança real é ligada sem aprovação comercial e homologação do provedor (NOB-131 e NOB-138).
- `orgs.plan` (`free|pro`) e `company_modules` continuam valendo para quem já tem. Nenhuma etapa revoga licença existente.
- O catálogo é fictício até a aprovação: flag `fictitious`, código com prefixo `ficticio-`, só fora de produção.
- Toda superfície nova nasce desligada (`COMMERCIAL_CATALOG_ENABLED`).

## O que existe hoje, por relação comercial

| Relação                        | O que a branch tem                                                                                                                                                                                            | Fonte da verdade                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Plataforma cobra o escritório  | Stripe: Checkout hospedado do Pro (`startProCheckout`), Portal (`openBillingPortal`), webhook `/api/webhooks/stripe`. Um preço só, vindo de `STRIPE_PRICE_ID_PRO`. Teste de 7 dias (`TRIAL_DAYS`).            | Stripe; `orgs.plan` é o espelho |
| Licença Pro do escritório      | `orgs.plan`, `orgs.stripe_customer_id`, `orgs.stripe_subscription_id`, `orgs.trial_ends_at`. Usada em `tenant/plan.ts` (equipe, cota de assinatura e de IA).                                                  | `orgs.plan`                     |
| Serviço por empresa            | `company_modules` (`pgr`, `medicine`, `enabled`) e `company_module_events`. O owner liga e desliga à mão em `/companies/{id}/services`. As policies de RLS dos módulos leem essa tabela (`module-policy.ts`). | `company_modules`               |
| Escritório oferta ao cliente   | `pgr_basic_offer_versions` (0058): texto da oferta de PGR básico do escritório, com preço declarado, publicação e eventos. Não é contratação nem cobrança.                                                    | Tabela do escritório            |
| Clientes, catálogo e contratos | Novo nesta etapa (0090): `commercial_*`. Registro comercial sem cobrança e sem efeito em licença.                                                                                                             | Tabelas `commercial_*`          |

## Por que não estender a oferta básica (0058) nem o Stripe atual

- **0058.** É a oferta que o escritório descreve para os clientes dele: público, escopo técnico, limites e um preço declarado, tudo em um JSON por escritório. Quem escreve é o owner. O catálogo comercial da plataforma tem outro dono (a plataforma vende para o escritório ou para a empresa) e outro risco: se o pagador pudesse gravar o preço que ele mesmo paga, o preço não valeria nada. Por isso o catálogo não reaproveita a tabela. Ele reaproveita o desenho: versão numerada, publicação separada do rascunho, histórico só de inclusão e referência de aprovação comercial.
- **Stripe.** O código atual conhece um produto (Pro) e um preço fixo por variável de ambiente. Não tem itens, moeda, unidade, cota nem vigência. O catálogo novo é a origem desses dados. O Stripe continua sendo quem cobra: a NOB-132 liga cada item publicado a um preço do provedor.

## Modelo de dados alvo

Entregue nesta etapa (migration `0091_commercial_catalog_and_contracts`):

| Tabela                          | Escopo                | Chave e vínculos                                                                                  | Regras                                                                                                                                                                      |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commercial_offer_versions`     | Global da plataforma  | `id`; `UNIQUE(code, version)`                                                                     | Nome, escopo (`organization` ou `company`), moeda `BRL`, periodicidade, cotas, vigência, `fictitious`, referência de aprovação, publicação e desativação. Conteúdo imutável |
| `commercial_offer_items`        | Global da plataforma  | `id`; `offer_version_id`                                                                          | Serviço (`pgr`, `medicine`, `pro`, `one_off`), rótulo, unidade, valor unitário em centavos. Imutável depois de publicada                                                    |
| `commercial_customers`          | Escritório (`org_id`) | `id`; `(company_id, org_id)` → `companies`; uma consultoria por escritório; uma linha por empresa | Quem paga. `office`: a consultoria, com razão social e documento próprios. `company`: cliente direto, identidade lida do cadastro da empresa                                |
| `commercial_contracts`          | Escritório (`org_id`) | `id`, `seq`; `(customer_id, org_id)` → cliente; `offer_version_id` → versão                       | Cópia do pagador e da oferta no momento da contratação, vigência do contrato, autor. Só inclusão                                                                            |
| `commercial_contract_items`     | Escritório (`org_id`) | `id`; `(contract_id, org_id)` → contrato                                                          | Cópia de cada item com valor unitário. Só inclusão                                                                                                                          |
| `commercial_contract_companies` | Escritório (`org_id`) | `(contract_id, company_id)`; `(company_id, org_id)` → `companies`                                 | Quem usa. Só inclusão                                                                                                                                                       |

**Quem paga × quem usa.** O pagador é `commercial_contracts.customer_id`. Quem usa está em `commercial_contract_companies`. Cliente direto: pagador `company` e uma única empresa, a dele. Consultoria: pagador `office` e uma ou mais empresas do escritório. Oferta de escopo `organization` (Pro): pagador `office` e nenhuma empresa.

**Isolamento.** As quatro tabelas do escritório têm RLS por `org_id` com `USING` e `WITH CHECK`, uma policy restritiva que só admite administrador (`owner` ou `org:admin`) e, na inclusão, autor igual ao ator da sessão. As duas que carregam `company_id` também levam a policy de escopo de acesso por empresa da NOB-175, exigida pelo teste estrutural `member-access-scopes-rls`.

**Escopo do catálogo.** Global, no precedente de `caepi_certificates`: sem `org_id`, RLS ligado com policy de leitura (só versão publicada), `app_runtime` com `SELECT` apenas. Quem administra: operador com a conexão owner, pelo comando `npx tsx scripts/commercial-catalog.ts`, que grava quem executou (`COMMERCIAL_CATALOG_OPERATOR`). Existe superadmin da plataforma no código: a flag `users.is_master`, com a área `/admin-global` (`requireMaster`, `masterAction`). O painel de assinaturas e a reconciliação (NOB-137) usam esse perfil, de forma provisória e pendente de aprovação; um perfil financeiro próprio fica como pendência.

**Fonte da licença (alvo).** `company_modules` e `orgs.plan` continuam sendo o ponto de aplicação, porque as policies de RLS e os gates de plano já leem os dois. O contrato passa a ser o motivo da licença. A NOB-133 cria o direito de uso derivado do estado da assinatura e só escreve em `company_modules`/`orgs.plan` as linhas que ela mesma concedeu. Linha sem direito de uso registrado é legado ou cortesia e nunca é revogada pela reconciliação.

**Fonte da cobrança (alvo).** O provedor. O banco guarda o espelho, nunca decide se algo foi pago.

**Etapa 2 entregue** (migration `0092_commercial_billing`; detalhe em `nob-132-133-116-checkout-eventos-licencas.md`). As tabelas das NOB-132, 133 e 116 abaixo foram criadas com os nomes previstos. O que saiu diferente do previsto, e por quê:

- **`billing_checkout_sessions` guarda o pagador e os direitos de uso do contrato** (`customer_id`, `targets`). As tabelas de contrato da etapa 1 só são lidas por administrador com sessão, e o webhook não tem sessão. Copiar no checkout evitou afrouxar a policy da etapa 1.
- **Espelhos só aceitam escrita sem usuário na sessão.** Nem o owner grava pagamento, assinatura, direito de uso ou fatura. O plano previa RLS por escritório; a restrição a mais impede forjar estado de pagamento.
- **`commercial_entitlements.applied`** registra se a licença foi ligada pela contratação. É o que separa licença concedida de legado ou cortesia.
- **Função `SECURITY DEFINER` `commercial_reconcile_grant`.** É a única porta que escreve em `company_modules` e `orgs.plan` pelo fluxo comercial. Foi a alternativa a alterar policies existentes e `with-org.ts`, que o plano mandava não trazer sem revisão.
- **`billing_invoice_items` não copia os itens do contrato.** Guarda as linhas que o provedor cobrou, classificadas pelo preço do provedor de cada linha. O que foi cobrado pode diferir do contrato (quantidade, crédito, imposto).

Tabelas previstas (as das NOB-132, 133 e 116 já criadas; as demais, nomes propostos):

| Etapa   | Tabela ou coluna                                                             | Para quê                                                                                              |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| NOB-132 | `billing_provider_prices` (item da oferta → preço no provedor)               | Tabela à parte porque o item publicado é imutável                                                     |
| NOB-132 | `billing_provider_customers` (cliente comercial → cliente no provedor)       | Hoje só existe `orgs.stripe_customer_id`, que é do escritório. Não mexer nessa coluna                 |
| NOB-132 | `billing_checkout_sessions` (contrato, chave de idempotência, sessão)        | Repetir a mesma chave devolve a mesma sessão                                                          |
| NOB-133 | `billing_events` (`UNIQUE(provider, provider_event_id)`, só inclusão)        | Evento repetido não ativa nem cobra duas vezes                                                        |
| NOB-133 | `billing_subscriptions` (contrato, estado, período, cancelamento agendado)   | Espelho do provedor. O contrato segue imutável; o estado mora aqui                                    |
| NOB-133 | `commercial_entitlements` (contrato, empresa ou escritório, serviço, origem) | Motivo da licença; base da reconciliação com `company_modules` e `orgs.plan`                          |
| NOB-116 | `billing_invoices`, `billing_invoice_items` (cópia dos itens do contrato)    | Valor de PGR e de Medicina separados sai do `service` de cada item                                    |
| NOB-117 | Sem tabela nova prevista                                                     | Avulso é oferta `one_time` com item `one_off`; o direito de uso vale para o pedido, não para o módulo |
| NOB-118 | `commercial_trials` (empresa ou escritório, início, fim, conversão)          | Duração vem da política aprovada. Hoje o código usa 7 dias e a issue fala em 15                       |
| NOB-119 | `commercial_interests` (empresa, interesse, mensagem, visto em)              | Caixa interna. `platform_leads` continua sendo o pré-cadastro público, antes de existir escritório    |

## As 14 issues

| Issue   | O que a branch já tem                                        | O que o simulador propõe                                                         | Decisão                                                                                                                           |
| ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| NOB-131 | Stripe integrado só para o Pro, sem conta homologada         | #122: contratos tipados e política em `domains/billing/contracts.ts`             | **Feito em parte.** Contratos de domínio reescritos em `domains/commercial/offer.ts`. Aprovação comercial e homologação pendentes |
| NOB-114 | Oferta básica por escritório (0058)                          | #123: clientes e catálogo por escritório, escritos pelo owner                    | **Feito nesta etapa, reescrito.** Catálogo global; clientes e contratos por escritório                                            |
| NOB-132 | `createProCheckoutSession` com preço fixo                    | #124: gateway falso, checkout idempotente                                        | **Reaproveitar o desenho** (idempotência, preço resolvido no servidor) sobre o cliente Stripe existente. Sem gateway falso        |
| NOB-133 | Webhook que espelha `orgs.plan`, sem caixa de eventos        | #125: caixa de eventos, faturas, licenças; altera `module-policy.ts`, `with-org` | **Reescrever.** Aproveitar caixa de eventos e ordenação. Não trazer as mudanças em `with-org` e nas policies sem revisão          |
| NOB-116 | Nada                                                         | #126: consulta de cobranças por serviço                                          | **Reaproveitar o desenho.** Depende de 133. A separação já está nos itens do contrato                                             |
| NOB-117 | Nada                                                         | #127: pedido avulso, função `SECURITY DEFINER` e grants por coluna               | **Depende de aprovação comercial** (quais avulsos, preço). Preparar com catálogo fictício                                         |
| NOB-118 | Teste de 7 dias do Pro pelo Stripe                           | #128: teste de 15 dias por empresa, sem cartão, bloqueio de impressão            | **Depende de aprovação comercial** (7 ou 15 dias, com ou sem cartão). Reaproveitar o gate de emissão no servidor                  |
| NOB-119 | `platform_leads` (pré-cadastro público)                      | #129: interesse por empresa e caixa interna                                      | **Reaproveitar o desenho.** Sem envio externo                                                                                     |
| NOB-134 | `/plans` (Pro) e `/pgr-basic-offer`                          | #133: telas de planos, comparação e retorno do checkout                          | **Reescrever** com `_ui` da branch e teste de campo nativo. Depende de 132                                                        |
| NOB-135 | Portal do Stripe                                             | #130: cotação de mudança, cancelamento e retomada                                | **Depende de aprovação comercial** (regra de troca e cancelamento). Avaliar o Portal antes de escrever tela própria               |
| NOB-136 | Portal do Stripe (faturas e cartão)                          | #131: faturas e portal falso                                                     | **Já existe em parte** pelo Portal hospedado. Tela própria de faturas depende de 133                                              |
| NOB-137 | Nada. Existe superadmin (`users.is_master`, `/admin-global`) | #132: lista de usuários em variável de ambiente, sem superadmin                  | **Reescrever.** Decidir primeiro quem é o operador (precedente: papel `identity_verifier`)                                        |
| NOB-138 | Nada                                                         | #135: matriz de cenários do simulador                                            | **Reaproveitar a matriz** como roteiro, executada no ambiente de teste do provedor                                                |
| NOB-115 | Este plano                                                   | #134: Pro simulado em `require-tenant-context.ts`                                | **Agregadora.** Fecha com a evidência integrada das subtarefas. Não trazer o Pro simulado                                         |

Nenhuma PR do simulador entra por cherry-pick: as migrations 0060 a 0068 delas colidem com a base e dependem de `integrations/billing/mock-gateway.ts`.

## Ordem de implementação

1. **NOB-131 e NOB-114.** Feito nesta etapa: contratos de domínio, catálogo versionado, clientes e contratação com cópia imutável.
2. **NOB-132, NOB-133, NOB-116.** Feito, sem validação contra o provedor (não há credencial de teste). Checkout por contrato, caixa de eventos, assinatura espelhada, direito de uso e cobrança separada por serviço. Só em modo de teste do provedor.
3. **NOB-117, NOB-118, NOB-119.** Feito com catálogo fictício: pedido avulso, teste por empresa com bloqueio da emissão final e interesse comercial.
4. **NOB-134 a NOB-137.** Feito: tela de planos e contratação, ficha da assinatura, faturas e portal, painel do superadmin com reconciliação auditada. Mudança de plano com cotação, cancelamento e reativação próprios ficaram de fora (política não aprovada; hoje é o portal do provedor).
5. **NOB-138 e NOB-115.** Matriz e roteiro em `nob-138-matriz-homologacao.md`, com a prova automatizada por cenário. **A execução no provedor não aconteceu** (sem conta de teste). A NOB-115 só fecha depois dela e das decisões comerciais.

## Estado da entrega

Tudo está atrás de `COMMERCIAL_CATALOG_ENABLED`, desligada por padrão, e só aceita chave de teste do provedor. Nenhuma cobrança real foi ligada.

| Critério da NOB-115                               | Situação                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Assinatura ativa habilita os serviços contratados | Provado em integração (PGR, Medicina, ambos e Pro). Falta provar no provedor.                          |
| Mudança de estado reflete nas permissões          | Provado em integração (falha, atraso, recuperação, renovação, cancelamento). Falta provar no provedor. |
| Evento repetido não duplica ativação nem cobrança | Provado em integração, inclusive em paralelo e fora de ordem.                                          |
| Legado e cortesia preservados                     | Provado: o banco recusa revogar o que a contratação não concedeu.                                      |
| Aceite integrado e homologação                    | **Pendente**: conta de teste do provedor, decisões comerciais e revisão de segurança.                  |

## Decisões pendentes

Do comercial (detalhe em `nob-131-oferta-e-provedor.md`): catálogo e valores, pagador, periodicidade, cotas, troca, cancelamento, atraso e teste.

Técnicas, para as próximas etapas:

1. Operador da plataforma: a leitura de assinaturas e a reconciliação ficaram com o superadmin (`users.is_master`), provisoriamente (NOB-137). Publicar preço continua com quem tem a conexão owner. Falta decidir se haverá um perfil financeiro próprio.
2. Resolvido na NOB-133: Pro legado e serviço ligado à mão nunca são revogados (direito de uso com `applied = false`). Segue aberto como o Pro novo convive com a assinatura antiga do Pro no provedor.
3. Como calcular o valor cobrado por funcionário, por documento e por faixa. A NOB-132 cobra 1 por escritório e 1 por empresa do contrato; as outras unidades são recusadas no checkout.
4. Se o cadastro da empresa deve listar clientes e contratos comerciais em `/companies/{id}/dependents`. Hoje a exclusão de uma empresa com cliente ou contrato comercial é recusada pela chave estrangeira.
5. Se colaborador pode ler contratos. Hoje só o owner lê e grava.
6. Política de atraso: hoje sem carência (`past_due` suspende na hora). Carência exige decisão comercial e um job agendado.
