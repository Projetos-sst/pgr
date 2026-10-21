# NOB-102 — validação e revisão

## Resultado

- Tipagem aprovada após regenerar tipos de rotas do Next para a branch.
- Suíte unitária completa: 168 suítes, 1698 testes aprovados, sem skips.
- Integração dirigida: 4 suítes, 35 testes aprovados em PostgreSQL temporário,
  incluindo Actions e HTTP de empresas/funcionários e consulta CNPJ mockada.
- A primeira execução encontrou uma asserção de teste que usava
  `saved.data.employee` em vez do retorno real `saved.data`; corrigida e repetida.
- Sem QA manual autenticado, consulta cadastral real, banco real ou migration.

## Revisão de segurança/compatibilidade

- Tenant continua resolvido pela sessão/gate; entrada não escolhe escritório.
- Constraint de unicidade existente é mantida, inclusive sob concorrência.
- Não há consulta "check then insert" que substitua a proteção transacional.
- POST/PUT preservam o gate e reutilizam o leitor JSON seguro já existente.
- CNPJ vazio continua aceito como antes; registros legados não são reescritos.
- CNPJ numérico mantém o cálculo anterior; letras usam ASCII menos 48 conforme
  manual oficial, sem remover conteúdo desconhecido para "tornar válido".
- CPF continua com a validação e a unicidade atuais; não houve mudança comercial
  de vínculo de funcionário ou de permissão de owner/colaborador/cliente.
- Provedor de autofill continua auxiliar, com preenchimento manual disponível.

## Critérios de aceite

1. CNPJ válido/inválido: testes numéricos, alfanuméricos, DVs errados, conteúdo
   desconhecido, normalização, máscara e apresentação cobertos.
2. Funcionários/empresa: persistência do vínculo e rejeição de referências
   cruzadas, tanto entre tenants quanto entre empresas do mesmo tenant, cobertas.
3. Duplicidade/campos obrigatórios: criação/edição, normalização, concorrência,
   erro de campo CNPJ, nome/grau/empresa/CPF e JSON inválido cobertos.

Risco residual: dados históricos escritos fora dos validadores não são saneados
automaticamente; o suporte externo a CNPJ alfanumérico depende do provedor. Nenhum
teste confirma existência, situação fiscal ou regularidade de um CNPJ real.
