# Data Model — Fase 1: Implantação do redesign visual

Esta fatia é de **apresentação**. Não cria, altera nem remove tabela, coluna, enum, constraint, índice,
policy RLS ou trigger. **Zero migration.** O único acesso a dados é **leitura de contagem** para o
dashboard — sempre escopada por tenant (`withOrg` + RLS backstop `app.current_org`).

## Read model — KPIs do dashboard

Modelo de leitura derivado (não persistido). Todas as contagens são por `org_id` do tenant ativo
resolvido de `requireTenantContext()`, nunca de input do cliente.

| KPI                   | Fonte       | Query (conceitual)                                        | Origem                                                            |
| --------------------- | ----------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Empresas              | `companies` | `COUNT(*) WHERE org_id = :org`                            | reaproveita `listCompanies(...).total` ou helper enxuto           |
| PGRs                  | `pgr`       | `COUNT(*) WHERE org_id = :org`                            | `listPgr(...).total` ou helper                                    |
| Equipe                | `employees` | `COUNT(*) WHERE org_id = :org`                            | `listEmployees(...).total` ou helper                              |
| EPIs abaixo da mínima | `epi_stock` | `COUNT(*) WHERE org_id = :org AND balance < min_quantity` | helper novo `countEpiStockBelowMinimum(orgId)` (padrão `withOrg`) |

**Regra de isolamento (Princípio I)**: cada contagem roda dentro de `withOrg(orgId, tx => …)`; o RLS
`org_id = current_setting('app.current_org', true)` é o backstop. Um teste de integração (Postgres
efêmero) MUST provar que, com dois tenants semeados, a contagem de um nunca inclui registros do outro.

## Read model — widgets em empty-state (sem fonte pronta)

Não há modelo de dados: os widgets de gráfico (Riscos por Categoria, Planos de Ação, Status/Tipo de OS,
Categorias de Incidentes) renderizam o **empty-state do mockup**. Nenhuma agregação nova é introduzida
(ver research D4). Se uma agregação vier a existir no futuro, será outra fatia.

## Entidades contadas (referência, não modificadas)

- **Empresa** (`companies`) — dimensão-raiz da cadeia do PGR, isolada por `org_id`.
- **PGR** (`pgr`) — documento de PGR do tenant.
- **Funcionário** (`employees`) — trabalhador da empresa-cliente, isolado por `org_id`.
- **Item de estoque de EPI** (`epi_stock`) — tem `balance` e `min_quantity` (`CHECK balance >= 0`,
  `CHECK min_quantity >= 0`); "abaixo da mínima" ⇔ `balance < min_quantity` (`computeEpiStockStatus`).

## Estados/transições

Nenhum. Fatia de leitura + apresentação.
