# Portal público — auditoria focalizada

> Complemento do [`../AUDIT.md`](../AUDIT.md) (auditoria dos 16 requisitos da reunião de
> 05/10/2026). Este documento **não** repete aquela auditoria: cobre só o recorte do portal
> público — landing, páginas das duas vertentes, login, orçamento, navegação, design system,
> responsividade, SEO e acessibilidade. Requisitos da reunião envolvidos: **R04** (tela inicial
> pública), **R05** (login e acessos), **R06** (identidade visual), **R09** (estrutura do portal
> em duas vertentes).

Base: `origin/develop` = `f7e417d`. Branch: `feature/reuniao-2026-10-05-pgr-portal`.

---

## 1. Estado anterior

### 1.1 A entrada pública eram 42 linhas

`src/app/(public)/page.tsx` tinha título, um parágrafo e dois botões. Sem header, sem rodapé, sem
nenhuma apresentação do produto, sem vertentes, sem orçamento. Quem chegava pela internet não
conseguia saber o que o sistema faz.

### 1.2 O que existia de rota pública

| Rota                                  | Natureza                    | Tocada nesta entrega |
| ------------------------------------- | --------------------------- | -------------------- |
| `/`                                   | landing de 42 linhas        | **substituída**      |
| `/sign-in`, `/sign-up`                | Clerk dentro do `AuthFrame` | ajuste visual        |
| `/sign/[token]`                       | assinatura de EPI por token | **não tocada**       |
| `/signature-requests/[token]`         | assinatura genérica         | **não tocada**       |
| `/psychosocial-response/[id]/[token]` | questionário anônimo        | **não tocada**       |

As três rotas por token continuam exatamente como estavam. A separação é estrutural, não uma
promessa: o shell comercial vive num grupo aninhado `(public)/(marketing)/`, então header e rodapé
de marketing não alcançam nenhuma delas.

### 1.3 Dois defeitos reais no login, medidos

| Defeito                                              | Medição anterior        | Causa                                                                                              |
| ---------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Barra horizontal em 375px                            | `scrollWidth` 399 × 360 | `p-8` (64px) sobre 375px deixava 311px para um cartão do Clerk que pede ~400px                     |
| Barra horizontal em 768px                            | `scrollWidth` 765 × 753 | o split `md:grid-cols-2` abria exatamente em 768px: 384px por coluna, 320px úteis                  |
| Widget anunciava "para continuar em **sst-manager**" | texto visível na tela   | nome da aplicação no painel do Clerk, interpolado em 18 strings do pt-BR por `{{applicationName}}` |

O terceiro não estava em lugar nenhum do repositório — por isso a auditoria anterior não achou a
origem. Confirmado varrendo `@clerk/localizations`.

### 1.4 Afirmação sem fonte

`auth-frame.tsx` exibia **"IA com 92% de precisão na detecção proativa"**. Não há nenhuma medição
desse número no repositório. Numa landing pública isso deixa de ser texto de tela interna e passa a
ser afirmação comercial verificável.

---

## 2. Identidade visual real — confirmada no código

Tudo abaixo foi lido em `src/app/globals.css` e `src/app/layout.tsx`, não herdado da auditoria
anterior.

| Item        | Valor real                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| Tipografia  | **Manrope** (`--font-sans`) e **JetBrains Mono** (`--font-mono`), `next/font` |
| Primária    | `--color-primary: #5b63f5`; `--color-primary-strong: #4f46e5`                 |
| Fundo       | `--color-bg: #eae9e8` + 4 gradientes radiais fixos no `body`                  |
| Superfície  | `--color-surface: #ffffff`                                                    |
| Texto       | `#1b1f2e` / muted `#52576e` / subtle `#8c91a8`                                |
| Status      | danger `#d33a3f`, green `#0e9f6e`, amber `#f5a524` (+ `-strong` `#c9820a`)    |
| Raios       | field 11px, card 12px, glass 18px, pill 30px                                  |
| Superfícies | `.app-nav`, `.glass-card`, `.glass-menu`, `.glass-panel`, `.glass-input`      |
| Botão       | `.btn-primary` com `--shadow-primary`                                         |
| Animação    | 6 keyframes + `.hover-lift`, **com bloco `prefers-reduced-motion` já pronto** |
| Modo escuro | **desligado de propósito** — `@custom-variant dark (&:where(.dark, .dark *))` |

**Conclusão:** o design system existe e é consistente. Esta entrega **não criou um segundo**. A
única adição ao `@theme` foi o par de tokens da vertente Medicina.

### 2.1 Única adição de token

```css
--color-accent-teal: #14a098;
--color-accent-teal-strong: #0b7a74; /* variante que passa AA em texto */
```

Justificativa: a Medicina precisa ser reconhecível como _área_ ao lado do indigo, sem virar uma
segunda marca e sem reutilizar o `accent-green`, que já significa "sucesso" nos badges.

---

## 3. Referência ESO — o que foi observado

