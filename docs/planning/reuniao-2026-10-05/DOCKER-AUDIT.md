# Auditoria e otimização do Docker Desktop — 08/10/2026

Máquina de desenvolvimento do PGR (Windows 11 Pro 26300, WSL2 2.4.11.0, kernel 5.15.167.4-1).
Documento sanitizado: nenhuma senha, token, connection string ou conteúdo de `.env` foi copiado
para cá — os testes de conexão leram o `.env` em memória e reportaram apenas host e resultado.

**Escopo autorizado:** preservar o que PGR e Site-PMPA precisam, mais qualquer dado persistente que
não possa ser descartado com segurança. Comandos proibidos pelo usuário (`system prune -a --volumes`,
`volume prune`, `image prune -a`, `builder prune -a`, `compose down -v`, remoção forçada de imagem
referenciada) **não foram executados**.

## 1. Antes

Medições de 08/10/2026, antes de qualquer ação.

### 1.1 Disco (`docker system df`)

| TYPE          | TOTAL | ACTIVE | SIZE     | RECLAIMABLE     |
| ------------- | ----- | ------ | -------- | --------------- |
| Images        | 27    | 19     | 14,35 GB | 4,837 GB (33%)  |
| Containers    | 19    | 4      | 306,5 MB | 283,6 MB (92%)  |
| Local Volumes | 47    | 6      | 6,246 GB | 5,057 GB (80%)  |
| Build Cache   | 52    | 0      | 1,766 GB | 1,766 GB (100%) |

VHDX da distro `docker-desktop-data`: **42,89 GB ocupados em disco** (`%LOCALAPPDATA%\Docker\wsl`),
contra ~19 GB de conteúdo real somado acima — ou seja, ~24 GB de VHDX inflado que o WSL não devolve
sozinho ao Windows.

### 1.2 Memória

| Item                                      | Valor                 |
| ----------------------------------------- | --------------------- |
| RAM física                                | 23,79 GB              |
| RAM em uso                                | 21,22 GB (89,2%)      |
| `vmmemWSL` (VM inteira do Docker/WSL)     | 4.127 MB              |
| Docker Desktop (processos Windows)        | 406 MB em 4 processos |
| Soma real dos containers (`docker stats`) | **1,131 GiB**         |

Maiores consumidores de RAM da máquina, para contexto:

| Processo                 | RAM      |
| ------------------------ | -------- |
| Opera                    | 6.867 MB |
| `vmmemWSL` (Docker)      | 4.127 MB |
| Antigravity (IDE)        | 2.221 MB |
| svchost (agregado)       | 1.901 MB |
| chrome                   | 1.423 MB |
| node (13 servidores MCP) | 1.140 MB |
| Docker Desktop           | 406 MB   |

**Conclusão central da investigação: o Docker não é o maior consumidor de memória da máquina.**
Os containers usam ~1,13 GiB; os ~3 GB restantes do `vmmemWSL` são page cache do kernel Linux e
overhead da VM, que a WSL retém porque **não existe `%USERPROFILE%\.wslconfig`** — sem ele valem os
defaults: teto de ~50% da RAM física (11,58 GiB, confirmado pelo limite que o `docker stats` reporta)
e **sem** `autoMemoryReclaim`. Opera sozinho consome 66% mais que a VM inteira do Docker.

## 2. Classificação dos recursos

Critério: a qual projeto o recurso pertence e se pode ser descartado sem perda.

| Projeto                                                        | Origem confirmada                              | Classificação                                      |
| -------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| **PGR**                                                        | este repositório                               | **essencial**                                      |
| **Site-PMPA**                                                  | `site-pmpa/docker-compose.yml`                 | **essencial**                                      |
| **boteco-do-farias-60-anos**                                   | tem `supabase/` próprio; stack da Supabase CLI | **terceiro projeto — não tocar sem autorização**   |
| `minikube`, `elastic-logs-lab`, `fullstackweekend-aparatus-v2` | nenhum projeto nas pastas auditadas            | **origem antiga/desconhecida — exige autorização** |

