# Portal público — QA

Execução em **09/10/2026**, contra o **build de produção** (`npm run build` + `next start -p 3001`),
não contra o dev server. Base de dados: **Postgres efêmero em container** — o banco remoto do PGR
não foi tocado em nenhum momento desta execução.

Ferramentas: **Chrome DevTools MCP** (inspeção de CSS, medição de overflow, console, cabeçalhos),
**Playwright MCP** (fluxos de interação) e um script Playwright do próprio projeto
(`node_modules/playwright`) para a matriz de viewports e as capturas.

---

## 1. Testes técnicos

| Comando                             | Resultado                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `npm run check`                     | **PASS** (exit 0) — format + lint + typecheck + unit                   |
| ↳ lint                              | **0 erros**, 4 avisos — os mesmos 4 preexistentes da `develop`         |
| ↳ typecheck                         | **0 erros**                                                            |
| ↳ unit                              | **145 suítes / 1393 testes PASS** (baseline era 143 / 1367 → +2 / +26) |
| `npm run build`                     | **PASS** (exit 0)                                                      |
| Integração `platform/leads.test.ts` | **9 / 9 PASS** contra Postgres real                                    |

### 1.1 Avisos preexistentes (não são regressão)

`no-img-element` em `company-form.tsx`, `employee-form.tsx` e `epi-catalog-form.tsx`; `Company`
não usado em `domains/pgr/companies.ts`. Todos já estavam na `develop`; nenhum arquivo desses foi
tocado.

### 1.2 Saída do build para as rotas novas

```
┌ ○ /                        (estática)
├ ○ /seguranca-do-trabalho   (estática)
├ ○ /medicina-do-trabalho    (estática)
├ ƒ /orcamento               (dinâmica — lê searchParams)
├ ○ /robots.txt              (estática)
└ ○ /sitemap.xml             (estática)
```

As três páginas de apresentação saem **pré-renderizadas**, que é o melhor caso para quem chega
pela internet.

---

## 2. Matriz de responsividade

Script: `qa-viewports.mjs` — para cada combinação, carrega a página, rola até o fim (dispara as
animações de entrada), volta ao topo e mede
`document.documentElement.scrollWidth <= clientWidth`.

| viewport        | /   | /seguranca-do-trabalho | /medicina-do-trabalho | /orcamento | /sign-in |
| --------------- | --- | ---------------------- | --------------------- | ---------- | -------- |
| **320 × 700**   | ok  | ok                     | ok                    | ok         | ok       |
| **375 × 812**   | ok  | ok                     | ok                    | ok         | ok       |
| **768 × 1024**  | ok  | ok                     | ok                    | ok         | ok       |
| **1440 × 900**  | ok  | ok                     | ok                    | ok         | ok       |
| **1920 × 1080** | ok  | ok                     | ok                    | ok         | ok       |

**Barra horizontal indevida: 0 de 25 combinações.** Em todas, `scrollWidth == clientWidth`.

Medido junto, nas mesmas 25 combinações:

- **exatamente um `<h1>`** por página;
- **nenhum salto de nível de cabeçalho** (sem `h1 → h3`);
- **0 imagens sem `alt`**.

Nenhum `overflow-x: hidden` global foi usado. Os círculos decorativos que ultrapassam a borda
ficam contidos pelo `overflow-hidden` da própria seção — por isso não geram barra.

### 2.1 Correção de overflow do login, antes e depois

| viewport | antes (auditoria anterior)             | depois (medido agora) |
| -------- | -------------------------------------- | --------------------- |
| 375px    | `scrollWidth` 399 × 360 — **overflow** | 375 × 375 — ok        |
| 768px    | `scrollWidth` 765 × 753 — **overflow** | 768 × 768 — ok        |

---

## 3. Fluxos no Playwright MCP

