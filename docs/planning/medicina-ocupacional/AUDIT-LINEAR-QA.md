# Auditoria Medicina Ocupacional: Linear, integrações e QA (Agente 6)

Data: 2026-10-21. Auditoria READ-ONLY. Nada foi criado, editado, comentado, movido ou reatribuído no
Linear. Nenhum código, schema, migration, teste ou config foi alterado. **Nenhum teste foi executado**
(a worktree `develop-ro` não tem `node_modules`; verificado com `test -d node_modules` → `NO_NODE_MODULES`).
Os scripts Python do protótipo foram apenas lidos.

---

## 1. Escopo analisado

- **Parte A (Linear)**: projeto `pgr` (P-NOB-4, team PGR/NOB), milestones, membros, recursos, documentos,
  status updates, comentários do projeto; 25 issues pedidas (NOB-93, 94, 97–103, 105, 107–113, 120–123,
  125, 128–130) com relações, anexos, histórico de estado e comentários; busca por Medicina/PCMSO/ASO/
  exame/clínica/Lista C. NOB-98 em profundidade (PR #112, docs da branch, NOB-101/105/107, docs do projeto).
  Confronto status Linear × estado real das PRs no GitHub.
- **Parte B (QA)**: worktree `origin/develop` = `d6b787c` (commit de 2026-10-20 23:25 -0300, merge da #118).
  Scripts, Jest (projetos, exclusões), helpers de Postgres efêmero, `runIsolationSuite`, testes de RLS/
  isolamento e de Medicina, Playwright, CI/CD em `.github/workflows`. Scripts `testes/*.py` do protótipo.
  Mapa testes existentes × necessários para Medicina (21 cenários).

## 2. Fontes consultadas

| Fonte | Como |
| --- | --- |
| Linear MCP `linear-server` | `get_project` (members/milestones/resources), `list_documents`, `get_document` ("Comece aqui"), `get_status_updates` (0), `list_comments` (projeto + 25 issues), `get_issue` (includeRelations, stateHistory), `list_issues` (projeto completo + 6 buscas) |
| GitHub | `gh pr view 112 --json ...`, `gh api repos/Projetos-sst/pgr/pulls/112/comments` (0), `gh api .../issues/112/comments` (0), `gh pr checks 112`, `gh pr list --state all`, corpos de #108/#109/#111/#115/#116/#117, `gh run list` (CI e CD), `gh api .../rulesets` (403: recurso indisponível no plano) |
| Git (worktree) | `git show origin/codex/NOB-98-feat/riscos-para-medicina:<path>`, `git log origin/develop..<branch>`, `git merge-base --is-ancestor`, `git merge-tree --write-tree` (somente objetos, sem tocar working tree) |
| Código develop `d6b787c` | `package.json`, `jest.config.ts`, `jest.integration-setup.ts`, `playwright.config.ts`, `tests/e2e/*`, `.github/workflows/{ci,cd,changelog}.yml`, `src/__tests__/integration/_helpers/*`, testes de Medicina, `src/shared/db/schema/{medicos,module-policy}.ts`, `docs/produto/08-fluxos-emissao-assinatura.md` |
| Protótipo | `Projeto-SST-Ocupacional/LEIAME.txt`, `testes/*.py` (10 arquivos, 675 linhas) |

## 3. Arquivos reais (verificados abertos)

Branch `origin/codex/NOB-98-feat/riscos-para-medicina` (head `ebfbac3`, 2 commits acima de develop: `7c9adb3`, `ebfbac3`):
`.specs/20261020-nob-98/spec.md` (76 l.), `.specs/20261020-nob-98/validation.md` (44 l.),
`docs/planning/nob-97-100-98-relatorio.md` (108 l.), `src/shared/db/migrations/0054_medical_risk_sources.sql` (68 l.),
`src/shared/domains/medicine/risk-sources.ts`, `src/shared/server/actions/medicine/risk-sources.ts`.

Develop `d6b787c`: `jest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/cd.yml`,
`.github/workflows/changelog.yml` (início), `src/__tests__/integration/_helpers/{db.ts,isolation-suite.ts,pgr-seed.ts}`,
`src/__tests__/integration/pgr/{medicos,health-exams,rest-health-exams}.test.ts`,
`src/__tests__/integration/platform/{company-modules,company-module-management,shared-company-records}.test.ts`,
`src/__tests__/integration/psychosocial/{psychosocial,risk-factors}.test.ts`,
`src/__tests__/integration/documents/documents-download.test.ts`, `src/__tests__/integration/auth/switch-tenant.test.ts`,
`src/__tests__/integration/pgr-editor/pgr-revisions.test.ts`, `src/shared/db/schema/medicos.ts`, `src/shared/db/schema/module-policy.ts`,
`docs/produto/08-fluxos-emissao-assinatura.md`.

Protótipo: `testes/flow.py`, `crawl.py`, `teste.py`, `demo.py` (lidos na íntegra); `portal.py`, `amianto.py`,
`fadiga.py`, `rev3.py`, `rev4.py`, `rev5.py` (lidos; asserções extraídas por grep).

---

## 4. Evidências

### 4.1 Projeto Linear `pgr`

- P-NOB-4, status In Progress, prioridade Urgent, lead **douglas moura**, início 2026-10-17, sem targetDate.
- Membros: Carlos, Rikelvin, Douglas. (E-mails removidos em 2026-10-21 antes do commit: dado pessoal, não evidência técnica.)
- 46 issues (38 do backlog + 8 subtarefas Pro). 8 milestones sem data: "4. Medicina Ocupacional — PCMSO e ASO" progresso **13%**;
  "6. Teleconsultas e portal de clínicas" **0%**; "2. Arquitetura e integração" 85%.
- Recursos: 2 documentos de Douglas (2026-10-17): "Comece aqui — guia do time, fila de trabalho e mapa de APIs" e
  "Assinatura Pro — telas, APIs e pesquisa de gateways". **0 status updates. 0 comentários no projeto.**
- O guia diz: "Centralizar decisões no documento ou na issue correspondente. Usar comentários de tarefa para contexto técnico,
  evidências, bloqueios e decisões de revisão. Não há Slack no fluxo." Lista como "Pendências que merecem alinhamento inicial":
  "Fonte, significado e códigos da Lista C", "Regras e responsáveis técnicos para emissão/assinatura de documentos", entre outras.
- O "Mapa de APIs" do guia propõe para "Integração PGR → Medicina": "Riscos por empresa/contexto, contrato versionado e tratamento
  de mudanças" (NOB-98, NOB-111) e declara: "Não representam endpoints já implementados."

### 4.2 Fato transversal: zero comentários

`list_comments` retornou `[]` para **todas as 25 issues** e para o projeto. Nenhuma decisão, pergunta ou evidência está registrada
em comentários do Linear. As únicas evidências fora das descrições são os **anexos de PR** (NOB-97/98/99/100/101/102/103/105/107).

### 4.3 Tabela consolidada das issues

Legenda prioridade: U=Urgent, H=High, M=Medium. "Med" = milestone 4; "Tele" = milestone 6.

| Issue | Título (resumido) | Responsável | Status | Prio | Milestone | Anexo/PR | Bloqueada por | Bloqueia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NOB-93 | Obter modelo completo do Dr. Alcides | **sem** | In Review (desde 17/10) | H | 1 | — | — | 94, 101, 104, 105, 112, 113 |
| NOB-94 | Comparar modelo × sistema do Douglas | Rikelvin | **Backlog** | U | 1 | — | 93 | 96, 97, 101, 103, 108 |
| NOB-97 | Separar módulos Medicina/Segurança | Rikelvin | Done (20/10 17:39) | U | 2 | PR #109 | 94 | 98, 99, 100, 108, 121 |
| NOB-98 | Integração riscos PGR → PCMSO | Rikelvin | In Progress (20/10 17:16) | H | 2 | PR #112 "validação técnica pendente" | 97, 99, 103 | 109, 130 |
| NOB-99 | Cadastros comuns entre módulos | Rikelvin | Done (20/10 18:53) | H | 2 | PR #110 | 97, 102 | 98, 108, 111, 122 |
| NOB-100 | Contratação independente PGR/Medicina | Rikelvin | Done (20/10 21:48) | H | 2 | PR #111 | 97, 114 | 111, 115, 116, 133 |
| NOB-101 | Fluxos de emissão e assinatura | Rikelvin | Done | H | 2 | PR #108 "levantamento… (rascunho)" | 93, 94 | 105, 109, 110 |
| NOB-102 | Validar CNPJ e funcionários | Rikelvin | In Review | U | 3 | PR #118 | — | 99, 103, 104, 105 |
| NOB-103 | Riscos ergonômicos/físicos/químicos | Rikelvin | In Progress | H | 3 | PR #113 "revisão técnica pendente" | 94, 102 | 98, 105 |
| NOB-105 | Concluir geração do PGR (Douglas) | Rikelvin | In Progress | U | 3 | PR #115 "emissão integral pendente" | 93, 101, 102, 103, 104 | 106, 107, 118, 124, 128, 129 |
| NOB-107 | Avaliação técnica do PGR gerado | Rikelvin | In Progress | H | 3 | PR #117 "parecer técnico pendente" | 105 | 130 |
| NOB-108 | Módulo de Medicina conforme protótipo | **Carlos** | In Progress (20/10 02:45) | U | Med | — | 94, 97, 99 | 110, 112, 122, 123 |
| NOB-109 | Geração automática do PCMSO | **Carlos** | Backlog | U | Med | — | **98**, 101, 111, 112, 113 | 118, 125, 128, 129 |
| NOB-110 | Fluxo de geração do ASO | **Carlos** | Backlog | U | Med | — | 101, 108, 112, 113 | 118, 125, 128, 129 |
| NOB-111 | PGR fornecido pela empresa (externo) | **Carlos** | Backlog | H | Med | — | 99, 100 | 109 |
| NOB-112 | Abas/formulários que alimentam documentos | **Carlos** | In Progress (20/10 02:50) | H | Med | — | 93, 108 | 109, 110, 123 |
| NOB-113 | Completar "Lista C" | **Carlos** | In Progress (20/10 02:48) | H | Med | — | 93 | 109, 110 |
| NOB-120 | Teleconsulta avulsa | **Carlos** | Backlog | M | Tele | — | 117, 121 | — |
| NOB-121 | Cadastro de médicos/psicólogos internos e externos | **Carlos** | Backlog | M | Tele | — | 97 | 120, 122 |
| NOB-122 | Portal empresa ↔ clínica | **Carlos** | Backlog | H | Tele | — | 99, 108, 121 | 123, 130 |
| NOB-123 | Conectar protótipo ao front-end | **Carlos** | Backlog | H | Tele | — | 108, 112, 122 | 128 |
| NOB-125 | IA para documentos de Medicina | **Carlos** | Backlog | H | 7 | — | 109, 110, 126 | — |
| NOB-128 | Teste E2E completo (CNPJ → documentos) | sem | Backlog | U | 8 | — | 105, 109, 110, 123, 127 | 130 |
| NOB-129 | Testar geração/visualização/download/restrições | sem | Backlog | H | 8 | — | 105, 109, 110, 118, 127 | 130 |
| NOB-130 | Validar integrações e treinamento | sem | Backlog | H | 8 | — | **98**, 107, 116, 117, 122, 128, 129 | — |

Comentários: **0 em todas**. Labels: as issues de Medicina carregam o label de área "Medicina Ocupacional — PCMSO e ASO" ou
"Teleconsultas e portal de clínicas" mais labels técnicos com prefixo "PGR •" (ex.: "PGR • API / Backend"); NOB-113, NOB-120 e NOB-125
têm "PGR • A definir".

**Confirmação pedida**: as 11 issues de Medicina (108, 109, 110, 111, 112, 113, 120, 121, 122, 123, 125) estão **todas atribuídas a
Carlos**. Estados: **In Progress = 108, 112, 113** (iniciadas em 2026-10-20 entre 02:45 e 02:50 UTC, conforme stateHistory);
**Backlog = 109, 110, 111, 120, 121, 122, 123, 125**. Nenhuma das três In Progress tem PR anexada, branch ou comentário.

### 4.4 Outras issues do projeto que tocam Medicina (busca)

Buscas "Medicina", "PCMSO", "ASO", "exame", "clínica", "Lista C" não trouxeram nada fora do conjunto, exceto issues comerciais/teste
que citam Medicina: **NOB-116** (separar valores/cobranças PGR e Medicina, Backlog, sem responsável), **NOB-117** (avulsos), **NOB-118**
(teste de 15 dias com restrição de impressão; bloqueado por 109/110), **NOB-115/NOB-133** (Pro/licenças). A busca "Lista C" trouxe também
NOB-137 (Pro) e issues de outros projetos (PGR-47/51/68/80, falso-positivo).

### 4.5 Detalhe por issue (critérios, lacunas, decisões)

Critérios de aceite estão nas descrições (texto padrão "Item NN de 38 do backlog… propostos para validação da equipe; sem responsável ou
prazo definido" — texto desatualizado: hoje há responsáveis).

- **NOB-93** (In Review, sem responsável). Critérios: 2 de 3 marcados ([X] modelo disponível por versão, [X] campos/anexos inventariados;
  [ ] "Lacunas e dúvidas registradas para validação"). Lacuna: não diz onde o modelo está; sem responsável; bloqueia 112/113 de Carlos.
- **NOB-94** (Backlog, Rikelvin). Critérios: matriz requisito × implementação × evidência. Lacuna: **dependência violada**: bloqueia NOB-97
  (Done), NOB-101 (Done), NOB-103 e NOB-108 (In Progress) mas continua em Backlog sem evidência.
- **NOB-97** (Done, #109). Critérios (nenhum marcado): limites documentados; acesso por permissão e contratação; fluxos preservados.
  Entrega em develop: migration `0053_company_module_access.sql`, RLS restritiva `health_exams_module_access` e `pgr*_module_access`
  (`src/shared/db/schema/health-exams.ts:63`, `pgr.ts:68,104,148`).
- **NOB-98**: ver §4.7.
- **NOB-99** (Done, #110). Teste `platform/shared-company-records.test.ts` cobre "keeps shared records available to Medicine without requiring PGR".
- **NOB-100** (Done, #111). Critério 3 "Medicina funciona com PGR externo conforme fluxo previsto" **não** é entregue pela #111: o corpo da
  #111 diz "O uso de PGR externo pela Medicina é a entrega NOB-98 seguinte". Done com critério dependente de PR aberta.
- **NOB-101** (Done, #108 mergeada 20/10 15:15). Entrega só documentação (`docs/produto/08-fluxos-emissao-assinatura.md`). O próprio doc §5
  lista como "explicitamente pendentes": quem elabora/revisa/emite/assina, vínculo profissional, modalidade de assinatura, estados,
  congelamento por versão, eventos (linhas 87-103). O corpo da #108 diz "não conclui a issue" e "permanece em rascunho para essa discussão".
  O doc confirma: "PCMSO: fluxo ainda não implementado" (l. 49); "Não existe consumidor `aso`/`health_exam` no registry genérico de
  assinatura" (l. 67). Done aceitável apenas pela leitura literal do critério "confirmadas **ou explicitamente pendentes**".
- **NOB-102** (In Review, #118 **mergeada** 21/10 02:25).
- **NOB-103** (In Progress, #113 **mergeada** 21/10 00:15). Anexo diz "revisão técnica pendente" (provável motivo de manter aberta: HIPÓTESE).
- **NOB-105 / NOB-107** (In Progress; #115 e #117 drafts abertos). #117 explicita: "avaliação técnica e revalidação exigem evidência do
  profissional responsável". Nenhuma das duas contém a pergunta da NOB-98.
- **NOB-108** (Carlos, In Progress). Critérios: jornadas do protótipo mapeadas/implementadas; persistência e retomada; acesso e isolamento por
  cliente verificados. Lacuna: sem inventário de jornadas registrado; bloqueador NOB-94 em Backlog.
- **NOB-109** (Carlos, Backlog). Critérios: PCMSO reflete riscos **selecionados e validados**; origem interna/externa identificada; fluxo técnico
  de emissão. Depende diretamente da validação técnica que a NOB-98 deixou pendente.
- **NOB-110** (Carlos, Backlog). ASO com vínculos corretos, campos obrigatórios validados, revisão/emissão/assinatura conforme fluxo aprovado
  (que NOB-101 deixou pendente).
- **NOB-111** (Carlos, Backlog). "Criar entrada de PGR externo com referência ao documento e registro estruturado dos riscos". **Sobreposição
  forte com a PR #112**, que já implementa fonte externa manual/JSON com origem/versão e sempre pendente (spec.md:12-16).
- **NOB-112** (Carlos, In Progress). Mapear campos das abas → entidades → documentos; salvar/retomar; validações.
- **NOB-113** (Carlos, In Progress). "Confirmar significado, fonte e versão da chamada Lista C com o responsável técnico… não inventar códigos".
  Decisão externa pendente (Dr. Alcides). Também listada no guia e na descrição do projeto como "Pontos de confirmação".
- **NOB-120/121/122/123** (Carlos, Backlog, milestone 6). NOB-121 critério 3: "Permissões limitam acesso aos vínculos autorizados" — é
  **a mesma decisão** que trava a NOB-98 (identidade/autorização do profissional). NOB-122: vínculo autorizado empresa-clínica.
- **NOB-125** (Carlos, Backlog). IA com limites para dados sensíveis; depende de 109/110/126.
- **NOB-128/129/130** (sem responsável). Testes de homologação; NOB-130 bloqueada por NOB-98.

### 4.6 Status Linear × estado real no GitHub

| Issue | Linear | PR | Estado GitHub (gh pr list, 21/10) | Consistência |
| --- | --- | --- | --- | --- |
| NOB-101 | Done | #108 | MERGED 20/10 15:15, docs | Coerente com merge; issue em si com decisões pendentes |
| NOB-97 | Done | #109 | MERGED 20/10 17:39 | Coerente |
| NOB-99 | Done | #110 | MERGED 20/10 18:33 | Coerente |
| NOB-100 | Done | #111 | MERGED 20/10 21:34 | Merge ok; critério "PGR externo" depende da #112 aberta |
| NOB-98 | In Progress | #112 | **OPEN, isDraft=false**, base `codex/NOB-100-feat/servicos-por-empresa` (já mergeada), **sem checks**, review 0 | Corpo diz "PR empilhada, em rascunho", mas GitHub não marca draft |
| NOB-103 | In Progress | #113 | MERGED 21/10 00:15 | **Linear atrasado** (ou mantido aberto por revisão técnica) |
| NOB-104 | In Progress | #114 | MERGED 21/10 00:23 (docs) | **Linear atrasado** |
| NOB-102 | In Review | #118 | MERGED 21/10 02:25 (= HEAD develop d6b787c) | **Linear atrasado** |
| NOB-105 | In Progress | #115 | OPEN draft | Coerente |
| NOB-106 | In Progress | #116 | OPEN draft | Coerente |
| NOB-107 | In Progress | #117 | OPEN draft | Coerente |

**Douglas**: nenhuma issue do projeto está atribuída a ele (`list_issues project=pgr`). Suas PRs #99–#106 (14–15/10) estão MERGED, nenhuma
anexada a issue do Linear. #101/#102/#104 entregaram CD Vercel com migrations automáticas e release para `main` (#102 base `main`, 15/10);
NOB-127 "Publicar ambiente online para testes reais" segue Backlog sem responsável (relação entre as duas: HIPÓTESE, não registrada).
`gitBranchName` da NOB-98 é `carlos07victor/nob-98-…` porque o Linear gera o nome a partir do usuário autenticado no MCP (Carlos), não do
responsável; o branch real é `codex/NOB-98-feat/riscos-para-medicina`.

### 4.7 NOB-98 em profundidade

**Estado**: In Progress desde 2026-10-20 17:16; 0 comentários; anexo PR #112. PR #112 criada 20/10 17:14, atualizada 21/10 00:15, por
`rikelvinceSanto`, 30 arquivos (0054/0055 + snapshots Drizzle ~24,7 mil linhas), sem comentários nem reviews (`pulls/112/comments` = 0,
`issues/112/comments` = 0).

**A pergunta pendente existe, mas não está no Linear nem na PR como comentário**: está no corpo da PR e nos docs da branch, e foi feita
**ao operador da sessão do Rikelvin** ("ao usuário"), não a uma parte interessada nomeada:

- Corpo da PR #112, seção "Pendência de negócio obrigatória": *"O cadastro de médicos não vincula profissional ao usuário autenticado.
  Falta definir quem concede autorização e como identificar o profissional. NÃO há fluxo operacional de aprovar/rejeitar até essa definição;
  owner/colaborador não são presumidos responsáveis técnicos."*
- `.specs/20261020-nob-98/spec.md:55-59`: *"O cadastro `medicos` não vincula profissional ao usuário autenticado. Foi perguntado ao usuário
  quem pode conceder autorização de validação e como identificar o profissional. Não considerar owner/colaborador automaticamente habilitado
  para aprovar riscos. Enquanto não houver resposta, não há endpoint/botão de aprovação ou rejeição."*
- `docs/planning/nob-97-100-98-relatorio.md:85-88`: *"Falta definir quem concede autorização de validação e como identificar o profissional
  no usuário autenticado (o cadastro atual de médicos não tem esse vínculo). A pergunta foi enviada ao usuário."*
- `.specs/20261020-nob-98/validation.md:40-42`: critério "Validação técnica e transições de aprovação/rejeição: **pendentes** da decisão sobre
  concessão de autorização e identidade profissional."

Confirmação no código de develop: `src/shared/db/schema/medicos.ts:25-36` tem `id, org_id, name, crm, specialty, clinic, phone` (+ status) e
**nenhuma coluna de usuário**; o único schema com vínculo a usuário é `org-memberships.ts`.

**Pergunta a fazer (formulação recomendada, já que não há registro de quem deve responder)**:

> 1. Quem pode marcar um risco (vindo do PGR interno ou de PGR externo) como "validado" ou "rejeitado" para uso no PCMSO: apenas o médico
>    coordenador do PCMSO daquela empresa-cliente, qualquer médico do trabalho cadastrado, ou outro papel?
> 2. Quem concede e revoga essa autorização: o owner do escritório, o próprio coordenador, ou a plataforma?
> 3. Como o sistema identifica que o usuário logado é aquele profissional: vincular o cadastro `medicos` (CRM) a um usuário do Clerk/
>    `org_memberships`? O profissional pode ser externo ao escritório (clínica parceira)?
> 4. A autorização é por empresa-cliente ou vale para todo o escritório? Ao trocar o coordenador, as validações anteriores continuam válidas?
> 5. Validar exige nota/justificativa obrigatória? Rejeitar exige motivo?

**Quem deve responder**: Expedito (produto: quem concede/revoga e se o profissional pode ser externo); **Dr. Alcides** (validação clínica:
qual profissional pode validar riscos para o PCMSO e o que a validação significa); Douglas (Tech Lead: identidade Clerk ↔ `medicos` e modelo
de papéis). Rikelvin implementa; Carlos é afetado diretamente (NOB-109/110/121/122).

**Opções técnicas** (todas exigem migration nova, porque 0054 faz `REVOKE UPDATE, DELETE` do `app_runtime` nas três tabelas e a policy
RESTRICTIVE `medical_risk_entries_pending_insert` só aceita INSERT `pending` — `0054_medical_risk_sources.sql:59,66-68`):

| Opção | Descrição | Prós | Contras |
| --- | --- | --- | --- |
| A | `medicos.user_id` (Clerk) + tabela `professional_grants(org_id, company_id, medico_id, granted_by, revoked_at)` concedida pelo owner | Por empresa; auditável; reusa `medicos` | Exige fluxo de convite/vínculo do usuário Clerk; profissional externo precisa de membership |
| B | Novo papel de domínio (ex. `medical_coordinator`) em `org_memberships` / role Clerk | Simples no gate (`requireOfficeStaff` → `requireMedicalReviewer`) | Escopo de escritório inteiro, não por empresa; mistura identidade profissional com papel de acesso |
| C | "Coordenador do PCMSO" designado por empresa (FK `company → medico`) + vínculo usuário | Espelha NR-07 (coordenador por PCMSO), casa com NOB-109 | Mais modelagem; precisa da opção A para identidade |
| D | Owner atesta validação (provisório) | Desbloqueia já | Contraria explicitamente a spec ("owner não é presumido profissional habilitado"); risco regulatório |

Persistência da revisão (independe da opção de autorização): (i) tabela append-only `medical_risk_reviews` com status derivado do último evento
(consistente com a imutabilidade da 0054); ou (ii) `GRANT UPDATE(status, reviewed_by, reviewed_at, review_note)` + policy de UPDATE restrita
ao revisor. Recomendação: (i).

**Consequências de não decidir**: NOB-98 não fecha; NOB-109 (critério "riscos selecionados e validados") e NOB-130 ficam bloqueadas;
`canUseMedicalRisk` (`domains/medicine/risk-sources.ts:88-96`) só libera `validated`, então **nenhum risco é utilizável** pelo PCMSO hoje.
A mesma lacuna reaparece em NOB-110 (ASO assinado por médico), NOB-121 (permissões por vínculo) e NOB-122 (clínica autorizada).

**Estado de integração da #112 (riscos)**: a base `codex/NOB-100-feat/servicos-por-empresa` (`044334e`) já é ancestral de develop; a PR precisa
de **retarget para develop**. `git merge-tree origin/develop <branch>` indica **conflito em `docs/api/sst-manager.postman_collection.json`**
(api-design.md mescla automaticamente). `gh pr checks 112` → "no checks reported": o CI só dispara para PR com base develop/main
(`ci.yml:4-5`). Migrations 0054/0055 encaixam após `0053_company_module_access.sql`, a última de develop. **Ao mergear em develop, o CD aplica
0054/0055 automaticamente no banco do ambiente develop** (`cd.yml:67-75`, `drizzle-kit migrate` com `DATABASE_URL_UNPOOLED` puxado da Vercel);
a spec pede "primeiro em staging" — na prática o merge é a aplicação em staging/homolog. 0055 também fecha inventário/avaliações/medidas/EPI-risco
quando PGR está desabilitado (spec.md:36-38): mudança de comportamento para empresas novas, que começam **sem módulos** (relatorio:11).

**Como a Medicina avança sem duplicar a integração do Rikelvin**:
1. Tratar `medical_risk_sources` / `medical_risk_entries` (repositório `src/shared/db/repositories/medical-risk-sources.ts` da #112) como o
   **único contrato** PGR → Medicina. PCMSO (NOB-109) referencia `source_id` + ids de entries (snapshot), nunca lê `risks`/`pgr` direto.
2. **NOB-111 (Carlos) deve ser reescopada sobre a #112**: o registro de PGR externo já existe lá; resta UX, upload/GED do documento e a validação.
3. Avançar em paralelo no que não depende da validação: inventário de jornadas (NOB-108), mapeamento de campos (NOB-112), catálogo de exames/
   Lista C como dado versionado (NOB-113, aguardando Dr. Alcides), modelo de PCMSO em rascunho que consome fontes com aviso de "pendente".
4. Coordenar a decisão de identidade profissional numa só issue: NOB-121 (Carlos) é o lugar natural para `medicos ↔ usuário` + concessões;
   NOB-98 consome. Registrar isso no Linear (decisão do coordenador).
5. Reservar numeração de migration com Rikelvin (0054/0055 já ocupadas pela #112, ainda não mergeada).

---

## 5. Funcionalidades existentes (QA, develop `d6b787c`)

### 5.1 Comandos reais (`package.json`)

`test` = `jest --selectProjects unit`; `test:integration` = `jest --selectProjects integration --runInBand`; `check` = format:check + lint +
typecheck + test (unit); `test:deploy` = `node --test scripts/__tests__/*vercel*.test.mjs`; `db:generate|migrate|studio` (drizzle-kit);
`worker`. **Não há script npm para Playwright** (e2e roda com `npx playwright test`: HIPÓTESE pelo padrão). devDeps de teste: `jest`,
`@swc/jest`, `jest-environment-jsdom`, `@testing-library/*`, `@playwright/test`, `playwright`, `@clerk/testing`.

### 5.2 Jest (`jest.config.ts`)

- Projeto **unit** (jsdom): `src/**/__tests__/**/*.test.ts(x)` + `src/__tests__/unit/**`, ignora `/__tests__/integration/`.
- Projeto **integration** (node): `src/__tests__/integration/**/*.test.ts(x)`; timeout 30 s (`jest.integration-setup.ts:1`).
- **8 suítes excluídas** (`jest.config.ts:26-35`): 6 `rest-*` (harness de Route Handler do Next no Jest retorna 500/"Cannot read properties of
  undefined (reading 'has')"), `least-privilege` e `companies-scope-model` (dependem do modelo exato de roles do Supabase). Comentário l. 24
  ("As 99 suítes restantes") está desatualizado: hoje há 177 arquivos de integração e 137 unitários em `src/__tests__` (+31 testes colocalizados).
  A #112 fala em "nove suítes excluídas"; em develop são 8 (diferença não investigada: NÃO VERIFICADO).
- Contagem: `rest-health-exams.test.ts` **não** está excluída (REST de exames roda no Jest).

### 5.3 Postgres efêmero e helpers

- `_helpers/db.ts`: `appRuntimeClient()` (`INTEGRATION_DATABASE_URL`), `adminClient()` (`INTEGRATION_DATABASE_URL_ADMIN`), `withOrgTx()`,
  `setJwtClaims()`, `applyMigrations()` — lê **todos os `.sql` em ordem alfabética**, divide por `--> statement-breakpoint`, idempotente via
  `_test_applied_migrations` + advisory lock. **Não lê `_journal.json`** (divergência possível com `drizzle-kit migrate` do CD se surgir arquivo
  órfão ou numeração duplicada).
- `_helpers/pgr-seed.ts`: `seedPgrBase` trunca `orgs/users` em cascata e semeia `org_a`/`org_b` com empresa, `company_modules` (l. 64),
  unidade, GES, função, funcionário, EPI, PGR — ids fixos em `PGR_IDS`. Não semeia `medicos` nem `health_exams`.
- `_helpers/isolation-suite.ts`: `runIsolationSuite({table, seededCountA, crossTenantInsertSql, extraSeedSql})` — 6 asserções RLS (A só vê A,
  B só vê B, sem tenant → 0, tenant inválido → 0, insert cross-tenant rejeitado por WITH CHECK, sem vazamento após `withOrg`). Usada em 25
  arquivos para 20 tabelas: categories, companies, control_measures, employees, epi_* (6), ergonomic_evaluations, ges, ges_job_roles,
  job_roles, pgr, pgr_ges, pgr_revisions, risk_assessments, risks, stock_movements, work_units. **Não cobre `medicos`, `health_exams`,
  `company_modules`, tabelas psicossociais** (o isolamento delas é testado de forma ad hoc nos testes de CRUD).
- Padrão de gate em teste: `jest.mock("@/shared/auth/require-office-staff")` + `mockResolvedValue({userId, tenantId, plan, role})`
  (`health-exams.test.ts:7-30`); REST via bypass dev `x-dev-tenant`/`DEV_API_AUTH_BYPASS` em alguns testes.
- Todas as suítes usam `(shouldRun ? describe : describe.skip)`: **sem as envs, passam como "skipped"** — localmente um `npm run test:integration`
  sem banco parece verde.

### 5.4 Testes de Medicina existentes

| Arquivo | Casos |
| --- | --- |
| `integration/pgr/medicos.test.ts` | CRUD escopado; busca nome/CRM; filtro clínica; clínicas não vazam; `client` → FORBIDDEN; CRM duplicado → DUPLICATE; VALIDATION; cross-tenant → NOT_FOUND |
| `integration/pgr/health-exams.test.ts` | CRUD com médico; busca/filtro; médico cross-tenant → FK_NOT_FOUND; funcionário cross-tenant → FK_NOT_FOUND; data futura → VALIDATION; cross-tenant → NOT_FOUND |
| `integration/pgr/rest-health-exams.test.ts` | GET/POST 201/PUT/DELETE 204; 422 VALIDATION/FK_NOT_FOUND; 403 client; 404 cross-tenant |
| `integration/platform/company-modules.test.ts` | backfill 0053; empresa nova sem módulos; revogar PGR mantém Medicina; revogar Medicina oculta exames sem apagar; isolamento de habilitações |
| `integration/platform/company-module-management.test.ts` | mudança atômica; ativação explícita; colaborador não altera; outro tenant; **concorrência**; **rollback** se auditoria falha; REST |
| `integration/platform/shared-company-records.test.ts` | cadastros comuns sem clonagem; disponíveis à Medicina sem PGR; isolamento |
| `integration/psychosocial/{psychosocial,risk-factors}.test.ts` | campanhas, rota pública anônima, transições, cross-tenant, FORBIDDEN |
| unit: `domains/pgr/{medicos,health-exams}.test.ts`, `domains/platform/company-modules.test.ts`, `psychosocial-risk-factors.test.ts` | zod/regras |

Na branch #112 (não em develop): `integration/platform/medical-risk-sources.test.ts` (280 l.) e `unit/domains/platform/medical-risk-sources.test.ts`.

Reaproveitáveis para Medicina: `documents/documents-download.test.ts` (download cross-tenant → 404 sem assinar path),
`auth/switch-tenant.test.ts` (troca de organização só para membership), `pgr-editor/pgr-revisions.test.ts` (versionamento + concorrência +
UNIQUE), `safety/service-orders.test.ts` (snapshot imutável pós-emissão, concorrência).

### 5.5 Playwright

`playwright.config.ts`: `testDir: tests/e2e`; projeto **public** (`public-*.spec.ts`) sempre; projetos **setup/protected** só com
`E2E_PROTECTED=1` (Clerk via `@clerk/testing`, storageState `.auth/user.json`, exige `SUPABASE_SECRET_KEY` para memberships). `webServer`
`npm run dev` com `reuseExistingServer`. Specs: `public-signature.spec.ts` (3 testes, assinatura pública de OS) e `safety-protected.spec.ts`
(5 testes, Fase 06). **Nenhum E2E de Medicina. Playwright não roda no CI** (nenhum passo em `ci.yml`).

### 5.6 CI/CD (`.github/workflows`)

- `ci.yml`: gatilho `pull_request` para **develop/main** + `workflow_call`. Jobs: `quality` (Prettier, ESLint, typecheck), `test` (serviço
  **postgres:16**, cria `sst_test`, roda `scripts/ci-integration-bootstrap.sql` para roles estilo Supabase, depois `npm run test`,
  `npm run test:deploy`, `npm run test:integration`), `build` (`npm run build`). Envs Clerk/Supabase são placeholders.
- `cd.yml`: `push` em develop/main + manual. Job `ci` reusa `ci.yml`; job `deploy` faz `vercel pull`, **aplica migrations no banco do
  ambiente** (`node --env-file=.vercel/.env.production.local node_modules/drizzle-kit/bin.cjs migrate`, l. 67-75), `vercel build`, deploy
  prebuilt. develop → projeto Vercel de homolog (`VERCEL_DEVELOP_*`); main → produção.
- `gh run list --workflow cd.yml`: 6 execuções em develop de 20/10 17:39 a 21/10 02:25 (merges #109, #110, #111, #113, #114, #118), todas
  `success`. Não li os logs; pela definição do job, 0053 (da #109) foi aplicada no banco de homolog (HIPÓTESE forte).
- `changelog.yml`: push em develop/release reescreve CHANGELOG via GitHub App que seria "bypass_actor do ruleset". `gh api .../rulesets` → 403
  ("Upgrade to GitHub Pro…"): proteção de branch/checks obrigatórios **NÃO VERIFICADO**.

### 5.7 Scripts do protótipo (`testes/*.py`, não executados)

Python + Playwright sync contra `file:///…/app/saude-ocupacional.html`, rede abortada (`page.route(... r.abort())`), `localStorage` limpo,
asserções sobre o estado global `S.*` e funções internas (`save`, `trocarPerfil`, `assinRaw`, `exigeRetorno`). `crawl.py` grava `snap.json`
e `demo.py` grava `demo.png` no diretório corrente (efeito colateral).

| Script | O que testa | Reuso como roteiro de QA |
| --- | --- | --- |
| `flow.py` | CNAE curto bloqueado; CPF com aviso; busca; **ASO sem médico bloqueado**; **ASO guarda snapshot de riscos e não muda quando o risco da função muda**; CID inválido; fim antes do início; texto não se perde; kit INSS (S-2230); kiosk psicossocial anônimo, n<5 oculto; clínica + guia de encaminhamento; conclusão sem resultados bloqueada; ASO gerado pela clínica; indicadores; aviso e exclusão em cascata | Alto: validações, snapshot pós-emissão, guia → ASO |
| `portal.py` | "Ver como" empresa/clínica; empresa não vê funcionário/empresa de outra; clínica vê só ASOs das suas guias; clínica sem excluir; vínculo exigido, pedido de acesso, liberação; aba fora do perfil redireciona; sem rolagem horizontal; empresa não exclui funcionário com ASO; ASO da clínica travado para a empresa | Alto: matriz de autorização empresa/clínica/profissional (NOB-122) |
| `demo.py` | Documentos em demonstração no teste grátis: sem baixar/copiar, marca d'água, Ctrl+P/Ctrl+S/contextmenu bloqueados, impressão em branco; assinante libera | Médio: NOB-118/129 (restrição é só front-end no protótipo; na plataforma tem de ser no servidor) |
| `amianto.py` | Prazos de guarda (amianto/raios X 30, não ionizante 20, comum 20), periodicidade por exposição, alertas pós-demissionais | Alto como regras clínicas a validar com Dr. Alcides |
| `rev3.py` | Aritmética de datas (31/01+1 mês, bissexto), retorno ao trabalho por afastamentos somados, periodicidade por histórico | Alto: casos-limite unitários |
| `fadiga.py`, `teste.py`, `rev4.py`, `rev5.py` | Fadiga (KSS, interjornada, microssono), preços/contratos, teste grátis 15 dias, conversão, contratos vencidos | Baixo para Medicina core; útil para comercial |

Como código, **não são reaproveitáveis** (dependem do HTML monolítico e de globais). Como roteiro, ~60 asserções de Medicina servem de casos de
aceite para NOB-108/110/112/122.

---

## 6. Lacunas

### 6.1 Mapa testes existentes × necessários para Medicina

Camadas: U = unit (jsdom); I = integração Postgres efêmero; E = E2E Playwright (projeto protected). "98?" = depende da NOB-98/#112.

| # | Cenário | Camada | Existe hoje? | Helper/teste reaproveitável | 98? |
| --- | --- | --- | --- | --- | --- |
| 1 | Sem autenticação | I (gate) + E | Parcial: `auth/protected-layout`, `no-tenant-block`; nada específico de rotas de Medicina | `auth/*.test.ts`, `proxy.ts` (307) | Não |
| 2 | Sem módulo Medicina habilitado | I | Sim para `health_exams` (RLS restritiva, `company-modules.test.ts`); **não** para `medicos`/psicossocial (sem policy de módulo) | `company-modules.test.ts`, `companyModuleScope` | Não |
| 3 | Empresa só Medicina | I | Sim para cadastros comuns e exames; fontes de risco só na #112 | `shared-company-records.test.ts`, `medical-risk-sources.test.ts` (#112) | Sim (fontes) |
| 4 | Só PGR | I | Sim (`revokes Medicine without hiding PGR`) | `company-modules.test.ts` | Não |
| 5 | Ambos | I | Implícito no seed (`company_modules` com ambos) | `pgr-seed.ts` | Não |
| 6 | Profissional autorizado | I + E | **Não existe** (não há vínculo usuário ↔ médico) | — | **Sim (decisão pendente)** |
| 7 | Profissional sem vínculo | I | **Não** | padrão `mockedGate` + role | **Sim** |
| 8 | Trabalhador de outra empresa (mesmo tenant) | I | Parcial: cross-tenant sim; **outra empresa do mesmo escritório não** em exames | `pgr-review-samples` (#117, "GES não vinculado no mesmo escritório"), FKs compostas da 0054 | Parcial |
| 9 | Clínica não vinculada | I + E | **Não** (`clinic` é texto livre em `medicos`; sem entidade clínica/vínculo) | `portal.py` como roteiro | Não (NOB-121/122) |
| 10 | Troca de organização | I + E | Sim para o cookie (`switch-tenant.test.ts`); não para dados de Medicina após troca | `switch-tenant.test.ts`, `runIsolationSuite` | Não |
| 11 | Acesso por ID (IDOR) | I | Sim para medicos/exames (cross-tenant → NOT_FOUND / 404) | `medicos`, `health-exams`, `rest-health-exams` | Não |
| 12 | Download não autorizado (ASO/PCMSO) | I | Padrão existe para GED (`documents-download.test.ts`); **não** para ASO (`certificate_path` texto, sem GED) | `documents-download.test.ts` | Não |
| 13 | Salvar e retomar (rascunho) | I + E | **Não** (não há formulários de PCMSO/ASO em rascunho) | — | Não |
| 14 | Validação | U + I | Sim para medicos/exames (zod + VALIDATION) | `unit/domains/pgr/*`, padrão `VALIDATION` | Não |
| 15 | Edição concorrente | I | Padrão existe (`pgr-revisions`, `company-module-management`); nada em Medicina | `pgr-revisions.test.ts` | Não |
| 16 | Emissão bloqueada (dados obrigatórios/riscos não validados) | U + I | **Não**; `canUseMedicalRisk` unitário só na #112 | `medicalSourceWarnings`/`canUseMedicalRisk` (#112) | **Sim** |
| 17 | Versionamento (PCMSO/ASO) | I | Não para Medicina; padrão em `pgr-revisions` e `documents-update` | `pgr-revisions.test.ts` | Parcial |
| 18 | Falha de rede | U (front) + E | **Não** (nenhum teste de erro de rede/loading na UI) | `@testing-library` + mocks de fetch | Não |
| 19 | Rollback | I | Padrão existe (`company-module-management` "rolls back… audit event"); #112 diz testar rollback | `company-module-management.test.ts` | Parcial |
| 20 | Dados externos não validados (PGR externo/JSON) | U + I | Só na #112 (import sempre `pending`, status/aprovador rejeitados no JSON) | `medicalRiskContentSchema` `.strict()` | **Sim** |
| 21 | Alteração de risco após emissão | I | Na #112: fingerprint detecta mudança sem nova revisão (`changed`); **não há emissão de PCMSO/ASO ainda** para provar snapshot | `service-orders.test.ts` (snapshot imutável), `flow.py` como roteiro | **Sim** |

### 6.2 Outras lacunas

- Nenhuma decisão, pergunta ou evidência nos comentários do Linear (contraria o próprio guia do projeto).
- `runIsolationSuite` não cobre tabelas de Medicina; `medicos` não tem RLS por módulo.
- E2E de Medicina inexistente; Playwright fora do CI.
- ASO sem consumidor no registry de assinatura e sem GED (`08-fluxos-emissao-assinatura.md:60-68`).
- NOB-108/112/113 In Progress sem artefato rastreável.

## 7. Riscos

| Risco | Evidência | Impacto |
| --- | --- | --- |
| Decisão de autorização profissional sem dono nem registro | spec.md:55-59; 0 comentários no Linear | Bloqueia NOB-98 → NOB-109 → NOB-128/129/130 |
| Duplicação NOB-111 × #112 | NOB-111 descrição vs spec.md:12-16 | Retrabalho e dois contratos de PGR externo |
| Merge = migration em homolog | `cd.yml:67-75`; CD success em todos os merges recentes | 0054/0055 e qualquer migration de Medicina aplicadas automaticamente ao mergear |
| Colisão de numeração de migration | #112 ocupa 0054/0055 sem merge | Conflito de journal/`applyMigrations` alfabético |
| #112 sem CI e com conflito | `gh pr checks` vazio; conflito Postman | Integração atrasada; base fantasma |
| Linear desatualizado | §4.6 (NOB-102/103/104) | Planejamento sobre estado errado; dependência NOB-94 violada |
| Falso verde local | `describe.skip` sem envs | Dev acredita que integração passou |
| Testes REST excluídos | `jest.config.ts:26-35` | REST de Medicina novo pode cair no mesmo harness quebrado |

## 8. Dependências

- NOB-109 ← NOB-98 (validação), NOB-101 (fluxo), NOB-111, NOB-112, NOB-113 (Lista C, Dr. Alcides).
- NOB-110 ← NOB-101, NOB-108, NOB-112, NOB-113.
- NOB-98 ← decisão de autorização (Expedito/Dr. Alcides/Douglas) + retarget/CI/merge da #112.
- NOB-121 ↔ NOB-98: mesma decisão de identidade profissional.
- NOB-122/123 ← NOB-121.
- Ordem de integração Rikelvin: #109 → #110 → #111 (todas mergeadas) → #112 (aberta).

## 9. Decisões pendentes

| Decisão | Para quem |
| --- | --- |
| Quem valida/rejeita riscos para PCMSO e o que a validação significa clinicamente | **Dr. Alcides** |
| Quem concede/revoga autorização; profissional externo/clínica parceira tem acesso? | **Expedito** |
| Identidade do profissional (vínculo `medicos` ↔ usuário Clerk) e modelo de papéis/escopo por empresa | **Douglas** (com Rikelvin) |
| Persistência da revisão (append-only vs UPDATE) e migration correspondente | **Rikelvin** (aprovação Douglas) |
| NOB-111 reescopada sobre a #112? NOB-121 assume a modelagem de identidade profissional? | **Douglas** + **Carlos** |
| Retarget da #112 para develop, resolver conflito Postman, rodar CI, decidir merge (implica migration em homolog) | **Rikelvin** / **Douglas** |
| Atualizar status Linear de NOB-102/103/104 e destino da NOB-94 | **Rikelvin** / **Douglas** |
| Significado, fonte e versão da Lista C | **Dr. Alcides** (Carlos registra) |
| Registrar perguntas/decisões como comentários no Linear (NOB-98, NOB-113) | **Coordenador / Carlos** |

## 10. Recomendações

1. Registrar a pergunta de §4.7 como comentário na NOB-98, mencionando Expedito/Dr. Alcides/Douglas (ação do coordenador; este agente não escreve no Linear).
2. Usar o contrato `medical_risk_sources/entries` como única fonte PGR → Medicina; não criar leitura paralela de `risks`.
3. Reescopar NOB-111 sobre a #112; concentrar identidade/autorização profissional na NOB-121.
4. Para cada tabela nova de Medicina: `runIsolationSuite` + policy RESTRICTIVE `companyModuleScope(..., 'medicine')` + teste "sem módulo".
5. Criar seed de Medicina (`medicos`, exames, fontes) espelhando `pgr-seed.ts`, com dados fictícios.
6. Testar REST de Medicina no padrão de `rest-health-exams.test.ts` (que roda) e não no dos `rest-*` excluídos.
7. Adicionar E2E protected de Medicina (cenários 1, 6, 9, 12, 13, 18) usando `portal.py`/`flow.py` como roteiro; avaliar Playwright no CI.
8. Combinar numeração de migration com Rikelvin antes de gerar qualquer migration de Medicina; lembrar que merge em develop migra homolog.
9. Rodar `npm run test:integration` com `INTEGRATION_*` definidas e conferir que nada saiu como "skipped".

## 11. Nível de confiança

- Dados do Linear (status, responsáveis, relações, 0 comentários): **alto** (lidos via API).
- Pergunta pendente da NOB-98: **alto** quanto ao conteúdo (literal em 3 docs + corpo da PR); **médio** quanto ao destinatário real ("ao usuário" = operador da sessão do Rikelvin; não há registro de envio a Expedito/Dr. Alcides).
- Estado das PRs/CI/CD: **alto** (gh). Aplicação efetiva de 0053 em homolog: **médio** (inferida do job success, logs não lidos).
- Mapa de testes: **alto** para o que existe (arquivos lidos); cobertura real **não comprovada** (nada executado).

## 12. O que não foi possível verificar

- **Nenhum teste executado** (sem `node_modules` na worktree; proibido instalar). Nenhum resultado declarado aprovado.
- Se a pergunta da NOB-98 chegou a Expedito/Dr. Alcides por outro canal (WhatsApp/reunião): sem registro acessível.
- Logs do CD (passo de migrate) e estado do banco de homolog.
- Rulesets/checks obrigatórios (API 403 no plano atual).
- Motivo da diferença 8 × 9 suítes excluídas citada na #112.
- Conteúdo do documento Linear "Assinatura Pro" (não relevante a Medicina; não lido na íntegra).
- Conteúdo integral de `scripts/ci-integration-bootstrap.sql`, `tests/e2e/support/global.setup.ts` e do teste `medical-risk-sources.test.ts` da #112.
- Histórico do Linear anterior a 2026-10-17 (projeto criado nessa data).
