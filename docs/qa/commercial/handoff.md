# Financeiro simulado — entrega ao Douglas e à equipe

Escopo: milestone 5 do Linear, 14 issues. Implementação opt-in com dados fictícios, sem cobrança real. As PRs têm destino develop, permanecem em rascunho e devem ser revisadas/integradas em ordem. Implementação, integração e homologação são estados diferentes.

## Ordem das PRs

| Issue   | PR                                                  | Entrega                                  |
| ------- | --------------------------------------------------- | ---------------------------------------- |
| NOB-131 | [122](https://github.com/Projetos-sst/pgr/pull/122) | Contratos e políticas do simulador       |
| NOB-114 | [123](https://github.com/Projetos-sst/pgr/pull/123) | Clientes e catálogo versionado           |
| NOB-132 | [124](https://github.com/Projetos-sst/pgr/pull/124) | Adaptador e checkout idempotente         |
| NOB-133 | [125](https://github.com/Projetos-sst/pgr/pull/125) | Eventos, reconciliação e licenças        |
| NOB-116 | [126](https://github.com/Projetos-sst/pgr/pull/126) | Cobranças discriminadas por serviço      |
| NOB-117 | [127](https://github.com/Projetos-sst/pgr/pull/127) | Pedidos avulsos e autorização por pedido |
| NOB-118 | [128](https://github.com/Projetos-sst/pgr/pull/128) | Teste de 15 dias e proteção de emissão   |
| NOB-119 | [129](https://github.com/Projetos-sst/pgr/pull/129) | Interesse comercial e caixa interna      |
| NOB-135 | [130](https://github.com/Projetos-sst/pgr/pull/130) | Prévia, mudança, cancelamento e retomada |
| NOB-136 | [131](https://github.com/Projetos-sst/pgr/pull/131) | Faturas e portal privado simulado        |
| NOB-137 | [132](https://github.com/Projetos-sst/pgr/pull/132) | Administração e reconciliação auditada   |
| NOB-134 | [133](https://github.com/Projetos-sst/pgr/pull/133) | Páginas e retorno seguro do checkout     |
| NOB-115 | [134](https://github.com/Projetos-sst/pgr/pull/134) | Pro aditivo no contexto autenticado      |
| NOB-138 | PR de validação que contém este documento           | Matriz de cenários e evidências          |

Os controles de tela 135–137 precedem a montagem 134 para cada branch compilar com suas dependências. Commits corretivos equivalentes de lint existem em algumas branches; ao integrar, manter o mesmo conteúdo e conferir o diferencial contra develop, sem duplicar alterações.

## Contrato para substituir o simulador

- Tipos/políticas/eventos: src/shared/domains/billing/contracts.ts. Valores inteiros em centavos, itens por produto e período confirmados pela fonte.
- Adaptador: src/shared/integrations/billing/mock-gateway.ts. createMockPaymentClient implementa Customer, checkout, portal e verificação de assinatura; createMockBillingGateway oferece a interface completa com armazenamento injetado. Os serviços usam os repositórios persistentes, sem callbacks de sucesso fictício.
- Orquestração: src/shared/server/platform/billing-\*-core.ts. Actions e REST compartilham estes serviços; caminhos e Postman em docs/api/.
- Persistência: src/shared/db/repositories/billing/. O inbox de eventos é separado da autoridade simulada billing_provider_states. Sem memória de processo como fonte de verdade.
- Eventos exigem assinatura do corpo bruto, janela temporal e versão crescente; um evento atrasado fica no histórico sem reaplicar efeitos. Mesmo ID com conteúdo diferente é recusado. Faturas preservam valor/itens originais.
- Owner controla financeiro; colaboradores recebem somente a verificação booleana operacional de serviço avulso adquirido. A administração exige ainda BILLING_ADMIN_USER_IDS e continua restrita ao tenant ativo. Servidor e RLS verificam isolamento.

O endpoint /api/billing/webhooks/provider é autenticado e exclusivo do simulador. O gateway real precisará de ingresso separado, assinatura oficial, credencial de serviço restrita e resolução confiável da organização a partir de vínculo persistido. Não basta retirar a autenticação deste endpoint. Cada assinatura real precisa de versão/ordenação confiável ou consulta à fonte para normalização.

O portal usa um método fictício Visa ••••4242 predefinido. Apenas metadados mascarados e a sincronização de teste são registrados; PAN/CVV não são aceitos. O portal real deverá ser hospedado pelo provedor e retornar metadados verificados. Não reativar contrato encerrado por evento tardio.

## Ativação em homologação isolada

Configurar somente no servidor:

| Nome                        | Uso                                                                         |
| --------------------------- | --------------------------------------------------------------------------- |
| APP_ENV                     | local, sandbox ou test                                                      |
| BILLING_MODE                | mock                                                                        |
| BILLING_MOCK_ENABLED        | true para ativação explícita                                                |
| BILLING_MOCK_WEBHOOK_SECRET | segredo exclusivo do ambiente com ao menos 32 caracteres; nunca NEXT_PUBLIC |
| BILLING_MOCK_FAIL_REQUESTS  | true simula indisponibilidade; omitir no fluxo normal                       |
| BILLING_ADMIN_USER_IDS      | lista explícita de usuários autorizados; vazia nega administração           |

VERCEL_ENV e VERCEL_TARGET_ENV de produção bloqueiam o simulador mesmo se APP_ENV estiver incorreto. Configurar flags não executa migrations. O Stripe atual e orgs.plan permanecem preservados; seu teste anterior de 7 dias não é migrado silenciosamente para o novo teste de 15 dias.

Fluxo de demonstração: entrar como owner, abrir /configuracoes/planos, escolher empresa, criar oferta fictícia e iniciar teste/checkout. Seguir o retorno e demonstrar os cenários do simulador. Conferir itens, faturas, mudança com prévia e portal temporário. Repetir como colaborador, outra empresa e outro escritório para conferir restrições.

## Migrations e integração com Carlos

Última develop verificada: e6f25428051ad1cc5a6df57b97365e17c2c16b67, migration 0059. A consulta das PRs abertas não mostrou a NOB-112, mas isso não confirma se Carlos já reservou numeração localmente.

0060_commercial_simulation cria tabelas e policies financeiras. 0061_commercial_module_access acrescenta itens/período às faturas e conecta licenças pagas às permissões operacionais. 0062_commercial_one_off_access oferece autorização booleana por pedido e restringe UPDATE às colunas mutáveis. 0063_commercial_trial_exports preserva a janela original do teste em conversões parciais e protege emissão por produto.

A numeração 0060–0063 é candidata, sem reserva garantida. Antes de integrar, atualizar develop e conciliar com Carlos a ordem e os snapshots; se houver migration concorrente, regenerar o diferencial do schema a partir da base integrada e transportar o SQL customizado cuidadosamente. Não renomear apenas os SQLs: revisar journal, timestamps e prevId dos snapshots. Reexecutar validação e testes com o novo HEAD.

Validação offline: node scripts/validate-commercial-migrations.mjs; drizzle-kit check; drizzle-kit generate com URL sintética somente para carregar a configuração, sem migrate. Resultado da geração: nenhum diferencial de schema. Aplicação SQL e verificações de FKs, GRANTs, RLS e helpers foram exercitadas somente em PostgreSQL temporário. Nenhum banco produtivo foi acessado.

## Matriz e evidências

| Cobertura                                                                                                                           | Suítes                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Catálogo imutável, clientes, preço interno e retry                                                                                  | billing-catalog, billing-checkout             |
| Assinatura, assinatura HMAC, duplicação, ordem, RLS e revogação                                                                     | billing-subscriptions                         |
| Valores históricos separados e avulsos isolados                                                                                     | billing-charges, billing-orders               |
| Teste fixo de 15 dias, emissão e conversão parcial                                                                                  | billing-trials                                |
| Interesse e confirmação idempotente                                                                                                 | billing-interests                             |
| Prévia, expiração, concorrência, vigência e encerramento                                                                            | billing-management                            |
| Portal privado, expiração, método fictício e indisponibilidade                                                                      | billing-portal                                |
| Permissão administrativa, filtros e reconciliação                                                                                   | billing-admin                                 |
| Pro vigente, expiração, produção e preservação do legado                                                                            | billing-license, commercial-tenant-context    |
| Sucesso, ação adicional, recusa, atraso, recuperação, renovação, cancelamento, repetição, ordem, indisponibilidade e FKs/RLS/GRANTs | billing-sandbox-matrix                        |
| Prévia na interface, identidade do checkout, troca de empresa e método mascarado                                                    | billing-management-controls, commercial-pages |
| Fim de mês e ano bissexto do calendário fictício                                                                                    | mock-period                                   |

Comandos reproduzíveis: npm run check; npm run test:integration com PostgreSQL temporário configurado conforme o helper e o CI. Não apontar testes de integração para dados reais: o seed limpa tabelas do banco de teste.

Conferência visual isolada em Chrome headless: planos, assinatura, cobranças, simulador, administração e portal em 390×900 e 1440×900, com componentes reais, Actions substituídas por dados sintéticos e CSS do projeto. Doze combinações sem erro JavaScript ou rolagem horizontal; formulário rejeitou terceira casa decimal. Isso não é E2E autenticado.

[Resultados responsivos](responsive-results.json), [planos no celular](plans-mobile.png), [cobranças no desktop](invoices-desktop.png).

## Pendências externas e limites explícitos

- NOB-131: aprovar catálogo real, preços/cotas, política de cobrança, regras fiscais e provedor/conta. O mock não homologa adquirente.
- NOB-138/NOB-115: aceite integrado após merge e teste autenticado no Clerk, homologação de gateway/portal reais e CD oficial. Nenhuma issue é declarada Done só por haver uma PR.
- PCMSO/ASO ainda não têm emissores nesta base. Medicina deverá chamar assertCompanyBillingExportAllowed após sua autorização técnica e antes de gerar/armazenar/baixar documentos. O helper está preparado/testado; essa integração futura permanece parcial na NOB-118.
- Serviço avulso produz pedido e elegibilidade comercial por pedido/produto, sem abrir o módulo inteiro. Os fluxos técnicos futuros devem consumir requirePurchasedService e continuar exigindo validação profissional; o financeiro não emite documento clínico nem substitui responsabilidade técnica.
- Quotas comerciais são metadados versionáveis; a simulação não implementa novas cotas aprovadas por oferta nem altera os limites comerciais existentes. A visão resumida limita contratos/clientes a 100 e empresas a 200; faturas/interesses/administração têm paginação no servidor.
- Faturas simuladas não são notas fiscais. Vencimento, documentos fiscais, rateio, estorno, chargeback, descontos, conciliação bancária e envio externo não são inventados. Datas e regra integral de mudança pertencem somente à demonstração; no real, prevalecem fonte/política homologadas.
- Os oito arquivos de integração previamente excluídos pelo jest.config.ts e testes condicionais de infraestrutura continuam dívida existente, descrita nessa configuração. Checks verdes não equivalem a cobrir essas integrações externas.

Após revisão, integrar pela cadeia e acompanhar o pipeline oficial de homologação. Não aplicar migrations manualmente em produção, não modificar main e não liberar a numeração da Medicina antes de confirmar o estado integrado.
