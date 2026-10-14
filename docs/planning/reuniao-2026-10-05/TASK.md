# Task — Reunião de 05/10/2026

Checklist derivado de [AUDIT.md](AUDIT.md) e [PLAN.md](PLAN.md). **Nenhuma tarefa funcional está
marcada**: nesta execução houve apenas auditoria do Docker e do sistema. A execução começa depois das
decisões bloqueantes (seção 0) e da autorização do usuário.

Cada tarefa traz: **req.** (ID do requisito) · **módulo** · **dep.** (dependência) · **aceite** ·
**teste** · **resp.** (responsável).

Marcado abaixo só o que **realmente aconteceu** nesta execução (seção 1).

> **Atualização de 09/10/2026 — Portal público.** Parte dos lotes C, D e E foi implementada e
> está documentada em [`portal-publico/`](portal-publico/PORTAL-TASK.md): landing, páginas das
> duas vertentes (R04/R09), correções do login (R05/R06) e o pré-cadastro de interessados. As
> decisões 3, 4 e 8 da seção 0 foram resolvidas lá. O checklist funcional **deste** arquivo
> continua valendo para o que ainda não foi feito.

---

## 0. Decisões bloqueantes

- [ ] **D1** — Contrato com o Douglas: aceitar os 3 campos opcionais de `PgrConsolidated`
      (AUDIT §20) e definir onde o template imprime hierarquia por função, treinamentos e
      `resultGuidance`. _Bloqueia: Lote A._ · resp.: Douglas + nós
- [ ] **D2** — Pré-cadastro de interessados: grava no banco, dispara e-mail, ou os dois? Quais campos
      são obrigatórios? _Bloqueia: Lotes D e E._ · resp.: usuário
- [ ] **D3** — "Solicitar Orçamento" é formulário próprio ou o mesmo pré-cadastro com outra chamada?
      _Bloqueia: Lotes D e E._ · resp.: usuário
- [ ] **D4** — Áreas Saúde/Segurança na landing: seções da mesma página ou rotas próprias
      (`/saude`, `/seguranca`)? _Bloqueia: Lotes D e G._ · resp.: usuário
- [ ] **D5** — Divisão Saúde × Segurança no menu é só visual ou também por papel de acesso?
      _Bloqueia: Lote G._ · resp.: usuário
- [ ] **D6** — "minimizar" (reunião) × `collective_protection` (sistema) são o mesmo nível?
      _Bloqueia: rótulos dos Lotes A e B._ · resp.: profissional de SST
- [ ] **D7** — No PGR impresso, treinamentos saem por função, por GES ou em tabela geral?
      _Bloqueia: Lote A._ · resp.: usuário + Douglas
- [ ] **D8** — Afirmação "IA com 92% de precisão" vai para a landing pública? Com que fonte?
      _Bloqueia: Lote D._ · resp.: usuário
- [ ] Decisões registradas no AUDIT e no PLAN; marcadores de bloqueio removidos

---

## 1. Auditoria desta execução (concluída)

- [x] Docker inventariado, classificado por projeto e limpo com segurança — ≈3,44 GB liberados,
      zero volumes/containers removidos ([DOCKER-AUDIT.md](DOCKER-AUDIT.md))
- [x] Smoke test dos serviços essenciais: PGR (banco remoto, RLS, Gotenberg) e Site-PMPA
      (frontend, Strapi, Postgres, Adminer) — todos operacionais
- [x] `git fetch --prune`, `develop` sincronizada em `f7e417d`, branch
      `feature/reuniao-2026-10-05-pgr-portal` criada
- [x] Branch `feature/lot-04-cnae-cbo` preservada em `8dd86a9` (não apagada, não modificada, não
      rebaseada, sem PR)
- [x] Inventário real: 128 páginas, 144 rotas REST, 61 tabelas, 52 migrations, 118+160 arquivos de
      teste
- [x] Auditoria de backend dos 16 requisitos (schema, domain, repository, Actions, REST, tenant,
      testes, componentes)
