import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cartão de KPI do redesign (promovido de `dashboard/_components/dashboard-widgets.tsx`
 * — classes copiadas sem alteração, o dashboard segue idêntico). Com `href` vira
 * link; sem `href` é um bloco estático (`<div>`), sem o hover que sugeriria clique —
 * cartão sem destino real não finge ser navegável.
 */
export function StatCard({
  label,
  value,
  href,
  eyebrow,
  subtext,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  href?: string;
  eyebrow?: string;
  subtext?: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  if (highlight) {
    const content = (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase">
            {eyebrow ?? label}
          </span>
          {icon ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/20 text-white transition-transform group-hover:scale-105">
              {icon}
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <span className="text-[36px] leading-none font-extrabold tracking-tight text-white">
            {value}
          </span>
          <div className="mt-1.5 text-xs font-semibold text-white/85">
            {subtext ?? label}
          </div>
        </div>
      </>
    );
    return href ? (
      <Link
        href={href}
        className="group hover-lift animate-fade-slide-up relative flex flex-col justify-between rounded-[18px] bg-[#5b63f5] p-[20px] text-white shadow-[0_14px_30px_rgba(91,99,245,0.3)] transition-all"
      >
        {content}
      </Link>
    ) : (
      <div className="animate-fade-slide-up relative flex flex-col justify-between rounded-[18px] bg-[#5b63f5] p-[20px] text-white shadow-[0_14px_30px_rgba(91,99,245,0.3)]">
        {content}
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[#9095ad] uppercase">
          {eyebrow ?? label}
        </span>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#5b63f5]/12 text-[#5b63f5] transition-transform group-hover:scale-105">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <span className="text-[36px] leading-none font-extrabold tracking-tight text-[#1b1f2e]">
          {value}
        </span>
        <div className="mt-1.5 text-xs font-semibold text-[#797e96]">
          {subtext ?? label}
        </div>
      </div>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="glass-card group hover-lift animate-fade-slide-up flex flex-col justify-between p-[20px] transition-all hover:border-[#5b63f5]/40"
    >
      {content}
    </Link>
  ) : (
    <div className="glass-card animate-fade-slide-up flex flex-col justify-between p-[20px]">
      {content}
    </div>
  );
}
