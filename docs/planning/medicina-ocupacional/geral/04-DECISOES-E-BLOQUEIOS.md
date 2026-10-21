# 04 · Registro de decisões e bloqueios

> **Documento dinâmico. Registro central, mantido pelo coordenador.** Última atualização: **2026-10-21**.
> A lista completa de pendências da Fase 0, por pessoa, continua em [`../DECISIONS.md`](../DECISIONS.md), sem alterações.
> Este registro **operacionaliza** as decisões que afetam os lotes: dá ID estável, estado, fonte e próxima ação a cada uma.
> A coluna "DECISIONS.md" mostra o ID correspondente na Fase 0.
>
> **Regra:** uma decisão só muda de estado com **fonte e data**. Hipótese não vira decisão por estar escrita aqui.
> Respostas parciais ficam `PARCIALMENTE_RESPONDIDA`, e o que falta vira entrada própria.

## Estados

| Estado | Significado |
|---|---|
| `PENDENTE` | Pergunta sem resposta |
| `PARCIALMENTE_RESPONDIDA` | Há resposta, mas ela não cobre tudo; o restante está em entradas `PENDENTE` |
| `RESPONDIDA` | A parte interessada respondeu por completo |
| `APROVADA_TECNICAMENTE` | O desenho técnico derivado foi aprovado pelo Douglas |
| `REVOGADA` | Resposta retirada pela própria fonte |
| `SUBSTITUIDA` | Trocada por outra entrada, que deve ser indicada |

## 1. Bloqueios ativos por lote

| Lote | Bloqueado? | Por quê | Entradas |
|---|---|---|---|
| 01 | **Não por decisão de produto ou técnica.** Pendência de gestão: aceite do Douglas (MED-DEC-25) | Escopo aceito pelo Carlos. Acabamento opcional | MED-DEC-25; 16, 17, 18 (opcionais) |
| 02 | Sim, para migrations | Ordem e numeração dependem da #112; estratégia de migrations | MED-DEC-08, 26 (+ 15 arquivamento, 23 transferência, 24 catálogo) |
| 03 | Parcial | A autorização de validação foi parcialmente respondida | MED-DEC-01…07, 10, 13 |
| 04 | Não começou (estado `PLANEJADO`); **dependências futuras** a resolver antes de iniciar | Identidade, emissão, campos, estados, assinatura | MED-DEC-04, 12, 14, 19, 28 |
| 05 | Sim (`BLOQUEADO`) | NOB-98 sem validador; periodicidade | MED-DEC-01…07, 27 + merge da #112 |
| 06 | Sim (`BLOQUEADO`) | Escopo de portais | MED-DEC-21 |

## 2. Registro

### MED-DEC-01: Quem concede a autorização para validar tecnicamente os riscos do PGR

| Campo | Valor |
|---|---|
| Responsável | Expedito (produto) |
| Status | **`PARCIALMENTE_RESPONDIDA`** |
| Pergunta | Em 20/10/2026, Rikelvin perguntou quem deve conceder autorização para que um profissional valide tecnicamente os riscos do PGR. Opções: (1) administrador do sistema ou escritório; (2) responsável técnico da empresa; (3) outro profissional ou setor definido pela empresa. Também perguntou se é necessário registrar os dados de identificação profissional de quem valida |
| Resposta | "Opção 03. A empresa mesmo define quem vai autorizar. E sim; é importante registrar os dados desse profissional." |
| Fonte | Resposta de Expedito no grupo, 21/10/2026 |
| Data | 2026-10-21 |
| **Confirmado** | (a) A **empresa** define quem concede a autorização. (b) Os **dados de identificação do profissional** que valida devem ser registrados |
| **Não definido** (vira as entradas 02–07) | Qual usuário da empresa indica o autorizador; se o autorizador também valida; categorias profissionais; comprovação de identidade; profissionais externos; escopo; revogação; validações anteriores após revogação; justificativa de rejeição; modelo técnico Clerk/banco |
| Impacto | A resposta escolheu a opção 3; as opções 1 e 2 não são a regra padrão, **sujeito à MED-DEC-02** (se "empresa" significar o escritório, a leitura muda). Aponta para uma **designação por empresa** (alinhada à proposta P1, `company_medical_assignments`, em [`../AUDIT-DATABASE.md`](../AUDIT-DATABASE.md) §10.4), mas **não aprova** P1. Confirma que `medicos` precisa de mais campos de identificação (hoje: nome, CRM sem UF, especialidade) |
| Issues | NOB-98 (Rikelvin), NOB-121, NOB-109, NOB-110 |
| Lotes afetados | 03, 04, 05 |
| Próxima ação | Publicar o comentário de atualização na NOB-98 (§3) **após autorização do Carlos**; coletar MED-DEC-02…07 |

