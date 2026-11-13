# NOB-182 — Guarda, exportação e descarte de documentos

A política de guarda ainda **não foi aprovada**. Esta entrega registra a política e a aprovação, exporta o
acervo de um PGR com manifesto e hash e calcula prazos como simulação. **Nenhum código desta entrega apaga
dado ou arquivo.** Não há job, cron, worker nem botão de exclusão.

Fontes: SEG-12 e MED-18 (`questionario-v3/01-MATRIZ-MESTRE.md`), conflito C-04
(`03-CONFLITOS-E-RECOMENDACOES.md`) e DT-07 (`04-REGISTRO-DE-DECISOES.md`), que recomenda a alternativa (b):
nenhuma exclusão automática até cláusula jurídica e exportação completa.

## 1. O que já existia na develop

| Tema                    | Onde                                                             | Situação                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Acervo (GED)            | `documents`, `folders`, bucket privado `documents`               | Uma linha por versão (`document_group_id` + `version`). Vínculo ao PGR por `related_entity_type='pgr'`. Sem hash do arquivo na tabela  |
| Amostras e pareceres    | `pgr_review_samples`, `pgr_review_decisions`                     | Só inserção. A amostra guarda `file_sha256`, `snapshot_sha256` e `template_sha256`                                                     |
| Revisão e emissão final | `pgr_document_approvals`                                         | Só inserção. O evento `issued` guarda `file_sha256` e o documento do GED                                                               |
| Textos do documento     | `pgr_docx_text_versions`                                         | Só inserção, com hash dos textos                                                                                                       |
| Revisões do PGR         | `pgr_revisions`                                                  | Histórico numerado por PGR                                                                                                             |
| Assinatura              | `signature_requests`, `signature_captures` (`target_type='pgr'`) | Captura com nome, meio, data e imagem em base64 no banco                                                                               |
| Auditoria               | `logTenantEvent` (log da aplicação)                              | Não é tabela. Não serve de prova de exportação                                                                                         |
| Fila                    | `jobs` + `worker/` (`pdf_batch`)                                 | Só gera PDF. Não usada aqui                                                                                                            |
| Exclusão manual         | `deleteDocument` (GED), `deletePgr`                              | Já existiam. O GED recusa apagar amostra e emissão final (`IN_USE`). As FKs `RESTRICT` impedem apagar PGR com amostra, evento ou texto |
| Encerramento            | `companies.status` (`active`, `pending`, `inactive`)             | Não há data de encerramento de contrato, de empresa nem de PGR. `pgr.valid_until` é validade do documento, não encerramento            |
| Exclusão automática     | —                                                                | Não existe                                                                                                                             |
| Alerta de PGR a vencer  | PR #137 (citada em `nob-174-reaproveitamento-pr-137.md`)         | Não está na develop. É alerta de validade do PGR (SEG-11), não de guarda. Ver pendência 7                                              |

## 2. Registros abrangidos, por categoria

A lista vive em código (`RETENTION_CATEGORY_CATALOG`, `src/shared/domains/retention/policy.ts`) e aparece na
tela `/retention`.

| Categoria (`category`) | Registros                                                                                                                       | Entra na exportação por PGR |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `pgr_documents`        | Arquivos do PGR no GED com todas as versões (emissão final, amostra, PDF arquivado), cabeçalho do PGR e `pgr_revisions`         | Sim                         |
| `pgr_review_records`   | `pgr_review_samples`, `pgr_review_decisions`, `pgr_document_approvals`, `pgr_docx_text_versions`                                | Sim                         |
| `signature_evidence`   | `signature_requests` e `signature_captures` do PGR; assinaturas de ordens de serviço                                            | Sim, as do PGR              |
| `sst_records`          | Inventário de riscos, avaliações, medidas de controle, planos de ação, OS, inspeções, permissões, EPI, treinamentos, auditorias | Não (pendência 3)           |
| `health_records`       | Exames, ASO, PCMSO, prontuário, afastamentos, acidentes (dado de saúde P0)                                                      | Não (pendência 4)           |

## 3. Política proposta (provisória)

Os valores abaixo são a proposta da SEG-12 e a resposta da MED-18. Ficam em `PROPOSED_RETENTION_TERMS` e
servem só para preencher o formulário e a simulação enquanto não há versão registrada. Nenhum deles é
constante que dispare ação.

