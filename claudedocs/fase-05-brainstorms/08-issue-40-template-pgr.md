# Issue #40 · Template PDF do PGR

**Objetivo:** primeiro template real — documento do PGR completo (capa customizável,
sumário configurável, GES, inventário de riscos, plano de ação, hierarquia de controles,
cabeçalho ISO) em A4 via Gotenberg. Define o padrão visual dos demais templates.

**Depende de:** #37 (cliente), #88 (cabeçalho ISO), dados consolidados da Fase 03.
**A issue mais "design" da fase — escopo escorregadio; segurar YAGNI.**

## Decisões a cravar

1. **Dependência de dados:** exige a "query consolidada do PGR" (Fase 03) —
   **verificar se foi realmente entregue e em que formato**. Se não existir agregador
   único, a fatia começa criando `getPgrConsolidated(companyId)` no repositório,
   reusando os repos de GES/riscos/plano de ação (sem duplicar regra).
2. **Configuração do documento (decisão de produto):** capa com cor+logo e sumário
   configurável implicam estado —
   - (a) tabela `pgr_document_settings` persistida por empresa/PGR; vs.
   - (b) formulário efêmero no momento da geração.
     A issue não define; cravar no spec.
3. **Logo:** `companies.logo_path` existe como texto, mas **upload nunca foi
   implementado** — "empresa sem logo" será o caso comum; a capa precisa ficar boa sem
   logo. Se o logo entrar: inline como data URI (decisão de assets do #37).
4. **Sumário com nº de página:** página exata só pós-render. MVP recomendado: sumário
   **sem** número de página (só ordem das seções) — `target-counter` do CSS tem suporte
   parcial no Chromium; registrar como limitação.
5. **Cabeçalho ISO repetido (FRM/REV/data — #88):** Gotenberg aceita
   `header.html`/`footer.html` separados no multipart — o "posicionamento
   topo/rodapé/ambos" vira literalmente qual arquivo recebe o fragmento. O cliente #37
   precisa expor esse parâmetro. Reusar o **mesmo componente** do preview do #88 para o
   fragmento — senão o preview mente.
6. **CSS de impressão:** `@page { size: A4; margin }`, `break-inside: avoid` em cards,
   `thead` repetindo nas tabelas longas do inventário. Verificação visual manual contra
   o Chromium do Gotenberg real (padrão do quickstart da 019).

## Testes

- Unit renderizando o template com fixtures: PGR completo, PGR sem riscos, empresa sem
  logo — assertando o HTML (seções presentes/ausentes conforme config).
- PDF binário: verificação manual/e2e (não automatizar pixel-diff no MVP).

## Riscos

- PGR grande (centenas de riscos) → HTML enorme → memória do Gotenberg (liga com o
  sizing do #36).

## Insumos para o /speckit-specify

- **Branch:** `feature/pgr-pdf-template` (da issue)
- **User stories:** (P1) PDF do PGR com capa, sumário e todas as seções; (P2) cabeçalho
  de controle de formulário no documento.
- **Success criteria:** PDF contém riscos, avaliações, plano de ação e hierarquia de
  controles; legível em A4; capa/cabeçalho refletem as configurações.
- **Edge cases:** PGR sem riscos; documento muito extenso; empresa sem logo.
- **Restrições:** reusar a leitura de dados do PGR sem duplicar lógica.
