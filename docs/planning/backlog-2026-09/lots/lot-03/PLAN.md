# Lote 3 — Plan

**Issues:** #40 (NR-17), #48 (NR-18) e o **fechamento da #47** · **Base:** `develop` em `25ade4d`
(última migration `0050`) · **Branch única:** `feature/lot-03-nr17-nr18-pgr` · **Fonte:**
[AUDIT.md](AUDIT.md).

> **Q1–Q4 foram decididas em 27/09/2026** (ver [AUDIT.md](AUDIT.md)): Q1 = tabela dedicada
> `ergonomic_evaluations`; Q2 = adequação (enum) + observação por dimensão; Q3 = campanha
> psicossocial agregada **opcional**; Q4 = relação de EPIs **também** no PDF. Nada neste plano está
> bloqueado.

## Objetivo

Fechar o conjunto normativo do PGR: registrar a avaliação ergonômica da NR-17 ligada ao risco, levá-la
ao documento (o que permite **fechar a #47**) e organizar no PGR os documentos complementares da NR-18
com a relação de EPIs derivada do cadastro.

## Escopo

1. **#40** — avaliação NR-17 por risco: schema, domínio, repositório, Server Action + REST, UI no
   detalhe do risco, exibição no consolidado e testes.
2. **#47** — seção NR-17 no PDF, na ordem certa, e fechamento da issue.
3. **#48** — tipos NR-18 como vocabulário fechado no domínio, checklist por tipo na aba Documentos do
   PGR (unidades `site`) e **relação de EPIs derivada** do cadastro.

## Fora de escopo

- Cadastro de profissional habilitado / ART por documento (issue #36; a NR-18 pede o documento, não a
  autoria estruturada).
- Implementar a metodologia COPSOQ (banco de itens, escala oficial, escore normativo).
- Formulário de AET completa — a AET entra como **laudo anexado** pelo GED.
- Tabela nova para documentos de canteiro (`construction_site_documents`): o GED cobre.
- Qualquer mudança no módulo psicossocial existente (campanhas, perguntas, respostas).

## Decisões herdadas (não reabrir)

- **Estado honesto**: campo sem dado sai como "não informado"; ausência nunca vira conformidade.
- **Nada de texto fabricado** em documento legal — a ponte #51 segue fora do PDF.
- **Vigência = mais recente por data**, como a NR-09 e a cobertura do plano.
- **Numeração das seções do PDF é sequencial pelo que existe** — a NR-17 entra na ordem e as
  seguintes se renumeram sozinhas.
- **Branch única + PR única** por lote.
- **Padrão visual global obrigatório** (ver seção própria) — o problema do `max-w-2xl` do Lote 2 não
  se repete.

## Arquitetura #40

Q1 = **B** (tabela dedicada) — decidido.

1. `schema/ergonomics.ts` (novo) — tabela `ergonomic_evaluations` + enum de adequação.
2. `domains/pgr/ergonomics.ts` (novo) — Zod, rótulos das seis dimensões, regra de "vigente" e
   helpers puros (nenhuma regra no repositório ou na tela).
3. `repositories/ergonomic-evaluations.ts` — CRUD com `withOrg`, `assertRiskInTenant` (mesmo padrão
   de `risk-assessments`) e `auditedTenantWrite`.
4. Server Actions `actions/pgr/ergonomic-evaluations.ts` + REST
   `/api/v1/risks/{id}/ergonomic-evaluations` (GET, POST 201) e
   `/api/v1/ergonomic-evaluations/{id}` (GET, PUT, DELETE 204) — as **4 superfícies** obrigatórias,
   com `api-design.md` e Postman.
5. `pgr-consolidated.ts` (domínio + repositório) — avaliação ergonômica **vigente** por risco.
6. `pgr-pdf-template.ts` — seção NR-17.

## Modelo de dados NR-17

Q1 = **B**, Q2 = **A** — decidido. Modelo final:

| Coluna                                                                                              | Tipo                      | Nulo | Observação                                     |
| --------------------------------------------------------------------------------------------------- | ------------------------- | ---- | ---------------------------------------------- |
| `id`, `org_id`, `risk_id`                                                                           | uuid / text / uuid        | não  | FK `orgs` e `risks` (`on delete cascade`)      |
| `posture`, `movements`, `physical_load`, `mental_load`, `work_organization`, `physical_environment` | enum `ergonomic_adequacy` | sim  | `adequate \| inadequate \| not_applicable`     |
| `*_notes` (uma por dimensão)                                                                        | text                      | sim  | Observação do profissional                     |
| `method`                                                                                            | text                      | sim  | Instrumento/método (sugestões incluem COPSOQ)  |
| `psychosocial_campaign_id`                                                                          | uuid                      | sim  | Q3 = A; FK `psychosocial_campaigns` (SET NULL) |
| `responsible`                                                                                       | text                      | sim  | Não há cadastro de profissional (#36)          |
| `assessed_at`                                                                                       | date                      | não  | Vigência = maior `assessed_at`                 |
| `notes`                                                                                             | text                      | sim  | Observação geral                               |
| `created_at`, `updated_at`                                                                          | timestamptz               | não  | Trigger padrão                                 |

Regras: nenhuma dimensão é obrigatória (avaliação pode ser parcial e honesta); **não existe conclusão
global** — a issue não pede e o sistema não diagnostica; histórico 1:N por risco, vigente = a mais
recente.

## AEP/AET

A **AEP** é este registro estruturado. A **AET** é o laudo **anexado ao risco** pelo GED
(`related_entity_type = "risk"`, já suportado e versionado). O formulário mostra o atalho "Anexar
laudo (AET)" apontando para o upload com o vínculo pré-preenchido — zero schema novo.

## Psicossocial/COPSOQ

Q3 = **A** — decidido.

- **Q3 = A (o que vale):** a avaliação aponta para uma campanha psicossocial **fechada** do mesmo GES; o PDF
  imprime nome da campanha, período, nº de respostas e os fatores derivados com nível. Consulta
  agregada, **nunca** resposta individual (as respostas nem sequer têm vínculo com pessoa).
- ~~Q3 = B (descartada): só o campo `method` em texto livre.~~ O campo `method` continua existindo, mas o vínculo agregado também.

Em qualquer cenário, o rótulo no documento diz exatamente o que é: "resultado agregado da campanha X",
e **não** "escore COPSOQ". O sistema não implementa a metodologia.

## UI #40

- **Onde:** detalhe do risco (`/risks/{id}`) ganha a seção **"Avaliação ergonômica (NR-17)"** com
  lista das avaliações (vigente em destaque) e ação "Nova avaliação"; páginas
  `/risks/{id}/ergonomic-evaluations/new` e `/[evaluationId]/edit`.
- **Formulário:** wrapper de 940px + `_ui/form`, com `FormSection` por bloco — "Identificação da
  avaliação" (data, responsável, método/instrumento), "Aspectos físicos" (postura, movimentos, carga
  física, ambiente físico), "Aspectos mentais e organizacionais" (carga mental, organização do
  trabalho) e "Observações". Cada dimensão = `SelectField` (adequação) + `TextAreaField` (observação).
- **Lista:** `ListCard` + `DataGrid` do `data-list`, com badge de adequação por dimensão resumida e
  `StatusBadge` semântico.
- Mostrar no detalhe do risco e na aba consolidada do PGR; ausência = "sem avaliação ergonômica".

## Backend #40

Erros reusados: `VALIDATION` (422), `NOT_FOUND` (404), `FK_NOT_FOUND` (422), `FORBIDDEN` (403).
Nenhum código novo. `officeAction` + `restHandler` como sempre; nada de rota paralela.

## Integração #47

Seção **NR-17** entre NR-09 e o plano de ação, por GES, com: risco, data, responsável, as seis
dimensões (adequação + observação) e, se Q3 = A, o bloco agregado da campanha. Risco sem avaliação
ergonômica aparece como "sem avaliação ergonômica registrada"; GES sem nenhum risco avaliado diz isso
em uma linha. Depois disso a **#47 fecha**.

## Arquitetura #48

Sem tabela nova e sem migration: vocabulário no domínio + leitura derivada.

1. `domains/documents/nr18.ts` (novo) — lista fechada dos tipos do 18.4.3 e rótulos.
2. `pgr-documents-tab.tsx` — painel "Documentos complementares (NR-18)" com checklist por tipo,
   exibido quando a unidade do PGR é `site`.
3. `repositories/pgr-consolidated.ts` — relação de EPIs deduplicada do PGR.
4. `pgr-pdf-template.ts` — seção da relação de EPIs (Q4 = A).

## Documentos NR-18

Tipos (lista fechada, do texto da norma): **projeto da área de vivência**, **projeto elétrico das
instalações temporárias**, **projetos de proteção coletiva**, **projeto de SPIQ (quando aplicável)**.
Eles entram como sugestões de `doc_type` no upload e como linhas do checklist.

## Tipos

"Organizados por tipo" = agrupar/filtrar os anexos do PGR por `doc_type` (o repositório já aceita o
filtro). O checklist é **informativo**: mostra anexado/faltando por tipo, com atalho de anexar. **Não
bloqueia** assinatura nem geração de PDF — nenhum requisito pede isso.

## GED/versionamento

Intocados. O anexo continua documento do acervo vinculado ao PGR; nova versão preserva o vínculo
(#56) e a exclusão remove o grupo. O checklist lê a versão vigente.

## Relação de EPIs

Consulta derivada: PGR → GES vinculados → riscos → `epi_risk` → `epi_catalog`, **deduplicada por
EPI**, trazendo nome, CA, validade do CA, fabricante, norma, material/tamanho, vida útil e os
riscos/GES atendidos. Fonte única é o cadastro; nada é digitado. CA vencido aparece com badge de
alerta (a validade já existe na base) — informação real, não julgamento novo.

## UI #48

- Painel NR-18 dentro da aba **Documentos e PDF** do PGR, no padrão dos cartões existentes, com
  checklist (tipo · situação · atalho).
- Painel **"Relação de EPIs"** logo abaixo, em `DataGrid` do `data-list`, somente leitura, com aviso
  de que a fonte é o cadastro de EPI.

## Backend #48

Nenhuma Action nova de escrita. Uma leitura derivada no repositório do consolidado (ou action de
leitura dedicada, se a tela precisar paginar) e os filtros de documento que já existem. `api-design.md`
e Postman ganham a nota de que a relação é derivada — sem endpoint novo, a não ser que a tela peça.

## Padrão visual e UI

Regras executáveis (ver a tabela de foundation no [AUDIT](AUDIT.md#auditoria-visual--ui-foundation)):

- **Largura:** lista `mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-8`; formulário/detalhe
  `mx-auto w-full max-w-[940px] px-[30px] pt-7 pb-10`. **Nunca** `max-w-2xl` encostado à esquerda.
- **Cabeçalho:** `PageHeader` de `_ui/list` com `icon`, `title`, `description` e `backHref` — o botão
  Voltar é o da primitive, à esquerda do título; nada de link textual improvisado.
- **Lista:** `ListCard` > `ListToolbar` (`ToolbarSearch` + `ToolbarSelect`/`SegmentedFilter` +
  `ToolbarButton` da ação primária) > `DataGrid` + `GridHeader` + `GridRow` + `Cell`/`MonoCell` >
  `ListFooter` (contagem, páginas, itens por página). Vazio = `EmptyState`.
- **Centralização das colunas:** cabeçalho e valores **centralizados**, exceto a coluna descritiva
  principal (nome do risco/documento/EPI), que fica à esquerda por legibilidade — exceção registrada
  aqui de propósito. Para isso, **estender a primitive**: `Cell` e `GridColumn` passam a aceitar
  `align: "left" | "center" | "right"`. Proibido espalhar `text-center` nas telas novas.
- **Badges:** `StatusBadge` do `data-list` com os tons existentes — `red` inadequado/CA vencido,
  `amber` atenção/a vencer, `green` adequado/anexado, `neutral` não aplicável/sem dado, `indigo`/`blue`
  informativo. Nenhuma cor hardcoded, nenhuma paleta nova.
- **Formulário:** `_ui/form` (`FormSection`, `TextField`, `TextAreaField`, `SelectField`,
  `FormActions`, `SubmitButton`, `CancelLink`), campos agrupados em cartões por tema, ajuda em
  `text-text-subtle text-xs`, erro abaixo do campo via `FieldError`, obrigatoriedade pelo `required`
  da primitive.
- **Ações:** rodapé único com `FormActions` — primária à direita (`SubmitButton`), `CancelLink` à
  esquerda dela; destrutiva só com `confirm-delete-button`/`confirm-modal`.
- **Responsividade:** 375×812, 768×1024 e 1440×900, com `scrollWidth <= clientWidth` e comparação
  visual contra uma tela de referência já aprovada (riscos psicossociais / EPI / GES).
- **Sem mockup novo:** não existe `.dc.html` de #40/#48; a referência é a foundation e as telas já
  redesenhadas. Nada de pixel-perfect contra imagem inexistente.

## Migrations previstas

| Migration (nome provisório)  | Issue | Conteúdo                                                                               | Situação         |
| ---------------------------- | ----- | -------------------------------------------------------------------------------------- | ---------------- |
| `0051_ergonomic_evaluations` | #40   | Tabela `ergonomic_evaluations` + enum `ergonomic_adequacy` + RLS/índices/GRANT/trigger | **implementada** |
| —                            | #48   | nenhuma                                                                                | Confirmado       |
| —                            | #47   | nenhuma                                                                                | Confirmado       |

Número **não** reservado e **nada gerado** nesta execução. Na implementação: `git pull --ff-only`,
`npm run db:generate`, renomear para o padrão descritivo e acertar o `tag` do journal.

## RLS

`ergonomic_evaluations` nasce com `pgPolicy` de isolamento
(`org_id = current_setting('app.current_org', true)`) para `app_runtime`, igual às demais tabelas do
PGR, e todo acesso passa por `withOrg`. #48 não cria tabela — usa as policies existentes de
`documents`, `epi_catalog`, `epi_risk`, `risks` e `ges`.

## Testes

**#40** — unit: Zod (dimensões opcionais, data obrigatória, enum inválido), rótulos, seleção da
avaliação vigente. Integração (Postgres efêmero): CRUD, histórico/vigente, cross-tenant
(`FK_NOT_FOUND`/`NOT_FOUND`), `client` → `FORBIDDEN`, RLS da tabela nova.
**#47** — unit do template: seção NR-17 na ordem, risco sem avaliação com estado honesto, ausência de
NR-17 quando não há nenhuma avaliação, nenhum escore inventado; integração da rota de PDF e do
`pdf-batch-core` (os **dois** chamadores).
**#48** — unit: checklist por tipo (anexado/faltando), relação de EPIs deduplicada, badge de CA
vencido. Integração: relação isolada por tenant, documento de outro tenant não entra no checklist.
**Sempre:** `npm run check`, integração completa, `npm run build` e QA Playwright nos três viewports.

## Estratégia da branch

**Uma só:** `feature/lot-03-nr17-nr18-pgr`, criada de `develop` em `25ade4d`. Auditoria, decisões,
implementação, walkthrough, review, QA e correções vivem nela. Rebase em `origin/develop` antes da PR;
`--force-with-lease`, nunca `--force`.

## Estratégia da PR

**Uma só, no fim do lote**, depois de implementação, walkthrough, review, QA Playwright, PDF, RLS,
cross-tenant, `check`, integração, build e rebase final. A PR deve fechar **#40** e **#47**, e fechar
**#48** se a parte dela entrar completa. Merge é do usuário.

## Ordem interna de implementação

1. **#40** — schema, migration, domínio, repositório, API, UI, testes (gate: verde antes de seguir).
2. **#47** — seção NR-17 no template + consolidado; fecha a issue.
3. **#48** — tipos NR-18 + checklist + relação de EPIs (+ seção no PDF — Q4 = A).

Por quê: a migration sai isolada no começo; o template é tocado depois que o dado existe; #48 é a
parte barata e, se precisar, pode ser cortada para outro lote sem travar o fechamento da #47.

## Dependências

- **Entrada:** Q1, Q2, Q3 (#40) e Q4 (#48/#47) — **todas respondidas em 27/09/2026**.
- **Interna:** #47 depende de #40 verde na branch; #48 depende do template já com a NR-17 (Q4 = A).
- **Saída:** com #40, #47 e #48 fechadas, o conjunto normativo do PGR (NR-01/09/17/18) fica completo.

## Riscos

Ver [AUDIT](AUDIT.md#riscos). Os dois que exigem disciplina no código: **não** apresentar média Likert
interna como COPSOQ e **não** deixar tela nova fora do padrão visual.

## Definition of Done

- [x] Q1–Q4 respondidas e registradas.
- #40: migration com RLS validada em Postgres efêmero; 4 superfícies de API; UI no padrão; unit +
  integração novos.
- #47: seção NR-17 no PDF pelos **dois** chamadores, conferida em PDF real; issue fechada.
- #48: checklist NR-18 por tipo em unidade `site`; relação de EPIs derivada (e no PDF (Q4 = A));
  nenhuma digitação duplicando o cadastro.
- `npm run check`, integração completa e `npm run build` verdes; CI verde na PR.
- QA Playwright com evidências em 375/768/1440; massa sintética removida.
- `WALKTHROUGH.md`, `REVIEW.md` e `QA.md` do lote escritos; fichas 040/047/048 atualizadas.

## Itens bloqueados

**Nenhum.** As quatro decisões foram fechadas em 27/09/2026 (Q1 = tabela dedicada; Q2 = adequação +
observação; Q3 = campanha agregada opcional; Q4 = relação de EPIs também no PDF). Um bloqueio novo
só entra aqui se aparecer impedimento técnico real durante a execução.
