# Portal público — checklist

Estado real em **13/10/2026**, após a implementação do design aprovado por Douglas (Tech Lead)
e Expedito. Só é marcado o que foi executado e verificado; o que depende de terceiro fica como
**BLOQUEADO**, nunca como feito.

---

## 1. Referência aprovada

- [x] HTML oficial localizado em `Documentos/redesign/PGR-e — Portal público.html`
- [x] Arquivo original **preservado intacto** (só servido e lido)
- [x] Seis pranchas analisadas: Home, Segurança, Medicina, Login, Orçamento, Design system
- [x] DOM e CSS de cada prancha extraídos para arquivos de referência fora do repositório
- [x] Estados não visíveis no DOM inicial capturados: menu mobile, FAQ, fluxo do PGR
- [x] Capturas da referência em 375, 768 e 1440
- [x] Design system extraído do CSS real (cores, escala, raios, container, botões, movimento)
- [x] CSS do bundler (`sc-*`, `#dc-root`) separado do CSS autoral
- [x] `@font-face` em base64 descartadas — as fontes vêm do `next/font`

## 2. Base visual

- [x] Folha do portal escopada sob `.pg`
- [x] Escopo em três níveis: `.pg`, `.pg.auth`, `.pg .pg-medicina`
- [x] **149 de 149 seletores escopados** no bundle — zero globais
- [x] `globals.css` revertido: byte a byte idêntico à `develop`
- [x] Tipografia via `--font-sans`/`--font-mono` (Manrope + JetBrains Mono já no projeto)
- [x] Header fiel (72px, sticky, blur, nav em pílula, dois CTAs)
- [x] Footer fiel (completo e variante compacta do Orçamento)
- [x] Nenhuma dependência nova

## 3. Home

- [x] Hero: selo, h1 68px com destaque indigo, parágrafo, 2 CTAs, link de entrar
- [x] Ilustração conceitual do hero (3 cartões + trama pontilhada + rótulo)
- [x] Seção das duas vertentes
- [x] Benefícios
- [x] Bento de funcionalidades com o PGR em destaque
- [x] Como funciona (passos numerados)
- [x] CTA de fechamento
- [x] FAQ com as 7 perguntas aprovadas, primeira aberta
- [x] Ordem e composição preservadas — nenhuma seção acrescentada ou removida

## 4. Segurança do Trabalho

- [x] Breadcrumb, hero e ilustração
- [x] **Fluxo interativo do PGR** — 5 etapas, anterior/próxima, barra de progresso
- [x] Conteúdo das 5 etapas conforme o design
- [x] Cards de módulos
- [x] Seção de responsabilidade técnica
- [x] CTA final e rodapé

## 5. Medicina do Trabalho

- [x] Breadcrumb, hero, selo "Área em expansão"
- [x] Composição do ASO
- [x] Seção "Disponível hoje" — conferida contra o sistema real
- [x] Seção "Próximas etapas" com os 5 itens marcados como planejados
- [x] Conexão com Segurança
- [x] Acentos teal escopados à área, sem virar segunda marca

## 6. Login

- [x] Painel de marca em gradiente, com os 3 destaques do design
- [x] Cartão branco, "Ainda não tem acesso?", "Autenticação protegida por Clerk"
- [x] **Clerk real** — autenticação demonstrativa do protótipo não copiada
- [x] Google, e-mail, redirects, tenant e permissões preservados
- [x] Cartão duplicado do Clerk neutralizado por CSS (sem manipulação de DOM)
- [x] Overflow em 375px e 768px — reverificado, ausente
- [x] "sst-manager" não aparece no widget (diz "para continuar em PGR-e")
- [x] Um único `<h1>` por página
- [ ] **BLOQUEADO** — renomear a aplicação no painel do Clerk (a página hospedada ainda diz "sst-manager")

## 7. Solicitar orçamento

