# NOB-179 — Revisão por documento e rastreabilidade da emissão do PGR

Cada PGR pode passar por revisão de uma pessoa diferente do elaborador antes da emissão final. A revisão é
adotada PGR a PGR pelo administrador e começa desligada: nada muda para os PGRs existentes nem para o plano
Gratuito até alguém ativar. Não é declaração de conformidade técnica. O parecer é de quem o registra.

## Como funciona

1. O administrador ativa a revisão obrigatória no PGR, com motivo. A ativação não tem volta.
2. O administrador designa o revisor: um membro do escritório, com acesso ao PGR, diferente do elaborador.
3. O revisor abre a prévia, confere e registra o próprio parecer: aprovar ou rejeitar com motivo.
4. Com parecer favorável para a versão atual, a emissão final é liberada e fica arquivada no GED.
5. Se os dados ou o modelo mudarem depois do parecer, a aprovação deixa de valer e a nova versão precisa de
   novo parecer. O parecer antigo continua no histórico.

A prévia (download direto e amostras da NOB-107) continua livre em qualquer estado.

## Formato do dado

Uma tabela só de inserção, `pgr_document_approvals` (migration `0085`). Cada linha é um evento do PGR.
O estado nunca é gravado: é calculado dos eventos e dos hashes atuais (`deriveApprovalState` em
`src/shared/domains/pgr/document-approval.ts`).

| Evento            | Quem grava        | O que guarda                                                                |
| ----------------- | ----------------- | --------------------------------------------------------------------------- |
| `required`        | Administrador     | Motivo da adoção. Um por PGR.                                               |
| `assigned`        | Administrador     | Elaborador, revisor, identificação profissional do revisor, motivo.         |
| `revoked`         | Administrador     | Designação revogada e motivo.                                               |
| `approved`        | Revisor designado | Designação, hash dos dados, hash do modelo, fundamentação opcional.         |
| `rejected`        | Revisor designado | O mesmo, com motivo obrigatório.                                            |
| `issued`          | Membro que emitiu | Parecer usado, documento no GED, hash do arquivo, dados e modelo, snapshot. |
| `issue_cancelled` | Administrador     | Emissão cancelada e motivo.                                                 |

Versão do documento = hash do snapshot dos dados (`pgrSnapshotHash`, o mesmo da conferência da NOB-105) +
hash do arquivo do modelo DOCX.

## Máquina de estados

| Estado              | Significado                                         | Eventos aceitos                               |
| ------------------- | --------------------------------------------------- | --------------------------------------------- |
| `not_required`      | Revisão não adotada. Fluxo antigo.                  | `required`                                    |
| `awaiting_reviewer` | Adotada, sem revisor (nunca designado ou revogado). | `assigned`                                    |
| `awaiting_review`   | Revisor designado, sem parecer.                     | `assigned`, `revoked`, `approved`, `rejected` |
| `rejected`          | Último parecer do revisor atual é rejeição.         | os mesmos                                     |
| `approved`          | Parecer favorável e hashes iguais aos atuais.       | os mesmos e `issued`                          |
| `stale`             | Parecer favorável, mas dados ou modelo mudaram.     | os mesmos, sem `issued`                       |

Regras de transição:

- Nova designação ou revogação descarta o parecer anterior. O evento antigo fica no histórico.
- Parecer que cita uma designação substituída é ignorado.
- `approved` vira `stale` só pela comparação de hash. Nada é apagado.
- Desde a NOB-177 o hash dos dados inclui o hash dos textos padrão do PGR (`textsSha256`): salvar um texto em `/pgr/{id}/texts` ou regenerar o modelo também leva `approved` a `stale`. Ver `nob-177-layout-e-amostras.md`.
- `issue_cancelled` é aceito em qualquer estado com revisão ativa.

## Quem pode o quê

