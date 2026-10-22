# REVIEW — Lote <preencher: NN> <preencher: nome>

<!-- Modelo. Copiar para lotes/<NN-slug>/REVIEW.md (links já relativos a essa pasta). Parecer de revisão (subagente independente e/ou revisor humano). Não registrar aprovação que não existiu.
     Lote não iniciado: deixar o bloco "NÃO INICIADO" e manter só o checklist. -->

**NÃO INICIADO — nenhuma revisão realizada** <!-- remover quando houver a primeira revisão -->

| Campo           | Valor                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Revisor         | <preencher: nome ou "subagente independente">                         |
| Data            | <preencher: AAAA-MM-DD>                                               |
| Escopo revisado | <preencher: branch/SHA ou PR>                                         |
| Parecer         | <preencher: aprovado / aprovado com ressalvas / mudanças necessárias> |

## Checklist do que revisar

- [ ] Escopo bate com o PLAN; nada fora de escopo sem registro
- [ ] Tenant: toda query via `withOrg`; tenant da sessão, nunca do cliente
- [ ] Empresa e módulo: FK composta, RESTRICTIVE `medicine`, `assertCompanyModuleTx` na escrita
- [ ] Gate de papel (`officeAction`/`restHandler`/`requireOfficeStaff`); owner não é médico presumido
- [ ] Regras S-01…S-13 de [05](../../geral/05-SEGURANCA-E-DADOS.md) §2
- [ ] Erro ≠ vazio em toda tela/listagem tocada
- [ ] Nenhum dado médico em IA, log, `localStorage` ou fixture real
- [ ] Nenhuma assinatura técnica simulada
- [ ] Migration (se houver): aditiva, uma por PR, `when` correto, checklist de [06](../../geral/06-GIT-MIGRATIONS-CD.md) §3.4
- [ ] 4 superfícies (Action, REST, api-design, Postman) coerentes entre si
- [ ] Testes: unit, integração sem skipped, `runIsolationSuite` em tabela nova, E2E
- [ ] Identidade visual: Manrope/JetBrains Mono, indigo, primitives `_ui`; teal só se aprovado
- [ ] Documentação do lote atualizada

## Achados

| #   | Severidade                                   | Achado      | Arquivo:linha | Resolução                                              |
| --- | -------------------------------------------- | ----------- | ------------- | ------------------------------------------------------ |
| R1  | <preencher: bloqueante / importante / menor> | <preencher> | <preencher>   | <preencher: corrigido em SHA real / aceito / pendente> |

## Conclusão

<preencher>
