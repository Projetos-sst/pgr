export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 bg-white px-8 py-24 text-center sm:items-start sm:text-left">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          SST Manager
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600">
          Plataforma multiempresa de Segurança e Medicina do Trabalho. Acesse com sua
          conta para gerenciar sua organização.
        </p>
        <p className="text-sm text-zinc-500">
          Use os botões &quot;Entrar&quot; ou &quot;Criar conta&quot; no topo da
          página.
        </p>
      </main>
    </div>
  );
}
