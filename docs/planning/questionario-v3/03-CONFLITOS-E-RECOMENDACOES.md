# 03 · Conflitos, ressalvas e recomendações (Documento C)

Organizado por prioridade:

- **Crítico:** segurança, sigilo, exigência normativa.
- **Alto:** impede fluxo funcional.
- **Médio:** decisão importante, mas reversível.
- **Baixo:** UX, apresentação, configuração.

As recomendações remetem ao [04](04-REGISTRO-DE-DECISOES.md) e não são aprovações dos profissionais.

## 1. Matriz de conflitos entre Segurança e Medicina

### C-01 · SEG-06 × MED-17 — permissões e sigilo · CRÍTICO

| Campo                   | Conteúdo                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segurança               | Separação "de menu e de permissão". Incidentes e psicossocial em "Ambas", com campos de saúde restritos por campo ou registro (versão pós-reunião; antes era "apenas de menu") |
| Medicina                | O RH vê tipo, data, conclusão, validade e a restrição necessária ao trabalho; nunca resultados. CID só com autorização do trabalhador. ASO e atestados são tópicos distintos   |
| Natureza                | Não há contradição. As duas pedem sigilo, mas o sistema hoje só separa módulos por empresa e qualquer colaborador vê as duas áreas. A PR #137 trata só navegação               |
| Consequência            | Sem controle de acesso por área e campo, dados de saúde (lesão, afastamento, acompanhamento psicossocial, futuro prontuário) ficam visíveis à equipe de Segurança e ao RH      |
| Alternativa recomendada | DT-02 (acesso por empresa e módulo) + DT-03 (perfis de área com restrição de campos de saúde no servidor e na RLS) + DT-21 (visão do RH)                                       |
| Norma                   | NR-07 7.6.1 (prontuário sob responsabilidade do médico); LGPD, art. 11 (dado de saúde sensível)                                                                                |
| Pode ser adotado agora  | Projeto do modelo de permissões e auditoria dos campos de saúde em incidentes e psicossocial; nenhuma tela nova de saúde aberta ao RH antes disso                              |
| Não pode ser assumido   | Que filtro de menu basta; que o RH veja resultado ou CID; que o colaborador de Segurança veja dado clínico                                                                     |

### C-02 · SEG-19/20/21 × MED-03/09/15 — validação de riscos e definição de exames · ALTO

| Campo                   | Conteúdo                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança               | A mesma validação vale para todos os riscos (SEG-19). A empresa indica o autorizador no sistema; o autorizado pode ser externo, com acesso próprio (SEG-20). Risco alterado volta para validação e o médico é notificado sem validar (SEG-21)                                                                                      |
| Medicina                | "quem valida os riscos é quem assina o PGR"; o coordenador define os exames a partir dos riscos (MED-03). "Ausência de riscos" só quando a função não está exposta (MED-09). O sistema relaciona exames aos riscos e o coordenador mantém, aumenta ou exclui (MED-15)                                                              |
| Natureza                | Terminologia e titularidade. A NOB-98 criou um "profissional autorizado" indicado pela empresa; o Dr. Alcides diz que valida quem assina o PGR. São compatíveis se o autorizado for o responsável pelo PGR ou alguém indicado. O fluxo implementado (o owner registra a indicação) diverge da SEG-20 (a empresa indica no sistema) |
| Consequência            | Risco de duas validações paralelas (Segurança e Medicina) ou de o médico ser tratado como validador                                                                                                                                                                                                                                |
| Alternativa recomendada | DT-12: uma validação por risco e versão, servindo às duas áreas; o médico notificado e com uso só de riscos validados (NOB-98 e NOB-147 já fazem assim); DT-27 para a indicação pelo representante                                                                                                                                 |
| Norma                   | NR-07 7.5.1 (PCMSO considera os riscos do PGR); 7.5.5 (inconsistência reavaliada com os responsáveis pelo PGR)                                                                                                                                                                                                                     |
| Pode ser adotado agora  | Manter o fluxo da NOB-98 como base comum; validação individual do inventário de Segurança (NOB-103) e notificação ao médico                                                                                                                                                                                                        |
| Não pode ser assumido   | Que o médico valide riscos; que "ausência de riscos" seja automática; que a IA ou importação valide                                                                                                                                                                                                                                |

