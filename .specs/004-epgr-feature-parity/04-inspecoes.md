# ePGR — Inspeções (Planos, Veiculares, Segurança, Equipamentos)

Módulo de inspeções com **planos de inspeção (modelos)** reutilizáveis e execução por tipo.

---

## 1. Planos de Inspeção (modelos) (`/planosdeinspecao/lista`)

Modelos reutilizáveis de checklist. Colunas: **Título · Tipo · Subtipo/Equipamento · Descrição · Empresa · Opções**.
Itens do plano: **`/planosdeinspecao/detalhe/:planoId/itens`** — lista de itens/perguntas do checklist
(o que será verificado em cada inspeção que usar este plano).

**Formulário do Plano (`/planosdeinspecao/detalhe`):**
- `Título` (ex.: "Inspeção de Veículos Utilitários")
- `Tipo de Inspeção` (mat-select): **Veicular** / **Máquinas e Equipamentos**
  (inspeção de *Segurança* não usa plano/checklist — usa ocorrências; ver §3)
- `Subtipo` (mat-select dependente do tipo)
- `Descrição` (textarea)

**Itens do plano (`/planosdeinspecao/detalhe/:planoId/itens`):** lista com colunas
**Ordem · Descrição · Valor Padrão · Opções**; botão "Novo Item". Form do item:
- `Descrição do Item` (textarea — "o que verificar")
- `Valor Padrão` (`valorPadrao`): **✓ Marcado / ✗ Desmarcado** (cada item é booleano com valor padrão)
- `Ordem` (number)

### Veículo (`/veiculos/detalhe`) — `api/veiculo/`
Lista: **Placa · Marca · Modelo · Cor · Tipo · Proprietário · Empresa · KM Inicial**.
Form: `Placa` (máscara AAA-0A00), `Marca`, `Modelo`, `Tipo` (Carro/Moto/Caminhão/Ônibus/Van/Utilitário/Caminhonete/Outro),
`Cor`, `Proprietário`, `KM Inicial` (`quilometragemInicial`), `Foto do Veículo`, `Anotações`.

## 2. Inspeções Veiculares (`/inspecoesveiculares/lista`)

Colunas: **Data · Veículo · Motorista · KM · Percurso · Empresa · Status · Opções**;
busca por motorista/placa/modelo/percurso; botão **"Nova Inspeção"**.
Visualização: **`/inspecoesveiculares/visualizar/:id`**.

- Vincula a **Veículo**. Registra KM, percurso, motorista, data, status e itens do checklist do plano.

**Formulário (`/inspecoesveiculares/detalhe`):** `Data da Inspeção`, `Veículo` (select),
`Plano de Inspeção` (preenchido automaticamente ao selecionar o veículo), `Nome do Motorista`,
`Registro/CNH do Motorista`, `Quilometragem Atual`, `Percurso` (ex.: "Cidade A → Cidade B"),
`Observações Gerais` → **"Salvar e Continuar"** abre o preenchimento dos itens do checklist.

## 3. Inspeções de Segurança (`/inspecoes-de-seguranca/lista`)

Colunas: **Data · Área · Tipo · Empresa · Ocorrências · Status · Opções**; busca por área/anotações/status;
botão **"Nova Inspeção"**.
- **Ocorrências**: **`/inspecoes-de-seguranca/detalhe/:inspecaoId/ocorrencias`** — não conformidades
  encontradas (cada ocorrência pode gerar **plano de ação**).
- **Assinatura digital**: rota pública **`/assinaturainspeseguranca/:param`** (responsável assina a inspeção).

**Formulário (`/inspecoes-de-seguranca/detalhe`):** `Empresa`, `Data`,
`Tipo de Inspeção` (Programada / Não Programada), `Categoria` (Segurança / Meio Ambiente / Qualidade / Saúde / Outros),
`Área` (ex.: Produção, Escritório), `Responsável pela Inspeção` (busca funcionário), `Responsável pela Área`,
`Anotações / Observações` → após salvar registra as **ocorrências**.

## 4. Inspeções de Equipamentos (`/inspecoesequipamentos`)

- Inspeção de equipamentos/EPIs (vincula a `api/epi/` / equipamentos), usando plano de inspeção do tipo equipamento.
- Tela depende de equipamentos cadastrados.

## 5. Requisitos de paridade (inspeções)

- Biblioteca de **planos/checklists** reutilizáveis com itens configuráveis.
- Execução de inspeção por tipo (veicular/segurança/equipamento) com status, fotos e ocorrências.
- Ocorrência → **plano de ação** (corretivo) com prazo/responsável.
- **Assinatura digital** da inspeção via link/QR.
