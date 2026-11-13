# NOB-177 — layout próprio do PGR e amostras de homologação

Status: layout, amostras, textos editáveis e testes entregues. **Parecer do responsável
técnico: pendente.** Nenhuma aprovação humana foi registrada nem simulada nesta etapa.

## 1. O que mudou no layout

A estrutura de conteúdo do documento não mudou: mesmas seções, mesma ordem, mesmas tags.
Mudou a apresentação, que agora sai só dos tokens do design system do produto
(`src/shared/domains/pgr/pgr-docx/theme.ts`): indigo `#5B63F5`, indigo forte `#4F46E5`,
indigo suave `#EEF0FE`, Manrope embutida no DOCX e instalada no conversor.

| Parte                  | Antes                                          | Agora                                                                                              |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Capa                   | Imagem de fundo flutuante (`cover-background`) | Capa nativa: logo PGR-e, faixa indigo com título e subtítulo, filete indigo forte, dados à direita |
| Cabeçalho de tabela    | Fundo indigo cheio com texto branco            | Fundo indigo suave, texto indigo forte e filete indigo embaixo; continua repetindo na quebra       |
| Título de seção        | Barra indigo suave                             | Igual, com filete indigo                                                                           |
| Título do GES          | Barra igual à das seções                       | Barra indigo cheia com texto branco, para separar um ambiente do outro                             |
| Cartão de risco        | Faixa cheia na cor do agente                   | Cabeçalho neutro, barra lateral na cor do agente e etiqueta "AGENTE/TIPO" na cor do agente         |
| Títulos da metodologia | Fundo indigo cheio                             | Mesmo padrão dos cabeçalhos de tabela                                                              |

A capa deixou de usar imagem flutuante. Por isso `templates/pgr/assets/cover-background.png`
saiu do repositório, e a ressalva sobre a imagem flutuante no Google Docs deixou de valer.

Fallback: o DOCX embute Manrope Regular e Bold. Sem a fonte, Word e LibreOffice trocam por
uma fonte sem serifa do sistema; cores, bordas e tabelas são OOXML nativo e não dependem
de imagem.

A referência de terceiros original não está neste ambiente (o PDF real fica fora do
repositório). O layout foi definido pelo design system do produto, sem reproduzir cores,
capa ou marca de terceiros. A comparação de conteúdo abaixo usa a estrutura que a fatia
030 já tinha levantado dessa referência.

## 2. Matriz de cobertura: modelo × referência

A matriz vive em código, em `src/shared/domains/pgr/pgr-docx/coverage.ts`. O teste
`src/__tests__/unit/domains/pgr/pgr-docx/coverage.test.ts` lê o template versionado e
falha se algum bloco perder uma tag. Tirar uma seção do gerador quebra o teste.