Pontos de verificação que sustentam a classificação:

- O PGR **não** tem diretório `supabase/` e o `.env` aponta para `aws-1-us-east-1.pooler.supabase.com`
  (Supabase **remoto**). Logo os 12 containers `supabase_*_boteco-do-farias-60-anos` e suas 10 imagens
  **não** pertencem ao PGR — pertencem ao terceiro projeto.
- O PGR usa Docker apenas para `sst-gotenberg` (render de PDF), `sst-pdf-worker` (fila de PDF) e
  `qa-pg16` (Postgres efêmero de teste de integração, porta 5433).
- O Site-PMPA usa `pmpa-postgres`, `pmpa-backend` (Strapi), `pmpa-frontend` (Vite) e `pmpa-db-admin`
  (Adminer).

## 3. Imagens removidas

Só imagens **dangling** (`<none>`, sem tag) e cada uma verificada individualmente com
`docker ps -a --filter ancestor=<id>` antes da remoção — todas sem container referenciando.

| Imagem (id)    | Containers referenciando |
| -------------- | ------------------------ |
| `d1d987858b81` | nenhum                   |
| `cb646223c82b` | nenhum                   |
| `bb11cfd1b112` | nenhum                   |
| `822c33a5eec6` | nenhum                   |
| `9d660e826408` | nenhum                   |
| `e82241562039` | nenhum                   |

Comando: `docker image rm <ids>` (remoção nominal, **sem** `-f`, **sem** `image prune -a`).

Além disso: `docker builder prune -f` — 52 entradas de cache de build, **0 ativas**. Impacto avaliado
antes: o próximo build fica mais lento, nenhum dado é perdido. (Não foi usado `-a`, que é proibido.)

Nenhuma imagem com tag foi removida. As 21 restantes seguem todas referenciadas por algum container
ou por um dos dois projetos essenciais:

`gotenberg/gotenberg:8` (1,69 GB) · `site-pmpa-strapi-backend` (1,62 GB) · `sst-pdf-worker:lote2`
(1,49 GB) · 10 imagens `public.ecr.aws/supabase/*` · `node:20` · `postgres:16` ·
`postgres:16-alpine` · `site-pmpa-vite-frontend` · `node:20-alpine` · `adminer`.

## 4. Containers

**Nenhum container foi removido. Nenhum serviço em execução foi interrompido.**

| Container                                  | Imagem                     | Estado            | Projeto                   | Ação                                                      |
| ------------------------------------------ | -------------------------- | ----------------- | ------------------------- | --------------------------------------------------------- |
| `pmpa-frontend`                            | site-pmpa-vite-frontend    | Up (3000)         | Site-PMPA                 | preservado, rodando                                       |
| `pmpa-backend`                             | site-pmpa-strapi-backend   | Up (1337)         | Site-PMPA                 | preservado, rodando                                       |
| `pmpa-postgres`                            | postgres:16-alpine         | Up healthy (5432) | Site-PMPA                 | preservado, rodando                                       |
| `pmpa-db-admin`                            | adminer                    | Up (8088)         | Site-PMPA                 | preservado, rodando                                       |
| `sst-gotenberg`                            | gotenberg/gotenberg:8      | Exited (0)        | PGR                       | preservado parado; testado e devolvido ao estado anterior |
| `sst-pdf-worker`                           | sst-pdf-worker:lote2       | Exited (0)        | PGR                       | preservado parado (config intacta, 23 envs)               |
| `qa-pg16`                                  | postgres:16                | Exited (255)      | PGR (teste de integração) | preservado parado                                         |
| 12 × `supabase_*_boteco-do-farias-60-anos` | public.ecr.aws/supabase/\* | Exited            | terceiro projeto          | **intocados — aguardando autorização**                    |

