# Lote 4 — Plan

> Plano de implementação de **#3 (CNAE)** e **#10 (CBO)**, escrito sobre a
> [auditoria](AUDIT.md) de 27/09/2026. Uma pergunta bloqueante em aberto — o arquivo oficial do CBO
> (AUDIT § Perguntas bloqueantes). Tudo o que depende dela está marcado
> `BLOCKED UNTIL DECISION (arquivo CBO)`; o resto já está descrito como será feito.

## Objetivo

Dar busca assistida por **código ou descrição** ao campo CNAE do cadastro de Empresas e ao campo CBO
do cadastro de Funções, sem tirar do usuário a possibilidade de digitar e salvar manualmente.

## Escopo

- Tabela global `cnae_subclasses` + `scripts/cnae-sync.ts` (fonte: API do IBGE).
- Tabela global `cbo_occupations` + `scripts/cbo-import.ts --file` (fonte: arquivo oficial do MTE).
- Superfícies de consulta para os dois catálogos (Server Action + rota em `api/integrations`).
- **Um** componente de autocomplete em `_ui/`, usado pelos dois formulários.
- `company-form.tsx` e `job-role-form.tsx` passam a usar o componente.
- Testes (unit, integração, componente) e QA Playwright.

## Fora de escopo

- CNAEs **secundários** da empresa (o modelo tem um CNAE; nenhum requisito pede lista).
- Coluna de descrição do CBO em `job_roles` (descrição é derivada do catálogo).
- Validação dura de formato em `companies.cnae` / `job_roles.cbo` e migração dos dados existentes.
- Família CBO de 4 dígitos como entidade própria (é prefixo do código de 6).
- Qualquer uso de CNAE/CBO no eSocial (hoje inexistente).
- Trocar o `<datalist>` de `TextField` — ele continua servindo sugestões estáticas.

## Decisões herdadas (não reabrir)

| Decisão                                                            | Origem                           |
| ------------------------------------------------------------------ | -------------------------------- |
| Catálogo público = tabela **global**, sem `org_id`, sem `withOrg`  | `caepi_certificates` (fatia 011) |
| Contenção da exceção = **GRANT SELECT** para `app_runtime`         | migration `0009`                 |
| RLS ligado com policy única de leitura global (`using true`)       | event trigger `ensure_rls`       |
| Consulta de dado público = gate de **sessão** (`requireAuth`)      | `actions/epi/lookup-ca.ts`       |
| Rota de dado público fica em `api/integrations`, fora de `/api/v1` | CEP, CNPJ, CAEPI                 |
| Falha de integração **nunca** bloqueia o formulário                | `useLookup`                      |
| Branch única por lote, uma PR no fim                               | Lotes 2 e 3                      |

## Arquitetura geral

```
                    ┌──────────────── _ui/catalog-combobox.tsx (NOVO, compartilhado)
                    │
  company-form ─────┤                      job-role-form
       │            │                            │
  useCnaeSearch     │                       useCboSearch        (hooks finos, debounce + abort)
       │                                         │
  /api/integrations/cnae/search           /api/integrations/cbo/search
  actions/catalogs/search-cnae            actions/catalogs/search-cbo
       │                                         │
  integrations/cnae/search.ts             integrations/cbo/search.ts     (serviço único por catálogo)
       │                                         │
  repositories/cnae.ts                    repositories/cbo.ts            (SELECT local, sem withOrg)
       │                                         │
  schema/cnae-subclasses.ts               schema/cbo-occupations.ts      (tabelas GLOBAIS)
       ▲                                         ▲
  scripts/cnae-sync.ts                    scripts/cbo-import.ts --file
  (fetch IBGE → parse → upsert)           (arquivo oficial → parse → upsert)
```

Escrita nos dois casos por `repositories/*-upsert.ts` com **handle injetado** (conexão owner), igual
ao `caepi-upsert.ts`.

## Catálogo CNAE

### Fonte CNAE

`GET https://servicodados.ibge.gov.br/api/v2/cnae/subclasses` — verificada em 27/09/2026: 200 OK,
**1.332** subclasses, 3,6 MB, ~2,2 s, sem credencial. Não tem busca textual (por isso o espelho).
Cada item traz `id` (7 dígitos), `descricao` e a hierarquia `classe → grupo → divisao → secao`.

