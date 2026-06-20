# Prompt do `/speckit-specify` — CRUDs dos cadastros base do PGR (spec 007)

**Criado**: 2026-06-20

**Para que serve**: este arquivo é o **input pronto** do `/speckit-specify` da fatia 007. Cole o
bloco em `## 🚀 Prompt` no comando (o hook de Git cria a branch automaticamente).

**Continuação da 006**: a fatia **006** (`.specs/006-cadastros-base-pgr/`, migration `0005`)
criou o **modelo de dados** de toda a cadeia (`companies`, `work_units`, `ges`, `ges_job_roles`,
`job_roles`, `employees`, `categories`), os repositórios base (`list`/`create`), os helpers de
derivação e os testes. A **007** entrega a **UI + Server Actions de CRUD completo** sobre esse
modelo — consolidando **5 cards** numa fatia única.

**Anexos obrigatórios** (fonte da verdade — leia INTEIROS antes de escrever a spec):

- `docs/briefings/007-01-empresa.md`
- `docs/briefings/007-02-unidade-obra.md`
- `docs/briefings/007-03-ges.md`
- `docs/briefings/007-04-funcoes.md`
- `docs/briefings/007-05-funcionarios.md`

Cada briefing traz, por entidade: o modelo de dados **real** da 006 (campos/constraints), o
escopo do CRUD, a tabela "métodos existentes × a criar", regras, edge cases, testes e critérios
de aceite. A spec deve **formalizar os 5 briefings como requisitos verificáveis**, sem perder
nenhum edge case.

> **Checkpoint humano**: após o `/speckit-specify`, um humano lê o `spec.md` e confirma o escopo
> consolidado (5 CRUDs numa fatia) antes de avançar para `/speckit-plan`.

---

## ⚠️ Achados de pré-análise (devem virar requisitos, não decisão técnica)

1. **CRUD incompleto nos repositórios da 006 = lacuna a corrigir.** Os repositórios atuais só
   expõem `list*` e `create*`. **Faltam** `getById` (detalhe), `update`, `delete` e
   busca/filtros em todas as entidades, e **editar/remover vínculo** em `ges_job_roles`. Como o
   requisito é **CRUD completo**, essas operações são **escopo obrigatório** da 007 (não
   opcional). O `createCompany` ainda ignora os campos novos da 006 (só grava
   `cnpj`/`razao_social`) — deve passar a persistir todos os campos.
2. **Contrato `Result` não existe no projeto.** Os cards pedem "Server Actions retornam
   `Result`", mas não há esse tipo no código. A 007 deve **estabelecer o contrato de retorno das
   Server Actions** (sucesso/erro padronizado, sem vazar exceção crua para a UI). É requisito de
   consistência, não uma solução técnica imposta.
3. **Nº de expostos é derivado** (helpers `countExposedWorkersByGes`/`exposedWorkersByGesMap` já
   existem). A 007 só **consome** — nunca cria coluna/trigger nem aceita o número como input.

---

## 🚀 Prompt (copie e cole)

