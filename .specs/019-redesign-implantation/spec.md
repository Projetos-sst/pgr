# Especificação de Funcionalidade: Implantação do design system do redesign visual

**Feature Branch**: `feature/redesign-implantation`

**Created**: 2026-07-13

**Status**: Draft

**Input**: Descrição do usuário: "Implantar o sistema visual dos mockups `sst-project/redesign/*.dc.html` (paleta indigo, tipografia Manrope, cards glass/blur) nas telas **já implementadas** do sst-manager, mantendo as telas ainda não implementadas separadas em backlog. Fonte da verdade: `docs/briefings/briefing-redesign-implantation.md` + `docs/briefings/redesign-backlog-telas.md`."

> **Nota de fidelidade**: esta é uma fatia de **design/UI transversal**. O "contrato" do que
> cada tela deve ser é o mockup `.dc.html` correspondente. Onde esta spec cita rotas, telas ou o
> provedor de autenticação existente, são fatos de produto já em produção — não decisões novas de
> arquitetura. O "como" técnico está travado no briefing; esta spec descreve **o que** o usuário
> deve ver e **por quê**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Identidade visual do redesign nos cadastros e no dashboard (Priority: P1)

Como usuário do escritório (owner/collaborator), quero que as telas que já uso todos os dias —
os cadastros da cadeia do PGR (empresas, unidades de obra, funções, GES, funcionários,
categorias, catálogo e estoque de EPI), o PGR e planos de ação, e o dashboard — apresentem a
identidade visual do redesign (paleta indigo, tipografia Manrope, cards com efeito glass/blur,
cantos arredondados e sombras suaves), fiéis aos mockups `.dc.html`, em vez do visual atual sem
tema (preto/branco, fonte Arial).

**Why this priority**: É o coração da entrega — a maior parte das telas em uso ganha a nova cara
de uma vez. Como todas essas telas renderizam pelas mesmas primitives de UI compartilhadas,
aplicar o tema à fundação já cascateia para dezenas de telas, entregando o maior valor visível
com o menor risco.

**Independent Test**: Abrir cada tela de cadastro e o dashboard no sistema real e compará-las
lado a lado com o `.dc.html` correspondente em 375px, 768px e 1440px, confirmando fidelidade
visual (cores, tipografia, cards, espaçamento) e responsividade sem quebra de layout.

> Nota: nesta história o `/dashboard` já adota tokens e tipografia por herança da fundação; o
> **rebuild completo** do dashboard (KPI cards + widgets com dados reais/empty-state) é entregue na
> US4. Assim US1 (P1) é entregável sem depender de US4 (P2).

**Acceptance Scenarios**:

1. **Given** um usuário do escritório autenticado, **When** ele abre a lista de empresas,
   **Then** a tela usa a paleta indigo, a tipografia Manrope e os cards com glass/blur do
   `empresas.dc.html`, e não o visual preto/branco anterior.
2. **Given** qualquer tela de CRUD da cadeia do PGR, **When** o usuário abre o formulário de
   criação ou edição, **Then** os campos, botões e mensagens seguem o estilo do mockup de
   formulário correspondente, mantendo os mesmos campos e o mesmo comportamento de validação de
   hoje.
3. **Given** as telas de CRUD sem mockup próprio (metodologia de risco, riscos, assinaturas,
   devoluções de EPI), **When** o usuário as abre, **Then** elas exibem o novo tema herdado das
   primitives compartilhadas, consistentes com as telas que têm mockup, sem regressão funcional.
4. **Given** qualquer uma dessas telas, **When** exibida em 375px, 768px e 1440px, **Then** o
   layout permanece legível e sem sobreposição/estouro horizontal em todos os três tamanhos.

---

### User Story 2 - Navegação em mega-menu por categoria, só com rotas reais (Priority: P1)

Como usuário, quero navegar por um menu organizado em categorias (Módulos, Cadastro, Gestão,
Qualidade) em vez da lista plana de links atual, e quero que esse menu mostre **apenas** as telas
que realmente existem no sistema — sem itens "em breve" que levam a lugar nenhum.