| Categoria            | Prazo proposto | Marco inicial proposto                             | Fonte  |
| -------------------- | -------------- | -------------------------------------------------- | ------ |
| `pgr_documents`      | 12 meses       | Término do contrato do escritório com a plataforma | SEG-12 |
| `pgr_review_records` | 12 meses       | Término do contrato                                | SEG-12 |
| `signature_evidence` | 12 meses       | Término do contrato                                | SEG-12 |
| `sst_records`        | 12 meses       | Término do contrato                                | SEG-12 |
| `health_records`     | 240 meses      | Desligamento do trabalhador                        | MED-18 |

Avisos: 90, 60 e 30 dias antes do fim do prazo.

**Conflito aberto (C-04):** a NR-01 1.5.7.3.3.1 exige o histórico do inventário por no mínimo 20 anos e a
NR-07 7.6.1.1 exige 20 anos para o prontuário. Os 12 meses da SEG-12 são prazo contratual da plataforma, não
a obrigação legal da organização. Por isso a proposta não pode virar exclusão sem a cláusula jurídica.

## 4. O que a pergunta 2 do formulário final precisa confirmar

O formulário final não está no repositório. Os campos abaixo são os que o sistema registra em cada versão da
política; a resposta entra por `/retention`, sem mudança de código.

| Campo a confirmar          | Onde fica no registro                                          | Padrão conservador aplicado até a resposta        |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Responsável pela guarda    | `postClosureAccess` (texto) e `approval.approverName`          | Sem aprovador registrado: política não aprovada   |
| Período por categoria      | `terms.categories[].retentionMonths`                           | Proposta da tabela acima, marcada como provisória |
| Marco inicial              | `terms.categories[].startingPoint`                             | Proposta; data do marco é informada na simulação  |
| Avisos                     | `terms.noticeDaysBefore`                                       | 90, 60, 30                                        |
| Acesso após o encerramento | `terms.postClosureAccess` (texto)                              | Escritório mantém consulta e exportação           |
| Quem autoriza o descarte   | `terms.discardAuthorization` (texto)                           | Descarte bloqueado                                |
| Quem aprovou a política    | `approval`: nome, cargo, data e onde está registrada a decisão | Não aprovada                                      |

**Quem aprova:** pela DT-07, o jurídico e o Carlos. No sistema, só o administrador do escritório (`owner`)
registra a versão, informando quem aprovou, o cargo, a data e a referência (ata, contrato, e-mail).

## 5. Registro da política e da aprovação

- Tabela `retention_policy_versions` (migration `0089_retention_policy_and_exports`), uma linha por versão,
  por escritório. Só inserção: `app_runtime` não tem `UPDATE` nem `DELETE`.
- `status`: `proposed` ou `approved`. Versão aprovada exige nome, cargo, data (não futura) e referência
  (zod no servidor e `CHECK` no banco).
- `terms_sha256`: hash dos termos, para citar a versão exata em contrato ou ata.
- Estado da política = versão mais recente. Sem versão, ou com a mais recente só proposta, o estado é
  **não aprovada**. Registrar uma proposta depois de uma aprovação volta o estado para não aprovada.
- RLS: isolamento por escritório; policy restritiva de `INSERT` exige `recorded_by` = usuário da sessão e
  papel `owner`/`org:admin` em `org_memberships`. O servidor também recusa (`FORBIDDEN`).

## 6. Exportação

**Recorte escolhido: por PGR.** É o menor recorte que cumpre o aceite (documentos, versões, pareceres e
evidências de assinatura) e o único em que o banco já garante o escopo da NOB-175: a policy `pgr_actor_scope`
decide se o membro enxerga o PGR, e todas as tabelas exportadas dependem dele. Exportação por empresa fica
para depois (pendência 3).

`POST /api/v1/pgr/{id}/retention-exports` devolve um `.zip`:

```
manifest.json
records/pgr.json
records/pgr_revisions.json
records/documents.json
records/pgr_review_samples.json
records/pgr_review_decisions.json
records/pgr_document_approvals.json
records/pgr_docx_text_versions.json
records/signature_requests.json      (sem token_hash)
records/signature_captures.json
files/{document_group_id}/v{versão}-{document_id}.{ext}
```

