# Lote 04 — ASO · REVIEW

## NÃO INICIADO — nenhuma revisão realizada

Não há PR, parecer, aprovação técnica nem validação clínica deste lote.

## Checklist do que revisar

### Decisões e escopo

- [ ] Cada regra clínica implementada tem a decisão correspondente registrada (A-03, A-04, A-05, A-09), com fonte.
- [ ] O desenho de emissão implementado é o aprovado pelo Douglas (D-06); o gerador do PGR não foi reconstruído.
- [ ] A seção de riscos só aparece conforme A-04 / NOB-98.

### Assinatura e documento

- [ ] Captura QR/link/rabisco usada **só** como ciência do trabalhador; nenhum texto chama isso de assinatura do médico.
- [ ] Estado `signed` exige assinatura técnica ligada ao `output_sha256`; sem provedor, "emitido, sem assinatura técnica".
- [ ] Prévia/rascunho claramente identificados até o fluxo oficial.
- [ ] Snapshot completo (sem leitura ao vivo de CPF/nascimento no render) e imutável após `issued`.
- [ ] Worker renderiza do snapshot, com `upsert:false`; regressão do GED do PGR verificada.

### Segurança

- [ ] RLS isolation + RESTRICTIVE `medicine` em toda tabela nova; FK composta `(company_id, org_id)`.
- [ ] Sem DELETE no runtime para emissões; UPDATE só por coluna.
- [ ] Emissor com designação vigente verificado no servidor e no banco; owner não presumido médico.
- [ ] Download auditado, URL curta, cross-tenant → 404.
- [ ] Nenhum dado de saúde em log, IA ou `localStorage`; nenhum dado clínico real em teste.

### Contrato e API

- [ ] Server Action + REST + `api-design.md` + Postman no mesmo PR.
- [ ] Códigos de erro de domínio (`VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE`) mapeados.

### Migrations

- [ ] Uma migration por PR, aditiva, `when` maior que o último, estados em `text` + CHECK, ensaio em Postgres efêmero.
- [ ] Revisor ciente de que o merge em develop aplica em homologação e o merge em main aplica em produção.

### Testes e UX

- [ ] Cenários do [QA](QA.md) executados com evidência; nenhuma suite "skipped" por falta de `INTEGRATION_*`.
- [ ] Erro ≠ vazio; acessibilidade (rótulos, foco, `role="alert"`); 375/768/1440; identidade visual (Manrope, JetBrains Mono, indigo `#5B63F5`, `_ui`).

### Revisores sugeridos

Douglas (emissão/GED/migrations), Rikelvin (autorização/auditoria), Dr. Alcides (conteúdo clínico do documento — validação, não código).
