# Lote 2 — Walkthrough

Como o que foi implementado funciona na prática, do cadastro ao PDF. Descreve o comportamento **real**
verificado no QA de 27/09/2026, não a intenção.

## #39 — Avaliação quantitativa NR-09

### Onde se cadastra

Na avaliação do risco, não em tela nova: **Riscos → abrir o risco → Avaliações → Nova avaliação**
(`/risks/{id}/assessments/new`) ou o lápis de uma avaliação existente.

### Como o bloco aparece

O cartão **“Avaliação quantitativa (NR-09)”** só é renderizado quando as duas condições valem:

1. **Critério = Quantitativo** (o campo já existia no formulário);
2. o risco é de agente **físico, químico ou biológico** — os agentes que a NR-09 cobre.

Trocar o critério para Qualitativo esconde o bloco e os campos não são enviados. Em risco ergonômico,
mecânico, de acidentes ou psicossocial o bloco nunca aparece — e quem tentar pela API recebe
`422 VALIDATION` com a mensagem “Agente ergonômico não é objeto da NR-09 (físicos, químicos e
biológicos)”. A regra vive no servidor; a tela só reflete.

### O que se informa

| Campo                                   | Observação                                                               |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Método de avaliação                     | Texto livre com sugestões (NHO-01, NHO-06, NHO-08, NIOSH, dosimetria…)   |
| Valor medido                            | Decimal; exige unidade quantitativa (sem unidade → 422 e CHECK no banco) |
| Unidade da medição                      | Enum já existente, sem a opção “qualitativo/não aplicável”               |
| Limite de tolerância (valor)            | Numérico, ao lado do campo textual “referência normativa” que já existia |
| Conclusão (informada pelo profissional) | `Abaixo do limite` · `Acima do limite` · `Limite não aplicável`          |

### Como a sugestão funciona

Havendo **valor medido + limite numérico + unidade**, aparece um aviso âmbar: “Sugestão do sistema:
&lt;conclusão&gt; (comparação entre valor medido e limite). Confirme, altere ou ignore — o que vale é
a sua conclusão”, com o atalho **Usar sugestão**. É só isso: a sugestão nunca preenche o campo
sozinha, nunca sobrescreve o que foi escolhido e o backend não a recalcula ao salvar. No QA gravamos
deliberadamente `Abaixo do limite` com medição de 87,5 dB(A) contra limite de 85 — e foi **essa** a
conclusão persistida.

### Edição

Reabrir a avaliação traz método, valor, unidade, limite e conclusão preenchidos. Apagar os campos e
salvar limpa o bloco (volta a `null`); o histórico de avaliações continua como antes, 1:N por data.

### Onde o dado aparece

- Aba **Inventário de Riscos** do PGR (visão consolidada): método, resultado medido, limite e
  conclusão no detalhe do risco.
- Seção 3 do PDF (abaixo).

## #47 — Estrutura do PDF do PGR

### Onde se edita o 5W2H

**Riscos → abrir o risco → Medidas de controle → Nova medida** (ou editar). O cartão **“Plano de ação
5W2H”** agora tem os sete elementos:

| Elemento | Campo na tela                            |
| -------- | ---------------------------------------- |
| O quê    | Ação a implementar                       |
| Por quê  | **Por que a medida é necessária** (novo) |
| Onde     | GES do risco (derivado, não se digita)   |
| Quando   | Prazo para execução                      |
| Quem     | Responsável pela ação                    |
| Como     | Como será implementada                   |
| Quanto   | **Custo estimado (R$)** (novo)           |

Motivo e custo são **opcionais** e não foram tornados obrigatórios para registros antigos. Em branco,
o documento imprime “não informado” — o sistema não inventa texto. A regra do #42 continua: risco
moderado ou superior com medida aplicável exige responsável e prazo.

### Como se gera o PDF

No PGR, etapa **6. Documentos e PDF**:

- **Baixar agora** — rota `GET /api/v1/pgr/{id}/pdf` (aceita `?color=`), gera na hora e não guarda
  cópia;
- **Arquivar no GED** — enfileira um job `pdf_batch`; o worker gera e grava como documento versionado
  do PGR. No QA os dois caminhos produziram **o mesmo arquivo** (48.521 bytes, texto idêntico).

### O que sai no documento

```
capa → cabeçalho ISO (quando configurado) → sumário →
  1. Identificação
  2. Inventário de riscos (NR-01)
  3. Avaliação quantitativa de agentes (NR-09)
  4. Plano de ação (5W2H)
  5. Hierarquia de controles (NR-01)
```

- **Seção 1** — empresa (razão social, nome fantasia, CNPJ, CNAE, atividade, grau de risco, endereço,
  site), unidade/obra (nome, contrato, endereço, vigência), responsável técnico (nome, registro, ART
  anexada, emissão e validade) e **preposto** (nome, cargo, título e registro profissional, vindos de
  `work_units.manager_name`/`manager_role` — o campo que o cadastro chama “Gestor/Preposto”). Campo
  vazio imprime “não informado”.
- **Seção 2** — o inventário de sempre, agora também com código eSocial, unidade, concentração de
  referência, limite textual, EPIs indicados e a cobertura do plano (#42).
- **Seção 3** — uma tabela por GES, só com agentes físicos/químicos/biológicos: agente, descrição,
  método, resultado com unidade, limite, conclusão e data. Risco elegível sem medição sai como “Sem
  medição registrada — avaliação quantitativa pendente”, e o rodapé declara quantos riscos do GES
  ficaram fora por não serem objeto da NR-09. Ausência de medição **não** vira conformidade.
- **Seção 4** — o 5W2H completo, lido de `control_measures`. Nenhum dado vem de `action_plans`: a
  ponte #51 preenche `who`/`why`/`where` com texto gerado (“Responsável não definido”, “Ambiente não
  informado”, “Medida de controle nível …”) e isso não entra em documento legal.
- **Seção 5** — hierarquia de controles, como já era.

### E a NR-17?

**Não existe neste documento.** A integração NR-17 depende da issue #40, que não tem implementação. Em
vez de imprimir uma seção vazia ou reaproveitar dados do módulo psicossocial (que é outro assunto —
campanhas e questionários), o PDF simplesmente não traz a seção, e a numeração é sequencial pelo que
existe. Quando a #40 chegar, a seção entra na ordem e as seguintes se renumeram sozinhas. A #47
**permanece aberta** por causa disso.
