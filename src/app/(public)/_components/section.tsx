import type { ReactNode } from "react";

/**
 * Ritmo vertical e largura do portal público. Uma única definição para que
 * landing e páginas das vertentes tenham exatamente o mesmo compasso — o que
 * separa uma página "de produto" de um template montado seção por seção.
 *
 * `px-5` no mobile é o colchão lateral mínimo (nunca encostar o texto na borda);
 * a largura máxima de 1180px fica abaixo do `max-w-[1320px]` das listas
 * autenticadas de propósito: conteúdo editorial lê melhor mais estreito.
 */
export const SHELL = "mx-auto w-full max-w-[1180px] px-5 sm:px-8";

export function Section({
  id,
  children,
  className = "",
  tone = "plain",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "plain" | "panel";
}) {
  return (
    <section
      id={id}
      className={`relative py-16 sm:py-20 lg:py-24 ${
        tone === "panel" ? "border-y border-white/60 bg-white/40" : ""
      } ${className}`}
      /* `scroll-mt` compensa o header fixo quando a navegação usa âncora. */
      style={id ? { scrollMarginTop: "80px" } : undefined}
    >
      <div className={SHELL}>{children}</div>
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "indigo",
}: {
  children: ReactNode;
  tone?: "indigo" | "teal";
}) {
  return (
    <p
      className={`font-mono text-[11px] tracking-[0.16em] uppercase ${
        tone === "teal" ? "text-accent-teal-strong" : "text-primary-strong"
      }`}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  tone = "indigo",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "indigo" | "teal";
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={
        align === "center" ? "mx-auto max-w-[680px] text-center" : "max-w-[720px]"
      }
    >
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <Tag
        className={`text-text mt-3 text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.12] font-extrabold tracking-tight text-balance`}
      >
        {title}
      </Tag>
      {lead ? (
        <p className="text-text-muted mt-4 text-base leading-7 sm:text-[17px]">{lead}</p>
      ) : null}
    </div>
  );
}
