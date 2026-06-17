# Patterns a Seguir

Guia de padrões de engenharia para o projeto. Objetivo: legibilidade, manutenção
previsível, baixo acoplamento e evolução segura. Código e identificadores em inglês;
documentação e comunicação em PT.

---

## Princípios fundamentais

> **Seguir sempre.** Estes princípios têm precedência sobre qualquer regra específica
> abaixo. Na dúvida entre duas soluções, escolha a mais simples que resolve o problema.

### Clean Code

Código deve ser semântico a ponto de dispensar comentários. O leitor entende a
intenção pelo nome, não pela explicação ao lado.

- Nomes revelam intenção; funções pequenas com responsabilidade única.
- Prefira refatorar a comentar. Comente apenas o "porquê" irredutível (restrição
  externa, rationale de segurança, edge case proposital) — nunca o "o quê".
- Remova código morto, `TODO` de funcionalidade central e placeholder. Entregue
  código pronto, não scaffolding.

### KISS — Keep It Simple

Prefira a solução mais simples que atende ao requisito. Complexidade só quando
justificada por necessidade real e demonstrável.

- Menos camadas, menos indireção, menos "espertezas".
- Uma solução simples que evolui vence uma arquitetura complexa "à prova de futuro".

### DRY — Don't Repeat Yourself

Elimine duplicação real de conhecimento. Quando a mesma regra aparece em dois ou mais
lugares, extraia constante/função/módulo.

- Abstraia quando houver **dois ou mais** consumidores reais — não antes.
- Não force DRY sobre coincidências: dois trechos parecidos com motivos diferentes
  devem permanecer separados.

### Cuidado redobrado com over-engineering

> **YAGNI — You Aren't Gonna Need It.** Implemente apenas o requisito atual.

- Sem features, camadas ou abstrações especulativas "para o futuro".
- Não crie estrutura de domínio, generalizações ou pontos de extensão sem uso real.
- Abstração precoce é dívida: custa manutenção sem entregar valor.
- Antes de adicionar uma camada/abstração, pergunte: *"Isto resolve um problema que
  existe hoje?"* Se não, não adicione.

❌ **Errado**: "Build login form" → login + registro + reset de senha + 2FA + SSO.
✅ **Certo**: "Build login form" → apenas o login form.

---

## 1. Padrão de código

### Objetivo da seção

Garantir legibilidade, manutenção previsível e menor acoplamento por meio de regras
claras de escrita, organização e qualidade de código.

### Regra: Nomeação semântica

Nomes claros reduzem ambiguidade e diminuem tempo de entendimento em review.

**Regra**

- Variáveis e funções em inglês com intenção explícita.
- Booleanos devem começar com `is`, `has`, `should`, `can`.
- Classes e tipos em `PascalCase`.
- Funções e variáveis em `camelCase`.
- Pastas em `kebab-case`.

✅ **Jeito certo**

```ts
const isMeetingOwner = meeting.ownerId === userId;
function calculateRetryDelay(attempt: number): number {}
class AccessValidationService {}
```

❌ **Jeito errado**

```ts
const value = meeting.ownerId === userId;
function calc(x: number): number {}
class service {}
```

### Regra: Funções pequenas e responsabilidade única

Funções coesas são mais fáceis de testar e refatorar.

**Regra**

- Uma função deve resolver um único objetivo.
- Priorizar early return e evitar `if/else` profundamente aninhado.
- Ao crescer complexidade, extrair para funções auxiliares ou serviços.

✅ **Jeito certo**

```ts
function validateMeetingAccess(input: AccessInput): AccessResult {
  if (!input.userId) return { allowed: false, reason: "MISSING_USER" };
  if (!input.companyId) return { allowed: false, reason: "MISSING_COMPANY" };
  if (input.userCompanyId !== input.companyId)
    return { allowed: false, reason: "TENANT_MISMATCH" };
  return { allowed: true };
}
```

❌ **Jeito errado**

```ts
function validate(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }
  return false;
}
```

### Regra: Endpoint orquestra, service executa regra de negócio

Controller deve ser camada de entrada e coordenação; regra de negócio deve ficar em
service/domain.

**Regra**

- Controller não implementa regra complexa, query ou transformação pesada.
- Middleware não consulta model diretamente para regra de negócio.
- Validação de acesso deve ficar em service dedicado.

