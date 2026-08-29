# 029 — Correções da Avaliação do e-PGR (lote 2)

Spec enxuta (mesma decisão de 024-028: sem cerimônia completa de spec-kit). Continuação do lote
`.specs/028-correcoes-avaliacao-epgr/spec.md` (PR #63, branch `fix/correcoes-avaliacao-epgr`) —
este lote pega o que ficou "fora de escopo" ou não endereçado lá e mata o máximo de issues
possível ainda hoje, priorizando as que não exigem decisão de arquitetura nova.

## Método

Execução via subagent-driven-development enxuto (mesmo padrão do lote 028): cada grupo abaixo =
1 subagent, 1 commit próprio, revisado pelo orquestrador antes de commitar. Grupos são desenhados
para não tocarem os mesmos arquivos entre si (paralelizável com segurança). Grupo 1 (schema) roda
primeiro e bloqueia os demais, porque eles dependem das colunas novas existirem.

## Escopo (issues incluídas neste lote)

**Grupo 1 — schema + migration única (bloqueante, roda primeiro):**

- #5 — `companies.website` (text, URL validada no Zod).
- #7, #8 — `work_units.managerName`, `managerRole`, `professionalTitle`, `professionalRegistration`
  (todas opcionais).
- #24 — `epi_catalog.replacementDate` (date, opcional).
- #27 — `epi_catalog.createdBy` (text, opcional — id do usuário Clerk da sessão).
- #23 — `stock_movements.batch` (text, opcional — lote de rastreabilidade).
- #25 — tabela nova `epi_catalog_audit_log` (append-only: `id`, `org_id`, `epi_catalog_id` FK
  CASCADE, `changed_by`, `changed_at`, `summary` text) + RLS igual ao padrão de `tenant_probe`.

**Grupo 2 — Empresas** (`company-form.tsx`, `companies.ts` domínio/repo):

- #4 — corrigir upload do logo (hoje `TextField` puro) → upload real com preview, padrão de
  `document-upload-form.tsx:82-88`.
- #5 — campo de site/portal (usa coluna do Grupo 1), validação de URL no Zod, exibir na seção
  "Contato & marca".
- #3 — **não implementar código**: postar comentário técnico na issue avaliando CNAE/Concla (mesmo
  padrão do #44 no lote 028) — BrasilAPI já autopreenche `cnae_fiscal`/`cnae_fiscal_descricao` via
  CNPJ; autocomplete por busca livre de CNAE exigiria integração nova sem padrão pronto no projeto.

**Grupo 3 — Unidades de Obra** (`work-unit-form.tsx`, `work-units.ts` domínio/repo):

- #7 — campos `managerName`/`managerRole` (gestor/preposto).
- #8 — campos `professionalTitle`/`professionalRegistration` (formação profissional do responsável).

**Grupo 4 — GES** (`ges-form.tsx`, `ges.ts` schema/domínio):

- #12 — `ceilingHeight` aceitar vírgula E ponto decimal (`z.coerce` com normalização
  `,`→`.` antes do parse) + opção "Não aplicável".
- #13 — campo `roof` (Cobertura) definido como `SelectField` com 3 opções fechadas: **sem
  cobertura / cobertura parcial / cobertura total** (decisão de produto tomada aqui — mais
  compatível com o uso em avaliação de exposição do que % numérico livre) + texto de ajuda.
- #15 — mensagens de validação Zod específicas por campo do formulário de GES (não genérico "Dados
  inválidos").

**Grupo 5 — Funcionários** (`employee-form.tsx`, `employees.ts` domínio):

- #16 — trocar `TextField` de foto por upload real com preview (mesmo padrão do Grupo 2/#4).

**Grupo 6 — EPI Catálogo** (`epi-catalog-form.tsx`, `epi-catalog.ts` domínio/repo, `register-entry.tsx`):

- #21 — corrigir `SelectField` "Categoria" (hoje trava `disabled` em lista vazia sem feedback) →
  mostrar erro + CTA para `/categories/new?type=...`.