### C-03 · SEG-07/09/24 × MED-01/11/12 — responsabilidades e documentos · ALTO

| Campo                   | Conteúdo                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança               | O elaborador assina e a empresa dá ciência ou aprova (SEG-07); fluxo com revisão técnica e aprovação (SEG-09); cada PGR revisado por pessoa distinta, com acesso próprio (SEG-24)                                                                                                      |
| Medicina                | O examinador conclui e assina o ASO; o coordenador consta, com RQE (MED-01). Correção por substituição, sem apagar (MED-11). Três métodos de assinatura "válidos" (MED-12)                                                                                                             |
| Natureza                | Os modelos de responsabilidade são diferentes e legítimos: PGR (elaboração, revisão por par, responsável, ciência) × ASO (ato médico individual). O conflito interno da Segurança (SEG-07 × SEG-24) precisa de leitura integrada. Equivalência jurídica das assinaturas não confirmada |
| Consequência            | Uma "assinatura" ou "aprovação" genérica servindo aos dois documentos misturaria responsabilidades                                                                                                                                                                                     |
| Alternativa recomendada | DT-04 (fluxo do PGR), DT-06 (imutabilidade e substituição), DT-21 (ASO). Sem assinatura verificável, o documento sai como prévia                                                                                                                                                       |
| Norma                   | NR-01 1.5.7.2 (PGR datado e assinado sob responsabilidade da organização); NR-07 7.5.19.1 (ASO com examinador identificado e assinatura)                                                                                                                                               |
| Pode ser adotado agora  | Imutabilidade, versões e substituição; separar os papéis de revisor e de administrador                                                                                                                                                                                                 |
| Não pode ser assumido   | Que o administrador aprove os próprios documentos; que um método de assinatura tenha validade jurídica sem verificação; assinatura fictícia                                                                                                                                            |

### C-04 · SEG-12 × MED-18 — guarda, exportação e exclusão · CRÍTICO

| Campo                   | Conteúdo                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança               | O administrador pode excluir PGR emitido, com motivo; depois do contrato, os dados ficam 1 ano, com avisos e exportação completa (SEG-12)                                                                                                                                    |
| Medicina                | 20 anos depois do desligamento; "30 anos é uma lei geral e não ocupacional"; destino depois do prazo sem marcação (MED-18)                                                                                                                                                   |
| Natureza                | Prazo contratual da plataforma × obrigações legais de guarda da organização                                                                                                                                                                                                  |
| Consequência            | A exclusão em 1 ano ou pelo administrador pode deixar a empresa sem registros obrigatórios (20 anos), se ela não exportou. Prontuários não podem seguir a regra contratual da Segurança                                                                                      |
| Alternativa recomendada | DT-07: sem exclusão automática; arquivar toda emissão com integridade; exportação completa; "excluir" vira cancelar ou inativar; regra final por cláusula jurídica                                                                                                           |
| Norma (conferida)       | NR-01 1.5.7.3.3.1 (histórico do inventário, mínimo 20 anos); NR-01 1.5.7.2.1 (disponibilidade); NR-07 7.6.1.1 (20 anos, ressalvados os Anexos); NR-07 Anexo III 2.17 (exames pós-demissionais do asbesto por 30 anos, que é uma obrigação de oferecer exames, não de guarda) |
| Pode ser adotado agora  | Arquivamento imutável da emissão e exportação; política de "nenhuma exclusão automática" documentada                                                                                                                                                                         |
| Não pode ser assumido   | Exclusão automática; exclusão física de PGR emitido; que o prazo da Segurança vale para dados clínicos; que os 30 anos sejam irrelevantes para expostos a amianto (conferir também a NR-15, Anexo 12)                                                                        |

