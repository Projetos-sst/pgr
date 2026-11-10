# Síntese executiva — Medicina Ocupacional (PCMSO e ASO) · 09/11/2026

> Para apresentação à equipe. Detalhes, evidências e matriz completa: `HANDOFF-MEDICINA-2026-11-09.md`.
> Responsável pela frente: Carlos. Merges feitos manualmente pelo Carlos.

## 1. Objetivo da frente

Levar ao PGR-e a gestão de Medicina Ocupacional: o PCMSO (NR-7) a partir dos riscos do PGR, interno ou externo, e o ASO, com rastreabilidade, segurança clínica e documentos versionados.

## 2. Situação em uma linha

**Entregue e testado em código para o escopo definido; não homologado e não pronto para produção.**

## 3. ENTREGUE E TESTADO EM CÓDIGO

**PCMSO:**

- fontes de risco de PGR interno ou externo, validadas por profissional autorizado;
- proposta de exames pela Tabela 27;
- plano aprovado pelo coordenador vigente e preso aos riscos validados;
- critérios de interpretação;
- conferência normativa e prévia versionada e imutável (SHA-256);
- registro do PCMSO assinado pelo coordenador nomeado na prévia;
- relatório analítico e sua apresentação.

**ASO:**

- exame preso à empresa de origem e procedimentos realizados;
- conferência NR-7 7.5.19.1 (a–g);
- inexistência de riscos só por declaração e com o id da função;
- coordenador na data do exame (sobreposição bloqueia);
- prévia imutável e ASO assinado só a partir da prévia atual, nos fluxos examinador e clínica externa;
- entrega ao trabalhador com conferência do comprovante.

**Formulários:**

- persistência e retomada sem perda;
- erros aparecem no campo;
- falha de rede preserva o que foi digitado;
- vale para 23+ formulários da Medicina.

**Segurança e RLS:**

- isolamento por escritório e módulo;
- atos clínicos só com vínculo médico ↔ conta e identidade verificada por operador independente;
- o owner não tem competência clínica pelo papel, e o CRM nunca autoriza;
- documentos e eventos aceitam só inclusão;
- uma única versão assinada vigente, garantida no banco, inclusive por SQL direto e sob concorrência;
- gatilhos de integridade: aprovação imutável e CRM equivalente barrado.

**Datas:** dia de Brasília pela regra IANA no app, no SQL e nas telas.

**Testes e CI:**

- 2390 testes unitários e 1646 de integração, em Postgres real com RLS;
- CI oficial verde na última PR (#170);
- PRs #165–#170 mergeadas.

**Migrations:** 0079 a 0082, aditivas e validadas no migrator real (journal de 83 registros). O CD pós-#170 aplicou as migrations com sucesso.

## 4. PENDENTE DE VALIDAÇÃO CLÍNICA (Dr. Alcides / responsável técnico)

- **Modelos reais de ASO e PCMSO (NOB-93):** não foram enviados. São 10 perguntas, listadas no handoff, seção 7.
- **Decisões de conteúdo:**
  - cronograma nominal, texto-base e campanhas de saúde do PCMSO;
  - regra de obrigatoriedade do coordenador por porte;
  - lista de examinadores por empresa ou por escritório.
- **Regras de emissão:**
  - ASO sem os complementares do plano;
  - ASO de clínica externa conferido contra a conclusão do exame;
  - reabertura de conferência de comprovante anulada.

## 5. PENDENTE DE HOMOLOGAÇÃO (NOB-162)

- Leitura do banco de homologação: journal (83 esperados), policies e gatilhos.
- Inventários agregados, sem dados pessoais:
  - ASO e PCMSO com mais de uma versão vigente;
  - declarações sem `job_role_id`;
  - CRMs equivalentes;
  - vínculos médicos legados.
- Regularização autorizada do que aparecer nesses inventários.
- Validação das jornadas em navegador autenticado, com dados fictícios.

## 6. PENDENTE DE TERCEIROS

- **Provedor de assinatura** (ICP-Brasil ou plataforma): sem contrato. Hoje o sistema registra o documento assinado fora dele e não assina.
- **Verificadores independentes de identidade** (NOB-158) e **regularização de vínculos legados** (NOB-159).
- **Credencial de leitura** do banco de homologação.

## 7. FORA DO ESCOPO ENTREGUE

- Portal do trabalhador e das clínicas (NOB-122).
- PPP (NOB-141), fadiga (NOB-142), doenças crônicas (NOB-143) e teleconsulta (NOB-120).
- IA (NOB-125) e S-2220 com transmissão (NOB-140).
- Os ~35 formulários de outros módulos.

## 8. NÃO PRONTO PARA PRODUÇÃO

Gates abertos:

- NOB-158 e NOB-159 (identidade médica);
- NOB-162 (homologação);
- NOB-93 (modelo documental);
- provedor de assinatura.

Os documentos saem como **prévia**, não como emissão válida.

## 9. Requisitos MED-01..23 (questionário do Dr. Alcides)

IMP 12 · PAR 9 · PRO 1 · NOR 1 = 23. A classificação item a item está no handoff, seção 4. Não estão todos implementados.

## 10. Próximas ações (responsáveis já definidos)

- **Carlos:** apresentar esta síntese e o handoff; enviar ao Dr. Alcides as perguntas da NOB-93.
- **Durante a ausência:** nenhum merge sem o Carlos e nada em produção. Quem tiver acesso de leitura autorizado registra na NOB-162 o journal e os inventários agregados.
