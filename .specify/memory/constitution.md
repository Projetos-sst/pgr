<!--
SYNC IMPACT REPORT
==================
Version change: 1.2.0 → 1.2.1 (PATCH — clarificação/correção de Princípio I)
Last amended: 2026-06-19

Modified sections:
- Princípio I (Isolamento Multi-Tenant): corrigido o identificador de tenant — de
  "organização do Clerk" para "o tenant = escritório/workspace (`orgs.id` no nosso
  banco), resolvido da sessão autenticada via vínculos (`org_memberships`)". Adicionada
  a distinção empresa-cliente (`company_id`, dimensão de dados DENTRO do tenant) vs.
  tenant (`org_id`, fronteira de isolamento). A organização do Clerk passa a ser apenas
  a camada de UI B2B do plano PRO (`orgs.clerk_org_id`), opcional; contas free têm
  tenant isolado sem organização no Clerk.
- "Restrições Técnicas & Stack" → linha Auth/Multi-tenant ajustada à mesma premissa.

Rationale: a fatia 005 (.specs/005-modelo-tenant-gate-pro) adota o Modelo B — o tenant
é o escritório do profissional de SST, e contas free têm tenant isolado SEM organização
no Clerk. Logo, o identificador de tenant não pode ser a org do Clerk. A redação anterior
assumia "org do Clerk = tenant" (premissa da 004), incompatível com o free. A emenda
corrige o descritor SEM relaxar a regra não-negociável: o tenant continua vindo sempre da
sessão autenticada e NUNCA de input do cliente.

Classificação PATCH: nenhum princípio adicionado, removido ou redefinido de forma
incompatível; a regra não-negociável (isolamento + tenant da sessão) é preservada — apenas
o identificador é descrito com precisão e estendido ao caminho free.

Principles modified: I (clarificado, não redefinido em incompatibilidade).
Added sections: none. Removed sections: none.

Templates reviewed for consistency:
- .specify/templates/plan-template.md ........ ✅ ok (Constitution Check preenchido pelo /speckit-plan; sem referência hardcoded ao identificador de tenant)
- .specify/templates/spec-template.md ......... ✅ ok (sem conflito)
- .specify/templates/tasks-template.md ........ ✅ ok (sem conflito)
- .specify/templates/checklist-template.md .... ✅ ok (sem conflito)

Histórico:
- (template) → 1.0.0: adoção inicial (5 princípios + 2 seções).
- 1.1.0: ajustes anteriores de governança/seções.
- 1.2.0: exceção de Postgres efêmero para RLS/policies/triggers na cláusula de Integração.
- 1.2.1: correção do identificador de tenant no Princípio I (Modelo B — tenant = escritório/`orgs.id`).

Follow-up TODOs: none
-->

# Constituição — SST Manager

SST Manager é um SaaS B2B multiempresa de Segurança do Trabalho (SST). Esta
constituição define as regras não-negociáveis que governam todas as decisões de
produto, arquitetura e código. Ela supersede preferências individuais.

## Core Principles

### I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)

Toda leitura e escrita de dados de negócio MUST ser escopada pelo **tenant
ativo** — o escritório/workspace do profissional de SST, identificado pelo
`orgs.id` no nosso banco. As regras:

- O identificador do tenant ativo MUST vir sempre da sessão autenticada —
  resolvido a partir do `userId` da sessão e dos vínculos do nosso sistema
  (`org_memberships`) — e NUNCA de input do cliente (body, query, header).
- A organização do Clerk NÃO é o identificador de tenant. Quando existir, é
  apenas a camada de UI B2B do plano PRO (`orgs.clerk_org_id`); contas free têm
  tenant isolado SEM organização no Clerk.
- A "empresa-cliente" (`company_id`) é uma dimensão de dados DENTRO do tenant —
  NÃO uma fronteira de isolamento. A fronteira de isolamento é sempre o tenant
  (`org_id`).
- Nenhuma query pode acessar dados de negócio sem o filtro de tenant aplicado.
- O Row Level Security (RLS) do Supabase MUST estar habilitado em toda tabela
  que contém dados de negócio, como defesa em profundidade — nunca a única
  barreira.
- Storage de arquivos MUST particionar/autorizar acesso por tenant.

**Rationale**: Vazamento de dados entre escritórios é a falha crítica de um SaaS
B2B e o maior risco identificado para este produto. Não há cenário em que
relaxar este princípio seja aceitável. O tenant é o escritório (não a
empresa-cliente, que é uma dimensão interna): essa premissa (Modelo B) garante
isolamento desde o cadastro, inclusive para contas free sem organização no
Clerk.

### II. Stack Fixa e Simplicidade (YAGNI)

A stack do projeto é fixa: Next.js fullstack na Vercel, Supabase (PostgreSQL +
Storage), Clerk (autenticação e organizações) e Cloudflare na borda.

- Introduzir nova infraestrutura (AWS completa, microserviços, filas dedicadas,
  serviços externos pagos, novo banco) MUST exigir emenda formal a esta
  constituição antes da implementação.
- Aplicar YAGNI: implementar apenas o requisito atual da fatia em andamento;
  sem features ou abstrações especulativas.
- Preferir a solução mais simples que atende o requisito.

**Rationale**: O prazo é agressivo (45 dias). Complexidade de infraestrutura é
o maior inimigo da entrega; a evolução para arquiteturas mais robustas só se
justifica após validação do produto.

### III. Entrega em Fatias Verticais