Acessado em navegador real (Chrome DevTools MCP) em 09/10/2026. Páginas lidas: a home,
`/software-para-seguranca-do-trabalho` e `/software-para-medicina-do-trabalho`.

**Limitação encontrada e registrada:** o Cloudflare do site interceptou a navegação para a página
de Medicina uma vez ("Executando verificação de segurança"); resolveu-se com um reload. Em 375px o
site reporta `clientWidth` 486 — ele **não é verdadeiramente responsivo**, usa zoom forçado e um
`navbar-toggle` de Bootstrap.

### 3.1 Arquitetura da informação aproveitada

| Padrão do ESO                                              | O que fizemos                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| As duas vertentes como itens de **primeiro nível** no menu | Adotado: `/seguranca-do-trabalho` e `/medicina-do-trabalho`                  |
| "SOLICITAR ORÇAMENTO" como CTA destacado no header         | Adotado — mas o nosso **leva a um formulário real**, não a `href="#"`        |
| Hero com lista de capacidades em duas colunas              | Adotado, com capacidades que têm módulo correspondente                       |
| Um bloco por vertente na home, terminando em "ver mais"    | Adotado (seção "Duas vertentes")                                             |
| Página de vertente com fluxo numerado `01…04`              | Adotado (`01…05` em Segurança, `01…04` em Medicina)                          |
| Página de vertente com "Funcionalidades" + diferenciais    | Adotado como "Módulos", **com selo de disponibilidade** — o ESO não tem isso |
| Rodapé com colunas de links                                | Adotado, só com links que existem                                            |
| Depoimentos de clientes                                    | **Não adotado** — não temos depoimentos reais; inventar seria fraude         |
| Selos "SITE SEGURO", "Amazon AWS"                          | **Não adotado** — selo de terceiro que não contratamos                       |
| CTAs repetidos apontando para `#`                          | **Não adotado** — todo CTA aqui tem destino real                             |

**Nada foi copiado**: nenhum texto, cor, imagem, ícone, componente ou trecho de código do ESO está
nesta entrega. A identidade é a do PGR-e.

---

## 4. Inventário de recursos — a base da honestidade da landing

Levantado das rotas reais em `src/app/(protected)/**/page.tsx` e dos schemas em
`src/shared/db/schema/`. É o que alimenta `_content/platform.ts`.

### 4.1 Disponível (tem rota e tabela)

PGR (`/pgr`) · Riscos (`/risks`) com avaliações, medidas de controle e avaliações ergonômicas ·
Metodologia de risco (`/risk-methodology`) · Auditorias de risco (`/risk-audits`) · GES (`/ges`) ·
Empresas, Unidades de obra, Funções, Funcionários · EPI: catálogo, estoque, devoluções, entregas com
assinatura · Inspeções de segurança, equipamentos e veículos + planos de inspeção · Permissões de
trabalho · Incidentes · Planos de ação · Ordens de serviço · Treinamentos: catálogo, conformidade,
vencimento · Psicossocial: campanhas e fatores de risco · Assinatura digital · **ASO**
(`/health-exams`) · **Médicos** (`/medicos`).

### 4.2 Em evolução

eSocial SST (`/esocial`) — configuração e painel existem; GED (`/documents`) — modelo e tela
existem, o módulo segue em construção.

### 4.3 Não implementado — e marcado como planejado na interface

| Recurso                     | Evidência de ausência                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| PCMSO                       | zero ocorrências em `src/`                                                            |
| Absenteísmo                 | zero ocorrências em `src/`                                                            |
| Portal de clínicas / exames | `medicos.clinic` é `text` livre (`schema/medicos.ts:37`); não há entidade clínica     |
| Envio de e-mail             | nenhuma dependência de e-mail no `package.json` (sem nodemailer/resend/sendgrid/smtp) |

Esses quatro aparecem na página de Medicina com o selo **"Planejado"**, em bloco separado e com o
texto dizendo que ainda não estão implementados.

---

## 5. Orçamento — auditoria do que existia

Procurado em `src/`: formulário de contato, tabela de leads, endpoint, CRM, integração de e-mail.
**Nada disso existia.** Não havia fluxo para reaproveitar.

### 5.1 O que foi implementado, e por quê assim

| Decisão                                              | Razão                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tabela `platform_leads` **sem `org_id`**             | o visitante não tem tenant; `withOrg` não se aplica. Segunda exceção documentada ao Princípio I             |
| `app_runtime` recebe **só `INSERT`**, nunca `SELECT` | é o que torna impossível a consulta pública de leads — inclusive do registro recém-gravado                  |
| RLS habilitado com uma policy só, de `INSERT`        | produção força RLS em toda tabela nova (event trigger `ensure_rls`); sem policy, a gravação falharia lá     |
| Índice único `(lower(email), submitted_on)`          | deduplicação no banco: o mesmo e-mail não grava dois pedidos no mesmo dia, em qualquer número de instâncias |
| Janela por IP **hasheado e só em memória**           | primeira barreira contra abuso sem persistir endereço IP                                                    |
| Campos mínimos, sem CPF e sem dado de saúde          | LGPD: coletar só o necessário para responder um contato comercial                                           |

