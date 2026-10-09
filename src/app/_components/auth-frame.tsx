import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/app/(public)/_components/brand-mark";
import { Icon } from "@/app/(public)/_components/icon";
import { AUTH_HIGHLIGHTS } from "@/app/(public)/_content/platform";

/**
 * Moldura das telas de autenticação/onboarding: painel de marca em gradiente à
 * esquerda + slot do componente do Clerk à direita. É só markup nosso — o form
 * é do Clerk.
 *
 * Duas correções de responsividade feitas aqui (medidas no navegador, não
 * supostas):
 *
 * - **O split passou de `md:` para `lg:`.** Em 768px exatos cada coluna ficava
 *   com 384px e, descontado o `p-8`, sobravam 320px para um cartão do Clerk que
 *   pede 400px — o que produzia barra horizontal. A partir de 1024px há espaço
 *   para as duas colunas de verdade.
 * - **O respiro lateral encolhe no mobile** (`px-4` em vez de `p-8`) e a coluna
 *   do formulário ganhou `min-w-0`, para poder ceder largura em vez de empurrar
 *   o layout.
 *
 * O selo da marca e os ícones vêm dos mesmos componentes do portal público, para
 * login e landing não divergirem com o tempo.
 */
const BRAND_GRADIENT = "bg-[linear-gradient(150deg,#4f46e5_0%,#5b63f5_48%,#7c7bf7_100%)]";

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
    <main className="grid min-h-screen w-full flex-1 lg:grid-cols-2">
      <aside
        className={`relative hidden flex-col justify-between overflow-hidden p-11 text-white lg:flex lg:p-14 xl:p-16 ${BRAND_GRADIENT}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[120px] -right-[90px] h-[340px] w-[340px] rounded-full bg-white/10 blur-[6px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-[70px] -left-[50px] h-[220px] w-[220px] rounded-full bg-white/[0.08]"
        />

        <div className="relative">
          <BrandMark tone="light" />
        </div>

        <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-4 text-[clamp(1.75rem,2.6vw,2.125rem)] leading-[1.12] font-extrabold tracking-tight">
            Saúde e segurança do trabalho em uma só plataforma
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {AUTH_HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border border-white/30 bg-white/[0.18]"
                >
                  <Icon name={item.icon} className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-white/70">
                    {item.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/orcamento"
          className="relative flex w-fit items-center gap-2 rounded-full text-xs text-white/70 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Ainda não tem acesso? Solicitar orçamento
        </Link>
      </aside>

      <section className="flex min-w-0 flex-col justify-center gap-6 bg-white/55 px-4 py-10 backdrop-blur-[34px] sm:px-8 sm:py-12 lg:px-10 xl:px-16">
        {/* A marca aparece só no mobile: na coluna larga ela já está no painel
            de gradiente, que não é renderizado abaixo de `lg`. */}
        <div className="mx-auto w-full max-w-[400px] lg:hidden">
          <BrandMark size="sm" />
        </div>

        <div className="mx-auto w-full max-w-[400px] min-w-0">
          {title ? (
            <h1 className="text-text mb-6 text-2xl font-extrabold tracking-tight">
              {title}
            </h1>
          ) : null}
          <div className="flex min-w-0 justify-center">{children}</div>
        </div>
      </section>
    </main>
  );
}
