# Auditoria de retomada — Medicina Ocupacional · 14/11/2026

> Auditoria da `develop` em `53c75d6` (merge da #171), feita por leitura de código, testes e Linear.
> As correções têm PR própria; nenhum merge foi feito. Responsável pela frente e pelos merges: Carlos.
> Documentos anteriores: `HANDOFF-MEDICINA-2026-11-09.md` e `SINTESE-EXECUTIVA-MEDICINA-2026-11-09.md`.

## Camada 1 — Resumo executivo

### Situação em uma linha

O código da Medicina está entregue e testado para o escopo definido. A auditoria achou **um defeito de segurança fora de produção** e **telas que escondiam falhas de leitura**. Os dois já têm PR. Nada está homologado nem pronto para produção.

### Números

| Item | Quantidade |
|---|---|
| Issues auditadas | 7 (NOB-158, 159, 121, 123, 122, 120, 162) |
| Prontas para Done | 0 |
| Parciais (código entregue, falta homologação ou decisão) | 5 (158, 159, 121, 123, 162) |
| Bloqueadas por dependência ou decisão | 2 (122, 120) |
| Defeitos confirmados (P1) | 2 |
| Defeitos corrigidos em PR | 2 P1, mais 1 menor (menu) |
| Lacunas P2 registradas, sem correção nesta rodada | 9 |

### Defeitos encontrados e corrigidos

1. **P1, segurança fora de produção (NOB-158), PR #173.**
   - **Defeito:** as rotas REST do operador de identidade (`/api/v1/admin/identity-verifications/**`) não exigiam master. A tela e as Server Actions já exigiam master **e** designação no banco.
   - **Com o bypass dev ligado** (homologação ou local), a conta do operador vinha de um header forjável. Por isso, dava para gravar uma verificação no banco compartilhado.
   - **Em produção:** a designação no banco continuava barrando quem não foi designado. Faltava a camada de master documentada.
   - **Correção:** `requireMaster()` nas três rotas. Com o bypass, o código de controle da conta não sai pela REST.
2. **P1, telas que escondiam falhas (NOB-123), PR #174.**
   - **ASO e PCMSO:** uma consulta que falhava aparecia como "nenhum registro". A frase "Nenhum ASO assinado registrado. Até lá, o exame não tem ASO oficial." aparecia mesmo quando a leitura tinha falhado.
   - **Prévia do PCMSO:** a conferência que falhou liberava o botão de gerar a prévia. O servidor confere de novo, mas a tela enganava.
   - **Correção:** cada seção avisa a falha e não oferece registro às cegas.
3. **Menor, menu.** "Minha identidade profissional" só era alcançada por um link dentro da edição do médico. Entrou no menu da Medicina (PR #174).

**Testes:**
- **Antes de cada correção:** os testes novos falham.
- **Depois:** passam.
- **`npm run check` local:**
  - #173: 2390 testes unitários, mais a suíte de integração `professional-identity` (12/12) em Postgres efêmero;
  - #174: 2395 testes unitários.
- **CI oficial:** ver PRs.

### O que pode ser demonstrado

Só em ambiente local ou de homologação, com dados fictícios. O roteiro é **proposto, não validado em navegador**; veja a seção 4.

- **Cadastros base:** empresas com Medicina, funções, GES, funcionários e profissionais de saúde (CRM ou CRP, UF, RQE, interno ou externo).
- **Exames ocupacionais:** procedimentos pela Tabela 27, riscos validados de PGR interno ou externo, inexistência de riscos declarada por GES e função.
- **Proposta de exames e plano:** o rascunho, sim. A aprovação exige coordenador com identidade verificada.
- **Conferência do PCMSO e do ASO, prévias imutáveis com SHA-256, histórico de versões.**
- **Registro do documento assinado fora do sistema e entrega do ASO com conferência do comprovante:** explicados ou demonstrados com ASO de clínica externa (fluxo B).

**Atos clínicos não demonstráveis hoje:** aprovar o plano, registrar o ASO pelo examinador, abrir o prontuário. Todos exigem um operador de identidade provisionado no banco (NOB-162), e ele ainda não existe na homologação.

### O que falta para a reunião

- Merge das PRs #173 e #174 pelo Carlos, depois do CI verde.
- Decidir se a demonstração vai mostrar atos clínicos. Se for, falta provisionar um operador e um master fictícios num ambiente autorizado. Hoje esse provisionamento é feito só pelo dono do banco, fora do app.
- Validar o roteiro em navegador. Isso não foi feito nesta rodada: os servidores MCP de navegador não conectaram e o dev server não estava ligado.
- **Perguntas a levar:**
  - "dois verificadores": são duas aprovações por verificação ou um grupo de dois operadores?
  - validade de 12 meses: o teto técnico hoje é 36;
  - CRM alterado e depois restaurado;
  - NOB-122 e NOB-120: as perguntas estão na seção 3.

## Camada 2 — Matriz por issue

Legenda de "Pode corrigir agora?": **Sim** = corrigido nesta rodada; **Não, decisão** = depende de decisão de produto ou clínica; **Não, homologação** = depende de acesso ou operação na homologação; **Não, terceiros** = depende de outra equipe ou fornecedor.

### NOB-158 — Verificação independente da identidade médica

| Campo | Conteúdo |
|---|---|
| Status Linear | In Review (Carlos) |
| Requisito | Verificação independente do owner; conta alternativa barrada; verificação registrada; testes de bypass no servidor e no SQL |
| Implementado | Predicado `actor_clinical_medico_ids` (0071) exigido no app e na RLS em todos os caminhos clínicos: prontuário, restrições, trilha, nota clínica de afastamento, conclusão do examinador, ASO assinado no fluxo A, aprovação e itens do plano, critérios, relatório analítico e PCMSO assinado pelo coordenador |
| Implementado (verificação) | Vínculo por convite, verificação não vencida e não revogada, CRM/UF iguais ao cadastro, profissional ativo e médico |
| Implementado (papéis) | `app_runtime` não escreve verificação. O papel `identity_verifier` exige operador designado, fora do escritório e que não seja a própria conta; desafio HMAC com limites (0072). O owner não tem competência clínica pelo papel |
| Faltando | Provisionamento real (papel de login, segredos, operadores designados); teste E2E na homologação; definir "dois verificadores" (hoje é um só `verified_by`) |
| Faltando (P2) | Teto de validade de 36 meses contra a decisão de 12; CRM que muda e volta restaura a verificação antiga; CRM reformatado ("90001" para "90.001") corta o acesso (falha fechada); a string `IDENTITY_VERIFIER_DATABASE_URL` é a raiz de confiança e o `app.current_actor` é definido pelo app; recusar depois de aprovar não tem efeito (só a revogação corta) |
| Evidência no código | `src/shared/db/migrations/0071_professional_identity_verifications.sql`, `0072`, `0080`, `0081`; `src/shared/server/medicine/identity-verification-core.ts`; `src/app/api/v1/admin/identity-verifications/**` |
| Teste | `integration/medicine/professional-identity.test.ts` (12 casos, incluindo conta alternativa, segundo owner, operador membro e autoverificação, revogação, expiração, CRM alterado e REST com master); `coordinator-permission-in-force.test.ts`; `clinical-records.test.ts` |
| Lacunas de teste | Negativos de identidade não verificada ainda faltam para: nota de afastamento, conclusão do examinador, relatório analítico e itens do plano (core e SQL); troca de UF e de categoria depois da verificação |
| Depende de terceiros | Operadores reais (decisão do Carlos); credencial do banco de homologação |
| Pode corrigir agora? | **Sim**, o P1 da REST. Não, decisão: teto de 12 meses e CRM restaurado. Não, homologação: provisionamento |
| Correção feita | REST do operador exige master pela sessão real; código de controle não sai com o bypass |
| Status recomendado | **Manter In Review**. Não marcar Done sem homologação e evidência real |
| PR ou commit | #173 |

### NOB-159 — Vínculos médicos legados

| Campo | Conteúdo |
|---|---|
| Status Linear | In Review (Carlos) |
| Requisito | Vínculos anteriores à 0069 (`invitation_id` nulo) preservados, com efeito clínico só depois de verificação e reconfirmação pela própria conta |
| Implementado | Nenhum vínculo legado novo (a inclusão exige convite, 0069/0071); acesso só com verificação **e** reconfirmação (RLS 0071 e `professional-identity.ts`); nada é excluído (sem DELETE; UPDATE só nas colunas de revogação) |
| Faltando | Inventário de leitura dos legados na homologação (a consulta está na seção 5 deste documento; não foi executada) |
| Evidência no código | `0069`, `0071`; `src/shared/db/repositories/professional-identity.ts` |
| Teste | `professional-identity.test.ts` "NOB-159: vínculo legado precisa de verificação E reconfirmação da própria conta" |
| Depende de terceiros | Acesso de leitura autorizado à homologação |
| Pode corrigir agora? | Não, homologação |
| Correção feita | — (registrada a consulta agregada) |
| Status recomendado | **Manter In Review** até o inventário e a regularização autorizada |
| PR ou commit | Este documento |

### NOB-121 — Cadastro de profissionais internos e externos

| Campo | Conteúdo |
|---|---|
| Status Linear | In Progress (Carlos) |
| Requisito | Profissionais internos e externos cadastráveis; categoria e registros validados; permissões limitadas aos vínculos autorizados |
| Implementado | Médico (CRM) e psicólogo (CRP); UF obrigatória; RQE só para médico (Zod e CHECK); afiliação interna ou externa; duplicidade canônica no app e no gatilho (0081); inativo sai das opções e do predicado clínico; isolamento; exclusão com exames → `IN_USE` |
| Critério 3 | **Atendido** pelas NOB-149, 157 e 158: o acesso depende de vínculo por convite e de verificação, nunca do papel |
| Faltando (P2) | Número do registro é texto livre (até 20) sem conferência de formato; o índice cru `uq_medicos_org_crm` impede médico e psicólogo com o mesmo número no escritório; o psicólogo recebe `FORBIDDEN` genérico ao pedir verificação; o profissional externo precisa ser membro do escritório (sem perfil restrito, ligado à NOB-122) |
| Evidência no código | `src/shared/domains/pgr/medicos.ts`, `src/shared/db/schema/medicos.ts`, `0081` |
| Teste | `unit/domains/pgr/medicos.test.ts`, `unit/medicine/medico-form.test.tsx`, `integration/pgr/medicos.test.ts`, `medicos-registration-duplicates.test.ts`, `medicos-delete-examiner.test.ts`, `professional-links.test.ts` |
| Depende de terceiros | NOB-97 (Done) |
| Pode corrigir agora? | Não, decisão: formato do registro e perfil do externo |
| Correção feita | Menu "Minha identidade profissional" (PR #174) |
| Status recomendado | **Pode ir para In Review**: os três critérios estão atendidos em código. Os P2 viram melhorias, sem bloquear |
| PR ou commit | #138, #154 (antes); #174 (menu) |

### NOB-123 — Conectar ao front-end as funcionalidades do protótipo

| Campo | Conteúdo |
|---|---|
| Status Linear | Backlog (Carlos) |
| Requisito | Ações do protótipo com serviço real identificado; dados persistem depois de recarregar; erro e carregamento visíveis |
| Implementado | Empresas, funções, GES, funcionários, profissionais, exames, riscos, plano, PCMSO e ASO têm tela real, Server Action e REST, e são renderizados no servidor a partir do banco (recarregar mantém os dados). Nenhum link quebrado, botão sem ação ou dado fictício nas telas da Medicina |
| Faltando | Clínicas, encaminhamentos e portal (NOB-122); modelos de ASO e PCMSO (NOB-93); assinatura pelo sistema (MED-12); hub único de documentos da Medicina; painel com absenteísmo, NTEP e encaminhamentos; lista de afastamentos por empresa; psicossocial (entrevistas, indicadores, fadiga); só `/medicine` tem `loading.tsx` |
| Faltando (fora da Medicina) | A mesma falha de leitura tratada como vazio em `employees`, `job-roles`, `ges`, `schedule`, `psychosocial/campaigns` e `psychosocial/risk-factors`; `/schedule` sem item no menu |
| Evidência no código | Matriz completa por item na seção 2 |
| Teste | Testes de integração por fluxo (seção 2); testes de tela `aso-page`, `pcmso-page`, `clinical-record-page`, `health-exam-edit-page` |
| Depende de terceiros | NOB-122, NOB-93, provedor de assinatura |
| Pode corrigir agora? | **Sim**, as falhas escondidas nas telas da Medicina e o menu. Os cadastros compartilhados ficam para quem é dono deles |
| Correção feita | `SectionLoadError` no ASO, no PCMSO, no prontuário e na edição do exame; menu |
| Status recomendado | **In Progress** (deixa o Backlog): a parte sem dependência está conectada; o resto depende das issues citadas |
| PR ou commit | #174 |

### NOB-122 — Portal de comunicação entre empresas e clínicas

| Campo | Conteúdo |
|---|---|
| Status Linear | Backlog (Carlos) |
| Requisito | A empresa envia pedido à clínica vinculada; a clínica consulta e atualiza pedidos autorizados; isolamento e histórico |
| Implementado | Nada específico. Existem: o campo livre `medicos.clinic`; o ASO de clínica externa (fluxo B) registrado pela equipe; a entrega do ASO (precedente de compartilhar documento); rotas públicas com token (assinatura, psicossocial); `scoped_company_id` só em riscos |
| Faltando | Entidade clínica, vínculo empresa ↔ clínica, encaminhamento com estados, perfil de clínica e de RH, regra do que cada um vê |
| Evidência no código | Sem tabela de clínica; `lotes/06-clinicas-e-portais/PLAN.md` (BLOQUEADO desde 21/10) |
| Teste | — |
| Depende de terceiros | Decisões E-02, D-05, D-12, DT-21, DT-26 e DT-27; parecer LGPD (controlador e operador); NOB-108 |
| Pode corrigir agora? | Não, decisão. Um catálogo interno de clínicas (sem login externo e sem dado de saúde) seria tecnicamente seguro, mas cria tabela, migration e superfície de CRUD que dependem da decisão DT-26. Não foi implementado |
| Correção feita | — |
| Status recomendado | **Manter Backlog**, com as perguntas da seção 3 |
| PR ou commit | — |

### NOB-120 — Teleconsulta como serviço avulso

| Campo | Conteúdo |
|---|---|
| Status Linear | Backlog (Carlos) |
| Requisito | Compra avulsa; consulta ligada ao profissional e ao pedido; falha de pagamento tratada |
| Implementado | Nada. O Stripe da `develop` é só a assinatura Pro do escritório. A compra avulsa (NOB-117) existe só numa branch não integrada, com gateway simulado e migrations com numeração em conflito |
| Faltando | Tudo: produto, agenda, sala de vídeo, consentimento, pedido e pagamento |
| Evidência no código | `src/shared/integrations/stripe/client.ts` (`mode: "subscription"`); branch `origin/codex/NOB-117-feat/servicos-avulsos` |
| Teste | — |
| Depende de terceiros | NOB-117 (Backlog, sem responsável), fornecedor de vídeo, gateway, regras CFM/CFP de telessaúde (a confirmar), parecer jurídico |
| Pode corrigir agora? | Não, terceiros |
| Correção feita | — |
| Status recomendado | **Manter Backlog, bloqueada** pela NOB-117 |
| PR ou commit | — |

### NOB-162 — Homologação e liberação da Medicina

| Campo | Conteúdo |
|---|---|
| Status Linear | In Progress (Carlos) |
| Requisito | Confirmar CD e migrations por leitura; provisionar `identity_verifier_login`, `IDENTITY_VERIFIER_DATABASE_URL` e `IDENTITY_CHALLENGE_SECRET`; designar operadores depois da aprovação; inventários; E2E |
| Implementado | Código e migrations 0079–0082 integrados; CD pós-#170 e pós-#171 verdes (`migrations applied successfully`); guia `docs/deploy/identity-verifier.md` |
| Faltando | Leitura do journal real (83 esperados); os 5 inventários agregados; provisionamento; E2E em navegador |
| Evidência no código | Seção 5 (consultas propostas, não executadas) |
| Teste | — (só a homologação prova) |
| Depende de terceiros | Credencial de leitura autorizada; dono do banco para o provisionamento |
| Pode corrigir agora? | Não, homologação |
| Correção feita | Consultas agregadas registradas para quem tiver acesso autorizado |
| Status recomendado | **Manter In Progress** |
| PR ou commit | Este documento |

## 2. NOB-123 — protótipo × sistema real

Legenda: **A** funciona e tem teste · **B** parcial · **C** só visual · **D** não implementado · **E** não verificável · **F** depende de outra issue ou decisão.

| # | Item do protótipo | Rota real | Classe | Testes | Lacuna |
|---|---|---|---|---|---|
| 1 | Empresas | `/companies`, `/companies/[id]/services` | A | `company-registration`, `company-modules`, `rest-companies` | — |
| 2 | Funções | `/job-roles` | A | `job-roles`, `job-roles-isolation` | Falha de leitura vira lista vazia (fora da Medicina) |
| 3 | GES | `/ges` | A | `ges`, `ges-job-roles`, `ges-isolation` | Idem |
| 4 | Funcionários | `/employees`, `/employees/[id]` | A | `employees`, `medicine-employees`, `occupational-health-section` | Idem |
| 5 | Profissionais | `/medicos`, `/professional-identity`, `/admin-global/identity-verifications` | A em código · F para demonstrar | `medicos`, `professional-links`, `professional-identity` | Verificação exige operador provisionado (NOB-162); clínicas: D (NOB-122) |
| 6 | Exames ocupacionais | `/health-exams/**`, `/medicine/procedures` | A | `health-exams-lote02a`, `rest-health-exams`, `health-exam-form-*` | Certificado é caminho em texto, sem upload |
| 7 | Riscos | `/medical-risks`, `/companies/[id]/medical-risks`, `/risk-authorizations/[id]` | A | `medical-risk-sources`, `risk-authorizations`, `risk-absence` | — |
| 8 | Plano de exames | `/companies/[id]/exam-proposal`, `/exam-plan` | A · F para aprovar | `exam-proposal`, `exam-plans`, `coordinator-permission-in-force` | Aprovação exige coordenador verificado |
| 9 | PCMSO | `/companies/[id]/pcmso-readiness`, `/pcmso`, `/interpretation-criteria`, `/pcmso-coordinator`, `/analytical-report` | A (editorial F) | `pcmso-readiness`, `pcmso-documents`, `pcmso-signed`, `pcmso-page` | Modelo final: NOB-93. Falhas escondidas: **corrigidas (#174)** |
| 10 | ASO | `/health-exams/[id]/aso` | A (assinatura D) | `aso`, `aso-signed`, `aso-delivery`, `aso-delivery-review`, `aso-page` | Sistema não assina (MED-12). Falhas escondidas: **corrigidas (#174)** |
| 11 | Histórico e documentos | Dentro das telas de PCMSO e ASO e em `/employees/[id]` | B | `pcmso-documents`, `aso-signed` | Sem hub único e sem ligação com o GED |
| 12 | Comunicação com clínicas | — | D / F | — | NOB-122 |
| — | Painel da Medicina | `/medicine` | B | `overview`, `medicine-overview-cards` | 5 indicadores; faltam absenteísmo, NTEP, encaminhamentos e psicossocial |
| — | Psicossocial | `/psychosocial/**` | B | `psychosocial`, `risk-factors` | Entrevistas, indicadores e fadiga: D |
| — | Agenda e encaminhamento | `/schedule` (genérica) | B | `schedule-events` | Sem item no menu; encaminhamento: D |
| — | Afastamentos e NTEP | `/employees/[id]`, `/absences/[id]/clinical`, `/medicine/ntep` | A | `absences`, `ntep-lista-c`, `absences-section-feedback` | Sem lista por empresa; Kit INSS, FAP/RAT e PPP: D |

## 3. NOB-122 e NOB-120 — perguntas e proposta para o backlog

> **Proposta, não aprovada.** Nada disso foi implementado.

### NOB-122: perguntas de produto

1. Clínica e RH terão login próprio na V1? Qual dos três modos do MED-04 vem primeiro?
2. A clínica atende vários escritórios, mas o tenant é o escritório. A identidade da clínica é global ou uma por escritório? Isso toca o Princípio I e a decisão D-05.
3. O fluxo do encaminhamento do protótipo (`solicitado → emitido → agendado → realizado → concluído | cancelado`) está aprovado? Quem muda cada estado?
4. O representante da empresa cria o pedido ou só o escritório (DT-27)?
5. Que dados mínimos a clínica vê do trabalhador encaminhado? E depois que o vínculo termina?
6. Visão do RH (MED-17, DT-21): tipo, data, conclusão, validade e restrição "necessária para a função". Quem escreve essa restrição, separada do prontuário?
7. No modo 3, como o ASO do examinador da clínica se relaciona com o coordenador e com a verificação (NOB-158)? Qual a regra de divergência no fluxo B?
8. O portal vale como canal digital de entrega do ASO (MED-13)?
9. CID só com autorização registrada do trabalhador (MED-17): quem coleta e como?
10. MFA para os perfis de clínica e RH (D-12)?

### NOB-122: esboço de dados (proposta)

- **Entidades:** `clinics` e `company_clinic_links` (catálogo interno, com histórico do vínculo e sem DELETE); depois `exam_referrals` e `exam_referral_events` (só inclusão) e `clinic_memberships`.
- **Pode ser compartilhado:**
  - **com a clínica:** identificação mínima do encaminhado, função e riscos, procedimentos e agenda;
  - **com o RH:** tipo, data, apto ou inapto, validade, restrição necessária e situação da entrega.
- **Nunca compartilhado:**
  - observações clínicas, resultados e prontuário;
  - CID sem autorização;
  - trabalhadores de outras empresas;
  - dados financeiros da empresa para a clínica.

### NOB-120: perguntas de produto

1. O que é a teleconsulta? Orientação, psicologia ou retorno? Ela nunca gera nem substitui ASO? (O questionário diz "sem consulta 'válida' só por vídeo".)
2. Quem compra (escritório, empresa ou trabalhador) e para quem?
3. Quem agenda? Qual a política de cancelamento, falta e reembolso?
4. Só médico ou também psicólogo?
5. O que é registrado, onde e quem lê? É permitido gravar?
6. O que acontece com pagamento pendente ou recusado, ou com o profissional ou o fornecedor indisponível?
7. Ela entra no catálogo de serviços da NOB-117?

### NOB-120: esboço de estados (proposta)

`aguardando_pagamento → pago → agendada → em_andamento → concluída | cancelada | falta | pagamento_recusado | fornecedor_indisponível`

- Só `pago` permite agendar. O pagamento é confirmado por webhook idempotente.
- Conteúdo clínico nunca vai para o pedido, o pagamento, os metadados do fornecedor, os logs ou a IA.
- O consentimento do paciente fica registrado antes da sessão.

## 4. Roteiro de demonstração

> **Roteiro proposto, não validado em navegador.** A coluna "Teste" indica a cobertura automatizada de cada passo, não uma demonstração feita.
> **Atos clínicos** (passos 5, 8 e o registro pelo examinador no 12) exigem um operador e um master **fictícios** provisionados pelo dono do banco num ambiente autorizado. Sem isso, explique o passo em vez de demonstrá-lo.

| # | Passo | Rota e papel | O que fazer e o resultado esperado | Teste |
|---|---|---|---|---|
| 1 | Login | `/sign-in`, qualquer membro | Login Clerk → `/dashboard` | `auth/protected-layout` |
| 2 | Escolher empresa e ligar a Medicina | `/companies` → `/companies/[id]/services`, owner | Liga a Medicina → a empresa aparece em `/medicine` | `company-modules`, `company-services-consistency` |
| 3 | Funções, GES e funcionários | `/job-roles/new`, `/ges/new`, `/employees/new`, equipe | Salva e recarrega → os dados continuam lá | `job-roles`, `ges-job-roles`, `employees` |
| 4 | Área da Medicina | Menu "Medicina do Trabalho" → `/medicine`, equipe | Filtra por empresa → indicadores e funcionários com último exame | `overview`, `medicine-employee-list` |
| 5 | Profissionais | `/medicos/new` (equipe); convite em `/medicos/[id]/edit` (owner); aceite e pedido em "Minha identidade profissional" (o profissional); aprovação em `/admin-global/identity-verifications` (master e operador) | Acesso clínico "disponível" | `medicos`, `professional-links`, `professional-identity` · **F (NOB-162)** |
| 6 | Exame | `/medicine` → "Registrar exame" → `/health-exams/new`, equipe | Salva → edição com procedimentos (Tabela 27) | `health-exams-lote02a`, `health-exam-form-*` |
| 7 | Riscos | `/medical-risks` → empresa → fonte do PGR → `/risk-authorizations/[id]`; inexistência de riscos por GES e função | Riscos validados, origem interna ou externa | `medical-risk-sources`, `risk-authorizations`, `risk-absence` |
| 8 | Riscos → exames → plano | `/companies/[id]/exam-proposal` → `/exam-plan`; coordenador em `/pcmso-coordinator` (owner) | Rascunho pela equipe; aprovação pelo coordenador verificado | `exam-proposal`, `exam-plans`, `pcmso-coordinators` · **F** |
| 9 | Conferência e prévia do PCMSO | `/companies/[id]/pcmso-readiness` → `/interpretation-criteria` → `/pcmso` | Pendências listadas; sem pendências, prévia imutável com hash | `pcmso-readiness`, `pcmso-documents`, `pcmso-page` |
| 10 | Conferência e prévia do ASO | `/health-exams/[id]/aso` | Checklist NR-7 7.5.19.1 a–g → prévia arquivada | `aso`, `aso-page` |
| 11 | Histórico de documentos | Telas de PCMSO e ASO, `/employees/[id]`, `/analytical-report` | Versões da prévia, assinados como Vigente ou Substituído, download | `pcmso-signed`, `aso-signed`, `analytical-reports` |
| 12 | Assinatura e entrega | `/health-exams/[id]/aso`, `/companies/[id]/pcmso` | Explicar que o sistema não assina. Registrar o PDF assinado (SHA-256; examinador verificado, ou clínica externa no fluxo B) e a entrega com conferência do comprovante | `aso-signed`, `aso-delivery`, `aso-delivery-review` |

## 5. Consultas agregadas para a homologação (NOB-159 e NOB-162)

> **Propostas, não executadas.** Rodar só com credencial de leitura **autorizada** e numa conta que leia todos os escritórios. Pelo `app_runtime`, a RLS devolve zero. As consultas devolvem só contagens, sem dado pessoal. Não corrigem nada: a regularização é decisão do Carlos.

```sql
-- Journal (esperado: 83 registros, último 0082)
select count(*) as aplicadas, max(created_at) as ultima from drizzle.__drizzle_migrations;

-- ASO assinado: exames com mais de uma versão vigente (raiz sem substituição)
select count(*) as exames_ambiguos from (
  select org_id, health_exam_id from public.aso_signed_documents
  where replaces_id is null group by 1, 2 having count(*) > 1) x;

-- PCMSO assinado: empresas com mais de uma versão vigente
select count(*) as empresas_ambiguas from (
  select org_id, company_id from public.pcmso_signed_documents
  where replaces_id is null group by 1, 2 having count(*) > 1) x;

-- Declarações de inexistência de riscos sem a função cadastrada
select count(*) as declaracoes_sem_job_role from public.medical_risk_absence_declarations
where job_role_id is null;

-- Cadastros com número de registro canônico repetido no mesmo escritório
select count(*) as grupos_equivalentes from (
  select org_id, public.medico_registration_canonical(crm) from public.medicos
  group by 1, 2 having count(*) > 1) x;

-- Vínculos legados (sem convite) ainda ativos, e quantos já foram reconfirmados
select count(*) as legados_ativos,
       count(*) filter (where exists (
         select 1 from public.medico_link_reconfirmations r
         where r.link_id = l.id and r.org_id = l.org_id)) as reconfirmados
from public.medico_user_links l
where l.invitation_id is null and l.revoked_at is null;
```

## 6. Lacunas P2 registradas (sem correção nesta rodada)

| # | Lacuna | Issue | Por que não foi corrigida |
|---|---|---|---|
| 1 | Validade da verificação: teto técnico de 36 meses, contra a decisão de 12 | NOB-158 | Pede migration de CHECK; decisão a confirmar |
| 2 | CRM alterado e depois restaurado faz a verificação antiga voltar a valer | NOB-158 | Pede decisão: invalidação permanente ou não |
| 3 | CRM reformatado corta o acesso (comparação de texto cru) | NOB-158 | Falha fechada; mudar exige decisão sobre a forma canônica |
| 4 | `IDENTITY_VERIFIER_DATABASE_URL` é a raiz de confiança do operador | NOB-158/162 | Operacional: guarda do segredo |
| 5 | Recusar um pedido depois de aprovado não tem efeito; só a revogação corta | NOB-158 | Comportamento a confirmar |
| 6 | Registro profissional sem conferência de formato; índice cru impede médico e psicólogo com o mesmo número | NOB-121 | Decisão de formato e migration |
| 7 | Psicólogo recebe `FORBIDDEN` genérico ao pedir verificação | NOB-121 | Mensagem; baixa prioridade |
| 8 | Falha de leitura tratada como vazio nos cadastros compartilhados e no psicossocial | NOB-123 | Fora da frente Medicina |
| 9 | `/schedule` sem item no menu | NOB-123 | Pede decisão de onde ela entra no menu |
