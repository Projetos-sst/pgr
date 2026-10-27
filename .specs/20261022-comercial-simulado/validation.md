# Validação comercial — 22/10/2026

Branch: codex/NOB-138-test/matriz-comercial-e-handoff. Base develop verificada: e6f25428051ad1cc5a6df57b97365e17c2c16b67, migration 0059. PRs #122–#135 em rascunho para develop; nenhum merge/deploy executado.

| Verificação                                                  | Resultado                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| npm run check após a correção de recuperação de sessão       | Aprovado: formatação, lint, tipagem, 192 suítes / 1.821 testes unitários                                        |
| Avisos do lint                                               | Quatro avisos anteriores de imagens; nenhum erro                                                                |
| Integração completa em PostgreSQL 16 temporário              | 189 suítes / 1.450 testes aprovados; cinco suítes condicionais e 14 testes ignorados, sem falha                 |
| Regressão após o ajuste de expiração/repetição               | Cinco suítes / 28 testes aprovados: checkout, gestão, avulsos, portal e matriz                                  |
| Drizzle check                                                | Aprovado                                                                                                        |
| Drizzle generate offline com conexão sintética não utilizada | Nenhum diferencial de schema                                                                                    |
| node scripts/validate-commercial-migrations.mjs              | Cadeia candidata 0060–0063, timestamps, prevId dos snapshots, 12 tabelas financeiras com RLS/policies/FKs       |
| Privilégios no banco temporário                              | Histórico append-only, FKs compostas, helpers SECURITY DEFINER com search_path fixo e execução pública revogada |
| Conferência visual isolada                                   | Seis telas × duas larguras (390×900, 1440×900), 12 combinações sem erro JavaScript/rolagem horizontal           |

A integração completa validou o conjunto 0056546, seguida da regressão direcionada da correção de expiração de checkout/portal. O check completo foi repetido após essa correção. O CI do HEAD publicado repete unitários, integração, build e renderização DOCX/PDF; conferir os quatro checks no [HEAD atual da PR #135](https://github.com/Projetos-sst/pgr/pull/135/checks). As PRs anteriores têm seus próprios quatro checks.

Nenhuma suíte foi excluída nesta entrega. As oito exclusões de integração prévias do jest.config.ts e os skips condicionais continuam documentados nessa configuração. Não foi realizada homologação com usuários reais do Clerk, adquirente, portal real ou conteúdo clínico.

O teste responsivo usou componentes/CSS reais com Actions e fixtures sintéticas em harness local isolado, sem criar rota de bypass no produto. Evidências em docs/qa/commercial/.

Antes de integrar, conciliar migrations candidatas com Carlos/NOB-112 e revisar a cadeia de PRs. Pendências externas: políticas/preços/cotas e gateway reais; consumo dos helpers pelos emissores futuros PCMSO/ASO e fluxos técnicos avulsos. Não declarar homologação real ou issues agregadoras Done apenas por haver testes do simulador.
