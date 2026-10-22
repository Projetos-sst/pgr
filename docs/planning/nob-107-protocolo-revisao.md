# NOB-107 — protocolo e registro de revisão técnica

Atualização: o fluxo operacional de amostras imutáveis e pareceres recebidos foi
implementado na continuação da PR #117. Consulte
`../../.specs/20261021-conclusao-pgr/nob-107.md`. O protocolo abaixo descreve a
preparação inicial; não substitui a revisão humana, que permanece pendente.

Status: preparação de casos; **nenhuma aprovação técnica registrada**.
Não há profissional avaliador nomeado ou parecer fornecido nesta etapa.

## Casos representativos reproduzíveis

`src/__tests__/integration/pdf/pgr-review-samples.test.ts` utiliza PostgreSQL
temporário, cadastros fictícios, gerador e template DOCX reais. Não acessa dados
reais nem envia documentos a profissionais. O logo é mockado; não converte PDF.

| Caso                   | Preparação                                          | Evidência automática                                                                 | Revisão humana                                              |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Físico                 | Risco físico e fonte fictícios no GES da empresa A  | Categoria, descrição e fonte presentes; ausência do inventário B; sem tags pendentes | Pendente                                                    |
| Químico                | Risco químico no mesmo contexto                     | Mesmo conjunto de verificações                                                       | Pendente                                                    |
| Ergonômico             | Situação ergonômica fictícia                        | Mesmo conjunto de verificações                                                       | Pendente                                                    |
| Avaliação ausente      | Remover a avaliação da amostra no banco temporário  | Documento mantém "Não avaliado"                                                      | Pendente; responsável define se emissão final deve bloquear |
| Correção e regeneração | Gerar, alterar descrição fictícia e gerar novamente | Nova descrição presente; arquivo anterior mantém os bytes anteriores                 | Pendente; não representa histórico durável ou aprovação     |

Também se testa que o PGR da empresa A não pode ser gerado no tenant B.
Esses casos verificam o encadeamento banco → consolidado → mapeador → DOCX.
Não comprovam critérios técnicos, cálculos corretos sob uma metodologia aprovada,
conformidade legal ou paginação visual. Não deduzir isso de um teste verde.

As amostras em `templates/pgr/exemplo/` são referências fictícias já existentes;
não foram revalidadas por profissional nesta execução. Novos cenários não são
arquivados automaticamente: os testes geram o DOCX em memória.

### Cobertura adicional da revisão de código

- Outra empresa do mesmo escritório e GES não vinculado: os inventários não
  entram no documento selecionado.
- Avaliação quantitativa vigente: a avaliação mais recente fornece os valores e
  unidades em vez da referência antiga do risco; probabilidade/severidade são
  as persistidas. Isso não aprova limites nem metodologia.
- Histórico: as notas de duas revisões aparecem na ordem correta.

## Dossiê por amostra para o responsável

Preencher antes de apresentar uma amostra, guardando o arquivo efetivamente
avaliado. Após a NOB-105, capturar os headers de identificação junto do download.
Para arquivos atuais sem esses headers, registrar o hash do arquivo e commit
manualmente. Não afirmar que o arquivo traz parecer embutido.

| Campo                                                  | Valor a preencher                  |
| ------------------------------------------------------ | ---------------------------------- |
| Código do caso / empresa fictícia / ambiente           | Pendente                           |
| Versão aprovada do modelo e commit do sistema          | Pendente                           |
| ID do PGR, revisão e instante da geração               | Pendente                           |
| Hash do template / origem / arquivo, quando disponível | Pendente                           |
| Arquivo DOCX e PDF real a revisar                      | Pendente                           |
| Nome e identificação profissional do avaliador         | Pendente                           |
| Data do parecer e documento/evidência                  | Pendente                           |
| Parecer                                                | Pendente de revisão (não aprovado) |

## Registro das divergências e revalidação

| ID                         | Caso/hash original | Página/campo | Divergência e parecer   | Correção/PR | Novo hash | Parecer de revalidação |
| -------------------------- | ------------------ | ------------ | ----------------------- | ----------- | --------- | ---------------------- |
| A preencher após avaliação | —                  | —            | Nenhum parecer recebido | —           | —         | Pendente               |

Manter o arquivo original e a versão corrigida; não sobrescrever nem renomear
como "aprovado" sem parecer. Referenciar a issue/PR de correção e a evidência do
responsável na revalidação. Verificar cálculo/classificação contra os casos
assinados pelo responsável, sem criar uma metodologia nova durante o teste.

## Casos ainda bloqueados

- Máquinas e informações de segurança por ambiente: dependem da NOB-104.
- Campos/anexos integrais e condições de emissão final: dependem de NOB-93/94/105.
- Escopo comercial básico: depende da NOB-106/114; não supor dispensa por porte.
- Aprovação técnica: profissional e processo precisam ser indicados. O controle
  de owner da contratação não torna o owner responsável técnico automaticamente.
- QA visual do PDF e teste de integração real com conversor/armazenamento.

## Encerramento

Concluir NOB-107 somente depois de pareceres reais, correções vinculadas e
revalidação das versões corrigidas. Os testes desta etapa preparam a revisão;
nenhum dos três critérios de avaliação humana foi declarado concluído.