### Sync CNAE

`npx tsx scripts/cnae-sync.ts`

1. `fetch` da lista completa (timeout generoso, sem credencial);
2. valida o payload com Zod (array não-vazio; `id` de 7 dígitos; `descricao` não-vazia);
3. mapeia para linhas do espelho;
4. `upsertMany` por código, em chunks, com `syncedAt` único da execução.

Fail-safe idêntico ao CAEPI: qualquer falha (rede, payload inválido, zero linhas válidas) acontece
**antes** de escrever — a base anterior fica intacta, log estruturado e `exit ≠ 0`. Cadência
sugerida: mensal (o CNAE muda raramente). Sem `--file`, porque a fonte é `fetch` direto; um
`--dry-run` que só relata contagens é bem-vindo.

### Modelo de dados CNAE

Tabela **global** `cnae_subclasses` (sem `org_id`):

| Coluna              | Tipo        | Nulo | Observação                                                      |
| ------------------- | ----------- | ---- | --------------------------------------------------------------- |
| `code`              | text **PK** | não  | 7 dígitos, sem máscara (`4929902`) — PK natural, alvo do upsert |
| `description`       | text        | não  | descrição da subclasse                                          |
| `class_code`        | text        | sim  | `classe.id` (5 dígitos)                                         |
| `class_description` | text        | sim  | `classe.descricao`                                              |
| `section_code`      | text        | sim  | `…divisao.secao.id` (letra)                                     |
| `synced_at`         | timestamptz | não  | carimbo da carga                                                |
| `created_at`        | timestamptz | não  | default `now()`                                                 |
| `updated_at`        | timestamptz | não  | trigger `set_updated_at`                                        |

Índice: PK cobre busca por código/prefixo. Índice de descrição **só** se a medição pedir — 1.332
linhas não pedem.

### Busca CNAE

- Entrada normalizada: se sobrarem só dígitos após limpar, é **busca por código** (prefixo,
  `code LIKE '<digitos>%'`); senão é **busca por descrição** (`description ILIKE '%termo%'`).
- Termo com menos de 2 caracteres não consulta.
- Limite fixo de **20** resultados, ordenados por código.
- Resposta informa se a base está vazia (`baseEmpty`), como o CAEPI, para a UI distinguir
  "nada encontrado" de "catálogo nunca sincronizado".
- O serviço **nunca lança** por "não encontrado": ausência é estado do contrato.

### Integração Company/CNPJ

- O `TextField` de CNAE vira `CatalogCombobox`; o campo "Atividade principal" continua um
  `TextField` normal, editável.
- Selecionar um item preenche **código + atividade principal** (sobrescreve os dois — foi ação
  explícita do usuário).
- O autofill por CNPJ continua exatamente como está (merge preservando o que já havia).
- **Regras de convivência:** a última ação do usuário vence; mudar o CNAE **não** redispara o lookup
  de CNPJ; nada é limpo em silêncio; digitar um CNAE que não existe no catálogo é permitido e salva.

## Catálogo CBO

### Fonte CBO

Portal do MTE, página de Downloads, item **"Estrutura CBO (CSV) — Arquivo ZIP (106 kb)"**. Página
verificada em 27/09/2026 (200 OK, item presente). O download é postback JSF com redirecionamento
temporizado; **não** foi automatizado na auditoria (detalhes e evidências no AUDIT).

### Import/sync CBO

`npx tsx scripts/cbo-import.ts --file <caminho do ZIP/CSV oficial>` — **caminho primário**.

1. valida o arquivo (existe, não-vazio, assinatura ZIP/CSV);
2. descompacta se for ZIP e localiza o CSV de ocupações;
3. `parse` isolado e testado por fixture (separador, encoding e colunas confirmados no primeiro
   import real — `BLOCKED UNTIL DECISION (arquivo CBO)`);
4. `upsertMany` por código, em chunks, com `syncedAt`.

Mesmo fail-safe: falha antes de escrever, log estruturado, `exit ≠ 0`. `--dry-run` relata contagens
sem gravar. Coletor por browser (molde `caepi/collect.ts`) fica como **tentativa opcional**, num
módulo isolado, e **não** é pré-requisito da issue.

### Modelo de dados CBO

Tabela **global** `cbo_occupations` (sem `org_id`):

