# 02 · Roadmap e status dos lotes

> **Documento dinâmico.** Atualizar ao mudar o estado de qualquer lote. Última atualização: **2026-10-21**,
> pelo coordenador (Claude), na organização documental pós-Fase 0.
> Fonte da divisão em lotes: [`../IMPLEMENTATION-PLAN.md`](../IMPLEMENTATION-PLAN.md) (Fase 0). Este roadmap **não** cria
> um plano paralelo, só acompanha aquele.

## Estados permitidos

| Estado | Significado | Evidência mínima exigida |
|---|---|---|
| `PLANEJADO` | Escopo documentado, sem implementação | Pasta do lote com README/PLAN/TASK |
| `EM_EXECUCAO` | Trabalho em andamento | Commit na branch do lote ou decisão em coleta |
| `BLOQUEADO` | Não pode avançar | Decisão ou dependência registrada em [04](04-DECISOES-E-BLOQUEIOS.md) |
| `EM_QA` | Implementação completa em teste | QA.md do lote com o ambiente e os cenários em execução |
| `EM_REVISAO` | Revisão de código em curso | REVIEW.md do lote aberto |
| `PR_ABERTA` | PR aberta para develop | Número da PR |
| `MERGED` | Mergeado em `develop` (o CD aplica as migrations na **homologação**) | SHA do merge |
| `HOMOLOGADO` | Validado em homologação pelos interessados | Registro da validação (quem, quando) |
| `PUBLICADO` | Em produção, via release `develop → main` (o CD aplica as migrations na **produção**) | SHA em `main` + run do CD |

**`MERGED` ≠ `HOMOLOGADO` ≠ `PUBLICADO`.** Nenhum estado é marcado sem a evidência da coluna da direita.

## Antecedente

**Fase 0, entregue como documentação em 2026-10-21:** auditoria com 6 subagentes. Documentos na raiz desta pasta
(`AUDIT-*.md`, `GAP-MATRIX.md`, `DECISIONS.md`, `DEPENDENCIES.md`, `IMPLEMENTATION-PLAN.md`, `FIRST-MVP.md`).

## Tabela de lotes