| Operação                              | Administrador       | Colaborador    | Revisor designado | Elaborador | Representante |
| ------------------------------------- | ------------------- | -------------- | ----------------- | ---------- | ------------- |
| Ver estado, histórico e emissões      | Sim                 | Sim, no escopo | Sim               | Sim        | Não           |
| Ativar revisão obrigatória            | Sim                 | Não            | Não               | Não        | Não           |
| Designar, trocar ou revogar revisor   | Sim                 | Não            | Não               | Não        | Não           |
| Registrar parecer                     | Só se for o revisor | Não            | Sim               | Nunca      | Não           |
| Emissão final (com aprovação vigente) | Sim                 | Sim, no escopo | Sim               | Sim        | Não           |
| Cancelar emissão final                | Sim                 | Não            | Não               | Não        | Não           |
| Prévia                                | Como antes          | Como antes     | Como antes        | Como antes | Como antes    |

Onde cada regra é garantida:

- **Autoaprovação.** Três camadas no banco: `CHECK` elaborador ≠ revisor em toda linha; policy de inserção
  que exige ator = revisor e ator ≠ criador do PGR (`pgr.created_by`); trigger que exige que o parecer cite
  a designação vigente com o mesmo elaborador e revisor. A aplicação repete as regras para dar a mensagem certa.
- **Só o administrador** ativa, designa, revoga e cancela: policy de inserção por tipo de evento.
- **Escopo da NOB-175.** A tabela não tem `company_id`. Ela herda o escopo pelo PGR: a policy
  `pgr_document_approvals_context` só enxerga linhas cujo PGR o membro enxerga. Na designação, o sistema
  confere com as policies reais se o revisor enxerga o PGR. Revisor que perde o escopo deixa de ver e de opinar.
- **Histórico imutável.** O runtime só tem `SELECT` e `INSERT` na tabela.
- **Outro escritório.** RLS por `org_id`, como nas demais tabelas.

O elaborador é quem criou o PGR. Em PGR antigo sem criador registrado, o administrador declara o elaborador
na designação, e o declarado precisa ser membro do escritório com acesso ao PGR.

## Prévia e emissão final

- **Prévia:** `GET/POST /api/v1/pgr/{id}/docx` sem `purpose`. Livre, com o aviso "PRÉVIA PARA CONFERÊNCIA".
- **Emissão final:** `POST /api/v1/pgr/{id}/docx` com `purpose:"issue"`. Já exigia conferência atual e sem
  pendência bloqueante (NOB-105). Com a revisão ativa passa a exigir também estado `approved`, e:
  - o arquivo vai para o GED (`documents`, tipo "PGR — emissão final") pelo mesmo caminho das amostras;
  - o evento `issued` guarda autoria (elaborador da designação), revisão (parecer, revisor, data) e origem
    (hash dos dados, do modelo e do arquivo, snapshot dos dados, quem emitiu);
  - o texto do documento cita o revisor e a data do parecer;
  - o documento do GED não pode ser excluído.
- **Versão nova:** mudança posterior exige novo parecer e nova emissão. A nova emissão aponta a anterior
  como substituída. O administrador pode cancelar uma emissão com motivo. Arquivo e histórico permanecem.
- **PGR sem revisão ativa:** a emissão final segue como antes, só com o download. Nada é arquivado.

## Assinatura

O fluxo de assinatura não mudou. Único efeito: com a revisão ativa, pedir assinatura sem aprovação vigente
responde 422. Sem a revisão ativa, o pedido funciona como hoje.

**Pendente de decisão (DT-04, SEG-07/09):** signatário, modalidade e procedimento da assinatura final não
estão aprovados. Enquanto isso não for decidido com o responsável, a assinatura não é ligada à emissão
arquivada: o pedido de assinatura continua valendo para o PGR, não para um arquivo específico.

## Bloqueios da SEG-13

O que a conferência (`checkPgrReadiness`) faz hoje, comparado com a resposta do questionário:

