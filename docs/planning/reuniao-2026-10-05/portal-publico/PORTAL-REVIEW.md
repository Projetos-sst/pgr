# Portal público — review

Revisão do próprio diff antes da PR: segurança, acessibilidade, regressões e os pontos em que um
revisor deveria olhar com atenção.

---

## 1. Superfície da mudança

| Categoria                                                 | Arquivos                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Portal (layout, 4 páginas, 9 componentes, conteúdo)       | 15                                                          |
| Fluxo de leads (schema, migration, domínio, repo, action) | 5                                                           |
| Correções de login e marca                                | 3 (`auth-frame.tsx`, `clerk-localization.ts`, `layout.tsx`) |
| SEO                                                       | 3 (`robots.ts`, `sitemap.ts`, `site-url.ts`)                |
| Rotas públicas                                            | 1 (`proxy.ts`)                                              |
| Tokens                                                    | 1 (`globals.css`)                                           |
| Testes                                                    | 3                                                           |
| Documentação                                              | 5 + 11 capturas                                             |

**Arquivos de `(protected)/` alterados: zero.** **Arquivos de PDF/template alterados: zero.**

---

## 2. Segurança

### 2.1 O que foi preservado

| Item                               | Verificação                                                        |
| ---------------------------------- | ------------------------------------------------------------------ |
| Clerk como autenticador            | nenhuma linha de autenticação alterada                             |
| `proxy.ts`                         | só a lista de rotas públicas ganhou 3 caminhos de apresentação     |
| `auth.protect()`                   | intacto — `/dashboard`, `/pgr`, `/companies` devolvem **307**      |
| Isolamento multi-tenant / RLS      | nenhuma tabela de tenant tocada; nenhuma policy existente alterada |
| Papéis e permissões                | nenhuma mudança                                                    |
| Rotas públicas por token           | fora do grupo `(marketing)` — não herdam nada do shell comercial   |
| Basic auth de sandbox              | intacto                                                            |
| CSP, `X-Frame-Options`, `no-store` | intactos (confirmados por `curl -I`)                               |

### 2.2 A superfície nova, e por que ela é estreita

A única porta nova para o mundo é `submitPlatformLead`. O desenho inteiro gira em torno de uma
frase: **a aplicação pode escrever um lead e não pode ler nenhum.**

```sql
GRANT INSERT ON public.platform_leads TO app_runtime;   -- e nada mais
```

Provado em Postgres real (`src/__tests__/integration/platform/leads.test.ts`, 9/9):

| Operação como `app_runtime`           | Resultado                          |
| ------------------------------------- | ---------------------------------- |
| `INSERT`                              | funciona                           |
| `SELECT *`                            | **permission denied**              |
| `SELECT count(*)`                     | **permission denied**              |
| `UPDATE`                              | **permission denied**              |
| `DELETE`                              | **permission denied**              |
| `INSERT … RETURNING id`               | **permission denied**              |
| 2º `INSERT` com o mesmo e-mail no dia | `23505` (índice único)             |
| mesmo e-mail em outra caixa           | `23505` (índice em `lower(email)`) |

Mais: RLS habilitado com **uma única policy**, de `INSERT` (`polcmd = 'a'`); nenhuma policy de
`SELECT` existe; a tabela **não tem `org_id`** (é global por natureza — o visitante não tem
tenant).

> **Achado do próprio teste.** A primeira versão usava o helper `appRuntimeClient()`, que — apesar
> do nome — conecta com `INTEGRATION_DATABASE_URL`, a URL de administração. A asserção de "não
> consegue ler" teria passado por engano, com o superusuário. O teste agora abre a conexão
> explicitamente com `INTEGRATION_APP_RUNTIME_URL`, e o comentário no arquivo explica por quê.

### 2.3 Dados pessoais

- coletados: nome, empresa, e-mail, telefone, área de interesse, mensagem opcional;
- **não** coletados: CPF, data de nascimento, endereço, qualquer dado de saúde;
- o **IP não é persistido** — só existe hasheado, em memória, com expiração;
- nenhum lead é legível pela aplicação;
- a página de orçamento é `noindex`.

### 2.4 Conteúdo público

Nenhum nome de empresa real, nenhum dado de cliente, nenhum print do sistema com dado real,
nenhum token, nenhuma informação administrativa. O conteúdo descreve capacidades, não clientes.

### 2.5 Desvio consciente da regra das 4 superfícies

O `CLAUDE.md` exige Server Action + REST + `api-design.md` + Postman para todo CRUD. Entregamos
**só a Server Action**: não é um CRUD (não há list/update/delete nem tela administrativa), e um
espelho REST criaria um endpoint público de escrita (spam) e, com `GET`, contradiria a exigência
de não permitir consulta pública de leads. Quando existir a tela administrativa, ela será um CRUD
de verdade e as quatro superfícies se aplicam. Registrado em `PORTAL-AUDIT.md §5.2`.

---

## 3. Acessibilidade

Verificado no navegador, não por inspeção de código:

