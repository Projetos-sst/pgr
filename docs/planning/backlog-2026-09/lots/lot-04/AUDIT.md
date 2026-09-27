# Lote 4 — Auditoria

Auditoria específica das duas issues do lote, feita sobre o código real e com **reverificação das
fontes oficiais** em 27/09/2026. Nada foi implementado nesta execução.

## Issues

- **#3** — [Empresas] Integração automática de CNAE
- **#10** — [Funções] Avaliar integração com CBO

## Base

| Item                      | Valor                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `develop`                 | `f7e417d` (merge da PR #96 — Lote 3)                          |
| Branch do lote            | `feature/lot-04-cnae-cbo` (criada de `f7e417d`)               |
| Última migration real     | `0051_ergonomic_evaluations`                                  |
| PRs abertas               | **nenhuma** — sem risco de colisão de migration ou de arquivo |
| Issues fechadas no Lote 3 | #40, #47, #48 (confirmadas via `gh issue view`)               |

## Baseline

`npm run check` na branch, antes de qualquer alteração: **PASS** — 143 suítes, 1 367 testes, 0 erros,
**4 warnings pré-existentes** (3 × `<img>` em company/employee/epi-catalog form, 1 × import não usado
em `domains/pgr/companies.ts`).

## Estado atual

### CNAE (#3)

- `companies.cnae` e `companies.main_activity` são **texto livre nullable**
  (`schema/companies.ts:36-37`); no Zod, `cnae: optionalString` — **sem máscara e sem validação**.
- O autofill por CNPJ já preenche os dois: `useCnpjLookup` → BrasilAPI `/api/cnpj/v1`, que devolve
  `cnae_fiscal` (numérico) e `cnae_fiscal_descricao` (`providers/brasilapi.ts:17-18,48-49`;
  `company-form.tsx:136-153`).
- Falha de lookup **já não bloqueia** o cadastro (`use-lookup.ts` nunca lança; vira `error`
  silencioso) → o 2º critério de aceite da issue já está atendido hoje.
- O CNAE é lido pelo consolidado e impresso no PDF do PGR (`pgr-consolidated.ts:95,164`,
  `pgr-pdf-template.ts:237`). Nenhuma validação, nenhum uso no eSocial.
- **Dados reais no banco de desenvolvimento estão misturados**: `6821801` (7 dígitos, veio do
  autofill), `423520` (6 dígitos, incompleto) e `42000-00` (formatado e inválido). Consequência
  direta: qualquer validação dura recusaria registros já salvos.

### CBO (#10)

- `job_roles.cbo` é **texto livre nullable** (`schema/job-roles.ts:30`), `cbo: optionalString` no Zod.
  Formulário: `TextField` mono com placeholder `0000-00` (`job-role-form.tsx:96-103`).
- Uso: só a listagem/busca de funções (`repositories/job-roles.ts:121` — `ilike` em título ou CBO) e
  a coluna `MonoCell` da lista. **eSocial não usa CBO** (nenhuma ocorrência em `domains/esocial/`).
- **Não existe** coluna de descrição do CBO em `job_roles`.
- Dados reais no dev também estão misturados: `2521-05`, `7243-15`, `715210`, `7152-10`.

### Autocomplete

- **Não existe nenhum** no projeto. O que há é `<datalist>` estático (`_ui/form.tsx:221-251`,
  usado em `TextField suggestions`), que não busca no servidor, não navega por teclado de forma
  controlada e não mostra código + descrição.
- **Nenhuma biblioteca** de combobox/popover instalada: sem Radix, Headless UI, cmdk, downshift,
  react-aria ou floating-ui no `package.json`.
- Existe precedente de dropdown próprio com portal e teclado no `nav-menu.tsx` (mega-menu).
- Existe `useLookup` (`integrations/client/use-lookup.ts`): dispara `fetch` só com formato válido,
  **aborta a requisição anterior** e nunca lança. Falta debounce — ele dispara no `blur`, não a cada
  tecla.

## Fontes externas verificadas

Consulta feita em **27/09/2026**.

| Catálogo | Fonte                                    | Oficial? | URL                                                           | Formato    | Busca online? | Download completo?       | Automatizável?                    | Observação                                                                 |
| -------- | ---------------------------------------- | -------- | ------------------------------------------------------------- | ---------- | ------------- | ------------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| CNAE     | IBGE — Serviço de Dados, API de CNAE v2  | **Sim**  | `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses`     | JSON       | **Não**       | **Sim** (3,6 MB, ~2,2 s) | **Sim** (`fetch`, sem credencial) | 200 OK, **1.332** subclasses. `?descricao=` é **ignorado** (devolve tudo). |
| CNAE     | IBGE — subclasse por id                  | Sim      | `.../api/v2/cnae/subclasses/4712100`                          | JSON       | n/a           | n/a                      | Sim                               | 200 OK, ~2 KB — serve para conferir um código, não para busca textual.     |
| CNAE     | BrasilAPI — CNPJ                         | Terceiro | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`                 | JSON       | n/a           | n/a                      | Já em uso                         | Só autofill por CNPJ. **Não** é fonte mestre de CNAE.                      |
| CBO      | MTE — portal da CBO, página de Downloads | **Sim**  | `http://www.mtecbo.gov.br/cbosite/pages/downloads.jsf`        | HTML (JSF) | n/a           | listado                  | **Parcial** — ver abaixo          | 200 OK; item "Estrutura CBO (CSV) — Arquivo ZIP (106 kb)" presente.        |
| CBO      | MTE — atalho                             | Sim      | `https://cbo.mte.gov.br` → `/cbosite/`                        | HTML       | n/a           | n/a                      | n/a                               | Redireciona para o mesmo portal.                                           |
| CBO      | dados.gov.br — API de conjuntos          | Sim      | `https://dados.gov.br/api/publico/conjuntos-dados/buscar?...` | JSON       | n/a           | n/a                      | **Não**                           | **401** — exige credencial de API.                                         |
| CBO      | URL estática do ZIP                      | —        | `/cbosite/pages/downloads/CBO2002_Estrutura.zip` e variação   | —          | n/a           | **Não**                  | Não                               | **404** nas duas tentativas — não há caminho estático.                     |

**Detalhe do download do CBO (fato apurado, não hipótese).** A página não tem nenhum `href` para
arquivo: os itens são `<a onclick="mojarra.jsfcljs(...)">` de um form JSF (`formDownload`) com
`javax.faces.ViewState` e `DTPINFRA_TOKEN`, e o clique leva a uma página intermediária com
`function redireciona()` que dá `submit()` **depois de 10 s** e um botão `Download`. Duas tentativas
automatizadas falharam em produzir o arquivo:

1. POST do postback com cookie de sessão + ViewState + `formDownload:link5` → **200 `text/html`**,
   11 KB, sem `Content-Disposition` (voltou a própria página).
2. Playwright real: clique no link (espera de 60 s) e depois clique no botão `Download`
   (espera de 90 s) → **nenhum evento de download**.

Ou seja: o arquivo oficial **existe e está publicado**, mas a coleta automatizada é frágil e não foi
demonstrada nesta auditoria.

---

# #3 — CNAE

## Requisito

Buscar CNAE por **código ou descrição** no cadastro de Empresas, preenchendo código + descrição;
falha da integração **não** bloqueia a digitação manual; `npm run check` verde.

## Formulário atual

`company-form.tsx` mantém `cnpj/razaoSocial/nomeFantasia/cnae/mainActivity` num único estado
(`CnpjFields`, linha 62) e dois `TextField` controlados para CNAE e "Atividade principal"
(linhas 242-256). O lookup de CNPJ dispara no `onBlur` do campo de CNPJ e faz _merge_ preservando o
que já estava digitado (`found.cnae || prev.cnae`). Não há nenhuma busca por CNAE.

## CNPJ / BrasilAPI

O autofill por CNPJ **permanece como está**. A busca manual entra **ao lado**, no campo de CNAE,
sem tocar no fluxo de CNPJ. Regra de convivência definida no PLAN: a última ação do usuário vence;
escolher um CNAE na busca sobrescreve código + atividade; buscar CNPJ de novo continua fazendo
merge como hoje. Nada é resetado em silêncio e mudar o CNAE **não** redispara o lookup de CNPJ.

## Fonte IBGE / Concla

Verificada (tabela acima). Os três fatos que decidem a arquitetura:

1. a API **entrega a lista completa** (1.332 subclasses) sem credencial;
2. a API **não tem busca textual** — o parâmetro de descrição é ignorado;
3. o `id` é **numérico de 7 dígitos** (`4929902`), com `descricao` e a hierarquia
   (`classe` → `grupo` → `divisao` → `secao`) embutida em cada item, além de `atividades` e
   `observacoes`.

## Arquitetura recomendada

| Opção                                      | Busca por código | Busca por descrição | Disponibilidade               | Custo por consulta       | Veredito                                                                     |
| ------------------------------------------ | ---------------- | ------------------- | ----------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| **A — tabela global + sync** (recomendada) | sim (prefixo)    | sim (`ilike`)       | independe do IBGE estar no ar | 1 SELECT local           | **Escolhida.** É o padrão `caepi_certificates`, já provado no projeto.       |
| B — JSON versionado no repositório         | sim              | sim (em memória)    | total                         | carrega 3,6 MB           | Rejeitada: 3,6 MB versionados, sem índice, e atualizar vira commit.          |
| C — consulta online ao IBGE em tempo real  | sim (por id)     | **não**             | depende do IBGE               | 3,6 MB por busca textual | Rejeitada: a fonte não busca por texto; seria baixar tudo a cada tecla.      |
| D — reusar algo existente                  | —                | —                   | —                             | —                        | Não existe: BrasilAPI só resolve CNPJ; `/api/cnae/v1` dela responde **404**. |

**Recomendação: A.** Espelho local numa tabela **global** `cnae_subclasses` (sem `org_id`), no molde
exato do CAEPI, alimentada por `scripts/cnae-sync.ts`.

## Código e normalização

- **Persistir**: 7 dígitos, sem máscara (`4929902`). É o que a BrasilAPI já grava hoje via autofill e
  o que o IBGE usa como `id` — não quebra nada e é a única forma que já existe "correta" no banco.
- **Exibir**: `4929-9/02` (formato Concla) no resultado da busca e como texto de apoio no campo.
- **Buscar**: normalizar a entrada para dígitos, então `4929902`, `4929-9/02` e `49299` (prefixo)
  encontram a mesma coisa.
- **Não** migrar dados existentes e **não** introduzir validação dura: os registros atuais estão
  mistos (`42000-00`, `423520`) e travar o formulário reprovaria cadastro já salvo. O campo continua
  `optionalString`.

## CNAE principal × secundários

`companies` tem **um** CNAE (`cnae`) e uma atividade principal (`main_activity`). A issue fala do
"campo CNAE do formulário de Empresas". **Fora de escopo** criar lista de secundários — seria schema
novo, UI nova e nenhum requisito pede. Registrado como decisão, não como pergunta.

## Fallback manual

Estados a tratar, todos sem bloquear o salvamento: base vazia (nunca sincronizada), busca sem
resultado, erro de rede/servidor, código digitado que não existe no espelho. O CAEPI já tem o
vocabulário para isso (`baseUnsynced` no payload, aviso "Preencha manualmente") — é o que será
reusado.

## Migration

**SIM** — uma tabela global nova. Nenhuma alteração em `companies`.

---

# #10 — CBO

## Requisito

Busca de CBO por código ou descrição no cadastro de Função; preenchimento manual continua
funcionando se a integração falhar ou não houver match; `npm run check` verde.

## Formulário atual

`job-role-form.tsx`: `TextField` mono, placeholder `0000-00`, sem busca. O valor vai direto para
`job_roles.cbo` (texto). A lista de funções mostra o CBO em `MonoCell` e a busca textual da lista já
casa com ele.

## Fonte oficial MTE

Verificada (tabela acima). Resumo honesto: **a fonte oficial existe** — portal da CBO do MTE,
item "Estrutura CBO (CSV) — Arquivo ZIP (106 kb)" — mas **não foi possível automatizar o download**
nesta auditoria (postback JSF + redirecionamento temporizado; sem URL estática; sem API pública).

## Arquivo / formato

O que dá para afirmar: é um **ZIP de ~106 KB com CSV(s)** chamado "Estrutura CBO". O conteúdo exato
(quais arquivos, separador, encoding, colunas) **não foi verificado** porque o arquivo não foi
obtido. O PLAN trata isso como entrada do parser, a confirmar no primeiro import real — e o parser
nasce com teste de fixture, como o do CAEPI.

## Arquitetura recomendada

Mesma família da #3: tabela **global** `cbo_occupations` (sem `org_id`), leitura local. A diferença
está na **ingestão**:

- **Caminho primário:** `npx tsx scripts/cbo-import.ts --file <arquivo oficial>` — importa o ZIP/CSV
  que alguém baixou do portal. É o mesmo fallback que o CAEPI já expõe (`caepi-sync.ts --file`), aqui
  promovido a caminho principal porque a coleta automática não se sustentou.
- **Caminho opcional (tentativa):** coletor por browser em módulo isolado, no molde de
  `integrations/caepi/collect.ts` (o único módulo do projeto que conhece browser). Só entra se for
  demonstrado funcionando; **não é pré-requisito** da issue.

## Escopo: ocupação (6 dígitos) × família (4)

**Ocupação de 6 dígitos.** É o que o campo representa hoje (placeholder `0000-00`) e o que a issue
pede ("código/descrição da ocupação"). A família de 4 dígitos sai de graça como **prefixo** do
próprio código — se for útil exibir, é coluna derivada na leitura, sem tabela nem busca separada.

## Código e normalização

- **Persistir**: 6 dígitos sem máscara (`715210`).
- **Exibir**: `7152-10`.
- **Buscar**: normalizar para dígitos — `715210` e `7152-10` encontram o mesmo.
- **Sem** migração de dados e **sem** validação dura, pelo mesmo motivo da #3 (o banco tem as duas
  grafias hoje).

