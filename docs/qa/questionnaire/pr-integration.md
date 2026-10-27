O questionário do Expedito revelou diferenças entre os fluxos entregues e as regras esperadas: módulos eram escolhidos somente depois do cadastro, a emissão conferida não exigia um revisor independente e o teste bloqueava também os downloads de demonstração. Esta integração conecta esses fluxos ao servidor, preserva documentos/acessos anteriores e registra a aderência das 28 NOBs trabalhadas às 58 questões, com pendências explícitas.

### Escopo

- Reúne os commits comerciais simulados das PRs #122–135 e os ajustes descritos abaixo. O gateway continua simulado e não altera assinaturas/preços reais.
- Seleção de PGR/Medicina no cadastro por owner, com motivo e gravação transacional de empresa, módulos e histórico.
- Revisão por PGR com contas distintas, amostra imutável, versão dos dados/modelo, parecer próprio, concorrência e RLS. Novos PGRs exigem revisão antes da emissão/assinatura; antigos aderem por designação.
- Revisor restrito também no Gratuito, com conta Clerk/e-mail verificado, sem liberar recursos Pro; acesso somente aos PGRs designados, com concessão/revogação pelo owner. Nenhuma mensagem de convite é enviada.
- Teste simulado de 15 dias, uma concessão global por CNPJ, proteção contra troca de identidade e downloads ilimitados de PDF/DOCX com marca nesta etapa. Emissão, assinatura e arquivamento final continuam bloqueados no teste. Arquivos baixados podem ser modificados/impressos externamente, limitação aceita pelo usuário.
- Navegação comum de incidentes e psicossocial, alerta interno de PGR a vencer em 30 dias, severidades da conferência no fluxo revisado e seis categorias de amostras fictícias.

### Banco e integração

Base verificada: develop `e6f25428051ad1cc5a6df57b97365e17c2c16b67`, migration 0059. Esta PR contém a cadeia candidata comercial `0060–0063` e a revisão `0064–0068` (aprovação por documento, teste por CNPJ, migração segura de novos PGRs, revisor restrito e leitura por ator). Inclui o código funcional; não transportar somente SQL. Reconciliar a numeração imediatamente antes da integração com o trabalho do Carlos. A PR #136 dele estava aberta sem migration na conferência inicial.

### Validação

`npm run check` aprovado localmente: 194 suítes / 1.826 testes unitários, tipagem, formatação e lint (quatro avisos preexistentes). Integrações e rehearsal do migrator oficial executados em PostgreSQL temporário, incluindo regressões NOB-98 e Lote 01 da Medicina, owner/colaborador/revisor restrito, dois escritórios, concorrência e revogação. Dez combinações visuais celular/desktop sem overflow ou erros de JavaScript, com fixtures. Evidências e limites em `docs/qa/questionnaire/validation.md`; o CI deve validar o HEAD atual antes de aprovação.

### Pendências conhecidas

Não representa o cumprimento de todas as respostas do questionário. A matriz `docs/qa/questionnaire/2026-10-27-alinhamento.md` identifica lacunas como ACL geral por empresa/obra/módulo, operação de Segurança separada, validação individual do inventário, arquivamento/cancelamento completo, carência financeira, modelos e decisões técnicas/comerciais. PCMSO/ASO finais continuam no escopo de Medicina. Homologação com usuários reais do Clerk e responsável técnico ainda é necessária. Manter em rascunho para revisão; sem merge automático ou aplicação manual de migrations em produção.
