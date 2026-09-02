# IA pgr-e — relatório de ajustes e disponibilização dos agentes

**Data:** 02/09/2026 · **Branch:** `develop` · **Commits:** `607bf1a`, `ca7c3f8`, `a0c281a`

---

## Resumo

Os dois agentes que já existiam (**sugestão de riscos** e **plano de ação 5W2H**) estavam
falhando em uso real. A causa não era o modelo: era a nossa camada descartando resposta
boa por diferença de formato e, num dos casos, o próprio prompt mandando o agente ficar
calado. Isso foi corrigido na raiz — na classe base — e por isso a correção vale também
para os agentes novos.

Depois disso, três novos agentes entraram, cada um com superfície completa (Server Action

- REST + docs + Postman + tela de revisão + testes).

**Estado hoje:**

| Agente                         | Onde aparece                 | Situação                                     |
| ------------------------------ | ---------------------------- | -------------------------------------------- |
| Sugestão de riscos             | Detalhe do GES               | ✅ funcionando (verificado ao vivo)          |
| Plano de ação 5W2H             | Auditoria de risco           | ✅ funcionando (verificado ao vivo)          |
| Medidas de controle NR-01      | Medidas de controle do risco | ✅ funcionando (5/5 execuções)               |
| Treinamentos obrigatórios      | Edição da função             | ✅ funcionando (6/6 execuções)               |
| Instruções de OS (NR-01 1.4.1) | Edição da Ordem de Serviço   | ⚠️ código pronto, **não verificado ao vivo** |

> **Sobre o número "42":** não existe no repositório nenhuma lista de 42 itens — procurei
> em `novas-correcoes/` (só há 4 `.docx` de avaliação de cliente, nenhum com esse
> conteúdo), nas specs e nas issues. Preferi não inflar a lista para bater o número: o que
> está abaixo são os **41 ajustes reais**, cada um verificável no código. Coincidência
> curiosa: o commit dos agentes novos tocou exatamente 42 arquivos.

---

## Parte 1 — Por que riscos e 5W2H não funcionavam

### O diagnóstico

Rodei os dois agentes contra o banco real, não contra mock. Três causas independentes,
todas nossas:

**1. O 5W2H voltava correto e era jogado fora.** O modelo devolvia `how` como lista de
passos numerados — exatamente o que o **nosso próprio prompt** pedia ("passos concretos,
na ordem"). O schema exigia `string`. O Mastra valida **antes** do nosso código rodar,
então o plano inteiro virava `AI_UNAVAILABLE`.

**2. A sugestão de riscos perdia tudo em silêncio.** O modelo classificava o agente de
risco em português ("Químico", "Físico"); o enum é em inglês. Cada item reprovava
individualmente e a resposta de 12 riscos corretos chegava na tela como **lista vazia** —
indistinguível de "não achei nada".

**3. O prompt mandava o agente ficar calado.** A regra dizia para não presumir além da
descrição do GES. Só que **9 dos 12 GES reais têm apenas nome**. O modelo obedecia e
devolvia zero.

### Sobre os retries (o que você pediu para verificar)

A cadeia de modelos está correta e não era o problema: primário
`minimax/minimax-m3:free`, dois fallbacks, 2 tentativas por modelo, troca automática em
429/timeout/5xx (`config.ts` + `core/model-chain.ts`, tudo por env, sem rebuild).

**Mas retry não resolvia nenhuma das três causas acima** — e essa é a conclusão que
importa. Retry salva falha transitória. Incompatibilidade de formato é determinística:
reproduz idêntica em todas as tentativas, esgota a cadeia inteira e cobra do usuário ~40s
de espera para dar o mesmo erro. Por isso a correção foi de **tolerância no schema**, não
de mais tentativas.

### Os ajustes (1–16)

| #   | Ajuste                                                                                                                       | Arquivo                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `flexibleText` — aceita lista/número onde o schema pede texto; lista vira passos numerados em vez de reprovar                | `agents/core/flexible-text.ts`                 |
| 2   | `flexibleOptionalText` — vazio/`null` vira **campo ausente**, não string vazia (evitava custo "R$ 0" silenciosamente errado) | `agents/core/flexible-text.ts`                 |
| 3   | 5W2H: `what`/`why`/`who`/`where`/`how` passam a `flexibleText`                                                               | `agents/action-plan/prompt.ts`                 |
| 4   | Riscos: campos de texto passam a `flexibleText`/`flexibleOptionalText`                                                       | `agents/risk-suggestion/prompt.ts`             |
| 5   | `OUTPUT_CONTRACT` na **classe base** — proíbe devolver a definição do schema                                                 | `agents/core/sst-agent.ts`                     |
| 6   | Executor passa a enviar `systemPrompt` (instruções + contrato) e não `instructions` cru                                      | `agents/core/mastra-ai-service.ts`             |
| 7   | `normalizeAliasKey` + `aliasPreprocessor` — normalização de enum reaproveitável                                              | `domains/pgr/enum-aliases.ts`                  |
| 8   | `AGENT_TYPE_ALIASES` — "químico"/"físico"/"ergonômico"… → enum em inglês                                                     | `domains/pgr/ai-risk-suggestion.ts`            |
| 9   | `normalizeAgentType` aplicado no campo `agentType`                                                                           | `domains/pgr/ai-risk-suggestion.ts`            |
| 10  | Regra nova: nome do GES e títulos de função são **evidência técnica válida**                                                 | `agents/risk-suggestion/prompt.ts`             |
| 11  | Regra nova: proibido inventar especificidade (modelo de máquina, medição, número)                                            | `agents/risk-suggestion/prompt.ts`             |
| 12  | Regra nova: com pouco contexto, riscos **típicos** da atividade; lista vazia só quando nem a atividade é inferível           | `agents/risk-suggestion/prompt.ts`             |
| 13  | `ReferenceNotFoundError("origin")` virava a palavra `origin` na tela → mensagem em português                                 | `server/safety/action-plan-suggestion-core.ts` |
| 14  | Idem para `"ges"` → "GES não encontrado."                                                                                    | `server/pgr/ai-risk-suggestion-core.ts`        |
| 15  | Resposta vazia **não consome cota** — o usuário não paga por sugestão que não veio                                           | `server/pgr/ai-risk-suggestion-core.ts`        |
| 16  | Testes unitários: `flexible-text`, `sst-agent`, `normalizeAgentType`, prompt de riscos                                       | `__tests__/unit/…`                             |

**Resultado medido:** o agente de medidas passou de **1/5** para **5/5** só com o ajuste
#5. Riscos e 5W2H foram reexecutados depois de todas as mudanças — sem regressão.

---

## Parte 2 — Agente de medidas de controle (NR-01)

**Onde:** `/risks/{id}/control-measures` · **Verificado:** 5/5 execuções

Percorre a hierarquia da NR-01 (eliminação → substituição → engenharia → administrativo →
EPI) e propõe uma medida por nível, com "o quê", "como", monitoramento e justificativa.

| #   | Ajuste                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Domínio: schema, aliases de nível, ordenação pela hierarquia, deduplicação por nível                                                                                                                     |
| 18  | `dropExistingLevels` — a UNIQUE `(org, risco, nível)` só permite uma medida por nível, então os níveis já cadastrados são descartados **antes** de responder (nunca oferecemos o que o aceite recusaria) |
| 19  | Prompt de 10 regras, ancorado na classificação vigente do risco                                                                                                                                          |
| 20  | Agente **sem estado**: a primeira versão carregava os níveis existentes dentro do agente e o executor faz cache por `id` — estado poderia vazar entre execuções. Passou para o core                      |
| 21  | Repositório do contexto: risco + GES + títulos de função + avaliação vigente. **Nunca lê `employees`**                                                                                                   |
| 22  | Core com a ordem certa: isolamento → cota → LLM → descarte. Risco de outra org recusa **antes** da chamada externa                                                                                       |
| 23  | Aceite reusa `createControlMeasure` — regra de status pela classificação e espelho no Plano de Ação vêm de graça                                                                                         |
| 24  | Server Action + 2 rotas REST (`POST` sugerir, `POST /accept` → 201)                                                                                                                                      |
| 25  | Tela de revisão com seleção item a item (a IA nunca grava sozinha)                                                                                                                                       |
| 26  | Testes: prompt, schema, ordenação, descarte de níveis                                                                                                                                                    |

---

## Parte 3 — Agente de treinamentos obrigatórios

**Onde:** edição da função · **Verificado:** 6/6 execuções, 4–7 sugestões por função

| #   | Ajuste                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Domínio: schema com periodicidade normalizada e carga horária coagida (1–200h)                                                                                         |
| 28  | **Catálogo como vocabulário, não como cardápio** — a primeira versão do prompt ancorava tanto no catálogo que o agente só repetia o que já existia (1 item por função) |
| 29  | Regra: função operacional raramente tem menos de três obrigatórios — atacou a subresposta                                                                              |
| 30  | `sameTrainingName` por tokens — "Trabalho em Altura" casa com "NR-35 — Trabalho em Altura"; exige 2 tokens em comum para não criar vínculo falso                       |
| 31  | `matchAgainstCatalog` devolve `trainingId` e `alreadyRequired`: a tela mostra o que já é obrigatório, o que só será vinculado e o que será criado                      |
| 32  | Aceite cria no catálogo o que faltar e então vincula; o vínculo é idempotente                                                                                          |
| 33  | Server Action + 2 rotas REST + tela de revisão (item já obrigatório nasce desmarcado)                                                                                  |
| 34  | Testes: tokens, casamento com catálogo, schema, prompt                                                                                                                 |

> Antes de reescrever as regras, instrumentei a execução para confirmar que **nada estava
> sendo descartado em silêncio** — o modelo realmente respondia pouco. Só então mexi no
> prompt.

---

## Parte 4 — Agente de instruções de Ordem de Serviço

**Onde:** edição da OS · **Status:** ⚠️ pronto, **sem verificação ao vivo**

Redige as instruções de segurança da NR-01 1.4.1 na voz imperativa, a partir da função, do
GES, dos riscos e dos EPIs da atividade.

| #   | Ajuste                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35  | Domínio + schema (máx. 12 instruções, 500 caracteres cada, aceitando item como texto ou objeto)                                                                                                                                     |
| 36  | Repositório lê o funcionário **apenas** para chegar ao GES e à função — nome, CPF e matrícula nunca são selecionados                                                                                                                |
| 37  | Prompt de 9 regras, voz imperativa, sem repetir os itens que a OS já tem                                                                                                                                                            |
| 38  | **Sem `/accept` por decisão**: a coleção de itens é substituída em bloco pelo `PUT` da OS, que guarda a imutabilidade da OS assinada e o estado terminal. Um caminho de escrita próprio duplicaria essas guardas e elas divergiriam |
| 39  | Server Action + rota REST + botão "Redigir com a IA pgr-e" no formulário (só na edição — o agente lê a OS já persistida)                                                                                                            |
| 40  | Testes: prompt, schema, ausência de PII no contexto                                                                                                                                                                                 |

---

## Parte 5 — Fechamento

| #   | Ajuste                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41  | `docs/api/api-design.md` + coleção Postman com os 5 endpoints novos; typecheck e testes limpos (**1196 testes, 133 suítes**); arquivos temporários de investigação removidos |

---

## Pendências — o que você precisa saber

**1. A chave da OpenRouter expirou no meio do trabalho.**
`401 API key expired`, tanto em `/chat/completions` quanto em `/key`. Foi por isso que o
agente de OS ficou sem verificação ao vivo. Vale registrar que o **caminho de falha se
comportou certo**: `AI_UNAVAILABLE`, mensagem genérica "A IA pgr-e está indisponível no
momento", sem vazar provedor, modelo ou nome de variável para a tela. Com uma chave nova
em `.env.local`, o agente de OS pode ser validado em minutos.

**2. Testes de integração não rodaram.** Exigem `INTEGRATION_DATABASE_URL` apontando para
um Postgres efêmero, que não está configurado nesta máquina. Os testes unitários (1196)
passam.

**3. Auditorias órfãs — decisão sua.** `risk_audits` liga a origem de forma polimórfica,
**sem FK**. Apagar um risco deixa a auditoria apontando para o nada, e o agente 5W2H não
tem o que ler. Na org principal, **3 das 5 auditorias estão nesse estado**. Hoje isso
devolve a mensagem "A origem desta auditoria não existe mais…" — correto, mas é sintoma.
Duas saídas: limpar as auditorias órfãs, ou impedir a exclusão de risco com auditoria
ativa. Não escolhi por você.

---

## Nota de segurança

A chave da OpenRouter vive **apenas** em `.env.local` (gitignored), lida do ambiente a cada
execução — nunca em código, nunca em commit. O front-end não nomeia provedor nem
framework: para o usuário, é sempre **"IA pgr-e"**. Isso é regra da camada, não estilo:
`toActionError` devolve a mensagem do erro direto para o cliente, então qualquer detalhe de
infraestrutura numa mensagem de erro apareceria na tela.
