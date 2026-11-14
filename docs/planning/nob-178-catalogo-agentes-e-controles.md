# NOB-178 — catálogo de agentes e medidas de controle

Status: código, testes e documentação entregues. **Revisão do responsável técnico: pendente.**
Nada aqui foi aprovado por profissional de SST. Onde este documento diz "proposta", a lista veio
da equipe de desenvolvimento e espera conferência.

## 1. O que foi pedido e o que foi feito

| Pedido da issue                                                   | Situação                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Cruzar SEG-15/16/18/22 com a reunião                              | Feito na seção 2. A gravação da reunião não está no repositório (ver 2.1).                      |
| Manter a metodologia atual                                        | Mantida. Nenhuma fórmula, matriz, faixa ou limite foi alterado (seção 6).                       |
| Agentes e unidades por categoria                                  | Catálogo em código, como sugestão e aviso. Lista proposta na seção 3, pendente de revisão.      |
| Hierarquia eliminação, substituição, engenharia, adm. e EPI       | Entregue na tela, na API, no PDF e no DOCX (seção 4). Migration aditiva `0087`.                 |
| Anexos de máquina pelos tipos confirmados                         | Entregue pelo GED, com trava de acesso no banco (seção 5). Migration `0088`, só uma policy.     |
| Levantar as decisões do cadastro ainda "A definir"                | Seção 7.                                                                                        |
| Lista revisada pelo responsável, com exemplos válidos e inválidos | Lista e exemplos prontos (seção 3). **Revisão humana pendente.**                                |
| Campo quantitativo só quando aplicável                            | Corrigido na conferência do PGR (seção 3.4).                                                    |
| Registros anteriores continuam interpretáveis                     | Sem backfill. Testes de compatibilidade na seção 8.                                             |
| Orientação por nível e plano de ação no documento                 | Já existiam no DOCX e foram preservados. Uma divergência de texto ficou registrada (seção 4.3). |
| Anexo só na máquina e empresa corretas, acesso direto conferido   | Entregue e testado, inclusive por URL direta (seção 5.3).                                       |
| Mudança de fórmula ou limite depende de fonte e aprovação         | Nenhuma mudança feita. Regra registrada na seção 6.                                             |

## 2. Cruzamento das respostas com a reunião e com o código

### 2.1 Fontes usadas e fontes que faltam

- Respostas: `docs/planning/questionario-v3/01-MATRIZ-MESTRE.md` (SEG-15, 16, 18 e 22),
  `03-CONFLITOS-E-RECOMENDACOES.md` (C-21, C-22, C-23 e C-25) e `04-REGISTRO-DE-DECISOES.md`
  (DT-09, DT-10 e DT-11).
- Reunião de 05/10/2026: o repositório só tem a auditoria `docs/planning/reuniao-2026-10-05/AUDIT.md`,
  que declara que não existe ata. **A gravação (parte 1, 27:23 a 48:35) não está no repositório nem
  na máquina de desenvolvimento, então o trecho não foi conferido.** O cruzamento abaixo usa as
  seções 7 (R01, hierarquia) e 8 (R02, classificação) da auditoria.
- A tabela de agentes e unidades que o Expedito anexou na SEG-18 está no "Documento A"
  (`QUESTIONARIO-RESPONDIDO-CONSOLIDADO-V2-2026-11-02.docx`), que fica fora do repositório. **A
  tabela original não foi lida.** Por isso o catálogo da seção 3 é proposta da equipe, não a
  transcrição da tabela dele.

### 2.2 Tabela de cruzamento

