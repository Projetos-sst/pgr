# Lacunas de requisito e perguntas para o Tech Lead

Cada pergunta foi escrita para destravar implementação: responde-se com uma escolha, não com uma
discussão. Onde há premissa recomendada, ela é a que será usada se não houver objeção.

> **Auditoria específica do Lote 1 (2026-09-16) prevalece** para #33, #42 e #56 — ver fichas em `tasks/`.

## READY

Nenhuma issue — #56 passou a READY COM PREMISSAS na auditoria específica.

## READY COM PREMISSAS

### #56 — GED: controle de versões

Critérios 1 e 2 já atendidos e testados; falta listar/exibir o histórico e aplicar somente leitura no backend.

- Premissa 1: "versão ativa" continua sendo a **maior versão do grupo** até existir aprovação; #54/#62
  redefinem para "maior versão aprovada/publicada" (a definição fica centralizada num único ponto).
- Premissa 2: escrever metadados em versão não vigente é rejeitado no repositório (409); nova versão criada
  a partir de id antigo herda metadados da versão **vigente**.
- Não bloqueante: código de erro (novo 409 vs. reuso) é decidido no PLAN.

### #3 — CNAE

- **Premissa:** espelho local das 1.332 subclasses da API do IBGE (busca por texto não existe na API),
  consulta 100% local como no CAEPI; autofill via CNPJ continua como está.
- Perguntas:
  1. Espelho local (tabela global + script de sync) ou arquivo JSON versionado no repositório?
  2. Guardar o código como hoje (`4712100`) ou formatado (`4712-1/00`)?
  3. Só CNAE principal, ou também CNAEs secundários?

### #39 — NR-09

> Auditado em profundidade em 26/09 — ver [lots/lot-02/AUDIT.md](lots/lot-02/AUDIT.md), que prevalece
> sobre esta seção.

- **Recomendação técnica:** colunas quantitativas na própria `risk_assessments` (método, valor
  medido, unidade reusando o enum `measurement_unit`, LT numérico ao lado do LT textual já existente,
  conclusão), preenchidas só no critério `quantitative`; a seção do PGR mostra a **avaliação
  vigente**.
- **Decidido em 27/09/2026:**
  1. **Q1** → colunas em `risk_assessments`; nada de tabela dedicada.
  2. **Q2** → conclusão **informada/confirmada pelo profissional**; o sistema só sugere, nunca
     sobrescreve nem recalcula em silêncio.
- Resolvidas na auditoria do Lote 2: 3. LT — fica **numérico e textual**: `tolerance_limit_value` novo ao lado do `tolerance_limit` atual
  (nem todo agente tem limite numérico). 4. Laudo — **já funciona**: documento vinculado ao risco (`related_entity_type = "risk"`).

### #47 — PDF do PGR (seção 5)

> Ver [lots/lot-02/AUDIT.md](lots/lot-02/AUDIT.md).

- **Fonte do plano:** `control_measures` (decisão do Lote 1). `action_plans` está descartado como
  fonte do PDF — a ponte #51 fabrica `who`/`why`/`where`.
- **Decidido em 27/09/2026:**
  1. **Q3** → **7 de 7**, com `action_why` e `action_cost` novos em `control_measures`; sem backfill
     fictício e sem obrigatoriedade retroativa.
- Resolvido na auditoria: **preposto = `work_units.manager_name`/`manager_role`** — é o rótulo que o
  próprio formulário de unidade usa ("Gestor/Preposto"); nenhum campo novo.

### #48 — NR-18

- **Premissa:** categorias do 18.4.3 viram tipos sugeridos de documento + checklist de presença na aba
  Documentos do PGR, exibido só quando a unidade é `type = site`; relação de EPIs derivada de
  `epi_risk` → riscos dos GES do PGR.
- Perguntas:
  1. Checklist apenas informativo ou bloqueia assinatura/publicação do PGR quando faltar documento?
  2. Quais campos compõem "especificação técnica" do EPI (CA, validade do CA, fabricante, norma, material)?
  3. A relação de EPIs entra no PDF do PGR ou basta na tela?

### #59 — GED: auditoria e relatórios

- **Premissa:** trilha persistida `document_audit_log` (padrão `epi_catalog_audit_log`) registrando
  criação/edição/versão/movimentação/download/exclusão com `userId` do Clerk; export CSV.
