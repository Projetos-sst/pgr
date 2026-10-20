# NOB-100 — validação

- Tipagem aprovada após corrigir a tipagem booleana do predicado SQL e reutilizar
  o validador de UUID já adotado no projeto.
- Integração: três suítes / 15 testes aprovados em PostgreSQL 16.14 isolado,
  incluindo habilitações, cadastros comuns e gerenciamento.
- Cobertos: owner versus colaborador/cliente, tenant errado, entrada inválida,
  idempotência, concorrência, rollback quando falha a gravação de auditoria e
  GET/PUT HTTP reais via NextRequest e wrappers existentes.
- Plano Pro e registros anteriores preservados; nenhum teste usa pagamento real.
- Incluído tratamento de JSON malformado como VALIDATION/422; reteste dos sete
  casos de gerenciamento aprovado, inclusive o caso HTTP de JSON inválido.
- Sem teste manual autenticado no navegador. Build e suíte completa desta
  integração serão executados ao final; esta PR é dependente da NOB-99.

Critérios de contratação/habilitação e acesso independente implementados. O uso
de fonte PGR externa por empresa com apenas Medicina depende da NOB-98 seguinte.
Não foi implementado checkout separado nem alteração de preço/cobrança.
