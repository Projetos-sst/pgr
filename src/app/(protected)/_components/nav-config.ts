import type { AccessArea } from "@/shared/domains/platform/access-scopes";

export type SubMenuItem = {
  href: string;
  label: string;
  iconName?: string;
};

export type MenuItem = {
  href?: string;
  label: string;
  iconName?: string;
  area?: AccessArea;
  children?: SubMenuItem[];
};

export type NavEntry =
  | { kind: "link"; href: string; label: string; iconName?: string }
  | {
      kind: "group";
      label: string;
      iconName?: string;
      area?: AccessArea;
      items: MenuItem[];
    };

export const NAV: NavEntry[] = [
  { kind: "link", href: "/dashboard", label: "Dashboard" },
  {
    kind: "group",
    label: "Módulos",
    iconName: "folder",
    items: [
      { href: "/pgr", label: "PGR", iconName: "alert-triangle", area: "safety" },
      { href: "/pgr-basic-offer", label: "Oferta de PGR básico", iconName: "file-text" },
      { href: "/esocial", label: "eSocial (SST)", iconName: "file-text" },
      { href: "/reports", label: "Relatórios em PDF", iconName: "file-check" },
    ],
  },
  {
    kind: "group",
    label: "Cadastro",
    iconName: "user-plus",
    items: [
      { href: "/companies", label: "Empresas", iconName: "building" },
      { href: "/work-units", label: "Unidades de Obra", iconName: "map-pin" },
      { href: "/job-roles", label: "Funções", iconName: "briefcase-user" },
      { href: "/ges", label: "GES", iconName: "layers" },
      { href: "/employees", label: "Funcionários", iconName: "users" },
      { href: "/categories", label: "Categorias", iconName: "tag" },
      { href: "/vehicles", label: "Veículos", iconName: "car" },
      {
        href: "/form-controls",
        label: "Controle de Formulários",
        iconName: "file-check",
      },
    ],
  },
  {
    kind: "group",
    label: "Gestão de Segurança",
    iconName: "shield",
    area: "safety",
    items: [
      { href: "/risks", label: "Riscos", iconName: "alert-triangle" },
      { href: "/risk-methodology", label: "Metodologia de Risco", iconName: "sliders" },
      { href: "/risk-audits", label: "Auditorias de Risco", iconName: "clipboard-check" },
      { href: "/incidents", label: "Gestão de Incidentes", iconName: "alert-circle" },
      { href: "/action-plans", label: "Gestão de Planos de Ação", iconName: "calendar" },
      { href: "/service-orders", label: "Gestão de OS", iconName: "file-edit" },
      {
        href: "/work-permits",
        label: "Permissões de trabalho",
        iconName: "check-circle",
      },
      {
        label: "EPI",
        iconName: "hardhat",
        children: [
          { href: "/epi-catalog", label: "Catálogo de EPI", iconName: "hardhat" },
          { href: "/epi-stock", label: "Estoque de EPI", iconName: "briefcase" },
          { href: "/epi-returns", label: "Devoluções de EPI", iconName: "rotate-ccw" },
        ],
      },
      {
        label: "Treinamentos",
        iconName: "book-open",
        children: [
          {
            href: "/training-catalog",
            label: "Catálogo de treinamentos",
            iconName: "book-open",
          },
          {
            href: "/training-compliance",
            label: "Conformidade por função",
            iconName: "check-square",
          },
          { href: "/training-expiry", label: "Vencimentos", iconName: "clock" },
        ],
      },
      {
        label: "Inspeções",
        iconName: "search",
        children: [
          {
            href: "/inspection-plans",
            label: "Planos de Inspeção",
            iconName: "clipboard-list",
          },
          { href: "/vehicular-inspections", label: "Veiculares", iconName: "car" },
          { href: "/safety-inspections", label: "Segurança", iconName: "shield" },
          { href: "/equipment-inspections", label: "Equipamentos", iconName: "wrench" },
        ],
      },
      {
        label: "Riscos psicossociais",
        iconName: "heart",
        children: [
          {
            href: "/psychosocial/campaigns",
            label: "Campanhas de avaliação",
            iconName: "heart",
          },
          {
            href: "/psychosocial/risk-factors",
            label: "Fatores de risco",
            iconName: "heart",
          },
        ],
      },
    ],
  },
  {
    kind: "group",
    label: "Medicina do Trabalho",
    iconName: "activity",
    area: "health",
    items: [
      { href: "/medicine", label: "Painel", iconName: "clipboard-list" },
      {
        href: "/risk-authorizations",
        label: "Autorizações de riscos",
        iconName: "shield",
      },
      { href: "/medical-risks", label: "Riscos para PCMSO", iconName: "alert-triangle" },
      { href: "/health-exams", label: "Exames e ASO", iconName: "activity" },
      { href: "/medicos", label: "Médicos", iconName: "stethoscope" },
      {
        href: "/professional-identity",
        label: "Minha identidade profissional",
        iconName: "briefcase-user",
      },
      {
        href: "/incidents",
        label: "Incidentes, acidentes e CAT",
        iconName: "alert-circle",
      },
      {
        href: "/psychosocial/campaigns",
        label: "Avaliação psicossocial",
        iconName: "heart",
      },
    ],
  },
  {
    kind: "group",
    label: "Qualidade",
    iconName: "quality",
    items: [
      {
        href: "/documents",
        label: "GED — Gestão Eletrônica de Documentos",
        iconName: "folder-archive",
      },
      {
        href: "/retention",
        label: "Guarda e descarte de documentos",
        iconName: "shield",
      },
    ],
  },
];

export function menuItemHrefs(item: MenuItem): string[] {
  const own = item.href ? [item.href] : [];
  const nested = item.children?.map((child) => child.href) ?? [];
  return [...own, ...nested];
}

export function groupHrefs(label: string): string[] {
  return NAV.flatMap((entry) =>
    entry.kind === "group" && entry.label === label
      ? entry.items.flatMap(menuItemHrefs)
      : [],
  );
}

export function allNavHrefs(nav: NavEntry[] = NAV): string[] {
  return nav.flatMap((entry) =>
    entry.kind === "link" ? [entry.href] : entry.items.flatMap(menuItemHrefs),
  );
}

function inAreas(areas: readonly AccessArea[], area?: AccessArea): boolean {
  return area === undefined || areas.includes(area);
}

export function visibleNav(areas: readonly AccessArea[]): NavEntry[] {
  return NAV.flatMap((entry): NavEntry[] => {
    if (entry.kind === "link") return [entry];
    if (!inAreas(areas, entry.area)) return [];
    return [{ ...entry, items: entry.items.filter((item) => inAreas(areas, item.area)) }];
  });
}
