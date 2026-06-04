import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Você não tem permissão</h1>
      <p className="max-w-md text-base text-zinc-600">
        Esta operação não está disponível para a organização ativa.
      </p>
      <Link
        href="/dashboard"
        className="rounded-full border border-black/8 px-5 py-2 text-sm font-medium transition-colors hover:bg-black/4"
      >
        Voltar ao painel
      </Link>
    </main>
  );
}