✅ **Jeito certo**

```ts
export async function createMeetingController(req: Request, res: Response) {
  const dto = mapCreateMeetingDto(req.body);
  const result = await meetingService.createMeeting(dto, req.user);
  return res.status(201).json(result);
}
```

❌ **Jeito errado**

```ts
export async function createMeetingController(req: Request, res: Response) {
  const existing = await MeetingModel.findAll();
  if (!req.user.permissions.includes("CREATE")) throw new Error("forbidden");
  const heavyMapping = existing.map((x) => ({ id: x.id, value: x.raw }));
  return res.json(heavyMapping);
}
```

### Regra: Tipagem forte e padronização de erros

Tipos explícitos e erros estruturados reduzem bugs silenciosos e melhoram
observabilidade.

**Regra**

- Proibido `any`.
- Usar `unknown` quando necessário, com validação explícita.
- Erros devem seguir contrato único.

**Contrato recomendado**

```ts
type AppError = {
  status: number;
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
};
```

### Regra: Logging técnico e auditoria

Logs consistentes aceleram debug e análise de incidentes.

**Regra**

- Registrar início, eventos críticos e fim do fluxo.
- Incluir campos de correlação: `requestId`, `companyId`, `userId`, `operation`.
- Ações sensíveis de usuário devem gerar log de auditoria.

✅ **Jeito certo**

```json
{"level":"info","operation":"meeting.create","phase":"start","requestId":"req_1","companyId":"cmp_10","userId":"usr_20"}
{"level":"info","operation":"meeting.create","phase":"finish","requestId":"req_1","meetingId":"mtg_99","durationMs":43}
```

> ⚠️ **Atenção:** nunca logar segredo, token, senha ou payload sensível sem
> mascaramento.

---

## 2. Padrão de projeto (Arquitetura)

### Objetivo da seção

Definir arquitetura escalável com fronteiras claras entre camadas, reduzindo
acoplamento e facilitando evolução de domínio.

### Regra: Aplicar DDD de forma pragmática

DDD organiza o sistema por domínio e linguagem de negócio, evitando estrutura centrada
em framework.

**Regra**

- Estruturar módulos por domínio de negócio.
- Cada domínio deve conter contratos, serviços de aplicação e adaptadores necessários.
- **KISS/YAGNI:** só crie a estrutura de domínio quando houver domínio real — não
  fragmente por antecipação.

**Estrutura de referência**

```
src/
  domains/
    meetings/
      controllers/
      services/
      repositories/
      dto/
      tests/
```

### Regra: Repository pattern obrigatório para acesso a dados

Repository isola persistência e permite evolução de ORM/SQL sem contaminar regra de
negócio.

**Regra**

- Services não acessam model/ORM diretamente.
- Query manual deve ser encapsulada em repository.

✅ **Jeito certo**

```ts
const meetings = await meetingRepository.listByCompany(companyId, filters);
```

❌ **Jeito errado**

```ts
const meetings = await orm.meetings.findMany({ where: { companyId } });
```

### Regra: DTO para entrada e saída de contratos

DTO protege contrato da API e evita vazamento de entidades internas.

**Regra**

- Todo endpoint deve mapear request para DTO de entrada.
- Toda resposta pública deve usar DTO de saída.
- Validação declarativa deve ocorrer antes da regra de negócio.

✅ **Jeito certo**

```ts
type CreateMeetingInputDto = {
  title: string;
  startsAt: string;
  participants: string[];
};
```

### Regra: Modularização e reutilização via toolkit

Código reaproveitável deve ser centralizado para reduzir duplicidade entre projetos.

**Regra**

- Extrair utilitários compartilháveis para toolkit quando houver reutilização real
  (DRY com dois ou mais consumidores).
- Evitar abstração precoce sem uso em mais de um contexto (over-engineering).

### Regra: Uso de middleware com fronteira clara

Middleware deve executar apenas preocupação transversal e leve.

**Regra**

- Middleware para autenticação, parsing e telemetria.
- Autorização contextual e regra de domínio em services.

> ⚠️ **Atenção:** middleware com consulta de model e regra de negócio complexa cria
> acoplamento oculto.

### Regra: Controle de concorrência em filas longas

Processamento concorrente sem limite pode saturar banco e filas.

**Regra**

- Usar `p-limit` em jobs de alto volume.
- Definir concorrência por capacidade do serviço e SLA.

