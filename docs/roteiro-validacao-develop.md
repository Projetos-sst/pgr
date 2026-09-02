# Roteiro de validação em `develop`

**Para:** equipe técnica · **Branch:** `feature/mastra-agents` → `develop`
**Contexto dos agentes:** [`docs/relatorio-agentes-ia.md`](./relatorio-agentes-ia.md)

---

## Escopo

Duas frentes chegam juntas em `develop`:

- **Bloco A — IA pgr-e:** cinco agentes. Dois já existiam e **estavam quebrados em uso
  real** (regressão obrigatória); três são novos.
- **Bloco B — issues da avaliação e-PGR:** 18 issues fechadas em 02/09, mais o
  provisionamento dos buckets de Storage.

Este roteiro cobre **comportamento**. Campo novo, rótulo e texto de ajuda dá para conferir
lendo o código ou abrindo a tela — não gastamos linha com isso. O que está aqui é o que só
se descobre executando: gravação, regra de negócio, isolamento por tenant, dado legado e
interação entre módulos.

**Uma migration nesta leva: `0045_storage_buckets`.** Sem ela, metade do Bloco B falha.

---

## Antes de começar

### 1. Chave da OpenRouter (bloqueia o Bloco A)

A chave usada no desenvolvimento **expirou**. Sem uma válida, os cinco agentes respondem
`AI_UNAVAILABLE` e não há o que testar.

```bash
# .env.local (gitignored — a chave NUNCA vai para o repositório)
OPENROUTER_API_KEY=sk-or-v1-...

curl -s -o /dev/null -w "%{http_code}\n" https://openrouter.ai/api/v1/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"   # espera-se 200
```

Demais variáveis já têm default medido — só mexam se forem testar troca de modelo:
`AI_SUGGESTION_MODEL` (`minimax/minimax-m3:free`), `AI_FALLBACK_MODELS` (dois fallbacks em
ordem), `AI_MAX_RETRIES_PER_MODEL` (`2`). São lidas **a cada execução**: trocar de modelo
não pede rebuild, só reinício do processo.

### 2. Migration dos buckets (bloqueia o Bloco B)

```bash
npm run db:migrate     # aplica a 0045 no Supabase de develop
```

