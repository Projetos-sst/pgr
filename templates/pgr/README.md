# PGR em DOCX — templates

Template do PGR (Programa de Gerenciamento de Riscos) na identidade visual do PGR-e, preenchido com os dados da plataforma e convertido em PDF. A estrutura, as seções e as tabelas seguem o `PGR 2026.pdf` de referência. A marcação de categorias segue o `PGR 2026.1.pdf`.

## O que tem aqui

| Arquivo                              | O que é                                                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pgr-template.docx`                  | **Template real**, lido pela aplicação (`GET/POST /api/v1/pgr/{id}/docx`). Só tags `{{...}}` + texto fixo.                                                        |
| `pgr-template-limpo.docx` / `.pdf`   | O template como documento, **sem marcação**: texto fixo, semi-fixo já com o valor padrão e dinâmico como `{{tag}}`.                                               |
| `pgr-template-anotado.docx` / `.pdf` | O mesmo, com a marcação do PGR 2026.1: **fixo em amarelo**, **semi-fixo em laranja** (já com o valor padrão), **dinâmico sem marcação** (aparece como `{{tag}}`). |
| `exemplo/pgr-exemplo.docx` / `.pdf`  | Template preenchido com dados **fictícios** (`example-content.ts`): é o resultado final esperado.                                                                 |
| `assets/`                            | Logo PGR-e (o logo da empresa entra no lugar do placeholder do cabeçalho). A capa é desenhada pelo gerador, sem imagem de fundo.                                  |
| `amostras/`                          | Quatro casos **fictícios** de homologação do modelo (DOCX + PDF) e o `manifest.json` com os hashes. Roteiro: `docs/planning/nob-177-layout-e-amostras.md`.        |
| `fonts/`                             | Manrope e JetBrains Mono (SIL OFL 1.1, licenças junto). Incluídas na imagem `Dockerfile.gotenberg` e montadas pelo compose local.                                 |
| `build/`                             | Intermediário do gerador (gitignored).                                                                                                                            |

A réplica do PGR 2026 com os dados reais do cliente fica fora do repositório, em `docs/_local-refs/pgr-2026/` (gitignored, com dados pessoais). O `render-samples.ts` a gera quando o JSON local existe.

## As três categorias

| Categoria                            | No PGR 2026.1 | No template                                                            | De onde vem o valor                                                                                                                                                                       |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fixo**                             | amarelo       | texto literal                                                          | O próprio template. Muda só no gerador (`scripts/pgr-docx/template-document.ts`).                                                                                                         |
| **Semi-fixo** (placeholder editável) | laranja       | `{{labels.*}}`, `{{titles.*}}`, `{{@texts.*}}`, metodologia, campanhas | Padrão em `src/shared/domains/pgr/pgr-docx/defaults.ts`. Cada PGR guarda a sua versão em `/pgr/{id}/texts` (`POST .../docx-texts`); a prévia aceita `overrides` soltos (`POST .../docx`). |
| **Dinâmico**                         | sem marcação  | `{{company.razaoSocial}}`, loops `{{#ges}}…{{/ges}}`                   | Banco: `getPgrConsolidated` + `getPgrDocxExtras` → `buildPgrDocxContent`.                                                                                                                 |

Os textos semi-fixos aceitam **tokens com chave simples**, trocados antes do preenchimento: `{empresa}`, `{grauRisco}`, `{numeroEmpregados}`, `{cipaTitulares}`, `{cipaSuplentes}`, `{cipaHorasTreinamento}` (mínimo da NR-05 pelo grau de risco: 8/12/16/20h), `{anosVigencia}`, as faixas `{faixaTrivial}`, `{faixaToleravel}`, `{faixaModerado}`, `{faixaSubstancial}`, `{faixaIntoleravel}` e `{classeExemplo}` (classe do exemplo 2 × 3). Assim um texto editado pelo cliente continua recebendo o dado do PGR.

A classificação usa as faixas da metodologia da organização (`getRiskMethodologyView`; sem configuração, o preset padrão): selos dos riscos, matriz 5×5 com legenda, faixas listadas na seção 17 e dashboard saem das mesmas faixas, e a classe de cada risco é a gravada na avaliação (a mesma da tela do PGR). Conteúdo sem `classificationBands` (réplica, exemplo fictício) mantém a matriz de referência do PGR 2026.

## Fluxo de geração

### Identificação da geração (NOB-105, etapa parcial)

O resultado de `generatePgrDocx` inclui `provenance`: ID do PGR, instante UTC,
SHA-256 do template, dos dados de entrada serializados (incluindo overrides,
faixas e conteúdo do logo) e dos bytes do arquivo entregue. A rota DOCX/PDF
retorna `X-Pgr-Generated-At`, `X-Pgr-Template-Sha256`, `X-Pgr-Source-Sha256`, `X-Pgr-Texts-Sha256` e
`X-Pgr-File-Sha256`. No Postman, salve esses valores junto da amostra para revisão.

São identificadores técnicos; não constituem assinatura ou aprovação. O hash dos
dados não permite reconstruí-los, não é uma revisão persistida nem garante uma
transação única entre os leitores atuais. Os headers não ficam embutidos no
arquivo baixado nem no histórico do GED. O histórico durável da emissão e os
campos técnicos obrigatórios continuam pendentes de definição e implementação.

Os hashes são calculados no servidor, depois da leitura escopada ao tenant.
O hash do PDF identifica os bytes convertidos; o do DOCX identifica os bytes do
DOCX. O horário usa o mesmo instante da data de emissão impressa.

```
banco (withOrg)                         puro / testável                          binário
──────────────────────────────          ─────────────────────────────            ───────────────────────────
getPgrConsolidated  ┐
                    ├─► buildPgrDocxContent ─► buildPgrDocxData(+overrides) ─► renderDocxTemplate ─► DOCX
getPgrDocxExtras    ┘   (from-consolidated)    (build-data)                    (docxtemplater + logo)    │
                                                                                                          ├─► PDF: Gotenberg (LibreOffice)
                                                                                                          └─► PDF: Google Docs (Service Account)
```

- `src/shared/server/platform/pgr-docx-core.ts`: orquestra, mapeia erros (`NOT_FOUND`, `REPORT_UNAVAILABLE`).
- `src/shared/domains/pgr/pgr-docx/`: conteúdo, padrões semi-fixos, montagem dos dados e blocos OOXML (matriz de risco, matriz de treinamento, campanhas, textos ricos).
- `src/shared/integrations/docx/`: motor (`template-engine.ts`) e troca do logo (`image.ts`).
- `src/shared/integrations/google/`: Service Account, retry e Drive/Docs.

## Integração ao fluxo "criar documento do PGR"

Na aba **Documentos** do PGR (`pgr-documents-tab.tsx`):

```
Baixar DOCX / Baixar PDF ─► GET /api/v1/pgr/{id}/docx?format=docx|pdf ─► generatePgrDocx ─► arquivo na hora

Arquivar no GED ─► enqueuePgrPdfBatchAction ─► job `pdf_batch` (payload.format, padrão pdf)
                ─► worker ─► generatePgrDocx(org do job, pgr) ─► DOCX preenchido (ou PDF derivado dele)
                ─► Storage (bucket `documents`) ─► documents.status = ready (nova versão do GED)
```

- O arquivo guardado por padrão é o **PDF convertido do DOCX preenchido**; `format: "docx"` no payload mantém a opção de armazenar o DOCX. Job legado sem `format` continua em PDF. Sem migration (o payload é jsonb).
- O worker precisa do template na imagem (`Dockerfile.worker` copia `templates/pgr/pgr-template.docx`).
- A rota HTML `/api/v1/pgr/{id}/pdf` segue disponível, mas a UI não a usa mais; o seletor de cor da capa saiu, porque a identidade do template é fixa.

## Sintaxe do template (docxtemplater)

Delimitadores `{{ }}`, os mesmos do Salesbud. Opções: `paragraphLoop`, `linebreaks` e um parser de caminho pontuado (só chaves próprias; tag ausente sobe para o escopo pai).

| Tag                          | Efeito                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{{company.razaoSocial}}`    | Valor (caminho pontuado).                                                                                                                        |
| `{{#ges}}…{{/ges}}`          | Loop. Com a abertura na 1ª célula e o fechamento na última, repete a **linha** da tabela (ou o grupo de linhas: medidas e plano de ação usam 4). |
| `{{#agent.physical}}…{{/…}}` | Condição. Escolhe a variante colorida do cabeçalho do cartão de risco. `{{#level.moderate}}` escolhe a cor do selo de nível.                     |
| `{{^epis}}…{{/epis}}`        | Invertida: linha "nenhum EPI" quando a lista está vazia. Precisa ficar em duas células para a linha sumir.                                       |
| `{{@texts.cipa}}`            | OOXML cru: parágrafos/tabelas gerados em código (textos semi-fixos, matrizes, campanhas).                                                        |

Tags na mesma célula viram loop **inline** (repetem dentro do parágrafo). Para repetir a linha, a abertura e o fechamento precisam estar em células diferentes.

Catálogo (lista completa via `listTemplateTags`):

- **Cabeçalho e rodapé:** `emittedAt`, `validity`, `labels.headerTitle`, `labels.inventoryHeaderTitle`.
- **Identificação:**
  - `company.{razaoSocial, nomeFantasia, cityState, address, cnpj, stateRegistration, phone, cnae, riskGrade}`;
  - `workUnit.{name, contractNumbers, address, addressCity}`;
  - `contract.*`, mostrado só com `#contract.hasAny`;
  - `responsibles.*`;
  - `#revisions` → `number, date, validUntil, description, responsible`.
- **Seções:**
  - `#summary` → `title`;
  - `titles.*` (24);
  - `@texts.*` (19);
  - `#jobRoles` → `name, description, workload, employeeCount` + `#parts` (`name, description, workload, employeeCount`, `last` e as marcas `whole`, `head`, `body`, `tail`) + `jobRolesTotal`;
  - `@trainingMatrixXml`, `@riskMatrixXml`, `@campaignsXml`;
  - `#annexActions` → `gesTitle, riskRef, occupationalRisk, action, responsible, deadline, status` (Anexo I);
  - `methodology.*` (tabelas da seção 17 e necessidade de controle).
- **Inventário (`#ges`):**
  - `title`, `processDescription`, `construction.*`, `#jobRoles` → `name`;
  - `#risks`: `number`, `agentType`, `riskLevel`, `hazard`, `risk`, `sources`, `propagation`, `exposureTime`, `injuries`, `criterion`, `esocialCode`, `unitLabel`, `unitValue`, `uncertainty`, `probability`, `severity`, `controlNeed`, `result`, `toleranceLimit`, mais as flags `agent.*` e `level.*`;
  - `#measures` → `riskLabel`, `riskName`, `{elimination,collective,administrative,individual}.{applies,measures,monitoring}`;
  - `#epis` → `riskRef, hazard, epi, ca, neutralizes`;
  - `#actions` → `riskRef, occupationalRisk, riskLevel, action, tracking, measurement, responsible, deadline, status`;
  - `dashboard.{total, trivial, tolerable, moderate, substantial, intolerable}` e os rótulos `riskLevelLabels.*`.
- **Logo:** imagem placeholder com `docPr name="pgr-company-logo"` nos cabeçalhos. Depois do preenchimento ela é trocada pelo logo da empresa (`companies.logo_path`), proporcional à caixa. Sem logo, fica o do PGR-e.

## Como o Salesbud faz, e o que veio para cá

O Salesbud (MIT-API e backend, `GoogleDocsService`) preenche um **Google Doc modelo**:

1. Copia o modelo (`drive.files.copy`).
2. Troca os marcadores (`documents.batchUpdate` + `replaceAllText`, `matchCase`).
3. Monta as tabelas com inserções de baixo nível.
4. Confere os marcadores que sobraram.
5. Exporta DOCX/PDF.

Tudo roda autenticado por Service Account (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT`), com retry em 429/503/408 (8 tentativas, `1500ms·2^(n-1)` até 60s, mais jitter).

O que foi trazido (`src/shared/integrations/google/`):

- **`config.ts`**: o mesmo contrato de env. O JSON é aceito cru ou em base64.
- **`retry.ts`**: a mesma política de retry, pura e testada.
- **`drive-docs.ts`**:
  - `copyFile`, `replaceAllText`, `readDocumentText`, `exportFile`, `deleteFile`;
  - `fillGoogleDocTemplate`, o fluxo Salesbud completo: copia → troca → confere as sobras → exporta → apaga;
  - `flattenToMarkers`, que achata objetos em `{{caminho}}`;
  - `convertDocxWithGoogle`, que sobe o DOCX convertendo para Google Doc → exporta o PDF → apaga.

**Diferença de propósito.** O PGR repete GES, riscos e linhas de tabela, e o `replaceAllText` não repete nada. O preenchimento então é feito **no DOCX** pelo docxtemplater (loops e condições nativos). O Google entra como **conversor** (`PGR_DOCX_PDF_PROVIDER=google`), no lugar do LibreOffice do Gotenberg. O `fillGoogleDocTemplate` fica disponível para modelos simples mantidos direto no Drive.

## Variáveis de ambiente

| Variável                              | Padrão      | Uso                                                                      |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `PGR_DOCX_PDF_PROVIDER`               | `gotenberg` | `gotenberg` (usa `GOTENBERG_URL`) ou `google`.                           |
| `GOOGLE_SERVICE_ACCOUNT_JSON`         | vazio       | Chave da Service Account (JSON cru ou base64). Vazio = Google desligado. |
| `GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT` | vazio       | Usuário do Workspace personificado (domain-wide delegation).             |
| `PGR_DOCX_DRIVE_FOLDER_ID`            | vazio       | Pasta/Shared Drive dos arquivos temporários.                             |

Para ligar o Google:

1. No GCP, habilite **Google Drive API** e **Google Docs API**.
2. Crie a Service Account e gere a chave JSON.
3. Compartilhe a pasta `PGR_DOCX_DRIVE_FOLDER_ID` com o e-mail da Service Account, ou configure a delegação para o `USER_SUBJECT`.

## Regenerar template e amostras

O template é **gerado por código**: não edite o `.docx` à mão, altere `scripts/pgr-docx/template-document.ts`.

```bash
# só o template (+ o insumo anotado em build/)
npm run pgr-docx:template

# template + limpo + anotado + exemplo + amostras de homologação (+ réplica local, se existir), com PDF
docker compose up -d gotenberg        # já monta templates/pgr/fonts
GOTENBERG_URL=http://localhost:3001 npm run pgr-docx:samples
```

O `render-samples.ts` falha se algum documento final sair com `{{marcador}}` sobrando, e sai com código 1 se uma amostra de homologação tiver marcador, "undefined", "null" ou "NaN", ou se o conversor não devolver PDF.

Regenerar o template muda o hash do modelo, mesmo sem mudança de código. Por isso:

- gere template e amostras no mesmo commit: `render-homologation.test.ts` falha se `amostras/manifest.json` não bater com o template versionado;
- todo PGR com parecer favorável volta para conferência (`stale`, NOB-179) e as amostras de revisão (NOB-107) aparecem como alteradas. Nada é apagado.

## Identidade visual

Cores e tamanhos vêm de `src/shared/domains/pgr/pgr-docx/theme.ts`, os mesmos tokens do produto (indigo `#5B63F5`, Manrope). Capa nativa com faixa indigo; cabeçalho de tabela em indigo suave com filete, repetido a cada quebra de página; título do GES em barra indigo cheia; cartão de risco com barra lateral e etiqueta na cor do agente. Nada no layout vem de documento de terceiros. A matriz de cobertura de conteúdo fica em `src/shared/domains/pgr/pgr-docx/coverage.ts` e é travada por teste.

## Pontos de atenção

- **Persistência dos semi-fixos.** Cada PGR guarda versões dos seus textos em `pgr_docx_text_versions` (só inserção), editadas em `/pgr/{id}/texts` ou por `POST /api/v1/pgr/{id}/docx-texts`, com motivo e autor. Toda geração usa a versão mais recente e registra o hash dos textos efetivos (`X-Pgr-Texts-Sha256`), que entra na versão do documento. A emissão final (`purpose:"issue"`) recusa `overrides` soltos. A tela edita títulos, textos e rótulos; campanhas só pela API; metodologia não é editável por PGR.
- **Campos ainda sem coluna no banco.** Saem vazios, nunca inventados:
  - inscrição estadual;
  - contratante, CNPJ da contratante, gestor, fiscal, objeto e e-mail do contrato;
  - coautor;
  - composição da CIPA (titulares/suplentes): sem dado, o texto usa "representantes titulares e suplentes", sem número; com 1, a frase vai para o singular.
- **Bloco do contrato.** Aparece quando há qualquer dado de contrato (`contract.hasAny`). Linha sem valor mostra "Não informado". Na identificação, os opcionais vazios (inscrição estadual, telefone, contrato da unidade) somem, e os demais mostram "Não informado". Na revisão, data, validade, descrição e responsável vazios mostram "—".
- **Textos do PGR 2026.** Foram preservados os textos fixos e semi-fixos; referências específicas à terraplenagem foram generalizadas para não atribuir essa atividade a todas as empresas.
- **Paginação.**
  - O LibreOffice não suporta `SECTIONPAGES`, então o rodapé usa numeração contínua ("Página X de Y").
  - Tabelas e grupos de linhas usam `keepNext` para não se partirem. Por isso a réplica tem mais páginas que o original (272 páginas × 220 do original), com leitura melhor.
  - O LibreOffice ignora viúva/órfã dentro de linha de tabela que pode partir. Por isso o quadro de funções sai em `parts`, cada parte numa linha de tabela que não parte: a função com até 14 linhas estimadas é uma parte só (`whole`), e a mais longa vira partes de 6 linhas. A primeira (`head`) leva nome, carga horária e quantidade; as do meio (`body`) e a última (`tail`) só continuam a descrição. Entre as partes a margem de célula é zero, para a descrição seguir sem vão, e só `whole` e `tail` têm borda de baixo.
  - Nas células dinâmicas, as duas últimas palavras são unidas por espaço não separável (U+00A0) quando o par mede até 70% da largura útil da coluna, ou, quando o texto ocupa mais de uma linha, sempre que o par com a folga do LibreOffice (par × 1,03) cabe na largura útil e a penúltima linha continua com duas palavras ou mais em toda a faixa de folga (da largura útil até 3% acima dela). Se a penúltima ficaria com uma palavra só, a palavra anterior também é unida à seguinte. Antes dessa medição, a barra precedida de espaço (" / " ou " /fornecedores") e o traço colado à palavra seguinte (como em "GES 07 -Pintor") ficam presos à palavra anterior por U+00A0, para que nenhuma linha da célula comece por barra ou traço. Nomes em coluna estreita (risco da tabela de medidas, GES/Risco/Responsável do Anexo I, nome da função) são equilibrados em linhas. Dentro das palavras unidas, o hífen entre letras vira hífen não separável (U+2011). Na carga horária do quadro de funções, "-feira" também usa U+2011, e o travessão entre dois horários fica preso aos dois lados por U+00A0. Quem buscar ou copiar texto do DOCX (por exemplo "porta-a-porta" ou "Segunda-feira") deve considerar esses caracteres.
  - A grade de campanhas põe `keepNext` na linha de título e, nas linhas de ações, em todos os blocos menos o último, para não se partir entre páginas.
- **Fontes.** O DOCX do template embute a Manrope Regular e a Bold (`scripts/pgr-docx/embed-fonts.ts`, aplicado por `build-template.ts`), então o Word usa a fonte do próprio arquivo, mesmo sem a Manrope instalada. Os DOCX preenchidos herdam as fontes, porque o preenchimento não remove arquivos do pacote. A JetBrains Mono não aparece no documento e não é embutida. O LibreOffice do Gotenberg continua usando a fonte instalada a partir de `templates/pgr/fonts`.
- **Google Docs como conversor.** Não foi validado contra uma conta real, porque não há credenciais neste ambiente. A importação do Docs pode tratar diferente a faixa da capa (tabela com fundo) e os campos de página. Valide a primeira geração antes de trocar o provedor padrão.

## Publicação da integração

1. Fazer o merge desta integração na `develop` e publicar a aplicação na Vercel. O tracing inclui o template na função `/api/v1/pgr/[id]/docx`; conferir esse arquivo no artefato do build.
2. Reconstruir e publicar o worker a partir de `Dockerfile.worker`. A imagem precisa conter o template; atualizar só a Vercel não atualiza o processo que consome a fila.
3. Reconstruir a imagem de `Dockerfile.gotenberg` (em homolog, a imagem referida por `docker-compose.homolog.yml`) para incluir Manrope/JetBrains Mono. Não trocar o endereço/token do serviço existente.
4. Aplicação e worker precisam de `GOTENBERG_URL` acessível e, quando exigido pelo proxy, `GOTENBERG_TOKEN`. `PGR_DOCX_PDF_PROVIDER=gotenberg` é o padrão e não exige credenciais Google.
5. O worker usa `DATABASE_URL` (app_runtime), `DATABASE_URL_UNPOOLED` (owner), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. O bucket privado `documents` já é o usado pelo GED.
6. Migration `0086_pgr_docx_text_versions` (NOB-177, aditiva): aplicar antes de publicar a aplicação e o worker. Jobs antigos sem formato continuam em PDF; jobs com formato DOCX explícito continuam sendo respeitados. Documentos já existentes são preservados.

O cartão de cada risco segue os campos do PGR 2026, sem bloco extra de avaliação NR-09/NR-17. Listas vazias (funções, GES, riscos, medidas, ações do Anexo I) saem com mensagem explícita. Falta de avaliação, propagação ou medida não vira conformidade nem "não aplicável". Revisões não cadastradas não são criadas na exportação; validade e responsável históricos ficam vazios porque o histórico não os armazena.

## Validação com serviços reais

`src/__tests__/integration/pdf/pgr-docx-live.test.ts` é opt-in, com `PGR_DOCX_LIVE_TEST=true`. Exige as cinco URLs de banco apontando para um Postgres local descartável chamado `sst_test`, preparado pelo bootstrap de integração. **O seed apaga os dados desse banco de teste.** Usa Gotenberg e Storage reais; cria apenas objetos com UUID novo no bucket privado e os remove ao terminar. `PGR_DOCX_QA_DIR` opcional salva os PDFs localmente para inspeção visual. Rode isoladamente, com `--maxWorkers=1 --testTimeout=60000`.

O teste percorre handlers de download/overrides, ação de arquivamento, fila, processo real do worker, upload privado e download assinado, incluindo isolamento por organização. A autenticação da sessão e a invalidação de cache do Next são substituídas nesse harness; o gate REST e as leituras/escritas com RLS são exercitados. `pgr-docx-route.test.ts` cobre também o bloqueio do bypass em produção. O provedor Google continua opcional e sem validação contra conta real.

Para verificar HTTP com `next start` no Mac, use `--hostname localhost` e a URL `http://localhost:<porta>` de forma consistente. A execução com bind em `127.0.0.1` reproduziu um encaminhamento recursivo do proxy para `localhost` (`ECONNREFUSED`/`EADDRNOTAVAIL`), antes de chegar ao handler; com `localhost`, o download retorna 200. Não foi necessário alterar autenticação ou middleware.