| Questão | Resposta                                                                                                                                    | Reunião (auditoria)                                                                                     | Antes desta entrega                                                                | Depois desta entrega                                                                              | Pendente                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| SEG-15  | Marca "Fundacentro" e "Outro". Diz que a Fundacentro não tem padrão. Cita NR-03 e o Manual GRO/PGR. Escritório pode alterar.                | R02: cinco classes e ação por classe já existiam.                                                       | Preset `fundacentro` (matriz 5×5), editável por escritório.                        | Igual. Nada alterado.                                                                             | DT-09: rótulo do preset e qualquer tabela nova dependem do responsável técnico. |
| SEG-16  | Cinco orientações corretas. Orientação impressa em todos os riscos. Hierarquia em cinco níveis, com Substituição e Controles de Engenharia. | R01: hierarquia de 4 níveis por risco. A reunião falou "minimizar" e o sistema usa "proteção coletiva". | Enum `control_level` com 4 valores, sem substituição.                              | Cinco níveis, na ordem, na tela, API, PDF e DOCX.                                                 | Confirmar os termos (seção 7.1).                                                |
| SEG-18  | Exigir campos por categoria. "Deixar livre para ser acrescentado" quando o agente não estiver na tabela.                                    | Sem registro na auditoria.                                                                              | Agente em texto livre, unidade em enum do eSocial, sem catálogo por categoria.     | Catálogo por grupo com agentes de exemplo, unidades usuais e fonte. Sugere e avisa, não bloqueia. | Revisão da lista e regra de obrigatoriedade (DT-11).                            |
| SEG-22  | Seis itens "A definir". Confirma que não há vínculo direto entre máquina e riscos ou inspeções. Define os tipos de anexo.                   | Sem registro na auditoria.                                                                              | Cadastro por obra/GES e apêndice no DOCX (NOB-104). Sem arquivo anexado à máquina. | Anexos por máquina, só dos tipos confirmados, com trava de acesso.                                | Os seis itens seguem "A definir" (seção 7.3).                                   |

## 3. Catálogo de agentes e unidades por grupo

### 3.1 Como funciona

- Fica em `src/shared/domains/pgr/risk-agent-catalog.ts`, como constante tipada. Não há tabela nova.
- Cada grupo (os 7 valores de `risk_agent_type`) tem agentes de exemplo. Cada agente tem as unidades
  usuais e a fonte.
- **O campo "Perigo" continua texto livre**, como a SEG-18 pediu. O catálogo só oferece sugestões
  quando o grupo é escolhido.
- A lista de unidades do formulário mostra primeiro as usuais do grupo e marca as outras com
  "(fora do usual do grupo)". Nenhuma unidade some.
- A gravação (tela e API) **não recusa** unidade fora do usual. A conferência do PGR
  (`GET /pgr/{id}/readiness`) mostra o aviso `unit_outside_catalog`, que não impede a emissão.
- Quando o texto do perigo é igual ao nome de um agente do catálogo (sem diferenciar maiúsculas e
  acentos), valem as unidades daquele agente. Caso contrário, valem as do grupo.
- "Qualitativo / Não aplicável" é sempre aceita como usual.

Motivo de não bloquear: a lista ainda não foi revisada pelo responsável. A DT-11 recomenda aviso até
ele definir a obrigatoriedade. Bloquear com uma lista não aprovada travaria cadastro legítimo.

### 3.2 Categorias, campos, agentes, unidades e fonte (proposta)

Campos de todo risco: grupo do agente (obrigatório), descrição (obrigatória), perigo, fontes
geradoras, meios de propagação, tempo de exposição, possíveis lesões, código do agente (S-2240),
unidade de medida e concentração/intensidade. A conferência do PGR já exigia perigo, fontes e
possíveis lesões para emitir (NR-01 1.5.7.3.2), e isso não mudou.