Os buckets `company-logos` e `employee-photos` **nunca existiram** no projeto Supabase —
a criação era passo manual no painel e nunca foi feita. Por isso as issues #4 e #16 foram
fechadas com o código correto e o upload continuava falhando com `Bucket not found`. A
0045 leva isso para o versionamento. Confirmem:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
-- documents, company-logos, employee-photos — todos privados;
-- os dois novos com 5 MB e allowlist image/png + image/jpeg
```

### 3. Dados mínimos no tenant de teste

Os agentes leem contexto real; tenant vazio devolve pouco e o teste não prova nada.

- ≥ 1 **GES** com processo/ambiente descritos e ≥ 1 função vinculada;
- ≥ 1 **risco** com avaliação vigente — **um trivial/tolerável e um moderado+** (a regra
  #42 só aparece no segundo);
- ≥ 1 **auditoria de risco** cuja origem **ainda exista** (ver Armadilhas);
- ≥ 1 **OS salva** com funcionário designado;
- ≥ 1 **empresa** e **funcionário** para os uploads.

### 4. Build

```bash
npm ci && npm run check     # format + lint + typecheck + 1200 testes unitários
npm run dev
```

`npm run test:integration` exige `INTEGRATION_DATABASE_URL` (Postgres efêmero) — **não
rodou no desenvolvimento**. Rodem se o ambiente de vocês tiver.

---

# Bloco A — IA pgr-e

| #   | Agente                    | Tela                           | Estado                         |
| --- | ------------------------- | ------------------------------ | ------------------------------ |
| 1   | Sugestão de riscos        | `/ges/{id}`                    | corrigido — validar regressão  |
| 2   | Plano de ação 5W2H        | `/risk-audits/{id}`            | corrigido — validar regressão  |
| 3   | Medidas de controle NR-01 | `/risks/{id}/control-measures` | novo                           |
| 4   | Treinamentos obrigatórios | `/job-roles/{id}/edit`         | novo                           |
| 5   | Instruções de OS          | `/service-orders/{id}/edit`    | novo — **nunca rodou ao vivo** |

Em todos: a IA **propõe**, o usuário revisa e confirma. Nenhum agente grava sozinho.
Durante a execução (~5–20s) a tela mostra barra de progresso e esqueleto — sem feedback
visual é bug.

### A1 · Sugestão de riscos — `/ges/{id}`

- [ ] Modal abre **imediatamente** já carregando (não depois da resposta)
- [ ] "Adicionar selecionados" cria os riscos como **rascunho** no GES
- [ ] **Regressão A — enum em português:** nenhum risco pode sumir. Antes, "Químico"/"Físico" reprovavam contra o enum inglês e 12 riscos corretos viravam lista vazia. Compare o total do modal com o total criado
- [ ] **Regressão B — GES só com nome:** teste num GES **sem** descrição de processo (ex.: "Técnicos de Manutenção Elétrica"). Antes devolvia zero; agora deve trazer riscos típicos da atividade — **sem** inventar modelo de máquina, medição ou número que ninguém informou
- [ ] Lista vazia **não consome cota** (confira em `ai_usage_events`)

### A2 · Plano de ação 5W2H — `/risk-audits/{id}`

- [ ] Os 8 campos voltam preenchidos e **editáveis** antes de "Criar plano"
- [ ] **Regressão C — `how` em lista:** era a falha mais comum. O modelo devolve "como" em passos numerados e isso derrubava o plano inteiro como `AI_UNAVAILABLE`. Agora vira texto com passos. **Rode 3–5 vezes** — só reproduz em parte das respostas
- [ ] "Quem" traz área ou função, **nunca** nome de pessoa
- [ ] Prazo/custo ausentes ficam vazios — não `R$ 0`, não string vazia
- [ ] IA indisponível não bloqueia: o preenchimento manual continua funcionando

### A3 · Medidas de controle — `/risks/{id}/control-measures`

- [ ] Medidas vêm na ordem da hierarquia NR-01 (eliminação → coletiva → administrativo → EPI)
- [ ] **Nível já cadastrado não é oferecido.** A UNIQUE `(org, risco, nível)` admite uma medida por nível: cadastre uma medida coletiva e peça sugestão de novo — coletiva não pode reaparecer
- [ ] **Risco moderado+ → responsável e prazo obrigatórios** (cruza com a issue #42, ver B2). O aviso âmbar deve aparecer no topo do modal e o aceite sem os campos deve ser barrado **na tela**, sem perder as sugestões
- [ ] Risco trivial/tolerável: aceite sem responsável/prazo funciona
- [ ] Aceitar grava com **status derivado da classificação** e **espelha no Plano de Ação** — é o mesmo caminho do cadastro manual
- [ ] Risco com todos os níveis preenchidos → mensagem de lista vazia, sem erro

### A4 · Treinamentos obrigatórios — `/job-roles/{id}/edit`

- [ ] Volta 3+ treinamentos para função operacional (esperado 4–7)
- [ ] Cada linha diz o destino: **já obrigatório** (desmarcado, não selecionável) · **existe no catálogo** (só vincula) · **novo** (cria e vincula)
- [ ] **Casamento por tokens:** com "NR-35 — Trabalho em Altura" no catálogo, uma sugestão "Trabalho em Altura" deve casar com o existente e **não** criar duplicata
- [ ] O inverso: dois cursos diferentes não podem ser casados como o mesmo
- [ ] Aceitar duas vezes o mesmo item não duplica o vínculo (idempotente)
- [ ] O que foi criado no catálogo tem carga horária e periodicidade **sugeridas** — revisar

### A5 · Instruções de OS — `/service-orders/{id}/edit`

> **Único que nunca rodou contra o provedor real** — a chave expirou antes. Prioridade.

- [ ] O botão **não** aparece em `/service-orders/new` e aparece na edição
- [ ] Instruções na voz imperativa, aplicáveis à função; itens já presentes não são repetidos
- [ ] Entram como itens do checklist e só persistem no **"Salvar"** — sem gravação automática
- [ ] **OS assinada:** a imutabilidade dos itens continua valendo. Não há `/accept` próprio de propósito — a escrita passa pelo `PUT` da OS, que é quem guarda essa regra

---

# Bloco B — Issues da avaliação e-PGR

## B1 · Upload de binários — #4 (logo), #16 (foto do empregado), #30 (foto do EPI)

**A parte mais frágil da leva** e a que só se valida com o Supabase real. As três issues
já tinham sido fechadas antes com o código certo; o que faltava era o bucket existir.

| Onde                            | Bucket                | Limite        |
| ------------------------------- | --------------------- | ------------- |
| `/companies/{id}/edit` — logo   | `company-logos`       | 5 MB, PNG/JPG |
| `/employees/{id}/edit` — foto   | `employee-photos`     | 5 MB, PNG/JPG |
| `/epi-catalog/{id}/edit` — foto | `documents` (reusado) | idem          |

- [ ] Upload nas três telas, com **preview** aparecendo depois de gravar
- [ ] Reabrir a tela: o preview volta (URL assinada, TTL 1h) — não pode ficar quebrado
- [ ] **PNG e JPG** passam; **PDF, SVG, WEBP e GIF** são recusados com mensagem clara
- [ ] Arquivo **acima de 5 MB** recusado
- [ ] Arquivo de 0 byte recusado
- [ ] **Isolamento (obrigatório):** o path é particionado por `org_id` **da sessão**. Confirmem em `storage.objects` que o objeto nasceu sob o `org_id` certo e que usuário de outro tenant não alcança o binário
- [ ] Substituir a imagem: o preview novo aparece. O objeto antigo fica órfão no bucket **de propósito** (custo desprezível, sem job de limpeza nesta correção) — **não é bug**
- [ ] Logo da empresa aparece no **PDF do PGR** consolidado

## B2 · Medidas de controle: status por nível e ponte com o Plano de Ação — #42, #50, #51

Regra que vive no repositório, compartilhada por Server Action e REST — vale testar pelos
**dois** caminhos.

- [ ] Risco **moderado+** com medida `aplicável` **sem** responsável ou prazo → recusa com `VALIDATION`/422 e mensagem explícita
- [ ] Os mesmos dados com responsável e prazo → grava
- [ ] Risco **trivial/tolerável** → não exige nenhum dos dois
- [ ] Status vazio recebe default pela classificação: trivial/tolerável → **manter**; moderado+ → **introduzida**
- [ ] Risco **sem avaliação vigente** → sem default, campo permanece vazio (não inventa nível)
- [ ] **Ponte #51:** criar/atualizar medida aplicável **espelha no Plano de Ação, na mesma transação**. Confirmem que não nasce plano duplicado ao editar a mesma medida duas vezes
- [ ] Sem `actionWhat`/`actionHow` a ponte não cria plano — e a medida também não grava (é aplicável)
- [ ] **Rollback:** se a ponte falhar, a medida **não** pode ficar gravada sozinha

## B3 · Catálogo de EPI — #21, #23, #24, #25, #26, #27, #29, #30

- [ ] **#25 — histórico append-only:** cada create/update grava uma linha em `epi_catalog_audit_log` **na mesma transação** do write, com resumo do que mudou. Edite 3 vezes → 3 linhas, mais recente primeiro, nenhuma sobrescrita. Update que falha **não** pode deixar linha de histórico
- [ ] **#27 — responsável pela inserção:** `createdBy` vem **sempre da sessão**, nunca do corpo da requisição. Mandem `createdBy` forjado via REST (`POST /api/v1/epi-catalog`) e confirmem que é **ignorado**. O campo é **imutável** no update — só o `changedBy` do histórico muda
- [ ] **#21 — categoria:** com **zero** categorias do tipo EPI cadastradas, o select mostra erro + atalho para criar, em vez de travar desabilitado em silêncio. E só oferece categorias do tipo `epi` (FK composta impede salvar de outro tipo)
- [ ] **#23 — lote** e **#26 — nota fiscal** no registro de **entrada de estoque**: gravam, aparecem no histórico do item e sobrevivem ao recarregar
- [ ] **#24 — data de substituição** e **#29 — especificações técnicas** persistem no item
- [ ] **Isolamento:** histórico, `createdBy` e lote de um tenant não podem aparecer em outro

## B4 · GES — #12 (pé-direito), #13 (cobertura), #15 (erro por campo)

- [ ] **#12:** `4,5` e `4.5` são aceitos e persistem igual (normaliza vírgula→ponto). `0` e negativo recusados. Vazio é aceito como "não aplicável" — **sem** erro
- [ ] Texto que não é número (`4,5m`) recusado com mensagem de campo
- [ ] **#13 — dado legado:** `roof` virou enum (`sem` / `parcial` / `total`), mas GES antigos têm **texto livre** ("Telha metálica"). Abram um GES antigo e confirmem que a tela não quebra e que salvar não corrompe o registro. **Se quebrar, é migração de dado pendente, não bug de UI** — reportem assim
- [ ] **#15:** o erro aparece **no campo**, não só na faixa genérica do topo

## B5 · PGR — #36 (ART do responsável técnico)

- [ ] Anexar a ART na aba de dados básicos do PGR (`relatedEntityType=responsible_technician`)
- [ ] O **PDF do PGR** referencia a ART anexada
- [ ] Sem ART anexada, o PDF continua gerando — não pode quebrar
- [ ] Anexo de um tenant não aparece no PGR de outro

## B6 · Empresas e Unidades de Obra — #5, #7, #8

Campos novos; só o smoke e a validação de formato importam aqui.

- [ ] **#5 — site/portal:** URL inválida (`empresa.com.br` sem esquema) é recusada; `https://…` aceito; vazio aceito
- [ ] **#7/#8 — gestor/preposto e formação profissional** gravam, voltam na edição e aparecem na listagem onde previsto

