# Portal público — QA

Execução em **13/10/2026**, contra o **build de produção** (`npm run build` + `next start -p 3001`).
Banco: **Postgres efêmero em container**, criado para a execução e removido no fim. O banco
remoto do PGR **não foi tocado** — a migration `0052` segue não aplicada lá (verificado por
leitura de catálogo: `to_regclass('public.platform_leads')` → `null`).

Ferramentas: **Chrome DevTools MCP** (inspeção de CSS, cascata, cabeçalhos, redirect de rota
protegida), **Playwright MCP** (interações) e scripts Playwright do projeto (matriz de
viewports, comparação geométrica e capturas determinísticas).

---

## 1. Comparação com a referência aprovada

Método: a mesma página é aberta na referência (prancha extraída) e na implementação, no mesmo
viewport, com fontes carregadas (`document.fonts.ready`), rolagem completa para disparar as
animações, retorno ao topo e animações zeradas. Compara-se a geometria e a tipografia das
âncoras — header, `h1`, primeiro parágrafo, botões, rodapé — e a posição e o tamanho de cada
`h2`.

### 1.1 Resultado em 1440 × 900

| Página    | Altura ref | Altura impl | Δ       | Âncoras                | `h2`                         |
| --------- | ---------- | ----------- | ------- | ---------------------- | ---------------------------- |
| Home      | 5932       | 5920        | **−12** | só o rodapé (ver §1.4) | 6/6 texto, posição e tamanho |
| Segurança | 3744       | 3732        | **−12** | só o rodapé            | 4/4                          |
| Medicina  | 3592       | 3580        | **−12** | só o rodapé            | 4/4                          |
| Orçamento | 1153       | 1158        | **+5**  | **idênticas**          | 1/1                          |

### 1.2 Resultado em 768 × 1024

| Página    | Δ altura | Diferença restante |
| --------- | -------- | ------------------ |
| Home      | −122     | só o rodapé (−121) |
| Segurança | −122     | só o rodapé        |
| Medicina  | −121     | só o rodapé        |
| Orçamento | +6       | **nenhuma**        |

### 1.3 Resultado em 375 × 812

| Página    | Δ altura | Diferença restante    |
| --------- | -------- | --------------------- |
| Home      | −179     | só o rodapé (−179)    |
| Segurança | −179     | só o rodapé           |
| Medicina  | −179     | só o rodapé           |
| Orçamento | +19      | rodapé compacto (−30) |

**Em nenhuma das 12 combinações há divergência de `h1`, `h2`, parágrafo, botão, header,
tipografia ou cor.** Tamanho de fonte, peso, entrelinha, espaçamento entre letras e cor batem
exatamente.

### 1.4 A única diferença recorrente, explicada

O rodapé é 12px (desktop), 121px (tablet) e 179px (mobile) mais curto. Causa única: a coluna
"Institucional" do design, que traz um link para uma página de privacidade inexistente e dois
marcadores literais `[A DEFINIR]`. Divergência intencional — ver `PORTAL-REVIEW.md`.

### 1.5 Correções que vieram da comparação

A primeira medição acusou desvio acumulado (12px na primeira seção, chegando a 59px no fim da
Home) e cores erradas. Três causas, todas corrigidas:

| Defeito medido                                  | Causa                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| Texto `rgb(27,31,46)` em vez de `rgb(22,23,29)` | a regra `.pg` que carrega cor e fonte tinha sido descartada na deduplicação |
| `line-height: 24px` em vez de `normal`          | o preflight do Tailwind impõe 1.5 no `body`; o design parte de `normal`     |
| Desvio crescente seção a seção                  | consequência do item acima — cada bloco de texto ficava alguns px maior     |
| Menu hambúrguer visível em 1440px               | a prancha de Login redefine `.btn` e a regra vazava para as outras páginas  |

A última levou ao escopo em três níveis (`.pg`, `.pg.auth`, `.pg .pg-medicina`).

---

## 2. Testes técnicos

