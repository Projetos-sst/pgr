# PGR-e

Plataforma multiempresa de Segurança e Medicina do Trabalho (Next.js 16 App Router + Clerk).

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencher chaves do Clerk
npm run dev                  # http://localhost:3000
```

Além das chaves do Clerk/Supabase, o `.env.local` precisa de `EPI_SIGN_TOKEN_SECRET`
(segredo do token HMAC da assinatura pública de entrega de EPI — qualquer string longa
aleatória, ex.: `openssl rand -hex 32`).

Comandos úteis: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`.

### Geração de PDF (Gotenberg)

A geração de documentos (ex.: PDF do PGR) usa o [Gotenberg](https://gotenberg.dev), um serviço
stateless de conversão HTML→PDF, consumido por `src/shared/integrations/pdf/gotenberg.ts`. Suba o
container local com Docker:

```bash
docker compose up -d gotenberg      # sobe o Gotenberg em http://localhost:3001
docker compose logs -f gotenberg    # acompanhar
docker compose down                 # derrubar
```

### Worker de PDF (fila `jobs`)

O botão **"Arquivar no GED"** (etapa _Documentos e PDF_ do editor de PGR) não gera o arquivo na
hora: ele enfileira um job `pdf_batch` e responde na mesma hora. Quem renderiza e marca o
documento como `ready` é o worker — **sem ele o documento fica preso em `generating`**. O
download síncrono ("Baixar agora") não depende do worker, só do Gotenberg.

```bash
docker compose up -d --build worker   # worker + gotenberg (depends_on healthy)
docker compose logs -f worker         # {"level":"info","worker":"pdf_batch","msg":"started"}
```

Os dois serviços vivem no mesmo `docker-compose.yml` e sobem juntos com `docker compose up -d` —
uma máquina só no deploy. O worker lê os segredos do `.env.local` (`DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `SUPABASE_*`) e fala com o Gotenberg pela rede interna do compose
(`http://gotenberg:3000`, não a porta 3001 do host).

No `.env.local`, aponte o app para o container (a variável ausente **desabilita** a geração —
`isPdfGenerationEnabled()` fica `false` — sem quebrar o resto):

```bash
GOTENBERG_URL=http://localhost:3001
# GOTENBERG_TOKEN=           # opcional; vazio em dev (sem auth). Em prod, token/gateway.
```

Validação ponta a ponta (opcional, roda **só** com o serviço no ar):

```bash
docker compose up -d gotenberg
GOTENBERG_URL=http://localhost:3001 npm run test:integration -- pdf/gotenberg
```

Em produção, hospeda-se o **mesmo** container em rede privada (Railway/Render/Fly.io) atrás de
token/gateway; só a aplicação o chama (Constituição, Princípio II / emenda 1.4.0).

## Documentação da fatia atual

- Plano e contratos: [`specs/001-clerk-auth/plan.md`](specs/001-clerk-auth/plan.md)
- Quickstart (setup Clerk Dashboard + smoke test): [`specs/001-clerk-auth/quickstart.md`](specs/001-clerk-auth/quickstart.md)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
