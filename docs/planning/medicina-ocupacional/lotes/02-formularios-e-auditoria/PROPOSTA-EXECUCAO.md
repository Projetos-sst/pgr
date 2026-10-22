# Lote 02 — PROPOSTA DE EXECUÇÃO

> **Documento de preparação, escrito em 2026-10-21 pelo Agente 5. Nada aqui foi implementado.** Nenhum código, migration,
> branch ou PR foi criado. Tudo o que é desenho é **PROPOSTA**. Suposição não verificada aparece como **HIPÓTESE**.
> Decisão de produto, clínica ou de arquitetura **não** é tomada aqui: as opções ficam abertas para o time.
> [README](README.md) · [PLAN](PLAN.md) · [TASK](TASK.md) · [AUDIT](AUDIT.md) · [Decisões](../../geral/04-DECISOES-E-BLOQUEIOS.md) ·
> [Git/migrations/CD](../../geral/06-GIT-MIGRATIONS-CD.md)

## 0. Base de fatos

| Fato                                                                                                                                                    | Evidência (verificada em 2026-10-21)                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `origin/develop` = `d6b787c`                                                                                                                            | `git rev-parse origin/develop`                                                                                                                                                                                                                                                                                                                                                             |
| Última migration da develop: `0053_company_module_access`, `when` 1792509152595                                                                         | `src/shared/db/migrations/meta/_journal.json:377-381`; 54 arquivos `.sql` (0000–0053)                                                                                                                                                                                                                                                                                                      |
| Snapshots encadeados na develop                                                                                                                         | `meta/0053_snapshot.json:3` (`prevId`) = `meta/0052_snapshot.json:2` (`id`)                                                                                                                                                                                                                                                                                                                |
| PR #112 (NOB-98): aberta, **draft**, base `develop`, `MERGEABLE`, CI verde (lint/format/typecheck, build, unit+integração)                              | `gh pr list` e `gh pr checks 112`                                                                                                                                                                                                                                                                                                                                                          |
| #112 reserva `0054_medical_risk_sources`, `0055_pgr_inventory_module_access`, `0056_company_risk_authorizations`; snapshots encadeados a partir da 0053 | journal e `meta/0054..0056_snapshot.json` em `origin/codex/NOB-98-feat/riscos-para-medicina` (`5cca180`)                                                                                                                                                                                                                                                                                   |
| Pilha empilhada na #112: #119 (`0057_machine_installations`), #115 (sem migration), #116 (`0058_pgr_basic_offers`), #117 (`0059_pgr_document_reviews`)  | `gh pr list` (bases encadeadas); journals das branches `origin/codex/NOB-104…`, `NOB-106…`, `NOB-107…`                                                                                                                                                                                                                                                                                     |
| Maior `when` reservado hoje: 1792608470913 (0059)                                                                                                       | journal de `origin/codex/NOB-107-test/amostras-revisao`                                                                                                                                                                                                                                                                                                                                    |
| Lote 01 em andamento **no working tree** desta branch (não commitado)                                                                                   | `git status`: `M` em `domains/pgr/health-exams.ts`, `repositories/health-exams.ts`, `actions/pgr/health-exams.ts`, `api/v1/health-exams/route.ts`, `nav-menu.tsx`, `_ui/list.tsx`, `dashboard-widgets.tsx`; `??` em `domains/medicine/`, `server/medicine/`, `actions/medicine/`, `repositories/medicine-overview.ts`, `api/v1/medicine/`, `_ui/stat-card.tsx`, `_ui/list-error-state.tsx` |
| Douglas aprovou o direcionamento geral e o início do Lote 01 (informado pelo Carlos, 21/10)                                                             | informação do coordenador. **Não** aprova migration, a 0055, assinatura médica nem regra clínica                                                                                                                                                                                                                                                                                           |

**Leitura de código:** as citações `arquivo:linha` abaixo são do **`HEAD` (`c0f10e4`, igual à develop no código)**, lidas
com `git show HEAD:<arquivo>` quando o arquivo está sendo editado pelo Lote 01. Onde cito o working tree do Lote 01, isso
vem marcado como "WT Lote 01", e as linhas podem mudar.

---

## a) Mapa campo → entidade → documento

Fontes: protótipo `Projeto-SST-Ocupacional/app/saude-ocupacional.html` (citado como `html:N`) e a especificação
`especificacao/Especificacao-da-Plataforma-SST.md` (`SPEC:N`). O protótipo usa dados fictícios, e nenhum valor dele foi
copiado. Sensibilidade segue AUDIT-PROTOTYPE §5.13: **S3** dado de saúde individual, **S2** dado pessoal ou conclusão,
**S1** cadastral.

Destino: **R** reutilizar coluna existente · **E** estender entidade existente · **N** entidade/coluna nova ·
**D** derivado (não é campo) · **F** fora do Lote 02.

### a.1 ASO, formulário de registro (P-12, `fAso`, `html:797-823`)

