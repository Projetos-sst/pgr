# #61 — [Qualidade/GED] Notificações automáticas por e-mail

https://github.com/Projetos-sst/pgr/issues/61

### Objetivo

E-mail ao Administrador de TI (backup concluído/falho, AD atualizado) e ao usuário quando permissões/acessos
do GED mudarem.

### Estado atual no código

- Nenhum provedor de e-mail em `package.json` (resend/sendgrid/nodemailer/postmark ausentes).
- Notificações são derivadas das pendências, sem persistência, com decisão registrada: "não há tabela nem e-mail (decisão KISS, zero infra nova)" (`src/shared/domains/platform/notifications.ts:15-20`).
- Constituição: Princípio II exige **emenda formal** para serviço externo pago (precedente: Stripe na v1.5.0).

### O que já existe

Notificações in-app derivadas.

### O que falta

Provedor, templates, disparo por evento, configuração de destinatário, tratamento de falha.

### Arquivos/domínios provavelmente afetados

`integrations/email/` (novo), eventos de permissão (#58), rotina de backup (#60), configurações do tenant.

### Migration

PROVÁVEL — outbox/log de envio ou e-mail do administrador por tenant.

### Testes necessários

Unit com provedor mockado; integração do disparo por evento; falha do provedor não quebra a ação principal.

### Dependências

#58 (eventos de permissão), #60 (eventos de backup/AD).

### Riscos

Custo; entregabilidade (SPF/DKIM); dado pessoal em e-mail; reversão de decisão de arquitetura registrada.

### Requisitos faltantes

Aprovação do provedor + emenda; destinatário de TI por tenant; quais eventos disparam.

### Dificuldade

4/5 — dependência externa nova e decisões de infraestrutura.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

0%.

### Lote recomendado

8

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
