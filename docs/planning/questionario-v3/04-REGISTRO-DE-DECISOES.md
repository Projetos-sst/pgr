# 04 · Registro de decisões técnicas (Documento D)

Decisões que a equipe pode consultar sem reabrir os questionários. Cada uma separa:

- o que o profissional respondeu;
- o que a equipe recomenda;
- o que a norma exige.

**Nenhuma recomendação está validada só por estar aqui.**

Estados:

- **recomendada:** proposta da equipe, sem aprovação;
- **validada:** aprovada por quem tem autoridade, com nome, data e local do registro;
- **implementada:** mergeada na `develop`, com teste;
- **pendente:** depende de decisão externa.

IDs `DT-NN` nunca são reutilizados.

- As decisões `MED-EXE-01..07` (PR #138) e `MED-DEC-NN` (`medicina-ocupacional/geral/04`) continuam nos documentos de origem.
- As decisões da PR #137 aparecem citadas como "decisão registrada da equipe", sem atribuição ao Expedito ou ao Dr. Alcides.

## Resumo

| ID    | Situação                                          | Questões                           | Estado                    | Responsável pela decisão          |
| ----- | ------------------------------------------------- | ---------------------------------- | ------------------------- | --------------------------------- |
| DT-01 | Conta contratante: empresa direta ou consultoria  | SEG-01, 05                         | recomendada               | Carlos / Douglas                  |
| DT-02 | Acesso de colaborador por empresa e módulo        | SEG-03, 06; MED-17                 | recomendada               | Carlos / Douglas (segurança)      |
| DT-03 | Separação Saúde × Segurança por permissão         | SEG-06; MED-17                     | recomendada               | Carlos / Douglas + Dr. Alcides    |
| DT-04 | Fluxo integrado do PGR                            | SEG-07, 09, 23, 24                 | recomendada               | Expedito (confirmação)            |
| DT-05 | Identificação do responsável pelo PGR             | SEG-08, 13                         | recomendada               | Expedito / responsável técnico    |
| DT-06 | Documento emitido é imutável                      | SEG-10; MED-11                     | parcialmente implementada | —                                 |
| DT-07 | Guarda, exportação e exclusão                     | SEG-12; MED-18                     | pendente                  | Jurídico + Carlos                 |
| DT-08 | Exceção justificada de bloqueantes                | SEG-13                             | recomendada               | Expedito / responsável técnico    |
| DT-09 | Metodologia de classificação                      | SEG-15                             | pendente                  | Responsável técnico               |
| DT-10 | Hierarquia de controle em cinco níveis            | SEG-16                             | recomendada               | Expedito (confirmação dos termos) |
| DT-11 | Campos técnicos por categoria de risco            | SEG-18                             | recomendada               | Expedito / responsável técnico    |
| DT-12 | Validação única de riscos para PGR e PCMSO        | SEG-19, 20, 21, 35; MED-03, 09, 15 | recomendada               | Expedito + Dr. Alcides            |
| DT-13 | Teste grátis e arquivos baixados                  | SEG-28                             | recomendada               | Carlos (comercial, no fim)        |
| DT-14 | Inadimplência sem bloquear documento obrigatório  | SEG-29                             | pendente                  | Jurídico                          |
| DT-15 | CA vencido: aquisição × entrega de estoque        | SEG-31                             | recomendada               | Expedito (confirmação) + NR-06    |
| DT-16 | Modalidades de assinatura da ficha de EPI         | SEG-31                             | recomendada               | Expedito + jurídico (biometria)   |
| DT-17 | Anonimato no psicossocial                         | SEG-34                             | recomendada               | Expedito (confirmação)            |
| DT-18 | eSocial: preparar e exportar ≠ transmitir         | SEG-35; MED-23                     | recomendada               | Carlos / Douglas                  |
| DT-19 | Canais de notificação                             | SEG-33                             | recomendada               | Carlos                            |
| DT-20 | Tipos de resposta e versões de modelo de inspeção | SEG-32                             | recomendada               | Expedito (escala padrão)          |
| DT-21 | ASO, restrição e visão do RH                      | MED-01, 10, 17; SEG-06             | recomendada               | Dr. Alcides + jurídico            |
| DT-22 | Acompanhamento pós-demissional do amianto         | MED-20 (regra 10), MED-18          | recomendada               | Dr. Alcides (ciência da norma)    |
| DT-23 | Regras clínicas interpretativas só como apoio     | MED-19, 20                         | recomendada               | Dr. Alcides                       |
| DT-24 | Comercial por último, sem bloquear o técnico      | SEG-01, 04, 25–30                  | validada (direção)        | Reunião com o Expedito            |
| DT-25 | Aceite das entregas é humano                      | MED-21                             | recomendada               | Carlos / Expedito / Dr. Alcides   |
| DT-26 | Modos de participação da clínica                  | MED-04; SEG-02                     | recomendada               | Dr. Alcides                       |
| DT-27 | Perfil do representante da empresa                | SEG-02, 20; MED-17                 | recomendada               | Carlos / Douglas                  |
| DT-28 | Edição dos textos padrão do PGR                   | SEG-14                             | recomendada               | Expedito (aprovador dos textos)   |

## Decisões

### DT-01 · Conta contratante: empresa direta ou consultoria

- **Situação:** a SEG-01 descreve venda direta à empresa e venda via consultoria. Hoje o tenant é o "escritório".
- **Alternativas:**
  - (a) dois tipos de tenant;
  - (b) um tenant genérico ("conta contratante"), que pode ser consultoria ou empresa final;
  - (c) duplicar a empresa em vários tenants.
- **Recomendação:** (b). A empresa que contrata direto é a própria conta e se cadastra como empresa atendida. Não usar (c).
- **Justificativa:** preserva o isolamento por tenant, que já existe, e evita duplicar dados de funcionários e exames.
- **Riscos:** relatórios comerciais precisam distinguir o tipo de conta; isso vai no cadastro comercial, no fim.
- **Fonte:** SEG-01, SEG-05; arquitetura (`withOrg`, RLS).
- **Estado:** recomendada.

### DT-02 · Acesso de colaborador por empresa e módulo

- **Situação:** a SEG-03 pede atribuição por empresa e módulo (e obra, na observação). Hoje todo colaborador vê tudo.
- **Alternativas:** (a) filtro só de menu; (b) atribuições no banco aplicadas no servidor e na RLS; (c) papéis fixos por área.
- **Recomendação:** (b).
  - Tabela de atribuições colaborador × empresa × módulo, conferida em Actions, REST, páginas e jobs, com policy RLS.
  - Obra como extensão posterior.
- **Decisão registrada da equipe (PR #137):** a restrição preserva o acesso atual até a configuração explícita, como estratégia de migração.
- **Justificativa:** "uma UI escondida não equivale a permissão"; a SEG-06 e a MED-17 dependem disso.
- **Riscos:** regressão de acesso. Mitigar com testes de isolamento e ativação gradual por escritório.
- **Fonte:** SEG-03, SEG-06, MED-17.
- **Estado:** recomendada. Precisa de issue própria: nenhuma cobre hoje.

### DT-03 · Separação Saúde × Segurança por permissão

- **Situação:** a SEG-06 (versão nova) exige separação por menu **e** permissão, com restrição por campo em incidentes e psicossocial.
- **Recomendação:**
  - Perfis de área (Segurança, Saúde) sobre a DT-02.
  - Nos módulos "Ambas", os campos de saúde ficam em estrutura separada ou com policy própria. Exemplos: lesão e afastamento do acidentado; acompanhamento clínico psicossocial.
  - O menu reflete a permissão; nunca a substitui.
- **Justificativa:** sigilo médico (MED-17); a NR-07 7.6.1 trata o prontuário como registro do médico responsável.
- **Riscos:** os módulos de incidentes e psicossocial já gravam dados sem essa separação. Exige auditoria do schema e migration aditiva.
- **Fonte:** SEG-06, MED-10, MED-17; NR-07 7.6.1.
- **Estado:** recomendada. **Corrige a premissa** da PR #137 (só navegação).

### DT-04 · Fluxo integrado do PGR

- **Situação:** a SEG-07 (alternativa 2, sem revisor) diverge da SEG-09 (com revisão técnica) e da SEG-24 (revisão em cada PGR por pessoa distinta). A SEG-23 é outro controle.
- **Recomendação:**
  1. Elaboração.
  2. Validação dos riscos (DT-12).
  3. Revisão técnica por profissional distinto do elaborador e do administrador, com acesso próprio.
  4. Aprovação técnica pelo revisor.
  5. Emissão.
  6. Assinatura do responsável.
  7. Ciência ou aprovação da empresa (representante, DT-27).
  - A validação do gerador por amostras (SEG-23) continua separada: mudança relevante de modelo ou regra exige nova rodada.
- **Justificativa:** concilia as três respostas sem descartar nenhuma.
- **Riscos:** custo operacional em escritórios pequenos. A SEG-24 não prevê dispensa.
- **Fonte:** SEG-07, 09, 23, 24. Código: NOB-107 (amostras) e PR #137 (revisor por PGR, aberta).
- **Estado:** recomendada. Confirmar com o Expedito que a "aprovação" da SEG-09 é do revisor e a "aprovação" da SEG-07 é ciência da empresa.

### DT-05 · Identificação do responsável pelo PGR

- **Situação:** a SEG-08 marca que "não se aplica" não pode ser emitido, mas a observação diz que o registro em conselho não é obrigatório. A SEG-13 bloqueia "responsável e seu registro".
- **Recomendação:**
  - Nome e função do responsável obrigatórios e bloqueantes.
  - Elaborador e responsável registrados quando forem pessoas diferentes.
  - Número de registro opcional, guardado e impresso quando existir.
  - "Não se aplica" descreve só o tipo de registro; não dispensa o responsável.
  - Lista de tipos de registro configurável por escritório (SEG-08 alternativa 3).
- **Norma (conferida):** NR-01 1.5.7.2 exige documentos "datados e assinados" sob responsabilidade da organização, sem registro em conselho. Outras NRs podem exigir habilitação específica para laudos.
- **Estado:** recomendada.

### DT-06 · Documento emitido é imutável

- **Situação:** SEG-10 e MED-11.
- **Recomendação:**
  - Depois de assinado ou publicado, nada muda.
  - Correção = nova revisão (Rev01, Rev02...) ou substituição com motivo, referência à anterior, autor, data e versão.
  - Cancelamento pelo responsável técnico ou pelo administrador, com motivo.
  - O documento anterior fica visível no histórico.
- **Já implementado:** trava de PGR assinado ou publicado (`domains/pgr/pgr-lock.ts`); revisões numeradas.
- **Falta:**
  - cancelamento e substituição formais do PGR;
  - ASO e PCMSO (NOB-110, NOB-109).
- **Estado:** parcialmente implementada.

### DT-07 · Guarda, exportação e exclusão

- **Situação:**
  - a SEG-12 permite que o administrador exclua PGR emitido e propõe excluir os dados 1 ano depois do contrato;
  - a MED-18 fixa 20 anos para o prontuário.
- **Norma (conferida):**
  - NR-01 1.5.7.3.3.1: histórico do inventário por no mínimo 20 anos;
  - NR-01 1.5.7.2.1: documentos sempre disponíveis a trabalhadores, sindicatos e fiscalização;
  - NR-07 7.6.1.1: prontuário por 20 anos depois do desligamento, ressalvados os Anexos.
- **Alternativas:**
  - (a) implementar a exclusão em 1 ano como está;
  - (b) nenhuma exclusão automática até cláusula jurídica e exportação completa;
  - (c) a plataforma guarda pelo prazo legal.
- **Recomendação:** (b) agora.
  - Arquivar toda emissão com hash, versão e registros de revisão e assinatura.
  - Exportação completa antes de qualquer encerramento.
  - O "excluir" do administrador vira cancelamento ou inativação com motivo, nunca apagamento físico.
  - (c) ou outra regra só por decisão jurídica.
- **Riscos:** custo de armazenamento. A obrigação legal é da organização, mas apagar cedo transfere o risco para ela sem aviso adequado.
- **Estado:** pendente (jurídico). Nenhuma exclusão automática existe hoje.

### DT-08 · Exceção justificada de bloqueantes

- **Situação:** a SEG-13 admite emitir com item bloqueante pendente, mediante justificativa do responsável técnico.
- **Recomendação:**
  - Duas listas fechadas:
    - **não excepcionáveis:** identificação da empresa (razão social/CNPJ), responsável (nome e função, DT-05), vigência e conteúdo mínimo do inventário da NR-01 1.5.7.3.2 (processos, atividades, perigos com fontes, possíveis lesões, grupos expostos);
    - **excepcionáveis com justificativa:** por exemplo, dado quantitativo ainda em medição, com plano de ação.
  - A justificativa registra autor, data e versão, e aparece no documento.
- **Justificativa:** impede o uso da exceção como autorização genérica para emitir documento incompleto.
- **Estado:** recomendada. A lista final é do responsável técnico.

### DT-09 · Metodologia de classificação

- **Situação:** a SEG-15 marca Fundacentro e "Outro", e afirma que a Fundacentro não tem padrão. Cita a NR-03 e o Manual GRO/PGR da NR-1.
- **Recomendação:**
  - Manter o preset atual, mas rotulá-lo pelo conteúdo real ("matriz 5×5 com gradações AIHA, AS/NZS 4360 e European Commission"), como o próprio DOCX descreve.
  - Não chamá-lo de "Fundacentro oficial".
  - Nenhuma tabela nova da NR-03 ou do Manual entra sem o responsável técnico indicar o item e a tabela exatos.
- **Estado:** pendente (responsável técnico).

### DT-10 · Hierarquia de controle em cinco níveis

- **Situação:** a SEG-16 lista Eliminação, Substituição, Controles de Engenharia, Administrativos e EPI. O código tem `elimination`, `collective_protection`, `administrative` e `ppe`.
- **Norma (conferida):**
  - NR-01 1.5.5.1.1: eliminar, reduzir ou controlar;
  - NR-01 1.5.5.1.2: proteção coletiva, depois medidas administrativas ou de organização do trabalho, depois EPI.
- **Recomendação:**
  - Migration aditiva com o valor "substituição".
  - Rótulo "Controles de engenharia (proteção coletiva)" para o valor existente, sem renomear dados.
  - Documento e formulários com os cinco níveis. "Minimizar" não vira categoria.
  - Registrar que a imagem do Expedito usa "Redução ou substituição" e confirmar o termo.
- **Estado:** recomendada.

### DT-11 · Campos técnicos por categoria de risco

- **Recomendação:** quatro camadas separadas:
  - (1) catálogo de agentes por categoria, extensível ("deixar livre para ser acrescentado");
  - (2) atributos técnicos por categoria;
  - (3) unidades sugeridas por agente, alinhadas ao enum de unidades do eSocial;
  - (4) regras de obrigatoriedade.
  - Obrigatório agora: só o que a NR-01 1.5.7.3.2 exige. Os campos da tabela do Expedito geram aviso até o responsável técnico definir a obrigatoriedade.
  - Sem comparação com limites de tolerância: a alternativa 3 não foi marcada.
- **Estado:** recomendada.

### DT-12 · Validação única de riscos para PGR e PCMSO

- **Situação:**
  - SEG-19: a mesma validação vale para todos os riscos;
  - SEG-20: a empresa indica o autorizador no sistema;
  - SEG-21: risco alterado volta para validação e o médico é notificado;
  - MED-03: o médico não valida; "quem valida os riscos é quem assina o PGR";
  - MED-09: ausência de risco só quando a função não está exposta;
  - MED-15: exames propostos a partir dos riscos.
- **Recomendação:**
  - **Uma** validação técnica por risco e versão, feita pelo profissional autorizado. Normalmente é o responsável técnico do PGR; outro profissional, se a empresa indicar.
  - A mesma validação serve ao PGR e à Medicina.
  - O médico coordenador é notificado de mudanças e usa só riscos validados de fonte vigente (já assim na NOB-98 e na NOB-147). Ele não valida riscos e decide os exames.
  - Risco novo, alterado ou sugerido pela IA entra pendente.
  - "Ausência de riscos" só por declaração do responsável, nunca preenchida automaticamente.
- **Riscos:** evitar duas validações incompatíveis da mesma origem. O fluxo da NOB-98 (Done) é o ponto de partida.
- **Estado:** recomendada. Confirmar com o Expedito e o Dr. Alcides que o autorizado é o responsável pelo PGR ou alguém que ele indica.

### DT-13 · Teste grátis e arquivos baixados

- **Situação:** a SEG-28 bloqueia imprimir, assinar e emitir, mas permite baixar DOCX e PDF com marca "que não pode ser removida".
- **Limitação técnica:** a plataforma não controla a impressão de arquivo baixado, e marca em DOCX é removível.
- **Alternativas:**
  - (a) DOCX e PDF com marca, aceitando o limite (decisão registrada da equipe na PR #137);
  - (b) só PDF com a marca no conteúdo de cada página, sem DOCX durante o teste;
  - (c) só visualização.
- **Recomendação:** (b), ou (a) com aviso explícito ao cliente.
  - "Bloquear impressão" = sem botão de imprimir na plataforma.
  - Não prometer bloqueio de impressão externa nem marca irremovível.
- **Código:** `TRIAL_DAYS = 7` na `develop`; 15 dias na PR #128 (aberta).
- **Estado:** recomendada. Comercial, no fim.

### DT-14 · Inadimplência sem bloquear documento obrigatório

- **Situação:** a SEG-29 suspende a emissão 15 dias depois do vencimento e bloqueia o download dos PGRs emitidos.
- **Norma (conferida):** NR-01 1.5.7.2.1 — documentos sempre disponíveis a trabalhadores, sindicatos e fiscalização.
- **Recomendação:**
  - Suspender emissão, novas revisões e recursos Pro.
  - Manter consulta e um meio de disponibilizar o último PGR emitido, ainda que limitado (por exemplo, PDF com marca de inadimplência, sem DOCX).
  - Texto contratual e na tela.
  - Não prometer bloqueio de captura de tela.
- **Estado:** pendente (jurídico).

### DT-15 · CA vencido: aquisição × entrega de estoque

- **Situação:** a SEG-31 marca "bloquear a entrega", mas a observação permite fornecer do estoque.
- **Norma:** pelo MTE (Perguntas e Respostas sobre EPI; NT 146/2015 e 130/2018), a comercialização exige CA válido e o fornecimento depois da aquisição segue validade e armazenamento do fabricante. Conferir a NR-06 consolidada.
- **Recomendação:**
  - Bloquear a **entrada no estoque por compra** com CA vencido na data da aquisição.
  - Gravar a situação do CA na compra.
  - Permitir a **entrega** de item comprado com CA válido, dentro da validade do fabricante, com aviso.
  - Bloquear a entrega quando não houver comprovação da compra com CA válido.
- **Estado:** recomendada.

### DT-16 · Modalidades de assinatura da ficha de EPI

- **Situação:** na SEG-31, o link não atende à prática. O Expedito pede três modalidades: biometria opcional, foto do EPI entregue e ficha física assinada.
- **Recomendação:**
  - Registrar a modalidade em cada entrega.
  - Ficha física digitalizada e foto do EPI (não do trabalhador) primeiro.
  - Biometria só depois de avaliação jurídica: dado sensível (LGPD, art. 5º, II, e art. 11) com consentimento específico e alternativa sem biometria.
  - Manter o link de 72 h, já implementado, como opção configurável. Ele não é a prática padrão.
- **Estado:** recomendada.

### DT-17 · Anonimato no psicossocial

- **Situação:** a SEG-34 marca "configurável, mínimo 3", mas a observação recomenda 5, por corte, e supressão contra dedução por diferença.
- **Recomendação provisória (equipe, não do Expedito):**
  - Mínimo de 5, configurável só para cima.
  - Aplicado a cada corte (setor, cargo, turno) e ao total.
  - Supressão complementar quando um grupo oculto puder ser deduzido.
- **Justificativa:** maior proteção; a própria observação diz que 5 é prática, não lei.
- **Estado:** recomendada. Confirmar com o Expedito.

### DT-18 · eSocial: preparar e exportar ≠ transmitir

- **Situação:** a SEG-35 deixa em aberto a transmissão ao eSocial e a CAT; a MED-23 inclui "Envio de eventos de saúde ao eSocial (S-2220)".
- **Recomendação:**
  - Preparar, validar e exportar o S-2220 (NOB-140) sem transmitir.
  - Nunca afirmar envio sem protocolo.
  - Transmissão (certificado, procuração, responsabilidade) só depois da decisão da SEG-35, igual para S-2210/2220/2240.
- **Estado:** recomendada.

### DT-19 · Canais de notificação

- **Recomendação:**
  - Sistema e e-mail como padrão.
  - WhatsApp só para vencimentos críticos, com opt-in do destinatário, opção de desativar, modelos aprovados na API oficial e registro de consentimento.
  - Destinatários conforme a tabela da SEG-33, respeitando a DT-21 (o RH recebe "ASO vencido" sem conteúdo clínico).
- **Estado:** recomendada.

### DT-20 · Tipos de resposta e versões de modelo de inspeção

- **Recomendação:**
  - Tipo de resposta por item: sim/não, C/NC/NA, numérica, múltipla escolha e foto.
  - Modelo padrão somente leitura; modelos derivados por usuários de nível superior.
  - A inspeção grava a versão do modelo.
  - Escala padrão (sim/não × C/NC/NA) a confirmar com o Expedito.
  - Modelos adicionais entram quando forem enviados.
- **Estado:** recomendada.

### DT-21 · ASO, restrição e visão do RH

- **Situação:**
  - MED-10: as marcações pedem descrição da restrição; a observação diz apto ou inapto, com detalhes no prontuário;
  - MED-17: o RH vê tipo, data, conclusão, validade e a restrição necessária ao trabalho; CID só com autorização;
  - MED-01: examinador assina e o coordenador consta.
- **Norma:** NR-07 7.5.19.1 (ASO: apto ou inapto; examinador identificado).
- **Recomendação:**
  - ASO imprime apto ou inapto.
  - A descrição clínica fica no prontuário segregado.
  - A comunicação da adaptação necessária ao trabalho, sem diagnóstico, é um registro separado visível ao RH.
  - CID nunca no ASO; nos afastamentos, só com autorização registrada do trabalhador.
- **Estado:** recomendada (MED-EXE vigente na PR #138). Confirmar com o Dr. Alcides e o jurídico.

### DT-22 · Acompanhamento pós-demissional do amianto

- **Situação:** na MED-20, regra 10, o Dr. Alcides marca "Não vale". Na MED-18 diz que "30 anos é uma lei geral e não ocupacional".
- **Norma (conferida):**
  - NR-07, Anexo III, 2.17: depois do contrato com exposição ao asbesto, o empregador disponibiliza exames periódicos "durante, no mínimo, trinta anos". Periodicidade em 2.17.1.
  - NR-07, Anexo III, 3.5: a espirometria pós-demissional segue a periodicidade radiológica.
- **Recomendação:**
  - Prevalece a norma.
  - Tratar como obrigação do empregador (agenda e convocação), não como regra clínica automática.
  - A proposta de exames da NOB-147 já cita o item 2.17 quando o agente é asbesto.
  - Informar ao Dr. Alcides que a regra 10 contraria a NR-07.
- **Estado:** recomendada.

### DT-23 · Regras clínicas interpretativas só como apoio

- **Situação:** na MED-20, as regras 4 (audiometria) e 5 (espirometria) estão "Vale". Na MED-19, "sugere e o médico confirma" e "calcula com regras aprovadas".
- **Recomendação:**
  - Prazos administrativos (7.5.8, 7.5.9, 7.5.11) como sugestão confirmável. Isso já existe na NOB-145.
  - Critérios interpretativos de exame só como indicação visual, com conclusão sempre do médico.
  - Nenhuma regra aplicada sem item normativo e teste de fronteira.
- **Estado:** recomendada.

### DT-24 · Comercial por último, sem bloquear o técnico

- **Situação:** SEG-25, 26 e 30 estão "A definir"; a SEG-27 tem estrutura escolhida e valores pendentes.
- **Decisão (reunião com o Expedito):**
  - três formatos (só PGR, só Medicina, PGR + Medicina);
  - preço pelo porte (funcionários);
  - precificação, faixas, valores, avulsos e cobrança no fim.
- **Recomendação:**
  - Fluxos clínicos e operacionais não dependem de cobrança.
  - Habilitação manual pelo owner até o comercial existir.
  - Valores da tela não aparecem como aprovados.
  - Como o Pro e o porte se combinam fica para a rodada comercial.
- **Estado:** validada quanto à direção (reunião); valores pendentes.

### DT-25 · Aceite das entregas é humano

- **Situação:** na MED-21, para as próximas entregas, "a IA pode concluir essa parte".
- **Recomendação:**
  - Aceite humano identificado e registrado: quem, quando e o que foi aceito.
  - A IA pode montar checklist e evidência de teste, mas não aceitar.
  - CI verde não é aceite clínico.
- **Estado:** recomendada.

### DT-26 · Modos de participação da clínica

- **Recomendação:** três modos por clínica, conforme a MED-04:
  - sem acesso (a guia e o resultado circulam por fora);
  - acesso restrito para agendar e informar a realização;
  - acesso restrito com médico examinador próprio que conclui o ASO.
  - A clínica é multiescritório (SEG-02).
  - Portal da Medicina (NOB-122), sem acesso à Segurança.
- **Estado:** recomendada.

### DT-27 · Perfil do representante da empresa

- **Recomendação:**
  - Perfil próprio ligado a uma ou mais empresas.
  - Pode: ver o PGR emitido e dar ciência ou aprovação (SEG-02); indicar o autorizador de riscos no sistema (SEG-20); ver dos exames só o permitido na MED-17.
  - Enquanto o perfil não existir, o registro pelo owner com evidência (fluxo atual da NOB-98) é a transição. Essa transição precisa ser registrada como tal.
- **Estado:** recomendada.

### DT-28 · Edição dos textos padrão do PGR

- **Recomendação:**
  - Textos padrão editáveis por PGR **em rascunho**, com registro de autor, data e diferença em relação ao padrão.
  - O documento assinado é imutável (DT-06).
  - O conteúdo exigido por norma não pode ser suprimido; aviso na conferência (DT-08).
  - Aprovador dos textos padrão da plataforma: a definir. Na SEG-14 ninguém foi marcado.
- **Estado:** recomendada.
