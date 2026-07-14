# Briefing — Emenda da constituição: serviço auxiliar de PDF (Gotenberg) · Fase 3, issue #08

> Documento de **análise/reflexão** (não é a emenda em si). Objetivo: entender a task, mapear
> requisitos e a lógica sobre a constituição **real** do repo, sinalizar onde o enunciado da issue
> diverge (paths/versão), e deixar o caminho de execução pronto — antes de rodar
> `/speckit-constitution`. Idioma: PT-BR (docs); identificadores em inglês.

---

## 1. O que a task é (em uma frase)

Registrar, **via emenda formal à constituição**, a autorização do **Gotenberg** (serviço auxiliar de
geração de PDF, fora da Vercel) como infraestrutura permitida — porque o **Princípio II** ("Stack Fixa e
Simplicidade") exige emenda **antes** de introduzir qualquer infra nova, e o Gotenberg é **pré-requisito
de governança da Fase 5** (Documentos + PDF). Não é código: é um passo de **governança**.

---

## 2. Natureza da task: governança, não feature

Esta issue **não** tem modelo de dados, Server Action, REST, UI nem testes. O único artefato entregável é
o arquivo [.specify/memory/constitution.md](../../.specify/memory/constitution.md) editado (+ o Sync
Impact Report e o footer de versão). Consequências:

- **Sem migration, sem tabela, sem `withOrg`, sem Postman.** As seções de "modelo de dados" e "superfície
  de API" de um briefing normal **não se aplicam**.
- O "gate de qualidade" aqui não é `typecheck/lint/test` — é **conformidade de governança**: versão
  incrementada corretamente, justificativa registrada, Princípio II atualizado, templates ainda
  consistentes.
- **Precedente direto e recentíssimo**: a emenda **1.3.0** (provedores de LLM/Anthropic, fatia 016)
  fez **exatamente** este mesmo movimento — autorizar um serviço externo sob salvaguardas no Princípio
  II. Esta emenda é o **segundo caso** e deve **espelhar a estrutura** da 1.3.0. Ver §5.

---

## 3. Reconciliação card × repo (o enunciado erra caminhos e omite a versão)

| Issue diz                                        | Na realidade do repo                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/00-visao-geral.md` (AD-06)    | **`docs/produto/00-visao-geral.md`** — `docs/architecture/` está **VAZIO**. AD-06 está na tabela de decisões |
| `docs/architecture/04-integracoes-e-servicos.md` | **`docs/produto/04-integracoes-e-servicos.md`** (seção "Serviço de geração de PDF — Gotenberg")               |
| "Incrementar a versão (MINOR)"                   | Versão atual é **1.3.0**; o alvo é **1.4.0** (a issue não cita o número — confirmar 1.3.0 → 1.4.0)             |
| Rodar `/speckit-constitution`                    | Existe a skill; **ou** editar à mão espelhando a 1.3.0 (foi como a 1.3.0 saiu). Ambos válidos — ver §11        |

**Fontes reais da decisão (source of truth já existente):**

- [docs/produto/00-visao-geral.md](../produto/00-visao-geral.md) — **AD-06**: "Gotenberg como serviço
  auxiliar de PDF" (alternativa rejeitada: Puppeteer na função Vercel / `@react-pdf/renderer`;
  racional: resolve cold start / limite de bundle / memória; alta fidelidade HTML/CSS; zero código de
  serviço a manter). Bloco de trade-off logo abaixo já diz que **requer emenda antes da Fase 5**.
- [docs/produto/04-integracoes-e-servicos.md](../produto/04-integracoes-e-servicos.md) — seção completa
  do Gotenberg, incluindo uma **"Nota de governança"** explícita: _"introduzir o Gotenberg é
  infraestrutura nova e, pela constituição (Princípio II), exige emenda formal antes da Fase 5 … via
  `/speckit-constitution` com incremento de versão."_
- [docs/produto/05-roadmap-de-fases.md](../produto/05-roadmap-de-fases.md) — **Fase 5** (dias 34–38) lista
  como **pré-requisito de governança**: "emenda à constituição registrando a adoção do Gotenberg — feita
  **antes** de começar a fase."

→ A issue está correta na intenção ("a emenda só formaliza o que o roadmap já documentou"), mas **os
paths estão errados** (architecture → produto). O briefing e a emenda devem citar `docs/produto/`.

---

## 4. O que é o Gotenberg e por que dispara o Princípio II

**O que é**: [Gotenberg](https://gotenberg.dev) é uma **API HTTP stateless, open-source**, distribuída
como **container Docker pronto**, que converte HTML/Markdown → PDF (usa Chromium internamente). Não
escrevemos nem mantemos o código do serviço; apenas o consumimos por HTTP.

**Por que exige emenda**: o Princípio II fixa a stack (Next.js na Vercel + Supabase + Clerk + Cloudflare)
e diz que **"introduzir nova infraestrutura … serviços externos pagos, novo banco … MUST exigir emenda
formal antes da implementação."** O Gotenberg é **um serviço rodando fora da Vercel** (Railway / Render /
Fly.io) — logo, infra nova. Não importa que seja open-source/barato: o gatilho é **"serviço fora da
stack fixa"**, não "pago".

**Justificativa técnica (o que a emenda precisa registrar como racional — critério de aceite):**

- Rodar **Chromium dentro da função serverless da Vercel** é inviável: **cold start**, **limite de
  bundle (~250 MB)** e **limite de memória**. (Fonte: doc 04 §"Por que um serviço separado".)
- A solução é um **worker auxiliar stateless** dedicado à renderização — **um único** container, sem
  volume, sem banco, **substituível** (HTTP padrão). **Não** é uma arquitetura de microserviços (o
  trade-off do AD-06 registra isso explicitamente contra o "manter a stack simples").
- Casa com o **Princípio IV** (operações pesadas assíncronas): documento único via `after()` do Next 16;
  lote via tabela `jobs` + Vercel Cron. **Obs.**: `jobs` (tabela Postgres/Supabase) e Vercel Cron **não**
  são infra nova — já cabem na stack; **só o Gotenberg** precisa da emenda.

---

## 5. O molde: a emenda 1.3.0 (LLM) é o gabarito estrutural

A constituição já tem o **padrão de "exceção autorizada sob salvaguardas"** no Princípio II, criado pela
emenda **1.3.0**. A estrutura a replicar (ver o arquivo atual):

1. **Sync Impact Report** (bloco de comentário no topo): `Version change: 1.3.0 → 1.4.0 (MINOR — …)`,
   `Last amended`, seções modificadas, rationale, classificação MINOR, entrada nova na lista "Histórico".
2. **Princípio II** — novo bullet **"Serviço de renderização de PDF (AUTORIZADO — emenda 1.4.0)"**,
   espelhando o bullet dos "Provedores de LLM (AUTORIZADO — emenda 1.3.0)".
3. **Restrições Técnicas & Stack** — nova linha **"Geração de PDF"** (análoga à linha "IA/LLM" que a
   1.3.0 adicionou), citando o serviço auxiliar sob as salvaguardas do Princípio II.
4. **Footer** — `**Version**: 1.4.0 | … | **Last Amended**: <data>`.

Reusar o mesmo tom e formato mantém a constituição coerente e a auditoria trivial.

---

## 6. Insight central: as salvaguardas do Gotenberg **diferem** das do LLM

Copiar a 1.3.0 cegamente seria **errado**. A salvaguarda-chave do LLM — **"(b) NENHUM dado sensível/PII
enviado além do contexto necessário"** — **não se aplica** ao Gotenberg: para gerar o PDF do PGR, o
Gotenberg **recebe, por natureza, o conteúdo completo do documento do tenant** (dados da empresa,
possivelmente de funcionários). Zero-PII é impossível aqui — o dado É o documento.

Portanto as salvaguardas do Gotenberg devem ser **reenquadradas** para o que realmente controla o risco:

| Salvaguarda (Gotenberg)                                                                                          | Fonte no repo                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| (a) endpoint **não público**; protegido por **token** (`GOTENBERG_TOKEN`) e/ou restrição de rede — só a app chama | doc 04 §"Operação e segurança"                   |
| (b) serviço **stateless** — não persiste o documento (sem volume, sem banco); o PDF volta e a app o salva no Storage | doc 04 (topologia/pipeline)                      |
| (c) segredo (`GOTENBERG_URL`/`GOTENBERG_TOKEN`) **só no servidor**, nunca no cliente, nunca commitado (Princípio V) | doc 04 §"Variáveis de ambiente"                  |
| (d) chamada de renderização **desacoplada** da resposta ao usuário (Princípio IV: `after()` / `jobs`+cron)       | doc 04 §"Pipeline assíncrono"                    |
| (e) **substituível** (HTTP stateless padrão) — troca sem afetar o domínio; a indisponibilidade tem retry (`attempts`) | doc 04 / doc 05 (mitigação de risco)             |

O isolamento multi-tenant (Princípio I) permanece **intacto**: o HTML já é montado no servidor **após**
checar o tenant; o Gotenberg é um renderizador burro, não decide de quem é o dado.

---

## 7. Mapa concreto de edições na constituição

Alvo: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (hoje em **1.3.0**).

1. **Sync Impact Report** (topo, comentário HTML):
   - `Version change: 1.3.0 → 1.4.0 (MINOR — Princípio II: serviço auxiliar de PDF (Gotenberg) autorizado como infra permitida)`
   - `Last amended: <data ISO>`
   - Modified sections: Princípio II (novo bullet de PDF) + linha de stack "Geração de PDF".
   - Rationale: Fase 5 exige geração de PDF; Chromium não roda bem no serverless (cold start/bundle/memória);
     Gotenberg é worker auxiliar stateless, não microserviços; salvaguardas mantêm Princípios I e V intactos.
   - Classificação **MINOR**: nova permissão materialmente expandida a um princípio existente, sem remover
     nem redefinir princípios (idêntico ao critério que classificou a 1.3.0).
   - Histórico: acrescentar `- 1.4.0: Princípio II autoriza serviço auxiliar de PDF (Gotenberg) sob salvaguardas (Fase 5).`
2. **Princípio II** — inserir, após o bullet dos LLMs (1.3.0), o bullet:
   > **Serviço de renderização de PDF (AUTORIZADO — emenda 1.4.0)**: usar um serviço auxiliar
   > **stateless** de conversão HTML→PDF fora da Vercel (ex.: Gotenberg, container Docker open-source
   > em Railway/Render/Fly.io) é infraestrutura PERMITIDA para a geração de documentos, desde que:
   > (a) o endpoint não seja público e seja protegido por token/segredo (`GOTENBERG_TOKEN`) e/ou
   > restrição de rede; (b) o serviço seja stateless (não persiste o documento); (c) o segredo resida
   > SÓ no servidor; (d) a geração pesada/em lote seja desacoplada da requisição (Princípio IV);
   > (e) o serviço seja substituível. Demais serviços externos pagos continuam exigindo emenda formal.
3. **Restrições Técnicas & Stack** — adicionar linha (perto de "IA/LLM" / "Borda"):
   > **Geração de PDF**: serviço auxiliar stateless HTML→PDF fora da Vercel (ex.: Gotenberg), sob as
   > salvaguardas do Princípio II (endpoint protegido, stateless, segredo server-only, geração assíncrona).
4. **Footer**: `**Version**: 1.4.0 | **Ratified**: 2026-05-19 | **Last Amended**: <data>`.

---

## 8. Versionamento

- **Atual**: 1.3.0. **Alvo**: **1.4.0**.
- **MINOR** (segundo as regras da própria seção Governança): "novo princípio **ou seção materialmente
  expandida**". A emenda **expande** o Princípio II com uma nova permissão condicionada — enquadramento
  idêntico ao da 1.3.0. Não é MAJOR (não remove/redefine princípio) nem PATCH (não é só clarificação).

---

## 9. Critérios de aceite → como serão verificados

| Critério de aceite (issue)                                          | Como se verifica                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Constituição emendada citando o serviço auxiliar de PDF             | Princípio II tem o bullet do Gotenberg + linha de stack "Geração de PDF"           |
| Justificativa registrada (cold start / memória / bundle serverless) | Consta no Sync Impact Report (rationale) e no bullet do Princípio II              |
| Versão incrementada conforme governança                            | Sync report `1.3.0 → 1.4.0 (MINOR)` + footer `Version: 1.4.0`                      |
| Emenda concluída antes das demais issues da Fase 5                  | Esta issue mergeia **antes** de qualquer issue de PDF/documentos da Fase 5         |

---

## 10. Fronteiras — o que NÃO entra nesta issue

- **Nada de código de PDF**: `lib/pdf.ts`, templates, deploy do container, tabela `jobs`, endpoint de
  cron, `GOTENBERG_URL/TOKEN` em uso — tudo isso é **Fase 5**, não esta issue. Aqui só se **autoriza**.
- **Não** re-abrir a decisão AD-06 (serviço vs Puppeteer vs `@react-pdf/renderer`): já foi tomada nos
  docs de produto; a emenda apenas a **formaliza** na constituição.
- **Não** mexer nos Princípios I, IV e V (só se **referenciam**; permanecem intactos).
- **Não** confundir com a tabela `jobs` + Vercel Cron: esses cabem na stack atual e **não** precisam de
  emenda; o gatilho é exclusivamente o **serviço externo Gotenberg**.

---

## 11. Passo a passo de execução

1. **(Recomendado) Rodar `/speckit-constitution`** com o input descrevendo a exceção do Gotenberg
   (serviço auxiliar stateless de PDF fora da Vercel; racional cold start/bundle/memória; salvaguardas da
   §6; bump MINOR 1.3.0 → 1.4.0). A skill sincroniza os templates dependentes e mantém o formato.
   - **Alternativa manual** (foi como a 1.3.0 saiu): editar `constitution.md` seguindo o **mapa da §7**,
     replicando a estrutura da emenda 1.3.0. Igualmente válido; só exige aplicar as 4 edições à mão.
2. **Conferir** os 4 pontos da §7 (sync report, bullet do Princípio II, linha de stack, footer) e que a
   linha "Histórico" ganhou a entrada 1.4.0.
3. **Sanity de governança**: nenhum outro princípio foi enfraquecido; classificação MINOR correta;
   templates em `.specify/templates/` seguem consistentes (a 1.3.0 marcou todos como "✅ ok").
4. **Commitar** em branch de feature própria (ex.: `feature/constitution-gotenberg-pdf`) com mensagem
   `docs(constitution): emenda 1.4.0 — autoriza serviço auxiliar de PDF (Gotenberg) sob salvaguardas`,
   e abrir PR contra `develop`. **Mergear antes** de iniciar as issues de PDF da Fase 5.
   > Nota de processo: a emenda 1.3.0 foi commitada junto da fatia 016; esta pode ir **sozinha** numa
   > branch de governança, já que é pré-requisito transversal da Fase 5 (não está acoplada a uma feature).

---

### Resumo executivo

Task de **governança pura**: autorizar o **Gotenberg** (worker stateless de HTML→PDF fora da Vercel) no
**Princípio II**, bump **MINOR 1.3.0 → 1.4.0**, com a justificativa dos **limites do serverless para
Chromium** (cold start / bundle ~250 MB / memória). O trabalho é quase mecânico porque há **precedente
idêntico e recente** (a emenda 1.3.0 do LLM é o molde) e a decisão já está **documentada** em
`docs/produto/` (AD-06 + doc 04 + pré-requisito da Fase 5 no doc 05). O **único cuidado analítico** é não
copiar as salvaguardas do LLM cegamente: a de **zero-PII não se aplica** (o Gotenberg recebe o documento
completo do tenant); as salvaguardas certas são **endpoint protegido, stateless, segredo server-only e
geração assíncrona**. Riscos de execução não são técnicos e sim de **fidelidade**: a issue aponta para
`docs/architecture/` (vazio) quando as fontes reais estão em **`docs/produto/`**, e omite que a versão
alvo é **1.4.0**.

---

## 12. Execução da emenda — o que foi feito (2026-07-13)

A emenda **foi executada** via `/speckit-constitution` (comando recomendado pela issue), aplicando ao
[.specify/memory/constitution.md](../../.specify/memory/constitution.md) as **4 edições** do mapa da §7:

1. **Sync Impact Report** (topo): `Version change: 1.3.0 → 1.4.0 (MINOR — Princípio II: serviço auxiliar
   de PDF (Gotenberg) autorizado)`, `Last amended: 2026-07-13`, seção "Modified sections" reescrita para
   o PDF, rationale (limites do serverless para Chromium + AD-06), classificação MINOR, e entrada
   `1.4.0: …` no Histórico.
2. **Princípio II** — novo bullet **"Serviço de renderização de PDF (AUTORIZADO — emenda 1.4.0)"** com as
   5 salvaguardas (endpoint protegido por token; stateless; segredo server-only; geração assíncrona;
   substituível) e a nota explícita de que **"zero-PII" NÃO se aplica** (recebe o documento completo do
   tenant).
3. **Restrições Técnicas & Stack** — nova linha **"Geração de PDF"** citando o serviço auxiliar stateless
   sob as salvaguardas do Princípio II.
4. **Footer** — `**Version**: 1.4.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-07-13`.

**Validação (passos 4 e 6 da skill)** — tudo verde:

- Nenhum placeholder `[ALL_CAPS]` restante; nenhum `TODO(...)`/`NEEDS CLARIFICATION`.
- Versão coerente em report ↔ bullet do Princípio II ↔ Histórico ↔ footer (todos **1.4.0**).
- Templates (`plan`/`spec`/`tasks`/`checklist`) **consistentes** — nenhum fixa a versão da constituição
  (só o `constitution-template.md` tem o placeholder `[CONSTITUTION_VERSION]`, que é o gabarito). O gate
  de novo serviço externo continua coberto pelo Constitution Check + Complexity Tracking do
  `plan-template`.
- **Pre-hook** `before_constitution` (`speckit.git.initialize`, mandatory): pré-condição já satisfeita
  (repo já é git) — tratado como no-op.
- **Post-hook** `after_constitution` (`speckit.git.commit`, opcional): **não** executado (commit só
  quando você pedir).

**⚠️ Sequenciamento de versão (importante) — não commitar às cegas:** a 1.4.0 **encadeia na 1.3.0**, que
hoje só existe no branch `feature/ai-risk-suggestion` (commit `8853005`, PR aberta) e **ainda não está no
`develop`** (que segue em 1.2.1). Portanto:

- **Recomendado**: mergear a PR da fatia 016 primeiro (leva a 1.3.0 ao `develop`), depois abrir um branch
  **dedicado** `feature/constitution-gotenberg-pdf` a partir do `develop` e commitar a 1.4.0 sozinha
  (governança transversal — não acoplada a uma feature). Assim as versões não "pulam" 1.3.0 e a PR da IA
  não é poluída.
- A edição **já está aplicada no working tree** (branch atual `feature/ai-risk-suggestion`, que tem a
  1.3.0), então o conteúdo está correto e revisável. Só **não** foi commitada de propósito. Se preferir,
  faço o cherry-pick/branch quando a 016 mergear.

---

## 13. Prompt DETALHADO para `/speckit-specify` — a feature de PDF da Fase 5 (o que esta emenda desbloqueia)

> **Nuance**: a **issue #08 em si** é a emenda (comando `/speckit-constitution`, já executada acima) — ela
> **não** tem `/speckit-specify`. O prompt abaixo é para a **próxima** fatia que a emenda destrava: a
> **geração de PDF de documentos (Fase 5)**, montado no mesmo esqueleto do exemplo (`/speckit-specify` +
> `GIT_BRANCH_NAME` + `Feature` + `CONTEXTO` + reconciliação card×repo + modelo de dados + `User stories`
> P1/P2 + `Success criteria` + `Edge cases`), com o detalhamento dos docs de produto embutido. Spec em
> pt-BR; branch/commits em inglês. Copie do `/speckit-specify` até o fim.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/pdf-document-generation

Feature: PDF document generation (geração de PDF de documentos via Gotenberg — primeiro template: o PGR)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria da Fase 5
(1 issue = 1 branch = 1 spec). Feature FUNCIONAL: o gestor de SST gera o PDF de um documento (começando
pelo PGR já existente) a partir do conteúdo estruturado do tenant. O sistema renderiza um template do
documento para HTML no servidor (após checar o tenant), envia o HTML a um serviço auxiliar de renderização
(Gotenberg — HTML→PDF via Chromium, fora da Vercel), recebe o PDF, salva no Supabase Storage particionado
por tenant e registra o caminho. Geração de UM documento é rápida (executa após responder ao usuário, via
after() do Next 16); geração em LOTE é desacoplada por uma fila (tabela `jobs` + Vercel Cron), com
progresso consultável. É a PRIMEIRA feature que gera PDF e a primeira que usa o Gotenberg.
ESCOPO: (US1) gerar o PDF de um documento único + baixar/consultar; (US2) geração em lote via fila `jobs`
+ cron, com status/retry. FORA DE ESCOPO: editor de templates de PDF; múltiplos tipos de documento além do
primeiro template (PGR); upload/anexo de documentos externos; fila dedicada (QStash) — YAGNI, fica como
evolução (AD-08); assinatura digital do PDF.

PRÉ-REQUISITO DE GOVERNANÇA (já resolvido): o Gotenberg foi autorizado no Princípio II pela emenda da
constituição 1.4.0 (2026-07-13). O Constitution Check do plano deve referenciar isso como PASS (não há
gate pendente); a introdução do serviço externo já está formalizada.

RECONCILIAÇÃO CARD × REPO (os docs de produto usam nomes genéricos que NÃO batem — resolver na spec):
- "lib/pdf.ts" NÃO existe -> isolar o ponto de rede em src/shared/integrations/pdf/* (server-only),
  espelhando o padrão de src/shared/integrations/ai/* da fatia 016 (config server-only + cliente HTTP +
  função pura de montagem do HTML). A regra de negócio vive em núcleo compartilhado
  src/shared/server/pgr/* consumido por Server Action (officeAction) e, se houver superfície HTTP, REST.
- "features/pgr/" NÃO existe -> domínio em src/shared/domains/pgr/*; Server Actions em
  src/shared/server/actions/pgr/*; repositórios em src/shared/db/repositories/* (cada um embrulha withOrg).
- "docs/architecture/" está VAZIO -> as fontes reais são docs/produto/00-visao-geral.md (AD-06, AD-08),
  docs/produto/04-integracoes-e-servicos.md (seção Gotenberg + pipeline de jobs) e
  docs/produto/05-roadmap-de-fases.md (Fase 5). Padrões vivem em CLAUDE.md e docs/briefings/*.
- "organization_id (Clerk)" -> tenant = orgs.id; acesso via withOrg() + RLS app_runtime backstop
  (current_setting('app.current_org', true)); NUNCA Clerk org / input do cliente. Storage MUST particionar
  por tenant (Princípio I): o storage_path começa pelo org_id e o acesso é autorizado por tenant.
- "SQLite em memória" para testes -> integração contra Postgres EFÊMERO (INTEGRATION_*); NÃO há SQLite.

ANTES DE ESCREVER A SPEC, leia e liste (dizendo o que extraiu de cada):
- docs/produto/04-integracoes-e-servicos.md (seção "Serviço de geração de PDF — Gotenberg": topologia,
  pipeline, operação/segurança, variáveis GOTENBERG_URL/GOTENBERG_TOKEN/CRON_SECRET) e o bloco "Pipeline
  assíncrono de jobs (Princípio IV)" (documento único via after(); lote via jobs + Vercel Cron).
- docs/produto/00-visao-geral.md (AD-06 Gotenberg; AD-08 jobs+cron; AD-04 Route Handlers p/ webhooks/cron).
- .specify/memory/constitution.md — Princípio II (bullet do serviço de PDF, emenda 1.4.0), Princípio I
  (isolamento + storage por tenant), Princípio IV (operações pesadas assíncronas), Princípio V (segredos).
- src/shared/db/schema/pgr.ts + o CRUD de PGR (fatia 013) — a fonte do conteúdo do primeiro template.
- src/shared/integrations/ai/config.ts + anthropic.ts (fatia 016) — PADRÃO de integração server-only com
  segredo em env a ESPELHAR para o cliente do Gotenberg.
- src/shared/server/office-action.ts + src/shared/api/rest.ts (officeAction/restHandler, ActionResult,
  toActionError, códigos de erro) e src/proxy.ts (rotas públicas/cron).

MODELO / MUDANÇAS DE DADOS:
- Tabela nova `jobs` (fila de geração em lote): id, org_id (-> orgs cascade), kind (ex.: 'pdf'), status
  (pgEnum: pending|processing|done|failed), target_ref (documento alvo, ex.: pgr_id), storage_path
  (nullable, preenchido no sucesso), attempts (int default 0), error (text nullable), created_at,
  updated_at. RLS `jobs_isolation` (app_runtime, current_setting('app.current_org', true)) + GRANT
  SELECT,INSERT,UPDATE. Migration nova (ex.: 0016_jobs após a fatia 016; RENUMERAR no rebase se colidir
  com fatia paralela). [DECISÃO A CLARIFICAR: reuso da `jobs` para outros tipos futuros vs tabela só-PDF.]
- Persistência do PDF: Supabase Storage (bucket particionado por tenant). O registro do resultado é o
  `storage_path` (na `jobs` para lote; para documento único, decidir se grava em `jobs` também ou numa
  coluna do próprio documento). [DECISÃO A CLARIFICAR: onde mora o storage_path do documento único.]

INTEGRAÇÃO GOTENBERG (serviço auxiliar stateless, fora da Vercel):
- Cliente HTTP server-only em src/shared/integrations/pdf/*; GOTENBERG_URL + GOTENBERG_TOKEN SOMENTE no
  servidor (nunca no cliente). Endpoint do Gotenberg NÃO é público (token no header + restrição de rede).
- HTML montado no servidor com renderToStaticMarkup + CSS de impressão, APÓS checar o tenant (isolamento).
- Documento único: Server Action gera e usa after() do Next 16 para chamar o Gotenberg DEPOIS de responder
  (não bloqueia a resposta). Lote: Server Action cria N linhas em `jobs` (pending) e responde já; um Route
  Handler de cron (app/api/cron/process-jobs, protegido por CRON_SECRET) pega pendentes -> processing ->
  chama Gotenberg -> salva no Storage -> done (ou failed, incrementa attempts).
- Falha/timeout do Gotenberg -> erro tratado (ex.: PDF_UNAVAILABLE, código novo, 502); NUNCA vaza detalhe
  do serviço; no lote, marca `failed` e permite retry via attempts; o documento/tenant permanece intacto.

CONTRATO DE ERROS (códigos do domínio, não HTTP cru):
- FK_NOT_FOUND (422): documento (ex.: pgr_id) de outra org -> validado ANTES de renderizar/enfileirar.
- PDF_UNAVAILABLE (502): falha do serviço de PDF (código NOVO).
- VALIDATION (422): pedido de lote inválido/vazio.
- FORBIDDEN (403): papel client.
- UNAUTHORIZED/execução de cron sem CRON_SECRET válido -> 401 no Route Handler de cron.

REGRAS NÃO-NEGOCIÁVEIS (constituição):
- Tenant = orgs.id, sempre da sessão; pertencimento do documento ao tenant validado ANTES de renderizar.
- Storage particionado/autorizado por tenant (Princípio I): storage_path escopado por org_id.
- Segredos (GOTENBERG_URL/TOKEN, CRON_SECRET) só no servidor, nunca commitados (Princípio V).
- Operação pesada NÃO roda síncrona na requisição (Princípio IV): único via after(); lote via jobs+cron.
- Gotenberg é auxiliar/substituível; sua indisponibilidade não corrompe o documento (retry no lote).
- Superfície: Server Action (officeAction) para gerar/enfileirar/consultar status; se exposta por HTTP,
  REST mirror (restHandler) + docs (api-design.md) + Postman — regra vive UMA vez (núcleo compartilhado).
  O endpoint de cron é Route Handler (AD-04), guardado por CRON_SECRET, NÃO é superfície de tenant.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero gerar o PDF de um documento (PGR) e baixá-lo, para ter a versão final
  formatada — a geração não bloqueia a tela e o arquivo fica associado ao meu escritório (tenant).
- (P2) Como gestor de SST, quero disparar a geração de vários PDFs de uma vez e acompanhar o progresso
  (pendente/processando/concluído/falhou), para processar documentos em lote sem travar a interface.

Success criteria (mensuráveis, tecnologia-agnósticos):
- A geração de um documento produz um PDF fiel ao conteúdo, salvo e associado ao tenant, sem bloquear a
  resposta ao usuário.
- Nenhum PDF ou caminho de storage de um tenant é acessível por outro (isolamento verificável).
- A geração em lote registra cada item como pendente e evolui para concluído/falhou; itens que falham
  podem ser reprocessados (retry) sem duplicar os concluídos.
- Uma falha do serviço de PDF não corrompe o documento nem trava a UI (erro tratado; retry no lote).
- Segredos do serviço de PDF e do cron nunca aparecem no cliente nem no repositório.
- Suítes (unit + integração de persistência/isolamento/fila em Postgres efêmero, com o Gotenberg MOCKADO),
  lint, tipos e build passam.

Edge cases:
- Documento de outra organização -> FK_NOT_FOUND, ANTES de renderizar/chamar o Gotenberg (isolamento).
- Falha/timeout/erro do Gotenberg -> PDF_UNAVAILABLE (502) no único; `failed`+attempts no lote; documento
  intacto.
- Cron chamado sem CRON_SECRET válido -> 401 (nunca processa jobs).
- Job preso em `processing` (worker morreu) -> política de re-tentativa por attempts/idade [A CLARIFICAR].
- Lote parcialmente falho -> os itens `done` permanecem; só os `failed` reprocessam (idempotência por job).
- Conteúdo do documento vazio/incompleto -> decidir se bloqueia a geração (VALIDATION) ou gera PDF parcial.

DECISÕES A CLARIFICAR (marcar para /speckit-clarify):
- `jobs` genérica (kind) reusável para outros tipos futuros vs tabela específica de PDF?
- storage_path do documento ÚNICO: numa coluna do próprio documento vs também via `jobs`?
- Política de retry/timeout de jobs presos em `processing` (por attempts/idade)?
- Deploy do container Gotenberg (Railway/Render/Fly.io) — decisão de infra, fora do código da fatia?
- Documento único: after() do Next 16 (recomendado) vs enfileirar SEMPRE via `jobs` por uniformidade?

Conteúdo da spec em pt-BR; branch e commits em inglês. NÃO invente solução técnica não descrita aqui —
descreva o "o quê" e o "porquê". Marque claramente as DECISÕES A CLARIFICAR para o /speckit-clarify.
```