- [x] Verificação funcional das telas públicas pela UI real (`:3001`) via Playwright
- [x] Responsividade de `/`, `/sign-in` e `/sign-up` medida em 375×812, 768×1024 e 1440×900
- [x] Baseline `npm run check` **verde** (0 erros, 4 warnings pré-existentes, 143 suites / 1367
      testes unit)
- [x] Trabalho do Douglas localizado e classificado sem sobrescrever nada
- [x] `AUDIT.md`, `PLAN.md`, `TASK.md` e `DOCKER-AUDIT.md` criados
- [x] Zero arquivos funcionais alterados · zero migration · zero PR · zero merge

---

## 2. Lote A — Contrato de dados do PGR por função

Zero migration. Primeiro da fila: é o único lote que destrava outra pessoa.

- [ ] **A1** — Tipo `ConsolidatedJobRole` no domínio do consolidado
      · req. R01/R03 · módulo `domains/pgr/pgr-consolidated.ts` · dep. D1
      · aceite: contrato idêntico ao publicado em AUDIT §20; campos opcionais; nenhuma fixture antiga
      quebra · teste: unit de tipo + suíte existente de `pgr-pdf-template` verde sem alteração
      · resp. nós
- [ ] **A2** — `groupMeasuresByControlLevel` (função pura)
      · req. R01 · módulo `domains/pgr/control-measure.ts` · dep. A1
      · aceite: devolve sempre os 4 níveis na ordem canônica, inclusive vazios
      · teste: unit (4 níveis, nível vazio, ordem, medida não aplicável) · resp. nós
- [ ] **A3** — `resultGuidance` no risco consolidado
      · req. R02 · módulo `domains/pgr/pgr-consolidated.ts` · dep. A1
      · aceite: reusa `riskClassificationGuidance` **sem reescrever texto normativo**; risco sem
      avaliação → `null` · teste: unit das 5 classes + caso nulo · resp. nós
- [ ] **A4** — JOINs no repositório do consolidado
      · req. R01/R03 · módulo `db/repositories/pgr-consolidated.ts` · dep. A1
      · aceite: dentro do mesmo `withOrg`/transação; sem N+1; função em 2 GES não duplica
      · teste: integração (2 GES × funções compartilhadas, função sem treinamento, função sem medida,
      **cross-tenant**, PGR sem GES) · resp. nós
- [ ] **A5** — `normalizeReferenceNorm` (se D7 exigir agrupar por NR)
      · req. R03 · módulo `domains/pgr/trainings.ts` · dep. D7
      · aceite: "NR 6" / "NR06" / "nr-6" → mesma chave; valor desconhecido passa intacto
      · teste: unit com variações de grafia · resp. nós
- [ ] **A6** — Funções e treinamentos visíveis na aba consolidada do PGR
      · req. R01/R03 · módulo `pgr/[id]/_components/pgr-consolidated-tab.tsx` · dep. A4
      · aceite: dado real na tela antes de ir ao PDF; sem dado → empty-state do projeto, nunca dado
      fictício · teste: QA Playwright em tenant de QA · resp. nós
- [ ] **A7** — Medir custo do consolidado antes/depois e registrar
      · req. R16 · módulo repositório · dep. A4
      · aceite: tempo registrado no REVIEW; sem regressão inaceitável em PGR grande
      · teste: medição manual com massa de QA · resp. nós
- [ ] **A8** — Enviar o contrato ao Douglas **antes do merge**
      · req. R16 · módulo documentação · dep. A1–A4
      · aceite: confirmação dele sobre forma e nomes · teste: n/a · resp. nós → Douglas

---

## 3. Lote B — Visão de função na interface

Zero migration. Depende do Lote A mergeado.

- [ ] **B1** — Rota nova `/job-roles/[id]` (detalhe da função)
      · req. R01 · módulo `app/(protected)/job-roles/[id]/page.tsx` · dep. Lote A
      · aceite: identificação + GES vinculados com `worker_count` + 2 seções (hierarquia,
      treinamentos); `PageHeader` com `backHref`; wrapper central
      · teste: integração da leitura + QA Playwright · resp. nós
- [ ] **B2** — Seção de hierarquia de controle por função
      · req. R01 · módulo `job-roles/[id]/_components/` · dep. B1, D6
      · aceite: 4 níveis na ordem canônica; nível sem medida aparece explicitamente vazio; rótulos
      pelo domínio (`controlLevelLabel`), nunca string solta
      · teste: componente (nível vazio) + QA · resp. nós
