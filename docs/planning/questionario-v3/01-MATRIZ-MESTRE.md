# 01 · Matriz mestre das 58 questões (Documento B)

Fontes, legenda e regras de leitura: [README](README.md).

- **E:** arquivo do Expedito pós-reunião, questionário v3.0 de 22/10/2026. O bloco de consolidação está em branco e sem data.
- **A:** Word do Dr. Alcides, consolidação "Nome: Alcides · Função: Coord PCMSO", sem data.

As citações entre aspas são a redação original. Observações longas aparecem em trecho, e a íntegra está no
Documento A.

- O código existente se refere à `develop` em `915f024` (02/11/2026).
- PR aberta não conta como implementado.

## 1. O que mudou na versão pós-reunião do Expedito

| Questão | Versão anterior (27/10)      | Versão pós-reunião                                                                                                                                                                                    | Efeito                                                                  |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SEG-02  | Nada marcado                 | Alt. 2 (escritório + representante da empresa); representante visualiza e dá ciência/aprovação; uma pessoa pode representar várias empresas; clínica pode atender vários escritórios; papéis listados | Portal do representante entra no escopo                                 |
| SEG-06  | Separação "apenas de menu"   | Separação **"de menu e de permissão"**, com observações sobre campos de saúde                                                                                                                         | **Inverte** a premissa usada na PR #137 (só navegação)                  |
| SEG-14  | Nada marcado                 | Alt. 3 (modelo atual com ajustes); escritório pode editar textos padrão                                                                                                                               | Modelo deixa de ser "decisão externa"; aprovador continua sem definição |
| SEG-15  | Só "Outro"                   | "Fundacentro" **e** "Outro" marcados                                                                                                                                                                  | Continua ambíguo                                                        |
| SEG-16  | Hierarquia no campo de nomes | Hierarquia movida para Observações + imagem (5 níveis)                                                                                                                                                | Mesmo conteúdo; a imagem nomeia o nível 2 "Redução ou substituição"     |
| SEG-17  | Alt. 1                       | Alt. 1 **e** 3, com observação                                                                                                                                                                        | Tabela por função e consolidada                                         |
| SEG-18  | Nada marcado                 | Alt. 2 + tabela de agentes e unidades                                                                                                                                                                 | Campos por categoria entram no escopo                                   |
| SEG-20  | Nada marcado                 | Alt. 2 (a empresa indica no sistema); autorizado externo com acesso próprio                                                                                                                           | **Diverge** do fluxo implementado (alt. 1)                              |
| SEG-25  | Nada marcado                 | "A definir"                                                                                                                                                                                           | Pendência comercial explícita                                           |
| SEG-26  | Nada marcado                 | "A definir"                                                                                                                                                                                           | Idem                                                                    |
| SEG-30  | Nada marcado                 | "A definir"                                                                                                                                                                                           | Idem                                                                    |

As outras 24 questões de Segurança não mudaram.

## 2. Situação das 58 questões

| Status                         | SEG | MED | Total | Questões                                                                                                                                        |
| ------------------------------ | --: | --: | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFINIDO                       |   6 |   4 |    10 | SEG-05, 09, 17, 19, 20, 24 · MED-07, 11, 16, 23                                                                                                 |
| DEFINIDO COM RESSALVAS         |  18 |  16 |    34 | SEG-01, 02, 03, 04, 06, 10, 11, 13, 14, 16, 18, 21, 23, 27, 28, 32, 33, 35 · MED-01, 02, 04, 05, 06, 08, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22 |
| AMBÍGUO                        |   5 |   2 |     7 | SEG-07, 08, 15, 31, 34 · MED-03, 10                                                                                                             |
| A DEFINIR                      |   4 |   1 |     5 | SEG-22, 25, 26, 30 · MED-09 (pergunta principal)                                                                                                |
| VALIDAÇÃO NORMATIVA NECESSÁRIA |   2 |   0 |     2 | SEG-12, 29                                                                                                                                      |
| **Total**                      |  35 |  23 |    58 |                                                                                                                                                 |

Marcador **VN** (ponto normativo a conferir, além das duas acima): 20 questões.

- SEG-06, 08, 10, 11, 12, 13, 15, 16, 18, 29, 31, 33 e 34;
- MED-02, 10, 12, 16, 17, 18 e 20.

## 3. Resumo por questão

