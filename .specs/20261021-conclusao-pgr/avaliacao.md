# Comparação inicial dos anexos com o código

Referências recebidas em 21/10: Avaliação do e-PGR (DOCX) e PGR plataforma
preenchido (PDF de 22 páginas, emissão indicada em 15/10/2026). Não foram
identificados como modelo final aprovado. Conteúdo e dados dos anexos não
foram copiados para fixtures nem para o Git.

| Observação                                     | Evidência atual e encaminhamento                                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CNPJ com pontuação                             | Máscara/normalização e dígitos já existentes; NOB-102 integrada e testes aprovados. Não refazer.                                                          |
| Logo e foto como caminho textual               | Há uploads nas telas de empresa/funcionário. Homologação real de Storage permanece necessária.                                                            |
| Gestor, título e registro profissional da obra | Campos persistidos em work_units. Conferir mapeamento documental na NOB-105.                                                                              |
| Pé-direito com vírgula                         | Normalização já presente no domínio GES. Não transformar cobertura em número, pois é descrição de material/tipo.                                          |
| Inventário, medidas e plano                    | Existem camadas persistidas e relações; preservar regras configuráveis, conferir saída e ausências na emissão.                                            |
| Máquinas por ambiente                          | Catálogo existente; vínculo de instalação, fatos de segurança e histórico implementados na continuidade da NOB-104.                                       |
| Formato do PGR                                 | Template DOCX existente, diferente do estado relatado no Word. Acrescentar equipamentos e verificar consistência antes de emitir.                         |
| IA apenas dicas                                | Integração assistiva não equivale a emissão/revisão técnica automática. Não inferir aprovação ou conteúdo profissional. Expansão de IA é backlog próprio. |
| CNAE/CBO automáticos                           | Dependem das fontes/integradores; não inventar dados. A consulta via CNPJ existente não equivale a catálogo completo de CNAE/CBO.                         |

## Inconsistência objetiva da referência

Página 20 do PDF: Risco 3 tem probabilidade 2 e severidade 2, mas aparece como
Trivial (1–2). O produto é 4; pela legenda do próprio documento seria Tolerável
(3–6). Não copiar essa classificação para fixtures ou alterar metodologia atual
para reproduzir o erro. Conferir as faixas configuradas da organização.

Os exemplos e observações orientam software e testes; a revisão profissional,
a aprovação do modelo e as condições comerciais continuam sendo registros
reais a obter, nunca resultados presumidos por esta implementação.
