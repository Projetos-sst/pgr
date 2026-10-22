# Lote 06 — Profissionais, clínicas e portais · REVIEW

## NÃO INICIADO — nenhuma revisão realizada

Lote bloqueado. Não há PR, parecer nem aprovação.

## Checklist do que revisar

### Escopo

- [ ] Só os portais confirmados pelo Expedito (E-02) foram implementados.
- [ ] Identidade profissional consumida do [Lote 03](../03-identidade-e-riscos/README.md), sem modelo paralelo.
- [ ] Nenhum cadastro duplicado de empresa ou funcionário.

### Autorização (provar no banco, não só na UI)

- [ ] Clínica não vê trabalhador de empresa não vinculada.
- [ ] RH não vê prontuário nem resultado clínico; vê só o que A-03 permitir.
- [ ] Escopo por empresa/clínica aplicado no servidor **e** na RLS.
- [ ] Nenhum "Ver como"/projeção no cliente; nenhum dado de outra organização.
- [ ] Clínica não recebe dado financeiro.

### Dado clínico

- [ ] Resultados clínicos só com papel clínico + auditoria de leitura + arquitetura D-05.
- [ ] Nada em IA, log ou `localStorage`; nenhum dado clínico real em teste.

### Contrato, migrations e testes

- [ ] Action + REST + `api-design.md` + Postman por CRUD.
- [ ] Migrations aditivas, uma por PR, ensaiadas; revisor ciente da aplicação automática no merge.
- [ ] [QA](QA.md) com evidência; nenhuma suite "skipped".

### Revisores sugeridos

Rikelvin (papéis/escopo/RLS), Douglas (arquitetura D-05, migrations), Expedito (escopo de produto), Dr. Alcides (o que cada perfil vê de saúde).
