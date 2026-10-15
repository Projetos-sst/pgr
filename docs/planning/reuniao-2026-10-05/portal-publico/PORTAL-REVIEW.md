# Portal público — review

Revisão do próprio diff antes de atualizar a PR #97: segurança, acessibilidade, regressões e os
pontos em que um revisor deve olhar com atenção.

---

## 1. O que mudou nesta entrega

A PR #97 passou a conter **o design aprovado pelo Claude Design** (Douglas + Expedito), no lugar
da primeira versão do portal. O commit `4de6eb5` segue no histórico e a tag
`portal-v1-pre-claude-design` aponta para ele.

| Categoria                                     | Arquivos |
| --------------------------------------------- | -------- |
| Portal novo (`_portal/` + 4 páginas + layout) | 11       |
| **Removidos** — componentes e conteúdo da v1  | 13       |
| Login (moldura + aparência + localização)     | 3        |
| Backend de leads (preservado, 1 ajuste)       | 4        |
| Schema e migration (preservados)              | 3        |
| SEO (preservado)                              | 3        |
| `proxy.ts` (preservado)                       | 1        |
| Testes                                        | 2        |
| Documentação + capturas                       | 17       |

**`globals.css` voltou a ser idêntico à `develop`.** Os tokens teal que a v1 havia adicionado
foram revertidos: o design traz as próprias cores literais e não precisa deles.

---

## 2. Segurança

### 2.1 Preservado integralmente

| Item                               | Verificação                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Clerk como autenticador            | nenhuma linha de autenticação alterada; a demo do protótipo não entrou |
| `proxy.ts`                         | inalterado nesta etapa (as 3 rotas públicas já haviam sido declaradas) |
| `auth.protect()`                   | `/dashboard` → **307** para o Clerk, verificado                        |
| Isolamento multi-tenant / RLS      | nenhuma tabela de tenant tocada                                        |
| Papéis e permissões                | nenhuma mudança                                                        |
| Rotas públicas por token           | fora de `(marketing)` — não herdam o shell comercial                   |
| CSP, `X-Frame-Options`, `no-store` | intactos                                                               |

### 2.2 A superfície pública continua estreita

A única porta para o mundo segue sendo `submitPlatformLead`, com a mesma regra:
**a aplicação escreve um lead e não consegue ler nenhum.**

```sql
GRANT INSERT ON public.platform_leads TO app_runtime;   -- e nada mais
```

Reprovado em Postgres real nesta execução (9/9): `SELECT`, `UPDATE`, `DELETE` e
`INSERT … RETURNING` devolvem _permission denied_; a deduplicação por
`(lower(email), submitted_on)` funciona inclusive com caixa diferente.

### 2.3 Uma mudança de comportamento no erro — leia

Com o banco indisponível, a ação deixava o erro subir e o visitante via uma página 500. Agora
falhas de **conectividade** (`ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`…) viram
`UNAVAILABLE` com mensagem amigável, e o erro é registrado com `console.error`.

Por que isso é seguro: só falhas de conexão são capturadas — erro de dados, violação de
constraint não mapeada ou bug de código **continuam subindo**. A regra do projeto (não silenciar
o inesperado) permanece.

### 2.4 Dados pessoais

Coletados: nome, empresa, e-mail, telefone, área de interesse, mensagem opcional e o aceite.
Não coletados: CPF, data de nascimento, endereço, qualquer dado de saúde — e a própria página
afirma isso ("Não solicitamos informações de saúde neste formulário"), o que é verdade.
O **IP não é persistido**: existe só hasheado, em memória, com expiração.

### 2.5 Conteúdo público

Nenhum nome de empresa real, nenhum dado de cliente, nenhum print do sistema com dado real,
nenhum token. As ilustrações do hero são composições do design, rotuladas "Ilustração
conceitual" pelo próprio design.

---

## 3. Honestidade do conteúdo

O conteúdo aprovado foi conferido contra o sistema real antes do porte:

| Afirmação do design                                    | Estado real                                          | Ação                           |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------ |
| Segurança: PGR, riscos, controles, EPI, inspeções      | existem                                              | mantida                        |
| Medicina: ASO e exames; profissionais de saúde         | `health_exams`, `medicos` existem                    | mantida                        |
| PCMSO, CAT, clínicas, exames, absenteísmo "planejados" | não implementados                                    | mantida                        |
| "Não garante conformidade com as NRs" (FAQ)            | correto e prudente                                   | mantida                        |
| CAT como "planejado"                                   | há campos internos em incidentes, sem evento eSocial | mantida — subdeclarar é seguro |

Nenhum texto precisou de correção factual. O design é honesto.

---

## 4. Acessibilidade

Verificado no navegador — ver `PORTAL-QA.md §6`. Destaques do que foi **acrescentado** ao
protótipo sem alterar o visual:

- link "pular para o conteúdo";
- bloco `prefers-reduced-motion` (o design especifica a regra; o export não a traz);
- navegação por teclado completa no `tablist` do fluxo do PGR (setas, `Home`/`End`, roving);
- `Escape` e devolução de foco no menu mobile;
- título do painel de login rebaixado a `<p>` para a página ter um único `h1`.

**Não executados:** auditoria automatizada de contraste e teste com leitor de tela real.

---

## 5. Regressões

| Risco                                      | Verificação                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Tokens do portal vazarem para o sistema    | **149 de 149 seletores escopados sob `.pg`**; `globals.css` idêntico à `develop` |
| Rotas por token herdarem o shell comercial | não — grupo aninhado                                                             |
| Colisão de `@keyframes`                    | nenhuma (`rise`/`spin` não existem no `globals.css`)                             |
| Suíte unitária                             | 1381 PASS                                                                        |
| Lint                                       | 0 erros; os mesmos 4 avisos preexistentes                                        |
| Build                                      | PASS; 3 páginas estáticas                                                        |
| Dependências novas                         | **nenhuma** — `package.json` inalterado                                          |
| Arquivos de `(protected)/`                 | zero no diff                                                                     |
| PDF/DOCX do Douglas                        | zero no diff; `feature/pgr-docx-templates` sem arquivo em comum                  |

### 5.1 Mudanças com alcance além do portal

1. **`layout.tsx`** usa `clerkLocalization` no lugar de `ptBR`. Alcança todas as telas do Clerk,
   inclusive internas. Efeito só textual: `sst-manager` → `PGR-e`.
2. **`layout.tsx`** define `title: { default, template: "%s" }`. Telas internas não exportam
   metadata própria, então seguem com `PGR-e`.
3. **`clerk-appearance.ts`** foi reescrito para os tokens do design — mas é importado **somente**
   por `/sign-in` e `/sign-up`.

---

## 6. Qualidade do código

| Verificação       | Resultado                                                      |
| ----------------- | -------------------------------------------------------------- |
| `any`             | nenhum                                                         |
| `console.log`     | nenhum (há um `console.error` deliberado, §2.3)                |
| Código morto      | os 13 arquivos da v1 foram **removidos**, não deixados órfãos  |
| Client Components | 4, cada um por estado real                                     |
| Dependência nova  | nenhuma                                                        |
| Folha do portal   | 36KB, ~150 regras, escopo em 3 níveis documentado no cabeçalho |
| Migration         | preservada; **não aplicada em banco nenhum**                   |

### 6.1 Sobre os estilos inline

As páginas carregam muito `style={{…}}`. É deliberado: são os valores do design, portados sem
reinterpretação. Simplificá-los em classes utilitárias significaria reescrever o design à mão —
exatamente o que a missão proíbe. O que é estrutural e se repete (`.btn`, `.nav-link`, `.field`,
`.lift`, `.step-tab`) está na folha; o que é posicionamento de uma peça específica ficou inline,
como no original.

---

## 7. Pontos de atenção para quem revisar

1. **O escopo em três níveis** (`.pg`, `.pg.auth`, `.pg .pg-medicina`) é o que impede as
   pranchas de se atropelarem — a prancha de Login redefine `.btn` com padding menor, e isso
   vazava para as outras páginas antes do escopo.
2. **Seletor repetido entre pranchas fica com a primeira definição.** São variações acidentais
   do export, não intenção de design — exceto as teal da Medicina, que foram escopadas.
3. **Neutralização do cartão do Clerk** usa `!important` em quatro regras. É o mínimo para
   vencer o CSS-in-JS do Clerk, e só sobre superfície (fundo, sombra, borda, padding).
4. **A migration `0052` não foi aplicada em lugar nenhum.** O formulário só grava depois disso.
5. **O lead não notifica ninguém ainda** — decisão de produto em aberto.
6. **As capturas somam ~1,8 MB** no repositório. Entraram para a PR ser revisável sem subir o
   ambiente; se o time preferir, saem em um commit.

---

## 8. Divergências intencionais — resumo

| #   | Divergência                                         | Razão                                                 |
| --- | --------------------------------------------------- | ----------------------------------------------------- |
| 1   | Coluna "Institucional" do rodapé fora               | link para página inexistente + `[A DEFINIR]` literais |
| 2   | Rótulo do consentimento reescrito                   | não há Política de Privacidade para referenciar       |
| 3   | Título do painel de login vira `<p>`                | o Clerk já renderiza um `h1`                          |
| 4   | Autenticação demonstrativa do protótipo não copiada | o login é o Clerk real                                |
| 5   | Envio simulado do protótipo não copiado             | o formulário grava de verdade                         |
| 6   | Ano do copyright calculado                          | o design fixa 2026                                    |

As divergências 1 e 2 explicam toda a diferença de altura medida entre referência e
implementação. Nenhuma outra existe.
