# Lote 00 — PLAN

> Plano de alinhamento. **Não há código, tabela, API ou migration neste lote.** O "resultado" é decisão registrada com
> fonte e data no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md). [README do lote](README.md) · [AUDIT](AUDIT.md) · [TASK](TASK.md)

## 1. Resultado esperado

| Resultado                                                                           | Critério de pronto                                                               | Destrava                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| Pergunta de acompanhamento da NOB-98 registrada formalmente (se o Carlos autorizar) | Comentário publicado com destinatários; link do comentário anotado em MED-DEC-01 | Coleta de MED-DEC-02…07             |
| MED-DEC-02…07 respondidas ou com prazo                                              | Cada entrada com resposta literal + fonte + data, ou "aguardando <pessoa>"       | Lote 03 (P1, P5) → Lote 05          |
| Ordem de merge da #112 e numeração das migrations decididas                         | MED-DEC-08 `RESPONDIDA` pelo Douglas                                             | Lote 02                             |
| Aceite (ou recusa) do efeito da `0055`                                              | MED-DEC-09 `RESPONDIDA` por Douglas + Expedito                                   | merge da #112                       |
| Dono da identidade profissional e reescopo da NOB-111                               | MED-DEC-10 `RESPONDIDA`; issues ajustadas no Linear pelo dono                    | Lote 03                             |
| ADR de arquitetura clínica                                                          | MED-DEC-11 `RESPONDIDA`                                                          | tabelas clínicas (Lotes 02, 04, 06) |
| Linear coerente com o GitHub                                                        | NOB-102/103/104 e NOB-94/93 ajustadas por quem tem a autoridade                  | planejamento confiável              |

## 2. Princípios

1. **Um registro só.** Decisão nova vira `MED-DEC-NN` no [04](../../geral/04-DECISOES-E-BLOQUEIOS.md) (escrito pelo coordenador),
   seguindo o §5 de lá. Este lote não mantém tabela paralela de decisões.
2. **Resposta parcial continua parcial.** MED-DEC-01 fica `PARCIALMENTE_RESPONDIDA` até as lacunas serem respondidas.
3. **Ninguém decide por terceiros.** Carlos registra; Douglas, Expedito, Dr. Alcides e Rikelvin decidem no que é deles.
4. **Nada é publicado sem autorização.** Comentário no Linear, mudança de status e escrita em PR alheia exigem o Carlos.
5. **Não bloquear o Lote 01.** O Lote 01 é zero migration e não lê riscos; nenhuma pendência daqui o trava.

## 3. Convivência com o trabalho do Rikelvin

Regras herdadas de [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md) §3 (não reabrir):

| #   | Regra                                                     | Consequência prática                                                                                                     |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | O único contrato PGR → Medicina é `medical_risk_*` (#112) | A Medicina não cria leitura paralela de `risks`                                                                          |
| 2   | Não há segundo cadastro de PGR externo                    | NOB-111 é reescopada sobre a #112 (MED-DEC-10)                                                                           |
| 3   | Ajustes no contrato são **propostos** ao Rikelvin         | Função/CBO no snapshot interno, classificação na externa, fingerprint sem `pgr.updated_at`: propostas, não implementação |
| 4   | Fonte externa nunca nasce validada                        | Já garantido pela `0054`                                                                                                 |
| 5   | Empresa só com Medicina não precisa de PGR                | A fonte externa cobre; cadastros comuns continuam visíveis                                                               |

**Arquivos com risco de conflito entre a #112 e o Lote 01** (combinar a ordem de merge com o Rikelvin):

