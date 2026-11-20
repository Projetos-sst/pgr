# NOB-126 — Inventário de infraestrutura e plano de ambientes

Escrito em 20/11/2026 sobre a `develop` `3c998b3f` (migrations até `0096`). Fontes: o código, `docs/deploy/vercel.md`, `docs/deploy/identity-verifier.md`, `docker-compose*.yml`, `.env.example` e o histórico do GitHub Actions. Não foi lida nenhuma variável real dos ambientes, então o que depende de painel (plano contratado, backup, cota) está marcado **a verificar**.

## 1. O que a plataforma usa hoje

| Peça                  | O que é                                                       | Onde roda                                                    | Ambientes                                                                                                   |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Aplicação             | Next.js 16 (App Router), saída `standalone`                   | Vercel, organização no plano **Hobby**                       | `develop-pgr-e` (homologação, `APP_ENV=sandbox`) e `pgr-e-production` (`APP_ENV=production`)               |
| Publicação            | GitHub Actions: CI (lint, tipos, build, unit, integração) → CD | GitHub, repositório privado na organização Free              | `develop` publica na homologação; `main` publica na produção. Sem vínculo Git nativo na Vercel              |
| Banco                 | Postgres no Supabase, Drizzle como dono do schema             | Supabase                                                     | Testes `bhsppikrcjarbvmhzpna`; produção `fbuebpkqwhwvdkoakwje`                                              |
| Acesso ao banco       | `app_runtime` sem bypass de RLS (pooler 6543); owner só para migrations | —                                                   | Por projeto. O CD aplica as migrations antes do deploy                                                       |
| Arquivos              | Supabase Storage, buckets privados                            | Supabase                                                     | Buckets `documents`, `company-logos`, `employee-photos` (e fotos de EPI e veículos)                         |
| Login                 | Clerk                                                         | Clerk                                                        | **Produção usa as chaves de testes** (decisão temporária registrada em `vercel.md`)                         |
| PDF                   | Gotenberg (LibreOffice) com as fontes do template, atrás de proxy Caddy com token | VPS (`docker-compose.homolog.yml`)       | Homologação. Alternativa: Google Docs por Service Account                                                   |
| Fila de PDF em lote   | Worker Node (`worker/index.ts`), tabela `jobs`                | VPS, junto do Gotenberg                                      | Cada worker aponta para o banco do seu ambiente                                                             |
| IA                    | Mastra + OpenRouter                                           | OpenRouter                                                   | Modelo padrão e reservas com sufixo `:free`. **Produção usa a chave de testes**                             |
| Pagamento             | Stripe (Checkout, Portal, webhook)                            | Stripe                                                       | Desligado sem `STRIPE_SECRET_KEY` (responde `503`). Catálogo comercial atrás de `COMMERCIAL_CATALOG_ENABLED` |
| Identidade do médico  | Papel `identity_verifier` no banco + conta de login separada  | Supabase                                                     | Não provisionado: o acesso clínico fica bloqueado (falha fechada). Ver NOB-162                              |
| Integrações públicas  | CNPJ, CEP, CAEPI                                              | APIs públicas, via `src/app/api/integrations/**`             | Todos                                                                                                       |
| Proteção da homologação | Basic auth no `proxy.ts` quando `APP_ENV=sandbox`           | Vercel                                                       | Homologação                                                                                                 |

## 2. Riscos encontrados

Ordenados pelo efeito no lançamento.

1. **Vercel Hobby é para uso pessoal e não comercial.** A plataforma vai cobrar clientes, então o plano não serve para a produção. **Decisão:** produção no plano Pro da Vercel antes de qualquer cliente pagante. A homologação pode continuar no Hobby.
2. **CI e CD dependem da cobrança do GitHub.** Em 14/11 o Actions parou por limite de gastos, e a homologação ficou sem receber três PRs. Sem CI não há prova, e sem CD não há deploy. **Decisão:** definir um limite de gastos com alerta e um dono para a conta da organização.
3. **Produção usa as chaves de testes do Clerk e do OpenRouter.** Usuário de teste e usuário real dividem a mesma base de login, e a IA de produção consome a cota de testes. **Decisão:** chaves próprias de produção antes do lançamento.
4. **Modelos `:free` do OpenRouter.** Eles têm limite de uso baixo, e a política de dados de cada provedor gratuito precisa ser conferida. Hoje a IA recebe só contexto sem dado pessoal (fatia 016), mas as NOB-124 e 125 vão precisar dessa resposta antes de mandar qualquer coisa. **A verificar:** política de retenção do modelo escolhido.
5. **Backup e restauração do banco não estão documentados.** O plano do Supabase decide se há backup diário e recuperação para um ponto no tempo. **A verificar** no painel dos dois projetos. Sem teste de restauração, o backup não conta.
6. **Sem monitoramento de erro.** Não há serviço de erro nem alerta. Hoje um erro de produção só aparece se alguém olhar o log da Vercel. **Decisão:** ligar um serviço de erro antes do lançamento (seção 4).
7. **Worker e Gotenberg rodam fora do CD.** O VPS é atualizado à mão, e uma mudança no template pode chegar à aplicação sem chegar ao conversor. **Decisão:** registrar no roteiro de publicação a versão da imagem `dougladmo/sst-gotenberg` junto com o commit da aplicação.
8. **Bypass de autenticação da API em ambiente não produtivo.** `DEV_API_AUTH_BYPASS` é ignorado em produção pelo código, mas **a verificar** se está `false` na homologação (pendência já registrada em `STATUS-MEDICINA-2026-11-14.md`).