| Grupo        | Agente de exemplo                          | Unidade usual | Fonte indicada        |
| ------------ | ------------------------------------------ | ------------- | --------------------- |
| Físico       | Ruído contínuo ou intermitente             | dB(A)         | NR-15, Anexo 1        |
| Físico       | Ruído de impacto                           | dB(C)         | NR-15, Anexo 2        |
| Físico       | Vibração de mãos e braços                  | m/s²          | NR-15, Anexo 8        |
| Físico       | Vibração de corpo inteiro                  | m/s²          | NR-15, Anexo 8        |
| Físico       | Calor                                      | °C            | NR-15, Anexo 3        |
| Físico       | Frio                                       | Qualitativo   | NR-15, Anexo 9        |
| Físico       | Umidade                                    | Qualitativo   | NR-15, Anexo 10       |
| Físico       | Radiações não ionizantes                   | Qualitativo   | NR-15, Anexo 7        |
| Químico      | Gases e vapores                            | ppm, mg/m³    | NR-15, Anexo 11       |
| Químico      | Poeiras minerais com sílica livre          | mg/m³, %      | NR-15, Anexo 12       |
| Químico      | Fibras de asbesto                          | f/cm³         | NR-15, Anexo 12       |
| Químico      | Fumos metálicos                            | mg/m³         | NR-15, Anexos 11 e 12 |
| Biológico    | Vírus, bactérias e fungos                  | Qualitativo   | NR-15, Anexo 14       |
| Biológico    | Parasitas e protozoários                   | Qualitativo   | NR-15, Anexo 14       |
| Ergonômico   | Postura inadequada                         | Qualitativo   | NR-17                 |
| Ergonômico   | Levantamento e transporte manual de cargas | Qualitativo   | NR-17                 |
| Ergonômico   | Movimentos repetitivos                     | Qualitativo   | NR-17                 |
| Ergonômico   | Iluminação inadequada                      | lux           | NR-17 e NHO 11        |
| Mecânico     | Máquinas e equipamentos sem proteção       | Qualitativo   | NR-12                 |
| Mecânico     | Ferramentas manuais ou motorizadas         | Qualitativo   | NR-12                 |
| Acidentes    | Queda de diferente nível                   | Qualitativo   | NR-35                 |
| Acidentes    | Choque elétrico                            | Qualitativo   | NR-10                 |
| Acidentes    | Incêndio ou explosão                       | Qualitativo   | NR-23                 |
| Psicossocial | Sobrecarga de trabalho                     | Qualitativo   | NR-01 e NR-17         |
| Psicossocial | Assédio e violência no trabalho            | Qualitativo   | NR-01 e NR-17         |

As unidades são as 10 do enum `measurement_unit`, que espelha a tabela de unidades do eSocial
S-2240. Nenhuma unidade nova foi criada. As fontes foram indicadas pela equipe e **não foram
conferidas item a item por profissional**. A lista não traz limite de tolerância de propósito.

### 3.3 Exemplos válidos e inválidos

Regras que recusam a gravação (já existiam, seguem iguais):

| Entrada                                                                               | Resultado                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Risco físico, unidade dB(A), concentração `87.5`                                      | Aceito                                           |
| Risco de acidente sem unidade e sem concentração                                      | Aceito                                           |
| Concentração `87.5` sem unidade, ou com "Qualitativo / Não aplicável"                 | Recusado (`VALIDATION`)                          |
| Concentração `oitenta`                                                                | Recusado (`VALIDATION`)                          |
| Avaliação quantitativa com valor medido e sem unidade                                 | Recusado (`VALIDATION`)                          |
| Avaliação qualitativa com valor medido, método ou limite preenchidos                  | Recusado (`VALIDATION`)                          |
| Avaliação com valor medido em risco ergonômico, mecânico, de acidente ou psicossocial | Recusado (`VALIDATION`, "não é objeto da NR-09") |

Catálogo (novo, só sugere e avisa). Os casos abaixo são os mesmos do teste
`risk-agent-catalog.test.ts`:

| Grupo      | Perigo informado               | Unidade      | Situação                      |
| ---------- | ------------------------------ | ------------ | ----------------------------- |
| Físico     | Ruído contínuo ou intermitente | dB(A)        | Usual                         |
| Físico     | Ruído de impacto               | dB(C)        | Usual                         |
| Físico     | Agente fora da lista           | dB(C)        | Usual (vale a lista do grupo) |
| Químico    | Gases e vapores                | ppm ou mg/m³ | Usual                         |
| Químico    | Fibras de asbesto              | f/cm³        | Usual                         |
| Ergonômico | Iluminação inadequada          | lux          | Usual                         |
| Biológico  | Vírus, bactérias e fungos      | Qualitativo  | Usual                         |
| Físico     | Ruído contínuo ou intermitente | dB(C)        | Fora do usual, gera aviso     |
| Físico     | (qualquer)                     | mg/m³        | Fora do usual, gera aviso     |
| Químico    | Gases e vapores                | f/cm³        | Fora do usual, gera aviso     |
| Biológico  | (qualquer)                     | ppm          | Fora do usual, gera aviso     |
| Ergonômico | Postura inadequada             | lux          | Fora do usual, gera aviso     |
| Acidentes  | (qualquer)                     | °C           | Fora do usual, gera aviso     |

"Fora do usual" nunca recusa a gravação. O aviso diz qual unidade foi usada, quais são as usuais do
grupo e que o registro continua válido.

### 3.4 Quando o campo quantitativo é exigido

- Valor medido, unidade e método só são exigidos na conferência do PGR quando a avaliação está
  marcada como quantitativa **e** o grupo admite avaliação quantitativa: físico, químico ou
  biológico (a mesma lista que o sistema já usava para liberar os campos da NR-09).
- **Correção feita.** Antes, um risco ergonômico, mecânico, de acidente ou psicossocial com critério
  "quantitativo" bloqueava a emissão com `measurement_incomplete`, embora a tela e a API não
  deixassem preencher esses campos para esses grupos. O bloqueio era impossível de resolver sem
  trocar o critério. Agora a exigência não vale para esses grupos.
- Na gravação do risco, unidade e concentração continuam opcionais para todos os grupos.

## 4. Hierarquia de controle em cinco níveis

### 4.1 O que mudou

| Ordem | Valor gravado           | Rótulo na tela, na API e no PDF                   | Linha no DOCX                                                                                                             |
| ----- | ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| I     | `elimination`           | I — Eliminação                                    | I. É possível eliminação dos fatores de risco?                                                                            |
| II    | `substitution` (novo)   | II — Substituição                                 | II. É possível substituição por processo, material ou equipamento de menor risco?                                         |
| III   | `collective_protection` | III — Controles de Engenharia (Proteção Coletiva) | III. Minimização e controle dos fatores de risco, com a adoção de controles de engenharia e medidas de proteção coletiva? |
| IV    | `administrative`        | IV — Medidas Administrativas/Organização          | IV. Minimização e controle dos fatores de risco, com a adoção de medidas administrativas ou de organização do trabalho?   |
| V     | `ppe`                   | V — EPI                                           | V. Adoção de medidas de proteção individual?                                                                              |

- Migration `0088_control_level_substitution`: `ALTER TYPE control_level ADD VALUE 'substitution'
BEFORE 'collective_protection'`. É aditiva. Nenhuma linha de `control_measures` é alterada.
- A regra de uma medida por nível e por risco continua. O máximo por risco passou de 4 para 5.
- A listagem, o formulário, o painel, o PDF consolidado, a sugestão por IA e o DOCX usam a mesma
  ordem.
- A IA de medidas passa a classificar "substituição" no nível novo. Antes ela gravava como
  eliminação.

### 4.2 Compatibilidade

- Medidas antigas mantêm o valor gravado. O que muda é o rótulo: "II — Proteção Coletiva" passa a
  aparecer como "III — Controles de Engenharia (Proteção Coletiva)", e as medidas administrativas e
  de EPI passam de III e IV para IV e V. O nome antigo continua dentro do rótulo novo.
- Risco antigo não ganha linha de substituição no banco. No DOCX a linha II sai com "—" e "Não
  informado", igual a qualquer nível sem medida.
