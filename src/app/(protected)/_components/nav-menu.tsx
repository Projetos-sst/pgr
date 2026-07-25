"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SubMenuItem = {
  href: string;
  label: string;
  iconName?: string;
};

type MenuItem = {
  href?: string;
  label: string;
  iconName?: string;
  children?: SubMenuItem[];
};

type NavEntry =
  | { kind: "link"; href: string; label: string; iconName?: string }
  | { kind: "group"; label: string; iconName?: string; items: MenuItem[] };

const NAV: NavEntry[] = [
  { kind: "link", href: "/dashboard", label: "Dashboard" },
  {
    kind: "group",
    label: "Módulos",
    iconName: "folder",
    items: [
      { href: "/pgr", label: "PGR", iconName: "alert-triangle" },
      { href: "/epi-stock", label: "Estoque de EPI", iconName: "briefcase" },
      { href: "/epi-returns", label: "Devoluções de EPI", iconName: "rotate-ccw" },
      { href: "/esocial", label: "eSocial (SST)", iconName: "file-text" },
      {
        label: "Inspeções",
        iconName: "search",
        children: [
          { href: "/vehicular-inspections", label: "Veiculares", iconName: "car" },
          { href: "/safety-inspections", label: "Segurança", iconName: "shield" },
          { href: "/equipment-inspections", label: "Equipamentos", iconName: "wrench" },
        ],
      },
      { href: "/work-permits", label: "Permissões de trabalho", iconName: "check-circle" },
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
      { href: "/training-catalog", label: "Treinamentos", iconName: "book-open" },
      { href: "/form-controls", label: "Controle de Formulários", iconName: "file-check" },
      { href: "/epi-catalog", label: "Equipamentos", iconName: "hardhat" },
      { href: "/incidents", label: "Incidentes", iconName: "alert-circle" },
      { href: "/vehicles", label: "Veículos", iconName: "car" },
      { href: "/inspection-plans", label: "Planos de Inspeção", iconName: "clipboard-list" },
    ],
  },
  {
    kind: "group",
    label: "Gestão de Segurança",
    iconName: "shield",
    items: [
      { href: "/psychosocial/campaigns", label: "Gestão de Riscos Psicossociais", iconName: "heart" },
      { href: "/incidents", label: "Gestão de Incidentes", iconName: "alert-circle" },
      { href: "/action-plans", label: "Gestão de Planos de Ação", iconName: "calendar" },
      { href: "/service-orders", label: "Gestão de OS", iconName: "file-edit" },
      { href: "/risk-methodology", label: "Metodologia de Risco", iconName: "sliders" },
      { href: "/risks", label: "Riscos", iconName: "alert-triangle" },
      { href: "/risk-audits", label: "Auditorias de Risco", iconName: "clipboard-check" },
    ],
  },
  {
    kind: "group",
    label: "Qualidade",
    iconName: "quality",
    items: [
      { href: "/documents", label: "GED — Gestão Eletrônica de Documentos", iconName: "folder-archive" },
    ],
  },
];

