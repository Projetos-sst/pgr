# Lote 07 — Homologação e preparação de publicação

> Navegação: [Índice da frente](../../README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md) ·
> [Decisões e bloqueios](../../geral/04-DECISOES-E-BLOQUEIOS.md) · [Arquitetura e contratos](../../geral/03-ARQUITETURA-E-CONTRATOS.md)

| Campo                    | Valor                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status do lote**       | **PLANEJADO** — parte contínua (isolamento, seed, testes) acompanha cada lote desde o 01; a homologação ponta a ponta depende dos Lotes 04/05/06                                                                                                                                               |
| Issues                   | [NOB-128 — Teste E2E completo (CNPJ → documentos)](https://linear.app/nobuggy/issue/NOB-128) · [NOB-129 — Testar geração/visualização/download/restrições](https://linear.app/nobuggy/issue/NOB-129) · [NOB-130 — Validar integrações e treinamento](https://linear.app/nobuggy/issue/NOB-130) |
| Status no Linear (21/10) | as três em Backlog, milestone 8, **sem responsável**                                                                                                                                                                                                                                           |
| Branch                   | nenhuma criada                                                                                                                                                                                                                                                                                 |
| PR                       | nenhuma                                                                                                                                                                                                                                                                                        |
| Migrations               | não se aplica (este lote não cria schema)                                                                                                                                                                                                                                                      |
| Próxima ação             | Definir responsável no Linear (decisão do Douglas). Enquanto isso, nada é executado por este lote                                                                                                                                                                                              |

## Objetivo

Provar, com evidência rastreável, que cada entrega de Medicina funciona ponta a ponta, respeita isolamento e autorização,
não regride o PGR, é responsiva e acessível, está documentada e foi validada pelos interessados — e preparar a
publicação sem confundir os estados abaixo.

## Estados que este lote controla (não confundir)

| Estado         | Significa                                                                                                                                | Evidência mínima                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **MERGED**     | PR mergeada em `develop`. **Pelo CD, as migrations do PR já foram aplicadas no banco de homologação** (`.github/workflows/cd.yml:67-75`) | link da PR + commit de merge + run do CD                                          |
| **HOMOLOGADO** | cenários deste lote executados no ambiente de homologação, com evidência, e validação dos interessados registrada                        | relatório do [QA](QA.md) + parecer do [REVIEW](REVIEW.md) + registro da validação |
| **PUBLICADO**  | release `develop → main` mergeado e deploy de produção concluído. **O merge em `main` aplica as migrations na produção**                 | PR de release + run do CD em `main` + verificação pós-deploy                      |

Regras:

- **Não marcar deploy em produção sem evidência.** Hoje `origin/main` está em `0052` e `develop` em `0053` (HIPÓTESE forte:
  produção em 0052). Ao fazer o release, 0053, 0054/0055 (se a #112 entrar) e as de Medicina chegam **juntas**.
- **Não há rollback de schema**: só migration para frente. Ensaiar o lote de migrations em cópia da produção antes do release.
- MERGED não implica HOMOLOGADO; HOMOLOGADO não implica PUBLICADO.

## Responsáveis

| Frente                                    | Quem                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Dono das issues de homologação            | **nenhum no Linear**; a definir (Douglas)                                                       |
| Execução dos cenários de Medicina         | quem implementar cada lote (Carlos), com revisão cruzada                                        |
| Validação clínica dos documentos e regras | Dr. Alcides                                                                                     |
| Validação de produto e treinamento        | Expedito                                                                                        |
| Pipeline, CD, release e ambiente online   | Douglas (NOB-127 "Publicar ambiente online para testes reais" está em Backlog, sem responsável) |
| Regressões de segurança/isolamento        | Rikelvin (revisão)                                                                              |

## Dependências

| Depende de                                                                                             | Situação                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Lotes [01](../01-ficha-saude-ocupacional/README.md)–[06](../06-clinicas-e-portais/README.md) entregues | nenhum entregue                                                      |
| Playwright no CI                                                                                       | **não roda** hoje (nenhum passo em `ci.yml`)                         |
| Seed de Medicina fictício                                                                              | inexistente (previsto no Lote 01)                                    |
| Isolation suite das tabelas de saúde                                                                   | inexistente (`runIsolationSuite` cobre 20 tabelas, nenhuma de saúde) |
| Ambiente online para testes reais                                                                      | NOB-127 em Backlog                                                   |

Linear: NOB-128 ← NOB-105, 109, 110, 123, 127; NOB-129 ← NOB-105, 109, 110, 118, 127; NOB-130 ← NOB-98, 107, 116, 117,
122, 128, 129 ([AUDIT-LINEAR-QA §4.3](../../AUDIT-LINEAR-QA.md)).

## Documentos do lote

| Arquivo                          | Conteúdo                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| [AUDIT.md](AUDIT.md)             | Infraestrutura de testes e CD existente, lacunas, riscos    |
| [PLAN.md](PLAN.md)               | Estratégia, matriz de cenários por lote, critérios de saída |
| [TASK.md](TASK.md)               | Tarefas (não iniciadas)                                     |
| [WALKTHROUGH.md](WALKTHROUGH.md) | NÃO INICIADO                                                |
| [QA.md](QA.md)                   | NÃO INICIADO — cenários planejados                          |
| [REVIEW.md](REVIEW.md)           | NÃO INICIADO — checklist                                    |

## Fontes da Fase 0

- [IMPLEMENTATION-PLAN.md — Lote 7 e regra de migrations](../../IMPLEMENTATION-PLAN.md)
- [GAP-MATRIX.md — MED-36](../../GAP-MATRIX.md)
- [AUDIT-LINEAR-QA.md §5 (QA existente), §6 (lacunas e mapa de 21 cenários), §5.7 (scripts do protótipo)](../../AUDIT-LINEAR-QA.md)
- [AUDIT-DATABASE.md §10.6 (CD e migrations automáticas)](../../AUDIT-DATABASE.md)
- [AUDIT-SECURITY.md §7, §10.4](../../AUDIT-SECURITY.md)
- [AUDIT-UX.md §6, §10.3 (acessibilidade e responsividade)](../../AUDIT-UX.md)
- [AUDIT-PROTOTYPE.md §5.14 (jornadas)](../../AUDIT-PROTOTYPE.md)
