import type { Metadata } from "next";
import Link from "next/link";

import { PgrFlow } from "../../_portal/pgr-flow";

/**
 * Segurança do Trabalho — porte fiel da prancha aprovada.
 *
 * A seção `#fluxo` é interativa no design (tablist de 5 etapas com anterior e
 * próxima); ela sai para `<PgrFlow />`, um Client Component, em vez de virar
 * imagem estática. O resto da página é estático.
 */
export const metadata: Metadata = {
  title: "Segurança do Trabalho — PGR-e",
  description:
    "Da identificação dos riscos ao acompanhamento das medidas de controle, com o PGR como módulo central.",
  alternates: { canonical: "/seguranca-do-trabalho" },
  openGraph: {
    title: "Segurança do Trabalho — PGR-e",
    description:
      "Empresas e funções, inventário de riscos, avaliação, medidas de controle, planos de ação e o documento do PGR.",
    url: "/seguranca-do-trabalho",
    type: "website",
  },
};

export default function SegurancaDoTrabalho() {
  return (
    <>
      <section
        aria-labelledby="hero-title"
        style={{
          background:
            "radial-gradient(1000px 480px at 80% -10%, rgba(91, 99, 245, 0.12), rgba(91, 99, 245, 0) 70%)",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "28px 24px clamp(56px, 7vw, 104px)",
          }}
        >
          <nav
            aria-label="Trilha de navegação"
            style={{ marginBottom: "clamp(28px, 4vw, 56px)" }}
          >
            <ol
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                margin: "0px",
                padding: "0px",
                listStyle: "none",
                fontSize: "13.5px",
                color: "rgb(86, 89, 102)",
              }}
            >
              <li>
                <Link
                  href="/"
                  style={{
                    color: "rgb(86, 89, 102)",
                    textDecoration: "none",
                    fontWeight: "600",
                  }}
                >
                  Início
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li
                aria-current="page"
                style={{ color: "rgb(22, 23, 29)", fontWeight: "700" }}
              >
                Segurança do Trabalho
              </li>
            </ol>
          </nav>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(460px, 100%), 1fr))",
              gap: "56px",
              alignItems: "center",
            }}
          >
            <div
              className="rise"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "26px",
                minWidth: "0px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgb(91, 99, 245)",
                    color: "rgb(255, 255, 255)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "rgba(91, 99, 245, 0.8) 0px 10px 20px -10px",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <span className="mono" style={{ color: "rgb(62, 68, 201)" }}>
                  Segurança do Trabalho
                </span>
              </span>
              <h1
                id="hero-title"
                style={{
                  fontSize: "clamp(36px, 4.6vw, 60px)",
                  lineHeight: "1.04",
                  letterSpacing: "-0.04em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Da identificação dos riscos ao acompanhamento das medidas de prevenção.
              </h1>
              <p
                style={{
                  fontSize: "clamp(17px, 1.5vw, 19px)",
                  lineHeight: "1.6",
                  color: "rgb(74, 77, 90)",
                  maxWidth: "540px",
                  textWrap: "pretty",
                }}
              >
                Organize o Programa de Gerenciamento de Riscos com informações conectadas:
                estrutura da empresa, inventário, avaliações, controles e planos de ação.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <Link className="btn btn-primary" href="/orcamento">
                  Solicitar orçamento
                </Link>
                <a className="btn btn-secondary" href="#fluxo">
                  Ver o fluxo do PGR
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
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </a>
              </div>
            </div>

            <div
              className="rise rise-2"
              role="img"
              aria-label="Ilustração conceitual do documento do PGR com suas seções"
              style={{
                position: "relative",
                padding: "28px 28px 28px 20px",
                minWidth: "0px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "44px 6px 6px 44px",
                  borderRadius: "22px",
                  background: "rgb(227, 228, 253)",
                  border: "1px solid rgb(210, 211, 251)",
                  transform: "rotate(3deg)",
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  inset: "36px 16px 16px 34px",
                  borderRadius: "22px",
                  background: "rgb(240, 240, 254)",
                  border: "1px solid rgb(220, 221, 251)",
                  transform: "rotate(1.5deg)",
                }}
              ></div>
              <div
                style={{
                  position: "relative",
                  background: "rgb(255, 255, 255)",
                  border: "1px solid rgb(228, 227, 240)",
                  borderRadius: "22px",
                  padding: "28px",
                  boxShadow: "rgba(30, 32, 80, 0.5) 0px 30px 60px -36px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "22px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span
                      className="mono"
                      style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
                    >
                      Documento · ilustração
                    </span>
                    <span
                      style={{
                        fontWeight: "800",
                        fontSize: "22px",
                        letterSpacing: "-0.02em",
                        lineHeight: "1.15",
                      }}
                    >
                      PGR — Programa de Gerenciamento de Riscos
                    </span>
                  </div>
                  <span
                    style={{
                      flex: "0 0 auto",
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgb(238, 239, 254)",
                      color: "rgb(91, 99, 245)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5M9 13h6M9 17h4" />
                    </svg>
                  </span>
                </div>
                <div style={{ height: "1px", background: "rgb(238, 236, 231)" }}></div>
                <ol
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    margin: "0px",
                    padding: "0px",
                    listStyle: "none",
                  }}
                >
                  <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgb(91, 99, 245)",
                        color: "rgb(255, 255, 255)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      Identificação da empresa e funções
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgb(91, 99, 245)",
                        color: "rgb(255, 255, 255)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      Inventário de riscos
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgb(91, 99, 245)",
                        color: "rgb(255, 255, 255)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      Avaliação dos riscos
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgb(91, 99, 245)",
                        color: "rgb(255, 255, 255)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      Medidas de controle
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: "2px solid rgb(180, 183, 250)",
                        background: "rgb(255, 255, 255)",
                        flex: "0 0 auto",
                      }}
                    ></span>
                    <span
                      style={{
                        fontWeight: "700",
                        fontSize: "15px",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      Plano de ação
                    </span>
                  </li>
                </ol>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    background: "rgb(247, 247, 245)",
                    fontSize: "13px",
                    color: "rgb(74, 77, 90)",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#5B63F5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l9 5-9 5-9-5 9-5z" />
                    <path d="M3 13l9 5 9-5" />
                  </svg>
                  Montado a partir das informações cadastradas na plataforma
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        id="fluxo"
        aria-labelledby="fluxo-title"
        style={{
          padding: "clamp(56px, 7vw, 96px) 0px",
          background: "rgb(250, 250, 248)",
          borderTop: "1px solid rgb(232, 230, 225)",
          borderBottom: "1px solid rgb(232, 230, 225)",
          scrollMarginTop: "72px",
        }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "24px",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                maxWidth: "640px",
              }}
            >
              <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
                O fluxo do PGR
              </span>
              <h2
                id="fluxo-title"
                style={{
                  fontSize: "clamp(30px, 3.4vw, 44px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Cada etapa alimenta a seguinte.
              </h2>
            </div>
            <p
              style={{
                maxWidth: "420px",
                color: "rgb(74, 77, 90)",
                fontSize: "16.5px",
                lineHeight: "1.6",
              }}
            >
              Selecione uma etapa para ver o que é registrado e quais módulos participam.
            </p>
          </div>
          <PgrFlow />
          <p
            className="mono"
            style={{
              fontSize: "10px",
              color: "rgb(106, 109, 121)",
              marginTop: "20px",
              letterSpacing: "0.1em",
            }}
          >
            Representação conceitual do trabalho — não descreve a estrutura de dados do
            sistema.
          </p>
        </div>
      </section>
      <section
        id="modulos"
        aria-labelledby="mod-title"
        style={{ padding: "clamp(56px, 7vw, 104px) 0px", scrollMarginTop: "72px" }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "680px",
              marginBottom: "48px",
            }}
          >
            <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
              Módulos
            </span>
            <h2
              id="mod-title"
              style={{
                fontSize: "clamp(30px, 3.4vw, 44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.03em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              Tudo o que o PGR precisa, organizado em três frentes.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
              gap: "20px",
            }}
          >
            <div
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                  A
                </span>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Estruturar
                </h3>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="3" width="10" height="18" rx="1.5" />
                    <path d="M14 9h5a1 1 0 0 1 1 1v11" />
                    <path d="M8 7h2M8 11h2M8 15h2" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>
                    Empresas e unidades
                  </h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Cadastro das empresas atendidas, com dados de identificação e
                    endereço.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M3 20a6 6 0 0 1 12 0" />
                    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>Funções e GES</h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Funções organizadas em Grupos de Exposição Similar.
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                  B
                </span>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Mapear e avaliar
                </h3>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 6h11M9 12h11M9 18h11" />
                    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>
                    Inventário de riscos
                  </h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Riscos físicos, químicos, biológicos, ergonômicos e de acidentes.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 18a8 8 0 1 1 16 0" />
                    <path d="M12 18l4-5" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>
                    Avaliação de riscos
                  </h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Registro consistente da avaliação de cada risco identificado.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                    <circle cx="16" cy="7" r="2" />
                    <circle cx="10" cy="17" r="2" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>
                    Medidas de controle
                  </h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Controles relacionados aos riscos que pretendem reduzir.
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                  C
                </span>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Agir e acompanhar
                </h3>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5" y="4" width="14" height="17" rx="2" />
                    <path d="M9 4h6v3H9z" />
                    <path d="M9 13l2 2 4-4" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>Planos de ação</h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Ações organizadas e acompanhadas até a conclusão.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 17h18v3H3z" />
                    <path d="M5 17a7 7 0 0 1 14 0" />
                    <path d="M10 10V6h4v4" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>Gestão de EPI</h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Equipamentos de proteção individual organizados na plataforma.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="6" />
                    <path d="M20 20l-4.5-4.5" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>Inspeções</h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Registro das inspeções de segurança realizadas.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 0px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: "rgb(91, 99, 245)",
                    color: "rgb(255, 255, 255)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h4" />
                  </svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "800" }}>
                    Documento do PGR
                  </h4>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Geração do documento do programa a partir dos cadastros.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              marginTop: "20px",
              padding: "16px 20px",
              borderRadius: "16px",
              border: "1px dashed rgb(207, 205, 198)",
              background: "rgb(250, 250, 248)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: "10px",
                color: "rgb(106, 109, 121)",
                marginRight: "6px",
              }}
            >
              Também na plataforma
            </span>
            <span
              style={{
                padding: "6px 11px",
                borderRadius: "9px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                fontSize: "13.5px",
                fontWeight: "600",
              }}
            >
              Ordens de serviço
            </span>
            <span
              style={{
                padding: "6px 11px",
                borderRadius: "9px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                fontSize: "13.5px",
                fontWeight: "600",
              }}
            >
              Registro de incidentes
            </span>
            <span
              style={{
                padding: "6px 11px",
                borderRadius: "9px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                fontSize: "13.5px",
                fontWeight: "600",
              }}
            >
              Monitoramento psicossocial
            </span>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="resp-title"
        style={{ padding: "0px 0px clamp(56px, 7vw, 96px)" }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "28px 48px",
              alignItems: "center",
              padding: "clamp(28px, 4vw, 48px)",
              borderRadius: "24px",
              background: "rgb(22, 23, 29)",
              color: "rgb(255, 255, 255)",
            }}
          >
            <span
              style={{
                flex: "0 0 auto",
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                background: "rgb(42, 44, 58)",
                color: "rgb(180, 183, 250)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div
              style={{
                flex: "1 1 420px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <h2
                id="resp-title"
                style={{
                  fontSize: "clamp(22px, 2.2vw, 28px)",
                  fontWeight: "800",
                  letterSpacing: "-0.02em",
                  lineHeight: "1.2",
                }}
              >
                Tecnologia a serviço do trabalho técnico.
              </h2>
              <p
                style={{
                  color: "rgb(201, 202, 214)",
                  fontSize: "16px",
                  lineHeight: "1.65",
                  maxWidth: "760px",
                }}
              >
                A plataforma organiza, relaciona e documenta as informações. A
                identificação e a avaliação dos riscos, as decisões e a responsabilidade
                técnica pelo PGR continuam com os profissionais de SST.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="cta-title"
        style={{ padding: "0px 0px clamp(64px, 8vw, 112px)" }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "0px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
            gap: "20px",
          }}
        >
          <div
            style={{
              gridColumn: "1 / -1",
              position: "relative",
              overflow: "hidden",
              borderRadius: "28px",
              background:
                "radial-gradient(rgba(255, 255, 255, 0.16) 1px, rgba(0, 0, 0, 0) 1.2px) 0% 0% / 20px 20px rgb(79, 87, 238)",
              padding: "clamp(36px, 5vw, 56px)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "28px",
              color: "rgb(255, 255, 255)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                maxWidth: "620px",
              }}
            >
              <span className="mono" style={{ color: "rgb(218, 220, 254)" }}>
                Segurança do Trabalho
              </span>
              <h2
                id="cta-title"
                style={{
                  fontSize: "clamp(28px, 3.2vw, 40px)",
                  lineHeight: "1.1",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Quer ver o PGR organizado na sua empresa?
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: "1.6",
                  color: "rgb(238, 239, 255)",
                }}
              >
                Solicite um orçamento e conte como sua equipe trabalha hoje.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link className="btn btn-light" href="/orcamento">
                Solicitar orçamento
              </Link>
              <Link className="btn btn-outline-light" href="/">
                Voltar ao início
              </Link>
            </div>
          </div>
          <Link
            className="lift"
            href="/medicina-do-trabalho"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              padding: "24px 28px",
              borderRadius: "20px",
              background: "rgb(238, 248, 246)",
              border: "1px solid rgb(214, 238, 233)",
              textDecoration: "none",
              color: "rgb(22, 23, 29)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span
                style={{
                  flex: "0 0 auto",
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgb(14, 147, 132)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5.2 8.8 11.4 8.8 11.4s8.8-6.2 8.8-11.4z" />
                  <path d="M3.5 12h4l2-3 3 6 2-3h6" />
                </svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span
                  className="mono"
                  style={{ fontSize: "10px", color: "rgb(11, 122, 110)" }}
                >
                  Na mesma plataforma
                </span>
                <span style={{ fontWeight: "800", fontSize: "18px" }}>
                  Conheça também a Medicina do Trabalho
                </span>
              </span>
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "700",
                color: "rgb(11, 122, 110)",
              }}
            >
              Ver área{" "}
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
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
