# ePGR — Cadastros Base

Cadeia obrigatória: **Empresa → Unidade de Obra → GES → (Funções + Riscos)**; **Funcionário** vincula GES+Função.

---

## 1. Empresa (`/empresas/detalhe`) — recurso `api/empresas/`

Entidade-tenant. Lista (`/empresas/lista`): busca por CNPJ/nome fantasia/razão social; colunas
**CNPJ · Nome fantasia · Razão social · Email · Opções**.

**Formulário (Detalhes da Empresa):**

- **Logo da empresa** (upload de imagem) — usada no cabeçalho do PGR.
- **Informações Básicas**
  - `CNPJ` (máscara `00.000.000/0000-00`) + **botão de busca** (autopreenche dados via consulta de CNPJ).
  - `Telefone` (máscara `(00) 00000-0000`)
  - `Email`
  - `Nome Fantasia`
  - `Razão Social`
- **Endereço**
  - `Endereço` (rua, número, bairro)
  - `UF` (select com 27 UFs)
  - `Cidade`
- **Atividade Empresarial**
  - `CNAE` (máscara `0000-0/00`)
  - `Atividade Principal` (descrição)
  - **`Grau de Risco`** (select 1–4) — grau de risco NR-04, define exigências.
- Ações: **Cancelar** / **Salvar Nova Empresa**.

> Regra: sem empresa cadastrada, o app mostra "Cadastrar primeira empresa" e bloqueia os módulos.

---

## 2. Unidade de Obra (`/unidades-obra/detalhe`) — recurso `api/unidadeobra/`

Obra/contrato/local físico onde existem os GES. Lista: busca por nome/contrato/empresa;
colunas **Nome · Nº Contrato · Empresa · Cidade/UF · Opções**.

**Formulário:**

- `Empresa` (herda do contexto global)
- `Nome da Unidade de Obra / Local` *(obrigatório)* — ex.: "Obra Centro, Galpão B"
- `Número do Contrato` — ex.: "2023/001"
- `Objeto do Contrato / Descrição` *(obrigatório)* — escopo da obra (textarea)
- **Endereço**: `CEP` (autocompleta via **ViaCEP**), `Logradouro`, `Número`, `Complemento`, `Bairro`, `Cidade`, `UF`
- Botão **"Preencher com endereço da Empresa"** (copia endereço da empresa)
- Ações: Cancelar / Salvar alterações

---

## 3. GES — Grupo de Exposição Similar (`/setores/detalhe`) — recurso `api/setor/`

> "GES" na UI; rota/recurso internos = "setor". É o agrupamento de trabalhadores com exposição
> similar — núcleo da caracterização ambiental para o PGR.

Lista (`/setores/lista`): filtros **Empresa** + **Obra/Local** ("Todas as Obras"); card "Total de
Trabalhadores"; busca por nome/descrição; colunas **GES · Descrição · N° trabalhadores · Opções**.

**Formulário — seções: Identificação do GES / Caracterização do Processo / Descrição do Ambiente:**

- `Nome do GES` *(obrigatório)* — campo com **sugestões da IA** ("Digite o nome ou selecione uma sugestão")
- `Empresa`, `Unidade de Obra / Contrato` (select `unidadeObraId`)
- `N° de trabalhadores expostos` (`nTrabalhadores`, **somente leitura** — calculado a partir dos funcionários/funções)
- `Funções do GES` — sublista de funções vinculadas (ver botão "Gerenciar Funções")
- **Caracterização do Processo**
  - `Caracterização detalhada do processo` (`descricao`, textarea) — atividades, ferramentas, equipamentos,
    matérias-primas, dinâmica operacional.
- **Descrição do Ambiente** (todos obrigatórios)
  - `Tipo de construção` (ex.: Alvenaria, Galpão metálico)
  - `Pé direito (altura)` (ex.: 3.5)
  - `Piso` (ex.: Cerâmico, Antiderrapante, Concreto)
  - `Cobertura` (ex.: Telha termoacústica, Fibrocimento)
  - `Iluminação` (ex.: LED 500lux, Natural)
  - `Ventilação` (ex.: Natural, Exaustores 2000CFM)
  - `Outras características ambientais relevantes` (textarea: temperatura, ruído, layout, sinalização, rotas de fuga)
- Botões: **"Dicas de Preenchimento da IA"**, Cancelar, Salvar alterações.

