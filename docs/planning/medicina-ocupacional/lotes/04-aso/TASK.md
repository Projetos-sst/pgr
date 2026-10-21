# Lote 04 — ASO · TASK

> **Status real do lote: não iniciado.** Nenhuma tarefa começou; nenhuma branch, PR ou migration existe.
> Responsável pela implementação: Carlos (NOB-110). Tarefas de decisão apenas **registram** perguntas; quem decide está indicado.
> [README do lote](README.md) · [PLAN](PLAN.md)

## A. Decisões (registrar e acompanhar; não decidir por terceiros)

- [ ] **T04-A1** Registrar A-03 (campos obrigatórios; conclusão × dado sigiloso; destino de `notes`).
  Aceite: pergunta registrada no canal oficial com destinatário Dr. Alcides; resposta (ou ausência) refletida em [04-DECISOES-E-BLOQUEIOS](../../geral/04-DECISOES-E-BLOQUEIOS.md). Resp.: Carlos (registro). Deps.: autorização do Carlos para escrever no Linear (C-02). Status: não iniciado.
- [ ] **T04-A2** Registrar A-04 (ASO pode listar riscos não validados?). Aceite: idem. Resp.: Carlos. Status: não iniciado.
- [ ] **T04-A3** Registrar A-05 (quem emite) e A-09 (estados e snapshot). Aceite: idem. Resp.: Carlos. Status: não iniciado.
- [ ] **T04-A4** Pedir ao Douglas a decisão D-06 (camada de emissão) e marcar sessão de desenho P7. Aceite: desenho aprovado registrado no [PLAN](PLAN.md) com data e fonte. Resp.: Carlos (pedido) / Douglas (decisão). Status: não iniciado.
- [ ] **T04-A5** Acompanhar E-07 (provedor ICP-Brasil). Aceite: provedor e modalidade registrados, ou 4d mantido fora. Resp.: Expedito + Douglas. Status: não iniciado.
- [ ] **T04-A6** Pedir remoção da relação NOB-110 → NOB-113 se A-02 confirmar "Lista C" = NTEP (D-10). Resp.: Douglas. Status: não iniciado.

## B. Pré-requisitos de outros lotes (só acompanhar)

- [ ] **T04-B1** P1 identidade + designação mergeada ([Lote 03](../03-identidade-e-riscos/TASK.md)). Status: não iniciado.
- [ ] **T04-B2** P4 procedimentos e P9 auditoria clínica mergeadas ([Lote 02](../02-formularios-e-auditoria/TASK.md)). Status: não iniciado.

## C. Implementação 4a — formulário definitivo e prévia

- [ ] **T04-C1** Schema zod do ASO com campos obrigatórios aprovados (A-03) e testes unitários. Aceite: cada campo obrigatório ausente → `VALIDATION`; testes unit verdes. Deps.: T04-A1. Status: não iniciado.
- [ ] **T04-C2** Histórico de função (P3) — migration + repositório + backfill idempotente. Aceite: período sobreposto recusado; backfill reexecutado sem efeito; isolation suite. Deps.: D-01/D-07. Status: não iniciado.
- [ ] **T04-C3** Formulário em `/health-exams/[id]` com procedimentos (P4) e médico selecionado da lista (não digitado). Aceite: rótulos acessíveis em linhas repetíveis; erro ≠ vazio; 375/768/1440 sem rolagem horizontal. Deps.: T04-B2, T04-C1. Status: não iniciado.
- [ ] **T04-C4** Prévia do documento com faixa "PRÉVIA — sem validade legal" e sem estado de emissão. Aceite: impossível confundir com ASO emitido (texto, não só cor). Deps.: T04-C3. Status: não iniciado.

## D. Implementação 4b — emissão com snapshot

- [ ] **T04-D1** Migration P7 conforme desenho aprovado pelo Douglas. Aceite: RLS isolation + módulo por `kind`; sem DELETE; trigger de imutabilidade; ensaio em Postgres efêmero. Deps.: T04-A4. Status: não iniciado.
- [ ] **T04-D2** Domínio de emissão (máquina de estados A-09, snapshot canônico + `snapshot_sha256`). Aceite: unit de transições válidas/inválidas; snapshot determinístico. Deps.: T04-A3, T04-D1. Status: não iniciado.
- [ ] **T04-D3** Server Action `officeAction` + mirror REST (`restHandler`) + `api-design.md` + Postman. Aceite: os quatro itens da superfície obrigatória no mesmo PR; 201 na emissão. Deps.: T04-D2. Status: não iniciado.
- [ ] **T04-D4** Template DOCX do ASO por script (padrão `scripts/pgr-docx`) e `kind: 'aso'` no worker, renderizando do snapshot com `upsert:false`. Aceite: retry não altera snapshot; `output_sha256` confere; regressão do PGR verde. Deps.: T04-D1, aceite do Douglas. Status: não iniciado.
- [ ] **T04-D5** Retificação e cancelamento com motivo e ator. Aceite: emissão anterior continua consultável; cancelamento sem motivo → `VALIDATION`. Deps.: T04-D2. Status: não iniciado.
- [ ] **T04-D6** Download autorizado e auditado do ASO emitido. Aceite: cross-tenant → 404 sem assinar path; empresa sem `medicine` → bloqueado; evento de auditoria gravado. Deps.: T04-D4, P9. Status: não iniciado.

## E. Implementação 4c/4d — ciência e assinatura técnica

- [ ] **T04-E1** Registry `aso` em `signatures/contract.ts` para ciência do trabalhador, com `document_sha256` se aprovado. Aceite: ciência ligada ao arquivo emitido; textos da UI dizem "ciência", nunca "assinatura do médico". Deps.: T04-D4. Status: não iniciado.
- [ ] **T04-E2** Migration P8 + integração com provedor (mock em teste). Aceite: estado `signed` só com assinatura válida ligada ao `output_sha256`; sem provedor, estado máximo "emitido, sem assinatura técnica". Deps.: T04-A5. Status: não iniciado.

## F. Seção de riscos

- [ ] **T04-F1** Bloco de riscos lido só de `medical_risk_*` conforme A-04 (validados, ou não validados com aviso). Aceite: nenhuma leitura direta de `risks`; risco alterado após a emissão não muda o documento. Deps.: T04-A2, NOB-98 (P5). Status: não iniciado.

## G. Testes e homologação

- [ ] **T04-G1** Integração em Postgres efêmero para cada tabela/rota nova (`runIsolationSuite`, módulo desligado, emissor sem designação, UPDATE/DELETE proibidos). Aceite: suites executadas com `INTEGRATION_*` definidas e nenhuma "skipped". Status: não iniciado.
- [ ] **T04-G2** Cenários do [QA](QA.md) executados e evidências registradas; [REVIEW](REVIEW.md) preenchido. Status: não iniciado.
