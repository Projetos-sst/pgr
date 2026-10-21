# Lote 05 — PCMSO · REVIEW

## NÃO INICIADO — nenhuma revisão realizada

Lote bloqueado. Não há PR, parecer, aprovação técnica nem validação clínica.

## Checklist do que revisar

### Desbloqueio e decisões
- [ ] Decisão sobre validador/autorizador registrada com fonte e implementada sem ir além do que foi decidido.
- [ ] Periodicidade e regras de exame implementadas = A-06 aprovada, item a item; nada herdado do protótipo sem aprovação.
- [ ] Estados do documento = A-09.

### Integridade clínica
- [ ] Impossível emitir com fonte não validada ou desatualizada (verificação transacional).
- [ ] Snapshot com `source_id`/`entry_id`/fingerprint; versão emitida imutável.
- [ ] Nenhuma leitura direta de `risks`; contrato único `medical_risk_*`; ajustes da #112 feitos pelo Rikelvin ou com ele.
- [ ] Nenhuma aprovação em nome de terceiro; owner não presumido médico.
- [ ] Seção NTEP só com dataset oficial (nunca a base parcial do protótipo).

### Segurança e contrato
- [ ] RLS isolation + `medicine` + FK composta em toda tabela nova; sem DELETE de versão emitida.
- [ ] Server Action + REST + `api-design.md` + Postman no mesmo PR.
- [ ] Nenhum dado de saúde em IA, log ou `localStorage`; nenhum dado clínico real em teste.

### Migrations
- [ ] Uma por PR, aditiva, `when` crescente, `text` + CHECK, ensaio em Postgres efêmero; revisor ciente de que o merge aplica no banco (develop → homologação, main → produção).

### Testes e UX
- [ ] [QA](QA.md) com evidência; nenhuma suite "skipped".
- [ ] Erro ≠ vazio; etapas acessíveis; 375/768/1440; `_ui` e identidade visual.

### Revisores sugeridos
Rikelvin (contrato de riscos e autorização), Douglas (emissão, migrations), Dr. Alcides (conteúdo clínico — validação).