Os 15 containers parados somam 283,6 MB recuperáveis. Removê-los é reversível em termos de
funcionalidade (o `docker compose up` / `supabase start` recria), mas 12 deles são de um projeto fora
do escopo autorizado, então ficaram como estão.

## 5. Volumes

**Nenhum volume foi removido.** Regra do usuário: mesmo volume aparentemente descartável exige
confirmação explícita.

47 volumes, 6,246 GB, dos quais 5,057 GB sem link algum.

Volumes **com** link (preservar obrigatoriamente):

| Volume                                           | Tamanho                        | Dono                            |
| ------------------------------------------------ | ------------------------------ | ------------------------------- |
| `site-pmpa_postgres_data`                        | 74,02 MB                       | **Site-PMPA — banco do Strapi** |
| `supabase_db_boteco-do-farias-60-anos`           | 101 MB                         | terceiro projeto                |
| `supabase_storage_boteco-do-farias-60-anos`      | 0 B                            | terceiro projeto                |
| `supabase_edge_runtime_boteco-do-farias-60-anos` | 44,12 MB                       | terceiro projeto                |
| 3 volumes anônimos (`d7a0…`, `1986…`, `7f61…`)   | 757,8 MB / 212,3 MB / 212,3 MB | containers existentes           |

Os uploads do Strapi **não** estão em volume: são bind mounts em `./strapi-cms/public/uploads`,
`src`, `config` e `database` — ficam no disco do projeto, fora do alcance de qualquer comando Docker
de limpeza. Nada de uploads foi tocado.

Volumes nomeados **sem** link, de origem antiga/desconhecida (candidatos, **pendentes de autorização**):

| Volume                                       | Tamanho  | Observação                                            |
| -------------------------------------------- | -------- | ----------------------------------------------------- |
| `minikube`                                   | 970,1 MB | cluster Kubernetes local, nenhum projeto auditado usa |
| `elastic-logs-lab_esdata`                    | 2,887 MB | laboratório de Elastic                                |
| `fullstackweekend-aparatus-v2_postgres_data` | 48,42 MB | **contém banco Postgres — pode ter dado único**       |
| `supabase_edge_runtime_`                     | 40,24 MB | sufixo vazio, provável resíduo de stack renomeada     |

Mais 39 volumes anônimos, 36 deles sem link, somando ~4,0 GB (maiores: 674,6 MB, 315,1 MB, 315 MB,
314,8 MB, 226,1 MB). São camadas de dados de containers já descartados — tipicamente `PGDATA` e
`node_modules` de stacks antigas. Não há como atribuí-los a um projeto pelo nome; por isso nenhum foi
removido.

## 6. Depois

### 6.1 Disco

| TYPE          | TOTAL       | ACTIVE | SIZE                    | RECLAIMABLE    |
| ------------- | ----------- | ------ | ----------------------- | -------------- |
| Images        | **21** (−6) | 19     | **12,68 GB** (−1,67 GB) | 3,172 GB (25%) |
| Containers    | 19          | 4      | 306,5 MB                | 283,6 MB       |
| Local Volumes | 47          | 6      | 6,246 GB                | 5,057 GB       |
| Build Cache   | **9**       | 0      | **0 B** (−1,766 GB)     | 0 B            |

Imagens dangling restantes: **0**.
**Espaço efetivamente liberado: ≈ 3,44 GB** (1,67 GB de imagens + 1,766 GB de cache de build).

### 6.2 Memória

| Item                     | Antes            | Depois           |
| ------------------------ | ---------------- | ---------------- |
| RAM em uso               | 21,22 GB (89,2%) | 21,45 GB (90,2%) |
| `vmmemWSL`               | 4.127 MB         | 4.326 MB         |
| Docker Desktop (Windows) | 406 MB           | 405 MB           |
| Soma dos containers      | 1,131 GiB        | 1,106 GiB        |

Containers depois da limpeza: `pmpa-backend` 954,8 MiB · `pmpa-frontend` 119,2 MiB ·
`pmpa-postgres` 46,59 MiB · `pmpa-db-admin` 11,52 MiB.