| #   | Campo do protótipo                                                                                                                                | Coluna real                                                                                                                                | Dest.            | Entidade                                 | Documento que consome                        | Sens.                                       | Decisão / lote                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------- | -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Funcionário (`funcionarioId`, `html:809`)                                                                                                         | `health_exams.employee_id` (`schema/health-exams.ts:48-50`)                                                                                | R                | `health_exams`                           | ASO, S-2220                                  | S2                                          | —                                                                                                                                                                                                                                                                                                          |
| 2   | Tipo de exame (`tipo`, 5 valores, `html:204`, `html:810`)                                                                                         | `exam_type` (`schema/health-exams.ts:19-25`)                                                                                               | R                | `health_exams`                           | ASO, S-2220                                  | S2                                          | **Divergência de rótulo:** o protótipo diz "Mudança de risco ocupacional" (`html:204`) e a plataforma diz "Mudança de Função" (`domains/pgr/health-exams.ts:33`). O rótulo é compartilhado com a OS (`service-order-form.tsx:13,48`) e o enum também (`schema/service-orders.ts:23,46`). D-13 + MED-DEC-14 |
| 3   | Data do ASO (`data`, `html:811`)                                                                                                                  | `performed_at` (`schema/health-exams.ts:53`)                                                                                               | R                | `health_exams`                           | ASO, S-2220                                  | S2                                          | **Pergunta nova:** "data do ASO" (emissão) e "realizado em" (exame) são a mesma data? Afeta Lote 04 (MED-DEC-14/28)                                                                                                                                                                                        |
| 4   | Conclusão (`resultado` apto/restrição/inapto, `html:812`)                                                                                         | `aptitude` (`schema/health-exams.ts:27-31,55`)                                                                                             | R                | `health_exams`                           | ASO (a empresa vê só a conclusão, `SPEC:61`) | S2                                          | —                                                                                                                                                                                                                                                                                                          |
| 5   | Médico examinador (texto) + CRM/UF (texto) (`html:813-814`)                                                                                       | `doctor_id` → `medicos` (`schema/health-exams.ts:51`); `medicos.crm` sem UF (`schema/medicos.ts:33`), `UNIQUE(org, crm)` (`medicos.ts:43`) | R + E            | `health_exams` + `medicos`               | ASO                                          | S1                                          | UF/RQE do CRM: Lote 03 (MED-DEC-04/10). **Obrigatoriedade:** o protótipo bloqueia sem médico (`html:2569`), a plataforma aceita vazio (`domains/pgr/health-exams.ts:87`). MED-DEC-14                                                                                                                       |
| 6   | Procedimentos realizados (`exames[{nome, data}]`, `html:816-817`); pré-preenche "Exame clínico" + exames da função com a data do ASO (`html:799`) | —                                                                                                                                          | N                | catálogo + `health_exam_procedures` (P4) | ASO (procedimentos com data), S-2220         | S3 média (revela quais exames foram feitos) | MED-DEC-08, 26, 24                                                                                                                                                                                                                                                                                         |
| 7   | "Riscos impressos no ASO" (`html:819`)                                                                                                            | riscos do GES (`risks`) e, na #112, `medical_risk_*`                                                                                       | D                | cadastros comuns                         | ASO                                          | S1                                          | Nunca vira campo da Medicina (regra do PLAN §2). Lotes 03/04                                                                                                                                                                                                                                               |
| 8   | Resultado COPSOQ individual, "sigilo médico" (`html:820`)                                                                                         | —                                                                                                                                          | F                | psicossocial                             | nenhum (não sai no ASO)                      | **S3**                                      | MED-DEC-11, 30                                                                                                                                                                                                                                                                                             |
| 9   | Observações / restrições (`obs`, `html:821`)                                                                                                      | `notes` (`schema/health-exams.ts:56`), texto livre sem limite (`form-fields.ts:3-7`)                                                       | R (com ressalva) | `health_exams`                           | ASO (as restrições), nada (as observações)   | S2/S3                                       | O protótipo mistura restrição (vai no ASO) e observação (não vai). Separar? Aviso "não registre CID"? MED-DEC-14, 18                                                                                                                                                                                       |
| 10  | Alertas de dispensa do demissional e de retorno (`html:801-803`)                                                                                  | —                                                                                                                                          | D                | regra clínica                            | —                                            | —                                           | MED-DEC-27. Fora do Lote 02                                                                                                                                                                                                                                                                                |
| 11  | Snapshot da emissão (`snap`, `html:2570`; `snapASO`, `html:825-828`)                                                                              | —                                                                                                                                          | F                | emissão (Lote 04)                        | ASO                                          | S2                                          | MED-DEC-12, 28                                                                                                                                                                                                                                                                                             |
| 12  | (sem campo no protótipo) validade                                                                                                                 | `valid_until` (`schema/health-exams.ts:54`), informada                                                                                     | R                | `health_exams`                           | ficha, painel                                | S1                                          | O protótipo calcula pela periodicidade da função. A plataforma usa a validade informada (Lote 01), sem cálculo: MED-DEC-27                                                                                                                                                                                 |
| 13  | (sem campo no protótipo) anexo                                                                                                                    | `certificate_path` (`schema/health-exams.ts:57`), texto                                                                                    | R                | `health_exams`                           | —                                            | S2                                          | GED do ASO: Lote 04                                                                                                                                                                                                                                                                                        |
| 14  | Empresa do exame: implícita pelo funcionário (`html:798`) e congelada no snapshot (razão/CNPJ, `html:826`)                                        | **não existe** (visibilidade pela empresa atual do funcionário, `schema/health-exams.ts:63-69`)                                            | N                | `health_exams.company_id`                | ASO, ficha, painel                           | S1                                          | MED-DEC-08, 26, 23 (ver §e.1)                                                                                                                                                                                                                                                                              |

### a.2 Encaminhamento e resultados (P-07, `fEnc`, `html:1910-1956`)

| #   | Campo do protótipo                                                                                                                     | Coluna real                                                                     | Dest.     | Motivo / decisão                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Trabalhador, tipo, clínica, data de preferência, data agendada, hora, situação (`ENC_STATUS`, `html:1813`), observações para a clínica | —                                                                               | F         | Encaminhamento e clínica: fase 2, Lote 06 (AUDIT-DATABASE §10.2; MED-DEC-21)                                                                                                                                   |
| 16  | Procedimento: `solicitado`, `nome`, `data`, `status` pendente/normal/alterado, `resultado` ("laudo resumido") (`html:1929-1933`)       | —                                                                               | N parcial | Entram só **procedimento + data + situação de realização**. `resultado` (texto) e `normal/alterado` (interpretação) ficam **fora**: são resultado clínico (AUDIT-DATABASE §10.4 P4; `SPEC:93`). MED-DEC-24, 11 |
| 17  | 12 sinais vitais e antropometria (`MEDIDAS`, `html:1815`)                                                                              | —                                                                               | F         | S3. MED-DEC-11                                                                                                                                                                                                 |
| 18  | Audiometria (OD/OE, 7 frequências) e espirometria (CVF, VEF1, % previsto)                                                              | —                                                                               | F         | S3; "ficam com o médico" (`SPEC:93`)                                                                                                                                                                           |
| 19  | Médico examinador (lista ou "outro" digitado), data da conclusão, conclusão com "Pendente", restrições                                 | `doctor_id`, `performed_at`, `aptitude` (NOT NULL, `schema/health-exams.ts:55`) | R parcial | "Pendente" exige estado de documento: MED-DEC-28 (Lote 04)                                                                                                                                                     |
| 20  | Importação de laudos com IA (`html:1936`)                                                                                              | —                                                                               | F         | MED-DEC-20                                                                                                                                                                                                     |
| 21  | Validação de conclusão: procedimento solicitado sem data e pendente bloqueia (`html:2055-2056`)                                        | —                                                                               | N (regra) | Vira regra técnica do P4 só se a MED-DEC-24 confirmar os estados (ver §c.4)                                                                                                                                    |

