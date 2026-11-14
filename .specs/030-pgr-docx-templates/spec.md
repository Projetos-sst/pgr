# 030 — PGR em DOCX por template (fixo / semi-fixo / dinâmico)

Spec enxuta (mesma decisão de 024-029). **Base:** `develop`. **Migration:** nenhuma.

## Objetivo

Gerar o PGR a partir de um **template DOCX** na identidade visual do PGR-e, com a mesma estrutura, seções e tabelas do documento de referência (`PGR 2026.pdf`), e preencher a partir dos dados da plataforma. O fluxo segue o preenchimento de documentos do Salesbud (Service Account + Google Drive/Docs).

O PGR 2026.1 marca as três categorias de conteúdo:

| Marcação     | Categoria | Implementação                                                                             |
| ------------ | --------- | ----------------------------------------------------------------------------------------- |
| amarelo      | fixo      | texto literal do template                                                                 |
| laranja      | semi-fixo | tag com valor padrão (`domains/pgr/pgr-docx/defaults.ts`), trocável por PGR (`overrides`) |
| sem marcação | dinâmico  | tag preenchida do banco (consolidada + extras)                                            |

## Critérios de aceite

1. **Template igual ao PGR 2026** na identidade PGR-e:
   - `templates/pgr/pgr-template.docx`;
   - exemplo preenchido com dados fictícios em `templates/pgr/exemplo/`;
   - réplica com os dados reais só local (`docs/_local-refs/`, gitignored).
2. **Template do PGR 2026.1** com as partes fixas, semi-fixas e dinâmicas, toda a estrutura e as tabelas: `pgr-template-limpo.{docx,pdf}` (sem marcação: semi-fixo com o padrão, dinâmico como `{{tag}}`) e `pgr-template-anotado.{docx,pdf}` (o mesmo com fixo amarelo e semi-fixo laranja).
3. **Componentes do preenchimento**, à moda do Salesbud:
   - motor de template (`integrations/docx`);
   - Service Account, retry e Drive/Docs (`integrations/google`), com as env vars como placeholder;
   - rota de geração `GET`/`POST /api/v1/pgr/{id}/docx` (DOCX ou PDF).

## Decisões

- **docxtemplater no DOCX + Google como conversor.** O `replaceAllText` do Salesbud não repete linhas de tabela, e o PGR repete GES, riscos, medidas, EPIs e ações. O preenchimento acontece no DOCX: loops e condições nativos, delimitadores `{{ }}` iguais aos do Salesbud. O PDF sai pelo Gotenberg (LibreOffice, padrão) ou pelo Google Docs (`PGR_DOCX_PDF_PROVIDER=google`). O fluxo Salesbud completo (`fillGoogleDocTemplate`) fica disponível para modelos planos no Drive.
- **Template gerado por código** (`scripts/pgr-docx`, lib `docx`). Cada trecho nasce com a sua categoria, e o mesmo gerador emite o template real e o anotado. Assim não existe edição manual do `.docx` divergindo da marcação.
- **Três camadas puras:**
  1. `PgrDocxContent`, o conteúdo de exibição;
  2. `buildPgrDocxContent`, que vai do banco ao conteúdo;
  3. `buildPgrDocxData`, que vai do conteúdo aos dados do template, com os semi-fixos, os tokens `{empresa}`/`{grauRisco}`/… e os derivados (sumário, dashboard, flags de cor, blocos OOXML).
- **Só dado persistido.** O que o modelo ainda não tem sai vazio ou "Não informado":
  - inscrição estadual;
  - dados da contratante;
  - coautor;
  - composição da CIPA.
- **Sem Server Action.** A saída é um download binário, mesmo precedente do `/pgr/{id}/pdf`. A REST reusa `resolveContext` e `restStatusForCode`.
- **Dados de cliente fora do git.** A réplica real e o JSON de conteúdo ficam em `docs/_local-refs/`.

## Superfície

