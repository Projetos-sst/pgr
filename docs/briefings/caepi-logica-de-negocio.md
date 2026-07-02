# CAEPI/CA — Lógica de negócio (guia para entender antes de codar)

> **Objetivo deste documento:** explicar, em linguagem de negócio, **o que é o CAEPI**, **o que
> a fonte externa precisa entregar** e **como o fluxo funciona ponta a ponta** — sem pré-requisito
> técnico. É o companheiro conceitual do briefing técnico
> [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md).
>
> Se você só quer a resposta curta, vá para a seção **[TL;DR](#tldr)**.

---

## TL;DR

- **CA** = Certificado de Aprovação que o **MTE** dá a cada _modelo_ de EPI. É **dado público** do
  governo, igual para todo mundo.
- **CAEPI** = a base do MTE com **todos os CAs** do país.
- No nosso produto, o CAEPI serve **para uma coisa só**: quando o usuário cadastra um EPI e digita o
  número do CA, o sistema **confere se o CA existe/está vigente** e **autopreenche** fabricante, norma
  e validade. **Nunca bloqueia** o cadastro.
- Existem **duas histórias de dados que não se misturam**:
  1. **Base pública do CAEPI** — espelho do governo, **global**, só leitura, atualizada por um robô.
  2. **Seu mundo** (catálogo de EPI, estoque, entrega) — dado do cliente, isolado por empresa,
     editável.
- A **única ponte** entre as duas é o **momento da consulta**: leio a base pública para
  validar/preencher o formulário; ao salvar, os campos viram uma **cópia** dentro do catálogo do
  cliente.

---

## 1. Contexto de domínio (para quem nunca viu)

- **EPI** = Equipamento de Proteção Individual (capacete, luva, bota, óculos, máscara, protetor
  auricular…).
- **CA (Certificado de Aprovação)** = número emitido pelo **MTE** (Ministério do Trabalho e Emprego).
  Pela **NR-6**, todo EPI usado/comercializado no Brasil precisa de um CA válido. O CA tem **data de
  validade** e uma **situação** (vigente, vencido ou cancelado).
- **CAEPI** = o sistema/base do MTE que registra **todos** os CAs.

Pensa no CA como o "RG do modelo de EPI": ele não descreve _a sua luva no estoque_, ele descreve _o
modelo de luva aprovado pelo governo_. Duas empresas diferentes que compram a mesma luva usam **o
mesmo CA**.

---

## 2. O que é, na prática, um registro de CA

O CAEPI é um **catálogo público**: **uma linha por número de CA**. Cada linha descreve um modelo de
EPI aprovado. Um registro real tem, em essência:

```
CA 31469
├─ validade:      2025-11-30
├─ situação:      VÁLIDO | VENCIDO | CANCELADO
├─ fabricante:    3M DO BRASIL LTDA   (+ CNPJ 45.985.371/0001-08)
├─ natureza:      Nacional | Importado
├─ equipamento:   "Respirador purificador de ar tipo peça semifacial (PFF2)"
├─ descrição:     "... elástico, clipe nasal ..."
├─ aprovado para: proteção das vias respiratórias contra poeiras e névoas
└─ norma(s):      ABNT NBR 13698:2011
```

> **Importante:** isso é **dado público, igual para todos**. Não tem dono, não tem `org_id`, ninguém
> edita pela mão. É a "tabela do governo".

Dos campos acima, o produto usa:

| Campo         | Para quê                                                     |
| ------------- | ------------------------------------------------------------ |
| `situação`    | decidir se é **válido / vencido / cancelado**                |
| `validade`    | comparar com a data de hoje (válido vs vencido)              |
| `fabricante`  | **autopreencher** o campo Fabricante do EPI                  |
| `norma`       | **autopreencher** o campo Norma do EPI                       |
| `equipamento` | contexto/descrição (ajuda o usuário a confirmar que é o EPI) |

---

## 3. O que a "API externa" precisa entregar (e por que ela não é bem uma API)

A responsabilidade da fonte externa é **só uma**: dado um número de CA, devolver o registro da
seção 2 — ou dizer "não existe". Ela **não** sabe nada do seu estoque, das suas empresas ou dos seus
funcionários. É uma **consulta de referência**.

O problema: **o MTE não expõe uma API REST estável** para isso. As fontes oficiais reais são:

1. **Portal web** de consulta (`caepi.mte.gov.br`) — lento, sujeito a captcha e instabilidade.
   Scraping é frágil.
2. **Download da base completa** — um **arquivo TXT delimitado por `|`** com **todos os CAs**,
   publicado periodicamente pelo MTE.

Ou seja: a "API externa" na prática é **um arquivo que o governo publica**. Nós o baixamos de tempos
em tempos e viramos "a API" internamente.

### Decisão: ingestão da base + consulta local (não proxy ao vivo)

| Abordagem                                     | Como funciona                                             | Risco                                                           |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| **Proxy ao vivo** (o que o ePGR faz)          | a cada consulta, o servidor busca o CA na fonte externa   | **frágil**: se o upstream cair/bloquear, a consulta quebra      |
| **Ingestão + consulta local** (nossa escolha) | um robô baixa a base inteira; a consulta lê o banco local | robusto: se o upstream cair, só o **robô** falha, não o usuário |

> **Prova ao vivo (02/07/2026):** o backend do ePGR (`back.e-pgr.com.br/api/ca/{numero}`) devolveu
> `500 · "Erro ao consultar CA" · "Response status code does not indicate success: 403 (Forbidden)"`.
> A consulta de CA do produto de referência estava **fora do ar** porque a fonte externa bloqueou o
> servidor deles. É exatamente esse acoplamento que a ingestão local evita.

---

## 4. As duas histórias de dados (o ponto que costuma confundir)

```
━━━ HISTÓRIA A: base pública do CAEPI (roda sozinha, no fundo) ━━━

  [Robô / Cron 1x/dia]
       │  baixa o TXT oficial do MTE
       ▼
  parse (split por "|")  ──►  UPSERT em lote  ──►  ┌──────────────────────────┐
                                                     │  caepi_certificates      │  GLOBAL
                                                     │  (todos os CAs do país)  │  sem org_id
                                                     └──────────────────────────┘  só leitura
   • ninguém edita à mão
   • se o download falhar, a base anterior continua servindo


━━━ HISTÓRIA B: usuário cadastra um EPI dele (no caminho do request) ━━━

  Usuário digita "CA 31469" no formulário de Equipamento (EPI)
       │
       ▼
  lookupCa("31469")  ──►  SELECT em caepi_certificates  (LOCAL, milissegundos)
       │
       ├─ achou + vigente  →  autopreenche Fabricante/Norma/Validade  (badge verde)
       ├─ achou + vencido  →  autopreenche + aviso "CA vencido"
       └─ não achou        →  aviso "CA não encontrado" (campo continua editável)
       │
       ▼
  Usuário confere e clica em Salvar
       │
       ▼
  ┌─────────────────────────────────────┐
  │  epi_catalog  (SEU banco)           │  dado DO cliente, com org_id + RLS
  │  ca, name, manufacturer, norm,      │  é uma CÓPIA (snapshot) dos campos
  │  ca_valid_until, category, ...      │  no momento do salvamento
  └─────────────────────────────────────┘
```

**A chave que resolve a confusão:** a consulta de CA **não grava nada** na base pública. Ela só
**lê** o espelho do governo para _ajudar a preencher o formulário_. Quando o usuário salva, os campos
viram uma **cópia** dentro do `epi_catalog` dele — daí pra frente é dado dele, editável, isolado por
empresa.

---

## 5. De quem é cada dado

| Tabela                          | Dono            | `org_id`/RLS?          | Quem escreve              | Papel                                                     |
| ------------------------------- | --------------- | ---------------------- | ------------------------- | --------------------------------------------------------- |
| `caepi_certificates`            | **Público/MTE** | ❌ global, sem tenant  | só o **robô** de ingestão | "Existe esse CA? Está válido? De quem é?"                 |
| `epi_catalog`                   | **Cliente**     | ✅ isolado por empresa | o **usuário** (staff)     | "Quais EPIs EU cadastrei" (com CA validado como atributo) |
| `epi_stock` / `stock_movements` | **Cliente**     | ✅ isolado por empresa | o **usuário**             | "Quanto tenho em estoque, entradas/saídas"                |
| `epi_deliveries`                | **Cliente**     | ✅ isolado por empresa | o **usuário**             | "Pra quem entreguei, com assinatura"                      |

> O CAEPI é a **única exceção** justificada ao princípio multi-tenant: é dado público, não há
> cruzamento de tenants a proteger, então a tabela é global e sem RLS. Todo o resto continua isolado
> por empresa como sempre.

---

## 6. Os três estados de um CA (e o que a tela faz)

| Estado          | Quando                                             | Comportamento na UI                                                  |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| **Válido**      | CA existe na base **e** `validade >= hoje`         | badge verde + autopreenche fabricante/norma/validade                 |
| **Vencido**     | CA existe **mas** `validade < hoje` (ou cancelado) | badge "CA vencido" (aviso, distinto de inexistente) + ainda preenche |
| **Inexistente** | CA não está na base                                | aviso "CA não encontrado"; campos seguem editáveis                   |

Regras transversais:

- A consulta **nunca bloqueia** o salvamento — é auxiliar. O usuário pode salvar um EPI com CA
  vencido/inexistente se quiser (o campo é editável).
- Base ainda **não sincronizada** (tabela vazia) → tratar como "não encontrado" com aviso "base CAEPI
  ainda não sincronizada", **não** como erro fatal.
- Formato inválido (não é número) → nem consulta.

---

## 7. Walkthrough concreto (exemplo de ponta a ponta)

**Cenário:** a consultoria "SST Manager" vai cadastrar um respirador PFF2 no catálogo de EPI da
empresa cliente "Obra XPTO".

1. **(fundo, já aconteceu ontem)** O robô baixou o TXT do MTE e a linha do `CA 31469` está em
   `caepi_certificates` com validade `2025-11-30`, fabricante `3M DO BRASIL LTDA`, norma
   `ABNT NBR 13698:2011`, situação `VÁLIDO`.
2. O usuário abre **Equipamentos → Novo**, seleciona a empresa "Obra XPTO", tipo **EPI**.
3. Digita `31469` no campo **CA** e sai do campo (blur) / clica na lupa.
4. `lookupCa("31469")` faz um `SELECT` local → acha, `validade >= hoje` → **válido**.
5. A tela mostra badge verde e **autopreenche**: Fabricante = `3M DO BRASIL LTDA`, Norma =
   `ABNT NBR 13698:2011`, Validade = `30/11/2025`.
6. O usuário ajusta Nome ("Respirador PFF2 3M"), Categoria, Unidade, e clica **Salvar**.
7. Nasce **uma linha em `epi_catalog`** no tenant da "Obra XPTO", com esses campos **copiados**. A
   `caepi_certificates` **não muda**.
8. A partir daqui, estoque e entrega desse EPI trabalham **só** com o `epi_catalog` do cliente. O
   CAEPI só voltará a ser tocado se alguém consultar outro CA.

**Variação (CA vencido):** no passo 4, se `validade < hoje`, o badge vira "CA vencido", ainda
preenche os dados, e o usuário decide se cadastra assim mesmo.

---

## 8. O que **não** faz parte disso (fora de escopo)

- O CAEPI **não** maneja estoque, entrega ou PGR — ele só valida/preenche o CA.
- **Não** há chamada externa por request do usuário — a consulta é local. O único acesso externo é o
  robô de ingestão, fora do caminho do usuário.
- **Não** há edição manual da base pública.
- Histórico de versões de um CA e notificação proativa de vencimento ficam para o futuro.

---

## 9. Como verificar você mesmo

Para bater o olho e confirmar a lógica sem depender deste texto:

1. **No produto de referência (ePGR):** entre em **Cadastro → Equipamentos → Novo**. Repare que o
   campo **CA** tem uma **lupa de consulta** e que Fabricante/Norma/Validade são autopreenchíveis.
   Repare também que **Estoque de EPI** e **Entrega de EPI Digital** são telas **separadas** — ou
   seja, catálogo, estoque e entrega são camadas distintas (todas do banco deles).
2. **A fonte oficial:** acesse `https://caepi.mte.gov.br/` e procure **"Base de dados do sistema CAEPI
   (Download)"**. É o TXT que a ingestão vai consumir. A existência desse download (em vez de uma API)
   é o que justifica a arquitetura.
3. **A fragilidade do proxy ao vivo:** o backend do ePGR expõe `back.e-pgr.com.br/api/ca/{numero}`.
   Em 02/07/2026 ele devolvia `500` com `"Response status code does not indicate success: 403
(Forbidden)"` — a consulta ao vivo estava quebrada por bloqueio do upstream. É o cenário que a
   ingestão local nos protege.

---

## 10. Glossário rápido

| Termo                    | Significado                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| **EPI**                  | Equipamento de Proteção Individual                                          |
| **CA**                   | Certificado de Aprovação de um modelo de EPI (número + validade + situação) |
| **CAEPI**                | Base do MTE com todos os CAs                                                |
| **MTE**                  | Ministério do Trabalho e Emprego                                            |
| **NR-6**                 | Norma que obriga EPI a ter CA válido                                        |
| **Ingestão**             | Baixar a base oficial e gravar no nosso banco (robô/cron)                   |
| **`caepi_certificates`** | Nossa tabela global (espelho do MTE), só leitura                            |
| **`epi_catalog`**        | Catálogo de EPI do cliente (dado dele, com o CA validado como atributo)     |

---

## Referências

- Briefing técnico da fatia: [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md).
- Camada base de integrações (CEP/CNPJ): [`008-integracoes-externas.md`](./008-integracoes-externas.md).
- Modelo de dados de EPI (fatia 008): `src/shared/db/schema` + `docs/produto/02-modelagem-de-dados.md`.
- Cron + `CRON_SECRET`: `docs/produto/04-integracoes-e-servicos.md`.
- Fonte oficial: `https://caepi.mte.gov.br/` → "Base de dados do sistema CAEPI (Download)".
