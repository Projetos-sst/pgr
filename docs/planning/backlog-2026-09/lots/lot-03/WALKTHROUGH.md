# Lote 3 — Walkthrough

Comportamento **real** entregue pelo lote, do jeito que o usuário encontra no sistema. Escrito
depois da implementação e dos gates técnicos; o que está aqui foi visto funcionando.

Issues: **#40** (NR-17), **#47** (fechamento do PDF do PGR), **#48** (NR-18 + relação de EPIs).

---

## #40 — Avaliação ergonômica (NR-17)

### Onde fica

No **detalhe do risco** (`/risks/{id}`), abaixo dos dados do risco, existe a seção
**"Avaliação ergonômica (NR-17)"**. Ela mostra a avaliação **vigente** e dá acesso ao histórico.
A barra de ações do topo ganhou o botão **NR-17**, ao lado de "Avaliações" e "Medidas de controle".

Rotas:

| Rota                                                    | O que é                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `/risks/{id}`                                           | seção com a avaliação vigente            |
| `/risks/{id}/ergonomic-evaluations`                     | histórico completo (vigente em destaque) |
| `/risks/{id}/ergonomic-evaluations/new`                 | nova avaliação                           |
| `/risks/{id}/ergonomic-evaluations/{evaluationId}/edit` | edição                                   |

### Criar uma avaliação

"Nova avaliação" abre o formulário centralizado (940 px), dividido em cartões:

1. **Identificação da avaliação** — data (único campo obrigatório), responsável, método/instrumento
   (campo livre com sugestões: AEP, Checklist de Couto, RULA, REBA, NIOSH, Moore-Garg, entrevista,
   COPSOQ) e campanha psicossocial opcional.
2. **Aspectos físicos** — postura, movimentos, carga física e ambiente físico.
3. **Aspectos mentais e organizacionais** — carga mental e organização do trabalho.
4. **Observações gerais** — texto livre + atalho "Anexar laudo (AET)".

Cada dimensão tem um **select de adequação** (Adequado / Inadequado / Não aplicável) e uma
**observação**. Deixar o select em branco significa **"não avaliado"** — uma avaliação parcial é
válida e o sistema não completa nada por conta própria. Não existe nota, escore nem conclusão geral:
a NR-17 não fixa nenhum, e o sistema não inventa norma.

### Histórico e vigência