✅ **Jeito certo**

```ts
import pLimit from "p-limit";
const limit = pLimit(10);
await Promise.all(records.map((record) => limit(() => processRecord(record))));
```

---

## 3. Padrão de IA

### Objetivo da seção

Padronizar o uso de IA para aumentar produtividade sem perder qualidade técnica,
segurança e consistência arquitetural.

### Regra: IA é acelerador, não aprovador final

Saída de IA pode estar sintaticamente correta e conceitualmente errada.

**Regra**

- Toda sugestão de IA deve passar por revisão humana antes de merge.
- Autor da PR é responsável final pelo comportamento entregue.

### Regra: Desenvolvimento orientado por especificação

Spec Driven Development reduz ambiguidades e melhora qualidade de geração por IA.

**Regra**

- Iniciar implementação a partir de especificação validada.
- Transformar requisitos em critérios verificáveis antes da codificação.

**Fluxo recomendado**

```
Requisito → Spec técnica → Casos de teste → Implementação → Review → QA
```

### Regra: Geração de testes por IA com validação rigorosa

Teste gerado por IA pode validar cenário incorreto.

**Regra**

- Todo teste criado por IA deve ser revisado para garantir que cenário e assert
  refletem regra de negócio real.
- Casos críticos multi-tenant devem ser escritos ou validados manualmente.

❌ **Jeito errado**

> Teste passa, mas valida apenas status HTTP e ignora isolamento por empresa.

### Regra: Prompt com contexto mínimo obrigatório

Sem contexto de arquitetura, IA tende a produzir soluções desalinhadas ao projeto.

**Regra**

- Informar ao prompt: domínio, padrões arquiteturais, contrato de API, restrições de
  banco e estilo de código.
- Referenciar documentos de projeto atualizados.

**Template mínimo de prompt**

```
Contexto: backend TypeScript com DDD e repository pattern.
Objetivo: implementar endpoint de listagem de reuniões.
Restrições: multi-tenant obrigatório por company_id, sem uso de any, com DTO de entrada/saída.
Entregáveis: service, repository e testes de integração.
```

> ⚠️ **Atenção:** nunca compartilhar segredo, credencial ou dados sensíveis em prompts
> externos.

---

## 4. Padrão de banco (Modelagem, migrations, queries)

### Objetivo da seção

Estabelecer consistência de modelagem, segurança multi-tenant e desempenho em
consultas e migrações.

### Regra: Convenção de nomenclatura de schema

Nome consistente facilita manutenção, query analysis e onboarding.

**Regra**

- Tabelas e colunas em `snake_case`.
- Índices no padrão `idx_<tabela>_<coluna>` ou `idx_<tabela>_<coluna1>_<coluna2>`.
- FKs no padrão `fk_<tabela>_<tabela_referenciada>`.

✅ **Jeito certo**

```sql
CREATE TABLE meeting_participants (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  meeting_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL
);
CREATE INDEX idx_meeting_participants_company_id ON meeting_participants(company_id);
```

### Regra: Multi-tenant obrigatório por `company_id`

Isolamento de tenant é requisito de segurança e conformidade.

**Regra**

- Toda query de leitura/escrita deve aplicar filtro de tenant.
- Não aceitar endpoint com acesso transversal sem autorização explícita e auditável.

✅ **Jeito certo**

```sql
SELECT id, title
FROM meetings
WHERE company_id = $1
ORDER BY starts_at DESC;
```

❌ **Jeito errado**

```sql
SELECT id, title
FROM meetings
ORDER BY starts_at DESC;
```

> ⚠️ **Atenção:** ausência de filtro de tenant pode expor dados entre clientes.

### Regra: Critério de uso ORM versus SQL raw

Escolher abordagem correta reduz latência sem perder manutenção.

**Regra**

- Usar ORM para CRUD simples e consultas comuns.
- Usar SQL raw para consultas críticas de performance, sempre encapsulado em repository
  e com testes.

| Cenário                       | Abordagem preferida    | Requisito mínimo   |
| ----------------------------- | ---------------------- | ------------------ |
| CRUD simples                  | ORM                    | DTO validado       |
| Relatório com joins complexos | SQL raw em repository  | Benchmark e teste  |
| Query crítica com degradação  | SQL raw otimizado      | Plano de execução  |

