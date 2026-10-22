# DECISIONS: decisões pendentes por pessoa

> Consolidado do coordenador, 2026-10-21. Junta e deduplica as decisões dos seis relatórios. **Nenhuma está tomada.**
> Fonte de cada uma entre colchetes. "Bloqueia" indica o que fica parado sem a resposta.

## 1. Por pessoa

### Douglas (Tech Lead)

| #    | Decisão                                                                                                                                                                                                                   | Bloqueia                    | Fonte                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- |
| D-01 | Ordem de merge: a #112 (0054/0055) entra antes de qualquer migration de Medicina? Se não, quem regera os snapshots dela                                                                                                   | Lote 2+                     | [ARCH §9, DB §9]        |
| D-02 | Aceitar o efeito da 0055: riscos, avaliações, medidas e EPI de empresas **sem PGR** ficam invisíveis em todo o app (o Expedito precisa estar ciente)                                                                      | merge da #112               | [DB §4.4, SEC R10]      |
| D-03 | Dono da identidade profissional: NOB-121 (Carlos) modela e a NOB-98 consome? Ou o inverso?                                                                                                                                | Lote 3                      | [LINEAR §4.7]           |
| D-04 | Reescopar a NOB-111 sobre a #112 (evitar dois contratos de PGR externo)                                                                                                                                                   | Lote 3                      | [LINEAR §4.5]           |
| D-05 | Arquitetura de isolamento: A (RLS atual + segregação clínica), B (schema `clinical`) ou C (banco por cliente, como pede a especificação do protótipo). A opção C exige emenda MAJOR da constituição (tenant = escritório) | tabelas clínicas            | [SEC §10.3, PROTO D-01] |
| D-06 | Camada de emissão genérica com snapshot (P7): estender `documents` (`company_id`, hash) e o pipeline dele, ou tabelas próprias de Medicina                                                                                | Lote 4                      | [DB §10.3]              |
| D-07 | Estratégia de migrations com CD automático (staging intermediário? só aditivas? janela develop→main?)                                                                                                                     | todo lote com migration     | [ARCH R1, DB §10.6]     |
| D-08 | IA com qualquer conteúdo de saúde: proibir, ou pseudonimizar com contrato sem treino. Inclui o texto livre de acidente que hoje vai para modelos `:free`                                                                  | NOB-125                     | [SEC D8, R5]            |
| D-09 | Token de acento por módulo (teal `#0d6b63`) e unificação de `StatusBadge`/`ListCard` + contraste AA das pílulas                                                                                                           | visual do Lote 1 (opcional) | [UX §9]                 |
| D-10 | Remover a dependência NOB-110 → NOB-113, se o Dr. Alcides confirmar que "Lista C" = NTEP                                                                                                                                  | planejamento do Lote 4      | [esta síntese]          |
| D-11 | Corrigir a lógica do bypass dev (allowlist de `APP_ENV` + falhar o boot); P1 após a revisão cruzada                                                                                                                       | — (independe de Medicina)   | [SEC R1 + nota]         |
| D-12 | Exigir MFA para owner e perfis de saúde (Clerk)                                                                                                                                                                           | dado clínico                | [SEC D9]                |
| D-13 | Enum próprio de tipo de exame (hoje `exam_type` é compartilhado com `service_orders.os_type`)                                                                                                                             | Lote 2                      | [ARCH R6]               |
| D-14 | Remover a coleção Postman obsoleta (`postman/`) e atualizar o CLAUDE.md (última migration 0053, CD com migrations, sandbox)                                                                                               | —                           | [ARCH §6]               |

### Expedito (produto)

