import type { Metadata } from "next";
import Link from "next/link";

import { Section, SectionHeading, Eyebrow, SHELL } from "../_components/section";
import { AreaCard, BenefitCard, ModuleCard, StepCard } from "../_components/cards";
import { HeroDiagram } from "../_components/hero-diagram";
import { FaqAccordion } from "../_components/faq-accordion";
import { CtaBand } from "../_components/cta-band";
import { Reveal } from "../_components/reveal";
import { Icon } from "../_components/icon";
import {
  AREAS,
  BENEFITS,
  BRAND,
  HEALTH_MODULES,
  HOW_IT_WORKS,
  SAFETY_MODULES,
} from "../_content/platform";

export const metadata: Metadata = {
  title: "PGR-e — Saúde e segurança do trabalho em uma só plataforma",
  description:
    "Plataforma multiempresa de Segurança e Medicina do Trabalho: cadastros, inventário de riscos, medidas de controle, plano de ação, gestão de EPI, treinamentos, ASO e elaboração do PGR.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PGR-e — Saúde e segurança do trabalho em uma só plataforma",
    description:
      "Organize as rotinas de Segurança e de Medicina do Trabalho sobre os mesmos cadastros, do levantamento de riscos ao PGR assinado.",
    url: "/",
    type: "website",
  },
};

/** Capacidades do hero — todas com módulo correspondente na área autenticada. */
const HERO_CAPABILITIES = [
  "Inventário e avaliação de riscos",
  "Medidas de controle e plano de ação",
  "Elaboração e revisão do PGR",
  "Gestão de EPI com assinatura",
  "Treinamentos e inspeções",
  "ASO e médicos do trabalho",
];

const AREA_ICONS = {
  "seguranca-do-trabalho": "shield",
  "medicina-do-trabalho": "stethoscope",
} as const;

/** Destaques da home: o PGR primeiro, e só módulos disponíveis. */
const FEATURED = [
  ...SAFETY_MODULES.filter((m) => m.availability === "available").slice(0, 6),
  ...HEALTH_MODULES.filter((m) => m.availability === "available").slice(0, 2),
];

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 lg:pt-24 lg:pb-24">
        <div
          aria-hidden
          className="bg-primary/[0.07] pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="bg-accent-teal/[0.07] pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full blur-3xl"
        />

        <div className={`${SHELL} relative`}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div>
              <Eyebrow>Plataforma SST</Eyebrow>
              <h1 className="text-text mt-4 text-[clamp(2.1rem,5.6vw,3.5rem)] leading-[1.06] font-extrabold tracking-tight text-balance">
                {BRAND.tagline}
              </h1>
              <p className="text-text-muted mt-5 max-w-[560px] text-base leading-7 sm:text-lg sm:leading-8">
                Dois caminhos — Segurança e Medicina do Trabalho — sobre os mesmos
                cadastros. Você levanta os riscos, define as medidas de controle,
                acompanha as rotinas e gera o PGR a partir dos dados que já estão no
                sistema.
              </p>

              <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {HERO_CAPABILITIES.map((item) => (
                  <li key={item} className="text-text flex items-start gap-2.5 text-sm">
                    <span className="bg-primary/10 text-primary-strong mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/seguranca-do-trabalho"
                  className="btn-primary rounded-pill focus-visible:ring-primary px-6 py-3 text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Conhecer Segurança do Trabalho
                </Link>
                <Link
                  href="/medicina-do-trabalho"
                  className="text-accent-teal-strong border-accent-teal/40 rounded-pill hover:bg-accent-teal/10 focus-visible:ring-accent-teal border bg-white/70 px-6 py-3 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Conhecer Medicina do Trabalho
                </Link>
                <Link
                  href="/sign-in"
                  className="text-text-muted hover:text-text focus-visible:ring-primary rounded-pill px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Entrar na plataforma
                </Link>
              </div>
            </div>

            <div className="lg:pl-4">
              <HeroDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- duas vertentes */}
      <Section id="vertentes" tone="panel">
        <SectionHeading
          eyebrow="Duas vertentes, uma plataforma"
          title="Segurança e Medicina do Trabalho, sem dois sistemas"
          lead="As duas áreas trabalham sobre o mesmo cadastro de empresas, unidades, funções e funcionários. O que muda é o que cada uma acompanha."
          align="center"
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {AREAS.map((area, index) => (
            <Reveal key={area.slug} delay={index * 90} className="h-full">
              <AreaCard
                href={`/${area.slug}`}
                eyebrow={area.eyebrow}
                title={area.title}
                promise={area.promise}
                summary={area.summary}
                highlights={area.highlights}
                icon={AREA_ICONS[area.slug]}
                accent={area.accent}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- benefícios */}
      <Section>
        <SectionHeading
          eyebrow="Por que centralizar"
          title="O dado entra uma vez e serve a todo o resto"
          lead="O ganho não é ter muitas telas: é não precisar repetir o mesmo cadastro em planilhas paralelas para cada documento."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, index) => (
            <Reveal key={benefit.title} delay={(index % 3) * 80} className="h-full">
              <BenefitCard
                icon={benefit.icon}
                title={benefit.title}
                text={benefit.text}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ recursos */}
      <Section id="recursos" tone="panel">
        <SectionHeading
          eyebrow="Recursos"
          title="O que já está no ar"
          lead="Cada recurso abaixo tem tela e dados na área autenticada. O que ainda está em desenvolvimento aparece marcado nas páginas das vertentes — nunca como pronto."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((item, index) => (
            <Reveal key={item.name} delay={(index % 4) * 70} className="h-full">
              <ModuleCard item={item} />
            </Reveal>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/seguranca-do-trabalho#modulos"
            className="text-primary-strong hover:bg-primary/10 rounded-pill focus-visible:ring-primary border border-white/70 bg-white/70 px-5 py-2.5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Todos os módulos de Segurança
          </Link>
          <Link
            href="/medicina-do-trabalho#modulos"
            className="text-accent-teal-strong hover:bg-accent-teal/10 rounded-pill focus-visible:ring-accent-teal border border-white/70 bg-white/70 px-5 py-2.5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Todos os módulos de Medicina
          </Link>
        </div>
      </Section>

      {/* -------------------------------------------------------- como funciona */}
      <Section id="como-funciona">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionHeading
            eyebrow="Como funciona"
            title="Cinco passos, na ordem em que o trabalho acontece"
            lead="Não é um fluxo imaginado para a apresentação: é a sequência que as telas da plataforma seguem hoje."
          />
          <ol className="relative">
            <span
              aria-hidden
              className="from-primary/35 absolute top-2 bottom-8 left-[13px] w-px bg-gradient-to-b to-transparent"
            />
            {HOW_IT_WORKS.map((item, index) => (
              <Reveal key={item.step} delay={index * 60} as="li">
                <StepCard step={item.step} title={item.title} text={item.text} />
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ CTA */}
      <CtaBand
        title="Quer ver a plataforma com os dados da sua operação?"
        lead="Conte o tamanho da sua carteira e qual vertente interessa mais. Respondemos com um orçamento e uma apresentação do sistema."
      />

      {/* ------------------------------------------------------------------ FAQ */}
      <Section id="perguntas-frequentes" tone="panel">
        <SectionHeading
          eyebrow="Perguntas frequentes"
          title="Dúvidas que aparecem antes de começar"
          align="center"
        />
        <div className="mx-auto mt-12 max-w-[820px]">
          <FaqAccordion />
        </div>
      </Section>
    </>
  );
}
