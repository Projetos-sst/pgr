"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function UserProfilePill() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const name = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      "Usuário"
    : "Usuário";
  const initial = name.charAt(0).toUpperCase() || "U";
  const avatarUrl = user?.imageUrl;

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={popoverRef} className="relative">
      {/* Botão de Gatilho Limpo no Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Abrir Menu de Perfil"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/40 shadow-xs saturate-[170%] backdrop-blur-[20px] transition-all duration-200 hover:scale-105 hover:bg-white/60 active:scale-95"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#5b63f5] text-sm font-extrabold text-white shadow-xs">
            {initial}
          </span>
        )}
      </button>

      {/* Popover Compacto & Ultra-Elegante (Estilo SaaS Premium) */}
      {open ? (
        <div className="glass-menu animate-dropdown-pop absolute top-full right-0 z-[150] mt-2 w-[230px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 text-[#1b1f2e] shadow-xl">
          {/* Header Horizontal Compacto */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5b63f5] text-xs font-extrabold text-white shadow-xs">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-extrabold text-[#1b1f2e]">
                {name}
              </span>
              <span className="text-[10px] font-bold tracking-wider text-[#5b63f5] uppercase">
                ADMINISTRADOR
              </span>
            </div>
          </div>

          <div className="my-1 border-t border-slate-100" />

          {/* Lista de Opções Solicitadas */}
          <div className="flex flex-col gap-0.5 text-xs font-semibold text-[#52576e]">
            {/* 1. Perfil */}
            <Link
              href="/profile?tab=profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150 hover:bg-[#5b63f5]/10 hover:text-[#5b63f5]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[#5b63f5]"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Perfil</span>
            </Link>

            {/* 2. Alterar Senha */}
            <Link
              href="/profile?tab=security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150 hover:bg-[#5b63f5]/10 hover:text-[#5b63f5]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[#5b63f5]"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Alterar Senha</span>
            </Link>

            {/* 3. Equipe e Acessos */}
            <Link
              href="/profile?tab=team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150 hover:bg-[#5b63f5]/10 hover:text-[#5b63f5]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[#5b63f5]"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Equipe e Acessos</span>
            </Link>

            <div className="my-1 border-t border-slate-100" />

            {/* 4. Assinatura */}
            <Link
              href="/plans"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150 hover:bg-[#5b63f5]/10 hover:text-[#5b63f5]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-[#5b63f5]"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <span>Assinatura</span>
            </Link>

            {/* 5. Sair */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-red-600 transition-all duration-150 hover:bg-red-50"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
