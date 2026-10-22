# 07 — Critérios de entrega (Definition of Done)

> Documento permanente. Vale para todos os lotes em `../lotes/`. Cada lote copia o checklist geral para o seu
> [TASK.md](../templates/TASK.template.md) / [QA.md](../templates/QA.template.md) e acrescenta o específico (§3).
> Estados de lote: PLANEJADO · EM_EXECUCAO · BLOQUEADO · EM_QA · EM_REVISAO · PR_ABERTA · MERGED · HOMOLOGADO · PUBLICADO.

## 1. Regras de honestidade

1. **Não afirmar PASS sem execução.** Todo PASS cita comando, data, ambiente e saída (ou arquivo de evidência).
2. **Não exigir teste impossível sem registrar o bloqueio.** Se um teste não pode rodar (sem ambiente, sem decisão,
   sem dado), o QA registra **BLOQUEADO + motivo + quem destrava**, e o item não conta como feito.
3. **Não inventar** commit, SHA, PR, data de conclusão ou aprovação.
4. **MERGED ≠ HOMOLOGADO ≠ PUBLICADO.**
   - MERGED: PR integrada em `develop` (o CD aplicou o que houver de migration em homologação).
   - HOMOLOGADO: validado em homologação por quem o lote define (com evidência).
   - PUBLICADO: release `develop → main` concluído e conferido em produção.
5. Suíte de integração que saiu **"skipped"** por falta de `INTEGRATION_*` **não é PASS**.

## 2. DoD geral (todo lote com código)

- [ ] **Requisito rastreável**: cada item liga a issue do Linear, linha MED-xx da [GAP-MATRIX](../GAP-MATRIX.md) e/ou decisão
- [ ] **Implementação completa** do escopo do PLAN (nada "depois" sem registro no TASK)
- [ ] **Permissões**: gate de papel, tenant, empresa e módulo verificados no servidor **e** no banco quando houver tabela
- [ ] **Regras permanentes de segurança clínica** (S-01…S-13 de [05](05-SEGURANCA-E-DADOS.md) §2) conferidas
- [ ] **Migrations**, se houver: checklist de [06](06-GIT-MIGRATIONS-CD.md) §3.4 completo; uma por PR; aditiva
- [ ] **4 superfícies** do CLAUDE.md para todo CRUD/HTTP (Action + REST + `api-design.md` + Postman)
- [ ] **Unit**: regras de domínio, zod, helpers, estados de UI (vazio/erro/loading)
- [ ] **Integração** em Postgres efêmero (`INTEGRATION_DATABASE_URL`), **sem suíte skipped**: cross-tenant, módulo desligado, `FORBIDDEN`, `NOT_FOUND`, constraints
- [ ] **Isolamento**: `runIsolationSuite` para **toda tabela nova**
- [ ] **Chrome DevTools**: console sem erro e rede sem 4xx/5xx inesperado nas telas tocadas (evidência no QA)
- [ ] **Playwright** (projeto `protected`, local) para a jornada do lote, com dados fictícios
- [ ] **Revisão de código** por subagente independente (registrada no REVIEW)
- [ ] **QA** executado e registrado com evidências
- [ ] **Documentação** do lote atualizada: TASK, WALKTHROUGH, QA, REVIEW (+ [08-HANDOFF](08-HANDOFF.md) pelo coordenador)
- [ ] **`npm run check`** verde localmente
- [ ] **CI verde** na PR (base `develop`)
- [ ] **PR revisável**: descrição com escopo, fora de escopo, migrations, riscos, como testar
- [ ] **Aprovação** registrada
- [ ] **Merge com autorização** explícita
- [ ] **Homologação**, quando aplicável, com evidência e responsável

Lote só de documentação/decisão (Lote 0): valem rastreabilidade, documentação, revisão e aprovação; o resto é N/A
com justificativa.

## 3. DoD específica por lote

### Lote 00 — Alinhamento e contratos

- [ ] Pergunta da NOB-98 com respostas registradas por item (hoje **PARCIALMENTE_RESPONDIDA**; ver [04](04-DECISOES-E-BLOQUEIOS.md))
- [ ] Ambiguidade "empresa-cliente × escritório" resolvida por escrito
- [ ] Ordem de merge da #112 × migrations de Medicina decidida (D-01) e efeito da 0055 aceito ou recusado (D-02)
- [ ] Dono da identidade profissional decidido (D-03); NOB-111 reescopada ou não (D-04)
- [ ] Divergências Linear × GitHub resolvidas por quem tem autoridade ([09](09-LINEAR-E-RESPONSAVEIS.md) §4)
- [ ] Nenhuma ação no Linear sem autorização