function NavIcon({ name, className = "w-4 h-4" }: { name?: string; className?: string }) {
  if (!name) return null;
  const stroke = "currentColor";
  const strokeWidth = "1.8";
  const props = {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "folder":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="17" y1="11" x2="23" y2="11" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "quality":
      return (
        <svg {...props}>
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "rotate-ccw":
      return (
        <svg {...props}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "car":
      return (
        <svg {...props}>
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 1 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "building":
      return (
        <svg {...props}>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="6" x2="9" y2="6.01" />
          <line x1="15" y1="6" x2="15" y2="6.01" />
          <line x1="9" y1="10" x2="9" y2="10.01" />
          <line x1="15" y1="10" x2="15" y2="10.01" />
          <line x1="9" y1="14" x2="9" y2="14.01" />
          <line x1="15" y1="14" x2="15" y2="14.01" />
          <line x1="9" y1="18" x2="15" y2="18" />
        </svg>
      );
    case "map-pin":
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "briefcase-user":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <rect x="15" y="11" width="8" height="10" rx="1" />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "book-open":
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "check-square":
      return (
        <svg {...props}>
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "file-check":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      );
    case "hardhat":
      return (
        <svg {...props}>
          <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
          <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          <path d="M4 15a8 8 0 0 1 16 0" />
        </svg>
      );
    case "clipboard-list":
      return (
        <svg {...props}>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "alert-circle":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "file-edit":
      return (
        <svg {...props}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...props}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    case "clipboard-check":
      return (
        <svg {...props}>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );
    case "folder-archive":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function closeDesktop() {
    setOpenGroup(null);
    setActiveSubmenu(null);
  }

  function closeAll() {
    setOpenGroup(null);
    setActiveSubmenu(null);
    setMobileOpen(false);
  }

  // Pre-expand group containing current active route on mobile
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    NAV.forEach((entry) => {
      if (entry.kind === "group") {
        const hasActive = entry.items.some((item) =>
          item.href
            ? isActive(pathname, item.href)
            : item.children?.some((child) => isActive(pathname, child.href))
        );
        if (hasActive) {
          initialExpanded[entry.label] = true;
        }
      }
    });
    setMobileExpandedGroups((prev) => ({ ...initialExpanded, ...prev }));
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDesktop();
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeAll();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function toggleMobileGroup(label: string) {
    setMobileExpandedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  }

  return (
    <div ref={containerRef} className="flex items-center">
      {/* Desktop: itens inline na barra (apenas xl: 1280px e acima) */}
      <nav className="hidden items-center gap-1 xl:flex">
        {NAV.map((entry) => {
          if (entry.kind === "link") {
            const active = isActive(pathname, entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={closeAll}
                className={
                  active
                    ? "rounded-[11px] bg-[#5b63f5] px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(91,99,245,0.35)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_6px_20px_rgba(91,99,245,0.5)] active:scale-[0.97]"
                    : "rounded-[11px] px-3.5 py-2 text-[13px] font-semibold text-[#7a7f97] transition-all duration-200 hover:bg-white/40 hover:text-[#1b1f2e] active:scale-[0.97]"
                }
              >
                {entry.label}
              </Link>
            );
          }

          const open = openGroup === entry.label;
          const groupActive = entry.items.some((item) =>
            item.href
              ? isActive(pathname, item.href)
              : item.children?.some((child) => isActive(pathname, child.href))
          );

          return (
            <div key={entry.label} className="relative">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenGroup(open ? null : entry.label);
                  setActiveSubmenu(null);
                }}
                className={`group flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 hover:bg-white/40 active:scale-[0.97] ${
                  groupActive ? "text-[#5b63f5]" : "text-[#7a7f97] hover:text-[#1b1f2e]"
                }`}
              >
                <NavIcon name={entry.iconName} className="h-4 w-4 text-[#7a7f97] group-hover:text-[#5b63f5]" />
                {entry.label}
                <span
                  aria-hidden
                  className={`inline-block text-[11px] text-[#9095ad] transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {open ? (
                <div className="glass-menu animate-dropdown-pop absolute top-full left-0 z-50 mt-2 flex min-w-[240px] flex-col gap-0.5 p-2 shadow-2xl">
                  {entry.items.map((item) => {
                    const hasChildren = Boolean(item.children && item.children.length > 0);
                    const isSubOpen = activeSubmenu === item.label;
                    const itemActive = item.href
                      ? isActive(pathname, item.href)
                      : item.children?.some((child) => isActive(pathname, child.href));

                    if (hasChildren) {
                      return (
                        <div
                          key={item.label}
                          className="relative"
                          onMouseEnter={() => setActiveSubmenu(item.label)}
                          onMouseLeave={() => setActiveSubmenu(null)}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSubmenu(isSubOpen ? null : item.label)
                            }
                            className={`flex w-full items-center justify-between rounded-card px-3 py-2 text-sm font-medium transition-all duration-150 ${
                              itemActive || isSubOpen
                                ? "bg-primary-ring/60 font-bold text-primary-strong"
                                : "text-text-muted hover:bg-black/[0.04] hover:text-text"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <NavIcon name={item.iconName} className="h-4 w-4 text-[#5b63f5]" />
                              {item.label}
                            </span>
                            <span className="text-[12px] text-[#9095ad]">›</span>
                          </button>

                          {/* Flyout Submenu */}
                          {isSubOpen ? (
                            <div className="glass-menu animate-dropdown-pop absolute top-0 left-full z-50 ml-1 flex min-w-[200px] flex-col gap-0.5 p-2 shadow-2xl">
                              {item.children?.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={closeAll}
                                  className={`flex items-center gap-2.5 rounded-card px-3 py-2 text-sm font-medium transition-all duration-150 ${
                                    isActive(pathname, child.href)
                                      ? "bg-primary-ring font-bold text-primary-strong"
                                      : "text-text-muted hover:translate-x-0.5 hover:bg-black/[0.04] hover:text-text"
                                  }`}
                                >
                                  <NavIcon name={child.iconName} className="h-4 w-4 text-[#5b63f5]" />
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href!}
                        onClick={closeAll}
                        className={`flex items-center gap-2.5 rounded-card px-3 py-2 text-sm font-medium transition-all duration-150 ${
                          isActive(pathname, item.href!)
                            ? "bg-primary-ring font-bold text-primary-strong"
                            : "text-text-muted hover:translate-x-0.5 hover:bg-black/[0.04] hover:text-text"
                        }`}
                      >
                        <NavIcon name={item.iconName} className="h-4 w-4 text-[#5b63f5]" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Mobile e Tablet: Botão de Menu (Apenas Ícone) (< 1280px) */}
      <div className="xl:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="nav-mobile-panel"
          aria-label="Abrir Menu de Navegação"
          title="Menu de Navegação"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-white/50 bg-white/40 text-[#5b63f5] shadow-xs backdrop-blur-[20px] transition-all duration-200 hover:scale-105 hover:bg-white/60 active:scale-95"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {/* Portal para document.body (impede qualquer corte por backdrop-filter do header) */}
        {mobileOpen && mounted
          ? createPortal(
              <>
                {/* Backdrop escuro absoluto */}
                <div
                  className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs xl:hidden animate-fade-in"
                  onClick={closeAll}
                />

                {/* Off-Canvas Side Drawer Sólido no Body com Animação de Entrada */}
                <div
                  id="nav-mobile-panel"
                  className="fixed inset-y-0 left-0 z-[999] flex w-[340px] sm:w-[380px] max-w-[90vw] flex-col border-r border-slate-200 bg-white text-[#1b1f2e] shadow-2xl xl:hidden overflow-hidden animate-drawer-slide-left"
                >
                  {/* Drawer Top Header */}
                  <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-100 px-5 bg-white">
                    <Link
                      href="/welcome"
                      onClick={closeAll}
                      className="flex items-center gap-2.5 transition-transform hover:scale-105"
                    >
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[#5b63f5] text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(91,99,245,0.4)]">
                        S
                      </span>
                      <span className="text-base font-extrabold tracking-tight text-[#1b1f2e]">
                        SST Manager
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={closeAll}
                      aria-label="Fechar menu"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 active:scale-95"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Drawer Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {/* Ações Rápidas (Exibidas no celular quando ocultas da barra superior) */}
                    <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4 md:hidden">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9095ad]">
                        Acesso Rápido
                      </span>
                      <Link
                        href="/getting-started"
                        onClick={closeAll}
                        className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                          pathname === "/getting-started"
                            ? "bg-[#5b63f5]/10 font-bold text-[#5b63f5]"
                            : "text-[#52576e] hover:bg-slate-100 hover:text-[#1b1f2e]"
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-[#5b63f5]"
                        >
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                        <span>Trilha do Sucesso — SST Manager</span>
                      </Link>

                      <Link
                        href="/pending-items"
                        onClick={closeAll}
                        className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                          pathname === "/pending-items"
                            ? "bg-[#5b63f5]/10 font-bold text-[#5b63f5]"
                            : "text-[#52576e] hover:bg-slate-100 hover:text-[#1b1f2e]"
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-[#5b63f5]"
                        >
                          <path d="M9 11l3 3L22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        <span>Minhas Tarefas e Pendências</span>
                      </Link>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9095ad]">
                        Menu de Navegação
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {NAV.map((entry) => {
                        if (entry.kind === "link") {
                          const active = isActive(pathname, entry.href);
                          return (
                            <Link
                              key={entry.href}
                              href={entry.href}
                              onClick={closeAll}
                              className={`flex items-center justify-between rounded-[12px] px-3.5 py-2.5 text-sm font-semibold transition-all ${
                                active
                                  ? "bg-[#5b63f5] font-bold text-white shadow-[0_4px_14px_rgba(91,99,245,0.3)]"
                                  : "text-[#52576e] hover:bg-slate-100 hover:text-[#1b1f2e]"
                              }`}
                            >
                              <span>{entry.label}</span>
                            </Link>
                          );
                        }

                        const isExpanded = Boolean(mobileExpandedGroups[entry.label]);
                        const groupActive = entry.items.some((item) =>
                          item.href
                            ? isActive(pathname, item.href)
                            : item.children?.some((child) => isActive(pathname, child.href))
                        );

                        return (
                          <div
                            key={entry.label}
                            className="overflow-hidden rounded-[14px] border border-slate-200/70 bg-slate-50/60"
                          >
                            <button
                              type="button"
                              onClick={() => toggleMobileGroup(entry.label)}
                              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-bold transition-colors ${
                                groupActive
                                  ? "text-[#5b63f5]"
                                  : "text-[#1b1f2e] hover:text-[#5b63f5]"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <NavIcon name={entry.iconName} className="h-4 w-4 text-[#5b63f5]" />
                                {entry.label}
                              </span>
                              <span
                                className={`text-xs text-[#9095ad] transition-transform duration-200 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              >
                                ▾
                              </span>
                            </button>

                            {isExpanded ? (
                              <div className="flex flex-col gap-1 border-t border-slate-200/60 bg-white p-2">
                                {entry.items.map((item) => {
                                  if (item.children) {
                                    return (
                                      <div key={item.label} className="flex flex-col gap-1 pl-2">
                                        <span className="flex items-center gap-1.5 pt-1.5 text-xs font-bold text-[#5b63f5]">
                                          <NavIcon name={item.iconName} className="h-3.5 w-3.5" />
                                          {item.label}
                                        </span>
                                        {item.children.map((child) => {
                                          const childActive = isActive(pathname, child.href);
                                          return (
                                            <Link
                                              key={child.href}
                                              href={child.href}
                                              onClick={closeAll}
                                              className={`flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-xs font-medium transition-all ${
                                                childActive
                                                  ? "bg-[#5b63f5]/10 font-bold text-[#5b63f5]"
                                                  : "text-[#646982] hover:bg-slate-100 hover:text-[#1b1f2e]"
                                              }`}
                                            >
                                              <NavIcon name={child.iconName} className="h-3.5 w-3.5 text-[#5b63f5]" />
                                              {child.label}
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    );
                                  }

                                  const itemActive = item.href ? isActive(pathname, item.href) : false;
                                  return (
                                    <Link
                                      key={item.href}
                                      href={item.href!}
                                      onClick={closeAll}
                                      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-medium transition-all ${
                                        itemActive
                                          ? "bg-[#5b63f5]/10 font-bold text-[#5b63f5]"
                                          : "text-[#52576e] hover:bg-slate-100 hover:text-[#1b1f2e]"
                                      }`}
                                    >
                                      <NavIcon name={item.iconName} className="h-4 w-4 text-[#5b63f5]" />
                                      {item.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4">
                    <Link
                      href="/welcome"
                      onClick={closeAll}
                      className="flex items-center justify-between text-xs font-medium text-[#7a7f97] hover:text-[#5b63f5]"
                    >
                      <span>SST Manager System v0.2</span>
                      <span>Boas-vindas →</span>
                    </Link>
                  </div>
                </div>
              </>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}
