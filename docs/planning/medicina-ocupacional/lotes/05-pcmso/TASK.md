# Lote 05 — PCMSO · TASK

> **Status real do lote: não iniciado (BLOQUEADO pela NOB-98).** Nenhuma branch, PR ou migration.
> Responsável pela implementação: Carlos (NOB-109). Tarefas de decisão apenas registram/acompanham.
> [README do lote](README.md) · [PLAN](PLAN.md)

## A. Desbloqueio (acompanhar; não decidir por terceiros)

- [ ] **T05-A1** Acompanhar a resposta completa da pergunta da NOB-98 (A-01, E-01 parcial, D-03), incluindo a ambiguidade "empresa = `companies` ou `orgs`". Aceite: decisão registrada com fonte em [04-DECISOES-E-BLOQUEIOS](../../geral/04-DECISOES-E-BLOQUEIOS.md). Resp.: Carlos (acompanhar) / Expedito, Dr. Alcides, Douglas (decidir). Status: não iniciado.
- [ ] **T05-A2** Acompanhar retarget, CI e merge da PR #112 e a decisão D-02 (efeito da 0055). Resp.: Rikelvin / Douglas. Status: não iniciado.
- [ ] **T05-A3** Acompanhar P1 e P5 ([Lote 03](../03-identidade-e-riscos/TASK.md)). Status: não iniciado.
- [ ] **T05-A4** Registrar A-06 (periodicidade e regras clínicas) e a regra "risco por GES × exame por função". Aceite: regras aprovadas listadas, item a item, com fonte. Resp.: Carlos (registro) / Dr. Alcides. Status: não iniciado.
- [ ] **T05-A5** Propor ao Rikelvin os ajustes do contrato #112 que o PCMSO precisa (função/expostos na captura interna, classificação na externa, fingerprint sem `pgr.updated_at`). Aceite: proposta registrada na NOB-98; nada implementado por fora. Status: não iniciado.

## B. Implementação (só após o desbloqueio)

- [ ] **T05-B1** Migration P6 (`pcmso_programs`, `pcmso_versions`, fontes por versão). Aceite: RLS isolation + `medicine`; FK composta; UNIQUE de vigência e de versão; trigger de imutabilidade; ensaio em Postgres efêmero. Deps.: T05-A1..A3, D-01/D-07. Status: não iniciado.
- [ ] **T05-B2** Domínio de versões (estados A-09) e montagem do snapshot com `source_id`/`entry_id`/fingerprint. Aceite: unit de transições; snapshot determinístico. Deps.: T05-B1. Status: não iniciado.
- [ ] **T05-B3** Verificação transacional de fontes na emissão. Aceite: uma fonte não validada ou desatualizada → emissão recusada e nada gravado. Deps.: T05-B2, P5. Status: não iniciado.
- [ ] **T05-B4** Plano de exames por GES/função com periodicidade aprovada (A-06) e procedimentos (P4). Aceite: só valores dentro das regras aprovadas; testes unit das regras. Deps.: T05-A4, P4. Status: não iniciado.
- [ ] **T05-B5** Server Action + REST + `api-design.md` + Postman. Aceite: os quatro no mesmo PR. Deps.: T05-B2. Status: não iniciado.
- [ ] **T05-B6** Telas `/companies/[id]/pcmso` (etapas fontes → plano → revisão → emissão) com aviso de fonte pendente em rascunho. Aceite: rascunho nunca baixável como documento válido; erro ≠ vazio; 375/768/1440; `_ui`. Deps.: T05-B5. Status: não iniciado.
- [ ] **T05-B7** Template do PCMSO (padrão `scripts/pgr-docx`) e emissão via P7 (`kind: 'pcmso'`). Aceite: documento igual ao snapshot; regressão do PGR verde. Deps.: desenho P7 aprovado ([Lote 04](../04-aso/PLAN.md)). Status: não iniciado.
- [ ] **T05-B8** Evento "fonte desatualizada" para versões emitidas sobre fonte que mudou. Aceite: versão emitida intacta; aviso visível; nova versão exige nova revisão. Deps.: T05-B3. Status: não iniciado.
- [ ] **T05-B9** Assinatura técnica do coordenador (P8). Aceite: `signed` só com assinatura válida ligada ao hash. Deps.: E-07. Status: não iniciado.
- [ ] **T05-B10** Seção de vigilância NTEP a partir do dataset oficial (P2). Aceite: snapshot grava `dataset_id`/`version`; sem dataset ativo, seção omitida com aviso. Deps.: Lista C oficial (Lote 03). Status: não iniciado.

## C. Testes e homologação

- [ ] **T05-C1** Integração em Postgres efêmero: isolation suite, módulo desligado, coordenador sem designação, fonte pendente, fonte alterada após emissão, concorrência de versão. Aceite: executado com `INTEGRATION_*`, nenhuma suite "skipped". Status: não iniciado.
- [ ] **T05-C2** Cenários do [QA](QA.md) com evidências; [REVIEW](REVIEW.md) preenchido. Status: não iniciado.
