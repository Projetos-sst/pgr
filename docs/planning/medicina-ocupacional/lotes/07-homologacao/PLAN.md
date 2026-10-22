# Lote 07 — Homologação · PLAN

> Plano, não decisão. O responsável das issues de homologação ainda não existe no Linear.
> [README do lote](README.md) · [Roadmap e status](../../geral/02-ROADMAP-E-STATUS.md)

## 1. Resultado esperado

Cada lote de Medicina sai do estado MERGED para HOMOLOGADO com evidência registrada no próprio `QA.md`/`REVIEW.md`, e
a frente inteira chega a uma publicação planejada, ensaiada e verificada, sem dado clínico real e sem migration não
ensaiada indo para produção.

## 2. Estratégia em camadas

| Camada                                  | Quando                                                     | Conteúdo                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.0 Contínua                            | desde o [Lote 01](../01-ficha-saude-ocupacional/README.md) | seed fictício de Medicina; `runIsolationSuite` para toda tabela de saúde (existente e nova); teste "módulo desligado"; REST no padrão `rest-health-exams` |
| 7.1 Por lote                            | antes de cada PR e depois de cada merge                    | cenários do `QA.md` do lote; integração com `INTEGRATION_*` e contagem de skipped = 0; smoke em homologação após o CD                                     |
| 7.2 Ponta a ponta (NOB-128)             | após Lotes 04/05                                           | jornada CNPJ → empresa → funcionário → exame → ASO → (PCMSO quando desbloqueado) → documentos                                                             |
| 7.3 Documentos e restrições (NOB-129)   | após Lote 04                                               | geração, visualização, download autorizado, restrições (teste grátis no servidor, se NOB-118 confirmar)                                                   |
| 7.4 Integrações e treinamento (NOB-130) | após NOB-98 e Lote 06                                      | contrato PGR → Medicina, clínicas/portais confirmados, roteiro de treinamento                                                                             |
| 7.5 Validação dos interessados          | por entrega                                                | Dr. Alcides (conteúdo clínico), Expedito (produto); registro escrito com data e fonte                                                                     |
| 7.6 Preparação de publicação            | antes de cada release develop → main                       | inventário de migrations pendentes em produção; ensaio em cópia da produção; checklist pós-deploy                                                         |

## 3. Matriz de cenários × lotes

Os 21 cenários de [AUDIT-LINEAR-QA §6.1](../../AUDIT-LINEAR-QA.md), alocados:

| #   | Cenário                                         | Lotes      | Bloqueado por  |
| --- | ----------------------------------------------- | ---------- | -------------- |
| 1   | Sem autenticação                                | 01+        | —              |
| 2   | Sem módulo Medicina                             | 01+        | —              |
| 3   | Empresa só Medicina                             | 01, 05     | #112 (fontes)  |
| 4   | Só PGR                                          | 01         | —              |
| 5   | Ambos                                           | 01         | —              |
| 6   | Profissional autorizado                         | 03, 04, 05 | decisão NOB-98 |
| 7   | Profissional sem vínculo                        | 03, 04, 05 | decisão NOB-98 |
| 8   | Trabalhador de outra empresa (mesmo escritório) | 01, 04, 06 | —              |
| 9   | Clínica não vinculada                           | 06         | E-02           |
| 10  | Troca de organização                            | 01+        | —              |
| 11  | IDOR                                            | 01+        | —              |
| 12  | Download não autorizado                         | 04, 05     | P7             |
| 13  | Salvar e retomar                                | 02, 04, 05 | —              |
| 14  | Validação                                       | todos      | —              |
| 15  | Edição concorrente                              | 02, 04, 05 | —              |
| 16  | Emissão bloqueada                               | 04, 05     | NOB-98 / A-03  |
| 17  | Versionamento                                   | 04, 05     | P7             |
| 18  | Falha de rede                                   | 01+        | —              |
| 19  | Rollback                                        | 02, 04, 05 | —              |
| 20  | Dados externos não validados                    | 03, 05     | #112           |
| 21  | Alteração de risco após emissão                 | 04, 05     | NOB-98         |

## 4. Dimensões transversais

| Dimensão                   | Critério                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funcional                  | cenários do lote verdes com evidência                                                                                                                                        |
| Segurança                  | isolamento por escritório, por empresa e por módulo; perfis; auditoria; nada em IA/log/`localStorage`                                                                        |
| Regressões                 | PGR (GED, DOCX, riscos), cadastros comuns, `company_modules`; efeito da 0055 nas rotas que leem `risks` (R-03 do Rikelvin)                                                   |
| Isolamento                 | `runIsolationSuite` em toda tabela de saúde; cross-tenant e mesma-organização-outra-empresa                                                                                  |
| Responsividade             | 375/768/1440 sem rolagem horizontal (critério da fatia 019)                                                                                                                  |
| Acessibilidade             | contraste AA (pílulas de status hoje abaixo), `aria-live`/`role="alert"`, rótulos em linhas repetíveis, foco em diálogos, alvos ≥ 44px ([AUDIT-UX §10.3](../../AUDIT-UX.md)) |
| Documentação               | `api-design.md` + Postman atualizados; `WALKTHROUGH.md` do lote preenchido                                                                                                   |
| Validação com interessados | registro escrito; sem registro, não é HOMOLOGADO                                                                                                                             |

## 5. Publicação (preparação; não executar sem evidência)

1. Listar migrations em `develop` ausentes em `main` (hoje, pelo menos a 0053).
2. Ensaiar a aplicação do lote em cópia da produção; registrar tempo, locks e resultado.
3. Confirmar variáveis do ambiente de produção (`APP_ENV=production`, bypass desligado) — hoje NÃO VERIFICADO.
4. PR de release `develop → main` com a lista de migrations e o efeito de cada policy RESTRICTIVE.
5. Após o CD de `main`: smoke pós-deploy e registro. Só então o lote vira PUBLICADO.

## 6. Ferramentas

- Integração: `npm run test:integration` com Postgres efêmero (`INTEGRATION_DATABASE_URL`, `INTEGRATION_DATABASE_URL_ADMIN`).
- E2E: Playwright projeto protected (`E2E_PROTECTED=1`); avaliar com o Douglas incluir no CI.
- Roteiros: scripts do protótipo **apenas lidos**, nunca executados.

## 7. O que depende de decisão

| Item                                                                 | Quem                  |
| -------------------------------------------------------------------- | --------------------- |
| Responsável das NOB-128/129/130                                      | Douglas               |
| Playwright no CI                                                     | Douglas               |
| Staging intermediário / janela develop → main para migrations (D-07) | Douglas               |
| Ambiente online para testes reais (NOB-127)                          | Douglas               |
| Critério de validação clínica e de produto (formato do registro)     | Dr. Alcides, Expedito |