| Área          | Bloco                                | Situação   | Observação                                                                                    |
| ------------- | ------------------------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| Identificação | Capa                                 | Preservado | Layout novo; mesmos dados (vigência, razão social, unidade, obra, contrato)                   |
| Identificação | Empregador                           | Preservado | Inscrição estadual sem coluna no banco: some quando vazia                                     |
| Identificação | Unidade, obra e contrato             | Parcial    | Contratante, CNPJ da contratante, gestor, fiscal, objeto e e-mail sem coluna: "Não informado" |
| Identificação | Responsáveis                         | Parcial    | Coautor sem coluna no banco                                                                   |
| Identificação | Histórico de revisões                | Preservado | Validade e responsável históricos vazios: o histórico não os guarda                           |
| Identificação | Sumário e seções de texto            | Preservado | Textos semi-fixos editáveis por PGR (seção 4)                                                 |
| Inventário    | Quadro de funções                    | Preservado | Cabeçalho repete na quebra de página                                                          |
| Inventário    | Caracterização do GES                | Preservado |                                                                                               |
| Inventário    | Perigos e riscos por GES             | Preservado | Cartão por risco                                                                              |
| Inventário    | Painel de riscos por GES             | Preservado |                                                                                               |
| Avaliações    | Avaliação qualitativa e quantitativa | Preservado | Sem bloco extra NR-09/NR-17, como na referência; sem avaliação mostra "Não avaliado"          |
| Avaliações    | Metodologia e matriz de risco        | Preservado | Metodologia é do escritório; não é editável por PGR                                           |
| Controles     | Medidas de prevenção por hierarquia  | Preservado |                                                                                               |
| Controles     | Equipamentos de proteção individual  | Preservado | Lista vazia mostra mensagem própria                                                           |
| Controles     | Necessidade de controle              | Preservado |                                                                                               |
| Plano de ação | Plano de ação por GES                | Preservado |                                                                                               |
| Plano de ação | Cronograma consolidado               | Preservado | Mesma fonte do Anexo I                                                                        |
| Anexos        | Anexo I: cronograma de implementação | Preservado | Cabeçalho repete na quebra                                                                    |
| Anexos        | Matriz de treinamento por função     | Preservado |                                                                                               |
| Anexos        | Cronograma de campanhas de saúde     | Preservado | Campanhas editáveis só pela API (seção 4)                                                     |
| Anexos        | Apêndice de máquinas e equipamentos  | Preservado | Só aparece quando o PGR tem máquinas                                                          |

O que falta em relação à referência, e por quê:

- **Composição da CIPA, coautor, inscrição estadual e dados da contratante.** Não há coluna
  no banco. O documento nunca inventa: o campo some ou mostra "Não informado".
- **"Página X de Y" por seção.** O LibreOffice não suporta `SECTIONPAGES`; a numeração é
  contínua.
- **Anexos de terceiros em arquivo (laudos, ART, certificados).** O modelo não incorpora
  arquivos externos; isso depende do GED e está fora desta entrega.

## 3. Amostras fictícias

Geradas por script, a partir de `src/shared/domains/pgr/pgr-docx/sample-cases.ts`. Todas
usam nomes fictícios, CNPJ `00.000.000/0001-00` e o aviso "AMOSTRA FICTÍCIA PARA
HOMOLOGAÇÃO DO MODELO". Nenhum dado de cliente entra nesses arquivos.

| Caso                 | Arquivos em `templates/pgr/amostras/` | O que conferir                                                             | Páginas do PDF |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| `empresa-pequena`    | `.docx` e `.pdf`                      | Documento mínimo: capa, identificação, um GES e um risco                   | 19             |
| `inventario-extenso` | `.docx` e `.pdf`                      | 6 GES, 48 riscos e 36 funções: tabelas atravessando páginas                | 76             |
| `campos-vazios`      | `.docx` e `.pdf`                      | Opcionais vazios somem ou mostram "Não informado"; listas vazias com aviso | 19             |
| `com-anexos`         | `.docx` e `.pdf`                      | Anexo I, matriz de treinamento, campanhas e apêndice de máquinas           | 22             |

Como regenerar:

```bash
docker compose up -d gotenberg
GOTENBERG_URL=http://localhost:3001 npm run pgr-docx:samples
docker compose stop gotenberg
```

O script grava `templates/pgr/amostras/manifest.json` com o hash do modelo, o hash dos
textos padrão, o hash de cada DOCX e PDF, o número de tabelas e quantas repetem o
cabeçalho. Sai com código 1 se algum caso tiver marcador `{{ }}` sobrando, "undefined",
"null" ou "NaN", ou se o conversor não devolver PDF. Sem `GOTENBERG_URL`, só os DOCX são
gerados.

Verificação automática:

- `inspectDocx` (`src/shared/integrations/docx/inspect.ts`) lista as tabelas, as linhas de
  cabeçalho que repetem, os marcadores sobrando e os literais vazios.
