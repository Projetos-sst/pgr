# Lote 03 — AUDIT

> HEAD `d6b787c` + leitura da PR #112 feita na Fase 0. Não repete a auditoria: referencia. [README do lote](README.md)

## 1. Identidade profissional — situação

| Fato                                                                                                | Evidência                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `medicos` tem `name`, `crm` (texto, sem UF), `specialty`, `clinic` (texto livre), `phone`, `status` | `src/shared/db/schema/medicos.ts:25-40`                                                                 |
| Sem `user_id`, sem UF do CRM, sem RQE; `UNIQUE(org_id, crm)` colide entre UFs                       | idem; [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.2                                         |
| Único vínculo usuário ↔ escritório: `org_memberships`; `scoped_company_id` existe e não é aplicado  | `src/shared/db/schema/org-memberships.ts:27`; [`../../AUDIT-SECURITY.md`](../../AUDIT-SECURITY.md) §4.1 |
| Papéis de domínio: `owner`, `collaborator`, `client` (bloqueado); nenhum papel técnico/clínico      | `src/shared/tenant/active-tenant.ts`; CLAUDE.md                                                         |
| Psicólogos não cabem em `medicos`                                                                   | GAP-MATRIX MED-27                                                                                       |
| `health_exams.doctor_id` com `SET NULL`: apagar o médico apaga a autoria                            | `src/shared/db/schema/health-exams.ts:51`                                                               |

Consequência: **ninguém** pode hoje validar risco, assinar ASO ou coordenar PCMSO de forma rastreável.

## 2. Contrato de riscos — situação

| Estado                    | Conteúdo                                                                                                                                                                        | Fonte                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| IMPLEMENTADO (develop)    | Empresa → GES → risco; avaliação; medidas; `ges_job_roles`; escrita de risco exige módulo PGR (#113); leitura não restrita por módulo                                           | [`../../geral/03-ARQUITETURA-E-CONTRATOS.md`](../../geral/03-ARQUITETURA-E-CONTRATOS.md) §5.1 |
| EM DESENVOLVIMENTO (#112) | `medical_risk_sources/entries/events`; `kind` interno/externo; fingerprint; frescor; INSERT só `pending`; runtime sem UPDATE/DELETE; `canUseMedicalRisk` = `validated` ∧ fresco | idem §5.2; [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.4–4.5                      |
| Não cobre (#112)          | fluxo de validação; função/CBO/expostos na captura interna; classificação na externa; medidas/EPI; FK do documento externo; fingerprint inclui `pgr.updated_at`                 | [`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §4.5, §10.1                              |
| BLOQUEADO (decisão)       | quem valida, como se identifica, escopo, revogação, riscos não validados no ASO                                                                                                 | MED-DEC-02…07, 14                                                                             |

`reviewed_by` em `medical_risk_entries` é texto sem FK; aprovar exige migration nova porque a `0054` faz `REVOKE UPDATE, DELETE`
e a policy `medical_risk_entries_pending_insert` só aceita `pending` ([`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §4.7).

## 3. PGR externo — situação

- A #112 já implementa fonte `external` manual/JSON (até 500 itens, sempre `pending`, `reference` texto livre, sem upload).
- A NOB-111 pede "entrada de PGR externo com referência ao documento e registro estruturado dos riscos": **sobreposição forte**.
- Recomendação da Fase 0 (não decidida): reescopar a NOB-111 para UX + upload no GED + vínculo do documento, sobre o contrato da #112
  (MED-DEC-10).
- A `0055` faz empresas sem PGR dependerem só de `medical_risk_*` (MED-DEC-09).

## 4. Lista C — situação

- Protótipo: "Lista C – Anexo II do Decreto 3.048/99 (redação do Decreto 6.957/2009). Base PARCIAL (A15–K46)"; 18 grupos, 222 classes
  CNAE distintas; faltam M e S/T; pontos a validar (integralidade, grupos intermediários, redação vigente, classe × subclasse, formato,
  agravamento "mental") ([`../../AUDIT-PROTOTYPE.md`](../../AUDIT-PROTOTYPE.md) §5.12).
- **É NTEP (CID × CNAE), não catálogo de exames** (revisão cruzada X-2 da Fase 0). Não bloqueia o registro nem a emissão de ASO; alimenta
  afastamentos/NTEP e a seção de vigilância do PCMSO.
- Nada existe no repositório. Precedente técnico: `caepi_certificates` (tabela global, leitura `USING (true)`, escrita só via owner,
  `scripts/caepi-sync.ts` + `repositories/caepi-upsert.ts`).
- NOB-113 pede explicitamente "confirmar significado, fonte e versão… não inventar códigos".

## 5. Lacunas

1. Sem modelo de identidade nem de designação por empresa.
2. Sem fluxo de validação (e o banco o impede, corretamente, até haver desenho).
3. Ambiguidade empresa-cliente × escritório na resposta do Expedito; sem ator da empresa-cliente no sistema.
4. Dono da identidade indefinido (NOB-121 no milestone 6 é pré-requisito da NOB-98 e da NOB-110).
5. NOB-111 duplicando a #112.
6. Lista C sem fonte oficial confirmada; NOB-110/109 "bloqueadas por" NOB-113 no Linear sem necessidade técnica para o ASO.

## 6. Riscos

| Risco                                                | Impacto                                                  | Mitigação                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Implementar autorização a partir da resposta parcial | Regra errada em produção; aprovação em nome de terceiros | Lote BLOQUEADO até MED-DEC-02…07                                            |
| Dois contratos de riscos ou de PGR externo           | Retrabalho; dados divergentes                            | Regras de convivência ([`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §3) |
| "Owner atesta" como atalho (opção D da Fase 0)       | Contraria a spec da NOB-98; risco regulatório            | Fora de questão sem decisão explícita                                       |
| Importar a Lista C parcial como oficial              | Erro normativo propagado ao PCMSO                        | Só fonte oficial; base do protótipo só como fixture de teste do importador  |
| Coletar CPF do profissional sem necessidade          | LGPD (minimização)                                       | Dados mínimos decididos em MED-DEC-04                                       |
| Migration de identidade antes da #112                | Regerar `0054`/`0055`                                    | MED-DEC-08                                                                  |

## 7. Dependências

```
MED-DEC-02…06 + MED-DEC-10 ──► 3a (P1) ──► 3b (P5, Rikelvin) ──► Lote 04 (assinar ASO) · Lote 05 (PCMSO)
#112 mergeada + MED-DEC-09 ──► 3b, 3c, 3d
MED-DEC-13 ──► 3e (P2) ──► vigilância NTEP do PCMSO
MED-DEC-08 ──► toda migration
```
