# NOB-98 — fontes de riscos para Medicina

> Especificação histórica da primeira entrega. A decisão de autorização foi definida pela empresa-cliente e implementada no complemento de 21/10/2026: `.specs/20261021-nob-98-autorizacao/`. As pendências de autorização abaixo descrevem o estado anterior; a migration 0056 passa a permitir somente a atualização dos campos de revisão pelos profissionais autorizados.

Base: NOB-100 / PR #111. A geração do PCMSO é outra issue (NOB-109).

## Escopo implementado

- Fontes por empresa, internas (PGR existente) ou externas, com referência ao
  documento, versão, autor/data de registro e fingerprint do conteúdo.
- Captura interna por uma consulta SQL consistente: PGR, revisão, grupos de
  exposição, inventário e avaliação vigente. Nenhum dado pessoal de funcionário
  é copiado e nenhuma prescrição ou conclusão médica é inferida.
- Fonte externa: registro manual ou importação JSON estruturada; referência ao
  documento original pode identificar um arquivo já arquivado no GED. Não há
  extração automática de PDF nem download de URL externa.
- Riscos separados por grupo, categoria, descrição, função opcional e informações
  fornecidas na origem. Registro/importação sempre cria riscos pendentes.
- Status pendente/validado/rejeitado distintos; campos de responsável/data/nota
  preparados. Aprovação técnica indisponível até definir a concessão de autorização.
- Fontes e conteúdo são imutáveis para o runtime. Nova versão pode substituir uma
  fonte anterior da mesma empresa; a anterior continua no histórico.
- Consulta compara fingerprints em lote, detectando alterações mesmo sem aumentar
  o número da revisão; distingue origem ausente, modificada e substituída.
- Medicina consulta as fontes sem depender de um PCMSO. Empresa com apenas
  Medicina registra PGR externo sem contratar PGR. Consultar PGR interno vivo
  continua sujeito à habilitação PGR; se indisponível, a captura histórica permanece
  visível com aviso e sem liberação de uso automático.

## Migração e tabelas

0054 adiciona `medical_risk_sources`, `medical_risk_entries` e
`medical_risk_events`, com FKs compostas empresa/tenant e fonte/empresa/tenant.
Policies RLS exigem tenant e Medicina habilitada. INSERT de risco só aceita estado
pendente; runtime não tem UPDATE/DELETE dessas tabelas. Eventos append-only e
criação da fonte/riscos/evento acontecem na mesma transação.

0055 estende a habilitação PGR ao inventário, avaliações, medidas de controle,
avaliações ergonômicas e vínculos risco/EPI. Isso fecha as APIs que consultam
essas tabelas sem passar pelo documento PGR; GES/empresas/funcionários seguem comuns.

Aplicar 0054/0055 somente após 0053, primeiro em staging. Não altera tabelas médicas
existentes, Pro, Stripe ou preços. Não aplicar migration em produção nesta tarefa.

## Superfícies

- Action + GET/POST `/api/v1/companies/{id}/medical-risk-sources`.
- `/medical-risks`: empresas com Medicina; `/companies/{id}/medical-risks`:
  registro, importação estruturada e consulta de fontes/riscos.
- Paginação explícita de fontes. Revalidação de fontes internas em lote.
- JSON externo é lista de `{agentType,description,exposureGroup,jobRole?,
possibleInjuries?,exposureDescription?}`. Até 500 riscos por fonte; arquivo da
  interface até 2 MB. Status/aprovador não são aceitos na importação.

## Decisão técnica ainda pendente

O cadastro `medicos` não vincula profissional ao usuário autenticado. Foi perguntado
ao usuário quem pode conceder autorização de validação e como identificar o
profissional. Não considerar owner/colaborador automaticamente habilitado para
aprovar riscos. Enquanto não houver resposta, não há endpoint/botão de aprovação
ou rejeição. Não tratar esta issue como integralmente concluída.

Para concluir essa parte: implementar a concessão/revogação aprovada, conferir
autorização no servidor, gravar transições com ator/data/identificação/nota e
testar aprovação/rejeição, revogação, concorrência e versionamento. As colunas e
os rótulos disponíveis não equivalem a esse fluxo operacional.

## Plano e critérios

1. Schema e migration aditiva; nenhuma migração de produção.
2. Captura interna consistente e registro externo imutável, sempre pendente.
3. Actions/REST/UI, documentação e Postman.
4. Testar empresa apenas Medicina, tenant errado, origem alterada/removida,
   troca de avaliação sem nova revisão, versões e rejeição de status importado.
5. Lint, tipos, unitários, integração PostgreSQL real e build.

Constitution Check: mesma stack/infraestrutura, consultas nos repositórios,
autenticação por wrappers, tenant da sessão e RLS; zero regras médicas novas.
