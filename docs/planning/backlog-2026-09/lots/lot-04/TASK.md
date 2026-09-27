# Lote 4 — Task

Checklist da implementação do lote — **nada funcional marcado**: nesta execução só houve auditoria e
planejamento. A execução começa depois da resposta da pergunta bloqueante ([AUDIT.md](AUDIT.md)) e da
sua autorização. Tudo numa branch só (`feature/lot-04-cnae-cbo`), uma PR no fim.

## 0. Decisões

- [ ] Pergunta bloqueante respondida: quem fornece o **arquivo oficial da Estrutura CBO** e se a #10
      pode ser entregue com catálogo vazio
- [ ] Resposta registrada no AUDIT e no PLAN; marcadores `BLOCKED UNTIL DECISION (arquivo CBO)`
      removidos

## 1. Preparação

- [ ] `git fetch origin --prune && git rebase origin/develop` (a branch nasceu em `f7e417d`)
- [ ] Conferir a última migration real antes de gerar qualquer coisa (era `0051`)
- [ ] Conferir PRs concorrentes tocando `_ui/form.tsx`, `company-form.tsx`, `job-role-form.tsx`,
      `schema/` ou migrations
- [ ] Mover #3 e #10 para _In progress_ no board

## 2. Autocomplete — foundation

- [ ] `_ui/catalog-combobox.tsx` com o contrato do PLAN (texto livre + assistência)
- [ ] Debounce (~300 ms) e cancelamento da requisição anterior
- [ ] Navegação por teclado: ↓ ↑ Enter Esc Tab
- [ ] ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`, `listbox`/`option`,
      `aria-activedescendant`
- [ ] Estados: loading, vazio, erro, catálogo não sincronizado
- [ ] Seleção por mouse; fechar sem perder o texto digitado
- [ ] Valor inicial (registro em edição) exibido formatado
- [ ] Visual idêntico ao `TextField` (altura, raio, borda, foco, label, erro)
- [ ] Dropdown com a largura do input, altura máxima e rolagem interna
- [ ] Teste de componente cobrindo digitação, debounce, teclado, vazio, erro e seleção

## 3. CNAE — Schema/catálogo

- [ ] `schema/cnae-subclasses.ts` — tabela **global**, PK `code`, sem `org_id`
- [ ] Policy única de leitura global (`using true`) + `enableRLS()`
- [ ] `npm run db:generate`, renomear para o padrão descritivo e acertar o `tag` no journal
- [ ] SQL custom na migration: `GRANT SELECT … TO app_runtime` + trigger `set_updated_at`
- [ ] Aplicar em Postgres efêmero do zero e conferir a tabela

## 4. CNAE — Sync

- [ ] `scripts/cnae-sync.ts`: `fetch` do IBGE → validação Zod → `upsertMany`
- [ ] `repositories/cnae-upsert.ts` com handle injetado, chunks e dedupe por código
- [ ] Fail-safe: qualquer falha acontece **antes** de escrever; log estruturado; `exit ≠ 0`
- [ ] `--dry-run` relatando inseridos/atualizados/inalterados
- [ ] Execução real contra o IBGE, conferindo a contagem (1.332 na verificação de 27/09)

## 5. CNAE — Repository/domain

- [ ] `repositories/cnae.ts` — SELECT local, **sem** `withOrg`, informando `baseEmpty`
- [ ] `domains/.../cnae.ts` — `normalizeCnae`, `formatCnae`, decisão código × descrição
- [ ] `integrations/cnae/search.ts` — serviço único, nunca lança

## 6. CNAE — Search/API

- [ ] Server Action `searchCnae` com gate `requireAuth()`
- [ ] Rota `GET /api/integrations/cnae/search?q=` com `ensureSession()` e `no-store`
- [ ] Limite de 20 resultados e termo mínimo de 2 caracteres
- [ ] `docs/api/api-design.md` atualizado (seção de integrações)
- [ ] Coleção Postman com o recurso

## 7. CNAE — UI

- [ ] Campo CNAE do `company-form.tsx` passa a usar o `CatalogCombobox`
- [ ] Seleção preenche código **e** atividade principal
- [ ] Autofill por CNPJ preservado; mudar o CNAE **não** redispara o lookup de CNPJ
- [ ] Digitação livre continua salvando (nenhuma validação dura)
- [ ] Descrição do item selecionado exibida como texto de apoio

## 8. CNAE — Tests

- [ ] Unit: normalização, formatação, decisão de modo de busca, parser do payload do IBGE
- [ ] Integração: leitura global sem `withOrg`, escrita negada a `app_runtime`, busca por código,
      por prefixo e por descrição, limite, base vazia, upsert idempotente
- [ ] UI/Action: salvar com item do catálogo e com texto manual
- [ ] `npm run check` verde (gate antes de começar a #10)

## 9. CBO — Schema/catálogo

- [ ] `schema/cbo-occupations.ts` — tabela **global**, PK `code`, sem `org_id`
- [ ] Policy de leitura global + `enableRLS()`
- [ ] Migration gerada, renomeada e com `GRANT SELECT` + trigger
- [ ] Aplicar em Postgres efêmero do zero

## 10. CBO — Import/sync

- [ ] `scripts/cbo-import.ts --file <zip/csv oficial>` como caminho primário
- [ ] Validação do arquivo (existe, não-vazio, assinatura) antes de qualquer escrita
- [ ] Parser isolado, com fixture, confirmado contra o arquivo oficial real
- [ ] `repositories/cbo-upsert.ts` com handle injetado, chunks e dedupe
- [ ] `--dry-run` com contagens
- [ ] N/A se a decisão for entregar sem o arquivo — registrar o motivo aqui

## 11. CBO — Repository/domain

- [ ] `repositories/cbo.ts` — SELECT local, sem `withOrg`, com `baseEmpty`
- [ ] `domains/.../cbo.ts` — `normalizeCbo`, `formatCbo`, família como prefixo
- [ ] `integrations/cbo/search.ts` — serviço único

## 12. CBO — Search/API

- [ ] Server Action `searchCbo` com `requireAuth()`
- [ ] Rota `GET /api/integrations/cbo/search?q=`
- [ ] `api-design.md` e Postman

## 13. CBO — UI

- [ ] Campo CBO do `job-role-form.tsx` passa a usar o `CatalogCombobox`
- [ ] Seleção preenche o **código**; o título aparece como apoio e **não** é persistido
- [ ] Digitação livre continua salvando

## 14. CBO — Tests

- [ ] Unit: normalização, formatação, parser (fixture)
- [ ] Integração: leitura global, busca por código e título, base vazia, upsert idempotente
- [ ] UI/Action: salvar com item do catálogo e com texto manual

## 15. Visual (obrigatório em toda tela alterada)

- [ ] Formulários no wrapper central de 940px (sem `max-w-2xl` encostado à esquerda)
- [ ] `PageHeader` com `backHref`; `FormSection` por tema; `FormActions` no rodapé
- [ ] Combobox com a mesma altura, raio, borda, foco e label do `TextField`
- [ ] Dropdown com a largura do input, altura máxima e rolagem interna
- [ ] Código em mono; descrição ao lado; item ativo com o realce existente
- [ ] Loading, vazio e erro no vocabulário do projeto; nenhuma cor nova
- [ ] Validar 1440×900
- [ ] Validar 768×1024
- [ ] Validar 375×812
- [ ] `scrollWidth <= clientWidth` nas três larguras
- [ ] Comparar visualmente com uma tela já aprovada (Empresas / Funções)

## 16. Integração e dados

- [ ] Tabelas globais sem `org_id` e sem policy de tenant
- [ ] `app_runtime` só lê; escrita exclusiva da conexão owner
- [ ] Migrations aplicadas do zero, em ordem, num banco novo
- [ ] Nenhuma migração de dados em `companies.cnae` / `job_roles.cbo`

## 17. Playwright

- [ ] Massa sintética em tenant de QA (nunca cliente real), com IDs registrados
- [ ] CNAE: CNPJ → busca por código → busca por descrição → seleção → edição manual → salvar → reabrir
- [ ] CBO: busca por código → busca por descrição → seleção → fallback manual → salvar → reabrir
- [ ] Catálogo vazio e "nenhum resultado" não bloqueiam o salvamento
- [ ] Teclado completo no combobox
- [ ] Evidências em `validacao_full/003-cnae/` e `validacao_full/010-cbo/` (desktop/tablet/mobile)
- [ ] Console e rede sem erro inesperado
- [ ] Massa removida e contagens conferidas

## 18. Walkthrough

- [ ] `WALKTHROUGH.md` com o fluxo real (onde buscar, o que preenche, o que acontece sem catálogo)

## 19. Review

- [ ] `REVIEW.md` com arquitetura, migrations, decisões, desvios, segurança, performance e dívidas

## 20. QA

- [ ] `QA.md` escrito **antes** da execução e preenchido com o resultado real

## 21. Rebase

- [ ] `git fetch origin --prune && git rebase origin/develop`
- [ ] Migrations revalidadas após o rebase (número, journal, snapshot, aplicação do zero)
- [ ] Repetir `check`, integração, build e os fluxos críticos do Playwright

## 22. PR

- [ ] Push da branch e **uma única PR**
- [ ] `Closes #3`; `Closes #10` **só** se o catálogo tiver sido importado — senão
      `Partially addresses #10`
- [ ] Board: issues entregues → _In review_; nada como _Done_ sem merge
- [ ] Sem merge automático — o merge é do usuário
