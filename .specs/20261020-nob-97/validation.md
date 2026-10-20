# NOB-97 — validação

- TypeScript: aprovado.
- Lint: aprovado, com cinco avisos preexistentes (quatro usos de `img` e um import
  de tipo não usado em arquivos não modificados por esta issue).
- Suíte unitária: 167 suítes, 1.681 testes aprovados.
- Integração dirigida: PGR, exames e módulos, 28 testes aprovados em PostgreSQL
  16.14 isolado em loopback. Nova execução dos cinco testes de módulo/backfill:
  aprovada. Esses resultados se sobrepõem; não somar como testes distintos.
- Migrações 0000–0053 aplicadas apenas no banco descartável de teste.
- Formatação dos arquivos novos/modificados verificada com Prettier.
- Primeiro build: bloqueado pelo download de Google Fonts na rede restrita;
  retentativa autorizada aprovada, usando as configurações fictícias do CI.

O primeiro ensaio do banco de teste falhou por WIN1252 no Windows; o cluster foi
recriado em UTF-8. As execuções aprovadas usam a configuração corrigida. O Jest
avisou sobre conexões abertas ao terminar os asserts; saiu normalmente após o
timeout ocioso do pool, e o servidor temporário foi encerrado.

## Critérios

- Limites/entidades/interfaces: documentados em `spec.md`.
- Módulos por contratação: base e RLS implementadas para PGR e exames; a gestão
  pelo owner e sua interface são a entrega seguinte NOB-100.
- Preservação de fluxos: testes dirigidos existentes passaram e backfill
  comprovado. Não houve teste manual autenticado no navegador nem banco real.
- Empresas novas começam sem módulos, conforme decisão do usuário.

Não há alteração no plano Pro, checkout, preços, assinatura ou webhook Stripe.
