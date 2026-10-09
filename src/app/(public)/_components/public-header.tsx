"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "./brand-mark";
import { SHELL } from "./section";
import { PUBLIC_NAV } from "../_content/platform";

/**
 * Header do portal público. Reaproveita a superfície `.app-nav` do design
 * system (sticky + blur + borda clara) que o shell autenticado já usa, para o
 * visitante reconhecer a mesma plataforma depois de entrar.
 *
 * É Client Component por três motivos reais: estado do menu mobile, realce ao
 * rolar e marcação do link ativo. O conteúdo em si vem de `_content/platform`.
 */
export function PublicHeader() {
  const pathname = usePathname();

  /*
   * O painel aberto guarda *em qual rota* foi aberto, em vez de um booleano.
   * Assim a troca de rota fecha o menu por derivação, no próprio render — sem
   * um efeito que chama `setState` e dispara uma renderização em cascata
   * (regra `react-hooks/set-state-in-effect`).
   */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpenState = (value: boolean) => setOpenFor(value ? pathname : null);

  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    // A leitura inicial vai num `rAF` (e não no corpo do efeito) para cobrir a
    // volta pelo histórico, em que o navegador restaura a posição de rolagem.
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Escape fecha e devolve o foco ao botão; trava o scroll do corpo enquanto o
  // painel cobre a tela.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // `setOpenFor` direto (e não o helper): o setter do `useState` é estável,
        // então o efeito não precisa declarar dependência nenhuma.
        setOpenFor(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`app-nav transition-shadow duration-300 ${
        scrolled ? "shadow-[0_6px_24px_rgba(50,55,100,0.10)]" : ""
      }`}
    >
      <div className={`${SHELL} flex h-16 items-center gap-4`}>
        <BrandMark size="sm" />

        <nav aria-label="Navegação principal" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`rounded-pill focus-visible:ring-primary block px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    isActive(item.href)
                      ? "text-primary-strong bg-white/70"
                      : "text-text-muted hover:text-text hover:bg-white/60"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link
            href="/sign-in"
            className="text-text-muted hover:text-text rounded-pill focus-visible:ring-primary hidden px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none sm:block"
          >
            Entrar
          </Link>
          {/*
            O CTA comercial fica visível em toda largura — some-lo no celular
            tiraria a conversão da primeira dobra. Só o rótulo encolhe: abaixo de
            `sm` vira "Orçamento", que cabe ao lado do logo e do botão de menu.
          */}
          <Link
            href="/orcamento"
            className="btn-primary rounded-pill focus-visible:ring-primary px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="sm:hidden">Orçamento</span>
            <span className="hidden sm:inline">Solicitar orçamento</span>
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpenState(!open)}
            aria-expanded={open}
            aria-controls="public-mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="glass-panel focus-visible:ring-primary flex h-10 w-10 items-center justify-center rounded-[12px] focus-visible:ring-2 focus-visible:outline-none lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="text-text h-5 w-5"
              aria-hidden
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Painel mobile: montado só quando aberto (nada invisível capturando foco). */}
      {open ? (
        <div
          id="public-mobile-menu"
          ref={panelRef}
          className="animate-fade-slide-up glass-menu absolute inset-x-3 top-[calc(100%+8px)] rounded-[18px] p-3 lg:hidden"
        >
          <nav aria-label="Navegação principal (mobile)">
            <ul className="flex flex-col gap-1">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpenState(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`focus-visible:ring-primary block rounded-[12px] px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      isActive(item.href)
                        ? "text-primary-strong bg-white/80"
                        : "text-text hover:bg-white/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-black/5 pt-3">
            <Link
              href="/sign-in"
              onClick={() => setOpenState(false)}
              className="text-text focus-visible:ring-primary rounded-pill block px-4 py-3 text-center text-sm font-semibold hover:bg-white/70 focus-visible:ring-2 focus-visible:outline-none"
            >
              Entrar
            </Link>
            <Link
              href="/orcamento"
              onClick={() => setOpenState(false)}
              className="btn-primary rounded-pill focus-visible:ring-primary block px-4 py-3 text-center text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Solicitar orçamento
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