Medição adicional **após intervalo de estabilização** (ao final de toda a sessão, com o dev server do
PGR e o trabalho de navegador já encerrados):

| Item                | Valor estabilizado                                                                 |
| ------------------- | ---------------------------------------------------------------------------------- |
| RAM em uso          | **19,84 GB (83,4%)**                                                               |
| `vmmemWSL`          | **4.314 MB**                                                                       |
| Soma dos containers | 1,336 GiB (`pmpa-backend` subiu para 1,182 GiB sozinho, por uso próprio do Strapi) |

Leitura honesta desses números: a RAM total caiu de 21,45 GB para 19,84 GB, mas **não por causa da
limpeza do Docker** — caiu porque o dev server do PGR e o trabalho de navegador da auditoria foram
encerrados. O `vmmemWSL` ficou praticamente igual (4.326 → 4.314 MB), e o `pmpa-backend` até cresceu
por conta própria.

**A limpeza de disco não reduziu RAM — e não era esperado que reduzisse.** Imagens e cache de build
ocupam disco dentro do VHDX, não memória. A oscilação de ~200 MB no `vmmemWSL` é page cache normal.
Para efetivamente reduzir memória existem só dois caminhos, ambos descritos na seção 7 e **ambos
dependentes de autorização**.

### 6.3 Serviços essenciais — smoke test

Todos não destrutivos; o único container iniciado foi devolvido ao estado anterior.

| Verificação                                    | Resultado                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Site-PMPA frontend `http://localhost:3000/`    | **HTTP 200** (Vite dev server respondendo)                                                                                            |
| Site-PMPA Strapi `http://localhost:1337/`      | **HTTP 302** (redireciona para `/admin`, esperado)                                                                                    |
| Site-PMPA Strapi `http://localhost:1337/admin` | **HTTP 200**                                                                                                                          |
| Adminer `http://localhost:8088/`               | **HTTP 200**                                                                                                                          |
| `pmpa-postgres` `pg_isready`                   | **accepting connections**                                                                                                             |
| PGR — banco (pooler remoto, porta 6543)        | **conexão OK**, role `app_runtime`, PostgreSQL 17.6, 61 tabelas em `public`                                                           |
| PGR — RLS ativo                                | `select count(*) from orgs` sem `app.current_org` → **0 linhas** (backstop funcionando)                                               |
| PGR — migrations no disco                      | 52 entradas no journal, última `0051_ergonomic_evaluations`                                                                           |
| PGR — Gotenberg                                | `docker start` → `GET :3010/health` **HTTP 200** (`chromium: up`, `libreoffice: up`) → `docker stop` (estado anterior restaurado)     |
| PGR — worker de PDF                            | imagem `sst-pdf-worker:lote2` presente (1,49 GB), config intacta (`restart=unless-stopped`, 23 envs). Não iniciado: sobe sob demanda. |

Nenhum teste tocou banco de produção, nenhuma migration foi executada.

### 6.4 Conflito de porta detectado

`pmpa-frontend` publica **0.0.0.0:3000**, exatamente a porta default do `npm run dev` do PGR. Com o
Site-PMPA no ar, o dev server do PGR não consegue subir em 3000. Workaround sem mexer em arquivo
versionado: `npm run dev -- -p 3001` (ou parar o `pmpa-frontend` enquanto se trabalha no PGR).
Nenhuma alteração foi feita no `docker-compose.yml` do Site-PMPA nem no `package.json` do PGR.

## 7. Configuração recomendada (NÃO aplicada — pendente de autorização)

`%USERPROFILE%\.wslconfig` não existe. A WSL 2.4.11.0 instalada suporta `autoMemoryReclaim` e
`sparseVhd`. Proposta dimensionada para os 23,79 GB físicos desta máquina (não um teto arbitrário de
2 ou 4 GB):