| Item                                              | Código                       | No sistema | SEG-13                             |
| ------------------------------------------------- | ---------------------------- | ---------- | ---------------------------------- |
| Razão social                                      | `company_name`               | Bloqueia   | Bloqueia                           |
| CNPJ válido                                       | `company_cnpj`               | Bloqueia   | Bloqueia                           |
| Responsável                                       | `responsible`                | Bloqueia   | Bloqueia                           |
| Registro do responsável (quando o tipo exige)     | `registration`               | Bloqueia   | Bloqueia, em conflito com a SEG-08 |
| Datas de vigência                                 | `validity`, `validity_order` | Bloqueia   | Bloqueia                           |
| GES vinculados                                    | `no_ges`                     | Bloqueia   | Bloqueia                           |
| Descrição do processo no GES                      | `process_description`        | Bloqueia   | Bloqueia                           |
| Funções vinculadas ao GES                         | `no_job_roles`               | Bloqueia   | Bloqueia                           |
| Perigo, fontes e lesões do risco                  | `risk_description`           | Bloqueia   | Bloqueia                           |
| Valor, unidade e método da avaliação quantitativa | `measurement_incomplete`     | Bloqueia   | Bloqueia                           |
| Avaliação do risco registrada                     | `assessment_missing`         | Bloqueia   | Só avisa                           |
| Avaliação consistente                             | `assessment_inconsistent`    | Bloqueia   | Só avisa                           |
| Classificação pela metodologia atual              | `classification_changed`     | Bloqueia   | Só avisa                           |
| Medidas e plano de ação                           | `plan_incomplete`            | Bloqueia   | Só avisa                           |
| Ambiente sem risco                                | `no_risks`                   | Avisa      | Só avisa                           |
| Informações de segurança das máquinas             | `machine_safety_missing`     | Avisa      | Só avisa                           |
| Campos do modelo sem preenchimento                | (gerador)                    | Bloqueia   | Não tratado                        |

Quatro itens bloqueiam no sistema e a resposta pede só aviso. Nada foi afrouxado nesta entrega: reduzir a
severidade é decisão do responsável técnico (a NR-01 1.5.7.1 exige inventário e plano de ação).

### Exceções justificadas (DT-08): proposta, nada habilitado

Nenhuma exceção existe no sistema. A proposta abaixo precisa de aprovação do responsável técnico.

| Item                                                              | Pode ter exceção?                                         | Quem justificaria          |
| ----------------------------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| Razão social, CNPJ, responsável, vigência                         | Não                                                       | —                          |
| GES, processo, funções, perigo, fontes e lesões (NR-01 1.5.7.3.2) | Não                                                       | —                          |
| Avaliação ausente ou inconsistente, classificação divergente      | Não                                                       | —                          |
| Valor, unidade e método quantitativo ainda em medição             | Sim, com plano de ação para a medição                     | Responsável técnico do PGR |
| Plano de ação incompleto                                          | A decidir                                                 | Responsável técnico do PGR |
| Registro do responsável quando não há conselho                    | Não é exceção: resolver pela DT-05 (tipo "não se aplica") | —                          |

Auditoria proposta para quando for habilitada: a exceção vira mais um evento em `pgr_document_approvals`
(item, justificativa, autor, data, hashes da versão), entra no hash da versão para exigir novo parecer do
revisor, aparece no documento emitido e não pode ser registrada pelo administrador em nome do responsável.

## O que veio da PR #137

Nada foi copiado por merge ou cherry-pick. O desenho foi lido e reescrito sobre a base atual.

