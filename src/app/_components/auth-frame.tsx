import type { ReactNode } from "react";

/**
 * Moldura das telas de autenticação/onboarding em split 1fr/1fr ocupando a tela
 * inteira (fullscreen, edge-to-edge): painel indigo de marca à esquerda + slot do
 * componente do Clerk à direita sobre superfície glass. Em telas estreitas
 * colapsa para uma coluna (o painel de marca é ocultado). É só markup nosso — o
 * form é do Clerk.
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
    <main className="grid min-h-screen w-full flex-1 md:grid-cols-2">
      <aside className="bg-primary relative hidden flex-col justify-between gap-10 overflow-hidden p-11 text-white md:flex lg:p-14">
        <span
          aria-hidden
          className="absolute -top-32 -right-24 h-[340px] w-[340px] rounded-full bg-white/10 blur-md"
        />
        <span
          aria-hidden
          className="absolute -bottom-20 -left-14 h-[220px] w-[220px] rounded-full bg-white/[0.08]"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/35 bg-white/20 text-base font-extrabold">
            S
          </span>
          <span className="text-lg font-extrabold tracking-tight">SST Manager</span>
        </div>
        <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-4 text-[28px] leading-tight font-extrabold tracking-tight lg:text-[34px]">
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
        <p className="relative text-xs text-white/70">Precisa de ajuda? Fale conosco.</p>
      </aside>

      <section className="glass-panel flex flex-col justify-center p-8 sm:p-12">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <h1 className="text-text text-2xl font-extrabold tracking-tight">{title}</h1>
          <div className="flex justify-center">{children}</div>
        </div>
      </section>
    </main>
  );
}
