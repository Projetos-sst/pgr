# Briefing: Modelo de Tenant + Equipe e Acessos com Gate PRO

**Criado**: 2026-06-19

**Status**: Briefing / decisão de produto (pré-spec)

**Origem**: Análise do produto de referência **ePGR** (https://app.e-pgr.com.br) +
discussão de arquitetura de tenant e custo de autenticação.

**Relação com fatias existentes**: refina a premissa da fatia `004`
(`.specs/004-multi-tenant-isolation/`) e antecede uma futura fatia de
"Equipe e Acessos / Planos".

---

## 1. Resumo executivo

O SST Manager é **multi-tenant** e continuará sendo. A entidade-raiz de isolamento
(o **tenant**) é o **escritório/conta do profissional de SST**, não a empresa-cliente.
Cada conta tem um **workspace (`org_id`) no nosso próprio banco desde o cadastro**,
com dados isolados por Row Level Security (RLS).

A gestão de equipe ("Equipe e Acessos" — convidar colaboradores/clientes) é uma
feature de **plano PRO**. O custo de Clerk Organizations (cobrado por organização)
fica **alinhado à receita**: só vira Clerk Organization quem é PRO e, portanto, paga.

> **Decisão fechada**: **Clerk + Gate PRO**.
> - Todo usuário tem `org_id` (workspace no nosso banco) desde o signup.
> - **Clerk Organization só existe no plano PRO.**
> - Usuário free usa o sistema completo sozinho; não convida ninguém.
> - **Nesta etapa**: apenas o **campo de plano** (`free | pro`). Sem lógica de
>   enforcement, sem auto-criação de Clerk Org, sem fluxo de convite ainda.

---

## 2. Origem e método

A inspiração de produto é o **ePGR**. Para decidir o modelo de tenant sem achismo,
o fluxo do ePGR foi inspecionado diretamente (navegador), cobrindo: cadastro, perfil,
seletor global de empresa e o fluxo "Equipe e Acessos / Adicionar Colaborador".

As conclusões abaixo derivam dessa inspeção + da análise de custo dos provedores de
autenticação.

---

## 3. Descobertas do ePGR (evidências)

| Evidência observada | O que indica |
| --- | --- |
| Cadastro pede **Nome, Sobrenome, CPF** + "Empresa" (texto livre) + Cargo | A raiz da conta é uma **pessoa física**; "Empresa" é atributo de perfil, não tenant |
| Cargos disponíveis: "Consultoria Externa", "Sócio/Proprietário", "Téc./Eng. Seg. Trabalho" | Perfil típico = **profissional/escritório de SST que atende vários clientes** |
| Topo do app tem seletor global **"Todas as Empresas"** + empresas com CNPJ | Visão **agregada cross-empresa** — impossível se cada empresa fosse um tenant isolado |
| "Equipe e Acessos" fica no **Perfil do usuário** (nível conta) | Membros entram no **workspace da conta**, não de uma empresa específica |
| Modal "Adicionar Colaborador": Nome/CPF/E-mail + "Empresa" (texto) + **Tipo: Colaborador / Cliente** | Convite é **escopo de conta**; **não há** seleção de "a qual empresa dar acesso" |
| Perfil do dono: "Empresa: nobuggy / Cargo: Sócio", papel "Administrador" | A conta é o tenant; o usuário é admin **da conta** |

**Conclusão**: o ePGR segue o **Modelo B** — _tenant = conta/escritório_;
_"Empresa" = entidade de negócio (com `company_id`) dentro do tenant_.

---

## 4. Decisão de modelo: Modelo B (tenant = escritório)

- **Tenant (`org_id`)**: o escritório/conta. Raiz de todo o isolamento (RLS).
- **Empresa-cliente (`company_id`)**: entidade de negócio **dentro** do tenant; uma
  dimensão de filtro, não uma fronteira de isolamento.
- O seletor "Todas as Empresas / [empresa]" é um **filtro de aplicação** dentro do
  tenant — **não** é troca de tenant.

Modelo A (cada empresa-cliente = um tenant/org isolado) foi **descartado**: contraria
as evidências do ePGR (visão "Todas as Empresas", equipe no nível da conta) e
multiplicaria orgs/custo sem necessidade.

---

## 5. Modelo de identidade

Princípio central: **separar identidade de vínculo (membership)**.

| Conceito | Definição | Onde vive |
| --- | --- | --- |
| **Identidade (User)** | 1 por CPF/e-mail; um login | Provedor de auth (Clerk) |
| **Org (Workspace/Escritório)** | o tenant isolado | Nosso banco (`orgs`) |
| **Membership** | vínculo User↔Org **com papel** (N:N) | Nosso banco (`org_memberships`) |

Consequências (todas sem edge case):

- **1 identidade por CPF**, com **N memberships**. O CPF nunca fica preso a uma org.
- **Dono de org = membership com papel `owner`.** Convidar = criar membership
  (pendente → ativo). **Mesmo mecanismo**, papéis diferentes.
- O **convidado não ganha org automática**; só tem org própria se **criar** uma.
- Um usuário pode **ter a própria org E ser membro de N outras** simultaneamente
  (modelo Slack/Notion: uma identidade, vários workspaces).
- **Troca entre orgs** importa para **qualquer** usuário com **2+ memberships** —
  inclusive um usuário **free convidado** para uma org PRO. Só quem tem exatamente
  **1 workspace** não vê seletor de org. (Detalhado na seção 11, Inv-2.)

---

## 6. Decisão de autenticação: Clerk + Gate PRO

### 6.1 Por que não foi trivial

O Clerk cobra **por organização** (MRO — _Monthly Retained Organization_), não só
por usuário. No Modelo B, _1 cliente ≈ 1 org_; se toda conta (inclusive free) virasse
Clerk Org, o custo escalaria por cliente — inviável para um SaaS de **alto volume e
baixo ticket** (profissionais de SST em sua maioria solo).

### 6.2 A solução: alinhar o gerador de custo à receita

- **Free**: workspace existe no nosso banco (`org_id`), mas **sem Clerk Organization**.
  → não consome cota de org no Clerk.
- **PRO**: ao assinar, cria-se a **Clerk Organization** → destrava "Equipe e Acessos".
  → o custo `~$1/org` incide apenas sobre quem **já paga**.

### 6.3 Números do Clerk (verificados em clerk.com/pricing, 2026-06)

| Dimensão | Plano free (Hobby) | Acima do free |
| --- | --- | --- |
| Usuários (MRU) | **50.000** no total do app | Pro **$25/mês** + **$0,02/MRU** excedente |
| Organizações (MRO) | **100** | **~$1/org** excedente (as 100 primeiras incluídas) |

- Org só conta quando **existe e tem ≥1 usuário** → usuário free **sem org = 0 MRO**.
- Os 50k MRU são o **total** (free + PRO + membros convidados), não "só free".
- Cobrança de org excedente é só **acima** de 100: ex.: 101 orgs ⇒ `$25 + $1 = $26/mês`.
- **0 a 50.000 usuários free (com 0 orgs) ⇒ $0 no Clerk.**

> Comparativo considerado: **Supabase Auth** (MAU-based, já pago, RLS nativo, mas
> orgs/convites/switch construídos à mão) e **Better Auth** (open-source, self-host,
> plugin `organization` com orgs/papéis/convites prontos, custo só do DB). O Gate PRO
> torna o **Clerk viável** mantendo a DX da UI B2B pronta; Better Auth permanece como
> alternativa de menor custo recorrente se o custo de org passar a pesar.

---

## 7. Regra de negócio: Free vs PRO

### 7.1 Conta Free

- Tem **workspace (`org_id`) próprio** criado no signup; dados isolados por RLS.
- **Sem Clerk Organization.**
- Usa o **sistema completo sozinho** (cadastros/CRUDs, empresas-cliente, etc.) — não
  depende de troca de org nem de Clerk Org.
- Pode preencher dados de perfil (empresa, cargo).
- **Não** acessa "Equipe e Acessos" (não convida colaboradores/clientes).
- Não vê seletor de troca de org (só tem um workspace).

### 7.2 Conta PRO

- Mesmo workspace (`org_id`) — **sem migração de dados** ao fazer upgrade.
- **Destrava "Equipe e Acessos"**: convidar **Colaborador** (membro da equipe do
  escritório) e **Cliente** (pessoa da empresa-cliente, com acesso restrito).
- No upgrade, cria-se a **Clerk Organization** correspondente, vinculada ao workspace.

### 7.3 Invariante de isolamento (free e pro)

O tenant (`org_id`) **sempre existe** desde o signup. O plano controla **apenas** se a
conta pode **gerenciar membros** — não a existência do isolamento. Isso evita um fork
de modelo (free scoped por user vs pro scoped por org) e mantém o RLS **uniforme**.

---

## 8. Modelo de dados proposto

> Tabelas de negócio (futuras) carregam **`org_id`** (isolamento, RLS) **+ `company_id`**
> (dimensão de negócio).

### `orgs` (workspace / escritório — o tenant)

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | `uuid` | PK — **id canônico do tenant** (usado por RLS / `withOrg`) |
| `name` | `text` | nome do escritório |
| `plan` | `text` | **`free` \| `pro`** — _único item desta etapa_ |
| `clerk_org_id` | `text` | **nullable** — preenchido só quando PRO (mapeia → Clerk Org) |
| `created_at` | `timestamptz` | default `now()` |

### `org_memberships` (já iniciado na fatia `002`)

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `org_id` | `uuid` | FK → `orgs.id` |
| `user_id` | `text` | identidade (Clerk) |
| `role` | `text` | `owner` \| `colaborador` \| `cliente` |
| `scoped_company_id` | `uuid` | **nullable** — preenchido só para `cliente` (escopo por empresa) |

### `companies` (empresas-cliente — dado de negócio)

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `org_id` | `uuid` | FK → `orgs.id` (tenant dono) |
| `cnpj` | `text` | identificação |
| `razao_social` | `text` | nome |

**Isolamento**: RLS por `org_id` (padrão já provado em `tenant_probe` na `004`). O tipo
`cliente` exige, adicionalmente, filtro por `company_id` (= `scoped_company_id`).

---

## 9. Requisitos funcionais

**Tenant e identidade**

- **FR-001**: Todo usuário recém-cadastrado MUST receber um **workspace (`org_id`)**
  próprio no banco, com ele como membro `owner`.
- **FR-002**: O `org_id` ativo MUST vir sempre da sessão/identidade autenticada e do
  vínculo (`org_memberships`), NUNCA de input do cliente.
- **FR-003**: Toda tabela de negócio MUST ser isolada por `org_id` via RLS (padrão
  herdado da `004`).
- **FR-004**: Uma identidade (CPF/e-mail) MUST poder pertencer a **N** orgs via
  memberships, com papel por vínculo.

**Plano e gate (campo apenas, nesta etapa)**

- **FR-005**: A `orgs` MUST ter um campo `plan` com valores `free | pro` (default
  `free`).
- **FR-006**: _(futuro)_ "Equipe e Acessos" SHALL ser acessível somente quando
  `plan = pro`. **Não implementar a lógica de bloqueio nesta etapa** — apenas o campo.
- **FR-007**: _(futuro)_ A Clerk Organization SHALL ser criada apenas no upgrade para
  PRO, vinculada via `orgs.clerk_org_id`. **Fora desta etapa.**

**Convite (futuro — fora desta etapa)**

- **FR-008**: _(futuro)_ Conta PRO SHALL convidar `colaborador` (escopo do tenant) e
  `cliente` (escopo restrito a um `company_id`).

---

## 10. Escopo desta etapa

**Incluído agora**

- Apenas o **campo `plan` (`free | pro`)** no modelo (decisão de plano).
- Documentação da decisão de modelo/identidade/auth (este briefing).

**Explicitamente fora de escopo agora** (vira fatia futura)

- Lógica de **enforcement** do gate (bloquear "Equipe e Acessos" para free).
- **Auto-criação** da Clerk Organization no upgrade.
- **Fluxo de convite** (colaborador/cliente) e UI de "Equipe e Acessos".
- **RBAC fino** intra-org e policy de escopo por `company_id` para o tipo `cliente`.
- **Seletor de troca de org** e onboarding multi-org.
- Integração de **billing/assinatura** real.

---

## 11. Edge Cases, Conflitos & Invariantes

> Esta seção define o modelo completo de identidade/membership para que nenhum
> caso-limite vire bug futuro — em especial **vazamento de dados entre tenants**. As
> três **invariantes** abaixo são **normativas** e reduzem quase todo edge case ao
> **mesmo mecanismo de membership**.

### 11.1 Caso motivador — A (PRO) convida B (que já tem workspace free)

B aceita e passa a ter **duas memberships** (o vínculo é **aditivo**, nunca substitui):

| Membership | Papel | Plano da org |
| --- | --- | --- |
| `(org_B, user_B)` | `owner` | free — workspace do próprio B, criado no signup |
| `(org_A, user_B)` | `colaborador` \| `cliente` | pro — org de A |

B **continua dono do workspace dele** e vira **membro** da org de A. Uma identidade,
vários workspaces (modelo Slack/Notion). **Não existe "perda de org"** — convite só
adiciona vínculo.

### 11.2 Invariantes fundamentais (normativas)

**Inv-1 — Plano é propriedade do ORG, não do usuário.**
Não existe "usuário free/pro" global; existe "**org_X é free/pro**" (`orgs.plan`).
Permissões e features são resolvidas pelo **plano da org ativa**. Logo, B (free no
próprio workspace) pode ser **colaborador plenamente funcional** numa org PRO. Quem
paga o PRO é o **dono da org**, pelo benefício **daquela org**.

**Inv-2 — "Org ativa" é conceito NOSSO (`org_memberships`), não do Clerk.**
O workspace free de B **não é uma Clerk Organization** (`clerk_org_id = null`), então
**não aparece** no `OrganizationSwitcher` nativo do Clerk. Portanto, o **seletor e a
org ativa são dirigidos pela nossa `org_memberships`** (free + pro na mesma lista).
Quando a org ativa é PRO, espelhamos a active-org no Clerk (para a UI B2B); quando é
free, é puramente nosso. → **Qualquer** usuário com **2+ memberships** vê o seletor —
inclusive um free convidado para uma org PRO.

**Inv-3 — Convite reconcilia identidade existente; nunca duplica conta.**
Se o e-mail/CPF convidado **já tem conta**, o convite **anexa membership** à identidade
existente — não cria um 2º login para o mesmo CPF. O Nome/CPF digitado pelo convidante
é **rótulo/sugestão**; em divergência, **a identidade real vence**. O aceite casa pelo
**token do convite** (link), não por igualdade de e-mail.

### 11.3 Catálogo de edge cases (resolução proposta)

| # | Edge case | Resolução |
| --- | --- | --- |
| **Identidade** | | |
| 1 | Convidar e-mail que **já tem conta** | Anexar membership à identidade existente (idempotente). Nunca criar 2º login para o mesmo CPF |
| 2 | Convidar e-mail **sem conta** | Convite pendente → no aceite, cria identidade + membership |
| 3 | CPF/Nome digitado por A ≠ dados reais de B | Identidade real vence; dado digitado é só rótulo até o aceite |
| 4 | Aceite com **e-mail diferente** do convidado | Casar pelo **token do convite** (link), não por igualdade de e-mail |
| 5 | A convida o **próprio e-mail** / B **já é membro** / convite **duplicado** | Rejeitar / no-op (idempotência) |
| **Plano / billing** | | |
| 6 | A faz **downgrade** PRO→free com B na equipe | **D2** — recomendado *suspender* memberships (preserva dados), não apagar |
| 7 | Org PRO com **equipe grande** vs. teto de membros do Clerk free | Depende da Q1/Q2 (seção 12, add-on B2B) — manter no radar |
| 8 | B (free) tem **acesso limitado** por ser free? | Não. Acesso em org_A segue o **plano de org_A** (Inv-1). Free só limita o workspace **dele** |
| **Contexto / multi-org** | | |
| 9 | Qual a **org ativa** no login de um usuário multi-org? | Persistir última org ativa; ao abrir link de convite, ativar org_A. **Nunca** default ambíguo (risco de operar no tenant errado) |
| 10 | Switcher precisa listar **free + pro** juntos | Dirigido por `org_memberships` (nosso), não pelo Clerk (Inv-2) |
| 11 | B é `colaborador` em A e `cliente` em C | Role/escopo resolvidos **por membership da org ativa**, nunca global no usuário |
| **Escopo / RBAC** | | |
| 12 | `cliente` escopado à empresa X **vê dados de outra empresa** | RLS do tipo `cliente`: `org_id = ativo AND company_id = scoped_company_id`. Sem isso, vaza |
| 13 | `cliente` acessa **membros/admin** da org | Role `cliente` = só leitura do escopo dele; bloquear gestão de equipe/admin |
| 14 | Mesmo CNPJ em **2 escritórios** (A e D atendem a mesma empresa) | `companies` é **por org**; CNPJ **não é único global**. Duas linhas, dois escopos distintos |
| **Ciclo de vida** | | |
| 15 | A (owner) é **removido/sai** → org sem dono | Proibir remover **último owner**; exigir transferência de ownership |
| 16 | A **deleta a org/conta** | Cascade nas memberships de org_A; B mantém o workspace dele. Definir destino de dados/companies |
| 17 | B é **removido de org_A** com ela ativa na sessão | Reusar edge case do `004`: detectar perda de acesso → cair para outra org / onboarding |
| 18 | B **deleta a própria conta** | Remover memberships dele em toda parte; tratar workspace próprio órfão |
| **Sync Clerk** | | |
| 19 | Membership divergente entre **Clerk** e **nosso DB** (org PRO) | Fonte da verdade = **nosso app escreve nos dois**; webhook reconcilia. Free não tem lado Clerk |
| 20 | Downgrade apaga Clerk Org → membership Clerk some, nosso DB permanece | Reconciliar: nosso DB é canônico; Clerk Org é só camada de UI do PRO |

### 11.4 Decisões de produto pendentes (default recomendado — **a confirmar**)

- **D1 — Usuário convidado que nunca se cadastrou sozinho ganha workspace próprio?**
  *Recomendado:* **sim, sempre cria workspace pessoal free** (uniforme e barato — não é
  Clerk Org, custo zero; ele pode usar/assinar depois). Alternativa: criar só sob
  demanda (mais enxuto, mas quebra a invariante "todo user tem `org_id`").

- **D2 — Downgrade PRO→free com equipe ativa.**
  *Recomendado:* **suspender** (não apagar) as memberships da equipe e **deletar a
  Clerk Org** (zera o $1/org), mantendo `org_memberships` no nosso DB. Re-upgrade
  restaura. Preserva dados, corta custo.

- **D3 — `cliente` é membro do escritório ou entidade separada?**
  *Recomendado:* tratar `cliente` como **membership com `scoped_company_id`** (mesma
  mecânica, role restrito) — não uma entidade paralela. Mantém um só modelo.

---

## 12. Questões em aberto (a confirmar)

1. **Add-on B2B do Clerk abaixo de 100 orgs**: confirmar se as features de
   Organizations (convite/papéis) exigem plano pago/add-on **mesmo** com ≤100 orgs.
   Decide se "Clerk + Gate PRO" sai de graça até 100 PRO ou já paga no 1º PRO.
2. **Limite de membros por org no tier free do Clerk**: confirmar se há teto (ex.: ~20)
   que force o add-on quando um escritório PRO tiver equipe grande.
3. **Alavancas de monetização do solo**: se só "Equipe e Acessos" for PRO, o
   profissional solo fica free permanente. Avaliar outras alavancas (limite de
   empresas-cliente, nº de PGRs, IA, assinaturas digitais).

---

## 13. Impacto na fatia `004`

**O que muda (premissa invertida)**

- `004` afirma "cada Clerk Org = uma Empresa". Corrigir para: **Clerk Org = escritório
  (tenant)**; **Empresa = entidade de negócio (`company_id`) scoped por org**.
- Nasce a entidade de domínio **`companies`** e a dimensão `company_id` nos módulos.
- O `org_id` ativo passa a ser resolvido a partir do **nosso workspace**
  (`org_memberships`), não apenas da org ativa do Clerk (necessário para o free, que
  não tem Clerk Org).

**O que permanece (motor de isolamento intacto)**

- O padrão de RLS por transação (`withOrg`, `set_config('app.current_org', …)`,
  `current_setting('app.current_org', true)`), a tabela `tenant_probe` e a auditoria
  de fronteira de tenant continuam **válidos sem mudança**.

---

## 14. Custo (resumo)

| Cenário | Clerk (Gate PRO) |
| --- | --- |
| 200 usuários free, 0 orgs | **$0** |
| Até 50.000 usuários (free + pro), ≤100 orgs | **$0** |
| 49.900 free + 99 PRO (≤50k MRU, 99 MRO) | **$0** (sujeito à Q1/Q2 da seção 12) |
| 101 orgs | $25 + $1 = **$26/mês** |
| 150 orgs | $25 + $50 = **$75/mês** |
| 200 orgs | $25 + $100 = **$125/mês** |

---

## Referências

- ePGR — produto de referência: https://app.e-pgr.com.br
- Clerk Pricing: https://clerk.com/pricing
- Clerk Organizations / B2B: https://clerk.com/organizations
- Better Auth — Organization plugin: https://better-auth.com/docs/plugins/organization
- Supabase Pricing: https://supabase.com/pricing
- Fatia `004`: `.specs/004-multi-tenant-isolation/`
