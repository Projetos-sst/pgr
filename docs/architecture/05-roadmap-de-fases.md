# 05 — Roadmap de Fases (45 dias)

Plano de entrega das fatias verticais, mapeado ao prazo de 45 dias do
`Projeto.md`. Cada fatia é entregue ponta a ponta — banco + Server Actions +
queries + UI — conforme o Princípio III da constituição.

> **O prazo é agressivo.** Esta sequência **só fecha** se o escopo permanecer
> exatamente o definido, sem expansão de features durante o desenvolvimento
> (`Projeto.md`). Cada fase passa pelo ciclo Spec Kit completo.

## Sequenciamento e dependências

A ordem é ditada pelas dependências de dados. `employees` é referenciado por
quase todos os módulos → vem cedo. PGR é o mais complexo → recebe a maior
janela. Documentos/PDF é transversal → vem depois que há conteúdo para gerar.

```
Fase 0 ─▶ Fase 1 ─┬─▶ Fase 2 (EPIs)
(fundação) (func.) ├─▶ Fase 3 (PGR)
                   ├─▶ Fase 4 (Treinamentos)
                   └─▶ Fase 6 (OS + Acidentes)

Fase 3, 4 ─────────▶ Fase 5 (Documentos + PDF)
Fase 1..6 ─────────▶ Fase 7 (Dashboards + hardening)
```

## Fases

### Fase 0 — Fundação · dias 1–5

A espinha dorsal. Nenhum módulo de negócio começa antes disto.

- Integração do Clerk (`ClerkProvider`, `proxy.ts`, telas de auth, tratamento de
  usuário sem organização).
- Setup do Supabase + Drizzle: conexão pooled, papel restrito para RLS,
  `drizzle.config.ts`, primeira migration.
- Helpers de tenant: `requireOrg()`, `getOrgContext()`, `withOrg()` (docs 02/03).
- Convenção de RLS aplicada (policy padrão + `SET LOCAL`).
- Shell da área `(app)`: layout, sidebar, header, `<OrganizationSwitcher />`.
- Primitivos de UI em `components/ui/`.
- Gates de qualidade verdes: `npm run lint` + checagem de tipos.

**Entregável**: usuário faz login, escolhe organização e vê o shell vazio.
**Saída técnica**: estrutura dos docs 01–03 no lugar.

### Fase 1 — Funcionários + Setores/Cargos · dias 6–12

Entidade base referenciada por EPIs, treinamentos, acidentes e medidas de
controle.

- Tabelas `sectors`, `job_roles`, `employees` + RLS.
- CRUD completo de funcionários; cadastro de setores e cargos.
- Validação de CPF; `UNIQUE(organization_id, cpf)`.

**Entregável**: cadastrar, listar, editar e excluir funcionários.

### Fase 2 — EPIs · dias 13–19

Depende de Funcionários.

- Tabelas `epi_catalog`, `epi_deliveries` + RLS.
- CRUD do catálogo de EPIs.
- Registro de entrega/devolução vinculado a funcionário.

**Entregável**: gerir catálogo e registrar entregas de EPI.

### Fase 3 — PGR / Gestão de Riscos · dias 20–27

O módulo mais complexo — maior janela. Depende de Setores.

- Tabelas `pgr_documents`, `risks`, `risk_assessments`, `control_measures` + RLS.
- CRUD do documento de PGR e dos riscos.
- Avaliação de risco (probabilidade × severidade, `risk_level` persistido).
- Plano de ação (medidas de controle) com responsável e prazo.

**Entregável**: montar um PGR com riscos avaliados e plano de ação.
**Atenção**: candidato a estourar prazo — ver Riscos abaixo.

### Fase 4 — Treinamentos · dias 28–33

Depende de Funcionários.

- Tabelas `training_catalog`, `training_records` + RLS.
- CRUD do catálogo de treinamentos (NR, carga horária, validade).
- Registro de treinamento por funcionário, com `expires_at` calculado.

**Entregável**: gerir treinamentos e registrar realizações com validade.

### Fase 5 — Documentos + Geração de PDF · dias 34–38

Transversal. Vem depois de PGR e Treinamentos (já há conteúdo a documentar).

- **Pré-requisito de governança**: emenda à constituição registrando a adoção
  do Gotenberg (ver doc 04) — feita antes de começar a fase.
