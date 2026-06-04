# ePGR — Inventário de Riscos, Metodologia e PGR

O coração do produto: avaliação de riscos por GES (NR-01/GRO + eSocial S-2240) e geração do documento PGR.

---

## 1. Inventário de Riscos do GES (`/setores/riscos/detalhe`) — recurso `api/risco/`

Lista (`/setores/riscos/lista`): contexto Empresa + GES + Obra; colunas **Agente · Perigo · Risco ·
Fontes geradoras · Cadastro · Opções**; ações: **Metodologia de Avaliação**, **Voltar para GES**,
**Reutilizar** (reaproveitar riscos de biblioteca/outro GES), **Novo**.

**Formulário de Risco — campos:**

### Identificação do risco
- **`Agente`** (select): `Físico` · `Químico` · `Biológico` · `Ergonômico` · `Mecânicos` · `Acidentes` · `Fatores psicossociais`
  - (campo oculto `subtipoErgonomico` para detalhar agentes ergonômicos)
- `Perigo` (`perigo`)
- `Risco` (`descricao`)
- `Identificação das fontes geradoras` (`identificacaoFonteGeradora`)
- `Trajetória/Meios de Propagação` (`trajetoriaMeioPropagacao`)
- **`Tempo de Exposição`** (select): faixas
  `< 1 h/turno de 8h ou < 5 h/sem` · `1 a 2 h…(5 a 10 h/sem)` · `2 a 4 h…(10 a 20 h/sem)` ·
  `4 a 7 h…(20 a 35 h/sem)` · `> 7 h…(> 35 h/sem)` · `Eventual` · `Intermitente` · `Habitual`
- `Possíveis Lesões` (`possiveisLesoes`)

### Mapeamento eSocial (S-2240) — *obrigatório*
- **`Código do Agente Nocivo (eSocial)`** (`codigoAgenteNocivoEsocial`) — busca por código/descrição (ex.: `01.01.001`)
- **`Unidade de Medida (eSocial)`** (`unidadeMedidaEsocial`) — lista oficial:
  `Não aplicável (Avaliação Qualitativa)` · `1 dose diária de ruído` · `2 dB(linear)` · `3 dB(C)` · `4 dB(A)` ·
  `5 m/s²` · `6 m/s^1,75` · `7 ppm` · `8 mg/m³` · `9 f/cm³` · `10 °C` · `11 m/s` · `12 %` · `13 lux` ·
  `14 ufc/m³` · `15 dose diária` · `16 dose mensal` · `17 dose trimestral` · `18 dose anual` ·
  `19 W/m²` · `20 A/m` · `21 mT` · `22 µT` · `23 mA`

### Concentração / Intensidade
- Bloco para valor medido (quantitativo) da concentração/intensidade do agente.

### Avaliação (matriz de risco)
- `Critério` (`criterio`): `Qualitativo` / `Quantitativo`
- `Gradação da Probabilidade` (`gradacaoProbabilidade`) — opções definidas pela **Metodologia** (1–5)
- **`Severidade`** (`severidade`):
  `1 - Lesão leve sem necessidade de atenção médica` · `2 - Lesão/doença séria reversível` ·
  `3 - Lesão/doença crítica irreversível que pode limitar capacidade funcional` ·
  `4 - Lesão/doença incapacitante ou mortal` · `5 - Mortes ou incapacitantes múltiplas (>10)`
- `Nível Risco X x Y` (`nivelRiscoXY`) — resultado probabilidade × severidade
- **`Grau de Incerteza / Priorização`** (`priorizacao`): `0 - Certa` / `1 - Incerta` / `2 - Altamente Incerta`
- `Necessidade Controle Informação Adicional`
- `Resultado`
- `Limite de tolerância` (`limiteTolerancia`)

### Hierarquia de Controles (NR-01) — 4 níveis, cada um com Sim/Não + justificativa + monitoramento
1. **I. Eliminação dos fatores de risco?** — `simNaoUm` (checkbox) · `eliminacaoFatoresRisco` (textarea) · `monitoramentoUm`
2. **II. Minimização/controle por proteção coletiva?** — `simNaoDois` · `minimizacaoProtecaoColetiva` · `monitoramentoDois`
3. **III. Minimização por medidas administrativas/organização do trabalho?** — `simNaoTres` · `minimizacaoOrganizacaoTrabalho` · `monitoramentoTres`
4. **IV. Adoção de medidas de proteção individual (EPI)?** — `simNaoQuatro` · `adocaoEpi` · `monitoramentoQuatro`
- `Justificativa de aceitação de risco`
- `Monitoramento`

### EPIs do risco — recurso `api/epirisco/`
- Tabela na própria tela do risco: **Nome · CA · Neutraliza os Riscos? · Opções** (com busca de EPI e botão "Não Aplicável").
- CA = Certificado de Aprovação (validável via CAEPI/MTE).

### Plano de ação do risco — recurso `api/planoDeAcao/`
- Vínculo direto: "Criar Primeiro Plano" / "Nenhum plano de ação cadastrado" (ver `05-gestao-seguranca.md`).

---

## 2. Metodologia de Avaliação de Riscos (modal global)

