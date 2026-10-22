# IMPLEMENTATION-PLAN: lotes da Medicina Ocupacional

> Proposta do coordenador, 2026-10-21, ajustada às dependências **reais** encontradas na auditoria. Não é decisão:
> a ordem de merge, a numeração de migrations e a camada de emissão dependem do Douglas; as regras clínicas
> dependem do Dr. Alcides; o produto depende do Expedito. Nada aqui atribui trabalho do Douglas ou do Rikelvin
> sem o aceite deles.

## O que mudou em relação à hipótese inicial do enunciado

1. **A "Lista C" não bloqueia o ASO.** O dado real do protótipo é a Lista C do Anexo II do Decreto 3.048/99 (NTEP: CID ×
   CNAE), não um catálogo de exames. Ela alimenta afastamentos/NTEP e a seção de vigilância NTEP do PCMSO. No Linear, a
   NOB-110 (ASO) aparece "bloqueada por" NOB-113. A recomendação é confirmar com o Dr. Alcides o significado (a própria
   NOB-113 pede isso) e, se confirmado, **remover essa dependência** (decisão do Douglas).
2. **O Lote 1 pode e deve ser zero migration.** A #112 já reservou 0054/0055, e o merge em develop aplica a migration no
   banco de homologação sem passo manual (`cd.yml:67-75`). Qualquer migration de Medicina antes de resolver a #112 obrigaria
   a regerar os snapshots dela.