### 5.2 Desvio consciente da regra das 4 superfícies

O `CLAUDE.md` exige Server Action + espelho REST + `api-design.md` + Postman para **todo CRUD**.
Aqui foi entregue **só a Server Action**, de propósito:

- não é um CRUD — não há listagem, edição nem exclusão, e não há tela de administração;
- um espelho REST exporia um endpoint de escrita pública (vetor de spam) e, com `GET`,
  contradiria diretamente a exigência de não permitir consulta pública de leads.

Quando existir a tela administrativa de leads, ela será um CRUD de verdade, pela conexão
owner/unpooled, e aí sim as quatro superfícies se aplicam.

### 5.3 Dependência de produto, em aberto

**Para onde vai o pedido depois de gravado?** Hoje ele fica na tabela e não notifica ninguém. Não
há capacidade de e-mail no projeto e não há endereço comercial definido — e inventar um seria pior
do que registrar a lacuna. Ver [§8](#8-pendências-e-decisões).

---

## 6. O que foi reaproveitado, corrigido e criado

### 6.1 Reaproveitado (sem reescrever)

`.app-nav`, `.glass-card`, `.glass-menu`, `.glass-panel`, `.glass-input`, `.btn-primary`,
`.hover-lift`, `.animate-fade-slide-up`, o bloco `prefers-reduced-motion`, todos os tokens do
`@theme`, as duas fontes, o `AuthFrame`, o `clerkAppearance` e o gradiente de marca.

### 6.2 Corrigido

| Problema                               | Correção                                                               |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Overflow do login em 375px             | `px-4` no mobile + `min-w-0` na coluna do formulário                   |
| Overflow do login em 768px             | split movido de `md:` para `lg:`                                       |
| "sst-manager" no widget                | `clerk-localization.ts` troca `{{applicationName}}` pela marca real    |
| "IA com 92% de precisão"               | substituída por afirmação verificável sobre o fluxo de sugestão por IA |
| Cards de grade com alturas desiguais   | `h-full` no card e no wrapper de animação (achado na revisão visual)   |
| `Reveal` quebrando semântica de `<ol>` | passou a aceitar `as="li"` — sem `<div>` entre a lista e os itens      |

### 6.3 Criado

Grupo `(public)/(marketing)/` com layout, landing, duas páginas de vertente e orçamento;
`_content/platform.ts` (fonte única de conteúdo); 9 componentes em `_components/`; tabela
`platform_leads` + migration `0052` + domínio + repositório + Server Action; `robots.ts`;
`sitemap.ts`; `site-url.ts`; 3 suítes de teste.

---

## 7. Áreas que NÃO foram modificadas

| Área                                                          | Verificação                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Template e preenchimento do PDF (responsabilidade do Douglas) | nenhum arquivo de `pdf`/`template` no diff                  |
| Backlog CNAE/CBO — branch `feature/lot-04-cnae-cbo`           | intacta em `8dd86a9`                                        |
| GED / Documentos                                              | nenhum arquivo tocado                                       |
| Módulos clínicos internos                                     | nenhum arquivo tocado                                       |
| Autenticação, tenant, RLS das tabelas de tenant               | nenhuma regra alterada; só aparência e localização do Clerk |
| Visual do dashboard autenticado                               | nenhum arquivo de `(protected)/` tocado                     |

---

## 8. Pendências e decisões

### 8.1 Decisões que a missão já resolveu

| Decisão anterior (PLAN.md §Decisões)                         | Resolvida como                                           |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| D3 — Orçamento é formulário próprio ou o mesmo pré-cadastro? | **O mesmo**: uma tabela, com campo `source` e `interest` |
| D4 — Saúde/Segurança: seções ou rotas próprias?              | **Rotas próprias**                                       |
| D8 — manter a afirmação "92% de precisão"?                   | **Removida**                                             |

### 8.2 Em aberto — bloqueiam só o que está indicado

| #   | Pendência                                                              | Tipo                   | O que fica bloqueado                            |
| --- | ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------- |
| 1   | Destino do pedido de orçamento (e-mail? tela administrativa? ambos?)   | decisão do interessado | notificação e leitura dos leads                 |
| 2   | Renomear a aplicação no painel do Clerk de `sst-manager` para `PGR-e`  | configuração externa   | nada — já contornado na localização             |
| 3   | `NEXT_PUBLIC_APP_URL` não definido no ambiente                         | configuração externa   | `sitemap.xml` sai vazio; sem canonical absoluto |
| 4   | Aplicar a migration `0052` no banco                                    | dependência técnica    | o formulário só grava depois de aplicada        |
| 5   | Logotipo: hoje a marca é o selo "P" + wordmark, não há arquivo de logo | decisão do interessado | nada — o selo é consistente com o `AuthFrame`   |

**Nenhuma dessas pendências impede a demonstração das páginas.** A 4 impede apenas o envio
efetivo do formulário.