| Comando                             | Resultado                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| `npm run check`                     | **PASS** (exit 0)                                            |
| ↳ lint                              | **0 erros**, 4 avisos — os mesmos preexistentes da `develop` |
| ↳ typecheck                         | **0 erros**                                                  |
| ↳ unit                              | **144 suítes / 1381 testes PASS**                            |
| `npm run build`                     | **PASS**                                                     |
| Integração `platform/leads.test.ts` | **9 / 9 PASS** contra Postgres real                          |

A suíte caiu de 145/1393 para 144/1381 porque o teste de conteúdo da v1
(`public-portal-content.test.ts`) foi removido junto com o módulo que ele testava
(`_content/platform.ts`). Os 22 casos de lead (unit + integração) continuam.

### 2.1 Rotas no build

```
┌ ○ /                        (estática)
├ ○ /seguranca-do-trabalho   (estática)
├ ○ /medicina-do-trabalho    (estática)
├ ƒ /orcamento               (dinâmica — lê ?interesse=)
├ ƒ /sign-in/[[...sign-in]]  (dinâmica — Clerk)
```

---

## 3. Matriz de responsividade

25 combinações: 5 páginas × 320/375/768/1440/1920.

| Métrica                       | Resultado             |
| ----------------------------- | --------------------- |
| **Barra horizontal indevida** | **0 de 25**           |
| `<h1>` por página             | exatamente 1 em todas |
| Salto de nível de cabeçalho   | nenhum                |
| Imagens sem `alt`             | 0                     |
| Erros de console              | **0**                 |
| Respostas HTTP ≥ 400          | **0**                 |

Nenhum `overflow-x: hidden` improvisado: o `.pg` usa `overflow-x: clip`, que é a regra do
próprio design.

> Na primeira passagem, `/sign-in` acusou **2 `<h1>`** — o do painel de marca e o que o Clerk
> renderiza. Corrigido: o título do painel virou `<p>` com estilo idêntico.

As 72 requisições "falhas" registradas são todas `?_rsc=…` com `net::ERR_ABORTED`: prefetch do
App Router cancelado quando o script navega antes de concluir. Nenhuma devolveu erro — o
contador de respostas ≥400 é zero.

---

## 4. Interações (Playwright MCP)

| Fluxo                             | Resultado | Evidência                                                        |
| --------------------------------- | --------- | ---------------------------------------------------------------- |
| Fluxo do PGR — estado inicial     | **PASS**  | 5 abas, etapa 01, "anterior" desabilitado, `tabIndex` roving     |
| Fluxo do PGR — botão próxima      | **PASS**  | etapa 02, título, itens e módulos trocam; 2 barras preenchidas   |
| Fluxo do PGR — seta do teclado    | **PASS**  | `ArrowDown` → etapa 03 e foco em `fluxo-tab-2`                   |
| Menu mobile — abrir               | **PASS**  | `aria-expanded=true`, 6 itens, rolagem travada, sem overflow     |
| Menu mobile — `Escape`            | **PASS**  | fecha, destrava a rolagem e devolve o foco ao botão              |
| FAQ                               | **PASS**  | 7 perguntas, primeira aberta — igual ao protótipo                |
| Orçamento — `?interesse=medicina` | **PASS**  | rádio "Medicina do Trabalho" pré-selecionado                     |
| Orçamento — envio vazio           | **PASS**  | "5 campos precisam de atenção" + 5 erros com `aria-invalid`      |
| Orçamento — envio válido          | **PASS**  | confirmação em `role="status"`, formulário some                  |
| Orçamento — **gravação real**     | **PASS**  | 1 linha no banco, `interest=health`, e-mail normalizado          |
| Rotas protegidas sem sessão       | **PASS**  | `/dashboard` → 307 para o Clerk                                  |
| Links                             | **PASS**  | todos internos; 7 rotas e 8 âncoras conferidas, nenhuma quebrada |

Linha gravada (dado sintético, removida junto com o container):

```
Mariana Souza | Consultoria SST QA | mariana.qa@exemplo-design.com.br | health | quote
```

---

## 5. Regressão no sistema autenticado

A verificação **visual** das telas internas ficou **BLOQUEADA**: o navegador disponível não tem
sessão Google ativa, e não foram usadas credenciais. Em lugar dela, duas verificações objetivas
e mais fortes que uma captura:

| Verificação                                       | Resultado                         |
| ------------------------------------------------- | --------------------------------- |
| `globals.css` vs `origin/develop`                 | **byte a byte idêntico**          |
| Seletores do bundle do portal escopados sob `.pg` | **149 de 149 — zero globais**     |
| `clerkAppearance` usado fora de sign-in/sign-up   | **não** — só nessas duas telas    |
| Arquivos de `(protected)/` no diff                | **zero**                          |
| Colisão de `@keyframes` com o `globals.css`       | nenhuma (`rise`/`spin` são novos) |

Sem token global alterado e sem seletor fora de `.pg`, não existe caminho pelo qual o portal
altere a aparência de uma tela autenticada.

Mudanças que **alcançam** a área autenticada, e são só textuais:
`layout.tsx` troca `ptBR` por `clerkLocalization` (onde aparecia `sst-manager`, agora aparece
`PGR-e`) e define `title.template`, que as telas internas não usam.

---

## 6. Acessibilidade

| Item                                                      | Resultado                        |
| --------------------------------------------------------- | -------------------------------- |
| Link "pular para o conteúdo" como primeiro foco           | ok                               |
| Um `<h1>` por página, sem salto de nível (25 medições)    | ok                               |
| Landmarks `header`/`nav[aria-label]`/`main`/`footer`      | ok                               |
| `aria-current="page"` no item ativo                       | ok                               |
| Menu mobile: `aria-expanded`, `Escape`, devolução de foco | ok                               |
| Fluxo do PGR: `tablist`, setas, `Home`/`End`, roving      | ok                               |
| FAQ: `aria-expanded` + `role="region"`                    | ok                               |
| Campos com rótulo e `autocomplete`                        | 8 de 8                           |
| Erros com `aria-invalid` + `aria-describedby`             | ok                               |
| `role="status"` na confirmação, `role="alert"` nos erros  | ok                               |
| Foco visível (anel indigo 3px, offset 3px, do design)     | ok                               |
| Imagens sem `alt`                                         | 0                                |
| `prefers-reduced-motion`                                  | bloco próprio na folha do portal |

**Não executados:** auditoria automatizada de contraste e teste com leitor de tela real. A
conformidade com WCAG 2.2 AA foi buscada por construção e verificada nos itens acima; não é
afirmada como certificada.

---

## 7. Capturas

Em `docs/planning/reuniao-2026-10-05/portal-publico/capturas/` — página inteira, JPEG, do build
de produção:

`landing-375x812` · `landing-768x1024` · `landing-1440x900` · `seguranca-375x812` ·
`seguranca-1440x900` · `medicina-375x812` · `medicina-1440x900` · `orcamento-375x812` ·
`orcamento-1440x900` · `login-375x812` · `login-768x1024`

As capturas da referência ficaram fora do repositório (são reprodutíveis a partir do HTML
aprovado com os scripts descritos no `PORTAL-WALKTHROUGH.md §1.1`).

---

## 8. Itens BLOQUEADOS

| Item                                          | Por quê                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Envio do formulário contra o banco **real**   | a migration `0052` não foi aplicada em produção — e não deve ser aqui     |
| Verificação **visual** das telas autenticadas | sem sessão no navegador; substituída pelas provas objetivas do §5         |
| `sitemap.xml` com URLs                        | `NEXT_PUBLIC_APP_URL` não definido — sai vazio por decisão                |
| `robots.txt` liberando indexação              | `APP_ENV=local`; fora de produção bloqueia tudo, como projetado           |
| Página de Política de Privacidade             | não existe conteúdo jurídico aprovado                                     |
| Renomear a aplicação no painel do Clerk       | configuração externa; a página hospedada do Clerk ainda diz "sst-manager" |

---

## 9. Ambiente

Porta 3001 (a 3000 é do Site-PMPA). Postgres **efêmero** (`postgres:16`, `--rm`) criado para a
execução e **removido no fim**; nenhum container existente foi apagado. Nenhuma imagem removida,
nenhum volume apagado, nenhum `prune`, nenhuma alteração de `.wslconfig`, nenhum `wsl --shutdown`.
O Docker Desktop estava parado e foi iniciado para rodar o Postgres de teste.