- [ ] **B3** — Seção de treinamentos obrigatórios no detalhe
      · req. R03 · módulo `job-roles/[id]/_components/` · dep. B1
      · aceite: norma, carga horária e periodicidade; função sem treinamento → empty-state
      · teste: componente + QA · resp. nós
- [ ] **B4** — `required-trainings.tsx` também em `/job-roles/new`
      · req. R03 · módulo `app/(protected)/job-roles/new/page.tsx` · dep. B1
      · aceite: marcar treinamento sem precisar salvar e reabrir a função
      · teste: QA Playwright (criar função já com treinamentos) · resp. nós
- [ ] **B5** — Superfícies REST + docs + Postman da leitura por função
      · req. R01/R03 · módulo `app/api/v1/job-roles/[id]/**` · dep. B1
      · aceite: as 4 superfícies obrigatórias (Action, REST, `api-design.md`, Postman); mesmos códigos
      de erro · teste: integração REST + cross-tenant + `FORBIDDEN` · resp. nós
- [ ] **B6** — Link para o detalhe na listagem `/job-roles`
      · req. R01 · módulo `job-roles/page.tsx` · dep. B1
      · aceite: `RowActions`/`EditIconLink` do kit, sem componente novo · teste: QA · resp. nós

---

## 4. Lote C — Correções de acesso e login

Zero migration. Independente — pode entrar primeiro.

- [ ] **C1** — Corrigir overflow horizontal de `/sign-in` e `/sign-up`
      · req. R05 · módulo `app/_components/auth-frame.tsx` · dep. nenhuma
      · aceite: `scrollWidth <= clientWidth` em 375×812 **e** 768×1024 (hoje 399×360 e 765×753);
      1440×900 continua correto; **nenhuma** mudança de autenticação
      · teste: Playwright nas 3 viewports com assert numérico · resp. nós
- [ ] **C2** — `clerkAppearance` herdando os tokens do design system
      · req. R06 · módulo `app/_components/clerk-appearance.tsx` · dep. nenhuma
      · aceite: indigo `#5b63f5`, Manrope, raio de 11px no miolo do widget; nenhuma cor nova
      · teste: QA visual nas 3 viewports · resp. nós
- [ ] **C3** — Renomear a aplicação no dashboard do Clerk ("sst-manager" → PGR-e)
      · req. R05/R06 · módulo ambiente (não é código) · dep. nenhuma
      · aceite: o widget deixa de anunciar "para continuar em sst-manager"
      · teste: conferência visual na tela de login · resp. dono da conta Clerk
- [ ] **C4** — Regressão de autenticação
      · req. R05 · módulo `proxy.ts` / `(protected)/layout.tsx` · dep. C1
      · aceite: rota protegida sem sessão continua redirecionando para `/sign-in?redirect_url=…`;
      usuário sem organização continua provisionando tenant pessoal
      · teste: integração + Playwright · resp. nós

---

## 5. Lote D — Landing pública (apresentação)

Zero migration. Bloqueado por D2, D3, D4 e D8.

- [ ] **D1t** — Extrair o pitch da plataforma para módulo compartilhado
      · req. R04/R06 · módulo `app/_components/platform-pitch.ts` · dep. D8
      · aceite: `AuthFrame` e landing leem a **mesma** fonte; zero texto duplicado
      · teste: unit do módulo + QA das duas telas · resp. nós
- [ ] **D2t** — Reescrever `(public)/page.tsx` com apresentação e CTAs
      · req. R04 · módulo `app/(public)/page.tsx` · dep. D1t, D3, D4
      · aceite: apresentação da plataforma, área Saúde, área Segurança, botão Login e botão Solicitar
      Orçamento presentes na UI real · teste: Playwright verificando os 5 elementos · resp. nós
- [ ] **D3t** — Identidade visual na landing
      · req. R06 · módulo `(public)/page.tsx` + `globals.css` (só se faltar token) · dep. D2t
      · aceite: usa os tokens existentes; **nenhum** token novo sem necessidade; coerente com as telas
      internas já aprovadas · teste: QA visual nas 3 viewports · resp. nós