| #    | Decisão                                                                                                                            | Bloqueia           | Fonte              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ |
| E-01 | Quem **concede e revoga** a autorização de validar riscos; o profissional pode ser externo (clínica parceira)?                     | NOB-98 → PCMSO     | [LINEAR §4.7]      |
| E-02 | Perfis da V1: haverá login de RH, clínica e trabalhador? Portais de empresa e clínica entram no roadmap?                           | Lote 6             | [SEC D3, UX §9]    |
| E-03 | Empresa nova nasce com Medicina habilitada, passa por wizard, ou continua manual pelo owner? (Hoje nasce sem nada)                 | UX do Lote 1       | [ARCH §9]          |
| E-04 | Psicossocial: fica no PGR ("Gestão de Segurança") ou passa à Medicina? COPSOQ II substitui as perguntas livres?                    | MED-28             | [UX §9]            |
| E-05 | Posição única quando a especificação (13/10) e as planilhas/HTML (14/10) divergem (teste grátis, fadiga, contratos, preços duplos) | escopo comercial   | [PROTO V-02..V-07] |
| E-06 | Campos NIT/CTPS/salário em `employees`; `UNIQUE(org, cpf)` impede o mesmo trabalhador em duas empresas do escritório               | PPP / consultorias | [DB §9, UX §9]     |
| E-07 | Provedor de assinatura ICP-Brasil e modalidade                                                                                     | assinatura técnica | [DB §9]            |
| E-08 | Confirmar se a versão on-line do protótipo (artifact claude.ai) tem dados reais e o que fazer com eles                             | —                  | [PROTO D-12]       |

### Dr. Alcides (validação clínica)

| #    | Decisão                                                                                                                                                                      | Bloqueia              | Fonte                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------- |
| A-01 | Qual profissional pode validar riscos para o PCMSO e o que "validar" significa clinicamente                                                                                  | NOB-98 → PCMSO        | [LINEAR §4.7]        |
| A-02 | Significado, fonte oficial e versão da "Lista C". O protótipo declara Anexo II do Decreto 3.048/99, redação de 2009, parcial A15–K46, sem M e S/T. Classe ou subclasse CNAE? | NOB-113, Lote 3       | [PROTO §5.12]        |
| A-03 | Campos obrigatórios do ASO; o que é conclusão (visível ao escritório/RH) × dado clínico sigiloso; destino de `health_exams.notes` e `employees.blood_type`                   | Lote 4                | [SEC D4, DB §9]      |
| A-04 | O ASO pode listar riscos ainda **não validados** (com aviso), ou só riscos validados?                                                                                        | 1ª entrega de ASO     | [esta síntese]       |
| A-05 | Quem pode emitir ASO: só o médico examinador/clínica, ou também o escritório/empresa (o protótipo deixa a empresa emitir: R-05)                                              | Lote 4                | [PROTO D-04]         |
| A-06 | Regras clínicas do protótipo que viram requisito: periodicidade 12/24, dispensa do demissional 90/135, retorno ≥ 30 d, audiometria, fadiga, crônicos                         | PCMSO, painel         | [PROTO D-02]         |
| A-07 | Prazo de guarda (20 anos? 30 com amianto/ionizante?) e política de arquivamento, junto com o jurídico                                                                        | arquivamento (Lote 2) | [PROTO D-11, SEC D6] |
| A-08 | Grupo mínimo do psicossocial (5 fixo ou configurável ≥ 3) e se haverá texto livre                                                                                            | MED-28                | [PROTO D-09, SEC D7] |
| A-09 | Estados do documento médico (rascunho → em revisão → emitido → assinado → retificado/cancelado) e o conteúdo do snapshot                                                     | Lote 4/5              | [DB §10.3]           |

### Rikelvin (integração/segurança)

| #    | Decisão / ação                                                                                                                              | Bloqueia             | Fonte         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| R-01 | Retarget da #112 para develop, resolver o conflito do Postman, rodar CI. O corpo diz "rascunho", mas o GitHub não marca draft               | merge da #112        | [LINEAR §4.7] |
| R-02 | Persistência da revisão de riscos: tabela append-only (recomendado) × `GRANT UPDATE` por coluna                                             | P5                   | [DB §10.4]    |
| R-03 | A 0055 quebra leituras que dependem de `risks` (psicossocial `registerRiskInPgr`, OS, PDF)? Testar regressão antes do merge                 | merge da #112        | [SEC R10]     |
| R-04 | Atualizar o Linear: NOB-102/103/104 com PR mergeada; NOB-94 em Backlog bloqueando issues Done; NOB-100 Done com critério dependente da #112 | coerência do backlog | [LINEAR §4.6] |
| R-05 | Trilha de auditoria clínica (P9): revisar o desenho que o Carlos propuser                                                                   | Lote 2               | [SEC R3]      |
| R-06 | `medicos`, `accidents` e psicossocial entram no gate do módulo `medicine`?                                                                  | —                    | [SEC D5]      |

