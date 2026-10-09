import Link from "next/link";

import { BrandMark } from "./brand-mark";
import { SHELL } from "./section";
import { BRAND } from "../_content/platform";

/**
 * Rodapé do portal público.
 *
 * Só links que existem de verdade. Sem endereço, telefone, CNPJ ou perfis de
 * rede social inventados: nada disso está configurado no projeto, e um rodapé
 * com dado fictício é o tipo de detalhe que queima a credibilidade da
 * apresentação comercial.
 */
const COLUMNS = [
  {
    title: "Plataforma",
    links: [
      { href: "/seguranca-do-trabalho", label: "Segurança do Trabalho" },
      { href: "/medicina-do-trabalho", label: "Medicina do Trabalho" },
      { href: "/#recursos", label: "Recursos" },
      { href: "/#como-funciona", label: "Como funciona" },
    ],
  },
  {
    title: "Acesso",
    links: [
      { href: "/sign-in", label: "Entrar" },
      { href: "/sign-up", label: "Criar conta" },
      { href: "/orcamento", label: "Solicitar orçamento" },
      { href: "/#perguntas-frequentes", label: "Perguntas frequentes" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-white/60 bg-white/45">
      <div className={`${SHELL} py-14`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] lg:gap-14">
          <div>
            <BrandMark size="sm" />
            <p className="text-text-muted mt-4 max-w-sm text-sm leading-6">
              {BRAND.description}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-text font-mono text-[11px] tracking-[0.16em] uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-text-muted hover:text-primary-strong focus-visible:ring-primary rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-text-subtle mt-12 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            {BRAND.name} — plataforma de Saúde e Segurança do Trabalho. Sistema em
            evolução contínua.
          </p>
          <p>&copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