- **Sem backfill.** Medida antiga de substituição que foi cadastrada como eliminação continua como
  eliminação. Reclassificar é decisão do profissional, caso a caso.

### 4.3 Orientação por nível de risco e plano de ação no documento

- O DOCX já imprimia, em todo risco, o campo "Necessidade de controle e informações adicionais",
  que vem da tabela de metodologia do próprio documento (classe do risco × incerteza). Já imprimia
  também a seção "Plano de ação" por risco. As duas coisas foram preservadas.
- **Divergência registrada, não resolvida.** A SEG-16 confirmou como corretas as cinco orientações
  por classe (Trivial a Intolerável). O sistema tem dois conjuntos de texto: o das telas
  (`riskClassificationGuidance`, por exemplo "Plano de ação obrigatório, com prazo e responsável
  definidos") e o do documento (por exemplo "Controle adicional, se possível/viável"). O DOCX imprime
  só o segundo. Sem o Documento A não dá para saber qual dos dois foi mostrado ao Expedito. Trocar o
  texto do documento exige essa confirmação e nova mudança de template.

### 4.4 Efeito no modelo do documento

O template DOCX ganhou a linha II e foi regenerado junto com as amostras e o exemplo.

| Item                                | Antes             | Depois            |
| ----------------------------------- | ----------------- | ----------------- |
| `templateSha256`                    | `c205ee5c…be6227` | `c768f0ad…ee47a0` |
| `textsSha256`                       | `b3e859f2…b1a1fc` | Igual             |
| Páginas do `inventario-extenso.pdf` | 72                | 76                |
| Páginas das outras três amostras    | 19, 19 e 22       | Iguais            |

Consequência no deploy, igual à descrita na NOB-177: todo PGR com parecer favorável volta para
conferência (`stale`) e as amostras de revisão aparecem como alteradas. Nada é apagado. A PR #172 já
mudava o hash do modelo pela NOB-177, então não há um segundo ciclo de reconferência por causa desta
entrega.

## 5. Anexos de máquina

### 5.1 Tipos confirmados na SEG-22

Manual, Laudo, ART, Inspeção Inicial de Mobilização, Plano de Manutenção, Ordem de Serviço de
Manutenção, Laudo NR 12 - Apreciação de Riscos, Inspeção Periódica e Inspeção Eventual. A resposta
escreve "Ordens de Serviços de Manutenção" e "Laudo NR 12_Apreciação de Riscos". A grafia foi
normalizada para o singular e para hífen.

### 5.2 Como funciona

- O anexo é um documento do GED com `relatedEntityType = machine_installation` e `relatedEntityId`
  igual ao id do vínculo da máquina (`/companies/{id}/machines/{machineId}`). Não há tabela nova.
- A tela da máquina ganhou a seção "Anexos da máquina" com o botão "Anexar Documento". No upload, o
  tipo é escolhido em uma lista fechada com os nove tipos acima. Quem cadastra escolhe quais anexa,
  como a resposta pede. Nenhum tipo é obrigatório.
- Pela API, `POST /documents` com esse vínculo recusa tipo fora da lista (`422 VALIDATION`) e
  máquina que a sessão não enxerga (`422 FK_NOT_FOUND`). A recusa acontece antes de gravar o arquivo.
- Versão nova, validade, download e exclusão usam o GED como já era.
- O DOCX do PGR continua listando as máquinas no apêndice, sem listar os arquivos anexados.

### 5.3 Acesso

- Migration `0089_machine_attachment_scope`: policy restritiva `documents_machine_attachment_scope`
  na tabela `documents`. Um documento ligado a uma máquina só é lido ou gravado por quem enxerga a
  máquina. A visibilidade da máquina já considera escritório, serviço PGR habilitado na empresa e o
  escopo do membro por empresa e obra (NOB-175).
- Como a regra está no banco, ela vale para a listagem, o detalhe, as versões, o download, a edição
  e a exclusão, na tela, na Action e na API.
- Documentos sem vínculo com máquina não são afetados. A limitação conhecida da NOB-175 para os
  outros vínculos do GED (PGR, GES e risco) continua como estava.

| Cenário testado                                                                 | Resultado                           |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| Anexo criado na máquina A                                                       | Aparece só na máquina A             |
| Tipo "Contrato" em anexo de máquina                                             | `VALIDATION`, sem upload            |
| Anexar em máquina de outro escritório ou inexistente                            | `FK_NOT_FOUND`, sem upload          |
| Religar documento existente a máquina de outro escritório                       | `FK_NOT_FOUND`                      |
| Outro escritório abre o anexo pelo id                                           | `NOT_FOUND`                         |
| Colaborador com escopo na empresa A abre anexo de máquina da empresa A2 pelo id | `NOT_FOUND` (Action) e `404` (REST) |
| Mesmo colaborador lista os anexos da máquina da empresa A2                      | Lista vazia                         |
| Mesmo colaborador tenta anexar na máquina da empresa A2                         | `FK_NOT_FOUND`                      |
| Mesmo colaborador abre documento ligado a um PGR                                | Continua visível                    |

Sem a policy, os dois cenários do colaborador com escopo falham (o anexo da outra empresa abre com
`200`). Isso foi conferido removendo a policy no banco de teste e rodando a suíte.

## 6. Metodologia: o que não foi alterado

- Matriz 5×5, cálculo `probabilidade × severidade`, faixas de classificação, presets, textos de
  ação por classe, regra de plano de ação para moderado ou superior e conclusão NR-09: sem mudança.
- O preset continua com o nome `fundacentro`. A DT-09 recomenda rotular pelo conteúdo real, mas
  depende do responsável técnico.
- O catálogo não tem limite de tolerância nem compara valor medido com limite.
- **Regra para mudanças futuras.** Alterar fórmula, faixa, limite ou tornar um campo obrigatório por
  categoria exige, registrado na issue e neste diretório: a fonte (norma, item e tabela), quem
  aprovou, a data e o efeito nos registros existentes. Sem isso a mudança não entra.

## 7. Decisões pendentes

### 7.1 Hierarquia de controle (para o Expedito)

1. O termo do nível II é "Substituição" (texto da resposta) ou "Redução ou substituição" (imagem
   anexada)? Hoje está "Substituição".
2. O nível III pode se chamar "Controles de Engenharia (Proteção Coletiva)"? A NR-01 usa "proteção
   coletiva" e a resposta usa "controles de engenharia". Hoje aparecem os dois.
3. As frases das linhas II e III do documento (seção 4.1) estão adequadas? Elas foram escritas pela
   equipe no estilo das linhas que já existiam.
4. Qual texto de orientação por classe deve sair no documento (seção 4.3)?
5. Medidas antigas cadastradas como eliminação que na verdade são substituição devem ser revistas?

### 7.2 Catálogo de agentes (para o responsável técnico)

1. Revisar a lista da seção 3.2: agentes, unidades e fonte. Comparar com a tabela original da
   SEG-18, que a equipe não leu.
2. Algum campo passa a ser obrigatório por categoria? Hoje nenhum campo novo é obrigatório.
3. A unidade fora do usual deve continuar como aviso ou passar a impedir a gravação de registros
   novos?
4. O critério "quantitativo" deve continuar disponível para os grupos ergonômico, mecânico, de
   acidente e psicossocial? Hoje continua, sem exigir medição.
5. O escritório poderá cadastrar os próprios agentes no catálogo? Hoje o catálogo é fixo no código
   e o texto livre cobre o que falta.

### 7.3 Cadastro de máquinas: itens "A definir" da SEG-22

| Item da SEG-22                                         | Resposta   | Como o sistema está hoje (NOB-104)                                                 |
| ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------- |
| Vínculo com empresa e obra, GES opcional               | A definir  | Empresa e obra obrigatórias, GES opcional                                          |
| Registro individual ou em grupo                        | A definir  | Os dois modos. Individual exige identificação e quantidade 1                       |
| Campos livres                                          | A definir  | Descrição, operação, medidas de segurança, manutenção e responsável em texto livre |
| Retirada com motivo                                    | A definir  | Retirada lógica com motivo e histórico                                             |
| Falta de informação só avisa                           | A definir  | Aviso `machine_safety_missing` na conferência, sem bloquear                        |
| Anexo próprio no PGR                                   | A definir  | Apêndice de máquinas no DOCX, só quando há vínculo ativo                           |
| Sem vínculo direto entre máquina e riscos ou inspeções | Confirmado | Não há vínculo                                                                     |
| Tipos de anexo                                         | Confirmado | Entregue nesta issue (seção 5)                                                     |

Perguntas novas sobre os anexos:

1. Os arquivos anexados devem ser citados no apêndice de máquinas do PGR?
2. Algum tipo exige validade (por exemplo, inspeção periódica)? Hoje a validade é opcional.
3. Quem pode anexar e ler? Hoje, administrador e colaborador do escritório que enxergam a máquina.
   Representante da empresa e profissional externo não têm acesso.
4. O cadastro de máquinas continua **não homologado** (C-25).

### 7.4 Metodologia (para o responsável técnico)

1. DT-09: rótulo do preset e, se for o caso, o item e a tabela exatos da NR-03 ou do Manual GRO/PGR.

## 8. Verificação

Testes automáticos. O banco de integração foi um Postgres 16 descartável.

| O que prova                                                                           | Arquivo                                                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cinco níveis, ordem e rótulos                                                         | `src/__tests__/unit/domains/pgr/risks.test.ts`, `control-measure.test.ts`, `methodology.test.ts`                     |
| IA classifica "substituição" no nível novo                                            | `ai-control-measure-suggestion.test.ts`                                                                              |
| Medida antiga de eliminação segue listada, com a substituição depois dela             | `src/__tests__/integration/control-measures/control-measures.test.ts`                                                |
| Enum do banco com os cinco valores na ordem                                           | `src/__tests__/integration/pgr/pgr-risk-migration-shape.test.ts`                                                     |
| DOCX com as cinco linhas na ordem                                                     | `src/__tests__/unit/scripts/pgr-docx/template-document.test.ts`, `from-consolidated.test.ts`, `sample-cases.test.ts` |
| Template, cobertura de marcadores e amostras coerentes                                | `coverage.test.ts`, `render-homologation.test.ts`                                                                    |
| Catálogo: estrutura, casos usuais e fora do usual, opções do formulário               | `src/__tests__/unit/domains/pgr/risk-agent-catalog.test.ts`                                                          |
| Agente livre e unidade fora do usual continuam aceitos na gravação                    | `src/__tests__/unit/domains/pgr/risk.test.ts`                                                                        |
| Unidade antiga fora do catálogo sai no DOCX como foi gravada                          | `from-consolidated.test.ts`                                                                                          |
| Unidade antiga fora do catálogo só gera aviso na conferência                          | `pgr-readiness.test.ts`                                                                                              |
| Campo quantitativo não é exigido para grupo sem medição                               | `pgr-readiness.test.ts`                                                                                              |
| Formulário sugere agentes e mantém a unidade antiga ao editar                         | `src/app/(protected)/risks/_components/__tests__/risk-form.test.tsx`                                                 |
| Anexos de máquina: tipo, máquina correta, outro escritório, outra empresa, URL direta | `src/__tests__/integration/documents/machine-attachments.test.ts`                                                    |
| Upload de anexo de máquina mostra só os tipos confirmados                             | `document-upload-form.test.tsx`                                                                                      |

Conferência visual: a página das medidas do `templates/pgr/exemplo/pgr-exemplo.pdf` regenerado foi
aberta e mostra as cinco linhas por risco, sem corte. As telas (risco, medidas, máquina e upload)
**não foram abertas em navegador** nesta entrega.
