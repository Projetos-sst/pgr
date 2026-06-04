# ePGR — Gestão de Segurança (Incidentes, Planos de Ação, OS, Psicossocial)

Menu "Gestão de Segurança": Riscos Psicossociais · Gestão de Incidentes · Gestão de Planos de Ação · Gestão de OS.

---

## 1. Incidentes / Acidentes (`/incidentes/detalhe`) — `api/incidentes/`

Lista (`/incidentes/lista`): **Data · Empresa · Acidentado · Descrição · Categoria · Status · Opções**.

**Formulário (investigação de acidente) — abas:**

### Aba "Dados do acidentado, local e descrição"
- `Empresa`, `Funcionário` (acidentado), `Local`
- `Tipo de acidente` (`tipoAcidente`): **Típico / Trajeto / Doença ocupacional**
- `Categoria` (`categoria`): **Saúde / Meio ambiente / Segurança do trabalho**
- `Gravidade` (`gravidade`): **Alta / Média / Baixa**
- `Houve afastamento?` (Sim/Não)
- `Classificação da lesão`, `Parte do corpo atingida` (código/descrição), `Agente causador` (código/descrição)
- `Data do acidente`, `Horas trabalhadas até o acidente`, `Hospital de atendimento`
- `Descrição da Natureza da Lesão` (código/descrição), `Descrição do acidente`

### Aba "Possíveis causas e impactos"
- `Descrição das possíveis causas`
- `Impactou o meio ambiente (solo, rio, mar, ar, biodiversidade)?` + `Potencial de Impacto ao meio ambiente?`
- `Houve perda material?`
- `Houve lesão em outra pessoa (não empregado/contratado/subcontratado)?` + `Potencial de fatalidade em outra pessoa?`
- `Área responsável pelo local do evento (supervisão ou gerência)`
- `Ocorreu durante atividade controlada?`
- `Procedimento associado`
- Testemunha: `Usar funcionário da empresa como testemunha` (checkbox), `Nome da testemunha`, `Função da testemunha`

### Aba "Fotos"
- Anexo de fotos do acidente (após salvar).

> Alinhado a **CAT** (eSocial **S-2210**) e investigação de causas. Campos de código/descrição sugerem
> tabelas oficiais (natureza da lesão, parte do corpo, agente causador — tabelas CAT/eSocial).

## 2. Gestão de Incidentes (`/gestaodeincidentes`)

Acompanhamento do ciclo de vida. Colunas: **Data · Empresa · Acidentado · Descrição · Categoria · Gravidade · Status**.
Filtros de status: **Todos / Aguardando planejamento / Aguardando conclusão / Concluído** + "Ocultar concluídos".
Cada incidente avança: registro → planejamento (planos de ação) → conclusão.

## 3. Planos de Ação (`/planosdeacao`, `/planosdeacao/gestao`) — `api/planoDeAcao/`

Gestão central de ações corretivas/preventivas (estilo 5W2H). Colunas:
**Empresa · Tipo · Localização · Referência · Ação / Responsável · Prazo · Status · Opções**.
Filtros: Obra, **Tipo**, e status: **Todos / Programado / Pendente / Concluído / Cancelado / Próx. Vencer em 30d**.

- Plano de ação pode originar de: **risco** (GES), **ocorrência de inspeção**, **incidente**, **não conformidade**.
- Lista/gestão expõe: `Tipo`, `Localização`, `Referência` (origem), `Ação / Responsável`, `Prazo`, `Status`;
  **prazos automatizados + alertas inteligentes** (status "Próx. Vencer em 30d").

**Formulário (modal "Plano de Ação", criado a partir do risco — botão "Criar Primeiro Plano"):**
- `Fonte de risco ocupacional` (`fonteRisco`, preenchido a partir do risco)
- `Nível de risco` (`nivel`, do risco)
- `Ação a ser implementada` (`acao`, textarea) — *o quê / como será feito*
- `Formas de acompanhamento` (`formaAcompanhamento`, textarea) — como a execução será acompanhada
- `Aferição de resultados` (`afericaoResultados`, textarea) — como medir os resultados
- `Responsável pela ação` (`responsavel`) — *quem*
- `Prazo para execução` (`dataPrazo`, date) — *quando*

## 4. Ordens de Serviço (OS) (`/gestaodeos`)

OS funcional de SST (NR-01 1.5.7.3 — cientificar o trabalhador sobre riscos/medidas/EPIs). Duas visões:
- **OS Abertas**: **Funcionário · Empresa · Tipo OS · Data Emissão · Dias Aberta · Status de Assinatura · Opções**
- **OS Assinadas**: **Funcionário · Empresa · Tipo OS · Data Assinatura · Status · Opções**

- OS emitida por funcionário (a partir do GES/função/riscos/EPIs do trabalhador).
- **Assinatura digital**: rota pública **`/assinaturaos/:param`** (trabalhador assina via link/QR).
- Rastreia **dias em aberto** e **status de assinatura** (pendente/assinada).

## 4b. Riscos e Auditorias (`/riscoseauditorias/lista`, `/riscoseauditorias/detalhe/:id`)

> **Módulo premium** (consta como benefício de plano superior, ~R$399,90/mês "Gestão de Riscos e Auditorias").
> Na conta de teste (plano básico) o módulo fica **bloqueado/limitado**; documentado via UI parcial + bundle.

Workflow de **análise e auditoria de riscos/incidentes** no formato **kanban por status**:
- Abas/etapas: **Aguardando análise → Planejando ações → Concluído**.
- Ação inicial: **"Iniciar Análise"** (move o item de "aguardando" para "planejando ações").
- Detalhe (`app-riscoseauditorias-detalhe`): modais **"Alterar Status"** e **"Detalhes"**; cada item analisado
  gera/recebe **planos de ação** (integra com `api/planoDeAcao/`).
- Sobrepõe-se à Gestão de Incidentes, porém com enquadramento de **auditoria** (tratativa formal de riscos
  identificados e não conformidades até a conclusão).

> Sugestão de IA também para planos de ação (`app-plano-acao-modal-sugestao`): além de "Sugerir Riscos com IA",
> o sistema sugere **planos de ação por IA** para os riscos/itens.

## 5. Riscos Psicossociais — Mapeamento (`/gestaoriscospsico/detalhe`) — `api/campanhas-psicossociais/`

Lista (`/gestaoriscospsico/lista`): **Data Início · Data Fim · Empresa · Mapeamento/Obra · Status · Opções**;
filtro por Obra; botão "Novo".

**Editor de campanha (Mapeamento Psicossocial) — etapas/abas:**
`Informações` · `Perguntas` · `Respostas` · `Dashboard` · `Riscos` · `Conclusão`.

- **Informações**: `Nome` (ex.: "Pesquisa de Clima Psicossocial 2026"), `Obra/Local`, `Data Início`, `Data Fim`,
  `Cor do Tema/Capa`, `Descrição` (exibida ao funcionário no topo do questionário).
- **Perguntas**: monta o questionário psicossocial.
- **Respostas**: trabalhadores respondem via rota pública **`/responderpsico/:campanhaId/:token`** (anônimo/por token).
- **Dashboard**: análise dos resultados.
- **Riscos**: deriva riscos psicossociais do resultado (alimenta o inventário/PGR — agente "Fatores psicossociais").
- **Conclusão**: relatório/encerramento.

> Atende à inclusão de **riscos psicossociais** no GRO/PGR (NR-01, vigência 2025+).
