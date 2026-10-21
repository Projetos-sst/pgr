# NOB-105 — mapeamento da emissão e pendências

> Atualização de 21/10/2026: implementados snapshot transacional, conferência de preenchimento, token contra alteração posterior, modo de prévia/geração conferida, UI/Action/REST e máquinas da NOB-104. Detalhes em `.specs/20261021-conclusao-pgr/nob-105.md`. Os itens abaixo documentam o levantamento anterior. Aprovação profissional e modelo integral não foram presumidos.

Status: etapa parcial. Não é declaração de conformidade técnica do PGR.

## Caminho atual

`getPgrConsolidated` + `getPgrDocxExtras` + metodologia da organização →
`buildPgrDocxContent` → `buildPgrDocxData` → template real → DOCX → conversor PDF.
`src/shared/server/platform/pgr-docx-core.ts` orquestra o fluxo; a rota binária é
`src/app/api/v1/pgr/[id]/docx/route.ts`. O worker utiliza o mesmo gerador.

## Matriz de aderência

| Grupo do modelo existente                                     | Fonte                                            | Situação                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Empresa e obra                                                | `pgr-consolidated.ts`, `companies`, `work_units` | Mapeado                                                                    |
| Responsáveis, emissão, vigência                               | Cabeçalho do PGR                                 | Mapeado; vínculo profissional/modalidade de assinatura dependem de NOB-101 |
| Revisões                                                      | `pgr_revisions`, extras                          | Mapeado ao conteúdo; não representa snapshot de todas as dependências      |
| GES, ambiente, funções e expostos                             | Consolidado e extras                             | Mapeado                                                                    |
| Físicos, químicos, ergonômicos e demais categorias existentes | `risks`, avaliação vigente                       | Mapeado; escala e critérios não alterados                                  |
| Medidas, ações e EPIs por risco                               | Consolidado                                      | Mapeado; ausência de dados não deve virar declaração de conformidade       |
| Treinamentos, textos e anexos de ações do template            | Extras e `build-data.ts`                         | Mapeamento existente documentado em `templates/pgr/README.md`              |
| Máquinas por ambiente e informações de segurança              | Relação não existente                            | Pendente de NOB-104 e definição técnica                                    |
| Demais anexos do modelo integral aprovado                     | Modelo não confirmado nesta etapa                | Comparar página a página após aprovação de NOB-93/94                       |

## Etapa implementada

Identificação do modelo por SHA-256 do binário, impressão digital dos dados
serializados usados em memória e hash dos bytes exportados. Horário UTC comum
ao instante usado na emissão impressa. Headers autenticados documentados no
README/API/Postman. Nenhuma migration ou requisito técnico novo.

O hash é diagnóstico, não assinatura, aprovação, validação de riscos ou revisão
legal. Os dados completos não são enviados nos headers. O fingerprint é da
serialização, sem promessa de equivalência semântica entre ordenações diferentes.
As leituras atuais continuam em transações próprias: um snapshot atômico e seu
histórico persistente precisam de uma próxima etapa antes de garantir reprodução
exata de uma emissão antiga. Não alterar silenciosamente o GED/assinaturas.

## Antes de concluir a issue

1. Confirmar versão, campos, tabelas e anexos do modelo com o responsável.
2. Aprovar campos obrigatórios e condições de ausência/não aplicabilidade. Não
   criar exigências por categoria, porte ou risco sem validação.
3. Distinguir visualização de rascunho e emissão final, preservando os downloads
   atuais até existir uma migração de comportamento aprovada.
4. Implementar a prechecagem única para HTTP e worker, com erros por campo.
5. Incorporar as máquinas do contexto aprovado na NOB-104.
6. Persistir snapshot/manifestações da emissão, autor, versão e ligação ao GED;
   impedir que uma mudança posterior reescreva o documento já assinado.
7. Avaliar/revalidar amostras na NOB-107.

Não transformar `missingTags` inteiro em bloqueio indiscriminado: existem campos
opcionais e defaults no modelo atual. Uma lista de obrigatórios precisa ser
aprovada, não deduzida do parser.

## Validação local

- 3 suítes / 91 testes unitários aprovados, incluindo template real no core,
  nome de arquivo, métodos PDF mockados, mapeamento e alterações de origem.
- 2 suítes / 12 testes de integração aprovados: HTTP e geração com PostgreSQL
  temporário e template/motor reais. Conversor PDF e Storage mockados.
- Tipagem aprovada. Conversão PDF real e QA visual/autenticado não executados.
- Critérios de geração parcial: existentes e exercitados. Mapeamento integral,
  bloqueios técnicos aprovados e histórico durável: **pendentes**.