- REST:
  - `GET /api/v1/pgr/{id}/docx?format=docx|pdf`;
  - `POST /api/v1/pgr/{id}/docx` com `{format?, overrides?}` (`pgrDocxRequestSchema`, `strict`).
- Erros:
  - `NOT_FOUND` (404): PGR inexistente ou de outro tenant;
  - `VALIDATION` (422): formato ou chave de override inválidos;
  - `FORBIDDEN` (403): papel `client`;
  - `REPORT_UNAVAILABLE` (503): template ou provedor ausente/falho.
- Docs: `docs/api/api-design.md` (Recursos + Sumário), Postman (pasta "PGR · DOCX (template)").
- Env (`.env.example`): `PGR_DOCX_PDF_PROVIDER`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICE_ACCOUNT_USER_SUBJECT`, `PGR_DOCX_DRIVE_FOLDER_ID`.

## Integração ao fluxo do PGR

Criar o documento do PGR passa a usar o template:

1. **Baixar DOCX / Baixar PDF** (aba Documentos) chamam `GET /api/v1/pgr/{id}/docx?format=docx|pdf`; o PDF sai do DOCX preenchido.
2. **Arquivar no GED** enfileira o job `pdf_batch`; o worker chama `generatePgrDocx` com o `org_id` do job e grava o **PDF convertido do DOCX preenchido** como nova versão do GED (`format` opcional no payload jsonb: `pdf` padrão, `docx` opcional; payload legado sem `format` = `pdf`).
3. Sem migration (`job_type` e schema intactos) e sem Server Action nova; a rota HTML `/pdf` e `buildPgrHtml` permanecem, fora do caminho da UI. O seletor de cor da capa foi removido da UI.

## Testes

- **Unit:**
  - `build-data` (tokens, overrides, dashboard, anotação);
  - `from-consolidated` (vocabulário do documento, contrato condicional, matriz de treinamento, medidas, EPIs, plano);
  - `request` (schema);
  - motor (parser, render do template real sem marcadores sobrando, todas as tags resolvíveis, loops, troca do logo);
  - imagem;
  - retry Google;
  - Drive/Docs mockado (upload/export/delete, retry 429, fluxo Salesbud, achatamento);
  - core (provedor de PDF, nome do arquivo, `REPORT_UNAVAILABLE`).
- **Integração** (Postgres efêmero): `pgr-docx.test.ts`:
  - render com dados reais do tenant;
  - overrides;
  - PDF pelo provedor;
  - cross-tenant → `NOT_FOUND`;
  - extras isolados por tenant.
- **Verificação HTTP registrada no desenvolvimento original** (`next dev` + bypass de dev + Postgres efêmero): `GET` docx/pdf 200, `POST` com overrides 200, chave inválida 422, formato inválido 422, outro tenant 404, `client` 403.

## Fora de escopo / próximos passos

- ~~Persistir os semi-fixos por PGR e a tela de edição.~~ Entregue na NOB-177: tabela `pgr_docx_text_versions` (migration `0086`), tela `/pgr/{id}/texts`, `GET`/`POST /api/v1/pgr/{id}/docx-texts` e hash dos textos em cada geração. A NOB-177 também trocou a apresentação (capa nativa, cabeçalhos de tabela, cartão de risco) e criou as amostras de homologação em `templates/pgr/amostras/`. Ver `docs/planning/nob-177-layout-e-amostras.md`.
- Colunas para os campos ainda vazios (inscrição estadual, contrato com a contratante, coautor, CIPA).
- Validar o provedor Google com uma conta real antes de torná-lo o padrão.

Detalhes de uso, catálogo de tags e regeneração: `templates/pgr/README.md`.

A integração atual acrescenta o teste opt-in com Gotenberg, worker e Storage reais descrito em `templates/pgr/README.md`, além da regressão do PDF padrão no GED. Os detalhes NR-09/NR-17/5W2H/EPI ficam só no PDF padrão (HTML); o DOCX e o PDF do template seguem o cartão de risco do PGR 2026, sem esse bloco, e o teste do worker garante a ausência.