```ini
[wsl2]
memory=8GB
processors=4
autoMemoryReclaim=gradual
sparseVhd=true
```

Justificativa de cada linha:

- `memory=8GB` — os containers somam 1,13 GiB em regime; 8 GB dão folga larga para builds do Strapi e
  para o Postgres efêmero de integração, e devolvem ~3,6 GB do teto atual (11,58 GiB) ao Windows.
  Não é um limite arbitrário: é ~1/3 da RAM física, 7× o consumo real medido.
- `autoMemoryReclaim=gradual` — faz a WSL devolver page cache ocioso ao Windows. É o item que de fato
  ataca o `vmmemWSL` de 4,3 GB.
- `processors=4` — opcional; reduz o overhead de vCPU sem afetar os serviços medidos.
- `sparseVhd=true` — faz o VHDX encolher. Hoje são **42,89 GB em disco para ~19 GB de conteúdo**;
  este é de longe o maior ganho disponível (~20 GB), e nenhum dado é perdido.

**Para aplicar é obrigatório um `wsl --shutdown`**, que derruba Docker Desktop e os 4 containers do
Site-PMPA. O usuário proibiu executar `wsl --shutdown` automaticamente, então a configuração **não foi
escrita nem aplicada**. Depois do shutdown, basta subir o Docker Desktop e `docker compose up -d` no
Site-PMPA — os volumes e bind mounts são preservados.

## 8. Resultado

**Executado (seguro, reversível, autorizado):**

- 6 imagens dangling removidas após verificação individual de referência. Imagens 27 → 21.
- Cache de build (52 entradas, 0 ativas) limpo com `builder prune -f`. 1,766 GB → 0 B.
- **≈ 3,44 GB de disco liberados.**
- Smoke test completo dos dois projetos essenciais: **tudo operacional**.
- Zero volumes removidos · zero containers removidos · zero serviços interrompidos · zero arquivos de
  projeto alterados · nenhum recurso do terceiro projeto tocado.

**Diagnóstico de memória:** o Docker responde por 4,3 GB dos 21,45 GB em uso, dos quais apenas
1,1 GiB são containers. Opera (6,9 GB), a IDE Antigravity (2,2 GB) e os 13 servidores MCP (1,1 GB)
somados pesam mais que o dobro da VM do Docker. Limpar imagens não muda isso — por construção.

**Pendente da sua autorização explícita (em ordem de impacto):**

| #   | Ação                                                                    | Ganho                                                                                    | Risco                                                                         |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Criar o `.wslconfig` proposto + `wsl --shutdown`                        | ~20 GB de disco (VHDX sparse) e teto de RAM 11,58 → 8 GB, com devolução gradual de cache | derruba Docker e os 4 containers do Site-PMPA por ~1 min; volumes preservados |
| 2   | Parar os 4 containers do Site-PMPA quando não estiver usando o site     | até 1,13 GiB de RAM                                                                      | o site local sai do ar até `compose up -d`                                    |
| 3   | Remover os 36 volumes anônimos órfãos                                   | ~4,0 GB                                                                                  | **irreversível**; podem conter `PGDATA` de stacks antigas                     |
| 4   | Remover `minikube`, `elastic-logs-lab_esdata`, `supabase_edge_runtime_` | ~1,01 GB                                                                                 | **irreversível**; nenhum projeto auditado usa                                 |
| 5   | Remover `fullstackweekend-aparatus-v2_postgres_data`                    | 48 MB                                                                                    | **irreversível e contém banco** — recomendo manter                            |
| 6   | Remover os 12 containers parados do boteco-do-farias                    | 283,6 MB                                                                                 | projeto de terceiro; `supabase start` recria                                  |
| 7   | Remover `node:20` / `node:20-alpine` se nenhum build os usar            | a confirmar                                                                              | próximo build baixa de novo                                                   |

Recomendação: aprovar **1** (maior ganho, totalmente reversível) e **2**; tratar **3** a **5** como
decisão separada, já que são irreversíveis.
