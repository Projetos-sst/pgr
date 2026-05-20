# 04 — Integrações e Serviços

Este documento cobre as integrações externas e o serviço auxiliar de geração de
PDF.

## Clerk — autenticação e organizações

O Clerk resolve autenticação, sessões e **multi-tenancy** (Organizations). É a
fonte de verdade de usuários e do vínculo usuário↔organização.

### Responsabilidades

| O Clerk faz | A aplicação faz |
|---|---|
| Login, sessão, MFA | Lê a sessão para obter `userId` e `orgId` |
| Organizations e memberships | Usa `orgId` como `organization_id` em todo dado |
| Troca de organização ativa | Renderiza o `<OrganizationSwitcher />` no shell |
| Convites e papéis na org | Lê o papel para autorização nas Server Actions |

### Pontos de implementação

- `ClerkProvider` no `app/layout.tsx` raiz.
- `proxy.ts` protege as rotas de `(app)` — redireciona não autenticados.
- Telas de auth em `app/(auth)/` usam os componentes do Clerk.
- O `orgId` ativo é obtido **sempre** via `requireOrg()` (doc 03) — nunca de
  input do cliente.
- **Sem organização ativa** = sem acesso à área `(app)`. Tratar o caso de
  usuário sem nenhuma organização (onboarding / criar organização).

### Sincronização via webhook

A aplicação mantém um espelho mínimo em `user_profiles` (doc 02) para exibir
nomes e referenciar autoria sem chamar a API do Clerk a cada render.

```
Clerk  ──evento──▶  app/api/webhooks/clerk/route.ts  ──▶  user_profiles
   user.created / user.updated / user.deleted
```

- O Route Handler **verifica a assinatura** do webhook antes de processar.
- É **idempotente** — o mesmo evento pode chegar duas vezes.
- Memberships de organização **não** são espelhados: continuam no Clerk,
  consultados pela sessão.

## Supabase Storage — arquivos

Armazena os arquivos dos módulos de Documentos, certificados de treinamento e os
PDFs gerados.

### Particionamento por tenant (Princípio I)

O caminho do objeto **começa pelo `organization_id`**:

```
<bucket>/<organization_id>/<modulo>/<uuid>-<nome-do-arquivo>
```

Assim o isolamento aparece já na estrutura de chaves. O acesso é autorizado por
organização — nenhum tenant alcança a partição de outro.

### Fluxos

| Fluxo | Como |
|---|---|
| **Upload** | Server Action recebe o arquivo, valida (tipo, tamanho) e envia via `lib/storage.ts`; grava a `storage_path` na tabela `documents` |
| **Download** | `lib/storage.ts` gera uma **URL assinada** de curta duração; o cliente baixa direto do Supabase |
| **Exclusão** | Server Action remove o objeto e o registro na mesma operação |

Buckets **privados** — nada de bucket público. Todo acesso é via URL assinada
gerada no servidor, após checar o tenant.

## Serviço de geração de PDF — Gotenberg

> **Nota de governança**: introduzir o Gotenberg é infraestrutura nova e, pela
> constituição (Princípio II), **exige emenda formal** antes da Fase 5. O desvio
> é pequeno e justificado (ver AD-06 no doc 00), mas precisa ser registrado via
> `/speckit-constitution` com incremento de versão.

### Por que um serviço separado

Rodar Chromium dentro das funções serverless da Vercel é problemático: cold
start, limite de tamanho de bundle (~250 MB) e de memória. A solução é um
**worker auxiliar stateless** dedicado à renderização.

