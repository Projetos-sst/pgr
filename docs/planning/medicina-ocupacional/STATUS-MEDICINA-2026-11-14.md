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

| Falta                                                                                                                                             | Depende de                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Merge das PRs #176 (validade de 12 meses, **migration 0083 ainda não integrada**) e #177 (testes)                                                 | Carlos                                                          |
| Inventário e regularização dos vínculos médicos legados (NOB-159)                                                                                 | Credencial de leitura autorizada; decisão do Carlos             |
| Confirmar a NOB-121 (cadastro de profissionais): três critérios comprovados em teste (#177); falta decidir o índice de registro (seção 7, item 4) | Carlos                                                          |
| CI oficial e CD                                                                                                                                   | Regularizar a cobrança do GitHub (administrador da organização) |
| Leitura do banco de homologação (journal e inventários)                                                                                           | Credencial de leitura autorizada                                |
| Provisionamento do operador de identidade (papel, segredos, designação)                                                                           | Dono do banco, com aprovação do Carlos                          |
| Confirmar que `DEV_API_AUTH_BYPASS` não está `true` no projeto de homologação (`develop-pgr-e`, `APP_ENV=sandbox`)                                | Quem administra as variáveis da Vercel                          |
| Teste em navegador                                                                                                                                | Ambiente isolado com login de teste (seção 5)                   |
| Modelos reais de ASO e PCMSO (NOB-93) e regras clínicas pendentes                                                                                 | Dr. Alcides                                                     |
| Assinatura digital pelo sistema                                                                                                                   | Provedor (sem contrato)                                         |
| Portal de clínicas (NOB-122) e teleconsulta (NOB-120)                                                                                             | Decisões de produto e jurídicas; NOB-117                        |

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
   - reproduzido em banco local;
   - **proposta, a decidir (não implementada):**
     - **Identidade do registro:** escritório + categoria (CRM ou CRP) + UF do conselho + número canônico, que tira ponto, hífen, barra e espaços e mantém os zeros à esquerda (`medico_registration_canonical`, já usado pelo gatilho 0081).
     - **No banco:**
       - trocar `uq_medicos_org_crm` por um índice único parcial em `(org_id, profession, registration_uf, medico_registration_canonical(crm))` onde o número canônico não é nulo;
       - para registro não canônico (com letras), um índice único sobre o texto cru `(org_id, profession, registration_uf, crm)`;
       - cadastro antigo sem UF continua barrado pelo gatilho (`missing_uf`).
     - **Antes de criar os índices:**
       - rodar o inventário de "CRMs equivalentes" na homologação, porque duplicatas antigas fariam a migration falhar no CD;
       - decidir a regularização;
       - ajustar o teste `medicos-registration-duplicates` ("mesmo texto de registro → DUPLICATE") e a seção do api-design.
     - **Efeito:** nenhum dado é perdido. Cadastros hoje recusados sem motivo (CRM 12345/SP e 12345/MA, ou CRM 12345 e CRP 12345) passam a ser aceitos.
5. **Profissional externo:** precisa ser membro do escritório para ter vínculo. Um perfil restrito depende da NOB-122.

## 8. Consulta agregada adicional para a homologação

Complementa a seção 5 da auditoria. É **proposta e não executada**; deve rodar com credencial de leitura autorizada e devolve só uma contagem.

```sql
-- Verificações com validade acima de 12 meses (anteriores à 0083, que usa NOT VALID)
select count(*) as verificacoes_acima_de_12_meses
from public.professional_identity_verifications
where expires_at > verified_at + interval '12 months';
```

Depois da #176, essas verificações **não dão mais acesso clínico** além de 12 meses desde a conferência. A autorização usa o menor entre `expires_at` e `verified_at + 12 meses`, testado no prontuário, no ato de coordenador e pelo SQL direto, e as datas gravadas não mudam. A contagem serve só para regularizar o histórico. Se for zero, a constraint pode ser validada com `ALTER TABLE public.professional_identity_verifications VALIDATE CONSTRAINT ck_identity_verifications_validity;`, com decisão do Carlos.

## 8.1 Bypass dev na homologação: instruções para o operador autorizado

O agente não tem acesso às variáveis da Vercel. O passo a passo abaixo é para quem administra o projeto `develop-pgr-e`. Não cole valores de variáveis em chat, issue ou PR.

1. **Conferir a variável.** Na Vercel, projeto `develop-pgr-e` → Settings → Environment Variables (target Production, o único usado pelo CD), veja se existe `DEV_API_AUTH_BYPASS`. Pela CLI, `vercel env ls production` lista só os nomes, não os valores.
2. **Se existir com `true`:** remova a variável (ou troque o valor para `false`) e faça um redeploy do deployment atual, para a mudança valer. O CD continua bloqueado pela cobrança do GitHub, e o redeploy pelo painel usa as variáveis novas.
3. **Conferir sem dado real.** Faça uma requisição de leitura sem sessão, com um tenant inexistente: `curl -s -o /dev/null -w "%{http_code}" -H "x-dev-tenant: org_inexistente_teste" -H "x-dev-role: owner" https://<domínio da homologação>/api/v1/companies`.
   - Com o bypass **desligado**, o proxy do Clerk redireciona (`307`) ou recusa (`401`/`404`).
   - Com o bypass **ligado**, a API responde JSON (`200` com lista vazia). Nesse caso, volte ao passo 2.
4. **Registrar na NOB-162** quem conferiu, quando e o resultado (só o código HTTP), sem valores de variáveis.

Até essa confirmação, o banco de homologação deve ser tratado como exposto à REST com identidade forjável, se o bypass estiver ligado.

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
EM ANDAMENTO: PRs #176 (validade de 12 meses, inclusive a efetiva dos legados), #177 (testes) e #178 (este documento), aguardando revisão.
PRÓXIMO PASSO: merge das PRs pelo Carlos; regularizar o GitHub Actions.
BLOQUEIO: GitHub Actions bloqueado por cobrança; sem credencial de leitura da homologação; navegador não validado.
RESPONSÁVEL CONFIRMADO: Carlos (merges e frente da Medicina).
EVIDÊNCIA: PRs #173–#177; comentários de verificação local nas PRs.
PREVISÃO, SE FUNDAMENTADA: —
```
