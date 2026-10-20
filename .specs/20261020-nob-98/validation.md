# NOB-98 — validação

- Nove testes de integração específicos de fontes aprovados, incluindo HTTP,
  empresa apenas Medicina, importação sempre pendente, mudanças de risco e
  avaliação sem nova revisão, origem removida, histórico/substituição e RLS.
- Quatro testes unitários de entrada, estados, avisos e critérios de uso aprovados.
- Reteste conjunto após o reforço do inventário: quatro suítes / 24 testes,
  todos aprovados, sem ignorados. Inclui NOB-97/99/100/98.
- Suíte completa: 163 suítes / 1.267 testes de integração aprovados, sem falhas;
  cinco suítes / 14 testes ignorados pelas condições de ambiente existentes.
- Suíte unitária completa: 168 suítes / 1.685 testes aprovados, sem ignorados.
- Tipagem, formatação e build finais aprovados. Lint sem erros e com cinco
  avisos preexistentes; arquivos do reforço final conferidos novamente.
- Migrations 0053–0055 aplicadas somente em PostgreSQL 16.14 temporário, UTF-8,
  loopback. Nunca aplicadas em produção.

## Limitações explícitas

Testes com Gotenberg/PDF/GED reais, equipe e webhook de membros com integração
Supabase e o smoke de conexão real foram ignorados por falta das condições
específicas. Nove suítes adicionais continuam excluídas no `jest.config.ts` por
limitações já documentadas. Nenhum desses testes foi declarado aprovado.

O smoke exige especificamente `app_runtime` na porta de pooler 6543; o cluster
temporário usa uma porta local exclusiva, então essa condição não se aplica.

Não foi feito QA manual autenticado com Clerk no navegador. A importação é
estruturada e referenciada ao documento; não há extração automática de PDF.

## Critérios de aceite

- Disponibilização de riscos à Medicina para elaboração de PCMSO: implementada,
  sem exigir que PCMSO já exista. Consulta informa estado e avisos, sem aprovar.
- Origem/versão rastreáveis: implementadas com registro/ator/data, referência,
  captura imutável e fingerprint. Histórico preservado por novas versões.
- Ausência e atualização sem perda silenciosa: testes aprovados para origem
  removida, inventário vazio, versão substituída e mudanças sem nova revisão.
- Validação técnica e transições de aprovação/rejeição: **pendentes** da decisão
  sobre concessão de autorização e identidade profissional. Não há endpoint
  operacional de aprovação; owner não é presumido profissional habilitado.

Esta PR permanece em rascunho e a NOB-98 não está integralmente concluída.
