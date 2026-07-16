"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { MasterUser } from "@/shared/domains/platform/admin";
import {
  demoteMasterAction,
  promoteMasterByEmailAction,
} from "@/shared/server/actions/platform/admin";

export function MasterManager({ masters }: { masters: MasterUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function onPromote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (new FormData(form).get("email") as string) ?? "";
    startTransition(async () => {
      const result = await promoteMasterByEmailAction(email);
      if (result.ok) {
        setError(null);
        setInfo(`${result.data.name} agora é administrador da plataforma.`);
        form.reset();
        router.refresh();
      } else {
        setInfo(null);
        setError(
          result.error.code === "NOT_FOUND"
            ? "Nenhum usuário com esse e-mail."
            : result.error.message,
        );
      }
    });
  }

  function onDemote(userId: string) {
    startTransition(async () => {
      const result = await demoteMasterAction(userId);
      if (result.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onPromote}
        className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-end dark:border-white/10"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Promover por e-mail</span>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Promover
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-green-700 dark:text-green-400">{info}</p> : null}

      {masters.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum administrador da plataforma.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
          {masters.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-zinc-500">{m.email ?? "—"}</span>
              </div>
              <button
                type="button"
                onClick={() => onDemote(m.id)}
                disabled={pending}
                className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