### a.3 Outras telas que tocam o Lote 02

| #   | Origem                                                                                                                                                                        | Destino                            | Decisão / lote                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| 22  | Funções → exames `{nome, meses}` (P-03; `procedimentosPara`, `html:1836`)                                                                                                     | plano de exames da versão do PCMSO | Lote 05; MED-DEC-27                                 |
| 23  | Lista de ASO: empresa não altera ASO emitido pela clínica (`html:2287`); `bloqueioExclusao` impede excluir funcionário/empresa com ASO (guarda de 20/30 anos, `html:547-551`) | arquivamento em vez de DELETE      | MED-DEC-15 (`SPEC:51`: 20 anos após o desligamento) |
| 24  | "Registro de auditoria imutável de leituras e alterações de dados clínicos, guardado por 5 anos" (`SPEC:215`)                                                                 | trilha P9                          | MED-DEC-11, 15 (ver §e.3)                           |

**Conclusão do mapa:** o formulário de exame da plataforma (`health-exam-form.tsx`, campos nas linhas 101-160 do `HEAD`) já
cobre os itens 1–5, 9, 12 e 13. O que falta para o Lote 02 é: **procedimentos (6/16)** e **empresa do exame (14)**. Todo o
resto fica fora ou depende de decisão clínica.

---

## b) Especificação dos formulários

### b.1 Registro de exame (`/health-exams/new` e `/health-exams/[id]/edit`), extensão do formulário atual

| Campo (label)                | `name`            | Tipo de controle                                                                                      | Obrigatório                    | Validação                                                                                 | Estado                                   |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Funcionário                  | `employeeId`      | select                                                                                                | sim                            | UUID do tenant (`FK_NOT_FOUND`); empresa com Medicina (`repositories/health-exams.ts:37`) | existente                                |
| Tipo de exame                | `examType`        | select                                                                                                | sim                            | enum de 5 valores                                                                         | existente (rótulo: D-13/MED-DEC-14)      |
| Médico responsável           | `doctorId`        | select                                                                                                | não                            | médico do tenant                                                                          | existente (obrigatoriedade: MED-DEC-14)  |
| Aptidão                      | `aptitude`        | select                                                                                                | sim                            | enum de 3 valores                                                                         | existente                                |
| Realizado em                 | `performedAt`     | data                                                                                                  | sim                            | calendário válido, não futura (`domains/pgr/health-exams.ts:79-83`)                       | existente                                |
| Vencimento                   | `validUntil`      | data                                                                                                  | não                            | formato (`:90`) **+ proposta: `>= performedAt`**                                          | proposta independente (T02-A2)           |
| Caminho do ASO / certificado | `certificatePath` | texto                                                                                                 | não                            | texto livre (`:93`)                                                                       | existente                                |
| Observações                  | `notes`           | textarea                                                                                              | não                            | texto livre (`:92`); proposta técnica: limite de tamanho (HIPÓTESE: 2.000 caracteres)     | existente (aviso/destino: MED-DEC-14/18) |
| Empresa do exame             | —                 | **não aparece no formulário**; exibida só em leitura                                                  | —                              | derivada no servidor, **nunca vinda do cliente**                                          | condicionado (§c.3)                      |
| Procedimentos                | `procedures[]`    | lista de linhas: procedimento (select do catálogo), data, situação; botões "+ procedimento" e remover | não (a lista pode ficar vazia) | ver §c.4                                                                                  | condicionado (§c.4)                      |

Regras de UX:

- Linha nova de procedimento usa a data de realização como padrão, como o protótipo faz (`html:799`). HIPÓTESE: confirmar com o Carlos.
- **Nenhum campo de valor ou laudo** na linha. O schema não terá a chave, e o teste Q08 do [QA](QA.md) verifica isso.
- Erro de carregamento do catálogo é diferente de catálogo vazio (reusar o `list-error-state` criado no Lote 01).
- Se a empresa do funcionário estiver sem Medicina, o select de funcionários já não lista (filtro de módulo em `repositories/employees.ts:113`).

### b.2 Catálogo de procedimentos (condicionado à MED-DEC-24)

- **Se for por escritório:** lista + formulário no padrão do `medicos` (`/exam-procedures`, `/new`, `/[id]/edit`), com os campos
  `name` (obrigatório, único por escritório), `code` (opcional), `kind` (clínico/complementar), `active`. A exclusão mostra
  os dependentes e é recusada com `IN_USE` se houver exame ligado. Preferir desativar.
- **Se for referência global:** **sem formulário**. Só leitura, carregada por script com conexão owner (precedente
  `caepi_certificates`).

### b.3 Trilha de auditoria

**Sem tela** até a MED-DEC-11 e a MED-DEC-21 definirem quem vê (o PLAN §4 já registra isso).

---

## c) Contratos de dados propostos

Regra das quatro superfícies (CLAUDE.md): Server Action com `officeAction`, REST espelho com `restHandler`, `api-design.md`
e Postman. A tabela §c.6 resume quais contratos expõem HTTP.

### c.1 Validação de datas (independente, zero migration, precisa do OK do Carlos: T02-A2)

```ts
// src/shared/domains/pgr/health-exams.ts — PROPOSTA (o arquivo está sendo editado pelo Lote 01)
export const healthExamInputSchema = z
  .object({
    /* campos atuais, linhas 85-94 do HEAD */
  })
  .refine((v) => !v.validUntil || v.validUntil >= v.performedAt, {
    path: ["validUntil"],
    message: "Vencimento anterior à realização",
  });
```

- Contrato HTTP inalterado: só aparece um novo caso de `VALIDATION` (422). As duas superfícies usam o mesmo schema
  (`api/v1/health-exams/route.ts:32` e `[id]/route.ts:25` do `HEAD`).
- Hoje ninguém chama `.extend`, `.pick` ou `.omit` nesse schema (verificado com `git grep`). HIPÓTESE: no Zod 4.4.3, esses
  métodos sobre um objeto refinado têm restrições. Conferir na implementação.
- Risco: um exame antigo com `valid_until < performed_at` deixa de ser salvo na edição até ser corrigido. HIPÓTESE:
  contar esses casos na homologação antes do merge, sem expor dado.
- Testes: unit (data igual passa, data anterior falha, vazio passa) + integração REST/Action (`VALIDATION`).
- Documentação: uma frase em `api-design.md` (linha 143, recurso `/health-exams`). Postman: um request negativo (opcional).

### c.2 Metadados de auditoria sem conteúdo clínico (independente: função pura, sem tabela)

