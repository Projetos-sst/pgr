# Lote 00 — AUDIT

> Situação em 2026-10-21, base `origin/develop` = `d6b787c` (última migration `0053_company_module_access`; `origin/main` em
> `0052`). Não repete a Fase 0: referencia. [README do lote](README.md)

## 1. Situação existente

| Item | Estado | Evidência |
|---|---|---|
| Registro de decisões | Existe: Fase 0 em [`../../DECISIONS.md`](../../DECISIONS.md) (histórico, não editar) e registro vivo em [`../../geral/04-DECISOES-E-BLOQUEIOS.md`](../../geral/04-DECISOES-E-BLOQUEIOS.md) (MED-DEC-01…22) | arquivos desta pasta |
| Comentários no Linear | **Zero** em todas as 25 issues de Medicina e no projeto | [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.2 |
| Pergunta de autorização da NOB-98 | Feita pelo Rikelvin ao grupo em 20/10; **respondida parcialmente** pelo Expedito em 21/10 | MED-DEC-01 |
| PR #112 | Aberta, sem CI, base errada, conflito no Postman | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4 |
| Linear × GitHub | NOB-102/103/104 com PR mergeada e status atrasado; NOB-94 em Backlog bloqueando issues Done | [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.6 |

## 2. NOB-98 e a pergunta de autorização

- **Antes de 20/10** a pendência existia só no corpo da PR #112 e na spec da branch (`.specs/20261020-nob-98/spec.md:55-59`,
  arquivo da branch do Rikelvin, ausente em develop): "quem concede autorização de validação e como identificar o
  profissional" ([`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.7).
- **20/10/2026:** Rikelvin perguntou no grupo quem concede a autorização (1. administrador do sistema/escritório;
  2. responsável técnico da empresa; 3. outro profissional ou setor definido pela empresa) e se os dados de identificação de
  quem valida devem ser registrados.
- **21/10/2026:** Expedito respondeu: *"Opção 03. A empresa mesmo define quem vai autorizar. E sim; é importante registrar os
  dados desse profissional."* Fonte: resposta de Expedito no grupo, 21/10/2026. Status: **PARCIALMENTE_RESPONDIDA**.
- **O que a resposta não cobre** (cada item é uma entrada própria no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md)): qual usuário
  da empresa indica o autorizador (MED-DEC-02); se o autorizador também valida e quais categorias validam (MED-DEC-03);
  comprovação de identidade e modelo Clerk/banco (MED-DEC-04); externos (MED-DEC-05); escopo, revogação e validações
  anteriores (MED-DEC-06); justificativa de rejeição (MED-DEC-07).
