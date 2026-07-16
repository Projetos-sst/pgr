import Link from "next/link";

export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Você precisa estar autenticado
      </h1>
      <p className="text-text-muted max-w-md text-base">
        Faça login para acessar esta página.
      </p>
      <Link
        href="/sign-in"
        className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors"
      >
        Entrar
      </Link>
    </main>
  );
}
