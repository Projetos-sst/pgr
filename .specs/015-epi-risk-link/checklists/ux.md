# Checklist: Qualidade dos requisitos de UX do vínculo

**Purpose**: Validar se os requisitos de experiência (busca, tela de edição vs criação, estados
vazio/N.A., feedback de erro) estão completos, claros e cobrem os fluxos e edge cases.
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md) · **Foco**: UX da seção `EpiRiscoSection`

## Requirement Completeness

- [ ] CHK001 - As colunas da tabela de EPIs vinculados estão especificadas (Nome · CA · Neutraliza os Riscos? · Remover)? [Completeness, Spec §FR-004]
- [ ] CHK002 - O requisito de onde a seção aparece (tela de **edição**, não de criação) e o fluxo cria-depois-vincula estão documentados? [Completeness, Spec §FR-011]
- [ ] CHK003 - Os requisitos de estado de carregamento/pendência durante add/update/remove estão definidos? [Gap]
- [ ] CHK004 - Há requisito de como os erros (`DUPLICATE`, validação) são apresentados ao usuário na seção? [Gap]

## Requirement Clarity

- [ ] CHK005 - O comportamento da busca de EPI disponível (por **nome OU CA**) está claro quanto aos campos pesquisados? [Clarity, Spec §FR-006]
- [ ] CHK006 - A distinção entre "risco sem nenhum EPI" (estado vazio) e "EPI vinculado com Não Aplicável" está explícita na UX? [Clarity, Spec §FR-008 + Edge Cases]
- [ ] CHK007 - O mapeamento dos rótulos do enum (Sim/Não/Não Aplicável) está especificado para exibição? [Clarity, data-model.md]

## Scenario & Edge Case Coverage

- [ ] CHK008 - Há requisito de que, após vincular, o EPI sai da lista de "disponíveis" e entra em "vinculados" (e vice-versa ao remover)? [Coverage, Spec §US3]
- [ ] CHK009 - O fallback de exibição para EPI **sem CA** ("—") está especificado? [Edge Case, Spec Edge Cases]
- [ ] CHK010 - A lista de disponíveis exclui os já vinculados e restringe a itens `type = 'epi'` — isso está declarado como requisito de UX, não só de repositório? [Coverage, Spec §FR-006]

## Non-Functional

- [ ] CHK011 - Requisitos de acessibilidade dos selects (rótulos, navegação por teclado) estão especificados? [Gap, Accessibility]
- [ ] CHK012 - A ausência de tempo-real/polling (recarrega após cada mutação) é uma decisão de UX declarada? [Clarity, contracts §UI]