| Item                                                                                       | Resultado |
| ------------------------------------------------------------------------------------------ | --------- |
| Link de pular conteúdo como primeiro foco, 160 × 44px                                      | ok        |
| Um `<h1>` por página, sem salto de nível (25 medições)                                     | ok        |
| Landmarks `header`/`nav[aria-label]`/`main`/`footer`                                       | ok        |
| `aria-current="page"` no item ativo                                                        | ok        |
| Menu mobile: `aria-expanded`, `aria-controls`, Escape, devolução de foco, trava de rolagem | ok        |
| Painel mobile montado só quando aberto                                                     | ok        |
| FAQ em `<details>` nativo                                                                  | ok        |
| 8 de 8 campos com rótulo; `autocomplete` nos de contato                                    | ok        |
| Erros com `aria-invalid` + `aria-describedby`                                              | ok        |
| `role="status"` na confirmação, `role="alert"` no erro                                     | ok        |
| 0 imagens sem `alt`                                                                        | ok        |
| `prefers-reduced-motion` respeitado (medição A/B)                                          | ok        |

Contraste: os pares usados são o indigo `#5b63f5` sobre branco (botão, texto branco) e os
`-strong` (`#4f46e5`, `#0b7a74`, `#c9820a`) para texto colorido sobre fundo claro — foi por isso
que o teal ganhou a variante `-strong`, em vez de usar `#14a098` em texto.

### 3.1 O que **não** foi verificado

Nenhuma auditoria automatizada de contraste pixel a pixel e nenhum teste com leitor de tela real.
A conformidade com WCAG 2.2 AA foi buscada por construção e verificada nos itens acima; não é
afirmada como certificada.

---

## 4. Regressões

| Risco                                      | Verificação                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| Rotas por token herdarem o shell comercial | **não** — grupo aninhado; `/sign/[token]` e irmãs fora de `(marketing)` |
| Rota antiga `/` quebrada                   | **não** — a nova serve `/`; a antiga foi removida no mesmo commit       |
| Suíte unitária                             | 1393 testes PASS (eram 1367; +26 novos)                                 |
| Lint                                       | 0 erros; os mesmos 4 avisos preexistentes                               |
| Build                                      | PASS; as 3 páginas saem estáticas                                       |
| Dependências novas                         | **nenhuma** — `package.json` inalterado                                 |
| Mudança de identidade visual               | **não** — único token novo é o par teal                                 |
| Dashboard autenticado                      | nenhum arquivo de `(protected)/` tocado                                 |

### 4.1 Mudança com alcance além do portal — leia com atenção

Duas alterações saem do recorte do portal e merecem o olhar do revisor:

1. **`layout.tsx` troca `localization={ptBR}` por `clerkLocalization`.** Afeta **todas** as telas
   do Clerk, inclusive dentro da área autenticada. O efeito é só textual: onde aparecia
   `sst-manager`, passa a aparecer `PGR-e`. Verificado em `/sign-in`.
2. **`layout.tsx` ganha `title: { default, template: "%s" }`.** As telas autenticadas não exportam
   `metadata` própria, então continuam com o título `PGR-e`; só as páginas que definem título
   passam a usá-lo sem sufixo.

---

## 5. Qualidade do código

| Verificação                   | Resultado                                                                |
| ----------------------------- | ------------------------------------------------------------------------ |
| `any`                         | nenhum introduzido                                                       |
| `console.log`                 | nenhum                                                                   |
| Código morto                  | nenhum; a `(public)/page.tsx` antiga foi **removida**, não deixada órfã  |
| Client Components             | 3, cada um justificado (menu, observer, formulário)                      |
| Duplicação de conteúdo        | zero — tudo vem de `_content/platform.ts`                                |
| Reimplementação de componente | nenhuma — `.app-nav`, `.glass-*`, `.btn-primary`, `.hover-lift` reusados |
| Arquivo gigante               | maior página tem ~250 linhas, composta de componentes                    |
| Migration                     | gerada por `drizzle-kit`, não escrita à mão; `GRANT` como SQL custom     |

---

## 6. Pontos de atenção para quem revisar

1. **`platform_leads` é a segunda tabela global do projeto.** A primeira (`caepi_certificates`) é
   SELECT-only; esta é INSERT-only. Vale conferir se a justificativa convence: o visitante não
   tem tenant, então não há `org_id` para isolar.
2. **A janela por IP é best-effort.** Em memória, por instância. A barreira real é o índice
   único. Se o deploy tiver várias instâncias, o limite por janela se dilui — está documentado.
3. **O lead não notifica ninguém ainda.** É decisão de produto em aberto, não esquecimento.
4. **A migration `0052` não foi aplicada em lugar nenhum.** O formulário só grava depois disso.
5. **`clerk-localization.ts` é um contorno temporário.** Quando o painel do Clerk for renomeado,
   o arquivo pode ser apagado.
6. **As capturas somam ~1,4 MB no repositório.** Entraram para a PR ser revisável sem subir o
   ambiente; se o time preferir, saem em um commit.

---

## 7. Melhorias que ficaram de fora, de propósito

| Ideia                                         | Por que não agora                                                   |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Tela administrativa de leads                  | precisa da decisão de destino; e aí vira CRUD completo              |
| Notificação por e-mail do lead                | o projeto não tem capacidade de e-mail; exige dependência nova      |
| Capturas reais do sistema na landing          | mostrariam dado de cliente; precisaria de um tenant de demonstração |
| Depoimentos e logos de clientes               | não temos; inventar é fraude                                        |
| Blog / páginas de conteúdo                    | fora do escopo                                                      |
| Divisão Saúde × Segurança no menu autenticado | é o Lote G do `../PLAN.md`, não deste recorte                       |
