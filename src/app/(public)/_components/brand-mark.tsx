import Link from "next/link";

import { BRAND } from "../_content/platform";

/**
 * Marca da plataforma. Reaproveita o selo que o `AuthFrame` já usava nas telas
 * de autenticação (quadrado arredondado com a inicial + wordmark), agora como
 * componente único para landing, páginas das vertentes e login não divergirem.
 *
 * `tone="dark"` é para fundo claro; `tone="light"` para fundo em gradiente.
 */
export function BrandMark({
  tone = "dark",
  href = "/",
  size = "md",
}: {
  tone?: "dark" | "light";
  href?: string | null;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : "h-[38px] w-[38px] text-base";
  const word = size === "sm" ? "text-base" : "text-lg";

  const content = (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={
          tone === "light"
            ? `${box} flex shrink-0 items-center justify-center rounded-[12px] border border-white/35 bg-white/20 font-extrabold backdrop-blur`
            : `${box} bg-primary shadow-primary flex shrink-0 items-center justify-center rounded-[12px] font-extrabold text-white`
        }
      >
        P
      </span>
      <span
        className={`${word} font-extrabold tracking-tight ${tone === "light" ? "" : "text-text"}`}
      >
        {BRAND.name}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="focus-visible:ring-primary rounded-[14px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${BRAND.name} — página inicial`}
    >
      {content}
    </Link>
  );
}
