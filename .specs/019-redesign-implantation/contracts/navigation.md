# Contrato — Navegação (mega-menu por categoria)

Substitui a nav plana de 14 links em `src/app/(protected)/layout.tsx` por um mega-menu agrupado. O menu
lista **apenas rotas implementadas** — nenhum item para módulo inexistente (backlog não aparece).

## Agrupamento proposto (categorias × rotas reais)

| Categoria    | Itens (rota → rótulo)                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Início**   | `/boas-vindas` → Boas-vindas · `/dashboard` → Painel                                                                                                          |
| **Cadastro** | `/companies` → Empresas · `/work-units` → Unidades de obra · `/job-roles` → Funções · `/ges` → GES · `/employees` → Funcionários · `/categories` → Categorias |
| **Módulos**  | `/pgr` → PGR · `/risk-methodology` → Metodologia de Risco · `/risks` → Riscos · `/epi-catalog` → Catálogo de EPI · `/epi-stock` → Estoque de EPI              |
| **Gestão**   | `/epi-returns` → Devoluções de EPI · `/signatures` → Assinaturas                                                                                              |

> As 4 categorias-espelho do mockup são **Módulos / Cadastro / Gestão / Qualidade** (+ Início). A
> categoria **Qualidade** fica **oculta** enquanto não houver rota implementada nela (GED, controle de
> formulários etc. estão no backlog) — por C-NAV-2, não se exibe categoria/itens sem destino real. O
> agrupamento acima é o ponto de partida; ajustes finos de qual rota cai em qual categoria são livres no
> implement, desde que as regras de conformidade sejam respeitadas.

## Regras de conformidade

- **C-NAV-1**: todo item do menu aponta para uma rota que existe em `src/app/(protected)/**` e responde
  (nenhum 404/placeholder). Verificação: cruzar os `href` do menu com os diretórios de rota.
- **C-NAV-2**: nenhuma tela do backlog (`docs/briefings/redesign-backlog-telas.md`) aparece no menu.
- **C-NAV-3**: itens agrupados por categoria (não lista plana única), visualmente fiéis ao mockup.
- **C-NAV-4**: em 375px o menu colapsa de forma acessível (ex.: botão/disclosure com `aria-expanded`),
  sem esconder item implementado nem gerar rolagem horizontal do corpo.
- **C-NAV-5**: `/boas-vindas` e `/dashboard` coexistem como destinos distintos (ver contrato de telas).