- `sample-cases.test.ts` confere, em cada caso: tabelas esperadas presentes, nenhum
  marcador sobrando, nenhum "undefined"/"null"/"NaN", cabeçalho repetido nas tabelas que
  quebram, e só dado fictício.
- `render-homologation.test.ts` confere o manifesto e trava as amostras versionadas no
  modelo versionado: mudar o template sem regenerar as amostras quebra o teste.

Conferência feita nos PDFs reais (Gotenberg/LibreOffice) desta entrega:

- Manrope embutida nos quatro PDFs.
- Nenhum "undefined", "null", "NaN" ou `{{` no texto extraído.
- No `inventario-extenso`: cabeçalho do Anexo I repetido nas páginas 19 a 24; cabeçalho
  das medidas em 18 páginas; cabeçalho dos EPIs em 9; quadro de funções nas páginas 6 e 7
  com cabeçalho nas duas.
- Leitura visual por amostragem: capa, quadro de funções, matriz de treinamento, Anexo I,
  cartões de risco, medidas, EPIs, plano de ação, painel, campos vazios e apêndice de
  máquinas.

Não foi conferido: abertura no Microsoft Word, impressão em papel e conversão pelo Google
Docs (sem credenciais neste ambiente).

## 4. Textos padrão editáveis e versão usada

Os semi-fixos (títulos, textos e rótulos) têm o padrão em
`src/shared/domains/pgr/pgr-docx/defaults.ts`. Antes desta entrega só podiam ser trocados
no corpo do `POST /api/v1/pgr/{id}/docx`, sem ficar guardados. Agora:

- **Onde editar.** Tela `/pgr/{id}/texts` (link "Textos padrão deste PGR" na aba
  Documentos). Mostra o padrão ao lado do campo, exige o motivo da alteração e lista as
  versões salvas. API: `GET` e `POST /api/v1/pgr/{id}/docx-texts`; Server Actions em
  `src/shared/server/actions/pgr/pgr-docx-texts.ts`.
- **Onde fica guardado.** Tabela `pgr_docx_text_versions` (migration
  `0086_pgr_docx_text_versions`): uma linha por versão, com as alterações em relação ao
  padrão, o hash dos textos efetivos, o motivo, quem salvou e quando. O `app_runtime` só
  insere e lê; não altera nem apaga. Voltar ao padrão é salvar uma versão nova sem
  alterações.
- **Quem edita.** `owner` e `collaborator` com acesso ao PGR. PGR publicado ou assinado não aceita versão nova (409).
- **Registro em cada geração.** Toda geração calcula `textsSha256`, o hash dos textos
  efetivos (padrão do sistema mais a versão salva mais o que veio na requisição). O valor
  sai no header `X-Pgr-Texts-Sha256`, entra no hash dos dados do PGR e, por ele, nas
  amostras de revisão (NOB-107), no parecer e na emissão final (NOB-179).
- **Emissão final.** `purpose:"issue"` recusa `overrides` na requisição (422): a emissão
  usa só os textos salvos, para que o que foi revisado seja o que é emitido. A prévia
  continua aceitando `overrides` soltos.

Prova: `src/__tests__/integration/pdf/pgr-docx-texts.test.ts` (Postgres efêmero) cobre
salvar, versionar, gerar com o texto salvo, o header, a mudança do hash dos dados, a
recusa na emissão, o isolamento entre organizações, o papel `client` e a tabela sem
`UPDATE`/`DELETE`.

## 5. Efeito da mudança de hash

A versão de um documento é o par (hash do modelo, hash dos dados). Esta entrega muda os
dois:

- **Hash do modelo.** O template foi regenerado com o layout novo. Regenerar o template
  muda o hash mesmo sem mudança de código, porque o pacote DOCX leva data de criação.
- **Hash dos dados.** Passou a incluir `textsSha256` para todo PGR, com ou sem texto
  salvo.

Consequências no deploy:

- Todo PGR com parecer favorável (`approved`) passa a `stale` e precisa de nova
  conferência antes da emissão final. Nada é apagado; emissões já feitas ficam como estão.