- [x] Breadcrumb, título, passos, aviso de privacidade
- [x] Formulário com os campos e estados do design
- [x] Cartões de rádio da área de interesse, com estado selecionado
- [x] Contador 0/500 em mono
- [x] Resumo de erros e erro por campo
- [x] Estado de envio e confirmação
- [x] Rodapé compacto, como na prancha
- [x] **Backend real preservado** (`platform_leads`, INSERT sem SELECT)
- [x] Validação Zod no servidor, janela por IP hasheado, deduplicação no banco
- [x] Pré-seleção por `?interesse=`
- [x] **Fim a fim validado** contra Postgres real
- [x] Falha de banco vira o estado de erro do design, não uma página 500
- [ ] **BLOQUEADO** — destino do pedido (e-mail? tela administrativa?) — decisão do interessado
- [ ] **BLOQUEADO** — aplicar a migration `0052` no banco
- [ ] **BLOQUEADO** — Política de Privacidade (link e consentimento do design dependem dela)

## 8. Interações

- [x] Menu mobile com `Escape`, devolução de foco e trava de rolagem
- [x] FAQ exclusivo, primeira pergunta aberta
- [x] Fluxo do PGR com teclado (setas, `Home`/`End`, `tabIndex` roving)
- [x] Hover, foco e transições do design
- [x] `prefers-reduced-motion` respeitado
- [x] Nenhum botão decorativo com aparência de funcional

## 9. SEO

- [x] `title`, `description`, `canonical` e Open Graph por página
- [x] `robots.ts` por ambiente · `sitemap.ts` · `/orcamento` como `noindex`
- [ ] **BLOQUEADO** — `NEXT_PUBLIC_APP_URL` não definido: sitemap vazio, sem canonical absoluto

## 10. Acessibilidade

- [x] Skip link, landmarks, um `h1` por página, sem salto de nível
- [x] Foco visível, navegação por teclado, alvos de 44px
- [x] Rótulos, `autocomplete`, `aria-invalid`, `aria-describedby`
- [x] `role="status"` e `role="alert"`
- [x] 0 imagens sem `alt`
- [ ] Auditoria automatizada de contraste e leitor de tela real — **não executados**

## 11. Comparação pixel-perfect

- [x] Comparação objetiva referência × implementação em 375, 768 e 1440
- [x] Geometria e tipografia das âncoras conferidas (header, h1, p, botões, rodapé)
- [x] Posição e tamanho de **todos os `h2`** conferidos
- [x] 4 defeitos encontrados na comparação e corrigidos
- [x] Diferença restante: só a altura do rodapé, pela divergência documentada

## 12. Testes

- [x] `npm run check` — **PASS** (0 erros de lint, 1381 testes)
- [x] `npm run build` — **PASS**
- [x] Integração de `platform_leads` — **9/9** contra Postgres real
- [x] Matriz 25 combinações — **0 com problema**
- [x] 0 erro de console · 0 resposta ≥400 · 0 link quebrado

## 13. Regressão no sistema autenticado

- [x] `globals.css` idêntico à `develop`
- [x] Seletores do portal 100% escopados
- [x] `clerkAppearance` só em sign-in/sign-up
- [x] Zero arquivos de `(protected)/` no diff
- [ ] **BLOQUEADO** — conferência **visual** das telas internas: sem sessão no navegador

## 14. Documentação

- [x] `PORTAL-WALKTHROUGH.md` reescrito para a implementação definitiva
- [x] `PORTAL-QA.md` reescrito com a comparação e os testes desta execução
- [x] `PORTAL-REVIEW.md` reescrito
- [x] `PORTAL-TASK.md` (este)
- [x] `PORTAL-AUDIT.md` e `PORTAL-PLAN.md` anotados como históricos, sem apagar rastro
- [x] 11 capturas do build de produção

## 15. Git

- [x] `feature/lot-04-cnae-cbo` intacta (`8dd86a9`)
- [x] `feature/pgr-docx-templates` do Douglas intacta — zero arquivos em comum
- [x] Nenhum arquivo de PDF/DOCX tocado
- [x] v1 preservada no histórico (`4de6eb5`) e na tag `portal-v1-pre-claude-design`
- [x] PR #97 atualizada — **nenhuma PR nova**
- [x] **Nenhum merge realizado**

---

## 16. Fora deste escopo

Lote 4 CNAE/CBO · GED · divisão Saúde × Segurança no menu autenticado · hub de EPI ·
contrato de dados por função · modelos de inspeção do Expedito.
