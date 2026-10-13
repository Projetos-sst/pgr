# Portal público — arquitetura implementada

> **Atualização de 13/10/2026.** A arquitetura de rotas, o escopo do shell comercial, o fluxo de
> orçamento e o SEO descritos aqui **continuam valendo**. O que mudou foi a camada visual: os
> componentes de `(public)/_components/` e o módulo `_content/platform.ts` foram substituídos
> por `(public)/_portal/`, portado do HTML aprovado pelo Claude Design. A arquitetura
> definitiva está em [`PORTAL-WALKTHROUGH.md §3`](PORTAL-WALKTHROUGH.md).

> Complemento do [`../PLAN.md`](../PLAN.md). Aquele documento planeja os 8 lotes da reunião; este
> descreve **o que foi construído** no recorte do portal público (parte dos lotes C, D e E).

---

## 1. Rotas

```
src/app/(public)/
├── (marketing)/                     ← grupo aninhado: SÓ aqui entram header e rodapé comerciais
│   ├── layout.tsx                   ← shell público + link "pular para o conteúdo"
│   ├── page.tsx                     ← /                        landing
│   ├── seguranca-do-trabalho/       ← /seguranca-do-trabalho    vertente 1
│   ├── medicina-do-trabalho/        ← /medicina-do-trabalho     vertente 2
│   └── orcamento/                   ← /orcamento                pedido de orçamento
├── _components/                     ← componentes do portal
├── _content/platform.ts             ← fonte única de conteúdo
├── sign-in/, sign-up/               ← Clerk (inalteradas, fora do shell)
├── sign/[token]/                    ← assinatura de EPI (intacta)
├── signature-requests/[token]/      ← assinatura genérica (intacta)
└── psychosocial-response/…          ← questionário anônimo (intacta)
```

**Por que um grupo aninhado.** Se o layout de marketing ficasse em `(public)/layout.tsx`, as rotas
por token herdariam header e rodapé comerciais — um trabalhador assinando a entrega de EPI pelo
celular veria menu de vendas. O aninhamento resolve isso na estrutura, sem condicional.

### 1.1 Rotas públicas no `proxy.ts`

As três rotas novas foram declaradas no `createRouteMatcher`. Sem isso o `auth.protect()` do Clerk
redirecionaria o visitante para o login — a landing abriria, mas as vertentes não.

```ts
"/seguranca-do-trabalho",
"/medicina-do-trabalho",
"/orcamento",
```

Nada mais do `proxy.ts` mudou: sandbox basic auth, `NO_STORE_PATH_PREFIXES`, remoção de headers e
o matcher seguem iguais.

---

## 2. Componentes

| Arquivo                | Tipo       | Papel                                                                                             |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `_content/platform.ts` | dado puro  | marca, navegação, vertentes, módulos com disponibilidade, benefícios, passos, FAQ, pitch do login |
| `icon.tsx`             | server     | 22 ícones inline, mesmo traço do `nav-menu.tsx` autenticado                                       |
| `brand-mark.tsx`       | server     | selo + wordmark, nos tons claro e escuro                                                          |
| `section.tsx`          | server     | `SHELL`, `Section`, `SectionHeading`, `Eyebrow` — o ritmo vertical                                |
| `public-header.tsx`    | **client** | header sticky, menu mobile, link ativo, realce ao rolar                                           |
| `public-footer.tsx`    | server     | rodapé em colunas, só links reais                                                                 |
| `cards.tsx`            | server     | `AvailabilityBadge`, `AreaCard`, `BenefitCard`, `ModuleCard`, `StepCard`                          |
| `hero-diagram.tsx`     | server     | composição do hero: a cadeia do produto + as 5 classes de risco                                   |
| `cta-band.tsx`         | server     | faixa comercial reutilizada pelas 3 páginas                                                       |
| `faq-accordion.tsx`    | server     | `<details>`/`<summary>` nativos — acessível e sem JavaScript                                      |
| `reveal.tsx`           | **client** | entrada discreta por `IntersectionObserver`                                                       |
| `quote-form.tsx`       | **client** | formulário de orçamento                                                                           |

**Só 3 Client Components**, cada um por um motivo concreto (estado de menu, observer de viewport,
estado de formulário). Todo o resto é Server Component — nenhuma hidratação desnecessária.

### 2.1 Decisões de componente que vale registrar

- **FAQ em `<details>` nativo.** Um accordion reimplementado em React seria mais código, mais
  hidratação e menos acessível. O `name="faq"` dá o comportamento exclusivo sem uma linha de JS.