```ts
// src/shared/domains/medicine/clinical-audit.ts — PROPOSTA (caminho HIPÓTESE; o diretório é criado pelo Lote 01)
export const CLINICAL_AUDIT_ACTIONS = [
  "health_exam.create",
  "health_exam.update",
  "health_exam.delete",
  "health_exam.read",
] as const;
export const HEALTH_EXAM_AUDITABLE_FIELDS = [
  "employeeId",
  "doctorId",
  "examType",
  "performedAt",
  "validUntil",
  "aptitude",
  "notes",
  "certificatePath",
] as const;
export const clinicalAuditMetadataSchema = z.strictObject({
  changedFields: z.array(z.enum(HEALTH_EXAM_AUDITABLE_FIELDS)).optional(), // só NOMES, nunca valores
  surface: z.enum(["action", "rest", "page"]),
});
export function changedFieldNames(
  before: HealthExamValues,
  after: HealthExamValues,
): HealthExamAuditableField[];
```

- `strictObject` recusa chave desconhecida. O teste unit tenta gravar `notes`, `aptitude: "unfit"` ou um CID e espera falha
  (cenário Q07).
- Fica de fora de propósito: "motivo" em texto livre. Ele pode carregar conteúdo clínico, e por isso depende da MED-DEC-11/14.
- **Recomendação:** só escrever esse código junto com a tabela (§c.5), para não deixar código sem consumidor. A exceção é o
  Rikelvin (R-05) querer revisar o contrato antes.

### c.3 `health_exams.company_id` (condicionado: MED-DEC-08, 26, 23)

- **Input:** **não muda**. A empresa nunca vem do cliente, pelo mesmo princípio do tenant. O servidor deriva o valor de
  `employees.company_id` dentro da transação de criação, aproveitando a leitura que `assertRefsInTenant` já faz
  (`repositories/health-exams.ts:31-37`).
- **Saída:** o tipo `HealthExam` ganha `companyId`. HIPÓTESE: `HealthExamListItem` (`domains/pgr/health-exams.ts:100-110`)
  ganha `companyId` e `companyName`.
- **Edição:** hoje o `updateHealthExam` permite trocar o funcionário (`repositories/health-exams.ts:161`). É preciso decidir
  (decisão técnica do Carlos) entre: (i) **bloquear a troca de funcionário** na edição, que vira `VALIDATION`; (ii) recalcular
  a empresa quando o funcionário mudar.
- **Filtro `?companyId=`:** no WT Lote 01 ele significa "empresa ATUAL do funcionário" (`domains/pgr/health-exams.ts:126-131`
  do WT). Depois da coluna, o significado muda para "empresa do exame". É uma mudança de contrato: atualizar `api-design.md`
  e a descrição no Postman.
- Superfícies: as quatro já existem para `/health-exams`. Só documentação e Postman mudam.

### c.4 Catálogo e procedimentos por exame (condicionado: MED-DEC-24, 08, 26 e §c.3 antes)

```ts
// PROPOSTA — só se a MED-DEC-24 escolher catálogo por escritório
export const EXAM_PROCEDURE_KINDS = ["clinical", "complementary"] as const;
export const examProcedureInputSchema = z.object({
  name: requiredString("Nome é obrigatório").max(200),
  code: optionalString, // código de referência (HIPÓTESE: tabela 27 do eSocial; validar)
  kind: z.enum(EXAM_PROCEDURE_KINDS),
  active: z.boolean().default(true),
});

// Linha de procedimento dentro do exame. Os valores de status dependem da MED-DEC-24
export const PROCEDURE_STATUSES = ["pending", "done", "not_done"] as const; // PROPOSTA do AUDIT-DATABASE P4
export const healthExamProcedureSchema = z
  .strictObject({
    // strict: nenhuma chave de resultado
    procedureId: requiredUuid("Procedimento é obrigatório"),
    performedAt: optionalIsoDate, // não futura
    status: z.enum(PROCEDURE_STATUSES),
  })
  .refine((p) => (p.status === "done") === Boolean(p.performedAt), {
    path: ["performedAt"],
    message: "Informe a data só para procedimento realizado",
  });
// healthExamInputSchema ganha `procedures: z.array(healthExamProcedureSchema).max(50).default([])`,
// sem procedureId repetido (VALIDATION)
```

- **Persistência:** o array vai **dentro** do payload do exame e é gravado na **mesma transação** (substitui o conjunto
  inteiro na edição). Assim a UI tem um só "Salvar" e a trilha (§c.5) registra uma só ação. Alternativa: sub-recurso
  `/api/v1/health-exams/{id}/procedures` (GET/PUT). Fica para o time decidir.
- **Coerência `done` ⇔ data:** é proposta técnica, não regra clínica, e precisa do OK do Carlos. Janela de validade de exame
  complementar em relação ao ASO é regra clínica: MED-DEC-27, fora daqui.
- **REST do catálogo (por escritório):** `GET`/`POST` `/api/v1/exam-procedures` (`?search=`, `?kind=`, `?active=`; `201`);
  `GET`/`PUT`/`DELETE` `/api/v1/exam-procedures/{id}` (`204`; `409 IN_USE` com dependentes, mapeamento já existente em
  `api/rest.ts:18`); `GET /api/v1/exam-procedures/{id}/dependents`. Server Action com `officeAction`
  (HIPÓTESE de caminho: `actions/medicine/exam-procedures.ts`). Pasta nova no Postman + seção no `api-design.md`.
- **Catálogo global:** só leitura (`GET`), sem CRUD e sem `/dependents` no runtime, porque a escrita é do script owner. As
  quatro superfícies continuam valendo para o GET.

### c.5 Trilha de auditoria clínica (condicionado: MED-DEC-11, 15, 08, 26; revisão R-05 do Rikelvin)

```ts
// repositories/clinical-audit.ts — PROPOSTA. Chamado DENTRO do withOrg da operação (mesma tx)
export async function recordClinicalAuditTx(
  tx: TenantTransaction,
  e: {
    orgId: string;
    companyId: string;
    actorUserId: string;
    action: ClinicalAuditAction;
    entityType: "health_exam";
    entityId: string;
    metadata: ClinicalAuditMetadata; // validado por clinicalAuditMetadataSchema (§c.2)
  },
): Promise<void>;
```

