# Security & Privacy Checklist: Sugestão de riscos assistida por IA

**Purpose**: Deep-dive de **qualidade dos requisitos** de Segurança & Privacidade para a primeira
feature que **envia dados do tenant para um serviço externo (LLM)**. Cada item avalia se o requisito
está **bem escrito** (completo/claro/consistente/mensurável/coberto) — **não** se o código funciona.
Aprofunda a seção "Segurança & Privacidade" do [review.md](./review.md) (sanidade leve, 5 itens).
**Created**: 2026-07-14
**Evaluated**: 2026-07-14 (10/17 passam; 7 abertos = lacunas de **redação da spec**, não defeitos de implementação)
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md)

## Fronteira de Egresso de Dados & PII

- [x] CHK001 Os campos do GES enviados ao LLM estão definidos como **allowlist** explícita (processo, ambiente, títulos de função), e não apenas por exclusão? [Completeness, Spec §FR-002]
- [x] CHK002 "Dado sensível"/PII está definido com escopo concreto (nome, CPF) em vez de termo vago? [Clarity, Spec §SC-003]
- [ ] CHK003 Existe requisito tratando **PII residual em texto livre** — um nome de funcionário digitado na descrição do processo/ambiente — já que a exclusão declarada cobre só os dados estruturados de `employees`? [Gap, Spec §FR-002] — **ABERTO**: a spec garante não enviar a tabela `employees`, mas não aborda PII que o próprio usuário pode ter digitado nos campos descritivos que são enviados.
- [x] CHK004 Está claro que o que é enviado por função é o **título/cargo** (dimensão), nunca o indivíduo? [Clarity, Spec §FR-002]

## Segredos & Autenticação

- [x] CHK005 A restrição de **chave do LLM somente no servidor** é requisito (§FR-011), não apenas suposição? [Completeness, Spec §FR-011]
- [ ] CHK006 Existe requisito de **redação de segredos e do payload em logs/telemetria** (a chave e o conteúdo enviado ao LLM não podem vazar em logs)? [Gap] — **ABERTO**: a spec não menciona logging; para dado que sai da fronteira, a não-exposição em logs deveria ser requisito explícito.

## Isolamento & Autorização

- [x] CHK007 A verificação de **pertencimento do GES ao tenant antes da chamada externa** está consistente entre os fluxos de sugestão e de aceite? [Consistency, Spec §FR-007 / §SC-007]
- [x] CHK008 A restrição a **papéis de escritório** (client proibido) está declarada para **ambas** as superfícies (ação de servidor e espelho REST)? [Coverage, Spec §FR-014]

## Governança do Provedor & Conformidade

- [ ] CHK009 Existe requisito sobre **retenção/uso dos dados pelo provedor** (não-treinamento, retenção limitada, sub-processadores) para o contexto do tenant que sai da fronteira? [Gap] — **ABERTO**: a spec fixa a chave server-only e o zero-PII estrutural, mas não declara garantias de tratamento do lado do provedor.
- [ ] CHK010 A **base legal/LGPD** para enviar contexto do tenant a um terceiro está referenciada como premissa/dependência? [Gap, Assumption] — **ABERTO**: nenhuma premissa cobre a base legal do compartilhamento com terceiro.

## Saída do Modelo (não-confiável) & Integridade

- [x] CHK011 O descarte de **lote parcialmente inválido** (item malformado / agente fora do conjunto) está especificado, preservando os itens válidos? [Edge Case, Spec §FR-006]
- [ ] CHK012 Existe requisito de **tratar a saída do modelo como não-confiável** — sanitização/escape do texto sugerido antes de exibir e persistir (anti-injeção/XSS via conteúdo do LLM)? [Gap] — **ABERTO**: FR-006 descarta itens _estruturalmente_ inválidos, mas nada exige neutralizar conteúdo _textual_ hostil dentro de um item válido.
- [x] CHK013 O aceite reutilizar o caminho de criação existente garante que riscos por IA passem pelas **mesmas validações** dos manuais (sem bypass de regra)? [Consistency, Spec §FR-015]

## Abuso, Custo & Observabilidade

- [x] CHK014 A **cota mensal por plano** (free finita / pro ilimitada) está quantificada como requisito? [Clarity, Spec §FR-008 / §Assumptions]
- [ ] CHK015 Existe requisito limitando o **tamanho do contexto enviado** (cap de payload) para conter custo/token e abuso (DoS por GES gigante)? [Gap] — **ABERTO**: a cota limita _frequência_ de pedidos, mas não o _tamanho_ de cada um.
- [ ] CHK016 O registro append-only de uso cobre **auditoria/rastreabilidade** (quem pediu), além da contagem de cota (org + tipo + momento)? [Coverage, Gap, Data-model §ai_usage_events] — **ABERTO**: o modelo registra `org/tipo/timestamp`, sem o autor do pedido — insuficiente para trilha de auditoria "quem enviou dado para fora".
- [x] CHK017 O comportamento em **cota esgotada** (bloqueio com mensagem clara; pro sem limite) está especificado sem vazar detalhe interno? [Completeness, Spec §Edge Cases / §FR-008]

## Notes

- Marque concluído com `[x]`. Item aberto indica ajuste na **spec** (redação de requisito), não no código.
- **Resultado da avaliação (2026-07-14)**: 10/17 passam. Os 7 abertos (CHK003, CHK006, CHK009, CHK010,
  CHK012, CHK015, CHK016) são **lacunas de requisito** típicas de "primeiro egresso de dados a um
  terceiro" — PII residual em texto livre, redação em logs, governança/LGPD do provedor, saída
  não-confiável do modelo, cap de payload e granularidade de auditoria. São **melhorias de spec
  não-bloqueantes** para o as-built demonstrável; várias podem já estar tratadas implicitamente no
  código, mas não estão **escritas** como requisito.
- Complementa (não substitui) o `review.md`: aquele é sanidade leve pré-merge; este aprofunda só
  Segurança/Privacidade. Sobreposição intencional: CHK001↔review CHK001; CHK005↔review CHK004;
  CHK007↔review CHK003; CHK011↔review CHK015.
- Prioridade dos abertos, se o time quiser fechar: **CHK003** (PII residual) e **CHK012** (saída
  não-confiável) primeiro — maior impacto de segurança; depois CHK009/CHK010 (LGPD/provedor).
