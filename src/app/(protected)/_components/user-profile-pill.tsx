"use client";

import { useUser, UserButton } from "@clerk/nextjs";

export function UserProfilePill() {
  const { user } = useUser();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia," : hour < 18 ? "Boa tarde," : "Boa noite,";
  const firstName = user?.firstName ?? user?.username ?? "Usuário";

  return (
    <div className="flex h-[40px] items-center gap-[9px] rounded-[30px] border border-white/50 bg-white/34 py-0 pr-3 pl-[5px] saturate-[170%] backdrop-blur-[20px]">
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-[30px] h-[30px] rounded-full shadow-xs",
          },
        }}
      />
      <div className="hidden flex-col leading-[1.1] sm:flex">
        <span className="text-[10px] text-[#9095ad]">{greeting}</span>
        <span className="text-[13px] font-bold text-[#1b1f2e]">{firstName}</span>
      </div>
    </div>
  );
}
