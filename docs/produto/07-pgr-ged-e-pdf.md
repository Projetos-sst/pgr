# PGR × GED × PDF — como funciona

Guia da etapa **"Documentos e PDF"** do editor de PGR (`/pgr/{id}`). A confusão dessa tela vem de
um ponto só: **os dois botões de PDF não fazem a mesma coisa**, e um deles depende de um processo
que roda fora da aplicação. Tudo o mais decorre disso.

---

## 1. O resumo em uma frase

| Botão               | O que faz                                           | Guarda cópia? | Depende do worker?       |
| ------------------- | --------------------------------------------------- | ------------- | ------------------------ |
| **Baixar agora**    | Gera o PDF na hora e devolve o arquivo              | ❌ Não        | ❌ Não (só do Gotenberg) |
| **Arquivar no GED** | Enfileira a geração; o PDF vira documento do acervo | ✅ Sim        | ✅ **Sim**               |

Se você só quer o arquivo para mandar por e-mail, use **Baixar agora**. Se quer que o PGR fique
guardado e versionado no acervo da empresa, use **Arquivar no GED** — e garanta que o worker está
no ar, senão o documento nasce e nunca fica pronto (ver §5).

---

## 2. Baixar agora (síncrono)

```
Você clica → GET /api/v1/pgr/{id}/pdf?color=#5b63f5
          → lê a visão consolidada do PGR (GES → riscos → avaliação → medidas 5W2H → EPIs)
          → monta o HTML do template
          → Gotenberg converte HTML → PDF
          → o navegador baixa o arquivo
```

- O seletor de **cor da capa** só muda o parâmetro `?color=` — nada é salvo.
- O nome do arquivo sai legível: `pgr-<empresa>-<unidade>-<data>.pdf`.
- Nada é gravado no banco nem no Storage. Baixar 10 vezes não cria 10 registros.
- Se o Gotenberg estiver fora, a rota devolve **503**.

---

## 3. Arquivar no GED (assíncrono)

Aqui está a parte que costuma confundir: **o clique não gera o PDF**. Ele só cria o registro e a
tarefa. Quem gera é o worker, depois.

### O que acontece no clique (imediato, atômico)

Numa única transação `withOrg`:

1. Cria a linha em `documents` com `status = 'generating'`, `doc_type = 'PGR'`,
   `related_entity_type = 'pgr'`, `related_entity_id = <id do PGR>`, `size_bytes = 0` e o
   `storage_path` **já calculado** — o `documentId` é gerado na aplicação justamente para o path
   ser conhecido antes de o arquivo existir. É isso que torna o reprocessamento idempotente.
2. Cria a linha em `jobs` com `job_type = 'pdf_batch'`, `status = 'pending'` e o payload
   `{ documentId, pgrId }`.

A tela responde na hora com _"Geração enfileirada"_. **Nesse momento o PDF ainda não existe.**

### O que o worker faz (depois, em outro processo)

```
loop:
  recupera claims travados há mais de 300s
  reivindica 1 job  (SELECT … FOR UPDATE SKIP LOCKED)
  gera o PDF (mesma consolidada + mesmo template do "Baixar agora")
  faz upload com upsert
  UPDATE documents SET status='ready', size_bytes=…, name='PGR — <empresa>'
  marca o job como done
```

- Falhou? Volta para `pending` e tenta de novo, até **3 tentativas**; depois vira `failed`.
- O claim usa `SKIP LOCKED`, então subir mais de um worker não duplica trabalho.
- A escrita do resultado usa sempre `withOrg(job.org_id)` — o worker roda com conexão owner para
  reivindicar jobs, mas **nunca** escreve fora do tenant do job.

---

## 4. Documentos vinculados

A aba lista os documentos do acervo cujo vínculo aponta para este PGR
(`related_entity_type = 'pgr'` + `related_entity_id = <id>`). O vínculo é **polimórfico e sem FK**:
o banco garante apenas que o par é completo-ou-vazio (CHECK), não que a entidade exista.

Dois caminhos alimentam essa lista:

- **Arquivar no GED** — o PDF gerado nasce já vinculado.
- **Anexar documento** — upload manual (ART, laudo, evidência). Vindo do PGR, o formulário já vem
  com o vínculo preenchido, mostra _"Vinculado a PGR — {empresa}"_ em vez de pedir um UUID cru, e
  volta para o PGR ao salvar.

> **A visão por vínculo atravessa pastas.** Um anexo arquivado dentro de uma pasta aparece aqui do
> mesmo jeito — "todos os anexos deste PGR" não depende de onde cada um foi guardado. Navegar
> pastas e filtrar por vínculo são leituras diferentes do mesmo acervo.