Disponível em GES/Riscos/PGR (botão "Metodologia de Avaliação"). Base teórica declarada:
**AIHA**, **AS/NZS 4360**, **European Commission**, conforme **Fundacentro**.
Abas: **Probabilidade · Severidade · Matriz de Risco · Controle de Riscos**.

### Gradação de Probabilidade (1–5)
| Nível | Classificação | Descrição |
|---|---|---|
| 1 | Rara | Ocorrência improvável no tempo de exposição |
| 2 | Pouco Provável | Pode ocorrer ocasionalmente no tempo de exposição |
| 3 | Possível | Pode ocorrer algumas vezes no tempo de exposição |
| 4 | Provável | Provavelmente ocorrerá no tempo de exposição |
| 5 | Muito Provável | Ocorrerá frequentemente no tempo de exposição |

### Gradação de Severidade (1–5)
| Nível | Classificação | Descrição |
|---|---|---|
| 1 | Leve | Lesões ou doenças sem afastamento |
| 2 | Baixa | Lesões ou doenças com afastamento curto |
| 3 | Moderada | Lesões ou doenças críticas irreversíveis |
| 4 | Alta | Incapacidade permanente parcial |
| 5 | Extrema | Morte ou incapacidade permanente total |

### Matriz 5×5 de Risco — classificação dos níveis (Probabilidade × Severidade)
| Faixa (produto) | Classificação |
|---|---|
| 1–3 | Trivial |
| 3–8 | Tolerável |
| 4–12 | Moderado |
| 10–20 | Substancial |
| 20–25 | Intolerável |

> Exemplo do app: "Ruído ocupacional de 40 dB > 10% e < 50% do LEO (85 dB)" para calibrar a probabilidade.
> A aba "Controle de Riscos" reforça a hierarquia NR-01 (eliminação → coletiva → administrativa → EPI).

---

## 3. Sugestão de Riscos por IA — recursos `api/modelagemRisco/`, `api/OpenAI/`

- Botão **"Sugerir Riscos com IA"** no detalhe do GES.
- Correlaciona **função × ambiente** (dados do GES: caracterização do processo + descrição do ambiente
  + funções) para sugerir um conjunto de riscos (agente/perigo/risco/fontes) — "92% de precisão" (marketing).
- **"Dicas de Preenchimento da IA"** em formulários (GES, etc.) — sugere texto para os campos.
- Indicadores na home: "Precisão da IA 92%", "Saúde da Modelagem 100% — cálculo matemático".
- Admin: **`/admin-global/uso-openai`** monitora consumo de tokens/uso da IA.

> Requisito de paridade: integrar provedor LLM (no sst-manager, usar Claude/Anthropic) com prompt
> personalizado que recebe contexto do GES e devolve lista estruturada de riscos sugeridos para revisão humana.

---

## 4. PGR — Programa de Gerenciamento de Riscos — recursos `api/pgrs/`, `api/pgrsetor/`, `api/revisao/`, `api/sumario/`

Lista (`/pgrs/lista`): filtros Empresa + Obra; colunas **Emissão · Validade · Obra/Contrato · Empresa ·
Responsável pela elaboração · Usuário · Opções**; botões "Metodologia de Avaliação" e "Novo".

### Fluxo de criação
1. Clicar **Novo** → abre modal **"Declaração de Ciência de Riscos"**:
   - Texto: declara ciência dos riscos e medidas; ciência de que descumprir expõe trabalhadores;
     compromisso de adotar medidas preventivas conforme **NR-01 e demais NRs**.
   - Checkbox obrigatório "Declaro ter lido e aceito a declaração de ciência de riscos" + **"Confirmar e prosseguir"**.
2. Vai para o **editor de PGR** (`/pgrs/detalhe`), organizado em **abas**:

| Aba | Conteúdo |
|---|---|
| **PGR** | Informações Básicas (Empresa, Unidade de Obra/Contrato) + **Informações do Responsável**: `Responsável da empresa` (coordenador), `Registro` (`tipoRegistro`: CRM / CREA / MTE / Não aplicável), `Nº do registro` (`rmteCoordenador`) |
| **GES** | Vincula os GES da obra ao PGR ("Salve o PGR para vincular GES") — recurso `api/pgrsetor/` |
| **Revisões** | Histórico/versões do PGR ("Salve o PGR para adicionar revisões") — recurso `api/revisao/` |
| **Configurar Cor e Sumário** | Personaliza **cor** da capa e o **sumário/índice** do documento — recurso `api/sumario/` |
| **Documentos GED** | Anexa documentos do GED ao PGR |

3. Após configurar, **gerar o documento**: rota **`/pgrs/gerarpgr/:id`** produz o PGR final
   (PDF com capa, sumário, caracterização dos GES, inventário de riscos, plano de ação, controles).

### Assinatura do PGR
- Rota pública **`/assinaturapgr/:param`** — assinatura digital do PGR (responsável/empresa) via link/token.

### Campos/metadados do PGR (da lista e editor)
- Data de **Emissão** e **Validade** (vigência do programa).
- **Obra/Contrato** e **Empresa**.
- **Responsável pela elaboração** (com registro profissional) e **Usuário** que emitiu.

> Requisito de paridade: o PGR consolida automaticamente GES + riscos + controles + planos de ação
> da obra num documento versionado, com capa customizável, sumário configurável, declaração de ciência
> e assinatura digital.