## 3. Plano de ambientes

| Ambiente    | Para quê                                | Banco                     | Login                | Pagamento               | IA                  | Dados                          |
| ----------- | --------------------------------------- | ------------------------- | -------------------- | ----------------------- | ------------------- | ------------------------------ |
| Local       | Desenvolvimento e testes de integração  | Postgres efêmero (Docker) | Clerk de testes      | Desligado ou dublê      | Desligada ou dublê  | Seeds (`scripts/seed-dev-*`)   |
| Homologação | Teste da equipe e do cliente, sem dado real | Supabase de testes     | Clerk de testes      | Stripe em modo teste    | Chave de testes     | Fictícios, nunca dado de cliente |
| Produção    | Clientes                                | Supabase de produção      | **Clerk de produção** | Stripe em modo real, só depois da NOB-131 | **Chave própria** | Reais                          |

Regras que já valem no código e continuam:

- Cada branch publica com os segredos do seu projeto, sem cair nos do outro (`cd.yml`).
- A migration roda antes do deploy, e a falha dela interrompe o deploy.
- O catálogo fictício nunca roda em produção nem com `APP_ENV` vazio.
- Evento do Stripe em modo real (`livemode`) é ignorado pelo fluxo comercial fora de produção.

## 4. Backup, restauração e monitoramento

| Item                    | Mínimo para o lançamento                                                                                         | Situação         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| Backup do banco         | Backup diário com retenção de pelo menos 7 dias no projeto de produção                                            | A verificar      |
| Restauração             | Uma restauração de teste em projeto separado, com o tempo medido e registrado                                     | Não feito        |
| Arquivos do Storage     | Saber se o backup do Supabase cobre o Storage. Se não cobrir, cópia periódica do bucket `documents`               | A verificar      |
| Erros da aplicação      | Serviço de erro ligado na produção, sem dado pessoal nem clínico no evento                                         | Não existe       |
| Disponibilidade         | Verificação externa da página de login e do Gotenberg (`/health`), com alerta                                      | Não existe       |
| Fila de PDF             | Alerta para job `failed` ou parado além de `WORKER_STALE_AFTER_SECONDS`                                            | Não existe       |
| Rollback da aplicação   | Voltar ao deployment anterior no projeto certo, sem reverter o banco (`vercel.md`)                                 | Documentado      |

## 5. Custos a comparar

Os valores mudam por plano e por uso, então nenhum número entra aqui sem a fonte oficial e a data da consulta.

| Serviço        | O que decide o custo                                   | Decisão pendente                                  |
| -------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Vercel         | Plano (Hobby não serve para a produção), usuários do time | Contratar o Pro para a produção                 |
| Supabase       | Plano por projeto, backup, tamanho do banco e do Storage | Plano da produção com backup                     |
| Clerk          | Usuários ativos por mês                                 | Instância de produção                             |
| OpenRouter     | Tokens por modelo                                       | Modelo pago ou gratuito na produção (NOB-124/125) |
| Stripe         | Tarifa por transação e por recorrência                  | Ver NOB-131                                       |
| VPS            | Máquina do Gotenberg e do worker                        | Uma máquina por ambiente ou compartilhada          |
| GitHub Actions | Minutos do repositório privado                          | Limite de gastos e dono da conta                  |

## 6. O que fica para quem decide

| #   | Decisão                                                     | Bloqueia                          |
| --- | ----------------------------------------------------------- | --------------------------------- |
| 1   | Contratar Vercel Pro para a produção                        | Lançamento comercial              |
| 2   | Chaves de produção do Clerk e do OpenRouter                 | Lançamento                        |
| 3   | Plano do Supabase de produção com backup e teste de restauração | Lançamento                    |
| 4   | Serviço de erro e de disponibilidade                        | Lançamento                        |
| 5   | Limite de gastos e dono da conta do GitHub                  | CI e CD de todas as PRs           |
| 6   | Provedor e modelo de IA com política de dados conferida     | NOB-124, NOB-125                  |

Nada disso muda o código desta etapa. Cada decisão tomada deve voltar para esta tabela com a data e quem decidiu.
