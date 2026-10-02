# PGR em DOCX — templates

Template do PGR (Programa de Gerenciamento de Riscos) na identidade visual do PGR-e, preenchido com os dados da plataforma e convertido em PDF. A estrutura, as seções e as tabelas seguem o `PGR 2026.pdf` de referência. A marcação de categorias segue o `PGR 2026.1.pdf`.

## O que tem aqui

| Arquivo                              | O que é                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pgr-template.docx`                  | **Template real**, lido pela aplicação (`GET/POST /api/v1/pgr/{id}/docx`). Só tags `{{...}}` + texto fixo.                                        |
| `pgr-template-anotado.docx` / `.pdf` | Espelho do PGR 2026.1: **fixo em amarelo**, **semi-fixo em laranja** (já com o valor padrão), **dinâmico sem marcação** (aparece como `{{tag}}`). |
| `exemplo/pgr-exemplo.docx` / `.pdf`  | Template preenchido com dados **fictícios** (`example-content.ts`): é o resultado final esperado.                                                 |
| `assets/`                            | Fundo da capa e logo PGR-e (o logo da empresa entra no lugar do placeholder do cabeçalho).                                                        |
| `fonts/`                             | Manrope e JetBrains Mono (SIL OFL 1.1, licenças junto). Montadas no Gotenberg pelo `docker-compose.yml`.                                          |
| `build/`                             | Intermediário do gerador (gitignored).                                                                                                            |

A réplica do PGR 2026 com os dados reais do cliente fica fora do repositório, em `docs/_local-refs/pgr-2026/` (gitignored, com dados pessoais). O `render-samples.ts` a gera quando o JSON local existe.

## As três categorias

| Categoria                            | No PGR 2026.1 | No template                                                            | De onde vem o valor                                                                                              |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Fixo**                             | amarelo       | texto literal                                                          | O próprio template. Muda só no gerador (`scripts/pgr-docx/template-document.ts`).                                |
| **Semi-fixo** (placeholder editável) | laranja       | `{{labels.*}}`, `{{titles.*}}`, `{{@texts.*}}`, metodologia, campanhas | Padrão em `src/shared/domains/pgr/pgr-docx/defaults.ts`. Cada PGR pode trocar via `overrides` (`POST .../docx`). |
| **Dinâmico**                         | sem marcação  | `{{company.razaoSocial}}`, loops `{{#ges}}…{{/ges}}`                   | Banco: `getPgrConsolidated` + `getPgrDocxExtras` → `buildPgrDocxContent`.                                        |

Os textos semi-fixos aceitam **tokens com chave simples**, trocados antes do preenchimento: `{empresa}`, `{grauRisco}`, `{numeroEmpregados}`, `{cipaTitulares}`, `{cipaSuplentes}`, `{cipaHorasTreinamento}` (mínimo da NR-05 pelo grau de risco: 8/12/16/20h) e `{anosVigencia}`. Assim um texto editado pelo cliente continua recebendo o dado do PGR.

## Fluxo de geração

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

Catálogo (290 tags no total; lista completa via `listTemplateTags`):

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
  - `#jobRoles` → `name, description, workload, employeeCount` + `jobRolesTotal`;
  - `@trainingMatrixXml`, `@riskMatrixXml`, `@campaignsXml`;
  - `methodology.*` (tabelas da seção 17 e necessidade de controle).
- **Inventário (`#ges`):**
  - `title`, `processDescription`, `construction.*`, `#jobRoles` → `name`;
  - `#risks`: `number`, `agentType`, `riskLevel`, `hazard`, `risk`, `sources`, `propagation`, `exposureTime`, `injuries`, `criterion`, `esocialCode`, `unitLabel`, `unitValue`, `uncertainty`, `probability`, `severity`, `controlNeed`, `result`, `toleranceLimit`, mais as flags `agent.*` e `level.*`;
  - `#measures` → `riskLabel`, `riskName`, `{elimination,collective,administrative,individual}.{applies,measures,monitoring}`;
  - `#epis` → `riskRef, hazard, epi, ca, neutralizes`;
  - `#actions` → `riskRef, occupationalRisk, riskLevel, action, tracking, measurement, responsible, deadline, status`;
  - `dashboard.{total, trivial, tolerable, moderate, substantial, intolerable}`.
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

# template + anotado + exemplo (+ réplica local, se existir), com PDF
docker compose up -d gotenberg        # já monta templates/pgr/fonts
GOTENBERG_URL=http://localhost:3001 npm run pgr-docx:samples
```

O `render-samples.ts` falha se algum documento final sair com `{{marcador}}` sobrando.

## Pontos de atenção

- **Persistência dos semi-fixos.** Hoje os overrides chegam no corpo do `POST .../docx`. Para o cliente editar no site falta guardá-los por PGR (sugestão: coluna `jsonb` `pgr.docx_overrides`, validada pelo mesmo `pgrDocxOverridesSchema`) e a tela de edição.
- **Campos ainda sem coluna no banco.** Saem vazios, nunca inventados:
  - inscrição estadual;
  - contratante, CNPJ da contratante, gestor, fiscal, objeto e e-mail do contrato;
  - coautor;
  - composição da CIPA (titulares/suplentes): o texto mostra "—" até existir dado ou o dimensionamento pelo Quadro I da NR-05.
- **Bloco do contrato.** Só aparece quando a obra tem número de contrato. Linhas sem valor ficam com o rótulo e o valor vazio, como no documento de referência.
- **Textos fixos herdados do PGR 2026.** O §21 menciona "terraplenagem" (é da obra de referência) e merece revisão editorial. Pequenos erros de digitação do original foram corrigidos.
- **Paginação.**
  - O LibreOffice não suporta `SECTIONPAGES`, então o rodapé usa numeração contínua ("Página X de Y").
  - Tabelas e grupos de linhas usam `keepNext` para não se partirem. Por isso a réplica tem mais páginas que o original (246 páginas × 220 do original), com leitura melhor.
- **Fontes.** O LibreOffice só usa fonte instalada (`templates/pgr/fonts` montada no Gotenberg). No Word, sem Manrope instalada, o DOCX cai na fonte substituta. O PDF é a saída canônica.
- **Google Docs como conversor.** Não foi validado contra uma conta real, porque não há credenciais neste ambiente. A importação do Docs pode tratar diferente a imagem flutuante da capa e os campos de página. Valide a primeira geração antes de trocar o provedor padrão.
