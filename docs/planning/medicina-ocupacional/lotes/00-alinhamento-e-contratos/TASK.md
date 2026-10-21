# Lote 00 — TASK

> **Status real:** frente de alinhamento `EM_EXECUCAO`; **nenhuma ação abaixo foi concluída.** Nenhum comentário foi
> publicado, nenhum status do Linear foi alterado. Cada ação tem dono e o que se aguarda.
> Ao concluir uma ação, marcar o checkbox **com fonte e data**, e pedir ao coordenador a atualização do
> [04](../../geral/04-DECISOES-E-BLOQUEIOS.md). [README](README.md) · [PLAN](PLAN.md)

## A. Registro e comunicação

- [ ] **T00-A1** Decidir se publica o comentário de atualização na NOB-98
  ([texto em 04 §3](../../geral/04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado)).
  Aceite: decisão registrada em MED-DEC-22; se "sim", link do comentário anotado em MED-DEC-01.
  Responsável: Carlos. Dependências: nenhuma. Aguardando: **Carlos**.
- [ ] **T00-A2** Se autorizado, publicar o comentário sem alterar responsável nem status da NOB-98.
  Aceite: comentário visível na NOB-98, mencionando Expedito, Dr. Alcides e Douglas como destinatários das perguntas.
  Responsável: Carlos. Dependências: T00-A1. Aguardando: T00-A1.
- [ ] **T00-A3** Anexar a pasta de documentação da frente como evidência nas issues NOB-108/112/113 (C-04).
  Aceite: link da pasta (branch do Lote 01) em cada issue. Responsável: Carlos. Dependências: autorização (MED-DEC-22).
  Aguardando: **Carlos**.

## B. Decisões de produto (Expedito)

- [ ] **T00-B1** Obter resposta para MED-DEC-02 ("empresa" = empresa-cliente ou escritório? quem indica o autorizador?).
  Aceite: resposta literal + fonte + data no 04. Responsável pelo registro: Carlos. Dependências: T00-A2 ou outro canal
  formal. Aguardando: **Expedito**.
- [ ] **T00-B2** Obter resposta para MED-DEC-05 (profissional externo pode validar?). Aceite: idem. Aguardando: **Expedito**.
- [ ] **T00-B3** Obter resposta para MED-DEC-16 (empresa nova nasce com Medicina?). Não bloqueia o Lote 01. Aceite: idem.
  Aguardando: **Expedito**.

## C. Decisões clínicas (Dr. Alcides)

- [ ] **T00-C1** MED-DEC-03 (autorizador também valida? quais categorias validam?). Aceite: resposta literal + fonte + data.
  Aguardando: **Dr. Alcides**.
- [ ] **T00-C2** MED-DEC-06 (escopo, revogação, validações anteriores) — parte clínica. Aguardando: **Dr. Alcides + Expedito**.
- [ ] **T00-C3** MED-DEC-07 (nota em validação, motivo em rejeição). Aguardando: **Dr. Alcides**.
- [ ] **T00-C4** MED-DEC-13 (Lista C: significado, fonte oficial, versão, classe × subclasse CNAE). Aguardando: **Dr. Alcides**.
- [ ] **T00-C5** MED-DEC-15 (prazo de guarda; arquivar × apagar). Aguardando: **Dr. Alcides + jurídico**.
- [ ] **T00-C6** MED-DEC-18 (aviso "não registre diagnóstico ou CID" em Observações). Opcional para o Lote 01.
  Aguardando: **Dr. Alcides**.

## D. Decisões técnicas (Douglas)

- [ ] **T00-D1** MED-DEC-08 (ordem de merge da #112 × migrations da Medicina; numeração). Aceite: decisão registrada.
  Dependências: T00-E1. Aguardando: **Douglas**.
- [ ] **T00-D2** MED-DEC-09 (aceitar o efeito da `0055`). Dependências: T00-E2. Aguardando: **Douglas + Expedito**.
- [ ] **T00-D3** MED-DEC-10 (dono da identidade profissional NOB-121 × NOB-98; reescopo da NOB-111). Aguardando: **Douglas**,
  com Carlos e Rikelvin.
- [ ] **T00-D4** MED-DEC-11 (ADR A × B × C). Aguardando: **Douglas**.
- [ ] **T00-D5** MED-DEC-04 (modelo Clerk ↔ profissional), após T00-B1 e T00-C1. Aceite: proposta do Carlos sobre P1 revisada
  pelo Douglas e pelo Rikelvin. Aguardando: B1, C1.
- [ ] **T00-D6** MED-DEC-17 (teal e contraste AA das pílulas). Opcional para o Lote 01. Aguardando: **Douglas**.

## E. PR #112 e coerência do backlog (Rikelvin)

- [ ] **T00-E1** Retarget da #112 para `develop`, resolver o conflito do Postman e rodar o CI (R-01).
  Aceite: checks da #112 visíveis e verdes. Responsável: Rikelvin (aceite dele necessário). Aguardando: **Rikelvin**.
- [ ] **T00-E2** Regressão das leituras que dependem de `risks` sob a `0055` (R-03). Aceite: resultado registrado na #112.
  Aguardando: **Rikelvin**.
- [ ] **T00-E3** Combinar com o Rikelvin a ordem de merge entre #112 e Lote 01 nos arquivos comuns
  ([PLAN §3](PLAN.md#3-convivência-com-o-trabalho-do-rikelvin)). Aceite: combinação registrada no README do Lote 01.
  Responsável: Carlos + Rikelvin. Aguardando: **Rikelvin**.
- [ ] **T00-E4** Atualizar o Linear: NOB-102/103/104 (PR mergeada), NOB-94 (Backlog bloqueando Done), NOB-100 (critério que
  depende da #112), NOB-93 (sem responsável) (R-04). Aguardando: **Rikelvin / Douglas**.
