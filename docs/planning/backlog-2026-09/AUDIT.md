# Auditoria do Backlog — 2026-09-16

Base: `develop` @ `b3b738e`. Todas as afirmações sobre código foram verificadas nesse commit; os
trechos "Onde mexer no código" das issues foram escritos em 2026-08-29 e divergências estão
registradas nas fichas de `tasks/`.

> **Auditoria específica do Lote 1 (2026-09-16, `develop` @ `690ec1b`) prevalece** sobre a
> classificação inicial para #33, #42 e #56. Mudanças: #42 dificuldade 2→3; #56 READY → READY COM
> PREMISSAS; #33 funcionalmente resolvida. **Decisões de produto tomadas em 2026-09-16:** #42 → READY COM
> PREMISSAS (plano do PGR em `control_measures`, garantia suave, sem bloqueio, sem migration); #33 → RESOLVIDA,
> validar e fechar sem migrar; #56 → vigente = maior versão até #54. Detalhes nas fichas.

## 1. Snapshot do Backlog (via `gh project item-list`)

- Project `PVT_kwDOErG_2s4BhzSZ` — 61 itens: **19 Backlog**, 42 Done, 0 Ready/In progress/In review.
- As 19 são issues de `Projetos-sst/pgr`, label `enhancement`, abertas por `Dougladmo` em
  2026-08-29. Nenhuma tinha assignee, prioridade, size, estimate ou milestone.
- Após a auditoria: **19/19 atribuídas a `CarlosVictor7`** (campo Assignees do Project reflete isso).
  Status **mantido em Backlog**.
- Nenhuma PR aberta no repo no momento da auditoria. Última migration: `0048_form_control_type_status`.

## 2. Matriz master

