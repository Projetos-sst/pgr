# IA pgr-e — roteiro de validação em `develop`

**Para:** equipe técnica · **Branch:** `develop` · **Commits:** `607bf1a`, `ca7c3f8`, `a0c281a`, `6fd509c`
**Contexto completo:** [`docs/relatorio-agentes-ia.md`](./relatorio-agentes-ia.md)

---

## O que precisa ser validado

Cinco agentes de IA no ar. Dois já existiam e **estavam quebrados em uso real** — foram
corrigidos e precisam de teste de regressão. Três são novos.

| #   | Agente                         | Tela                           | Estado                         |
| --- | ------------------------------ | ------------------------------ | ------------------------------ |
| 1   | Sugestão de riscos             | `/ges/{id}`                    | corrigido — validar regressão  |
| 2   | Plano de ação 5W2H             | `/risk-audits/{id}`            | corrigido — validar regressão  |
| 3   | Medidas de controle NR-01      | `/risks/{id}/control-measures` | novo                           |
| 4   | Treinamentos obrigatórios      | `/job-roles/{id}/edit`         | novo                           |
| 5   | Instruções de OS (NR-01 1.4.1) | `/service-orders/{id}/edit`    | novo — **nunca rodou ao vivo** |

**Zero migration nesta leva.** Nada de schema mudou; `ai_usage_events` já existia.

---

## Antes de começar

### 1. Chave da OpenRouter (bloqueante)

A chave usada no desenvolvimento **expirou**. Sem uma válida, os cinco agentes respondem
`AI_UNAVAILABLE` e não há o que testar.

```bash
# .env.local (gitignored — a chave NUNCA vai para o repositório)
OPENROUTER_API_KEY=sk-or-v1-...
```