**Após salvar (`/setores/detalhe/:id`)** aparecem as ações centrais:
- **Gerenciar Funções** → funções do GES
- **Gerenciar Riscos** → inventário de riscos do GES (`/setores/riscos/lista`)
- **Sugerir Riscos com IA** → motor `modelagemRisco`/`OpenAI` correlaciona função × ambiente e sugere riscos

---

## 4. Funções do GES / Funções (`/funcoes/lista`) — recursos `api/funcao/`, `api/funcaosetor/`

Lista: filtro Empresa; busca por nome/descrição/empresa; colunas **Nome · Descrição · Empresa · Hora de trabalho · Opções**;
ações "Gerenciar Dados" e "Novo".

- `api/funcao/` = catálogo de funções/cargos.
- `api/funcaosetor/` (`FuncaoSetor`) = associação Função ↔ GES (setor), com nº de trabalhadores e jornada.

**Formulário de Função (`/funcoes/detalhe`):**
- `Empresa`
- `CBO` (`cbo`) — código da **Classificação Brasileira de Ocupações** (ex.: 411010), via `api/Cbo/`
- `Nome da Função`
- `Horário de trabalho` (`horarioTrabalho`)
- `Descrição` (textarea)
- **Treinamentos obrigatórios** — após salvar, vincula os treinamentos exigidos para a função
  (alimenta a aba "Treinamentos Obrigatórios" do funcionário).

---

## 5. Categorias (`/categorias/lista`) — recurso `api/categoria/`

Lista: filtro Empresa; busca por nome/tipo/empresa; colunas **Nome · Tipo · Empresa · Observação · Opções**.
Classificação auxiliar de EPIs/equipamentos.

**Formulário (`/categorias/detalhe`):**
- `Tipo` (mat-select): **EPI** / **Máquinas e Equipamentos**
- `Nome da Categoria` (ex.: Capacete, Máquina de Solda)
- `Observação` (textarea)

> Funcionário exige (validação): Nome, GES, Função do GES, Nascimento, Estado civil, Matrícula, Admissão.
> GES e Função do GES são selecionados por **picker (lupa)**; Função precisa estar vinculada ao GES
> (GES → "Gerenciar Funções" → Incluir, em `/setores/funcoessetor` — `api/funcaosetor/`).

---

## 6. Funcionário (`/funcionarios/detalhe`) — recurso `api/funcionario/`

Lista (`/funcionarios/lista`): filtro Empresa + status **Todos/Ativos/Inativos**; busca por nome/GES/função;
colunas **Nome · GES/Obra · Empresa · Ordens de Serviço · Status · Opções**; ações "Gerenciar Dados" e "Novo".

**Formulário — abas: Geral / Endereço e Contato / Treinamentos Obrigatórios:**

### Aba Geral
- `Nome`
- `Nascimento` (date)
- `Sexo` (select: Masculino / Feminino / Outro / Não especificado)
- `Estado civil` (select: Solteiro(a) / Casado(a) / União estável / Divorciado(a) / Viúvo(a) / Separado(a))
- `Tel./Cel.` (`celular`)
- `Email`
- `CPF`, `RG`, `CNH`, `Passaporte`
- **`Foto 3x4`** (upload; também alimentável pela rota pública `/foto3x4/:param`)
- `Empresa` (`nomeEmpresa`)
- `GES` (`nomeSetor`)
- `Função do GES` (`nomeFuncao`)
- `Crachá` (`cracha`) + `Validade do crachá` (date)
- `Matrícula`
- `Tipo sanguíneo`
- `Admissão` (date), `Demissão` (date)

### Aba Endereço e Contato
- `CEP` (ViaCEP), `Endereço`, `Número`, `Complemento`, `Bairro`, `UF`, `Cidade`
- `Contatos de emergência`

### Aba Treinamentos Obrigatórios
- Lista de treinamentos exigidos para o funcionário (vínculo com módulo de Treinamentos; vazio = "Nenhum treinamento obrigatório").

- Ações: Cancelar / Salvar alterações.

**Ações relacionadas ao funcionário** (a partir da lista/detalhe):
- **Entrega de EPI** (`/funcionarios/entregarepi/:id`) — ver `03-epi-estoque.md`.
- **Histórico de entrega de EPI** (`/funcionarios/historicoentregaepi/:id`).
- **Ordens de Serviço** funcionais (coluna na lista) — ver `05-gestao-seguranca.md`.
