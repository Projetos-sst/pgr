/*
 * Helpers puros do AvatarBadge (sem JSX) — isolados para teste unitário direto.
 * A cor do avatar varia por nome de forma determinística, dando identidade às
 * linhas das listas (mockups de Empresas/Funcionários) com contraste no tema claro.
 */

export const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "rgba(91,99,245,0.12)", fg: "#5b63f5" }, // indigo
  { bg: "rgba(14,159,110,0.14)", fg: "#0e9f6e" }, // green
  { bg: "rgba(245,165,36,0.16)", fg: "#c9820a" }, // amber
  { bg: "rgba(211,58,63,0.12)", fg: "#d33a3f" }, // red
  { bg: "rgba(14,165,233,0.14)", fg: "#0284c7" }, // sky
  { bg: "rgba(168,85,247,0.14)", fg: "#9333ea" }, // violet
];

/** Iniciais (até 2) a partir do nome; "?" quando vazio. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/** Cor determinística do avatar a partir do nome (hash estável → índice). */
export function avatarColor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