```
/speckit-specify

GIT_BRANCH_NAME: feature/pgr-base-cruds

Feature: CRUDs dos cadastros base do PGR — Empresa, Unidade de Obra, GES (com gestão de
funções vinculadas), Função (Cargo) e Funcionário. Fatia única que entrega a UI + Server
Actions de CRUD COMPLETO sobre o modelo de dados criado na fatia 006.

ANEXOS OBRIGATÓRIOS (fonte da verdade — leia INTEIROS antes de escrever a spec):
- docs/briefings/007-01-empresa.md
- docs/briefings/007-02-unidade-obra.md
- docs/briefings/007-03-ges.md
- docs/briefings/007-04-funcoes.md
- docs/briefings/007-05-funcionarios.md
Cada um formaliza o modelo de dados real da 006, o escopo do CRUD, os métodos que faltam,
as regras, os edge cases e os critérios de aceite. A spec NÃO pode perder nenhum edge case.

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (inspirado no ePGR).
Esta é a continuação da fatia 006: lá criou-se o MODELO DE DADOS (migration 0005: companies,
work_units, ges, ges_job_roles, job_roles, employees) + repositórios base (list/create) +
helpers de derivação + testes. Aqui (007) entrega-se o CRUD COMPLETO (criar, listar, detalhar,
editar, excluir) de cada entidade, em UI + Server Actions. Antes de escrever a spec, leia
.specs/006-cadastros-base-pgr/ (data-model, spec, contracts) e .specs/005-modelo-tenant-gate-pro/,
o padrão de RLS da 004 (.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md) e os
arquivos já existentes em src/shared/db/schema/, src/shared/db/repositories/,
src/shared/domains/pgr/, src/shared/auth/require-tenant-context.ts e src/shared/db/with-org.ts.
LISTE os arquivos que vai ler antes de começar.

DECISÃO DE ESCOPO (registrar como tal): os 5 cards (#69, #71, #12, #13, #14) são consolidados
numa fatia 007 única (1 spec, 1 branch). As entidades têm dependência de cadeia
(Empresa → Unidade de Obra → GES/Função → Funcionário), então a ordem de prioridade reflete a
cadeia. NÃO fragmentar em 5 specs.

CRUD COMPLETO É REQUISITO (não opcional): para CADA entidade a spec exige criar, listar (com
busca/filtros), detalhar (getById org-scopado), editar e excluir. Os repositórios da 006 hoje
só têm list/create — todas as operações ausentes (getById, update, delete, busca/filtros, e
editar/remover vínculo em ges_job_roles) são escopo OBRIGATÓRIO desta fatia. O create de
empresa deve passar a persistir TODOS os campos da 006 (endereço, risk_grade, CNAE, etc.).

CONTRATO DE RETORNO DAS SERVER ACTIONS: a spec deve exigir um contrato de retorno padronizado
para toda Server Action (resultado de sucesso vs. erro de validação/negócio), sem vazar
exceção crua para a UI. (O projeto ainda não tem esse contrato — esta fatia o estabelece.)

User stories (P1 = mais crítica; ordem segue a cadeia de dados):
- US1 (P1): Como gestor de SST, quero CRUD completo de Empresa-cliente do meu escritório
  (CNPJ, razão social, CNAE, Grau de Risco NR-04, endereço, logo) — raiz da cadeia do PGR.
- US2 (P1): Como gestor de SST, quero CRUD completo de Unidade de Obra por empresa, com opção
  de copiar o endereço da empresa.
- US3 (P1): Como gestor de SST, quero CRUD completo de Função (Cargo) por empresa, com CBO.
- US4 (P1): Como gestor de SST, quero CRUD completo de GES com a caracterização do ambiente e
  gerenciar as funções vinculadas (add/editar/remover worker_count), com o nº de expostos
  DERIVADO por soma das funções.
- US5 (P1): Como gestor de SST, quero CRUD completo de Funcionário (lista, ficha de detalhe,
  criar/editar, excluir) com os dados do PGR, vinculado a Empresa/GES/Função do GES.

Success criteria mensuráveis (tecnologia-agnósticos):
- Cada uma das 5 entidades tem CRUD completo funcional (criar, listar, detalhar, editar,
  excluir) na fatia.
- Grau de Risco da empresa é obrigatório (1–4); fora do intervalo nunca salva.
- Nº de trabalhadores expostos do GES reflete SUM(worker_count) das funções vinculadas, é
  somente leitura, e é 0 quando não há vínculos.
- O picker de Função do funcionário mostra apenas as funções vinculadas ao GES selecionado.
- CPF do funcionário é único por escritório; mesmo CPF é aceito em escritórios distintos.
- Mesmo CNPJ é aceito em escritórios distintos; duplicado no mesmo escritório é bloqueado.
- 0% de registros de um escritório visíveis/edytáveis/excluíveis por usuário de outro, em
  qualquer caminho; detalhe cross-tenant retorna 404; lista cross-tenant retorna vazio.

Edge cases a considerar (consolidados dos 5 briefings — não omitir):
- Empresa: CNPJ duplicado no mesmo escritório (bloqueado) vs. em escritórios distintos
  (permitido); risk_grade fora de 1..4 (rejeitado); CNPJ inválido (≠14 dígitos) rejeitado;
  excluir empresa com filhos → confirmação + aviso de cascata.
- Unidade de Obra: empresa sem endereço (botão "copiar endereço" desabilitado); excluir
  unidade com GES vinculados (aviso/cascata); empresa de outro escritório nunca selecionável.
- GES: sem funções vinculadas → expostos = 0; worker_count <= 0 (rejeitado); mesma função
  vinculada duas vezes ao mesmo GES (bloqueado, UNIQUE); empresa sem unidades de obra (Obra
  vazia, criação bloqueada); excluir GES → cascata em ges_job_roles e ges_id dos funcionários
  vira NULL (preserva funcionário, avisar); soma do card "Total" nunca cruza tenants.
- Função: título duplicado na mesma empresa (bloqueado) vs. em empresas diferentes (permitido);
  excluir função vinculada a GES (vínculo some, expostos caem) ou a funcionários (job_role_id
  vira NULL) → avisar do impacto.
- Funcionário: CPF inválido/duplicado; GES sem funções (picker de Função vazio, salvar sem
  função permitido); funcionário sem GES/função (permitido, FKs nullable); detalhe de
  funcionário de outra org (404); enum fora do conjunto (rejeitado).
- Geral (todas): tenant ativo inexistente/inválido → lista vazia, jamais dados de outro;
  registro de outro escritório → 404 no detalhe, nunca na lista.

Restrições obrigatórias (constituição / Modelo B):
- Todo acesso a dados escopado pelo tenant ativo via requireTenantContext() + withOrg(); o id
  do tenant vem SEMPRE da sessão/vínculo, NUNCA de input do cliente (query string, body, header).
- Isolamento multi-tenant com backstop no banco (RLS app_runtime/GUC), padrão herdado da 004.
  Empresa-cliente é DIMENSÃO dentro do tenant, não fronteira.
- Validação de schema (zod) em TODA Server Action, antes da regra de negócio. Reutilizar os
  schemas já existentes em src/shared/domains/pgr/validation.ts (cpf, cnpj, risk_grade,
  worker_count, enums) — não duplicar (DRY).
- Nº de expostos é DERIVADO (SUM via helpers existentes), nunca coluna/trigger nem input.
- Server Actions com contrato de retorno padronizado; logTenantEvent na fronteira de tenant,
  sem PII.

Testes obrigatórios (CLAUDE.md + constituição):
- Unit de regra de negócio/validação (CPF, CNPJ, risk_grade, worker_count, enums, unicidades,
  derivação do nº de expostos com helpers puros).
- Integração de Server Actions/queries (create/list/detail/update/delete de cada entidade;
  gestão de ges_job_roles; picker de função do GES; 404 cross-tenant).
- Caminho crítico de isolamento multi-tenant contra Postgres EFÊMERO (INTEGRATION_*, NUNCA
  SQLite), escrito/validado à mão: tenant A só vê A; B só vê B; sem tenant, vazio; escrita
  cross-tenant rejeitada; UNIQUE(org_id, cpf) e uq_companies_org_id_cnpj permitem o mesmo
  valor em orgs distintas e bloqueiam no mesmo.
- npm run test e npm run test:integration verdes.

FORA DE ESCOPO (especificar para registro; ficam em fatias futuras):
- Integrações externas: lookup de CNPJ (Receita) e ViaCEP (dependem de #68).
- Upload de imagem (logo da empresa, foto 3x4 do funcionário) — só os campos logo_path /
  photo_path existem; storage é fatia futura.
- "Sugerir riscos com IA" / "Gerenciar Riscos" do GES (módulo PGR, Fase 3).
- Vínculo de Treinamentos do funcionário e tabela de referência de CBO (Fase 4).
- Contatos de emergência, CNH e passaporte do funcionário (deferidos na 006).
- CRUD de `categories` (catálogo EPI/Máquinas) — não faz parte destes 5 cards.

PRINCÍPIOS DE PROJETO (obrigatórios — overengineering é inadmissível):
- KISS: a solução mais simples que entrega o CRUD completo. Sem camadas/abstrações
  especulativas.
- YAGNI: implementar só o requisito desta fatia; nada de features além das 5 user stories.
- DRY: reutilizar repositórios da 006, schemas zod de validation.ts, helpers de expostos,
  withOrg/requireTenantContext, o padrão de endereço estruturado e o contrato Result (uma vez
  estabelecido) em todas as 5 entidades.

NÃO invente solução técnica aqui (forma da UI, estrutura das Server Actions, formato exato do
Result, biblioteca de formulário). Isso é decisão do /speckit-plan, com os briefings e o
código da 006 como insumo. Aqui só o "o quê" e o "porquê".

Escreva tudo em português brasileiro. Branch e commits em inglês.
```
