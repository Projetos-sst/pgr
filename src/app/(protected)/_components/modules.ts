/**
 * Lista dos módulos operacionais do PGR, compartilhada entre o dashboard e a
 * página de boas-vindas (reuso — não duplicar). São rotas reais implementadas.
 */
export type PgrModule = {
  href: string;
  title: string;
  description: string;
};

export const PGR_MODULES: PgrModule[] = [
  {
    href: "/companies",
    title: "Empresas",
    description: "Empresas-cliente do escritório — raiz da cadeia do PGR.",
  },
  {
    href: "/work-units",
    title: "Unidades de obra",
    description: "Frentes e canteiros vinculados a cada empresa.",
  },
  {
    href: "/job-roles",
    title: "Funções",
    description: "Cargos/funções (CBO) usados nos GES e funcionários.",
  },
  {
    href: "/ges",
    title: "GES",
    description: "Grupos de exposição similar e funções associadas.",
  },
  {
    href: "/employees",
    title: "Funcionários",
    description: "Trabalhadores das empresas-cliente.",
  },
  {
    href: "/categories",
    title: "Categorias",
    description: "Catálogo de EPIs e máquinas do escritório.",
  },
  {
    href: "/epi-catalog",
    title: "Catálogo de EPI",
    description: "Itens de EPI e de máquinas/equipamentos, com CA e validade.",
  },
];