| Trecho da #137                                                 | Decisão                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pgr_document_approvals` (designação e parecer imutáveis)      | Reaproveitado como tabela de eventos, com mais tipos de evento    |
| Elaborador ≠ revisor por `CHECK` e policy                      | Reaproveitado. Parte da regra foi para trigger (ver decisões)     |
| Parecer ligado ao hash dos dados e do modelo                   | Reaproveitado, sem exigir amostra prévia                          |
| Bloqueio de emissão e assinatura por aprovação vigente         | Reaproveitado, separado de qualquer regra comercial               |
| Elaborador declarado quando o PGR não tem criador              | Reaproveitado                                                     |
| `technical_review_required` + trigger em todo PGR novo         | Não trazido. Virou ativação explícita por PGR (evento `required`) |
| Revisor restrito com conta Clerk e funções `SECURITY DEFINER`  | Não trazido. Pendência abaixo                                     |
| `billing_*`, `requirePgrBillingPreview`, marca de demonstração | Não trazido. É da frente comercial                                |
| Severidades da conferência como aviso                          | Não trazido. Ver SEG-13 acima                                     |
| Policies de leitura da 0068                                    | Não trazidas. O escopo vem do PGR pela NOB-175                    |

## Decisões desta entrega

- **Ativação sem volta.** Padrão mais conservador: se o administrador pudesse desligar, bastaria desligar
  depois de uma rejeição. Ativação por engano exige intervenção no banco.
- **Trigger para a sequência dos eventos.** O Postgres recusa policy que consulta a própria tabela
  ("infinite recursion detected in policy"). As regras que dependem dos eventos anteriores foram para uma
  trigger `BEFORE INSERT`, que roda com as permissões de quem insere.
- **Parecer sem amostra.** A #137 exigia uma amostra da NOB-107 para cada parecer. Aqui o parecer se liga
  direto aos hashes da versão. A amostra continua disponível e independente.
- **Uma emissão = um documento novo no GED**, com a ligação de substituição no evento, e não uma nova
  versão do mesmo documento do GED.
- **PGR com histórico de revisão não pode ser excluído** (`ON DELETE RESTRICT`), como já ocorre com amostras.
- **O administrador pode ser o revisor** quando não é o elaborador. A DT-04 recomenda revisor distinto
  também do administrador; isso depende do revisor externo e ficou como pendência.

## Pendências

1. **Signatário, modalidade e procedimento da assinatura final** (DT-04). Sem decisão, a assinatura não é
   ligada ao arquivo emitido.
2. **Revisor externo.** A SEG-23/24 pede revisor de fora do escritório, com acesso próprio e separado da
   administração. Hoje o revisor é um membro do escritório. Escritório de uma pessoa só não consegue usar
   o fluxo. Depende do perfil de profissional externo (pendente também na NOB-175).
3. **Confirmação da DT-04 com o Expedito:** a "aprovação" da SEG-09 é do revisor e a da SEG-07 é ciência
   da empresa. A ciência da empresa não foi implementada.
4. **Lista final de bloqueios e exceções** (DT-08) e as quatro severidades divergentes da SEG-13.
5. **Revisão obrigatória por padrão em PGR novo.** Hoje é sempre ativação manual. Ligar por padrão muda o
   fluxo de assinatura e o Gratuito, e precisa de decisão.
6. **Elaborador = criador do PGR.** Quem edita depois não é registrado como elaborador.
7. **Emissão final sem revisão ativa não é arquivada.** Segue só com download, como antes.
8. **Republicação e trava do PGR.** A emissão final arquivada não altera `published_at` nem a trava de
   edição, que continuam ligadas à assinatura.
9. **Prazo do revisor e notificação** de designação ou rejeição não existem.

## Testes

- Unit: `src/__tests__/unit/domains/pgr/document-approval.test.ts` (máquina de estados, emissões, schemas).
- Integração (Postgres efêmero): `src/__tests__/integration/pdf/pgr-document-approval.test.ts`: designar,
  aprovar, rejeitar, reatribuir, revogar, autoaprovação na aplicação e no banco, parecer de não designado,
  outro escritório, membro fora do escopo, obsolescência por mudança de dado, emissão final bloqueada e
  liberada, substituição e cancelamento, PGR sem a revisão inalterado, assinatura bloqueada só com a
  revisão ativa, Server Actions e REST.
