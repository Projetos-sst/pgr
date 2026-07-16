import type { ReactNode } from "react";

/**
 * Moldura das telas de autenticação/onboarding (split 1fr/1fr do `login.dc.html`
 * e `primeiros-passos.dc.html`): painel indigo de marca à esquerda + slot do
 * componente do Clerk à direita. Em telas estreitas colapsa para uma coluna
 * (o painel de marca é ocultado). É só markup nosso — o form é do Clerk.
 */
const HIGHLIGHTS = [
  {
    title: "Gestão centralizada e rastreável",
    detail: "EPIs, assinaturas digitais e relatórios em um só lugar.",
  },
  {
    title: "Análise inteligente de riscos",
    detail: "IA que apoia a detecção proativa de riscos ocupacionais.",
  },
  {
    title: "Conformidade legal",
    detail: "Alinhado às Normas Regulamentadoras vigentes.",
  },
];

export function AuthFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[24px] border border-white/60 shadow-[0_30px_70px_-30px_rgba(50,55,100,0.5)] md:grid-cols-2">
        <aside className="bg-primary relative hidden flex-col justify-between gap-10 p-11 text-white md:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/35 bg-white/20 text-base font-extrabold">
              S
            </span>
            <span className="text-lg font-extrabold tracking-tight">SST Manager</span>
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
              {eyebrow}
            </p>
            <p className="mt-4 text-[28px] leading-tight font-extrabold tracking-tight">
              Gestão de PGR simplificada e 100% rastreável
            </p>
            <ul className="mt-6 flex flex-col gap-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/20 text-xs font-bold"
                  >
                    ✓
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="block text-xs text-white/75">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/70">Precisa de ajuda? Fale conosco.</p>
        </aside>

        <section className="glass-panel flex flex-col justify-center gap-6 p-8 sm:p-12">
          <div>
            <h1 className="text-text text-2xl font-extrabold tracking-tight">{title}</h1>
          </div>
          <div className="flex justify-center">{children}</div>
        </section>
      </div>
    </main>
  );
}