- Toda amostra de revisão existente (NOB-107) aparece como "Dados ou textos atuais diferem
  da amostra".
- Nenhum teste fixa hash literal do modelo: os testes calculam o hash do arquivo
  versionado. O que trava é `render-homologation.test.ts`, que exige amostras regeneradas
  junto com o template.

Regra para quem mexer no gerador: regenerar template e amostras no mesmo commit, e avisar
que as aprovações em aberto voltam para conferência.

## 6. Roteiro de homologação

São duas conferências diferentes, e uma não substitui a outra.

### 6.1 Homologação do modelo (esta entrega)

Avalia o gerador: layout, estrutura e textos padrão, com dados fictícios. Vale para todos
os PGRs enquanto o modelo não mudar.

1. Abrir os quatro PDFs de `templates/pgr/amostras/` e, se quiser editar, os DOCX.
2. Anotar o `templateSha256` e o `textsSha256` do `manifest.json`: identificam o que foi
   avaliado.
3. Conferir, em cada caso:
   - capa e identidade visual;
   - seções da matriz de cobertura presentes e na ordem;
   - tabelas legíveis, cabeçalho repetido nas quebras, nenhuma linha partida no meio;
   - campos vazios coerentes (some ou "Não informado", nunca dado inventado);
   - anexos e apêndice de máquinas;
   - textos padrão (seções de texto, rótulos e títulos).
4. Registrar o parecer na tabela abaixo, com nome, registro profissional e data.
5. Ajuste pedido: corrigir o gerador, regenerar template e amostras, registrar o novo
   hash e repetir a conferência dos pontos alterados. O parecer anterior não vale para o
   hash novo.

| Campo                                   | Valor                              |
| --------------------------------------- | ---------------------------------- |
| `templateSha256` avaliado               | Pendente                           |
| `textsSha256` avaliado                  | Pendente                           |
| Responsável (nome e registro)           | Pendente                           |
| Data                                    | Pendente                           |
| Parecer                                 | Pendente de revisão (não aprovado) |
| Ajustes pedidos                         | Nenhum parecer recebido            |
| Novo hash e parecer da nova conferência | Pendente                           |

### 6.2 Revisão por documento (NOB-179)

Avalia um PGR real, com os dados daquele cliente, dentro do sistema: elaborador, revisor,
parecer e emissão final arquivada no GED. É feita a cada documento e volta para
conferência quando dados, textos ou modelo mudam (`stale`). Detalhes em
`nob-179-revisao-por-documento.md`.

A homologação do modelo não aprova nenhum PGR de cliente. A revisão por documento não
homologa o modelo.

## 7. Pendências e decisões para o responsável

| Assunto                                    | Decisão conservadora aplicada                                               | O que falta decidir                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Parecer do modelo                          | Fica pendente; nada foi marcado como aprovado                               | Quem assina e quando                                       |
| Quem aprova o texto padrão da plataforma   | O padrão continua em código, mudado só por PR                               | Se haverá edição do padrão por escritório, e quem aprova   |
| Edição de campanhas de saúde               | Só pela API (`overrides.campaigns`); a tela edita títulos, textos e rótulos | Se a tela deve editar a grade de campanhas                 |
| Metodologia e matriz de risco              | Não editável por PGR                                                        | Se o escritório pode ter metodologia própria               |
| Aprovações que voltam para conferência     | Aceito: é o comportamento seguro quando o modelo muda                       | Comunicar os escritórios antes do deploy                   |
| Referência de terceiros                    | Comparação feita pela estrutura já levantada na fatia 030                   | Conferência lado a lado por quem tem o PDF original        |
| Word e Google Docs                         | Não validados                                                               | Abrir as amostras no Word; validar o Google com conta real |
| Campos sem coluna (CIPA, coautor, IE etc.) | Somem ou "Não informado"                                                    | Se entram no cadastro                                      |
