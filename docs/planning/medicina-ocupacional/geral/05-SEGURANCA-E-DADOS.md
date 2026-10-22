# 05 — Segurança e dados

> Documento permanente. Base: [AUDIT-SECURITY.md](../AUDIT-SECURITY.md) (código `d6b787c` + PR #112), com a revisão
> cruzada do [README da Fase 0](../README.md) (X-1: bypass dev rebaixado de P0 para **P1**).
> **Este documento não declara conformidade com LGPD, NR-07, CFM ou CFP.** Separa o que é técnico do que é
> jurídico/clínico (§4).

## 1. Rótulos

| Rótulo             | Significado                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **IMPLEMENTADO**   | existe em `origin/develop`, com evidência de código (arquivo)                                     |
| **PROPOSTO**       | desenho da auditoria ou de um lote; nada criado                                                   |
| **BLOQUEADO**      | depende de decisão (código em [04](04-DECISOES-E-BLOQUEIOS.md) / [DECISIONS.md](../DECISIONS.md)) |
| **NÃO_VERIFICADO** | não foi possível conferir (configuração externa, ambiente, política de terceiro)                  |

Uma regra pode ter partes com rótulos diferentes; cada linha diz qual parte é qual.

## 2. Regras permanentes de segurança clínica

Valem para todo lote, todo PR e toda revisão. O REVIEW de cada lote confere uma a uma.

| #    | Regra                                                                              | Como se verifica                                                              |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S-01 | Não copiar a segurança simulada do protótipo ("Ver como", perfis de tela)          | autorização no servidor + RLS; teste de integração por perfil                 |
| S-02 | Não usar `localStorage`/`sessionStorage`/IndexedDB para dado médico                | busca no diff; dado vem de Server Component/Action                            |
| S-03 | Não aprovar em nome de terceiros                                                   | nenhuma ação grava "aprovado por X" executada por outro usuário               |
| S-04 | Owner **não** é médico presumido (nem colaborador)                                 | nenhuma regra concede papel técnico por papel de acesso                       |
| S-05 | Não expor prontuário ao escritório                                                 | prontuário não existe e não será criado sem perfil clínico (S-07)             |
| S-06 | Nada entre organizações                                                            | `withOrg` + RLS + teste cross-tenant (404) em toda leitura nova               |
| S-07 | Não armazenar resultado clínico novo antes de perfil clínico + trilha de auditoria | migration com coluna de resultado só depois de P9 e da decisão de perfis      |
| S-08 | Nenhum dado médico em IA                                                           | nenhum prompt recebe campo de saúde; revisão do diff de `integrations/agents` |
| S-09 | Nenhuma assinatura técnica falsa (QR/link/rabisco ≠ assinatura técnica)            | documento sem provedor sai "emitido, sem assinatura técnica"                  |
| S-10 | Nenhum dado clínico real em teste                                                  | seeds e E2E com dados fictícios; nunca a organização real                     |
| S-11 | Não apagar exames sem avaliar retenção                                             | nenhuma nova rota de DELETE de exame; arquivamento após A-07                  |
| S-12 | Erro de leitura ≠ lista vazia                                                      | `result.ok === false` → `ErrorState`; teste de UI do estado de erro           |
| S-13 | Não duplicar cadastro de empresa ou funcionário                                    | Medicina usa `companies`/`employees`; nenhum CRUD paralelo                    |

## 3. Regras por tema

### 3.1 Autenticação

| Regra                                                                                      | Rótulo                    | Evidência / pendência                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Toda rota não pública passa por `clerkMiddleware` + `auth.protect()`                       | IMPLEMENTADO              | `src/proxy.ts` (AUDIT-SECURITY E1)                                                                                  |
| Defesa em profundidade nas páginas e actions (`requireTenantContext`/`requireOfficeStaff`) | IMPLEMENTADO              | E7                                                                                                                  |
| Sandbox (homologação) exige HTTP Basic **antes** do Clerk e do bypass                      | IMPLEMENTADO              | `proxy.ts:98-100`; `docs/deploy/vercel.md`                                                                          |
| Bypass dev do REST (`DEV_API_AUTH_BYPASS` + `x-dev-*`) impossível em produção              | IMPLEMENTADO (lógica)     | `rest.ts`, `proxy.ts`; é **fail-open** se `APP_ENV` faltar num deploy novo → risco **P1** (R1 após revisão cruzada) |
| Allowlist explícita de `APP_ENV` + falhar o boot com a flag ativa em deploy                | PROPOSTO                  | D-11 (Douglas/Rikelvin), independe da Medicina                                                                      |
| Valores reais de `APP_ENV`/`DEV_API_AUTH_BYPASS` na Vercel                                 | NÃO_VERIFICADO            | —                                                                                                                   |
| MFA para owner e perfis de saúde                                                           | PROPOSTO / NÃO_VERIFICADO | D-12; configuração do Clerk fora do código                                                                          |

### 3.2 Tenant (escritório)

| Regra                                                                                                      | Rótulo                   | Evidência |
| ---------------------------------------------------------------------------------------------------------- | ------------------------ | --------- |
| Tenant ativo vem da sessão (cookie validado contra `org_memberships`), nunca do cliente                    | IMPLEMENTADO             | E4, E5    |
| Toda leitura/escrita por `withOrg`; RLS `org_id = current_setting('app.current_org', true)` em toda tabela | IMPLEMENTADO             | E12–E14   |
| O banco não conhece usuário nem papel: segregação por perfil depende do servidor                           | IMPLEMENTADO (limitação) | L2        |

### 3.3 Empresa-cliente

| Regra                                                                                  | Rótulo                                       | Evidência                |
| -------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------ |
| Tabela nova de Medicina com FK composta `(company_id, org_id) → companies(id, org_id)` | PROPOSTO (padrão já usado em 0053 e na #112) | AUDIT-ARCHITECTURE §10.1 |
| `health_exams` segue a empresa **atual** do funcionário (sem `company_id`)             | IMPLEMENTADO (limitação, R4)                 | AUDIT-ARCHITECTURE R4    |
| `health_exams.company_id` com a empresa na data do exame                               | PROPOSTO (Lote 2)                            | IMPLEMENTATION-PLAN      |
| Filtro por empresa não vaza entre empresas do mesmo escritório                         | PROPOSTO (teste do Lote 1)                   | FIRST-MVP §7             |

### 3.4 Módulo habilitado

| Regra                                                                                                       | Rótulo                      | Evidência             |
| ----------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------- |
| RESTRICTIVE `medicine` em `health_exams`; `assertCompanyModuleTx` na escrita                                | IMPLEMENTADO                | E24, E26              |
| `medicos`, `accidents`, psicossocial, `employees.blood_type` fora do gate `medicine`                        | IMPLEMENTADO (lacuna L8)    | E31; decisão R-06/D5  |
| Só owner altera habilitação — **só na aplicação** (banco concede UPDATE ao runtime)                         | IMPLEMENTADO (risco R8, P1) | E27                   |
| Toda tabela nova de Medicina com RESTRICTIVE `companyModuleScope(…, 'medicine')` + teste "módulo desligado" | PROPOSTO                    | AUDIT-LINEAR-QA §10.4 |

### 3.5 Identidade profissional

| Regra                                                                 | Rótulo                   | Evidência / pendência                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medicos` sem vínculo com usuário, sem UF do CRM, sem RQE             | IMPLEMENTADO (lacuna)    | E35                                                                                                                                                                                                                                                                                                           |
| Identidade + designação por empresa com vigência (P1)                 | PROPOSTO **e** BLOQUEADO | E-01 **PARCIALMENTE_RESPONDIDA** (Expedito, 21/10): a empresa define quem autoriza e os dados do profissional devem ser registrados; faltam ator, escopo, revogação, externos, modelo Clerk/banco e a ambiguidade empresa-cliente × escritório ([03](03-ARQUITETURA-E-CONTRATOS.md) §6). D-03 (dono) pendente |
| Nenhuma concessão de permissão implementada antes da decisão completa | regra da frente          | brief da organização                                                                                                                                                                                                                                                                                          |

### 3.6 Permissões

| Regra                                                                                     | Rótulo                        | Evidência                              |
| ----------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| owner/collaborator leem e escrevem todo exame de empresa com Medicina; `client` bloqueado | IMPLEMENTADO                  | E34, E7                                |
| Lote 1 **não amplia** a exposição de dado de saúde                                        | PROPOSTO (critério do Lote 1) | FIRST-MVP §6                           |
| Matriz perfis × classes de dado                                                           | PROPOSTO                      | AUDIT-SECURITY §10.2 (sujeita a D3/D4) |
| Papel clínico no servidor e na RLS (contexto de papel na transação)                       | PROPOSTO / BLOQUEADO          | SEC §10.3; D-05, E-02, A-03            |

### 3.7 Dados clínicos

| Regra                                                                                       | Rótulo                           | Evidência                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| Hoje: conclusão de aptidão em `health_exams`; `notes` livre; `blood_type` no cadastro comum | IMPLEMENTADO (risco R7)          | E32, E41                                     |
| Aviso "não registre diagnóstico ou CID" em Observações                                      | PROPOSTO, sujeito ao Dr. Alcides | FIRST-MVP §2                                 |
| Classificação de campos (conclusão × sigiloso) e destino de `notes`/`blood_type`            | BLOQUEADO                        | A-03 / D4                                    |
| Resultado clínico (audiometria, espirometria, valores) só após S-07                         | BLOQUEADO                        | P4 sem valores; R2/R3 (P0 para dado clínico) |

### 3.8 Prontuário

| Regra                                                                                   | Rótulo                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Não existe e **não** entra em nenhum lote planejado                                     | IMPLEMENTADO (ausência) / fora do MVP (MED-37)      |
| Exige equipe de saúde designada, sigilo profissional, retenção longa, export controlado | PROPOSTO (SEC §10.1) / BLOQUEADO (CFM: Dr. Alcides) |

### 3.9 ASO

| Regra                                                                         | Rótulo                                        | Evidência |
| ----------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| ASO é **registro**, não emissão; sem documento, sem assinatura                | IMPLEMENTADO (ausência)                       | E32       |
| `certificate_path` é texto digitado, nunca baixado                            | IMPLEMENTADO (lacuna L5)                      | E32       |
| Emissão com snapshot imutável + hash (P7)                                     | PROPOSTO / BLOQUEADO (D-06, A-03, A-05, A-09) | DB §10.3  |
| Ciência do trabalhador via registry (`target_type` novo) ≠ assinatura técnica | PROPOSTO                                      | DB §10.3  |
| Seção de riscos do ASO só com fonte validada (ou decisão explícita com aviso) | BLOQUEADO                                     | A-04      |

### 3.10 PCMSO

| Regra                                                                      | Rótulo                         |
| -------------------------------------------------------------------------- | ------------------------------ |
| Não existe                                                                 | IMPLEMENTADO (ausência)        |
| Emissão bloqueada se alguma fonte usada não estiver `validated` no momento | PROPOSTO (Lote 5)              |
| Coordenador designado assina; validação por profissional identificado      | BLOQUEADO (NOB-98, A-01, E-01) |

### 3.11 Trilha de auditoria

| Regra                                                                                                         | Rótulo                                      | Evidência |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------- |
| `logTenantEvent` = `console.log` sem id da entidade; leituras não registradas                                 | IMPLEMENTADO (lacuna L3)                    | E43, E44  |
| Trilhas persistidas só em `company_module_events` e `epi_catalog_audit_log` (+ `medical_risk_events` na #112) | IMPLEMENTADO                                | E45       |
| `medical_audit_events` append-only (leitura + escrita, sem conteúdo clínico, mesma transação)                 | PROPOSTO (P9, Lote 2; Rikelvin revisa R-05) | DB §10.4  |

### 3.12 Retenção

| Regra                                                                             | Rótulo                                                  | Evidência                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| DELETE físico de exame; CASCADE empresa → funcionário → exame; SET NULL do médico | IMPLEMENTADO (risco R4)                                 | E33                           |
| Arquivamento no lugar de DELETE/CASCADE                                           | PROPOSTO **e** BLOQUEADO até prazo de guarda            | A-07 (Dr. Alcides + jurídico) |
| Prazo de 20/30 anos                                                               | NÃO_VERIFICADO (HIPÓTESE da especificação do protótipo) | AUDIT-PROTOTYPE §5.5          |

### 3.13 Armazenamento

| Regra                                                                                                          | Rótulo                    | Evidência      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------- |
| Buckets privados via service key, sem policy de Storage; isolamento pelo path `org_id/...` montado no servidor | IMPLEMENTADO (lacuna L11) | E18            |
| Documento clínico em bucket próprio, path por empresa, download só por action auditada                         | PROPOSTO                  | SEC R11, §10.3 |
| Backups/PITR, criptografia em repouso, região                                                                  | NÃO_VERIFICADO            | SEC §12        |

### 3.14 URLs assinadas

| Regra                                                                                      | Rótulo                              | Evidência                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------- |
| GED com TTL de 60 s; logo de empresa 3600 s                                                | IMPLEMENTADO                        | E19                             |
| Documento clínico: URL ≤ 60 s, gerada só após checagem de tenant, empresa, módulo e perfil | PROPOSTO                            | SEC R11                         |
| Download cross-tenant → 404 sem assinar path (padrão `documents-download.test.ts`)         | IMPLEMENTADO (GED) / PROPOSTO (ASO) | AUDIT-LINEAR-QA §6.1 cenário 12 |

### 3.15 IA

| Regra                                                                     | Rótulo                                            | Evidência                   |
| ------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------- |
| Chave só no servidor, cota por tenant, allowlist, isolamento antes do LLM | IMPLEMENTADO                                      | SEC §5 item 6               |
| Texto livre de acidente vai ao LLM (modelos `:free`)                      | IMPLEMENTADO (risco R5, P1)                       | E37                         |
| Nenhum dado de saúde em prompt de Medicina (NOB-125 fica no backlog)      | regra da frente; decisão formal BLOQUEADA em D-08 | IMPLEMENTATION-PLAN backlog |
| Retenção/treino dos provedores                                            | NÃO_VERIFICADO                                    | E38                         |

### 3.16 LGPD

Nenhuma afirmação de conformidade. A tabela separa responsabilidades (SEC §10.5).

| Técnico (engenharia)                                                                                                                                               | Jurídico / clínico (fora do código; não decidido aqui)                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segregação por perfil, auditoria de leitura, URLs curtas, logs sem PII, minimização em IA, export/eliminação por titular ou empresa, MFA, grupo mínimo no servidor | Controlador × operador (escritório, empresa-cliente, plataforma), base legal, prazos de guarda, consentimento, sigilo médico/psicológico, DPA com provedores, resposta a incidentes |

Rótulo geral: os itens técnicos estão **PROPOSTOS** (exceto os já marcados IMPLEMENTADO acima); os jurídicos/clínicos
estão **BLOQUEADOS** em quem decide (Dr. Alcides, jurídico/DPO, Douglas).

### 3.17 Isolamento

| Regra                                                                                                                            | Rótulo                                           | Evidência                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------- |
| `runIsolationSuite` (6 asserções RLS) cobre 20 tabelas; **não** cobre `health_exams`, `medicos`, `company_modules`, psicossocial | IMPLEMENTADO (lacuna)                            | E21; AUDIT-LINEAR-QA §5.3 |
| Toda tabela nova de Medicina entra na isolation suite                                                                            | PROPOSTO (DoD, [07](07-CRITERIOS-DE-ENTREGA.md)) | —                         |
| Suítes `least-privilege` e `companies-scope-model` fora do CI                                                                    | IMPLEMENTADO (risco R9, P1)                      | E20                       |
| Arquitetura A (RLS + segregação clínica) evoluindo para B (schema `clinical`) × C (banco por cliente)                            | BLOQUEADO (D-05, Douglas)                        | SEC §10.3                 |

### 3.18 Erros (erro ≠ vazio)

| Regra                                                                                                                     | Rótulo                 | Evidência               |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------- |
| `/health-exams` e `/medicos` transformam erro em lista vazia                                                              | IMPLEMENTADO (defeito) | AUDIT-UX §4.2           |
| `ErrorState` quando `result.ok === false`; vazio só com `ok:true` e zero linhas; bloqueio por módulo com mensagem própria | PROPOSTO (Lote 1)      | FIRST-MVP §2            |
| Repositório nunca devolve "todos" sem tenant; ausência de tenant é bloqueada pelo gate                                    | IMPLEMENTADO           | CLAUDE.md; constituição |

### 3.19 Logs

| Regra                                                                       | Rótulo                       | Evidência |
| --------------------------------------------------------------------------- | ---------------------------- | --------- |
| `restHandler` loga `error.message` cru; serviço de IA loga o objeto de erro | IMPLEMENTADO (risco R12, P2) | E46       |
| Nenhum conteúdo clínico, CPF ou nome em log ou evento de auditoria          | PROPOSTO (DoD)               | SEC R12   |
| Conteúdo real dos logs em produção                                          | NÃO_VERIFICADO               | —         |

## 4. Prioridades herdadas da Fase 0

| ID      | Prioridade                           | Resumo                                                                   | Situação                        |
| ------- | ------------------------------------ | ------------------------------------------------------------------------ | ------------------------------- |
| R1      | **P1** (era P0; revisão cruzada X-1) | bypass dev fail-open                                                     | proposta D-11, fora da Medicina |
| R2      | P0 para dado clínico                 | sem papel clínico                                                        | bloqueia S-07                   |
| R3      | P0 para dado clínico                 | sem trilha de auditoria                                                  | P9 no Lote 2                    |
| R4      | P1                                   | perda de ASO por DELETE/CASCADE                                          | arquivamento após A-07          |
| R5      | P1                                   | texto de acidente no LLM                                                 | D-08                            |
| R6      | P1                                   | psicossocial reidentificável                                             | E-04/A-08                       |
| R7–R10  | P1                                   | `notes`/`blood_type`; owner só na app; suítes fora do CI; efeito da 0055 | ver AUDIT-SECURITY §7           |
| R11–R14 | P2                                   | Storage, logs, token psicossocial em claro, configuração externa         | ver AUDIT-SECURITY §7           |
