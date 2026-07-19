import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

import { getSessionOrNull } from "@/shared/auth/get-session";
import { AuthFrame } from "@/app/_components/auth-frame";
import { clerkAppearance } from "@/app/_components/clerk-appearance";

type SearchParams = Record<string, string | string[] | undefined>;

const isValidTicket = (raw: unknown): raw is string =>
  typeof raw === "string" && raw.length > 0 && raw.length <= 4096;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawTicket = params["__clerk_ticket"];
  const ticket = isValidTicket(rawTicket) ? rawTicket : null;

  const session = await getSessionOrNull();

  if (session?.isAuthenticated && ticket) {
    redirect(
      `/sign-out?redirect_url=/sign-up?__clerk_ticket=${encodeURIComponent(ticket)}`,
    );
  }
  if (session?.isAuthenticated && !ticket) {
    redirect("/dashboard");
  }

  // Cadastro aberto (Modelo B / spec 005): qualquer visitante pode criar conta —
  // provisiona um tenant pessoal automaticamente (ver `provisionPersonalTenant`).
  // `__clerk_ticket` (convite) continua funcionando: o Clerk detecta o ticket na
  // URL e conduz o fluxo de aceite de convite normalmente dentro do componente.
  return (
    <AuthFrame eyebrow="Plataforma SST">
      <SignUp path="/sign-up" appearance={clerkAppearance} forceRedirectUrl="/welcome" />
    </AuthFrame>
  );
}
