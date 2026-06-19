# Prompt do `/speckit-specify` — Modelo de Tenant + Gate PRO

**Criado**: 2026-06-19

**Para que serve**: este arquivo é o **input pronto** do `/speckit-specify` desta
fatia. Cole o bloco abaixo no comando (o hook de Git cria a branch automaticamente).

**Anexo obrigatório**: `docs/briefing-equipe-acessos-gate-pro.md` — é a **fonte da
verdade** da decisão (modelo, invariantes, 20 edge cases, modelo de dados, custo). A
spec deve **formalizar o briefing como requisitos verificáveis**, sem perder nenhuma
invariante nem edge case. Este é um ponto **crítico** do sistema (isolamento entre
clientes).

> **Checkpoint humano** (workflow 1.1): após o `/speckit-specify`, um humano lê o
> `spec.md` e corrige regras antes de avançar. Confirme também a decisão de
> **branch/relacionamento com a fatia 004** (emendar a 004 vs. fatia que a supersede).

---

```
/speckit-specify

GIT_BRANCH_NAME: feature/modelo-tenant-gate-pro

Feature: Modelo de tenant multiempresa + fundação de Equipe e Acessos com Gate PRO —
corrige a premissa de tenant, estabelece o modelo de identidade/membership e o
isolamento, e introduz o campo de plano (free|pro) que serve de base ao Gate PRO.

ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec):
- docs/briefing-equipe-acessos-gate-pro.md
Ele contém a decisão de modelo, as 3 invariantes normativas, o catálogo de 20 edge
cases, o modelo de dados e a análise de custo. A spec NÃO pode perder nenhuma
invariante nem edge case relevante — é um ponto CRÍTICO do sistema (isolamento entre
clientes / vazamento de dados é a falha mais grave de um SaaS B2B).

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (inspirado no
ePGR). Antes de escrever a spec, leia os padrões já vigentes no repo (estrutura de
app/ e src/, Server Actions/Route Handlers, Drizzle, e o padrão de RLS da fatia 004 em
.specs/004-multi-tenant-isolation/) e LISTE os arquivos que vai ler. Esta fatia REVISA
a premissa da 004: lá assumiu-se "organização do Clerk = Empresa"; aqui corrige-se para
"organização = Escritório (o tenant); Empresa = entidade de negócio dentro do tenant".

DECISÃO DE MODELO (registrar como regra de negócio — o "o quê", não a solução técnica):
- Modelo B: o TENANT é o escritório/conta do profissional de SST. A "Empresa-cliente"
  é uma entidade de negócio DENTRO do tenant — uma dimensão de dados, não uma fronteira
  de isolamento.
- Todo usuário, ao se cadastrar, recebe um WORKSPACE (unidade de tenant) próprio, com
  isolamento de dados desde o primeiro acesso — inclusive contas free.
- Gate PRO: a gestão de equipe ("Equipe e Acessos" — convidar colaboradores/clientes) é
  exclusiva do plano PRO. Conta free usa o sistema sozinha, sem convidar ninguém.
- O PLANO é propriedade do TENANT (free|pro), não do usuário.

INVARIANTES NORMATIVAS (devem virar requisitos/regras explícitas na spec):
- Inv-1: Permissões e disponibilidade de feature são resolvidas pelo plano do TENANT
  ativo, nunca por um "plano do usuário" global. Um usuário free pode ser colaborador
  pleno num tenant PRO.
- Inv-2: A "organização ativa" é conceito do NOSSO sistema (a lista de vínculos do
  usuário), não do provedor de autenticação. Qualquer usuário com 2+ vínculos vê o
  seletor de troca; quem tem apenas 1 vínculo não vê seletor.
- Inv-3: Convite RECONCILIA identidade existente — nunca cria conta duplicada para o
  mesmo CPF/e-mail. Convidar = criar vínculo; o dono do tenant é apenas um vínculo com
  papel de proprietário. O aceite casa pelo TOKEN do convite, não por igualdade de
  e-mail.

MODELO DE IDENTIDADE (regra de negócio):
- 1 identidade por CPF/e-mail, com N vínculos (memberships) a tenants.
- Um usuário pode ser dono do próprio tenant E membro de N outros simultaneamente.
- Papéis de vínculo: proprietário | colaborador | cliente. O papel "cliente" é
  restrito aos dados de UMA empresa-cliente específica do tenant (escopo por empresa).

User stories (P1 = mais crítica):
- US1 (P1): Como profissional de SST recém-cadastrado, quero já entrar com um espaço
  próprio e isolado, para usar o sistema sozinho sem depender de convite nem de
  escolher organização.
- US2 (P1): Como operador da plataforma, quero que os dados de um escritório nunca
  apareçam para outro — mesmo que uma consulta esqueça o filtro — para não vazar dados
  entre clientes (backstop de isolamento, herdado/estendido da fatia 004).
- US3 (P1): Como produto, quero distinguir tenants free de PRO por um campo de plano,
  para servir de base ao Gate PRO de Equipe e Acessos.
- US4 (P2): Como usuário convidado para o escritório de um terceiro, quero pertencer a
  esse escritório mantendo meu próprio espaço, e alternar entre eles com segurança, para
  atuar em mais de um contexto sem misturar dados.
- US5 (P2): Como dono de escritório PRO, quero conceder a um cliente acesso restrito aos
  dados apenas da empresa dele, para não expor as demais empresas do escritório.
- US6 (P3): Como dono de escritório, quero que, ao perder acesso ou plano, os dados
  sejam preservados e o acesso tratado de forma previsível (sem vazamento, sem perda).

Success criteria mensuráveis (tecnologia-agnósticos):
- 100% dos usuários recém-cadastrados entram com um tenant próprio isolado.
- 0% de registros de um tenant visíveis para usuário de outro, em qualquer caminho.
- Consulta sem filtro explícito retorna apenas dados do tenant ativo; sem tenant ativo,
  retorna vazio (nunca tudo).
- Tentativa de gravar registro pertencente a outro tenant é rejeitada em 100% dos casos.
- Um usuário com papel "cliente" enxerga 0 dados de empresas diferentes da sua dentro do
  tenant.
- Todo tenant tem exatamente um valor de plano (free|pro); default free.
- Um usuário com 2+ vínculos alterna de tenant e 100% dos dados passam a ser do tenant
  selecionado; 0% de dados do anterior permanecem visíveis.

Edge cases a considerar (do catálogo do briefing — não omitir os relevantes):
- Convidar e-mail que já tem conta → anexar vínculo, nunca duplicar identidade.
- Convidar e-mail sem conta → vínculo pendente; no aceite, cria identidade + vínculo.
- Nome/CPF digitado pelo convidante divergente do real → a identidade real vence.
- Aceite com e-mail diferente do convidado → casar pelo token do convite.
- Convidar a si mesmo / já-membro / convite duplicado → rejeitar/no-op (idempotência).
- Downgrade PRO→free com equipe → vínculos suspensos (não apagados); dados preservados.
- Usuário free é colaborador pleno num tenant PRO (plano é do tenant, não do usuário).
- Multi-org: definir tenant ativo default sem ambiguidade (risco de operar no errado).
- Seletor lista tenants free e PRO juntos.
- "cliente" escopado à empresa X não vê dados de outra empresa nem áreas de admin/equipe.
- Mesmo CNPJ em dois escritórios → duas empresas distintas (CNPJ não é único global).
- Remover o último proprietário → proibido; exigir transferência de propriedade.
- Deleção de tenant/conta → cascata previsível; demais vínculos do usuário preservados.
- Usuário removido do tenant que estava ativo na sessão → tratar como "sem tenant ativo".
- Valor de tenant ativo inválido/inexistente → resultado vazio, jamais dados de outro.

ESCOPO DE IMPLEMENTAÇÃO DESTA FATIA (manter enxuto — confirmar no checkpoint humano):
- INCLUI agora:
  - Workspace (tenant) criado no cadastro, com o usuário como proprietário.
  - O CAMPO de plano (free|pro) no tenant — apenas o campo/estado, SEM lógica de
    bloqueio (enforcement) ainda.
  - Modelo de dados/relacionamentos que sustentam as invariantes (tenant; vínculo com
    papel e escopo por empresa; entidade empresa-cliente) e o isolamento por tenant.
- FORA do escopo agora (especificar para o registro; implementar em fatias futuras):
  - Fluxo de convite (envio/aceite) e UI de "Equipe e Acessos".
  - Enforcement do Gate PRO (bloquear a feature quando free).
  - Criação automática da organização no provedor de auth no upgrade.
  - Policy de escopo por empresa para o papel "cliente" e RBAC fino intra-tenant.
  - Seletor de troca e onboarding multi-org.
  - Integração de billing/assinatura.

Restrições obrigatórias (constituição):
- Todo acesso a dados escopado pelo tenant ativo; o identificador do tenant vem sempre
  da sessão/vínculo, NUNCA de input do cliente (query string, body ou header).
- Isolamento multi-tenant com backstop no banco (RLS), reutilizando o padrão da fatia
  004.
- Validação de schema em toda Server Action / Route Handler.
- Testes obrigatórios (CLAUDE.md + constituição): unitários de regra de negócio;
  integração de Server Actions/Route Handlers (SQLite em memória); e o caminho crítico
  de isolamento contra Postgres efêmero (RLS), escrito/validado à mão — tenant A ativo
  só vê A; B só vê B; sem tenant, vazio; rejeição de escrita cross-tenant; e (para o
  papel "cliente", quando implementado) nenhum dado de outra empresa.

RELAÇÃO COM A FATIA 004:
Esta spec corrige/supersede a premissa de tenant da 004 ("organização = Empresa" →
"organização = Escritório"). O motor de isolamento da 004 (helper de tenant por
transação, RLS, tabela de demonstração, auditoria de fronteira) permanece válido e é
reutilizado; muda o SIGNIFICADO do identificador de tenant e nasce a entidade
empresa-cliente. Um humano decide se emenda a 004 ou trata como fatia que a supersede.

NÃO invente solução técnica aqui (provedor de auth, forma da policy de RLS, set_config,
API de organizações). Isso é decisão do /speckit-plan, com o briefing como insumo.
Aqui só o "o quê" e o "porquê".

Escreva tudo em português brasileiro.
```
