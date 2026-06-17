# Contrato — Onboarding, shell e bloqueio sem org ativa

## Rotas

| Rota                                          | Conteúdo                                                                                                                                       | Regra                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `(protected)/onboarding`                      | `<CreateOrganization afterCreateOrganizationUrl="/dashboard" />` + `<OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" />` | Destino de quem está autenticado mas sem org ativa. Lista convites/empresas e permite criar nova. |
| `(protected)/dashboard` (e demais de negócio) | Conteúdo de negócio                                                                                                                            | Só acessível com org ativa.                                                                       |

## Shell autenticado

- Exibe `<OrganizationSwitcher afterSelectOrganizationUrl="/dashboard" hidePersonal />`
  como seletor global de empresa (FR-004).
- A organização ativa e sua persistência entre reloads/sessões são do Clerk
  (FR-006, SC-006) — sem storage próprio.

## Bloqueio (contrato de comportamento)

Resolução única do tenant: `requireOrgContext()` (`src/shared/auth/require-org-context.ts`)
→ retorna `{ userId, orgId, orgRole, … }` ou lança `NoActiveOrgError` (sem `orgId`).

| Camada                        | Comportamento                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `(protected)/layout.tsx`      | `requireAuth()`; se `NoActiveOrgError` (ou sessão sem `orgId`) → `redirect('/onboarding')`. Não renderiza conteúdo de negócio (FR-007, US8). |
| Server Action de negócio      | Chama `requireOrgContext()` no topo; sem org ativa → retorna `Result { ok:false, error }` e **não** toca o banco (US8 cenário 2).            |
| Route Handler de negócio      | Idem; sem org ativa → `401/403`, sem acesso a dado.                                                                                          |
| Usuário removido da org ativa | Sessão perde `orgId` → mesmo caminho → `/onboarding` (FR-010).                                                                               |

Invariante: **sem org ativa, nenhum conteúdo de negócio é renderizado e nenhuma
query de negócio é executada** (Princípio I).

## Origem do tenant

- `orgId` vem **sempre** de `auth()` (sessão Clerk) via `requireOrgContext()`.
- **Nunca** de `formData`, query string, header ou body (FR-008).
- Toda leitura/escrita usa esse `orgId`, que coincide com o seletor (FR-009, SC-007).
