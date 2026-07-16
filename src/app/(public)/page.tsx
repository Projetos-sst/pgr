import Link from "next/link";
import { Show } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 bg-white px-8 py-24 text-center sm:items-start sm:text-left">
        <h1 className="text-foreground max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          SST Manager
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600">
          Plataforma multiempresa de Segurança e Medicina do Trabalho. Acesse com sua
          conta para gerenciar sua organização.
        </p>
        <div className="flex flex-wrap gap-3">
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="btn-primary rounded-pill px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Acessar o painel
            </Link>
          </Show>
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="btn-primary rounded-pill px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="glass-panel text-text-muted rounded-pill hover:text-text px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Criar conta
            </Link>
          </Show>
        </div>
      </main>
    </div>
  );
}
