# Lote 06 — Profissionais, clínicas e portais · AUDIT

> Base: `origin/develop` = `d6b787c` (21/10/2026). Resume a Fase 0.
> [README do lote](README.md)

## 1. Situação existente

| Peça                                                              | Estado                                                                                      | Evidência                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Catálogo de médicos do escritório                                 | CRUD mergeado (`0029`); CRM sem UF; `clinic` é **texto livre**; sem psicólogos; sem usuário | `src/shared/db/schema/medicos.ts:33,43`; [GAP-MATRIX MED-03, MED-27](../../GAP-MATRIX.md)                        |
| Entidade clínica, vínculo empresa ↔ clínica, encaminhamento, guia | **inexistentes**                                                                            | MED-24                                                                                                           |
| Papéis                                                            | binário: equipe do escritório (`owner`/`collaborator`) × `client` bloqueado em tudo         | [AUDIT-SECURITY §5 item 2](../../AUDIT-SECURITY.md)                                                              |
| Escopo de usuário por empresa                                     | coluna existe e **não é aplicada**                                                          | `src/shared/db/schema/org-memberships.ts:27` (`scoped_company_id`); [AUDIT-SECURITY L6](../../AUDIT-SECURITY.md) |
| Papel clínico / RLS por papel                                     | inexistente; o banco não sabe quem é o usuário                                              | [AUDIT-SECURITY L1, L2](../../AUDIT-SECURITY.md)                                                                 |
| Auditoria de leitura                                              | inexistente (só console)                                                                    | [AUDIT-SECURITY L3](../../AUDIT-SECURITY.md)                                                                     |
| Agenda genérica                                                   | existe `schedule_events` (PGR); adequação a agendamento de exame **NÃO VERIFICADA**         | `src/shared/db/schema/schedule-events.ts`                                                                        |
| Fluxos públicos por token (precedente técnico)                    | assinatura (token hasheado, uso único), psicossocial                                        | [AUDIT-SECURITY §5 item 4](../../AUDIT-SECURITY.md)                                                              |

## 2. O que o protótipo faz (referência de comportamento)

Fonte: [AUDIT-PROTOTYPE §5.1, §5.4, §5.7, §5.8, §5.13, §5.14](../../AUDIT-PROTOTYPE.md); pacote Projeto-SST-Ocupacional V17 (fora do repositório).

- **Perfis simulados** (provedor, empresa, clínica, pendente); nenhum login de médico, psicólogo ou trabalhador.
- **Clínicas** (P-09/P-10): cadastro com médicos examinadores (nome, CRM, UF) e exames com preço/prazo.
- **Encaminhamentos** (P-06/P-07): status `solicitado → emitido → agendado → realizado → concluido | cancelado`;
  `concluirEnc` cria o ASO. Guia `docGuia` (P-08) com número `G-AAMMDD-XXXX` e ficha de coleta.
- **Portal da empresa** (P-59…P-61) e **portal da clínica** (P-62), pedido de acesso (P-63).
- **Equipe técnica** (P-42/P-43): profissional com tipo, registro, UF, RQE.
- Jornadas: J-01 (empresa solicita exame), J-02 (clínica do pedido ao ASO).

**Problemas que não podem ser portados** ([AUDIT-PROTOTYPE §7](../../AUDIT-PROTOTYPE.md)):

| ID   | Problema                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Isolamento só visual; todas as coleções no navegador; `exigirVinculo` desligado por padrão                                  |
| R-02 | Portal da empresa recebe objetos completos de encaminhamento (sinais vitais, audiometria, espirometria) e afastamento (CID) |
| R-03 | Clínica recebe RAT, FAP, folha e as assinaturas (valores/pagamentos) das empresas                                           |
| R-04 | "Aprovar como \<profissional\>" pelo editor                                                                                 |
| R-05 | Empresa emite e edita ASO próprio                                                                                           |
| R-06 | IA lê laudos com nome/CPF/dados clínicos                                                                                    |

## 3. Lacunas

| #   | Lacuna                                                                                 |
| --- | -------------------------------------------------------------------------------------- |
| L1  | Definição dos perfis da V1 (RH? clínica? trabalhador?) — E-02                          |
| L2  | Profissional externo ao escritório (clínica parceira) pode ter acesso? — E-01          |
| L3  | Psicólogos: estender `medicos` ou criar `health_professionals`? — decisão de modelagem |
| L4  | Entidade clínica + vínculo autorizado empresa ↔ clínica com vigência                   |
| L5  | Encaminhamento com status, guia como documento, agendamento                            |
| L6  | Escopo por empresa (servidor + RLS) para RH e clínica                                  |
| L7  | Papel clínico e camada clínica separada antes de resultados de exame                   |
| L8  | MFA para perfis de saúde (D-12) e configuração externa não versionada                  |

## 4. Riscos

| #   | Risco                                                                      | Severidade                                                                                                         |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R1  | Construir portais antes da decisão de produto e refazer                    | Alta (prazo)                                                                                                       |
| R2  | Clínica vendo trabalhador de empresa não vinculada                         | Alta (vazamento)                                                                                                   |
| R3  | RH vendo resultado clínico ou prontuário                                   | Alta (P0 para dado clínico)                                                                                        |
| R4  | Ativar `client` sem escopo por empresa no banco                            | Alta                                                                                                               |
| R5  | Guardar sinais vitais/audiometria sem papel clínico nem auditoria          | Alta (P0)                                                                                                          |
| R6  | Recriar cadastros de empresa/funcionário dentro do portal                  | Média                                                                                                              |
| R7  | Interpretar NOB-123 ("conectar protótipo ao front-end") como portar o HTML | Média — o protótipo é especificação de comportamento, não código ([AUDIT-PROTOTYPE §10](../../AUDIT-PROTOTYPE.md)) |

## 5. Decisões técnicas (estado)

| Tema                                                            | Estado                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Matriz perfis × classes de dado                                 | **PROPOSTO** ([AUDIT-SECURITY §10.2](../../AUDIT-SECURITY.md)); hoje só "escritório" e `client` bloqueado |
| A agora, evoluindo para B (schema `clinical`) na camada clínica | **PROPOSTO**; decisão D-05 (Douglas)                                                                      |
| Estender `company_modules`, não substituí-lo                    | **PROPOSTO** ([AUDIT-SECURITY §8](../../AUDIT-SECURITY.md))                                               |
| Identidade profissional (P1) no Lote 03                         | **PROPOSTO**; dono a decidir (D-03)                                                                       |
| Portais na V1                                                   | **PENDENTE** (E-02)                                                                                       |
