import type { Metadata } from "next";
import Link from "next/link";

import { parseInterestParam } from "@/shared/domains/platform/leads";

import { SHELL, Eyebrow } from "../../_components/section";
import { QuoteForm } from "../../_components/quote-form";
import { Icon } from "../../_components/icon";

export const metadata: Metadata = {
  title: "Solicitar orçamento — PGR-e",
  description:
    "Solicite um orçamento da plataforma de Saúde e Segurança do Trabalho. Informe a área de interesse e o tamanho da sua carteira de empresas.",
  alternates: { canonical: "/orcamento" },
  // Página de formulário: útil para quem chega pelo site, irrelevante no índice.
  robots: { index: false, follow: true },
};

const ASSURANCES = [
  {
    icon: "lock",
    title: "Só o necessário",
    text: "Nome, empresa, contato e a área de interesse. Nenhum dado sensível e nenhum CPF.",
  },
  {
    icon: "check",
    title: "Sem compromisso",
    text: "A solicitação não cria conta nem contrato: é só um pedido de contato comercial.",
  },
  {
    icon: "route",
    title: "Resposta pelo contato informado",
    text: "A equipe retorna pelo e-mail ou telefone que você deixar no formulário.",
  },
] as const;

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialInterest = parseInterestParam(params.interesse);

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 lg:py-24">
      <div
        aria-hidden
        className="bg-primary/[0.07] pointer-events-none absolute -top-40 right-[-12%] h-[480px] w-[480px] rounded-full blur-3xl"
      />
      <div className={`${SHELL} relative`}>
        <nav aria-label="Trilha de navegação" className="text-text-subtle mb-7 text-xs">
          <Link
            href="/"
            className="hover:text-primary-strong focus-visible:ring-primary rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Início
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span className="text-text-muted">Solicitar orçamento</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <Eyebrow>Contato comercial</Eyebrow>
            <h1 className="text-text mt-4 text-[clamp(1.9rem,4.4vw,2.75rem)] leading-[1.1] font-extrabold tracking-tight text-balance">
              Vamos falar sobre a sua operação
            </h1>
            <p className="text-text-muted mt-5 text-base leading-7">
              Conte quantas empresas você atende e qual vertente interessa mais.
              Respondemos com um orçamento e uma apresentação da plataforma.
            </p>

            <ul className="mt-9 flex flex-col gap-5">
              {ASSURANCES.map((item) => (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="bg-primary/10 text-primary-strong flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]">
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="text-text block text-sm font-bold">
                      {item.title}
                    </span>
                    <span className="text-text-muted mt-1 block text-sm leading-6">
                      {item.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-text-subtle mt-9 text-xs leading-5">
              Já tem acesso?{" "}
              <Link
                href="/sign-in"
                className="text-primary-strong focus-visible:ring-primary rounded font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Entrar na plataforma
              </Link>
              .
            </p>
          </div>

          <QuoteForm initialInterest={initialInterest} />
        </div>
      </div>
    </section>
  );
}
