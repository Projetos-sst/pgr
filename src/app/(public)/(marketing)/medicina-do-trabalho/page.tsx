import type { Metadata } from "next";
import Link from "next/link";

import { Section, SectionHeading, Eyebrow, SHELL } from "../../_components/section";
import { ModuleCard, StepCard } from "../../_components/cards";
import { CtaBand } from "../../_components/cta-band";
import { Reveal } from "../../_components/reveal";
import { Icon } from "../../_components/icon";
import { HEALTH_MODULES } from "../../_content/platform";

export const metadata: Metadata = {
  title: "Medicina do Trabalho — PGR-e",
  description:
    "Acompanhamento de saúde ocupacional sobre os mesmos cadastros da Segurança: ASO por funcionário, médicos responsáveis, validade de exames e avaliação de riscos psicossociais.",
  alternates: { canonical: "/medicina-do-trabalho" },
  openGraph: {
    title: "Medicina do Trabalho — PGR-e",
    description:
      "ASO, médicos do trabalho, controle de validade de exames e riscos psicossociais — integrados aos cadastros da Segurança.",
    url: "/medicina-do-trabalho",
    type: "website",
  },
};

/** Fluxo da vertente — só etapas que existem hoje na área autenticada. */
const FLOW = [
  {
    step: "01",
    title: "Use o cadastro que já existe",
    text: "O funcionário cadastrado para a Segurança é o mesmo da Medicina: empresa, unidade, função e grupo de exposição.",
  },
  {
    step: "02",
    title: "Cadastre os médicos responsáveis",
    text: "Nome, CRM, especialidade e clínica de vínculo. O médico é quem assina o exame no registro.",
  },
  {
    step: "03",
    title: "Registre o ASO",
    text: "Tipo de exame, data de realização, aptidão e o arquivo do atestado. A validade é calculada no registro.",
  },
  {
    step: "04",
    title: "Acompanhe validade e riscos psicossociais",
    text: "Exames a vencer na ficha do funcionário e campanhas de avaliação psicossocial por link anônimo.",
  },
];