**Why this priority**: A navegação é o esqueleto compartilhado por todas as telas autenticadas;
sem ela reorganizada, o redesign fica visualmente inconsistente com o mockup e o usuário continua
com a lista plana. Listar rotas inexistentes quebraria a confiança e exporia roadmap interno.

**Independent Test**: Percorrer todos os itens do menu e confirmar que (a) estão agrupados por
categoria como no mockup, (b) cada item leva a uma rota que responde (nenhum 404/placeholder), e
(c) nenhuma tela de módulo não implementado aparece no menu.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele abre a navegação principal, **Then** os itens
   aparecem agrupados por categoria conforme o mockup, e não como uma lista plana única.
2. **Given** o menu aberto, **When** o usuário clica em qualquer item, **Then** ele chega a uma
   página existente e funcional — nenhum item aponta para módulo ainda não construído.
3. **Given** a navegação em telas estreitas (375px), **When** exibida, **Then** ela colapsa de
   forma acessível (ex.: menu compacto) sem esconder itens implementados nem quebrar o layout.

---

### User Story 3 - Página de boas-vindas pós-login (Priority: P2)

Como usuário recém-autenticado, quero uma página de boas-vindas com uma visão geral dos módulos e
ações rápidas (seguindo o `home.dc.html`), separada do dashboard operacional, para me orientar
logo após o login.

**Why this priority**: Melhora o onboarding e a orientação, mas depende da fundação visual (US1) e
não bloqueia o uso do sistema. É uma reorganização do conteúdo que hoje vive no `/dashboard` (a
lista de módulos), não uma capacidade nova.

**Independent Test**: Acessar `/boas-vindas` após o login e confirmar que ela apresenta a visão
geral de módulos / ações rápidas no layout do `home.dc.html`, reaproveitando os atalhos de
módulos que hoje aparecem no dashboard, sem introduzir dado ou lógica de negócio nova.

**Acceptance Scenarios**:

1. **Given** um usuário que acabou de se autenticar, **When** o login finaliza, **Then** ele é
   levado à página de boas-vindas (layout do `home.dc.html`, destino padrão pós-login) com visão
   geral de módulos e ações rápidas.
2. **Given** a página de boas-vindas, **When** o usuário aciona uma ação rápida, **Then** é
   levado ao módulo correspondente já existente.
3. **Given** a existência da página de boas-vindas, **When** o usuário abre o dashboard, **Then**
   o dashboard permanece como a tela operacional (KPIs/widgets) distinta da boas-vindas — os dois
   propósitos não se confundem.

---

### User Story 4 - Dashboard com KPIs reais e estados vazios honestos (Priority: P2)

Como usuário, quero um dashboard no layout do `dashboard.dc.html` com indicadores (KPIs) que
mostrem números **reais** do meu escritório onde o dado existe (empresas, PGRs, equipe) e que
mostrem um **estado vazio claro** nos widgets cujo dado ainda não existe no sistema (ex.:
incidentes, ordens de serviço), em vez de números inventados.

**Why this priority**: Agrega valor informativo, mas depende da fundação (US1) e do princípio de
"nunca inventar dado". É P2 porque o valor operacional real está nos poucos KPIs com dado
existente; o resto é apresentação honesta de ausência.

**Independent Test**: Abrir o dashboard em um tenant com dados conhecidos e conferir que os KPIs
com fonte real batem com a contagem esperada (isolada por tenant) e que os widgets sem fonte de
dados exibem o padrão de estado vazio do mockup — nunca valores fictícios.

**Acceptance Scenarios**:

1. **Given** um tenant com N empresas, M PGRs e K funcionários, **When** o usuário abre o
   dashboard, **Then** os KPIs de Empresas/PGRs/Equipe exibem exatamente N/M/K daquele tenant.
2. **Given** um widget cujo módulo de dados não existe (ex.: ordens de serviço, incidentes),
   **When** o dashboard é exibido, **Then** o widget mostra o estado vazio do próprio mockup
   (ícone informativo + frase), sem número ou gráfico fictício.
3. **Given** dois tenants distintos, **When** cada um abre o dashboard, **Then** as contagens de
   um nunca incluem registros do outro (isolamento multi-tenant preservado).