### Carlos (Medicina)

| #    | Decisão / ação                                                                                                 | Fonte                 |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------- |
| C-01 | Aprovar o escopo do FIRST-MVP (Lote 1, zero migration) antes de abrir branch                                   | esta síntese          |
| C-02 | Autorizar (ou não) o comentário de auditoria na NOB-98 (§2) e os links desta auditoria nas issues de Medicina  | regra 21 do enunciado |
| C-03 | Autorizar o commit desta pasta de documentação em branch `docs/` (hoje está **não rastreada** no working tree) | regra 8 do enunciado  |
| C-04 | As issues NOB-108/112/113 estão In Progress sem nenhum artefato. Anexar esta auditoria como evidência          | [LINEAR §4.3]         |

## 2. Texto proposto para comentar na NOB-98

> **Não publicado.** Precisa de autorização do Carlos (C-02). Comentar no Linear é ação visível ao time.

```
Auditoria da frente de Medicina (21/10), pergunta pendente da NOB-98.

A pendência está registrada só no corpo da PR #112 e em .specs/20261020-nob-98/spec.md:55-59
("Foi perguntado ao usuário quem pode conceder autorização de validação e como identificar o
profissional"). Não há registro de que chegou às partes interessadas, então formalizo aqui:

1. Quem pode marcar um risco (do PGR interno ou de PGR externo) como "validado" ou "rejeitado"
   para uso no PCMSO: só o médico coordenador do PCMSO daquela empresa, qualquer médico do trabalho
   cadastrado, ou outro papel? (Dr. Alcides)
2. Quem concede e revoga essa autorização: owner do escritório, o próprio coordenador, ou a
   plataforma? (Expedito)
3. Como o sistema identifica que o usuário logado é aquele profissional: vincular o cadastro de
   médicos (CRM + UF) a um usuário do Clerk? O profissional pode ser externo ao escritório?
   (Expedito + Douglas)
4. A autorização é por empresa-cliente ou vale para todo o escritório? Ao trocar o coordenador,
   as validações anteriores continuam valendo? (Dr. Alcides)
5. Validar exige nota obrigatória? Rejeitar exige motivo? (Dr. Alcides)

Enquanto isso, canUseMedicalRisk só libera riscos "validated" e a 0054 só aceita "pending",
então nenhum risco fica utilizável pelo PCMSO (comportamento correto até a decisão).
A mesma decisão trava a NOB-110 (ASO), a NOB-121 (permissões por vínculo) e a NOB-122 (clínica):
proposta de um dono só para a identidade profissional (decisão do Douglas).
Detalhe: docs/planning/medicina-ocupacional/AUDIT-LINEAR-QA.md §4.7.
```

## 3. Decisões já tomadas que esta auditoria **respeita** (não reabrir)

| Decisão                                                                   | Fonte                                    |
| ------------------------------------------------------------------------- | ---------------------------------------- |
| Módulos PGR/Medicina por empresa-cliente, independentes do plano free/pro | NOB-97, `.specs/20261020-nob-97/spec.md` |
| Cadastros comuns, sem cópia por módulo                                    | NOB-99                                   |
| Só o owner altera a habilitação, com motivo obrigatório                   | NOB-100                                  |
| `medicos` é catálogo do escritório, sem restrição por módulo              | spec NOB-97                              |
| Owner/colaborador **não** são presumidos responsáveis técnicos            | spec NOB-98, corpo da #112               |
| Fontes de risco imutáveis, sempre `pending` na entrada                    | 0054 da #112                             |
| Não reconstruir o gerador do PGR do Douglas                               | enunciado                                |
