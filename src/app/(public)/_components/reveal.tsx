"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Entrada discreta de seção ao entrar na viewport.
 *
 * Duas regras de segurança no desenho:
 *
 * 1. **Nunca esconde no HTML inicial.** O conteúdo é renderizado visível no
 *    servidor; o estado "escondido" só é aplicado depois da montagem e só para
 *    elementos que estão *abaixo* da dobra. Sem JavaScript — ou se a hidratação
 *    falhar — a página fica inteira legível, sem bloco invisível.
 * 2. **Respeita `prefers-reduced-motion`.** Com a preferência ativa, o
 *    componente não anima nada e nem instala o observer.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Atraso em ms, para escalonar itens de uma mesma grade. */
  delay?: number;
  className?: string;
  /**
   * Elemento renderizado. Dentro de `<ol>`/`<ul>` tem de ser `"li"`: um `<div>`
   * entre a lista e os itens é HTML inválido e faz o leitor de tela perder a
   * contagem de itens.
   */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    // Já visível na primeira pintura: mantém estático (animar aqui causaria
    // piscada em conteúdo que o usuário já está lendo).
    const box = element.getBoundingClientRect();
    if (box.top < window.innerHeight * 0.9) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px -5% 0px", threshold: 0 },
    );
    observer.observe(element);

    /*
     * Rede de segurança: se por qualquer motivo o observer não disparar, o
     * conteúdo aparece sozinho. Conteúdo escondido para sempre é pior do que
     * animação perdida — e esta é a falha que o modo "esconde e espera" sempre
     * arrisca.
     */
    const failsafe = window.setTimeout(() => setState("shown"), 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const motion =
    state === "hidden"
      ? "opacity-0 translate-y-3"
      : state === "shown"
        ? "opacity-100 translate-y-0 transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        : "";

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      /*
       * Sem altura própria por padrão. Quem envolve card de grade passa
       * `className="h-full"` (senão o card não acompanha a altura da linha);
       * em lista vertical o `h-full` seria nocivo — dentro de um `<ol>` com
       * altura definida pelo grid, cada `<li>` viraria 100% da lista inteira.
       */
      className={`${motion} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
