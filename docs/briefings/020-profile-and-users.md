# Briefing — Fatia 020: Perfil e gestão de usuários (equipe/multiusuário)

**Issue**: #84 · `[Fase 07] 01 · Perfil e gestão de usuários (equipe/multiusuário)`
**Branch**: `feature/020-profile-and-users` (base: `develop`)
**Data**: 2026-07-14
**Autor da análise**: engenharia (passo 1/2 do fluxo — análise + decisões antes de codar)

> ⚠️ **Os hints técnicos da issue estão desatualizados** (`features/`, `organization_id` do Clerk,
> **SQLite em memória**, `docs/architecture/`). O **CLAUDE.md prevalece**: arquitetura em camadas
> `src/shared/...`, tenant = `orgs.id` da sessão, testes de integração em **Postgres efêmero**
> (`INTEGRATION_*`), nunca SQLite. Este briefing segue o CLAUDE.md.

---

## 1. O que a task pede (entendimento)

Duas superfícies para o profissional de SST logado:

1. **Perfil pessoal** (`/perfil`): dados pessoais (nome, sobrenome, CPF, telefone, e-mail, avatar),
   informações profissionais (empresa/cargo) e **troca de senha**.
2. **Gestão de equipe** (`/equipe`): o administrador do escritório lista/busca membros, **convida**
   novos, ajusta **papel/permissão** e **remove** membros — tudo escopado ao tenant ativo.

User stories: **P1** editar o próprio perfil (dados/avatar/senha) · **P2** convidar membros ·
**P3** definir papel de cada membro.

---

## 2. Realidade do código (o que existe vs. o que criar)

Levantamento feito sobre o `develop` atual.

### Já existe (reutilizar)

- **`users`** (`src/shared/db/schema/users.ts`): tabela **global** de identidade (`id` = Clerk id,
  `email`, `first_name`, `last_name`, `image_url`, timestamps). RLS estilo identidade
  (`authenticatedRole` + `auth.jwt()->>'sub'`), **escrita pelo client que bypassa RLS**
  (`src/shared/clerk-sync/*` + `repositories/users.ts` → `upsertUser/replaceUser/deleteUser`).
- **`org_memberships`** (`schema/org-memberships.ts`): `(org_id, user_id, role, scoped_company_id)`,
  PK composta, RLS `auth.jwt()->>'org_id'`, acesso via client que bypassa RLS
  (`repositories/org-memberships.ts`: `upsert/ensureOwner/listByUser/delete`).
- **Tenant/papéis** (`src/shared/tenant/active-tenant.ts`, `src/shared/auth/*`):
  `requireTenantContext()` → `{userId, tenantId, plan, role}`; `requireOfficeStaff()` admite só
  `owner`/`collaborator`. Papéis de domínio `owner`/`collaborator`/`client`.
- **Padrão CRUD de `companies`**: `officeAction` → `ActionResult<T>`; repositório com `withOrg` +
  paginação `{rows,total}`; `restHandler` no espelho REST; zod em `domains/pgr/*` com helpers
  `optionalString/requiredString`.
- **Clerk server-side**: `clerkClient()` já usado em `src/shared/auth/policy.ts` (quota de orgs).
- **UI**: `_ui/form.tsx` (`TextField/SelectField/FormActions/SubmitButton`) e `_ui/list.tsx`
  (`PageHeader/EmptyState/SearchForm/Pagination/Table`); nav em `(protected)/layout.tsx`.

### Precisa criar

- **Colunas de perfil** em `users`: `phone`, `cpf`, `job_title` (texto, nullable) → **migration 0017**.
  (Última migration = `0016_training_module`; próxima livre = **0017**.)
- **Leitura de usuário**: `getUserById` no `repositories/users.ts` (hoje só há escrita).
- **Roster da equipe**: `listMembershipsByOrg(orgId, params)` (join `org_memberships`↔`users`),
  com **filtro `org_id` explícito** (a tabela bypassa RLS — o escopo é responsabilidade da query).
- **Server Actions**: `updateProfile` (self), `updateMemberRole`, `removeMember`, e — conforme a
  decisão D2 abaixo — `inviteMember`.
- **Espelho REST + docs api-design + Postman** para os recursos expostos (mandato de 4 partes).
- **Páginas** `/perfil` (abas) e `/equipe` (lista/busca/convite) + entradas no nav.
- **Sem helper de Storage/upload** hoje — ver decisão D1.

---

## 3. Decisões de arquitetura (recomendações)

### D1 — Avatar (upload) → **reusar `image_url` do Clerk; não construir Storage agora**

Não há integração de Storage no repo, e o CLAUDE.md trata upload como "futuro" (campos `*_path`
são texto). Construir upload+bucket agora é infra especulativa (viola YAGNI/Princípio II). **Recomendado**:
exibir o avatar do Clerk (`users.image_url`, já sincronizado) e delegar a troca de foto ao Clerk
(componente `UserProfile`/perfil do Clerk). Persistimos localmente só `phone/cpf/job_title`.
_Alternativa (rejeitada agora)_: Supabase Storage — exigiria helper novo + política de bucket por tenant.

### D2 — Convite de membros → **decisão do usuário (impacta constituição)**

Pelo **Modelo B**, conta **free não tem Clerk org** → convite via Clerk Organizations só existe no
**PRO**. Convite "genérico" por e-mail exigiria **provedor de e-mail = serviço externo novo = emenda
formal** (como Gotenberg/LLM). Opções em aberto (ver seção 5).

### D3 — Troca de senha → **delegar ao Clerk (client-side)**