- **`Reveal` nunca esconde no HTML inicial.** Renderiza visível no servidor; só depois da
  montagem, e só para elementos abaixo da dobra, aplica o estado escondido. Respeita
  `prefers-reduced-motion` e tem um temporizador de segurança de 2,5s que revela o conteúdo mesmo
  se o observer falhar. Sem JavaScript, a página inteira continua legível.
- **`Reveal` é polimórfico (`as="li"`).** Dentro de `<ol>` ele precisa _ser_ o item: um `<div>`
  entre a lista e os `<li>` é HTML inválido e faz o leitor de tela perder a contagem.
- **Nenhuma biblioteca nova.** Sem Framer Motion, sem biblioteca de ícones, sem headless UI. Todas
  as animações são CSS/Tailwind sobre os keyframes que o `globals.css` já tinha.

---

## 3. Conteúdo — como a honestidade é imposta

`_content/platform.ts` tipa cada módulo com `availability: "available" | "evolving" | "planned"` e
um campo `route` que aponta a tela real.

Três testes unitários guardam a regra (`src/__tests__/unit/app/public-portal-content.test.ts`):

1. todo módulo `available`/`evolving` tem rota;
2. todo módulo `planned` tem `route: null`;
3. nenhum texto do portal contém percentual, "+N" ou "Nx mais" — o que impede o retorno de métrica
   inventada por descuido.

---

## 4. Fluxo de orçamento

```
quote-form.tsx (client)
  └── valida com leadInputSchema (Zod)
        └── submitPlatformLead()                 server action pública, sem gate de sessão
              ├── reparse com o MESMO schema     o cliente não é confiável
              ├── janela por IP hasheado          em memória, best-effort, IP nunca persistido
              └── repositories/platform-leads.ts
                    └── db.insert(platformLeads) sem withOrg — tabela global
                          └── índice único (lower(email), submitted_on)
```

**Camadas de contenção**, da mais fraca à mais forte:

| Camada                      | Alcance                                       |
| --------------------------- | --------------------------------------------- |
| Validação no cliente        | conforto — contornável                        |
| Validação no servidor (Zod) | obrigatória                                   |
| Janela por IP (memória)     | por instância do processo                     |
| Índice único no banco       | global, independe de instância                |
| `GRANT INSERT` sem `SELECT` | impossibilita qualquer leitura pela aplicação |

O erro `23505` do índice único **não** vira mensagem de erro para o visitante: o pedido dele do dia
já está registrado, então a ação devolve sucesso. Mostrar "já existe" vazaria a informação de que
aquele e-mail já se cadastrou.

### 4.1 Migration `0052_platform_leads`

Gerada por `drizzle-kit` (não escrita à mão) e complementada com o `GRANT INSERT` como SQL custom,
seguindo o padrão das migrations do projeto. **Não foi aplicada em nenhum banco** — nem no remoto
do PGR. Última migration real antes desta: `0051_ergonomic_evaluations`.

---

## 5. SEO

| Item           | Implementação                                                                   |
| -------------- | ------------------------------------------------------------------------------- |
| `metadataBase` | de `NEXT_PUBLIC_APP_URL`; **ausente** se a variável não estiver definida        |
| Título         | `template: "%s"` na raiz; cada página pública define o seu                      |
| Descrição      | própria por página                                                              |
| Canonical      | `alternates.canonical` por página                                               |
| Open Graph     | nas 3 páginas de apresentação                                                   |
| `robots.ts`    | bloqueia **tudo** fora de produção; em produção libera só o portal              |
| `sitemap.ts`   | 3 URLs; **vazio** sem `NEXT_PUBLIC_APP_URL` — sitemap com domínio errado é pior |
| `/orcamento`   | `robots: { index: false, follow: true }` — é formulário, não conteúdo de índice |

---

## 6. Acessibilidade — o que foi construído para isso

- `<main id="conteudo">` com link "Ir para o conteúdo" como primeiro foco tabulável;
- landmarks: `<header>`, `<nav aria-label>`, `<main>`, `<footer>`;
- uma única `<h1>` por página, hierarquia sem salto;
- menu mobile com `aria-expanded`, `aria-controls`, fechamento por `Escape` com devolução de foco,
  trava de rolagem do corpo e painel **montado só quando aberto**;
- `aria-current="page"` no link ativo;
- foco visível em todo controle (`focus-visible:ring-*`);
- campos com `<label for>`, erros com `aria-invalid` + `aria-describedby`, `role="alert"` no erro
  de envio e `role="status"` na confirmação;
- FAQ nativo;
- `prefers-reduced-motion` respeitado no `globals.css` e também em cada `hover:-translate-y`
  (`motion-reduce:`) e no `Reveal`.

---

## 7. Dependências

**Nenhuma dependência nova foi instalada.** O `package.json` não mudou.
