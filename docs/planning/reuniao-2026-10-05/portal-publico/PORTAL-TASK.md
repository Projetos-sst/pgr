# Portal público — checklist

Estado real em **09/10/2026**. Só é marcado o que foi executado e verificado; o que depende de
terceiro fica como **BLOQUEADO**, nunca como feito.

---

## 1. Auditoria

- [x] Auditar o design system no código (`globals.css`, `layout.tsx`)
- [x] Auditar a landing anterior (42 linhas) e as rotas públicas existentes
- [x] Confirmar fonte, cores, raios, sombras, superfícies e animações reais
- [x] Reproduzir e medir os dois overflows do login (375px e 768px)
- [x] Localizar a origem do "sst-manager" (nome da aplicação no painel do Clerk)
- [x] Inventariar os módulos reais a partir das rotas e dos schemas
- [x] Confirmar o que **não** existe: PCMSO, absenteísmo, portal de clínicas, envio de e-mail
- [x] Auditar se já havia fluxo de orçamento/leads — não havia
- [x] Visitar o ESO em navegador real e registrar a arquitetura aproveitada
- [x] Registrar a limitação encontrada no ESO (Cloudflare; site não responsivo)

## 2. Base visual

- [x] Grupo de rotas `(public)/(marketing)/` sem afetar as rotas por token
- [x] `PublicHeader` sticky, com menu mobile
- [x] `PublicFooter` só com links reais
- [x] `Section` / `SectionHeading` / `Eyebrow` (ritmo vertical único)
- [x] Conjunto de 22 ícones no traço do menu autenticado
- [x] `BrandMark` compartilhado entre portal e login
- [x] Par de tokens teal para a vertente Medicina
- [x] Nenhuma dependência nova

## 3. Landing

- [x] Hero com promessa, 6 capacidades e 3 CTAs
- [x] Composição do hero sem dashboard fictício
- [x] Seção das duas vertentes
- [x] Benefícios (6), sem número inventado
- [x] Recursos em destaque com selo de disponibilidade
- [x] Como funciona (5 passos reais)
- [x] Faixa de CTA comercial
- [x] FAQ acessível (6 perguntas)
- [x] Rodapé
- [x] Página antiga removida (sem rota órfã)

## 4. Segurança do Trabalho

- [x] Hero próprio com breadcrumb e selo da vertente
- [x] Painel da hierarquia de controle (4 níveis reais do enum)
- [x] Fluxo narrativo de 5 etapas
- [x] 12 módulos com selo de disponibilidade
- [x] Seção do PGR + normas de referência
- [x] CTA com `?interesse=seguranca`

## 5. Medicina do Trabalho

- [x] Hero próprio, com aviso de maturidade na primeira dobra
- [x] Painel do registro do ASO
- [x] Fluxo de 4 etapas que existem hoje
- [x] Módulos disponíveis separados dos planejados
- [x] PCMSO, absenteísmo e clínicas marcados como **Planejado**
- [x] Seção de integração entre as vertentes
- [x] Acabamento visual equivalente ao da Segurança
- [x] CTA com `?interesse=medicina`

## 6. Login

- [x] Overflow em 375px corrigido e medido
- [x] Overflow em 768px corrigido e medido
- [x] "sst-manager" substituído pela marca real
- [x] Afirmação "IA com 92% de precisão" removida
- [x] Marca visível também no mobile
- [x] Rodapé do painel vira link para `/orcamento`
- [x] Clerk, regras de autenticação e permissões intactos
- [ ] **BLOQUEADO** — renomear a aplicação no painel do Clerk (configuração externa)

## 7. Orçamento

- [x] Tabela `platform_leads` (global, sem `org_id`)
- [x] Migration `0052_platform_leads` gerada por `drizzle-kit`
- [x] `GRANT INSERT` sem `SELECT` como SQL custom
- [x] RLS com policy única de `INSERT`
- [x] Índice único `(lower(email), submitted_on)`
- [x] Schema Zod sem dado sensível
- [x] Repositório sem função de leitura (de propósito)
- [x] Server Action pública com revalidação no servidor
- [x] Janela por IP hasheado, sem persistir o endereço
- [x] Duplicata não vira erro nem revela que o e-mail já existe
- [x] Formulário com erros por campo, estado de envio e confirmação
- [x] Pré-seleção da área por `?interesse=`
- [x] Página `noindex`
- [x] Fim a fim validado contra Postgres real
- [ ] **BLOQUEADO** — destino do pedido (e-mail? tela administrativa?) — decisão do interessado
- [ ] **BLOQUEADO** — aplicar a migration no banco (fora desta execução)
- [ ] Tela administrativa de leads — depende da decisão acima

