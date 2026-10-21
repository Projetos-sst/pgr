# NOB-102 — validação de empresas e funcionários

## Plano e análise

O sistema já exige razão social e grau de risco, permite CNPJ opcional, possui
índice único `(org_id, cnpj)` e valida empresa/GES/função no cadastro de empregado.
Preservar essas regras e os registros existentes. Não tornar CNPJ obrigatório nem
alterar unicidade de CPF ou permissões comerciais.

Lacuna encontrada: duas implementações de checksum e normalizadores que apagam
letras, incompatíveis com o CNPJ alfanumérico implantado em 2026. Unificar em um
domínio puro, aceitando o formato numérico existente e o alfanumérico, com letras
maiúsculas e dois DVs numéricos. Normalização remove separadores de máscara,
mas não caracteres desconhecidos. Atualizar máscara/exibição e lookup para usar
a mesma regra; consulta externa continua opcional e não autoriza o cadastro.

Fonte: [manual oficial do DV](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
Exemplo de cálculo publicado: `12.ABC.345/01DE-35`. Casos de teste são exemplos,
não consulta cadastral nem confirmação de existência/atividade de empresa.

Melhorar mensagem/field error de CNPJ duplicado usando o índice já existente,
inclusive em corrida, sem consulta de existência que substitua a constraint.
Cobrir cadastros e atualizações pelas Actions e REST, normalização/duplicidade,
campos ausentes, tenant errado e referências incorretas de funcionários.

Arquivos: domínio CNPJ, validação e apresentação de empresas, validação de lookup,
mapeamento de erro de unicidade; testes/API/Postman. Sem tabela ou migration nova.

Constitution Check: arquitetura e stack preservadas, tenant da sessão, RLS e
constraints existentes mantidas, integrações testadas em PostgreSQL temporário.
Risco: CNPJs alfanuméricos não suportados por um provedor de autofill devem poder
ser cadastrados manualmente. Dados legados não são normalizados em massa.