### MED-DEC-02: Quem, na "empresa", indica o autorizador (e o que é "empresa")

| Campo | Valor |
|---|---|
| Responsável | Expedito |
| Status | `PENDENTE` |
| Pergunta | "Empresa" na resposta do MED-DEC-01 é a **empresa-cliente** (`companies`) ou o **escritório** de SST (`orgs`, o tenant)? Qual usuário dessa empresa pode indicar o autorizador? |
| Resposta | — |
| Fonte | Ambiguidade identificada na organização de 2026-10-21 (coordenador) |
| Impacto | Hoje **nenhum usuário da empresa-cliente acessa o sistema**: o papel `client` é bloqueado por `requireOfficeStaff()`, e `org_memberships.scoped_company_id` existe mas não é aplicado ([`../AUDIT-SECURITY.md`](../AUDIT-SECURITY.md) E6–E8). Se for a empresa-cliente, é preciso um perfil ou portal de empresa (MED-DEC-21), ou um registro feito pelo escritório **em nome** da empresa, com evidência da indicação |
| Issues | NOB-98, NOB-121, NOB-122 |
| Lotes | 03, 06 |
| Próxima ação | Incluir na pergunta de acompanhamento (§3) |

### MED-DEC-03: O autorizador também valida? Quais categorias profissionais podem validar?

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides |
| Status | `PENDENTE` |
| Pergunta | A pessoa que concede a autorização pode ela mesma validar riscos? Quais profissionais podem validar riscos para uso no PCMSO (só o médico coordenador do PCMSO? qualquer médico do trabalho? outras categorias)? |
| Resposta | — |
| Fonte | Lista "ainda não definido" do MED-DEC-01; [`../DECISIONS.md`](../DECISIONS.md) A-01 |
| Impacto | Define a regra de quem pode inserir uma revisão (P5) |
| Issues | NOB-98, NOB-109 |
| Lotes | 03, 05 |
| Próxima ação | Perguntar ao Dr. Alcides |

### MED-DEC-04: Comprovação da identidade profissional e modelo técnico (Clerk ↔ profissional ↔ banco)

| Campo | Valor |
|---|---|
| Responsável | Douglas (com Rikelvin) |
| Status | `PENDENTE` |
| Pergunta | Quais dados de identificação são obrigatórios (CRM + UF, RQE, CPF?) e como se comprova a identidade? Como o usuário do Clerk se liga ao cadastro `medicos`? |
| Resposta | — |
| Fonte | MED-DEC-01; [`../DECISIONS.md`](../DECISIONS.md) E-01, D-03 |
| Impacto | Pré-requisito para validação de riscos, assinatura do ASO e coordenação do PCMSO |
| Issues | NOB-98, NOB-121, NOB-110 |
| Lotes | 03, 04 |
| Próxima ação | Proposta técnica do Carlos sobre P1, para revisão do Douglas e do Rikelvin, depois de MED-DEC-02/03 |

### MED-DEC-05: Profissionais externos (clínica parceira) podem validar?

| Campo | Valor |
|---|---|
| Responsável | Expedito |
| Status | `PENDENTE` |
| Pergunta | Um profissional que não é membro do escritório pode receber a autorização? Como ele entra no sistema? |
| Resposta | — |
| Fonte | MED-DEC-01; [`../DECISIONS.md`](../DECISIONS.md) E-01 |
| Impacto | Membership no Clerk, convites, escopo |
| Issues | NOB-98, NOB-121, NOB-122 |
| Lotes | 03, 06 |
| Próxima ação | Pergunta de acompanhamento (§3) |