## Descrição

**Derivada, não persistida.** `job_roles` não ganha coluna: a descrição aparece no resultado da busca
e pode ser mostrada ao lado do código na tela; o que fica gravado é o código. Isso segue o princípio
"derivar antes de persistir" que o projeto usa desde a 006. Consequência aceita e registrada: se o
catálogo for substituído e um código sumir, o valor gravado continua válido (é texto) e a descrição
deixa de ser exibida — nada quebra.

## Fallback manual

Igual à #3, com um estado a mais e muito provável no começo: **catálogo vazio** (arquivo ainda não
importado). A tela diz isso com todas as letras e o campo segue editável.

## Migration

**SIM** — uma tabela global nova. Nenhuma alteração em `job_roles`.

---

# CAEPI — padrão reutilizável

| Aspecto             | CAEPI atual                                                                                                 | Reutilizável no CNAE?                           | Reutilizável no CBO?                          | Observações                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Schema              | `caepi_certificates`, **sem `org_id`**, PK natural (`ca`), `synced_at`                                      | **Sim** — molde direto                          | **Sim**                                       | PK natural = código do catálogo.                                         |
| Migration           | `0009`: `ENABLE RLS` + policy única `FOR SELECT … USING (true)` + `GRANT SELECT` + trigger `set_updated_at` | **Sim**                                         | **Sim**                                       | O RLS ligado existe por causa do event trigger `ensure_rls` da produção. |
| Contenção           | `app_runtime` só tem **SELECT**; escrita exclusiva do job via conexão owner/unpooled                        | **Sim**                                         | **Sim**                                       | É o que sustenta a exceção ao Princípio I.                               |
| Repositório leitura | `repositories/caepi.ts` — `db` direto, **sem `withOrg`**; informa `baseEmpty`                               | **Sim**                                         | **Sim**                                       | O `baseEmpty` vira o aviso "base não sincronizada".                      |
| Repositório escrita | `repositories/caepi-upsert.ts` — handle **injetado**, upsert em chunks de 1.000, dedupe por PK              | **Sim**                                         | **Sim**                                       | Não importa `server-only` de propósito (roda no tsx).                    |
| Serviço             | `integrations/caepi/lookup.ts` — consulta local, **nunca lança**, todo desfecho é estado do contrato        | **Sim**                                         | **Sim**                                       | Um serviço, duas superfícies.                                            |
| Server Action       | `actions/epi/lookup-ca.ts` — gate `requireAuth()` (dado público, sem tenant/papel)                          | **Sim**                                         | **Sim**                                       | `officeAction` **não** serve: não há tenant.                             |
| REST                | `app/api/integrations/caepi/[ca]` — `ensureSession()`, `Cache-Control: no-store`                            | **Sim** (mudando para `?q=`)                    | **Sim**                                       | Fica fora de `/api/v1` porque não é recurso de tenant.                   |
| Hook cliente        | `use-caepi-validation` sobre `useLookup` (abort, nunca lança)                                               | **Parcial** — falta debounce por tecla          | **Parcial**                                   | `useLookup` dispara no blur; busca por digitação precisa de debounce.    |
| Campo               | `ca-field.tsx` — input + estado textual, sempre editável                                                    | **Como referência de comportamento**, não de UI | idem                                          | É um input simples, não um combobox com lista.                           |
| Coleta              | `integrations/caepi/collect.ts` — Playwright headed, **único módulo com browser**                           | **Não precisa** (IBGE é `fetch` puro)           | **Sim, como molde** (se a coleta for tentada) | Anti-corruption layer: o portal muda, conserta-se num arquivo só.        |
| Script              | `scripts/caepi-sync.ts` — collect → parse → upsert, fail-safe, `--file`                                     | **Sim**                                         | **Sim** (com `--file` como caminho primário)  | Falha acontece **antes** de qualquer escrita.                            |
| Testes              | unit (normalize/parse/validate/lookup/hook) + integração contra Postgres efêmero                            | **Sim**                                         | **Sim**                                       | Parser com fixture é o que protege contra mudança de layout.             |

