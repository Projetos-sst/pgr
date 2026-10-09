# Plano — Reunião de 05/10/2026

Plano de execução derivado de [AUDIT.md](AUDIT.md). **Nada implementado**: este documento é o
planejamento. A execução começa depois das decisões bloqueantes (seção "Decisões que destravam") e da
autorização do usuário.

Regra que organiza tudo: **lotes pequenos e coerentes, 3–5 tarefas cada**, um por vez, uma PR por
lote. Nenhum lote mistura áreas. Nenhum lote toca o template do PDF — isso é do Douglas.

## Visão geral dos lotes

| Lote  | Tema                                | Req.               | Migration | Destrava                | Pré-requisito                          |
| ----- | ----------------------------------- | ------------------ | --------- | ----------------------- | -------------------------------------- |
| **A** | Contrato de dados do PGR por função | R01, R02, R03, R16 | **não**   | **o Douglas**           | nenhum                                 |
| **B** | Visão de função na interface        | R01, R03           | **não**   | pedido da reunião na UI | Lote A                                 |
| **C** | Correções de acesso e login         | R05, R06           | **não**   | telas prioritárias      | nenhum                                 |
| **D** | Landing pública — apresentação      | R04, R06           | **não**   | prioridade da reunião   | decisões 2–4                           |
| **E** | Pré-cadastro de interessados        | R04                | **sim**   | captação                | decisões 2–3 + desenho de rota pública |
| **F** | Hub unificado de EPI                | R07                | **não**   | organização             | nenhum                                 |
| **G** | Portal Saúde × Segurança            | R09                | **não**   | organização             | decisão 1                              |
| **H** | Modelos oficiais de inspeção        | R08                | a definir | —                       | material do Expedito                   |

Lotes **A–E** são o P0. **F–G** são P1. **H** está bloqueado por material externo. P2 (Saúde ampliada,
clínicas, Emoflow, psicossocial adicional, GED) **não entra neste plano** — a reunião decidiu adiar.

A ordem recomendada é **A → C → B → D → E → F → G**: A primeiro porque é o único que destrava outra
pessoa; C logo depois porque é pequeno, isolado e corrige bug real nas telas que a reunião priorizou.

---

## Lote A — Contrato de dados do PGR por função

**Requisitos:** R01 (hierarquia por função), R03 (treinamentos por função), R02 (ação por
classificação), R16 (preenchimento do PDF).
**Migration:** nenhuma. Tudo derivado na leitura.
**Responsável:** nós (dados). Douglas consome no template.

### Arquitetura

Estender `PgrConsolidated` de forma **aditiva e opcional** — nenhum campo existente muda de tipo,
nenhuma fixture antiga quebra. A cadeia de derivação já existe inteira no schema:

```
job_roles ──┐
            ├── ges_job_roles (worker_count, work_schedule)
ges ────────┘        │
                     └── risks ── control_measures (control_level, 5W2H)
job_roles ── job_role_required_trainings ── training_catalog (reference_norm, periodicity)
```

### Backend

1. **Domínio** — `src/shared/domains/pgr/pgr-consolidated.ts`:
   - novo tipo `ConsolidatedJobRole` (contrato completo em AUDIT §20);
   - `ConsolidatedGes.jobRoles?: ConsolidatedJobRole[]`;
   - `ConsolidatedRisk.resultGuidance?: string | null` preenchido com
     `riskClassificationGuidance(result)` — **reusando** a função que já existe em `methodology.ts`,
     sem reescrever texto normativo;
   - função pura `groupMeasuresByControlLevel(measures)` que devolve os 4 níveis na ordem canônica
     (`elimination → collective_protection → administrative → ppe`), inclusive os **vazios**, para o
     PDF poder imprimir "nível sem medida" como ausência honesta.
2. **Repositório** — `src/shared/db/repositories/pgr-consolidated.ts`: um JOIN adicional por GES
   (`ges_job_roles` → `job_roles`) e um por função (`job_role_required_trainings` →
   `training_catalog`), dentro do mesmo `withOrg` e da mesma transação. **Sem query N+1**: agregar em
   memória a partir de duas leituras, como o consolidado já faz com riscos/medidas/EPIs.
