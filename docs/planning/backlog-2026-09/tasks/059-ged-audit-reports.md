# #59 — [Qualidade/GED] Auditoria e relatórios de conformidade

https://github.com/Projetos-sst/pgr/issues/59

### Objetivo

Relatório exportável de auditoria do GED (criação, edição, aprovação, acesso, descarte) filtrável por
período/setor/ação; alerta de revisão obrigatória vencida ou a vencer.

### Estado atual no código

- **Documentos não têm trilha persistida.** `logTenantEvent` só escreve JSON no console (`shared/tenant/audit-log.ts:13-20`); `auditedTenantWrite` loga falhas (`repositories/audited-write.ts:5-20`); `officeAction` com `audit: true` loga **também sucessos** no console (`server/office-action.ts:27-34`) — a issue diz "só falhas", impreciso.
- **Existe precedente de trilha persistida:** `epi_catalog_audit_log` (migration 0032; `schema/epis.ts:306-345`; `repositories/epi-catalog-audit.ts`) com org_id, entidade, changed_by, changed_at, summary.
- Validade derivada: `classifyDocumentValidity` (`domains/documents/validity.ts:16-24`), janela 30 dias; alimenta filtro, KPIs e badge. Nenhum alerta ativo; notificações não têm categoria de documento (`domains/platform/notifications.ts`); `schedule_event_type.document_expiry` existe mas nada cria esses eventos.

### O que já existe

Padrão de audit log, classificação de validade, notificações derivadas in-app.

### O que falta

Tabela `document_audit_log`, gravação nas escritas/leituras do GED, relatório com filtros e export, categoria de notificação para revisão.

### Arquivos/domínios provavelmente afetados

Schema novo, repositório de auditoria, actions de documentos (registrar evento), rota de export, `notifications.ts`.

### Migration

SIM — tabela append-only com RLS.

### Testes necessários

Integração: cada ação grava evento; export filtra por período/ação; cross-tenant; notificação aparece para documento a vencer.

### Dependências

Alimenta #55 (acesso) e #57 (descarte). Filtro por setor depende de #58.

### Riscos

Volume de log se acesso/visualização entrar; gravar evento na mesma transação da escrita.

### Requisitos faltantes

CSV vs. PDF; leitura entra no log; `valid_until` vs. periodicidade de revisão; alerta in-app vs. e-mail.

### Dificuldade

3/5 — tabela e export com padrão existente; toca todas as escritas do GED.

### Prontidão

READY COM PREMISSAS

### Cobertura atual

25% — precedente de audit log e classificação de validade existem.

### Lote recomendado

5 (trilha + export); alertas podem ir ao 7

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