| #   | Fluxo                       | Resultado | Evidência                                                              |
| --- | --------------------------- | --------- | ---------------------------------------------------------------------- |
| 1   | Abrir a página inicial      | **PASS**  | título "PGR-e — Saúde e segurança do trabalho em uma só plataforma"    |
| 2   | Abrir Segurança do Trabalho | **PASS**  | h1 "Do levantamento do risco ao PGR assinado"                          |
| 3   | Voltar para a landing       | **PASS**  | navegação pelo logo e pelo breadcrumb                                  |
| 4   | Abrir Medicina do Trabalho  | **PASS**  | h1 "A saúde ocupacional sobre os mesmos cadastros"                     |
| 5   | Navegação do header         | **PASS**  | `aria-current="page"` aplicado ao item da rota ativa                   |
| 6   | Todos os CTAs               | **PASS**  | 8 destinos distintos, todos HTTP 200 (ver §4)                          |
| 7   | FAQ                         | **PASS**  | 6 perguntas, abre por clique, comportamento **exclusivo** confirmado   |
| 8   | Rolagem e âncoras           | **PASS**  | 7 âncoras existem; `#perguntas-frequentes` para a seção a 80px do topo |
| 9   | Menu mobile                 | **PASS**  | ver §3.1                                                               |
| 10  | Navegação por teclado       | **PASS**  | ver §3.2                                                               |
| 11  | Abrir o login               | **PASS**  | Clerk renderiza; marca correta                                         |
| 12  | Estado não autenticado      | **PASS**  | landing e vertentes abrem sem sessão                                   |
| 13  | Redirects de rota protegida | **PASS**  | `/dashboard`, `/pgr`, `/companies` → **307** para o Clerk              |
| 14  | Orçamento                   | **PASS**  | ver §3.3                                                               |
| 15  | Estados de erro             | **PASS**  | ver §3.3                                                               |
| 16  | Links quebrados             | **PASS**  | nenhum — ver §4                                                        |

### 3.1 Menu mobile (375 × 812)

| Verificação                              | Resultado                                          |
| ---------------------------------------- | -------------------------------------------------- |
| Botão visível e com alvo confortável     | 40 × 40px                                          |
| `aria-expanded` alterna                  | `false` → `true` → `false`                         |
| `aria-label` alterna                     | "Abrir menu" → "Fechar menu"                       |
| Painel montado só quando aberto          | sim (`#public-mobile-menu` ausente quando fechado) |
| Itens                                    | 6 (4 de navegação + Entrar + Solicitar orçamento)  |
| Rolagem do corpo travada enquanto aberto | `body.style.overflow = "hidden"`                   |
| `Escape` fecha                           | sim                                                |
| `Escape` devolve o foco ao botão         | sim (`document.activeElement === botão`)           |
| Rolagem destravada ao fechar             | sim                                                |
| Clicar num item navega e fecha o menu    | sim → `/medicina-do-trabalho`, painel desmontado   |
| Overflow horizontal com o menu aberto    | nenhum                                             |

### 3.2 Teclado

Ordem de tabulação a partir do topo da landing:

```
1 Ir para o conteúdo (#conteudo)   ← primeiro foco, como manda o padrão
2 PGR-e (logo, /)
3 Segurança do Trabalho
4 Medicina do Trabalho
5 Recursos
6 Como funciona
7 Entrar
8 Solicitar orçamento
9 Conhecer Segurança do Trabalho (primeiro CTA do hero)
```

O link de pular conteúdo, ao receber foco, aparece em `(12, 12)` com **160 × 44px**.

> **Defeito encontrado e corrigido durante o QA.** Na primeira medição esse link reaparecia com
> **160 × 20px**: o utilitário `not-sr-only` do Tailwind zera `padding`, anulando o `px-5 py-2.5`
> que estava fora do variante. O padding passou para dentro do `focus:`.

### 3.3 Orçamento — fim a fim

Executado contra o Postgres efêmero, com a migration `0052` aplicada ali.