**O que NÃO deve ser copiado do CAEPI:** o `ca-field.tsx` (é input simples, não combobox); o lookup
no `onBlur` (busca por descrição precisa de debounce por digitação); e a semântica de validade/
vencimento (`valid`/`expired`), que é específica de certificado e não existe em catálogo de
classificação.

---

# Autocomplete compartilhado

## O que existe

Nada de combobox. Existe: `<datalist>` estático, `useLookup` (fetch com abort), e um dropdown
próprio com portal e teclado no `nav-menu.tsx`.

## O que é preciso

**Um** componente em `_ui/` — trabalho batizado no PLAN como `CatalogCombobox` — no padrão ARIA
combobox (input + listbox), servindo CNAE e CBO. **Sem biblioteca nova**: o que falta (debounce,
navegação por seta, `aria-activedescendant`, clique-fora) é pequeno e o projeto já tem precedente
próprio; instalar Radix/cmdk só para isso seria dependência nova sem necessidade demonstrada.

Requisitos funcionais (detalhados no PLAN): texto livre digitável, busca por código **e** descrição,
debounce, loading, vazio, erro, teclado completo, seleção por mouse, limpar, valor inicial,
`disabled`, mobile e acessibilidade. O ponto crítico: é **campo de texto com assistência**, nunca um
`<select>` fechado — o usuário tem de poder digitar algo que não está no catálogo e salvar.

