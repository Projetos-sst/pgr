# NOB-107 — revisão de código e cobertura

Registro histórico da etapa inicial. A continuação operacional está descrita em
`../20261021-conclusao-pgr/nob-107.md`, com amostras no GED, parecer recebido,
controle de concorrência e histórico imutável. Aprovação técnica real permanece
dependente do profissional responsável.

## Escopo

Revisada a PR #117 e seu caminho real: repositório consolidado, extras,
mapeamento DOCX, template e rota de download. A branch foi atualizada com
develop preservando os commits e sem duplicar a PR.

## Constatações

- As leituras usam o tenant e os GES vinculados ao PGR; acrescentada prova para
  outra empresa do mesmo escritório e GES não vinculado, além de tenant diferente.
- Valores quantitativos vêm da avaliação vigente, com unidade e limite
  persistidos; acrescentada prova de regeneração após avaliação posterior,
  sem reutilizar referência antiga do risco. Nenhum limite técnico foi definido.
- Acrescentada prova de presença e ordenação das notas de revisão.
- Os cinco casos originais continuam cobrindo categorias, avaliação ausente e
  correção de descrição sem alteração dos bytes do arquivo já exportado.
- A primeira execução dos novos cenários encontrou um dado de teste incompleto
  (`work_units.description` obrigatório); fixture corrigida, sem mudar a regra
  do banco ou tornar o campo opcional para passar no teste.

Não se constatou nesses cenários uma divergência que justificasse alterar
classificações, cálculos ou layout do produto. Isso não equivale a auditoria de
todo o sistema nem a parecer técnico do PGR.

## Limites

Validação executada: tipagem aprovada e 3 suítes / 20 testes de integração
aprovados em PostgreSQL temporário (8 cenários de revisão, 6 de geração e 6 de
HTTP). Nenhum skip nessas suítes. O CI anterior da PR estava aprovado; novos
commits exigem nova execução antes de considerar a versão atual validada no CI.

O arquivo anterior é preservado em memória pelo teste; isso não comprova um
histórico durável no GED. A NOB-105 documenta esse ponto. Metodologia aprovada,
anexos integrais, máquinas, autoria profissional e aprovação humana continuam
pendentes. Conversão PDF real e revisão visual/autenticada não executadas.
Não enviar documentos a terceiros sem instrução expressa do usuário.

## Critérios de encerramento

Preparação/cobertura automática podem ser revisadas na PR. Os critérios de
avaliação técnica, correção de divergências apontadas por profissional e
revalidação de documentos só podem ser encerrados com seus respectivos pareceres.
NOB-107 permanece em andamento, sem simular aprovação ou assinatura.