Confirme antes de perder tempo com a UI:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://openrouter.ai/api/v1/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"   # espera-se 200
```

### 2. Demais variáveis (já têm default, só mexa se for testar troca de modelo)

| Variável                   | Default                                                 | Para quê                                |
| -------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `AI_SUGGESTION_MODEL`      | `minimax/minimax-m3:free`                               | modelo primário                         |
| `AI_FALLBACK_MODELS`       | `cohere/north-mini-code:free,minimax/minimax-m2.7:free` | cadeia de fallback, em ordem            |
| `AI_MAX_RETRIES_PER_MODEL` | `2`                                                     | tentativas antes de cair para o próximo |

São lidas **a cada execução** — trocar de modelo não pede rebuild, só reinício do processo
que leu o `.env`.

### 3. Dados mínimos no tenant de teste

Os agentes leem contexto real. Tenant vazio devolve pouco e o teste não prova nada.

- ≥ 1 **GES** com processo/ambiente descritos e ≥ 1 função vinculada;
- ≥ 1 **risco** nesse GES, com classificação (avaliação) vigente;
- ≥ 1 **auditoria de risco** cuja origem **ainda exista** (ver "Armadilhas");
- ≥ 1 **função** vinculada a GES com riscos;
- ≥ 1 **OS salva** com funcionário designado.

### 4. Build local

```bash
npm ci && npm run check     # format + lint + typecheck + 1196 testes unitários
npm run dev
```

`npm run test:integration` exige `INTEGRATION_DATABASE_URL` (Postgres efêmero) — **não
rodou no desenvolvimento**, então rodem se o ambiente de vocês tiver.

---

## Roteiro por agente

Em todos: a IA **propõe**, o usuário revisa e confirma. Nenhum agente grava sozinho.
Enquanto roda (~5–20s), a tela mostra barra de progresso e esqueleto — se ficar sem
feedback visual, é bug.

### 1 · Sugestão de riscos — `/ges/{id}` → "Sugerir riscos com a IA pgr-e"

- [ ] Modal abre **imediatamente** já carregando (não depois da resposta)
- [ ] Volta com riscos plausíveis; seleção item a item funciona
- [ ] "Adicionar selecionados" cria os riscos como **rascunho** no GES
- [ ] **Regressão A — enum em português:** nenhum risco pode sumir. Antes, "Químico"/"Físico" reprovavam contra o enum inglês e 12 riscos corretos viravam lista vazia. Confira o total prometido no modal vs. o total criado
- [ ] **Regressão B — GES só com nome:** teste num GES **sem** descrição de processo, só nome (ex.: "Técnicos de Manutenção Elétrica"). Antes devolvia zero. Agora deve devolver riscos típicos da atividade — **sem** inventar modelo de máquina, medição ou número que ninguém informou
- [ ] Lista vazia **não consome cota** (confira em `ai_usage_events`)

### 2 · Plano de ação 5W2H — `/risk-audits/{id}` → "Sugerir 5W2H com a IA pgr-e"

- [ ] Os 8 campos voltam preenchidos e editáveis antes de "Criar plano"
- [ ] **Regressão C — `how` em lista:** era a falha mais comum. O modelo devolve "como" em passos numerados e isso derrubava o plano inteiro como `AI_UNAVAILABLE`. Agora a lista deve virar texto com passos numerados. **Rode 3–5 vezes** — só reproduz em parte das respostas
- [ ] "Quem" traz **área ou função**, nunca nome de pessoa
- [ ] Prazo/custo ausentes ficam vazios (não `R$ 0`, não string vazia)
- [ ] IA indisponível não bloqueia: o preenchimento manual continua funcionando

### 3 · Medidas de controle — `/risks/{id}/control-measures` → "Sugerir medidas com a IA pgr-e"

- [ ] Medidas vêm ordenadas pela hierarquia NR-01 (eliminação → substituição → engenharia → administrativo → EPI)
- [ ] Cada uma traz "o quê", "como" e, quando cabe, monitoramento e justificativa
- [ ] **Nível já cadastrado não é oferecido.** A UNIQUE `(org, risco, nível)` permite uma medida por nível — cadastre uma medida de engenharia e peça sugestão de novo: engenharia não pode reaparecer
- [ ] Aceitar grava com **status derivado da classificação vigente** e **espelha no Plano de Ação** (é o mesmo caminho do cadastro manual, `createControlMeasure`)
- [ ] Responsável e prazo vêm **vazios** de propósito — são decisão humana
- [ ] Risco com todos os níveis preenchidos → mensagem de lista vazia, sem erro

### 4 · Treinamentos obrigatórios — `/job-roles/{id}/edit` → "Sugerir treinamentos com a IA pgr-e"

- [ ] Volta com 3+ treinamentos para função operacional (esperado 4–7)
- [ ] Cada linha diz claramente o destino: **já obrigatório** (desmarcado, não selecionável) · **existe no catálogo** (só vincula) · **novo** (cria e vincula)
- [ ] **Casamento por tokens:** com "NR-35 — Trabalho em Altura" no catálogo, uma sugestão "Trabalho em Altura" deve casar com o item existente — e **não** criar duplicata
- [ ] O inverso também: dois cursos genuinamente diferentes não podem ser casados como o mesmo
- [ ] Aceitar reporta quantos foram vinculados e quantos foram criados no catálogo
- [ ] Aceitar duas vezes o mesmo item não duplica o vínculo (idempotente)
- [ ] Revisar carga horária e periodicidade do que foi criado no catálogo — é sugestão, não verdade

### 5 · Instruções de OS — `/service-orders/{id}/edit` → "Redigir com a IA pgr-e"

> **Este é o único que nunca rodou contra o provedor real.** A chave expirou antes.
> Priorizem: é onde a chance de surpresa é maior.

- [ ] O botão **não** aparece em `/service-orders/new` (o agente lê a OS já persistida) e aparece na edição
- [ ] Instruções vêm na voz imperativa ("Utilizar…", "Inspecionar…"), aplicáveis à função
- [ ] Itens já presentes no checklist **não** são repetidos
- [ ] As instruções entram como itens do checklist e só persistem no **"Salvar"** — não há gravação automática
- [ ] Máx. 12 instruções, 500 caracteres cada
- [ ] **OS assinada:** confirmem que a imutabilidade dos itens continua valendo. Não há `/accept` próprio de propósito — a escrita passa pelo `PUT` da OS, que é quem guarda essa regra

---

## REST / Postman

Coleção atualizada: `docs/api/sst-manager.postman_collection.json` (pastas
"Sugestao de …"). Contrato em `docs/api/api-design.md`.

```bash
# habilite o bypass só em ambiente não-produtivo
DEV_API_AUTH_BYPASS=true
```

| Verbo | Rota                                                         | Retorno   |
| ----- | ------------------------------------------------------------ | --------- |
| POST  | `/api/v1/ges/{id}/risk-suggestions` · `/accept`              | 200 · 201 |
| POST  | `/api/v1/risks/{id}/control-measure-suggestions` · `/accept` | 200 · 201 |
| POST  | `/api/v1/job-roles/{id}/training-suggestions` · `/accept`    | 200 · 201 |
| POST  | `/api/v1/service-orders/{id}/instruction-suggestions`        | 200       |
| POST  | `/api/v1/risk-audits/{id}/suggest-action-plan`               | 200       |

```bash
curl -X POST "$BASE/api/v1/risks/$RISK_ID/control-measure-suggestions" \
  -H "x-dev-tenant: $ORG_ID" -H "x-dev-role: owner"
