# Lacunas de requisito e perguntas para o Tech Lead

Cada pergunta foi escrita para destravar implementação: responde-se com uma escolha, não com uma
discussão. Onde há premissa recomendada, ela é a que será usada se não houver objeção.

## READY

### #56 — GED: controle de versões

Critérios de aceite claros e metade já atendida no modelo. Sem perguntas bloqueantes.

- Premissa registrada: o gate "só vira ativa após aprovação" pertence a #54/#62, não a esta issue.

## READY COM PREMISSAS

### #42 — Plano de ação por nível de risco (parte restante)

- **Premissa:** "todo risco tem entrada no plano" será atendido por **indicador derivado** (riscos do
  inventário sem plano de ação) + ação "Criar plano" com `origin_type = risk` — sem gerar registro
  automático, porque `action_plans` exige `what/why/who/where/how` NOT NULL e isso obrigaria texto fictício.
- Perguntas:
  1. Indicador + botão "Criar plano" atende, ou vocês exigem geração automática de uma entrada por risco?
  2. Risco com medida de controle aplicável já ligada a um plano (ponte `control_measure`) conta como coberto?
  3. Risco **nunca avaliado** entra no indicador de "sem plano"?

### #3 — CNAE

- **Premissa:** espelho local das 1.332 subclasses da API do IBGE (busca por texto não existe na API),
  consulta 100% local como no CAEPI; autofill via CNPJ continua como está.
- Perguntas:
  1. Espelho local (tabela global + script de sync) ou arquivo JSON versionado no repositório?
  2. Guardar o código como hoje (`4712100`) ou formatado (`4712-1/00`)?
  3. Só CNAE principal, ou também CNAEs secundários?

### #39 — NR-09

- **Premissa:** avaliação quantitativa ligada a cada **avaliação** (`risk_assessments`), com método,
  valor medido, unidade (enum `measurementUnit` existente), LT numérico e conclusão calculada.
- Perguntas:
  1. Um risco pode ter várias medições (histórico) ou uma avaliação NR-09 vigente?
  2. Conclusão (acima/abaixo do LT) calculada pelo sistema ou informada pelo técnico?
  3. LT sempre numérico (NR-15) ou também texto para agentes qualitativos?
  4. Precisa anexar o laudo/relatório de medição (reusar anexos de documento do risco)?

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

## NEEDS CONTEXT

### #40 — NR-17

Falta o modelo da avaliação. A issue lista dimensões, não campos.

1. AEP é checklist (sim/não), escala (1–5) ou texto por dimensão (postura, movimentos, carga física,
   carga mental, organização do trabalho, ambiente físico)?
2. AET completa é formulário no sistema ou documento anexado (laudo)?
3. COPSOQ: aplicar o questionário pelas campanhas psicossociais existentes, ou só registrar o resultado
   agregado por dimensão? Há licença/versão brasileira definida?
4. Avaliação ergonômica fica por risco (agente `ergonomic`) ou por GES/posto?

## NEEDS PRODUCT DECISION

### #33 — EPI: assinatura/QR — POSSIVELMENTE JÁ RESOLVIDA

Os dois critérios de aceite já são atendidos pelo fluxo próprio do EPI (link/QR/manual, status com data
na entrega e coluna "Assinatura" na Ficha de EPI, testes de integração cobrindo token, expiração e
cross-tenant).

1. Fechamos a #33 como resolvida?
2. Ou vocês querem a unificação com a infra genérica (guarda imagem da assinatura, `signed_at` real,
   aparece em `/signatures`) — sabendo que é migração de dados com tokens já distribuídos?

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

## NEEDS EXTERNAL INFO

### #10 — CBO

Não há API; a fonte oficial é o download de arquivos no portal do MTE.

1. Qual arquivo oficial usamos (CBO 2002 — tabela de ocupações, 6 dígitos)? Alguém do time já tem o
   arquivo validado?
2. Buscar só ocupação (6 dígitos) ou também família (4 dígitos)?
3. O campo passa a validar o formato `0000-00` ou continua aceitando texto livre?

## BLOCKED

| Issue | Bloqueada por | Pergunta que ainda sobra quando desbloquear                                                                                                                     |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #47   | #39, #40      | "Preposto" = `work_units.managerName/managerRole` (rótulo "Gestor/Preposto")? Plano 5W2H lido de `action_plans` (tem os 7 campos) em vez de `control_measures`? |
| #53   | #52, #58      | Revisão pode reprovar e devolver ao autor, ou só comentar?                                                                                                      |
| #54   | #53, #58      | Aprovação com assinatura por QR/link (infra 010) ou aceite autenticado in-app? Mapeamento tipo→aprovador é fixo?                                                |
| #55   | #54, #58      | Leitor vê só a versão publicada vigente? Log de cada visualização ou só download?                                                                               |
| #62   | #52–#57       | "Documento sem versão ativa" — em que situação isso ocorre após descarte da versão vigente?                                                                     |

**#47 é desbloqueável em parte:** seções 1 (identificação com preposto), 2 (inventário com dados
quantitativos) e 5 (plano 5W2H) não dependem de NR-09/NR-17 e entram no Lote 2.
