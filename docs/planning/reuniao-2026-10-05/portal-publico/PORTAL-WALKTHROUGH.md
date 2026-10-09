# Portal público — walkthrough

O que foi entregue, como navegar e por que cada decisão foi tomada.

---

## 1. Como abrir

```bash
npm run dev -- -p 3001     # a porta 3000 é do Site-PMPA, em container
# ou, como foi validado:
npm run build && npx next start -p 3001
```

| Rota                     | O que é                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | landing da plataforma inteira                                 |
| `/seguranca-do-trabalho` | vertente Segurança, com o PGR no centro                       |
| `/medicina-do-trabalho`  | vertente Medicina, com o que existe e o que é planejado       |
| `/orcamento`             | pedido de orçamento (aceita `?interesse=seguranca\|medicina`) |
| `/sign-in`, `/sign-up`   | Clerk, com a moldura `AuthFrame` ajustada                     |

---

## 2. A landing, seção por seção

| Seção              | O que mostra                                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Header**         | marca, 4 itens, "Entrar" e "Solicitar orçamento". Sticky, com sombra ao rolar           |
| **Hero**           | promessa, parágrafo, 6 capacidades e 3 CTAs; à direita, a composição do produto         |
| **Duas vertentes** | dois cartões — indigo e teal — com resumo, 4 destaques e link para a página da vertente |
| **Benefícios**     | 6 razões para centralizar, sem número inventado                                         |
| **Recursos**       | 8 módulos disponíveis, cada um com selo, e dois links para as listas completas          |
| **Como funciona**  | 5 passos na ordem real das telas                                                        |
| **CTA**            | faixa comercial em gradiente de marca                                                   |
| **FAQ**            | 6 perguntas em accordion nativo                                                         |
| **Rodapé**         | marca, descrição e duas colunas de links reais                                          |

### 2.1 O hero não tem dashboard falso

Em vez de inventar gráficos, a peça da direita mostra **a cadeia real do produto** — Estrutura →
Risco → Controle → PGR — e as **cinco classes de risco** que a metodologia usa de verdade
(`risk_classification`, em `schema/risk-methodology.ts`), com a observação de que a classe
intolerável leva à interrupção da atividade.

É informação verificável no código, e explica o produto melhor do que um print genérico.

---

## 3. As duas vertentes

Mesma estrutura dos dois lados, para nenhuma parecer de segunda linha:

```
breadcrumb → selo da vertente → h1 → parágrafo → CTAs → painel lateral
fluxo numerado → módulos com selo → seção de aprofundamento → faixa de CTA
```

|                | Segurança                        | Medicina                                     |
| -------------- | -------------------------------- | -------------------------------------------- |
| Acento         | indigo `#5b63f5`                 | teal `#14a098`                               |
| Painel do hero | hierarquia de controle, 4 níveis | o que o registro do ASO guarda               |
| Fluxo          | 5 passos                         | 4 passos                                     |
| Módulos        | 12 (todos com rota)              | 5 disponíveis/em evolução + **3 planejados** |
| Aprofundamento | o PGR + 6 normas de referência   | integração entre as áreas + psicossocial     |

### 3.1 Como a Medicina fica honesta sem ficar pobre

A página **diz na primeira dobra** que a vertente está em construção, num aviso destacado que
nomeia o que falta: PCMSO, absenteísmo e portal de clínicas. Mais abaixo, esses três aparecem num
bloco separado sob o título "Planejado — ainda não implementado", visualmente apagados e com selo.

O resto da página é sobre o que funciona: ASO com tipo/aptidão/validade/médico, cadastro de
médicos, e a avaliação psicossocial anônima.

---

## 4. Orçamento

O formulário coleta **nome, empresa, e-mail, telefone, área de interesse** e uma mensagem
opcional. Sem CPF, sem data de nascimento, sem nada de saúde.

Os botões "Solicitar orçamento" das vertentes chegam com `?interesse=seguranca` ou
`?interesse=medicina`, e a área já vem marcada.

```
valida no cliente → Server Action → revalida no servidor → janela por IP → grava
```

Três detalhes que vale conhecer:

1. **O IP nunca é guardado.** Ele só vira chave hasheada de um mapa em memória, para a janela de
   3 envios por 10 minutos.
2. **O banco é a barreira que não depende de instância.** `UNIQUE (lower(email), submitted_on)`
   impede dois pedidos do mesmo e-mail no mesmo dia.
3. **Duplicata não vira erro para o visitante.** Devolve sucesso, porque o pedido dele do dia já
   está registrado — e dizer "já existe" vazaria que aquele e-mail se cadastrou.