## Contrato de busca

Conceitual, um só para os dois catálogos:

```
buscar(q: string, limit?: number) -> { code: string; label: string; meta?: string }[]
```

`code` é o valor persistido (dígitos), `label` a descrição, `meta` o campo auxiliar (no CNAE, a
atividade principal já vem na própria descrição; no CBO, a família, se for útil). Os repositórios e
domínios são distintos; o **componente é o mesmo**.

---

# UI foundation

| Peça                                      | Existe hoje                                                          | Uso no Lote 4                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `PageHeader`                              | `_ui/list.tsx` (ícone, título, descrição, `backHref`)                | Sem mudança                                                         |
| `FormSection`                             | `_ui/form.tsx` (cartão glass, grade de 2 colunas)                    | Sem mudança                                                         |
| `TextField`                               | `_ui/form.tsx` — `fieldClass` h-46px, `rounded-field`, `glass-input` | **Referência visual** do combobox                                   |
| `SelectField`                             | `_ui/form.tsx`                                                       | Não serve (conjunto fechado)                                        |
| `FieldError`/`FormError`                  | `_ui/form.tsx`                                                       | Reuso direto                                                        |
| `FormActions`/`SubmitButton`/`CancelLink` | `_ui/form.tsx`                                                       | Sem mudança                                                         |
| `datalist` em `TextField`                 | `_ui/form.tsx:221-251`                                               | Continua para sugestões estáticas; **não** é o autocomplete do lote |
| Dropdown com portal                       | `nav-menu.tsx`                                                       | Precedente de implementação própria                                 |
| **Combobox**                              | **não existe**                                                       | **A criar** (única peça nova de foundation)                         |

