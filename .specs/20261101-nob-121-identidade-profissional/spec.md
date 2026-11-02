# NOB-121 + MED-02 — Identidade profissional e coordenador do PCMSO

Fonte de produto: Word de Medicina respondido pelo Dr. Alcides (MED-01, MED-02, MED-14) e NR-7 (itens 7.4.1 "c",
7.5.2, 7.5.19.1, 7.6.1.2). Interpretação e decisões: `docs/planning/medicina-ocupacional/geral/10-EXECUCAO-RESPOSTAS-DR-ALCIDES.md`
(MED-EXE-01 a 06).

## Escopo

1. `medicos` passa a cadastrar profissionais de saúde: `profession` (`physician|psychologist`), `affiliation`
   (`internal|external`), `registration_uf` (UF do conselho, obrigatória no input) e `rqe` (só médico). Migration
   aditiva `0060_medical_professional_identity`; nenhuma coluna removida ou renomeada.
2. `pcmso_coordinator_assignments`: designação do coordenador por empresa e período, histórico imutável.
   - Só médico ativo com UF; sem RQE exige justificativa da exceção do NR-7 7.5.2.
   - Uma designação aberta por empresa (índice único parcial); troca encerra a anterior na véspera.
   - Escrita só `owner` (app + policy RLS com `app.current_actor`); sem DELETE para o `app_runtime`; só a
     designação aberta pode ser encerrada; Medicina habilitada na empresa (policy restritiva de módulo).
3. Superfície: Server Actions (`actions/medicine/pcmso-coordinators.ts`), REST
   (`/api/v1/companies/{id}/pcmso-coordinators`, `/api/v1/pcmso-coordinators/{id}`), tela
   `/companies/{id}/pcmso-coordinator`, `api-design.md` e Postman.

## Fora do escopo

Login do profissional e vínculo com `org_memberships` (critério "permissões limitam acesso aos vínculos" da NOB-121
continua aberto); emissão de PCMSO/ASO; transferência formal de prontuários ao sucessor (7.6.1.2), que depende do
prontuário segregado.

## Critérios de aceite

- Profissional interno e externo, médico e psicólogo, com registro e UF validados.
- RQE só para médico (zod + CHECK no banco).
- Designação, troca e encerramento rastreáveis (quem, quando, motivo), sem sobreposição e sem exclusão.
- Isolamento entre tenants e empresas comprovado por testes de integração (Postgres efêmero).

## Migrations e merge

`0060` colide em número com a pilha comercial em draft (PRs #123–#135, `0060_commercial_simulation`). Quem entrar
depois na `develop` renumera e regenera o snapshot. Não aplicar em produção sem a revisão do Douglas (CD automático).