3. **Normalização de NR** — helper puro `normalizeReferenceNorm("NR 6" | "NR06" | "nr-6") → "NR-06"`
   para permitir agrupar treinamentos por norma sem migration. Decisão 7 define se é usado.

### Frontend

Nenhuma tela nova neste lote. A aba consolidada do PGR
(`pgr/[id]/_components/pgr-consolidated-tab.tsx`) passa a exibir as funções do GES e seus
treinamentos — é a validação visual de que o contrato tem dado real antes de ir ao PDF.

### Banco

Nada. Zero migration, zero mudança de RLS, zero policy nova.

### Contratos de dados

O contrato publicado em AUDIT §20 é a entrega deste lote. Precisa ser **enviado ao Douglas antes do
merge**, para ele confirmar forma e nomes.

### Testes

- **Unit**: `groupMeasuresByControlLevel` (4 níveis sempre presentes, ordem canônica, nível vazio),
  `normalizeReferenceNorm` (variações de grafia), preenchimento de `resultGuidance` para as 5 classes,
  risco sem avaliação → `resultGuidance` nulo.
- **Integração** (Postgres efêmero): consolidado de PGR com 2 GES × 2 funções compartilhadas; função
  em dois GES; função sem treinamento; função sem medida; **cross-tenant** (função de outro org não
  aparece); PGR sem GES.
- **Regressão**: a suíte de `pgr-pdf-template.test.ts` deve continuar verde **sem alteração** — prova
  de que a extensão é aditiva.

### QA

Gerar um PDF real pelo Gotenberg antes e depois do lote e confirmar que o documento **não muda** (os
campos novos só existem no contrato; quem imprime é o template do Douglas). Massa em tenant de QA,
removida no final.

### Riscos

Custo da derivação em PGR grande (AUDIT §23.4) — medir tempo do consolidado antes/depois e registrar.

---

## Lote B — Visão de função na interface

**Requisitos:** R01, R03.
**Migration:** nenhuma.
**Pré-requisito:** Lote A mergeado (reusa o mesmo domínio).

### Arquitetura

Nova rota de detalhe **`/job-roles/[id]`** — hoje inexistente. É o host que a reunião pediu para
"exibir a hierarquia de controle dentro de cada função".

### Frontend

1. `/job-roles/[id]/page.tsx` — detalhe da função: identificação (título, CBO, setor, empresa,
   jornada), GES vinculados com `worker_count`, e duas seções:
   - **Hierarquia de controle** — os 4 níveis na ordem canônica, cada um com as medidas dos riscos dos
     GES da função; nível sem medida aparece como vazio explícito, nunca omitido;
   - **Treinamentos obrigatórios** — lista de `job_role_required_trainings` com norma, carga horária e
     periodicidade.
2. `required-trainings.tsx` passa a ser montado também em `/job-roles/new` (hoje só na edição).
3. Link de "ver detalhe" na listagem `/job-roles` e no formulário.

Visual obrigatório: kit `_ui/data-list.tsx` para as grades, `PageHeader` com `backHref`, wrapper
central (lista `max-w-[1320px] px-4 py-8 sm:px-8`; formulário
`mx-auto w-full max-w-[940px] px-[30px] pt-7 pb-10`). Nenhuma cor nova.

### Backend

Server Action de leitura + mirror REST `GET /api/v1/job-roles/[id]/controls` (ou campo adicional no
`GET /api/v1/job-roles/[id]` — decidir na implementação), reusando o domínio do Lote A. Registrar em
`docs/api/api-design.md` e na coleção Postman — as 4 superfícies obrigatórias.

### Testes

Unit do agrupamento por função (já no Lote A); integração do novo endpoint com cross-tenant e função
sem GES; teste de componente da seção de hierarquia (nível vazio).

### QA

Playwright: criar função em tenant de QA → vincular GES com risco avaliado e medidas nos 4 níveis →
marcar 2 treinamentos → abrir detalhe → conferir os 4 níveis e os 2 treinamentos. Responsividade em
375/768/1440 com `scrollWidth <= clientWidth`. Massa removida.

---

## Lote C — Correções de acesso e login