- #24 — campo "Data de substituição" (usa coluna do Grupo 1).
- #27 — `createdBy` preenchido a partir da sessão (nunca de input do cliente) nas actions de
  `epi-catalog.ts`; exibir "cadastrado/atualizado por" no detalhe.
- #23 — campo "Lote" no registro de entrada de estoque (`register-entry.tsx`, usa coluna do Grupo 1).
- #25 — histórico de alterações do item: gravar `epi_catalog_audit_log` a cada create/update
  (resumo do diff) + aba "Histórico" no detalhe do item.
- #30 — trocar `TextField` de foto por upload real (mesmo padrão do Grupo 2/#4).
- #33 — **não implementar código**: postar comentário técnico avaliando migrar `epi_deliveries`
  para a infra genérica de assinatura (fatia 010) — é migração de dado real (tokens/assinaturas já
  emitidos), recomendo fatia própria.

**Grupo 7 — PGR / Plano de Ação** (`pgr-basic-info-tab.tsx`, `pgr-documents-tab.tsx`,
`action-plan-origin.ts`, `server/actions/safety/action-plans.ts`, `control-measure.ts`):

- #36 — anexar ART ao Responsável Técnico: entidade `responsible_technician` já existe no enum
  `documentRelatedEntityTypeSchema` desde o lote 028 (#45) — falta só ligar a UI (seção de upload
  na aba de dados básicos do PGR, filtrando `relatedEntityType=responsible_technician`).
- #42 (parte que ficou pendente no lote 028) — usar a coluna `control_measures.status` (já existe,
  migration 0031, sem uso ainda): ao salvar uma medida vinculada a um risco `trivial`/`tolerável`,
  default `status=maintain`; risco `moderado+` exige `dueDate`+`responsible` preenchidos (bloqueio
  de validação, não só sugestão) e default `status=introduced`. Reaproveita a ponte
  `control_measure → action_plan` do #51 (já pronta) — não cria plano "placeholder" para risco
  trivial sem ação real, por decisão de produto já registrada no lote 028.

**Grupo 10 — CBO (comentário, sem código):**

- #10 — postar comentário técnico avaliando integração de CBO (mesmo racional do #3): não existe
  API pública gratuita e estável de CBO tão direta quanto BrasilAPI/ViaCEP; campo `cbo` já existe
  como texto livre, recomendo manter manual até achar uma fonte confiável.

## Fora de escopo (mantido para fatia própria depois)

- **#39, #40, #47, #48** — integrações NR-09/NR-17/NR-18 e estrutura completa do PDF do PGR: módulos
  novos de ponta a ponta (schema + domínio + UI + template de PDF), não cabem num lote de correções.
- **#52–#62** — épico de Qualidade/GED (11 issues interdependentes: perfis/RBAC, workflow de
  aprovação, auditoria, AD, e-mail). Recomendação do lote 028 mantida: vira spec própria
  (`.specs/03X-ged-workflow/`) quando entrar na fila — é do tamanho das fatias 023/026/027, não de
  um lote de correções.

## Critérios de aceite

- [ ] `npm run check` (lint + typecheck + testes unitários) passando após cada grupo.
- [ ] Migration do Grupo 1 segue o padrão de custom SQL do projeto (GRANT/policy só para a tabela
      nova `epi_catalog_audit_log`; colunas novas em tabelas existentes já cobertas por RLS).
- [ ] Grupos 2-7 fazem 1 commit próprio cada, só depois do Grupo 1 estar commitado.
- [ ] #3, #10, #33 recebem comentário técnico na issue (sem código) — não contam como "closed" no
      board, ficam como decisão registrada.
- [ ] Sem teste de integração real rodado neste ambiente (mesma ressalva do lote 028) — escritos
      seguindo o padrão do projeto; rodar `npm run test:integration` antes do merge do PR #63.

## Status de execução

(preenchido ao final de cada grupo)
