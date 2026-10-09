import Link from "next/link";

import { SHELL } from "./section";

/**
 * Faixa comercial de fechamento, reutilizada pela landing e pelas duas páginas
 * de vertente. Usa o mesmo gradiente de marca do painel do `AuthFrame`, para a
 * peça comercial e a tela de login falarem a mesma língua visual.
 */
const BRAND_GRADIENT = "bg-[linear-gradient(135deg,#4f46e5_0%,#5b63f5_52%,#7c7bf7_100%)]";

export function CtaBand({
  title,
  lead,
  primary = { href: "/orcamento", label: "Solicitar orçamento" },
  secondary = { href: "/sign-in", label: "Entrar na plataforma" },
}: {
  title: string;
  lead: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className={SHELL}>
        <div
          className={`relative overflow-hidden rounded-[22px] px-7 py-12 text-white sm:px-12 sm:py-16 ${BRAND_GRADIENT}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 h-[300px] w-[300px] rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-12 h-[200px] w-[200px] rounded-full bg-white/[0.07]"
          />

          <div className="relative max-w-[640px]">
            <h2 className="text-[clamp(1.5rem,3.4vw,2.25rem)] leading-[1.14] font-extrabold tracking-tight text-balance">
              {title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/85 sm:text-base">
              {lead}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={primary.href}
                className="rounded-pill text-primary-strong px-6 py-3 text-sm font-bold shadow-[0_10px_28px_rgba(20,20,60,0.22)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ background: "#ffffff" }}
              >
                {primary.label}
              </Link>
              {secondary ? (
                <Link
                  href={secondary.href}
                  className="rounded-pill border border-white/45 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