### MED-DEC-06: Escopo, revogação e validações anteriores

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides + Expedito |
| Status | `PENDENTE` |
| Pergunta | A autorização vale por empresa-cliente ou para o escritório inteiro? Como se revoga? Quando o profissional é trocado ou revogado, as validações que ele já fez continuam valendo? |
| Resposta | — |
| Fonte | MED-DEC-01; [`../DECISIONS.md`](../DECISIONS.md) A-01 |
| Impacto | Vigência (`valid_from`/`valid_to`/`revoked_at`) e regra de uso de revisões antigas |
| Issues | NOB-98, NOB-109 |
| Lotes | 03, 05 |
| Próxima ação | Pergunta de acompanhamento (§3) |

### MED-DEC-07: Justificativa obrigatória em validação e rejeição

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides |
| Status | `PENDENTE` |
| Pergunta | Validar exige nota? Rejeitar exige motivo? |
| Resposta | — |
| Fonte | MED-DEC-01; [`../AUDIT-LINEAR-QA.md`](../AUDIT-LINEAR-QA.md) §4.7, pergunta 5 |
| Lotes | 03 |
| Próxima ação | Pergunta de acompanhamento (§3) |

### MED-DEC-08: Ordem de merge da PR #112 e numeração das migrations da Medicina

| Campo | Valor |
|---|---|
| Responsável | Douglas (com Rikelvin) |
| Status | `PENDENTE` |
| Pergunta | A #112 (que reserva 0054/0055) entra antes de qualquer migration da Medicina? Quem faz o retarget para develop, resolve o conflito do Postman e roda o CI? |
| Resposta | — |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-01, R-01; estado verificado em 2026-10-21: #112 aberta, base = branch do NOB-100, "no checks reported" |
| Impacto | Libera o Lote 02. Merge em develop aplica migration na homologação ([06](06-GIT-MIGRATIONS-CD.md)) |
| Issues | NOB-98, NOB-112 |
| Lotes | 02, 03 |
| Próxima ação | Levar ao Douglas e ao Rikelvin |

### MED-DEC-09: Aceitar o efeito da migration 0055 (riscos ocultos sem módulo PGR)

| Campo | Valor |
|---|---|
| Responsável | Douglas + Expedito |
| Status | `PENDENTE` |
| Pergunta | Empresas sem PGR habilitado deixam de ver riscos, avaliações, medidas e EPI de risco. Isso é aceito como regra de produto? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-02, R-03; [`../AUDIT-DATABASE.md`](../AUDIT-DATABASE.md) §4.4 |
| Lotes | 03, 05 |
| Próxima ação | Antes do merge da #112 |

### MED-DEC-10: Dono da identidade profissional (NOB-121 × NOB-98) e reescopo da NOB-111

| Campo | Valor |
|---|---|
| Responsável | Douglas (com Carlos e Rikelvin) |
| Status | `PENDENTE` |
| Pergunta | A NOB-121 (Carlos) modela identidade e designação, e a NOB-98 (Rikelvin) consome? A NOB-111 é reescopada para UX + documento no GED sobre o contrato da #112? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-03, D-04 |
| Lotes | 03 |
| Próxima ação | Alinhamento com o Douglas |

### MED-DEC-11: Arquitetura de isolamento para dado clínico (A × B × C)

| Campo | Valor |
|---|---|
| Responsável | Douglas |
| Status | `PENDENTE` |
| Pergunta | RLS atual + segregação clínica (A), schema `clinical` (B) ou banco por cliente (C, como propõe a especificação do protótipo, com emenda MAJOR da constituição)? |
| Fonte | [`../AUDIT-SECURITY.md`](../AUDIT-SECURITY.md) §10.3 (recomendação: A agora, evoluindo para B); [`../DECISIONS.md`](../DECISIONS.md) D-05 |
| Impacto | Pré-requisito para qualquer dado clínico além da conclusão do ASO |
| Lotes | 02 (auditoria clínica), 04, 06 |
| Próxima ação | ADR com o Douglas |

### MED-DEC-12: Camada de emissão de documentos com snapshot (P7)

| Campo | Valor |
|---|---|
| Responsável | Douglas |
| Status | `PENDENTE` |
| Pergunta | Estender `documents` e o pipeline existente, ou tabelas próprias de Medicina? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-06; [`../AUDIT-DATABASE.md`](../AUDIT-DATABASE.md) §10.3 |
| Lotes | 04, 05 |
| Próxima ação | Desenho para revisão do Douglas, no início do Lote 04 |

