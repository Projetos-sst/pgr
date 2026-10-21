# Lote 06 — Profissionais, clínicas e portais · TASK

> **Status real do lote: não iniciado (BLOQUEADO pelo escopo de portais — Expedito).** Nenhuma branch, PR ou migration.
> Responsável pela implementação: Carlos (NOB-121, NOB-122, NOB-123). A identidade profissional da NOB-121 está em
> [Lote 03 · TASK](../03-identidade-e-riscos/TASK.md) e não é repetida aqui.
> [README do lote](README.md) · [PLAN](PLAN.md)

## A. Decisões (registrar e acompanhar)

- [ ] **T06-A1** Registrar E-02: quais perfis e portais entram na V1 (RH, clínica, trabalhador). Aceite: resposta registrada com fonte; blocos 6.7/6.8 marcados como dentro ou fora. Resp.: Carlos (registro) / Expedito. Status: não iniciado.
- [ ] **T06-A2** Registrar E-01 parte "profissional externo" (clínica parceira pode ter login?). Resp.: Expedito. Status: não iniciado.
- [ ] **T06-A3** Acompanhar D-05 (A/B/C) e D-12 (MFA). Resp.: Douglas. Status: não iniciado.
- [ ] **T06-A4** Propor modelagem de psicólogos (`medicos` estendido × `health_professionals`) para decisão. Aceite: proposta com prós/contras registrada; decisão do Douglas. Resp.: Carlos. Status: não iniciado.
- [ ] **T06-A5** Esclarecer o escopo da NOB-123 com o Douglas (roteiro de jornadas × porte de código) e propor reescopo se necessário. Status: não iniciado.

## B. Implementação (cada item só após as condições do [PLAN §2](PLAN.md))

- [ ] **T06-B1** Psicólogos/profissionais externos (6.1). Aceite: CRUD com Action + REST + api-design + Postman; registro + UF únicos por escritório; testes de isolamento. Deps.: P1, T06-A4. Status: não iniciado.
- [ ] **T06-B2** Clínicas (6.2). Aceite: idem; exclusão bloqueada com encaminhamento aberto (se confirmado). Deps.: T06-A1. Status: não iniciado.
- [ ] **T06-B3** Vínculo empresa ↔ clínica (6.3). Aceite: vigência e revogação com ator e motivo; evento append-only. Deps.: T06-B2. Status: não iniciado.
- [ ] **T06-B4** Encaminhamentos e guia (6.4). Aceite: transições só por domínio; guia gerada via camada de emissão; clínica não vinculada → recusa. Deps.: T06-B3, [Lote 04](../04-aso/TASK.md). Status: não iniciado.
- [ ] **T06-B5** Agendamento (6.5), avaliando reuso de `schedule_events`. Aceite: data passada recusada; decisão de reuso registrada. Deps.: T06-B4. Status: não iniciado.
- [ ] **T06-B6** Escopo por empresa/clínica no servidor e na RLS (contexto de papel na transação). Aceite: RH de A não vê B; clínica não vê trabalhador de empresa não vinculada — provado no banco, não só na UI. Deps.: D-05, E-02. Status: não iniciado.
- [ ] **T06-B7** Portal da clínica (6.7), se confirmado. Deps.: T06-B6. Status: não iniciado.
- [ ] **T06-B8** Portal da empresa/RH (6.8), se confirmado. Aceite: só conclusão do ASO conforme A-03; nenhum prontuário. Deps.: T06-B6, A-03. Status: não iniciado.
- [ ] **T06-B9** Resultados clínicos (6.6) na camada clínica. Aceite: papel clínico + auditoria de leitura + schema separado (se B); nunca visível a RH. Deps.: D-05, P9, A-03. Status: não iniciado.

## C. Testes e homologação

- [ ] **T06-C1** Integração em Postgres efêmero com a matriz de perfis (cenários do [QA](QA.md)). Aceite: executado com `INTEGRATION_*`, nada "skipped". Status: não iniciado.
- [ ] **T06-C2** E2E protected das jornadas J-01/J-02 usando `portal.py` só como roteiro. Status: não iniciado.
- [ ] **T06-C3** [REVIEW](REVIEW.md) preenchido. Status: não iniciado.
