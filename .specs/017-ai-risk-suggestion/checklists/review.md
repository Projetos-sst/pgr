# Review Checklist: Sugestão de riscos assistida por IA

**Purpose**: Sanidade leve (pré-merge) da **qualidade dos requisitos** nos domínios
Segurança/Privacidade, API/Contratos, UX e IA/Confiabilidade. Itens avaliam se os requisitos estão
**bem escritos** (completos/claros/consistentes/mensuráveis/cobertos) — não se o código funciona.
**Created**: 2026-07-08
**Evaluated**: 2026-07-08 (16/18 passam; 2 abertos = achados não-bloqueantes do `/speckit-analyze`)
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [tasks.md](../tasks.md)

## Segurança & Privacidade

- [x] CHK001 Os campos exatos enviados ao LLM estão enumerados e a **exclusão de dados de funcionários/PII** está declarada como requisito (não só implícita na query)? [Completeness, Spec §FR-002]
- [x] CHK002 "Dado sensível"/PII está definido com escopo concreto (ex.: nome, CPF) em vez de termo vago? [Clarity, Spec §SC-003]
- [x] CHK003 O requisito de **verificar o pertencimento do GES ao tenant antes da chamada externa** está consistente entre os fluxos de sugestão e de aceite? [Consistency, Spec §FR-007]
- [x] CHK004 A restrição de **chave do LLM somente no servidor** aparece como requisito (§FR-011) e não apenas como suposição? [Completeness, Spec §FR-011]
- [x] CHK005 O **gate da constituição** para serviço externo pago (Princípio II) está documentado como ação de governança obrigatória? [Traceability, Plan §Constitution Check / Tasks T035]

## API & Contratos

- [x] CHK006 Todos os códigos de erro do domínio (AI_UNAVAILABLE, QUOTA_EXCEEDED, FK_NOT_FOUND, VALIDATION, FORBIDDEN) e seus mapeamentos HTTP estão especificados? [Completeness, Contracts §rest-api]
- [x] CHK007 O requisito de **regra única compartilhada** entre Server Action e espelho REST (sem lógica duplicada) está declarado? [Consistency, Spec §FR-012]
- [x] CHK008 Os status de sucesso (200 na sugestão / 201 no aceite) estão explicitamente definidos? [Clarity, Contracts §rest-api]
- [x] CHK009 Os entregáveis de **docs + Postman** da regra de superfície de API estão capturados como requisito/tarefa? [Coverage, Tasks T024/T025]

## UX (revisão / aceite)

- [x] CHK010 Os estados de **carregamento, vazio e erro** do fluxo de sugestão estão todos especificados? [Completeness, Spec §Edge Cases]
- [x] CHK011 O requisito "**nada é adicionado automaticamente**" está escrito de forma inequívoca? [Clarity, Spec §SC-002]
- [x] CHK012 O comportamento para **sugestões duplicadas** (vs inventário existente) está definido ou explicitamente deixado ao usuário? [Coverage, Spec §Edge Cases]
- [x] CHK013 Os campos que devem exibir **dicas de preenchimento** estão enumerados para os formulários de GES **e** de risco? [Completeness, Spec §FR-013]

## IA & Confiabilidade

- [ ] CHK014 "**≥3 riscos relevantes**" está definido com um critério objetivamente verificável (ou marcado como validação manual)? [Measurability, Spec §SC-001] — **ABERTO**: "relevantes" é subjetivo e SC-001 não está marcado como validação manual. Coincide com o achado A1/C1 do `/speckit-analyze` (MEDIUM, não-bloqueante).
- [x] CHK015 O comportamento para **lote parcialmente inválido** (descartar o item, não o lote) está especificado? [Edge Case, Spec §FR-006]
- [x] CHK016 O requisito de que **falha/timeout do LLM não bloqueia** o cadastro do GES está consistente entre §FR-010 e §SC-005? [Consistency, Spec §FR-010]
- [ ] CHK017 Existe requisito cobrindo um **teste automatizado do caminho de falha `AI_UNAVAILABLE`**? [Coverage, Gap] — **ABERTO**: o caminho de falha está descrito (FR-010, quickstart §4) e a rede é mockada nos testes, mas não há requisito/tarefa explícito de um teste automatizado do caso `AI_UNAVAILABLE`. Coincide com o achado C2 do `/speckit-analyze` (LOW, não-bloqueante).
- [x] CHK018 A escolha do **modelo de IA** (fixo vs configurável) está declarada como requisito/suposição? [Assumption, Spec §Assumptions]

## Notes

- Marque como concluído: `[x]`. Itens não resolvidos indicam ajuste na **spec** (não no código).
- **Resultado da avaliação (2026-07-08)**: 16/18 passam. Os 2 abertos (CHK014, CHK017) são melhorias de
  redação da spec, não defeitos de implementação, e coincidem 1:1 com os achados não-bloqueantes do
  `/speckit-analyze` (A1/C1 = SC-001 "relevantes"; C2 = teste de falha `AI_UNAVAILABLE`). Nenhum é um
  gate CRÍTICO — o único CRÍTICO (D1, emenda da constituição) foi fechado por T035.
- Alinhado ao `/speckit-analyze`: CHK005↔D1 (gate constituição, **fechado**), CHK014↔A1/C1/SC-001,
  CHK017↔C2 (teste de falha).
- Profundidade: **sanidade leve** — só itens de maior impacto por domínio; não é exaustivo.
