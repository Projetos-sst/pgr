import type { Metadata } from "next";
import Link from "next/link";

import { PortalFaq } from "../_portal/portal-faq";

/**
 * Home do portal público — porte fiel da prancha "Home" do HTML aprovado pelo
 * Claude Design (Douglas + Expedito).
 *
 * Os estilos inline e as classes vêm do design e são a referência visual: não
 * devem ser "simplificados". O FAQ sai daqui para um Client Component porque
 * tem estado; o resto da página é estático e pré-renderizado.
 */
export const metadata: Metadata = {
  title: "PGR-e — Saúde e segurança do trabalho em uma só plataforma",
  description:
    "Organize processos, acompanhe riscos ocupacionais e centralize as rotinas de saúde e segurança da sua empresa em um ambiente integrado.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PGR-e — Saúde e segurança do trabalho em uma só plataforma",
    description:
      "Plataforma de Saúde e Segurança do Trabalho: PGR, riscos, medidas de controle, EPI, inspeções e ASO.",
    url: "/",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <section
        aria-labelledby="hero-title"
        style={{
          background:
            "radial-gradient(900px 460px at 88% -10%, rgba(91, 99, 245, 0.11), rgba(91, 99, 245, 0) 70%), radial-gradient(640px 380px at -5% 40%, rgba(20, 184, 166, 0.07), rgba(20, 184, 166, 0) 70%)",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "clamp(48px, 7vw, 96px) 24px clamp(56px, 7vw, 104px)",
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
              gap: "28px",
              minWidth: "0px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: "10px",
                padding: "5px 14px 5px 5px",
                borderRadius: "999px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "999px",
                  background: "rgb(238, 239, 254)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgb(91, 99, 245)",
                  }}
                ></span>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgb(20, 184, 166)",
                  }}
                ></span>
              </span>
              <span
                className="mono"
                style={{ color: "rgb(74, 77, 90)", fontSize: "10.5px" }}
              >
                Plataforma SST · Segurança + Medicina
              </span>
            </span>
            <h1
              id="hero-title"
              style={{
                fontSize: "clamp(40px, 5.3vw, 68px)",
                lineHeight: "1.02",
                letterSpacing: "-0.04em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              Saúde e segurança do trabalho em{" "}
              <span style={{ color: "rgb(91, 99, 245)" }}>uma só plataforma.</span>
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
              Organize processos, acompanhe riscos ocupacionais e centralize as rotinas de
              saúde e segurança da sua empresa em um ambiente integrado.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link className="btn btn-primary" href="/seguranca-do-trabalho">
                Conhecer Segurança do Trabalho
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
              </Link>
              <Link className="btn btn-secondary" href="/medicina-do-trabalho">
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgb(20, 184, 166)",
                  }}
                ></span>
                Conhecer Medicina do Trabalho
              </Link>
            </div>
            <p
              style={{
                fontSize: "14.5px",
                color: "rgb(86, 89, 102)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Já utiliza a plataforma?{" "}
              <Link
                className="tlink"
                href="/sign-in"
                style={{ color: "rgb(62, 68, 201)", minHeight: "32px" }}
              >
                Entrar{" "}
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </p>
          </div>

          <div
            className="hero-art rise rise-2"
            role="img"
            aria-label="Ilustração conceitual de cartões da plataforma: inventário de riscos, plano de ação e ASO"
            style={{
              borderRadius: "28px",
              backgroundColor: "rgb(236, 235, 250)",
              backgroundImage:
                "radial-gradient(rgba(91, 99, 245, 0.2) 1px, rgba(0, 0, 0, 0) 1.2px)",
              backgroundSize: "18px 18px",
              border: "1px solid rgb(221, 220, 246)",
              minWidth: "0px",
            }}
          >
            <div
              className="c"
              style={{
                left: "28px",
                top: "32px",
                width: "340px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(231, 230, 240)",
                borderRadius: "18px",
                padding: "20px",
                boxShadow:
                  "rgba(30, 32, 80, 0.45) 0px 26px 50px -30px, rgba(30, 32, 80, 0.05) 0px 2px 6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    className="mono"
                    style={{ fontSize: "9.5px", color: "rgb(106, 109, 121)" }}
                  >
                    Segurança · PGR
                  </span>
                  <span style={{ fontWeight: "700", fontSize: "15px" }}>
                    Inventário de riscos
                  </span>
                </div>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "9px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l9 5-9 5-9-5 9-5z" />
                    <path d="M3 13l9 5 9-5" />
                  </svg>
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
                <div style={{ display: "grid", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgb(63, 66, 77)",
                    }}
                  >
                    Físico
                  </span>
                  <span
                    style={{
                      height: "6px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 243)",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "6px",
                        width: "82%",
                        borderRadius: "9px",
                        background: "rgb(91, 99, 245)",
                      }}
                    ></span>
                  </span>
                </div>
                <div style={{ display: "grid", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgb(63, 66, 77)",
                    }}
                  >
                    Químico
                  </span>
                  <span
                    style={{
                      height: "6px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 243)",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "6px",
                        width: "60%",
                        borderRadius: "9px",
                        background: "rgb(167, 139, 250)",
                      }}
                    ></span>
                  </span>
                </div>
                <div style={{ display: "grid", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgb(63, 66, 77)",
                    }}
                  >
                    Ergonômico
                  </span>
                  <span
                    style={{
                      height: "6px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 243)",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "6px",
                        width: "44%",
                        borderRadius: "9px",
                        background: "rgb(56, 189, 248)",
                      }}
                    ></span>
                  </span>
                </div>
                <div style={{ display: "grid", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgb(63, 66, 77)",
                    }}
                  >
                    Biológico
                  </span>
                  <span
                    style={{
                      height: "6px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 243)",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "6px",
                        width: "28%",
                        borderRadius: "9px",
                        background: "rgb(45, 212, 191)",
                      }}
                    ></span>
                  </span>
                </div>
                <div style={{ display: "grid", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgb(63, 66, 77)",
                    }}
                  >
                    Acidente
                  </span>
                  <span
                    style={{
                      height: "6px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 243)",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "6px",
                        width: "18%",
                        borderRadius: "9px",
                        background: "rgb(245, 165, 36)",
                      }}
                    ></span>
                  </span>
                </div>
              </div>
            </div>

            <div
              className="c"
              style={{
                right: "24px",
                top: "168px",
                width: "292px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(231, 230, 240)",
                borderRadius: "18px",
                padding: "18px",
                boxShadow:
                  "rgba(30, 32, 80, 0.5) 0px 26px 50px -28px, rgba(30, 32, 80, 0.05) 0px 2px 6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "9px",
                    background: "rgb(238, 239, 254)",
                    color: "rgb(91, 99, 245)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                <span style={{ fontWeight: "700", fontSize: "14.5px" }}>
                  Plano de ação
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "11px",
                    background: "rgb(247, 247, 245)",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: "600" }}>
                    Medida de controle
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgb(221, 245, 236)",
                      color: "rgb(15, 122, 85)",
                    }}
                  >
                    Concluída
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "11px",
                    background: "rgb(247, 247, 245)",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: "600" }}>
                    Responsável definido
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgb(230, 231, 254)",
                      color: "rgb(62, 68, 201)",
                    }}
                  >
                    Em andamento
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "11px",
                    background: "rgb(247, 247, 245)",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: "600" }}>
                    Verificação
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgb(255, 240, 214)",
                      color: "rgb(138, 82, 8)",
                    }}
                  >
                    Pendente
                  </span>
                </div>
              </div>
            </div>

            <div
              className="c"
              style={{
                left: "72px",
                bottom: "30px",
                width: "318px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(220, 239, 235)",
                borderRadius: "18px",
                padding: "18px",
                boxShadow:
                  "rgba(15, 90, 80, 0.45) 0px 26px 50px -30px, rgba(15, 90, 80, 0.05) 0px 2px 6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    className="mono"
                    style={{ fontSize: "9.5px", color: "rgb(11, 122, 110)" }}
                  >
                    Medicina · ASO
                  </span>
                  <span style={{ fontWeight: "700", fontSize: "14.5px" }}>
                    Exame ocupacional
                  </span>
                </div>
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "9px",
                    background: "rgb(227, 246, 242)",
                    color: "rgb(14, 147, 132)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "9px 14px",
                  alignItems: "center",
                  fontSize: "12px",
                  color: "rgb(86, 89, 102)",
                }}
              >
                <span>Colaborador</span>
                <span
                  style={{
                    height: "8px",
                    borderRadius: "9px",
                    background: "rgb(236, 236, 239)",
                    display: "block",
                    width: "78%",
                  }}
                ></span>
                <span>Função</span>
                <span
                  style={{
                    height: "8px",
                    borderRadius: "9px",
                    background: "rgb(236, 236, 239)",
                    display: "block",
                    width: "56%",
                  }}
                ></span>
                <span>Tipo</span>
                <span
                  style={{
                    justifySelf: "start",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    background: "rgb(227, 246, 242)",
                    color: "rgb(11, 122, 110)",
                  }}
                >
                  Periódico
                </span>
              </div>
            </div>
            <span
              className="tag mono"
              style={{
                position: "absolute",
                right: "18px",
                bottom: "16px",
                fontSize: "9.5px",
                color: "rgb(91, 94, 156)",
                background: "rgba(255, 255, 255, 0.75)",
                padding: "5px 9px",
                borderRadius: "7px",
              }}
            >
              Ilustração conceitual
            </span>
          </div>
        </div>
      </section>
      <section
        id="areas"
        aria-labelledby="areas-title"
        style={{ padding: "clamp(56px, 7vw, 96px) 0px" }}
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
                Arquitetura da plataforma
              </span>
              <h2
                id="areas-title"
                style={{
                  fontSize: "clamp(30px, 3.4vw, 44px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Uma plataforma. Duas vertentes.
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
              Segurança e Medicina do Trabalho compartilham a mesma identidade, o mesmo
              acesso e a mesma forma de trabalhar.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(500px, 100%), 1fr))",
              gap: "20px",
            }}
          >
            <article
              className="lift"
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "32px 32px 28px",
                  background: "rgb(241, 241, 254)",
                  borderBottom: "1px solid rgb(227, 227, 251)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "20px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span className="mono" style={{ color: "rgb(62, 68, 201)" }}>
                    01 — Segurança do Trabalho
                  </span>
                  <h3
                    style={{
                      fontSize: "28px",
                      letterSpacing: "-0.025em",
                      fontWeight: "800",
                      lineHeight: "1.15",
                    }}
                  >
                    Riscos identificados, controles acompanhados.
                  </h3>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "rgb(91, 99, 245)",
                    color: "rgb(255, 255, 255)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "rgba(91, 99, 245, 0.8) 0px 10px 20px -10px",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
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
              </div>
              <div
                style={{
                  padding: "28px 32px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "22px",
                  flex: "1 1 0%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "18px",
                    borderRadius: "16px",
                    border: "1px solid rgb(217, 218, 252)",
                    background: "linear-gradient(rgb(250, 250, 255), rgb(244, 244, 255))",
                  }}
                >
                  <span
                    style={{
                      flex: "0 0 auto",
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgb(255, 255, 255)",
                      border: "1px solid rgb(220, 221, 251)",
                      color: "rgb(91, 99, 245)",
                      display: "grid",
                      placeItems: "center",
                      fontFamily:
                        'var(--font-mono), "JetBrains Mono", ui-monospace, Menlo, monospace',
                      fontWeight: "600",
                      fontSize: "12px",
                    }}
                  >
                    PGR
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                      minWidth: "0px",
                    }}
                  >
                    <span style={{ fontWeight: "800", fontSize: "16px" }}>
                      Programa de Gerenciamento de Riscos
                    </span>
                    <span style={{ fontSize: "14px", color: "rgb(74, 77, 90)" }}>
                      O módulo central da área de Segurança.
                    </span>
                  </div>
                </div>
                <ul style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <li
                    style={{
                      padding: "8px 13px",
                      borderRadius: "10px",
                      background: "rgb(244, 243, 240)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "rgb(48, 50, 59)",
                    }}
                  >
                    Inventário de riscos
                  </li>
                  <li
                    style={{
                      padding: "8px 13px",
                      borderRadius: "10px",
                      background: "rgb(244, 243, 240)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "rgb(48, 50, 59)",
                    }}
                  >
                    Medidas de controle
                  </li>
                  <li
                    style={{
                      padding: "8px 13px",
                      borderRadius: "10px",
                      background: "rgb(244, 243, 240)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "rgb(48, 50, 59)",
                    }}
                  >
                    Planos de ação
                  </li>
                  <li
                    style={{
                      padding: "8px 13px",
                      borderRadius: "10px",
                      background: "rgb(244, 243, 240)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "rgb(48, 50, 59)",
                    }}
                  >
                    Gestão de EPI
                  </li>
                  <li
                    style={{
                      padding: "8px 13px",
                      borderRadius: "10px",
                      background: "rgb(244, 243, 240)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "rgb(48, 50, 59)",
                    }}
                  >
                    Inspeções
                  </li>
                </ul>
                <Link
                  className="tlink"
                  href="/seguranca-do-trabalho"
                  style={{ color: "rgb(62, 68, 201)", marginTop: "auto" }}
                >
                  Conhecer Segurança do Trabalho{" "}
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
                </Link>
              </div>
            </article>

            <article
              className="lift"
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "32px 32px 28px",
                  background: "rgb(238, 248, 246)",
                  borderBottom: "1px solid rgb(216, 239, 234)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "20px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span className="mono" style={{ color: "rgb(11, 122, 110)" }}>
                    02 — Medicina do Trabalho
                  </span>
                  <h3
                    style={{
                      fontSize: "28px",
                      letterSpacing: "-0.025em",
                      fontWeight: "800",
                      lineHeight: "1.15",
                    }}
                  >
                    Saúde ocupacional organizada, em expansão.
                  </h3>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "rgb(14, 147, 132)",
                    color: "rgb(255, 255, 255)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "rgba(14, 147, 132, 0.8) 0px 10px 20px -10px",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
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
              </div>
              <div
                style={{
                  padding: "28px 32px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "22px",
                  flex: "1 1 0%",
                }}
              >
                <ul style={{ display: "flex", flexDirection: "column" }}>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0px",
                      borderBottom: "1px solid rgb(238, 236, 231)",
                    }}
                  >
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      ASO e exames ocupacionais
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgb(221, 245, 236)",
                        color: "rgb(15, 122, 85)",
                      }}
                    >
                      Disponível
                    </span>
                  </li>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0px",
                      borderBottom: "1px solid rgb(238, 236, 231)",
                    }}
                  >
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>
                      Profissionais de saúde
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgb(221, 245, 236)",
                        color: "rgb(15, 122, 85)",
                      }}
                    >
                      Disponível
                    </span>
                  </li>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0px",
                      borderBottom: "1px solid rgb(238, 236, 231)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      PCMSO
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgb(237, 237, 240)",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      Planejado
                    </span>
                  </li>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0px",
                      borderBottom: "1px solid rgb(238, 236, 231)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      Clínicas parceiras e solicitação de exames
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgb(237, 237, 240)",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      Planejado
                    </span>
                  </li>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      CAT e absenteísmo
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgb(237, 237, 240)",
                        color: "rgb(74, 77, 90)",
                      }}
                    >
                      Planejado
                    </span>
                  </li>
                </ul>
                <Link
                  className="tlink"
                  href="/medicina-do-trabalho"
                  style={{ color: "rgb(11, 122, 110)", marginTop: "auto" }}
                >
                  Conhecer Medicina do Trabalho{" "}
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
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="ben-title"
        style={{
          padding: "clamp(56px, 7vw, 96px) 0px",
          background: "rgb(250, 250, 248)",
          borderTop: "1px solid rgb(232, 230, 225)",
          borderBottom: "1px solid rgb(232, 230, 225)",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "0px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "48px 72px",
          }}
        >
          <div
            style={{
              flex: "1 1 320px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              maxWidth: "420px",
            }}
          >
            <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
              Por que centralizar
            </span>
            <h2
              id="ben-title"
              style={{
                fontSize: "clamp(30px, 3.4vw, 44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.03em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              Menos planilhas dispersas. Mais clareza na gestão de SST.
            </h2>
            <p
              style={{ color: "rgb(74, 77, 90)", fontSize: "16.5px", lineHeight: "1.65" }}
            >
              A plataforma reúne em um só ambiente as informações que costumam ficar
              espalhadas entre arquivos, e-mails e documentos.
            </p>
          </div>
          <ol
            style={{
              flex: "2 1 560px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
              gap: "0px 40px",
              margin: "0px",
              padding: "0px",
              listStyle: "none",
            }}
          >
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                01
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Informações organizadas
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Empresas, unidades, funções e riscos estruturados e fáceis de consultar.
              </p>
            </li>
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                02
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Processos centralizados
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                PGR, planos de ação, EPI e inspeções no mesmo lugar.
              </p>
            </li>
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                03
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Gestão mais clara
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Status e pendências visíveis para quem acompanha a rotina de SST.
              </p>
            </li>
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                04
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Acompanhamento contínuo
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Ações e prazos acompanhados ao longo do tempo, não apenas na emissão do
                documento.
              </p>
            </li>
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                05
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Informações conectadas
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Riscos, controles e ações relacionados entre si, do levantamento ao
                programa.
              </p>
            </li>
            <li
              style={{
                padding: "24px 0px",
                borderTop: "1px solid rgb(225, 223, 218)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span className="mono" style={{ color: "rgb(91, 99, 245)" }}>
                06
              </span>
              <h3
                style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Fácil de usar
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Interface direta para técnicos, engenheiros e gestores com diferentes
                níveis de familiaridade.
              </p>
            </li>
          </ol>
        </div>
      </section>
      <section
        id="funcionalidades"
        aria-labelledby="func-title"
        style={{ padding: "clamp(56px, 7vw, 104px) 0px", scrollMarginTop: "72px" }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "680px",
              marginBottom: "40px",
            }}
          >
            <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
              Funcionalidades
            </span>
            <h2
              id="func-title"
              style={{
                fontSize: "clamp(30px, 3.4vw, 44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.03em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              O PGR no centro. Os módulos ao redor.
            </h2>
            <p
              style={{ color: "rgb(74, 77, 90)", fontSize: "16.5px", lineHeight: "1.6" }}
            >
              Recursos organizados pela lógica do trabalho: estruturar, mapear, agir e
              documentar.
            </p>
          </div>

          <div className="bento">
            <article
              className="b-big"
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "24px",
                background: "rgb(91, 99, 245)",
                color: "rgb(255, 255, 255)",
                padding: "36px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "32px",
                minHeight: "340px",
                boxShadow: "rgba(91, 99, 245, 0.9) 0px 30px 60px -36px",
              }}
            >
              <svg
                width="420"
                height="420"
                viewBox="0 0 420 420"
                fill="none"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: "-120px",
                  bottom: "-140px",
                  opacity: "0.22",
                }}
              >
                <circle cx="210" cy="210" r="80" stroke="#fff" strokeWidth="1.5" />
                <circle cx="210" cy="210" r="130" stroke="#fff" strokeWidth="1.5" />
                <circle cx="210" cy="210" r="180" stroke="#fff" strokeWidth="1.5" />
                <circle cx="210" cy="210" r="18" fill="#fff" />
                <circle cx="290" cy="210" r="7" fill="#fff" />
                <circle cx="118" cy="120" r="7" fill="#fff" />
                <circle cx="210" cy="30" r="7" fill="#fff" />
              </svg>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxWidth: "440px",
                }}
              >
                <span className="mono" style={{ color: "rgb(218, 220, 254)" }}>
                  Núcleo da Segurança
                </span>
                <h3
                  style={{
                    fontSize: "clamp(26px, 2.6vw, 34px)",
                    lineHeight: "1.1",
                    letterSpacing: "-0.03em",
                    fontWeight: "800",
                  }}
                >
                  PGR — Programa de Gerenciamento de Riscos
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "rgb(238, 239, 255)",
                  }}
                >
                  Reúne inventário de riscos, avaliações, medidas de controle e plano de
                  ação em um programa estruturado, com geração do documento.
                </p>
              </div>
              <div style={{ position: "relative" }}>
                <Link className="btn btn-light" href="/seguranca-do-trabalho">
                  Ver o fluxo do PGR{" "}
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
                </Link>
              </div>
            </article>

            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Mapear
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                Inventário de riscos
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Riscos ocupacionais registrados por categoria, função e GES.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Mapear
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Avaliação de riscos</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Cada risco avaliado e documentado de forma consistente.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Agir
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Medidas de controle</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Controles associados aos riscos que pretendem reduzir.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Agir
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Planos de ação</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Ações organizadas e acompanhadas até a conclusão.
              </p>
            </article>

            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Agir
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Gestão de EPI</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Equipamentos de proteção organizados por função e colaborador.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Acompanhar
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Inspeções</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Inspeções registradas e associadas às rotinas de segurança.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Estruturar
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                Empresas, unidades e funções
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Cadastro da estrutura da empresa, funções e GES.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
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
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
              </span>
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Documentar
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Documento do PGR</h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(74, 77, 90)",
                }}
              >
                Geração do documento do programa a partir das informações cadastradas.
              </p>
            </article>

            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(241, 250, 248)",
                border: "1px solid rgb(214, 238, 233)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "11px",
                  background: "rgb(221, 243, 239)",
                  color: "rgb(14, 147, 132)",
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
                  <path d="M12 11v6M9 14h6" />
                </svg>
              </span>
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(11, 122, 110)" }}
              >
                Medicina
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                ASO e exames ocupacionais
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(63, 74, 72)",
                }}
              >
                Registro e organização de ASO e exames dos colaboradores.
              </p>
            </article>
            <article
              className="lift"
              style={{
                borderRadius: "20px",
                background: "rgb(241, 250, 248)",
                border: "1px solid rgb(214, 238, 233)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "11px",
                  background: "rgb(221, 243, 239)",
                  color: "rgb(14, 147, 132)",
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
                  <path d="M6 3v6a4 4 0 0 0 8 0V3" />
                  <path d="M10 13v2a5 5 0 0 0 10 0v-2" />
                  <circle cx="20" cy="11" r="2" />
                </svg>
              </span>
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(11, 122, 110)" }}
              >
                Medicina
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                Profissionais de saúde
              </h3>
              <p
                style={{
                  fontSize: "14.5px",
                  lineHeight: "1.55",
                  color: "rgb(63, 74, 72)",
                }}
              >
                Cadastro dos médicos responsáveis pelos exames.
              </p>
            </article>
            <article
              className="b-wide"
              style={{
                borderRadius: "20px",
                background: "rgb(250, 250, 248)",
                border: "1px dashed rgb(207, 205, 198)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "14px",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: "10px", color: "rgb(106, 109, 121)" }}
              >
                Também na plataforma
              </span>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <li
                  style={{
                    padding: "8px 13px",
                    borderRadius: "10px",
                    background: "rgb(255, 255, 255)",
                    border: "1px solid rgb(228, 226, 221)",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  Ordens de serviço
                </li>
                <li
                  style={{
                    padding: "8px 13px",
                    borderRadius: "10px",
                    background: "rgb(255, 255, 255)",
                    border: "1px solid rgb(228, 226, 221)",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  Registro de incidentes
                </li>
                <li
                  style={{
                    padding: "8px 13px",
                    borderRadius: "10px",
                    background: "rgb(255, 255, 255)",
                    border: "1px solid rgb(228, 226, 221)",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  Monitoramento psicossocial
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>
      <section
        id="como-funciona"
        aria-labelledby="como-title"
        style={{
          padding: "clamp(56px, 7vw, 96px) 0px",
          background: "rgb(250, 250, 248)",
          borderTop: "1px solid rgb(232, 230, 225)",
          borderBottom: "1px solid rgb(232, 230, 225)",
        }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "640px",
              marginBottom: "56px",
            }}
          >
            <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
              Como funciona
            </span>
            <h2
              id="como-title"
              style={{
                fontSize: "clamp(30px, 3.4vw, 44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.03em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              Do cadastro da empresa ao documento do PGR.
            </h2>
          </div>
          <ol
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))",
              gap: "40px 24px",
              margin: "0px",
              padding: "0px",
              listStyle: "none",
            }}
          >
            <li
              style={{
                borderTop: "2px solid rgb(207, 208, 251)",
                paddingTop: "28px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-19px",
                  left: "0px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgb(91, 99, 245)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily:
                    'var(--font-mono), "JetBrains Mono", ui-monospace, Menlo, monospace',
                  fontWeight: "600",
                  fontSize: "12.5px",
                  boxShadow: "rgb(250, 250, 248) 0px 0px 0px 6px",
                }}
              >
                01
              </span>
              <h3
                style={{ fontSize: "19px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Estruture a empresa
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Cadastre empresas, unidades, funções e GES.
              </p>
            </li>
            <li
              style={{
                borderTop: "2px solid rgb(207, 208, 251)",
                paddingTop: "28px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-19px",
                  left: "0px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgb(91, 99, 245)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily:
                    'var(--font-mono), "JetBrains Mono", ui-monospace, Menlo, monospace',
                  fontWeight: "600",
                  fontSize: "12.5px",
                  boxShadow: "rgb(250, 250, 248) 0px 0px 0px 6px",
                }}
              >
                02
              </span>
              <h3
                style={{ fontSize: "19px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Mapeie os riscos
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Registre os riscos ocupacionais no inventário e avalie cada um.
              </p>
            </li>
            <li
              style={{
                borderTop: "2px solid rgb(207, 208, 251)",
                paddingTop: "28px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-19px",
                  left: "0px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgb(91, 99, 245)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily:
                    'var(--font-mono), "JetBrains Mono", ui-monospace, Menlo, monospace',
                  fontWeight: "600",
                  fontSize: "12.5px",
                  boxShadow: "rgb(250, 250, 248) 0px 0px 0px 6px",
                }}
              >
                03
              </span>
              <h3
                style={{ fontSize: "19px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Defina as ações
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Associe medidas de controle e organize os planos de ação.
              </p>
            </li>
            <li
              style={{
                borderTop: "2px solid rgb(207, 208, 251)",
                paddingTop: "28px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-19px",
                  left: "0px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgb(22, 23, 29)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily:
                    'var(--font-mono), "JetBrains Mono", ui-monospace, Menlo, monospace',
                  fontWeight: "600",
                  fontSize: "12.5px",
                  boxShadow: "rgb(250, 250, 248) 0px 0px 0px 6px",
                }}
              >
                04
              </span>
              <h3
                style={{ fontSize: "19px", fontWeight: "800", letterSpacing: "-0.01em" }}
              >
                Acompanhe e documente
              </h3>
              <p
                style={{ color: "rgb(74, 77, 90)", fontSize: "15px", lineHeight: "1.6" }}
              >
                Acompanhe a execução das ações e gere o documento do PGR.
              </p>
            </li>
          </ol>
        </div>
      </section>
      <section
        aria-labelledby="cta-title"
        style={{ padding: "clamp(56px, 7vw, 96px) 0px" }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "28px",
              background:
                "radial-gradient(rgba(255, 255, 255, 0.16) 1px, rgba(0, 0, 0, 0) 1.2px) 0% 0% / 20px 20px rgb(79, 87, 238)",
              padding: "clamp(36px, 5vw, 64px)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "32px",
              color: "rgb(255, 255, 255)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxWidth: "640px",
              }}
            >
              <span className="mono" style={{ color: "rgb(218, 220, 254)" }}>
                Próximo passo
              </span>
              <h2
                id="cta-title"
                style={{
                  fontSize: "clamp(28px, 3.4vw, 44px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Leve a gestão de saúde e segurança da sua empresa para um só lugar.
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: "1.6",
                  color: "rgb(238, 239, 255)",
                }}
              >
                Conte para nós qual área interessa à sua empresa e prepararemos uma
                proposta.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link className="btn btn-light" href="/orcamento">
                Solicitar orçamento
              </Link>
              <Link className="btn btn-outline-light" href="/sign-in">
                Entrar na plataforma
              </Link>
            </div>
          </div>
        </div>
      </section>
      <PortalFaq />
    </>
  );
}
