import type { ReactNode } from "react";

/**
 * Moldura das telas de autenticação/onboarding (split 1fr/1fr do `login.dc.html`
 * e `primeiros-passos.dc.html`): painel de marca em gradiente à esquerda + slot
 * do componente do Clerk à direita. Em telas estreitas colapsa para uma coluna
 * (o painel de marca é ocultado). É só markup nosso — o form é do Clerk.
 */
const BRAND_GRADIENT = "bg-[linear-gradient(150deg,#4f46e5_0%,#5b63f5_48%,#7c7bf7_100%)]";

const HIGHLIGHTS = [
  {
    title: "Gestão centralizada e rastreável",
    detail: "EPIs, assinaturas digitais e relatórios em um só lugar.",
    icon: "M20 6L9 17l-5-5",
  },
  {
    title: "Análise inteligente de riscos",
    detail: "IA com 92% de precisão na detecção proativa.",
    icon: "M3 12h4l3 7 4-14 3 7h4",
  },
  {
    title: "Conformidade legal garantida",
    detail: "Alinhado às Normas Regulamentadoras vigentes.",
    icon: "M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z",
  },
];

export function AuthFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen w-full flex-1 md:grid-cols-2">
      <aside
        className={`relative hidden flex-col justify-between overflow-hidden p-11 text-white md:flex lg:p-16 ${BRAND_GRADIENT}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[120px] -right-[90px] h-[340px] w-[340px] rounded-full bg-white/10 blur-[6px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-[70px] -left-[50px] h-[220px] w-[220px] rounded-full bg-white/[0.08]"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border border-white/35 bg-white/20 text-base font-extrabold backdrop-blur">
            P
          </span>
          <span className="text-lg font-extrabold tracking-tight">PGR-e</span>
        </div>

        <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-4 text-[34px] leading-[1.12] font-extrabold tracking-tight">
            Gestão de PGR simplificada e 100% rastreável
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border border-white/30 bg-white/[0.18]"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.9"
                  >
                    <path d={item.icon} />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-white/70">
                    {item.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Precisa de ajuda? Fale Conosco
        </p>
      </aside>

      <section className="flex flex-col justify-center gap-6 bg-white/55 p-8 backdrop-blur-[34px] sm:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-[400px]">
          {title ? (
            <h1 className="text-text mb-6 text-2xl font-extrabold tracking-tight">
              {title}
            </h1>
          ) : null}
          <div className="flex justify-center">{children}</div>
        </div>
      </section>
    </main>
  );
}
