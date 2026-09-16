# #54 — [Qualidade/GED] Fluxo de aprovação de documentos

https://github.com/Projetos-sst/pgr/issues/54

### Objetivo

Aprovação por papel e tipo (alta administração → políticas; gestores → procedimentos/instruções; Gestor da
Qualidade → registros), com registro de quem aprovou, quando e evidência de aceite/assinatura.

### Estado atual no código

- Infra genérica de assinatura: `signature_requests`/`signature_captures` (`schema/signatures.ts:40-109`), registry `SIGNATURE_TARGET_TYPES = demo|inspection|pgr|service_order` (`domains/signatures/contract.ts:13-18`); adicionar consumidor = entrada no registry + payload + form, sem schema novo. Há cota mensal por tenant no core.
- Adaptador de referência: `server/pgr/pgr-signature-core.ts` (98 linhas).
- Essa infra coleta assinatura por **token público (QR/link)**, não aprovação autenticada por papel.
- Precedente de aprovação in-app: `work_permits.approved_by` + status (`schema/work-permits.ts:67`).
- `doc_type` livre impede "aprovação por tipo" sem categoria fechada (#52).

### O que já existe

Infra de assinatura e padrão de aprovação in-app.

### O que falta

Papel Aprovador, mapeamento tipo→aprovador, registro de aprovação, gate de publicação.

### Arquivos/domínios provavelmente afetados

Domínio de workflow GED, repositório de aprovações, actions/REST, eventual `target_type = document_approval`.

### Migration

SIM — registro de aprovação (tabela ou colunas).

### Testes necessários

Integração: aprovador errado bloqueado por tipo; publicação sem aprovação bloqueada; evidência gravada.

### Dependências

#53, #58.

### Riscos

Usar assinatura pública para ato interno consome cota do plano free e expõe token fora da sessão.

### Requisitos faltantes

Assinatura QR/link vs. aceite autenticado; mapeamento tipo→aprovador fixo ou configurável.

### Dificuldade

4/5 — regra de autorização por tipo + possível integração com assinatura + gate transversal.

### Prontidão

BLOCKED (#53, #58) + decisão de produto

### Cobertura atual

25% — infra de assinatura reaproveitável.

### Lote recomendado

6

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