**Requisitos:** R05, R06.
**Migration:** nenhuma.
**Pré-requisito:** nenhum. Pode entrar primeiro se for conveniente.

### Escopo (3 tarefas)

1. **Corrigir o overflow horizontal** de `/sign-in` e `/sign-up`
   (`src/app/_components/auth-frame.tsx`): o `p-8` do `<section>` somado à largura mínima do
   `cl-card` do Clerk estoura a viewport em 375px (399 × 360) e 768px (765 × 753). Solução a aplicar
   com medição: reduzir o padding no breakpoint base e/ou dar `min-w-0`/largura fluida ao contêiner do
   widget. **Não** mexer em regra de autenticação — é layout.
2. **Nome da aplicação no Clerk**: o widget anuncia "para continuar em **sst-manager**". É
   configuração no dashboard do Clerk (não código). Tarefa de ambiente, a executar pelo dono da conta.
3. **Revisar `clerkAppearance`** para que o widget herde os tokens do design system (indigo `#5b63f5`,
   Manrope, raio de 11px) — hoje a moldura é nossa, mas o miolo do widget ainda é padrão em parte.

**Fora de escopo deliberadamente:** qualquer mudança em `proxy.ts`, `requireTenantContext`,
`resolveActiveTenant` ou papéis. A auditoria concluiu que a segurança está correta; "não alterar
segurança ou autenticação para simplificar interface".

### Testes / QA

Playwright nas 3 viewports para `/`, `/sign-in`, `/sign-up`, com assert de
`scrollWidth <= clientWidth`. Teste de rota protegida continuar redirecionando para
`/sign-in?redirect_url=…` (regressão de autenticação).

---

## Lote D — Landing pública (apresentação)

**Requisitos:** R04, R06.
**Migration:** nenhuma — esta parte é só apresentação.
**Pré-requisito:** decisões 2, 3 e 4 da AUDIT §24.

### Arquitetura

Reescrever `src/app/(public)/page.tsx` (hoje 42 linhas) reaproveitando o conteúdo de apresentação que
**já existe** em `src/app/_components/auth-frame.tsx:13-25`. Extrair esses três blocos para um módulo
compartilhado (`_components/platform-pitch.ts`) consumido pela landing **e** pelo `AuthFrame` — uma
fonte só, sem texto duplicado.

Estrutura proposta (depende da decisão 4):

- herói com apresentação da plataforma + CTA "Entrar" e "Solicitar Orçamento";
- seção **Segurança do Trabalho** — PGR, riscos, EPI, inspeções, OS;
- seção **Saúde Ocupacional** — ASO, médicos, exames;
- rodapé com contato.

Se a decisão 4 for "rotas próprias", `/saude` e `/seguranca` entram como rotas públicas novas e
precisam ser liberadas em `proxy.ts`.

### Observação de produto a resolver antes

O bloco de IA do `AuthFrame` afirma **"IA com 92% de precisão na detecção proativa"**. Esse número não
tem fonte no repositório. Numa landing pública é afirmação de marketing verificável: ou se sustenta
com dado, ou se reescreve. **Decidir antes de publicar.**

### Testes / QA

Unit do módulo de pitch; Playwright nas 3 viewports (landing é a primeira coisa que um cliente vê);
checagem de que `/` continua pública e que usuário autenticado vê o caminho para o painel.

---

## Lote E — Pré-cadastro de interessados

**Requisitos:** R04.
**Migration:** **sim** — a única do P0.
**Pré-requisito:** decisões 2 e 3 + desenho de isolamento aprovado.

### Por que é um lote separado

É a **primeira superfície de escrita pública não autenticada do produto**. Todas as rotas públicas
existentes (`/sign/[token]`, `/signature-requests/[token]`,
`/psychosocial-response/[campaignId]/[token]`) derivam o isolamento **do token**. Um formulário de
orçamento aberto na internet não tem token. Misturar isso com o Lote D esconderia uma decisão de
segurança dentro de um lote de layout.

### Banco (migration provável)

Tabela nova de pré-cadastro. **Número da migration a conferir na hora** — a última real hoje é
`0051_ergonomic_evaluations`; **não reservar número** (regra do projeto, e o Douglas pode mergear
antes).

