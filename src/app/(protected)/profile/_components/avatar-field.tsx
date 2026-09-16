"use client";

import { useUser } from "@clerk/nextjs";
import { useRef, useState, type ChangeEvent } from "react";

/*
 * "Alterar foto" (#186) — a identidade do usuário é do **Clerk**, então a foto é
 * gravada pelo mecanismo oficial (`user.setProfileImage`). NÃO existe coluna de
 * avatar nem bucket próprio: uma única fonte de verdade, sem duplicar perfil.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function AvatarField() {
  const { user, isLoaded } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reescolher o mesmo arquivo
    if (!file || !user) return;

    if (!ACCEPTED.includes(file.type)) {
      setError("Formato não suportado. Use PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Imagem muito grande (máximo 5 MB).");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
    } catch {
      setError("Não foi possível atualizar a foto. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  const initial = (user?.firstName ?? user?.username ?? "U").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      {isLoaded && user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem do CDN do Clerk (host externo), fora do loader do next/image
        <img
          src={user.imageUrl}
          alt="Foto do perfil"
          className="size-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-primary flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white"
        >
          {initial}
        </span>
      )}

      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={!isLoaded || pending}
          onClick={() => inputRef.current?.click()}
          className="glass-input text-text-muted hover:text-text w-fit rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Alterar foto"}
        </button>
        <span className="text-text-subtle text-[11px]">
          PNG, JPEG ou WebP · até 5 MB · gerenciada pela sua conta (Clerk)
        </span>
        {error ? (
          <span className="text-danger text-[11px] font-semibold">{error}</span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={onPick}
        className="hidden"
        aria-label="Selecionar nova foto de perfil"
      />
    </div>
  );
}