O manifesto traz: `formatVersion`, `scope` (escritório, PGR, empresa), `exportedBy`, `exportedAt`, estado da
política, `status`, contagens, `contentSha256` e, por item, `path`, `category`, `source` (tabela e id),
`status`, `sha256`, `expectedSha256` e `sizeBytes`.

### Como verificar a integridade

1. Abra o zip e, para cada item do manifesto com `status: "ok"`, calcule o SHA-256 do arquivo em `path`
   (`shasum -a 256 files/...`). Tem de ser igual ao `sha256` do item.
2. Recalcule o hash do conjunto: para cada item, em ordem de `path`, uma linha
   `path<TAB>status<TAB>sha256` (use `-` quando não há hash) terminada em `\n`; o SHA-256 desse texto é o
   `contentSha256`.
3. Compare o `contentSha256` com o registrado em `retention_exports` (`GET` da mesma rota) e com o header
   `X-Retention-Export-Sha256`.
4. `expectedSha256` é o hash gravado quando a amostra ou a emissão final foi gerada. Se o arquivo baixado
   tiver outro hash, o item sai como `hash_mismatch`.

### Repetição

`contentSha256` não inclui quem exportou nem a hora. Repetir a exportação sem mudança no acervo gera o mesmo
hash. Os registros são serializados em JSON com chaves ordenadas e linhas em ordem de `id`, sem depender da
ordenação do banco. Os bytes do zip mudam a cada execução (o manifesto leva data e autor); o hash a comparar
é o `contentSha256`.

Cada execução grava uma linha em `retention_exports` (só inserção): PGR, situação, hash, contagens, autor e
data.

### Falha

| Situação                                            | Resultado                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Arquivo não existe mais no Storage                  | O pacote sai. O item aparece no manifesto como `missing`. Situação `incomplete`, registrada         |
| Arquivo com hash diferente do registrado na emissão | O pacote sai com o arquivo. Item `hash_mismatch`. Situação `incomplete`, registrada                 |
| Storage indisponível ou erro que não é "não existe" | Nenhum pacote. `503 EXPORT_UNAVAILABLE`. Tentativa registrada como `failed` (`storage_unavailable`) |

Motivo da escolha: arquivo que sumiu não volta, e bloquear a exportação inteira deixaria o escritório sem o
resto do acervo justamente no encerramento. Erro passageiro é diferente: gerar pacote ali esconderia
arquivo que existe, então a exportação falha e pode ser repetida.

Documento do GED ainda em geração (`status='generating'`) aparece em `records/documents.json`, mas não vira
item de arquivo.

### Acesso

- Só equipe do escritório (`owner`, `collaborator`). Representante da empresa (`client`) recebe `403`. O
  questionário não pede exportação pelo representante.
- PGR de outro escritório ou fora do escopo do membro (NOB-175): `404`, sem linha em `retention_exports`.
- Dado de saúde P0 (`accidents`, exames, prontuário) **não entra** no pacote por PGR e não aparece em log.
  O log de fronteira leva só operação, escritório e usuário.
- A exportação não depende de a política estar aprovada: exportar não é destrutivo, e a DT-07 pede
  exportação completa antes de qualquer encerramento. O manifesto informa o estado da política.

Caminho síncrono, em memória, sem fila. Não foi adicionada dependência: o zip usa o `pizzip` que o projeto já
tinha.

## 7. Encerramento, simulação e trava de descarte

Não existe conceito de encerramento no sistema (contrato, empresa ou PGR). Não foi criado fluxo comercial.
O marco inicial é dado da política, e a data do marco é informada na simulação.

- `GET /api/v1/retention-policy/simulation?contract_end=AAAA-MM-DD&company_closure=…&document_issue=…&employee_termination=…`
  devolve, por categoria: início, fim do prazo de guarda, datas dos avisos e o resultado da trava.
- Sem versão registrada usa a proposta (`termsSource: "proposal"`); com versão usa os termos registrados.
  `provisional: true` enquanto a política não estiver aprovada.