- Perguntas:
  1. Exportar em CSV basta, ou precisa PDF?
  2. Visualização/download entra no log, ou só escritas?
  3. "Revisão obrigatória": usar `valid_until` existente ou criar periodicidade de revisão por documento?
  4. Alerta = notificação in-app (padrão atual) ou exige e-mail (#61)?

### #42 — Plano de ação por nível de risco

Status MANTER/INTRODUZIDA/APRIMORADA e a regra por nível **já existem** em `control_measures` (migration
0031, 9 testes de integração). **Decisões de 2026-09-16 (não reabrir):**

- Plano = plano do PGR em `control_measures`; nenhum `action_plan` ou `control_measure` automático.
- Garantia suave: todo risco aparece na projeção com cobertura derivada (não avaliado / sem medida /
  incompleto / coberto); nada inventado.
- Sem bloqueio de assinatura/publicação do PGR.
- Reclassificação para moderado+ → incompleto até revisão; para baixo → preserva dados humanos.
- PDF fica no Lote 2 com #47. Sem migration.
- Premissa restante: nomes finais da cobertura seguem o vocabulário do domínio/UI.
- Dívida pré-existente registrada (não expandir): a ponte #51 grava `who = "Responsável não definido"` e
  `why` gerado em `action_plans`.

## NEEDS CONTEXT

### #40 — NR-17

> Auditada em profundidade em 27/09 — ver [lots/lot-03/AUDIT.md](lots/lot-03/AUDIT.md), que prevalece
> sobre esta seção.

Perguntas respondidas em 27/09/2026 (não reabrir):

1. **Q1 = tabela dedicada** `ergonomic_evaluations`, 1:N por risco.
2. **Q2 = enum de adequação + observação** por dimensão (`NULL` ≠ `not_applicable`).
3. **Q3 = referência agregada opcional** a campanha psicossocial fechada; o sistema **nunca**
   calcula escore COPSOQ.

Resolvidas na auditoria do Lote 3:

4. **AET** = laudo **anexado** pelo GED (já suporta vínculo com risco e versionamento); não vira
   formulário.
5. **Granularidade** = por **risco** (critério de aceite da issue), não por GES.
6. **COPSOQ não está implementado**: o módulo psicossocial tem questionário genérico Likert e uma
   derivação por limiar do próprio projeto — o sistema **não** calculará escore normativo.
7. **Conclusão global**: a issue não pede; não será inventada.

### #48 — NR-18

> Ver [lots/lot-03/AUDIT.md](lots/lot-03/AUDIT.md).

Pergunta respondida em 27/09/2026:

1. **Q4 = seção do PDF** — a relação de EPIs derivada aparece na tela do PGR **e** no documento.

Resolvidas na auditoria do Lote 3: **sem migration** (tipos como lista fechada no domínio, relação
derivada do cadastro); checklist **informativo**, não bloqueante; exibido para unidade `site`;
autoria/ART por documento fora de escopo.

## NEEDS PRODUCT DECISION

### #52 — GED: elaboração

1. Tipos do GED (política, procedimento, instrução, registro/formulário) substituem `doc_type` livre ou
   convivem com ele?
2. Código do documento (ex.: `PO-SST-001`) gerado pelo sistema ou digitado?
3. "Setor" é GES, o texto `job_roles.sector`, ou um cadastro novo de setores?
4. Documentos já existentes (anexos do PGR, PDFs arquivados) entram no workflow ou ficam fora dele?

### #57 — GED: descarte

1. Após aprovação: apagar o arquivo do Storage ou só marcar como descartado (título diz "com flag",
   critério diz "exclusão efetiva")?
2. Retenção fixa (5 anos) ou por tipo? O sistema bloqueia descarte antes do prazo?
3. O `DELETE` atual (hard delete) continua existindo para quem?

### #58 — GED: perfis e permissões

1. Um usuário pode ter vários papéis e vários setores?
2. `owner` do tenant é Administrador do GED automaticamente?
3. O papel `client` (cliente do escritório) pode ser Leitor?
4. Papéis GED valem para todo documento ou só para os que entram no workflow (#52)?

### #60 — Active Directory e backup

1. O cliente usa AD de fato? Se sim, aceitam SSO via Clerk (SAML, recurso de plano pago) em vez de
   integração direta com AD?
2. Os backups gerenciados do Supabase (banco) atendem, ou precisa de rotina própria cobrindo o Storage?
3. Se nenhum dos dois for necessário agora, podemos registrar a decisão "não fazer" e fechar?

### #61 — E-mail

1. Aprovam provedor externo pago (ex.: Resend) com emenda ao Princípio II da constituição?
2. "Administrador de TI" é um e-mail configurado por tenant?
3. Quais eventos de permissão disparam e-mail (concessão, revogação, troca de setor)?

## RESOLVIDA — VALIDAR E FECHAR

### #33 — EPI: assinatura/QR

Os 3 critérios de aceite são atendidos pelo fluxo próprio do EPI, com testes de integração. **Decisão de
2026-09-16:** não migrar para a infra genérica (cota de 10 assinaturas/mês do plano free, assinaturas
históricas sem os dados exigidos, links de 72h em circulação, risco sem requisito). Ação: evidência →
comentário → fechar. `signed_at` próprio, se desejado, é melhoria separada.

## NEEDS EXTERNAL INFO

### #10 — CBO

Não há API; a fonte oficial é o download de arquivos no portal do MTE.

1. Qual arquivo oficial usamos (CBO 2002 — tabela de ocupações, 6 dígitos)? Alguém do time já tem o
   arquivo validado?
2. Buscar só ocupação (6 dígitos) ou também família (4 dígitos)?
3. O campo passa a validar o formato `0000-00` ou continua aceitando texto livre?

## BLOCKED

| Issue | Bloqueada por | Pergunta que ainda sobra quando desbloquear                                                                                                                                 |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #47   | #39, #40      | "Preposto" = `work_units.managerName/managerRole` (rótulo "Gestor/Preposto")? Fonte do plano 5W2H depende da **decisão 1 de #42** (medidas de controle vs. `action_plans`). |
| #53   | #52, #58      | Revisão pode reprovar e devolver ao autor, ou só comentar?                                                                                                                  |
| #54   | #53, #58      | Aprovação com assinatura por QR/link (infra 010) ou aceite autenticado in-app? Mapeamento tipo→aprovador é fixo?                                                            |
| #55   | #54, #58      | Leitor vê só a versão publicada vigente? Log de cada visualização ou só download?                                                                                           |
| #62   | #52–#57       | "Documento sem versão ativa" — em que situação isso ocorre após descarte da versão vigente?                                                                                 |

**#47 é desbloqueável em parte:** seções 1 (identificação com preposto), 2 (inventário com dados
quantitativos) e 5 (plano 5W2H) não dependem de NR-09/NR-17 e entram no Lote 2.