---

## Erros esperados (REST)

Coleção: `docs/api/sst-manager.postman_collection.json` · contrato: `docs/api/api-design.md`.
Habilitem `DEV_API_AUTH_BYPASS=true` **só** em ambiente não-produtivo.

| Código           | HTTP | Como provocar                                                                                     |
| ---------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `VALIDATION`     | 422  | medida aplicável em risco moderado+ sem responsável/prazo (#42)                                   |
| `FK_NOT_FOUND`   | 422  | id de **outra organização** — deve recusar **antes** de chamar o LLM (resposta rápida, sem custo) |
| `FORBIDDEN`      | 403  | `x-dev-role: client`                                                                              |
| `QUOTA_EXCEEDED` | 402  | plano `free` acima de **20 sugestões/mês por tipo de agente**                                     |
| `AI_UNAVAILABLE` | 502  | chave ausente/expirada ou cadeia de modelos esgotada                                              |

```bash
curl -X POST "$BASE/api/v1/risks/$RISK_ID/control-measure-suggestions" \
  -H "x-dev-tenant: $ORG_ID" -H "x-dev-role: owner"
```

**Verificação de segurança obrigatória.** Nenhuma mensagem de erro pode citar OpenRouter,
Mastra, nome de modelo ou nome de variável de ambiente: `toActionError` devolve a mensagem
ao cliente, então vazamento aqui **aparece na tela do usuário**. Para o usuário é sempre
**"IA pgr-e"**. Se acharem qualquer string fora disso, é bug de segurança, não cosmético.

**Isolamento multi-tenant.** O contexto enviado ao modelo é **não-PII**: só títulos de
função, nunca `employees`. Vale conferir que nenhum nome, CPF ou matrícula sai do servidor
— inclusive no agente de OS, que lê o funcionário **apenas** para chegar ao GES.

---

## Armadilhas conhecidas (não abram bug à toa)

**Auditoria órfã.** `risk_audits` liga a origem de forma polimórfica, **sem FK**. Risco
apagado deixa a auditoria apontando para o nada — na org principal, **3 de 5 auditorias
estão assim**. O 5W2H responde "A origem desta auditoria não existe mais…", o que está
correto. **Decisão de produto pendente:** limpar as órfãs, ou impedir excluir risco com
auditoria ativa.

**Objeto órfão no Storage.** Trocar a imagem não apaga a anterior — decisão registrada, não
esquecimento.

**`roof` legado.** GES antigos com texto livre no campo cobertura: é dado, não código.

**Tier gratuito é instável.** Os modelos são `:free`; 429 e timeout acontecem e a cadeia
troca de modelo sozinha. Uma execução lenta isolada não é bug — **três seguidas falhando
no mesmo cenário**, sim.

**Retry não conserta formato.** Se falhar sempre igual no mesmo cenário, o problema é
determinístico (schema/prompt) e insistir não ajuda. Foi assim que os três bugs originais
apareceram.

---

## Como reportar

Para cada achado: **bloco/issue · tela ou rota · entrada usada (id do GES/risco/função/OS)
· o que esperava · o que veio (resposta crua, se der) · reproduz sempre ou às vezes?**

O "sempre ou às vezes" é o que mais economiza tempo: separa incompatibilidade de formato
(sempre) de indisponibilidade do provedor (às vezes).

---

## Pronto para merge

- [ ] `npm run check` limpo
- [ ] Migration `0045` aplicada e os 3 buckets conferidos
- [ ] Bloco A: agentes 1 e 2 sem regressão (A, B e C); 3, 4 e 5 ponta a ponta
- [ ] Agente 5 validado ao vivo com chave nova — **é o único sem verificação prévia**
- [ ] Bloco B: B1 (upload nos 3 módulos) e B2 (regra #42 + ponte #51) validados pelos dois caminhos, UI e REST
- [ ] Isolamento multi-tenant conferido em Storage, histórico de EPI e anexos de PGR
- [ ] Nenhum vazamento de provedor/modelo/variável nas mensagens
- [ ] Testes de integração, se o ambiente tiver `INTEGRATION_DATABASE_URL`