[Gotenberg](https://gotenberg.dev) é uma API HTTP stateless, _open-source_, que
converte HTML/Markdown em PDF (usa Chromium internamente). Distribuída como
**container Docker pronto** — não escrevemos nem mantemos o código do serviço,
apenas o consumimos.

### Topologia

```
┌────────────────────────┐         ┌──────────────────────────┐
│  Next.js (Vercel)       │         │  Gotenberg (container)   │
│                         │  HTTP   │  Railway / Render /      │
│  lib/pdf.ts ───────────────POST──▶│  Fly.io                  │
│  (renderiza HTML do     │  HTML   │                          │
│   documento)            │◀──PDF───│  HTML → PDF (Chromium)   │
└───────────┬─────────────┘         └──────────────────────────┘
            │ salva o PDF
            ▼
   Supabase Storage
```

### Pipeline

1. Um template React do documento (PGR, etc.) é renderizado para HTML estático
   no servidor (`renderToStaticMarkup`) com CSS de impressão.
2. `lib/pdf.ts` faz `POST` do HTML ao Gotenberg.
3. O Gotenberg devolve o PDF.
4. A aplicação salva o PDF no Supabase Storage e registra a `storage_path`.

### Operação e segurança

- **Deploy**: um único container Gotenberg em Railway, Render ou Fly.io (escolha
  na Fase 5). Stateless — sem volume, sem banco.
- **Acesso**: o endpoint do Gotenberg **não** é público. Protegê-lo com token no
  header e/ou restrição de rede; só a aplicação o chama.
- **Substituível**: por ser stateless e padrão HTTP, pode ser trocado sem afetar
  o domínio.

## Pipeline assíncrono de jobs (Princípio IV)

Operações pesadas não rodam síncronas dentro da requisição do usuário. A
disciplina depende do tamanho da operação:

### Documento único — execução rápida

Para gerar **um** documento, a geração é rápida o bastante. A Server Action pode
usar o `after()` do Next.js 16 para rodar a chamada ao Gotenberg **depois** de
responder ao usuário — sem bloquear a resposta, sem infraestrutura extra.

### Lote — tabela `jobs` + Vercel Cron

Para geração **em lote** (vários documentos), o trabalho é desacoplado:

```
1. Server Action  ──▶  cria N linhas em `jobs` (status=pendente)  ──▶  responde já
2. Vercel Cron    ──▶  app/api/cron/process-jobs  (a cada X min)
3. Route Handler  ──▶  pega jobs pendentes  ──▶  marca `processando`
                  ──▶  chama Gotenberg  ──▶  salva PDF no Storage
                  ──▶  marca `concluido` (ou `falhou`, incrementa `attempts`)
4. UI             ──▶  consulta `jobs` para mostrar progresso ao usuário
```

- A tabela `jobs` (doc 02) é a fila. `attempts` permite _retry_ simples de jobs
  que falharam.
- O endpoint de cron é protegido por `CRON_SECRET`.
- **Evolução futura** (fora do MVP — YAGNI): se o volume crescer, trocar o
  par tabela+cron por uma fila dedicada com retries e _backoff_ (ex.: QStash da
  Upstash). Registrado no doc 05.

## Cloudflare — borda

Camada de **configuração**, não de código:

- **DNS** do domínio.
- **WAF** e mitigação de ataques / DDoS.
- **Cache de borda** para assets estáticos.

Não exige código na aplicação; é configurada no painel da Cloudflare apontando
para a Vercel.

## Variáveis de ambiente

Todos os segredos vivem **apenas** em variáveis de ambiente (constituição,
Princípio V) — nunca commitados. Configuradas na Vercel (e num `.env.local` para
desenvolvimento, ignorado pelo Git).

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk (cliente) |
| `CLERK_SECRET_KEY` | Clerk (servidor) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verificação do webhook do Clerk |
| `DATABASE_URL` | Postgres via pooler (transaction mode, papel restrito p/ RLS) |
| `DATABASE_URL_UNPOOLED` | Conexão direta — só para rodar migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações de Storage no servidor |
| `GOTENBERG_URL` | Endpoint do serviço de PDF |
| `GOTENBERG_TOKEN` | Autenticação do endpoint do Gotenberg |
| `CRON_SECRET` | Protege os endpoints de Vercel Cron |

> O `DATABASE_URL` usa um **papel restrito sujeito a RLS** (doc 02) — não o
> `service_role` nem o superusuário. É o que torna o RLS um backstop real.