4. **Given** o KPI que no mockup era "OS Funcional" (sem fonte de dados no sistema), **When** o
   dashboard é exibido, **Then** aquele slot é ocupado por uma métrica real disponível — nunca por
   um valor de OS inventado.

---

### Edge Cases

- **Widget sem dado real**: qualquer widget cuja agregação exija lógica de negócio nova (não uma
  contagem simples sobre tabela existente) deve usar o estado vazio do mockup, nunca dado
  fictício.
- **Telas sem mockup próprio** (metodologia de risco, riscos, assinaturas, devoluções de EPI):
  devem herdar o restyle pela fundação/primitives compartilhadas — não viram trabalho de
  restyle individual, e a verificação nelas é de consistência com as primitives, não comparação
  com um `.dc.html` inexistente.
- **Telas de autenticação e onboarding** (login, cadastro, primeiros passos): são renderizadas
  pelo provedor de autenticação existente e **não** podem ser reimplementadas; a adequação visual
  se dá envolvendo os componentes do provedor na moldura do mockup e ajustando sua aparência
  (cor/fonte/raio) via as opções de customização do próprio provedor.
- **Tenant vazio**: um escritório sem empresas/PGRs/funcionários deve ver KPIs zerados e/ou o
  estado vazio, nunca erro ou placeholder de mock.
- **Tela estreita (375px)**: nenhuma tela redesenhada pode gerar rolagem horizontal do corpo da
  página nem esconder ação implementada.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST aplicar uma fundação visual única (cor primária indigo e variações,
  neutros, raio de cantos, sombra, tipografia Manrope para texto e um monoespaçado para usos
  pontuais) derivada dos mockups `.dc.html`, de modo que nenhuma página/componente dependa de
  valores de cor "soltos" fora dessa fundação.
- **FR-002**: O sistema MUST aplicar essa fundação às primitives de UI compartilhadas
  (lista, formulário, dica de campo, botão de confirmar exclusão, campos de endereço) e ao shell
  (cabeçalho + navegação), de forma que todas as telas de CRUD que já as consomem recebam o novo
  tema sem mudança de comportamento.
- **FR-003**: Cada tela **com mockup direto** (login, boas-vindas, dashboard, empresas, unidades
  de obra, funções, GES, funcionários, categorias, catálogo de EPI, estoque de EPI, PGR, editor
  de PGR, planos de ação, primeiros passos — incluindo seus formulários de criação/edição) MUST
  refletir fielmente o layout, a paleta e a tipografia do `.dc.html` correspondente.
- **FR-004**: Cada tela **sem mockup próprio** (metodologia de risco, riscos e subrotas,
  assinaturas, devoluções de EPI) MUST exibir o novo tema herdado das primitives compartilhadas,
  consistente com as telas que têm mockup, sem regressão funcional.
- **FR-005**: A navegação principal MUST ser reorganizada em mega-menu por categoria (Módulos,
  Cadastro, Gestão, Qualidade), listando **somente** rotas implementadas — nenhum item para
  módulo inexistente.
- **FR-006**: O sistema MUST oferecer uma página de boas-vindas em rota própria, no layout do
  `home.dc.html`, reaproveitando os atalhos de módulos hoje presentes no dashboard, sem introduzir
  dado ou lógica de negócio nova; ela MUST ser o destino padrão após o login (o dashboard deixa de
  ser o landing pós-login, mas permanece acessível pelo menu).
- **FR-007**: O dashboard MUST apresentar o layout do `dashboard.dc.html` com KPIs de dados reais
  onde a fonte existe (empresas, PGRs, equipe) e estado vazio do mockup onde a fonte não existe.
- **FR-008**: O sistema MUST NOT exibir dados fictícios em nenhum KPI ou widget; ausência de fonte
  de dados MUST ser representada pelo estado vazio do mockup.
- **FR-009**: As contagens exibidas no dashboard MUST respeitar o isolamento multi-tenant — a
  contagem de um escritório nunca inclui registros de outro.
