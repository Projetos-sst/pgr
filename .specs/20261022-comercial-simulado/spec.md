# Comercial simulado — NOB-114–119 e NOB-131–138

Autorização de 22/10/2026: o usuário informou que Douglas aprovou implementar
pagamentos simulados, com contrato substituível para posterior integração real.
Isso não aprova preço, gateway, dispensa técnica ou cobrança de clientes reais.

Base: develop e6f2542, migrations até 0059. Checkout separado do trabalho da
Medicina. Carlos pode estar criando 0060; o usuário ainda não sabe. Não publicar
reserva de numeração nem integrar migrations antes de conferir novamente a base.

## Escopo e ordem

| Issue | Entrega                                                                     |
| ----- | --------------------------------------------------------------------------- |
| 131   | Contratos, política configurável e limites da simulação; handoff do gateway |
| 114   | Clientes por empresa, catálogo/preços versionados e auditoria               |
| 132   | Adaptador simulado, checkout autenticado e idempotente                      |
| 133   | Eventos, faturas, assinaturas, ordenação/retry e reconciliação              |
| 116   | Itens PGR/Medicina separados em contratação e cobrança                      |
| 117   | Pedidos avulsos independentes da assinatura                                 |
| 118   | Trial explícito de 15 dias; proteção de emissão no servidor                 |
| 119   | Interesse e alertas internos deduplicados; nenhum envio externo             |
| 135   | Assinatura, cotação com validade, mudança, cancelamento e retomada          |
| 136   | Faturas e portal temporário de pagamento simulado                           |
| 137   | Administração com permissão específica e histórico                          |
| 134   | Integração das páginas, comparação e retorno do checkout                    |
| 115   | Integração das licenças e aceitação do fluxo completo                       |
| 138   | Matriz de cenários, isolamento, UI e handoff ao Douglas                     |

Controles e APIs das telas (135–137) precedem a integração das páginas (134),
para que cada PR compile com suas dependências disponíveis.

PRs por issue, com dependências explícitas. Não repetir o erro anterior de
confundir merge entre branches com integração na develop. Nenhum merge/deploy
está autorizado nesta solicitação; resultados serão apresentados para revisão.

## Invariantes

- Simulação opt-in, apenas APP_ENV local/sandbox/test; produção recusa sempre.
- Cliente nunca informa preço final, ator, tenant ou estado pago confiável.
- Redirecionamento de checkout não confirma pagamento. Nenhum PAN/CVV é coletado.
- Estado do simulador persistido; não depende de memória de um processo Next.
- Ofertas/itens contratados preservam valores históricos, sem preço real criado
  automaticamente. Exemplos são identificados como fictícios e de simulação.
- Pro e módulos separados; empresa é dimensão dentro do escritório (tenant).
- Stripe e permissões existentes preservados. Sem backfill/revogação de clientes.
- Todas as mudanças financeiras autenticadas/auditadas, isoladas por tenant,
  idempotentes e protegidas contra concorrência. Histórico append-only.
- Nenhum conteúdo clínico vai para o módulo financeiro ou adaptador.
- API + Actions + documentação/Postman; testes unitários e Postgres temporário.
- Aprovação do provedor real e das políticas comerciais permanece externa.

## Política inicial do simulador

Trial dura 15 dias, sem coleta de cartão e sem cobrança automática. Bloqueio de
emissão/download durante trial se aplica apenas ao cliente que iniciou o fluxo
simulado; não muda regras do Stripe existente (que atualmente usa 7 dias).
Alterações podem ser demonstradas com efeitos no fim do período, sem prorrata
inventada. Regras são configuráveis/versionadas; a UI informa seu caráter de teste.
Alertas são uma caixa de entrada interna; não enviar WhatsApp/e-mail/SMS.

## Handoff e limites

Douglas receberá interface de gateway, eventos normalizados, política por oferta,
testes contratuais, flags e pontos de configuração. A conclusão refere-se ao
modo simulado; elegibilidade, tarifas, credenciais e homologação do gateway real
não podem ser declaradas concluídas por testes fictícios.
