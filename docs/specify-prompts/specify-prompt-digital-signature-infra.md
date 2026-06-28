/speckit-specify

GIT_BRANCH_NAME: feature/digital-signature-infra

Feature: Infraestrutura de assinatura digital por link público com token — camada de
PLATAFORMA, transversal e reutilizável (DRY), consumida por múltiplos módulos (entrega de
EPI, Ordem de Serviço, inspeção de segurança, PGR, foto 3x4, questionário psicossocial).
Permite que um membro do escritório gere, para um registro/evento de qualquer módulo, um
link público (e QR Code) protegido por token, que um terceiro SEM login (ex.: funcionário)
acessa para assinar digitalmente (canvas → imagem). A assinatura é persistida e vinculada
ao registro de origem, e o status ("Aguardando" → "Assinado") reflete em tempo real na tela
interna. Tudo isolado por tenant e respeitando o plano free/pro. Esta é uma fatia de
INFRAESTRUTURA (issue #67), não de um módulo de negócio.

ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec):

- docs/briefings/briefing-digital-signature-infra.md
  Consolida as decisões travadas no brainstorming: modelagem genérica polimórfica
  (signature_requests + signature_captures), segurança da rota pública (tenant resolvido
  a partir do token via policy de capability, nunca do cliente), regras de plano free/pro
  (conformidade com a 005), escopo in/out, contrato de consumo (registry por target_type)
  e estratégia de testes. As decisões técnicas (o "como") são insumo do /speckit-plan; a
  spec deve permanecer no nível de O QUÊ e POR QUÊ. Em conflito entre este prompt e o
  briefing, o BRIEFING prevalece — aponte o conflito.

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (inspirado no ePGR).
Antes de escrever a spec, leia os padrões já vigentes no repo e LISTE os arquivos que vai
ler. No mínimo:

- docs/briefings/briefing-digital-signature-infra.md — fonte da verdade desta fatia.
- .specs/005-modelo-tenant-gate-pro/spec.md — regras de plano (FR-011/012/013; Inv-1:
  plano é do tenant ativo, nunca do usuário).
- .specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md — motor de isolamento
  (withOrg + set_config) e padrão de RLS.
- CLAUDE.md — camadas (página/handler → action → domínio → repositório → schema),
  officeAction/restHandler, ActionResult, política de testes (Postgres efêmero, NÃO SQLite).
- src/shared/db/schema/companies.ts — template canônico de tabela com org_id + RLS.
- src/shared/tenant/active-tenant.ts e src/shared/tenant/plan.ts — resolução do plano do
  tenant ativo e padrão de helper de gate (isTeamManagementAvailable).

USER STORIES (priorizadas; cada uma independentemente testável):

- US1 (P1) Gerar link/QR assinável sem login. Como membro do escritório, quero gerar um QR
  Code ou link para que um terceiro assine um registro (ex.: entrega de EPI) sem precisar de
  conta. Teste: a partir de um registro, gera-se link+QR; ao abrir sem sessão, o formulário
  de captura correto é exibido.

- US2 (P1) Acompanhar a confirmação em tempo real. Como membro do escritório, quero ver na
  tela interna se a assinatura foi concluída sem recarregar. Teste: com um pedido
  "Aguardando", após assinar no link público, a tela interna passa a "Assinado" sozinha em
  menos de 5 segundos.

- US3 (P1) Reutilização por múltiplos módulos (DRY). Como produto, quero que a mesma
  infraestrutura sirva a vários módulos via um único contrato. Teste: um consumidor de
  demonstração integra-se via o contrato; o caminho para registrar um novo tipo de
  consumidor está documentado e não exige mudança de schema.

- US4 (P2) Assinatura manual (fallback). Como membro do escritório, quero registrar uma
  assinatura manual (fallback impresso) quando o terceiro não puder assinar pelo
  dispositivo. Teste: um pedido "Aguardando" pode ser marcado como assinado manualmente e
  fica registrado como tal.

- US5 (P3) Limite de uso por plano. Como produto, quero limitar o volume no plano free e
  liberar ilimitado no pro. Teste: um tenant free é impedido de criar novo pedido após
  atingir o limite mensal; um tenant pro nunca é impedido.

SUCCESS CRITERIA (mensuráveis e AGNÓSTICOS de tecnologia):

