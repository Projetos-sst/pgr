# NOB-98 — validação da autorização por empresa

## Evidências locais

- PostgreSQL 16.14 temporário, exclusivo, em loopback; migrations até 0056 aplicadas somente nesse cluster.
- Integração dirigida: duas suítes / 21 testes aprovados (fontes e autorização).
- Autorização: owner sem poderes automáticos, indicação com evidência, login client delegado, outra empresa/tenant, substituição, revogação, snapshot profissional, remoção de vínculo, decisões concorrentes, origem alterada/substituída, Medicina desabilitada, rollback de evento/decisão, HTTP e Server Actions.
- RLS/GRANT: inserção sempre pendente, conteúdo importado imutável, atualização dos quatro campos de revisão apenas por profissional autorizado, histórico sem UPDATE/DELETE pelo runtime.
- Suíte unitária completa inicial: 170 suítes / 1.706 testes aprovados. Três testes adicionais dos formulários aprovados após essa execução; verificam payload da indicação, revogação sem nova identidade e conflito de revisão.
- Typecheck aprovado. Build de produção aprovado com placeholders públicos do CI. Primeiro build falhou ao baixar fontes; repetição com rede compilou normalmente. Nenhuma mudança de fontes para contornar o problema.
- Lint inicial: zero erros; quatro avisos preexistentes de imagens e um import não utilizado novo, removido antes da publicação.

## Conferência antes da publicação

Suíte completa de integração, formatação final e CI: resultados registrados após conclusão.

## Limites e homologação

- Oito suítes de integração permanecem excluídas pelo jest.config.ts existente. Não foram declaradas aprovadas.
- Serviços externos opcionais (Gotenberg/PDF/GED, Supabase equipe/webhooks e smoke de conexão real) dependem das condições existentes. Skips são informados separadamente no resultado completo.
- Não houve teste manual autenticado no navegador com contas reais. Formulários são testados com React Testing Library; core, Actions e rotas com PostgreSQL real temporário e sessão simulada.
- Usuários precisam ter conta/vínculo prévio na organização; convites, preços e planos não foram alterados. Referência de evidência é textual. Registro profissional é declarado, sem consulta externa a conselho ou assinatura do PGR.
- Ao substituir/revogar o autorizador, concessões profissionais vigentes persistem até revogação explícita. Remover o vínculo da organização elimina concessões atuais por FK, sem apagar histórico de decisões/eventos.
- Antes de disponibilizar: revisar e aplicar migrations 0054–0056 pelo processo do projeto, homologar três contas (owner/autorizador/profissional), conferir módulos, indicação, autorização, revisão, revogação e consulta para PCMSO.
- Nenhuma migration em banco real, merge ou deploy executado.
