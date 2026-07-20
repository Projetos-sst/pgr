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
        className="glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">
            Promover por e-mail
          </span>
          <input
            name="email"
            type="email"
            required
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Promover
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-green-700">{info}</p> : null}

      {masters.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhum administrador da plataforma.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/50">
          {masters.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-2">
              <div className="flex flex-col">
                <span className="text-text text-sm font-medium">{m.name}</span>
                <span className="text-text-subtle text-xs">{m.email ?? "—"}</span>
              </div>
              <button
                type="button"
                onClick={() => onDemote(m.id)}
                disabled={pending}
                className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
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