- **Onde gravar:** no **repositório**, dentro da transação, e não no `officeAction` nem no `restHandler`. Os dois logs de
  sucesso existentes ficam **fora** da transação e vão só para o console: `office-action.ts:27-34` e `api/rest.ts:77-106`.
  O `auditedTenantWrite` só registra **falha** (`repositories/audited-write.ts:10-18`), e o destino é o console
  (`tenant/audit-log.ts:19-26`). Gravar no repositório cobre Action e REST de uma vez.
- **Sem superfície HTTP** enquanto ninguém puder ver a trilha (MED-DEC-11/21). A regra das quatro superfícies vale para
  recurso exposto por HTTP; este caso precisa ficar registrado na PR como exceção.
- Ator: a #112 introduz `app.current_actor` (`set_config` em `repositories/risk-authorizations.ts:37` da branch) e a policy
  `WITH CHECK (actor = current_setting('app.current_actor', true))` (`0056_…sql:77`). Reusar o padrão **depende do merge da #112**.
  Sem ele, o ator vem do `TenantContext` só pela aplicação.

### c.6 Resumo das superfícies

| Contrato                      | Server Action       | REST                     | api-design          | Postman             | Migration |
| ----------------------------- | ------------------- | ------------------------ | ------------------- | ------------------- | --------- |
| c.1 datas                     | existente (schema)  | existente (schema)       | 1 frase             | opcional            | não       |
| c.2 metadados                 | —                   | —                        | —                   | —                   | não       |
| c.3 `company_id`              | existente           | existente                | atualizar filtro    | atualizar descrição | **sim**   |
| c.4 catálogo (por escritório) | **nova**            | **nova** + `/dependents` | **nova seção**      | **nova pasta**      | **sim**   |
| c.4 procedimentos do exame    | existente (payload) | existente (payload)      | atualizar           | atualizar exemplos  | **sim**   |
| c.5 trilha                    | — (interna)         | — (sem HTTP)             | registrar a exceção | —                   | **sim**   |

---

## d) Escopo INDEPENDENTE × CONDICIONADO

### d.1 Independente (sem migration; pode avançar já)

| ID  | Item                                                   | Estado em 2026-10-21                       | Observação                                                                                                                                                                                  |
| --- | ------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-1 | Mapa campo → entidade → documento                      | **rascunho entregue neste documento (§a)** | T02-A1 só fecha com a revisão do Carlos                                                                                                                                                     |
| I-2 | Especificação dos formulários                          | rascunho (§b)                              | idem                                                                                                                                                                                        |
| I-3 | Contratos propostos                                    | rascunho (§c)                              | idem                                                                                                                                                                                        |
| I-4 | Validação `valid_until >= performed_at`                | não iniciado                               | Precisa do OK do Carlos (T02-A2). **Toca `domains/pgr/health-exams.ts`, que o Lote 01 está editando:** fazer depois do merge do Lote 01 ou dentro da PR dele, com o consentimento do Carlos |
| I-5 | Helpers puros de auditoria (§c.2) e unit tests         | não iniciado                               | Opcional; recomendação: junto com I-9/K-7                                                                                                                                                   |
| I-6 | Revisão das validações existentes                      | **feita (lista abaixo)**                   | —                                                                                                                                                                                           |
| I-7 | Componente de linhas de procedimento sem dado sigiloso | não iniciado                               | Opcional; não recomendo antes da K-6 (seria UI sem consumidor)                                                                                                                              |
| I-8 | Plano de testes de domínio sem tabela nova             | cenários em [QA](QA.md)                    | —                                                                                                                                                                                           |
| I-9 | Perguntas novas ao coordenador (§d.3)                  | listadas                                   | O coordenador decide se viram `MED-DEC-NN`                                                                                                                                                  |

**I-6: achados da revisão das validações existentes (código do `HEAD`)**

1. `valid_until` anterior a `performed_at` é aceito (`domains/pgr/health-exams.ts:90`). Proposta I-4.
2. O médico é opcional (`:87`); o protótipo exige (`html:2569`). Decisão MED-DEC-14.
3. `notes` e `certificate_path` não têm limite de tamanho (`form-fields.ts:3-7`, usados em `:92-93`). Proposta técnica: limite (HIPÓTESE: 2.000 / 500).
4. `GET /api/v1/health-exams?examType=<inválido>` **ignora** o filtro em silêncio (`api/v1/health-exams/route.ts:11-16` do `HEAD`). O arquivo está sendo alterado pelo Lote 01. Só registro, sem proposta neste lote.
5. Na edição, `updateHealthExam` permite trocar o funcionário (`repositories/health-exams.ts:161`). Isso importa para a `company_id` (§c.3).
6. Os rótulos dos tipos de exame são compartilhados com a OS (`service-order-form.tsx:48`). Trocar o rótulo afeta a OS.
7. `deleteHealthExam` faz DELETE físico (`repositories/health-exams.ts:178-188`). `deleteEmployee` (`repositories/employees.ts:225`) e o CASCADE (`schema/health-exams.ts:50`) apagam exames. Decisão MED-DEC-15.

### d.2 Condicionado (com migration ou decisão clínica)

| ID   | Item                                                                                                                       | Trava (decisão)                                                                                              | Depende também de                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| K-1  | Coluna `health_exams.company_id` nullable + FK composta + índice + backfill + escrita na aplicação (policy **inalterada**) | **MED-DEC-08**, **MED-DEC-26**; ON DELETE da FK (§e.1) toca a **MED-DEC-15**                                 | Lote 01 mergeado; ordem da #112 e da pilha 0057–0059                                                    |
| K-2  | Troca da policy `health_exams_module_access` para usar a `company_id` própria                                              | **MED-DEC-23** + 08/26                                                                                       | K-1 conferido em homologação                                                                            |
| K-3  | `company_id NOT NULL`                                                                                                      | MED-DEC-26 (regra aditiva)                                                                                   | K-1 com backfill conferido                                                                              |
| K-4  | Trocar `employee_id ON DELETE CASCADE` por RESTRICT; arquivamento (`archived_at`…)                                         | **MED-DEC-15**                                                                                               | K-1                                                                                                     |
| K-5  | Catálogo de procedimentos                                                                                                  | **MED-DEC-24** + 08/26                                                                                       | —                                                                                                       |
| K-6  | Procedimentos por exame (estados sem resultado)                                                                            | **MED-DEC-24** (lista e estados) + **MED-DEC-11** (se algo além de pendente/realizado/não realizado) + 08/26 | K-5; K-1 (FK composta com `company_id`)                                                                 |
| K-7  | Trilha de auditoria clínica                                                                                                | **MED-DEC-11** (onde vive, quem vê), **MED-DEC-15** (retenção: 5 anos em `SPEC:215`), 08/26                  | revisão R-05 do Rikelvin (sem entrada MED-DEC; `DECISIONS.md` R-05); padrão `app.current_actor` da #112 |
| K-8  | Auditoria de leitura (ficha, edição)                                                                                       | **MED-DEC-11**                                                                                               | K-7; impacto nas páginas do Lote 01 (ver §e.3)                                                          |
| K-9  | Destino de `notes` (separar restrição × observação; aviso de CID)                                                          | **MED-DEC-14**, **MED-DEC-18**                                                                               | —                                                                                                       |
| K-10 | Tipo de exame próprio / rótulo "mudança de risco"                                                                          | **D-13** (sem entrada MED-DEC, ver 04 §2.1) + MED-DEC-14                                                     | impacto na OS                                                                                           |
| K-11 | Médico obrigatório                                                                                                         | **MED-DEC-14**                                                                                               | —                                                                                                       |

