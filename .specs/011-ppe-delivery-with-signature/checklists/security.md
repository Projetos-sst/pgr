# Checklist de Qualidade de Requisitos: Segurança & Isolamento

**Purpose**: Validar que os requisitos de segurança e isolamento multi-tenant (rota pública sem login +
token de capacidade) estão completos, claros e consistentes — ANTES da implementação.
**Created**: 2026-06-27
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)
**Depth**: Standard · **Audience**: Reviewer (PR) / Author

> Estes itens testam a **qualidade dos requisitos**, não o comportamento do código.

## Requirement Completeness

- [ ] CHK001 - Os requisitos definem o mecanismo exato de derivação do tenant no caminho público (a partir do token, server-side)? [Completeness, Spec §FR-010]
- [ ] CHK002 - Está especificado **quais dados mínimos** a página pública pode exibir (e o que é proibido expor)? [Completeness, Spec §FR-009]
- [ ] CHK003 - Os requisitos de auditoria cobrem a confirmação **pública** (com `org_id` derivado do token) e a criação/assinatura interna? [Completeness, Spec §FR-013]
- [ ] CHK004 - Há requisito definindo a entropia/forma de geração do token de capacidade? [Completeness, Spec §FR-011]
- [ ] CHK005 - Está documentado o comportamento de autorização do caminho interno (papéis que operam vs. `client` negado)? [Completeness, Spec §FR-014]
- [ ] CHK006 - Os requisitos especificam que a rota pública deve ser liberada explicitamente (sem reaproveitar o bypass de desenvolvimento)? [Completeness, Plan/Research D3]

## Requirement Clarity

- [ ] CHK007 - "Dados mínimos" da tela pública está quantificado (lista explícita de campos), não apenas adjetivo? [Clarity, Spec §FR-009]
- [ ] CHK008 - "Uso único" do token está definido sem ambiguidade (o que torna o token inválido e quando)? [Clarity, Spec §FR-011]
- [ ] CHK009 - A janela de expiração (72h) tem origem inequívoca (a partir de qual instante é contada)? [Clarity, Spec §FR-017]

## Requirement Consistency

- [ ] CHK010 - A regra "tenant sempre da sessão" (caminho interno) e "tenant derivado do token" (caminho público) estão descritas sem se contradizerem? [Consistency, Spec §FR-010/Clarifications]
- [ ] CHK011 - O tratamento de token (404 inexistente / 409 usado / 410 expirado) é consistente entre spec, contratos e regras de erro? [Consistency, Spec §Edge Cases]

## Scenario Coverage

- [ ] CHK012 - Há requisito para o cenário de token de **outra organização** (não vazar dados, não afetar outra entrega)? [Coverage, Spec §SC-005]
- [ ] CHK013 - O cenário de confirmação repetida/concorrente (idempotência) está coberto como requisito? [Coverage, Spec §Edge Cases]
- [ ] CHK014 - Está coberto o requisito de que a confirmação pública afeta **somente** a entrega do token? [Coverage, Spec §FR-010/SC-005]

## Edge Case Coverage

- [ ] CHK015 - O comportamento para token expirado (>72h) está especificado como requisito (não só implícito)? [Edge Case, Spec §FR-017]
- [ ] CHK016 - O comportamento para entrega já assinada (token "queimado") está especificado? [Edge Case, Spec §Edge Cases]

## Non-Functional (Segurança)

- [ ] CHK017 - Há requisito sobre não-cacheamento (`no-store`) da rota/recurso público? [NFR, Plan/Contracts]
- [ ] CHK018 - Rate-limiting/anti-brute-force do token está endereçado ou explicitamente declarado fora de escopo? [NFR, Gap]
- [ ] CHK019 - Há requisito explícito de que `organization_id`/identificadores internos nunca sejam expostos ao visitante? [NFR, Spec §FR-010]

## Dependencies & Assumptions

- [ ] CHK020 - A premissa de que a leitura por token **não depende** do contexto de tenant (RLS) está registrada e é testável? [Assumption, Research D3]
- [ ] CHK021 - A suposição de "sem provedor de e-mail/SMS" (link só é gerado/exibido) está documentada como assunção, evitando expectativa de envio? [Assumption, Spec §FR-018]

## Ambiguities & Conflicts

- [ ] CHK022 - Algum termo de segurança permanece vago (ex.: "seguro", "mínimo") sem critério objetivo? [Ambiguity]