| Questão | Título                                        | Status | VN  | Decisão técnica | Linear                          |
| ------- | --------------------------------------------- | ------ | --- | --------------- | ------------------------------- |
| SEG-01  | Quem contrata e paga a Segurança do Trabalho  | DCR    |     | DT-01, DT-24    | NOB-114, 131, 116, 100          |
| SEG-02  | Quem entra no sistema                         | DCR    |     | DT-27, DT-26    | NOB-97, 122, 101                |
| SEG-03  | Colaboradores do escritório por empresa       | DCR    |     | DT-02           | NOB-97 (lacuna)                 |
| SEG-04  | Empresa atendida sem PGR contratado           | DCR    |     | DT-24           | NOB-100, 111, 117               |
| SEG-05  | Módulos de uma empresa recém-cadastrada       | D      |     |                 | NOB-100, 97                     |
| SEG-06  | Divisão entre Segurança e Saúde               | DCR    | VN  | DT-03           | NOB-97 (lacuna)                 |
| SEG-07  | Papéis no ciclo do PGR                        | AMB    |     | DT-04           | NOB-101, 107                    |
| SEG-08  | Registros profissionais do responsável        | AMB    | VN  | DT-05           | NOB-101, 105                    |
| SEG-09  | Etapas da emissão e uso da prévia             | D      |     | DT-04           | NOB-101, 105, 107               |
| SEG-10  | Alteração, cancelamento e substituição        | DCR    | VN  | DT-06           | NOB-105, 101                    |
| SEG-11  | Vigência e alertas de vencimento              | DCR    | VN  |                 | NOB-105                         |
| SEG-12  | Guarda dos PGRs emitidos                      | VNN    | VN  | DT-07           | NOB-105, 101                    |
| SEG-13  | O que impede a emissão do PGR                 | DCR    | VN  | DT-08           | NOB-105                         |
| SEG-14  | Modelo oficial do PGR e textos padrão         | DCR    |     | DT-28           | NOB-105, 94, 95                 |
| SEG-15  | Metodologia padrão de classificação           | AMB    | VN  | DT-09           | NOB-103                         |
| SEG-16  | Ações recomendadas por classificação          | DCR    | VN  | DT-10           | NOB-103, 105                    |
| SEG-17  | Treinamentos e normas por função              | D      |     |                 | NOB-105                         |
| SEG-18  | Campos técnicos por categoria de risco        | DCR    | VN  | DT-11           | NOB-103 (lacuna)                |
| SEG-19  | Validação dos riscos do próprio PGR           | D      |     | DT-12           | NOB-98, 103 (lacuna)            |
| SEG-20  | Registro do autorizador indicado pela empresa | D      |     | DT-12, DT-27    | NOB-98 (divergência)            |
| SEG-21  | PGR alterado depois da validação              | DCR    |     | DT-12           | NOB-98, 111                     |
| SEG-22  | Cadastro de máquinas e equipamentos           | AD     |     |                 | NOB-104                         |
| SEG-23  | Revisor técnico e amostras do gerador         | DCR    |     | DT-04           | NOB-107, 96                     |
| SEG-24  | Revisão em cada PGR                           | D      |     | DT-04           | NOB-107, 101                    |
| SEG-25  | PGR básico                                    | AD     |     | DT-24           | NOB-106                         |
| SEG-26  | Responsável pela oferta de PGR básico         | AD     |     | DT-24           | NOB-106                         |
| SEG-27  | Planos e valores                              | DCR    |     | DT-24           | NOB-114, 115, 116, 131, 134     |
| SEG-28  | Teste grátis                                  | DCR    |     | DT-13           | NOB-118, 119                    |
| SEG-29  | Inadimplência e carência                      | VNN    | VN  | DT-14           | NOB-115, 133, 136               |
| SEG-30  | Contratação de módulos e avulsos              | AD     |     | DT-24           | NOB-100, 117                    |
| SEG-31  | EPI: CA vencido e assinatura da ficha         | AMB    | VN  | DT-15, DT-16    | (sem issue específica)          |
| SEG-32  | Modelos oficiais de inspeção                  | DCR    |     | DT-20           | (sem issue específica)          |
| SEG-33  | Alertas e notificações                        | DCR    | VN  | DT-19           | NOB-119                         |
| SEG-34  | Grupo mínimo no psicossocial                  | AMB    | VN  | DT-17           | (sem issue específica)          |
| SEG-35  | Funcionalidades complementares da Segurança   | DCR    |     | DT-18, DT-12    | NOB-124, 140                    |
| MED-01  | Quem conclui e assina o ASO                   | DCR    |     | DT-21           | NOB-110, 121                    |
| MED-02  | Médico coordenador do PCMSO                   | DCR    | VN  |                 | NOB-121 / NOB-144               |
| MED-03  | Quem valida os riscos usados no PCMSO         | AMB    |     | DT-12           | NOB-98                          |
| MED-04  | Participação das clínicas                     | DCR    |     | DT-26           | NOB-122                         |
| MED-05  | Lista de exames e procedimentos               | DCR    |     |                 | NOB-109 / NOB-147, 112          |
| MED-06  | Datas do exame e do ASO                       | DCR    |     |                 | NOB-110, 112                    |
| MED-07  | Exames após transferência                     | D      |     |                 | NOB-112                         |
| MED-08  | Modelo oficial de ASO e PCMSO                 | DCR    |     |                 | NOB-93, 110, 109                |
| MED-09  | Riscos ainda não validados no ASO             | AD     |     | DT-12           | NOB-110                         |
| MED-10  | Restrições e observações no ASO               | AMB    | VN  | DT-21           | NOB-110                         |
| MED-11  | Correção e cancelamento de ASO emitido        | D      |     | DT-06           | NOB-110, 109                    |
| MED-12  | Assinatura dos documentos médicos             | DCR    | VN  |                 | NOB-110, 101                    |
| MED-13  | Entrega do ASO ao trabalhador                 | DCR    |     |                 | NOB-110, 122                    |
| MED-14  | Conteúdo mínimo do PCMSO                      | DCR    |     |                 | NOB-109                         |
| MED-15  | Como são definidos os exames de cada função   | DCR    |     |                 | NOB-109 / NOB-147               |
| MED-16  | Lista C (NTEP)                                | D      | VN  |                 | NOB-113                         |
| MED-17  | O que o RH pode ver                           | DCR    | VN  | DT-21, DT-03    | NOB-122                         |
| MED-18  | Guarda dos registros de saúde                 | DCR    | VN  | DT-07           | NOB-112                         |
| MED-19  | Como o sistema usa regras clínicas            | DCR    |     | DT-23           | NOB-109 / NOB-145               |
| MED-20  | Revisão das regras clínicas do protótipo      | DCR    | VN  | DT-22, DT-23    | NOB-109 / NOB-145, 147          |
| MED-21  | Quem aprova cada entrega                      | DCR    |     | DT-25           | NOB-130, 96                     |
| MED-22  | Dados reais no protótipo                      | DCR    |     |                 | NOB-123                         |
| MED-23  | Funcionalidades complementares da Medicina    | D      |     | DT-18           | NOB-120, 122, 125, 139–143, 113 |

Siglas: **D** definido · **DCR** definido com ressalvas · **AMB** ambíguo · **AD** a definir · **VNN** validação
normativa necessária.

## 4. Segurança do Trabalho (fonte E)

### SEG-01 · Quem contrata e paga a Segurança do Trabalho

- **Resposta:** [X] 3. Misto: o escritório paga a assinatura, e cada empresa paga um serviço próprio.
- **Observação:** "Vender o produto/sistema diretamente para as empresas, que pagarão pelo serviço e farão a gestão de suas obras. Vender para consultorias, que farão a gestão de empresas que as contratarão, nesse caso as consultorias fazem a gestão no sistema, e o pagamento é realizado pela consultoria."
- **Interpretação:** há dois canais de venda.
  - Na venda direta, a empresa final é a contratante e opera as próprias obras.
  - Na venda via consultoria, a consultoria contrata, paga e opera as empresas clientes.
  - A alternativa 3 ("cada empresa paga um serviço próprio") não aparece na observação, que fala de um pagador por canal.
- **Decisão posterior:** reunião com o Expedito.
  - Três formatos de contratação: só PGR, só Medicina, PGR + Medicina.
  - Preço pelo porte (número de funcionários).
  - Valores, faixas e cobrança ficam para o fim.
- **Status:** DEFINIDO COM RESSALVAS.
- **Comportamento esperado:** o tenant (conta contratante) pode ser uma consultoria ou uma empresa final. A empresa final que contrata direto é a própria conta e cadastra a si mesma como empresa atendida. Não há duplicação de empresas para simular acesso.
- **Impacto:**
  - Segurança e Medicina: o modelo de conta vale para os dois módulos.
  - A cobrança não bloqueia fluxos técnicos.
- **Dependências:** SEG-27 e SEG-30 (comercial, no fim); SEG-02 (representante da empresa).
- **Linear:** NOB-114, NOB-131, NOB-116, NOB-100 (Done).
- **Recomendação:** DT-01, DT-24.

### SEG-02 · Quem entra no sistema

- **Resposta:**
  - [x] 2. O escritório e o representante da empresa atendida.
  - No PGR, o representante: [X] "Visualizar e dar ciência ou aprovação".
  - Uma mesma pessoa pode representar mais de uma empresa: [X] Sim.
  - Uma clínica parceira pode atender mais de um escritório: [X] Sim.
- **Observação:** lista de papéis:
  - "Engenheiro de Segurança do Trabalho";
  - "Técnico de Segurança do Trabalho";
  - "Representante legal do empregador. Pode ser qualquer profissional indicado pela empresa";
  - "Médico do Trabalho. Não assina o PGR como documento principal. Sua atuação formal é no PCMSO (NR-7), embora possa contribuir com o levantamento de riscos à saúde."
- **Interpretação:** entram o escritório e o representante da empresa. O representante pode ser multiempresa e, no PGR, só visualiza e dá ciência ou aprovação.
  - O acesso da clínica não foi escolhido para a Segurança (a alternativa 3 não foi marcada), mas o Expedito admite clínica multiescritório.
  - Na Medicina, o Dr. Alcides admite clínica com acesso restrito (MED-04).