### d.3 Perguntas novas para o coordenador (não decididas aqui)

1. "Data do ASO" e "data de realização" são a mesma data? (§a item 3)
2. Na edição de um exame, pode-se trocar o funcionário? (§c.3, decisão técnica do Carlos)
3. ON DELETE da FK `health_exams.company_id`: CASCADE cria uma via **nova** de perda (§e.1). Escolher antes de gerar a K-1.
4. Quais leituras são auditadas (por exame individual, por lista, por painel agregado)? (§e.3)
5. Alteração de exame exige motivo? Se sim, texto livre ou lista fechada? (§c.2)
6. Rótulo do tipo `change_of_function`: manter ou passar a "Mudança de risco ocupacional", como no protótipo? (§a item 2)

---

## e) Análises (opções, sem escolha pelo time)

### e.1 `health_exams.company_id`

**Situação.** A visibilidade do exame vem do `employees.company_id` **atual**: a policy RESTRICTIVE faz `EXISTS` em
`employees` + `company_modules` (`schema/health-exams.ts:63-69`; SQL em `0053_company_module_access.sql:32`). Transferir um
funcionário é um UPDATE de `company_id` (`repositories/employees.ts:30-32`, `203-213`). Efeitos de hoje:

- os exames passam a "pertencer" à empresa nova;
- se a empresa nova **não** tem Medicina, os exames antigos ficam **invisíveis** para o runtime, sem serem apagados.

**Opções de modelo**

| Opção   | Descrição                                                                                                                                                                    | Prós                                                                               | Contras                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E-0     | Status quo (sem coluna)                                                                                                                                                      | zero migration                                                                     | exame segue a transferência; contraria o objetivo do lote e a DoD do 07                                                                                |
| E-1     | `company_id uuid` nullable + FK composta `(company_id, org_id) → companies(id, org_id)` (há `uq_companies_id_org`, `schema/companies.ts:50`) + índice `(org_id, company_id)` | padrão das tabelas da #112 e da 0053; habilita FK composta nas tabelas filhas (P4) | precisa backfill e decisão de ON DELETE                                                                                                                |
| E-2     | `company_id` **sem FK** + snapshot de razão/CNPJ                                                                                                                             | não bloqueia nem apaga nada                                                        | sem integridade; o snapshot é assunto do Lote 04 (MED-DEC-12/28)                                                                                       |
| ~~E-3~~ | FK composta para `employees(id, org_id, company_id)`                                                                                                                         | —                                                                                  | **inviável para o objetivo:** amarra o exame à empresa atual do funcionário; além disso, `employees` não tem esse UNIQUE (`schema/employees.ts:72-76`) |

**Backfill (E-1).** `UPDATE health_exams h SET company_id = e.company_id FROM employees e WHERE e.id = h.employee_id AND
e.org_id = h.org_id AND h.company_id IS NULL;` é idempotente. **Limite conhecido:** usa a empresa **atual**, porque não existe
histórico de função/empresa (P3 `employee_job_assignments` não existe: GAP MED-12). Exames de quem já foi transferido ficam
com a empresa errada e não há como reconstruir. Isso precisa constar na PR. Precedente de DML dentro de migration: o
`INSERT` em `company_module_events` na 0053 (`0053_company_module_access.sql:47`). HIPÓTESE: a migration roda como owner e
não é afetada pelo RLS (as tabelas não usam `FORCE ROW LEVEL SECURITY`). Conferir no ensaio.

**ON DELETE da FK nova**

| Opção                                                  | Efeito                                                                 | Observação                                                                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CASCADE                                                | apagar a empresa antiga apaga os exames de quem **já foi transferido** | **via nova de perda** (hoje esses exames sobrevivem, porque o funcionário está na empresa nova)                                                                                               |
| RESTRICT / NO ACTION                                   | impede apagar a empresa com exame histórico                            | muda o comportamento de excluir empresa; mexe na MED-DEC-15. HIPÓTESE: a interação com o CASCADE indireto `companies → employees → health_exams` precisa de ensaio (ordem dos gatilhos de FK) |
| `SET NULL (company_id)` com lista de colunas (PG ≥ 15) | mantém o exame e perde a empresa                                       | `SET NULL` simples anularia também `org_id` (NOT NULL) e falharia. HIPÓTESE: o drizzle-kit não emite a lista de colunas, então seria SQL custom                                               |

**Policy (K-2).** Trocar para `companyModuleScope(org_id, health_exams.company_id, 'medicine')` (`schema/module-policy.ts:5-13`)
simplifica a policy (um `EXISTS` a menos). Só depois de conferir o backfill e **em migration separada** (PLAN §3).

**Efeito na MED-DEC-23**

| Resposta da MED-DEC-23                         | Regra de leitura resultante                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "A empresa nova **não** vê exames da anterior" | policy só por `health_exams.company_id`; a ficha do funcionário na empresa nova mostra só os exames dela           |
| "A empresa nova **vê**"                        | policy `company_id do exame OU empresa atual do funcionário` com Medicina; a empresa antiga continua vendo os dela |
| Sem resposta                                   | K-1 pode entrar com a policy atual (sem mudar a visibilidade); K-2 fica bloqueada                                  |

Testes (Postgres efêmero): backfill reexecutado sem efeito (Q02); transferência não move o exame (Q03); empresa sem
Medicina não vê (Q04); `runIsolationSuite` (`_helpers/isolation-suite.ts:25`, 6 asserções nas linhas 50-90); filtro
`?companyId=` com o novo significado.

