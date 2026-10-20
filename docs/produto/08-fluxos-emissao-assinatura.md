# NOB-101 — levantamento de emissão e assinatura técnica

Data: 2026-10-20. Código-base inspecionado: `98a2600`.
Estado: levantamento para validação; não estabelece novas regras técnicas ou legais.

Fonte: [NOB-101](https://linear.app/nobuggy/issue/NOB-101), descrição completa
consultada, sem comentários/anexos vinculados. A issue pede documentar fluxos,
estados, versionamento e vínculo profissional e confirmar modalidade de assinatura
antes de implementar regras definitivas. Permite registrar regras explicitamente pendentes.

## 1. PGR: fluxo implementado atualmente

1. Equipe interna (`owner`/`collaborator`) cria/edita PGR no tenant ativo.
   O registro referencia empresa e unidade opcional; guarda responsável como
   texto, tipo/número de registro, emissão/validade e `created_by` opcional.
2. Equipe pode criar revisões. O número é calculado no servidor, serializado
   pelo lock do PGR. A revisão guarda data/notas e pode ser arquivada.
3. A consolidação lê os dados atuais dos GES/riscos/avaliações/medidas/EPIs.
   Revisão não contém snapshot integral desses dados.
4. Publicar preenche `pgr.published_at` se ainda vazio. O código de atualização
   do PGR não impõe um bloqueio de edição baseado nesse campo. Publicação não
   comprova revisão por responsável técnico nem assinatura.
5. Solicitar assinatura monta no servidor um payload público mínimo de identificação,
   responsável, datas e maior número de revisão. Cria pedido genérico `target_type=pgr`
   sob a cota do plano. O payload não é o conteúdo integral nem hash do arquivo emitido.
6. O signatário abre o link e informa nome/imagem da assinatura. O tenant é
   resolvido pelo registro do token; consumo/captura impede reutilização do pedido.
   Persiste-se o hash do token, não o token em texto. Não presumir validação de
   registro profissional ou uso de certificado com base na captura existente.

### Estados existentes (não são uma máquina de aprovação técnica)

| Objeto               | Estados/indicadores                               | Observação                                                                     |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| PGR                  | `published_at` vazio ou preenchido                | Não possui enum de aprovação/emissão técnica.                                  |
| Revisão              | Número sequencial; `archived_at` vazio/preenchido | Não congela conteúdo do inventário.                                            |
| Pedido de assinatura | `pending`, `signed`, `cancelled`                  | `cancelled` existe no schema; não pressupõe fluxo operacional de cancelamento. |
| Estado exibido       | `none` e estados do pedido; `expired` derivado    | Expiração é derivada, não estado persistido do enum.                           |
| Captura              | Nome, imagem, método e data, ligada ao pedido     | Não contém validação de conselho profissional.                                 |

Evidências: `src/shared/db/schema/pgr.ts`,
`src/shared/db/repositories/{pgr,pgr-revisions,pgr-consolidated}.ts`,
`src/shared/server/actions/pgr/pgr.ts`,
`src/shared/server/pgr/pgr-signature-core.ts`,
`src/shared/domains/signatures/targets/pgr.ts`,
`src/shared/server/actions/public-signatures.ts`,
`src/shared/db/schema/signatures.ts`.

## 2. PCMSO: fluxo ainda não implementado

Não foram localizados domínio, schema, repositório, API ou tela operacional de
PCMSO no código inspecionado. O tipo de documento no GED e menções em páginas
institucionais não implementam o programa.

Os requisitos das issues NOB-98/NOB-109/NOB-111 estabelecem entrada de riscos
internos ou externos, origem/versão e validação técnica. Não estabelecem uma
máquina de estados aprovada, identidade do revisor ou modalidade de assinatura.
Não criar estados como se fossem decisões já aprovadas.

## 3. ASO/exames: fluxo implementado atualmente

1. Equipe interna cadastra exame vinculado ao funcionário do tenant e a um
   médico opcional do mesmo tenant.
2. Registra tipo, realização, validade opcional, aptidão, notas e caminho do certificado.
3. Permite consultar, editar e excluir. A exibição de validade é derivada da data;
   aptidão e validade não são estados de revisão, emissão ou assinatura.
4. Não existe consumidor `aso`/`health_exam` no registry genérico de assinatura.
   O caminho de certificado não comprova geração ou assinatura técnica do ASO.

Evidências: `src/shared/db/schema/health-exams.ts`,
`src/shared/db/repositories/health-exams.ts`,
`src/shared/server/actions/pgr/health-exams.ts`,
`src/shared/domains/pgr/health-exams.ts` e
`src/shared/domains/signatures/contract.ts`.

## 4. Rastreabilidade: disponível e faltante

| Dimensão       | Disponível                                                         | Limitação a resolver após validação                                                              |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Escopo         | Sessão/tenant, `withOrg`, RLS; gate interno por papel              | Não substitui autoridade técnica ou contratação por módulo.                                      |
| PGR            | ID, empresa, responsável textual, autor opcional, datas e revisões | Sem aprovação do revisor e sem conteúdo integral por revisão.                                    |
| Assinatura PGR | Pedido, alvo, payload mínimo congelado, captura e timestamps       | Sem vínculo criptográfico com arquivo/conteúdo integral emitido.                                 |
| ASO/exame      | ID, funcionário, médico opcional, datas e certificado              | Médico pode ser removido (`SET NULL`); não há histórico imutável do responsável.                 |
| Auditoria      | Eventos de aplicação com operação, tenant, usuário e resultado     | `logTenantEvent` escreve em console; não é trilha persistida de todas as transições documentais. |
| PCMSO          | Requisitos cadastrados no Linear                                   | Sem modelo/fluxo persistido no código atual.                                                     |

## 5. Decisões técnicas/de negócio pendentes

Para cada documento, confirmar com o responsável técnico:

- Quem elabora, revisa, emite e assina; quais papéis técnicos devem ser conferidos.
- Campos obrigatórios de identificação/vínculo profissional e comportamento se
  o cadastro mudar ou for excluído.
- Se a captura atual por link é aplicável ou se outra modalidade foi aprovada.
- Quais estados/transições e rejeições são necessários; ordem entre revisão,
  emissão e assinatura e tratamento de revogação/cancelamento.
- Qual conteúdo/arquivo fica congelado em cada versão; quando alterações exigem
  nova emissão/assinatura e o que acontece com pedidos de versões anteriores.
- Quais eventos e identificadores precisam ser persistidos para rastrear
  responsável, revisor, versão de origem e artefato assinado.

Esses pontos estão explicitamente pendentes. Este levantamento não altera os
fluxos existentes, concede permissão profissional ou valida juridicamente assinaturas.

## 6. Validação posterior

Depois de aprovadas as regras, produzir matriz por documento com entrada,
precondição, ator autorizado, transição, saída e evidência persistida. Reusar os
wrappers e a infraestrutura de pedidos/capturas. Cobrir versão alterada, falta de
responsável, tenant incorreto, link expirado/repetido e concorrência, além dos
casos aprovados para revisão e emissão.

Testes existentes relacionados: `src/__tests__/integration/pgr-editor/`
(`pgr-revisions`, `pgr-signature`, `pgr-public-signature`, `pgr-signature-quota`),
`src/__tests__/integration/signatures/` e
`src/__tests__/integration/pgr/health-exams.test.ts`.
Nenhuma suíte foi executada nesta etapa documental. Não há evidência de aprovação
funcional nem validação técnica dos novos fluxos.
