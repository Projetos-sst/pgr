# ePGR — Qualidade (GED), eSocial, Treinamentos, Permissões e Formulários

---

## 1. GED — Gestão Eletrônica de Documentos (`/ged/lista`) — `api/documento/`, `api/pasta/`, `api/backblaze/`

Repositório de documentos com pastas hierárquicas e versionamento.
- KPIs: **Documentos · Pastas · Vencem em 30d · Vencidos**.
- Tabela: **(ícone) · Nome · Tipo · Versão · Tamanho · Criado em · Vencimento · Status · Opções**.
- Ações: **Criar** (Nova Pasta — organizar documentos), **Upload de Arquivo** (PDF, Word, Excel).
- Busca "Pesquisar documentos da raiz"; navegação por pastas (breadcrumb "Início").
- Documentos têm **vencimento** (controle de validade, alerta de vencidos/a vencer) e **versão**.
- Armazenamento físico em **Backblaze B2** (`api/backblaze/`).
- Integração: documentos do GED podem ser anexados ao **PGR** (aba "Documentos GED").

## 2. eSocial (`/esocial`, `/esocial/detalhe/:id`) — `esocialService` + `api/Relatorios/gerar-eventos-esocial`

Geração/transmissão de eventos SST do eSocial.
- Configuração: ambiente padrão **Produção** (`ambientePadrao: "Producao"`, sem seleção de ambiente pela UI).
- Lista de eventos com filtros **Data Inicial / Data Final / Status**; seleção múltipla para ação em lote.
- Operações do serviço: **listarEventos**, **enviarEventoEmLote**, **consultarRetornoEmLote**, **gerarRelatorio**.
- Geração de arquivo (XML/retorno) via `api/Relatorios/gerar-eventos-esocial` (blob).
- **Eventos suportados** (detectados no bundle):
  - **S-2190** — Admissão preliminar
  - **S-2200** — Admissão / Cadastramento inicial do vínculo
  - **S-2210** — Comunicação de Acidente de Trabalho (CAT)
  - **S-2220** — Monitoramento da Saúde do Trabalhador (ASO)
  - **S-2221** — Exame Toxicológico do Motorista Profissional
  - **S-2240** — Condições Ambientais do Trabalho / Agentes Nocivos (alimentado pelo inventário de riscos)
  - **S-2300** — Trabalhador Sem Vínculo de Emprego/Estatutário (TSVE) — início
- O mapeamento S-2240 vem do formulário de risco (código do agente nocivo + unidade de medida eSocial).

> Requisito de paridade: motor de geração de eventos eSocial SST a partir dos dados de risco/funcionário,
> com envio/consulta em lote e controle de status de retorno.

## 3. Treinamentos (`/treinamentos/lista`) — `api/treinamento/`

Colunas: **Nome · Descrição · Norma Ref. · Empresa · Carga Horária · Opções**.

**Formulário (`/treinamentos/detalhe`):**
- `Nome do Treinamento`
- `Norma Referência` (`normaReferencia`, ex.: NR-10, NR-35)
- `Carga Horária` (`cargaHoraria`, em horas — number)
- `Periodicidade` (select): **Anual / Bianual (2 anos) / Trienal (3 anos) / Quinquenal (5 anos) / Única (sem reciclagem)**
- `Descrição` (textarea)
- Vínculo: exigido por **Função** (form de Função) → aparece na aba "Treinamentos Obrigatórios" do funcionário;
  a periodicidade controla a reciclagem/validade.

## 4. Permissões de Trabalho (PT) (`/permissoesdetrabalho`)

- Módulo de Permissão de Trabalho (atividades de risco: trabalho a quente, altura, espaço confinado, etc.).
- **Status atual: módulo stub** — a tela renderiza apenas o título/placeholder nesta versão (sem lista/form ativos).
  Aparece no menu Módulos; provável funcionalidade futura.

## 5. Controle de Formulários (`/controle-formularios/lista`) — `api/controleformulario/`

Controle documental (estilo ISO) dos cabeçalhos de formulários/documentos.
Colunas: **Tipo · Modo · Posição · Conteúdo · Data · Equipamento · Empresa · Opções**.

**Formulário (`/controle-formularios/detalhe`):**
- `Tipo de Formulário` * (select)
- `Empresa` *
- `Código (FRM)` (`codigoFormulario`, ex.: 02)
- `REV` (`numeroRevisao`, nº da revisão, ex.: 01)
- `Data` (`dataControle`)
- `N.C.` (`numeroNc`, nº de não conformidade, ex.: 03)
- `GES Responsável` / Setor (`setorResponsavel`, ex.: Qualidade)
- `Posicionamento` (onde aparece no cabeçalho) + **Preview no cabeçalho**
- `Observação` (opcional)
- Uso: injeta metadados de controle (código, revisão, data) no cabeçalho dos documentos gerados (PGR, OS, fichas, inspeções).