| Lote | Nome | Objetivo | Issues Linear | Responsável | Estado | Dependências | Branch | PR | CI | Início | Conclusão | Próxima ação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [00](../lotes/00-alinhamento-e-contratos/README.md) | Alinhamento e contratos | Fechar as decisões que destravam os lotes 02–05 sem bloquear o 01 | NOB-98 (Rikelvin), NOB-108 | Carlos (registro); decisões de Douglas, Expedito, Dr. Alcides; Rikelvin na #112 | `EM_EXECUCAO` | — | — (frente documental; usa a branch do Lote 01 para os docs) | — | — | 2026-10-21 | — | Carlos autorizar a publicação do comentário de atualização na NOB-98 ([04 §3](04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado)) |
| [01](../lotes/01-ficha-saude-ocupacional/README.md) | Ficha de saúde ocupacional | Painel da Medicina + ficha do funcionário + registro e recuperação de exame, **zero migration** | NOB-108 | Carlos | `PLANEJADO` | Nenhuma de produto ou técnica. Aceite do Douglas ao escopo pendente (MED-DEC-25): recomendado antes do código, obrigatório na revisão da PR | `feature/NOB-108-ficha-saude-ocupacional` (criada em 2026-10-21; só o commit de documentação) | — | — | — | — | Executar o [TASK do Lote 01](../lotes/01-ficha-saude-ocupacional/TASK.md), item 1 (pré-check Git) |
| [02](../lotes/02-formularios-e-auditoria/README.md) | Formulários e auditoria | Procedimentos, `company_id` histórico do exame, trilha de auditoria clínica, preservação de registros | NOB-112 | Carlos | `PLANEJADO` | MED-DEC-08 (ordem e numeração das migrations, depende da #112); MED-DEC-15 (retenção) só para o arquivamento | — | — | — | — | Aguardar MED-DEC-08 |
| [03](../lotes/03-identidade-e-riscos/README.md) | Identidade e riscos | Identidade profissional, designação por empresa, validação de riscos (com o Rikelvin), PGR externo, Lista C | NOB-111, NOB-113, NOB-121 (+ NOB-98, Rikelvin) | Carlos; validação de riscos com o Rikelvin | `BLOQUEADO` (parcial) | MED-DEC-01…07 (autorização: parcialmente respondida); MED-DEC-10 (dono da identidade); MED-DEC-13 (fonte da Lista C); merge da #112 | — | — | — | — | Coletar respostas das MED-DEC-02…07 |
| [04](../lotes/04-aso/README.md) | ASO | Emissão de ASO com snapshot imutável no GED; assinatura técnica quando houver provedor | NOB-110 | Carlos; desenho da emissão com o Douglas | `PLANEJADO` | Lote 03 (identidade); MED-DEC-12 (camada de emissão); MED-DEC-14 (campos e emissor); MED-DEC-19 (ICP-Brasil) | — | — | — | — | Aguardar Lote 03 e MED-DEC-12 |
| [05](../lotes/05-pcmso/README.md) | PCMSO | Programa, versões, plano de exames e documento a partir de riscos **validados** | NOB-109 | Carlos | `BLOQUEADO` | NOB-98 completa (fontes mergeadas + validador + revisão); Lote 03; Lote 04 (camada de emissão) | — | — | — | — | Aguardar NOB-98 |
| [06](../lotes/06-clinicas-e-portais/README.md) | Clínicas e portais | Profissionais, clínicas, encaminhamentos e portais, conforme o escopo do produto | NOB-121, NOB-122, NOB-123 | Carlos | `BLOQUEADO` | MED-DEC-21 (perfis e portais V1, Expedito); papel clínico | — | — | — | — | Aguardar MED-DEC-21 |
| [07](../lotes/07-homologacao/README.md) | Homologação | Jornadas ponta a ponta, segurança, regressão, a11y, validação com interessados, preparo de publicação | NOB-128, NOB-129, NOB-130 | sem responsável no Linear | `PLANEJADO` | Lotes funcionais entregues | — | — | — | — | Definir o responsável no Linear (Douglas) |

Backlog fora dos lotes: NOB-120 (teleconsulta) e NOB-125 (IA de Medicina), conforme
[`../IMPLEMENTATION-PLAN.md`](../IMPLEMENTATION-PLAN.md#backlog-posterior).

## Status por issue do Carlos (Linear, consulta de 2026-10-21)

| Issue | Lote | Status no Linear | Observação |
|---|---|---|---|
| [NOB-108](https://linear.app/nobuggy/issue/NOB-108) | 01 | In Progress | Sem PR. Branch criada em 21/10 |
| [NOB-112](https://linear.app/nobuggy/issue/NOB-112) | 02 | In Progress | Sem artefato além da auditoria |
| [NOB-113](https://linear.app/nobuggy/issue/NOB-113) | 03 | In Progress | Aguarda fonte oficial (Dr. Alcides) |
| [NOB-111](https://linear.app/nobuggy/issue/NOB-111) | 03 | Backlog | Reescopo proposto sobre a #112 (MED-DEC-10) |
| [NOB-121](https://linear.app/nobuggy/issue/NOB-121) | 03 (identidade) / 06 (psicólogos) | Backlog | — |
| [NOB-110](https://linear.app/nobuggy/issue/NOB-110) | 04 | Backlog | — |
| [NOB-109](https://linear.app/nobuggy/issue/NOB-109) | 05 | Backlog | Bloqueada pela NOB-98 |
| [NOB-122](https://linear.app/nobuggy/issue/NOB-122) | 06 | Backlog | — |
| [NOB-123](https://linear.app/nobuggy/issue/NOB-123) | 06 | Backlog | — |
| [NOB-120](https://linear.app/nobuggy/issue/NOB-120) | backlog | Backlog | — |
| [NOB-125](https://linear.app/nobuggy/issue/NOB-125) | backlog | Backlog | Sem dado de saúde em IA (MED-DEC-20) |

Nenhum status do Linear foi alterado nesta organização. Mapa completo em [09](09-LINEAR-E-RESPONSAVEIS.md).

## Histórico de mudanças de estado

| Data | Lote | De → para | Evidência |
|---|---|---|---|
| 2026-10-21 | 00 | — → `EM_EXECUCAO` | Resposta parcial do Expedito (MED-DEC-01) e registro de decisões aberto |
| 2026-10-21 | 01 a 07 | — → estado inicial da tabela | Estrutura de lotes criada a partir de `IMPLEMENTATION-PLAN.md` |
