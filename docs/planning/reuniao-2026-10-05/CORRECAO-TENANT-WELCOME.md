# Correção — `tenant.context / blocked` em `/welcome`

Registro da investigação e da correção do erro que aparecia ao abrir
`http://localhost:3000/welcome`: overlay do Next com
`level: error · operation: tenant.context · outcome: blocked`, apontando para o
`console.error` de `src/shared/tenant/audit-log.ts`.

Data: 13/10/2026. Branch: `feature/reuniao-2026-10-05-pgr-portal` (PR #97).

---

## 1. O que o overlay era, de fato

Não era uma exceção não tratada: era o **`console.error` do próprio log de
auditoria**, que o overlay de desenvolvimento do Next exibe com a pilha do
servidor. A pilha mostrada
(`logTenantEvent` ← `requireTenantContext` ← `ProtectedLayout`) é o caminho do
registro, não o caminho de uma falha.

Esse evento sai de **um único lugar** em todo o código:

```
src/shared/auth/require-tenant-context.ts
  if (!active) { logTenantEvent("error", { operation: "tenant.context", outcome: "blocked", userId }) }
```

E `active` só é nulo quando `resolveActiveTenant` devolve nada — ou seja:
**a conta está autenticada e não tem nenhuma organização resolvível no banco**,
mesmo depois do auto-reparo (`provisionPersonalTenant`) que roda na mesma
requisição. Falha de infraestrutura não passa por aí: ela **lança**, e o erro
sobe como 500.

## 2. Por que o estado doía tanto

`/welcome` é a página de chegada depois do login
(`signInFallbackRedirectUrl="/welcome"`) e vive em `src/app/(protected)/`, cujo
layout exige **tenant**, não apenas sessão. Ao ser barrado, o layout mandava
para `/sign-in`:

```
/welcome → (sem tenant) → /sign-in → (sessão ativa) → /dashboard → (sem tenant) → /sign-in → …
```

O segundo passo foi **verificado no navegador**: com sessão ativa, `/sign-in`
redireciona para `/dashboard`, que é exatamente o mesmo layout que barrou. Ou
seja, o destino antigo fechava um **laço de redirecionamento** em cima de um
estado que não tinha tela nenhuma — e, em desenvolvimento, com pilha de erro na
cara do usuário.

## 3. Correção

| Mudança                                                                        | Arquivo                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Rota `/no-organization` — exige autenticação, **não** exige tenant             | `src/app/no-organization/page.tsx` (+ `sign-out-link.tsx`)                    |
| `NoTenantContextError` passa a levar para lá, não para `/sign-in`              | `src/app/(protected)/layout.tsx`                                              |
| Evento de auditoria ganha `reason` e severidade por caso                       | `src/shared/auth/require-tenant-context.ts`, `src/shared/tenant/audit-log.ts` |
| Visitante anônimo cai no `/sign-in` do produto, não na account portal do Clerk | `src/proxy.ts`                                                                |
| `code` opcional + espaço para ação de cliente                                  | `src/app/_components/error-state.tsx`                                         |

**`/no-organization`** fica fora de `(protected)` de propósito: é o único jeito
de atender quem tem sessão mas não tem tenant sem afrouxar o layout da área
autenticada. Ela não lê nenhum dado de tenant, não está na lista pública do
`proxy.ts` (visitante anônimo é mandado para o login antes de chegar) e repete a
verificação de sessão por dentro. A cada visita ela refaz a resolução — que
inclui o provisionamento auto-reparável —, então "Tentar novamente" tem efeito
real, e se o vínculo resolver ela devolve para `/welcome`. Tem "Sair da conta"
porque, sem isso, o estado é beco sem saída: `/sign-in` com sessão ativa volta
para a área bloqueada.

**Severidade do log.** O evento continua obrigatório (FR-026) e sai com a mesma
operação/`outcome`, agora com `reason`:

| `reason`        | Quando                                                                                      | Nível   |
| --------------- | ------------------------------------------------------------------------------------------- | ------- |
| `lost_access`   | havia tenant selecionado no cookie e ele não resolve mais — o cenário que a FR-024 descreve | `error` |
| `no_membership` | nunca houve seleção: conta autenticada ainda sem organização                                | `info`  |

Não é "trocar error por warn para sumir com o aviso": o fluxo foi corrigido
primeiro, e o que sobrou em `info` é um estado de onboarding esperado, com tela
própria. Tentativa realmente indevida continua auditada em `error` — tanto o
`lost_access` aqui quanto o cross-tenant em `office-action.ts`, `api/rest.ts` e
`audited-write.ts`, que não foram tocados.

## 4. O que **não** mudou

Clerk, isolamento multi-tenant, `withOrg`, RLS, papéis, `org_id`, rotas
protegidas, portal público, PDF/DOCX, GED, CNAE/CBO. Nenhuma migration, nenhum
dado de produção, nenhuma organização criada ou vinculada automaticamente além
do provisionamento pessoal que já existia.

## 5. Verificação

| Cenário                                          | Resultado                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| A — visitante anônimo em rota protegida          | `307` → `/sign-in?redirect_url=…` **do produto** (antes: account portal hospedada, que dizia "sst-manager")               |
| B — autenticado sem organização                  | tela `/no-organization` (sem overlay, sem pilha), com "Tentar novamente" e "Sair da conta" — verificado em 1440px e 375px |
| C — autenticado com organização                  | `/welcome` abre normalmente, 0 erro de console; `/dashboard` idem                                                         |
| D — `/no-organization` com organização resolvida | devolve para `/welcome` (ninguém fica preso)                                                                              |
| E — anônimo em `/no-organization`                | `307` para o login (a rota não é pública)                                                                                 |
| F — falha de infraestrutura                      | continua subindo; não é mascarada como "sem organização"                                                                  |
| Laço de redirecionamento                         | eliminado: o destino do bloqueio não exige tenant                                                                         |

Testes: `npm run check` PASS (0 erro de lint, 1381 unitários) e 15 suítes de
`integration/auth` (64 testes), incluindo a nova
`no-organization-page.test.tsx`. Login real no navegador feito com a conta
Google do projeto; nenhuma credencial digitada.

## 6. Pendência

A condição concreta que disparou o evento na máquina do relator **não foi
reproduzida**: com a conta do projeto a resolução funciona (duas organizações
ativas), e a identificação da conta afetada exigiria consulta direta ao banco
remoto, que não foi executada. O `reason` agora registrado faz a próxima
ocorrência se explicar sozinha.