### Lote 01 — Ficha de saúde ocupacional (NOB-108), zero migration

- [ ] Nenhuma migration, tabela ou policy nova (`git diff` sem `src/shared/db/migrations`)
- [ ] `/medicine` mostra só empresas com Medicina, com contagens reais; estado vazio diferente para owner e colaborador
- [ ] Seção "Saúde ocupacional" em `/employees/[id]` só com Medicina habilitada na empresa do funcionário
- [ ] Validade **informada** (`valid_until`); nenhuma periodicidade 12/24 calculada
- [ ] Erro ≠ vazio em `/medicine`, `/health-exams`, `/medicos` (teste de UI do estado de erro)
- [ ] Filtro `employeeId`/`companyId` sem vazamento entre empresas do mesmo escritório nem entre tenants (404)
- [ ] `GET /api/v1/medicine/overview` + Action + api-design + Postman; filtro novo em `GET /api/v1/health-exams`
- [ ] Busca e paginação de funcionários no servidor (fim do limite de 200)
- [ ] Teal só se o Douglas aprovar o token (D-09); caso contrário, sem teal
- [ ] Critério de demonstração do [FIRST-MVP](../FIRST-MVP.md) §9 executado em ambiente de teste

### Lote 02 — Formulários e auditoria (NOB-112)

- [ ] Mapa campo → entidade → documento das abas do protótipo entregue
- [ ] Ordem e número de migration acordados antes de gerar (D-01/D-07)
- [ ] Procedimentos por exame **sem valores de resultado** (S-07)
- [ ] `health_exams.company_id` preserva a empresa da data do exame (teste de transferência de funcionário)
- [ ] Trilha clínica append-only na mesma transação; sem conteúdo clínico; rollback testado; revisão do Rikelvin (R-05)
- [ ] Arquivamento só após decisão de prazo de guarda (A-07); sem decisão, fica fora e registrado como BLOQUEADO
- [ ] Enum próprio de tipo de exame só com decisão D-13 (impacto em `service_orders`)

### Lote 03 — Identidade e riscos (NOB-121, NOB-111, NOB-113 + integração NOB-98)

- [ ] Só começa a parte de identidade com a decisão completa de autorização (E-01/A-01) e o dono (D-03)
- [ ] Profissional sem designação vigente é recusado no servidor **e** no banco
- [ ] Nenhuma validação em nome de terceiro; owner/colaborador não validam por papel
- [ ] NOB-111 implementada **sobre** a #112 (sem segundo contrato de PGR externo); externo nunca nasce validado
- [ ] Lista C só com fonte oficial confirmada (A-02); importador idempotente; base do protótipo só como teste de regressão

### Lote 04 — ASO (NOB-110)

- [ ] Desenho da camada de emissão aprovado pelo Douglas (D-06); pipeline reaproveitado, não reconstruído
- [ ] Campos obrigatórios e emissor definidos (A-03, A-05)
- [ ] Snapshot imutável: retry do job não muda o documento; dado alterado após a emissão não muda o arquivo
- [ ] Sem provedor ICP-Brasil, o ASO sai como **"emitido, sem assinatura técnica"**
- [ ] Ciência do trabalhador ligada ao arquivo emitido e nunca apresentada como assinatura técnica
- [ ] Seção de riscos só com fonte validada ou decisão explícita (A-04)

### Lote 05 — PCMSO (NOB-109)

- [ ] NOB-98 completa (fontes mergeadas, validador definido, revisão implementada)
- [ ] Emissão bloqueada se alguma fonte usada não estiver validada no momento
- [ ] Versão emitida não muda quando a fonte muda; nova versão exige nova revisão
- [ ] Seção de vigilância NTEP só com a Lista C oficial

### Lote 06 — Clínicas e portais (NOB-121, NOB-122, NOB-123)

- [ ] Decisão de perfis e portais (E-02) registrada antes de qualquer código
- [ ] Escopo por empresa aplicado no servidor e na RLS antes de qualquer acesso externo
- [ ] Empresa/RH vê só conclusão; clínica vê só os próprios encaminhamentos (roteiro `portal.py` como casos de aceite)

### Lote 07 — Homologação (NOB-128, NOB-129, NOB-130)

- [ ] Responsável pelas issues definido
- [ ] Ambiente de homologação com dados fictícios e autorização para criar dados
- [ ] E2E ponta a ponta executado e registrado; restrições de download verificadas no servidor
- [ ] Estado final declarado separadamente: MERGED, HOMOLOGADO, PUBLICADO
