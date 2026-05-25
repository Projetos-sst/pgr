# Phase 1 — Data Model: Autenticação e Organizações (Clerk)

**Feature**: `feature/clerk-auth-foundation` · **Date**: 2026-05-24

## Visão geral

Nesta fatia, **todas** as entidades de identidade e tenant vivem no **Clerk** (sistema externo gerenciado). Não há tabelas próprias no PostgreSQL ainda. O "modelo de dados" desta fatia, portanto, é o **contrato de sessão** que a aplicação obtém do Clerk e o tipo do **AuthContext** que circula no servidor.

Quando a primeira fatia com persistência aparecer, espera-se que ela introduza uma tabela `organizations` local **espelhando** o `orgId` do Clerk como FK (para suportar dados de negócio escopados). Esse espelhamento é responsabilidade da próxima fatia, não desta.

---

## Entidades (residentes no Clerk)

### Usuário (`User`)

Identidade autenticável de uma pessoa.

| Campo                   | Origem | Descrição                                                   |
| ----------------------- | ------ | ----------------------------------------------------------- |
| `id` (`userId`)         | Clerk  | Identificador estável, prefixo `user_…`. Único globalmente. |
| `primaryEmailAddress`   | Clerk  | E-mail principal, usado para login.                         |
| `firstName`, `lastName` | Clerk  | Opcional, exibido pela UI do Clerk.                         |
| `imageUrl`              | Clerk  | Avatar, usado pelo `<UserButton>`.                          |

**Regras**:

- Um usuário pode pertencer a 0 ou mais organizações (memberships).
- Sem `Personal Account` (desabilitado no dashboard Clerk — R5/R9 do research).

### Organização (`Organization`)

Empresa-cliente do SST Manager. **É o tenant** para o isolamento da constituição §I.

| Campo          | Origem | Descrição                                                                  |
| -------------- | ------ | -------------------------------------------------------------------------- |
| `id` (`orgId`) | Clerk  | Identificador estável, prefixo `org_…`. Único globalmente. **É o tenant.** |
| `name`         | Clerk  | Nome legível da organização.                                               |
| `slug`         | Clerk  | Slug URL-safe (opcional para esta fatia).                                  |
| `imageUrl`     | Clerk  | Logo, exibido pelo `<OrganizationSwitcher>`.                               |
| `createdAt`    | Clerk  | Data de criação.                                                           |

**Regras**:

- Cada organização tem 1 ou mais membros.
- O criador entra automaticamente como `org:admin` (default do Clerk).
- Papéis intra-org (admin, basic_member, etc.) **não** são consumidos por esta fatia (Assumption da spec). Próximas fatias podem usar `has({ role })` quando precisarem.

### Membership (`OrganizationMembership`)

Vínculo Usuário × Organização.

| Campo                   | Origem | Descrição                                                                            |
| ----------------------- | ------ | ------------------------------------------------------------------------------------ |
| `id`                    | Clerk  | Identificador estável do vínculo.                                                    |
| `organization.id`       | Clerk  | FK lógica para `Organization`.                                                       |
| `publicUserData.userId` | Clerk  | FK lógica para `User`.                                                               |
| `role`                  | Clerk  | Papel dentro da org (ex.: `org:admin`, `org:member`). **Não consumido nesta fatia.** |
| `createdAt`             | Clerk  | Quando o usuário entrou na org.                                                      |

**Regras**:

- Um usuário pode ter N memberships ativas; apenas **uma é "ativa" por sessão** (a `orgId` no `auth()`).

### Convite (`OrganizationInvitation`)

Mecanismo do Clerk para um admin convidar usuário externo para a organização. Gerenciado pela UI do `<OrganizationProfile>` (ou `<OrganizationSwitcher>` quando admin). Esta fatia **não** customiza convites; usa o fluxo padrão.

---

## Contrato de Sessão (server-side)

Toda Server Action, Route Handler e Server Component da área autenticada lê o contexto via os helpers abaixo (nunca chama `auth()` diretamente em código de negócio).

### `AuthContext`

```ts
// lib/auth/types.ts
export type AuthContext = {
  userId: string; // ex.: "user_2abc…" — não vazio
  sessionId: string; // ex.: "sess_2abc…" — não vazio
};
```

### `OrgAuthContext`

```ts
// lib/auth/types.ts
export type OrgAuthContext = AuthContext & {
  orgId: string; // ex.: "org_2abc…" — não vazio, vem de auth()
  orgRole: string | null; // ex.: "org:admin", null se Clerk não retornar
  orgSlug: string | null;
};
```

**Invariantes**:

1. `AuthContext.userId` **sempre** provém de `await auth()` (Clerk), **nunca** de input do cliente.
2. `OrgAuthContext.orgId` **sempre** provém de `await auth()`, **nunca** de body/query/header.
3. Se o Clerk retornar `isAuthenticated: false`, helpers devem lançar `UnauthorizedError` antes de retornar.
4. Se autenticado mas sem `orgId`, helpers de org devem lançar `NoActiveOrgError` antes de retornar.

---

## Estados e transições (sessão)

```
[ANÔNIMO] -- sign-in/sign-up OK --> [AUTENTICADO sem org]
[AUTENTICADO sem org] -- cria/aceita org --> [AUTENTICADO com org ativa]
[AUTENTICADO com org ativa] -- troca de org --> [AUTENTICADO com org ativa] (orgId diferente)
[AUTENTICADO *] -- sign-out --> [ANÔNIMO]
[AUTENTICADO *] -- sessão expira --> [ANÔNIMO]
```

| Estado              | Pode acessar rotas públicas? | Pode acessar `/dashboard` e área `(app)`? | Pode acessar `/select-organization`? |
| ------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------ |
| Anônimo             | ✅                           | ❌ (redirect `/sign-in`)                  | ❌ (redirect `/sign-in`)             |
| Autenticado sem org | ✅                           | ❌ (redirect `/select-organization`)      | ✅                                   |
| Autenticado com org | ✅                           | ✅                                        | ✅ (pode criar/trocar)               |

---

## Mapeamento entidade ↔ requisitos funcionais

| FR                                                | Entidade/Contrato envolvido                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| FR-001..003 (login/cadastro/sair)                 | `User` (Clerk) via `<SignIn />`, `<SignUp />`, `<UserButton>`                                 |
| FR-004 (`userId`/`orgId` disponíveis no servidor) | `AuthContext` / `OrgAuthContext`                                                              |
| FR-005..009 (proteção e tenant da sessão)         | Invariantes 1–4 do contrato de sessão                                                         |
| FR-010..013 (criar/entrar/trocar org)             | `Organization`, `OrganizationMembership` via `<OrganizationSwitcher>`, `<CreateOrganization>` |
| FR-014 (página inicial autenticada)               | `User` + `Organization` (somente leitura via `auth()`)                                        |
| FR-015 (validação de schema)                      | Schemas Zod por handler (não pertencem ao modelo de identidade)                               |

---

## O que **não** é modelado nesta fatia (intencional)

- Tabela própria `organizations`/`users` no PostgreSQL (próxima fatia com persistência).
- Papéis e permissões finos intra-org consumidos pela aplicação (`has({ permission })`).
- Auditoria de eventos de auth (sign-in/sign-out, troca de org).
- Soft-delete de organizações/usuários.
- Convites customizados com fluxo próprio (UI atual usa o Clerk).
