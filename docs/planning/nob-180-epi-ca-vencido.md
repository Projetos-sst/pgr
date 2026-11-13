# NOB-180 · Entrada e entrega de EPI com CA vencido

**Status geral:** regra **provisória**. Aguarda a confirmação do responsável de SST (DT-15, SEG-31).

## Origem

- SEG-31 (questionário v3): "O EPI com CA vencido não pode ser adquirido, porém pode ser fornecido, se já
  constar no estoque e esteja em perfeitas condições de uso."
- Decisão do dono do produto para esta entrega:
  - o CA é um **campo do EPI cadastrado pela própria empresa** (número + validade);
  - a base global CAEPI (espelho do MTE) **não** é a fonte da regra;
  - a comparação é com a **data de hoje** no momento do lançamento, não com uma data de aquisição.

## Formato do dado

A regra lê três campos do item em `epi_catalog` e a data de hoje em `America/Sao_Paulo`.

| Campo            | Origem                       | Papel na regra                         |
| ---------------- | ---------------------------- | -------------------------------------- |
| `type`           | `epi_catalog.type`           | só `epi` exige CA                      |
| `ca`             | `epi_catalog.ca`             | número do CA informado pela empresa    |
| `ca_valid_until` | `epi_catalog.ca_valid_until` | validade do CA informada pela empresa  |
| hoje             | `todayInSaoPaulo()`          | o dia do vencimento (D) ainda é válido |

Nenhuma coluna, tabela ou migration nova. O histórico por lote continua em `stock_movements`
(`batch`, `invoice_number`, `invoice_date`, `movement_date`), exibido em `/epi-stock/{id}/history`.

## Tabela de cenários

| #   | Cenário                                                                        | Regra aplicada                                                                   | Resultado                                                       | Status                  |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------- |
| 1   | Entrada por compra, CA válido depois de hoje                                   | `ca_valid_until >= hoje`                                                         | Aceita, soma ao saldo, grava lote                               | provisória, aguarda SST |
| 2   | Entrada por compra, CA vence **hoje** (dia D)                                  | Dia D inclusive                                                                  | Aceita                                                          | provisória, aguarda SST |
| 3   | Entrada por compra, CA venceu **ontem** (D+1)                                  | `ca_valid_until < hoje`                                                          | Recusa `422 VALIDATION`, motivo com o CA e a data do vencimento | provisória, aguarda SST |
| 4   | Entrada com data do movimento ou da nota anterior ao vencimento, CA já vencido | A comparação usa a data de hoje. A data informada não entra na conta             | Recusa `422 VALIDATION`                                         | provisória, aguarda SST |
| 5   | Entrada de EPI **sem validade do CA** ou **sem número do CA**                  | Sem dado não há como provar CA válido                                            | Recusa `422 VALIDATION`: "Informe o CA e a validade do CA..."   | provisória, aguarda SST |
| 6   | Saldo inicial ao associar item novo ao estoque (`initialQuantity`)             | É uma entrada por compra: mesma regra dos cenários 1 a 5                         | Recusa desfaz a criação da linha de estoque                     | provisória, aguarda SST |
| 7   | Associar item com CA vencido ao estoque **sem** saldo inicial                  | Não há entrada                                                                   | Aceita, saldo 0                                                 | provisória, aguarda SST |
| 8   | Estoque já existente cujo CA venceu depois                                     | Nenhum dado é alterado. Entrega, baixa e devolução não verificam o CA            | Saldo preservado, entrega aceita                                | provisória, aguarda SST |
| 9   | Devolução de funcionário de EPI com CA vencido                                 | Devolução não é aquisição                                                        | Aceita, repõe o saldo                                           | provisória, aguarda SST |
| 10  | Entrada de máquina ou insumo (`machine`, `supply`)                             | CA não se aplica                                                                 | Aceita                                                          | provisória, aguarda SST |
| 11  | Outro escritório tenta lançar entrada no estoque                               | Isolamento por `org_id` (RLS) antes da regra do CA                               | `404 NOT_FOUND`, nada gravado                                   | definitiva (isolamento) |
| 12  | Membro restrito a outra empresa tenta lançar entrada em EPI desta empresa      | Escopo por empresa do catálogo (NOB-175) antes da regra do CA                    | `404 NOT_FOUND`, nada gravado                                   | definitiva (isolamento) |
| 13  | Cadastro ou edição do EPI no catálogo com CA vencido                           | Cadastro continua livre, para manter o histórico e permitir atualizar a validade | Aceita                                                          | provisória, aguarda SST |

## Onde a regra é aplicada

- **Regra pura:** `src/shared/domains/pgr/epi-ca-entry.ts` (`evaluateCaForStockEntry`).
- **Servidor, ponto único:** `applyStockEntry` em `src/shared/db/repositories/stock-movements.ts`, quando o
  movimento é `purchase`. Server Action (`registerStockEntryAction`, `createEpiStockAction`) e REST
  (`POST /api/v1/epi-stock/{id}/movements`, `POST /api/v1/epi-stock`) passam por ele.
- **Tela:** o modal "Registrar entrada" e o formulário de estoque mostram o motivo devolvido pelo servidor.
- **Banco:** nenhuma constraint nova. A regra depende da data de hoje, que um `CHECK` não expressa.

## Estoque e catálogo por empresa: como está hoje

- `epi_catalog.company_id` existe e é **opcional**. Item sem empresa vale para o escritório inteiro.
- `epi_stock` **não** tem `company_id`. A unicidade é `(org_id, catalog_id)`, então a empresa do saldo é a
  empresa do item do catálogo.
- `stock_movements`, `epi_deliveries` e `epi_delivery_items` também não têm `company_id`.
- Para "cada empresa com o seu estoque" de forma estrita faltaria: tornar `company_id` obrigatório no
  catálogo (com decisão sobre os itens atuais sem empresa) e levar o escopo por empresa (NOB-175) às tabelas
  de estoque, movimentos e entregas. Nada disso foi feito aqui.

## Pendências de decisão do responsável de SST

1. Confirmar a regra única de entrada pela data de hoje (cenários 1 a 4).
2. Confirmar o bloqueio de EPI sem CA ou sem validade informada (cenário 5). Hoje existem itens de catálogo
   sem esses campos. Eles deixam de receber entrada até o cadastro ser completado.
3. **Condição do EPI** ("perfeitas condições de uso"): o modelo não tem esse conceito. Não foi criado campo.
4. **Validade do produto** (fabricante): o modelo só tem `useful_life_months` e `replacement_date` no
   catálogo, sem validade por lote. A entrega não verifica validade do produto.
5. Cadastro com CA vencido (cenário 13): a SEG-31 fala em bloqueio "para opções de cadastro no sistema".
   Mantido livre nesta entrega.
6. Remoção da base global CAEPI (tabela, sincronização e consulta): fica para decisão posterior. A regra
   nova não depende dela.