Cada "Nova avaliação" **acrescenta** uma linha; nada é sobrescrito. A lista mostra data, situação
(**Vigente** / **Histórico**), responsável, método e um resumo das dimensões ("4 de 6 avaliadas ·
2 inadequadas"). A vigente é a de data mais recente; empate de data desempata pela criação mais
recente e, em último caso, pelo id — o resultado é sempre o mesmo. Abaixo da lista, um cartão
mostra as seis dimensões da avaliação vigente com badge por situação.

Editar e excluir estão na linha (ícone e confirmação padrão). Excluir remove **só** aquela
avaliação; o resto do histórico permanece.

### Responsável e método

Os dois são **o que foi digitado**. O sistema não preenche o responsável com o usuário logado, o
dono da organização nem o responsável técnico do PGR — não há cadastro estruturado de profissional
(isso é a #36), e inventar identidade num documento legal não é opção.

### AET

A **AET** (análise ergonômica do trabalho) não virou formulário: é laudo. O atalho
**"Anexar laudo (AET)"**, no último cartão do formulário, abre o upload do GED já com o vínculo ao
risco e o tipo "Análise Ergonômica do Trabalho (AET)" preenchidos. O documento entra no acervo
normal, com versionamento (#56) e histórico — nenhuma infraestrutura nova de documento.

### Campanha psicossocial (opcional)

O campo lista **apenas** campanhas **encerradas** da **mesma unidade** do GES do risco. Quando não
há nenhuma compatível, o campo aparece desabilitado com o aviso de que o vínculo é opcional e a
avaliação continua válida.

Com campanha vinculada, o sistema mostra o **resultado agregado**: nome da campanha, período,
número de respostas e os fatores derivados com nível. Nada mais. **Nenhuma resposta individual** é
lida (as respostas nem sequer têm vínculo com pessoa no modelo) e **não existe escore COPSOQ** — se
"COPSOQ" aparecer, é o texto que o profissional escreveu no campo de método.

As três regras do vínculo valem no **servidor**, não só na tela: campanha de outro escritório →
`FK_NOT_FOUND`; de outra unidade → `VALIDATION`; ainda não encerrada → `VALIDATION`.

### Como chega no PDF

A avaliação **vigente** de cada risco entra na seção NR-17 do documento (abaixo).

---

## #47 — PDF do PGR

### Ordem final das seções

1. Identificação
2. Inventário de riscos (NR-01)
3. Avaliação quantitativa de agentes (NR-09)
4. **Avaliação ergonômica (NR-17)** ← nova
5. Plano de ação (5W2H)
6. **Relação de EPIs** ← nova (#48)
7. Hierarquia de controles (NR-01)

A numeração é **sequencial pelo que existe**: desligar uma seção renumera as seguintes sozinha. O
sumário acompanha.

### O que a seção NR-17 imprime

Por GES, um bloco vertical por risco avaliado (layout escolhido para caber em A4 — tabela horizontal
com seis dimensões e seis observações ficaria ilegível):

- cabeçalho com agente e descrição do risco;
- data da avaliação, responsável e método/instrumento;
- tabela **Dimensão · Situação · Observação** com as seis dimensões;
- observações gerais, quando houver;
- bloco **"Resultado agregado da campanha psicossocial"**, quando houver campanha vinculada, com
  campanha, período, respostas recebidas e a tabela de fatores com nível.

### Estados honestos

- Risco sem avaliação: aparece **nominalmente** na linha "Sem avaliação ergonômica registrada:
  <descrição do risco>". Não some do documento.
- GES em que nenhum risco foi avaliado: "Sem avaliação ergonômica registrada para os riscos deste
  GES".
- Dimensão em branco: **"Não avaliado"**. Nunca "Adequado".
- Dimensão declarada não aplicável: **"Não aplicável"** — distinta de ausência.

### Os dois caminhos de geração

- **Baixar agora** (aba "Documentos e PDF" do PGR) → rota síncrona `/api/v1/pgr/{id}/pdf`.
- **Arquivar no GED** → job `pdf_batch`, processado pelo worker, que vira documento versionado
  ligado ao PGR.

Os dois montam o HTML pelo mesmo template e a partir da mesma leitura consolidada; há teste de
integração provando que o conteúdo sai equivalente pelos dois.

---

## #48 — NR-18 e relação de EPIs

### Quando o painel NR-18 aparece

Na aba **"Documentos e PDF"** do PGR, **somente** quando a unidade do PGR é do tipo
**Obra / Canteiro** (`work_units.type = 'site'`). Em unidade administrativa ou frente de trabalho o
painel não aparece — nada de checklist irrelevante, e nenhum PGR comum é bloqueado por requisito de
obra.

### O checklist

Painel **"Documentos complementares (NR-18)"**, com contador "N de 4 anexados" e uma linha por tipo:

| Documento                                    | Situação                              |
| -------------------------------------------- | ------------------------------------- |
| Projeto da área de vivência                  | Anexado / Faltando                    |
| Projeto elétrico das instalações temporárias | Anexado / Faltando                    |
| Projetos de proteção coletiva                | Anexado / Faltando                    |
| Projeto de SPIQ                              | Anexado / Faltando — quando aplicável |

Cada linha mostra o documento vigente (nome e versão) e um link **Anexar** que abre o upload do GED
já com o `doc_type` e o vínculo ao PGR preenchidos.

O checklist é **informativo**: não bloqueia PDF, assinatura, publicação nem arquivamento.

### Versionamento

O checklist enxerga o **documento lógico vigente**, não cada versão. Subir a v2 de um projeto mantém
o requisito **Anexado** (e a linha passa a mostrar "(v2)"); excluir o grupo devolve o requisito a
**Faltando**. O que conta é o **tipo** gravado (`doc_type`), não o nome do arquivo: um PDF chamado
"Projeto de SPIQ.pdf" salvo como tipo "ART" **não** satisfaz requisito nenhum.

### Relação de EPIs

Painel **"Relação de EPIs"**, logo abaixo, **somente leitura**. A fonte é o cadastro:
PGR → GES vinculados → riscos → `epi_risk` → `epi_catalog`. Não há campo para digitar; para mudar
qualquer dado, o painel leva ao catálogo de EPI.

Colunas: EPI (com descrição), CA (com badge de situação e data), fabricante, norma, especificações
(material · tamanho · unidade · vida útil) e os riscos/GES atendidos.

- **Deduplicado por EPI**: um item que atende três riscos ocupa **uma** linha, com os três contextos.
- **Situação do CA**: vencido (vermelho), a vencer em até 30 dias (âmbar — a mesma janela que o KPI
  de EPI do dashboard já usava), válido (verde) e **validade não informada** (neutro), que é estado
  próprio e não vira "válido" nem "vencido".
- PGR sem EPI vinculado: "Nenhum EPI vinculado aos riscos deste PGR."

### No PDF

A mesma relação vira a seção **6. Relação de EPIs**, com as especificações agrupadas numa coluna
para caber em A4. Os **documentos** da NR-18 continuam como **anexos** no GED: o PGR os organiza e
referencia, mas nenhum binário (projeto elétrico, SPIQ, área de vivência) é concatenado ao PDF.

### API

Duas leituras derivadas, ambas só `GET` e testáveis no Postman:

- `GET /api/v1/pgr/{id}/nr18-checklist`
- `GET /api/v1/pgr/{id}/epi-relation`