| Coluna         | Tipo        | Nulo | Observação                                                     |
| -------------- | ----------- | ---- | -------------------------------------------------------------- |
| `code`         | text **PK** | não  | 6 dígitos, sem máscara (`715210`)                              |
| `title`        | text        | não  | título da ocupação                                             |
| `family_code`  | text        | sim  | 4 dígitos (prefixo) — preenchido no import, sem tabela própria |
| `family_title` | text        | sim  | se o arquivo trouxer                                           |
| `synced_at`    | timestamptz | não  | carimbo da carga                                               |
| `created_at`   | timestamptz | não  | default `now()`                                                |
| `updated_at`   | timestamptz | não  | trigger `set_updated_at`                                       |

Colunas além de `code`/`title` entram **só se existirem no arquivo** — nada é inventado.

### Busca CBO

Mesmas regras da CNAE (dígitos → prefixo por código; texto → `ILIKE` no título; mínimo 2
caracteres; limite 20; `baseEmpty` no contrato).

### Integração Job Role

- O `TextField` de CBO vira `CatalogCombobox`.
- Selecionar preenche **o código** (é o que `job_roles.cbo` guarda). O título aparece no item da
  lista e como texto de apoio abaixo do campo depois da seleção — **não** é persistido.
- Digitar um código fora do catálogo continua permitido e salva.

## Autocomplete compartilhado

`_ui/catalog-combobox.tsx` (nome de trabalho), client component, **sem biblioteca nova**.

Contrato:

```ts
type CatalogItem = { code: string; label: string; meta?: string };

type Props = {
  label: string;
  name: string; // vai para o FormData, como TextField
  value: string; // código digitado ou selecionado
  onChange: (value: string) => void; // digitação livre
  onSelect: (item: CatalogItem) => void;
  search: (q: string) => Promise<{ items: CatalogItem[]; baseEmpty?: boolean }>;
  formatCode?: (code: string) => string; // 4929902 → 4929-9/02
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  isMono?: boolean;
};
```

Comportamento obrigatório:

- **texto sempre livre** — nunca um `<select>` fechado; o que o usuário digita é o valor;
- debounce de ~300 ms na digitação; requisição anterior abortada (reuso do padrão de `useLookup`);
- estados visíveis: `loading`, `vazio`, `erro`, `base não sincronizada`;
- seleção por clique e por teclado; fechar sem perder o que foi digitado;
- valor inicial vindo do registro em edição, já formatado para exibição;
- `disabled` e `error` no mesmo contrato do `TextField`.

## Fallback manual

Matriz de estados — em **todos**, o campo continua editável e o formulário salva:

| Situação                         | O que a UI mostra                                           |
| -------------------------------- | ----------------------------------------------------------- |
| Catálogo nunca sincronizado      | "Catálogo ainda não sincronizado. Preencha manualmente."    |
| Busca sem resultado              | "Nenhum resultado. Você pode digitar o código manualmente." |
| Erro de rede/servidor            | aviso discreto; o campo não muda de estado                  |
| Termo curto (< 2 caracteres)     | nada é consultado, nenhuma mensagem de erro                 |
| Código digitado fora do catálogo | **nada acontece** — é válido e salva                        |

## Normalização

Helper novo e pequeno, no domínio de cada catálogo, reusando `onlyDigits`
(`integrations/validation.ts`):

- `normalizeCnae("4929-9/02") === "4929902"`; `formatCnae("4929902") === "4929-9/02"`.
- `normalizeCbo("7152-10") === "715210"`; `formatCbo("715210") === "7152-10"`.
- Busca por descrição: `lower()` nos dois lados. **Sem** remoção de acentos numa primeira versão —
  se os testes mostrarem que atrapalha, avalia-se `unaccent`/`pg_trgm` **com medição**, não por
  precaução.

## Padrão visual e UI

Regras executáveis — o combobox tem de parecer o `TextField` que ele substitui.

