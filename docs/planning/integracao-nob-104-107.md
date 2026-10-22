# Integração NOB-104–107 na develop — 22/10/2026

## Problema e composição

As PRs foram mergeadas para branches dependentes e não entregaram seu conteúdo
à develop. Base observada: `15015faea65468a7511c586f337e7dc62954eaec`
(PR #120, Lote 01 da Medicina); última migration integrada: 0056.

| Issue   | PR   | Head funcional | Destino do merge original                  |
| ------- | ---- | -------------- | ------------------------------------------ |
| NOB-104 | #119 | 173e9cd        | codex/NOB-98-feat/riscos-para-medicina     |
| NOB-105 | #115 | 2601fc8        | codex/NOB-104-feat/maquinas-por-ambiente   |
| NOB-106 | #116 | 752e292        | codex/NOB-105-feat/rastreabilidade-geracao |
| NOB-107 | #117 | 6275d7c        | codex/NOB-106-docs/proposta-pgr-basico     |

Esta branch nasce da develop e mescla `88ab246` (merge original da #117), que
contém os quatro heads funcionais e sua cadeia. Sem cherry-pick, squash, cópia
isolada de SQL ou reimplementação. O merge automático não teve conflitos.

Transporta UI, Actions/REST, regras, repositórios, schema, templates, testes,
API/Postman e as migrations completas. O Lote 01 e a NOB-98 são preservados.
A navegação soma a oferta básica mantendo a entrada de Medicina. API/Postman
preservam os recursos das duas frentes. Não muda main, cobrança, CD ou segredos.

## Banco e cadeia do Drizzle

- 0057_machine_installations: instalações por empresa/obra/GES e eventos.
- 0058_pgr_basic_offers: versões, publicação e eventos da oferta básica.
- 0059_pgr_document_reviews: amostras e decisões de revisão.
- SQLs e snapshots idênticos ao head 6275d7c; journal anterior preservado,
  com acréscimo dos índices 57–59, sem renumeração ou timestamps novos.
- Cada snapshot encadeia com o anterior; índices/tags únicos. Os timestamps
  0057–0059 são crescentes e posteriores a todos os anteriores.
- Existe inversão histórica de timestamp 0026→0027, já presente na base. Não
  foi alterada. O migrador oficial passou do zero e no upgrade 0056→0059.
- Sete tabelas novas com RLS, policies, FKs e GRANTs. Runtime sem DELETE;
  históricos/versões imutáveis conforme as entregas originais.

Teste adicional `pgr-integration-migrations.test.ts` usa o migrador real do
Drizzle, e não apenas o helper que executa SQL. Cria bancos locais exclusivos,
recusa conexão que não seja loopback /sst_test, verifica registro no journal
real do banco, idempotência, RLS, policies, privilégios e FKs validadas. O upgrade
semeia dados fictícios de PGR, riscos externos e Medicina Lote 01 em 0056 e
compara os registros completos antes/depois. Não acessa banco de aplicação.

## Validação local

Checkout isolado `C:/Users/rikel/pgr-integration-20261022`. O checkout original
foi preservado: havia erro de leitura em pack Git na pasta sincronizada.
Dependências instaladas com npm ci, sem alteração de package/lockfile.

- npm run check: aprovado; 186 suítes / 1.796 testes unitários, tipos,
  formatação e lint sem erros. Quatro avisos antigos de imagens.
- Integração dirigida: 8 suítes / 77 testes, sem skips: ensaio Drizzle,
  NOB-98 e cinco suítes do Lote 01 (painel, funcionários, filtros,
  isolamento e HTTP).
- Suíte completa e CI da PR: resultados finais na descrição da PR.
- Não houve QA autenticado novo de Clerk/Storage nem homologação técnica humana.

## Rollout e liberação para NOB-112

PR de integração destina-se a develop. Abertura não significa integração,
homologação ou publicação. Merge somente após revisão e autorização explícita.

O pipeline oficial CD executa CI, baixa configuração de homologação, aplica
migrations com drizzle-kit e publica na Vercel. Merge em develop afeta o banco
de homologação; main afeta produção. Não aplicar SQL manualmente. As migrations
são aditivas; falha posterior de build não desfaz migration já aplicada. Correções
futuras seguem em migration aditiva, sem reescrever migrations executadas.

Depois da autorização e do merge, confirmar SHA remoto de develop, sucesso do
step de migrations e do deploy no CD. Não declarar banco migrado apenas por
existirem arquivos Git ou checks de PR. Nenhuma credencial ou banco real foi
acessado nesta preparação.

Até essa confirmação, a NOB-112 pode preparar seu código, mas a geração de nova
migration não está liberada nesta auditoria. Após integração/homologação,
atualizar origin/develop e gerar a próxima migration a partir do journal atual.
Se nenhuma outra migration tiver entrado, a seguinte será 0060. Não reservar
numeração nem produzir snapshot concorrente antes de alinhar com a equipe.
