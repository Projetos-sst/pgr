# #3 — [Empresas] Integração automática de CNAE

https://github.com/Projetos-sst/pgr/issues/3

### Objetivo

Buscar CNAE por código **ou** descrição no cadastro de Empresas, preenchendo ambos; falha da integração
não bloqueia digitação manual.

### Estado atual no código

- CNPJ lookup já preenche CNAE e atividade principal: `src/app/(protected)/companies/_components/company-form.tsx:136-153` (via BrasilAPI `/api/cnpj/v1`, `src/shared/integrations/providers/brasilapi.ts:7,31,48-49`).
- Campos são `TextField` livres (`company-form.tsx:242-256`); colunas `companies.cnae` e `main_activity` texto (`schema/companies.ts:36-37`). Código salvo cru (`4712100`).
- Falha de lookup já não bloqueia (`use-lookup.ts:23-26,64-69`) → critério 2 já atendido.

### O que já existe

Autofill via CNPJ; padrão de espelho global + sync (`caepi_certificates`, `scripts/caepi-sync.ts`, rota `api/integrations/caepi/[ca]`).

### O que falta

Fonte de dados CNAE consultável por texto, endpoint de busca, componente de autocomplete (não existe
nenhum no projeto — só `<datalist>` estático em `_ui/form.tsx:221-251`).

### Fonte externa (reverificada em 2026-09-27 — Lote 4)

- IBGE `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses` → **200**, **1.332** subclasses,
  3,6 MB, ~2,2 s, sem credencial. `?descricao=` é **ignorado** (devolve a lista inteira) → **não há
  busca textual**, que é o argumento decisivo para o espelho local.
- IBGE `.../subclasses/{id}` → 200 (consulta por código exato). `id` = **7 dígitos** (`4929902`).
- BrasilAPI `/api/cnae/v1/{id}` → **404**. O comentário da issue que sugere esse endpoint está incorreto.

### Arquivos/domínios provavelmente afetados

`schema/` (tabela global nova), `scripts/cnae-sync.ts`, `repositories/cnae.ts`, `app/api/integrations/cnae/`, `_ui/` (combobox), `company-form.tsx`.

### Backend

Espelho local + busca `ilike`/prefixo por código; leitura sem `withOrg` (dado público, como CAEPI).

### Frontend

Combobox com debounce no campo CNAE, preenchendo código e atividade principal.

### Migration

PROVÁVEL — tabela global sem `org_id`, policy de leitura global. Nenhuma se a decisão for JSON versionado.

### Testes necessários

Unit (normalização/busca), integração (busca, base vazia → fallback manual), componente.

### Dependências

Componente compartilhado com #10.

### Riscos

Nenhum dado sensível. Base desatualizada se não houver sync (CNAE muda raramente).

### Requisitos faltantes

**Nenhum.** Decidido na auditoria do Lote 4: espelho local em tabela **global**
(`cnae_subclasses`, padrão `caepi_certificates`); código persistido com **7 dígitos** sem máscara e
exibido `4929-9/02`; **só o CNAE principal** (o modelo tem um campo, e a issue fala dele).

### Dificuldade

3/5 — integração nova de ponta a ponta com componente inédito, mas fonte pública estável e padrão CAEPI para copiar.

### Prontidão

**READY** — as três dúvidas antigas foram fechadas tecnicamente na auditoria do Lote 4
([../lots/lot-04/AUDIT.md](../lots/lot-04/AUDIT.md)).

### Cobertura atual

25% — autofill via CNPJ e fallback manual existem; busca livre não.

### Lote recomendado

4

## Execução

### Auditoria do Lote 4 (27/09/2026)

Detalhe em [../lots/lot-04/AUDIT.md](../lots/lot-04/AUDIT.md); plano em
[../lots/lot-04/PLAN.md](../lots/lot-04/PLAN.md).

- Fonte do IBGE reverificada: entrega a lista completa, **não** busca por texto → espelho local.
- Arquitetura: tabela **global** `cnae_subclasses` + `scripts/cnae-sync.ts`, molde CAEPI.
- Dados reais no dev estão **mistos** (`6821801`, `423520`, `42000-00`) → **sem** validação dura e
  **sem** migração de dados; o campo continua `optionalString`.
- Cria o `CatalogCombobox` compartilhado (não existe autocomplete no projeto).
- Migration: **SIM** (1 tabela global). Nenhuma criada ainda.

## Execução

| Branch                    | PR  | Migration | Testes | CI  | Decisão       | Status  |
| ------------------------- | --- | --------- | ------ | --- | ------------- | ------- |
| `feature/lot-04-cnae-cbo` | —   | prevista  | —      | —   | sem pendência | Backlog |