### C-05 · SEG-27/30 × contratação independente de Medicina · MÉDIO

| Campo                   | Conteúdo                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segurança               | Módulos PGR e Medicina contratados separadamente, com o Pro como nível de recursos e valores a definir (SEG-27); habilitação e cobrança "A definir" (SEG-30) |
| Medicina                | Sem pergunta comercial; a NOB-100 (Done) já habilita PGR e Medicina por empresa                                                                              |
| Reunião                 | Três formatos (só PGR, só Medicina, PGR + Medicina); preço por porte; comercial no fim                                                                       |
| Natureza                | Compatível na direção. Como Pro e porte se combinam continua aberto                                                                                          |
| Consequência            | Se o comercial bloquear a habilitação, a Medicina para por dependência comercial                                                                             |
| Alternativa recomendada | DT-24: habilitação manual pelo owner até o comercial; nenhum fluxo clínico ou operacional depende de cobrança                                                |
| Pode ser adotado agora  | Manter a NOB-100 como está; tirar da tela os valores não aprovados                                                                                           |
| Não pode ser assumido   | Preços, faixas, limites ou Enterprise; que a pilha comercial simulada seja a oferta aprovada                                                                 |

### C-06 · SEG-34 × confidencialidade de dados sensíveis · CRÍTICO

| Campo                   | Conteúdo                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança               | Marcação "mínimo 3 configurável"; a observação recomenda 5, por corte, e contra dedução por diferença                                                             |
| Medicina                | Psicossocial em "Ambas" (SEG-06); a MED-20, regra 7, aceita risco psicossocial de nível médio ou maior no ASO; o acompanhamento clínico é de Saúde                |
| Natureza                | A marcação contradiz a própria recomendação. Também há risco de dado individual migrar para o ASO                                                                 |
| Consequência            | Grupos pequenos permitem identificar respondentes. Hoje a agregação mostra médias sem mínimo                                                                      |
| Alternativa recomendada | DT-17 (mínimo 5 por corte, supressão complementar, configurável só para cima). No ASO, só o perigo psicossocial da função (inventário), nunca resposta individual |
| Norma                   | LGPD (dado que permita identificar; saúde é sensível). O próprio respondente diz que o número 5 não tem base legal citável                                        |
| Pode ser adotado agora  | Supressão de grupos pequenos (prometida no próprio questionário)                                                                                                  |
| Não pode ser assumido   | Que o mínimo 3 está aprovado ou que o 5 é exigência legal                                                                                                         |

### C-07 · SEG-35 × MED-23 — funcionalidades e eventos do eSocial · MÉDIO

| Campo                   | Conteúdo                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segurança               | Transmissão de eventos de SST ao eSocial e emissão oficial da CAT (S-2210): "A definir"                                                                      |
| Medicina                | "Envio de eventos de saúde ao eSocial (S-2220)": "Incluir"                                                                                                   |
| Natureza                | Parecem opostos, mas preparar e exportar o evento é diferente de transmitir                                                                                  |
| Consequência            | Implementar transmissão só do S-2220 criaria um caminho de envio sem decisão sobre certificado, procuração e responsabilidade, que a SEG-35 deixou em aberto |
| Alternativa recomendada | DT-18: S-2220 preparado, validado e exportado (NOB-140); transmissão única para S-2210/2220/2240 só depois da decisão                                        |
| Pode ser adotado agora  | Gerar e validar o XML do S-2220 a partir do ASO emitido; nunca afirmar envio sem protocolo                                                                   |
| Não pode ser assumido   | Que o eSocial é transmitido pela plataforma; que a CAT oficial está no escopo                                                                                |

## 2. Conflitos e ressalvas por prioridade

### Crítico