- **Status:** DEFINIDO COM RESSALVAS. O portal da clínica é decisão da Medicina (MED-04).
- **Comportamento esperado:** perfil "representante da empresa", ligado a uma ou mais empresas, com ciência ou aprovação registrada do PGR emitido. Sem cadastro de funcionários nem de entregas de EPI (não marcado).
- **Impacto:**
  - Segurança: ciência da empresa no fluxo do PGR (SEG-07/09).
  - Medicina: o mesmo perfil tende a ser o RH da MED-17, com outra visão.
- **Dependências:** SEG-20 (o representante indica o autorizador), SEG-03, MED-17.
- **Linear:** NOB-97 (Done; lacuna), NOB-122, NOB-101.
- **Código:** o perfil `client` existe com **uma** empresa (`scopedCompanyId`). Não há multiempresa nem ciência.
- **Recomendação:** DT-27, DT-26.

### SEG-03 · Colaboradores do escritório por empresa

- **Resposta:** [X] 2. "Sim. O administrador atribui as empresas de cada colaborador." [X] 3. "Sim, por empresa e por módulo (PGR ou Medicina)."
- **Observação:** "O administrador atribui empresas a cada colaborador, isso também serve quando a contratação ocorrer diretamente pela empresa, onde o administrador pode atribuir colaboradores pera gestão de cada obra".
- **Interpretação:** a alternativa 3 contém a 2; as duas são compatíveis. A observação acrescenta o nível de obra.
- **Status:** DEFINIDO COM RESSALVAS (o nível de obra não foi detalhado).
- **Comportamento esperado:** controle de acesso por colaborador × empresa × módulo (e, depois, obra), aplicado no servidor e no banco (RLS), não só no menu.
- **Decisão da equipe (PR #137, não do Expedito):** a restrição futura preserva o acesso atual até a configuração explícita das atribuições.
- **Impacto:**
  - Segurança e Medicina: base do sigilo da SEG-06 e da MED-17.
- **Dependências:** SEG-06, MED-17.
- **Linear:** nenhuma issue específica (a NOB-97, Done, não cobre).
- **Código:** todo colaborador vê todas as empresas.
- **Recomendação:** DT-02. Prioridade **crítica**.

### SEG-04 · Empresa atendida sem PGR contratado

- **Resposta:**
  - [x] 2. EPI, treinamentos e inspeções podem ser contratados como serviço separado.
  - [x] 3. Um PGR externo cadastrado também libera a parte operacional.
  - Histórico depois do cancelamento: [X] "Continua visível só para consulta".
- **Observação:** "A empresa pode ter acesso a algumas informações do módulo PGR".
- **Interpretação:** as alternativas 2 e 3 são caminhos alternativos para liberar a operação de Segurança.
- **Status:** DEFINIDO COM RESSALVAS ("algumas informações" sem lista; contratação separada depende do comercial).
- **Comportamento esperado:** capacidades operacionais de Segurança habilitáveis sem o PGR da plataforma. Histórico de riscos só leitura depois do cancelamento.
- **Impacto:**
  - Segurança: ligado à NOB-111 (PGR externo).
  - Medicina: já consome PGR externo (NOB-98).
- **Linear:** NOB-100, NOB-111, NOB-117.
- **Recomendação:** DT-24 (o comercial não bloqueia o técnico).

### SEG-05 · Módulos de uma empresa recém-cadastrada

- **Resposta:** [X] 2. No cadastro, o sistema pergunta quais módulos a empresa contratou.
- **Observação:** "É importante que no momento inicial do cadastro a empresa selecione os módulos que ela contratou [...] O contrato pode ser direto ou via Consultoria".
- **Status:** DEFINIDO.
- **Decisão da equipe (PR #137):** só o owner habilita módulos, inclusive no cadastro, com motivo.
- **Código:** na `develop`, a habilitação acontece depois do cadastro. A PR #137 (aberta) implementa a seleção no cadastro.
- **Linear:** NOB-100, NOB-97.

### SEG-06 · Divisão entre Segurança e Saúde no sistema

- **Resposta, por módulo:**
  - Incidentes, acidentes e CAT: [X] Ambas;
  - Ordens de serviço: [X] Segurança;
  - Treinamentos: [X] Segurança;
  - Avaliação psicossocial: [X] Ambas;
  - Afastamentos: [X] Saúde;
  - Entregas de EPI: [X] Segurança.
- **Resposta sobre a separação:** [X] "De menu e de permissão (cada perfil vê só a sua área)".
- **Observação (trecho):**
  - "Os campos de saúde precisam de restrição própria dentro do módulo";
  - psicossocial: "a restrição deve ser por campo ou por registro";
  - OS: "Ordens de manutenção ou de produção não são de segurança. Permissões de Trabalho, sim";
  - treinamentos de ergonomia ou primeiros socorros deveriam ser "Ambas";
  - afastamento por acidente se conecta a Incidentes;
  - EPI "desde que não contenham dados de saúde".
- **Mudança:** a versão anterior marcava "apenas de menu".
- **Status:** DEFINIDO COM RESSALVAS · VN (sigilo de dado de saúde).
- **Comportamento esperado:**
  - perfis de área (Segurança, Saúde) com permissão no servidor e RLS;
  - módulos "Ambas" com restrição por campo ou registro para dados de saúde (lesão, afastamento, acompanhamento clínico).
- **Impacto:**
  - Medicina: converge com a MED-17 (RH sem resultados nem CID) e com o prontuário segregado.
  - Segurança: incidentes precisam separar investigação (Segurança) de dados do acidentado (Saúde).
- **Código:**
  - A `develop` separa módulos por empresa (NOB-97), mas qualquer colaborador vê as duas áreas.
  - A PR #137 coloca incidentes e psicossocial também no menu da Medicina e declara que "não concede novas permissões". Isso atendia a versão antiga; **não atende a nova**.
- **Recomendação:** DT-03. Prioridade **crítica**.

### SEG-07 · Papéis no ciclo do PGR

- **Resposta:** [X] 2. "Um profissional do escritório elabora e assina, e a empresa atendida dá ciência ou aprova."
- **Observação:** em branco.
- **Interpretação:** a alternativa marcada não tem revisor. Mas a SEG-09 escolhe "revisão técnica → aprovado" e a SEG-24 exige revisão de cada PGR por profissional distinto do elaborador.
- **Status:** AMBÍGUO (resolvível pela leitura integrada).
- **Leitura integrada recomendada:** elaborador → validação dos riscos (SEG-19) → revisão técnica por outro profissional (SEG-24) → aprovação técnica pelo revisor (SEG-09) → emissão → assinatura do responsável → ciência ou aprovação da empresa (SEG-07/02).
- **Linear:** NOB-101, NOB-107.
- **Recomendação:** DT-04.

### SEG-08 · Registros profissionais aceitos para o responsável

- **Resposta:**
  - [x] 1. Manter os quatro tipos atuais. [X] 3. Lista configurável por escritório.
  - "Um PGR com responsável 'não se aplica' pode ser emitido?" [X] Não.
- **Observação:** "O PGR gerado pela plataforma deve indicar um responsável, identificado por nome e função. Quando houver elaborador e responsável distintos, ambos devem ser registrados. O registro em conselho profissional não é obrigatório para o responsável, mas, quando existir, deve ser informado e armazenado no documento."
- **Interpretação:** a marcação ("não se aplica" não pode ser emitido) conflita com a observação (registro não obrigatório). Leitura coerente: o responsável e a função são obrigatórios; o número de registro, não.
- **Norma (conferida):** NR-01 1.5.7.2 — os documentos do PGR são elaborados "sob a responsabilidade da organização [...] datados e assinados". O item não exige registro em conselho; outras NRs podem exigir habilitação específica.
- **Status:** AMBÍGUO · VN.
- **Linear:** NOB-101, NOB-105.
- **Recomendação:** DT-05.

### SEG-09 · Etapas da emissão e uso da prévia

- **Resposta:**
  - [x] 2. Rascunho → revisão técnica → aprovado → emitido → assinado.
  - "A prévia pode ser enviada ao cliente?" [X] "Sim, com a marca 'PRÉVIA'".
- **Status:** DEFINIDO.
- **Código:**
  - A prévia e a emissão conferida existem (NOB-105).
  - A trava de PGR assinado ou publicado existe (`domains/pgr/pgr-lock.ts`).
  - A revisão por amostras é da NOB-107. A revisão de **cada** PGR antes da emissão está na PR #137 (aberta).
- **Linear:** NOB-101, NOB-105, NOB-107.
- **Recomendação:** DT-04.

### SEG-10 · Alteração, cancelamento e substituição após a emissão

- **Resposta:**
  - Pergunta principal **sem marcação**.
  - Quem cancela: [X] "Somente o responsável técnico" e [X] "O administrador do escritório, com motivo".
  - Documento anterior: [X] "Continua visível no histórico".
- **Observação:** "Após a publicação e assinatura do documento [...] o documento não pode mais ser alterado. Pode sim, ser realizada outra revisão [...] (gerando revisão na sequência Rev01; Rev02; Rev03 e assim por diante)".
- **Interpretação:** a observação equivale à alternativa 1 (nada muda; nova revisão). Quanto ao cancelamento, as duas opções marcadas se combinam: o responsável técnico ou o administrador com motivo.
- **Status:** DEFINIDO COM RESSALVAS · VN (o questionário pede validação; ver NR-01 1.5.7.3.3.1 sobre histórico).
- **Código:** trava pós-assinatura e pós-publicação existe. Não há cancelamento nem substituição formal.
- **Recomendação:** DT-06.

### SEG-11 · Vigência e alertas de vencimento

- **Resposta:** [X] 1. Data livre, informada em cada PGR. Antecedência: [X] 30 dias e [X] Outro (sem valor).
- **Observação:** cita a NR-01 1.5.4.4.6 (revisão a cada dois anos ou nas situações "a" a "f") e 1.5.4.4.6.1 (até 3 anos com certificação em gestão de SST).
- **Norma (conferida):** o texto citado confere com a redação da Portaria MTE 1.419/2024. A numeração 1.5.4.4.6.1 foi retificada no DOU de 30/07/2025.
- **Status:** DEFINIDO COM RESSALVAS · VN ("Outro" sem valor; os gatilhos de revisão dependem do responsável técnico).
- **Comportamento esperado:**
  - data de fim livre;
  - alerta interno em 30 dias;
  - aviso informativo dos gatilhos de revisão (1.5.4.4.6 "a"–"f") sem calcular prazo automático.
- **Código:** alerta "PGR vencido" existe. O alerta de 30 dias está na PR #137.
- **Linear:** NOB-105.

### SEG-12 · Guarda dos PGRs emitidos

- **Resposta:** [X] 2. "Todo PGR emitido é arquivado; o administrador pode excluir, com motivo registrado."
- **Observação (trecho):**
  - "Ao término do contrato, a plataforma manterá os dados por 1 ano, com aviso à empresa em 30, 60 e 90 dias antes da exclusão";
  - "O sistema deve permitir exportação completa, com documentos, versões e registros de revisão e assinatura";
  - "o jurídico deve estabelecer a cláusula de contrato".
- **Norma (conferida):**
  - NR-01 1.5.7.3.3.1: o histórico das atualizações do inventário de riscos é mantido por "período mínimo de 20 (vinte) anos ou pelo período estabelecido em normatização específica";
  - NR-01 1.5.7.2.1: documentos "sempre disponíveis aos trabalhadores interessados, aos sindicatos [...] e à Inspeção do Trabalho";
  - na Medicina, a NR-07 7.6.1.1 exige 20 anos para o prontuário (MED-18).
- **Interpretação:** a obrigação de guarda é da organização, não necessariamente da plataforma. Mas a exclusão de PGR emitido pelo administrador e a exclusão automática em 1 ano não podem ser implementadas sem a cláusula jurídica e a exportação completa.
- **Status:** VALIDAÇÃO NORMATIVA NECESSÁRIA.
- **Código:** nenhuma exclusão automática existe. A emissão ainda não é arquivada com integridade (só as amostras da NOB-107).
- **Recomendação:** DT-07. Prioridade **crítica**.

### SEG-13 · O que impede a emissão do PGR

- **Resposta, por item:**
  - **Bloqueia:** razão social/CNPJ; responsável e seu registro; datas de vigência; GES vinculados; descrição do processo em cada GES; funções vinculadas ao GES; perigo, fontes e lesões de cada risco; valor, unidade e método da avaliação quantitativa.
  - **Só avisa:** ambiente sem risco; avaliação registrada e consistente; classificação pela metodologia; medidas e plano de ação; informações de segurança das máquinas.
  - Exceção: [X] "Sim, com justificativa do responsável técnico".
- **Interpretação:**
  - "Responsável **e seu registro**" bloqueante conflita com a SEG-08 (registro não obrigatório).
  - A exceção justificada não pode virar autorização genérica. Os itens mínimos do inventário (NR-01 1.5.7.3.2) e a identificação da empresa e do responsável não deveriam ser excepcionáveis.
  - Pela NR-01 1.5.7.1, o PGR contém no mínimo inventário e plano de ação; deixar o plano como "só aviso" precisa de leitura do responsável técnico.
- **Status:** DEFINIDO COM RESSALVAS · VN.
- **Código:**
  - `checkPgrReadiness` (NOB-105) tem bloqueios e avisos.
  - A PR #137 ajusta as severidades no fluxo com revisor.
  - Não existe exceção justificada.
- **Recomendação:** DT-08.

### SEG-14 · Modelo oficial do PGR e textos padrão

- **Resposta:**
  - [x] 3. O modelo atual serve com ajustes, que vou indicar.
  - Quem aprova os textos: **nenhuma marcação**.
  - O escritório pode editar textos padrão: [X] Sim.
- **Observação:** "Os ajustes são referentes ao modelo (não parecer tanto com o modelo do Layout do PGR 2026). O PGR apresenta o texto modelo padrão, porém o responsável pode alterar qualquer campo que julgar necessário".
- **Status:** DEFINIDO COM RESSALVAS (ajustes não listados; aprovador dos textos não atribuído).
- **Comportamento esperado:** edição de textos só em rascunho, com registro do que mudou em relação ao padrão. Documento assinado é imutável (SEG-10).
- **Código:** template DOCX gerado por código, com textos semifixos substituíveis (`overrides`).
- **Linear:** NOB-105, NOB-94, NOB-95.
- **Recomendação:** DT-28.

### SEG-15 · Metodologia padrão de classificação dos riscos

- **Resposta:**
  - [x] 1. Fundacentro (como hoje). [X] Outro (em branco).
  - Cada escritório pode alterar: [X] Sim.
- **Observação:** "A Fundacentro não possui padrão definido. Há metodologia na NR 03 que é do Ministério do Trabalho e Emprego. Manual_GRO_PGR_da_NR_1.pdf".
- **Interpretação:** marca Fundacentro e, ao mesmo tempo, diz que ela não tem padrão. Cita duas referências oficiais sem escolher tabela.
  - O preset atual "fundacentro" corresponde à matriz 5×5 descrita no próprio DOCX: "AIHA, AS/NZS 4360 e European Comission (recomendadas pela Fundacentro)".
  - Não existe "matriz Fundacentro oficial".
- **Status:** AMBÍGUO · VN.
- **Código:** `DEFAULT_METHODOLOGY_BASE = "fundacentro"` (`domains/pgr/methodology-presets.ts`); escritório pode alterar.
- **Recomendação:** DT-09.

### SEG-16 · Ações recomendadas por classificação

- **Resposta:**
  - As cinco orientações (Trivial a Intolerável): [X] Correta.
  - Orientação impressa no PGR: [X] "Sim, em todos os riscos".
- **Observação:** hierarquia de controle em cinco níveis:
  1. Eliminação;
  2. Substituição;
  3. Controles de Engenharia;
  4. Controles Administrativos;
  5. EPI.
  - Cada nível vem com definição e exemplos.
  - A imagem anexada nomeia o nível 2 "Redução ou substituição".
- **Norma (conferida):**
  - NR-01 1.5.5.1.1: medidas para "eliminar, reduzir ou controlar";
  - NR-01 1.5.5.1.2: quando a proteção coletiva for inviável ou insuficiente, hierarquia "a) medidas de caráter administrativo ou de organização do trabalho; e b) [...] EPI";
  - a NR-01 usa "proteção coletiva", não "controles de engenharia".
- **Status:** DEFINIDO COM RESSALVAS · VN.
- **Código:**
  - enum `control_level` com 4 valores: `elimination`, `collective_protection`, `administrative`, `ppe`;
  - não há "substituição".
- **Lacuna:** acrescentar "substituição" exige migration aditiva no enum, formulários e documento, sem renomear dados existentes. "Minimizar" não entra como categoria.
- **Recomendação:** DT-10.

### SEG-17 · Treinamentos e normas por função no PGR

- **Resposta:**
  - [x] 1. Por função. [X] 3. Em uma tabela geral do documento.
  - Normas: [X] "Sugerir normas, para o profissional confirmar".
- **Observação:** "O treinamento deve aparecer por função e gerar uma tabela consolidade geral no documento".
- **Status:** DEFINIDO.
- **Código:** a relação função → treinamentos obrigatórios existe. O DOCX ainda não traz a tabela.
- **Linear:** NOB-105.

### SEG-18 · Campos técnicos por categoria de risco

- **Resposta:** [X] 2. Exigir campos específicos por categoria de risco.
- **Observação:** "Deixar livre para ser acrescentado – caso o agente não esteja previsto nessa tabela".
  - Tabela por categoria (físicos, químicos, biológicos, ergonômicos, acidentes, psicossociais), com "Agentes e fatores (exemplos)" e "Unidade de medida usual".
  - Íntegra no Documento A.
- **Interpretação:** a tabela é de **exemplos** e unidades usuais. Ela não define, sozinha, quais campos são obrigatórios. Separar catálogo de agentes, atributos técnicos, unidades e regras de obrigatoriedade.
- **Norma (conferida):** NR-01 1.5.7.3.2 lista o conteúdo mínimo do inventário. Entre os itens:
  - "c) descrição dos perigos, com a identificação das fontes e/ou circunstâncias";
  - "g) caracterização da exposição";
  - "h) dados da análise preliminar ou do monitoramento das exposições".
- **Status:** DEFINIDO COM RESSALVAS · VN.
- **Código:**
  - o risco tem agente, fontes, propagação, exposição, lesões, unidade (enum eSocial) e código de agente nocivo (Tabela 24);
  - não há obrigatoriedade por categoria nem catálogo de agentes extensível.
- **Linear:** NOB-103 (Done; lacuna).
- **Recomendação:** DT-11.

### SEG-19 · Validação dos riscos do próprio PGR

- **Resposta:** [X] 2. "Sim, a mesma regra vale para todos os riscos."
- **Status:** DEFINIDO.
- **Interpretação:** os riscos do inventário do PGR passam pela mesma validação por profissional autorizado (indicado pela empresa) que hoje só existe para a Medicina.
  - Na MED-03, o Dr. Alcides diz que "quem valida os riscos é quem assina o PGR". As duas respostas convergem se o profissional autorizado for o responsável técnico ou quem ele indicar. Ver conflito C-02 no [03](03-CONFLITOS-E-RECOMENDACOES.md).
- **Código:** validação só no snapshot da Medicina (NOB-98). No inventário do PGR os riscos entram direto, e a IA gera rascunho.
- **Linear:** NOB-98, NOB-103 (lacuna).
- **Recomendação:** DT-12.

### SEG-20 · Registro do autorizador indicado pela empresa

- **Resposta:**
  - [x] 2. "A própria empresa entra no sistema e faz a indicação."
  - Autorizado externo: [X] "Sim, com acesso próprio ao sistema".
- **Proposta impressa:** a "alternativa 1" (fluxo implementado) **não** foi escolhida.
- **Status:** DEFINIDO.
- **Divergência com o código:** a NOB-98 implementou a alternativa 1 (o owner registra a indicação com evidência). A resposta exige o representante da empresa no sistema (SEG-02).
- **Recomendação:** DT-12, DT-27 (alternativa 1 como transição registrada, até existir o portal do representante).

### SEG-21 · PGR alterado depois da validação dos riscos

- **Resposta:** [X] 2. Os riscos alterados precisam ser validados novamente.
- **Observação (trecho):**
  - "O médico responsável deve ser notificado da alteração, mas não participa da validação dos riscos";
  - "Riscos de PGR externo que mudarem também devem voltar para validação, e não permanecer como pendentes indefinidamente";
  - "Não tenho confirmação sobre quais alterações exigem revalidação por norma, então essa regra deve ser validada com o responsável técnico."
- **Status:** DEFINIDO COM RESSALVAS (o critério de "alteração relevante" depende do responsável técnico).
- **Código (NOB-98):**
  - o PGR alterado vira `changed` e o risco deixa de ser utilizável;
  - nova fonte entra pendente;
  - sem notificação ao médico e sem diferença por risco.
- **Recomendação:** DT-12. A validação técnica do risco não se confunde com a aprovação médica dos exames.

### SEG-22 · Confirmação do cadastro de máquinas e equipamentos

- **Resposta:**
  - Seis itens: [X] "A definir" (vínculo empresa/obra com GES opcional; registro individual ou em grupo; campos livres; retirada com motivo; falta de informação só avisa; anexo próprio no PGR).
  - [x] "Confirmo" em "Sem vínculo direto entre máquina e riscos ou inspeções".
  - Anexos: [X] Manual, [X] Laudo, [X] ART, [X] Outro: "Inspeção Inicial de Mobilização, Plano de Manutenção, Ordens de Serviços de Manutenção, Laudo NR 12_Apreciação de Riscos, Inspeção Periódica, Inspeção Eventual (o responsável pelo cadastro seleciona os itens a serem inseridos)".
- **Status:** A DEFINIR (decisão parcial: anexos definidos e ausência de vínculo confirmada).
- **Código:** cadastro e anexo no DOCX existem (NOB-104, Done). Não há anexos de arquivo por máquina.
- **Linear:** NOB-104. O cadastro **não** está homologado.

### SEG-23 · Revisor técnico e amostras de validação do documento

- **Resposta:**
  - [x] 3. Uma amostra por tipo de atividade ou grau de risco.
  - Novas rodadas: [X] "Somente mudanças relevantes".
  - Revisor e prazo: em branco.
- **Observação (trecho):**
  - "incluir os riscos biológicos, mecânicos e psicossociais";
  - "mudar a forma como o risco é calculado exige nova revisão. Corrigir um erro de digitação, não. Essa diferença precisa estar escrita";
  - o revisor deve ser "de fora da equipe de desenvolvimento e do escritório".
- **Status:** DEFINIDO COM RESSALVAS (revisor, prazo e plano de amostragem indefinidos).
- **Código:** amostras e pareceres da NOB-107 com três casos fictícios. A PR #137 acrescenta biológico, mecânico e psicossocial.
- **Linear:** NOB-107, NOB-96. Esse controle valida o **gerador**, não cada PGR (SEG-24).

### SEG-24 · Revisão por amostragem ou em cada PGR

- **Resposta:**
  - [x] 2. "Sim. Cada PGR é revisado antes da entrega."
  - Revisor com acesso próprio: [X] Sim.
- **Observação (trecho):**
  - "a função de revisão deve ser separada da de administração do escritório";
  - "o sistema deve impedir que a mesma pessoa elabore e revise o mesmo PGR";
  - o registro guarda "nome, habilitação, data, hora e a versão do documento revisada".
- **Status:** DEFINIDO.
- **Código:**
  - na `develop`, só o administrador registra o parecer das amostras (NOB-107);
  - a PR #137 (aberta) implementa revisor distinto, com acesso próprio, por PGR.
- **Recomendação:** DT-04.

### SEG-25 · PGR básico: público, serviços e limites

- **Resposta:** [X] A definir. Periodicidade, público, limites, excedente e preço em branco.
- **Status:** A DEFINIR (comercial, no fim do desenvolvimento).
- **Código:** catálogo versionado com publicação e aprovações (NOB-106, Done), sem conteúdo aprovado.
- **Recomendação:** DT-24.

### SEG-26 · Responsável pela oferta de PGR básico

- **Resposta:** [X] A definir. Aprovador e publicador em branco.
- **Status:** A DEFINIR.
- **Código:** hoje a oferta é do escritório e só o owner altera.
- **Recomendação:** DT-24.

### SEG-27 · Planos e valores exibidos hoje

- **Resposta:** [X] 3. "Módulos PGR e Medicina contratados separadamente, com o Pro como nível de recursos." [X] A definir.
- **Observação (trecho):**
  - "O Pro define as faixas de limites e as funcionalidades disponíveis em cada um, o que permite cobrar de acordo com o porte";
  - "elimina o plano Enterprise";
  - "Façam uma lista dos módulos, que definiremos na próxima rodada";
  - "Valores a definir".
- **Compatibilidade com a reunião:**
  - os três formatos (só PGR, só Medicina, PGR + Medicina) cabem na alternativa 3;
  - "preço pelo porte" é compatível com "Pro define as faixas";
  - como Pro e faixa de funcionários se combinam continua aberto, junto com a precificação no fim.
- **Status:** DEFINIDO COM RESSALVAS (estrutura escolhida; valores e limites pendentes).
- **Código:** a tela mostra valores sem aprovação (Pro R$ 197, Enterprise R$ 497). A pilha comercial simulada (#122–#135) está aberta.
- **Recomendação:** DT-24. Não exibir valores como aprovados.

### SEG-28 · Teste grátis e restrições durante o teste

- **Resposta:**
  - [x] 2. "15 dias, como na planilha do protótipo."
  - Bloqueado: [X] Imprimir, [X] Assinar e emitir. **Download não bloqueado.**
  - Um teste por: [X] CNPJ da empresa.
- **Observação (trecho):**
  - "O download de DOCX e PDF é permitido, e todo documento gerado no teste recebe a marca 'DEMONSTRAÇÃO — TESTE GRÁTIS', que não pode ser removida pelo usuário, inclusive no arquivo baixado";
  - "A quantidade de downloads permitidos durante o teste ainda não está definida".
- **Fonte secundária:** o arquivo do Dr. Alcides marca o mesmo (15 dias; imprimir; assinar e emitir).
- **Limitação técnica:**
  - depois do download, a plataforma não controla a impressão do arquivo;
  - uma marca d'água em DOCX é removível por qualquer editor;
  - "Bloquear impressão" só vale para a ação de imprimir dentro da plataforma.
- **Decisão da equipe (PR #137):** download de demonstração com marca, aceitando que o arquivo baixado pode ser alterado; sem limite de downloads nesta etapa.
- **Status:** DEFINIDO COM RESSALVAS.
- **Código:** `TRIAL_DAYS = 7` na `develop` (`domains/platform/billing.ts`) **diverge** dos 15 dias. O teste de 15 dias por CNPJ está na PR #128 (pilha aberta).
- **Recomendação:** DT-13.

### SEG-29 · Inadimplência e carência

- **Resposta:**
  - [x] 1. "Sim, como está na especificação." A especificação prevê 15 dias depois do vencimento, emissão suspensa e dados acessíveis.
  - Download dos PGRs emitidos durante a suspensão: [X] Não.
- **Observação (trecho):**
  - "Somente visualização do último PGR emitido, sem download";
  - "O sistema deve bloquear também a impressão do documento pela tela e qualquer outra forma de exportação";
  - "recomendo que o jurídico revise a condição".
- **Norma (conferida):** NR-01 1.5.7.2.1 — documentos do PGR "sempre disponíveis aos trabalhadores interessados, aos sindicatos [...] e à Inspeção do Trabalho".
- **Interpretação:**
  - Impedir o acesso da empresa ao próprio documento obrigatório pode impedi-la de cumprir a NR-01.
  - Bloquear "impressão pela tela" não é tecnicamente garantível (captura de tela).
  - É preciso separar o bloqueio de funcionalidade comercial do acesso a registro obrigatório.
- **Status:** VALIDAÇÃO NORMATIVA NECESSÁRIA (jurídico).
- **Recomendação:** DT-14.

### SEG-30 · Contratação de módulos e serviços avulsos

- **Resposta:** [X] A definir. Serviços avulsos em branco.
- **Status:** A DEFINIR (comercial, no fim).
- **Código:** habilitação manual e gratuita pelo owner. Pedidos avulsos simulados na PR #127 (aberta).
- **Recomendação:** DT-24.

### SEG-31 · EPI: certificado de aprovação vencido e assinatura da ficha

- **Resposta:**
  - Entrega com CA vencido: [X] 1. Ser bloqueada.
  - Assinatura por link atende à prática: [X] Outro.
- **Observação:**
  - "Não, Opções de assinatura de recebimento: Biometria, coletada no momento da entrega, com assinatura prévia cadastrada no sistema. Registro fotográfico do EPI entregue, vinculado à entrega. Física, com impressão e assinatura da ficha";
  - "O sistema deve permitir as três opções e registrar qual foi usada em cada entrega. A biometria é opcional e exige cadastro prévio voluntário";
  - "A regra de bloqueio por CA vencido continua valendo para opções de cadastro no sistema. O EPI com CA vencido não pode ser adquirido, porém pode ser fornecido, se já constar no estoque e esteja em perfeitas condições de uso."
- **Interpretação:** a marcação (bloquear a entrega) conflita com a observação (pode fornecer do estoque). A observação separa as etapas:
  - **aquisição:** bloqueada com CA vencido;
  - **cadastro:** bloqueio vale;
  - **entrega:** permitida para item já em estoque, em boas condições.
- **Norma:**
  - O MTE (Perguntas e Respostas sobre EPI; NT 146/2015 e 130/2018) entende que a comercialização exige CA válido.
  - Depois da aquisição, o fornecimento segue a validade e o armazenamento informados pelo fabricante (itens 6.9.2.1 e 6.9.2.1.1 citados pelo MTE).
  - **Conferir o texto consolidado da NR-06** antes de implementar.
  - Biometria é dado pessoal sensível (LGPD, art. 5º, II): exige base legal específica.
- **Status:** AMBÍGUO · VN.
- **Código:**
  - a consulta do CA nunca bloqueia o cadastro;
  - a entrega não verifica a validade do CA;
  - assinatura manual ou por link de 72 h.
  - A resposta "Não" ao link **diverge do implementado**.
- **Recomendação:** DT-15, DT-16.

### SEG-32 · Modelos oficiais de inspeção

- **Resposta:** [X] 2. "Também resposta numérica, múltipla escolha ou foto, conforme o item." No campo "Outro" (caixa **desmarcada**) foi digitado: "Conforme / Não Conforme / Não Aplicável".
- **Observação (trecho):**
  - "O sim/não com observação continua como base. Os demais tipos são definidos por item dentro de cada modelo";
  - "Há um modelo padrão, que pode ser personalizado somente por usuários com nível de acesso superior. [...] o modelo padrão permanece somente leitura. Cada inspeção registrará a versão do modelo utilizada. Serão enviados alguns modelos adicionais".
- **Interpretação:** a base sim/não convive com a escala C/NC/NA, digitada sem marcar "Outro". Os tipos são por item.
- **Status:** DEFINIDO COM RESSALVAS (escala padrão a confirmar; modelos adicionais não recebidos).
- **Código:** sim/não com observação.
- **Recomendação:** DT-20.

### SEG-33 · Alertas e notificações de Segurança

- **Resposta:** [X] 3. Dentro do sistema, por e-mail e por WhatsApp.
- **Observação (trecho):**
  - "Dentro do sistema e por e-mail devem ser o padrão para tudo";
  - WhatsApp só "para vencimentos críticos e para quem aceitou esse canal, com opção de desativar";
  - tabela de alertas e destinatários: PGR, medidas, treinamento, EPI/CA, ASO vencido para "RH e colaborador" e ações do plano.
- **Status:** DEFINIDO COM RESSALVAS · VN (consentimento e base legal do WhatsApp; política da API da Meta).
- **Impacto na Medicina:** "ASO vencido → RH" é compatível com a MED-17 (o RH vê tipo, data, conclusão e validade), sem resultado.
- **Código:** só alertas internos.
- **Linear:** NOB-119 (alertas comerciais).
- **Recomendação:** DT-19.

### SEG-34 · Grupo mínimo de respostas no psicossocial

- **Resposta:** [X] 2. Configurável, com mínimo de 3.
- **Observação (trecho):**
  - "Recomendo 5 como mínimo fixo, ou configurável apenas para cima (5, 7, 10)";
  - "O limite deve valer para cada corte, não só para o total";
  - "Evitar a dedução por diferença";
  - "O 5 é uma prática comum de anonimato em pesquisas, não uma exigência legal que eu possa citar com precisão".
- **Interpretação:** a marcação (mínimo 3) contradiz a recomendação escrita pelo próprio respondente (mínimo 5).
- **Status:** AMBÍGUO · VN (LGPD; anonimato).
- **Código:** a agregação (`repositories/psychosocial-campaigns.ts`) mostra médias sem grupo mínimo. O questionário afirma que isso será corrigido.
- **Recomendação:** DT-17 (provisória; não é aprovação do Expedito). Prioridade **crítica**.

### SEG-35 · Funcionalidades complementares da Segurança do Trabalho

- **Incluir:**
  - serviço de auditoria de programas e documentos de SST;
  - formulário psicossocial respondido pela empresa;
  - inclusão automática de riscos psicossociais no inventário;
  - preenchimento automático de CNAE e CBO;
  - fluxo de qualidade do GED (elaboração, revisão, aprovação).
- **A definir:** transmissão de eventos de SST ao eSocial; emissão oficial da CAT (S-2210).
- **Interpretação:**
  - A "inclusão automática" de riscos psicossociais precisa respeitar a SEG-19: entra como pendente de validação.
  - A transmissão ao eSocial em aberto **não** contradiz o S-2220 incluído na MED-23: preparar e exportar é diferente de transmitir (conflito C-07).
- **Status:** DEFINIDO COM RESSALVAS.
- **Código:**
  - geração de XML do eSocial sem transmissão;
  - CAT como texto interno;
  - GED sem fluxo de qualidade.
- **Recomendação:** DT-18, DT-12.

## 5. Medicina Ocupacional (fonte A)

A interpretação detalhada e as decisões `MED-EXE-01..07` estão em
`docs/planning/medicina-ocupacional/geral/10-EXECUCAO-RESPOSTAS-DR-ALCIDES.md` (PR #138). Aqui ficam a resposta,
o status no padrão deste documento e o que mudou com a análise integrada.

| Questão | Resposta marcada (resumo fiel)                                                                                             | Observação original (trecho)                                                                                                                                                                         | Status | Comportamento esperado e pendência                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MED-01  | 1, 2 e 3; ASO identifica "o médico examinador e o médico coordenador do PCMSO"                                             | "o ASO deve conter a assinatura do médico examinador e constar o nome do médico coordenador [...] RQE [...]. O médico EXAMINADOR não precisa ser médico do trabalho."                                | DCR    | Dois fluxos (conclusão no sistema pelo examinador; ASO externo arquivado). Conclusão só pelo médico. NOB-110, NI                                                        |
| MED-02  | 1, 2 e 3; "CRM, UF e RQE"; troca → "O PCMSO é emitido novamente"                                                           | (em branco)                                                                                                                                                                                          | DCR·VN | Designação por empresa e período (PR #138). RQE padrão; sem RQE só pela exceção do NR-7 7.5.2. NOB-144 em revisão                                                       |
| MED-03  | "Outro" ("Está em Observações") e "A definir"; validações anteriores: "Continuam valendo" e "até a próxima revisão do PGR" | "Médico Coordenador do PCMSO não valida riscos, na verdade quem valida os riscos é quem assina o PGR [...]"                                                                                          | AMB    | O médico não valida riscos; usa os validados. Convergência com SEG-19/20 (C-02). Fluxo da NOB-98 preservado                                                             |
| MED-04  | 1, 2 e 3; fluxo de status sem marcação                                                                                     | "A clínica pode concluir ou não o ASO."                                                                                                                                                              | DCR    | Três modos de clínica (DT-26). NOB-122, NI                                                                                                                              |
| MED-05  | Lista inicial: nenhuma caixa (no campo de "Outro", desmarcado, foi digitado "Observações"); registro: [X] Outro            | "O ASO apenas cita a data e os exames complementares [...] não consta resultado [...] É NO PCMSO que estão listados os exames e periodicidade"                                                       | DCR    | Catálogo da Tabela 27 do eSocial (NOB-147, PR #140). ASO sem resultado. A observação cita a NR-15; a periodicidade dos exames é da NR-07                                |
| MED-06  | 1, 2 e 3; "pendente": sem marcação                                                                                         | "ASO com conclusão pendente pode ocorrer, se e somente se os exames completares estiverem sem resultado ou quando o exame clinico ainda não foi realizado."                                          | DCR    | Datas por procedimento, do clínico e da emissão; "pendente" só pelos dois motivos. NOB-110/112, NI                                                                      |
| MED-07  | [X] 1. Apenas na empresa onde foram realizados                                                                             | "Os exames feitos por uma empresa não podem ser aproveitados por outra [...]"                                                                                                                        | D      | **Diverge do código:** hoje o exame segue o funcionário. Exige empresa de origem no exame (migration). NOB-112                                                          |
| MED-08  | 1 e 2; registro sem médico: [X] Não; campos obrigatórios listados                                                          | "O PCMSO pode ter um texto básico enxuto, porém tem que ter o ramo de atividade da empresa, o CNAE, o grau de risco, número de empregados [...]"                                                     | DCR    | O modelo real não foi enviado (dependência externa, NOB-93). Rascunho sem médico; emissão exige examinador                                                              |
| MED-09  | Nenhuma caixa                                                                                                              | "não EXISTE ASO com ausência de riscos ocupacionais específicos porque os riscos não foram validados [...]"                                                                                          | AD     | A pergunta sobre riscos pendentes ficou sem resposta. A frase de ausência só vale quando a função não está exposta (DT-12)                                              |
| MED-10  | 1 e 2; restrição exige descrição: [X] Sim                                                                                  | "ou o empregado está APTO ou INAPTO [...] a descrição das restrições ficam no prontuário do trabalhador"                                                                                             | AMB·VN | A marcação (descrição impressa) conflita com a observação (só no prontuário). NR-07 7.5.19.1 "e": apto ou inapto. DT-21                                                 |
| MED-11  | [X] 1. Substituição com motivo; mesma regra para o PCMSO: [X] Sim                                                          | "não elimina os documentos que serão substituídos"                                                                                                                                                   | D      | ASO e PCMSO imutáveis; substituição versionada (DT-06). NOB-110/109                                                                                                     |
| MED-12  | 1, 2 e 3                                                                                                                   | "qualquer os 3 métodos é válido [...] documentos ocupacionais devem ser guardados por 20 anos."                                                                                                      | DCR·VN | Sem assinatura verificável, o documento sai como prévia. Equivalência jurídica não presumida                                                                            |
| MED-13  | Nenhuma caixa                                                                                                              | "ASO deve ser fornecido ao trabalhador que deve assinar 2 vias [...] na presença do médico examinador"                                                                                               | DCR    | Registro da entrega com evidência; portal do trabalhador (MED-23) como canal adicional                                                                                  |
| MED-14  | 1, 2 e 3; vigência [X] 12 meses; revisão por [X] Risco novo no PGR                                                         | "Mudança de médico coordenador não implica em revisão do PCMSO [...] seria mais correto chamar de atualização"                                                                                       | DCR    | Conflito interno com a MED-02 ("emitido novamente") resolvido como nova edição administrativa, sem revisão clínica. NOB-109                                             |
| MED-15  | 1, 2 e 3                                                                                                                   | "o PCMSO deve buscar quais riscos estão elencados para determinada função [...] e a partir dái ele automaticamente relaciona os exames [...] cabe ao médico coordenador manter, aumentar ou excluir" | DCR    | Proposta a partir dos riscos validados (NOB-147, PR #140); revisão do coordenador pendente (migration + identidade)                                                     |
| MED-16  | [X] 1. Lista C do Anexo II do Decreto 3.048/99; comparação por [X] Classe do CNAE (4 dígitos)                              | "só baixar e anexar referida lista"                                                                                                                                                                  | D·VN   | Importar só a fonte oficial vigente. NOB-113                                                                                                                            |
| MED-17  | 1 e 2; CID: [X] "Sim, somente com autorização do trabalhador"                                                              | "ASO E Atestados [...] não compartilham o mesmo espaço"                                                                                                                                              | DCR·VN | O RH vê tipo, data, conclusão e validade (+ restrição necessária ao trabalho); nunca resultados; CID fora por padrão (DT-21)                                            |
| MED-18  | [X] 1. 20 anos após o desligamento; depois do prazo: sem marcação                                                          | "30 anos é uma lei geral e não ocupacional"                                                                                                                                                          | DCR·VN | Confere com a NR-07 7.6.1.1, que ressalva os Anexos. Sem exclusão automática. Conferir NR-07 Anexo III 2.17 (amianto) e NR-15 Anexo 12 (C-04)                           |
| MED-19  | 2 e 3                                                                                                                      | Lista de prazos; demissional "até 90 dias para grau de risco 3 e 4 e de 120 dias grau de risco 1 e 2"                                                                                                | DCR    | Norma prevalece: 135/90 (NR-07 7.5.11), implementado na NOB-145. O "120 dias" aparece na NR-07, Anexo II, 4.1.1, para a **audiometria**                                 |
| MED-20  | 2, 3, 4, 5, 6 e 7: Vale; 8, 9 e 10: Não vale; 1 sem marcação                                                               | (em branco)                                                                                                                                                                                          | DCR·VN | 4 e 5 só como apoio, sem conclusão automática (DT-23). **Regra 10 × NR-07 Anexo III 2.17:** acompanhamento pós-demissional de expostos ao asbesto é obrigatório (DT-22) |
| MED-21  | 1, 2 e 3; mesmo formato depois: [X] Não                                                                                    | "depois e definido um fluxo e validado o que o app esta entregando, a IA pode concluir essa parte."                                                                                                  | DCR    | Aceite humano identificado e registrado; IA não conclui aceite (DT-25)                                                                                                  |
| MED-22  | [X] 1. Somente dados inventados; [X] 2. Alguns dados reais de empresas, nada de saúde                                      | (em branco)                                                                                                                                                                                          | DCR    | Marcações parcialmente contraditórias. Sem efeito: nada é copiado do protótipo                                                                                          |
| MED-23  | As nove funcionalidades: [X] Incluir                                                                                       | (em branco)                                                                                                                                                                                          | D      | Issues NOB-139 a 143, 120, 122, 125, 113. "Envio de eventos de saúde ao eSocial (S-2220)" × SEG-35 (C-07)                                                               |

## 6. Verificação da contagem

- Questões de Segurança encontradas no arquivo E: **35** (SEG-01 a SEG-35, sem lacuna nem duplicata).
- Questões de Medicina encontradas no arquivo A: **23** (MED-01 a MED-23).
- Caixas marcadas:
  - E: 102 na Parte I e 0 na Parte II;
  - A: 72 na Parte II e 3 na Parte I (SEG-28, registradas acima como fonte secundária).
- Nenhuma marcação foi inventada. Pergunta sem marcação aparece como "sem marcação"/"nenhuma caixa".