- [ ] **D4t** — Rotas `/saude` e `/seguranca` (**só** se D4 decidir rotas próprias)
      · req. R04 · módulo `app/(public)/**` + `proxy.ts` · dep. D4
      · aceite: rotas liberadas em `isPublicRoute`; nenhuma rota protegida exposta por engano
      · teste: integração de rota pública + Playwright · resp. nós
- [ ] **D5t** — Responsividade da landing
      · req. R04/R06 · módulo `(public)/page.tsx` · dep. D2t
      · aceite: `scrollWidth <= clientWidth` em 375/768/1440 · teste: Playwright · resp. nós

---

## 6. Lote E — Pré-cadastro de interessados

**Tem migration.** Bloqueado por D2, D3 e pelo desenho de isolamento.

- [ ] **E1** — Desenho de isolamento da escrita pública, aprovado antes de qualquer código
      · req. R04 · módulo decisão de arquitetura · dep. D2
      · aceite: definido se a tabela é global (padrão `caepi_certificates`) ou de tenant; definida a
      policy (`INSERT` ao `app_runtime`, `SELECT` restrito) considerando o event trigger `ensure_rls`
      de produção · teste: n/a · resp. nós + usuário
- [ ] **E2** — Schema da tabela de pré-cadastro
      · req. R04 · módulo `db/schema/` · dep. E1
      · aceite: campos conforme D2; `enableRLS()` com policy desenhada em E1
      · teste: integração aplicando migration do zero em Postgres efêmero · resp. nós
- [ ] **E3** — Migration com `GRANT` + trigger `set_updated_at` como SQL custom
      · req. R04 · módulo `db/migrations/` · dep. E2
      · aceite: número **conferido no journal real na hora** (nunca reservado); `tag` do journal
      coerente; aplica do zero em banco novo · teste: integração · resp. nós
- [ ] **E4** — Ação pública de pré-cadastro, sem `officeAction`
      · req. R04 · módulo `shared/server/actions/public/` · dep. E2
      · aceite: sem tenant e sem papel (espelha o precedente da ação pública de assinatura); payload
      validado por Zod · teste: integração (grava; leitura pública negada; payload inválido →
      `VALIDATION`) · resp. nós
- [ ] **E5** — Rate limiting + honeypot na rota pública
      · req. R04 · módulo rota pública · dep. E4
      · aceite: limite por IP ativo; não entregar sem ele; nenhum dado pessoal logado em claro
      · teste: integração disparando o limite · resp. nós
- [ ] **E6** — Formulário de orçamento na landing ligado à ação
      · req. R04 · módulo `(public)/page.tsx` · dep. E4, D3
      · aceite: sucesso e erro com o vocabulário do projeto; sem cor nova
      · teste: Playwright (envio válido, inválido, limite) · resp. nós

---

## 7. Lote F — Hub unificado de EPI

Zero migration. **Nenhuma funcionalidade nova** — tudo já existe (AUDIT §13).

- [ ] **F1** — Página `/epi` (hub) com os KPIs que já existem
      · req. R07 · módulo `app/(protected)/epi/page.tsx` · dep. nenhuma
      · aceite: reusa `episLowStock`/`episPendingReturn`/`episCaExpired`/`episCaDueSoon`; widget sem
      dado usa empty-state, **nunca** dado fictício · teste: integração das contagens isoladas por
      tenant + QA · resp. nós
- [ ] **F2** — Página `/epi-deliveries` (listagem de entregas)
      · req. R07 · módulo `app/(protected)/epi-deliveries/page.tsx` · dep. nenhuma
      · aceite: entrega deixa de ser alcançável só por `/employees/[id]`; kit `_ui/data-list.tsx`
      · teste: integração da listagem + cross-tenant + QA · resp. nós
- [ ] **F3** — Consolidar as entradas de EPI no menu
      · req. R07 · módulo `_components/nav-menu.tsx` · dep. F1, F2
      · aceite: uma seção de EPI em vez de 3 itens em 2 grupos; só rotas reais
      · teste: componente do menu + QA · resp. nós
