# NOB-97 — módulos por empresa

## Regras confirmadas em 2026-10-20

Contratação por empresa-cliente; somente owner altera habilitações. Empresas
existentes preservam ambos os módulos. Empresas novas começam sem módulos.
Colaboradores mantêm operação nos serviços habilitados. Pro, preços e Stripe
continuam independentes e não são alterados.

## Limites e interfaces

- PGR: documento, vínculos GES, revisões, consolidação e emissão existentes.
- Medicina: exames/ASO por funcionário. Médicos são catálogo compartilhado do escritório.
- Comuns: empresas, funcionários, funções/GES, documentos e autenticação. Não
  criar cópias desses registros por módulo. O acesso comum continua limitado ao tenant.
- `company_modules`: habilitações explícitas por `(org_id, company_id, module)`.
- `company_module_events`: histórico persistido append-only com ator, motivo e estados.
- Read contract: módulos conhecidos retornam desabilitados quando não há habilitação.
- A política de RLS restringe PGR, seus filhos e exames por habilitação da empresa;
  wrappers de autenticação/papel e `withOrg` continuam obrigatórios.
- A manutenção e exibição das habilitações são a etapa NOB-100.

## Migração segura proposta

Migration aditiva 0053: criar tabelas, índice e FKs compostas, grants e policies;
copiar habilitação dos dois serviços para todas as empresas existentes, com evento
identificando a migração. Nenhuma tabela/dado de negócio é removido. Ausência de
habilitação nas empresas criadas depois da migração significa acesso negado.

Aplicar primeiro em banco de teste e conferir contagens de empresas versus
habilitações/eventos. Depois implantar junto da versão compatível do app em janela
controlada. Não rodar migration em produção nesta tarefa. Em rollback de aplicação,
preservar tabelas e histórico; não apagar habilitações. Não executar rollback
destrutivo nem relaxar isolamento para restaurar acesso.

## Riscos

Novas empresas precisam de habilitação antes de operar PGR/exames. Essa mudança
foi autorizada pelo usuário. RLS limita listagens e URLs diretas; telas sem empresa
selecionada podem continuar mostrando o catálogo comum. Mensagens de erro não
devem revelar registros de outro tenant. Links de assinatura já emitidos não são
revogados automaticamente por esta entrega.

## Plano e validação

1. Schema code-first e migration aditiva revisada.
2. Separar Medicina na navegação sem remover URLs existentes.
3. Checagens de módulo em criação/edição e proteção RLS nas leituras/escritas.
4. Unitários de contrato e erros; integração com PostgreSQL real para módulos
   independentes, negação por padrão, filhos do PGR, tenants e preservação do backfill.
5. Lint, tipos, formatação, unitários e build. Registrar limitações reais.

Constitution Check: mesma stack, sem serviço novo de produto; banco efêmero apenas
para testes; tenant da sessão, RLS e gates existentes preservados; zero billing.