Credenciais são do Clerk; não existe verificação server-side limpa de "senha atual". **Recomendado**:
usar o fluxo do Clerk (componente/SDK client) para troca de senha, sem Server Action própria de senha.
Documentar como delegação — não reinventar gestão de credencial.

### D4 — Isolamento da equipe → **filtro `org_id` explícito + guarda de papel**

`org_memberships` bypassa RLS, então **toda** query de equipe filtra `org_id = tenantId` (do
`requireTenantContext`, nunca do cliente) e valida papel: **só `owner`** gerencia equipe
(`requireOfficeStaff` + checagem `role === "owner"`). Regra de integridade: **não remover/rebaixar o
último `owner`** da org.

---

## 4. Plano de testes (CLAUDE.md)

- **Unit**: schemas zod de perfil (CPF/telefone), regra "não remover o último owner", normalização
  de papel.
- **Integração (Postgres efêmero `INTEGRATION_*`)**: `updateProfile` (self), `listMembershipsByOrg`
  isolado por org (**cross-tenant não vaza**), `updateMemberRole`/`removeMember` com `FORBIDDEN`
  para não-owner e bloqueio do último owner. LLM/Clerk externos mockados.

---

## 5. Decisões (resolvidas com o usuário — 2026-07-14)

- **D1 (avatar)** → **RESOLVIDO: reusar o `image_url` do Clerk**, sem Storage novo. Persistir só
  `phone/cpf/job_title`.
- **D2 (convites)** → **RESOLVIDO: convite via Clerk Organizations, gated a PRO** (conta free segue
  single-user, coerente com o Modelo B). `inviteMember` exige `plan === "pro"` + `orgs.clerk_org_id`;
  free → erro de plano (`FORBIDDEN`/gate de plano) sem chamar o Clerk.
- **D3 (senha)** → delegar ao Clerk (client-side), sem Server Action de senha.
- **D4 (isolamento equipe)** → filtro `org_id` explícito (tabela bypassa RLS) + só `owner` gerencia +
  não remover/rebaixar o último owner.

---

## 6. Prompt para `/speckit-specify` (a preencher após D1/D2)

```
/speckit-specify

GIT_BRANCH_NAME: feature/020-profile-and-users

Feature: Perfil e gestão de usuários (equipe/multiusuário)

CONTEXTO:
SST Manager — SaaS B2B multiempresa de SST. Fatia própria (1 issue = 1 branch = 1 spec).
Seguir CLAUDE.md (camadas src/shared/*, tenant = orgs.id da sessão, Postgres efêmero nos testes de
integração — NUNCA SQLite). Reusar officeAction/restHandler/requireOfficeStaff/withOrg/_ui.

User stories (P1 = mais crítica):
- (P1) Como usuário, quero editar meu perfil (dados pessoais + cargo) e trocar minha senha.
- (P2) Como owner do escritório, quero listar/buscar e gerir os papéis dos membros da minha equipe.
- (P3) Como owner, quero convidar novos membros / remover membros. [depende de D2]

Success criteria (agnósticos):
- O owner monta e gere a equipe do escritório sem suporte.
- Dados de uma organização nunca aparecem para outra.

Edge cases:
- Convite para e-mail já cadastrado. Remoção/rebaixamento do último owner. Organização sem membros
  além do próprio owner.

Restrições (constituição):
- Todo acesso escopado ao tenant ativo (orgs.id da sessão). Zod em toda Server Action.
- Só owner gerencia equipe. Sem serviço externo novo sem emenda (ver D1/D2/D3 do briefing 020).

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```

---

## 7. Implementação (as-built)

- **Migration `0017_user_profile_fields`**: `+phone/+cpf/+job_title` em `users` (colunas app-managed;
  o upsert do clerk-sync não as toca — sem clobber). `db:generate` → "No schema changes".
- **Dados**: `repositories/users.ts` (`getUserById`, `updateUserProfile`) e
  `repositories/org-memberships.ts` (`listMembershipsByOrg` com **filtro `org_id` explícito** +
  busca/paginação in-app, `getOrgMembership`, `updateMembershipRole`, `countOwnersByOrg`);
  `repositories/orgs.ts` (`getOrgById`). Todas pelo client Supabase service (tabelas de identidade).
- **Domínio** `domains/platform/{profile,team}.ts`: `profileInputSchema` (CPF opcional reusa
  `cpfSchema`), `inviteMemberSchema`/`updateMemberRoleSchema`, `toTeamMemberView`, `ROLE_LABEL`.
- **Cores** `server/platform/{profile,team}-core.ts` (regra única): guards owner-only, gate PRO,
  proteção do último owner, bloqueio de auto-remoção. Convite/papel/remoção via
  `integrations/clerk/organizations.ts` (ponto único de rede; espelho local sincroniza por webhook).
- **Superfícies**: Server Actions (`officeAction`) + espelho REST (`/api/v1/profile`,
  `/api/v1/team(/[userId]|/invitations)`) + docs api-design + Postman (mandato de 4 partes).
- **UI**: `/perfil` (conta read-only do Clerk + form dos campos app-managed) e `/equipe`
  (roster + busca + convite/papel/remover para owner PRO) + nav.
- **Testes**: unit de schemas + guards do core (repos/Clerk mockados) — 20 casos. As tabelas de
  identidade usam o client Supabase service (fora do caminho Drizzle/`withOrg`), então **não** são
  exercitáveis pelo harness de Postgres efêmero; o isolamento é coberto por unit (escopo `org_id`
  explícito + gates). Suite total: 560/560.
- **Gates**: `typecheck` · `lint` · `test` (560) · `build` · `db:generate` "No schema changes" ✅.
