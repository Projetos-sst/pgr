"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { PORTAL_ROUTES } from "./routes";

/**
 * FAQ da Home — porte fiel da seção aprovada, incluindo o comportamento do
 * protótipo: o primeiro item nasce aberto e clicar no item aberto o fecha.
 *
 * As sete perguntas e respostas são **as aprovadas**, copiadas do HTML do
 * Claude Design sem reescrita.
 */
const PERGUNTAS = [
  {
    q: "O que é o PGR-e?",
    a: "É uma plataforma web para organizar as rotinas de Saúde e Segurança do Trabalho. A área de Segurança tem o PGR como módulo central; a área de Medicina do Trabalho está em expansão.",
  },
  {
    q: "Quais recursos de Segurança do Trabalho estão disponíveis?",
    a: "Cadastro de empresas, unidades, funções e GES, inventário e avaliação de riscos, medidas de controle, planos de ação, gestão de EPI, inspeções e geração do documento do PGR.",
  },
  {
    q: "O que já está disponível em Medicina do Trabalho?",
    a: "Recursos para ASO e exames ocupacionais e o cadastro de profissionais de saúde. PCMSO, CAT, clínicas parceiras, solicitação de exames e absenteísmo fazem parte do plano de evolução e ainda não estão disponíveis.",
  },
  {
    q: "A plataforma garante a conformidade com as Normas Regulamentadoras?",
    a: "Não. A plataforma organiza e documenta as informações, o que apoia o trabalho técnico. A análise, as decisões e a responsabilidade pelos programas continuam com os profissionais habilitados.",
  },
  {
    q: "Preciso instalar algum programa?",
    a: "Não. A plataforma é acessada pelo navegador, com login individual para cada usuário.",
  },
  {
    q: "Como solicito um orçamento?",
    a: "Preencha o formulário de solicitação informando seus dados de contato e a área de interesse. Nossa equipe retorna pelo e-mail ou telefone informado.",
  },
  {
    q: "Como acesso a plataforma?",
    a: "Clique em Entrar e utilize sua conta Google ou o e-mail cadastrado pela sua organização.",
  },
];

export function PortalFaq() {
  const base = useId().replace(/:/g, "");
  const [aberta, setAberta] = useState(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      style={{ padding: "0px 0px clamp(64px, 8vw, 112px)" }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0px auto",
          padding: "0px 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "40px 72px",
        }}
      >
        <div
          style={{
            flex: "1 1 300px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            maxWidth: "380px",
          }}
        >
          <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
            Perguntas frequentes
          </span>
          <h2
            id="faq-title"
            style={{
              fontSize: "clamp(30px, 3.4vw, 44px)",
              lineHeight: "1.08",
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            Dúvidas comuns
          </h2>
          <p style={{ color: "rgb(74, 77, 90)", fontSize: "16px", lineHeight: "1.6" }}>
            Não encontrou o que procura?{" "}
            <Link href={PORTAL_ROUTES.orcamento} style={{ fontWeight: 700 }}>
              Fale com a nossa equipe
            </Link>
            .
          </p>
        </div>

        <div style={{ flex: "2 1 560px", borderTop: "1px solid rgb(225, 223, 218)" }}>
          {PERGUNTAS.map((item, i) => {
            const aberto = aberta === i;
            const btnId = `${base}-faq-btn-${i}`;
            const panelId = `${base}-faq-panel-${i}`;
            return (
              <div key={item.q} style={{ borderBottom: "1px solid rgb(225, 223, 218)" }}>
                <h3 style={{ margin: "0px" }}>
                  <button
                    className="faq-q"
                    type="button"
                    id={btnId}
                    aria-expanded={aberto}
                    aria-controls={panelId}
                    onClick={() => setAberta(aberto ? -1 : i)}
                  >
                    <span>
                      <span>{item.q}</span>
                    </span>
                    <span
                      style={{
                        flex: "0 0 auto",
                        width: "32px",
                        height: "32px",
                        borderRadius: "9px",
                        background: "rgb(255, 255, 255)",
                        border: "1px solid rgb(225, 223, 218)",
                        display: "grid",
                        placeItems: "center",
                        transition: "transform 0.2s",
                        transform: aberto ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                </h3>
                {aberto ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className="rise"
                    style={{
                      padding: "0px 48px 24px 0px",
                      color: "rgb(74, 77, 90)",
                      fontSize: "15.5px",
                      lineHeight: "1.7",
                    }}
                  >
                    {item.a}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