- [ ] **F4** — Links cruzados ficha ↔ entrega ↔ devolução
      · req. R07 · módulo telas de EPI e de funcionário · dep. F2
      · aceite: ida e volta sem passar pelo menu · teste: QA Playwright do caminho completo
      · resp. nós

---

## 8. Lote G — Portal Saúde × Segurança

Zero migration. Bloqueado por D5 (e por D4, que molda a landing).

- [ ] **G1** — Reorganizar o mega-menu em duas vertentes
      · req. R09 · módulo `_components/nav-menu.tsx` · dep. D5
      · aceite: SAÚDE e SEGURANÇA no primeiro nível; cada módulo em um lugar só; **só rotas reais**
      · teste: componente verificando que toda rota do menu existe · resp. nós
- [ ] **G2** — Distinção visual leve entre as vertentes
      · req. R09/R06 · módulo menu + tokens existentes · dep. G1
      · aceite: usa só os tokens atuais; nenhuma cor nova · teste: QA visual · resp. nós
- [ ] **G3** — Separação por papel (**só** se D5 decidir que também é de acesso)
      · req. R09 · módulo autorização · dep. D5
      · aceite: vira **lote próprio** de autorização, não de menu; nenhuma permissão relaxada
      · teste: integração de autorização por papel · resp. nós
- [ ] **G4** — Navegação nas 3 viewports
      · req. R09 · módulo menu · dep. G1
      · aceite: mega-menu usável em 375px; `scrollWidth <= clientWidth` · teste: Playwright
      · resp. nós

---

## 9. Lote H — Modelos oficiais de inspeção (bloqueado)

- [ ] **H1** — Receber os modelos oficiais do Expedito
      · req. R08 · dep. material externo · aceite: arquivos reais em mãos · resp. **Expedito**
- [ ] **H2** — Avaliar se os modelos exigem resposta não-booleana
      · req. R08 · módulo `db/schema/inspections.ts` · dep. H1
      · aceite: decisão registrada; hoje `inspection_item_responses.value` é `boolean` + observação
      · teste: n/a · resp. nós
- [ ] **H3** — Importar os modelos como planos + itens (script idempotente)
      · req. R08 · módulo `scripts/` · dep. H1, H2
      · aceite: importação idempotente; **nenhum modelo fictício** criado
      · teste: integração do import + reimport sem duplicar · resp. nós
- [ ] **H4** — Migration de tipos de resposta (**só** se H2 confirmar necessidade)
      · req. R08 · módulo `db/schema` + `db/migrations` · dep. H2
      · aceite: vira lote de modelagem próprio, análogo às fatias 006/008/023; número conferido na
      hora · teste: integração aplicando do zero · resp. nós

---

## 10. Trabalho do Douglas — não tocar

- [ ] **X1** — Confirmar com o Douglas onde está o template atualizado
      · req. R15 · aceite: branch/PR publicada ou aviso de que segue local · resp. **Douglas**
- [x] Template do PGR **não** modificado nesta execução
- [x] Lógica de preenchimento do PDF **não** modificada nesta execução
- [x] Nenhum arquivo de `pgr-pdf-template.ts`, `pgr-pdf-core.ts`, `pdf-batch-core.ts`,
      `api/v1/pgr/[id]/pdf` ou `integrations/pdf/*` alterado
- [ ] **X2** — Mapear conflito antes de cada lote que mexa em `pgr-consolidated.ts`
      · req. R16 · aceite: só extensão aditiva com campos opcionais · resp. nós

---

## 11. Regras de git (toda a frente)

- [x] Branch única `feature/reuniao-2026-10-05-pgr-portal`, criada da `develop` atual
- [x] `feature/lot-04-cnae-cbo` congelada
- [x] Commit só de documentação nesta etapa
- [x] Nenhuma PR aberta · nenhum merge
- [ ] Antes de cada lote: `git fetch origin --prune && git rebase origin/develop`
- [ ] Antes de gerar migration: conferir a **última migration real** no journal (hoje `0051`) —
      nunca reservar número
- [ ] Uma PR por lote, ao final; o merge é do usuário
- [ ] Board: issue entregue → _In review_; nada como _Done_ sem merge
