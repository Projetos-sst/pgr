"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

const CATEGORY_OPTIONS = [
  { value: "", label: "Todas as Categorias" },
  { value: "Programa", label: "Programa" },
  { value: "Laudo", label: "Laudo" },
  { value: "Procedimento", label: "Procedimento" },
  { value: "Relatório", label: "Relatório" },
  { value: "Contrato", label: "Contrato" },
];

export function DocumentFilterBar({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") ?? "";
  const currentDocType = searchParams.get("docType") ?? "";

  const [search, setSearch] = useState(currentSearch);

  function applyFilters(newDocType?: string, newSearch?: string) {
    const params = new URLSearchParams(searchParams.toString());
    const targetDocType = newDocType !== undefined ? newDocType : currentDocType;
    const targetSearch = newSearch !== undefined ? newSearch : search;

    if (targetSearch.trim()) {
      params.set("search", targetSearch.trim());
    } else {
      params.delete("search");
    }

    if (targetDocType) {
      params.set("docType", targetDocType);
    } else {
      params.delete("docType");
    }

    if (folderId) {
      params.set("folderId", folderId);
    }

    params.delete("page");
    const qs = params.toString();
    router.push(`/documents${qs ? `?${qs}` : ""}`);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    applyFilters(currentDocType, search);
  }

  function onCategoryChange(val: string) {
    applyFilters(val, search);
  }

  const newDocHref = folderId ? `/documents/new?folderId=${folderId}` : "/documents/new";

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-b border-black/5 p-4 sm:flex-row sm:items-center sm:px-6 sm:py-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex h-11 flex-1 items-center rounded-xl border border-white/70 bg-white/50 px-4 shadow-xs focus-within:border-[#5b63f5]">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9095ad"
            strokeWidth="1.9"
            className="mr-2.5 shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por documento ou código…"
            className="text-text w-full bg-transparent text-xs font-medium outline-none placeholder:text-[#9095ad] sm:text-sm"
          />
        </div>

        <select
          value={currentDocType}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-11 cursor-pointer rounded-xl border border-white/70 bg-white/50 px-4 text-xs font-semibold text-[#52576e] transition-colors outline-none hover:bg-white/80 sm:text-sm"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </form>

      <Link
        href={newDocHref}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5b63f5] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(91,99,245,0.35)] transition-all hover:bg-[#4f46e5] sm:px-5 sm:text-sm"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Novo Documento
      </Link>
    </div>
  );
}
