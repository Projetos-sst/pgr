# Lote 3 — Auditoria

**Data:** 27/09/2026 · **Base:** `develop` em `25ade4d` (merge da PR #95) · **Branch do lote:**
`feature/lot-03-nr17-nr18-pgr` · **Última migration:** `0050_measure_why_cost` · **PRs abertas:**
nenhuma · **Board:** #40 e #48 em _Backlog_; #47 em _In progress_.

Esta auditoria prevalece, para #40, #48 e o fechamento da #47, sobre o que a auditoria geral de 16/09
supôs.

## Issues

- **#40** — Integração com NR-17 (avaliação ergonômica). Aberta, sem comentários.
- **#48** — Integração com NR-18 (18.4.3): documentos complementares do canteiro. Aberta, sem
  comentários.
- **#47** — Estrutura do PDF do PGR. Aberta; faltou só a seção NR-17 depois do Lote 2.

## Baseline

`npm run check` **verde** — 0 erros de lint (4 warnings pré-existentes: três `<img>` e um import não
usado), typecheck limpo, **1 297 testes unitários em 139 suítes**. As suítes que o lote vai tocar
(`psychosocial`, `pgr-consolidated`, `pgr-pdf-template`, `documents`, `epi`) somam **319 testes**,
todas verdes.

## Estado atual — o que o Lote 2 deixou pronto

```
GES → risks → risk_assessments (5×5 + bloco NR-09) → control_measures (5W2H 7/7)
                                   │                          │
                                   └──────────┬───────────────┘
                                              ▼
              getPgrConsolidated → buildPgrHtml → Gotenberg → PDF
                 1. Identificação · 2. NR-01 · 3. NR-09 · 4. 5W2H · 5. Hierarquia
```

Falta a NR-17 no meio dessa ordem, e a NR-18 não existe em lugar nenhum.

---

# #40 — NR-17

## Requisito

Registrar avaliação NR-17 (item 17.3.5) **vinculada a um risco do inventário**, cobrindo postura,
movimentos, carga física, carga mental, organização do trabalho e ambiente físico, avaliando também
como registrar resultado de instrumento psicossocial (ex.: COPSOQ). Os dados têm de aparecer na
estrutura do PGR (#47).

## Arquitetura atual

Varri o repositório por `ergonomic`, `ergonomia`, `AET`, `AEP`, `NR-17`, `postura`, `movimento`,
`carga`, `organização do trabalho`, `ambiente físico`, `COPSOQ`, `questionário` e `campanha`:

- **Nada de NR-17/AET/AEP.** `ergonomic` existe apenas como valor de `risk_agent_type`
  (`schema/risks.ts`) e como agente **não elegível** à NR-09 (regra do Lote 2).
- **Módulo psicossocial** (`schema/psychosocial.ts`) — é outro assunto, mas é a infra mais próxima:
  - `psychosocial_campaigns`: campanha por empresa/unidade, com `public_token` para o formulário
    público, status `draft|open|closed`, cores e texto para o trabalhador;
  - `psychosocial_questions`: perguntas **ad-hoc** por campanha (`likert | multiple_choice | free_text`)
    — não há banco de itens COPSOQ;
  - `psychosocial_responses`: **anônimas** — só `token` e `submitted_at`, **sem vínculo com
    funcionário**. Não há como identificar respondente (bom: o PGR nunca poderia expor indivíduo);
  - `psychosocial_answers`: `value_int` (Likert) / `value_text`;
  - `psychosocial_risks`: fator derivado da campanha, com `level` inteiro e vínculo **opcional** a
    `risks` (`registerRiskInPgr` cria um risco de agente `psychosocial` no GES e amarra);
  - `psychosocial_risk_factors`: catálogo por **GES**, com `level` (enum `low|medium|high`),
    `assessment_method` **texto livre** (o comentário do schema cita "Questionário COPSOQ" como
    exemplo) e `status`.
- **Derivação** (`domains/psychosocial/derivation.ts`): média Likert por pergunta; média ≥ limiar
  (default 3) vira fator com nível 1–4 por faixas do próprio projeto. **Não é metodologia COPSOQ** —
  é uma regra interna, documentada como tal no código.
- Nada psicossocial nem ergonômico entra hoje no consolidado ou no PDF.

## Modelo recomendado

A issue exige vínculo **com o risco**; a prática da NR-17 é avaliar posto/atividade. As opções reais:

| Opção | Desenho                                                    | Prós                                                                                 | Contras                                                                                                     |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| A     | Colunas em `risk_assessments` (como a NR-09 do Lote 2)     | Reusa histórico, "vigente", API e formulário                                         | 6 dimensões + conclusão + responsável incham uma tabela que é a matriz 5×5; a AEP tem data e autor próprios |
| **B** | **Tabela dedicada `ergonomic_evaluations`, 1:N por risco** | Histórico e "vigente" espelhando a regra do #39; campos próprios; não polui a matriz | Nova tabela, RLS, 4 superfícies de API e tela                                                               |
| C     | Avaliação por **GES**                                      | Mais próximo da prática (posto de trabalho)                                          | Contraria o critério de aceite ("vinculada a um risco"); PDF teria de cruzar GES×risco                      |

**Recomendação: B.** Mantém a promessa da issue (avaliação ligada ao risco), repete o padrão de
vigência que o PDF já sabe consumir e evita transformar `risk_assessments` em tabela-tudo — ela já
recebeu 5 colunas no Lote 2. **É decisão de produto (Q1)**, porque muda schema, UI e PDF.

## NR-17 — as seis dimensões

A issue **lista dimensões, não campos**. Nada no código define escala, e inventar uma (1–5, checklist
regulamentar) seria criar requisito.

| Campo                   | Tipo pedido pela issue | Existe hoje? | Onde?                                 | Reutilizável? | Persistido? | Decisão necessária?     |
| ----------------------- | ---------------------- | ------------ | ------------------------------------- | ------------- | ----------- | ----------------------- |
| Postura                 | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Movimentos              | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Carga física            | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Carga mental            | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Organização do trabalho | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Ambiente físico         | não especificado       | Não          | —                                     | —             | Sim         | **Sim (Q2)**            |
| Data da avaliação       | implícito              | Padrão       | `risk_assessments.assessed_at`        | Padrão sim    | Sim         | Não                     |
| Responsável             | implícito              | **Não**      | não há cadastro de profissional (#36) | Texto livre   | Sim         | Não — resolvido no PLAN |
| Conclusão geral         | **não pedida**         | Não          | —                                     | —             | —           | Não — não inventar      |

**Recomendação (Q2):** por dimensão, **enum de adequação** (`adequate | inadequate | not_applicable`)
**mais observação em texto livre**. Registra o julgamento do profissional sem inventar escala
numérica nem checklist normativo, e é o suficiente para o PDF dizer o que a norma pede. A alternativa
é texto livre puro por dimensão (mais barato, menos consultável).

**Conclusão geral:** a issue não pede. **Não criar.** O PDF reproduz as seis dimensões e as
observações; diagnóstico global é do profissional, não do sistema.

## AEP / AET

A NR-17 distingue avaliação **preliminar** (AEP) e **análise ergonômica do trabalho** (AET). No
produto não existe nenhuma das duas. Decisão tomada no PLAN (reversível, sem custo de schema): a
**AEP é o registro estruturado** (as seis dimensões) e a **AET é o laudo anexado** ao risco pelo GED,
que já suporta `related_entity_type = "risk"` desde a #45 e versiona desde a #56. Criar formulário de
AET completa seria inventar workflow que ninguém pediu.

## Psicossocial / COPSOQ

- **Suporte a COPSOQ hoje: não existe.** Há questionário genérico Likert e um texto livre
  `assessment_method` que menciona COPSOQ como exemplo. Não há banco de itens, dimensões do
  instrumento, escala oficial nem interpretação normativa.
- **Score agregado existe**, mas é média simples por pergunta e uma classificação 1–4 por faixas
  definidas pelo projeto — **não é score COPSOQ**. Chamar isso de COPSOQ no PGR seria falsear.
- Vínculo com GES: `psychosocial_risk_factors` é por GES; `psychosocial_risks` é por campanha, com
  vínculo opcional a um `risk`.

**Recomendação (Q3):** a avaliação NR-17 referencia o instrumento como **dado real e modesto** —
campo de método/instrumento (texto livre, com sugestões incluindo "COPSOQ") e, quando existir campanha
psicossocial fechada ligada ao mesmo GES, uma **referência agregada** (nome da campanha, período,
nº de respostas e o nível do fator derivado). Nada de calcular escore normativo que o sistema não
implementa.

## Privacidade

As respostas psicossociais **não têm vínculo com funcionário** (só token) — logo, não há risco de
expor indivíduo. Ainda assim, o PGR **nunca** deve trazer resposta individual: só o agregado por
campanha/fator. Isso vira regra explícita no PLAN e teste no template.

## UI

Dono do dado é o risco (critério de aceite). Caminho recomendado: **detalhe do risco → aba/seção
"Avaliação ergonômica (NR-17)"**, no mesmo padrão em que o risco já leva avaliações 5×5 e medidas:
lista + formulário próprio, sem tela nova de topo de menu. Fluxo completo: UI → Server Action →
REST → repositório → tabela → `getPgrConsolidated` → `buildPgrHtml`.

## Migration (#40)

**SIM** (conceitual, nada gerado nesta execução): tabela `ergonomic_evaluations` com `org_id`
(FK `orgs`, índice), `risk_id` (FK `risks`, `on delete cascade`), as seis dimensões (enum
`ergonomic_adequacy` + observação por dimensão, se Q2 = enum), `method` texto, `responsible` texto,
`assessed_at date`, `notes`, timestamps, `pgPolicy` de isolamento igual às demais tabelas do PGR e
GRANT/trigger herdados pelo padrão das migrations. Número **não** reservado: gerar com
`npm run db:generate` na hora, com a `develop` sincronizada (hoje em `0050`).

---

# #48 — NR-18

## Requisito

Anexar ao PGR, **organizados por tipo**, os documentos do 18.4.3 (área de vivência, projeto elétrico
temporário, proteção coletiva, SPIQ quando aplicável) e apresentar a **relação de EPIs com
especificações técnicas** como seção **derivada do cadastro** — nunca digitada.

## Documentos hoje

- **Anexar ao PGR já funciona**: `documents.related_entity_type = 'pgr'` (conjunto fechado em
  `domains/documents/validity.ts`: `pgr | responsible_technician | ges | risk`), aba **Documentos e
  PDF** do PGR e `DocumentAttachmentsSection` reutilizável (GES e risco já usam).
- **Versionamento (#56)** e pastas do GED funcionam; o vínculo é por documento (uma linha por versão,
  agrupada por `document_group_id`).
- **`doc_type` é texto livre**, com `SUGGESTED_DOC_TYPES` no domínio (ART, PGR, LTCAT, ASO…) — **sem
  os tipos da NR-18**.
- **O repositório já filtra por tipo**: `listDocuments` aceita `docType`, `relatedEntityType`,
  `relatedEntityId`, `validity`, `search` e paginação.

**Conclusão:** a issue sugeria `construction_site_documents` + nova entrada no enum de vínculo. **Não
é necessário.** O GED cobre arquivo, versão, vínculo e tipo; o que falta é **vocabulário** (lista
fechada de tipos NR-18 no domínio) e **apresentação** (checklist por tipo na aba do PGR). Criar tabela
nova duplicaria o acervo e quebraria o versionamento que a #56 entregou.

## "Organizados por tipo"

Funcionalmente = **agrupar/filtrar os anexos do PGR por `doc_type`**, usando uma lista fechada de
tipos NR-18 no domínio, e mostrar um **checklist** com o que já foi anexado e o que falta. Não é pasta
física no GED (pasta é organização do acervo, não do PGR) nem metadata nova no banco.

## GED / versionamento

Nada muda: o anexo continua sendo documento versionado do acervo, vinculado ao PGR. Nova versão
mantém o vínculo (comportamento verificado no QA do Lote 1). A exclusão remove o grupo inteiro.

## Unidade / obra

`work_units.type` é enum `site | branch | workfront`, com `site` = "Obra / Canteiro" — a issue dizia
que não existia distinção, **está desatualizada**. Decisão tomada no PLAN: o painel NR-18 aparece
**quando a unidade do PGR é `site`**, que é o escopo da norma; nas demais, nada é exibido (nem
checklist vazio). Reversível e sem schema.

## Profissional habilitado

O texto da issue descreve **a origem** dos documentos ("elaborados por profissional habilitado"), não
um requisito de cadastro de autoria. Não há cadastro de profissional no produto (issue #36). Decisão:
**não** criar campos de autoria/ART por documento nesta issue — quem quiser registrar isso usa o
próprio nome do documento ou anexa a ART, como hoje.

## Relação de EPIs — o que existe

`epi_catalog`: `name`, `ca`, `ca_valid_until`, `manufacturer`, `norm`, `material`, `size`,
`unit_of_measure`, `useful_life_months`, `description`, `photo_path`, `category_id`.
`epi_risk` liga EPI ↔ risco com `neutralization`. O **consolidado já carrega EPIs por risco** e o PDF
os imprime na coluna "EPIs" do inventário desde o Lote 2.

| Campo exigível na relação     | Existe hoje? | Fonte                            | Derivável? | Gap                                                  |
| ----------------------------- | ------------ | -------------------------------- | ---------- | ---------------------------------------------------- |
| Nome/descrição do EPI         | **Sim**      | `epi_catalog.name`               | Sim        | —                                                    |
| CA                            | **Sim**      | `epi_catalog.ca`                 | Sim        | —                                                    |
| Validade do CA                | **Sim**      | `epi_catalog.ca_valid_until`     | Sim        | —                                                    |
| Fabricante                    | **Sim**      | `epi_catalog.manufacturer`       | Sim        | —                                                    |
| Norma técnica                 | **Sim**      | `epi_catalog.norm`               | Sim        | —                                                    |
| Material / tamanho            | **Sim**      | `epi_catalog.material/size`      | Sim        | —                                                    |
| Vida útil                     | **Sim**      | `epi_catalog.useful_life_months` | Sim        | —                                                    |
| Riscos/GES atendidos          | **Sim**      | `epi_risk` → `risks` → `ges`     | Sim        | —                                                    |
| "Especificação técnica" única | Parcial      | conjunto dos campos acima        | Sim        | Não existe um campo só com esse nome — e não precisa |

**Conclusão:** a relação é **100% derivável** (PGR → GES vinculados → riscos → `epi_risk` →
`epi_catalog`, deduplicada por EPI), **sem migration** e sem digitação.

## Migration (#48)

Separando as três perguntas:

| Item                      | Migration?                                            |
| ------------------------- | ----------------------------------------------------- |
| Tipos NR-18 / checklist   | **NÃO** — lista fechada no domínio + filtro existente |
| Relação de EPIs           | **NÃO** — consulta derivada                           |
| "Especificações técnicas" | **NÃO** — campos já existem em `epi_catalog`          |

## Segurança (#48)

Tudo passa por `withOrg` + RLS já existentes de `documents`, `epi_catalog`, `epi_risk`, `risks` e
`ges`. Testes negativos planejados: documento de outro tenant não pode ser vinculado nem listado no
PGR; relação de EPIs de um tenant nunca inclui EPI de outro; download continua exigindo papel de
office staff.

---

# #47 — fechamento

O PDF já tem identificação, NR-01, NR-09, 5W2H e hierarquia. **Falta só a seção NR-17**, que depende
inteiramente do modelo da #40. Assim que a avaliação ergonômica existir, a seção entra na ordem — como
o Lote 2 deixou preparado, a numeração é sequencial pelo que existe e se reordena sozinha.

Dependência da #48: **só se** a relação de EPIs virar seção do PDF (**Q4**). Os documentos NR-18 em si
são anexos do PGR e não precisam ir para dentro do documento gerado.

---

# Auditoria visual / UI foundation

O sistema tem **dois kits**: `_ui/list.tsx` (mais antigo: `Table`, `SearchForm`, `Pagination`) e
**`_ui/data-list.tsx`** — o kit do redesign, usado pelas telas já alinhadas (companies, GES, riscos,
EPI, incidentes, psicossocial…). **O Lote 3 usa o `data-list`.**

| Necessidade                 | Componente/padrão existente                                                                                              | Reutilizar? | Gap                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------- |
| Wrapper de lista            | `mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-8`                                                                        | **Sim**     | —                                                     |
| Wrapper de formulário       | `mx-auto w-full max-w-[940px] px-[30px] pt-7 pb-10`                                                                      | **Sim**     | —                                                     |
| Cabeçalho de página         | `_ui/list.tsx` → `PageHeader` (ícone em bloco, título, subtítulo, voltar)                                                | **Sim**     | —                                                     |
| Cartão da lista             | `data-list` → `ListCard`                                                                                                 | **Sim**     | —                                                     |
| Toolbar (busca/filtro/ação) | `data-list` → `ListToolbar`, `ToolbarSearch`, `ToolbarSelect`, `SegmentedFilter`, `ToolbarButton`                        | **Sim**     | —                                                     |
| Tabela                      | `data-list` → `DataGrid` + `GridHeader` + `GridRow` + `Cell`/`MonoCell`                                                  | **Sim**     | **`align` só aceita `left`/`right`** — falta `center` |
| Badges semânticos           | `data-list` → `StatusBadge` com tons `green/amber/red/neutral/indigo/blue`                                               | **Sim**     | — (usar os tons, nunca cor hardcoded)                 |
| Ações por linha             | `data-list` → `RowActions`, `EditIconLink`; `_ui/row-actions.tsx`                                                        | **Sim**     | —                                                     |
| Rodapé/paginação            | `data-list` → `ListFooter` (contagem + páginas + itens por página)                                                       | **Sim**     | —                                                     |
| Estado vazio                | `_ui/list.tsx` → `EmptyState`                                                                                            | **Sim**     | —                                                     |
| Formulário                  | `_ui/form.tsx` → `FormSection`, `TextField`, `TextAreaField`, `SelectField`, `FormActions`, `SubmitButton`, `CancelLink` | **Sim**     | —                                                     |
| Botão Voltar                | `PageHeader backHref=…` (seta em pílula glass, à esquerda do título)                                                     | **Sim**     | —                                                     |
| Confirmação destrutiva      | `_ui/confirm-delete-button.tsx`, `confirm-modal.tsx`                                                                     | **Sim**     | —                                                     |

**Único componente novo justificado:** nenhum. O que existe cobre tudo; o gap real é **estender
`Cell`/`GridColumn` com `align: "center"`** (mudança de 3 linhas na primitive, aproveitada por todas
as telas) em vez de espalhar `text-center` nas novas.

**Lição do Lote 2 que não se repete:** nada de `max-w-2xl` encostado à esquerda. Formulário usa o
wrapper de 940px e cartões por seção; lista usa 1320px com o `ListCard`.

---

# Dependências

```
#40 (modelo NR-17) ──► #47 seção 4 ──► #47 pode fechar
#48 (tipos + relação de EPIs) ──► #47 só se a relação de EPIs for ao PDF (Q4)
```

Arquivos disputados: `pgr-consolidated.ts` (domínio + repositório) e `pgr-pdf-template.ts` — tocados
por #40 e possivelmente por #48. Por isso o lote roda em série, numa branch só.

# Riscos

| Risco                                          | Mitigação                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Modelar a AEP errado gera retrabalho de schema | Decidir Q1/Q2 antes de gerar migration; tabela dedicada é reversível  |
| Apresentar média Likert interna como "COPSOQ"  | Proibido no PLAN; referência agregada declarada como tal + teste      |
| Expor resposta individual no PGR               | Respostas já são anônimas; PDF só consome agregado; teste no template |
| Terceira mudança seguida no template do PDF    | Uma seção por vez, testes de ordem já existem desde o Lote 2          |
| Checklist NR-18 virar bloqueio sem requisito   | Informativo por decisão do PLAN                                       |
| Telas novas fora do padrão visual              | Seção "Padrão visual e UI" do PLAN + checklist no TASK                |

# Perguntas bloqueantes

## Pergunta 1

**Issue:** #40
**Pergunta:** a avaliação NR-17 vira **tabela dedicada** (`ergonomic_evaluations`, 1:N por risco, com
data/responsável próprios) ou **colunas em `risk_assessments`**, como foi feito com a NR-09?
**Por que bloqueia:** define schema, migration, UI, API e de onde o PDF lê.
**Opção A:** colunas em `risk_assessments` — consistente com o Lote 2, sem tabela nova.
**Opção B:** tabela dedicada ligada ao risco — histórico e vigência próprios, sem inchar a matriz 5×5.
**Recomendação técnica:** **B**. A AEP é um instrumento com data e autor próprios; `risk_assessments`
é a matriz de probabilidade × severidade e já recebeu cinco colunas no lote anterior.

## Pergunta 2

**Issue:** #40
**Pergunta:** como cada uma das seis dimensões é registrada — **enum de adequação + observação**,
**texto livre** ou **escala numérica**?
**Por que bloqueia:** muda schema (enum vs. texto vs. inteiro), formulário e o que o PDF imprime.
**Opção A:** enum `adequado | inadequado | não aplicável` + observação livre por dimensão.
**Opção B:** só texto livre por dimensão.
**Opção C:** escala numérica (1–5) por dimensão.
**Recomendação técnica:** **A**. Registra julgamento consultável sem inventar escala que a norma não
fixa. **C está descartada** a menos que você tenha a escala de uma metodologia adotada — não cabe ao
sistema criar uma.

## Pergunta 3

**Issue:** #40
**Pergunta:** o resultado psicossocial (COPSOQ) entra na avaliação NR-17 como **referência agregada a
uma campanha existente** ou apenas como **método/observação em texto**?
**Por que bloqueia:** a primeira opção cria vínculo (campanha ↔ avaliação) e uma consulta agregada; a
segunda é um campo.
**Opção A:** referência agregada — a avaliação aponta para uma campanha psicossocial fechada do mesmo
GES e o PDF mostra período, nº de respostas e níveis dos fatores derivados.
**Opção B:** texto livre de método/instrumento, como já acontece em `psychosocial_risk_factors`.
**Recomendação técnica:** **A** se você quer o PGR citando a campanha real; **B** se a intenção é só
registrar que houve aplicação. Em qualquer caso, o sistema **não** calculará escore COPSOQ — ele não
implementa a metodologia, e dizer o contrário no documento seria falso.

## Pergunta 4

**Issue:** #48 (e fechamento da #47)
**Pergunta:** a **relação de EPIs** derivada entra como **seção do PDF do PGR** ou fica **só na tela**
do PGR?
**Por que bloqueia:** muda o contrato do documento entregue ao cliente e decide se a #48 toca o
template junto com a #40.
**Opção A:** seção no PDF (a NR-18 pede a relação como parte do PGR).
**Opção B:** só na aba Documentos do PGR, sem alterar o documento gerado.
**Recomendação técnica:** **A** — o 18.4.3 trata do conteúdo do PGR, e a relação derivada não custa
migration. O template já sabe listar EPIs por risco; a seção nova é a consolidação deduplicada.

# Classificação final

| Issue   | Dificuldade | Prontidão                                      | Migration                          | Risco      | Cobertura hoje |
| ------- | ----------- | ---------------------------------------------- | ---------------------------------- | ---------- | -------------- |
| **#40** | **4/5**     | **NEEDS PRODUCT DECISION** (Q1, Q2, Q3)        | **SIM** (tabela + enum, se Q2 = A) | Médio-alto | ~10%           |
| **#48** | **2/5**     | **READY COM PREMISSAS** (só Q4 muda o alcance) | **NÃO**                            | Baixo      | ~60%           |
| **#47** | **2/5**     | **READY APÓS #40** — só falta a seção NR-17    | **NÃO**                            | Médio      | ~80%           |

# Recomendação

Rodar o lote em série numa branch só: **#40 → seção NR-17 no PDF (#47 fecha) → #48 (tipos NR-18 +
relação de EPIs)**. A migration da #40 sai isolada no começo; o template é tocado duas vezes, mas na
mesma branch e com os testes de ordem herdados do Lote 2. #48 é a parte barata e pode, se necessário,
ser cortada para um lote seguinte sem prejudicar o fechamento da #47.
