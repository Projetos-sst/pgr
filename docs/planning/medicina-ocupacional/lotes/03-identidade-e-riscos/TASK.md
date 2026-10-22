# Lote 03 — TASK

> **Status real: BLOQUEADO (parcial). Nenhuma tarefa iniciada.** Sem branch, PR ou migration. Nenhuma permissão será concedida
> antes das decisões. Responsável padrão: Carlos; a validação técnica (3b) é do Rikelvin. [README](README.md) · [PLAN](PLAN.md)

## A. Decisões (acompanhar; não decidir por terceiros)

- [ ] **T03-A1** MED-DEC-02 ("empresa" = empresa-cliente ou escritório; quem indica). Aguardando: **Expedito**.
- [ ] **T03-A2** MED-DEC-03 (autorizador valida? categorias). Aguardando: **Dr. Alcides**.
- [ ] **T03-A3** MED-DEC-04 (dados mínimos, comprovação, Clerk ↔ profissional). Aguardando: **Douglas + Rikelvin**, após A1/A2.
- [ ] **T03-A4** MED-DEC-05 (externos). Aguardando: **Expedito**.
- [ ] **T03-A5** MED-DEC-06 (escopo, revogação, validações anteriores). Aguardando: **Dr. Alcides + Expedito**.
- [ ] **T03-A6** MED-DEC-07 (nota e motivo). Aguardando: **Dr. Alcides**.
- [ ] **T03-A7** MED-DEC-10 (dono da identidade; reescopo da NOB-111). Aguardando: **Douglas**.
- [ ] **T03-A8** MED-DEC-13 (Lista C: significado, fonte, versão, classe × subclasse). Aguardando: **Dr. Alcides**.
- Critério de aceite comum: resposta literal + fonte + data registradas pelo coordenador no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md).

## B. Pode ser feito sem desbloquear (documental)

- [ ] **T03-B1** Proposta técnica de P1 (documento) com as opções I/II/III do PLAN §2.2 e o desenho §2.3, para revisão de Douglas e
      Rikelvin.
  - Critério de aceite: documento revisado; nenhuma migration criada. Responsável: Carlos. Dependências: A1 e A2 (para fechar a proposta;
    o rascunho pode começar). Status: não iniciado.
- [ ] **T03-B2** Levar ao Rikelvin as propostas de rastreabilidade do PLAN §5.
  - Critério de aceite: aceite ou recusa do Rikelvin registrados por item. Responsável: Carlos. Dependências: nenhuma. Status: não iniciado.
- [ ] **T03-B3** Rascunho da UX do PGR externo (NOB-111 reescopada), no padrão `_ui`, sem código.
  - Critério de aceite: fluxo e telas descritos; aprovado pelo Carlos. Dependências: A7 (reescopo). Status: não iniciado.

## C. Implementação (bloqueada)

- [ ] **T03-C1** P1 identidade + designação (migration + repositório + actions/REST/docs/Postman + testes).
      Dependências: A1–A5, A7, MED-DEC-08, T03-B1 aprovado. Status: não iniciado.
- [ ] **T03-C2** Apoio à P5 (revisão de riscos) do Rikelvin: testes de integração do lado da Medicina.
      Dependências: T03-C1, #112 mergeada, A6, decisão R-02 do Rikelvin. Responsável: Rikelvin (dono) + Carlos (apoio). Status: não iniciado.
- [ ] **T03-C3** PGR externo sobre a #112 (UX + documento no GED). Dependências: #112 mergeada, A7, T03-B3, regra de acesso do GED com o
      Douglas. Status: não iniciado.
- [ ] **T03-C4** Lista C: datasets globais + importador idempotente. Dependências: A8, MED-DEC-08. Status: não iniciado.
- [ ] **T03-C5** Pedir ao Douglas a remoção da dependência NOB-110 → NOB-113 se A8 confirmar NTEP (D-10). Aguardando: A8.

## D. Fechamento (por PR)

- [ ] **T03-D1** Review, QA, PR, CI, aceite, merge **com autorização** e homologação, no formato do
      [TASK do Lote 01](../01-ficha-saude-ocupacional/TASK.md) itens 14–20. Status: não iniciado.