3. **A identidade profissional é o gargalo comum.** A mesma decisão ("quem é o médico logado e o que ele pode fazer em qual
   empresa") trava a NOB-98 (validar riscos), a NOB-110 (assinar/emitir ASO), a NOB-109 (coordenador do PCMSO), a NOB-121
   (permissões por vínculo) e a NOB-122 (clínica). Ela precisa de **um dono só**. A recomendação é a NOB-121 (Carlos)
   modelar a identidade e a NOB-98 (Rikelvin) consumir, mas a decisão é do Douglas.
4. **A NOB-111 se sobrepõe à #112.** A fonte `external` já existe lá. A recomendação é reescopar a NOB-111 para a UX
   do PGR externo, o upload no GED e o vínculo de documento, sobre o contrato da #112.

## Lotes

### Lote 0: compatibilidade, contratos e decisões (sem código de Medicina)

| Item                                                                                                    | Dono                                          | Resultado esperado                                                                                   |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Registrar no Linear a pergunta pendente da NOB-98 (texto pronto em DECISIONS.md §2)                     | Carlos, **com autorização do usuário**        | Pergunta formal com destinatários: Expedito, Dr. Alcides, Douglas                                    |
| Retarget da #112 para develop, resolver o conflito do Postman, rodar CI                                 | Rikelvin                                      | CI verde na #112                                                                                     |
| Decidir se a #112 entra antes de qualquer migration de Medicina e se a 0055 é aceita                    | Douglas (+ Expedito para o efeito de produto) | Ordem de merge registrada                                                                            |
| Decidir o dono da identidade profissional (NOB-121 × NOB-98) e reescopar a NOB-111                      | Douglas + Carlos + Rikelvin                   | Issues ajustadas, sem duplicação                                                                     |
| ADR: RLS compartilhado × banco por cliente (a especificação do protótipo pede banco por cliente)        | Douglas                                       | Decisão registrada (recomendação: A agora, evoluindo para B na camada clínica; AUDIT-SECURITY §10.3) |
| Atualizar status do Linear (NOB-102/103/104 com PR mergeada; NOB-94 em Backlog bloqueando issues Done)  | Rikelvin/Douglas                              | Linear coerente com o GitHub                                                                         |
| Fora da Medicina, mas registrado: allowlist do bypass dev (R1, P1); texto livre de acidente no LLM (R5) | Douglas/Rikelvin                              | Issue própria, se aceito                                                                             |

### Lote 1: estrutura real da Medicina (NOB-108), **zero migration**

É o primeiro MVP demonstrável. Detalhe em FIRST-MVP.md.

| Item                                                                                                  | Funcionalidades     |
| ----------------------------------------------------------------------------------------------------- | ------------------- |
| Painel `/medicine` com seletor de empresa habilitada e lista de funcionários                          | MED-07              |
| Seção "Saúde ocupacional" em `/employees/[id]`                                                        | MED-06              |
| Gating e estados vazio/erro/loading; erro ≠ vazio em `/health-exams` e `/medicos`; filtro por empresa | MED-08, MED-05 (UI) |
| Seed de Medicina para testes (dados fictícios) + testes de isolamento das leituras novas              | MED-36              |

**Pode começar já**: não depende da NOB-98, de decisão clínica, de migration nem da #112. A única ressalva é um conflito trivial
em `nav-menu.tsx` com a #112.

### Lote 2: abas, formulários e persistência (NOB-112)

Primeiras migrations. Começa **depois** da decisão do Lote 0 sobre a ordem e a numeração das migrations.

| Item                                                                                               | Migration (proposta AUDIT-DATABASE §10.4)                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Mapa campo → entidade → documento das abas do protótipo (entregável da NOB-112)                    | —                                                                                         |
| Catálogo de procedimentos + procedimentos por exame, **sem valores de resultado**                  | P4                                                                                        |
| `health_exams.company_id` (empresa na data do exame, desacoplando da transferência do funcionário) | ALTER                                                                                     |
| Trilha de auditoria clínica append-only                                                            | P9                                                                                        |
| Arquivamento no lugar de DELETE físico/CASCADE de exames                                           | ALTER + troca de FK; **só depois** da decisão de prazo de guarda (Dr. Alcides + jurídico) |

### Lote 3: riscos externos e referência técnica (NOB-111, NOB-113, integração com a NOB-98)

| Item                                                                                         | Dependência                                                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Identidade profissional + designação por empresa (P1)                                        | **Decisão da pergunta da NOB-98**. Destrava a revisão de riscos do Rikelvin                         |
| NOB-111 reescopada: UX do PGR externo sobre a #112 + documento no GED                        | #112 mergeada                                                                                       |
| Revisão de riscos append-only (P5)                                                           | P1 + decisão. Dono: Rikelvin (NOB-98), com apoio do Carlos                                          |
| Dataset global da Lista C com procedência e importador idempotente (P2), padrão `caepi-sync` | Fonte oficial confirmada pelo Dr. Alcides. A base do protótipo serve **só** como teste de regressão |

### Lote 4: ASO (NOB-110)

| Item                                                                                                                 | Dependência                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Camada de emissão com snapshot imutável e hash (P7), reaproveitando GED, `jobs`, worker, Gotenberg e template-engine | **Desenho aprovado pelo Douglas**, que é dono do pipeline. Não reconstruir o gerador do PGR                                |
| Template DOCX do ASO por script, no padrão `scripts/pgr-docx`                                                        | Campos obrigatórios definidos (Dr. Alcides)                                                                                |
| Ciência do trabalhador (registry de assinatura, `target_type` novo)                                                  | —                                                                                                                          |
| Histórico de função (P3), para que o ASO use a função da data                                                        | —                                                                                                                          |
| Assinatura técnica ICP-Brasil (P8)                                                                                   | Provedor escolhido (Expedito + Douglas). Até lá, o ASO sai como **"emitido, sem assinatura técnica"**, nunca como assinado |

**O ASO pode ter uma primeira entrega independente do PCMSO completo?** Tecnicamente sim: o snapshot do ASO pode registrar
exame, aptidão, médico e procedimentos sem uma versão de PCMSO. O ponto que **não** é técnico é a seção de riscos do ASO.
Ela precisa vir de uma fonte da NOB-98 **validada**, ou então de uma decisão clínica explícita autorizando listar riscos
ainda não validados com aviso. Pergunta para o Dr. Alcides (DECISIONS.md, A-04).

### Lote 5: PCMSO (NOB-109)

Começa só com a NOB-98 completa: fontes mergeadas, validador definido e revisão implementada.

| Item                                                                               | Dependência                                                |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Programa, versões e plano de exames por GES/função (P6)                            | P1, P4, P5, P7                                             |
| Documento do PCMSO                                                                 | Seção de vigilância NTEP só com a Lista C oficial (Lote 3) |
| Emissão bloqueada se alguma fonte usada não estiver validada no momento da emissão | —                                                          |

### Lote 6: profissionais, clínicas e integrações (NOB-121, NOB-122, NOB-123)

| Item                                  | Dependência                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Psicólogos; clínicas; encaminhamentos | Decisão de portais e perfis (Expedito)                                                                                 |
| Portais de empresa e clínica          | Escopo por empresa (`scoped_company_id` hoje não é aplicado) e papel clínico (AUDIT-SECURITY R2, P0 para dado clínico) |

### Lote 7: homologação (NOB-128, NOB-129, NOB-130)

| Item                                                    | Observação                           |
| ------------------------------------------------------- | ------------------------------------ |
| E2E ponta a ponta, restrições de download e treinamento | Hoje sem responsável no Linear       |
| Playwright no CI                                        | Hoje não roda (AUDIT-LINEAR-QA §5.5) |

### Backlog posterior

| Item                                                          | Observação                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| NOB-120 Teleconsulta                                          | —                                                                                           |
| NOB-125 IA de Medicina                                        | **Nenhum dado de saúde em prompt** até decisão do Douglas e do jurídico (AUDIT-SECURITY D8) |
| Afastamentos/NTEP, PPP, FAP/RAT, fadiga, crônicos, prontuário | Fora do MVP (GAP-MATRIX MED-29…37)                                                          |

## Respostas pedidas pelo enunciado

| Pergunta                                                             | Resposta                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Podemos liberar navegação e formulários antes da resposta da NOB-98? | **Sim.** Os Lotes 1 e 2 não leem riscos: usam cadastros, exames e procedimentos. O que espera a NOB-98 é tudo que **consome risco validado**: PCMSO, a seção de riscos do ASO e a validação                                                                                       |
| Quando precisamos da Lista C?                                        | No Lote 3 (dataset) e no Lote 5 (seção NTEP do PCMSO). Não para o Lote 1, nem para o Lote 2, nem para o registro de exames                                                                                                                                                        |
| Quais documentos não podem ser emitidos sem validação técnica?       | **PCMSO** (exige riscos validados + coordenador designado). **ASO como documento assinado** (exige profissional identificado + assinatura técnica). Relatório psicossocial, kit INSS e requerimento NTEP também levam assinatura de profissional no protótipo e estão fora do MVP |
| O que pode começar imediatamente?                                    | Lote 1 (Carlos) e, em paralelo, o Lote 0 (decisões) + retarget/CI da #112 (Rikelvin)                                                                                                                                                                                              |
| O que não pode começar ainda?                                        | Lotes 2 a 5 com migration (até a ordem de merge da #112), P5/P6 (até a resposta da NOB-98), P2 (até a fonte da Lista C), arquivamento (até o prazo de guarda), P8 (até o provedor)                                                                                                |

## Paralelismo seguro

| Frente                                                                           | Pessoa               | Toca em                         | Conflito com a Medicina                                     |
| -------------------------------------------------------------------------------- | -------------------- | ------------------------------- | ----------------------------------------------------------- |
| Lote 1                                                                           | Carlos               | UI + leituras, zero migration   | Só a lista do `nav-menu.tsx` com a #112                     |
| #112: retarget, CI, merge                                                        | Rikelvin             | 0054/0055, `domains/medicine/*` | Reserva de numeração; nenhum arquivo do Lote 1 além do menu |
| DS: unificar `StatusBadge`/`ListCard`, contraste AA das pílulas, token de acento | Douglas (se aceitar) | `_ui`, `globals.css`            | Lote 1 deve consumir a primitive unificada; combinar ordem  |
| Lista C                                                                          | Dr. Alcides          | conteúdo                        | nenhum                                                      |

**Regra para todo lote com migration:** uma migration por PR, gerada com `drizzle-kit generate` depois de rebase em develop,
`when` maior que o último, aditiva (sem DROP nem NOT NULL em coluna existente), estados novos em `text` + CHECK (não enum,
porque o drizzle aplica as pendentes numa transação só) e ensaio em Postgres efêmero antes do merge. **O merge em develop é a
aplicação em homologação; o release para main é a aplicação em produção.**
