# Handoff — Medicina Ocupacional (PCMSO e ASO) · 09/11/2026

> Responsável pela frente: Carlos. Executor das implementações: Claude Code. Merges feitos manualmente pelo Carlos.
> Documento factual: separa **código implementado e testado**, **CI**, **homologação real**, **validação médica** e
> **produção**. Nenhum item aqui está homologado online nem liberado para uso clínico.

## 1. Resumo executivo

- **Código:** as jornadas de PCMSO e ASO estão implementadas de ponta a ponta na `develop`. Inclui:
  - riscos de PGR interno ou externo;
  - plano de exames aprovado pelo coordenador;
  - critérios de interpretação;
  - conferência normativa;
  - prévias versionadas e imutáveis;
  - registro de documento assinado fora do sistema, com substituição;
  - relatório analítico e sua apresentação;
  - entrega do ASO ao trabalhador, com conferência do comprovante.

  Tudo tem testes unitários e de integração em Postgres real com RLS.

- **Testes e CI:** a #168 e a #169 foram integradas à `develop` com o CI oficial verde (run 42509538010 na #169: 2388 testes unitários e 1646 de integração, nenhuma falha). O lote 4 (vigência única dos documentos assinados) está em PR **pendente de merge**; veja a seção 3.
- **Não homologado:** nenhuma jornada foi validada em navegador autenticado nem no banco de homologação. O CD aplica as migrations, mas o banco nunca foi lido diretamente (NOB-162).
- **Não pronto para produção:** os gates NOB-158/159 (identidade médica independente) e NOB-162 (infra de homologação) seguem abertos. O modelo documental final (NOB-93) não foi entregue.

## 2. Escopo entregue