- Tabela `documents` + `jobs` + RLS.
- Repositório de documentos: upload, listagem, URL assinada, validade.
- Deploy do container Gotenberg; `lib/pdf.ts`.
- Pipeline de PDF: documento único via `after()`; lote via `jobs` + Vercel Cron.
- Primeiro template de PDF (ex.: documento do PGR).

**Entregável**: anexar documentos e gerar PDFs (síncrono e em lote).

### Fase 6 — Ordens de Serviço + Acidentes · dias 39–42

Módulos de workflow. Dependem de Funcionários.

- Tabelas `service_orders`, `service_order_items`, `accidents` + RLS.
- CRUD de OS com itens (escrita transacional — exemplo ACID do doc 02) e estados.
- Registro de acidentes com dados de CAT e investigação.

**Entregável**: abrir e acompanhar OS; registrar acidentes.

### Fase 7 — Dashboards + Hardening · dias 43–45

Fechamento.

- Queries de agregação em `features/dashboard/queries.ts`; telas de dashboard.
- **Teste de isolamento multi-tenant** — caminho crítico (constituição manda
  priorizar teste aqui): garantir que nenhum dado cruza organizações.
- Revisão de performance: índices, queries N+1, cache.
- Revisão de segurança: validação em todas as actions, segredos, RLS ativo em
  todas as tabelas.
- Deploy final e _smoke test_ em produção.

**Entregável**: produto navegável, com dashboards, pronto para validação.

## Resumo

| Fase | Dias | Módulo | Depende de |
|---|---|---|---|
| 0 | 1–5 | Fundação | — |
| 1 | 6–12 | Funcionários, Setores, Cargos | Fase 0 |
| 2 | 13–19 | EPIs | Fase 1 |
| 3 | 20–27 | PGR / Riscos | Fase 1 |
| 4 | 28–33 | Treinamentos | Fase 1 |
| 5 | 34–38 | Documentos + PDF | Fases 3, 4 |
| 6 | 39–42 | Ordens de Serviço + Acidentes | Fase 1 |
| 7 | 43–45 | Dashboards + Hardening | Fases 1–6 |

## Riscos e trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| **Prazo de 45 dias sem folga** | Atraso em cascata | Escopo congelado; P1 de cada fase funcional antes de avançar; cortar para o P1 se uma fase atrasar |
| **PGR estourar a janela (Fase 3)** | Empurra Fases 4–7 | Entregar PGR em P1 (CRUD + avaliação) e deixar refinamentos para depois; é a fase de maior incerteza |
| **Modelagem de dados errada cedo** | Retrabalho caro | Migrations versionadas; revisar o `data-model.md` de cada fatia contra o doc 02 |
| **Vazamento entre tenants** | Falha crítica de SaaS B2B | Dupla barreira (aplicação + RLS); teste de isolamento na Fase 7 — idealmente antecipado |
| **Dependência do Gotenberg** | PDF indisponível | Serviço stateless e substituível; geração em lote assíncrona com `attempts`/retry |
| **Cold start / limites serverless** | Timeout em operação pesada | Princípio IV: nada pesado roda síncrono; PDF fora da Vercel |
| **Sem test runner configurado** | Regressões silenciosas | Constituição: testar caminhos críticos (isolamento, regras de negócio); configurar runner mínimo se a Fase 7 permitir |

## Melhorias futuras (pós-validação — fora do MVP)

Aplicar **YAGNI**: nada abaixo entra no MVP. São evoluções a considerar **só
depois** que o produto validar no mercado.

- **Fila dedicada** (ex.: QStash) substituindo `jobs` + Cron, com _backoff_ e
  retries robustos — quando o volume de geração crescer.
- **Soft-delete e auditoria completa** (`deleted_at`, trilha de alterações) — se
  o peso regulatório do domínio exigir histórico imutável.
- **Test runner + cobertura** dos caminhos críticos além do isolamento.
- **Observabilidade**: logs estruturados, métricas, alertas.
- **Notificações** (vencimento de EPI, treinamento, validade de documento) —
  outra operação assíncrona natural.
- **Cache mais agressivo** de leituras e relatórios de dashboard.
- **Exportações em massa** e relatórios extensos (assíncronos, via `jobs`).
- **Migração parcial para infraestrutura mais robusta** (workers, AWS) — só se a
  escala ultrapassar o modelo serverless atual, conforme previsto no `Projeto.md`.

Cada um desses itens, ao ser adotado, passa pelo fluxo Spec Kit — e os que tocam
infraestrutura exigem emenda à constituição (Princípio II).
