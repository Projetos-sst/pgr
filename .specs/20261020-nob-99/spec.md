# NOB-99 — cadastros comuns

Base: NOB-97 / PR #109. Sem nova tabela ou migration.

Empresas e funcionários continuam em `companies` e `employees`, com os mesmos
IDs e regras de unicidade/isolamento. PGR usa `company_id` e exames usam
`employee_id`. Não há sincronização nem cópia de cadastros por módulo.

## Plano implementado

- Reutilizar as consultas de empresa e funcionário, acrescentando filtro opcional
  de serviço validado por Zod. Consulta comum sem filtro preserva o comportamento.
- Formulário de PGR lista empresas com PGR habilitado; exames usam os mesmos
  funcionários das empresas com Medicina habilitada, identificando a empresa.
- REST existente `/companies` e `/employees` aceita `module=pgr|medicine`.
- Gates de papel/tenant continuam iguais. Filtro não concede acesso de escrita;
  a RLS e as validações da NOB-97 continuam aplicadas aos registros de cada módulo.
- Testar alterações de nome refletidas nos dois módulos, conservação de IDs e
  contagens, serviços independentes, tenant errado e parâmetros inválidos.

## Riscos e limites

Não mudar unicidade de CPF/CNPJ nem fronteira de tenant. Não criar usuário cliente
ou acesso externo ao escritório. A paginação existente do seletor de funcionários
(até 200 por consulta) foi preservada; pesquisa/paginação do seletor é evolução
separada. Inexistência de PCMSO não exige duplicar funcionários.

Constitution Check: mesma arquitetura e SQL nos repositórios; sem nova
infraestrutura ou mudança de billing. Validação de integração em PostgreSQL efêmero.