| #   | Task                              | Módulo              | Dif. | Prontidão              | Cobertura | Migration | Integração externa               | Dependências               | Lote |
| --- | --------------------------------- | ------------------- | ---- | ---------------------- | --------- | --------- | -------------------------------- | -------------------------- | ---- |
| 3   | CNAE — busca por código/descrição | Empresas (catálogo) | 3    | READY COM PREMISSAS    | 25%       | PROVÁVEL  | IBGE `servicodados` (verificada) | combobox com #10           | 4    |
| 10  | CBO — busca por código/descrição  | Funções (catálogo)  | 3    | NEEDS EXTERNAL INFO    | 0%        | PROVÁVEL  | Arquivo CBO do MTE (sem API)     | combobox com #3            | 4    |
| 33  | Assinatura/QR na entrega de EPI   | EPI                 | 1    | RESOLVIDA — FECHAR     | 75%       | NÃO       | —                                | —                          | 1C   |
| 39  | NR-09 — avaliação quantitativa    | PGR / Inventário    | 3    | READY COM PREMISSAS    | 25%       | SIM       | —                                | desbloqueia #47            | 2    |
| 40  | NR-17 — avaliação ergonômica      | PGR / Inventário    | 4    | NEEDS CONTEXT          | 25%       | SIM       | COPSOQ (instrumento)             | desbloqueia #47            | 3    |
| 42  | Plano de ação por nível de risco  | PGR / Plano de ação | 3    | READY COM PREMISSAS    | 50%       | NÃO       | —                                | PDF do plano vai para #47  | 1B   |
| 47  | Estrutura do PDF do PGR           | PGR / PDF           | 3    | BLOCKED (#39, #40)     | 50%       | NÃO       | Gotenberg (já existe)            | #39, #40                   | 2→3  |
| 48  | NR-18 — documentos do canteiro    | PGR / Documentos    | 3    | READY COM PREMISSAS    | 25%       | INCERTO   | —                                | usa #47 para o anexo EPI   | 3    |
| 52  | GED — elaboração                  | GED                 | 3    | NEEDS PRODUCT DECISION | 25%       | SIM       | —                                | #58                        | 5    |
| 53  | GED — revisão                     | GED                 | 3    | BLOCKED (#52, #58)     | 0%        | SIM       | —                                | #52, #58                   | 6    |
| 54  | GED — aprovação                   | GED                 | 4    | BLOCKED (#53, #58)     | 25%       | SIM       | —                                | #53, #58                   | 6    |
| 55  | GED — publicação e guarda         | GED                 | 4    | BLOCKED (#54, #58)     | 25%       | SIM       | —                                | #54, #58, #59              | 6    |
| 56  | GED — controle de versões         | GED                 | 2    | READY COM PREMISSAS    | 50%       | NÃO       | —                                | vigência redefinida em #54 | 1A   |
| 57  | GED — descarte com flag           | GED                 | 3    | NEEDS PRODUCT DECISION | 0%        | SIM       | —                                | #58, #59                   | 7    |
| 58  | GED — perfis e permissões         | GED / Auth          | 5    | NEEDS PRODUCT DECISION | 0%        | SIM       | Clerk (papéis)                   | base de todo o GED         | 5    |
| 59  | GED — auditoria e relatórios      | GED                 | 3    | READY COM PREMISSAS    | 25%       | SIM       | —                                | alimenta #55, #57          | 5    |
| 60  | GED — Active Directory + backup   | Plataforma / Infra  | 5    | NEEDS PRODUCT DECISION | 0%        | INCERTO   | AD/SSO, backup Supabase          | #61 (e-mails de backup)    | 8    |
| 61  | Notificações por e-mail           | Plataforma          | 4    | NEEDS PRODUCT DECISION | 0%        | PROVÁVEL  | Provedor de e-mail (pago)        | #58, #60                   | 8    |
| 62  | Regras de negócio do GED          | GED (transversal)   | 4    | BLOCKED (#52–#57)      | 25%       | SIM       | —                                | #52–#57                    | 7    |

## 3. Distribuição

| Dificuldade | Qtd | Issues                                          |
| ----------- | --- | ----------------------------------------------- |
| 1           | 1   | #33                                             |
| 2           | 1   | #56                                             |
| 3           | 10  | #3, #10, #39, #42, #47, #48, #52, #53, #57, #59 |
| 4           | 5   | #40, #54, #55, #61, #62                         |
| 5           | 2   | #58, #60                                        |

| Prontidão              | Qtd | Issues                      |
| ---------------------- | --- | --------------------------- |
| READY                  | 0   | —                           |
| READY COM PREMISSAS    | 6   | #3, #39, #42, #48, #56, #59 |
| NEEDS CONTEXT          | 1   | #40                         |
| NEEDS PRODUCT DECISION | 5   | #52, #57, #58, #60, #61     |
| RESOLVIDA — FECHAR     | 1   | #33                         |
| NEEDS EXTERNAL INFO    | 1   | #10                         |
| BLOCKED                | 5   | #47, #53, #54, #55, #62     |

`#33` é **FUNCIONALMENTE RESOLVIDA**: decisão de não migrar tomada em 2026-09-16; validar, comentar e fechar. `#54` tem ainda uma decisão de
produto (assinatura por QR/link vs. aceite autenticado) atrás do bloqueio.

## 4. Módulos reais

| Módulo                       | Issues                  | Observação                                                          |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Catálogos de cadastro        | #3, #10                 | Mesmo problema técnico: autocomplete de tabela oficial              |
| EPI                          | #33                     | Isolada                                                             |
| PGR — inventário, plano, PDF | #39, #40, #42, #47, #48 | Compartilham `risks`/`risk_assessments`, consolidado e template PDF |
| Qualidade/GED                | #52–#59, #62            | Épico com state machine própria; `documents` é a tabela central     |
| Plataforma                   | #60, #61                | Decisões de infraestrutura, não de GED em si                        |

## 5. Score de priorização (1–5, apoio à ordem — não é fórmula)

| #   | Valor | Esforço | Risco | Clareza | Reuso de contexto |
| --- | ----- | ------- | ----- | ------- | ----------------- |
| 3   | 3     | 3       | 2     | 4       | 3                 |
| 10  | 3     | 3       | 3     | 2       | 4 (após #3)       |
| 33  | 2     | 1       | 1     | 4       | 5                 |
| 39  | 5     | 3       | 3     | 4       | 4                 |
| 40  | 4     | 4       | 3     | 2       | 3                 |
| 42  | 4     | 3       | 2     | 2       | 4                 |
| 47  | 5     | 3       | 3     | 3       | 4                 |
| 48  | 3     | 3       | 2     | 3       | 4                 |
| 52  | 4     | 3       | 3     | 2       | 3                 |
| 53  | 3     | 3       | 2     | 3       | 3                 |
| 54  | 4     | 4       | 3     | 2       | 3                 |
| 55  | 4     | 4       | 4     | 2       | 3                 |
| 56  | 3     | 2       | 1     | 4       | 5                 |
| 57  | 3     | 3       | 3     | 2       | 3                 |
| 58  | 5     | 5       | 5     | 1       | 2                 |
| 59  | 4     | 3       | 2     | 3       | 3                 |
| 60  | 1     | 5       | 4     | 1       | 1                 |
| 61  | 2     | 4       | 3     | 1       | 2                 |
| 62  | 4     | 3       | 3     | 3       | 3                 |

## 6. Impacto em banco (nenhum número de migration reservado)

| #              | Migration | O quê (provável)                                                                                                                                                        |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3              | PROVÁVEL  | Tabela **global** `cnae_subclasses` (sem `org_id`, policy de leitura global, padrão `caepi_certificates`) — ou nenhuma, se a decisão for arquivo estático versionado    |
| 10             | PROVÁVEL  | Tabela global `cbo_occupations` (mesmo padrão)                                                                                                                          |
| 39             | SIM       | Colunas de avaliação quantitativa por avaliação (método, valor medido, unidade, LT numérico, conclusão) em `risk_assessments` **ou** tabela filha 1:N — decidir no PLAN |
| 40             | SIM       | Tabela `ergonomic_assessments` (AEP) vinculada a risco/GES + RLS; formato COPSOQ a decidir                                                                              |
| 48             | INCERTO   | Nenhuma se as categorias NR-18 forem tipos sugeridos de `doc_type`; enum/coluna se virar categoria fechada                                                              |
| 52             | SIM       | `documents`: `created_by`, `code`, `category`, `responsible_user_id`, vínculo de setor, status de workflow                                                              |
| 53             | SIM       | Tabela `document_reviews` (versão, revisor, comentário, status, data) + RLS                                                                                             |
| 54             | SIM       | Tabela/colunas de aprovação (aprovador, data, evidência) ou `target_type` novo na infra de assinatura                                                                   |
| 55             | SIM       | `documents.published_at` (+ `published_by`); leitura por setor; log de acesso via #59                                                                                   |
| 57             | SIM       | `discard_requested_at/by`, `discard_approved_at/by`, `discarded_at` (soft delete)                                                                                       |
| 58             | SIM       | Tabela de papéis GED usuário↔setor↔papel + possivelmente cadastro de setor                                                                                              |
| 59             | SIM       | Tabela `document_audit_log` append-only (padrão `epi_catalog_audit_log`, migration 0032)                                                                                |
| 61             | PROVÁVEL  | Outbox de e-mails / preferências, dependendo do provedor                                                                                                                |
| 62             | SIM       | CHECKs/triggers de invariantes sobre o que #52–#57 criarem                                                                                                              |
| 33, 42, 47, 56 | NÃO       | —                                                                                                                                                                       |
| 60             | INCERTO   | Depende da decisão (provavelmente nenhuma)                                                                                                                              |

## 7. Integrações externas

| Integração       | Issue    | Situação verificada em 2026-09-16                                                                                                                                                       | Credencial | Custo            | Implementável agora                          |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- | -------------------------------------------- |
| CNAE — IBGE      | #3       | `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses` responde 200 com **1.332 subclasses** (id + descrição + hierarquia). Só lista tudo ou busca por id — **não** busca por texto. | Não        | Não              | Sim, com premissa de espelho local           |
| CNAE — BrasilAPI | #3       | `/api/cnae/v1/{id}` responde **404**. O comentário da issue que cita esse endpoint está incorreto. O projeto já usa `/api/cnpj/v1`, que devolve o CNAE da empresa.                      | Não        | Não              | Já usado (via CNPJ)                          |
| CBO — MTE        | #10      | Sem API. `servicodados.ibge.gov.br/api/v2/cbo/...` não responde; `mtecbo.gov.br` oferece **downloads** de arquivo.                                                                      | Não        | Não              | Depende de obter e validar o arquivo oficial |
| Gotenberg        | #47      | Já integrado (`src/shared/integrations/pdf/gotenberg.ts`), worker `pdf_batch` em produção.                                                                                              | —          | —                | Sim                                          |
| Clerk            | #58, #60 | Auth 100% Clerk; papéis de tenant `owner/collaborator/client`. SSO/SAML corporativo seria recurso do Clerk, não AD direto.                                                              | Sim        | Possível (plano) | Após decisão                                 |
| Backup           | #60      | Nada no código; Supabase gerenciado.                                                                                                                                                    | —          | Possível         | Após decisão                                 |
| E-mail           | #61      | Nenhum provedor em `package.json`; `notifications.ts:19` registra decisão KISS "sem tabela nem e-mail". Princípio II da constituição exige emenda para serviço externo pago.            | Sim        | Sim              | Após decisão + emenda                        |
| COPSOQ           | #40      | Instrumento psicossocial; hoje só aparece como texto de exemplo. Licença/versão brasileira a confirmar.                                                                                 | —          | Incerto          | Após contexto                                |

## 8. Riscos técnicos

1. **Migrations paralelas.** Lotes 2, 3, 4, 5+ criam migrations. Colisão de número já ocorreu 3× neste
   repo. Regra: nunca reservar número; gerar só depois de atualizar `origin/develop` e checar PRs abertas.
2. **PDF do PGR é contrato com o cliente.** #47 muda ordem e conteúdo das seções; o template tem
   10 testes unitários e é usado por dois chamadores (rota síncrona e worker). Mudança precisa
   manter os dois e não quebrar o cabeçalho ISO de `form_controls`.
3. **GED é state machine nova sobre tabela em uso.** `documents` já tem CRUD, anexos do PGR/GES/risco
   e PDFs arquivados pelo worker. Introduzir `status` de workflow sem migrar os registros existentes
   esconderia documentos atuais. Exige spec própria antes de código.
4. **Autorização por papel dentro do tenant (#58)** é inédita no projeto: hoje RLS isola só por
   `org_id` e o gate é `requireOfficeStaff`. Errar aqui vaza documentos entre setores.
5. **#33 envolve dado legal em produção** se a decisão for migrar para a infra genérica (tokens já
   distribuídos a funcionários). Migrar também submeteria entregas de EPI à cota de 10 assinaturas/mês do
   plano free, e as assinaturas históricas não cabem em `signature_captures` (imagem NOT NULL nunca foi
   guardada). Por isso a recomendação é fechar como resolvida.
6. **#42 — geração automática de plano** esbarra em `action_plans.what/why/who/where/how NOT NULL`:
   gerar entrada "em branco" exigiria texto fictício. A ponte existente #51 **já grava texto padrão**
   (`who = "Responsável não definido"`, `why` gerado) — dívida pré-existente a decidir antes de #47.
7. **#56 — versões antigas não são somente leitura no backend:** `PUT /documents/{idAntigo}` edita o
   histórico e `POST /documents/{idAntigo}/versions` herda metadados antigos.
8. **Serviços pagos (#61, possivelmente #60)** exigem emenda formal da constituição (Princípio II).
