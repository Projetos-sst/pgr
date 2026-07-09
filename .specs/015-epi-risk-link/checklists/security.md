# Checklist: Qualidade dos requisitos de isolamento multi-tenant

**Purpose**: Validar se os requisitos de isolamento/segurança do vínculo EPI × risco estão completos,
claros, consistentes e verificáveis (unit tests para os requisitos — não para o código).
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md) · **Foco**: Princípio I (Isolamento Multi-Tenant, não-negociável)

## Requirement Completeness

- [ ] CHK001 - Os requisitos definem o escopo por tenant para **todos** os caminhos de leitura E escrita do vínculo (list, available, create, update, delete)? [Completeness, Spec §FR-010]
- [ ] CHK002 - Está especificado que a validação de pertencimento ao tenant (risco **e** EPI) é a **barreira real** de isolamento, distinta da RLS, porque a FK não passa pela RLS? [Completeness, Spec §FR-009]
- [ ] CHK003 - Há requisito explícito de que a RLS é **backstop** (defesa em profundidade), nunca a única barreira? [Completeness, Spec §FR-010]
- [ ] CHK004 - Os requisitos de autorização por papel (quem pode escrever: `owner`/`collaborator`; `client` → `FORBIDDEN`) estão documentados? [Coverage, Spec Edge Cases]
- [ ] CHK005 - Existe requisito sobre a trilha de auditoria de escritas aceitas/rejeitadas do vínculo? [Gap] _(contratos citam `auditedTenantWrite`; a spec não menciona)_

## Requirement Clarity

- [ ] CHK006 - A origem do tenant ativo está inequivocamente definida como "sessão, nunca input do cliente"? [Clarity, Spec §FR-010]
- [ ] CHK007 - O resultado esperado de referência cruzada está especificado **por operação** — criar → `FK_NOT_FOUND`; editar/remover → `NOT_FOUND`? [Clarity, Spec §US1]
- [ ] CHK008 - A distinção entre "risco sem EPI" (lista vazia, válido) e "vínculo de outra org não encontrado" está clara, para que vazio não seja confundido com bloqueio de isolamento? [Clarity, Spec §FR-008 + §US1]

## Requirement Consistency

- [ ] CHK009 - Os requisitos de isolamento são consistentes entre Server Action e REST mirror (mesma regra, sem reimplementação)? [Consistency, Spec §FR-012]
- [ ] CHK010 - O identificador de tenant (`org_id`/`orgs.id`) é usado de forma consistente na spec, sem confundir com a empresa-cliente (`company_id`) nem com a org do Clerk? [Consistency, Constituição §I]

## Scenario & Edge Case Coverage

- [ ] CHK011 - Os três vetores de ataque de US1 (leitura cruzada, escrita cruzada, acesso por id de outra org) têm requisito e resultado esperado definidos? [Coverage, Spec §US1]
- [ ] CHK012 - Há requisito para concorrência entre tenants distintos referenciando ids equivalentes (nenhum vazamento)? [Edge Case, Coverage, Gap]