### MED-DEC-13: Lista C (significado, fonte e versão) e dependência NOB-110 → NOB-113

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides (conteúdo); Douglas (dependência no Linear) |
| Status | `PENDENTE` |
| Pergunta | "Lista C" é a do Anexo II do Decreto 3.048/99 (NTEP, CID × CNAE), como declara o protótipo? Qual a fonte oficial e a versão vigente? Classe ou subclasse CNAE? Se confirmado, remover a dependência NOB-110 → NOB-113 |
| Fonte | [`../AUDIT-PROTOTYPE.md`](../AUDIT-PROTOTYPE.md) §5.12; [`../DECISIONS.md`](../DECISIONS.md) A-02, D-10 |
| Lotes | 03, 05 |
| Próxima ação | Perguntar ao Dr. Alcides |

### MED-DEC-14: Campos obrigatórios do ASO, quem emite, riscos não validados no ASO

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides |
| Status | `PENDENTE` |
| Pergunta | Quais campos são obrigatórios? O que é conclusão e o que é dado sigiloso? Quem pode emitir? O ASO pode listar riscos ainda não validados, com aviso? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) A-03, A-04, A-05 |
| Lotes | 04 |
| Próxima ação | Perguntar ao Dr. Alcides antes do Lote 04 |

### MED-DEC-15: Prazo de guarda e arquivamento de exames

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides + jurídico |
| Status | `PENDENTE` |
| Pergunta | 20 anos? 30 com amianto ou radiação ionizante? Excluir funcionário ou empresa com exame deve arquivar em vez de apagar? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) A-07; hoje há CASCADE (`../AUDIT-SECURITY.md` E33) |
| Lotes | 02 (arquivamento) |
| Próxima ação | Perguntar |

### MED-DEC-16: Empresa nova nasce sem módulo Medicina

| Campo | Valor |
|---|---|
| Responsável | Expedito |
| Status | `PENDENTE` |
| Pergunta | Empresa criada nasce com Medicina, passa por wizard, ou continua manual (owner habilita)? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) E-03; `createCompany` não habilita módulos (verificado) |
| Impacto | **Não bloqueia o Lote 01**: o estado vazio do painel trata o caso, e só muda o texto exibido |
| Lotes | 01 (texto), 02 |
| Próxima ação | Perguntar; o Lote 01 segue com o comportamento atual |

### MED-DEC-17: Token de acento teal e contraste AA das pílulas de status

| Campo | Valor |
|---|---|
| Responsável | Douglas |
| Status | `PENDENTE` |
| Pergunta | Aprovar `--color-module-medicine: #0d6b63` como acento do módulo? Unificar `StatusBadge` e corrigir o contraste das pílulas? |
| Fonte | [`../AUDIT-UX.md`](../AUDIT-UX.md) §10.1; [`../DECISIONS.md`](../DECISIONS.md) D-09 |
| Impacto | **Opcional no Lote 01**: sem aprovação, o lote sai sem teal |
| Lotes | 01 |
| Próxima ação | Perguntar ao Douglas |

### MED-DEC-18: Aviso no campo "Observações" do exame

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides |
| Status | `PENDENTE` |
| Pergunta | Exibir "não registre diagnóstico ou CID" no campo livre `notes`? |
| Fonte | [`../FIRST-MVP.md`](../FIRST-MVP.md) §2; [`../AUDIT-SECURITY.md`](../AUDIT-SECURITY.md) R7 |
| Impacto | Opcional no Lote 01 |
| Lotes | 01 |
| Próxima ação | Perguntar |

### MED-DEC-19: Provedor de assinatura técnica (ICP-Brasil)

| Campo | Valor |
|---|---|
| Responsável | Expedito + Douglas |
| Status | `PENDENTE` |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) E-07 |
| Impacto | Sem provedor, nenhum documento é marcado como assinado tecnicamente |
| Lotes | 04, 05 |

### MED-DEC-20: IA com qualquer conteúdo de saúde

| Campo | Valor |
|---|---|
| Responsável | Douglas (+ jurídico) |
| Status | `PENDENTE` |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-08; [`../AUDIT-SECURITY.md`](../AUDIT-SECURITY.md) R5 |
| Impacto | Até decidir, **nenhum dado de saúde em prompt** (regra permanente) |
| Issues | NOB-125 |

