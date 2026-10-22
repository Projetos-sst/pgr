# Lote 07 — Homologação · TASK

> **Status real do lote: não iniciado.** NOB-128/129/130 sem responsável no Linear. Nenhuma execução.
> [README do lote](README.md) · [PLAN](PLAN.md)

## A. Organização

- [ ] **T07-A1** Pedir ao Douglas um responsável para NOB-128/129/130. Aceite: responsável registrado no Linear e em [02-ROADMAP-E-STATUS](../../geral/02-ROADMAP-E-STATUS.md). Resp.: Carlos (pedido) / Douglas. Status: não iniciado.
- [ ] **T07-A2** Escrever o critério de saída HOMOLOGADO e PUBLICADO (README deste lote) e acordar com Douglas e Expedito. Status: não iniciado.
- [ ] **T07-A3** Definir o formato do registro de validação clínica (Dr. Alcides) e de produto (Expedito). Status: não iniciado.

## B. Camada contínua (acompanha os lotes)

- [ ] **T07-B1** Seed fictício de Medicina (`medicos`, `health_exams`, `company_modules`) no padrão de `pgr-seed.ts`. Aceite: nenhum dado real; usado pelas suites dos lotes. Deps.: [Lote 01](../01-ficha-saude-ocupacional/TASK.md). Status: não iniciado.
- [ ] **T07-B2** `runIsolationSuite` para `medicos`, `health_exams`, `company_modules` e cada tabela nova de saúde. Aceite: 6 asserções verdes por tabela. Status: não iniciado.
- [ ] **T07-B3** Rotina de verificação "skipped = 0" nas execuções de integração. Aceite: evidência anexada ao QA de cada lote. Status: não iniciado.

## C. Ponta a ponta

- [ ] **T07-C1** (NOB-128) E2E protected: CNPJ → empresa → Medicina habilitada → funcionário → exame → ASO. Aceite: roda localmente e (se decidido) no CI; datas relativas. Deps.: [Lote 04](../04-aso/TASK.md). Status: não iniciado.
- [ ] **T07-C2** (NOB-128) Estender a jornada ao PCMSO. Deps.: [Lote 05](../05-pcmso/TASK.md) (bloqueado pela NOB-98). Status: não iniciado.
- [ ] **T07-C3** (NOB-129) Geração, visualização, download autorizado e restrições de documentos. Aceite: download cross-tenant → 404; restrição aplicada no servidor. Deps.: Lote 04. Status: não iniciado.
- [ ] **T07-C4** (NOB-130) Validação das integrações (contrato PGR → Medicina, clínicas/portais confirmados) e roteiro de treinamento. Deps.: NOB-98, [Lote 06](../06-clinicas-e-portais/TASK.md). Status: não iniciado.

## D. Transversais

- [ ] **T07-D1** Regressão do PGR (GED, DOCX, riscos) e das rotas que leem `risks` após a 0055. Status: não iniciado.
- [ ] **T07-D2** Responsividade 375/768/1440 nas telas de Medicina. Status: não iniciado.
- [ ] **T07-D3** Acessibilidade: contraste AA, `aria-live`, rótulos, foco, alvos ≥ 44px. Status: não iniciado.
- [ ] **T07-D4** Conferir `api-design.md` + Postman contra as rotas entregues. Status: não iniciado.

## E. Publicação

- [ ] **T07-E1** Inventário de migrations em `develop` ausentes em `main`. Status: não iniciado.
- [ ] **T07-E2** Ensaio do lote de migrations em cópia da produção. Aceite: resultado registrado; nenhuma falha. Resp.: Douglas (ambiente). Status: não iniciado.
- [ ] **T07-E3** Checklist pós-deploy de produção. Aceite: só após o run do CD em `main` com sucesso e smoke registrado o lote vira PUBLICADO. Status: não iniciado.
