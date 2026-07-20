"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Mega-menu de navegação (contrato `contracts/navigation.md`), fiel à barra dos
 * mockups: um item direto (Dashboard) + categorias em dropdown (Cadastro/Módulos/
 * Gestão). Lista **apenas rotas implementadas** — categorias sem rota real (ex.:
 * Qualidade) ficam de fora por C-NAV-2. Inline no desktop; hambúrguer acessível
 * (`aria-expanded`) abaixo de `md` (C-NAV-4). A Home (Boas-vindas) fica no logo.
 */
type NavLink = { href: string; label: string };
type NavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; items: NavLink[] };

const NAV: NavEntry[] = [
  { kind: "link", href: "/dashboard", label: "Dashboard" },
  {
    kind: "group",
    label: "Cadastro",
    items: [
      { href: "/companies", label: "Empresas" },
      { href: "/work-units", label: "Unidades de obra" },
      { href: "/job-roles", label: "Funções" },
      { href: "/ges", label: "GES" },
      { href: "/employees", label: "Funcionários" },
      { href: "/categories", label: "Categorias" },
    ],
  },
  {
    kind: "group",
    label: "Módulos",
    items: [
      { href: "/pgr", label: "PGR" },
      { href: "/risk-methodology", label: "Metodologia de Risco" },
      { href: "/risks", label: "Riscos" },
      { href: "/epi-catalog", label: "Catálogo de EPI" },
      { href: "/epi-stock", label: "Estoque de EPI" },
      { href: "/service-orders", label: "Ordens de Serviço" },
      { href: "/incidents", label: "Incidentes/Acidentes" },
      { href: "/action-plans", label: "Planos de Ação" },
      { href: "/risk-audits", label: "Auditorias de Risco" },
    ],
  },
  {
    kind: "group",
    label: "Treinamentos",
    items: [
      { href: "/training-catalog", label: "Catálogo de treinamentos" },
      { href: "/training-expiry", label: "Vencimentos" },
      { href: "/training-compliance", label: "Conformidade" },
    ],
  },
  {
    kind: "group",
    label: "Inspeções",
    items: [
      { href: "/vehicles", label: "Veículos" },
      { href: "/inspection-plans", label: "Planos de inspeção" },
      { href: "/vehicular-inspections", label: "Inspeções veiculares" },
      { href: "/equipment-inspections", label: "Inspeções de equipamentos" },
      { href: "/safety-inspections", label: "Inspeções de segurança" },
      { href: "/work-permits", label: "Permissões de trabalho" },
      { href: "/psychosocial/campaigns", label: "Riscos psicossociais" },
    ],
  },
  {
    kind: "group",
    label: "Gestão",
    items: [
      { href: "/schedule", label: "Agenda" },
      { href: "/pending-items", label: "Pendências" },
      { href: "/reports", label: "Relatórios" },
      { href: "/epi-returns", label: "Devoluções de EPI" },
      { href: "/signatures", label: "Assinaturas" },
      { href: "/esocial", label: "eSocial (SST)" },
      { href: "/documents", label: "Documentos" },
      { href: "/form-controls", label: "Controle de formulário" },
      { href: "/team", label: "Equipe" },
      { href: "/profile", label: "Perfil" },
      { href: "/plans", label: "Planos" },
      { href: "/getting-started", label: "Primeiros passos" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function closeAll() {
    setOpenGroup(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
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

  return (
    <div ref={containerRef} className="flex items-center">
      {/* Desktop: itens inline na barra */}
      <nav className="hidden items-center gap-1 md:flex">
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
                    ? "btn-primary rounded-card px-3.5 py-2 text-[13px] font-bold"
                    : "text-text-muted hover:text-text rounded-card px-3.5 py-2 text-[13px] font-semibold transition-colors"
                }
              >
                {entry.label}
              </Link>
            );
          }
          const open = openGroup === entry.label;
          const groupActive = entry.items.some((item) => isActive(pathname, item.href));
          return (
            <div key={entry.label} className="relative">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? null : entry.label)}
                className={`rounded-card px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  groupActive ? "text-primary-strong" : "text-text-muted hover:text-text"
                }`}
              >
                {entry.label} <span aria-hidden>▾</span>
              </button>
              {open ? (
                <div className="glass-menu absolute top-full left-0 z-50 mt-2 flex min-w-[220px] flex-col gap-0.5 p-2">
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeAll}
                      className={`rounded-card px-3 py-2 text-sm font-medium transition-colors ${
                        isActive(pathname, item.href)
                          ? "bg-primary-ring text-primary-strong"
                          : "text-text-muted hover:text-text hover:bg-black/[0.04]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Mobile: hambúrguer + painel absoluto */}
      <div className="relative md:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="nav-mobile-panel"
          onClick={() => setMobileOpen((v) => !v)}
          className="glass-panel text-text-muted rounded-card flex items-center gap-2 px-3 py-1.5 text-sm font-semibold"
        >
          <span aria-hidden>☰</span> Menu
        </button>
        {mobileOpen ? (
          <div
            id="nav-mobile-panel"
            className="glass-menu absolute top-full left-0 z-50 mt-2 flex w-[240px] flex-col gap-3 p-4"
          >
            {NAV.map((entry) =>
              entry.kind === "link" ? (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={closeAll}
                  className={`rounded-card px-3 py-2 text-sm font-semibold ${
                    isActive(pathname, entry.href)
                      ? "bg-primary-ring text-primary-strong"
                      : "text-text-muted"
                  }`}
                >
                  {entry.label}
                </Link>
              ) : (
                <div key={entry.label} className="flex flex-col gap-1">
                  <span className="text-text-subtle font-mono text-[10px] tracking-[0.12em] uppercase">
                    {entry.label}
                  </span>
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeAll}
                      className={`rounded-card px-3 py-2 text-sm font-medium ${
                        isActive(pathname, item.href)
                          ? "bg-primary-ring text-primary-strong"
                          : "text-text-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