Mesmo filtro pela API:

```bash
GET /api/v1/documents?relatedEntityType=pgr&relatedEntityId=<uuid>
```

Par incompleto ou `relatedEntityId` que não seja UUID → a listagem ignora o filtro e responde
**200 sem filtrar** (nunca 500).

---

## 5. Subir o worker

Sem ele, **"Arquivar no GED" não termina**: o documento fica preso em `generating` para sempre.

```bash
docker compose up -d --build worker    # sobe worker + gotenberg juntos
docker compose logs -f worker          # {"level":"info","worker":"pdf_batch","msg":"started"}
```

Os dois serviços vivem no mesmo `docker-compose.yml` — uma máquina só no deploy. O worker lê os
segredos do `.env.local` e fala com o Gotenberg pela rede interna do compose
(`http://gotenberg:3000`, **não** a porta 3001 do host).

No `.env.local` da aplicação:

```bash
GOTENBERG_URL=http://localhost:3001
```

A variável ausente **desabilita** a geração (`isPdfGenerationEnabled()` fica `false`) sem quebrar o
resto do sistema.

---

## 6. Quando o PGR trava

Assinado ou publicado, o PGR vira documento fechado: `update`, vincular/desvincular GES e criar
revisão passam a devolver **409 `ALREADY_SIGNED`**. Publicar sem assinatura → **422**.

A trava é imposta **no servidor** (`assertPgrEditable`), nas Server Actions **e** nos handlers REST
— o `readOnly` da tela é só conveniência visual.

**Gerar PDF e anexar documento continuam liberados** com o PGR travado, de propósito: evidências
como a ART assinada costumam chegar depois da publicação.

---

## 7. Diagnóstico rápido

| Sintoma                                        | Causa provável                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Documento parado como "Documento PGR", 0 bytes | Worker fora do ar, ou job `failed` após 3 tentativas                 |
| Download do documento arquivado dá erro        | O objeto ainda não existe no Storage (`status` ainda é `generating`) |
| "Baixar agora" devolve 503                     | `GOTENBERG_URL` ausente ou container fora do ar                      |
| Anexo não aparece na aba do PGR                | Vínculo não foi gravado — confira `related_entity_id` no registro    |
| Botão de publicar não aparece                  | O PGR ainda não foi assinado                                         |

Consultas úteis:

```sql
-- jobs travados ou com falha
select id, status, attempts, last_error from jobs
where job_type='pdf_batch' and status <> 'done' order by created_at desc;

-- documentos que nunca ficaram prontos
select id, name, status, created_at from documents
where status='generating' order by created_at desc;
```

---

## 8. Limitações conhecidas

Comportamento atual documentado de propósito — **não** são bugs a corrigir sem decisão de produto:

1. **Cada arquivamento cria um documento lógico novo.** `enqueuePgrPdf` gera um
   `document_group_id` novo com `version: 1` a cada clique. Arquivar o mesmo PGR três vezes produz
   três documentos "v1" soltos, em vez de v1/v2/v3 do mesmo grupo — o resto do GED versiona por
   grupo (`addDocumentVersion` faz `MAX+1`), essa é a única escrita que não usa esse modelo.
2. **`status` é escrito e nunca lido.** Não está no DTO da listagem, não filtra nada e não aparece
   na UI. Documento preso em `generating` fica indistinguível de um documento pronto.
3. **`valid_until` do PDF arquivado nasce nulo**, mesmo com o PGR tendo validade — então ele não
   entra nos KPIs de "a vencer"/"vencido" do GED.
4. **O PDF gerado sempre cai na raiz** (`folder_id: null`); não há como direcioná-lo a uma pasta.
5. **`DELETE /pgr/{id}` não é bloqueado** em PGR assinado/publicado, embora a edição seja.

---

## Referências no código

| Peça                 | Arquivo                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| Aba da tela          | `src/app/(protected)/pgr/[id]/_components/pgr-documents-tab.tsx`           |
| Enfileiramento       | `src/shared/db/repositories/pdf-batch.ts`                                  |
| Processamento        | `src/shared/server/platform/pdf-batch-core.ts`                             |
| Worker               | `worker/index.ts`                                                          |
| Rota do PDF síncrono | `src/app/api/v1/pgr/[id]/pdf/route.ts`                                     |
| Template do PDF      | `src/shared/domains/pgr/pgr-pdf-template.ts`                               |
| Trava de edição      | `src/shared/domains/pgr/pgr-lock.ts` · `src/shared/server/pgr/pgr-lock.ts` |
| Filtro por vínculo   | `src/shared/domains/documents/documents.ts` (`parseRelatedEntityFilter`)   |