Decisões de modelagem a tomar **antes** de gerar qualquer coisa:

- é tabela **global** (sem `org_id`, como `caepi_certificates`) ou pertence a um tenant "comercial"?
  Um lead ainda não tem organização — provavelmente global;
- se global, o event trigger `ensure_rls` de produção **exige** policy: precedente é a policy única de
  leitura global de `caepi_certificates`, mas aqui o padrão é o inverso (escrita pública, leitura
  interna). Precisa de desenho próprio: `INSERT` permitido ao `app_runtime`, `SELECT` restrito;
- campos: nome, e-mail, telefone, empresa, mensagem, origem (`landing` × `orcamento`), timestamps;
- `GRANT` e trigger `set_updated_at` como SQL custom dentro da migration (padrão do projeto).

### Backend

Server Action pública dedicada **sem** `officeAction` (não há tenant nem papel) — espelhando o
precedente da ação pública de assinatura. Rate limiting obrigatório: hoje o único precedente de
limite é por cota de org (`ai_usage_events`), que não serve aqui. Avaliar limite por IP + honeypot;
captcha só se o usuário quiser dependência externa.

### Testes

Unit do schema Zod (e-mail, obrigatórios, tamanho máximo); integração: inserção pública funciona,
leitura pública **não** funciona, rate limit dispara, payload inválido → `VALIDATION`.

### Riscos

Superfície de spam e de abuso. Não entregar sem rate limiting. Não logar dado pessoal em claro.

---

## Lote F — Hub unificado de EPI

**Requisitos:** R07.
**Migration:** nenhuma. **Nenhuma funcionalidade nova** — a auditoria confirmou que tudo existe.

### Escopo (4 tarefas)

1. Página `/epi` — hub com os números que já existem no dashboard (`episLowStock`,
   `episPendingReturn`, `episCaExpired`, `episCaDueSoon`) e atalhos para catálogo, estoque, entregas,
   devoluções e fichas.
2. Página `/epi-deliveries` — listagem de entregas, que hoje **só existe como REST**; registrar
   entrega deixa de depender de navegar até `/employees/[id]`.
3. Menu: consolidar as três entradas hoje espalhadas em dois grupos sob uma única seção de EPI.
4. Links cruzados: da ficha do funcionário para a entrega e vice-versa.

**Não duplicar módulo** (regra explícita): nenhuma tabela, nenhum repositório, nenhuma Server Action
nova de escrita. Só leitura agregada e navegação.

### Testes / QA

Integração do endpoint de listagem de entregas (se precisar de filtro novo); Playwright do caminho
entrega → assinatura → devolução pelo novo hub, em tenant de QA; responsividade.

---

## Lote G — Portal Saúde × Segurança

**Requisitos:** R09.
**Migration:** nenhuma.
**Pré-requisito:** decisão 1 da AUDIT §24.

### Escopo

Reorganizar `nav-menu.tsx` (916 linhas, mega-menu) de 5 grupos para a estrutura de duas vertentes
decidida. Só rotas reais — o mega-menu atual já segue essa regra e ela se mantém. Distinção visual
leve entre as vertentes usando os tokens existentes (sem cor nova).

**Fora de escopo:** divisão de repositório, microsserviços, mudança de rota, mudança de permissão —
a menos que a decisão 1 diga que a separação também é por papel, e nesse caso isso vira um lote
próprio de autorização, **não** um lote de menu.

### Testes / QA

Teste de componente do menu (todas as rotas existem); Playwright de navegação nas 3 viewports.

---

## Lote H — Modelos oficiais de inspeção (bloqueado)

**Requisitos:** R08.
**Bloqueado por:** modelos oficiais do Expedito.

Quando os modelos chegarem, decidir: (a) importar como `inspection_plans` + `inspection_plan_items`
via script idempotente (o modelo atual já suporta), ou (b) se exigirem resposta numérica, múltipla
escolha ou foto por item, aí **sim** há migration em `inspection_item_responses` — e isso vira um lote
de modelagem próprio, análogo às fatias 006/008/023.

**Não criar modelos fictícios.** Um checklist de inspeção errado é risco real de segurança, não só
dado ruim.

---

## Decisões que destravam

