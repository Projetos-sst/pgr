# Questionário v3.0 — respostas oficiais e matriz de decisões

Referência única das 58 questões do questionário de definições do PGR-e (versão 3.0, 22/10/2026):
35 de Segurança do Trabalho (SEG-01 a SEG-35) e 23 de Medicina Ocupacional (MED-01 a MED-23). Serve para orientar
as próximas implementações sem reabrir os questionários.

Documento exclusivamente de consulta. Nenhum código, schema, migration ou status do Linear foi alterado para
produzi-lo.

## Fontes

| Parte           | Arquivo recebido                                      | Respondente                 | SHA-256 do arquivo | Leitura                                               |
| --------------- | ----------------------------------------------------- | --------------------------- | ------------------ | ----------------------------------------------------- |
| SEG-01 a SEG-35 | `QUESTIONARIO-PGR-e-segurança-Expedito.docx`          | Expedito                    | `eb05a329…aa5d6e5` | 102 caixas marcadas na Parte I, 0 na Parte II         |
| MED-01 a MED-23 | `QUESTIONARIO-PGR-e RESPOSTAS ALCIDES- MEDICINA.docx` | Dr. Alcides ("Coord PCMSO") | `d06e3cdb…2cfc5b`  | 72 caixas marcadas na Parte II, 3 na Parte I (SEG-28) |

- O arquivo do Expedito é a **versão preenchida depois da reunião de esclarecimentos**. Ele prevalece sobre a
  versão anterior (`QUESTIONARIO-RESPONDIDO-EXPEDITO.docx`, SHA-256 `bc36702c…a87ced`, 88 caixas).
  - Mudaram 11 questões: SEG-02, 06, 14, 15, 16, 17, 18, 20, 25, 26 e 30 (detalhe em [01](01-MATRIZ-MESTRE.md) §1).
  - A SEG-16 ganhou uma imagem da hierarquia de controle.
- O arquivo do Dr. Alcides é **idêntico, byte a byte,** ao lido em 01/11/2026 (`... RESPOSTAS EUCLIDES - MEDICINA.docx`).
  - A consolidação de Medicina já feita foi preservada: `docs/planning/medicina-ocupacional/geral/10-EXECUCAO-RESPOSTAS-DR-ALCIDES.md`, ainda na PR #138.
  - Ele também marcou a SEG-28 (15 dias, bloqueio de impressão e de assinatura/emissão). Isso coincide com o Expedito, mas não substitui a resposta dele.
- **Leitura:** o XML de cada DOCX (`w14:checkbox`/`w14:checked`), com tabelas, campos "Outro" e observações.
  - Cada arquivo tem 1.204 controles de seleção.
  - Proposta impressa no questionário ("Proposta inicial...") não é resposta.
- **Decisões posteriores às respostas:**
  - reunião com o Expedito: três formatos de contratação (só PGR, só Medicina, PGR + Medicina), preço pelo porte (número de funcionários), e precificação, faixas, valores, avulsos e cobrança deixados para o fim do desenvolvimento;
  - decisões registradas pela equipe no documento de alinhamento da PR #137, aberta;
  - decisões técnicas `MED-EXE-01..07`, da PR #138.

### Normas conferidas no texto oficial

| Norma                                | Versão / data                                                                                                                                                     | Itens usados                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| NR-01, capítulo 1.5                  | Portaria MTE nº 1.419/2024 (DOU 28/08/2024; vigência 270 dias depois), retificada no DOU de 30/07/2025. PDF SHA-256 `bc1285ac…8d906975`, consultado em 02/11/2026 | 1.5.4.4.6, 1.5.4.4.6.1, 1.5.5.1.1, 1.5.5.1.2, 1.5.7.1, 1.5.7.2, 1.5.7.2.1, 1.5.7.3.2, 1.5.7.3.3.1 |
| NR-07                                | Portaria MTP nº 567/2022. PDF SHA-256 `f27b63bb…be938b63`, consultado em 01/11/2026                                                                               | 7.4.1 c, 7.5.2, 7.5.8, 7.5.9, 7.5.11, 7.5.19.1, 7.6.1.1; Anexo II 4.1.1; Anexo III 2.17 e 3.5     |
| NR-06 (CA e fornecimento de estoque) | Perguntas e Respostas sobre EPI do MTE (cita itens 6.9.2.1 e 6.9.2.1.1) e Notas Técnicas 146/2015 e 130/2018                                                      | Conferir o texto consolidado vigente da NR-06 antes de implementar                                |

## Documentos

| Documento                                                          | Conteúdo                                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [01-MATRIZ-MESTRE.md](01-MATRIZ-MESTRE.md)                         | Documento B. As 58 questões: resposta marcada, observação, interpretação, status, comportamento esperado, impactos, dependências, Linear |
| [02-MATRIZ-IMPACTO.md](02-MATRIZ-IMPACTO.md)                       | Questão → decisão → issue → código existente → lacuna → impacto → prioridade → recomendação                                              |
| [03-CONFLITOS-E-RECOMENDACOES.md](03-CONFLITOS-E-RECOMENDACOES.md) | Documento C. Conflitos internos e entre Segurança e Medicina, por prioridade (crítico, alto, médio, baixo)                               |
| [04-REGISTRO-DE-DECISOES.md](04-REGISTRO-DE-DECISOES.md)           | Documento D. Decisões técnicas `DT-NN`: alternativas, recomendação, risco, fonte, responsável, estado                                    |

O Documento A (DOCX único com as 58 questões, marcações originais e notas da equipe separadas) fica fora do
repositório, junto dos arquivos recebidos: `PGR-e-entregaveis/RESPOSTAS QUESTIONARIO/QUESTIONARIO-RESPONDIDO-CONSOLIDADO-V2-2026-11-02.docx`.

## Como ler

Cada questão separa seis camadas, que nunca se misturam:

1. **Resposta original:** o que o profissional marcou e escreveu (redação preservada).
2. **Interpretação funcional:** a leitura da equipe.
3. **Recomendação técnica:** alternativa segura da equipe. Não é aprovação do profissional.
4. **Exigência normativa verificada:** só com item e fonte oficial conferidos.
5. **Decisão aprovada:** quando alguém com autoridade decidiu (com quem e onde).
6. **Pendência de implementação.**

Status (um por questão):

| Status                             | Significado                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **DEFINIDO**                       | Resposta clara, sem conflito material                                                                                         |
| **DEFINIDO COM RESSALVAS**         | Direção clara, com limites, exceções ou subperguntas sem resposta                                                             |
| **AMBÍGUO**                        | Marcações incompatíveis entre si ou com a observação                                                                          |
| **A DEFINIR**                      | O respondente deixou explicitamente sem definição                                                                             |
| **VALIDAÇÃO NORMATIVA NECESSÁRIA** | A resposta, como está, não pode ser implementada antes de resolver a exigência legal, médica, de privacidade ou de assinatura |

Marcadores complementares: **VN** (há ponto normativo a conferir, mesmo com direção definida) e **DTR** (existe
decisão técnica recomendada no [04](04-REGISTRO-DE-DECISOES.md)).

## Manutenção

- Este conjunto é atualizado quando chegar resposta nova, ata ou decisão registrada. Não crie cópias.
- Uma decisão `DT-NN` só muda para "validada" com o nome de quem decidiu, a data e onde ficou registrado.
- "Implementado" exige código mergeado na `develop` e teste. PR aberta é "em revisão".