| Cenário                                       | Esperado                                                      | Resultado |
| --------------------------------------------- | ------------------------------------------------------------- | --------- |
| `?interesse=medicina` pré-seleciona a área    | rádio `health` marcado                                        | **PASS**  |
| Envio vazio                                   | 4 erros de campo, sem chamada ao servidor                     | **PASS**  |
| Erros com ligação ARIA                        | `aria-invalid` + `aria-describedby` apontando alvo real       | **PASS**  |
| E-mail `ana@`                                 | "E-mail inválido."                                            | **PASS**  |
| Telefone `9999`                               | "Informe DDD e número (ex.: (11) 99999-9999)."                | **PASS**  |
| Envio válido                                  | confirmação em `role="status"`, formulário some               | **PASS**  |
| **Gravação real no banco**                    | 1 linha                                                       | **PASS**  |
| Normalização do e-mail                        | `Ana.Souza@Exemplo-QA.com.br` → `ana.souza@exemplo-qa.com.br` | **PASS**  |
| Interesse vindo da URL                        | `health`                                                      | **PASS**  |
| Reenvio com o **mesmo e-mail em outra caixa** | **nenhuma linha nova** (total segue 1)                        | **PASS**  |
| Reenvio não revela que o e-mail já existe     | mostra "Solicitação registrada"; sem "já existe"              | **PASS**  |

Linha gravada (dado sintético de QA, removido junto com o container):

```
name      | company                  | email                       | interest | source | submitted_on
Ana Souza | Consultoria SST de Teste | ana.souza@exemplo-qa.com.br | health   | quote  | 2026-10-09
```

---

## 4. Links

Coletados do HTML servido das 4 páginas do portal: **22 links distintos, todos internos**. Nenhum
`href="#"`, nenhum link externo, nenhum destino inventado.

| Destino                          | HTTP |
| -------------------------------- | ---- |
| `/`                              | 200  |
| `/seguranca-do-trabalho`         | 200  |
| `/medicina-do-trabalho`          | 200  |
| `/orcamento`                     | 200  |
| `/orcamento?interesse=seguranca` | 200  |
| `/orcamento?interesse=medicina`  | 200  |
| `/sign-in`                       | 200  |
| `/sign-up`                       | 200  |

Âncoras verificadas no HTML: `#conteudo`, `#vertentes`, `#recursos`, `#como-funciona`,
`#perguntas-frequentes` (landing) e `#modulos` (nas duas vertentes) — **todas existem**.

---

## 5. Console e rede

Nas 25 combinações da matriz, com rolagem completa de cada página:

| Métrica              | Resultado                                    |
| -------------------- | -------------------------------------------- |
| **Erros de console** | **0**                                        |
| Respostas HTTP ≥ 400 | **0**                                        |
| Imagens quebradas    | nenhuma (o portal não usa arquivo de imagem) |
| Requisições "falhas" | 128, **todas** `?_rsc=…` — ver abaixo        |

As 128 são **prefetch do App Router cancelado** (`net::ERR_ABORTED`) quando o script navega antes
do prefetch concluir. É comportamento normal do Next, não requisição com erro: nenhuma delas
retornou status de erro, e o contador de respostas ≥ 400 é zero.

Avisos de console observados (2, ambos de ambiente):

1. `Clerk has been loaded with development keys` — instância de desenvolvimento;
2. aviso de preload de fonte do `next/font` em `next start` local.

---

## 6. Acessibilidade verificada no navegador

| Item                                            | Resultado                                              |
| ----------------------------------------------- | ------------------------------------------------------ |
| Link "pular para o conteúdo" como primeiro foco | sim, visível ao focar, 160 × 44px                      |
| Um `<h1>` por página                            | sim, nas 25 combinações                                |
| Hierarquia de cabeçalhos sem salto              | sim, nas 25 combinações                                |
| Landmarks                                       | `header`, `nav[aria-label]`, `main#conteudo`, `footer` |
| `aria-current` no item ativo                    | sim                                                    |
| Menu mobile acessível                           | ver §3.1                                               |
| FAQ acessível                                   | `<details>`/`<summary>` nativos                        |
| Campos com rótulo                               | 8 de 8                                                 |
| `autocomplete` nos campos de contato            | `name`, `organization`, `email`, `tel`                 |
| Erros com `aria-invalid` + `aria-describedby`   | sim, alvos existem                                     |
| Confirmação anunciada                           | `role="status"`                                        |
| Erro de envio anunciado                         | `role="alert"`                                         |
| Imagens sem `alt`                               | 0                                                      |

