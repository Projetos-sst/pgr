# Conclusão progressiva do PGR

Autorização: usuário pediu concluir as pendências da melhor forma possível em
21/10/2026, após fornecer avaliação DOCX e exemplo PDF. Esses arquivos são
referências e evidências de defeitos; não equivalem a aprovação profissional.
Dados dos anexos permanecem fora do Git. Preservar arquivos locais anteriores.

## Etapas e decisões de implementação

1. NOB-98: código e CI já aprovados na PR 112. Preservar sem merge/deploy.
2. NOB-103: comparar avaliação e código; cadastro das categorias e contexto já
   entregue. Preservar metodologia configurável e não importar a classificação
   inconsistente do exemplo (2 x 2 apresentado como Trivial).
3. NOB-104: reutilizar catálogo machine e adicionar instalação por empresa/obra,
   GES opcional da mesma obra. Aceitar unidade identificada (quantidade 1) ou grupo
   com quantidade, campos livres de uso/segurança/monitoramento. Sem inferir
   certificação ou obrigatoriedade normativa. Auditoria transacional, retirada
   lógica preservando histórico, RLS, Actions/REST/UI e DOCX.
4. NOB-105: mapear campos/documento, expor diagnóstico de preenchimento; permitir
   prévia sem perder acesso atual e oferecer emissão controlada que bloqueia
   inconsistências objetivas. Não converter ausências em afirmações técnicas.
5. NOB-106: preparar oferta configurável e versionada, inicialmente inativa,
   somente owner, sem cobrança/Stripe/Pro. Ativação requer aprovações explícitas
   registradas, sem presumir elegibilidade por porte nem suprimir dados técnicos.
6. NOB-107: preparar amostras e testes, registrar revisão/achados/evidências e
   revalidação com rastreabilidade. Não inventar parecer técnico nem assinatura.

## Ordem de integração

Uma PR ativa por issue com código: NOB-98 → NOB-104 → NOB-105 → NOB-106 → NOB-107.
Reutilizar PRs 115–117. PR nova de continuidade da 104, pois PR 114 documental já
foi mergeada. CI deve aceitar bases codex para validar PRs dependentes; integração
em develop e migrations reais continuam fora desta execução.

## Verificações

Testes unitários de regras e integração PostgreSQL temporário: vínculos de outra
empresa/tenant, tipo epi rejeitado, contexto GES/obra, módulo desligado, histórico,
concorrência, rollback e agregação documental. Tipos, lint, formatação, build e
CI das PRs. Revisão visual de documentos sintéticos, sem dados dos anexos no Git.