| Área          | Entrega                                                                                                                                         | Issues                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Plataforma    | Medicina habilitada por empresa; cadastros comuns de empresa e funcionário                                                                      | NOB-97, 99, 100, 170, 171               |
| Riscos        | Fontes de PGR interno e externo, validação por profissional autorizado, inexistência de riscos por GES/função (id estável)                      | NOB-98, 111, 156, lote 2                |
| Profissionais | Identidade (categoria, UF, RQE), vínculo médico ↔ conta por convite, verificação independente, coordenador por empresa e período (vigente hoje) | NOB-121, 144, 149, 157–161, 164, lote 2 |
| Exames        | Registro, procedimentos da Tabela 27, empresa de origem, prontuário segregado, afastamentos                                                     | NOB-146, 147, 152, 155, 139             |
| PCMSO         | Proposta → plano aprovado → critérios → conferência → composição e prévia → PCMSO assinado → relatório analítico → apresentação                 | NOB-148, 150, 151, 153, 154, 166, 168   |
| ASO           | Conferência NR-7 7.5.19.1 → prévia → ASO assinado (examinador ou clínica externa) → entrega → conferência do comprovante                        | NOB-152, 163, 165, 167                  |
| Referências   | Tabela 27 (eSocial) e Lista C (NTEP, informativa)                                                                                               | NOB-147, 113                            |
| Formulários   | Persistência, retomada, validação e mensagens nos formulários da Medicina                                                                       | NOB-112 (#136, #166, #167, #168)        |

## 3. Evidências

PRs mergeadas na `develop`: #136, #138–#148, #150–#161, #163–#168. As principais da reta final são:

| PR       | Merge                 | Conteúdo                                                                                                                                                                                                                                                   | CI                      |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| #165     | `4325803`             | PGR externo em empresa só com Medicina (migration 0079)                                                                                                                                                                                                    | verde                   |
| #166     | `07ab5ca`             | Plano de exames: justificativa retomada                                                                                                                                                                                                                    | verde                   |
| #167     | `1db7d45`             | Lote 1: função/GES, coordenador vigente, CRM, erros aninhados, inclusão de exame, datas de documento                                                                                                                                                       | verde (run 42437454046) |
| #168     | `d150ffe`             | Lote 2: permissões do coordenador pela vigência, id da função, datas nas telas, CRM duplicado, 23 formulários, ASO com coordenador sobreposto, fuso IANA (migration 0080)                                                                                  | verde (run 42498719530) |
| #169     | `4434ed4`             | Lote 3: PCMSO assinado pelo coordenador da prévia, aprovação do plano imutável, plano preso aos riscos, ASO assinado só da prévia atual, examinador preservado, verificação de identidade sem pré-preenchimento, bypass dev, CRM no banco (migration 0081) | verde (run 42509538010) |
| LOTE4_PR | **pendente de merge** | Lote 4: vigência única de ASO e PCMSO assinados no banco (gatilho com trava do contexto, inclusive por SQL direto e sob concorrência); app falha fechado com legado ambíguo (migration 0082)                                                               | LOTE4_CI                |

**Migrations:** a última na `develop` é a `0081_lote3_signed_coordinator_plan_guard_crm_trigger`, com journal de 82 registros. O CD pós-#169 (run 42551678504) registrou `migrations applied successfully`. A PR do lote 4 traz a `0082_signed_documents_current_integrity` (journal de 83 registros), **pendente de merge**. As duas foram validadas no migrator real local: base, upgrade, rerun, banco limpo idêntico e sem drift. **O banco de homologação não foi lido diretamente.**

## 4. Matriz de aceite

Legenda:

- **A:** atendido em código e testado;
- **B:** parcial;
- **C:** bloqueado por modelo (NOB-93);
- **D:** bloqueado por assinatura/provedor;
- **E:** bloqueado por homologação (NOB-162);
- **F:** exige aprovação clínica.

### NOB-108 — Módulo Medicina conforme o protótipo

| Critério                                       | Situação                       | Evidência                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jornadas do protótipo mapeadas e implementadas | **B**                          | As 17 jornadas de PCMSO/ASO estão implementadas (matriz 12, "Auditoria integrada"). Fora do escopo do protótipo, sem implementação: portal e clínicas (NOB-122), PPP, fadiga, crônicos, teleconsulta e IA |
| Dados persistem e podem ser retomados          | **A**                          | Formulários: #166, #167, #168 e lote 3; testes `unit/medicine/*` e `integration/medicine/*`                                                                                                               |
| Acesso e isolamento por cliente verificados    | **A** em código · **E** online | RLS por escritório e módulo; testes de outro tenant e de SQL direto em todas as suítes de Medicina                                                                                                        |

### NOB-109 — Geração do PCMSO

| Critério                                                   | Situação                      | Evidência                                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PCMSO reflete os riscos selecionados e validados           | **A**                         | `pcmso-composition.ts`; plano preso às fontes e, no lote 3, ao conjunto de riscos; `pcmso-documents.test.ts`, `pcmso-signed-risk-basis.test.ts`                                                        |
| Origem interna ou externa identificada                     | **A**                         | `riskBasis.origin` (NOB-111); `external-pgr-medicine-only.test.ts`                                                                                                                                     |
| Campos obrigatórios e fluxo técnico de emissão respeitados | **B** + **C** + **D** + **F** | A conferência bloqueia campos ausentes (CNAE, grau, coordenador, plano). Cronograma nominal, clínicas e campanhas dependem de definição (seção 6). A emissão definitiva depende de assinatura (MED-12) |

### NOB-110 — Geração do ASO

| Critério                                            | Situação      | Evidência                                                                                                                                              |
| --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ASO gerado com vínculos e dados corretos            | **A**         | Conferência 7.5.19.1 a–g; empresa de origem; coordenador na data do exame; `aso.test.ts`                                                               |
| Campos obrigatórios validados antes da emissão      | **A**         | Itens bloqueantes da prévia e campos da MED-08 cobertos (auditoria NOB-93, seção 7)                                                                    |
| Revisão, emissão e assinatura seguem fluxo aprovado | **B** + **D** | Registro do ASO assinado (examinador verificado ou clínica externa), substituição com motivo e entrega comprovada. O sistema não assina (sem provedor) |

### NOB-112 — Formulários que alimentam os documentos

| Critério                                   | Situação                                            | Evidência                                                                                         |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Campos mapeados aos documentos e entidades | **A** para o que existe · **C** para o modelo final | Matriz 12 e matriz NOB-93 (seção 7)                                                               |
| Preenchimento salvo e recuperado sem perda | **A**                                               | #166 (justificativa), #167, #168 e lote 3 (examinador inativo preservado)                         |
| Dados válidos chegam à geração documental  | **A**                                               | Composições testadas (ASO e PCMSO); a declaração de inexistência só chega com id de função válido |

### MED-01 a MED-23 (reconciliado no lote 4)

Fonte: `geral/12-MATRIZ-DE-ADERENCIA.md`, estado atual. Legenda:

- **IMP:** implementado e testado;
- **PAR:** parcial;
- **PRO:** só no protótipo;
- **NOR:** depende de requisito normativo ou clínico;
- **FOR:** depende de fornecedor.

Um item pode ter dois marcadores (por exemplo, IMP + NOR). A categoria principal é a primeira.

| MED | Categoria | Evidência / pendência                                                                                                 |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| 01  | IMP       | ASO assinado nos fluxos A e B, substituição e vigência única (`aso-signed.test.ts`). Assinatura pelo sistema: MED-12  |
| 02  | IMP       | Coordenador por empresa e período, vigência (`pcmso-coordinators.test.ts`, `coordinator-permission-in-force.test.ts`) |
| 03  | IMP + NOR | Riscos validados de PGR interno ou externo; conciliação de nomenclatura pendente                                      |
| 04  | PRO       | Clínicas e status do exame: NOB-122                                                                                   |
| 05  | IMP       | Tabela 27 e procedimentos do exame                                                                                    |
| 06  | PAR       | Estados explícitos do exame e do documento                                                                            |
| 07  | IMP       | Exame preso à empresa de origem                                                                                       |
| 08  | PAR + NOR | Conteúdo mínimo coberto; modelos reais (NOB-93) ausentes                                                              |
| 09  | IMP       | Inexistência de riscos por GES e função (id estável)                                                                  |
| 10  | IMP + NOR | Apto ou inapto; restrição no prontuário; comunicação de adaptação pendente                                            |
| 11  | IMP       | Imutabilidade, substituição e vigência única no banco (0082)                                                          |
| 12  | PAR + FOR | Registro de documento assinado; assinatura e validação por provedor sem contrato                                      |
| 13  | PAR       | Entrega comprovada; canal digital do portal (NOB-122)                                                                 |
| 14  | PAR + FOR | Ciclo, relatório analítico e PCMSO assinado; emissão definitiva por provedor                                          |
| 15  | IMP       | Proposta e plano aprovado pelo coordenador                                                                            |
| 16  | IMP       | Lista C oficial (NTEP, informativa)                                                                                   |
| 17  | PAR       | Segregação clínica; portal e perfil do RH (NOB-122)                                                                   |
| 18  | PAR       | Sem exclusão automática; política de guarda e transferência                                                           |
| 19  | IMP       | Prazos do demissional (NR-7 7.5.11)                                                                                   |
| 20  | PAR + NOR | Regras 7.5.8–7.5.11; audiometria, espirometria e psicossocial dependem do médico                                      |
| 21  | NOR       | Aceite e IA (NOB-130)                                                                                                 |
| 22  | IMP       | Somente dados fictícios                                                                                               |
| 23  | PAR       | Complementares: afastamentos implementados; PPP, fadiga, crônicos, teleconsulta, IA e portal ausentes                 |

**Totais:** IMP 12 · PAR 9 · PRO 1 · NOR 1 = **23**.

**Correção do resumo do lote 3:** ele contava 9 + 10 + 1 + 1 = 21.

- MED-12 e MED-13 (ambas PAR) foram citadas à parte e ficaram fora da soma.
- MED-10 (IMP + NOR) foi contada como parcial.
- Pela matriz da época, o total certo era IMP 10 · PAR 11 · PRO 1 · NOR 1.

No lote 4, MED-01 e MED-11 passaram de PAR para IMP. A pendência registrada nelas era a fatia NOB-163 (ASO assinado), que está entregue e testada; a vigência única no banco veio no lote 4.

## 5. O que funciona em código (não confundir com homologação)

- **PCMSO:**
  - não há prévia sem plano aprovado, coordenador vigente e conferência sem bloqueios;
  - a prévia é imutável e tem hash;
  - o PCMSO assinado é registrado com conferência da base de riscos e, a partir do lote 3, do coordenador nomeado na prévia.
- **ASO:**
  - não há prévia com riscos pendentes, declaração inválida, examinador não médico ou coordenador sobreposto;
  - o ASO assinado pelo examinador exige identidade verificada e, a partir do lote 3, a prévia mais recente e ainda fiel ao exame;
  - a entrega fica ligada ao ASO vigente, e o recebimento só é confirmado com conferência do comprovante.
- **Clínico:**
  - prontuário, restrição e notas de afastamento são segregados;
  - só o médico vinculado e verificado lê, e cada leitura fica registrada na trilha de acesso.
- **Datas:** dia de Brasília pela regra IANA no app, no SQL e nas telas; datas civis aparecem como estão.

## 6. O que depende da equipe (não é defeito de código)

1. **Modelo documental (NOB-93):** o Dr. Alcides não enviou os modelos reais de ASO e PCMSO. As perguntas estão na seção 7.
2. **Decisões clínicas e editoriais (F):**
   - cronograma nominal no PCMSO (colunas);
   - campanhas de saúde;
   - texto-base do PCMSO;
   - regra de obrigatoriedade do coordenador por porte;
   - lista de examinadores (escritório × empresa);
   - ASO emitido sem os complementares do plano;
   - política de divergência no ASO de clínica externa (fluxo B).
3. **Provedor de assinatura (D):** ICP-Brasil ou plataforma; sem contrato.
4. **Verificadores independentes e credenciais (NOB-158/162):** provisionar o operador verificador e o acesso de leitura ao banco de homologação.
5. **Dados legados:**
   - contar e regularizar declarações de inexistência sem `job_role_id`, CRMs equivalentes e vínculos médicos anteriores à 0069 (NOB-159);
   - só com acesso autorizado, sem dados pessoais em log.

## 7. NOB-93 — modelo documental

**Fontes disponíveis:**

- questionário respondido pelo Dr. Alcides (MED-08, MED-14);
- `geral/10-EXECUCAO-RESPOSTAS-DR-ALCIDES.md`;
- protótipo `Projeto-SST-Ocupacional/app/saude-ocupacional.html` (`docASO` e `docPCMSO`, só como referência de UX).

**Fontes ausentes:**

- modelos reais de ASO e PCMSO (MED-08, opção 1);
- lista de ajustes ao protótipo (opção 2);
- logotipo, timbre e bloco de assinatura;
- texto das campanhas;
- PDF da NR-7 no repositório.

**ASO:** todo o conteúdo obrigatório (NR-7 7.5.19.1 a–g e campos da MED-08) está composto. O logotipo é opcional ("logotipo **ou** nome com CNPJ").

**PCMSO:** os itens do Dr. Alcides que faltam:

| Item (fonte)                                                     | Situação                                        | Ação                                        |
| ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Cronograma nominal por trabalhador (MED-14)                      | ausente                                         | Definir colunas (decisão); os dados existem |
| Clínicas que executam exames (MED-08)                            | ausente                                         | Depende do cadastro de clínicas (NOB-122)   |
| Ações e campanhas de saúde (MED-08)                              | ausente (aparece como pendência na conferência) | Aprovar lista padrão (calendário do MS)     |
| Obrigatoriedade de coordenador por número de empregados (MED-08) | ausente                                         | Regra normativa e texto                     |
| Relatório analítico do ano anterior (MED-14)                     | referenciado (id e hash)                        | Decidir se incorpora ou anexa               |
| Texto básico enxuto (MED-08)                                     | parcial                                         | Texto do Dr. Alcides                        |

**Perguntas ao Dr. Alcides:**

1. Envia os modelos reais ou aprova o leiaute do protótipo, e com quais ajustes?
2. Cabeçalho do ASO: logotipo, CNAE e grau de risco, data de nascimento e setor/GHE?
3. Item c do ASO: entram todos os riscos da função ou só os que exigem controle médico? Os psicossociais entram em "ergonômicos"?
4. O ASO pode sair sem os complementares do plano aprovado?
5. Blocos de assinatura: examinador, "ciente" do trabalhador e coordenador no PCMSO. Onde ficam e em que formato?
6. O texto-base do PCMSO e as campanhas: são fixos ou editáveis?
7. Qual a regra de obrigatoriedade do coordenador por porte?
8. Os examinadores do PCMSO são os do escritório ou os da empresa? As clínicas são exigidas já na primeira versão?
9. O plano de exames é exibido por ocasião (admissional, periódico, retorno, mudança, demissional)?
10. O relatório analítico vai incorporado ou só referenciado? O cronograma tem quais colunas?

## 8. Segurança e impedimentos à produção

- O owner não tem competência clínica pelo papel.
  - Atos clínicos exigem vínculo médico ↔ conta e identidade verificada por operador independente (`actor_clinical_medico_ids`), no app e na RLS.
  - Atos de coordenador exigem também a designação vigente hoje e única.
- O CRM digitado nunca autoriza nada. A partir do lote 3, um gatilho no banco impede novo CRM equivalente mesmo por SQL direto, e o formulário de verificação de identidade não vem mais preenchido com o cadastro.
- Documentos assinados, prévias, eventos e critérios são append-only, sem UPDATE ou DELETE para a role da aplicação.
- Arquivos ficam em caminho do tenant da sessão e são baixados por URL assinada de 60 segundos.
- **Produção bloqueada** por NOB-158 e NOB-159 (identidade e vínculos legados) e pela NOB-162 (homologação). O bypass de autenticação de desenvolvimento passa a exigir `APP_ENV` definido (lote 3).

## 9. Pendências prioritárias

**Corrigido no lote 3** (auditoria de fechamento, cada item reproduzido antes):

- **P0:**
  - PCMSO assinado aceitava um coordenador diferente do nomeado na prévia (app e RLS).
  - A policy de aprovação do plano permitia reescrever quem aprovou e quando (agora há gatilho de transição).
- **P1:**
  - ASO assinado aceitava prévia antiga ou desatualizada.
  - ASO assinado vigente divergente do exame editado não era sinalizado.
  - Plano de exames não ficava preso ao conjunto de riscos validados; aprovar um rascunho velho derrubava o plano vigente.
  - Editar exame com médico inativo apagava o examinador.
  - Excluir médico examinador apagava o examinador dos exames.
  - Botões de excluir escondiam a recusa do servidor.
  - Verificação de identidade vinha preenchida com o CRM do próprio cadastro (NOB-158).
  - Bypass de desenvolvimento ficava aberto sem `APP_ENV`.
  - CRM equivalente podia ser gravado por SQL direto (agora um gatilho barra gravações novas).
- **P2:** data-base do PCMSO inexistente no calendário (erro 500).

**Pendente:**
| Prioridade | Item | Bloqueio |
|---|---|---|
| P1 | ASO de clínica externa (fluxo B) sem conferência contra a conclusão do exame | Decisão de produto e jurídica |
| ~~P1~~ | Backstop no banco para "um único documento assinado vigente" (ASO e PCMSO) | **Corrigido no lote 4 (0082), pendente de merge**. O legado com mais de uma vigente falha fechado e depende de regularização autorizada |
| P1 | ASO pode sair sem os complementares do plano aprovado (hoje é aviso) | Decisão clínica |
| P1 | Regularização de dados legados (declarações sem `job_role_id`, CRMs equivalentes, vínculos anteriores à 0069) | Acesso de leitura à homologação (NOB-162) |
| P1 | Modelo documental final | NOB-93 |
| P2 | Conferência de comprovante anulada não pode ser refeita | Decisão: reabrir ou exigir nova entrega |
| P2 | Avisos de mudança de critérios ou dados da empresa depois da prévia do PCMSO | Implementável |
| P2 | `readiness.ready` do PCMSO sempre falso (itens "não disponível": clínicas, campanhas) | Corrigir junto com a decisão das campanhas |
| P2 | Examinadores listados por escritório, não por empresa | Decisão (pergunta 8, NOB-93) |
| P2 | CHECK de prefixo do tenant nos caminhos de arquivo; `scoped_company_id` em `medical_risk_decisions` | Endurecimento |
| P2 | ~35 formulários fora da Medicina | Outro escopo |

## 10. Procedimento de continuidade (durante a ausência do Carlos)

- Não fazer merge sem o Carlos, que é o único responsável pelos merges.
- Não habilitar Medicina em produção nem alterar `main`.
- Encaminhar ao Dr. Alcides as perguntas da seção 7. As respostas entram na NOB-93.
- Para quem tiver acesso de leitura autorizado ao banco de homologação: registrar na NOB-162 o journal (esperado: 81 registros, ou 82 depois do lote 3) e as contagens agregadas da seção 6, sem dados pessoais.
- Novas fatias seguem o padrão já usado: reproduzir antes, corrigir, testar em Postgres real, uma PR por lote, CI verde e merge manual.

## 11. Estado para apresentação

- **Código:** concluído para o escopo definido (jornadas de PCMSO e ASO); parcial onde depende de modelo, decisão clínica ou provedor.
- **Testes locais e CI:** verdes até a #169 (run 42509538010). Lote 4: LOTE4_CI (pendente de merge).
- **Homologação:** não realizada (NOB-162).
- **Pendências externas:** NOB-93 (modelo), provedor de assinatura, verificador independente, credenciais de homologação e decisões clínicas.
- **Produção:** **não está pronta.** Os gates NOB-158, NOB-159 e NOB-162 continuam bloqueando, e o documento sai como **prévia**, não como emissão válida.
