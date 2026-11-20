export function line(label: string, value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}