- **FR-010**: As telas de autenticação e onboarding MUST permanecer funcionalmente inalteradas
  (mesmo provedor de auth, mesmos fluxos), recebendo apenas a moldura visual do mockup e o ajuste
  de aparência via a customização do próprio provedor — sem reimplementar autenticação.
- **FR-011**: Todas as telas redesenhadas MUST permanecer responsivas e sem quebra de layout em
  375px, 768px e 1440px.
- **FR-012**: A fidelidade de cada tela com mockup MUST ser verificada por comparação visual
  lado a lado (tela real vs. `.dc.html`) nos três breakpoints antes de considerá-la concluída.
- **FR-013**: O sistema MUST NOT introduzir qualquer tela ou rota de módulo de negócio novo além
  da página de boas-vindas; todas as telas de módulos inexistentes permanecem catalogadas no
  backlog documentado, fora desta fatia.
- **FR-014**: Esta fatia MUST NOT alterar regras de isolamento (RLS), o schema (salvo, se
  estritamente necessário, algo trivial para uma contagem — a evitar) nem o contrato das ações de
  servidor existentes; mudanças de dado limitam-se a contagens simples sobre tabelas já
  existentes para o dashboard.

### Key Entities

Esta fatia é de apresentação e **não introduz novas entidades de dados**. O dashboard apenas
**conta** entidades já existentes e isoladas por tenant:

- **Empresa** (companies) — contada para o KPI "Empresas".
- **PGR** (pgr) — contado para o KPI "PGRs".
- **Funcionário** (employees) — contado para o KPI "Equipe".
- **Item de estoque de EPI abaixo da mínima** (`epi_stock`, `balance < min_quantity`) — 4º KPI,
  que ocupa o slot que no mockup era "OS Funcional" (métrica real e acionável fixada no plano/research).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% das telas com mockup direto listadas em FR-003 são aprovadas por comparação
  visual com o `.dc.html` correspondente nos três breakpoints (375px, 768px, 1440px).
- **SC-002**: 0 telas novas de módulo de negócio são criadas além da página de boas-vindas.
- **SC-003**: 0 itens do menu de navegação apontam para rota inexistente (todo item leva a uma
  página que responde).
- **SC-004**: 0 KPIs/widgets exibem dado fictício; todo widget sem fonte real mostra o estado
  vazio do mockup.
- **SC-005**: Os KPIs de Empresas/PGRs/Equipe batem exatamente com a contagem do tenant e nunca
  incluem registros de outro tenant.
- **SC-006**: 0 telas redesenhadas apresentam quebra de layout ou rolagem horizontal do corpo em
  375px, 768px ou 1440px.
- **SC-007**: `npm run check` (format:check + lint + typecheck + testes unitários) permanece
  verde ao final da fatia.

## Assumptions

- A fundação visual (tokens de cor/raio/sombra/tipografia) é o ponto único de verdade; extraí-la
  primeiro e aplicá-la às primitives compartilhadas cascateia o tema às ~13 telas sem mockup
  direto, sem restyle individual — assunção herdada das decisões do briefing (itens 3 e 4).
- Os mockups `.dc.html` são protótipos de design-comp (estilo embutido); o produto reproduz a
  intenção visual com as convenções do próprio sistema, sem copiar os estilos embutidos.
- A verificação de fidelidade é por julgamento visual comparativo, não por diff de pixel
  automatizado (não há infraestrutura de regressão visual no projeto e introduzir uma está fora
  de escopo).
- O dashboard só usa contagens simples sobre tabelas já existentes; nenhuma agregação que exija
  lógica de negócio nova entra nesta fatia (widgets nesse caso ficam em estado vazio).
- A página de perfil de usuário (`perfil.dc.html`) fica no backlog — hoje só existe o modal padrão
  do provedor de auth, e criar uma tela de perfil própria é decisão de produto separada.
- Fonte da verdade do "como": `docs/briefings/briefing-redesign-implantation.md`; catálogo do que
  fica de fora: `docs/briefings/redesign-backlog-telas.md`.
- Dependência: fluxos de autenticação/onboarding continuam sob o provedor de auth existente
  (Clerk), customizável apenas por moldura + opções de aparência.