| ID   | Questões                | Conflito ou lacuna                                                                                                                                                                               | Recomendação  |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| C-01 | SEG-06 × MED-17         | Sigilo sem permissão por área e campo (acima)                                                                                                                                                    | DT-02, 03, 21 |
| C-04 | SEG-12 × MED-18         | Exclusão × guarda legal (acima)                                                                                                                                                                  | DT-07         |
| C-06 | SEG-34                  | Mínimo 3 × recomendação 5 (acima)                                                                                                                                                                | DT-17         |
| C-08 | SEG-03                  | Hoje todo colaborador vê todas as empresas; a resposta exige atribuição por empresa e módulo. Nenhuma issue cobre                                                                                | DT-02         |
| C-09 | SEG-29                  | Bloquear o download do PGR emitido durante a inadimplência × NR-01 1.5.7.2.1 (documentos sempre disponíveis à fiscalização e aos trabalhadores); "bloquear impressão pela tela" não é garantível | DT-14         |
| C-10 | MED-20 regra 10 × NR-07 | "Não vale" para o acompanhamento pós-demissional do amianto × NR-07 Anexo III 2.17 (obrigatório por 30 anos). Prevalece a norma                                                                  | DT-22         |
| C-11 | MED-10                  | Marcações (descrição da restrição impressa) × observação (apto ou inapto; detalhes no prontuário) × NR-07 7.5.19.1                                                                               | DT-21         |
| C-12 | SEG-31                  | Biometria proposta como forma de assinatura: dado sensível (LGPD, art. 11), exige base legal e alternativa                                                                                       | DT-16         |

### Alto

| ID   | Questões                      | Conflito ou lacuna                                                                                                                                                  | Recomendação                                                      |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| C-02 | SEG-19/20/21 × MED-03/09/15   | Validação de riscos e definição de exames (acima)                                                                                                                   | DT-12                                                             |
| C-03 | SEG-07/09/24 × MED-01/11/12   | Responsabilidades e documentos (acima)                                                                                                                              | DT-04, 06, 21                                                     |
| C-13 | SEG-07 × SEG-09 × SEG-24      | A SEG-07 escolhe "elabora e assina" sem revisor; a SEG-09 e a SEG-24 exigem revisão por outro profissional                                                          | DT-04                                                             |
| C-14 | SEG-08 × SEG-13               | "Não se aplica" não pode ser emitido × registro em conselho não obrigatório; "responsável e seu registro" bloqueante                                                | DT-05                                                             |
| C-15 | SEG-13                        | Exceção justificada para qualquer bloqueante pode virar autorização genérica para emitir documento incompleto                                                       | DT-08                                                             |
| C-16 | SEG-20 × código               | A resposta (a empresa indica no sistema) diverge do fluxo implementado (o owner registra com evidência)                                                             | DT-27                                                             |
| C-17 | SEG-31 × código               | A entrega não verifica o CA; a marcação (bloquear) conflita com a observação (estoque pode ser fornecido); o link de 72 h não atende à prática                      | DT-15, 16                                                         |
| C-18 | SEG-24 × código               | Na `develop`, só o administrador registra parecer de amostra; a revisão por PGR com revisor próprio está na PR #137 (aberta)                                        | DT-04                                                             |
| C-19 | MED-07 × código               | O exame segue o funcionário na transferência; a resposta exige vínculo à empresa de origem                                                                          | NOB-112 (migration)                                               |
| C-20 | MED-03 × documento da PR #137 | O alinhamento de 27/10 (PR #137) classifica as MED-01..23 como "decisão externa" e as SEG-02/14/18/20 sem resposta; isso ficou desatualizado com os arquivos finais | Atualizar o documento da PR #137 (do Rikelvin; não alterado aqui) |

### Médio

