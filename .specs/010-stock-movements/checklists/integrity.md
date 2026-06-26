# Checklist de Qualidade de Requisitos — Integridade do saldo & Isolamento (`stock_movements`)

**Purpose**: Validar a **qualidade dos requisitos** (completude, clareza, consistência,
mensurabilidade, cobertura) das áreas de maior risco da fatia 010 — integridade transacional do
saldo e isolamento multi-tenant — **antes** da implementação.
**Created**: 2026-06-26
**Feature**: [spec.md](../spec.md)
**Foco**: integridade transacional (atomicidade/não-negatividade/concorrência) + isolamento
**Audiência**: revisor (PR) · **Profundidade**: padrão

> Este checklist testa se os **requisitos estão bem escritos**, não se o código funciona.

## Requirement Completeness

- [x] CHK001 - As três operações em escopo (entrada, saída manual, histórico) e seus inputs estão todas especificadas? [Completeness, Spec §FR-001/FR-002/FR-030]
- [x] CHK002 - O conjunto de tipos de movimento em escopo vs. fora está explicitamente delimitado (purchase/adjustment/discard dentro; employee_delivery fora)? [Completeness, Spec §5/Out of Scope]
- [x] CHK003 - Os campos obrigatórios/opcionais de cada operação estão enumerados (stockId, quantity, movementDate, invoiceNumber?, type)? [Completeness, Spec §FR-001/FR-002]
- [x] CHK004 - As colunas exibidas no histórico estão completamente especificadas, incluindo as omitidas ("Usuário" não implementada)? [Completeness, Spec §FR-030/FR-041]
- [x] CHK005 - O feedback pós-escrita (novo saldo + status derivado refletidos) está especificado como requisito? [Completeness, Spec §FR-005/FR-042]
- [x] CHK006 - A superfície REST (métodos, rota, códigos de status) está documentada como requisito? [Completeness, Spec §FR-043]
- [x] CHK007 - Os requisitos de auditoria distinguem explicitamente escrita (audita) de leitura (não audita)? [Completeness, Spec §FR-054]

## Requirement Clarity

- [x] CHK008 - A regra "o sinal vem do `type`, `quantity` é sempre positivo" é inequívoca para todos os tipos? [Clarity, Spec §FR-003]
- [x] CHK009 - O formato da mensagem de saldo insuficiente está definido com precisão ("disponível X, solicitado Y")? [Clarity, Spec §FR-024]
- [x] CHK010 - A ordenação do histórico está totalmente especificada, incluindo o desempate intra-dia (`movement_date DESC, created_at DESC`)? [Clarity, Spec §FR-031]
- [x] CHK011 - "Saldo resultante" está definido sem ambiguidade como derivação acumulada (não coluna armazenada)? [Clarity, Spec §FR-030]
- [x] CHK012 - O mapeamento entre valores de enum em inglês e rótulos pt-BR está claramente definido? [Clarity, Spec §Clarifications/FR-030]

## Requirement Consistency

- [x] CHK013 - Os códigos de erro são consistentes entre spec e contratos (VALIDATION/NOT_FOUND/FORBIDDEN/INSUFFICIENT_STOCK)? [Consistency, Spec §FR-053/FR-024]
- [x] CHK014 - A invariante "`balance` só é escrito por esta camada / read-only na 009" é afirmada de forma consistente? [Consistency, Spec §Inv-4/FR-034]
- [x] CHK015 - Os requisitos de escopo por tenant são consistentes entre UI, Server Actions e REST? [Consistency, Spec §FR-050/FR-051/US4]
- [x] CHK016 - `adjustment` é tratado consistentemente como decremento (sem bidirecional) em toda a spec? [Consistency, Spec §FR-021/A3]

## Acceptance Criteria Quality & Measurability

- [x] CHK017 - Os critérios de sucesso são mensuráveis e livres de detalhe de implementação? [Measurability, Spec §SC-001..SC-007]
- [x] CHK018 - "Saldo nunca negativo" é verificável objetivamente (100% recusa, 0% gravação)? [Measurability, Spec §SC-002/FR-020]
- [x] CHK019 - A invariante "acumulado do histórico == saldo atual" está expressa de forma verificável? [Measurability, Spec §FR-034/SC-003]
- [x] CHK020 - Cada user story (US1–US4) tem cenários de aceite definidos? [Acceptance Criteria, Spec §US1-US4]

## Scenario & Edge Case Coverage

- [x] CHK021 - Os fluxos de exceção (saldo insuficiente, cross-tenant, quantity ≤ 0, type inválido) têm requisitos definidos? [Coverage, Spec §Edge Cases]
- [x] CHK022 - O comportamento sob **concorrência** (duas saídas simultâneas; serialização) está especificado como requisito? [Coverage, Spec §FR-023/US2 cenário 4]
- [x] CHK023 - O estado vazio do histórico (item sem movimentos) está especificado? [Edge Case, Spec §FR-033]
- [x] CHK024 - A ausência de tenant/sessão está especificada como bloqueio pelo gate (não como histórico vazio)? [Coverage, Spec §US4 cenário 3/Edge]
- [x] CHK025 - O requisito de rollback/atomicidade está definido para falha parcial (nem movimento sem saldo, nem o inverso)? [Recovery, Spec §FR-004]
- [x] CHK026 - O cenário "funcionário no histórico" está delimitado (só `employee_delivery`; demais vazio)? [Coverage, Spec §FR-032/A5]

## Non-Functional (Integridade / Segurança / Performance)

- [x] CHK027 - A integridade do saldo está especificada em camadas (validação na app + `CHECK` como backstop)? [Non-Functional, Spec §FR-022]
- [x] CHK028 - O backstop de isolamento (RLS) está especificado para **todos** os caminhos de acesso (action/REST/repo)? [Security, Spec §FR-051/US4]
- [x] CHK029 - A autorização (office staff; papel `client` negado inclusive em leitura) está especificada? [Security, Spec §FR-055]
- [x] CHK030 - Os requisitos de paginação/performance para histórico volumoso estão definidos? [Non-Functional, Spec §FR-033]

## Dependencies & Assumptions

- [x] CHK031 - As dependências da 008/009 estão documentadas como pré-condição (incl. estado de branch)? [Dependency, Spec §Dependencies / Plan §"Pré-condições de branch"]
- [x] CHK032 - A suposição "`balance` só muda por esta camada (+ #19)" está documentada e validada? [Assumption, Spec §A1/Inv-4]
- [x] CHK033 - O requisito de banco de teste (Postgres efêmero; nunca SQLite nem dev) está documentado? [Dependency, Spec §Definição de pronto]

## Ambiguities & Conflicts

- [x] CHK034 - O fora-de-escopo é explícito o bastante para evitar scope creep (`created_by`, `balance_after`, #19/#20, ajuste bidirecional)? [Scope/Conflict, Spec §Out of Scope]
- [x] CHK035 - Há algum conflito entre "`movement_date` é `date` (sem hora)" e qualquer expectativa de ordenação por horário? [Ambiguity, Spec §FR-031/Edge]

## Notes

- Itens marcados como incompletos exigem ajuste na **spec** (não no código) antes do
  `/speckit-implement`.
- CHK022 e CHK026 correspondem aos achados F1/F2 do `/speckit-analyze`: o **requisito** existe e está
  bem escrito (passa neste checklist de qualidade); o que falta é apenas **cobertura de teste**, que é
  decisão separada (opcional).
