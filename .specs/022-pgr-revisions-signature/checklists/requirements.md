# Specification Quality Checklist: Revisões do PGR, revisão consolidada e assinatura pública

**Purpose**: Validar completude e qualidade da especificação antes de seguir para o planejamento
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Desvio deliberado e consistente com a convenção do repositório

O item "No implementation details" foi avaliado com o critério que este repositório já pratica (ver
`.specs/019-pgr-consolidated-view/spec.md`): a spec **não prescreve solução técnica** (não escolhe
biblioteca, não desenha função, não define endpoint exato — o `plan` é que materializa as rotas após
ler os contratos da Fase 0), mas **nomeia os artefatos já existentes** (tabelas, restrições UNIQUE,
códigos de erro de domínio) porque o valor central desta fatia é justamente **fidelidade ao que já
existe**: a issue original descrevia campos e tabelas que **não existem**, e a spec só é útil se
ancorar o time no modelo real. Nomear `pgr_revisions` ou `DUPLICATE` aqui é **restrição de negócio
herdada**, não decisão de implementação.

### Verificações executadas

- **Zero marcadores `[NEEDS CLARIFICATION]`** — confirmado por varredura do arquivo. Todas as
  decisões potencialmente ambíguas foram fechadas pelo Gate 0 e pela decisão de escopo aprovada
  (zero-migration; sem autor; sem snapshot; sem revisão automática; sem PDF; sem CPF/IP; status
  derivado), e as demais foram registradas em **Assumptions** com o racional.
- **Testabilidade** — cada FR tem cenário correspondente em User Scenarios ou em Edge Cases; cada
  SC é verificável sem conhecer a implementação (inclusive SC-013, que se verifica pelo comando de
  geração de migrations reportar "No schema changes").
- **Escopo delimitado** — a seção **Out of Scope** enumera explicitamente os 13 grupos excluídos, e a
  tabela de **Divergências** registra, item a item, onde a issue original contradiz o repositório.

### Correções aplicadas após a review read-only (2026-07-14)

1. **Cota promovida a requisito.** A política de cota deixou de existir apenas como Assumption e virou
   **FR-037** (contador por tenant/mês somando todos os tipos de alvo; `free` limitado, `pro`
   ilimitado; `QUOTA_EXCEEDED` → HTTP 402; sem cota nova, sem bypass, sem mexer em billing).
   Verificado no código: `createSignatureRequest` chama `countRequestsInCurrentMonth(tenantId)`, que
   **não filtra por `target_type`** — o compartilhamento da cota é consequência do reuso, não código novo.
2. **Testes de cota e HTTP 402 acrescentados** nos três níveis (unit, integração, REST/cURL).
3. **Resumo público definido como snapshot mínimo** (**FR-023**, reforçada): congelado na criação do
   link, sem dados de funcionários/PII, sem a consolidada completa. Edge cases e testes (unit,
   integração, segurança) acrescentados.
4. **Estados reais da assinatura registrados** (público: `signable|invalid|expired|used`; protegido:
   `pending|signed|expired|cancelled`), com a nota de que `cancelled` colapsa em `used` no resolvedor
   público — seguro, e a não ser alterado silenciosamente.

### Riscos que o `/speckit-plan` DEVE endereçar (não são lacunas da spec, são trabalho do plano)

1. **A rota pública de assinatura não está liberada no proxy hoje.** Sem essa correção, a User Story 5
   é inalcançável. O plano deve tratá-la como pré-requisito, com teste que prove acesso sem sessão.
2. **Endpoints exatos não foram inventados.** Por exigência explícita, o plano deve materializá-los
   **após** ler os contratos reais da infraestrutura de assinatura da Fase 0.
3. **Composição do payload público.** O plano deve definir o conjunto exato de campos do snapshot
   mínimo, respeitando FR-023a (sem PII, sem consolidada completa).

### Pendência conhecida fora desta spec

- A expectativa de **autor da revisão** presente na issue **não será atendida** nesta V1 (exigiria
  migration). Se o negócio a considerar obrigatória, deve virar **issue própria**, com decisão sobre
  FK versus snapshot de nome e sobre o comportamento quando o usuário sai do tenant.

**Status**: ✅ Todos os itens aprovados. Spec pronta para `/speckit-plan` (o `/speckit-clarify` é
dispensável — não há perguntas em aberto).
