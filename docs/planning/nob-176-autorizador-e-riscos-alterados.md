# NOB-176 — Indicação do autorizador pela empresa e revisão de riscos alterados

Cobre as respostas SEG-19, SEG-20 e SEG-21 (decisões DT-12 e DT-27). A NOB-98 já tinha entregue o fluxo de
indicação, autorização profissional e revisão de riscos, mas só o owner do escritório registrava a indicação.
Esta entrega deixa o representante da empresa fazer a indicação no sistema e prova, por teste, o que acontece
quando um risco muda depois de validado.

## Quem é o representante da empresa

Não existe perfil novo. O representante é a conta com papel `client` vinculada à empresa de um destes jeitos:

- `org_memberships.scoped_company_id` igual à empresa (uma empresa);
- `scoped_company_id` vazio e uma linha em `member_access_scopes` para a empresa (várias empresas, NOB-175).

Conta `client` sem nenhum dos dois vínculos não representa empresa nenhuma.

## Matriz

Legenda de "Onde é garantido": **Banco** = policy RLS; **Servidor** = regra no core/repositório, igual para
Server Action e API.

| Papel                                   | Operação                                     | Escopo                              | Onde é garantido |
| --------------------------------------- | -------------------------------------------- | ----------------------------------- | ---------------- |
| Owner do escritório                     | Registrar, substituir ou revogar a indicação | Qualquer empresa do escritório      | Banco + Servidor |
| Representante da empresa                | Indicar, substituir ou revogar o autorizador | Só as empresas a que está vinculado | Banco + Servidor |
| Representante da empresa                | Indicar a própria conta                      | Negado                              | Banco + Servidor |
| Representante da empresa                | Autorizar profissional ou validar risco      | Negado (não recebe esses poderes)   | Banco + Servidor |
| Autorizador atual                       | Autorizar e revogar profissionais            | Só a empresa que o indicou          | Banco + Servidor |
| Autorizador atual                       | Trocar ou revogar a própria indicação        | Negado                              | Banco + Servidor |
| Profissional com autorização ativa      | Validar ou rejeitar risco, com parecer       | Só a empresa que o autorizou        | Banco + Servidor |
| Profissional com autorização ativa      | Indicar autorizador                          | Negado                              | Banco + Servidor |
| Colaborador do escritório               | Indicar, autorizar ou validar                | Negado                              | Banco + Servidor |
| `client` sem vínculo com a empresa      | Qualquer operação da empresa                 | Negado                              | Banco + Servidor |
| Qualquer conta                          | Informar outro ator como autor do registro   | Negado (ator vem da sessão)         | Banco + Servidor |
| Qualquer conta                          | Dados de outro escritório                    | Negado                              | Banco            |
| Médico coordenador / equipe da Medicina | Usar risco no PCMSO                          | Só risco validado em fonte vigente  | Servidor         |

O representante chega pelas rotas delegadas que já existiam (`/risk-authorizations` e
`/api/v1/companies/{id}/risk-authorizations`, com `tenantAccess`). As telas do escritório continuam fechadas
para `client`.

## O que já existia (NOB-98, NOB-111, NOB-166)

- Indicação com evidência e motivo, autorização profissional com identidade declarada e parecer por risco, cada
  um com ator, data e histórico que não pode ser alterado nem apagado pela aplicação.
- Risco importado, interno ou externo, entra sempre pendente. O banco recusa inserir risco já validado.
- PGR interno alterado depois da captura: a fonte passa a `changed`, a situação vira `origin_changed` e o risco
  deixa de ser utilizável no PCMSO, mesmo que o parecer anterior continue gravado como `validated`.
- Nova versão da fonte (interna ou externa) substitui a anterior. Os riscos da nova versão entram pendentes e os
  da anterior deixam de ser utilizáveis.
- O parecer anterior fica em `medical_risk_decisions`, com a impressão digital da fonte em que foi dado.
- A Medicina recebe a alteração pelo contrato de leitura que já consome: `freshness`, `status`, `warnings` e
  `usableForPcmso` no inventário, e a base vigente usada na conferência e na assinatura do PCMSO.

## O que foi acrescentado

- O representante da empresa indica, substitui e revoga o autorizador na própria empresa. Regra no repositório
  `risk-authorizations.ts` e nas policies `risk_authorizers_owner_insert` e `risk_authorizers_owner_update`
  (migration `0084`, só `ALTER POLICY`). Os nomes das policies foram mantidos.
- Separação de funções: o representante não indica a própria conta, e a conta que já é o autorizador atual ou
  tem autorização profissional ativa na empresa não faz indicação.
- Cada evento do histórico grava `details.origin` (`company_representative` ou `office_owner`). A tela mostra a
  origem no histórico de indicação e autorizações.
- A leitura da área delegada devolve `appointmentOrigin`. Campo novo; os demais continuam iguais.
- A lista de empresas em `/risk-authorizations` inclui as empresas do representante.
- Testes de integração em `src/__tests__/integration/platform/company-representative-appointment.test.ts`:
  indicação na própria empresa, outra empresa, várias empresas por escopo, autoconcessão, ato em nome de outro,
  outro escritório, revogação, risco interno alterado, nova versão de fonte externa e contrato da Medicina.

Nenhum campo que a Medicina consome mudou de forma ou de significado.

## Definições pendentes

1. **Pareceres anteriores depois da revogação.** Hoje, revogar o profissional ou trocar o autorizador não
   invalida o que já foi validado: o risco continua utilizável e o parecer fica no histórico. É o comportamento
   da NOB-98, coerente com a resposta MED-03 ("continuam valendo até a próxima revisão do PGR"). Fica como
   regra **provisória**, coberta por teste. Falta o responsável técnico confirmar se a revogação deve invalidar
   os pareceres para novos consumos.
2. **Profissional externo com conta própria.** Não existe perfil. O profissional externo usa hoje uma conta
   `client` vinculada à empresa, igual à do representante. Por isso uma conta `client` vinculada, sem poder
   delegado ativo, é tratada como representante. Um profissional com autorização revogada volta a poder indicar.
   Só o perfil próprio do representante (DT-27) separa os dois de vez.
3. **Aviso ao médico.** A alteração aparece para a Medicina nos campos do contrato e bloqueia a conferência do
   PCMSO. Não há notificação ativa (e-mail ou alerta) ao médico responsável.
4. **Quais alterações exigem nova validação.** Hoje qualquer mudança no risco, na avaliação ou nos grupos do
   PGR de origem muda a impressão digital e tira o risco do uso. O critério por norma depende do responsável
   técnico (SEG-21).
5. **Validação única para o inventário do PGR (SEG-19).** A validação continua só na cópia de riscos usada pela
   Medicina. O inventário de Segurança não passa por ela.
6. **Evidência da indicação.** Continua sendo texto de referência, sem anexo nem verificação de autenticidade.
