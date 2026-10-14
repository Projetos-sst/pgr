# Metodologia de Avaliação de Riscos — refinamento visual

Rota `/risk-methodology`. Trabalho de UI/UX sobre tela existente: **nenhuma regra
da metodologia foi alterada**. Data: 13/10/2026.

---

## 1. O que estava errado (medido no navegador, antes de mexer)

| #   | Problema                                                               | Evidência                                                                                                                    |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A   | Nenhum agrupamento: as seções eram `h2` + conteúdo solto sobre o fundo | 0 cartões de seção na página (as demais telas de formulário usam `FormSection`)                                              |
| B   | Campo fora do design system                                            | 25 inputs a **38px / raio 12 / 14px**; o campo do sistema é **46px / raio 11 / 13px**                                        |
| B   | Campos sem rótulo visível e sem cabeçalho de coluna                    | só `aria-label`                                                                                                              |
| C   | Matriz pequena perto da largura disponível                             | tabela de **636px** num container de **1320px** (48%), célula 96×52                                                          |
| D   | Faixas de classificação espremidas                                     | cinco blocos de 96–128px de largura, input de 80px                                                                           |
| E   | Hierarquia NR-01 em pílulas largas e rasas                             | 4 linhas de 1320×38 com pouca hierarquia                                                                                     |
| F   | Botão Salvar solto no canto inferior esquerdo                          | sem área de ações                                                                                                            |
| G   | **Rolagem horizontal da página no mobile**                             | 375px → `scrollWidth` 454 (**+79px**); 320px → 454 (**+134px**). Causa: a grade `2rem 1fr 2fr` das gradações nunca colapsava |

## 2. O que foi feito

| Área      | Mudança                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Container | 1120px, centralizado, eixo único para todos os cartões, cabeçalho com ícone (o mesmo glifo `sliders` do menu)                          |
| Seções    | 6 cartões `FormSection` (glass + título mono/caixa-alta + descrição)                                                                   |
| Gradações | grade `nível \| rótulo \| descrição` com cabeçalho de coluna no desktop; no mobile, blocos empilhados com rótulo próprio em cada campo |
| Campos    | os 25 passam a usar a classe de campo do design system (exportada por `_ui/form`)                                                      |
| Matriz    | largura do cartão, célula 161×62, eixos explícitos, `scope`/`caption`, rolagem **dentro** do cartão                                    |
| Faixas    | cartões 1 → 2 → 3 → 5 colunas, ponto de cor + nome + intervalo em mono + campo rotulado + erro junto do campo                          |
| NR-01     | algarismo romano em selo, nome em destaque, descrição em texto secundário                                                              |
| Ações     | barra final com o estado do envio ao lado do botão                                                                                     |

### Largura: por que 1120 e não 940

As telas de formulário do sistema usam 940px. Só as cinco colunas da matriz mais
o cabeçalho de linha pedem ~940px — a 940 a matriz rolaria sempre. 1120 acomoda
a matriz inteira a partir de 1024px de viewport e mantém a linha de leitura dos
campos confortável (descrição em 610px no desktop).

## 3. Antes × depois (medido)

| Métrica                    | Antes                          | Depois                                    |
| -------------------------- | ------------------------------ | ----------------------------------------- |
| Cartões de seção           | 0                              | 6                                         |
| Altura dos campos          | 38px                           | **46px** (todos os 25)                    |
| Raio / tipografia do campo | 12px / 14px                    | **11px / 13px** (token do sistema)        |
| Largura da matriz (1440)   | 636px (48% do container)       | **1010px** (90% de 1120)                  |
| Célula da matriz           | 96×52                          | **161×62**                                |
| Rolagem horizontal em 375  | **+79px**                      | **0**                                     |
| Rolagem horizontal em 320  | **+134px**                     | **0** (matriz rola dentro do cartão)      |
| Erro de faixa              | só mensagem global do servidor | inline no campo + `aria-invalid` + global |

## 4. O que **não** mudou

`buildMatrix`, `classify`, `computeRiskLevel`, presets por base, gradações,
faixas, `methodologyInputSchema`, Server Action, persistência, isolamento por
tenant, RLS, papéis. Zero migration. Os rótulos canônicos do domínio
(`controlLevelLabel`) continuam intactos — a separação do algarismo romano é só
de exibição.

Conferido no navegador com os valores Fundacentro: a matriz devolve
1,2,3,4,5 / … / 5,10,15,20,25 e as classes Trivial→Intolerável exatamente como
antes; mudar o limite da faixa Trivial para 6 reclassifica tudo até 6 como
Trivial, como a regra derivada manda.

## 5. Acessibilidade

- Todo texto novo ou restilizado mede **≥ 6,1:1** (matriz 8,2:1; aviso âmbar
  6,6:1). A cor nunca é o único indicador: cada célula traz nível + nome da
  classe, e cada faixa traz ponto de cor + nome.
- Matriz com `caption` para leitor de tela e `scope` em todos os cabeçalhos.
- Campos com rótulo visível no mobile e `aria-label` descritivo no desktop; erro
  de faixa ligado ao campo por `aria-invalid`; faixa travada explicada por
  `aria-describedby`.
- Foco indigo visível em todos os 25 campos; todo controle do formulário ≥46px
  (os três controles de 40px da página são do cabeçalho global, pré-existentes).

**Pendente (fora do escopo desta tela):** dois padrões do design system ficam
abaixo de AA em qualquer tela do sistema — o título de seção em indigo/mono
(3,9:1) e a descrição do `PageHeader` em `text-text-subtle` (2,6:1). Mexer neles
é decisão de token, que atinge o sistema inteiro.

## 6. Verificação

| Viewport | Rolagem horizontal | Matriz                         |
| -------- | ------------------ | ------------------------------ |
| 320      | não                | rola dentro do cartão          |
| 375      | não                | rola dentro do cartão          |
| 768      | não                | rola dentro do cartão          |
| 1024     | não                | inteira, sem rolagem           |
| 1440     | não                | inteira (1010px)               |
| 1920     | não                | inteira, conteúdo centralizado |

`npm run check` PASS (0 erro de lint, 144 suítes, 1376 testes). Build e
integração verificados no CI da PR. 0 erro de console em todos os tamanhos.

Salvar: exercitado com faixa fora de ordem — o servidor recusou com
"Dados inválidos." na barra de ações e **nada foi persistido**. O caminho de
sucesso é coberto pelo teste de integração existente
(`src/__tests__/integration/pgr/risk-methodology.test.ts`), para não gravar
metodologia artificial na organização real.

Capturas em `capturas/` (antes e depois em 1440 e 375, mais o estado de erro).