- **Ambiguidade:** "empresa" pode ser a empresa-cliente (`companies`) ou o escritório (`orgs`, o tenant). Se for a
  empresa-cliente, hoje não há ator: o papel `client` é recusado por `requireOfficeStaff()` e
  `org_memberships.scoped_company_id` (`src/shared/db/schema/org-memberships.ts:27`) existe mas não é aplicado em nenhuma
  consulta ([`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §4.1). Registrar "em nome da empresa" pelo escritório esbarra
  na regra permanente "não aprovar em nome de terceiros".
- **Comportamento atual correto:** na #112, `canUseMedicalRisk` só libera `validated` e a `0054` só aceita INSERT `pending`;
  nenhum risco é utilizável pelo PCMSO até haver fluxo de validação.

## 3. PR #112

| Aspecto | Fato | Fonte |
|---|---|---|
| Base | `codex/NOB-100-feat/servicos-por-empresa` (merge-base `044334e` já está em develop) → precisa de retarget para `develop` | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4 |
| CI | "no checks reported": `ci.yml` só dispara para PR com base `develop`/`main` | [`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.7 |
| Conflito | Único conflito textual: `docs/api/sst-manager.postman_collection.json` | idem |
| Migrations | `0054_medical_risk_sources` (`when` 1792513283573) e `0055_pgr_inventory_module_access` (`when` 1792515723005) | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4 |
| Efeito da `0055` | Empresas **sem PGR** deixam de ver risco, avaliação, medida, AEP e vínculo EPI em todo o app | idem; MED-DEC-09 |
| Contrato | `medical_risk_sources/entries/events`, imutáveis no runtime; `kind` `internal`/`external`; fingerprint SHA-256 | [`../../geral/03-ARQUITETURA-E-CONTRATOS.md`](../../geral/03-ARQUITETURA-E-CONTRATOS.md) §5.2 |
| Não cobre | Fluxo de validação; função na captura interna; classificação na externa; medidas/EPI | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.1 |
| Interface | Acrescenta "Riscos para PCMSO" → `/medical-risks` no grupo Medicina do `NAV` (`nav-menu.tsx` l.102-110) — **mesmo trecho que o Lote 01 altera** | [`../../AUDIT-UX.md`](../../AUDIT-UX.md) §4.3 |

## 4. Arquitetura multi-tenant

- **Implementado:** tenant = escritório (`orgs.id`), `withOrg` + RLS `app.current_org`; módulo por empresa via
  `company_modules` + `companyModuleScope` (`src/shared/db/schema/module-policy.ts:5-13`) como policy RESTRICTIVE; em
  `health_exams` a policy `health_exams_module_access` (`src/shared/db/schema/health-exams.ts:63-70`) checa o módulo
  `medicine` da empresa **atual** do funcionário.
- **Divergência estratégica:** a especificação do protótipo pede banco por cliente; o código é banco compartilhado + RLS.
  Opções A (RLS + segregação clínica), B (schema `clinical`), C (banco por cliente; exige emenda MAJOR da constituição).
  Recomendação da Fase 0: A agora, evoluindo para B na camada clínica ([`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §10.3).
  **Decisão do Douglas, pendente** (MED-DEC-11).
- **Lacuna de perfil:** só existem "escritório" (owner/collaborator) e `client` bloqueado. Não há papel clínico.

## 5. Identidade profissional

- `medicos` (`src/shared/db/schema/medicos.ts:25-40`): `name`, `crm` (texto, sem UF), `specialty`, `clinic` (texto livre),
  `phone`, `status`. **Sem `user_id`, sem UF do CRM, sem RQE.** `UNIQUE(org_id, crm)` colide entre UFs.
- O único vínculo usuário ↔ escritório é `org_memberships`. Nenhuma tabela liga um usuário autenticado a um profissional.
- A mesma lacuna trava NOB-98 (validar), NOB-110 (assinar/emitir), NOB-109 (coordenar PCMSO), NOB-121 (permissões por
  vínculo) e NOB-122 (clínica). Dono a decidir (MED-DEC-10). Proposta técnica P1 descrita em
  [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.4 — **não aprovada**.

## 6. Validação clínica (Dr. Alcides)

Perguntas abertas que afetam lotes: quem valida riscos e o que "validar" significa (A-01 → MED-DEC-03); Lista C
(A-02 → MED-DEC-13); campos do ASO, conclusão × sigiloso, quem emite, riscos não validados no ASO (A-03/04/05 → MED-DEC-14);
regras clínicas do protótipo (A-06); prazo de guarda (A-07 → MED-DEC-15); estados do documento (A-09). Nenhuma foi
respondida. Não há registro de que tenham chegado ao Dr. Alcides por canal formal.

## 7. Fluxo ASO/PCMSO

- **ASO hoje:** só **registro** (`health_exams`, fatia 027 + RLS da `0053`). Não há emissão, snapshot, GED de ASO nem
  assinatura técnica. Proposta de fluxo: registro → emissão com snapshot imutável → ciência do trabalhador → assinatura técnica
  ([`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.3). Detalhe no [Lote 04](../04-aso/README.md).
- **PCMSO hoje:** inexistente. Exige fontes validadas (NOB-98 completa), coordenador designado (P1), procedimentos (P4) e
  camada de emissão (P7).

## 8. Ordem de migrations e CD

- `cd.yml` (push em `develop`/`main`) roda `drizzle-kit migrate` **antes** do deploy (`.github/workflows/cd.yml:67-75`):
  **merge em develop aplica a migration na homologação; merge em main aplica na produção.** Não há rollback de schema.
- O migrator pula, sem erro, migration com `when` menor que o último aplicado (caso `0026`/`0027`); todo `when` novo tem de
  ser maior que 1792515723005 se a #112 entrar ([`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.1).
- O helper de testes aplica os `.sql` em ordem alfabética e não lê o `_journal.json` (`src/__tests__/integration/_helpers/db.ts:54`).
- **Numeração da Medicina não definida.** As propostas P1–P9 "0056+" são indicativas (MED-DEC-08).

## 9. Lacunas

1. Nenhuma pergunta ou decisão registrada no Linear.
2. Resposta parcial do Expedito sem a parte clínica (Dr. Alcides) nem a técnica (Douglas).
3. Ordem de merge da #112 sem dono declarado.
4. Dependência NOB-94 (Backlog) bloqueando issues Done; NOB-93 sem responsável bloqueando NOB-112/113.
5. NOB-111 sobreposta à #112 sem reescopo.

## 10. Riscos

| Risco | Impacto | Mitigação neste lote |
|---|---|---|
| Interpretar a resposta parcial como regra completa | Implementar concessão sem decisão clínica; aprovação em nome de terceiros | Manter MED-DEC-01 `PARCIALMENTE_RESPONDIDA`; nada é implementado |
| Migration da Medicina mergeada antes da #112 | Rikelvin precisa regerar `0054`/`0055` e snapshots | Nenhuma migration até MED-DEC-08 |
| Mergear a #112 sem aceite da `0055` | Empresas sem PGR perdem visão de riscos sem aviso | Levar MED-DEC-09 ao Douglas e Expedito antes do merge |
| Conflito no `nav-menu.tsx`, `api-design.md` e Postman entre #112 e Lote 01 | Retrabalho de merge | Combinar ordem com o Rikelvin ([PLAN §3](PLAN.md#3-convivência-com-o-trabalho-do-rikelvin)) |
| Linear desatualizado | Planejamento sobre estado errado | Ação de coerência com Rikelvin/Douglas ([TASK](TASK.md)) |

## 11. Decisões técnicas já respeitadas

Ver [`../../geral/04-DECISOES-E-BLOQUEIOS.md` §4](../../geral/04-DECISOES-E-BLOQUEIOS.md#4-decisões-já-tomadas-que-todos-os-lotes-respeitam).