- SC-001: Um terceiro sem login acessa o link e conclui a assinatura; o status na tela
  interna muda para "Assinado" em menos de 5 segundos após a conclusão.
- SC-002: Cada token é de uso único e expira no tempo configurado; reuso ou uso após
  expiração retorna mensagem de erro clara, sem permitir gravação.
- SC-003: A assinatura coletada fica persistida e recuperável, vinculada ao registro de
  origem.
- SC-004: O mesmo mecanismo atende a pelo menos um módulo consumidor (demonstração) via o
  contrato único; adicionar novo módulo consumidor não exige alterar o modelo de dados.
- SC-005: Nenhum dado de assinatura cruza organizações: um token de uma organização nunca
  lê/grava dados de outra; sem token, nada é retornado.
- SC-006: No plano free, a criação de pedidos é bloqueada ao exceder o limite mensal; no
  pro não há bloqueio. O plano considerado é o do tenant ativo.

REGRAS DE PLANO (conformidade com a spec 005):

- O plano é atributo do TENANT ATIVO, nunca do usuário (Inv-1).
- PRO: assinaturas ilimitadas. FREE: até 10 pedidos por mês.
- O limite é verificado na CRIAÇÃO do pedido (superfície interna, com sessão).
- A rota pública (sem sessão) NUNCA verifica plano — apenas honra um pedido válido.
- A spec expressa a REGRA (o quê), não a implementação de contagem.

EDGE CASES (devem aparecer na spec):

- Token expirado antes de o terceiro assinar.
- Token já utilizado (tentativa de reuso).
- Terceiro sem smartphone → fallback de assinatura manual (US4).
- Perda de conexão durante a captura.
- Tenant free atinge o limite mensal ao criar novo pedido.
- Acesso à rota pública com token inválido/inexistente.

RESTRIÇÕES OBRIGATÓRIAS (constituição):

- Isolamento multi-tenant em toda gravação/consulta; a rota pública resolve o tenant a
  partir do token, NUNCA de input do cliente.
- Validação de schema (Zod) em toda Server Action.
- Testes obrigatórios: unitários (regras/validações) + integração (Server Actions / Route
  Handlers / queries) contra Postgres EFÊMERO (NÃO SQLite), incluindo o caminho crítico de
  isolamento multi-tenant.
- Erros expressos como códigos de domínio (VALIDATION, NOT_FOUND, FORBIDDEN,
  QUOTA_EXCEEDED, e estados públicos "expirado"/"já utilizado"), não HTTP cru.

FORA DE ESCOPO (liste como "Out of Scope"; NÃO especificar como requisito desta fatia):

- Envio do link por WhatsApp/SMS/e-mail (depende da issue #66 — integrações externas).
- Storage externo de imagem (ex.: Backblaze) — a imagem fica no banco nesta fatia.
- Integração com o módulo real de entrega de EPI (vive em branch irmã); apenas o caminho
  de plug-in é documentado.
- Tempo real via SSE (usa-se polling); contador/cron de quota (usa-se contagem derivada).

CRITÉRIOS DE ACEITE (verificáveis): espelhe os success criteria — token único e seguro com
expiração; QR aponta para a rota pública com o token; rota pública valida o token e exibe o
formulário correto; assinatura persistida e vinculada à origem; status atualiza sem
recarregar (<5s); token expirado/usado retorna estado adequado; ao menos um consumidor
(demo) integrado via contrato; gate de plano (free limitado, pro ilimitado, plano do tenant
ativo); isolamento multi-tenant garantido.

DISCIPLINA DE SPEC:

- Conteúdo da spec em PORTUGUÊS BRASILEIRO; branch, código e identificadores em INGLÊS.
- Mantenha a spec no nível de O QUÊ e POR QUÊ. NÃO descreva implementação técnica (schema,
  bibliotecas, nomes de arquivo) — isso pertence ao /speckit-plan e já está no briefing.
- Toda user story independentemente testável e priorizada (P1/P2/P3).
- Todo requisito funcional inequívoco e verificável; se algo estiver genuinamente ambíguo e
  não resolvido pelo briefing, marque com [NEEDS CLARIFICATION: pergunta específica] em vez
  de assumir.
- Não invente requisitos fora do briefing e da issue #67.
