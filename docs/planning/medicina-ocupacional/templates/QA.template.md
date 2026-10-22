# QA — Lote <preencher: NN> <preencher: nome>

<!-- Modelo. PASS só com execução real (comando, data, ambiente, evidência). Suíte "skipped" NÃO é PASS.
     Teste impossível: registrar BLOQUEADO + motivo + quem destrava. Dados SEMPRE fictícios.
     Lote não iniciado: deixar o bloco "NÃO INICIADO" e listar só os cenários planejados. -->

**NÃO INICIADO — nenhum teste executado** <!-- remover quando houver a primeira execução -->

## Ambiente

| Item                 | Valor                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Branch / SHA testado | <preencher>                                                                |
| Banco de integração  | <preencher: Postgres efêmero (INTEGRATION_DATABASE_URL definido? sim/não)> |
| Navegador / viewport | <preencher>                                                                |
| Organização de teste | <preencher: nunca a organização real>                                      |

## Comandos

| Comando                                   | Data        | Resultado                                 | Evidência   |
| ----------------------------------------- | ----------- | ----------------------------------------- | ----------- |
| `npm run check`                           | <preencher> | <preencher: PASS / FAIL / NÃO EXECUTADO>  | <preencher> |
| `npm run test:integration`                | <preencher> | <preencher: incluir nº de suítes skipped> | <preencher> |
| `npx playwright test` (projeto protected) | <preencher> | <preencher>                               | <preencher> |

## Cenários

| #   | Cenário                           | Camada      | Esperado                          | Resultado   | Evidência   |
| --- | --------------------------------- | ----------- | --------------------------------- | ----------- | ----------- |
| Q1  | Sem autenticação                  | I/E         | redirect/401                      | <preencher> | <preencher> |
| Q2  | Outro tenant por ID               | I           | 404                               | <preencher> | <preencher> |
| Q3  | Empresa sem Medicina              | I           | oculto / FORBIDDEN                | <preencher> | <preencher> |
| Q4  | Outra empresa do mesmo escritório | I           | sem vazamento                     | <preencher> | <preencher> |
| Q5  | Erro de leitura                   | U/E         | `ErrorState`, nunca "lista vazia" | <preencher> | <preencher> |
| Q6  | <preencher: cenário do lote>      | <preencher> | <preencher>                       | <preencher> | <preencher> |

## Chrome DevTools

- Console: <preencher: sem erros / erros listados>
- Network: <preencher: sem 4xx/5xx inesperados / lista>

## Bloqueios de teste

- <preencher ou "nenhum">
