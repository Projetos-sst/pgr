import type { Metadata } from "next";
import Link from "next/link";

import { QuoteForm } from "../../_portal/quote-form";

/**
 * Solicitar orçamento — porte fiel da prancha aprovada, com o formulário ligado
 * ao backend real criado na PR #97 (tabela `platform_leads`, INSERT sem SELECT).
 *
 * O `<main>` do design vira `<div>` porque o `<main>` já é do layout do portal.
 * A página é dinâmica: lê `?interesse=` para pré-selecionar a área, como os
 * CTAs das vertentes esperam.
 */
export const metadata: Metadata = {
  title: "Solicitar orçamento — PGR-e",
  description:
    "Preencha os dados e nossa equipe retorna com uma proposta para a área de interesse.",
  alternates: { canonical: "/orcamento" },
  robots: { index: false, follow: true },
};

export default async function Orcamento({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const interesse = typeof params.interesse === "string" ? params.interesse : null;

  return (
    <>
      <div
        style={{
          maxWidth: "1240px",
          margin: "0px auto",
          padding: "28px 24px clamp(56px, 7vw, 96px)",
        }}
      >
        <nav
          aria-label="Trilha de navegação"
          style={{ marginBottom: "clamp(24px, 4vw, 48px)" }}
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
              Solicitar orçamento
            </li>
          </ol>
        </nav>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "40px 64px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: "1 1 340px",
              display: "flex",
              flexDirection: "column",
              gap: "28px",
              minWidth: "0px",
              maxWidth: "460px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
                Solicitar orçamento
              </span>
              <h1
                style={{
                  fontSize: "clamp(34px, 4vw, 52px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.04em",
                  fontWeight: "800",
                  textWrap: "balance",
                }}
              >
                Conte o que sua empresa precisa.
              </h1>
              <p
                style={{ fontSize: "17px", lineHeight: "1.6", color: "rgb(74, 77, 90)" }}
              >
                Preencha os dados e nossa equipe retorna com uma proposta para a área de
                interesse.
              </p>
            </div>
            <ol
              style={{
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
                  gap: "16px",
                  padding: "16px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  className="mono"
                  style={{ color: "rgb(91, 99, 245)", paddingTop: "3px" }}
                >
                  01
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "800", fontSize: "16px" }}>
                    Envie a solicitação
                  </span>
                  <span style={{ fontSize: "14.5px", color: "rgb(74, 77, 90)" }}>
                    Leva cerca de um minuto.
                  </span>
                </span>
              </li>
              <li
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "16px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  className="mono"
                  style={{ color: "rgb(91, 99, 245)", paddingTop: "3px" }}
                >
                  02
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "800", fontSize: "16px" }}>
                    Entendemos sua necessidade
                  </span>
                  <span style={{ fontSize: "14.5px", color: "rgb(74, 77, 90)" }}>
                    Analisamos a área de interesse informada.
                  </span>
                </span>
              </li>
              <li
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "16px 0px",
                  borderBottom: "1px solid rgb(225, 223, 218)",
                }}
              >
                <span
                  className="mono"
                  style={{ color: "rgb(91, 99, 245)", paddingTop: "3px" }}
                >
                  03
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "800", fontSize: "16px" }}>
                    Retornamos com a proposta
                  </span>
                  <span style={{ fontSize: "14.5px", color: "rgb(74, 77, 90)" }}>
                    Pelo e-mail ou telefone informado.
                  </span>
                </span>
              </li>
            </ol>
            <div
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
                padding: "18px",
                borderRadius: "16px",
                background: "rgb(250, 250, 248)",
                border: "1px solid rgb(228, 226, 221)",
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgb(238, 239, 254)",
                  color: "rgb(91, 99, 245)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <p
                style={{ fontSize: "14px", lineHeight: "1.6", color: "rgb(74, 77, 90)" }}
              >
                Pedimos apenas dados de contato.{" "}
                <strong style={{ color: "rgb(22, 23, 29)" }}>
                  Não solicitamos informações de saúde
                </strong>{" "}
                neste formulário.
              </p>
            </div>
            <p style={{ fontSize: "14.5px", color: "rgb(86, 89, 102)" }}>
              Já utiliza a plataforma?{" "}
              <Link href="/sign-in" style={{ fontWeight: "700" }}>
                Entrar
              </Link>
            </p>
          </div>

          <div
            style={{
              flex: "1.35 1 520px",
              minWidth: "0px",
              background: "rgb(255, 255, 255)",
              border: "1px solid rgb(228, 226, 221)",
              borderRadius: "24px",
              boxShadow: "rgba(30, 32, 70, 0.45) 0px 30px 60px -44px",
              padding: "clamp(22px, 4vw, 40px)",
            }}
          >
            <QuoteForm interesseInicial={interesse} />
          </div>
        </div>
      </div>
    </>
  );
}