### MED-DEC-21: Perfis e portais da V1 (RH, clínica, trabalhador)

| Campo | Valor |
|---|---|
| Responsável | Expedito |
| Status | `PENDENTE` |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) E-02 |
| Lotes | 06 (e MED-DEC-02) |

### MED-DEC-22: Autorizações operacionais do Carlos

| Item | Status | Fonte |
|---|---|---|
| Commit e push da documentação na branch do Lote 01 (sem PR) | `RESPONDIDA` (autorizado). Substitui a C-03 da Fase 0 (que previa uma branch `docs/`) | Missão de organização, 2026-10-21, §5 e §28 |
| Publicar o comentário na NOB-98 (§3) (C-02) | `PENDENTE` | §3 deste documento |
| Anexar a auditoria como evidência nas issues de Medicina (C-04) | `PENDENTE` | [`../DECISIONS.md`](../DECISIONS.md) C-04 |
| Remover a worktree somente leitura `develop-ro` (scratchpad) | `PENDENTE`: recomendado, não exigido | Missão §5 |

### MED-DEC-23: Visibilidade dos exames após a transferência do funcionário entre empresas

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides + Expedito |
| Status | `PENDENTE` |
| Pergunta | Quando um funcionário passa de uma empresa-cliente para outra (no mesmo escritório), a empresa nova pode ver os exames feitos na anterior? |
| Resposta | — |
| Fonte | Planejamento do Lote 02 (`../lotes/02-formularios-e-auditoria/`), 2026-10-21. Hoje a visibilidade segue o `employees.company_id` **atual** ([`../AUDIT-ARCHITECTURE.md`](../AUDIT-ARCHITECTURE.md) R4) |
| Impacto | Define a regra de leitura de `health_exams.company_id` (empresa na data do exame) |
| Lotes | 02 |
| Próxima ação | Perguntar antes da migration do Lote 02 |

### MED-DEC-24: Catálogo de procedimentos (por escritório ou global) e lista inicial

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides (conteúdo) + Carlos (modelo) |
| Status | `PENDENTE` |
| Pergunta | O catálogo de procedimentos/exames é mantido por escritório ou é uma referência global? Quais procedimentos entram na carga inicial? |
| Resposta | — |
| Fonte | Planejamento do Lote 02, 2026-10-21; proposta P4 em [`../AUDIT-DATABASE.md`](../AUDIT-DATABASE.md) §10.4 (desenhada por escritório) |
| Lotes | 02 |
| Próxima ação | Perguntar antes do Lote 02 |

### MED-DEC-25: Aceite do escopo do Lote 01 (FIRST-MVP)

| Campo | Valor |
|---|---|
| Responsável | Carlos (escopo) + Douglas (aceite técnico) |
| Status | **`PARCIALMENTE_RESPONDIDA`** |
| Pergunta | O escopo do [`../FIRST-MVP.md`](../FIRST-MVP.md) (ficha de saúde ocupacional, zero migration) é aceito como Lote 01? ([`../DECISIONS.md`](../DECISIONS.md) C-01; o FIRST-MVP pedia também o aceite do Douglas) |
| Resposta | **Carlos:** sim. A missão de organização define o Lote 01 como primeiro lote funcional, com o FIRST-MVP como "base obrigatória", e a implementação dele como próxima execução. **Douglas:** sem registro |
| Fonte | Missão de organização do Carlos, 2026-10-21, §13 e §30 |
| Data | 2026-10-21 |
| Impacto | O código do Lote 01 pode começar na branch. O aceite do Douglas é **recomendado antes do código** e **obrigatório na revisão da PR** (DoD em [07](07-CRITERIOS-DE-ENTREGA.md)). Se ele pedir mudança de escopo, o plano do lote é ajustado antes da PR |
| Issues | NOB-108 |
| Lotes | 01 |
| Próxima ação | Carlos apresentar o FIRST-MVP ao Douglas (pode ser em paralelo ao início do código) |

### MED-DEC-26: Estratégia de migrations com CD automático

