# Versionamento

Seguimos o padrão **SemVer** (`MAJOR.MINOR.PATCH`), ex.: `1.2.3`.

## O que cada número significa

| Posição        | Nome                    | Sobe quando                                                                                                 |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **1º — MAJOR** | versão sólida / estável | o produto vira uma versão estável (`1.0.0`) ou, depois disso, há uma mudança que **quebra compatibilidade** |
| **2º — MINOR** | features novas          | entra uma leva de funcionalidades novas                                                                     |
| **3º — PATCH** | correção de bugs        | só conserto de bug, sem feature nova                                                                        |

## Fase atual — pré-estável (`0.x`)

Estamos **em desenvolvimento, construindo o sistema do zero**, então o 1º número fica em **`0`**.

Enquanto o 1º número for `0`, o produto é considerado **pré-estável** (ainda pode mudar bastante):

- **Nova leva de features** → sobe o número do **meio**: `0.1.0` → `0.2.0` → `0.3.0`...
- **Só correção de bug** → sobe o **último**: `0.2.0` → `0.2.1`.
- Nesta fase, mesmo mudanças que quebram compatibilidade sobem o número do **meio** (ainda não existe um "MAJOR" separado).

## Quando virar produto estável (`1.0.0`)

Quando o sistema for declarado estável, viramos `1.0.0`. A partir daí cada número passa a ter seu papel definido:

- **PATCH** (`1.0.0` → `1.0.1`) → só correção de bug.
- **MINOR** (`1.0.0` → `1.1.0`) → feature nova **sem quebrar** o que já existia.
- **MAJOR** (`1.x` → `2.0.0`) → mudança que **quebra** compatibilidade.

## Linha do tempo (exemplo)

```
0.1.0   → primeiro release (Fase 00 + Fase 02)
0.2.0   → próxima leva de features
0.2.1   → bug fix sobre a 0.2.0
0.3.0   → mais features
...
1.0.0   → produto estável
1.1.0   → feature nova (compatível)
1.1.1   → bug fix
2.0.0   → mudança que quebra compatibilidade
```

## Tags no Git

Cada release que vai para `main` recebe uma tag com o prefixo `v`:

```bash
git tag -a v0.1.0 -m "Fase 00 + Fase 02 (módulo EPI)"
git push origin v0.1.0
```
