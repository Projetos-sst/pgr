import Link from "next/link";

export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Você precisa estar autenticado
      </h1>
      <p className="max-w-md text-base text-zinc-600">
        Faça login para acessar esta página.
      </p>
      <Link
        href="/sign-in"
        className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium transition-colors hover:bg-[#383838]"
      >
        Entrar
      </Link>
    </main>
  );
}