| Campo | Valor |
|---|---|
| Responsável | Douglas |
| Status | `PENDENTE` |
| Pergunta | Haverá staging intermediário? Migrations só aditivas? Uma por PR? Janela para o release develop → main? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-07; [06](06-GIT-MIGRATIONS-CD.md) §3.1 (as regras de lá são **PROPOSTAS** até esta decisão) |
| Impacto | Toda migration: o merge em develop aplica na homologação, o merge em main aplica na produção |
| Lotes | 02, 03, 04, 05 |
| Próxima ação | Levar ao Douglas junto com a MED-DEC-08 |

### MED-DEC-27: Regras clínicas do protótipo que viram requisito (periodicidade e outras)

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides |
| Status | `PENDENTE` |
| Pergunta | Periodicidade 12/24 meses, dispensa do demissional 90/135 dias, retorno ≥ 30 dias, critérios de audiometria, fadiga e crônicos: quais valem? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) A-06; [`../AUDIT-PROTOTYPE.md`](../AUDIT-PROTOTYPE.md) §5.5 |
| Impacto | Até decidir, nenhuma tela calcula periodicidade (o Lote 01 mostra só a validade informada) |
| Lotes | 05 (plano de exames), painéis futuros |

### MED-DEC-28: Estados do documento médico e conteúdo do snapshot

| Campo | Valor |
|---|---|
| Responsável | Dr. Alcides (+ Douglas no desenho) |
| Status | `PENDENTE` |
| Pergunta | Rascunho → em revisão → emitido → assinado → retificado/cancelado: valem esses estados? O que entra no snapshot do ASO e do PCMSO? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) A-09; [`../AUDIT-DATABASE.md`](../AUDIT-DATABASE.md) §10.3 |
| Lotes | 04, 05 |

### MED-DEC-29: MFA obrigatório para owner e perfis de saúde

| Campo | Valor |
|---|---|
| Responsável | Douglas |
| Status | `PENDENTE` |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) D-12; [`../AUDIT-SECURITY.md`](../AUDIT-SECURITY.md) D9 |
| Lotes | antes de qualquer dado clínico além da conclusão do ASO |

### MED-DEC-30: Psicossocial (dono do módulo, COPSOQ, grupo mínimo)

| Campo | Valor |
|---|---|
| Responsável | Expedito + Dr. Alcides (+ Rikelvin) |
| Status | `PENDENTE` |
| Pergunta | O psicossocial fica no PGR ou passa à Medicina? O COPSOQ II substitui as perguntas livres? Grupo mínimo de 5 fixo, ou configurável a partir de 3? |
| Fonte | [`../DECISIONS.md`](../DECISIONS.md) E-04, A-08 |
| Lotes | fora dos lotes atuais (GAP-MATRIX MED-28) |

### 2.1 Correspondência com os IDs da Fase 0

Os documentos de lote podem citar os IDs de [`../DECISIONS.md`](../DECISIONS.md). Use esta tabela para achar a entrada
operacional. **Atenção:** "D-xx" em `AUDIT-SECURITY.md` e em `AUDIT-PROTOTYPE.md` são listas diferentes; abaixo, só os IDs de `DECISIONS.md`.

| DECISIONS.md | MED-DEC |
|---|---|
| D-01 | 08 |
| D-02 | 09 |
| D-03, D-04 | 10 |
| D-05 | 11 |
| D-06 | 12 |
| D-07 | 26 |
| D-08 | 20 |
| D-09 | 17 |
| D-10 | 13 |
| D-11 (bypass), D-13 (enum de exame), D-14 (Postman/CLAUDE.md) | sem entrada: fora da Medicina ou do lote atual; ver DECISIONS.md |
| D-12 | 29 |
| E-01 | 01, 05 |
| E-02 | 21 |
| E-03 | 16 |
| E-04 | 30 |
| E-05, E-06, E-08 | sem entrada: ver DECISIONS.md |
| E-07 | 19 |
| A-01 | 03, 06 |
| A-02 | 13 |
| A-03, A-04, A-05 | 14 |
| A-06 | 27 |
| A-07 | 15 |
| A-08 | 30 |
| A-09 | 28 |
| R-01 | 08 |
| R-02 | 04 (modelo), P5 do Lote 03 |
| R-03 | 09 |
| R-04, R-05, R-06 | sem entrada: ver DECISIONS.md |
| C-01 | 25 |
| C-02, C-03, C-04 | 22 |

