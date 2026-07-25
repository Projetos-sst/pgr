"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderActions() {
  const pathname = usePathname();

  const isGettingStarted = pathname === "/getting-started";
  const isPendingItems = pathname === "/pending-items";

  return (
    <div className="flex items-center gap-2">
      {/* Ícone de Mapa / Trilha de Sucesso / Tutorial */}
      <Link
        href="/getting-started"
        title="Trilha de Sucesso / Tutorial da Plataforma"
        className={`flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/50 bg-white/34 text-[#52576e] shadow-xs backdrop-blur-[20px] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/60 active:scale-95 ${
          isGettingStarted ? "border-[#5b63f5] bg-[#5b63f5]/10 text-[#5b63f5]" : ""
        }`}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </Link>

      {/* Ícone de Check / Minhas Tarefas / Pendências */}
      <Link
        href="/pending-items"
        title="Minhas Tarefas e Pendências"
        className={`flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/50 bg-white/34 text-[#52576e] shadow-xs backdrop-blur-[20px] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/60 active:scale-95 ${
          isPendingItems ? "border-[#5b63f5] bg-[#5b63f5]/10 text-[#5b63f5]" : ""
        }`}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </Link>
    </div>
  );
}