O wrapper de formulário do padrão global é `mx-auto w-full max-w-[940px] px-[30px] pt-7 pb-10` — é o
que as telas de empresa e função já devem usar (a conferir na implementação, junto com o resto).

---

# Segurança

- As duas tabelas são **globais**: dado público, igual para todos os tenants, **sem `org_id`**,
  **sem** policy de tenant e **sem** `withOrg` — exceção já documentada e aceita no projeto
  (`caepi_certificates`). A contenção é o **GRANT**: `app_runtime` só recebe `SELECT`.
- RLS fica **habilitado** com policy única de leitura global (`using true`), porque a produção força
  RLS em toda tabela nova (event trigger `ensure_rls`).
- Escrita exclusiva dos scripts de ingestão, por conexão **owner/unpooled**.
- Gate das superfícies de consulta: **sessão apenas** (`requireAuth()` / `ensureSession()`), como no
  CAEPI — não há tenant nem papel envolvido, então `officeAction`/`restHandler` não se aplicam.
- Nenhum dado sensível: classificações públicas. Nenhuma credencial nova.

# Performance

- CNAE: **1.332 linhas**. Índice por PK (código) resolve prefixo; `ilike '%termo%'` em 1.332 linhas é
  irrelevante. **Não** justifica `pg_trgm`.
