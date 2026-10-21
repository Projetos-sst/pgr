# Lote 07 — Homologação · REVIEW

## NÃO INICIADO — nenhuma revisão realizada

Nenhum lote foi homologado nem publicado.

## Checklist para declarar HOMOLOGADO (por lote)

- [ ] PR mergeada em `develop` e run do CD com sucesso registrados (estado MERGED comprovado).
- [ ] Cenários do `QA.md` do lote executados com evidência; nenhuma suite "skipped".
- [ ] Isolation suite verde para toda tabela de saúde tocada.
- [ ] Regressão do PGR verificada.
- [ ] Responsividade e acessibilidade verificadas.
- [ ] `api-design.md`, Postman e `WALKTHROUGH.md` atualizados.
- [ ] Validação clínica (Dr. Alcides) e de produto (Expedito) registradas por escrito, quando aplicável.
- [ ] Nenhum dado clínico real usado.

## Checklist para declarar PUBLICADO

- [ ] Lote HOMOLOGADO.
- [ ] Inventário das migrations que irão a produção, com efeito de cada policy RESTRICTIVE.
- [ ] Ensaio em cópia da produção registrado (lembrar: sem rollback de schema).
- [ ] Variáveis de produção conferidas (`APP_ENV=production`, bypass impossível).
- [ ] PR de release `develop → main` mergeada; run do CD em `main` com sucesso; smoke pós-deploy registrado.

## Revisores sugeridos

Douglas (CD, release, migrations), Rikelvin (isolamento e autorização), Dr. Alcides e Expedito (validação).