| ID   | Questões        | Conflito ou lacuna                                                                                                                          | Recomendação                           |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| C-05 | SEG-27/30       | Contratação independente (acima)                                                                                                            | DT-24                                  |
| C-07 | SEG-35 × MED-23 | eSocial (acima)                                                                                                                             | DT-18                                  |
| C-21 | SEG-15          | "Fundacentro" e "Outro" marcados; a própria observação diz que a Fundacentro não tem padrão                                                 | DT-09                                  |
| C-22 | SEG-16 × código | Cinco níveis (com Substituição e Engenharia) × enum de quatro níveis; NR-01 usa "proteção coletiva"; a imagem diz "Redução ou substituição" | DT-10                                  |
| C-23 | SEG-18          | Tabela de exemplos e unidades usuais não define campos obrigatórios                                                                         | DT-11                                  |
| C-24 | SEG-28 × código | Download permitido × impressão bloqueada (incompatível); marca "irremovível" em DOCX; `TRIAL_DAYS = 7` na `develop`                         | DT-13                                  |
| C-25 | SEG-22          | Seis de sete itens do cadastro de máquinas "A definir"; anexos definidos, mas inexistentes no código                                        | NOB-104 (não homologar)                |
| C-26 | MED-02 × MED-14 | "PCMSO é emitido novamente" × "mudança de coordenador é atualização, não revisão"                                                           | MED-EXE-03; nova edição administrativa |
| C-27 | MED-19 × NR-07  | 120 dias (observação) × 135 dias (NR-07 7.5.11). O 120 corresponde à audiometria (NR-07, Anexo II, 4.1.1)                                   | Implementado pela norma (NOB-145)      |
| C-28 | SEG-21          | "Quais alterações exigem revalidação" depende do responsável técnico                                                                        | DT-12                                  |
| C-29 | MED-21          | Para as próximas entregas, "a IA pode concluir essa parte"                                                                                  | DT-25                                  |
| C-30 | SEG-02 × MED-04 | Na Segurança, a clínica não entra (alt. 3 não marcada); na Medicina, a clínica pode ter acesso restrito e concluir o ASO                    | DT-26                                  |

### Baixo

| ID   | Questões | Ressalva                                                                      | Recomendação                            |
| ---- | -------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| C-31 | SEG-11   | Antecedência "Outro" marcada sem valor; 30 dias como padrão                   | Configurável depois                     |
| C-32 | SEG-14   | Aprovador dos textos padrão não marcado                                       | DT-28                                   |
| C-33 | SEG-17   | Tabela por função e consolidada ainda ausente no DOCX                         | Evolução do template                    |
| C-34 | SEG-32   | Escala padrão sim/não × C/NC/NA ("Outro" digitado, desmarcado)                | DT-20                                   |
| C-35 | MED-22   | "Somente dados inventados" e "alguns dados reais de empresas" marcados juntos | Sem efeito; nada é copiado do protótipo |

## 3. Comportamentos já implementados que podem precisar de correção

| Item                                          | Situação atual                                      | Resposta                                 | Ação sugerida                                                           |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Navegação Saúde × Segurança (PR #137, aberta) | Itens nos dois menus sem novas permissões           | SEG-06: menu **e** permissão             | Revisar antes do merge da #137 ou tratar em issue de permissões (DT-03) |
| Indicação do autorizador (NOB-98, Done)       | Owner registra com evidência                        | SEG-20: a empresa indica no sistema      | Transição documentada até o perfil do representante (DT-27)             |
| Teste grátis (`develop`)                      | 7 dias                                              | SEG-28: 15 dias por CNPJ                 | Corrigir junto da pilha comercial (NOB-118)                             |
| Psicossocial (`develop`)                      | Médias para qualquer tamanho de grupo               | SEG-34 (ambas as leituras exigem mínimo) | Corrigir já (DT-17)                                                     |
| Níveis de controle (`develop`)                | 4 valores                                           | SEG-16: 5 níveis                         | Migration aditiva (DT-10)                                               |
| Entrega de EPI (`develop`)                    | Sem verificação de CA; link de 72 h                 | SEG-31                                   | DT-15, DT-16                                                            |
| Exame após transferência (`develop`)          | O exame segue o funcionário                         | MED-07                                   | Empresa de origem no exame (NOB-112)                                    |
| Alinhamento da PR #137                        | MED "decisão externa"; SEG-02/14/18/20 sem resposta | Arquivos finais                          | Atualizar o documento (Rikelvin)                                        |