- CBO: ordem de poucos milhares (número exato a confirmar no arquivo). Mesma conclusão esperada; se o
  arquivo surpreender em volume, o PLAN prevê reavaliar índice **com medição**, não por precaução.
- Limite de resultados na busca (o PLAN fixa 20) e debounce no cliente contêm o volume de requisições.
- Nenhuma extensão nova de Postgres sem necessidade provada.

# Sync / import

| Catálogo | Origem                 | Mecanismo                                      | Idempotência                       | Fail-safe                                      |
| -------- | ---------------------- | ---------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| CNAE     | `fetch` da API do IBGE | `scripts/cnae-sync.ts` — baixa, valida, upsert | upsert por código, dedupe no chunk | falha antes de escrever; base anterior intacta |
| CBO      | arquivo oficial local  | `scripts/cbo-import.ts --file <zip/csv>`       | idem                               | idem                                           |

Nenhum dos dois apaga linhas de catálogo automaticamente: código que sai da fonte **permanece** no
espelho (e o valor gravado em `companies`/`job_roles` é texto, então nada é perdido). Remoção, se um
dia fizer sentido, é decisão separada — registrado no PLAN.

# Dependências

```
#3 CNAE ──(cria o CatalogCombobox)──► #10 CBO reaproveita
```

Arquivo em comum: `_ui/` (componente novo). Por isso as duas issues no mesmo lote e na mesma branch —
fazer o combobox duas vezes é retrabalho garantido.