### e.2 Catálogo de procedimentos (MED-DEC-24)

| Opção | Modelo                                                                                                                             | Prós                                                                                                   | Contras                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| P-A   | Por escritório: `exam_procedures` (org_id, name, code?, kind, active), `UNIQUE(org, name)` (AUDIT-DATABASE §10.4 P4)               | flexível; CRUD no padrão `medicos`; 4 superfícies + `/dependents`                                      | sem padronização entre escritórios; cada escritório parte do zero (ou carga inicial por escritório) |
| P-B   | Referência global (sem `org_id`, RLS `USING (true)`, runtime só SELECT, escrita por script owner; precedente `caepi_certificates`) | padronização; base para S-2220 (HIPÓTESE: tabela 27 do eSocial, "procedimentos diagnósticos"; validar) | atualização normativa; sem personalização; exceção ao Princípio I, que precisa ser justificada      |
| P-C   | Híbrido: global + catálogo do escritório com `reference_code` opcional                                                             | junta os dois                                                                                          | duas tabelas e mais complexidade                                                                    |
| P-D   | Sem catálogo: nome livre por exame, como no protótipo (`html:816-817`)                                                             | o mais simples; não depende da lista inicial                                                           | sem padronização nem relatório confiável; ainda exige migration                                     |

**Comum a todas:** a linha por exame (`health_exam_procedures`) **sem valor de resultado**. Os estados propostos são
`pending`/`done`/`not_done`. O protótipo usa `pendente`/`normal`/`alterado` (`html:1932`), e "normal/alterado" é
**interpretação clínica**: fica fora até a MED-DEC-24/11. FK composta para o exame exige `UNIQUE (id, org_id, company_id)` em
`health_exams`, o que **depende da K-1**. ON DELETE do exame → procedimentos: CASCADE enquanto o exame puder ser apagado;
revisar junto com a K-4.

### e.3 Trilha de auditoria clínica (MED-DEC-11 / MED-DEC-15)

| Opção | Onde                                                                                                                                                                                    | Prós                                                     | Contras                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| T-A   | Tabela `medical_audit_events` no schema `public`, isolation + RESTRICTIVE `medicine`, GRANT só SELECT/INSERT (precedentes: `0053…sql:41`; `0056…sql:83-85` com `REVOKE UPDATE, DELETE`) | encaixa na arquitetura A da MED-DEC-11; padrão conhecido | todo o escritório com acesso ao runtime lê a trilha, se houver tela |
| T-B   | Schema `clinical` com role/GRANT próprios (opção B da MED-DEC-11)                                                                                                                       | segregação real                                          | infra nova; depende do ADR do Douglas                               |
| T-C   | Trilha genérica da plataforma (`audit_events`), usada também por outros módulos                                                                                                         | um só mecanismo                                          | escopo maior que a Medicina; decisão do Douglas                     |
| T-D   | Só log estruturado (status quo melhorado)                                                                                                                                               | sem migration                                            | não atende "imutável" (`SPEC:215`) nem a R3 da AUDIT-SECURITY       |

Pontos que valem para qualquer opção persistida:

- **Mesma transação, com rollback se a auditoria falhar** (Q06). Precedente: `setCompanyModule` grava o evento no mesmo
  `withOrg` (`repositories/company-modules.ts:62-101`, insert na linha 91).
- **FK da trilha para `companies`:** o precedente `company_module_events` usa CASCADE (`schema/company-modules.ts:70-73`).
  Na trilha clínica, CASCADE **apaga a trilha** junto com a empresa e contradiz "imutável". Opções: sem FK, RESTRICT ou
  arquivamento. Decisão ligada à **MED-DEC-15**.
- **RESTRICTIVE `medicine` na trilha:** com o módulo desligado, a trilha some para o runtime e a escrita é negada (a operação
  também é). Avaliar se a leitura da trilha por quem audita deve contornar isso (MED-DEC-11/21).
- **Auditoria de leitura:** auditar o GET individual (`getHealthExamById`, `repositories/health-exams.ts:110-122`) obriga a
  leitura a fazer INSERT. As páginas do Lote 01 (ficha, painel) são Server Components. HIPÓTESE: auditar só a leitura de
  exame individual (ficha/edição), não listas nem contagens (PLAN §4). Volume e custo em aberto: MED-DEC-11.
- **Retenção da trilha:** `SPEC:215` fala em 5 anos, a guarda do exame em 20 anos (`SPEC:51`). Qual vale para a trilha é
  MED-DEC-15 + jurídico.

---

## f) Checklist de pré-requisitos da Fase H (implementação com migration do Lote 02)

> "Fase H" não está definida nos documentos da frente. Aqui ela é tratada como **a fase de implementação com migration do
> Lote 02** (HIPÓTESE de significado, termo do coordenador). Base: [06 §3.4](../../geral/06-GIT-MIGRATIONS-CD.md).

