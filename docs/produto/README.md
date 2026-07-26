# Roadmap de Arquitetura — SST Manager

Este diretório é o **norte técnico** do projeto. Ele descreve _como_ a aplicação
deve ser construída: estrutura de pastas, modelagem de dados, design de API,
integrações e o plano de entrega em 45 dias.

Não substitui o fluxo Spec Kit — ele o **alimenta**. Cada fatia vertical
continua passando por `/speckit-specify → plan → tasks → implement`. Este
roadmap é a referência estável que mantém todas as fatias coerentes entre si.

## Hierarquia de documentos

```
.specify/memory/constitution.md   → princípios não-negociáveis (o que NUNCA muda)
docs/architecture/                → COMO construir (este roadmap)
docs/workflow-desenvolvimento.md  → fluxo de trabalho Spec Kit / Git
specs/<tipo>/<feature>/           → spec + plan + tasks de cada fatia
```

Em caso de conflito, a ordem de precedência é: **constituição → este roadmap →
specs de feature**. Se uma fatia precisar contrariar o roadmap, isso é sinal de
que o roadmap deve ser revisado primeiro (e, se tocar um princípio, exige emenda
formal da constituição).

## Índice

| #   | Documento                                                              | Conteúdo                                                                                          |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| —   | [`README.md`](./README.md)                                             | Este índice                                                                                       |
| 00  | [`00-visao-geral.md`](./00-visao-geral.md)                             | Visão do produto, diagrama da arquitetura, decisões arquiteturais (ADR), princípios de engenharia |
| 01  | [`01-estrutura-de-pastas.md`](./01-estrutura-de-pastas.md)             | Estrutura de pastas do Next.js (frontend + backend), convenções                                   |
| 02  | [`02-modelagem-de-dados.md`](./02-modelagem-de-dados.md)               | Modelagem PostgreSQL, multi-tenant, tabelas por módulo, RLS, transações                           |
| 03  | [`03-api-design.md`](./03-api-design.md)                               | Server Actions vs Route Handlers, validação, acesso a dados org-scoped                            |
| 04  | [`04-integracoes-e-servicos.md`](./04-integracoes-e-servicos.md)       | Clerk, Supabase Storage, serviço de PDF (Gotenberg), jobs assíncronos, Cloudflare                 |
| 05  | [`05-roadmap-de-fases.md`](./05-roadmap-de-fases.md)                   | Plano de entrega faseado (45 dias), riscos, melhorias futuras                                     |
| 06  | [`06-inventario-de-entregaveis.md`](./06-inventario-de-entregaveis.md) | Inventário de entregáveis (telas/fluxos) → milestones e issues do GitHub                          |
| 07  | [`07-pgr-ged-e-pdf.md`](./07-pgr-ged-e-pdf.md)                         | Etapa "Documentos e PDF" do PGR: download síncrono vs. arquivamento no GED, worker, diagnóstico   |

## Como usar

- **Antes de iniciar uma fatia** (`/speckit-specify`): leia o documento 05 para
  saber em que fase ela entra e quais dependências já devem existir.
- **Durante o `/speckit-plan`**: os documentos 01–04 são a referência técnica.
  O plano da fatia não reinventa decisões já tomadas aqui; ele as aplica.
- **Ao revisar uma PR**: confira aderência ao roadmap além da constituição.

## Decisões já fechadas

Decisões técnicas que a constituição deixou em aberto e que estão consolidadas
neste roadmap (detalhes e justificativas no documento 00):

1. **Acesso a dados**: Drizzle ORM + escopo de organização na aplicação + RLS no
   Supabase como defesa em profundidade.
2. **Mutações**: Server Actions como padrão; Route Handlers só para webhooks,
   cron e downloads.
3. **Organização do código**: `app/` fino (só roteamento) + `features/` para a
   lógica de domínio.
4. **Geração de PDF**: serviço auxiliar Gotenberg (container stateless),
   acionado de forma assíncrona.

---

_Documento vivo. Atualize-o quando uma decisão arquitetural mudar — e propague a
mudança para as specs afetadas._
