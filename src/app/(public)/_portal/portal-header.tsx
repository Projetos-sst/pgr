"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PORTAL_NAV, PORTAL_ROUTES } from "./routes";

/**
 * Header do portal público — porte fiel do header da prancha aprovada.
 *
 * Os estilos inline e as classes (`nav-link`, `btn btn-ghost btn-sm`, `m-panel`)
 * vêm do HTML aprovado e não devem ser "melhorados": são a referência visual.
 *
 * É Client Component porque o design tem estado de menu (`menuOpen`) e marca o
 * item ativo. O comportamento segue o do protótipo, com os acréscimos que uma
 * aplicação real exige e o protótipo não tinha: fechar com `Escape`, devolver o
 * foco ao botão e travar a rolagem do corpo enquanto o painel cobre a tela.
 */
export function PortalHeader() {
  const pathname = usePathname();

  // Guarda em qual rota o painel foi aberto: trocar de rota fecha por derivação,
  // sem efeito que chame setState (regra react-hooks/set-state-in-effect).
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbertoEm(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  const ativo = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      style={{
        position: "sticky",
        top: "0px",
        zIndex: 30,
        background: "rgba(242, 241, 238, 0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgb(228, 226, 221)",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0px auto",
          padding: "0px 24px",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <Link
          href={PORTAL_ROUTES.home}
          aria-label="PGR-e, página inicial"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "rgb(22, 23, 29)",
          }}
        >
          <span
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "rgb(91, 99, 245)",
              color: "rgb(255, 255, 255)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "15px",
              boxShadow: "rgba(91, 99, 245, 0.7) 0px 6px 14px -6px",
            }}
          >
            P
          </span>
          <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>
            PGR-e
          </span>
        </Link>

        <nav
          aria-label="Principal"
          className="nav-desktop"
          style={{ alignItems: "center", gap: "2px" }}
        >
          {PORTAL_NAV.map((item) => (
            <Link
              key={item.key}
              className={ativo(item.href) ? "nav-link is-active" : "nav-link"}
              href={item.href}
              aria-current={ativo(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-desktop" style={{ alignItems: "center", gap: "8px" }}>
          <Link className="btn btn-ghost btn-sm" href={PORTAL_ROUTES.login}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Entrar
          </Link>
          <Link className="btn btn-primary btn-sm" href={PORTAL_ROUTES.orcamento}>
            Solicitar orçamento
          </Link>
        </div>

        <button
          ref={toggleRef}
          className="nav-toggle btn btn-secondary btn-sm"
          type="button"
          aria-controls="menu-mobile"
          aria-expanded={aberto}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          onClick={() => setAbertoEm(aberto ? null : pathname)}
          style={{ width: "44px", minHeight: "44px", padding: "0px" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {aberto ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {aberto ? (
        <div
          id="menu-mobile"
          className="m-panel rise"
          style={{
            borderTop: "1px solid rgb(228, 226, 221)",
            background: "rgb(250, 250, 248)",
            padding: "8px 24px 24px",
            boxShadow: "rgba(20, 20, 40, 0.35) 0px 24px 40px -28px",
          }}
        >
          <nav
            aria-label="Menu móvel"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {PORTAL_NAV.map((item) => (
              <Link
                key={item.key}
                className="m-link"
                href={item.href}
                aria-current={ativo(item.href) ? "page" : undefined}
                onClick={() => setAbertoEm(null)}
                style={ativo(item.href) ? { color: "rgb(62, 68, 201)" } : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
            <Link
              className="btn btn-primary"
              href={PORTAL_ROUTES.orcamento}
              onClick={() => setAbertoEm(null)}
            >
              Solicitar orçamento
            </Link>
            <Link
              className="btn btn-secondary"
              href={PORTAL_ROUTES.login}
              onClick={() => setAbertoEm(null)}
            >
              Entrar na plataforma
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
