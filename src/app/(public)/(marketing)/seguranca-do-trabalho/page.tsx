import type { Metadata } from "next";
import Link from "next/link";

import { Section, SectionHeading, Eyebrow, SHELL } from "../../_components/section";
import { ModuleCard, StepCard } from "../../_components/cards";
import { CtaBand } from "../../_components/cta-band";
import { Reveal } from "../../_components/reveal";
import { Icon } from "../../_components/icon";
import { SAFETY_MODULES } from "../../_content/platform";

export const metadata: Metadata = {
  title: "Segurança do Trabalho — PGR-e",
  description:
    "Inventário e avaliação de riscos, hierarquia de medidas de controle, plano de ação, gestão de EPI, inspeções, treinamentos e a elaboração do PGR em uma única plataforma.",
  alternates: { canonical: "/seguranca-do-trabalho" },
  openGraph: {
    title: "Segurança do Trabalho — PGR-e",
    description:
      "Do cadastro da empresa ao PGR assinado: riscos, medidas de controle, plano de ação, EPI, inspeções e treinamentos.",
    url: "/seguranca-do-trabalho",
    type: "website",
  },
};

/** Fluxo da vertente — espelha a sequência real das telas autenticadas. */
const FLOW = [
  {
    step: "01",
    title: "Organize as informações",
    text: "Empresa, unidades de obra, funções, grupos de exposição similar (GES) e funcionários. É a base de tudo o que vem depois.",
  },
  {
    step: "02",
    title: "Identifique e avalie os riscos",
    text: "Risco por GES, com agente, fonte geradora, propagação, tempo de exposição e possíveis lesões — avaliado pela metodologia de classificação do seu escritório.",
  },
  {
    step: "03",
    title: "Defina medidas e ações",
    text: "Medidas na hierarquia de controle, da eliminação ao EPI, e ações com responsável, prazo e custo no formato 5W2H.",
  },
  {
    step: "04",
    title: "Centralize o acompanhamento",
    text: "Entrega e devolução de EPI, treinamentos obrigatórios por função, inspeções, ordens de serviço e incidentes.",
  },
  {
    step: "05",
    title: "Gere e consulte o documento",
    text: "O PGR é montado a partir dos dados cadastrados, com controle de revisões e assinatura.",
  },
];

/** A hierarquia como o banco a define (enum `control_level`). */
const CONTROL_LEVELS = [
  {
    label: "Eliminação",
    text: "Remover o perigo ou substituir o processo.",
  },
  {
    label: "Proteção coletiva",
    text: "Medidas que protegem o grupo, não o indivíduo.",
  },
  {
    label: "Administrativo",
    text: "Organização do trabalho, sinalização e procedimentos.",
  },
  {
    label: "EPI",
    text: "Equipamento individual, como última camada.",
  },
];