export default function HealthPage() {
  const available = HEALTH_MODULES.filter((m) => m.availability !== "planned");
  const planned = HEALTH_MODULES.filter((m) => m.availability === "planned");

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pt-14 pb-14 sm:pt-20 lg:pt-24">
        <div
          aria-hidden
          className="bg-accent-teal/[0.09] pointer-events-none absolute -top-40 right-[-15%] h-[520px] w-[520px] rounded-full blur-3xl"
        />
        <div className={`${SHELL} relative`}>
          <nav aria-label="Trilha de navegação" className="text-text-subtle mb-7 text-xs">
            <Link
              href="/"
              className="hover:text-accent-teal-strong focus-visible:ring-accent-teal rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              Início
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-text-muted">Medicina do Trabalho</span>
          </nav>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <span className="bg-accent-teal/12 text-accent-teal-strong rounded-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold">
                <Icon name="stethoscope" className="h-4 w-4" />
                Vertente Medicina
              </span>
              <h1 className="text-text mt-5 text-[clamp(2rem,5vw,3.1rem)] leading-[1.08] font-extrabold tracking-tight text-balance">
                A saúde ocupacional sobre os mesmos cadastros
              </h1>
              <p className="text-text-muted mt-5 max-w-[620px] text-base leading-7 sm:text-lg sm:leading-8">
                Esta vertente está em construção, e dizemos isso abertamente. O que já
                funciona — ASO, médicos responsáveis, validade de exames e avaliação
                psicossocial — funciona de verdade e sobre o mesmo cadastro de
                funcionários da Segurança.
              </p>

              {/* Aviso de maturidade: a honestidade é parte da apresentação. */}
              <div className="rounded-card border-accent-teal/25 bg-accent-teal/[0.07] mt-7 border p-4">
                <p className="text-text flex items-start gap-2.5 text-sm leading-6">
                  <Icon
                    name="activity"
                    className="text-accent-teal-strong mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <strong className="font-bold">Em evolução.</strong> PCMSO, absenteísmo
                    e o portal de clínicas com solicitação de exames ainda não estão
                    implementados. Eles aparecem mais abaixo marcados como planejados.
                  </span>
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/orcamento?interesse=medicina"
                  className="rounded-pill focus-visible:ring-accent-teal bg-accent-teal hover:bg-accent-teal-strong px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(20,160,152,0.3)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Solicitar orçamento
                </Link>
                <Link
                  href="#modulos"
                  className="text-text-muted hover:text-text rounded-pill focus-visible:ring-accent-teal border border-white/70 bg-white/70 px-6 py-3 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver o que já existe
                </Link>
              </div>
            </div>

            <div className="glass-card p-6 sm:p-7">
              <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
                Registro do ASO
              </p>
              <dl className="mt-5 flex flex-col gap-3">
                {[
                  {
                    k: "Tipo de exame",
                    v: "Admissional, periódico, mudança de função, retorno ao trabalho, demissional",
                  },
                  { k: "Aptidão", v: "Apto, apto com restrições ou inapto" },
                  {
                    k: "Validade",
                    v: "Calculada no registro e visível na ficha do funcionário",
                  },
                  { k: "Médico", v: "Vinculado ao cadastro de médicos do trabalho" },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="rounded-card border border-white/70 bg-white/60 p-3.5"
                  >
                    <dt className="text-accent-teal-strong font-mono text-[10px] font-bold tracking-[0.1em] uppercase">
                      {row.k}
                    </dt>
                    <dd className="text-text-muted mt-1 text-xs leading-5">{row.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-text-muted mt-5 text-xs leading-5">
                O arquivo do atestado é guardado como anexo do registro. Nenhum dado
                clínico além do resultado de aptidão é solicitado pela plataforma.
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
            title="Quatro etapas que já funcionam"
            lead="O fluxo abaixo é o que a plataforma suporta hoje — sem etapas futuras misturadas."
            tone="teal"
          />
          <ol className="relative">
            <span
              aria-hidden
              className="from-accent-teal/35 absolute top-2 bottom-8 left-[13px] w-px bg-gradient-to-b to-transparent"
            />
            {FLOW.map((item, index) => (
              <Reveal key={item.step} delay={index * 60} as="li">
                <StepCard
                  step={item.step}
                  title={item.title}
                  text={item.text}
                  accent="teal"
                />
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      {/* ----------------------------------------------------------- módulos */}
      <Section id="modulos">
        <SectionHeading
          eyebrow="Módulos"
          title="O que existe e o que está planejado"
          lead="Separado de propósito: o que tem tela e dados hoje, e o que ainda é intenção de produto."
          tone="teal"
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((item, index) => (
            <Reveal key={item.name} delay={(index % 3) * 70} className="h-full">
              <ModuleCard item={item} accent="teal" />
            </Reveal>
          ))}
        </div>

        {planned.length > 0 ? (
          <div className="mt-12 border-t border-black/5 pt-10">
            <Eyebrow tone="teal">Planejado — ainda não implementado</Eyebrow>
            <p className="text-text-muted mt-3 max-w-[640px] text-sm leading-6">
              Itens levantados com os interessados e que entram no roteiro da vertente.
              Estão listados para dar visibilidade do caminho, não como recurso
              disponível.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {planned.map((item) => (
                <ModuleCard key={item.name} item={item} accent="teal" />
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* --------------------------------------------------------- integração */}
      <Section tone="panel">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow tone="teal">Integração entre as áreas</Eyebrow>
            <h2 className="text-text mt-3 text-[clamp(1.6rem,3.6vw,2.3rem)] leading-[1.12] font-extrabold tracking-tight text-balance">
              Saúde e Segurança leem o mesmo funcionário
            </h2>
            <p className="text-text-muted mt-4 text-base leading-7">
              O ganho de ter as duas vertentes juntas aparece aqui: a função que define os
              riscos a que o trabalhador está exposto é a mesma função que orienta os
              exames do acompanhamento de saúde. Não há dois cadastros para conciliar.
            </p>
            <ul className="mt-7 flex flex-col gap-3">
              {[
                "Funcionário, função e GES compartilhados entre as vertentes",
                "Riscos psicossociais integrados à avaliação ergonômica da NR-17",
                "Documentos de saúde guardados na mesma gestão de documentos",
                "Médicos do trabalho como cadastro do escritório",
              ].map((item) => (
                <li key={item} className="text-text flex items-start gap-2.5 text-sm">
                  <span className="bg-accent-teal/12 text-accent-teal-strong mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card p-6 sm:p-8">
            <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
              Avaliação psicossocial
            </p>
            <p className="text-text-muted mt-4 text-sm leading-6">
              As campanhas enviam um questionário por link público e{" "}
              <strong className="text-text font-bold">anônimo</strong>: a resposta não é
              identificável pelo escritório. Os fatores de risco avaliados são
              configurados pela própria equipe, e o resultado é consolidado de forma
              agregada.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {[
                "Questionário por link, sem conta de usuário",
                "Respostas anônimas e agregadas",
                "Fatores de risco configuráveis",
                "Integração com a avaliação ergonômica",
              ].map((item) => (
                <p
                  key={item}
                  className="rounded-card text-text flex items-center gap-2.5 border border-white/70 bg-white/60 px-3.5 py-2.5 text-xs font-semibold"
                >
                  <Icon
                    name="check"
                    className="text-accent-teal-strong h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.4}
                  />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Quer acompanhar a evolução da Medicina do Trabalho?"
        lead="Solicite um orçamento indicando a vertente Medicina. Você recebe o que já está disponível e o roteiro do que vem a seguir."
        primary={{ href: "/orcamento?interesse=medicina", label: "Solicitar orçamento" }}
        secondary={{ href: "/seguranca-do-trabalho", label: "Ver Segurança do Trabalho" }}
      />
    </>
  );
}