| Aspecto         | Regra                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Wrapper do form | `mx-auto w-full max-w-[940px] px-[30px] pt-7 pb-10` — **proibido** `max-w-2xl` encostado à esquerda       |
| Estrutura       | `PageHeader` (com `backHref`) + `FormSection` por tema + `FormActions` no rodapé                          |
| Label           | mesmo `labelClass` do `_ui/form.tsx` (`text-text-muted mb-1.5 text-xs font-semibold`)                     |
| Input           | mesma `fieldClass`: `glass-input rounded-field h-[46px] px-3.5 text-[13px]` + `font-mono` quando código   |
| Foco            | o mesmo anel do `glass-input` — nenhum estilo de foco próprio                                             |
| Dropdown        | largura **igual à do input**, logo abaixo, `glass-card`/`rounded-[12px]`, sombra suave, `z` acima do form |
| Item            | código em mono à esquerda + descrição ao lado; item ativo com o realce indigo já usado no projeto         |
| Altura da lista | máximo ~280 px com rolagem interna; nunca empurra o formulário                                            |
| Loading         | texto discreto no rodapé da lista ("Buscando…"), sem spinner novo                                         |
| Vazio           | linha de texto dentro da lista, não um card separado                                                      |
| Erro            | `FieldError` padrão, abaixo do campo                                                                      |
| Ajuda           | linha `text-text-subtle text-xs` abaixo do campo (ex.: descrição do item selecionado)                     |
| Badges          | **nenhum** — não há semântica de status aqui                                                              |
| Cores           | só tokens existentes; nenhum hex novo                                                                     |
| Botão Voltar    | o do `PageHeader`                                                                                         |
| Ações do form   | `FormActions` + `SubmitButton`/`CancelLink`, sem alteração                                                |
| Mobile (375)    | dropdown dentro da viewport, sem overflow horizontal; `scrollWidth <= clientWidth`                        |
| Teclado         | ↓/↑ navegam, Enter seleciona, Esc fecha (mantendo o texto), Tab sai sem selecionar                        |
| Acessibilidade  | `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"`/`option`, `aria-activedescendant`   |

## Backend

- **Serviço** por catálogo (`integrations/cnae/search.ts`, `integrations/cbo/search.ts`): consulta
  local, nunca lança, devolve o contrato com `items` + `baseEmpty`.
- **Server Action** (`actions/catalogs/search-cnae.ts`, `search-cbo.ts`): gate `requireAuth()`,
  devolve `ActionResult`.
- **Rota** `GET /api/integrations/cnae/search?q=` e `/api/integrations/cbo/search?q=`:
  `ensureSession()`, `Cache-Control: no-store`, mesma resposta.
- **Nada** em `/api/v1`: não é recurso de tenant, não usa `officeAction`/`restHandler`. A rota é o
  que o combobox chama (o `fetch` com abort do cliente precisa de URL).
- `docs/api/api-design.md` e a coleção Postman ganham os dois recursos, na seção de integrações.

## Migrations previstas

| Migration              | Issue | Conteúdo                                                                                          | Estado  |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------------- | ------- |
| `00NN_cnae_subclasses` | #3    | tabela global, PK `code`, RLS + policy de leitura global, `GRANT SELECT`, trigger de `updated_at` | a gerar |
| `00NN_cbo_occupations` | #10   | idem, PK `code`                                                                                   | a gerar |

Podem ser **uma** migration só (dois catálogos, mesmo padrão) — decisão de implementação, não de
produto. **Nenhum número é reservado aqui**: a última real é `0051`; antes de gerar, `git fetch` +
`gh pr list` para conferir colisão.

## Segurança / leitura global

Repetindo o que o AUDIT fixou, porque é o ponto que um reviewer vai olhar: as duas tabelas **não**
têm `org_id`, **não** têm policy de tenant e **não** passam por `withOrg`. A contenção é o GRANT
(`SELECT` para `app_runtime`, escrita só pelo job em conexão owner) + RLS ligado com policy única de
leitura global. Consulta gateada por sessão.

## Performance / índices

PK cobre código e prefixo. Sem índice de texto na primeira versão; limite de 20 resultados; debounce
no cliente. Reavaliar **com medição** se o catálogo de CBO for maior que o esperado.

## Testes

**Unit**

- normalização e formatação de CNAE e CBO (ida e volta, entrada suja, vazio);
- decisão "código vs. descrição" a partir do termo;
- parser do CNAE (payload do IBGE → linhas) com fixture;
- parser do CBO com fixture (`BLOCKED UNTIL DECISION (arquivo CBO)` para o layout real);
- componente: digitação livre, debounce, seleção por teclado e mouse, Esc, lista vazia, erro,
  base não sincronizada, valor inicial.