### 4.1 O que ainda falta decidir

O pedido **fica gravado e não notifica ninguém**: o projeto não tem capacidade de envio de e-mail
e não há endereço comercial definido. É a pendência nº 1 do `PORTAL-AUDIT.md`. Nada foi simulado:
não existe "envio" fingido, e a mensagem de confirmação diz exatamente o que aconteceu — que o
pedido ficou registrado na base de interessados.

---

## 5. Login

| O que mudou                                                  | O que **não** mudou                   |
| ------------------------------------------------------------ | ------------------------------------- |
| Split de colunas passou de `md:` para `lg:` (overflow 768px) | o Clerk continua sendo o autenticador |
| `px-4` no mobile e `min-w-0` na coluna (overflow 375px)      | nenhuma regra de autenticação         |
| Marca aparece no topo quando o painel não é renderizado      | nenhuma permissão                     |
| "sst-manager" → "PGR-e" na localização do Clerk              | nenhum fluxo de tenant/organização    |
| Pitch sem a afirmação de "92% de precisão"                   | o `clerkAppearance` segue o mesmo     |
| Rodapé do painel virou link para `/orcamento`                |                                       |

### 5.1 Por que a marca estava errada, e como foi corrigida

`sst-manager` é o **nome da aplicação no painel do Clerk**, que ele injeta em 18 strings do pt-BR
pelo placeholder `{{applicationName}}`. Não estava em lugar nenhum do repositório — por isso a
auditoria anterior não localizou a origem.

A correção definitiva é renomear a aplicação no painel (configuração externa, registrada como
pendência). Enquanto isso, `src/app/_components/clerk-localization.ts` substitui o placeholder
pelo nome da marca **na camada oficial de localização do Clerk** — não há manipulação de DOM nem
CSS escondendo texto. Quando o painel for renomeado, o módulo pode sumir sem efeito visível.

---

## 6. Interações

| Interação              | Como foi feita                                                        |
| ---------------------- | --------------------------------------------------------------------- |
| Header ao rolar        | sombra aparece depois de 8px; leitura inicial num `rAF`               |
| Menu mobile            | painel montado só quando aberto, `Escape` fecha e devolve o foco      |
| Hover dos cartões      | `.hover-lift` que já existia no design system                         |
| Seta do cartão de área | desliza 4px no hover, com `motion-reduce` desligando                  |
| FAQ                    | `<details>`/`<summary>` nativos, exclusivos por `name="faq"`          |
| Entrada das seções     | `IntersectionObserver`, escalonado em 60–90ms                         |
| Âncoras                | `scroll-margin-top: 80px` para o header fixo não cobrir o título      |
| Formulário             | erros por campo, "Enviando…" no botão, confirmação em `role="status"` |

**Nenhuma biblioteca de animação foi instalada.** Tudo é CSS/Tailwind sobre os keyframes que o
`globals.css` já tinha.

### 6.1 O cuidado com o `Reveal`

A entrada de seção é o tipo de efeito que esconde conteúdo quando algo dá errado. O componente
foi escrito para não conseguir fazer isso:

- renderiza **visível** no servidor e só esconde depois de montar;
- só esconde o que está abaixo da dobra;
- com `prefers-reduced-motion`, nem instala o observer;
- tem um temporizador de 2,5s que revela o conteúdo de qualquer jeito.

Sem JavaScript, a página inteira continua legível.

---

## 7. Defeitos encontrados durante a revisão visual

Três não vieram de relatório: vieram de olhar a tela e medir.

1. **Cartões de grade com alturas desiguais** — as linhas de "Recursos" não alinhavam porque o
   card não acompanhava a altura do item do grid. Corrigido com `h-full` no card e no wrapper.
2. **`Reveal` quebrando a semântica das listas** — ao receber `h-full`, o wrapper virou um `<div>`
   entre `<ol>` e `<li>` (HTML inválido) e, pior, cada passo passou a ocupar 430px em vez de 86px.
   O componente virou polimórfico: dentro de lista ele **é** o `<li>`, e o `h-full` virou opcional.
3. **Link "pular para o conteúdo" com 20px de altura ao focar** — o `not-sr-only` do Tailwind zera
   `padding`. O padding foi para dentro do variante `focus:`; o alvo passou a 160 × 44px.

---

## 8. O que não foi tocado

PDF e template (Douglas) · CNAE/CBO · GED · módulos clínicos internos · visual do dashboard
autenticado · regras de autenticação, tenant e RLS das tabelas de tenant · as três rotas públicas
por token.