## 8. Interações

- [x] Hover nos cartões (reusa `.hover-lift`)
- [x] Transições nos botões
- [x] Menu mobile animado e acessível
- [x] Estados de foco visíveis
- [x] Accordion do FAQ
- [x] Âncoras com `scroll-margin-top`
- [x] Header com realce ao rolar
- [x] Entrada discreta das seções, sem esconder conteúdo
- [x] Estados de carregamento e retorno do formulário
- [x] `prefers-reduced-motion` respeitado (medição A/B)
- [x] Nenhuma biblioteca de animação instalada

## 9. SEO

- [x] `title` por página com `template: "%s"` na raiz
- [x] `description` por página
- [x] `canonical` por página
- [x] Open Graph nas 3 páginas de apresentação
- [x] `metadataBase` a partir de `NEXT_PUBLIC_APP_URL`
- [x] `robots.ts` por ambiente
- [x] `sitemap.ts`
- [x] `/orcamento` como `noindex`
- [ ] **BLOQUEADO** — `NEXT_PUBLIC_APP_URL` não definido: sitemap sai vazio e não há canonical absoluto

## 10. Acessibilidade

- [x] Link "pular para o conteúdo" (e correção do alvo de 20px encontrada no QA)
- [x] Landmarks semânticos
- [x] Um `<h1>` por página, sem salto de nível
- [x] Foco visível em todo controle
- [x] Navegação por teclado verificada
- [x] Menu mobile acessível
- [x] FAQ acessível
- [x] Rótulos, `autocomplete`, `aria-invalid`, `aria-describedby`
- [x] `role="status"` e `role="alert"`
- [x] Zoom e `reduced motion`
- [ ] Auditoria automatizada de contraste e teste com leitor de tela real — **não executados**

## 11. Testes

- [x] Unit: schema e `parseInterestParam` do lead (13 casos)
- [x] Unit: invariantes de honestidade do conteúdo (13 casos)
- [x] Integração: contrato de segurança de `platform_leads` (9 casos, Postgres real)
- [x] `npm run check` — PASS
- [x] `npm run build` — PASS
- [x] 1393 testes unitários passando

## 12. QA no navegador

- [x] Chrome DevTools MCP: CSS, overflow, console, cabeçalhos
- [x] Playwright MCP: menu mobile, FAQ, teclado, formulário, redirects
- [x] Script Playwright: matriz de 25 combinações + capturas
- [x] 375 × 812, 768 × 1024, 1440 × 900 (obrigatórios)
- [x] 320 × 700 e 1920 × 1080 (adicionais)
- [x] Zero overflow horizontal em todas
- [x] Zero erro de console; zero resposta ≥ 400
- [x] Zero link quebrado; todas as âncoras existem
- [x] 11 capturas revisadas
- [x] 3 defeitos visuais encontrados na revisão e corrigidos

## 13. Documentação

- [x] `PORTAL-AUDIT.md`
- [x] `PORTAL-PLAN.md`
- [x] `PORTAL-TASK.md` (este)
- [x] `PORTAL-WALKTHROUGH.md`
- [x] `PORTAL-REVIEW.md`
- [x] `PORTAL-QA.md`
- [x] Capturas em `capturas/`

## 14. Git

- [x] `feature/lot-04-cnae-cbo` intacta
- [x] Nenhum arquivo de PDF/template tocado
- [x] Nenhum arquivo de GED tocado
- [x] Nenhum arquivo de `(protected)/` tocado
- [x] Sincronizado com `origin/develop`
- [x] PR aberta após implementação, review e QA
- [x] **Nenhum merge realizado**

---

## 15. Fora deste escopo (não iniciados)

- Lote 4 CNAE/CBO · GED dos Lotes 5–7 · divisão Saúde × Segurança no menu autenticado (Lote G) ·
  hub de EPI (Lote F) · contrato de dados por função (Lote A) · visão de função na UI (Lote B) ·
  modelos de inspeção do Expedito (Lote H).
