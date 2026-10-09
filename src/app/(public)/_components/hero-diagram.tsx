import { Icon } from "./icon";
import type { IconName } from "../_content/platform";

/**
 * Composição visual do hero.
 *
 * Decisão de conteúdo: **nada de dashboard fictício**. Em vez de inventar
 * gráficos e indicadores, a peça mostra a cadeia real do produto — os cadastros
 * que alimentam o risco, o risco que alimenta a medida de controle, a medida que
 * alimenta o PGR — e as cinco classes de risco que a metodologia do sistema
 * usa de verdade (`risk_classification`, em `schema/risk-methodology.ts`). Tudo
 * aqui é verificável no código; nenhum número é simulado.
 */
const CHAIN: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "building",
    title: "Estrutura",
    detail: "Empresa · Unidade · Função · GES",
  },
  {
    icon: "search",
    title: "Risco",
    detail: "Agente · fonte geradora · exposição",
  },
  {
    icon: "layers",
    title: "Controle",
    detail: "Eliminação → coletiva → administrativo → EPI",
  },
  {
    icon: "file-text",
    title: "PGR",
    detail: "Revisão · assinatura · documento",
  },
];

/** As cinco classes da metodologia, da mais branda à mais severa. */
const CLASSES = [
  { label: "Trivial", color: "bg-accent-green/70" },
  { label: "Tolerável", color: "bg-accent-green" },
  { label: "Moderado", color: "bg-accent-amber" },
  { label: "Substancial", color: "bg-accent-amber-strong" },
  { label: "Intolerável", color: "bg-danger" },
];

export function HeroDiagram() {
  return (
    <div className="glass-card relative p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
          Da estrutura ao documento
        </p>
        <span className="bg-primary/10 text-primary-strong rounded-pill px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase">
          PGR
        </span>
      </div>

      <ol className="relative mt-6">
        {/* Trilho vertical ligando os nós: o fluxo é uma cadeia, não uma lista. */}
        <span
          aria-hidden
          className="from-primary/50 via-primary/25 absolute top-5 bottom-5 left-[19px] w-px bg-gradient-to-b to-transparent"
        />
        {CHAIN.map((node, index) => (
          <li key={node.title} className="relative flex gap-4 pb-5 last:pb-0">
            <span className="bg-primary/10 text-primary-strong relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ring-4 ring-white/70">
              <Icon name={node.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="text-text flex items-baseline gap-2 text-sm font-bold">
                {node.title}
                <span className="text-text-subtle font-mono text-[10px] font-semibold">
                  0{index + 1}
                </span>
              </span>
              <span className="text-text-muted mt-0.5 block text-xs leading-5">
                {node.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-white/60 pt-5">
        <p className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
          Classificação de risco
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CLASSES.map((item) => (
            <span
              key={item.label}
              className="rounded-pill flex items-center gap-1.5 border border-white/70 bg-white/70 py-1 pr-2.5 pl-1.5 text-[11px] font-semibold"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
        <p className="text-text-muted mt-3 text-xs leading-5">
          Cada classe carrega a sua orientação de ação — até a interrupção da atividade no
          nível intolerável.
        </p>
      </div>
    </div>
  );
}
