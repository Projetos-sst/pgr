# Módulo de EPI — panorama dos fluxos (como o sistema vai funcionar)

> **Objetivo:** dar uma visão geral de **como todos os fluxos de EPI se encaixam** — catálogo,
> estoque, movimentações, entrega com assinatura digital, devolução, ficha/histórico e o vínculo
> EPI×risco. Ancorado no **modelo de dados real** (`src/shared/db/schema/epis.ts`, fatia 008) e nas
> **issues da Fase 02**.
>
> Companheiro de [`caepi-logica-de-negocio.md`](./caepi-logica-de-negocio.md) (a parte do CA) e do
> briefing técnico [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md).
>
> Esta é a parte **mais sensível** do módulo, porque mistura **saldo transacional**, **assinatura
> digital assíncrona** e **isolamento multi-tenant**. A seção
> [Pontos sensíveis](#9-pontos-sensíveis-e-lacunas-conhecidas) lista onde é fácil errar.

---

## 1. Mapa das issues (Fase 02 · módulo EPI)

| Issue    | Fluxo                                         | Tabela(s) principal(is)                       | Estado     | Depende de            |
| -------- | --------------------------------------------- | --------------------------------------------- | ---------- | --------------------- |
| **#17**  | Modelo de dados (catálogo, estoque, entregas) | as 6 tabelas + 2 enums                        | ✅ fechada | —                     |
| **#18**  | CRUD de Catálogo de EPI/Equipamentos          | `epi_catalog`                                 | aberta     | #17, #73 (categorias) |
| **#70**  | CRUD de Estoque de EPI                        | `epi_stock`                                   | aberta     | #17, #18              |
| **#72**  | Movimentações (entrada/saída + histórico)     | `stock_movements` ↔ `epi_stock`               | aberta     | #70                   |
| **#19**  | Entrega de EPI com assinatura digital         | `epi_deliveries` + `epi_delivery_items` + mov | aberta     | #70, #72, **#67**     |
| **#20**  | Devolução de EPI                              | `epi_delivery_items` + mov (retorno)          | aberta     | #19 (**+ migração**)  |
| **#21**  | Ficha/histórico de entregas por funcionário   | joins das entregas                            | aberta     | #19                   |
| **#75**  | Consulta de CA na CAEPI/MTE                   | `caepi_certificates` (global)                 | aberta     | #68                   |
| **#115** | Validação de CA no cadastro de EPI            | `caepi_certificates` + `epi_catalog`          | aberta     | #75, #18              |
| **#78**  | EPI × risco (neutralização) — **Fase 03**     | `epi_risk`                                    | aberta     | PGR/riscos            |
| **#67**  | Infra de assinatura digital (token/QR/link)   | tabela de tokens (a criar) — **Fase 0**       | aberta     | —                     |

> **Leitura da coluna "Estado":** só o **modelo** (#17) e as **categorias** (#73) estão fechados. Os
> fluxos abaixo descrevem o **alvo** — o que cada issue precisa entregar — independente de já estar
> codado. Há fatias locais em andamento (`.specs/010-epi-catalog-crud`, `.specs/010-stock-movements`).

---

## 2. As entidades (o modelo real, resumido)

Seis tabelas, todas **isoladas por `org_id` (tenant) + RLS**, e dois enums:

| Tabela               | Guarda                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `epi_catalog`        | o **modelo** de EPI/máquina: `name`, `ca`, `ca_valid_until`, `manufacturer`, `norm`, `size`, `unit_of_measure`, `category_id`+`type`, `photo_path` |
| `epi_stock`          | **estoque por item do catálogo**: `catalog_id`, `balance` (saldo materializado), `min_quantity`                                                    |
| `stock_movements`    | **cada movimento**: `stock_id`, `type`, `quantity` (>0), `movement_date`, `invoice_number`, `delivery_id?`                                         |
| `epi_deliveries`     | **entrega a um funcionário**: `employee_id`, `delivery_date`, `signature_status`, `auth_token?`                                                    |
| `epi_delivery_items` | **itens de cada entrega**: `delivery_id`, `catalog_id`, `quantity`                                                                                 |
| `epi_risk`           | **vínculo EPI × GES** com flag `neutralizes` (Fase 03)                                                                                             |

**Enums:**

- `stock_movement_type` = `purchase` · `employee_delivery` · `adjustment` · `discard`
- `epi_signature_status` = `pending` · `signed_qr` · `signed_link` · `signed_manual`

**Regras já gravadas no banco (constraints):**

- `epi_stock.balance >= 0` e `min_quantity >= 0` (CHECK)
- `stock_movements.quantity > 0` (CHECK — o **sinal vem do `type`**, não da quantidade)
- `epi_delivery_items.quantity > 0` (CHECK)
- `uq_epi_stock_org_catalog` — um item do catálogo tem **um** registro de estoque por tenant
- FK composta `epi_catalog (category_id, type) → categories (id, type)` — garante que o tipo do EPI
  bate com o tipo da categoria
- `stock_movements.delivery_id → epi_deliveries` com `ON DELETE SET NULL` (o movimento sobrevive à
  exclusão da entrega, virando um movimento "solto")

---

## 3. Como as peças se conectam

```
              categories (epi|machine)
                   │  (category_id, type)
                   ▼
             ┌─────────────┐        1─N        ┌──────────────────┐
             │ epi_catalog │◄──────────────────│ epi_delivery_items│
             │ (o modelo)  │        catalog_id  │ (item × qtd)     │
             └─────┬───────┘                    └────────┬─────────┘
                   │ catalog_id (1─1 por tenant)          │ delivery_id
                   ▼                                       ▼
             ┌─────────────┐                       ┌──────────────┐
             │  epi_stock  │        N─1            │epi_deliveries│──► employees
             │  (saldo)    │◄──────────┐           │ (assinatura) │    (employee_id)
             └─────┬───────┘           │           └──────┬───────┘
                   │ stock_id          │ delivery_id       │
                   ▼                   │ (nullable)        │
             ┌──────────────────┐      └───────────────────┘
             │ stock_movements  │  cada entrada/saída; se veio de uma entrega,
             │ (entrada/saída)  │  aponta pra ela via delivery_id
             └──────────────────┘
```

Em uma frase: **o catálogo define o modelo → o estoque guarda o saldo desse modelo → cada
movimentação mexe no saldo → uma entrega a funcionário gera movimentações de saída ligadas a ela.**

---

## 4. Os fluxos, um a um

### F1 · Catálogo de EPI (CRUD) — #18

O cadastro do "modelo" de EPI. **Criar · listar · editar · excluir** com os campos do ePGR:
`type` (EPI/Máquina), `category_id` (filtrada pelo tipo), `unit_of_measure`, **`ca`**, `name`,
`size`, `manufacturer`, `norm`, `ca_valid_until`, `description`, `photo_path`.

- O campo **CA** é onde entra a validação CAEPI (#115): consulta local → autopreenche
  `manufacturer`/`norm`/`ca_valid_until` (ver [`caepi-logica-de-negocio.md`](./caepi-logica-de-negocio.md)).
- Excluir um item do catálogo é **RESTRICT** contra `epi_delivery_items` (não apaga item que já foi
  entregue) e **CASCADE** para `epi_stock` (o estoque daquele modelo some junto).

### F2 · Estoque de EPI (CRUD) — #70

Associa um item do catálogo a um registro de estoque e define a **quantidade mínima**.

- Lista: **CA · Nome · Tam. · Und. Medida · Empresa · Mínima · Saldo · Opções**; filtros
  "Apenas com saldo", "Sem saldo / Abaixo da mínima / Acima da mínima".
- **`balance` é somente leitura aqui** — quem mexe no saldo são as **movimentações (F3)**.
- **Status é derivado** (sem coluna, sem trigger): comparar `balance` vs `min_quantity` na leitura →
  `sem_saldo` (0) · `abaixo_minima` (`0 < balance < min`) · `acima_minima` (`balance >= min`).

### F3 · Movimentações: entrada, saída manual e histórico — #72

O coração do saldo. Toda mudança de `balance` passa por aqui, **em transação atômica**.

- **Entrada (compra)** — modal `Data · Quantidade · Nº Nota Fiscal (opcional)` → cria
  `stock_movements` (`type = purchase`) e **incrementa** `balance`.
- **Saída manual** — modal `Data · Quantidade · Tipo (ajuste | descarte)` → cria movimento
  (`adjustment` | `discard`) e **decrementa** `balance`. (Saída manual **não** aceita
  `employee_delivery` — esse tipo só nasce do fluxo de entrega F4.)
- **Histórico por item** (`/epi-stock/[id]/history`) — tabela `Data · Tipo · Quantidade · Saldo
Resultante · Nº Nota Fiscal · Funcionário (se entrega)`. O **saldo resultante é derivado** por
  window function (`computeRunningBalance`), **sem coluna `balance_after`**.

**A transação (o ponto sensível nº 1):**

```
withOrg(orgId, tx => {
  SELECT balance FROM epi_stock WHERE id = :stockId FOR UPDATE   -- trava a linha
  novoSaldo = balance ± quantity                                 -- sinal vem do type
  se novoSaldo < 0  → aborta com INSUFFICIENT_STOCK (422)        -- valida na app
  INSERT stock_movements(...)                                    -- registra o movimento
  UPDATE epi_stock SET balance = novoSaldo                       -- materializa o saldo
})   -- qualquer falha → rollback total; CHECK balance >= 0 é o backstop no banco
```

### F4 · Entrega de EPI com assinatura digital — #19 (+ infra #67)

Fluxo multi-etapa. É onde estoque, entrega, funcionário e assinatura se encontram.

1. **Seleção de EPIs** (`/funcionarios/entregarepi/:id`) — tabela dos itens **com saldo disponível**:
   `checkbox · CA · EPI · Tam. · Und. · Descrição · Fabricante · Disponível (saldo) · Quantidade`.
   Marcar a linha habilita a quantidade. Busca por CA/nome.
2. **Preparar entrega** (modal) — lista "Itens para Entrega (N)", `Data de Entrega`, `Funcionário` →
   "Autenticar N EPI(s)".
3. **Autenticação** (3 métodos — ver F7):
   - **QR Code** — token único → funcionário abre rota **pública** `/assinar/[token]` → confirma →
     painel do gestor mostra "Aguardando confirmação…" em tempo real → status `signed_qr`.
   - **Enviar link** — dispara link por telefone/e-mail cadastrado do funcionário → status
     `signed_link`. Sem contato → "Ir para cadastro do funcionário".
   - **Assinatura manual** — imprime a ficha, funcionário assina no papel, gestor clica "Registrar
     assinatura manual" → status `signed_manual`.
4. **Baixa de estoque** — ao **confirmar a entrega** (qualquer método): para **cada item**, cria
   `stock_movements` (`type = employee_delivery`, `delivery_id` = a entrega) e **decrementa**
   `balance` — na mesma transação da F3. **Alerta** se o saldo ficar **abaixo da mínima**.

O que nasce no banco em uma entrega:

```
epi_deliveries        1 linha  (employee_id, delivery_date, signature_status, auth_token?)
  └─ epi_delivery_items  N linhas  (catalog_id, quantity)
  └─ stock_movements     N linhas  (type=employee_delivery, delivery_id=↑, quantity, decrementa saldo)
```

### F5 · Devolução de EPI — #20 ⚠️ precisa de migração

Funcionário devolve um EPI → **movimento de retorno que aumenta o saldo** + marca o item como
devolvido. Impede devolver duas vezes.

> **Lacuna real (ver §9):** hoje o schema **não tem** o tipo `return` no enum `stock_movement_type`
> **nem** a coluna `returned_at` em `epi_delivery_items`. Esta fatia **exige uma migração** antes de
> implementar. Sem isso, "devolvido" e "movimento de retorno" não têm onde morar.

Alvo do fluxo: preencher `returned_at` no(s) item(ns), criar movimento de retorno (`+ balance`),
atualizar a ficha (F6), listar pendentes de devolução (`returned_at IS NULL`).

### F6 · Ficha/histórico de EPI por funcionário — #21

Visão só-leitura da "ficha de EPI" de um funcionário: todos os EPIs entregues, com **CA · Tam. · Data
de Entrega · Data de Devolução · Status de Assinatura**. Filtros por período e status
(pendente/devolvido/todos). **Impressão** da ficha de controle (CSS print/PDF). Query = join de
`epi_deliveries` × `epi_delivery_items` × `epi_catalog` (× funcionário), escopada por tenant.

### F7 · EPI × risco (neutralização) — #78 (Fase 03)

Fora da Fase 02, mas parte do modelo: liga um EPI (`catalog_id`) a um risco/GES (`ges_id`) com a flag
`neutralizes`. Serve ao PGR ("este EPI neutraliza este risco?"). Só mencionado aqui para fechar o
mapa; detalhamento fica com a fase de riscos.

---

## 5. A camada de assinatura digital (infra #67 — transversal)

A entrega (F4) **não** implementa assinatura do zero — ela **consome** uma infra de plataforma
(Fase 0, issue #67) reusada por 6 fluxos (EPI, OS, inspeção, PGR, foto 3x4, psicossocial):

- **Token único** por evento (curta duração, seguro contra adivinhação) → gera **QR Code** e/ou
  **link**.
- **Rota pública** `app/(public)/assinar/[token]` valida o token e mostra o formulário de captura.
- **Captura** da assinatura (canvas/imagem) e armazenamento.
- **Painel interno "Aguardando confirmação"** com atualização em tempo real (polling/SSE).
- **Envio** do link por telefone/e-mail; **fallback manual** (impresso) registrado no sistema.

No modelo de EPI, o gancho já existe: `epi_deliveries.auth_token` (único quando presente) +
`signature_status`. A infra #67 preenche esses campos.

---

## 6. Referência: quem mexe no saldo (e em que direção)

| `stock_movement_type` | Origem                     | Efeito no `balance` | Issue          |
| --------------------- | -------------------------- | ------------------- | -------------- |
| `purchase`            | entrada manual (compra)    | **+**               | #72            |
| `adjustment`          | saída manual (ajuste)      | **−**               | #72            |
| `discard`             | saída manual (descarte)    | **−**               | #72            |
| `employee_delivery`   | entrega a funcionário (F4) | **−**               | #19            |
| _`return` (futuro)_   | devolução (F5)             | **+**               | #20 (migração) |

`quantity` é **sempre positivo**; o sinal acima vem do `type`. Toda alteração passa pela transação da
§4/F3 (`SELECT … FOR UPDATE` → valida `>= 0` → INSERT movimento + UPDATE saldo).

---

## 7. Isolamento multi-tenant (invariante, vale para tudo)

- **Todo** acesso passa por `withOrg(orgId, tx => …)`; `org_id` vem **sempre da sessão**
  (`requireTenantContext()`), **nunca** do cliente. RLS no papel `app_runtime` é o backstop.
- `companies` (empresa-cliente) é **dimensão dentro do tenant**, não fronteira de isolamento — o
  tenant é o **escritório** (`orgs.id`).
- Entregas cruzam `employees` (também isolado por tenant): uma entrega só enxerga funcionários do
  próprio tenant.

> ⚠️ Vários corpos de issue antigos citam `organization_id` do Clerk e "SQLite em memória" para
> testes — **desatualizado**. O isolamento é por `org_id` interno via `withOrg`+RLS, e os testes de
> integração rodam contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

---

## 8. Ordem de implementação sugerida (por dependência)

```
#18 Catálogo ──► #70 Estoque ──► #72 Movimentações ──► #19 Entrega ──► #21 Ficha
                                        (F3: saldo)        │  (+#67 assinatura)
                                                           └──► #20 Devolução (após migração)

paralelo/independente: #115 Validação de CA (depende só de #18 + base CAEPI)
Fase 03: #78 EPI × risco
```

Racional: nada mexe em saldo sem o **estoque** existir; a **entrega** depende da transação de saldo
**e** da infra de assinatura; a **devolução** e a **ficha** dependem da entrega; a **validação de
CA** é ortogonal (encaixa no catálogo assim que a base CAEPI existir).

---

## 9. Pontos sensíveis e lacunas conhecidas

1. **Saldo transacional (o mais perigoso).** Toda escrita de `balance` tem que ser
   `SELECT … FOR UPDATE` + validação `>= 0` + INSERT+UPDATE na **mesma** transação `withOrg`. Sem a
   trava, duas saídas concorrentes furam o saldo. O `CHECK balance >= 0` é só backstop — a mensagem
   amigável (`INSUFFICIENT_STOCK` → 422) vem da validação na app.
2. **Devolução (#20) exige migração antes de codar.** Faltam: valor `return` no enum
   `stock_movement_type` **e** coluna `returned_at` (date/timestamp, nullable) em
   `epi_delivery_items`. É a única fatia do módulo que **não** é "zero migration".
3. **Entrega × assinatura são assíncronas.** Decisão a fixar: a **baixa de estoque acontece na
   confirmação da entrega** (F4/passo 4), enquanto a **assinatura pode completar depois**
   (`pending` → `signed_*`). Ou seja, o EPI sai do estoque no ato; a assinatura é a **prova de
   recebimento**, que pode chegar via QR/link minutos depois. (Alinhado ao ePGR e à #19.)
4. **Dependência da infra #67.** A entrega (#19) não fecha sem a camada de assinatura digital
   (token/QR/link/rota pública). Se #67 não estiver pronta, dá para entregar #19 com **assinatura
   manual** primeiro e plugar QR/link quando a infra existir.
5. **Exclusões e integridade.** `epi_delivery_items.catalog_id` é **RESTRICT** (não apaga item do
   catálogo já entregue); `stock_movements.delivery_id` é **SET NULL** (movimento sobrevive à
   exclusão da entrega). Excluir uma entrega **não** estorna saldo automaticamente — decidir se
   exclusão de entrega deve gerar movimento de estorno (recomendado: **não permitir excluir** entrega
   assinada; usar devolução para retornar saldo).
6. **Issues com contexto desatualizado.** Campos citados em issues antigas (`standard`,
   `ca_expires_at`, `current_balance`, `minimum_quantity`, `epi_categories`, Clerk `organization_id`,
   SQLite) **não** batem com o schema real (`norm`, `ca_valid_until`, `balance`, `min_quantity`,
   `categories`, `org_id`+`withOrg`, Postgres efêmero). **Fonte da verdade = o schema**
   (`src/shared/db/schema/epis.ts`), não o texto da issue.

---

## 10. Estado atual (resumo)

- ✅ **Modelo de dados** (#17, fatia 008): as 6 tabelas + 2 enums + RLS, mergeado.
- ✅ **Categorias** (#73): CRUD que o catálogo referencia.
- 🔄 **Em andamento/planejado:** catálogo (#18), estoque (#70), movimentações (#72) — há specs locais
  (`.specs/010-epi-catalog-crud`, `.specs/010-stock-movements`).
- ⏳ **Pendente:** entrega+assinatura (#19), devolução (#20, precisa migração), ficha (#21),
  validação de CA (#115/#75), infra de assinatura (#67), EPI×risco (#78, Fase 03).

---

## Referências

- Modelo real: `src/shared/db/schema/epis.ts`.
- CA/CAEPI: [`caepi-logica-de-negocio.md`](./caepi-logica-de-negocio.md) · [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md).
- Fatias EPI existentes: `docs/briefings/briefing-epi-data-model.md`, `briefing-epi-stock-crud.md`,
  `briefing-stock-movements.md`.
- Padrões de API/tenant: `CLAUDE.md` (seções "API surface" e "Tenant isolation").
