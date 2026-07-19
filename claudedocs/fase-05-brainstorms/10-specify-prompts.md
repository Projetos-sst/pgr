# Fase 05 — Prompts de `/speckit-specify` prontos (um por fatia)

Prompts finais para iniciar cada fatia da Fase 05, na ordem de ataque sugerida.
Cada prompt combina o template da issue com as decisões dos brainstorms
(`claudedocs/fase-05-brainstorms/0*.md`).

**Padrões de prompt aplicados em todos:**

- **Contexto + leituras obrigatórias primeiro** — o spec nasce do estado real do repo,
  não da memória do modelo; o agente lista os arquivos que vai ler antes de escrever.
- **User stories priorizadas (P1/P2)** — P1 é o corte mínimo entregável da fatia.
- **Success criteria mensuráveis e tecnologia-agnósticos** — verificáveis por teste,
  sem citar solução.
- **Decisões já tomadas como restrições** — o brainstorm resolveu ambiguidades; o spec
  não deve reabri-las.
- **Questões abertas nomeadas** — o que sobrou de ambíguo vai explícito para o
  `/speckit-clarify`, em vez de ser inventado.
- **Fora de escopo explícito** — fronteiras com as issues vizinhas para conter creep.
- **"NÃO invente solução técnica"** — o specify captura o "o quê/porquê"; o "como" é do plan.

> Nota: **#36 (Deploy Gotenberg) não tem prompt** — é infra pura sem código de aplicação;
> não passa pelo Spec Kit (ver `02-issue-36-deploy-gotenberg.md`, runbook + validação e2e).

---

## 1 · Issue #33 — Modelo de dados (Documentos, Pastas e Jobs)

```
/speckit-specify

GIT_BRANCH_NAME: feature/documents-data-model

Feature: Documents, folders and jobs data model

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #33. Fatia de MODELAGEM PURA
(schema + migration + RLS + testes), análoga às fatias 006/008 — sem UI, sem CRUD.
ATENÇÃO: o corpo da issue #33 está desatualizado (era "Modelo A"); o padrão vigente é
o Modelo B. Antes de escrever a spec, leia e liste: claudedocs/fase-05-brainstorms/
01-issue-33-modelo-de-dados.md, src/shared/db/schema/companies.ts (template de
RLS/pgPolicy), .specs/006-cadastros-base-pgr/, .specs/008-epi-data-model/,
docs/architecture/02-modelagem-de-dados.md e a última migration em drizzle/ (numeração).

User stories (P1 = mais crítica):
- (P1) Como plataforma, preciso do modelo de documentos com pastas hierárquicas e
  metadados de validade, isolado por tenant, para suportar o GED (#34) e o download (#35).
- (P1) Como plataforma, preciso de uma fila leve de jobs para operações assíncronas
  (geração de PDF em lote, #39), com retry e claim concorrente seguro.
- (P2) Como plataforma, preciso vincular documentos a outras entidades (PGR, OS) sem
  acoplamento rígido de schema.

Success criteria mensuráveis (tecnologia-agnósticos):
- As 3 tabelas existem via migration, com isolamento por tenant testado (dados de um
  escritório nunca aparecem para outro).
- Pastas suportam hierarquia com raiz; nome duplicado na mesma pasta do mesmo tenant
  é rejeitado.
- Um job pendente reivindicado por dois processadores simultâneos é processado uma
  única vez (modelo suporta claim atômico).
- O status de validade de um documento (válido / a vencer / vencido) é derivável dos
  dados, sem coluna materializada que exija atualização periódica.

Decisões já tomadas (não reabrir — tratar como restrições):
- Status de VALIDADE é derivado na leitura (padrão classifyTrainingStatus da fatia 017);
  a coluna `status`, se existir, é de CICLO DE VIDA (ex.: generating|ready) para o #38.
- Vínculo polimórfico leve (related_entity_type + related_entity_id) SEM FK, com índice
  composto e conjunto fechado de tipos permitidos.
- `jobs` prevê `attempts` e recuperação de claim travado (job preso volta à fila);
  o processador de jobs atravessa tenants — o modelo deve permitir leitura
  administrativa da fila com escrita sempre escopada ao tenant do job.
- Árvore de pastas simples (sem closure table); prevenção de ciclo é invariante de
  aplicação, documentada.
- Tamanho de arquivo em bytes com suporte a arquivos grandes.

Questões abertas (resolver via /speckit-clarify, NÃO inventar):
- Versionamento de documento: 1 linha por versão (agrupadas) OU linha mutável +
  tabela de versões? (decisão de modelagem mais importante da fase — o #34 depende dela)
- Tipo de documento: enum fechado ou texto livre (paridade ePGR)?
- ON DELETE de pasta com filhos: restrito (resolver na aplicação) ou cascata?

Edge cases a considerar:
- Pasta raiz (pai nulo) e unicidade de nome na raiz.
- Job reivindicado em concorrência; job cujo processador morreu no meio.
- Documento sem validade definida.

Restrições obrigatórias (constituição / Modelo B):
- org_id NOT NULL → orgs.id + RLS app_runtime em todas as tabelas (template companies.ts);
  tenant nunca vem do cliente.
- Testes de isolamento em Postgres efêmero (INTEGRATION_*), nunca SQLite.
- Zero UI nesta fatia.

Fora de escopo: CRUD/telas (#34), download (#35), geração de PDF (#37/#38/#39),
form_controls (#88).

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 2 · Issue #88 — CRUD de Controle de Formulário (ISO)

```
/speckit-specify

