import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

import { getSessionOrNull } from "@/lib/auth/get-session";

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
    redirect(`/sign-out?redirect_url=/sign-up?__clerk_ticket=${encodeURIComponent(ticket)}`);
  }
  if (session?.isAuthenticated && !ticket) {
    redirect("/dashboard");
  }

  if (!ticket) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cadastro por convite
        </h1>
        <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
          O SST Manager é um sistema corporativo. Novas contas só podem ser
          criadas a partir de um convite enviado por um administrador da sua
          organização.
        </p>
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Procure no seu e-mail por uma mensagem com o link de convite, ou
          solicite um a quem administra sua organização.
        </p>
        <Link
          href="/sign-in"
          className="rounded-full border border-black/[0.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/[0.15] dark:hover:bg-white/[0.06]"
        >
          Já tenho uma conta — Entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <SignUp path="/sign-up" />
    </main>
  );
}
