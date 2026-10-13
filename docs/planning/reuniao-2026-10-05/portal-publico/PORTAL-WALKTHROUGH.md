# Portal público — walkthrough

Implementação do design **aprovado por Douglas (Tech Lead) e Expedito** no Claude Design.
O que foi entregue, como navegar e por que cada decisão foi tomada.

> **Histórico.** A primeira versão do portal (commit `4de6eb5`) foi construída sobre o design
> system do sistema autenticado, antes de existir o design aprovado. Ela foi **substituída**
> por esta. O commit anterior permanece no histórico da branch e a tag
> `portal-v1-pre-claude-design` aponta para ele.

---

## 1. Fonte de verdade visual

```
C:\Users\carlo\OneDrive\Documentos\redesign\PGR-e — Portal público.html
```

Export do Claude Design, 1.598.122 bytes, com **seis pranchas**: Home, Segurança do Trabalho,
Medicina do Trabalho, Login, Solicitar orçamento e Design system público. O arquivo original
**não foi alterado** — foi apenas servido e lido.

### 1.1 Como a referência foi extraída

O export é um bundle que monta as pranchas em `<iframe>` no navegador — o HTML não está no
código-fonte. O caminho usado:

1. servir o arquivo localmente e abri-lo com Playwright;
2. extrair, de cada `<iframe>`, o DOM renderizado e as regras CSS acessíveis;
3. salvar seis arquivos autônomos (`ref/*.html`) e capturar as referências em 375, 768 e 1440;
4. separar o CSS **autoral** do CSS do bundler (prefixos `sc-*`, `#dc-root`), e descartar as
   `@font-face` em base64 — Manrope e JetBrains Mono já vêm do `next/font`;
5. converter o DOM em JSX preservando classes e estilos do design;
6. capturar os estados que não estão no DOM inicial: menu mobile aberto, itens do FAQ e o
   fluxo interativo do PGR.

Nada disso vive no código de produção: os arquivos intermediários ficaram fora do repositório.

---

## 2. Como abrir

```bash
npm run build && npx next start -p 3001   # a porta 3000 é do Site-PMPA, em container
```

| Rota                     | Prancha de origem      |
| ------------------------ | ---------------------- |
| `/`                      | Home                   |
| `/seguranca-do-trabalho` | Segurança do Trabalho  |
| `/medicina-do-trabalho`  | Medicina do Trabalho   |
| `/orcamento`             | Solicitar orçamento    |
| `/sign-in`, `/sign-up`   | Login (com Clerk real) |

---

## 3. Arquitetura

```
src/app/(public)/
├── (marketing)/              ← shell comercial; as rotas por token ficam de fora
│   ├── layout.tsx            ← wrapper `.pg` + header + footer + skip link
│   ├── page.tsx              ← Home
│   ├── seguranca-do-trabalho/
│   ├── medicina-do-trabalho/
│   └── orcamento/
└── _portal/
    ├── portal.css            ← folha do design, 100% escopada sob `.pg`
    ├── routes.ts             ← `Main.dc.html` → `/`, etc.
    ├── portal-header.tsx     ← client: menu mobile e item ativo
    ├── portal-footer.tsx     ← completo e compacto
    ├── portal-footer-slot.tsx← escolhe a variante pela rota
    ├── portal-faq.tsx        ← client: accordion de 7 perguntas
    ├── pgr-flow.tsx          ← client: tablist de 5 etapas
    └── quote-form.tsx        ← client: visual do design, backend real
```

**Quatro Client Components**, cada um por estado real: menu, FAQ, fluxo do PGR e formulário.
Todo o resto é Server Component — Home, Segurança e Medicina saem **pré-renderizadas**.

### 3.1 `.pg` é a fronteira do tema

Os tokens do design (fundo `#F2F1EE`, tinta `#16171D`, raios 10/12/20/28, container 1240) são
**diferentes** dos tokens do sistema autenticado. Toda a folha vive sob `.pg`, que só existe no
portal e na moldura de autenticação.

Verificado no bundle gerado: **149 de 149 seletores escopados, zero globais**. E o
`globals.css` ficou **byte a byte idêntico à `develop`** — os tokens teal que a v1 havia
adicionado foram revertidos, porque o design traz as próprias cores literais.

---

## 4. Design system aplicado (valores medidos no CSS da referência)

| Item       | Valor                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Tipografia | Manrope + JetBrains Mono — **as mesmas do sistema**                     |
| Indigo     | 500 `#5B63F5` · 600 `#4A51E0` · 700 `#3E44C9` · 100 `#E6E7FE`           |
| Teal       | 500 `#14B8A6` · 600 `#0E9384` · 700 `#0B7A6E`                           |
| Neutros    | ink `#16171D` · texto 2 `#4A4D5A` · legenda `#565966` · borda `#E4E2DD` |
| Fundo      | `#F2F1EE` · superfície `#FAFAF8`                                        |
| Escala     | h1 68/1.02/-0.04em · h2 44/1.08/-0.03em · h3 28/1.15 · corpo 19/1.6     |
| Container  | 1240px + 24px de margem                                                 |
| Botões     | 48px (42px no header) · raio 12px (11px no `sm`) · alvo mínimo 44px     |
| Header     | 72px, sticky, `rgba(242,241,238,0.88)` + `blur(10px)`                   |
| Movimento  | hover 150–220ms · entrada sobe 10px, 450–550ms · foco anel indigo 3px   |

