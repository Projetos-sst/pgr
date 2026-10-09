import { FAQ } from "../_content/platform";

/**
 * Accordion de perguntas frequentes em `<details>`/`<summary>` nativos.
 *
 * Escolha deliberada: o elemento nativo já é acessível (expansível por teclado,
 * anunciado como botão de expansão pelos leitores de tela, com `aria-expanded`
 * gerenciado pelo navegador) e **funciona sem JavaScript**. Um accordion
 * reimplementado em Client Component aqui seria mais código, mais hidratação e
 * menos acessível.
 *
 * `name` igual em todos faz o comportamento de acordeão exclusivo (abrir um
 * fecha o outro) no navegador, sem estado em JS.
 */
export function FaqAccordion() {
  return (
    <div className="divide-y divide-black/5 overflow-hidden rounded-[18px] border border-white/70 bg-white/60">
      {FAQ.map((item) => (
        <details key={item.q} name="faq" className="group">
          <summary className="focus-visible:ring-primary flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset">
            <h3 className="text-text text-[15px] font-bold">{item.q}</h3>
            <span
              aria-hidden
              className="bg-primary/10 text-primary-strong mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <p className="text-text-muted px-6 pb-6 text-sm leading-7">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