| #   | Pré-requisito                                               | Hoje                       | Evidência / o que falta                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Base Git conhecida                                          | ✅                         | `origin/develop` = `d6b787c`                                                                                                                                                                                                                                           |
| 2   | Working tree livre para o Lote 02                           | ❌                         | Esta branch tem o Lote 01 não commitado (`git status`). O Lote 02 **não** deve começar aqui                                                                                                                                                                            |
| 3   | Última migration registrada                                 | ✅                         | `0053_company_module_access` (`_journal.json:377-381`)                                                                                                                                                                                                                 |
| 4   | Journal e snapshots coerentes                               | ✅ develop; ✅ #112        | develop: `0053.prevId` = `0052.id`. #112: 0054→0055→0056 encadeadas a partir da 0053                                                                                                                                                                                   |
| 5   | Concorrentes com migration mapeados                         | ✅                         | #112 (0054–0056), #119 (0057), #116 (0058), #117 (0059); #115 sem migration. Maior `when` reservado: 1792608470913                                                                                                                                                     |
| 6   | #112 mergeada (ou decidida)                                 | ❌                         | Aberta, **draft**, base `develop`, `MERGEABLE`, CI verde (`gh pr checks 112`). O merge também aplica a 0055 (MED-DEC-09 `PENDENTE`)                                                                                                                                    |
| 7   | Ordem de merge e numeração acordadas com Douglas e Rikelvin | ❌                         | MED-DEC-08 `PENDENTE`. "0060" é só a próxima livre **se** 0054–0059 entrarem antes; nunca escolher o número à mão (`drizzle-kit generate`)                                                                                                                             |
| 8   | Estratégia de migrations com CD                             | ❌                         | MED-DEC-26 `PENDENTE` (as regras do 06 §3.1 são PROPOSTAS)                                                                                                                                                                                                             |
| 9   | Arquivos comuns com o Lote 01 liberados                     | ❌                         | Lote 01 não mergeado. Comuns: `domains/pgr/health-exams.ts`, `repositories/health-exams.ts`, `actions/pgr/health-exams.ts`, `api/v1/health-exams/**`, `(protected)/health-exams/**`, `domains/medicine/`, `api-design.md`, Postman                                     |
| 10  | Arquivos comuns com a #112                                  | ⚠️ conhecidos              | A #112 altera `module-policy.ts` (usado pela policy de `health_exams`), `office-action.ts` (`tenantAccess`), `api/rest.ts`, `repositories/company-modules.ts`, `nav-menu.tsx`, `api-design.md`, Postman e cria `domains/medicine/*` (`git diff --stat develop...#112`) |
| 11  | Decisões clínicas e de produto                              | ❌                         | MED-DEC-11, 14, 15, 23, 24 `PENDENTE`                                                                                                                                                                                                                                  |
| 12  | Revisão R-05 do Rikelvin combinada                          | ❌                         | sem registro                                                                                                                                                                                                                                                           |
| 13  | Postgres de QA                                              | ⚠️                         | Contêiner local `qa-pg16` (postgres:16) no ar (`docker ps`). **Não verifiquei** se é o alvo do `INTEGRATION_DATABASE_URL`, porque não li o `.env`. O CI tem Postgres 16 efêmero (06 §2)                                                                                |
| 14  | Padrão de RLS disponível                                    | ✅ técnico                 | isolation + RESTRICTIVE (`schema/health-exams.ts:63-77`; `module-policy.ts:5-13`), `runIsolationSuite`. O desenho para as tabelas novas depende do item 11                                                                                                             |
| 15  | Impacto de CD entendido                                     | ✅ documentado / ❌ aceito | `cd.yml:67-75` aplica as migrations no merge. A produção está em 0052 (06 §1): o release levará 0053 + 0054–0059 + Lote 02 juntos (ensaiar)                                                                                                                            |
| 16  | Aceite do Douglas                                           | ⚠️ parcial                 | Ele aprovou o direcionamento e o início do Lote 01 (21/10). **Não** aprovou nenhuma migration do Lote 02                                                                                                                                                               |

**Satisfeitos hoje:** 1, 3, 4, 5, 14 e a documentação do 15. **Não satisfeitos:** 2, 6, 7, 8, 9, 11, 12. **Parciais:** 10, 13, 16.

---

## g) Estratégia de branch (PROPOSTA, nenhuma branch foi criada)

| Opção | Descrição                                                                                                                                               | Prós                                                                                                      | Contras                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1   | Branch nova de `origin/develop` **depois** do merge do Lote 01 (e, para a migration, depois da decisão da #112 e da pilha)                              | CI roda (base `develop`, `ci.yml:3-5`); sem conflito com o Lote 01; migration gerada sobre o journal real | espera                                                                                                                                                                           |
| G-2   | Empilhar sobre `feature/NOB-108-ficha-saude-ocupacional`                                                                                                | começa já                                                                                                 | **PR empilhada não roda CI** (`ci.yml:3-5`; 06 §2); rebase a cada ajuste da revisão do Lote 01; mistura escopos; migration gerada sobre uma base que ainda vai mudar (0054–0059) |
| G-3   | Documentação do Lote 02 na branch do Lote 01                                                                                                            | autorizado (MED-DEC-22: commit/push de documentação na branch do Lote 01)                                 | só serve para documentação                                                                                                                                                       |
| G-4   | G-1 dividido em PRs pequenas: (02-a) validação de datas, se não entrar no Lote 01; (02-b) K-1; (02-c) K-5/K-6; (02-d) K-7; (02-e) K-4 após a MED-DEC-15 | uma migration por PR (06 §3.1); revisão menor; recuperação simples                                        | mais PRs e mais ciclos de CD em homologação                                                                                                                                      |

**Recomendação (PROPOSTA, decisão do Carlos e do Douglas):** documentação via **G-3**; código via **G-1 + G-4**, sem
empilhar. Nome sugerido (06 §2): `feature/NOB-112-<slug>` por PR, por exemplo `feature/NOB-112-exame-empresa`. Ordem sugerida
das migrations: **K-1 primeiro**, porque K-6 (FK composta) e K-7 (`company_id` na trilha) dependem dela.

---

## h) Primeiro passo exato quando liberado

**Já liberado, sem migration:**

1. O Carlos revisa os §a–§c deste documento (fecha T02-A1 se aprovar) e responde a T02-A2 (validação de datas, §c.1).
2. O coordenador leva as perguntas do §d.3 e as MED-DEC-23/24 às pessoas indicadas.

**Para a primeira migration (K-1)**, quando a MED-DEC-08 e a MED-DEC-26 estiverem respondidas, o Lote 01 mergeado e a ordem da
#112 e da pilha 0057–0059 definida:

1. Parar o dev server (06 §4). `git fetch origin`. Conferir `ls src/shared/db/migrations | tail -1` e `gh pr list`;
   registrar no PLAN a última migration e o maior `when`.
2. `git switch -c feature/NOB-112-exame-empresa origin/develop`.
3. Ter a resposta da pergunta 3 do §d.3 (ON DELETE da FK) antes de editar o schema.
4. Em `src/shared/db/schema/health-exams.ts`: adicionar `companyId: uuid("company_id")` **nullable**, `foreignKey` composta
   `(companyId, orgId) → companies(id, orgId)` com o ON DELETE decidido e o índice `(org_id, company_id)`, **sem** alterar a
   policy `health_exams_module_access`.
5. `npm run db:generate` (nunca escolher o número nem editar o journal). Acrescentar ao `.sql` gerado o backfill idempotente
   do §e.1.
6. Na aplicação, gravar a `company_id` no `createHealthExam` a partir do funcionário lido em `assertRefsInTenant` e aplicar a
   regra escolhida para a troca de funcionário no `updateHealthExam` (§c.3).
7. Testes de integração no Postgres efêmero (Q02, Q03, Q04, Q10, Q12) com todas as migrations desde o zero e nenhuma suíte
   "skipped". Depois, a PR para `develop` com o aviso do 06 ("o merge aplica na homologação") e a revisão de TL **antes** do merge.
