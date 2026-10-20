# NOB-106 — proposta de PGR básico para aprovação

Status: **rascunho comercial/técnico, sem oferta ativa**.
Responsável pela aprovação comercial: a definir. Responsável técnico: a definir.
Nenhum valor, desconto, limite de funcionários ou dispensa foi aprovado.

## Princípios já autorizados pelo usuário

- Contratação/habilitação por empresa-cliente, gerenciada somente pelo owner.
- PGR e Medicina separados, podendo coexistir com Pro.
- Empresas existentes preservam o acesso; novas dependem de habilitação explícita.
- Não modificar preços, cobranças, assinaturas ou trial sem confirmação.
- Não inferir exigências técnicas ou dispensas pelo tamanho da empresa.

## Proposta para decisão

Reutilizar o mesmo gerador e requisitos técnicos aprovados do PGR, com uma oferta
comercial distinta somente após o cliente aprovar o público e o serviço incluído.
"Básico" não implica documento incompleto nem validação automática.

| Decisão                   | Proposta de encaminhamento                                                                                | Aprovação                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Público                   | Definir os critérios que o responsável técnico consiga verificar; não definir porte/risco automaticamente | Pendente                                  |
| Conteúdo mínimo           | Preservar os requisitos técnicos do modelo aprovado na NOB-105                                            | Pendente de modelo/revisão                |
| Serviços incluídos        | Especificar coleta, visita, elaboração, revisão, assinatura e suporte separadamente                       | Pendente                                  |
| Limites e excedentes      | Confirmar unidades/locais, revisões e prazo, sem bloquear requisitos técnicos necessários                 | Pendente                                  |
| Preço/moeda/periodicidade | Aprovar valores e forma de cobrança com o cliente                                                         | Pendente; nenhum valor proposto no código |
| Habilitação               | Reutilizar o módulo PGR por empresa; não transformar Pro em contratação de PGR                            | Regra de separação já autorizada          |
| Migração comercial        | Preservar contratos atuais e histórico; novas condições não retroagem                                     | Validar com NOB-114                       |

## Dependências e arquitetura

NOB-105: documento integral e pré-condições de emissão. NOB-114: catálogo
comercial versionado, preços e condições contratadas. Nenhuma das duas deve ser
substituída por constantes ou uma cópia do fluxo Stripe.

Já existe `orgs.plan`/`src/shared/tenant/plan.ts`, com plano free/pro no tenant.
Já existe controle de serviços em `company_modules`. Nenhum deles é, por si,
catálogo versionado de ofertas por empresa. Não gravar o "PGR básico" como um
novo valor de `orgs.plan` ou tratá-lo como habilitação automática da Medicina.

Após aprovação, NOB-114 deve fornecer referência à versão da oferta e preço,
guardando no contrato as condições aceitas. Uma mudança de preço cria nova versão,
sem reescrever o histórico. Validar se haverá integração de cobrança antes de
implementar Stripe; catálogo e controle de acesso não equivalem a pagamento.

Arquivos prováveis: domínio/repositório/schema do catálogo comercial da NOB-114,
suas Actions/REST/UI/API/Postman, e integração com o serviço por empresa existente.
Tabelas e colunas ainda não definidas. Não criar migration comercial nesta etapa.

## Critérios para habilitar

1. Aprovação registrada do público, escopo, preço, limites e responsável técnico.
2. NOB-105 e catálogo da NOB-114 disponíveis e testados.
3. Testes de versão/preço, owner, tenant/empresa e independência de Pro/Medicina.
4. Testes de preservação dos contratos e acessos antigos, incluindo ausência de
   cobrança automática na simples habilitação de módulo.
5. Documento representativo revisado tecnicamente na NOB-107.

## Resultado desta etapa

Proposta preparada para decisão; **nenhum critério de aceite foi declarado
concluído**. Não há alteração de preço, assinatura, acesso, banco ou aplicação.
"Faça da melhor forma" autoriza preparar a solução, mas não fornece os valores
ou o parecer técnico que a própria issue exige antes de habilitar a oferta.
