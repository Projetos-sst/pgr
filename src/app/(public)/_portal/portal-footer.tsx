import Link from "next/link";

import { PORTAL_ROUTES } from "./routes";

/**
 * Rodapé do portal público — porte fiel do rodapé da prancha aprovada.
 *
 * Duas divergências intencionais em relação ao HTML, ambas para não publicar
 * informação que não existe (ver `PORTAL-REVIEW.md`):
 *
 * 1. A coluna "Institucional" do design traz um link para
 *    `#politica-de-privacidade` e dois marcadores literais —
 *    `[CONTATO — A DEFINIR]` e `[RAZÃO SOCIAL E CNPJ — A CONFIRMAR]`. Não há
 *    página de privacidade no projeto, e inventar texto jurídico, CNPJ ou
 *    endereço seria pior do que a ausência. A coluna fica de fora até existirem
 *    os dados; o restante do rodapé é idêntico ao aprovado.
 * 2. O ano do copyright é calculado, não fixado em 2026.
 */
export function PortalFooter({
  variante = "completo",
}: {
  variante?: "completo" | "compacto";
}) {
  /*
   * A prancha "Solicitar orçamento" usa um rodapé reduzido — só o copyright —
   * para não competir com o formulário. As demais usam o completo.
   */
  if (variante === "compacto") {
    return (
      <footer
        style={{
          background: "rgb(250, 250, 248)",
          borderTop: "1px solid rgb(228, 226, 221)",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0px auto",
            padding: "24px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            fontSize: "13.5px",
            color: "rgb(86, 89, 102)",
          }}
        >
          <span>© {new Date().getFullYear()} PGR-e. Todos os direitos reservados.</span>
          <Link className="foot-link" href={PORTAL_ROUTES.termos}>
            Termos de uso
          </Link>
        </div>
      </footer>
    );
  }

  const colunas = [
    {
      titulo: "Plataforma",
      itens: [
        { href: PORTAL_ROUTES.seguranca, label: "Segurança do Trabalho" },
        { href: PORTAL_ROUTES.medicina, label: "Medicina do Trabalho" },
        { href: "/#funcionalidades", label: "Funcionalidades" },
      ],
    },
    {
      titulo: "Acesso",
      itens: [
        { href: PORTAL_ROUTES.login, label: "Entrar" },
        { href: PORTAL_ROUTES.orcamento, label: "Solicitar orçamento" },
      ],
    },
  ];

  return (
    <footer
      style={{
        background: "rgb(250, 250, 248)",
        borderTop: "1px solid rgb(228, 226, 221)",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0px auto",
          padding: "56px 24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "320px",
            }}
          >
            <Link
              href={PORTAL_ROUTES.home}
              aria-label="PGR-e, página inicial"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
                color: "rgb(22, 23, 29)",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  background: "rgb(91, 99, 245)",
                  color: "rgb(255, 255, 255)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              >
                P
              </span>
              <span
                style={{ fontWeight: 800, fontSize: "17px", letterSpacing: "-0.02em" }}
              >
                PGR-e
              </span>
            </Link>
            <p style={{ color: "rgb(74, 77, 90)", fontSize: "14.5px", lineHeight: 1.6 }}>
              Plataforma de Saúde e Segurança do Trabalho.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 72px" }}>
            {colunas.map((coluna) => (
              <nav
                key={coluna.titulo}
                aria-label={coluna.titulo}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: "10px",
                    color: "rgb(106, 109, 121)",
                    marginBottom: "8px",
                  }}
                >
                  {coluna.titulo}
                </span>
                {coluna.itens.map((item) => (
                  <Link key={item.href} className="foot-link" href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            paddingTop: "24px",
            borderTop: "1px solid rgb(228, 226, 221)",
            fontSize: "13.5px",
            color: "rgb(86, 89, 102)",
          }}
        >
          <span>© {new Date().getFullYear()} PGR-e. Todos os direitos reservados.</span>
          <Link className="foot-link" href={PORTAL_ROUTES.termos}>
            Termos de uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
