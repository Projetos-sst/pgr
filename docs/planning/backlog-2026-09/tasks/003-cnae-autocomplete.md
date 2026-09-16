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

### Fonte externa (verificada em 2026-09-16)

- IBGE `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses` → 200, 1.332 subclasses, sem credencial. Não busca por texto.
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

Espelho vs. arquivo; formato do código; CNAEs secundários (ver REQUIREMENTS-GAPS).

### Dificuldade

3/5 — integração nova de ponta a ponta com componente inédito, mas fonte pública estável e padrão CAEPI para copiar.

### Prontidão

READY COM PREMISSAS

### Cobertura atual

25% — autofill via CNPJ e fallback manual existem; busca livre não.

### Lote recomendado

4

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
