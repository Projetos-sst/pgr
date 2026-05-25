# Workflows do Spec Kit — SST Manager

Padrão de trabalho da equipe usando **GitHub Spec Kit**. Nada de código de
produto fora deste fluxo. Dois caminhos, conforme o que você vai fazer:

- **[Workflow 1 — Desenvolvimento](#workflow-1--desenvolvimento-de-feature-nova)**:
  construir algo que ainda **não existe**. Caminho padrão durante a fase inicial
  do projeto (build dos módulos de SST).
- **[Workflow 2 — Manutenção](#workflow-2--manutenção-de-feature-existente)**:
  alterar/corrigir/melhorar algo que **já existe**. Vira o caminho padrão depois
  que os módulos estão entregues.

> **Antes de tudo**: a constituição (`.specify/memory/constitution.md`) rege todas
> as decisões. O `/speckit-constitution` roda **uma única vez** por projeto (já
> foi executado — v1.0.0). Só rode de novo para emendar princípios.

---

## Comandos do Spec Kit

Ordem oficial — dependência estrita da esquerda para a direita: não dá para
planejar sem spec, nem implementar sem tasks.

| Comando                  | Função                                              | Tipo         |
| ------------------------ | --------------------------------------------------- | ------------ |
| `/speckit-constitution`  | Princípios não-negociáveis do projeto               | Uma vez      |
| `/speckit-specify`       | Especificação da feature (o **quê** e o **porquê**) | Obrigatório  |
| `/speckit-clarify`       | Até 5 perguntas para eliminar ambiguidade           | Quality gate |
| `/speckit-plan`          | Plano técnico (stack, arquitetura, modelo de dados) | Obrigatório  |
| `/speckit-tasks`         | `tasks.md` ordenado por dependência e prioridade    | Obrigatório  |
| `/speckit-analyze`       | Consistência spec ↔ plan ↔ tasks (read-only)        | Quality gate |
| `/speckit-checklist`     | Checklist de qualidade focado                       | Opcional     |
| `/speckit-implement`     | Executa as tasks, gera o código e **commita**       | Obrigatório  |
| `/speckit-taskstoissues` | Converte tasks em issues do GitHub                  | Opcional     |

**Hooks automáticos de Git** (extensão `git`):

- Antes do `/speckit-specify`: cria a branch da feature automaticamente.
- Antes/depois de cada comando: oferece commit dos artefatos (`.md`). Aceite —
  cria pontos de restauração.

---

## Padrões de nomenclatura (branch, commit, PR)

Usamos **GitFlow padrão + Conventional Commits**. Sem tags de task.

### Branch

Formato: `<tipo>/<descrição-curta-kebab>`

| Tipo        | Quando usar                              |
| ----------- | ---------------------------------------- |
| `feature/`  | Funcionalidade nova (Workflow 1)         |
| `fix/`      | Correção de bug (Workflow 2 — Trilha A)  |
| `hotfix/`   | Correção urgente em produção             |
| `refactor/` | Refatoração sem mudança de comportamento |
| `chore/`    | Manutenção (deps, config, build)         |
| `docs/`     | Apenas documentação                      |

Exemplos: `feature/cadastro-de-empresas`, `feature/geracao-pgr-pdf`,
`fix/pdf-pgr-encoding`, `refactor/repositorio-funcionarios`.

### Commit

Formato: `<tipo>: <descrição no imperativo>` — tipos: `feat`, `fix`,
`refactor`, `chore`, `docs`, `test`, `perf`, `style`, `build`, `ci`.

Exemplos:

- `feat: adiciona cadastro de empresas com isolamento por organização`
- `fix: corrige encoding UTF-8 no PDF do PGR`
- `refactor: extrai validação de CNPJ para módulo compartilhado`

### Pull Request

Título da PR: mesmo formato do commit (`<tipo>: <descrição>`). Toda feature
entra na `main` via PR — nunca commit direto na `main`.

### Como forçar o nome da branch no Spec Kit

O hook que roda antes do `/speckit-specify` cria a branch automaticamente e, por
padrão, usaria numeração sequencial (`001-...`). Para usar o padrão GitFlow,
**informe o nome da branch no próprio comando** via `GIT_BRANCH_NAME`:

```
/speckit-specify

GIT_BRANCH_NAME: feature/cadastro-de-empresas

Feature: ...
```

> **Nota técnica**: o diretório da spec espelha o nome da branch. Com
> `feature/cadastro-de-empresas`, os artefatos ficam em
> `specs/feature/cadastro-de-empresas/` (`spec.md`, `plan.md`, `tasks.md`).
> Isso é esperado e agrupa as specs por tipo.

---

## Workflow 1 — Desenvolvimento de feature nova

Use a cada **fatia vertical** (um módulo ou capacidade): cadastro de empresas,
funcionários, PGR, EPIs, documentos, treinamentos, ordens de serviço,
acidentes, dashboards, geração de PDF.

Princípio: **spec-first**. Define o "o quê" e o "porquê" antes de uma linha de
código (Princípio III da constituição — Entrega em Fatias Verticais).

### 1.1 — Escrever a spec (cria a branch automaticamente)

```
/speckit-specify

GIT_BRANCH_NAME: feature/<descricao-curta-kebab>

Feature: <nome da fatia> — <descrição curta>

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho.
Antes de escrever a spec, leia os padrões e convenções já vigentes no repo
(estrutura de `app/`, componentes, padrões de Server Actions/Route Handlers,
estilo Tailwind v4). Liste os arquivos que vai ler antes de começar.

User stories (P1 = mais crítica; P2, P3 conforme necessário):
- Como <persona>, quero <ação> para <benefício>

Success criteria mensuráveis (tecnologia-agnósticos):
- <ex.: usuário cadastra uma empresa em menos de 2 minutos>
- <ex.: dados de uma empresa nunca aparecem para usuário de outra>

Edge cases a considerar:
- <ex.: organização sem nenhum registro ainda>
- <ex.: input inválido / campos obrigatórios ausentes>
- <ex.: usuário sem permissão na organização>

Restrições obrigatórias (constituição):
- Todo acesso a dados escopado pela organização ativa (Clerk).
- Validação de schema em toda Server Action / Route Handler.

NÃO invente solução técnica aqui — só o "o quê" e o "porquê".
Escreva tudo em português brasileiro.
```

➡️ **Passo manual obrigatório**: depois deste comando, **um humano lê o
`spec.md`** e corrige regras de negócio antes de avançar. O agente não adivinha
regras de SST.

### 1.2 — Clarificar ambiguidades

```
/speckit-clarify
```

Rode se a spec contém `[NEEDS CLARIFICATION]` ou se restaram dúvidas. **Pode
rodar mais de uma vez** — cada passada pega lacunas diferentes.

### 1.3 — Planejar (decisões técnicas)

```
/speckit-plan
```

Gera `plan.md`, `data-model.md`, `contracts/`, `research.md`. Aqui entram stack,
arquitetura e o modelo de dados. Roda o "Constitution Check" contra os
princípios. **Revise o plano** antes de seguir.

### 1.4 — Quebrar em tarefas

```
/speckit-tasks
```

Gera `tasks.md` — tarefas pequenas, revisáveis e ordenadas por dependência e
por prioridade (P1 → P2 → P3).

### 1.5 — Análise de consistência

```
/speckit-analyze
```

Read-only. Cruza spec ↔ plan ↔ tasks e acha contradições e gaps **antes** de
gerar código. Barato — **sempre rode**.

### 1.6 — Checklist de qualidade (opcional)

```
/speckit-checklist
```

Recomendado em fatias sensíveis — ex.: checklist de isolamento multi-tenant ou
de segurança de dados.

### 1.7 — Implementar (gera o código e commita)

```
/speckit-implement
```

Executa as tasks de `tasks.md` na branch da feature. O agente **commita por
tarefa ou grupo lógico** usando Conventional Commits (`feat: ...`, `fix: ...`).

Quality gate antes de concluir cada tarefa: `npm run lint` e a verificação de
tipos do TypeScript devem passar (constituição).

### 1.8 — Pull Request

```bash
git push -u origin feature/<descricao-curta-kebab>
gh pr create   # título: "feat: <descrição>"
```

### 1.9 — (Opcional) Issues no GitHub

```
/speckit-taskstoissues
```

---

## Workflow 2 — Manutenção de feature existente

Primeiro **classifique** a mudança — isso decide quanto processo aplicar.

> **Critério A vs. B**: mudou _o que o sistema deve fazer_ (requisito/regra)?
> → Trilha B. Está só _consertando o que já deveria funcionar_? → Trilha A.

### Trilha A — Correção pequena / bug isolado

Comportamento errado, ajuste de UI, fix pontual — **sem mudar requisitos**.
Rodar o ciclo Spec Kit completo aqui seria overhead. Faça direto:

```bash
# 1) Branch
git checkout -b fix/<descricao-curta-kebab>

# 2) Debug sistemático: reproduzir → causa-raiz → corrigir a causa (não o sintoma)

# 3) Quality gate
npm run lint   # + verificação de tipos

# 4) Commits (Conventional Commits)
git commit -m "fix: corrige encoding UTF-8 no PDF do PGR"

# 5) PR
git push -u origin fix/<descricao-curta-kebab>
gh pr create   # título: "fix: <descrição>"
```

➡️ Se o comportamento **documentado** mudou, atualize o `spec.md` da feature
afetada no mesmo PR — spec e código andam juntos.

### Trilha B — Evolução de feature existente

Nova capacidade ou mudança de regra num módulo já entregue. Trate como uma
**fatia nova**, mas com spec **só do delta**.

Princípio: spec só do delta, não da feature inteira. O agente infere o "Estado
Atual" lendo o código existente; a spec registra apenas o que vai mudar.

#### 2.1 — Escrever a spec do delta

```
/speckit-specify

GIT_BRANCH_NAME: feature/<descricao-da-evolucao-kebab>

Feature: Evolução em <módulo> — <descrição curta da mudança>

CONTEXTO (código já existe):
Esta funcionalidade já está implementada. Leia os arquivos relevantes ANTES de
escrever a spec e liste-os: <caminhos ou padrões de busca, ex.: app/empresas/**>

ESTADO ATUAL (você infere lendo o código):
Descreva em 1-2 parágrafos o comportamento atual da parte que será alterada.
Isso vira uma seção fixa "Estado Atual" na spec.

DELTA QUE QUERO (a mudança em si):
- <o que muda>
- <restrições, ex.: sem quebrar o contrato atual / sem afetar outros módulos>
- <permitido, ex.: refator interno>

User stories (só as que mudam de comportamento):
- Como <persona>, quero <ação afetada> para <benefício>

Success criteria do delta (não da feature inteira):
- <ex.: zero regressão no comportamento existente>

Edge cases relacionados ao delta:
- <...>

NÃO documente comportamento que não vai mudar. Foco no delta.
Escreva tudo em português brasileiro.
```

#### 2.2 a 2.6 — Igual ao Workflow 1

```
/speckit-clarify    (se houver [NEEDS CLARIFICATION])
/speckit-plan       (estratégia de mudança, riscos de regressão)
/speckit-tasks      (costuma dar poucas tarefas em manutenção bem escopada)
/speckit-analyze    (verifica que o delta não contradiz a spec original)
/speckit-implement  (gera o código e commita com feat:/fix:/refactor:)
```

#### 2.7 — Pull Request

```bash
git push -u origin feature/<descricao-da-evolucao-kebab>
gh pr create   # título: "feat: <descrição>"
```

---

## Tabela de decisão rápida

| Pergunta                                            | Sim →                           | Não →                       |
| --------------------------------------------------- | ------------------------------- | --------------------------- |
| O código já existe no repo?                         | Workflow 2                      | Workflow 1                  |
| Vou criar tela/rota/modelo que não existe?          | Workflow 1                      | Workflow 2                  |
| Estou só consertando algo que já deveria funcionar? | Workflow 2 — Trilha A           | —                           |
| Estou mudando uma regra de negócio existente?       | Workflow 2 — Trilha B           | Trilha A                    |
| A mudança preserva o contrato externo?              | Trilha A ou B com escopo enxuto | Workflow 1 se for reescrita |

**Dica de escopo**: se a "manutenção" cresceu para tocar 80% do módulo, trate
como Workflow 1 (reescrita) com novo nome. Specs de manutenção pequenas e
específicas são as que mais rendem.

---

## Boas práticas (eficiência e qualidade)

Baseadas na documentação oficial do Spec Kit e em práticas consolidadas de
spec-driven development com IA:

1. **Specs enxutos e vivos** — a spec não é um documento de 80 páginas. É lean e
   evolui com o projeto. Ao mudar de direção: atualize a `spec.md` → regenere o
   plan → regenere as tasks.
2. **`/speckit-clarify` é o passo de maior alavancagem** — minutos de perguntas
   economizam horas de retrabalho. Pode rodar mais de uma vez.
3. **`/speckit-analyze` sempre antes do `/speckit-implement`** — é barato e pega
   violações da constituição e gaps lógicos que virariam falha em runtime.
4. **Checkpoint humano em cada artefato** — depois de specify, plan e tasks, um
   humano revisa: a spec captura a intenção? o plano trata as restrições reais?
   há edge case faltando? Não confie cegamente no agente.
5. **Spec = "o quê" e "porquê"; Plan = "como"** — não coloque stack/arquitetura
   na spec. Tecnologia é decisão do `/speckit-plan`.
6. **Uma fatia por vez** — termine a história P1 funcional antes de iniciar a
   próxima feature. Sem mega-spec cobrindo vários módulos.
7. **Mudanças focadas e revisáveis** — tasks pequenas evitam "code dumps" de
   mil linhas impossíveis de revisar.
8. **Segurança desde a spec** — isolamento multi-tenant e validação entram como
   requisito na spec, não como remendo depois.
9. **Aceite os commits dos hooks** — pontos de restauração entre etapas.
10. **Quality gate** — `npm run lint` + verificação de tipos antes de concluir
    qualquer tarefa.

---

## Armadilhas comuns

| Errado                                                       | Certo                                        |
| ------------------------------------------------------------ | -------------------------------------------- |
| Spec gigante cobrindo o módulo inteiro para mudar 1 coisa    | Spec só do delta (Workflow 2 — Trilha B)     |
| Codar primeiro e gerar a spec depois "para documentar"       | Spec antes do código — sempre                |
| Pular `/speckit-clarify` com `[NEEDS CLARIFICATION]` na spec | Resolver antes do `/speckit-plan`            |
| Pular `/speckit-analyze` e ir direto implementar             | Rodar `analyze` — é barato e pega erros cedo |
| Colocar stack/arquitetura dentro da `spec.md`                | Tecnologia vai no `/speckit-plan`            |
| Commit direto na `main`                                      | Sempre feature branch → PR                   |
| Branch/commit sem o padrão (`feature/...`, `feat: ...`)      | Seguir GitFlow + Conventional Commits        |
| Rodar o ciclo Spec Kit completo para um typo                 | Workflow 2 — Trilha A (direto)               |
| Aceitar o código do agente sem revisar                       | Checkpoint humano em cada artefato           |

---

## Onde cada coisa fica versionada

Projeto de repositório único (`sst-manager`):

- **Artefatos do Spec Kit** (`spec.md`, `plan.md`, `tasks.md`, checklists) →
  `specs/<tipo>/<descrição>/` (espelha o nome da branch).
- **Constituição** → `.specify/memory/constitution.md`.
- **Código de produto** → `app/` e demais diretórios do Next.js.
- **A branch da feature é a mesma para spec e implementação** — repo único, um
  ciclo por branch, fechado por PR na `main`.

---

## Resumo visual

```
DESENVOLVIMENTO (Workflow 1 — feature nova)
  specify → clarify → plan → tasks → analyze → [checklist] → implement → PR
  (branch feature/... criada automaticamente no specify)

MANUTENÇÃO (Workflow 2)
  Trilha A (bug):      branch fix/... → debug → fix → lint → commit → PR
  Trilha B (evolução): specify → clarify → plan → tasks → analyze → implement → PR
```

---

## Referências

- [GitHub Spec Kit — repositório](https://github.com/github/spec-kit)
- [Spec Kit — documentação oficial](https://github.github.com/spec-kit/)
- [Spec-driven development with AI — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Diving Into Spec-Driven Development With Spec Kit — Microsoft for Developers](https://developer.microsoft.com/blog/spec-driven-development-spec-kit)
- [Spec-Driven Development: From Code to Contract in the Age of AI Coding Assistants — arXiv](https://arxiv.org/html/2602.00180v1)