- Trava (`discardGate` e `assertDiscardAuthorized`): recusa quando a política não está aprovada, quando o
  marco inicial é desconhecido e quando o prazo ainda corre. Só o `owner` passa pela checagem de papel.
  **Nenhuma operação de exclusão chama essa trava hoje, porque nenhuma existe.** Ela é o ponto único que uma
  futura operação de descarte terá de chamar.
- Consulta após encerramento, no que o modelo permite: empresa com `status='inactive'` continua consultável e
  exportável por quem tem acesso (coberto por teste).

## 8. Travado até a aprovação

- Qualquer exclusão de registro ou de arquivo por política de guarda.
- Envio dos avisos de 90, 60 e 30 dias (hoje só se calculam as datas).
- Mudança de acesso após encerramento.
- Exportação e descarte de registros de saúde.

## 9. Roteiro de teste

Automático (Postgres 16 efêmero, Storage simulado): `src/__tests__/integration/retention/retention.test.ts`
e `src/__tests__/unit/domains/retention/`.

Manual, em homologação com dados de teste:

1. Como `owner`, abrir `/retention`. Conferir "Não aprovada" e os prazos marcados como provisórios.
2. Simular com término de contrato em 31/01/2027: fim do prazo em 31/01/2028 e avisos em 02/11/2027,
   02/12/2027 e 01/01/2028. Todas as categorias aparecem bloqueadas.
3. Registrar uma versão proposta. O estado continua "Não aprovada".
4. Como `collaborator`, abrir `/retention`: sem formulário. `POST /api/v1/retention-policy` responde `403`.
5. Como `owner`, registrar versão aprovada com nome, cargo, data e referência. Estado "Aprovada (versão 2)".
6. Em um PGR com amostra e emissão final, abrir Documentos > "Pacote de guarda" e exportar. Conferir os
   hashes pelo passo a passo da seção 6.
7. Exportar de novo: mesmo `contentSha256`, duas linhas no histórico.
8. Com um membro restrito a outra empresa, abrir a URL do pacote: "não encontrado".
9. Em homologação, apagar um objeto de teste direto no bucket e exportar: pacote `incomplete`, item `missing`.
10. Marcar a empresa como inativa e repetir a exportação: continua funcionando.
11. Conferir no banco que `documents`, amostras e assinaturas têm a mesma contagem de antes.

**Descarte:** não há operação para testar. Antes de qualquer operação real, o roteiro terá de rodar em dados
de teste, com a política aprovada registrada, e passar por `assertDiscardAuthorized`.

## 10. Pendências e decisões para o responsável

1. **Aprovar a política** (jurídico + Carlos, DT-07): prazos por categoria, marco inicial, acesso após
   encerramento e quem autoriza o descarte. Resolver o conflito entre 12 meses (SEG-12) e 20 anos (NR-01,
   NR-07).
2. **Modelar o encerramento** (data de fim de contrato, de atendimento à empresa, de desligamento) quando a
   frente comercial definir. Hoje a data só entra na simulação.
3. **Exportação por empresa e de registros de SST** fora do PGR (riscos, OS, EPI, treinamentos). Pacote
   maior; avaliar a fila `jobs`.
4. **Registros de saúde** (MED-18): exportação e guarda dependem das regras de acesso clínico. Fora desta
   entrega.
5. **Exclusão manual que já existe:** `deleteDocument` ainda apaga arquivo do GED ligado ao PGR que não seja
   amostra nem emissão final, e `deletePgr` apaga PGR sem histórico. A DT-07 recomenda trocar exclusão por
   cancelamento ou inativação. Decidir se essas operações passam a exigir a trava.
6. **Limite de tamanho:** a exportação monta o zip em memória. Para PGR com muitos arquivos grandes, mover
   para a fila.
7. **Alerta "PGR a vencer em 30 dias" da PR #137:** não entrou. É alerta de validade (SEG-11, NOB-105), não
   de guarda, e não está no aceite desta issue.
8. **Storage real:** a distinção entre arquivo ausente e Storage indisponível foi testada com o Storage
   simulado. Falta conferir em homologação o erro que o Supabase devolve para objeto inexistente.
9. **Auditoria de leitura:** consulta à política e ao histórico não gera registro em tabela, só a
   exportação e o registro de versão.