O trabalho MUST ser entregue em fatias verticais independentes, normalmente
alinhadas a um módulo (PGR, EPIs, funcionários, documentos, treinamentos,
ordens de serviço, acidentes, dashboards, geração de PDF).

- Cada fatia MUST ser testável e demonstrável isoladamente.
- Cada fatia segue o ciclo Spec Kit: `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`.
- MVP primeiro: a história de maior prioridade (P1) MUST estar funcional antes
  de iniciar a próxima.
- Specs MUST permanecer enxutos e focados em uma fatia — sem mega-specs.

**Rationale**: Fatias verticais reduzem risco, permitem validação incremental
e evitam que a aplicação vire um monólito desorganizado dentro do Next.js.

### IV. Operações Pesadas São Assíncronas

Processos longos ou pesados — geração de PDF em lote, notificações em massa,
importações, relatórios extensos — MUST NOT rodar de forma síncrona dentro de
um Route Handler ou Server Action que responde a uma requisição de usuário.

- Operações rápidas (CRUD e regras de negócio) rodam de forma síncrona.
- Operações pesadas MUST ser desacopladas da resposta (execução assíncrona /
  background), com feedback de progresso ao usuário quando aplicável.

**Rationale**: Ambientes serverless têm limites de tempo de execução. Operações
síncronas pesadas causam timeouts e degradam a experiência.

### V. Segurança e Integridade de Dados

Dados de SST têm peso legal e regulatório; integridade não é opcional.

- TypeScript MUST permanecer em modo `strict`; `any` só com justificativa
  explícita.
- Toda Server Action e Route Handler MUST validar a entrada com schema antes de
  tocar o banco de dados.
- O PostgreSQL é a fonte de verdade: relacionamentos e constraints (FK,
  NOT NULL, UNIQUE, CHECK) MUST refletir as regras de dados — a validação na
  aplicação complementa, não substitui, as garantias do banco.
- Segredos MUST residir apenas em variáveis de ambiente e NUNCA ser commitados.

**Rationale**: Validação em camadas e constraints no banco previnem corrupção
de dados que, neste domínio, pode ter consequências regulatórias.

## Restrições Técnicas & Stack

- **Framework**: Next.js 16.2.6 com App Router (`app/`), React 19. É uma versão
  major com breaking changes — consultar `node_modules/next/dist/docs/` antes de
  escrever código de framework (ver `AGENTS.md`).
- **Estilo**: Tailwind CSS v4 (CSS-first, sem `tailwind.config.*`); tokens de
  tema no bloco `@theme inline` de `app/globals.css`.
- **Linguagem**: TypeScript `strict`; alias de import `@/*` mapeia a raiz do
  repositório.
- **Execução/Deploy**: Vercel (serverless, escala automática).
- **Dados**: Supabase — PostgreSQL gerenciado e Storage de arquivos.
- **Auth/Multi-tenant**: Clerk — sessões e identidade (usuários). O **tenant** (escritório)
  é o `orgs.id` do nosso banco, resolvido pela sessão via `org_memberships` (não a org do
  Clerk). Organizações do Clerk, quando existirem, são a camada de UI B2B do plano PRO
  (`orgs.clerk_org_id`).
- **Borda**: Cloudflare — DNS, cache, WAF e mitigação.
- Backend e frontend são unificados no Next.js (Server Actions e Route
  Handlers); NÃO há API separada tradicional.

## Fluxo de Desenvolvimento & Quality Gates

- Todo trabalho de feature passa pelo fluxo Spec Kit (constitution → specify →
  plan → tasks → implement). Código de produto não é escrito fora desse fluxo.
- O trabalho MUST ocorrer em feature branches; nunca commits diretos na `main`.
- **Quality gate antes de concluir qualquer tarefa**: `npm run lint` e a
  verificação de tipos do TypeScript MUST passar.
- **Testes**: testes automatizados são MUST, não opcionais.
  - **Unitários**: toda lógica de negócio, funções utilitárias e validações
    MUST ter testes unitários (Jest + Testing Library).
  - **Integração**: toda Server Action e Route Handler MUST ter testes de
    integração. O ambiente de integração usa SQLite em memória como banco
    substituto **por padrão** — setup simples, sem dependência de serviços
    externos.
    - **Exceção (recursos exclusivos do PostgreSQL)**: fatias cujo comportamento
      depende de Row Level Security (RLS)/policies, triggers ou
      `auth.jwt()`/`current_setting` MUST usar um **Postgres efêmero** (ex.:
      branch do Supabase) como banco de integração — o SQLite não suporta esses
      recursos e não conseguiria provar o backstop. Decorre do Princípio I, que
      exige RLS comprovável. O SQLite permanece o default para as demais fatias.
  - Uma fatia só é considerada concluída quando os testes passam (`npm run
test` e `npm run test:integration`).
- Mudanças são revisadas quanto à conformidade com esta constituição antes do
  merge.

## Governance

- Esta constituição supersede outras práticas e preferências.
- **Emendas** exigem: (1) documentação da mudança, (2) justificativa explícita
  e (3) incremento de versão semântico.
- **Versionamento**: MAJOR para remoção ou redefinição incompatível de
  princípios/governança; MINOR para novo princípio ou seção materialmente
  expandida; PATCH para clarificações e ajustes não-semânticos.
- Toda fatia: o `/speckit-plan` MUST verificar conformidade na seção
  "Constitution Check"; violações justificadas vão em "Complexity Tracking".
- Orientação de runtime para agentes: `CLAUDE.md` e `AGENTS.md`.

**Version**: 1.2.1 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-06-19