| Arquivo                                                                    | #112                                     | Lote 01                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| `src/app/(protected)/_components/nav-menu.tsx` (grupo Medicina, l.102-110) | + "Riscos para PCMSO" → `/medical-risks` | + "Painel" → `/medicine`                                  |
| `docs/api/api-design.md`                                                   | + recurso `medical-risk-sources`         | + `medicine/overview` e filtros de `health-exams`         |
| `docs/api/sst-manager.postman_collection.json`                             | conflito já existente com develop        | + pasta/requests de Medicina                              |
| `src/shared/domains/medicine/`, `src/shared/server/actions/medicine/`      | cria o namespace                         | cria arquivos novos no mesmo namespace (nomes diferentes) |

Proposta (HIPÓTESE, a combinar): quem mergear depois faz o rebase e resolve as listas; a ordem dos itens no grupo Medicina
fica "Painel, Exames e ASO, Riscos para PCMSO, Médicos".

## 4. Ordem de migrations (proposta, não decidida)

| Passo | O quê                                                                                                                                                              | Dono               | Estado                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------ |
| 1     | Retarget da #112 para `develop`, resolver conflito do Postman, rodar CI                                                                                            | Rikelvin           | pendente (R-01)                |
| 2     | Teste de regressão das leituras que dependem de `risks` sob a `0055` (psicossocial, OS, PDF)                                                                       | Rikelvin           | pendente (R-03)                |
| 3     | Aceite do efeito da `0055`                                                                                                                                         | Douglas + Expedito | pendente (MED-DEC-09)          |
| 4     | Decisão: #112 entra antes de qualquer migration da Medicina?                                                                                                       | Douglas            | pendente (MED-DEC-08)          |
| 5     | Só então: primeira migration da Medicina (Lote 02), gerada por `drizzle-kit generate` após rebase, `when` maior que o último, aditiva, `text` + CHECK para estados | Carlos             | **bloqueado** pelos passos 1–4 |

Regras para toda migration futura: [`../../IMPLEMENTATION-PLAN.md`](../../IMPLEMENTATION-PLAN.md) (última seção) e
[`../../AUDIT-DATABASE.md`](../../AUDIT-DATABASE.md) §10.4 e §10.6. **A numeração `0056+` não está reservada.**

## 5. Dependências que este lote acompanha

```
MED-DEC-02…07 (Expedito, Dr. Alcides, Douglas) ──► P1 identidade + designação (Lote 03) ──► P5 revisão de riscos (Rikelvin)
                                                                                      └──► Lote 04 (ASO assinado) · Lote 05 (PCMSO)
#112 (retarget + CI + MED-DEC-09 + merge) ──► MED-DEC-08 ──► Lote 02 (primeiras migrations)
MED-DEC-11 (ADR A × B × C) ──► dado clínico além da conclusão do ASO
MED-DEC-13 (Lista C) ──► P2 (Lote 03) ──► seção NTEP do PCMSO
MED-DEC-15 (prazo de guarda) ──► arquivamento (Lote 02)
```

## 6. Segurança

- Nenhum dado pessoal, telefone ou e-mail nos registros; nomes apenas (Carlos, Rikelvin, Douglas, Expedito, Dr. Alcides).
- Nenhuma decisão de autorização é implementada aqui; nenhuma permissão é concedida.
- Regras permanentes: [`../../geral/01-CONTEXTO-E-ESCOPO.md` §8](../../geral/01-CONTEXTO-E-ESCOPO.md).

## 7. Sequência

1. Carlos lê o [04](../../geral/04-DECISOES-E-BLOQUEIOS.md) e decide sobre a publicação do comentário da NOB-98.
2. Coleta paralela: Expedito (MED-DEC-02, 05, 06 parte de produto), Dr. Alcides (MED-DEC-03, 06, 07, 13, 14, 15), Douglas
   (MED-DEC-04, 08, 09, 10, 11).
3. Rikelvin: retarget/CI da #112 (independente do Lote 01).
4. A cada resposta: coordenador atualiza o [04](../../geral/04-DECISOES-E-BLOQUEIOS.md) e, se um lote mudar de estado, o
   [02](../../geral/02-ROADMAP-E-STATUS.md).
