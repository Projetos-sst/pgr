# Medicina Ocupacional — situação para a reunião · 14/11/2026

> Resumo simples para a equipe. Detalhes: `AUDITORIA-RETOMADA-MEDICINA-2026-11-14.md`, `HANDOFF-MEDICINA-2026-11-09.md` e `SINTESE-EXECUTIVA-MEDICINA-2026-11-09.md`.

## 1. Situação em uma linha

A `develop` combinada (`944529f`, com as PRs #173, #174 e #175) passou em toda a validação **local**. Nada foi testado em navegador, o CI oficial não rodou e nada está homologado.

## 2. O que foi validado, e onde

| Validação                                                        | Onde                       | Resultado                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, formatação, typecheck e testes unitários (`npm run check`) | Local, `944529f`           | 246 suítes, 2395 testes. Uma falha intermitente em 1 de 4 execuções (`delete-medico-feedback`, corrida no teste, já existia antes); correção na PR #177 |
| Build de produção (`npm run build`)                              | Local, `944529f`           | Aprovado                                                                                                                                                |
| Integração completa (Postgres 16 real, mesmo bootstrap do CI)    | Local, `944529f`           | 205 suítes, **1655 aprovados, 0 falhas**, 14 pulados (os mesmos de antes)                                                                               |
| Migrations no migrator real                                      | Bancos locais descartáveis | Base 0081 → 0082, reaplicação, banco limpo idêntico ao atualizado e sem drift                                                                           |
| CI oficial do GitHub                                             | —                          | **Não rodou**: o Actions está bloqueado por cobrança ou limite de gastos da conta                                                                       |
| CD pós-merge (homologação)                                       | —                          | **Não rodou**, pelo mesmo motivo. A homologação não recebeu #173, #174 nem #175                                                                         |
| Navegador                                                        | —                          | **Não testado** (seção 5)                                                                                                                               |

## 3. O que funciona (testado em código, não em navegador)

- Cadastros: empresas com Medicina, funções, GES, funcionários e profissionais (médico CRM e psicólogo CRP, internos ou externos, UF e RQE).
- Exames ocupacionais com procedimentos da Tabela 27.
- Riscos validados de PGR interno ou externo, e a inexistência de riscos por GES e função.
- Proposta e plano de exames, conferência e prévia do PCMSO e do ASO, e o histórico de versões.
- Registro do documento assinado fora do sistema, entrega do ASO e conferência do comprovante.
- **Segurança:**
  - atos clínicos só com vínculo pela própria conta e identidade verificada por operador independente;
  - o owner não ganha competência clínica pelo papel, e o psicólogo nunca tem competência médica;
  - as rotas REST do verificador exigem master pela sessão real (#173).
- **Erros de leitura:** aparecem como erro, nunca como "nenhum registro" (#174).

## 4. O que falta

| Falta                                                                                                              | Depende de                                                      |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Merge das PRs #176 (validade de 12 meses) e #177 (testes)                                                          | Carlos                                                          |
| CI oficial e CD                                                                                                    | Regularizar a cobrança do GitHub (administrador da organização) |
| Leitura do banco de homologação (journal e inventários)                                                            | Credencial de leitura autorizada                                |
| Provisionamento do operador de identidade (papel, segredos, designação)                                            | Dono do banco, com aprovação do Carlos                          |
| Confirmar que `DEV_API_AUTH_BYPASS` não está `true` no projeto de homologação (`develop-pgr-e`, `APP_ENV=sandbox`) | Quem administra as variáveis da Vercel                          |
| Teste em navegador                                                                                                 | Ambiente isolado com login de teste (seção 5)                   |
| Modelos reais de ASO e PCMSO (NOB-93) e regras clínicas pendentes                                                  | Dr. Alcides                                                     |
| Assinatura digital pelo sistema                                                                                    | Provedor (sem contrato)                                         |
| Portal de clínicas (NOB-122) e teleconsulta (NOB-120)                                                              | Decisões de produto e jurídicas; NOB-117                        |

## 5. Navegador

Nenhum passo do roteiro foi executado em navegador nesta rodada. O roteiro de 12 passos da auditoria continua **proposto, não validado**.

**Motivos:**

- **Login:** as jornadas exigem login Clerk real, e não há conta de teste disponível para o agente. Credenciais não são pedidas por chat.
- **Isolamento do banco:** não foi possível confirmar, sem ler os arquivos `.env` (proibido), que o servidor local usaria um banco isolado e não o Supabase de testes compartilhado.
- **Atos clínicos:** exigem um operador de identidade provisionado, que não se cria em ambiente compartilhado.
- **Memória:** a máquina interrompeu processos por falta de memória durante a rodada.

**Para validar:** Carlos (ou alguém autorizado) roda o servidor local apontando para um banco descartável, com uma conta de teste. Os passos 5, 8 e 12, que envolvem atos clínicos, precisam de um operador e de um master fictícios **só nesse banco descartável**.

## 6. O que pode e o que não pode ser demonstrado

**Pode, depois de validar em navegador:**

- passos 1 a 4 (login, empresa, cadastros, painel da Medicina);
- passos 6, 7, 9, 10 e 11 (exame, riscos, conferência e prévia do PCMSO e do ASO, histórico);
- o passo 12 só com o ASO de clínica externa (fluxo B).

**Não pode hoje:**

- aprovar o plano, registrar o ASO pelo examinador e abrir o prontuário, porque exigem identidade verificada;
- assinatura digital, portal de clínicas, teleconsulta e emissão definitiva de ASO ou PCMSO.

## 7. Decisões pendentes

1. **"Dois verificadores" (NOB-162, decisão A):** duas aprovações independentes por verificação, ou um grupo de dois operadores? Hoje cada verificação tem um único `verified_by`.
2. **CRM ou UF que mudam e depois voltam:** a verificação antiga volta a valer? Hoje volta, e há teste prendendo esse comportamento.
3. **Renovação da verificação:** hoje só é possível depois que ela vence ou é revogada; não há renovação antecipada.
4. **Mesmo número de registro em UF ou categoria diferente** (por exemplo, CRM 12345/SP e CRM 12345/MA, ou CRM 12345 e CRP 12345):
   - hoje o índice `uq_medicos_org_crm`, sobre o texto cru, recusa o segundo cadastro;
   - a regra canônica do próprio sistema (gatilho 0081) e a documentação dizem que UF ou categoria diferente não é duplicata;
   - trocar o índice por (escritório, categoria, UF, número) não perde dados, mas muda uma regra testada;
   - reproduzido em banco local.
5. **Profissional externo:** precisa ser membro do escritório para ter vínculo. Um perfil restrito depende da NOB-122.

## 8. Consulta agregada adicional para a homologação

Complementa a seção 5 da auditoria. É **proposta e não executada**; deve rodar com credencial de leitura autorizada e devolve só uma contagem.

```sql
-- Verificações com validade acima de 12 meses (anteriores à 0083, que usa NOT VALID)
select count(*) as verificacoes_acima_de_12_meses
from public.professional_identity_verifications
where expires_at > verified_at + interval '12 months';
```

Se a contagem for zero, a constraint pode ser validada com `ALTER TABLE public.professional_identity_verifications VALIDATE CONSTRAINT ck_identity_verifications_validity;`, com decisão do Carlos.

## 9. Modelo de acompanhamento diário

Preencher só com fatos; deixar em branco o que não tiver evidência.

```
DATA:
CONCLUÍDO:
EM ANDAMENTO:
PRÓXIMO PASSO:
BLOQUEIO:
RESPONSÁVEL CONFIRMADO:
EVIDÊNCIA: (PR, commit, run, teste, print)
PREVISÃO, SE FUNDAMENTADA:
```

Exemplo preenchido com o estado de hoje:

```
DATA: 14/11/2026
CONCLUÍDO: #173, #174 e #175 integradas; develop 944529f validada localmente (2395 unitários, 1655 de integração, build).
EM ANDAMENTO: PRs #176 (validade de 12 meses) e #177 (testes), aguardando revisão.
PRÓXIMO PASSO: merge das PRs pelo Carlos; regularizar o GitHub Actions.
BLOQUEIO: GitHub Actions bloqueado por cobrança; sem credencial de leitura da homologação; navegador não validado.
RESPONSÁVEL CONFIRMADO: Carlos (merges e frente da Medicina).
EVIDÊNCIA: PRs #173–#177; comentários de verificação local nas PRs.
PREVISÃO, SE FUNDAMENTADA: —
```