export default function SafetyPage() {
  const available = SAFETY_MODULES.filter((m) => m.availability !== "planned");
  const planned = SAFETY_MODULES.filter((m) => m.availability === "planned");

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pt-14 pb-14 sm:pt-20 lg:pt-24">
        <div
          aria-hidden
          className="bg-primary/[0.08] pointer-events-none absolute -top-40 right-[-15%] h-[520px] w-[520px] rounded-full blur-3xl"
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
            <span className="text-text-muted">Segurança do Trabalho</span>
          </nav>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <span className="bg-primary/10 text-primary-strong rounded-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold">
                <Icon name="shield" className="h-4 w-4" />
                Vertente Segurança
              </span>
              <h1 className="text-text mt-5 text-[clamp(2rem,5vw,3.1rem)] leading-[1.08] font-extrabold tracking-tight text-balance">
                Do levantamento do risco ao PGR assinado
              </h1>
              <p className="text-text-muted mt-5 max-w-[620px] text-base leading-7 sm:text-lg sm:leading-8">
                O PGR é o centro desta vertente — e ele não é um editor de texto avulso: é
                o documento que nasce dos cadastros, dos riscos avaliados e das medidas de
                controle que você já registrou na plataforma.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/orcamento?interesse=seguranca"
                  className="btn-primary rounded-pill focus-visible:ring-primary px-6 py-3 text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Solicitar orçamento
                </Link>
                <Link
                  href="#modulos"
                  className="text-text-muted hover:text-text rounded-pill focus-visible:ring-primary border border-white/70 bg-white/70 px-6 py-3 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver os módulos
                </Link>
              </div>
            </div>

            {/* Hierarquia de controle: o conceito que organiza a vertente. */}
            <div className="glass-card p-6 sm:p-7">
              <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
                Hierarquia de controle
              </p>
              <ol className="mt-5 flex flex-col gap-3">
                {CONTROL_LEVELS.map((level, index) => (
                  <li
                    key={level.label}
                    className="rounded-card flex items-start gap-3 border border-white/70 bg-white/60 p-3.5"
                  >
                    <span
                      aria-hidden
                      className="bg-primary/10 text-primary-strong flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] font-mono text-[11px] font-bold"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-text block text-sm font-bold">
                        {level.label}
                      </span>
                      <span className="text-text-muted mt-0.5 block text-xs leading-5">
                        {level.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-text-muted mt-5 text-xs leading-5">
                O sistema registra a medida no nível correspondente e guarda o 5W2H de
                cada uma: o que, por quê, quem, quando, onde, como e quanto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- fluxo */}
      <Section tone="panel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            eyebrow="O caminho"
            title="Cinco etapas, na ordem das telas"
            lead="Cada etapa abaixo corresponde a uma área existente da plataforma — e a próxima só depende do que a anterior registrou."
          />
          <ol className="relative">
            <span
              aria-hidden
              className="from-primary/35 absolute top-2 bottom-8 left-[13px] w-px bg-gradient-to-b to-transparent"
            />
            {FLOW.map((item, index) => (
              <Reveal key={item.step} delay={index * 60} as="li">
                <StepCard step={item.step} title={item.title} text={item.text} />
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      {/* ----------------------------------------------------------- módulos */}
      <Section id="modulos">
        <SectionHeading
          eyebrow="Módulos"
          title="O que a vertente Segurança entrega hoje"
          lead="Todos os itens abaixo têm tela e dados na área autenticada. O selo indica a maturidade de cada um."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((item, index) => (
            <Reveal key={item.name} delay={(index % 3) * 70} className="h-full">
              <ModuleCard item={item} />
            </Reveal>
          ))}
        </div>

        {planned.length > 0 ? (
          <div className="mt-10">
            <Eyebrow>Planejado</Eyebrow>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {planned.map((item) => (
                <ModuleCard key={item.name} item={item} />
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* --------------------------------------------------------------- PGR */}
      <Section tone="panel">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Documento central</Eyebrow>
            <h2 className="text-text mt-3 text-[clamp(1.6rem,3.6vw,2.3rem)] leading-[1.12] font-extrabold tracking-tight text-balance">
              O PGR montado a partir do que já está cadastrado
            </h2>
            <p className="text-text-muted mt-4 text-base leading-7">
              Em vez de redigitar o inventário num documento à parte, o programa consolida
              empresa, unidades, GES, riscos avaliados e medidas de controle do próprio
              sistema. As revisões ficam versionadas e o documento passa por assinatura
              antes de ser distribuído.
            </p>
            <ul className="mt-7 flex flex-col gap-3">
              {[
                "Consolidação por unidade e por grupo de exposição",
                "Controle de revisões do programa",
                "Assinatura por link com token",
                "Inventário de riscos e plano de ação no mesmo documento",
              ].map((item) => (
                <li key={item} className="text-text flex items-start gap-2.5 text-sm">
                  <span className="bg-primary/10 text-primary-strong mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card p-6 sm:p-8">
            <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
              Normas de referência no sistema
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { code: "NR-1", text: "Gerenciamento de riscos e ordem de serviço" },
                { code: "NR-6", text: "EPI, com consulta de CA" },
                { code: "NR-9", text: "Avaliação de agentes e cronograma" },
                { code: "NR-17", text: "Avaliação ergonômica" },
                { code: "NR-18", text: "Construção civil" },
                { code: "eSocial", text: "Eventos de SST" },
              ].map((item) => (
                <div
                  key={item.code}
                  className="rounded-card border border-white/70 bg-white/60 p-3.5"
                >
                  <p className="text-primary-strong font-mono text-xs font-bold">
                    {item.code}
                  </p>
                  <p className="text-text-muted mt-1 text-xs leading-5">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="text-text-muted mt-5 text-xs leading-5">
              A plataforma organiza os dados exigidos por essas normas. A responsabilidade
              técnica pelo conteúdo do programa permanece com o profissional de SST.
            </p>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Quer ver o PGR sendo gerado com os seus dados?"
        lead="Solicite um orçamento indicando a vertente Segurança e o tamanho da sua carteira de empresas."
        primary={{ href: "/orcamento?interesse=seguranca", label: "Solicitar orçamento" }}
        secondary={{ href: "/medicina-do-trabalho", label: "Ver Medicina do Trabalho" }}
      />
    </>
  );
}
