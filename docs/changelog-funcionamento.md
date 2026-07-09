# Como o CHANGELOG Funciona

O CHANGELOG representa **as versões do produto**, e **não as branches do Git**.

Enquanto novas funcionalidades são desenvolvidas, todas elas são adicionadas à seção
**Unreleased**.

Quando uma nova release é criada, o conteúdo de **Unreleased** é "congelado" e passa a
representar aquela versão. Em seguida, um novo bloco **Unreleased** vazio é criado para receber as
próximas funcionalidades.

O arquivo é **gerado automaticamente** — ninguém edita o `CHANGELOG.md` à mão. Um workflow do
GitHub Actions reconstrói a seção do topo a cada merge, a partir dos commits (Conventional
Commits). Versões já fechadas viram texto fixo e nunca mudam.

---

# O que entra no CHANGELOG

O CHANGELOG registra **apenas mudanças relevantes para o produto**. O tipo do
[Conventional Commit](https://www.conventionalcommits.org/) define a categoria:

| Tipo do commit                          | Vai para o CHANGELOG? | Categoria   |
| --------------------------------------- | --------------------- | ----------- |
| `feat`                                  | Sim                   | **Added**   |
| `fix`                                   | Sim                   | **Fixed**   |
| `perf`                                  | Sim                   | **Changed** |
| `docs`, `refactor`                      | Só com opt-in¹        | **Changed** |
| `chore`, `ci`, `build`, `test`, `style` | Não                   | —           |

¹ `docs` e `refactor` ficam **fora por padrão**, porque quase nunca mudam algo perceptível para
quem usa o sistema. Quando representarem uma mudança visível ao produto, basta adicionar um
trailer ao commit para forçar a entrada:

```text
refactor(signatures): unifica fluxo de captura de assinatura

Changelog: Changed
```

> Um commit com **breaking change** (`feat!:` ou rodapé `BREAKING CHANGE:`) sempre entra, em
> **Changed**, prefixado com `**Breaking:**`.

---

# Exemplo Completo

## 1. Primeira feature

Criamos a branch:

```text
feature/login
```

Após o merge para a `develop`:

```text
feature/login
        │
        ▼
develop
```

O CHANGELOG passa a ser:

```md
# Changelog

## Unreleased

### Added

- Login com Google
```

---

## 2. Segunda feature

Criamos:

```text
feature/dashboard
```

Após o merge para a `develop`, o CHANGELOG fica:

```md
# Changelog

## Unreleased

### Added

- Login com Google
- Dashboard Financeiro
```

---

## 3. Terceira feature

Criamos `feature/payment`. Após o merge:

```md
# Changelog

## Unreleased

### Added

- Login com Google
- Dashboard Financeiro
- Integração com Stripe
```

Até este momento **não existe nenhuma release**. A branch `develop` continua acumulando
funcionalidades normalmente.

---

# 4. Criação da Release

Chegou o momento da publicação. Criamos:

```text
release/1.4.0
```

Neste momento o CHANGELOG é atualizado automaticamente. O bloco **Unreleased** passa a representar
oficialmente a versão **1.4.0** (com a data), e um novo bloco **Unreleased** vazio é criado para o
próximo ciclo:

```md
# Changelog

## Unreleased

---

## 1.4.0 - 2026-06-28

### Added

- Login com Google
- Dashboard Financeiro
- Integração com Stripe
```

> O número da versão vem do **nome da branch** (`release/1.4.0`). Nada de tags ou ajustes manuais.

Agora a versão **1.4.0** está congelada para homologação.

---

# 5. Novas Features Durante a Homologação

Enquanto a equipe de QA testa a versão **1.4.0**, o desenvolvimento continua normalmente na
`develop`. Nova branch:

```text
feature/chat
```

Após merge na `develop`:

```md
# Changelog

## Unreleased

### Added

- Chat em Tempo Real

---

## 1.4.0 - 2026-06-28

### Added

- Login com Google
- Dashboard Financeiro
- Integração com Stripe
```

Observe que a feature **Chat** **não** entrou na versão **1.4.0** — ela fará parte da próxima
release. A `develop` e a `release/1.4.0` editam blocos diferentes do arquivo, então **nunca
conflitam** entre si.

---

# 6. Correção Durante a Homologação

Durante os testes, a QA encontra um problema. Criamos uma branch de correção **a partir da própria
release**:

```text
release/1.4.0
        │
        ▼
fix/login-validation
        │
        ▼
release/1.4.0
```

Após o merge, apenas a versão da release é atualizada:

```md
# Changelog

## Unreleased

### Added

- Chat em Tempo Real

---

## 1.4.0 - 2026-06-28

### Added

- Login com Google
- Dashboard Financeiro
- Integração com Stripe

### Fixed

- Corrigida validação do Login
```

O bloco **Unreleased** permanece inalterado, porque essa correção pertence **exclusivamente** à
versão **1.4.0**.

---

# 7. Publicação

Após a aprovação da QA:

```text
release/1.4.0
        │
        ▼
main
```

Neste momento **o CHANGELOG não sofre nenhuma alteração**. O workflow nem é executado na `main` —
o arquivo já foi completamente construído durante o desenvolvimento e a homologação, e é apenas
publicado.

---

# 8. Volta para a Develop

Por fim, a release é mergeada de volta para a `develop`, para preservar as correções da
homologação. A `develop` recebe o bloco `1.4.0` **já congelado** (incluindo o fix do QA), enquanto
seu `Unreleased` continua com as features do próximo ciclo:

```md
# Changelog

## Unreleased

### Added

- Chat em Tempo Real

---

## 1.4.0 - 2026-06-28

### Added

- Login com Google
- Dashboard Financeiro
- Integração com Stripe

### Fixed

- Corrigida validação do Login
```

A correção do Login **não se duplica** no `Unreleased`: o gerador reconstrói cada seção a partir do
intervalo de commits correto, então o fix aparece só na `1.4.0`.

---

# Resumo Visual

```text
feature/login
                 ┐
feature/dashboard├──► develop ─────────────► Unreleased
feature/payment  ┘

                           │
                           ▼

                  release/1.4.0
                           │
             Unreleased → 1.4.0
             Novo Unreleased vazio
                           │
                           ▼

                  QA / Homologação
                           │
           fix/login-validation
                           │
                           ▼

                  Atualiza apenas
                    a versão 1.4.0
                           │
                           ▼

                     release → main
                (CHANGELOG não muda)
                           │
                           ▼

                  release → develop
              (1.4.0 congelado volta)
```

---

# Regras Importantes

- O `Unreleased` representa **a próxima versão do produto**.
- Toda feature mergeada na `develop` atualiza o `Unreleased` automaticamente.
- Ao criar uma `release/x.y.z`, o conteúdo de `Unreleased` é promovido para essa versão.
- Um novo `Unreleased` vazio é criado imediatamente após a criação da release.
- Correções feitas durante a homologação atualizam **apenas** a versão da release correspondente.
- O merge da release para a `main` **não altera o CHANGELOG** — ele já está completo.
- O merge de volta para a `develop` preserva o histórico, sem duplicar entradas.
- O CHANGELOG documenta **versões do produto**, e não o estado das branches do Git.
- Só `feat`, `fix` e `perf` entram por padrão; `docs`/`refactor` apenas com opt-in; o resto é
  ignorado.

```

```
