import type { Metadata } from "next";
import Link from "next/link";

/**
 * Medicina do Trabalho — porte fiel da prancha aprovada.
 *
 * Conferência de honestidade feita antes do porte: "ASO e exames ocupacionais"
 * e "Profissionais de saúde" existem de verdade (`health_exams`, `medicos`);
 * PCMSO, CAT, clínicas parceiras, solicitação de exames e absenteísmo aparecem
 * como planejados, que é o estado real. O design é conservador no caso do CAT
 * (há campos internos em incidentes, sem evento do eSocial) — e subdeclarar é
 * seguro. Nenhum texto precisou de correção.
 */
export const metadata: Metadata = {
  title: "Medicina do Trabalho — PGR-e",
  description:
    "Reúna ASO, exames ocupacionais e profissionais de saúde na mesma plataforma em que sua equipe gerencia o PGR.",
  alternates: { canonical: "/medicina-do-trabalho" },
  openGraph: {
    title: "Medicina do Trabalho — PGR-e",
    description:
      "Saúde ocupacional organizada, ao lado da segurança. Área em expansão, com o que já está disponível sinalizado.",
    url: "/medicina-do-trabalho",
    type: "website",
  },
};

export default function MedicinaDoTrabalho() {
  return (
    // `pg-medicina` ativa as variacoes teal de hover que a prancha define
    // so para esta area (ver o escopo em `_portal/portal.css`).
    <div className="pg-medicina">
      <section
        aria-labelledby="hero-title"
        style={{
          background:
            "radial-gradient(1000px 480px at 82% -10%, rgba(20, 184, 166, 0.12), rgba(20, 184, 166, 0) 70%), radial-gradient(700px 400px at 0% 0%, rgba(91, 99, 245, 0.06), rgba(91, 99, 245, 0) 70%)",
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
                Medicina do Trabalho
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
                  flexWrap: "wrap",
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
                    background: "rgb(14, 147, 132)",
                    color: "rgb(255, 255, 255)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "rgba(14, 147, 132, 0.8) 0px 10px 20px -10px",
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
                    <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5.2 8.8 11.4 8.8 11.4s8.8-6.2 8.8-11.4z" />
                    <path d="M3.5 12h4l2-3 3 6 2-3h6" />
                  </svg>
                </span>
                <span className="mono" style={{ color: "rgb(11, 122, 110)" }}>
                  Medicina do Trabalho
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgb(255, 255, 255)",
                    border: "1px solid rgb(203, 233, 227)",
                    color: "rgb(11, 122, 110)",
                  }}
                >
                  Área em expansão
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
                Saúde ocupacional organizada,{" "}
                <span style={{ color: "rgb(11, 122, 110)" }}>ao lado da segurança.</span>
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
                Reúna ASO, exames ocupacionais e profissionais de saúde na mesma
                plataforma em que sua equipe gerencia o PGR.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <Link className="btn btn-primary" href="/orcamento">
                  Solicitar orçamento
                </Link>
                <a className="btn btn-secondary" href="#disponivel">
                  Ver o que já está disponível
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
              aria-label="Ilustração conceitual de um registro de exame ocupacional e do cadastro de um profissional de saúde"
              style={{
                position: "relative",
                borderRadius: "28px",
                backgroundColor: "rgb(228, 243, 240)",
                backgroundImage:
                  "radial-gradient(rgba(14, 147, 132, 0.2) 1px, rgba(0, 0, 0, 0) 1.2px)",
                backgroundSize: "18px 18px",
                border: "1px solid rgb(207, 233, 227)",
                padding: "clamp(20px, 3vw, 36px)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                minWidth: "0px",
              }}
            >
              <div
                style={{
                  background: "rgb(255, 255, 255)",
                  border: "1px solid rgb(220, 239, 235)",
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: "rgba(15, 90, 80, 0.5) 0px 30px 60px -36px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span
                      className="mono"
                      style={{ fontSize: "9.5px", color: "rgb(11, 122, 110)" }}
                    >
                      ASO · ilustração
                    </span>
                    <span
                      style={{
                        fontWeight: "800",
                        fontSize: "19px",
                        letterSpacing: "-0.015em",
                      }}
                    >
                      Atestado de Saúde Ocupacional
                    </span>
                  </div>
                  <span
                    style={{
                      flex: "0 0 auto",
                      width: "40px",
                      height: "40px",
                      borderRadius: "11px",
                      background: "rgb(227, 246, 242)",
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
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      borderRadius: "9px",
                      background: "rgb(244, 243, 240)",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Admissional
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      borderRadius: "9px",
                      background: "rgb(14, 147, 132)",
                      color: "rgb(255, 255, 255)",
                    }}
                  >
                    Periódico
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      borderRadius: "9px",
                      background: "rgb(244, 243, 240)",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Retorno ao trabalho
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      borderRadius: "9px",
                      background: "rgb(244, 243, 240)",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Mudança de risco
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      borderRadius: "9px",
                      background: "rgb(244, 243, 240)",
                      color: "rgb(74, 77, 90)",
                    }}
                  >
                    Demissional
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "rgb(86, 89, 102)",
                        fontWeight: "600",
                      }}
                    >
                      Colaborador
                    </span>
                    <span
                      style={{
                        height: "10px",
                        borderRadius: "9px",
                        background: "rgb(236, 236, 239)",
                        width: "86%",
                      }}
                    ></span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "rgb(86, 89, 102)",
                        fontWeight: "600",
                      }}
                    >
                      Função
                    </span>
                    <span
                      style={{
                        height: "10px",
                        borderRadius: "9px",
                        background: "rgb(236, 236, 239)",
                        width: "64%",
                      }}
                    ></span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "rgb(86, 89, 102)",
                        fontWeight: "600",
                      }}
                    >
                      Empresa
                    </span>
                    <span
                      style={{
                        height: "10px",
                        borderRadius: "9px",
                        background: "rgb(236, 236, 239)",
                        width: "72%",
                      }}
                    ></span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "rgb(86, 89, 102)",
                        fontWeight: "600",
                      }}
                    >
                      Data do exame
                    </span>
                    <span
                      style={{
                        height: "10px",
                        borderRadius: "9px",
                        background: "rgb(236, 236, 239)",
                        width: "48%",
                      }}
                    ></span>
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "flex-end",
                  width: "min(330px, 100%)",
                  background: "rgb(255, 255, 255)",
                  border: "1px solid rgb(220, 239, 235)",
                  borderRadius: "18px",
                  padding: "16px 18px",
                  boxShadow: "rgba(15, 90, 80, 0.5) 0px 24px 44px -30px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "rgb(227, 246, 242)",
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                    flex: "1 1 0%",
                    minWidth: "0px",
                  }}
                >
                  <span style={{ fontWeight: "700", fontSize: "13.5px" }}>
                    Profissional de saúde
                  </span>
                  <span
                    style={{
                      height: "8px",
                      borderRadius: "9px",
                      background: "rgb(236, 236, 239)",
                      width: "70%",
                    }}
                  ></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        id="disponivel"
        aria-labelledby="disp-title"
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
              <span className="mono" style={{ color: "rgb(11, 122, 110)" }}>
                Disponível hoje
              </span>
              <h2
                id="disp-title"
                style={{
                  fontSize: "clamp(30px, 3.4vw, 44px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                O que a Medicina do Trabalho já oferece.
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
              Recursos em uso na plataforma, com a mesma interface da área de Segurança.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))",
              gap: "20px",
            }}
          >
            <article
              className="lift"
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                padding: "clamp(24px, 3vw, 36px)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <span
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "rgb(227, 246, 242)",
                    color: "rgb(14, 147, 132)",
                    display: "grid",
                    placeItems: "center",
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
                    <rect x="5" y="4" width="14" height="17" rx="2" />
                    <path d="M9 4h6v3H9z" />
                    <path d="M12 11v6M9 14h6" />
                  </svg>
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
                    borderRadius: "999px",
                    background: "rgb(221, 245, 236)",
                    color: "rgb(15, 122, 85)",
                  }}
                >
                  Disponível
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    letterSpacing: "-0.02em",
                  }}
                >
                  ASO e exames ocupacionais
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "rgb(74, 77, 90)",
                  }}
                >
                  Registro e organização dos Atestados de Saúde Ocupacional e dos exames
                  dos colaboradores.
                </p>
              </div>
              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingTop: "18px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <li
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E9384"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  ASO organizados por colaborador
                </li>
                <li
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E9384"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  Exames ocupacionais registrados na plataforma
                </li>
                <li
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E9384"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  Consulta centralizada, junto aos dados da empresa
                </li>
              </ul>
            </article>
            <article
              className="lift"
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(228, 226, 221)",
                borderRadius: "24px",
                padding: "clamp(24px, 3vw, 36px)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <span
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "rgb(227, 246, 242)",
                    color: "rgb(14, 147, 132)",
                    display: "grid",
                    placeItems: "center",
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
                    <path d="M6 3v6a4 4 0 0 0 8 0V3" />
                    <path d="M10 13v2a5 5 0 0 0 10 0v-2" />
                    <circle cx="20" cy="11" r="2" />
                  </svg>
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
                    borderRadius: "999px",
                    background: "rgb(221, 245, 236)",
                    color: "rgb(15, 122, 85)",
                  }}
                >
                  Disponível
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Profissionais de saúde
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "rgb(74, 77, 90)",
                  }}
                >
                  Cadastro dos médicos responsáveis pelos exames ocupacionais.
                </p>
              </div>
              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingTop: "18px",
                  borderTop: "1px solid rgb(238, 236, 231)",
                }}
              >
                <li
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E9384"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  Cadastro de médicos
                </li>
                <li
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "15px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E9384"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: "2px" }}
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  Informações profissionais centralizadas
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="exp-title"
        style={{ padding: "clamp(56px, 7vw, 104px) 0px" }}
      >
        <div style={{ maxWidth: "1240px", margin: "0px auto", padding: "0px 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 72px" }}>
            <div
              style={{
                flex: "1 1 300px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                maxWidth: "400px",
              }}
            >
              <span className="mono" style={{ color: "rgb(11, 122, 110)" }}>
                Em expansão
              </span>
              <h2
                id="exp-title"
                style={{
                  fontSize: "clamp(30px, 3.4vw, 44px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.03em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Próximas etapas da área.
              </h2>
              <p
                style={{
                  color: "rgb(74, 77, 90)",
                  fontSize: "16.5px",
                  lineHeight: "1.65",
                }}
              >
                Estes recursos fazem parte do plano de evolução da Medicina do Trabalho e{" "}
                <strong style={{ color: "rgb(22, 23, 29)" }}>
                  ainda não estão disponíveis
                </strong>
                .
              </p>
            </div>
            <ol
              style={{
                flex: "2 1 560px",
                display: "flex",
                flexDirection: "column",
                margin: "0px",
                padding: "0px",
                listStyle: "none",
                borderTop: "1px solid rgb(225, 223, 218)",
              }}
            >
              <li
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                  padding: "20px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1.5px dashed rgb(158, 216, 207)",
                    color: "rgb(11, 122, 110)",
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
                <div
                  style={{
                    flex: "1 1 0%",
                    minWidth: "0px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: "800" }}>PCMSO</h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "rgb(74, 77, 90)",
                      lineHeight: "1.5",
                    }}
                  >
                    Programa de Controle Médico de Saúde Ocupacional.
                  </p>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
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
                  alignItems: "center",
                  gap: "18px",
                  padding: "20px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1.5px dashed rgb(158, 216, 207)",
                    color: "rgb(11, 122, 110)",
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
                    <path d="M12 3l9 16H3z" />
                    <path d="M12 10v4M12 17v.01" />
                  </svg>
                </span>
                <div
                  style={{
                    flex: "1 1 0%",
                    minWidth: "0px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: "800" }}>CAT</h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "rgb(74, 77, 90)",
                      lineHeight: "1.5",
                    }}
                  >
                    Comunicação de Acidente de Trabalho.
                  </p>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
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
                  alignItems: "center",
                  gap: "18px",
                  padding: "20px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1.5px dashed rgb(158, 216, 207)",
                    color: "rgb(11, 122, 110)",
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
                    <path d="M4 21V7l8-4 8 4v14" />
                    <path d="M12 9v6M9 12h6" />
                    <path d="M3 21h18" />
                  </svg>
                </span>
                <div
                  style={{
                    flex: "1 1 0%",
                    minWidth: "0px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                    Clínicas parceiras
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "rgb(74, 77, 90)",
                      lineHeight: "1.5",
                    }}
                  >
                    Relacionamento com as clínicas que realizam os exames.
                  </p>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
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
                  alignItems: "center",
                  gap: "18px",
                  padding: "20px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1.5px dashed rgb(158, 216, 207)",
                    color: "rgb(11, 122, 110)",
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
                    <path d="M4 12l16-8-6 16-2.5-6.5z" />
                  </svg>
                </span>
                <div
                  style={{
                    flex: "1 1 0%",
                    minWidth: "0px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: "800" }}>
                    Solicitação de exames
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "rgb(74, 77, 90)",
                      lineHeight: "1.5",
                    }}
                  >
                    Pedido de exames ocupacionais pela plataforma.
                  </p>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
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
                  alignItems: "center",
                  gap: "18px",
                  padding: "20px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1.5px dashed rgb(158, 216, 207)",
                    color: "rgb(11, 122, 110)",
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
                    <rect x="4" y="5" width="16" height="16" rx="2" />
                    <path d="M4 10h16M9 3v4M15 3v4" />
                  </svg>
                </span>
                <div
                  style={{
                    flex: "1 1 0%",
                    minWidth: "0px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: "800" }}>Absenteísmo</h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "rgb(74, 77, 90)",
                      lineHeight: "1.5",
                    }}
                  >
                    Acompanhamento de afastamentos e ausências.
                  </p>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "5px 11px",
                    borderRadius: "999px",
                    background: "rgb(237, 237, 240)",
                    color: "rgb(74, 77, 90)",
                  }}
                >
                  Planejado
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="int-title"
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
              maxWidth: "720px",
              marginBottom: "44px",
            }}
          >
            <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
              Uma só plataforma
            </span>
            <h2
              id="int-title"
              style={{
                fontSize: "clamp(30px, 3.4vw, 44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.03em",
                fontWeight: "800",
                textWrap: "balance",
              }}
            >
              Segurança e Medicina, lado a lado.
            </h2>
            <p
              style={{ color: "rgb(74, 77, 90)", fontSize: "16.5px", lineHeight: "1.65" }}
            >
              Hoje as duas áreas compartilham a plataforma e o acesso. A conexão entre os
              riscos mapeados no PGR e o acompanhamento de saúde ocupacional é uma
              evolução prevista.
            </p>
          </div>
          <div className="integ">
            <div
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(220, 221, 251)",
                borderRadius: "22px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <span className="mono" style={{ color: "rgb(62, 68, 201)" }}>
                Segurança do Trabalho
              </span>
              <h3
                style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.015em" }}
              >
                Riscos por função e GES
              </h3>
              <p
                style={{ fontSize: "15px", color: "rgb(74, 77, 90)", lineHeight: "1.6" }}
              >
                Inventário, avaliações e controles organizados no PGR.
              </p>
            </div>
            <div
              className="mid"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                textAlign: "center",
              }}
            >
              <span
                className="line"
                style={{
                  width: "2px",
                  height: "28px",
                  background:
                    "repeating-linear-gradient(rgb(180, 183, 250) 0px, rgb(180, 183, 250) 4px, rgba(0, 0, 0, 0) 4px, rgba(0, 0, 0, 0) 8px)",
                }}
              ></span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: "rgb(22, 23, 29)",
                  color: "rgb(255, 255, 255)",
                }}
              >
                <span style={{ fontWeight: "800", fontSize: "14px" }}>PGR-e</span>
                <span
                  className="mono"
                  style={{
                    fontSize: "9.5px",
                    color: "rgb(201, 202, 214)",
                    letterSpacing: "0.1em",
                  }}
                >
                  Integração prevista
                </span>
              </span>
              <span
                className="line"
                style={{
                  width: "2px",
                  height: "28px",
                  background:
                    "repeating-linear-gradient(rgb(158, 216, 207) 0px, rgb(158, 216, 207) 4px, rgba(0, 0, 0, 0) 4px, rgba(0, 0, 0, 0) 8px)",
                }}
              ></span>
            </div>
            <div
              style={{
                background: "rgb(255, 255, 255)",
                border: "1px solid rgb(207, 233, 227)",
                borderRadius: "22px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <span className="mono" style={{ color: "rgb(11, 122, 110)" }}>
                Medicina do Trabalho
              </span>
              <h3
                style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.015em" }}
              >
                Exames por colaborador
              </h3>
              <p
                style={{ fontSize: "15px", color: "rgb(74, 77, 90)", lineHeight: "1.6" }}
              >
                ASO e exames ocupacionais registrados na mesma plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="cta-title"
        style={{ padding: "clamp(56px, 7vw, 96px) 0px clamp(64px, 8vw, 112px)" }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "0px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            style={{
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgb(94, 234, 212)",
                  }}
                ></span>
                <span className="mono" style={{ color: "rgb(218, 220, 254)" }}>
                  Medicina do Trabalho
                </span>
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
                Quer organizar a saúde ocupacional junto com a segurança?
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: "1.6",
                  color: "rgb(238, 239, 255)",
                }}
              >
                Conte o que sua empresa precisa e acompanhe a evolução da área.
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
            href="/seguranca-do-trabalho"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              padding: "24px 28px",
              borderRadius: "20px",
              background: "rgb(241, 241, 254)",
              border: "1px solid rgb(220, 221, 251)",
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
                  background: "rgb(91, 99, 245)",
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
                  <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span
                  className="mono"
                  style={{ fontSize: "10px", color: "rgb(62, 68, 201)" }}
                >
                  Na mesma plataforma
                </span>
                <span style={{ fontWeight: "800", fontSize: "18px" }}>
                  Conheça a Segurança do Trabalho e o PGR
                </span>
              </span>
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "700",
                color: "rgb(62, 68, 201)",
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
    </div>
  );
}
