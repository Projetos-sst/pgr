import type { ReactNode } from "react";
import Link from "next/link";

import "@/app/(public)/_portal/portal.css";

/**
 * Moldura das telas de autenticação — porte fiel da prancha "Login" aprovada.
 *
 * O protótipo traz uma autenticação **demonstrativa** (botão Google decorativo,
 * campo de e-mail e um `setTimeout` simulando acesso). Nada disso foi copiado:
 * o que entra no cartão é o componente real do Clerk, recebido por `children`.
 * O design contribui com a composição — painel de marca em gradiente à
 * esquerda, cartão branco à direita, rodapé "Solicitar orçamento" e a nota
 * "Autenticação protegida por Clerk".
 *
 * A folha do portal é importada aqui porque estas rotas vivem fora do grupo
 * `(marketing)` e, portanto, não passam pelo layout que a carrega. O wrapper
 * `.pg` continua sendo a fronteira do tema.
 */
export function AuthFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="pg auth">
      <aside
        className="auth-side"
        aria-label="Sobre a plataforma"
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(160deg, rgb(78, 85, 236) 0%, rgb(91, 99, 245) 55%, rgb(107, 114, 246) 100%)",
          color: "rgb(255, 255, 255)",
          padding: "48px clamp(32px, 5vw, 72px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "48px",
          minWidth: "0px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-140px",
            top: "-140px",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.07)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-90px",
            bottom: "-110px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.06)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0px",
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.12) 1px, rgba(0, 0, 0, 0) 1.2px)",
            backgroundSize: "22px 22px",
            opacity: 0.6,
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <Link
            href="/"
            aria-label="PGR-e, voltar ao site"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              color: "rgb(255, 255, 255)",
            }}
          >
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "15px",
              }}
            >
              P
            </span>
            <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>
              PGR-e
            </span>
          </Link>
          <Link className="side-link" href="/">
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
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Voltar ao site
          </Link>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <span className="mono" style={{ color: "rgba(255, 255, 255, 0.82)" }}>
            {eyebrow}
          </span>
          {/*
            `<p>` e nao `<h1>`: o Clerk renderiza o proprio titulo ("Entrar")
            como `h1`, e duas marcacoes de nivel 1 na mesma pagina quebram a
            navegacao por cabecalho. O estilo e identico ao do design — muda
            so a semantica, e o h1 da pagina passa a ser a acao principal.
          */}
          <p
            className="side-title"
            style={{
              fontSize: "clamp(30px, 3.2vw, 42px)",
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              fontWeight: 800,
              textWrap: "balance",
            }}
          >
            Saúde e segurança do trabalho em uma só plataforma.
          </p>
          <ul
            className="feat"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              marginTop: "6px",
            }}
          >
            {[
              {
                t: "Gestão centralizada",
                d: "PGR, EPI, inspeções e planos de ação em um só lugar.",
                icone: <path d="M5 12.5l4.5 4.5L19 7.5" />,
              },
              {
                t: "Informações conectadas",
                d: "Do inventário de riscos ao documento do PGR.",
                icone: (
                  <>
                    <path d="M12 3l9 5-9 5-9-5 9-5z" />
                    <path d="M3 13l9 5 9-5" />
                  </>
                ),
              },
              {
                t: "Segurança e Medicina do Trabalho",
                d: "Duas áreas, o mesmo acesso.",
                icone: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />,
              },
            ].map((item) => (
              <li
                key={item.t}
                style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    width: "32px",
                    height: "32px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.16)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
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
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item.icone}
                  </svg>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={{ fontWeight: 800, fontSize: "15.5px" }}>{item.t}</span>
                  <span
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "rgba(255, 255, 255, 0.84)",
                    }}
                  >
                    {item.d}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="side-foot" style={{ position: "relative" }}>
          <Link className="side-link" href="/orcamento">
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
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
            </svg>
            Precisa de ajuda? Fale conosco
          </Link>
        </div>
      </aside>

      <main
        className="auth-main"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          background:
            "radial-gradient(700px 400px at 70% 10%, rgba(91, 99, 245, 0.07), rgba(91, 99, 245, 0) 70%), rgb(242, 241, 238)",
          minWidth: "0px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minWidth: "0px",
          }}
        >
          <div
            style={{
              background: "rgb(255, 255, 255)",
              border: "1px solid rgb(228, 226, 221)",
              borderRadius: "22px",
              boxShadow:
                "rgba(30, 32, 70, 0.45) 0px 30px 60px -40px, rgba(30, 32, 70, 0.04) 0px 2px 6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "clamp(24px, 5vw, 36px)",
                display: "flex",
                flexDirection: "column",
                gap: "22px",
                minWidth: 0,
              }}
            >
              {title ? (
                <h2
                  style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em" }}
                >
                  {title}
                </h2>
              ) : null}
              {children}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: "14.5px",
              color: "rgb(74, 77, 90)",
            }}
          >
            Ainda não tem acesso?{" "}
            <Link href="/orcamento" style={{ fontWeight: 700 }}>
              Solicitar orçamento
            </Link>
          </div>

          <p
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              fontSize: "12.5px",
              color: "rgb(106, 109, 121)",
              marginTop: "4px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Autenticação protegida por Clerk
          </p>
        </div>
      </main>
    </div>
  );
}
