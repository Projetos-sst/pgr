import Link from "next/link";

import { TERMS_LINK_LABEL, TERMS_PATH } from "@/shared/domains/platform/ai-review";

export function AppFooter() {
  return (
    <footer className="flex min-h-[54px] flex-wrap items-center justify-center gap-[18px] border-t border-white/50 bg-white/30 px-5 py-3 text-center text-[12px] text-[#9095ad] saturate-[175%] backdrop-blur-[26px]">
      <span>© {new Date().getFullYear()} — PGR-e · Todos os direitos reservados</span>
      <Link href={TERMS_PATH} className="hover:text-text font-semibold transition-colors">
        {TERMS_LINK_LABEL}
      </Link>
    </footer>
  );
}
