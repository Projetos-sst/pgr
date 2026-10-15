# #62 — [Qualidade/GED] Regras de negócio do GED

https://github.com/Projetos-sst/pgr/issues/62

### Objetivo

Invariantes: nada publica sem aprovação; só a versão ativa é oficial; acesso restrito por setor e perfil;
todo documento tem responsável; descarte só após aprovação formal com auditoria.

### Estado atual no código

- "Versão ativa" parcialmente resolvida por `currentVersionPredicate` (`repositories/documents.ts:72-86`).
- CHECKs existentes em `documents` (`schema/documents.ts:87-92`): versão ≥ 1, tamanho, vínculo completo-ou-vazio. Única trigger: `set_updated_at`.
- Nenhuma coluna de responsável, aprovação, publicação ou descarte (ver #52, #54, #55, #57).

### O que já existe

Predicado de vigente e padrão de CHECK.

### O que falta

Cada invariante só existe depois das estruturas de #52–#57; esta issue consolida e prova as regras no servidor e no banco.

### Arquivos/domínios provavelmente afetados

Domínio de workflow do GED, CHECKs/triggers, guards nas actions/REST, testes de ponta a ponta.

### Migration

SIM — CHECKs/constraints finais.

### Testes necessários

Integração por invariante: publicar sem aprovação (servidor, não UI); consulta sem versão ativa retorna erro claro; responsável obrigatório; descarte sem aprovação.

### Dependências

#52, #53, #54, #55, #56, #57.

### Riscos

Constraint nova falhar sobre dados legados — exige backfill antes.

### Requisitos faltantes

Em que situação um documento fica "sem versão ativa" (após descarte da vigente?).

### Dificuldade

4/5 — transversal a todo o épico.

### Prontidão

BLOCKED (#52–#57)

### Cobertura atual

25% — vigência e CHECKs básicos.

### Lote recomendado

7

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
