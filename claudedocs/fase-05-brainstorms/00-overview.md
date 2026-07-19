# Fase 05 — Documentos + Geração de PDF · Overview dos brainstorms

Mapeamento das issues da Fase 05 (2026-07-18), cruzado com o estado atual do repo
(Modelo B, `withOrg`/RLS, `officeAction`/`restHandler`, migrations até `0016`).
Cada issue tem um arquivo de brainstorm neste diretório, insumo para o futuro
prompt do `/speckit-specify` de cada fatia.

## Issues e arquivos

| Issue | Título                                           | Arquivo                            | Status                     |
| ----- | ------------------------------------------------ | ---------------------------------- | -------------------------- |
| #32   | 01 · Emenda à constituição — Gotenberg           | —                                  | ✅ fechada (gate liberado) |
| #33   | 02 · Modelo de dados — Documentos, Pastas e Jobs | `01-issue-33-modelo-de-dados.md`   | aberta                     |
| #36   | 03 · Deploy do serviço Gotenberg                 | `02-issue-36-deploy-gotenberg.md`  | aberta                     |
| #37   | 04 · Cliente de geração de PDF                   | `03-issue-37-cliente-pdf.md`       | aberta                     |
| #34   | 05 · CRUD de Documentos (GED)                    | `04-issue-34-crud-ged.md`          | aberta                     |
| #35   | 06 · Download via URL assinada                   | `05-issue-35-download-assinado.md` | aberta                     |
| #38   | 07 · PDF de documento único                      | `06-issue-38-pdf-unico.md`         | aberta                     |
| #39   | 08 · PDF em lote (jobs + Vercel Cron)            | `07-issue-39-pdf-lote.md`          | aberta                     |
| #40   | 09 · Template PDF do PGR                         | `08-issue-40-template-pgr.md`      | aberta                     |
| #88   | 10 · CRUD de Controle de Formulário (ISO)        | `09-issue-88-form-controls.md`     | aberta                     |

**Prompts prontos de `/speckit-specify` (um por fatia):** `10-specify-prompts.md`.

## Grafo de dependências

```
#32 emenda (✅)
└─ #33 modelo de dados ──┬─ #34 CRUD GED ── #35 download assinado
                         ├─ #39 lote (usa jobs)
#36 deploy Gotenberg ──── #37 cliente PDF ─┬─ #38 PDF único
#88 form_controls ─────────────────────────┴─ #40 template PGR
```

Dois trilhos paralelizáveis: **GED** (#33 → #34 → #35) e **PDF** (#36 → #37 → #38/#39),
convergindo em #40 (que também consome #88).

## Ordem de ataque sugerida

1. **#33** (modelo — destrava o trilho GED e a fila) + **#36** (infra, sem código) em paralelo
2. **#88** (independente, baixo risco) + **#37** (cliente, precisa do #36)
3. **#34** (a fatia grande) → **#35** (pequena, cola no GED)
4. **#38** (único) → **#39** (lote — a mais arriscada operacionalmente)
5. **#40** por último (consome #37 + #88 + dados da Fase 03)

## ⚠️ Aviso transversal — issues desatualizadas (era "Modelo A")

As issues #33, #35, #36, #37, #38 e #39 citam coisas que não existem mais:
`lib/db/schema/*`, `lib/pdf.ts`, `lib/storage.ts`, `organization_id`, `features/*`
e "testes de integração com SQLite em memória". Padrão vigente:

- Schema: `src/shared/db/schema/*` · `org_id text NOT NULL → orgs.id` ·
  `pgPolicy(...).enableRLS()` (template `companies.ts`)
- Código: `src/shared/**` (repositories, actions, domains) + `src/app/**`
- Testes de integração: **Postgres efêmero** (`INTEGRATION_*`) — nunca SQLite
- CRUD exige as **4 superfícies**: Server Action + espelho REST `/api/v1/**` +
  `docs/api/api-design.md` + Postman

As issues #34 e #88 já estão no Modelo B.

## As 5 decisões a resolver antes de abrir qualquer branch

1. **Versionamento de documento** (#33): 1 linha por versão vs. tabela de versões.
2. **Leitura cross-tenant da fila pelo cron** (#39): claim administrativo + `withOrg(job.org_id)` por job.
3. **Estratégia de upload** (#34): body da Server Action (limite default 1MB!) vs. signed upload URL.
4. **Configuração do documento PGR** (#40): persistida (`pgr_document_settings`) vs. efêmera.
5. **Auth real do Gotenberg** (#36): basic auth nativa (não existe "token" nativo).