### Regra: Indexação orientada a acesso

Índice deve refletir padrão real de consulta.

**Regra**

- Toda migration de tabela crítica deve avaliar índices por coluna filtrada e ordenada.
- Justificativa do índice deve constar na PR.

**Exemplo**

```sql
CREATE INDEX idx_meetings_company_id_starts_at
ON meetings(company_id, starts_at DESC);
```

### Regra: Migration segura e reversível

Migration sem rollback planejado aumenta risco operacional.

**Regra**

- Toda migration deve ser idempotente quando possível.
- Incluir estratégia de rollback.
- Evitar alterações destrutivas sem janela controlada.

### Regra: Backfill e processamento de dados

Backfill sem governança pode sobrecarregar filas e banco.

**Regra**

- Executar backfill de forma controlada por tenant/escopo.
- Monitorar filas, latência e erro durante execução.
- Registrar plano de execução e validação pós-processamento.

---

## 5. Testes automatizados (Unitários, integração, E2E)

### Objetivo da seção

Definir estratégia de testes que cubra regra de negócio, integração entre camadas e
comportamento ponta a ponta.

### Regra: Adotar TDD quando aplicável

TDD antecipa falhas e melhora desenho de API interna.

**Regra**

- Para funcionalidades novas e correções críticas, escrever teste antes da
  implementação.
- Ciclo mínimo: falhar → implementar → passar → refatorar.

### Regra: Pirâmide de testes com foco em risco

Distribuição equilibrada de testes reduz custo e aumenta confiança.

**Regra**

- Priorizar unitários para regra de negócio.
- Usar integração para contratos entre camadas e banco.
- Usar E2E para jornadas críticas.

| Tipo       | Objetivo                            | Frequência |
| ---------- | ----------------------------------- | ---------- |
| Unitário   | Regra isolada                       | Alta       |
| Integração | Integração service/repository/DB    | Média      |
| E2E        | Fluxo crítico de negócio            | Seletiva   |

### Regra: Cenários críticos obrigatórios

Nem todo teste tem o mesmo valor; cenários críticos devem ser mandatórios.

**Regra**

- Cobrir isolamento multi-tenant, autorização, integridade de dados e idempotência.
- Para bug em produção, adicionar teste de regressão obrigatório.

**Exemplo de cenário crítico**

```gherkin
Dado usuário da empresa A
Quando listar reuniões
Então não deve retornar reuniões da empresa B
```

### Regra: Qualidade de testes acima de volume

Alta quantidade de testes fracos gera falsa segurança.

**Regra**

- Teste deve validar comportamento observável relevante.
- Proibido teste que apenas aumenta cobertura sem validar regra.
- Revisão de testes segue o mesmo rigor do código de produção.

### Regra: Execução contínua em pipeline

Sem gate automático, regressão chega mais rápido em produção.

**Regra**

- Pipeline mínimo: lint → testes unitários → integração.
- E2E em pipeline principal ou etapa de release conforme criticidade.

---

## 6. Documentação

### Objetivo da seção

Manter documentação viva para acelerar onboarding, aumentar previsibilidade e melhorar
a qualidade de implementação assistida por IA.

### Regra: README por repositório com seção operacional

README é ponto de entrada para desenvolvimento e suporte.

**Regra**

- Todo repositório deve conter visão geral, setup local, scripts, variáveis e
  troubleshooting básico.
- Atualizar README no mesmo ciclo de PR que alterar fluxo relevante.

**Estrutura mínima**

```markdown
## Visão geral

## Arquitetura

## Como executar localmente

## Variáveis de ambiente

## Fluxos críticos

## Como testar
```

### Regra: Documento de contexto para IA e engenharia

Documento de contexto reduz ruído em prompts e em onboarding técnico.

**Regra**

- Manter arquivo de contexto com domínio, limites de arquitetura e decisões técnicas.
- Atualizar após mudanças estruturais.

### Regra: Registro de decisões arquiteturais

Decisões sem histórico geram retrabalho e discussões repetidas.

**Regra**

- Registrar decisões relevantes com contexto, alternativas e impacto.
- Centralizar discussão e decisão no card/task correspondente.

### Regra: Governança de atualização documental

Documento desatualizado perde credibilidade e deixa de ser usado.

**Regra**

- PR que altera comportamento deve avaliar impacto documental antes do merge.
