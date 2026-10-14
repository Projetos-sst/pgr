"use client";

import { useRef, useState } from "react";

/**
 * Fluxo interativo do PGR — porte fiel da seção `#fluxo` da prancha Segurança.
 *
 * O protótipo usa `role="tablist"` vertical com painel único e botões de
 * anterior/próxima. Aqui o padrão é mantido e completado com o que a ARIA
 * Authoring Practices exige e o export não trazia: navegação por setas,
 * `Home`/`End` e gerenciamento de foco (`tabIndex` roving). O visual não muda.
 *
 * Os textos das cinco etapas são os aprovados, copiados do design.
 */
type Etapa = {
  title: string;
  short: string;
  desc: string;
  items: string[];
  mods: string[];
};

const ETAPAS: Etapa[] = [
  {
    title: "Empresas e funções",
    short: "A estrutura da empresa",
    desc: "A base do programa: quem é a empresa, onde atua e como as funções se organizam.",
    items: ["Empresas e unidades", "Funções", "Grupos de Exposição Similar (GES)"],
    mods: ["Empresas e unidades", "Funções e GES"],
  },
  {
    title: "Riscos ocupacionais",
    short: "Identificação e inventário",
    desc: "Os perigos e riscos a que cada grupo está exposto, reunidos em um inventário único.",
    items: [
      "Riscos por categoria: físico, químico, biológico, ergonômico e de acidentes",
      "Associação dos riscos às funções e GES",
      "Inventário de riscos consolidado",
    ],
    mods: ["Inventário de riscos"],
  },
  {
    title: "Avaliação e controles",
    short: "Avaliar e controlar",
    desc: "Cada risco avaliado e relacionado às medidas que o controlam.",
    items: [
      "Avaliação de cada risco identificado",
      "Medidas de controle relacionadas",
      "Equipamentos de proteção individual",
    ],
    mods: ["Avaliação de riscos", "Medidas de controle", "Gestão de EPI"],
  },
  {
    title: "Plano de ação",
    short: "Transformar em ações",
    desc: "As medidas definidas viram ações acompanhadas até a conclusão.",
    items: [
      "Ações do plano com status de acompanhamento",
      "Pendências visíveis para a equipe",
      "Inspeções de verificação",
    ],
    mods: ["Planos de ação", "Inspeções"],
  },
  {
    title: "PGR",
    short: "O programa consolidado",
    desc: "As informações das etapas anteriores se consolidam no Programa de Gerenciamento de Riscos.",
    items: [
      "Programa estruturado a partir dos cadastros",
      "Documento do PGR gerado pela plataforma",
      "Base para as revisões do programa",
    ],
    mods: ["PGR", "Documento do PGR"],
  },
];

export function PgrFlow() {
  const [atual, setAtual] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const etapa = ETAPAS[atual];

  function irPara(i: number, focar = false) {
    const alvo = Math.min(ETAPAS.length - 1, Math.max(0, i));
    setAtual(alvo);
    if (focar) tabsRef.current[alvo]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const mapa: Record<string, number> = {
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: ETAPAS.length - 1,
    };
    const destino = mapa[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    irPara((destino + ETAPAS.length) % ETAPAS.length, true);
  }

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "stretch" }}
    >
      <div
        role="tablist"
        aria-label="Etapas do fluxo do PGR"
        aria-orientation="vertical"
        style={{
          flex: "1 1 320px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
        }}
      >
        {ETAPAS.map((e, i) => {
          const on = i === atual;
          return (
            <button
              key={e.title}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              className={on ? "step-tab is-on" : "step-tab"}
              type="button"
              role="tab"
              id={`fluxo-tab-${i}`}
              aria-selected={on}
              aria-controls="fluxo-painel"
              tabIndex={on ? 0 : -1}
              onClick={() => irPara(i)}
              onKeyDown={(ev) => onKeyDown(ev, i)}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  width: "38px",
                  height: "38px",
                  borderRadius: "11px",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                  fontWeight: 600,
                  fontSize: "12.5px",
                  background: on ? "#5B63F5" : i < atual ? "#E6E7FE" : "#EFEEEA",
                  color: on ? "#FFFFFF" : i < atual ? "#3E44C9" : "#4A4D5A",
                }}
              >
                <span>0{i + 1}</span>
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: "0px",
                }}
              >
                <span
                  style={{ fontWeight: 800, fontSize: "16px", color: "rgb(22, 23, 29)" }}
                >
                  {e.title}
                </span>
                <span style={{ fontSize: "13.5px", color: "rgb(86, 89, 102)" }}>
                  {e.short}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="fluxo-painel"
        role="tabpanel"
        aria-labelledby={`fluxo-tab-${atual}`}
        tabIndex={0}
        style={{
          flex: "2 1 520px",
          minWidth: "0px",
          background: "rgb(255, 255, 255)",
          border: "1px solid rgb(228, 226, 221)",
          borderRadius: "24px",
          padding: "clamp(24px, 3vw, 40px)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span className="mono" style={{ color: "rgb(62, 68, 201)" }}>
            Etapa <span>0{atual + 1}</span> de 05
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              aria-label="Etapa anterior"
              disabled={atual === 0}
              onClick={() => irPara(atual - 1)}
              style={{ width: "44px", minHeight: "44px", padding: "0px" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              aria-label="Próxima etapa"
              disabled={atual === ETAPAS.length - 1}
              onClick={() => irPara(atual + 1)}
              style={{ width: "44px", minHeight: "44px", padding: "0px" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3
            style={{
              fontSize: "clamp(24px, 2.4vw, 32px)",
              letterSpacing: "-0.03em",
              fontWeight: 800,
              lineHeight: "1.12",
            }}
          >
            {etapa.title}
          </h3>
          <p
            style={{
              fontSize: "17px",
              lineHeight: "1.6",
              color: "rgb(74, 77, 90)",
              maxWidth: "560px",
            }}
          >
            {etapa.desc}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span
              className="mono"
              style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
            >
              O que é registrado
            </span>
            <ul style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {etapa.items.map((item) => (
                <li
                  key={item}
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                    lineHeight: "1.5",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#5B63F5"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span
              className="mono"
              style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
            >
              Módulos envolvidos
            </span>
            <ul style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {etapa.mods.map((mod) => (
                <li
                  key={mod}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(62, 68, 201)",
                    fontSize: "13.5px",
                    fontWeight: 700,
                  }}
                >
                  {mod}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{ marginTop: "auto", display: "flex", gap: "6px" }}
        >
          {ETAPAS.map((e, i) => (
            <span
              key={e.title}
              style={{
                flex: "1 1 0%",
                height: "4px",
                borderRadius: "4px",
                background: i <= atual ? "rgb(91, 99, 245)" : "rgb(230, 229, 225)",
                transition: "background-color 0.2s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