Fora isso, as duas não colidem: `companies`/`company-form.tsx` × `job-roles`/`job-role-form.tsx`.

# Riscos

| Risco                                                      | Mitigação                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Arquivo oficial de CBO não chega** → catálogo vazio      | Tudo o mais é entregável; a UI já trata base vazia. É a única pergunta bloqueante do lote.     |
| Layout do CSV do CBO diferente do esperado                 | Parser isolado com teste de fixture (molde `caepi/parse.ts`); o import falha antes de escrever |
| Portal do MTE muda (JSF, token, timer)                     | Se houver coletor, ele fica num módulo só (anti-corruption layer), como o do CAEPI             |
| API do IBGE fora do ar no momento do sync                  | Espelho local: a busca continua funcionando com a última carga                                 |
| Componente novo de combobox com acessibilidade pela metade | Requisitos de teclado/ARIA fixados no PLAN e itens de teste no TASK                            |
| Validação dura de formato reprovar dados já salvos         | Decisão explícita: **sem** validação dura, **sem** migração de dados                           |
| Autocomplete brigar com o autofill de CNPJ                 | Regra de convivência definida no PLAN (última ação do usuário vence, nada reseta em silêncio)  |

# Perguntas bloqueantes

## Pergunta 1

**Issue:** #10
**Pergunta:** quem fornece o **arquivo oficial da Estrutura CBO (CSV/ZIP)** do portal do MTE — e, se
ele não estiver disponível agora, a #10 pode ser entregue com o catálogo **vazio** (schema, parser,
busca, UI e script de import prontos e documentados), fechando só depois que o arquivo for
importado?
**Por que bloqueia:** decide se a #10 fecha neste lote ou fica aberta. Não é preguiça de pesquisa: a
página oficial foi verificada hoje, o item existe, e duas tentativas de download automatizado (POST
com ViewState e clique real no Playwright, 60 s e 90 s) **não** produziram o arquivo; não há URL
estática e a API do dados.gov.br responde 401.
**Opção A:** você (ou alguém do time) baixa o ZIP do portal e coloca num caminho local — eu importo
e a #10 fecha neste lote.
**Opção B:** implemento tudo com o catálogo vazio, a busca devolve "base ainda não importada" e a
#10 fica **aberta** até o arquivo chegar (a PR usa `Partially addresses #10`).
**Opção C:** eu tento um coletor por browser mesmo assim, aceitando que pode não funcionar e que o
`--file` continua sendo o caminho de verdade.
**Recomendação técnica:** **A**, com **B** como plano B automático. O download é um clique manual; o
esforço de automatizar um portal JSF com redirect temporizado não se paga para um catálogo que muda
raramente.

# Classificação final

| Issue   | Dificuldade | Prontidão                                            | Migration          | Fonte oficial                            | Risco | Cobertura hoje |
| ------- | ----------- | ---------------------------------------------------- | ------------------ | ---------------------------------------- | ----- | -------------- |
| **#3**  | **3/5**     | **READY**                                            | **SIM** (1 tabela) | IBGE — verificada, 1.332 subclasses      | Baixo | ~25%           |
| **#10** | **3/5**     | **READY COM PREMISSAS** (depende do arquivo oficial) | **SIM** (1 tabela) | MTE — página verificada, download manual | Médio | 0%             |

# Recomendação

Rodar o lote em série numa branch só: **combobox compartilhado → #3 (CNAE, ponta a ponta) → gate →
#10 (CBO, reaproveitando tudo) → QA conjunto**. A #3 não depende de ninguém e paga o custo da
foundation; a #10 entra atrás e só precisa do arquivo. Se o arquivo não chegar, a #3 fecha e a #10
fica aberta com a implementação pronta — sem fechar issue artificialmente.
