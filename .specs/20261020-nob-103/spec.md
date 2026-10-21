# NOB-103 — contexto dos riscos e revisão técnica

## Escopo entregue

O cadastro existente já possui físicos, químicos e ergonômicos, avaliação,
medidas de controle e contexto persistido por `risks.ges_id → ges → empresa/obra`.
O formulário agora envia a empresa e a obra selecionadas; Server Action e REST
validam sua correspondência ao GES. Valores divergentes geram FK_NOT_FOUND (422).
Criar/editar exige PGR habilitado na empresa obtida do GES, inclusive para
clientes antigos que enviem apenas gesId. Os seletores oferecem empresas com PGR.
Nenhum registro existente é removido, nem escala técnica modificada.

## Arquivos e riscos

- `domains/pgr/risk.ts`: contexto opcional validado, mantendo clientes antigos.
- `repositories/risks.ts`: validação no tenant e serviço, antes da escrita.
- Formulários de riscos: seleção filtrada e envio do contexto.
- API/Postman: documentam o mesmo contrato, sem endpoint paralelo.
- Testes: categorias, escrita, contexto, permissão, isolamento e HTTP.
- `jest.config.ts`: reabilita REST de riscos após corrigir o mock incompleto de
  OFFICE_STAFF_ROLES; as outras exclusões preexistentes permanecem.

Sem migration. A NOB-98 permanece separada, incluindo suas policies adicionais.
Esta PR não afirma que todo o inventário já tem restrição SQL por módulo.

## Validação executada

- 2 suítes / 20 testes unitários aprovados.
- 3 suítes / 35 testes de integração aprovados em PostgreSQL 16 temporário:
  Actions, REST e isolamento. Nenhum teste ignorado nessas execuções.
- Tipagem aprovada após regenerar os tipos Next.js da branch atual.
- Sem avaliação técnica humana ou QA autenticado no navegador.

## Critérios de aceite

- Categorias cadastráveis e editáveis: existente, exercitado nas três categorias.
- Vínculo ao contexto: existente, agora validado também contra a seleção enviada.
- Campos/validações revisados tecnicamente: **pendente**. O usuário autorizou
  manter as regras atuais e preparar a revisão; isso não constitui parecer técnico.

Revisar com o responsável: agente/perigo, fontes, propagação, exposição, lesões,
unidades e medições, escalas/metodologia existentes, medidas e critérios de
obrigatoriedade por categoria. Não concluir a issue antes dessa revisão.
