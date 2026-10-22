# Medicina Ocupacional: entrada única da frente

> **Comece por aqui.** Esta pasta é a estrutura permanente de implementação e acompanhamento da Medicina Ocupacional
> do PGR-e. A navegação abaixo foi acrescentada em **2026-10-21**. Logo depois dela vem, **sem alterações de conteúdo**,
> o README original da Fase 0 (auditoria), que é registro histórico. Frases de status dele (por exemplo, "pasta não
> commitada") refletem aquele momento.

## Estado atual (atualizado em 2026-10-21)

| Lote                                             | Nome                       | Estado                                                                                                                 | Próxima ação                                    |
| ------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [00](lotes/00-alinhamento-e-contratos/README.md) | Alinhamento e contratos    | `EM_EXECUCAO`                                                                                                          | Autorizar o comentário de atualização na NOB-98 |
| [01](lotes/01-ficha-saude-ocupacional/README.md) | Ficha de saúde ocupacional | `PR_ABERTA` — [#120](https://github.com/Projetos-sst/pgr/pull/120) em draft (implementado, testado, revisado em 21/10) | CI verde, revisão do Douglas, aceite            |
| [02](lotes/02-formularios-e-auditoria/README.md) | Formulários e auditoria    | `PLANEJADO` (proposta executável em [PROPOSTA-EXECUCAO](lotes/02-formularios-e-auditoria/PROPOSTA-EXECUCAO.md))        | Migrations aguardam MED-DEC-08/26               |
| [03](lotes/03-identidade-e-riscos/README.md)     | Identidade e riscos        | `BLOQUEADO` (parcial)                                                                                                  | Coletar MED-DEC-02…07                           |
| [04](lotes/04-aso/README.md)                     | ASO                        | `PLANEJADO`                                                                                                            | Depende do Lote 03 e do Douglas                 |
| [05](lotes/05-pcmso/README.md)                   | PCMSO                      | `BLOQUEADO`                                                                                                            | Aguarda a NOB-98                                |
| [06](lotes/06-clinicas-e-portais/README.md)      | Clínicas e portais         | `BLOQUEADO`                                                                                                            | Aguarda escopo de portais (MED-DEC-21)          |
| [07](lotes/07-homologacao/README.md)             | Homologação                | `PLANEJADO`                                                                                                            | Definir o responsável no Linear                 |

Fonte da verdade do estado: [geral/02-ROADMAP-E-STATUS.md](geral/02-ROADMAP-E-STATUS.md). Se divergir desta tabela, vale o roadmap.

**Decisões prioritárias:**

- **MED-DEC-01**, quem concede a autorização para validar riscos: `PARCIALMENTE_RESPONDIDA`. Resposta de Expedito no grupo,
  21/10/2026: a empresa define quem autoriza, e os dados do profissional devem ser registrados.
- O que falta: MED-DEC-02…07. Também em aberto: MED-DEC-08 (ordem da PR #112) e MED-DEC-10 (dono da identidade profissional).
- Registro completo em [geral/04-DECISOES-E-BLOQUEIOS.md](geral/04-DECISOES-E-BLOQUEIOS.md).

## Navegação

| Onde                                                                       | O quê                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [geral/01-CONTEXTO-E-ESCOPO.md](geral/01-CONTEXTO-E-ESCOPO.md)             | Produto, equipe, limites da Medicina, protótipo, o que não copiar, princípios                                                               |
| [geral/02-ROADMAP-E-STATUS.md](geral/02-ROADMAP-E-STATUS.md)               | Tabela de lotes, estados, histórico de mudanças                                                                                             |
| [geral/03-ARQUITETURA-E-CONTRATOS.md](geral/03-ARQUITETURA-E-CONTRATOS.md) | Stack, tenancy, módulos, contratos existentes, em desenvolvimento, bloqueados e propostos                                                   |
| [geral/04-DECISOES-E-BLOQUEIOS.md](geral/04-DECISOES-E-BLOQUEIOS.md)       | Registro central de decisões (`MED-DEC-NN`) e o comentário proposto para a NOB-98                                                           |
| [geral/05-SEGURANCA-E-DADOS.md](geral/05-SEGURANCA-E-DADOS.md)             | Regras obrigatórias: implementado, proposto, bloqueado, não verificado                                                                      |
| [geral/06-GIT-MIGRATIONS-CD.md](geral/06-GIT-MIGRATIONS-CD.md)             | Branches, PR, CI, **CD que aplica migrations**, checklist de migration                                                                      |
| [geral/07-CRITERIOS-DE-ENTREGA.md](geral/07-CRITERIOS-DE-ENTREGA.md)       | Definition of Done geral e por lote                                                                                                         |
| [geral/08-HANDOFF.md](geral/08-HANDOFF.md)                                 | **Onde paramos e qual é o próximo passo exato.** Modelo de atualização por sessão                                                           |
| [geral/09-LINEAR-E-RESPONSAVEIS.md](geral/09-LINEAR-E-RESPONSAVEIS.md)     | Issues por lote, responsáveis, dependências, divergências Linear × GitHub                                                                   |
| [lotes/](lotes/)                                                           | Uma pasta por lote: `README`, `AUDIT`, `PLAN`, `TASK`, `WALKTHROUGH`, `QA`, `REVIEW`                                                        |
| [templates/](templates/)                                                   | Modelos para os documentos de lote                                                                                                          |
| Fase 0 (abaixo e na raiz)                                                  | Auditoria original: `AUDIT-*.md`, `GAP-MATRIX.md`, `DECISIONS.md`, `DEPENDENCIES.md`, `IMPLEMENTATION-PLAN.md`, `FIRST-MVP.md`, `capturas/` |

**Git e Linear:**

- Branch do Lote 01: `feature/NOB-108-ficha-saude-ocupacional`.
- Projeto Linear: <https://linear.app/nobuggy/project/pgr-3cc61587654a>.
- NOB-98 é do Rikelvin (PR #112).

**Atenção aos IDs:**

- A Fase 0 usa "D-xx" em três listas diferentes: `DECISIONS.md` (D-01…D-14), `AUDIT-SECURITY.md` (D1…D10) e `AUDIT-PROTOTYPE.md` (D-01…D-12).
- O registro central usa `MED-DEC-NN`. Documentos de lote podem citar os IDs de `DECISIONS.md`.
- A correspondência está em [geral/04 §2.1](geral/04-DECISOES-E-BLOQUEIOS.md#21-correspondência-com-os-ids-da-fase-0).

**Erratas conhecidas da Fase 0** (os documentos originais foram mantidos sem edição):

1. A afirmação de que a pergunta da NOB-98 "não chegou formalmente a ninguém" foi superada: o Rikelvin perguntou no grupo em
   20/10 e o Expedito respondeu em 21/10 (MED-DEC-01).
2. "PRs mergeadas #97–#111" (checkpoint, item 5): a #107 não existe como PR.
3. `AUDIT-PROTOTYPE.md` §1 cita o caminho local do pacote do protótipo. O pacote fica **fora do repositório**, e o caminho
   vale só para a máquina do Carlos.
4. Os e-mails da linha de membros de `AUDIT-LINEAR-QA.md` foram removidos em 21/10, antes do primeiro commit. Foi a única
   edição de conteúdo na Fase 0, além do título deste README.

## Como retomar o trabalho

1. Ler [geral/08-HANDOFF.md](geral/08-HANDOFF.md): estado, branch, próximo passo.
2. Conferir o estado real: `git fetch origin --prune`, `git status`, PRs abertas e o Linear. O handoff pode estar desatualizado.
3. Ler o `README.md` e o `TASK.md` do lote em execução, e as decisões que o afetam em [geral/04](geral/04-DECISOES-E-BLOQUEIOS.md).
4. Seguir [geral/07-CRITERIOS-DE-ENTREGA.md](geral/07-CRITERIOS-DE-ENTREGA.md) e, se houver schema, [geral/06](geral/06-GIT-MIGRATIONS-CD.md).
5. Ao terminar a sessão: atualizar `TASK.md`, `WALKTHROUGH.md` e `QA.md` do lote **só com fatos**, o [roadmap](geral/02-ROADMAP-E-STATUS.md) e o [handoff](geral/08-HANDOFF.md).

---

# Fase 0 (auditoria e plano): README original

> 2026-10-21 · somente leitura · coordenação + 6 subagentes especializados.
> Base auditada: `origin/develop` = **`d6b787c`** (o develop local estava em `e1e3112`, 36 commits atrás), PR aberta
> #112 (`ebfbac3`), Linear (projeto `pgr`, time NOB) e o pacote `Projeto-SST-Ocupacional` (V17, 14/10/2026).
> **Nada foi implementado.** Pasta não commitada; aguarda revisão do Carlos.

## Como ler

| Arquivo                    | Para quê                                                                      |
| -------------------------- | ----------------------------------------------------------------------------- |
| **IMPLEMENTATION-PLAN.md** | Lotes 0–7 ajustados às dependências reais                                     |
| **FIRST-MVP.md**           | Primeira entrega demonstrável (zero migration)                                |
| **DECISIONS.md**           | Decisões pendentes por pessoa + texto proposto para a NOB-98                  |
| **GAP-MATRIX.md**          | Matriz mestra: 37 funcionalidades × estado × issue × lote                     |
| **DEPENDENCIES.md**        | Cadeia crítica e contrato de riscos Segurança → Medicina                      |
| AUDIT-ARCHITECTURE.md      | Código atual, PRs do Rikelvin e do Douglas, CD                                |
| AUDIT-PROTOTYPE.md         | Inventário real do protótipo (64 telas, 8 jornadas, Lista C, 23 divergências) |
| AUDIT-SECURITY.md          | Classes de dado, perfis, RLS, A × B × C, riscos P0–P2                         |
| AUDIT-DATABASE.md          | Schema, PR #112, emissão com snapshot, 9 migrations propostas                 |
| AUDIT-UX.md                | Design system, mapeamento de telas, teal como acento, a11y                    |
| AUDIT-LINEAR-QA.md         | 25 issues, NOB-98 em profundidade, mapa de testes                             |
| `capturas/proto-*.png`     | 6 capturas do protótipo com os dados de exemplo dele (fontes fallback)        |

## Resumo executivo

1. **A base do Rikelvin está em develop e é boa:** módulo por empresa (`company_modules` + RLS RESTRICTIVE + histórico
   append-only), cadastros comuns e serviços por empresa. A Medicina deve **estender** isso, nunca criar paralelo.
2. **A Medicina hoje é registro, não emissão.** Existem `medicos` e `health_exams`. Não existem PCMSO, emissão de ASO,
   assinatura técnica, Lista C, identidade do médico nem papel clínico.
3. **A NOB-98 está travada por uma pergunta que não chegou formalmente a ninguém.** Ela está no corpo da PR #112 e na spec
   (`spec.md:55-59`), não no Linear (0 comentários em todas as 25 issues). A pergunta: _quem concede autorização de validação
   e como identificar o profissional_. Sem isso, nenhum risco fica utilizável no PCMSO (comportamento correto da #112).
4. **O merge em develop aplica migration em homologação; o release em main aplica em produção, sem passo manual**
   (`cd.yml:67-75`). A #112 reservou 0054/0055 e nunca passou por CI (base errada).
5. **Dá para começar já sem pisar em ninguém:** o Lote 1 (ficha de saúde ocupacional) é zero migration, não lê riscos e
   não depende de decisão clínica.

## Revisão cruzada (o que o coordenador conferiu e corrigiu)

| #   | Achado                                                                                                                       | Como foi resolvido                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X-1 | O Agente 3 classificou o bypass dev como P0                                                                                  | Conferido: o ambiente de testes roda `APP_ENV=sandbox`, com HTTP Basic **antes** do Clerk e do bypass (`proxy.ts:98-100`, `vercel.md:95-96`); em produção o bypass é impossível. Rebaixado para **P1**, com nota no AUDIT-SECURITY. Os valores reais da Vercel continuam NÃO VERIFICADOS |
| X-2 | O Agente 1 descreveu a "Lista C" como "catálogo de exames por agente"                                                        | O dado real (Agente 2) é a Lista C do Anexo II do Decreto 3.048/99 (NTEP, CID × CNAE). Corrigido no AUDIT-ARCHITECTURE. Consequência: a Lista C **não** bloqueia o ASO (IMPLEMENTATION-PLAN §1)                                                                                          |
| X-3 | O Agente 2 atribuiu a carga da Lista C ao Rikelvin                                                                           | A NOB-113 é do Carlos no Linear. Corrigido                                                                                                                                                                                                                                               |
| X-4 | O Agente 2 citou "RLS compartilhado" como não reverificado                                                                   | Confirmado no código pelos Agentes 1, 3 e 4. Corrigido                                                                                                                                                                                                                                   |
| X-5 | "8 × 9 suítes excluídas" (PR #112 × develop)                                                                                 | Conferido em `jest.config.ts` de develop: **8**. A diferença vem da #113, que reabilitou `rest-risks`                                                                                                                                                                                    |
| X-6 | Agentes 4 e 6 propuseram modelos de autorização com nomes diferentes (`company_medical_assignments` × `professional_grants`) | Mesmo conceito. Consolidado como P1 (DEPENDENCIES §3.4)                                                                                                                                                                                                                                  |
| X-7 | O Agente 5 propõe periodicidade derivada na ficha                                                                            | Retirado do MVP: periodicidade 12/24 é regra clínica não validada. O MVP mostra só a validade **informada**                                                                                                                                                                              |
| X-8 | Fatos de que todos dependem                                                                                                  | Conferidos diretamente: develop em 0053 e main em 0052; `health_exams` sem `company_id`; `uq_employees_org_cpf`; `medicos` sem usuário e sem UF; `company_modules` sem insert em `createCompany`; `cd.yml` aplica `drizzle-kit migrate` em push                                          |

## Checkpoint (30 perguntas do enunciado)

| #   | Pergunta                          | Resposta curta                                                                                                                                | Onde            |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | Estado real da develop            | `d6b787c`, migration 0053, 7 PRs do Rikelvin + DOCX/CD do Douglas mergeados                                                                   | ARCH §4         |
| 2   | O que o Douglas implementou       | DOCX/PDF do PGR por template, GED versionado, worker, CD Vercel com migrations automáticas (#99–#106)                                         | ARCH §5.4       |
| 3   | O que o Rikelvin implementou      | NOB-97/99/100/101(docs)/102/103/104(docs) mergeadas; NOB-98 em PR aberta                                                                      | ARCH §5.2       |
| 4   | PRs abertas                       | #112 (NOB-98), #115/#116/#117 (drafts NOB-105/106/107)                                                                                        | ARCH §5.5       |
| 5   | PRs mergeadas                     | #97–#111, #113, #114, #118                                                                                                                    | LINEAR §4.6     |
| 6   | Entregas NOB-97/99/100            | Módulo por empresa + RLS + histórico; cadastros comuns com filtro; gestão owner-only com motivo                                               | ARCH §4.6–4.7   |
| 7   | Bloqueio concreto da NOB-98       | Quem concede a autorização de validação e como identificar o profissional (sem dono, sem registro no Linear)                                  | LINEAR §4.7     |
| 8   | Contrato de riscos consumível     | Só `medical_risk_*` da #112; hoje nada fica "validated"                                                                                       | DEPENDENCIES §3 |
| 9   | Entidades existentes              | companies, employees, job*roles, ges, risks\*, medicos, health_exams, documents, jobs, signature*\*, company_modules                          | DB §4.2         |
| 10  | Entidades a criar                 | identidade/designação, procedimentos, auditoria clínica, histórico de função, revisões de risco, PCMSO, emissão, assinatura técnica, datasets | DB §10.4        |
| 11  | Migrations necessárias            | P1–P9 (de 0056 em diante, se a #112 entrar antes); nenhuma no Lote 1                                                                          | DB §10.4        |
| 12  | Isolamento por empresa            | FK composta `(company_id, org_id)` + RESTRICTIVE `companyModuleScope(…, 'medicine')` + `assertCompanyModuleTx`                                | ARCH §10        |
| 13  | Proteger dados clínicos           | A agora, evoluindo para B: tabelas clínicas separadas, papel clínico no servidor e na RLS, auditoria de leitura, bucket próprio, nada em IA   | SEC §10.3       |
| 14  | Quem consulta cada dado           | Matriz perfis × classes (proposta; hoje só existe "escritório")                                                                               | SEC §10.2       |
| 15  | Fluxo de ASO                      | registro (existe) → emissão com snapshot imutável → ciência → assinatura técnica (provedor)                                                   | DB §10.3        |
| 16  | Fluxo de PCMSO                    | fontes validadas → programa/versão → plano de exames → emissão → assinatura do coordenador                                                    | DB P6           |
| 17  | PGR externo                       | Fonte `external` da #112 (sempre pendente); NOB-111 reescopada para UX + GED                                                                  | DEPENDENCIES §3 |
| 18  | Lista C                           | Protótipo: 18 grupos, sem M e S/T, "base parcial"; fonte oficial não conferida                                                                | PROTO §5.12     |
| 19  | Telas do protótipo                | 64 + 3 componentes (P-01…P-64, C-01…C-03)                                                                                                     | PROTO §5.13     |
| 20  | Telas do PGR para Medicina        | `/health-exams`, `/medicos`, `/companies/[id]/services`, psicossocial (no PGR)                                                                | UX §4.3         |
| 21  | Fluxos que precisam de integração | Riscos → PCMSO/ASO (NOB-98); documentos → GED/worker (Douglas); identidade ↔ Clerk                                                            | DEPENDENCIES §1 |
| 22  | Testes aproveitáveis              | `runIsolationSuite`, `pgr-seed`, `company-modules`, `rest-health-exams`, `service-orders` (snapshot)                                          | LINEAR §5.4     |
| 23  | Primeiro MVP                      | Ficha de saúde ocupacional (zero migration)                                                                                                   | FIRST-MVP       |
| 24  | Lotes                             | 0 decisões → 1 MVP → 2 persistência → 3 identidade/riscos/Lista C → 4 ASO → 5 PCMSO → 6 clínicas → 7 homologação                              | PLAN            |
| 25  | Decisões do Douglas               | D-01…D-14                                                                                                                                     | DECISIONS       |
| 26  | Decisões do Expedito              | E-01…E-08                                                                                                                                     | DECISIONS       |
| 27  | Decisões do Dr. Alcides           | A-01…A-09                                                                                                                                     | DECISIONS       |
| 28  | O que começa já                   | Lote 1 (Carlos); Lote 0 (decisões + retarget da #112)                                                                                         | PLAN            |
| 29  | O que não começa ainda            | Migrations antes da ordem da #112; P5/P6 antes da NOB-98; P2 antes da fonte; arquivamento antes do prazo; P8 antes do provedor                | PLAN            |
| 30  | Próximo prompt                    | Ver abaixo                                                                                                                                    | —               |

## Critérios de aceite da auditoria (estado honesto)

| Critério                                                                 | Estado                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLAUDE.md lido                                                           | OK (o da develop está desatualizado: diz migration 0030)                                                                                                       |
| Git auditado / develop verificada                                        | OK                                                                                                                                                             |
| PRs do Rikelvin verificadas                                              | OK (#108–#114, #118; #112 aberta)                                                                                                                              |
| Trabalho do Douglas mapeado                                              | OK                                                                                                                                                             |
| MCP Linear verificado                                                    | OK (leitura; nada escrito)                                                                                                                                     |
| Issues de Medicina, comentários e dependências                           | OK (0 comentários em todas)                                                                                                                                    |
| NOB-98 como dependência pendente                                         | OK                                                                                                                                                             |
| ZIP localizado                                                           | **PARCIAL**: a pasta descompactada está em `Documentos\Projeto-SST-Ocupacional\` (21 arquivos, íntegros); o `.zip` em si não foi localizado nem era necessário |
| DOCX, HTML, XLSX analisados                                              | OK (.docx comparado ao .md; XLSX via stdlib)                                                                                                                   |
| Scripts do protótipo analisados                                          | OK, **lidos e não executados**                                                                                                                                 |
| Protótipo, domínios e banco mapeados                                     | OK (o banco **pelo código**; estado real de homolog e produção NÃO VERIFICADO)                                                                                 |
| Migrations propostas                                                     | OK (só descritas; nenhum arquivo)                                                                                                                              |
| RLS, permissões e perfis clínicos                                        | OK (perfis são proposta)                                                                                                                                       |
| Documentos mapeados                                                      | OK                                                                                                                                                             |
| Lista C auditada                                                         | **PARCIAL**: conteúdo do protótipo auditado; conferência com a fonte oficial NÃO FEITA (exige o Dr. Alcides)                                                   |
| Contratos de risco, telas, gap matrix, dependências, lotes, MVP          | OK                                                                                                                                                             |
| Revisão cruzada                                                          | OK (8 itens acima)                                                                                                                                             |
| Nenhum arquivo funcional alterado                                        | OK: só esta pasta, **não rastreada**                                                                                                                           |
| Nenhuma migration executada / nenhum dado real modificado / nenhum merge | OK                                                                                                                                                             |
| Testes executados                                                        | **NÃO**: nenhum teste foi rodado nesta fase; as contagens citadas vêm dos documentos das PRs                                                                   |

**Efeitos colaterais registrados:**

- Foi criada uma worktree somente leitura de `origin/develop` no scratchpad da sessão (metadado em `.git/worktrees/`;
  remover com `git worktree remove <caminho>`).
- Foram executados `git fetch` (só refs remotas).
- O Agente 5 abriu o HTML do protótipo uma vez no Playwright, com rede bloqueada e só os dados de exemplo do próprio
  protótipo, e fechou em seguida.

## O que não foi possível verificar

- Estado real dos bancos de homologação e produção (quais migrations estão aplicadas).
- Variáveis da Vercel (`APP_ENV`, `DEV_API_AUTH_BYPASS`).
- MFA do Clerk, backups do Supabase e política de retenção do OpenRouter.
- Se a pergunta da NOB-98 chegou às partes interessadas por outro canal.
- Se o artifact on-line do protótipo tem dados reais.
- Qualquer conformidade normativa (NR-7, Decreto 3.048/99, CFM): **nada aqui é parecer jurídico ou clínico**.

## Próximo prompt recomendado

Depois que o Carlos aprovar FIRST-MVP.md e o Douglas aceitar o Lote 0:

> "Executar o Lote 1 da Medicina (NOB-108) conforme `docs/planning/medicina-ocupacional/FIRST-MVP.md`: branch
> `feature/NOB-108-ficha-saude-ocupacional` a partir de `origin/develop` atualizado (dev server parado), zero migration,
> Action + REST + api-design + Postman para o resumo do painel, testes unit e integração em Postgres efêmero, `npm run check`
> e `test:integration` sem suítes skipped, validação no navegador com dados fictícios. Não abrir PR sem revisão."
