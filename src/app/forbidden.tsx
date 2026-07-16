import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-text text-2xl font-semibold tracking-tight">
        Você não tem permissão
      </h1>
      <p className="text-text-muted max-w-md text-base">
        Esta operação não está disponível para a organização ativa.
      </p>
      <Link
        href="/dashboard"
        className="glass-panel text-text-muted rounded-pill hover:text-text px-5 py-2 text-sm font-semibold transition-colors"
      >
        Voltar ao painel
      </Link>
    </main>
  );
}
