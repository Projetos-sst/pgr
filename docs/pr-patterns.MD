# Padrão de PRs, branches e commits

## Objetivo da seção

Este padrão define como mudanças são planejadas, nomeadas, rastreadas e entregues para reduzir retrabalho, acelerar revisão e aumentar previsibilidade de release.

## Regra: Toda PR deve estar vinculada a uma task

Toda Pull Request deve referenciar um card ativo para garantir rastreabilidade ponta a ponta entre demanda, implementação e validação.

**Regra:**

- PR sem card só é permitida em exceções explícitas (hotfix crítico ou ajuste operacional emergencial).
- O ID da task deve aparecer em branch, commit e título da PR.

✅ **Jeito certo**

```
Branch:    ENG-123-feat/meeting-template-duplication
Commit:    ENG-123 feat: add meeting template duplication flow
PR Title:  ENG-123 - add meeting template duplication flow
```

❌ **Jeito errado**

```
Branch:    fix-stuff
Commit:    update
PR Title:  Ajustes diversos
```

> ⚠️ **Atenção:** sem ID de task, perde-se histórico de decisão e fica difícil auditar incidentes, encontrar decisões e histórico.

## Regra: Padrão de nomenclatura para branch

Branch bem nomeada facilita buscas, automações e entendimento rápido da intenção da mudança.

**Regra:**

- Formato obrigatório: `<TASK-ID>-<tipo>/<descricao-kebab-case>`.
- Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `hotfix`.

✅ **Jeito certo**

```
ENG-456-fix/sanitize-company-filter-on-repository
ENG-500-chore/update-pr-template
```

❌ **Jeito errado**

```
eng456_fix_company
feature/new-feature
```

## Regra: Mensagem de commit padronizada

Commit padronizado melhora leitura de histórico, geração de changelog e troubleshooting.

**Regra:**

- Formato obrigatório: `<TASK-ID> <tipo>: <descricao no imperativo>`.
- Commit deve representar mudança coesa e pequena.

| Tipo       | Quando usar                              | Exemplo                                                    |
| ---------- | ---------------------------------------- | ---------------------------------------------------------- |
| `feat`     | Nova funcionalidade                      | `ENG-120 feat: add export endpoint for meetings`           |
| `fix`      | Correção de bug                          | `ENG-121 fix: enforce company scope on list query`         |
| `chore`    | Manutenção técnica                       | `ENG-122 chore: update eslint configuration`               |
| `docs`     | Mudança documental                       | `ENG-123 docs: add api onboarding section`                 |
| `refactor` | Refatoração sem alterar regra de negócio | `ENG-124 refactor: split meeting service responsibilities` |
| `test`     | Criação/ajuste de testes                 | `ENG-125 test: cover tenant isolation in repository`       |
| `perf`     | Melhoria de desempenho                   | `ENG-126 perf: add compound index for meetings search`     |

## Regra: Template mínimo de PR

A descrição da PR é o contrato entre autor, reviewer e QA.

**Regra:**

Toda PR deve conter: objetivo, contexto, como testar/o que testar/porque testar, riscos, envs necessárias e checklist.

**Template recomendado:**

```markdown
## Objetivo

Implementar validação de escopo por empresa na listagem de reuniões.

## O que mudou

- Serviço de listagem atualizado para exigir `company_id`.
- Repositório ajustado para filtro multi-tenant.
- Testes de integração adicionados.

## Como testar

1. Subir ambiente local.
2. Criar dados para duas empresas.
3. Chamar endpoint com token da empresa A.
4. Validar que dados da empresa B não retornam.

### O que testar

Focar o teste nos middlewares de autenticação para invalidar conexões inseguras.

### Porque testar

Antes algumas requisições deixaram pegar dados de outra empresa através do endpoint.

## Riscos

- Regressão em filtros legados sem `company_id`.

## Checklist

- [ ] Testes unitários passaram
- [ ] Testes de integração passaram
- [ ] Sem breaking change não documentada

### ENV necessária

KMS_TOKEN=xyz
USE_ENCRYPTION=true
...
```

---

# Padrão de review/teste (Processo de Code Review e QA)

## Objetivo da seção

Padronizar como revisar e validar mudanças para elevar qualidade sem transformar review em bloqueio improdutivo.

## Regra: Revisão obrigatória com checklist técnico

Checklist reduz subjetividade e falhas recorrentes.

**Regra:**

- Toda PR deve ser revisada por pelo menos um dev do domínio.
- Para alteração crítica, exigir dois revisores.
- Review deve validar arquitetura, segurança, performance, testes e observabilidade.
- Colocar prints e comentários diretamente no card/task para manter este como ponto focal do tracking das mudanças e débitos que houveram na tarefa.

**Checklist de review:**

- [ ] Segue padrão de arquitetura (controller → service → repository)
- [ ] Não há query sem escopo multi-tenant
- [ ] DTOs de entrada e saída definidos
- [ ] Logs e auditoria aplicados quando necessário
- [ ] Testes cobrindo cenário principal e erro

## Regra: Qualidade de QA com roteiro explícito

QA eficiente depende de roteiro reprodutível e ambiente consistente.

**Regra:**

- PR deve incluir passo a passo de teste funcional.
- Definir dados de teste, pré-condições e resultado esperado.

## Regra: Execução de fluxo completo em ambiente local controlado

Simular integrações cedo evita descoberta tardia em homologação.

**Regra:**

- Utilizar `localStack` e/ou containers para validação de fluxos integrados quando aplicável.
- Quando cenário exigir nuvem real, executar em sandbox e ajustar tudo antes de subir para preprod.

**Cenários recomendados:**

- **Local:** validação rápida de integração assíncrona e contrato.
- **Sandbox:** validação final de permissões, rede e serviços gerenciados.

## Regra: Governança de revisão

Processo sem dono tende a degradar com o tempo.

**Regra:**

- Exceções devem ser registradas na PR com justificativa técnica.
- Revisões do GPT — se ignoradas, precisam ter um comentário com justificativa técnica.

> ⚠️ **Atenção:** acelerar entrega sem review qualificado aumenta custo de correção em produção.