Em ordem de impacto no cronograma:

| #   | Decisão                                                             | Bloqueia                   |
| --- | ------------------------------------------------------------------- | -------------------------- |
| 1   | Forma do contrato com o Douglas (4 pontos de AUDIT §20)             | Lote A — e o trabalho dele |
| 2   | Pré-cadastro: banco, e-mail ou os dois? Campos obrigatórios?        | Lotes D e E                |
| 3   | "Solicitar Orçamento" é formulário próprio ou o mesmo pré-cadastro? | Lotes D e E                |
| 4   | Áreas Saúde/Segurança na landing: seções ou rotas próprias?         | Lotes D e G                |
| 5   | Divisão Saúde × Segurança no menu: só visual ou também por papel?   | Lote G                     |
| 6   | "minimizar" × `collective_protection` (profissional de SST)         | rótulos do Lote A/B        |
| 7   | Treinamentos no PGR impresso: por função, por GES ou tabela geral?  | Lote A                     |
| 8   | Afirmação "92% de precisão" na landing                              | Lote D                     |

As demais perguntas da AUDIT §24 afetam P2 e não bloqueiam este plano.

## Responsáveis

| Área                                                                        | Responsável             |
| --------------------------------------------------------------------------- | ----------------------- |
| Contrato de dados, visão de função, landing, pré-cadastro, hub de EPI, menu | nós                     |
| Template do PGR e lógica de preenchimento do PDF                            | **Douglas** — não tocar |
| Modelos oficiais de inspeção                                                | **Expedito**            |
| Protótipo do fluxo de clínicas                                              | **Dr. Alcides** (P2)    |
| Dados de integração do Emoflow                                              | dono do Emoflow (P2)    |
| Nome da aplicação no Clerk                                                  | dono da conta Clerk     |
| Decisões normativas de SST                                                  | profissional de SST     |

## Riscos do plano

1. **Conflito no PDF com o Douglas.** Mitigação: Lote A só estende `pgr-consolidated.ts` com campos
   opcionais; template intocado; contrato enviado antes do merge.
2. **Retrabalho na landing** se a decisão 4 vier depois do Lote D. Mitigação: não começar D sem ela.
3. **Pré-cadastro sem desenho de isolamento** virar brecha. Mitigação: Lote E separado, com desenho
   aprovado antes da migration.
4. **Número de migration** mudar por merge concorrente. Mitigação: conferir o journal real na hora,
   nunca reservar.
5. **Performance da derivação por função** em PGR grande. Mitigação: medir no Lote A e registrar;
   se necessário, paginar ou materializar depois — com requisito, não por antecipação.
6. **Escopo do Lote F inflar** para "melhorar o EPI". Mitigação: o lote é navegação e agregação; zero
   escrita nova.

## Testes e QA — padrão de todos os lotes

Política do projeto, sem exceção por lote:

- **unit** para toda lógica de negócio (função pura, schema Zod, derivação);
- **integração** em **Postgres efêmero** (`INTEGRATION_DATABASE_URL`) para Server Actions e Route
  Handlers, sempre com caso **cross-tenant** e caso de autorização (`FORBIDDEN`);
- **nunca** SQLite, nunca o banco de dev, nunca produção;
- **Playwright** nos fluxos prioritários, em tenant de QA, com IDs registrados e massa **removida** no
  final; nunca dado de cliente;
- **responsividade** em 375×812, 768×1024 e 1440×900 com `scrollWidth <= clientWidth` em toda tela
  alterada;
- `npm run check` verde antes de abrir PR;
- as 4 superfícies obrigatórias em todo CRUD/HTTP: Server Action, mirror REST, `api-design.md`,
  Postman.

## O que este plano deliberadamente não faz

- não continua o Lote 4 CNAE/CBO (branch `feature/lot-04-cnae-cbo` congelada);
- não inicia GED / Lotes 5–7;
- não implementa PCMSO, absenteísmo, CAT oficial, clínicas, Emoflow nem psicossocial adicional;
- não cria outro template de PGR nem toca o do Douglas;
- não automatiza interrupção de atividade por classificação de risco sem requisito funcional explícito
  e validação de profissional de SST;
- não inventa catálogo de NR por função.