---

## 5. Interações portadas

| Interação        | Como ficou                                                                        |
| ---------------- | --------------------------------------------------------------------------------- |
| Menu mobile      | painel montado só quando aberto; `Escape` fecha e devolve o foco; rolagem travada |
| FAQ              | 7 perguntas, primeira aberta; clicar na aberta fecha — igual ao protótipo         |
| **Fluxo do PGR** | `role="tablist"` de 5 etapas, anterior/próxima, barra de progresso                |
| Formulário       | validação por campo, resumo de erros, contador 0/500, estado de envio             |
| Âncoras          | `scroll-margin-top: 72px`, como o design define                                   |

### 5.1 O fluxo do PGR não virou imagem

A prancha de Segurança tem uma navegação por etapas com conteúdo próprio em cada uma. Ela foi
implementada como componente real, com as cinco etapas e seus textos aprovados. Acréscimo nosso
sobre o protótipo: **navegação por teclado** (setas, `Home`/`End`) e `tabIndex` roving, como a
prática de ARIA exige para `tablist`. O visual não muda.

---

## 6. Login — visual aprovado, Clerk real

O protótipo traz uma autenticação **demonstrativa**: botão Google decorativo, campo de e-mail e
um `setTimeout` simulando acesso. **Nada disso foi copiado.**

| O que veio do design                          | O que é real                                   |
| --------------------------------------------- | ---------------------------------------------- |
| Painel de marca em gradiente, com 3 destaques | `<SignIn>` do Clerk dentro do cartão           |
| Cartão branco, raio 22px, sombra              | Google, e-mail, recuperação, redirects, tenant |
| "Ainda não tem acesso? Solicitar orçamento"   | link real para `/orcamento`                    |
| "Autenticação protegida por Clerk"            | é verdade                                      |

O Clerk v7 desenha o próprio cartão por CSS-in-JS, o que produzia **um cartão dentro do outro**.
Resolvido neutralizando só a superfície (`cl-card`, `cl-cardBox`, `cl-footer`) por CSS, pelos
nomes de classe públicos do Clerk — tematização, não manipulação de DOM, e sem tocar em
autenticação.

Correções anteriores **preservadas e reverificadas**: sem overflow em 375px e 768px; o widget diz
"para continuar em **PGR-e**", não "sst-manager".

---

## 7. Orçamento — visual aprovado, backend da PR #97

```
valida no cliente → Server Action → revalida com Zod → janela por IP → grava
```

Preservado da entrega anterior: tabela global `platform_leads`, `GRANT INSERT` **sem SELECT**,
deduplicação `(lower(email), submitted_on)`, janela de 3 envios/10min por IP **hasheado só em
memória**. O protótipo simula o envio; aqui a confirmação só aparece com `ok` do servidor.

**Validado de ponta a ponta** contra Postgres real: o pedido foi gravado com o interesse vindo
de `?interesse=medicina` e o e-mail normalizado.

### 7.1 Melhoria encontrada durante o QA

Com o banco fora do ar, a ação deixava o erro subir e o visitante via uma tela 500. Agora falha
de conectividade vira o **estado de erro do próprio design** (`role="alert"`), com o erro
registrado no log do servidor. Não silencia nada: só não derruba a página de quem queria pedir
um orçamento.

---

## 8. Divergências intencionais

Três, todas para não publicar informação que não existe:

1. **Coluna "Institucional" do rodapé.** O design traz um link para
   `#politica-de-privacidade` e dois marcadores literais — `[CONTATO — A DEFINIR]` e
   `[RAZÃO SOCIAL E CNPJ — A CONFIRMAR]`. Não há página de privacidade, e inventar CNPJ,
   endereço ou texto jurídico seria pior. A coluna fica de fora até existirem os dados. É o que
   explica os ~12px de diferença de altura do rodapé.
2. **Consentimento do formulário.** O design diz "Li e concordo com a Política de Privacidade",
   apontando para a mesma página inexistente. O aceite continua **obrigatório e validado**, mas
   o rótulo descreve o uso real: "Autorizo o uso dos meus dados de contato para responder a esta
   solicitação."
3. **Título do painel de login.** Era `<h1>` no design; virou `<p>` com estilo idêntico, porque
   o Clerk já renderiza "Entrar" como `h1` e duas marcações de nível 1 quebram a navegação por
   cabeçalho.

Acréscimos de acessibilidade que o protótipo não tinha e que não mudam o visual: link "pular
para o conteúdo", bloco `prefers-reduced-motion` e navegação por teclado no fluxo do PGR.

---

## 9. O que não foi tocado

PDF, template e a integração DOCX/Google do Douglas (`feature/pgr-docx-templates`) ·
CNAE/CBO (`feature/lot-04-cnae-cbo`, congelada em `8dd86a9`) · GED · módulos clínicos ·
`globals.css` · regras de autenticação, tenant e RLS · as três rotas públicas por token.

Nenhum arquivo de `(protected)/` no diff.