**Integração** (Postgres efêmero)

- tabelas globais legíveis **sem** `withOrg` e **sem** `org_id`;
- `app_runtime` não consegue escrever (só `SELECT`);
- busca por código, por prefixo e por descrição; limite respeitado;
- base vazia → `baseEmpty` verdadeiro;
- upsert idempotente (rodar duas vezes não duplica nem muda contagem);
- migration aplicada do zero junto com todas as anteriores.

**UI/Actions**

- salvar empresa com CNAE escolhido no catálogo e com CNAE digitado à mão;
- salvar função nos dois modos;
- CNPJ preenche CNAE e a busca manual sobrescreve sem redisparar o CNPJ.

## QA futuro

Playwright em **375×812**, **768×1024** e **1440×900**, com massa sintética em tenant de QA e
limpeza ao fim (padrão dos Lotes 1–3).

Fluxos CNAE: empresa nova → lookup de CNPJ → busca por código → busca por descrição → seleção →
edição manual depois da seleção → salvar → reabrir. Fluxos CBO: função nova → busca por código →
busca por descrição → seleção → fallback manual → salvar → reabrir. Em ambos: catálogo vazio,
nenhum resultado, teclado completo e `scrollWidth <= clientWidth`.

## Estratégia da branch

**Uma** branch para todo o lote: `feature/lot-04-cnae-cbo`, criada de `f7e417d`. Auditoria,
decisões, plano, migrations, catálogos, scripts, componente, formulários, testes, walkthrough,
review, QA e correções vivem nela. Sem branch de documentação, sem branch por issue. Commits
lógicos.

## Estratégia da PR

**Uma** PR, só no fim, depois de: #3 implementada; #10 implementada **ou** formalmente bloqueada
pela ausência do arquivo oficial; testes; migration; import/sync; walkthrough; review; QA
Playwright; rebase; `check`; integração; build.

`Closes #3` sempre que a #3 estiver completa. Para a #10, `Closes #10` **só** se o catálogo tiver
sido importado e a busca demonstrada com dado real; caso contrário, `Partially addresses #10` e a
issue fica aberta — nada de fechar issue artificialmente.

## Ordem interna

1. Componente `CatalogCombobox` + testes (foundation paga uma vez).
2. CNAE: schema → migration → sync → repositório/serviço → Action/rota → UI → testes.
3. **Gate #3** verde (`check` + integração) antes de seguir.
4. CBO: schema → import → repositório/serviço → Action/rota → UI → testes.
5. **Gate #10** verde.
6. Walkthrough, review, QA conjunto, rebase, PR.

## Dependências

- **Entrada:** o arquivo oficial do CBO (pergunta bloqueante do AUDIT).
- **Interna:** #10 depende do componente criado na #3 — por isso a ordem acima.
- **Externa:** API do IBGE no ar no momento do sync (não no momento da busca).

## Riscos

Os do [AUDIT](AUDIT.md#riscos). O que o plano faz a respeito: parser isolado com fixture, fail-safe
antes de escrever, coletor de browser fora do caminho crítico, zero validação dura sobre dados
existentes e requisitos de teclado/ARIA escritos como itens de teste.

## Definition of Done

- [ ] Busca por **código** e por **descrição** funcionando nos dois formulários.
- [ ] Cadastro manual continua funcionando com catálogo vazio, sem resultado ou com erro.
- [ ] Tabelas globais sem `org_id`, com policy de leitura global e `GRANT SELECT`.
- [ ] Scripts de sync/import idempotentes, documentados e com fail-safe.
- [ ] Um único componente de autocomplete, acessível por teclado.
- [ ] `docs/api/api-design.md` e Postman atualizados.
- [ ] `npm run check`, `npm run test:integration` e `npm run build` verdes.
- [ ] QA Playwright aprovado nos três viewports, com massa removida.

## Itens bloqueados

| Item                                        | Estado                                 |
| ------------------------------------------- | -------------------------------------- |
| Layout/encoding do CSV do CBO (parser real) | `BLOCKED UNTIL DECISION (arquivo CBO)` |
| Import com dado real e fechamento da #10    | `BLOCKED UNTIL DECISION (arquivo CBO)` |
| Coletor por browser do portal do MTE        | opcional — fora do caminho crítico     |

Nada da #3 está bloqueado.
