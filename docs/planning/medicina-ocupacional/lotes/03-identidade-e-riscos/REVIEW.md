# Lote 03 — REVIEW

> [README do lote](README.md)

## Estado

**NÃO INICIADO — nenhuma revisão realizada.**

## Checklist do que revisar

- [ ] Cada regra implementada cita a decisão (`MED-DEC-NN`) respondida que a sustenta; nada vem da resposta parcial como regra completa.
- [ ] A ambiguidade empresa-cliente × escritório (MED-DEC-02) foi resolvida antes de modelar quem indica o autorizador.
- [ ] Owner/colaborador não validam nem assinam sem designação; nenhum "aprovar como".
- [ ] Nenhum contrato de riscos ou de PGR externo paralelo à #112; a Medicina não lê `risks` diretamente.
- [ ] Ajustes ao contrato da #112 têm aceite registrado do Rikelvin.
- [ ] Revisão de riscos (P5) implementada pelo dono da NOB-98, com o desenho aprovado (R-02).
- [ ] Dados do profissional mínimos (MED-DEC-04); nenhum dado pessoal desnecessário.
- [ ] Lista C carregada só de fonte oficial confirmada; base do protótipo não usada como carga.
- [ ] Datasets globais com leitura global e escrita só via owner; importador idempotente.
- [ ] 4 superfícies para todo HTTP novo; `runIsolationSuite` e "módulo desligado" em toda tabela nova.
- [ ] Migrations com MED-DEC-08 respondida, uma por PR, revisadas antes do merge (o merge aplica na homologação).
