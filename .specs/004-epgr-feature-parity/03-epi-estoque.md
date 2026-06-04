# ePGR — EPI, Estoque e Entrega com Assinatura Digital

Recursos: `api/epi/`, `api/epiestoque/` (`EpiEstoque`), `api/estoquemovimento/` (`EstoqueMovimento`),
`api/epirisco/`, `api/imagem/`, `api/backblaze/`. Integração CAEPI/MTE para validar CA.

---

## 1. Catálogo de EPI / Equipamentos (`/equipamentos/lista`) — `api/epi/`

Cadastro do item (EPI/equipamento). Colunas:
**CA · Nome · Tam. (tamanho) · Fabricante · Tipo · Categoria · Und. Medida · Empresa · Validade · Opções**.
Filtro por **Tipo** ("Todos os Tipos"), busca por nome/CA/categoria; ações "Gerenciar Dados" e "Novo".

**Formulário (`/equipamentos/detalhe`):**
- `Tipo` (mat-select): **EPI** / **Máquinas e Equipamentos**
- `Categoria` (`categoriaId`, filtrada pelo tipo — ver `api/categoria/`)
- `Unidade de Medida` (opcional; ex.: MM, CM, L, G, UN)
- `Empresa`
- `CA` (`ca`) — Número do Certificado de Aprovação (validável em **CAEPI/MTE**: `https://caepi.mte.gov.br/internet`)
- `Nome`
- `Tamanho` (opcional; ex.: 42, M, G, XL)
- `Fabricante`
- `Norma`
- `Validade` (do CA)
- `Descrição completa` (textarea)
- Foto do EPI (upload)

> "Categorias" (`/categorias/lista`) classifica itens: **Nome · Tipo · Observação**.

## 2. Estoque de EPI (`/estoque/lista`) — `api/epiestoque/`

Saldo por item/empresa. Colunas: **CA · Nome · Tam. · Und. Medida · Empresa · Mínima · Saldo · Opções**.
Filtros: **Apenas com saldo**; status **Todos / Sem Saldo / Abaixo da Mínima / Acima da Mínima**; busca por nome/CA/empresa.
Botão **"Gerenciar Dados"** (adicionar item ao estoque, definir quantidade mínima).

- `Quantidade mínima` (alerta de reposição) e `Saldo` atual.
- Ações por linha (3 botões): **registrar entrada**, **registrar saída**, **editar/mín./histórico**.
- **Registrar entrada no estoque** (modal): `Data` (`dataEntrada`), `Quantidade` (`quantidadeEntrada`),
  `Nº Nota fiscal` (opcional) → "Confirmar Entrada" (cria movimento e aumenta o saldo).
- **Histórico de movimentações** (`/estoque/historico/:id`) — `api/estoquemovimento/`:
  entradas/saídas (compra, entrega ao funcionário, ajuste, descarte) que alteram o saldo.

## 3. EPI × Risco (`api/epirisco/`)

- Vincula EPIs ao risco do GES, indicando se **"Neutraliza os Riscos?"** (tabela no formulário de risco:
  **Nome · CA · Neutraliza os Riscos? · Opções**).
- Base para recomendar/exigir EPIs por exposição no PGR e na OS.

## 4. Entrega de EPI com assinatura digital (headline) — fluxo completo capturado

**Passo 1 — Seleção (`/funcionarios/entregarepi/:id`):**
- Cabeçalho: Empresa + Funcionário.
- Tabela de EPIs **com saldo disponível**: `(checkbox)` · `CA` · `EPI` · `Tam.` · `Und. Medida` · `Descrição` ·
  `Fabricante` · `Disponível` (saldo) · `Quantidade`. Marca-se o checkbox da linha (habilita o campo Quantidade) e define-se a qtd.
- Busca por CA/nome. Botão **"Revisar e confirmar"**.

**Passo 2 — Preparar entrega (modal):** lista "Itens para Entrega (N)" com EPI/CA/saldo/qtd,
`Data de Entrega`, `Funcionário`. Botão **"Autenticar N EPI(s)"**.

**Passo 3 — Autenticação de entrega (modal, 3 métodos):**
- **QR Code**: exibe QR; o funcionário aponta a câmera → é levado à tela pública de assinatura
  **`/autenticacaoentregaepi/:param`** → painel mostra *"Aguardando confirmação…"* (tempo real).
- **Enviar Link**: envia o link de autenticação por **telefone/e-mail** do funcionário
  (exige contato cadastrado; senão "Ir para cadastro do funcionário").
- **Assinatura manual**: para quem não tem celular/e-mail — imprime a ficha de controle de EPIs pelo histórico,
  o funcionário assina fisicamente e devolve; depois **"Registrar assinatura manual"**.

**Passo 4 — Histórico (`/funcionarios/historicoentregaepi/:id`)**: ficha/histórico de entregas do funcionário
(EPIs entregues, CA, datas, status de assinatura), com impressão da ficha de controle.

Requisitos de paridade:
- **Ficha de EPI** por empregado (EPIs entregues, CA, datas, assinatura).
- Recibo assinável remotamente (QR/link com token) **ou** manualmente, com armazenamento da assinatura/imagem (Backblaze).
- Baixa automática de estoque na entrega; alerta de saldo abaixo da mínima.
