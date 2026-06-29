# Git Flow - Processo de Desenvolvimento e Releases

## Objetivo

Este documento define o fluxo oficial de desenvolvimento da equipe, garantindo que:

- A `develop` permaneça como branch de integração das features.
- A `release` represente exatamente a versão que será publicada.
- A `main` contenha apenas versões homologadas e prontas para produção.
- O CHANGELOG represente fielmente o conteúdo de cada release.
- O desenvolvimento de novas features nunca seja interrompido durante uma homologação.

---

# Fluxo Geral

```text
feature/*
      │
      ▼
Pull Request
      │
      ▼
develop
      │
      ├── CI / Testes automáticos
      ├── Atualização do CHANGELOG
      │
      ▼
Criação da release/vX.Y.Z
      │
      ▼
QA / Homologação
      │
      ├── Correções (fix/*)
      ├── Atualização do CHANGELOG
      └── Ajustes de versão
      │
      ▼
Pull Request
release → main
      │
      ▼
Produção
      │
      ▼
Merge de volta para develop
```

---

# Branches

## main

Contém apenas versões em produção.

Nunca recebe desenvolvimento diretamente.

A única forma de atualizar a main é através de uma Pull Request da branch Release.

---

## develop

É a branch principal de desenvolvimento.

Todas as novas funcionalidades são integradas nela.

A develop deve estar sempre compilando e com todos os testes passando.

Ela não representa necessariamente uma versão pronta para produção.

---

## feature/\*

Cada funcionalidade deve ser desenvolvida em uma branch própria.

Exemplos:

```
feature/login
feature/dashboard
feature/payment
feature/user-profile
```

Sempre criada a partir da develop.

Fluxo:

```
develop
    │
    ▼
feature/login
    │
    ▼
PR → develop
```

---

## release/\*

Quando chega o momento da release (ex.: semanal), cria-se uma branch de release.

Exemplo:

```
release/1.4.0
```

Ela representa exatamente a versão que será publicada.

Após sua criação:

- Nenhuma feature nova entra nela.
- Apenas correções.
- Atualização de versão.
- Atualização do CHANGELOG.
- Pequenos ajustes.

Enquanto isso, a develop continua recebendo novas features normalmente.

---

## fix/\*

Caso seja encontrado algum problema durante a homologação da release, cria-se uma branch de correção.

Ela deve ser criada A PARTIR da release.

Exemplo:

```
release/1.4.0
        │
        ▼
fix/login-validation
```

Fluxo:

```
release/1.4.0
      │
      ▼
fix/login-validation
      │
      ▼
PR → release/1.4.0
```

Nunca enviar uma fix da release diretamente para develop.

---

# Fluxo de Desenvolvimento

## Nova Feature

```
feature/*
        │
        ▼
Desenvolvimento
        │
        ▼
Testes locais
        │
        ▼
PR → develop
```

Após aprovação:

- Merge
- CI
- Build
- Atualização automática do CHANGELOG

---

# Fluxo de Release

Quando a equipe decidir gerar uma versão:

```
develop
    │
    ▼
release/1.4.0
```

Essa branch será utilizada para:

- QA
- Homologação
- Testes manuais
- Correções
- Ajustes finais

Durante esse período:

A develop continua normalmente recebendo novas features.

---

# Fluxo de Correções

Durante os testes:

```
release/1.4.0

↓

Encontrado bug

↓

fix/login

↓

PR

↓

release/1.4.0
```

Após aprovação:

Novo deploy da própria release para homologação.

Repetir até aprovação.

---

# Publicação

Após aprovação da QA:

```
release/1.4.0

↓

PR

↓

main
```

Depois:

```
release/1.4.0

↓

Merge

↓

develop
```

Esse merge de volta é obrigatório para garantir que todas as correções feitas durante a homologação permaneçam também na develop.

---

# Convenção de Branches

## Features

```
feature/login
feature/dashboard
feature/payment
feature/profile
feature/reports
```

---

## Correções

```
fix/login-validation
fix/payment-timeout
fix/mobile-layout
fix/navbar
fix/dashboard-filter
```

---

## Releases

```
release/1.0.0
release/1.1.0
release/1.2.0
```

---

# Conventional Commits

Toda a equipe deverá utilizar Conventional Commits.

## Features

```
feat: add dashboard filters
```

---

## Correções

```
fix: correct login validation
```

---

## Refatorações

```
refactor: simplify auth flow
```

---

## Documentação

```
docs: update release process
```

---

## Testes

```
test: add authentication tests
```

---

## Build / Infra

```
build: update docker image

ci: update github actions
```

---

## Chores

```
chore: bump app version

chore: update changelog
```

---

# Pull Requests

## Feature → Develop

Título

```
feat: User Profile
```

Checklist

```
- Build funcionando
- Testes locais realizados
- CHANGELOG atualizado
- Sem conflitos
```

---

## Fix → Release

Título

```
fix: Login Validation
```

Checklist

```
- Bug reproduzido
- Correção aplicada
- Testado
- CHANGELOG atualizado
```

---

## Release → Main

Título

```
release: v1.4.0
```

Checklist

```
- QA aprovada
- Todos os bugs corrigidos
- CHANGELOG revisado
- Versão atualizada
```

---

# Política do CHANGELOG

O CHANGELOG será alimentado continuamente durante o desenvolvimento.

Cada Pull Request para develop deverá adicionar sua entrada.

Exemplo:

```markdown
## Added

- Login com Google
- Dashboard Financeiro

## Changed

- Melhorado carregamento do Dashboard

## Fixed

- Corrigido timeout no login
```

---

# Durante a Release

Ao criar uma release:

```
release/1.4.0
```

Todo o conteúdo do CHANGELOG representa exatamente aquela versão.

Caso ocorram correções durante a homologação:

Adicionar em:

```
## Fixed

- Corrigido erro de autenticação
- Corrigido layout mobile
```

Ao finalizar a release:

O CHANGELOG daquela versão ficará congelado.

Novas features continuarão sendo adicionadas apenas na develop, compondo a próxima versão.

---

# Benefícios

- Desenvolvimento nunca para.
- QA testa exatamente a versão que será publicada.
- Releases previsíveis.
- Histórico limpo.
- Fácil rollback.
- CHANGELOG sempre consistente.
- Processo escalável.
- Compatível com Git Flow clássico.