```

### Erros esperados

| Código           | HTTP | Como provocar                                                                                                    |
| ---------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `FK_NOT_FOUND`   | 422  | id de **outra organização** ou inexistente — deve recusar **antes** de chamar o LLM (resposta rápida, sem custo) |
| `FORBIDDEN`      | 403  | `x-dev-role: client`                                                                                             |
| `QUOTA_EXCEEDED` | 402  | plano `free` acima de **20 sugestões/mês por tipo de agente**                                                    |
| `AI_UNAVAILABLE` | 502  | chave ausente/expirada ou cadeia de modelos esgotada                                                             |

**Verificação de segurança obrigatória:** nenhuma mensagem de erro pode citar OpenRouter,
Mastra, nome de modelo ou nome de variável de ambiente. `toActionError` devolve a mensagem
ao cliente — vazamento aqui aparece na tela do usuário. Para o usuário é sempre
**"IA pgr-e"**. Se acharem qualquer string fora disso, é bug de segurança, não cosmético.

**Isolamento multi-tenant:** contexto enviado ao modelo é **não-PII** — só títulos de
função, nunca `employees`. Vale conferir no log/proxy que nenhum nome, CPF ou matrícula sai
do servidor, inclusive no agente de OS (que lê o funcionário **apenas** para chegar ao GES).

---

## Armadilhas conhecidas (não abram bug à toa)

**Auditoria órfã.** `risk_audits` liga a origem de forma polimórfica, **sem FK**. Risco
apagado deixa a auditoria apontando para o nada — na org principal, **3 de 5 auditorias
estão assim**. O 5W2H responde "A origem desta auditoria não existe mais…". Isso é
comportamento correto, não bug do agente. **Decisão de produto pendente:** limpar as
órfãs, ou impedir excluir risco com auditoria ativa.

**Lentidão e falha intermitente no tier gratuito.** Os modelos são `:free`. 429 e timeout
acontecem; a cadeia troca de modelo sozinha. Uma execução lenta isolada não é bug — **três
seguidas falhando no mesmo cenário**, sim.

**Retry não conserta formato.** Se a resposta falhar sempre igual no mesmo cenário, o
problema é determinístico (schema/prompt) e não adianta insistir. Reportem com o cenário
exato — é assim que os três bugs originais foram achados.

---

## Como reportar

Para cada achado: **agente · tela ou rota · entrada usada (id do GES/risco/função/OS) ·
o que esperava · o que veio (resposta crua, se der) · reproduz sempre ou às vezes?**

Esse "sempre ou às vezes" é o que mais economiza tempo: separa incompatibilidade de
formato (sempre) de indisponibilidade do provedor (às vezes).

---

## Definição de pronto para o merge

- [ ] `npm run check` limpo
- [ ] Agentes 1 e 2 sem regressão (A, B e C acima)
- [ ] Agentes 3, 4 e 5 funcionando ponta a ponta na UI
- [ ] Agente 5 validado ao vivo com chave nova — **é o único sem verificação prévia**
- [ ] Matriz de erros conferida, incluindo cross-tenant recusado antes do LLM
- [ ] Nenhum vazamento de provedor/modelo/variável nas mensagens
- [ ] Testes de integração, se o ambiente tiver `INTEGRATION_DATABASE_URL`
