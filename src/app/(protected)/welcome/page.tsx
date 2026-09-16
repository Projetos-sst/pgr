import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * Boas-vindas (#182) — composição fiel ao mockup `home.dc.html`:
 * hero (eyebrow + título + último acesso) com 2 cards indicadores à direita,
 * faixa informativa, "Ações rápidas" (3 cards) e "Inovações em segurança" (3 cards,
 * o do meio destacado em indigo).
 *
 * Dados: nome e último acesso vêm do Clerk (reais). Os dois indicadores do hero
 * ("Precisão da IA", "Saúde da modelagem") **não têm fonte no produto** — não há
 * telemetria de acurácia do LLM nem score de modelagem em lugar nenhum do schema —
 * então a estrutura visual do card é preservada com estado honesto ("—" / "Sem
 * dados") em vez de número fabricado. Mesmo motivo para os selos percentuais dos
 * cards de inovação, substituídos por descritores factuais das features.
 */
const lastAccessFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const glassCard =
  "rounded-[18px] border border-white/55 bg-white/24 p-[22px] shadow-[0_14px_34px_rgba(50,55,100,0.16),inset_0_1px_1px_rgba(255,255,255,0.85)] saturate-[190%] backdrop-blur-[30px]";

const indicatorCard =
  "flex flex-col justify-between gap-4 rounded-[20px] border border-white/55 bg-white/24 p-[22px] sm:gap-0 shadow-[0_16px_38px_rgba(50,55,100,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] saturate-[190%] backdrop-blur-[32px] lg:w-[236px]";

const eyebrow = "mb-3.5 font-mono text-[11px] tracking-[0.16em] text-[#9095ad] uppercase";

const chip =
  "rounded-[9px] border border-white/60 bg-white/40 px-[11px] py-[7px] text-[11px] font-semibold text-text-muted";

export default async function BoasVindasPage() {
  const user = await currentUser();
  const firstName = user?.firstName?.trim();
  const lastAccess = user?.lastSignInAt
    ? lastAccessFormatter.format(new Date(user.lastSignInAt))
    : null;

  return (
    /* `leading-[normal]` na raiz: o mockup não declara line-height fora dos
       pontos abaixo (h1, números, faixa e descrições), então o default do
       navegador é o que dá as alturas corretas de card. */
    <div className="px-5 pt-[34px] pb-10 leading-[normal] sm:px-[30px]">
      {/* Hero + indicadores */}
      <div className="mb-7 flex flex-col items-stretch gap-6 lg:flex-row lg:justify-between">
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-primary mb-2.5 font-mono text-[11px] tracking-[0.16em] uppercase">
            Boas-vindas
          </div>
          <h1 className="text-text text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] sm:text-[38px]">
            {firstName ? (
              <>
                Bem-vindo de volta,
                <br />
                {firstName}
              </>
            ) : (
              "Bem-vindo de volta"
            )}
          </h1>
          {lastAccess ? (
            <div className="text-text-subtle mt-3 text-[13px]">
              Último acesso · {lastAccess}
            </div>
          ) : null}
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2 lg:flex lg:shrink-0">
          <div className={indicatorCard}>
            <span
              className="bg-primary-ring text-primary flex size-[42px] items-center justify-center rounded-[13px]"
              aria-hidden
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="5" y="8" width="14" height="11" rx="2" />
                <path d="M12 8V5M9 13h.01M15 13h.01" />
              </svg>
            </span>
            <div>
              <div className="text-primary-strong text-[42px] leading-none font-extrabold tracking-[-0.03em]">
                —
              </div>
              <div className="mt-1 text-[12px] font-semibold text-[#797e96]">
                Precisão da IA · sem medição
              </div>
            </div>
          </div>

          <div className={indicatorCard}>
            <div className="flex items-start justify-between gap-2">
              <span
                className="bg-primary-ring text-primary flex size-[42px] items-center justify-center rounded-[13px]"
                aria-hidden
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                >
                  <path d="M3 12h4l3 7 4-14 3 7h4" />
                </svg>
              </span>
              {/* O mockup traz um selo verde "AO VIVO"; sem telemetria real seria
                  uma afirmação falsa, então o selo assume o estado honesto. */}
              <span className="flex items-center gap-[5px] rounded-[20px] bg-white/45 px-[9px] py-1 text-[10px] font-bold tracking-[0.04em] text-[#797e96]">
                <span className="size-1.5 rounded-full bg-[#b4b8ca]" aria-hidden />
                SEM DADOS
              </span>
            </div>
            <div>
              <div className="text-text text-[42px] leading-none font-extrabold tracking-[-0.03em]">
                —
              </div>
              <div className="mt-1 text-[12px] font-semibold text-[#797e96]">
                Saúde da modelagem · sem medição
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa informativa */}
      <div className="mb-[30px] flex items-center gap-4 rounded-[16px] border border-white/50 bg-white/20 px-6 py-[18px] saturate-[175%] backdrop-blur-[26px]">
        <span className="bg-primary h-[38px] w-1 shrink-0 rounded-[4px]" aria-hidden />
        <p className="text-[14px] leading-[1.55] text-[#5a5f78]">
          Você acessou a plataforma para gerenciar riscos ocupacionais de forma prática,
          segura e 100% conforme a legislação — transformando a gestão de segurança do
          trabalho em um processo eficiente.
        </p>
      </div>

      {/* Ações rápidas */}
      <h2 className={eyebrow}>Ações rápidas</h2>
      <div className="mb-[34px] grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`${glassCard} group hover:border-primary/40 flex flex-col gap-3.5 transition-colors`}
          >
            <span
              className={
                action.solid
                  ? "bg-primary flex size-[46px] items-center justify-center rounded-[13px] text-white shadow-[0_6px_16px_rgba(91,99,245,0.4)]"
                  : "bg-primary-ring text-primary flex size-[46px] items-center justify-center rounded-[13px]"
              }
              aria-hidden
            >
              {action.icon}
            </span>
            <span>
              <span className="text-text block text-[16px] font-bold">
                {action.title}
              </span>
              <span className="mt-[3px] block text-[13px] text-[#797e96]">
                {action.hint}
              </span>
            </span>
            <span
              aria-hidden
              className="text-primary mt-auto flex items-center gap-1.5 text-[13px] font-bold"
            >
              Abrir
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Inovações em segurança */}
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <h2 className="font-mono text-[11px] tracking-[0.16em] text-[#9095ad] uppercase">
          Inovações em segurança
        </h2>
        <Link href="/getting-started" className="text-primary text-[12px] font-semibold">
          Ver todas →
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article className={glassCard}>
          <div className="mb-[18px] flex items-start justify-between gap-2">
            <span
              className="bg-primary-ring text-primary flex size-11 items-center justify-center rounded-[13px]"
              aria-hidden
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
                <path d="M14 17h6M17 14v6" />
              </svg>
            </span>
            <span className="bg-primary-ring text-primary rounded-[20px] px-2.5 py-[5px] text-[9px] font-extrabold tracking-[0.08em]">
              NOVIDADE
            </span>
          </div>
          <h3 className="text-text mb-1.5 text-[17px] font-bold">
            Entrega de EPI Digital
          </h3>
          <p className="mb-4 text-[13px] leading-[1.5] text-[#797e96]">
            Registro de entrega com assinatura digital via QR Code e comprovação em tempo
            real.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <span className={chip}>Zero papel</span>
            <span className={chip}>Assinatura por QR Code</span>
          </div>
        </article>

        <article className="bg-primary rounded-[18px] p-[22px] text-white shadow-[0_16px_36px_rgba(91,99,245,0.35)]">
          <div className="mb-[18px] flex items-start justify-between gap-2">
            <span
              className="flex size-11 items-center justify-center rounded-[13px] bg-white/18"
              aria-hidden
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="1.7"
              >
                <rect x="5" y="8" width="14" height="11" rx="2" />
                <path d="M12 8V5M9 13h.01M15 13h.01" />
              </svg>
            </span>
            <span className="text-primary-strong rounded-[20px] bg-white px-2.5 py-[5px] text-[9px] font-extrabold tracking-[0.08em]">
              REVOLUCIONÁRIO
            </span>
          </div>
          <h3 className="mb-1.5 text-[17px] font-bold">Análise Inteligente de Riscos</h3>
          <p className="mb-4 text-[13px] leading-[1.5] text-white/82">
            IA que correlaciona funções laborais com ambientes para identificação proativa
            de riscos.
          </p>
          {/* O mockup mostra uma barra "Precisão 92%"; não existe métrica de acurácia
              coletada, então o espaço recebe descritores factuais da feature. */}
          <div className="flex flex-wrap gap-2.5">
            <span className="rounded-[9px] border border-white/25 bg-white/15 px-[11px] py-[7px] text-[11px] font-semibold text-white">
              Sugestão assistida
            </span>
            <span className="rounded-[9px] border border-white/25 bg-white/15 px-[11px] py-[7px] text-[11px] font-semibold text-white">
              Revisão obrigatória
            </span>
          </div>
        </article>

        <article className={glassCard}>
          <div className="mb-[18px] flex items-start justify-between gap-2">
            <span
              className="bg-primary-ring text-primary flex size-11 items-center justify-center rounded-[13px]"
              aria-hidden
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h4" />
              </svg>
            </span>
            <span className="text-text-muted rounded-[20px] border border-white/60 bg-white/40 px-2.5 py-[5px] text-[9px] font-extrabold tracking-[0.08em]">
              ESSENCIAL
            </span>
          </div>
          <h3 className="text-text mb-1.5 text-[17px] font-bold">
            Gestão de Planos de Ação
          </h3>
          <p className="mb-4 text-[13px] leading-[1.5] text-[#797e96]">
            Controle completo de planos de ação para correção de não conformidades.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <span className={chip}>Prazos e responsáveis</span>
            <span className={chip}>Alertas de vencimento</span>
          </div>
        </article>
      </div>
    </div>
  );
}

/** Atalhos do mockup — todos apontam para rotas reais do produto. */
const QUICK_ACTIONS = [
  {
    href: "/pgr",
    title: "Acessar PGRs",
    hint: "Inicie um novo PGR ou gerencie os existentes",
    solid: true,
    icon: (
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    title: "Dashboard",
    hint: "Acompanhe os indicadores de segurança",
    solid: false,
    icon: (
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M4 19V11M10 19V5M16 19v-6M21 19H3" />
      </svg>
    ),
  },
  {
    href: "/employees",
    title: "Funcionários",
    hint: "Gerencie equipes e emita Ordens de Serviço",
    solid: false,
    icon: (
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
      </svg>
    ),
  },
] as const;
