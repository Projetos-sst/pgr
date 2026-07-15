# Briefing — Fatia 032: Administração global (superadmin)

**Issue**: #89 · `[Fase 07] 09 · Administração global (masters, convites, uso de IA, guias)`
**Branch**: `feature/032-admin-global` (base: `develop`)
**Data**: 2026-07-15

## 1. A task

Área restrita de superadmin da plataforma (`/admin-global`): gestão de masters, monitoramento de uso de
IA por cliente, convites e guias. É **cross-tenant por natureza** (masters veem across-organizations).

## 2. Decisão de escopo (a mais sensível da fase)

- **Master = flag `users.is_master`** (decisão do usuário) — não é papel de tenant. Guard dedicado
  `requireMaster` (lê a flag do usuário da sessão). Área totalmente separada do gate de office-staff.
- **Cross-tenant é deliberado e restrito**: o repositório `admin.ts` opera sem `withOrg` (agrega uso de
  IA de TODAS as orgs), exclusivamente sob `requireMaster`. O Princípio I permanece intacto para o resto
  do app; esta é a única superfície global, gated.
- **MVP** = (1) gestão de masters (listar, promover por e-mail, remover — **protege o último master**);
  (2) uso de IA (Anthropic) por organização. **Convites e guias** ficam sinalizados como evolução (o
  convite de membros é per-org na fatia 020; o manual de onboarding já é um report type na fatia 026).
- **Sem entrada no nav**: superadmin acessa `/admin-global` por URL — evita expor a rota a todos e uma
  query de `is_master` por página. `requireMasterPage` → `forbidden()` para não-masters.

## 3. Implementação (as-built)

- **Migration `0018_user_is_master`**: `users.is_master boolean not null default false`. ⚠️ **Renumerar
  no rebase** (colide com `0018_schedule_events`/`0018_org_billing` — fatias paralelas).
- **Guard** `auth/require-master.ts` (`requireMaster` + `requireMasterPage`) + wrapper
  `server/master-action.ts` (espelha `officeAction`, gate global).
- **Repo** `repositories/admin.ts` (service client): `isUserMaster`, `listMasters`, `countMasters`,
  `setUserMaster`, `findUserByEmail`, `aiUsageByOrg` (agregação cross-tenant). Tipos em
  `domains/platform/admin.ts` (client-safe).
- **Actions** `actions/platform/admin.ts`: list/aiUsage/promote/demote — todas por `masterAction`;
  demote **protege o último master**; promote resolve por e-mail (`NOT_FOUND` se inexistente).
- **UI** `/admin-global`: gestão de masters (promover/remover) + tabela de uso de IA por org.
- **Testes**: unit das actions (último-master → `FORBIDDEN`; promote inexistente → `NOT_FOUND`;
  normalização de e-mail). O data-layer usa service client (fora do harness de Postgres). `typecheck`/
  `lint`/`build` verdes.

## 4. Para operar

O **primeiro master** é definido diretamente no banco (`update public.users set is_master = true where
id = '<clerk_user_id>'`) — a partir daí a gestão é pela UI. Sem master, `/admin-global` é `forbidden()`.

## 5. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/032-admin-global

Feature: Administração global (superadmin)

CONTEXTO:
SST Manager — área de superadmin da plataforma, CROSS-TENANT, restrita à flag users.is_master.
Separada do gate de tenant (office-staff). Seguir CLAUDE.md.

User stories:
- (P1) Como master, quero listar/promover/remover administradores da plataforma.
- (P2) Como master, quero monitorar o uso de IA por organização.

Success criteria:
- Só masters acessam a área; o restante do app permanece isolado por tenant.

Edge cases:
- Remover o último master (bloqueado). Promover e-mail inexistente.

Restrições (constituição):
- Princípio I intacto no resto do app; a superfície global é a única exceção, gated por is_master.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