GIT_BRANCH_NAME: feature/form-control-crud

Feature: Form control (ISO header) CRUD

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #88 — já escrita no Modelo B.
Cria o modelo `form_controls` (migration própria) e o CRUD completo com as 5 operações,
com preview do cabeçalho ISO em tempo real. Referência canônica de implementação:
companies (a fatia mais "receita de bolo" da fase). Antes de escrever a spec, leia e
liste: claudedocs/fase-05-brainstorms/09-issue-88-form-controls.md, a issue #88,
.specs/006-cadastros-base-pgr/, .specs/005-modelo-tenant-gate-pro/ e
docs/api/api-design.md (padrão das 4 superfícies).

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero cadastrar/editar/listar/detalhar/excluir o controle de
  cabeçalho ISO (Tipo, Empresa, FRM, REV, Data, N.C., GES/Setor, Posicionamento,
  Observação) por tipo de documento.
- (P2) Como gestor de SST, quero um preview em tempo real do cabeçalho, idêntico ao que
  será impresso, antes de salvar.

Success criteria mensuráveis (tecnologia-agnósticos):
- As 5 operações (list, getById, create, update, delete) entregues nas 4 superfícies
  (ação interna + API REST espelho + docs de API + coleção Postman).
- Código FRM duplicado no mesmo escritório é rejeitado (conflito); o mesmo código em
  escritórios distintos é aceito.
- Configuração de outro escritório retorna não-encontrado e nunca aparece em listagens.
- O preview reflete exatamente os valores preenchidos, em tempo real.