### 6.1 `prefers-reduced-motion` — medição A/B

| Preferência     | CTA do hero: `transition-property`    | duração | Blocos do `Reveal`                     |
| --------------- | ------------------------------------- | ------- | -------------------------------------- |
| `no-preference` | `transform, translate, scale, rotate` | `0.2s`  | animam ao entrar                       |
| **`reduce`**    | **`none`**                            | —       | `opacity: 1`, `0s`, **nada escondido** |

Com a preferência ativa o `Reveal` nem instala o observer: o conteúdo nasce visível.

---

## 7. Capturas

Em `docs/planning/reuniao-2026-10-05/portal-publico/capturas/` — página inteira, JPEG:

| Arquivo                  | Página    | Viewport   |
| ------------------------ | --------- | ---------- |
| `landing-375x812.jpg`    | landing   | 375 × 812  |
| `landing-768x1024.jpg`   | landing   | 768 × 1024 |
| `landing-1440x900.jpg`   | landing   | 1440 × 900 |
| `seguranca-375x812.jpg`  | Segurança | 375 × 812  |
| `seguranca-1440x900.jpg` | Segurança | 1440 × 900 |
| `medicina-375x812.jpg`   | Medicina  | 375 × 812  |
| `medicina-1440x900.jpg`  | Medicina  | 1440 × 900 |
| `orcamento-375x812.jpg`  | Orçamento | 375 × 812  |
| `orcamento-1440x900.jpg` | Orçamento | 1440 × 900 |
| `login-375x812.jpg`      | Login     | 375 × 812  |
| `login-768x1024.jpg`     | Login     | 768 × 1024 |

As duas de login são a evidência direta das correções de overflow.

---

## 8. Cabeçalhos de segurança observados

Medidos com `curl -I` no build de produção (configuração preexistente, não alterada):

- `Content-Security-Policy` com `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`;
- `X-Frame-Options: DENY`;
- `/sign-in` com `no-store, no-cache, must-revalidate, private`;
- `X-Powered-By` e `Server` removidos pelo `proxy.ts`.

> Efeito colateral útil observado durante o QA: a tentativa de medir os viewports dentro de um
> `<iframe>` falhou com `contentDocument` nulo — justamente porque o `frame-ancestors 'none'` está
> em vigor. A matriz passou a ser medida com navegação real.

---

## 9. Itens BLOQUEADOS

| Item                                               | Por quê                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Envio do formulário contra o **banco real** do PGR | a migration `0052` não foi aplicada em produção (e não deveria ser aqui)   |
| `sitemap.xml` com URLs                             | `NEXT_PUBLIC_APP_URL` não definido — sai vazio por decisão                 |
| `robots.txt` liberando indexação                   | `APP_ENV=local` — fora de produção o arquivo bloqueia tudo, como projetado |
| Fluxo autenticado além do redirect                 | não faz parte deste escopo; nenhuma credencial foi usada                   |

`GET /api/v1/companies` responde **200 sem sessão** neste ambiente. **Não é regressão**: é o
bypass de desenvolvimento da REST (`APP_ENV=local` + `DEV_API_AUTH_BYPASS=true`), que o
`proxy.ts` desliga em produção. Nenhuma linha dessa lógica foi tocada.

---

## 10. Ambiente usado no QA

- Build de produção do PGR em `localhost:3001` (porta 3000 é do Site-PMPA, em container).
- Postgres **efêmero** em container (`postgres:16`, `--rm`), criado para esta execução e
  **removido no fim**. Nenhum container existente foi apagado; o `qa-pg16` foi apenas iniciado
  para inspeção e **devolvido ao estado parado**.
- Nenhuma imagem removida, nenhum volume apagado, nenhum `prune`, nenhuma alteração de
  `.wslconfig`, nenhum `wsl --shutdown`.