## 3. Comentário proposto para a NOB-98 (não publicado)

> **Não publicado.** Comentar no Linear é ação visível ao time: exige autorização do Carlos. A NOB-98 é do Rikelvin;
> o comentário **não** muda o responsável nem o status. Não contém telefone nem dado pessoal.
>
> **Este texto `SUBSTITUI` o proposto em [`../DECISIONS.md`](../DECISIONS.md) §2.** Aquele foi escrito em 21/10, antes de se
> saber que o Rikelvin tinha feito a pergunta no grupo em 20/10 e que o Expedito respondeu em 21/10. A afirmação da Fase 0
> de que a pergunta "não chegou formalmente a ninguém" ([`../README.md`](../README.md), resumo executivo, item 3) ficou
> superada por essa informação. O documento original foi mantido sem edição, como registro histórico.

```
Atualização: autorização para validar riscos (NOB-98)

Pergunta feita pelo Rikelvin em 20/10 e respondida pelo Expedito no grupo em 21/10:
"Opção 03. A empresa mesmo define quem vai autorizar. E sim; é importante registrar os dados
desse profissional."

Confirmado:
- A empresa define quem concede a autorização para validar tecnicamente os riscos.
- Os dados de identificação do profissional que valida devem ser registrados.

Ainda em aberto (precisa de resposta antes de implementar o fluxo de validação):
1. "Empresa" é a empresa-cliente ou o escritório de SST? Hoje usuários da empresa-cliente não
   acessam o sistema. Quem, na empresa, indica o autorizador? (Expedito)
2. O autorizador também pode validar? Quais categorias profissionais podem validar riscos para
   o PCMSO? (Dr. Alcides)
3. Quais dados identificam o profissional (CRM + UF, RQE, outros) e como comprovar a identidade
   no sistema? (Douglas/Rikelvin, a partir das respostas acima)
4. Profissionais externos ao escritório podem receber a autorização? (Expedito)
5. A autorização vale por empresa ou para todo o escritório? Como se revoga? Validações feitas
   antes de uma revogação continuam valendo? (Dr. Alcides + Expedito)
6. Validar exige nota? Rejeitar exige motivo? (Dr. Alcides)

Enquanto isso, a #112 continua correta: riscos entram "pending" e canUseMedicalRisk só libera
"validated". Nenhum fluxo de concessão de permissão será implementado antes dessas respostas.
Registro completo: docs/planning/medicina-ocupacional/geral/04-DECISOES-E-BLOQUEIOS.md
(branch feature/NOB-108-ficha-saude-ocupacional).
```

## 4. Decisões já tomadas que todos os lotes respeitam

| Decisão | Fonte |
|---|---|
| Módulos PGR e Medicina por empresa-cliente, independentes do plano free/pro | NOB-97 / PR #109 |
| Cadastros comuns, sem cópia por módulo | NOB-99 / PR #110 |
| Só o owner altera a habilitação, com motivo | NOB-100 / PR #111 |
| Owner e colaborador **não** são responsáveis técnicos presumidos | spec NOB-98 / corpo da PR #112 |
| A empresa define quem concede a autorização; os dados do validador são registrados | MED-DEC-01 (parcial: escolha da opção 3, sujeita à MED-DEC-02), Expedito, 21/10/2026 |
| Não reconstruir o gerador de PGR do Douglas | missões de 21/10/2026 |

**Desenho em PR aberta (respeitado, mas ainda não é decisão final):** fontes de risco imutáveis, sempre `pending` na
entrada, inclusive as externas. Migration 0054 da PR #112, **não mergeada**.

## 5. Como registrar uma nova decisão

1. Criar uma entrada `MED-DEC-NN` com o próximo número livre. **Nunca reutilizar um ID.**
2. Preencher pergunta, resposta **literal**, fonte (canal + data, sem dado pessoal), impacto, issues, lotes e próxima ação.
3. Resposta incompleta: `PARCIALMENTE_RESPONDIDA`, com uma entrada nova para cada lacuna.
4. Atualizar [02](02-ROADMAP-E-STATUS.md) se o estado de algum lote mudar, e [08](08-HANDOFF.md) ao fim da sessão.
5. Não editar `../DECISIONS.md` (registro histórico da Fase 0).