Decisões já tomadas (restrições):
- Posicionamento é um conjunto fechado: topo | rodapé | ambos.
- O componente de preview DEVE ser o mesmo markup que será injetado no cabeçalho dos
  PDFs (#37/#40) — extraído como componente compartilhado, para o preview nunca mentir.
- A INJEÇÃO dos metadados no PDF é fronteira desta fatia (vive no cliente/template,
  issues #37/#40).

Questões abertas (resolver via /speckit-clarify):
- Além de UNIQUE por código FRM, deve haver unicidade por tipo de formulário no tenant?
  (se dois controles do mesmo tipo forem permitidos, o consumidor #40 precisa de regra
  de escolha)
- GES/Setor responsável: referência real a GES ou texto livre? (sugerido: texto livre no MVP)

Edge cases:
- Organização sem nenhum controle cadastrado (estado vazio).
- Múltiplos tipos de formulário com configurações distintas.
- Campos obrigatórios ausentes (Tipo, FRM, REV, Data, Posicionamento) → rejeitado.
- Controle de outra organização (não-encontrado em getById/update/delete).

Restrições obrigatórias (constituição / Modelo B):
- Tenant ativo via requireTenantContext() + withOrg(); nunca Clerk org nem input do cliente.
- Validação zod em toda Server Action; isolamento testado em Postgres efêmero.

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 3 · Issue #37 — Cliente de geração de PDF (Gotenberg)

```
/speckit-specify

GIT_BRANCH_NAME: feature/pdf-generation-client

Feature: PDF generation client (Gotenberg integration)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #37. Cria a camada server-only que
converte HTML em PDF via serviço Gotenberg (já no ar, #36) e grava o resultado em
storage de arquivos particionado por organização. ATENÇÃO: primeira fatia que usa o
Supabase Storage no projeto (hoje o repo só fala com o Supabase via Postgres) — bucket
privado, credencial server-only e novas variáveis de ambiente fazem parte da entrega.
Antes de escrever a spec, leia e liste: claudedocs/fase-05-brainstorms/
03-issue-37-cliente-pdf.md, docs/architecture/04-integracoes-e-servicos.md, o padrão
de erro de domínio em src/shared/server/ (precedente AI_UNAVAILABLE da fatia 016) e o
padrão de mock de serviço externo dos testes da 016.

User stories (P1 = mais crítica):
- (P1) Como sistema, preciso converter o HTML de um documento em PDF e armazená-lo com
  segurança, para as fatias de geração (#38/#39) e o template do PGR (#40).

Success criteria mensuráveis (tecnologia-agnósticos):
- Dado um HTML válido, um PDF correspondente fica armazenado no espaço da organização
  ativa e disponível para as demais fatias.
- Indisponibilidade do serviço de conversão resulta em erro de domínio tratado e
  reportado — nunca em falha silenciosa nem exceção crua ao usuário.
- Nenhum PDF é gravado fora da partição da organização que o solicitou.
- A lógica é testável sem o serviço real (conversão e armazenamento mockáveis).

Decisões já tomadas (restrições):
- Três responsabilidades separadas e testáveis: renderizar template em HTML; converter
  HTML em PDF; armazenar o binário no path do tenant.
- O path de armazenamento é SEMPRE derivado do tenant da sessão no servidor — nunca do cliente.
- Timeout explícito na conversão + 1 retry para falha de rede; erro final vira código
  de domínio no padrão da casa (precedente AI_UNAVAILABLE/502).
- O contrato do cliente já prevê fragmentos de cabeçalho/rodapé repetidos por página
  (consumidos pelo #40 com os metadados do #88).
- HTML enviado deve ser autossuficiente: imagens embutidas (sem depender de URLs externas).

Questões abertas (resolver via /speckit-clarify):
- Nome do bucket e convenção de path (ex.: <org>/documentos/...).
- Novo código de erro dedicado (PDF_UNAVAILABLE) ou reuso do existente?

Edge cases:
- Serviço de PDF indisponível / timeout.
- Documento sem dados suficientes para o template.
- Falha no armazenamento após conversão bem-sucedida.

Restrições obrigatórias (constituição):
- Storage particionado por organização; credenciais server-only, nunca no cliente.
- Testes com o serviço externo mockado; integração em Postgres efêmero quando houver banco.

Fora de escopo: disparo pelo usuário (#38), lote/fila (#39), template do PGR (#40),
telas de GED (#34).

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 4 · Issue #34 — CRUD de Documentos (GED)

```
/speckit-specify

GIT_BRANCH_NAME: feature/document-crud

Feature: Document (GED) CRUD

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #34 — já escrita no Modelo B, com o
modelo de dados pronto (#33). Esta fatia é UI + Server Actions + API do GED completo:
listagem com KPIs e navegação por pastas, upload, versionamento, mover e excluir, mais
criar/renomear pasta. Antes de escrever a spec, leia e liste:
claudedocs/fase-05-brainstorms/04-issue-34-crud-ged.md, a issue #34 (tabela de
operações), o spec/migration resultante do #33, .specs/006-*, .specs/005-*,
.specs/004-epgr-feature-parity/06-qualidade-ged-esocial.md (seção GED) e
docs/api/api-design.md.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero anexar, listar, detalhar e organizar documentos em
  pastas no GED.
- (P1) Como gestor de SST, quero versionar documentos preservando o histórico de revisões.
- (P2) Como gestor de SST, quero KPIs do acervo e alertas de vencidos / a vencer em 30 dias.

Success criteria mensuráveis (tecnologia-agnósticos):
- As 5 operações de documento (list, getById, create/upload, update/nova-versão/move,
  delete) + criar/renomear pasta, entregues nas 4 superfícies (ação interna + API REST
  espelho + docs de API + Postman).
- Documento/pasta de outro escritório retorna não-encontrado e nunca aparece em listagem.
- Upload acima do limite ou de tipo não permitido é rejeitado com erro claro; nada
  parcial fica gravado visível.
- Nova versão preserva o histórico; KPIs refletem o acervo em tempo real.
- Excluir documento remove também o arquivo armazenado.

Decisões já tomadas (restrições):
- Upload pelo fluxo padrão de formulário com limite configurado (~10–25MB) e validação
  de tipo/tamanho antes de gravar; upload direto ao storage fica registrado como
  evolução futura, fora do MVP.
- Ordem de escrita: binário primeiro, registro depois; falha no registro remove o
  binário (melhor esforço, com log) — janela de órfãos aceita e documentada no MVP.
- KPIs e status de validade usam o classificador derivado definido no #33 (sem coluna
  materializada), com datas no fuso America/Sao_Paulo.
- Navegação por pastas com breadcrumb; identificador de pasta inválido ou de outro
  tenant é tratado como raiz/não-encontrado — nunca vaza.
- A UI nasce no design system da fatia 019 (primitives _ui).

Questões abertas (resolver via /speckit-clarify):
- Exclusão de pasta ficou fora do escopo da issue — confirmar se é intencional e como a
  UI evita pastas inutilizáveis.
- Lista de tipos de arquivo permitidos e limite exato de tamanho.

Edge cases:
- Organização sem documentos/pastas; pasta vazia; documento sem validade.
- Falha de upload no meio; dois uploads simultâneos na mesma pasta com o mesmo nome.
- Documento/pasta de outra organização (não-encontrado em getById/update/delete).
- Mover documento para pasta de outro tenant (rejeitado).

Restrições obrigatórias (constituição / Modelo B):
- Tenant ativo via requireTenantContext() + withOrg(); nunca Clerk org nem input do cliente.
- Storage particionado pelo tenant; validação zod em toda Server Action; isolamento
  testado em Postgres efêmero.

Fora de escopo: download via URL assinada (#35), geração de PDF (#37/#38/#39),
template PGR (#40), cabeçalho ISO (#88); `jobs` é infra sem CRUD de usuário.

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 5 · Issue #35 — Download via URL assinada

```
/speckit-specify

GIT_BRANCH_NAME: feature/document-download

Feature: Document download via signed URL

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #35. ATENÇÃO: o corpo da issue está
desatualizado (era "Modelo A"). Fatia pequena que cola no GED (#34): baixar um
documento com segurança via link temporário gerado no servidor. Antes de escrever a
spec, leia e liste: claudedocs/fase-05-brainstorms/05-issue-35-download-assinado.md,
o helper de storage criado no #37, o CRUD do #34 e
.specs/004-epgr-feature-parity/06-qualidade-ged-esocial.md (download seguro).

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero baixar um documento do GED com segurança, a partir da
  listagem e do detalhe.

Success criteria mensuráveis (tecnologia-agnósticos):
- O download só é possível para usuários da organização dona do documento; tentativa
  cross-tenant resulta em não-encontrado.
- O link de download expira em janela curta (60–300s) e os buckets permanecem privados.
- O usuário nunca informa o caminho do arquivo — apenas o identificador do documento.

Decisões já tomadas (restrições):
- A verificação de tenant acontece ANTES de assinar: o caminho do arquivo vem do
  registro do banco (já filtrado por isolamento), nunca do cliente. Esta é a propriedade
  de segurança central da fatia.
- Nada é persistido: o link é descartável.
- Trade-off aceito e registrado: link assinado é portador (quem o tiver baixa dentro da
  janela); a expiração curta mitiga.
- Superfícies: ação para a UI + endpoint GET navegável na API espelho (mesmo core).

Edge cases:
- Documento de outra organização (não-encontrado).
- Link expirado (acesso negado pelo storage).
- Registro no banco sem arquivo correspondente no storage (órfão) → erro tratado,
  nunca falha crua.

Restrições obrigatórias (constituição):
- Storage particionado/autorizado por organização; verificação de tenant antes de
  liberar o arquivo.
- Assinatura mockada nos testes (não bater no storage real no CI).

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 6 · Issue #38 — PDF de documento único

```
/speckit-specify

GIT_BRANCH_NAME: feature/single-document-pdf

Feature: Single document PDF generation

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #38. ATENÇÃO: o corpo da issue está
desatualizado (era "Modelo A"). Gerar o PDF de um documento sob demanda sem bloquear o
usuário, usando o cliente de PDF (#37). O problema central da fatia é o FEEDBACK
(a resposta volta antes do PDF existir), não a conversão. Antes de escrever a spec,
leia e liste: claudedocs/fase-05-brainstorms/06-issue-38-pdf-unico.md, o cliente do
#37, a decisão de status de ciclo de vida do #33 e o padrão de polling da fatia 010
(assinaturas).

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero gerar o PDF de um documento sem travar a tela e ser
  avisado quando ficar pronto.

Success criteria mensuráveis (tecnologia-agnósticos):
- A resposta ao pedido é imediata (não espera a geração concluir).
- O usuário vê o documento passar por "gerando" → "pronto" (ou "falhou") sem recarregar
  manualmente a página.
- PDF pronto fica disponível para download pelo fluxo do #35.
- Falha de geração é comunicada e permite nova tentativa manual.

Decisões já tomadas (restrições):
- Feedback por acompanhamento de status (padrão de polling já usado na fatia 010) sobre
  um ciclo de vida gerando|pronto|falhou; NÃO usar a fila de jobs para documento único
  (a fila é do #39) e NÃO esperar de forma síncrona (Princípio IV).
- O documento gerado entra no acervo do GED com status de ciclo de vida — unificando
  com #34/#35 (decisão de modelo tomada no #33).
- O contexto do tenant é capturado antes do trabalho pós-resposta e propagado
  explicitamente (não há request context garantido depois da resposta).
- Sem retry automático nesta fatia (retry é papel do #39).

Questões abertas (resolver via /speckit-clarify):
- Quais documentos podem ser gerados nesta fatia (quais templates existem no momento)?
- Duas gerações simultâneas do mesmo documento: bloquear a segunda ou substituir?

Edge cases:
- Serviço de PDF indisponível (documento fica "falhou", não "gerando" para sempre).
- Documento sem dados suficientes para o template.
- Usuário dispara a geração e sai da tela (o resultado persiste).

Restrições obrigatórias (constituição):
- A resposta ao usuário não bloqueia esperando a geração (Princípio IV).
- Toda escrita escopada ao tenant capturado; testes com o conversor mockado, em
  Postgres efêmero.

Fora de escopo: geração em lote e retry automático (#39); template do PGR (#40).

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 7 · Issue #39 — PDF em lote (jobs + Vercel Cron)

```
/speckit-specify

GIT_BRANCH_NAME: feature/batch-pdf-generation

Feature: Batch PDF generation (jobs + Vercel Cron)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #39. ATENÇÃO: o corpo da issue está
desatualizado (era "Modelo A"). A fatia operacionalmente mais arriscada da fase:
enfileirar gerações em lote na tabela `jobs` (#33) e processá-las por um agendador,
sem bloquear o usuário. Duas armadilhas conhecidas: (1) o endpoint do agendador não tem
sessão/tenant e precisa ser liberado no proxy de autenticação; (2) o processador
atravessa tenants — a leitura da fila é administrativa, mas TODA escrita é escopada ao
tenant de cada job. Antes de escrever a spec, leia e liste:
claudedocs/fase-05-brainstorms/07-issue-39-pdf-lote.md, o modelo `jobs` do #33, o
cliente do #37, src/proxy.ts (precedente /sign da fatia 012), o precedente de leitura
administrativa (repositories/caepi-upsert.ts) e o precedente de lock transacional
(stock-movements).

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero gerar vários PDFs de uma vez sem travar o sistema.
- (P2) Como gestor de SST, quero acompanhar o progresso do lote (x de y concluídos).

Success criteria mensuráveis (tecnologia-agnósticos):
- O pedido em lote responde imediatamente e cria um job por item.
- Jobs pendentes são processados pelo agendador; concluídos têm PDF salvo e status
  atualizado; nenhum job é processado duas vezes mesmo com execuções sobrepostas.
- Job com falha registra o erro, tenta novamente até um limite e então falha
  definitivamente; job cujo processador morreu volta à fila.
- O endpoint do agendador rejeita chamadas sem o segredo.
- PDFs de uma organização nunca são gravados na partição de outra.

Decisões já tomadas (restrições):
- Reivindicação atômica de jobs com proteção contra execução dupla (precedente de lock
  do repo) e recuperação de claim travado por tempo.
- Processamento em porções por execução (respeitando o limite de tempo da plataforma);
  o restante fica para a próxima execução.
- Limite de tentativas (padrão 3) antes da falha definitiva, com o erro registrado.
- Progresso por agrupamento de lote + acompanhamento por polling (padrão da fatia 010).
- Endpoint do agendador protegido por segredo e liberado no proxy de autenticação.

Questões abertas (resolver via /speckit-clarify):
- RISCO DE VIABILIDADE Nº 1: o plano da conta na plataforma de deploy limita a
  frequência do agendador (plano hobby = execução diária). Confirmar plano/frequência
  antes de fechar a spec; se limitado, definir a alternativa (disparo manual +
  agendador externo).
- Quais documentos compõem um lote no MVP (ex.: fichas de EPI de todos os funcionários?).

Edge cases:
- Lote grande (mais jobs do que uma execução processa).
- Serviço de PDF fora do ar durante o processamento (falha + retry).
- Execuções do agendador sobrepostas.
- Reprocessamento manual de jobs falhados.

Restrições obrigatórias (constituição):
- Operação pesada nunca roda de forma síncrona na requisição (Princípio IV).
- Leitura administrativa da fila documentada como exceção; escrita sempre no tenant do
  job. Testes de isolamento em Postgres efêmero; agendador testado com e sem o segredo.

Fora de escopo: geração de documento único (#38); template do PGR (#40).

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 8 · Issue #40 — Template PDF do PGR

```
/speckit-specify

GIT_BRANCH_NAME: feature/pgr-pdf-template

Feature: PGR PDF template

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Fatia própria (1 issue = 1 branch = 1 spec), issue #40. Primeiro template real de
documento: o PDF do PGR (capa, sumário, GES, inventário de riscos, plano de ação,
hierarquia de controles, cabeçalho ISO), definindo o padrão visual dos próximos
templates. A issue mais "design" da fase — conter escopo com YAGNI. Antes de escrever
a spec, VERIFIQUE se a "visão consolidada do PGR" da Fase 03 foi entregue e em que
formato; leia e liste: claudedocs/fase-05-brainstorms/08-issue-40-template-pgr.md,
.specs/004-epgr-feature-parity/02-riscos-e-pgr.md (seção 4 — estrutura do documento),
o cliente do #37 (contrato de cabeçalho/rodapé) e o componente de cabeçalho do #88.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero o PDF do PGR com capa customizada, sumário e todas as
  seções para arquivar e apresentar o documento.
- (P2) Como gestor de SST, quero o cabeçalho de controle de formulário (FRM/REV/data)
  aplicado conforme a configuração (#88).

Success criteria mensuráveis (tecnologia-agnósticos):
- O PDF contém todos os riscos, avaliações, plano de ação e hierarquia de controles do
  PGR, sem duplicar a lógica de leitura de dados existente.
- Capa exibe cor customizável e logo da empresa quando houver — e permanece adequada
  sem logo.
- Sumário reflete as seções configuradas (incluídas/excluídas).
- Documento legível e adequado para impressão A4, com seções sem quebras no meio de
  blocos e cabeçalhos de tabela repetidos em tabelas longas.

Decisões já tomadas (restrições):
- Reusar a leitura consolidada do PGR; se não existir agregador único, criá-lo no
  repositório reusando as consultas existentes — nunca duplicar regra.
- Sumário SEM número de página no MVP (numeração exata só pós-render; registrado como
  limitação).
- Cabeçalho ISO entra como fragmento repetido por página via contrato do cliente #37;
  o markup é o MESMO componente do preview do #88 (posicionamento topo/rodapé/ambos).
- Logo embutido no HTML (autossuficiente), conforme decisão de assets do #37.
- Validação do resultado: testes de renderização do HTML com fixtures + verificação
  visual manual do PDF (sem pixel-diff no MVP).

Questões abertas (resolver via /speckit-clarify):
- Configuração do documento (cor da capa, seções do sumário): persistida por
  empresa/PGR ou informada a cada geração? (decisão de produto)
- Qual configuração de controle ISO usar quando houver mais de uma aplicável (depende
  da resposta de unicidade do #88)?

Edge cases:
- PGR sem riscos; GES sem funções vinculadas.
- Documento muito extenso (memória do serviço de conversão — alinhar com o
  dimensionamento do #36).
- Empresa sem logo cadastrado (caso comum: upload de logo ainda não existe).

Restrições obrigatórias (constituição):
- Reusar a leitura de dados do PGR, sem duplicar lógica.
- Toda leitura escopada ao tenant; testes em Postgres efêmero; conversor mockado nos
  testes automatizados.

Fora de escopo: disparo da geração (#38/#39), CRUD do controle ISO (#88), novos
templates além do PGR.

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
