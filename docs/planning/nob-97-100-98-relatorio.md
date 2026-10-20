# Entrega progressiva — NOB-97, NOB-99, NOB-100 e NOB-98

Data: 2026-10-20. Projeto: `C:\Users\rikel\OneDrive\Desktop\pgr`.
Base inicial: `98a2600` (`develop`), sem alterações de código preexistentes.
O planejamento anterior em `.specs/20261020-nob-97-101` foi preservado localmente.

## Regras adotadas

Serviços por empresa-cliente, independentes do plano Pro. Somente owner altera
habilitações; equipe interna opera/consulta conforme as permissões existentes.
Empresas antigas mantêm ambos os serviços pela migration; empresas novas começam
sem módulos. Nenhuma mudança em preços, checkout, trial, cobrança ou Stripe.

## Entregas e ordem de revisão

| Issue   | Entrega                                                                                                                                                                  | PR e dependência                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| NOB-97  | Catálogo de módulos, habilitações, histórico, migração de preservação e RLS para PGR/revisões/vínculos/exames; navegação de Medicina separada                            | [#109](https://github.com/Projetos-sst/pgr/pull/109), base develop                |
| NOB-99  | Mesmos cadastros e IDs de empresa/funcionário; filtros de serviço nos formulários, Action e REST                                                                         | [#110](https://github.com/Projetos-sst/pgr/pull/110), depende de #109             |
| NOB-100 | Gestão de serviços pelo owner, consulta pela equipe, motivo e histórico transacional, interface e GET/PUT                                                                | [#111](https://github.com/Projetos-sst/pgr/pull/111), depende de #110             |
| NOB-98  | Captura interna, registro/importação externa, consulta em Medicina sem PCMSO, origem/versão/fingerprint, avisos de alteração/ausência e bloqueio de aprovação automática | PR própria em preparação, depende de #111; validação técnica operacional pendente |

As PRs permanecem em rascunho para revisão da equipe. Não foram mescladas nem
implantadas. O CI atual só dispara para destino develop/main. Depois de integrar
a base, alterar a base da PR seguinte para develop e conferir seus checks antes
de aprovar. Não interpretar o CI da PR base como execução do CI das demais.

## Arquivos e tabelas principais

- NOB-97: `domains/platform/company-modules`, schemas `company-modules`,
  `module-policy`, `pgr`, `health-exams` e `companies`; repositórios PGR/exames;
  navegação. Migration **0053** cria `company_modules` e `company_module_events`.
- NOB-99: repositórios/Actions de empresas e funcionários; formulários de PGR e
  exames; filtros REST e coleção Postman. Sem nova tabela/migration.
- NOB-100: `server/platform/company-module-core`, Action de serviços, repositório
  de habilitações, página `/companies/{id}/services` e API `/modules`. Reutiliza
  tabelas da 0053, sem alterar contratos financeiros.
- NOB-98: domínio/repositório/core/Actions de fontes de riscos, páginas
  `/medical-risks` e `/companies/{id}/medical-risks`, API `/medical-risk-sources`.
  Migration **0054** cria `medical_risk_sources`, `medical_risk_entries` e
  `medical_risk_events`, com FKs compostas e RLS. **0055** estende a proteção de
  PGR ao inventário de riscos, avaliações, medidas e vínculos, cobrindo APIs diretas.

Todas as novas superfícies usam as camadas existentes. SQL fica em repositórios;
o tenant vem do contexto autenticado. Dados pessoais dos funcionários não são
copiados para o inventário médico, e não há inferência/prescrição clínica.

## Validação executada

- NOB-97: 167 suítes / 1.681 unitários; integração dirigida de PGR/exames/módulos
  (28 casos) e backfill (cinco casos, sobrepostos aos anteriores); lint/tipos/build
  aprovados. Os três jobs do GitHub da #109 passaram.
- NOB-99: três suítes / 23 testes de integração de empresas, funcionários e
  compartilhamento; tipos/lint dirigido aprovados.
- NOB-100: três suítes / 15 testes de integração; reteste dos sete casos de
  gerenciamento aprovado, incluindo owner/colaborador/cliente, HTTP, tenant,
  concorrência, idempotência e rollback quando a auditoria falha.
- NOB-98: nove testes dirigidos de integração e quatro unitários aprovados.
- Ensaio conjunto: **168 suítes / 1.685 testes unitários aprovados**; lint aprovado
  com cinco avisos preexistentes; `npm run format:check`, tipagem e build aprovados.
- Integração conjunta completa: **163 suítes / 1.267 testes aprovados**, sem
  falhas; cinco suítes / 14 testes ignorados por condições de ambiente.
- Reteste de segurança: quatro suítes / 24 testes aprovados após fechar o acesso
  ao inventário. Tipagem, formatação, lint dirigido e build confirmados novamente.

As migrations foram aplicadas somente a clusters PostgreSQL 16.14 temporários,
em loopback, sem serviço Windows instalado. O primeiro cluster teve falha de
encoding; os ensaios aprovados usam UTF-8. O Jest pode avisar sobre conexões
ociosas; as execuções dirigidas encerraram normalmente após o timeout do pool.
O primeiro build foi bloqueado pelo download de Google Fonts; a retentativa com
rede autorizada passou usando configurações fictícias do CI.

Não houve teste manual com sessão Clerk real no navegador. A configuração Jest
mantém nove suítes de integração preexistentes excluídas por limitações conhecidas;
a entrega não removeu nem mascarou essa exclusão.

Os 14 testes ignorados cobrem PDF/GED com serviços reais, Gotenberg, equipe,
webhook de membros e smoke de conexão. Não houve configuração desses serviços
externos; esses casos não foram declarados aprovados.

## Pendência obrigatória da NOB-98

Falta definir quem concede autorização de validação e como identificar o
profissional no usuário autenticado (o cadastro atual de médicos não tem esse
vínculo). A pergunta foi enviada ao usuário. Owner ou colaborador **não** foi
considerado automaticamente responsável técnico.

Registro/importação sempre produz estado pendente. O banco impede inserir risco
aprovado pelo runtime e impede alterar/deletar os snapshots. Há estados e campos
preparados para revisão, mas **não há fluxo operacional de aprovar/rejeitar** até
a definição da autorização. Não considerar a NOB-98 integralmente concluída.

## Homologação e riscos restantes

1. Revisar migrations 0053–0055 e executar em staging, na ordem. Conferir o
   backfill dos dois serviços para todas as empresas existentes.
2. Validar empresa nova sem módulos; owner habilita um serviço e colaborador
   opera somente o serviço correspondente. Revogar preserva os registros.
3. Validar edição dos cadastros comuns nos dois módulos e referências por tenant.
4. Em empresa apenas Medicina, registrar fonte externa e conferir todos os riscos
   pendentes; alterar PGR interno e conferir aviso de conteúdo desatualizado.
5. Definir autorização técnica, implementar/testar revisão e só então liberar
   aprovação/rejeição e uso dos riscos validados no fluxo PCMSO.
6. Realizar QA autenticado e integrar as PRs na ordem, após os checks aplicáveis.

Sem migration em banco real, merge, deploy ou alteração de regras financeiras.
