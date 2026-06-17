<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0 (MINOR — seção materialmente expandida)
Last amended: 2026-06-17

Modified sections:
- "Fluxo de Desenvolvimento & Quality Gates" → cláusula de testes de Integração
  expandida com exceção: fatias dependentes de recursos exclusivos do PostgreSQL
  (RLS/policies, triggers, auth.jwt()/current_setting) MUST usar Postgres efêmero
  como banco de integração; SQLite permanece o default para as demais fatias.

Rationale: o Princípio I exige RLS como backstop comprovável, e o SQLite não
suporta RLS/policies/triggers — a redação anterior, lida ao pé da letra, era
incompatível com o próprio Princípio I. A emenda alinha o texto à prática já
existente (ver .specs/004-multi-tenant-isolation e o teste least-privilege.test.ts).

Principles modified: none (nenhum princípio adicionado, removido ou redefinido).
Added sections: none. Removed sections: none.

Templates reviewed for consistency:
- .specify/templates/plan-template.md ........ ✅ ok (Constitution Check preenchido pelo /speckit-plan; sem referência hardcoded a SQLite)
- .specify/templates/spec-template.md ......... ✅ ok (sem conflito)
- .specify/templates/tasks-template.md ........ ✅ ok (sem conflito)
- .specify/templates/checklist-template.md .... ✅ ok (sem conflito)

Histórico:
- (template) → 1.0.0: adoção inicial (5 princípios + 2 seções).
- 1.1.0: ajustes anteriores de governança/seções.

Follow-up TODOs: none
-->

# Constituição — SST Manager

SST Manager é um SaaS B2B multiempresa de Segurança do Trabalho (SST). Esta
constituição define as regras não-negociáveis que governam todas as decisões de
produto, arquitetura e código. Ela supersede preferências individuais.

## Core Principles

### I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)

Toda leitura e escrita de dados de negócio MUST ser escopada pela organização
ativa. As regras:

- O identificador de tenant (organização do Clerk) MUST vir sempre da sessão
  autenticada — NUNCA de input do cliente (body, query, header).
- Nenhuma query pode acessar dados de empresa sem o filtro de tenant aplicado.
- O Row Level Security (RLS) do Supabase MUST estar habilitado em toda tabela
  que contém dados de empresa, como defesa em profundidade — nunca a única
  barreira.
- Storage de arquivos MUST particionar/autorizar acesso por organização.

**Rationale**: Vazamento de dados entre empresas é a falha crítica de um SaaS
B2B e o maior risco identificado para este produto. Não há cenário em que
relaxar este princípio seja aceitável.

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
- **Auth/Multi-tenant**: Clerk — sessões, usuários e organizações.
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

**Version**: 1.2.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-06-17
