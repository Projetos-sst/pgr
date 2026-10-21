/** Shared numeric/alphanumeric CNPJ rules. RFB manual: ASCII - 48, modulo 11. */
export function normalizeCnpj(value: string): string {
  return value
    .trim()
    .replace(/[a-z]/g, (char) => char.toUpperCase())
    .replace(/[.\/\-\s]/g, "");
}

/** Input is unmasked; the final two positions are always numeric. */
export function isValidCnpjChecksum(value: string): boolean {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (base: string) => {
    let weight = base.length - 7;
    let sum = 0;
    for (const char of base) {
      sum += (char.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const base = value.slice(0, 12);
  const first = digit(base);
  return value === `${base}${first}${digit(base + first)}`;
}

export function isValidCnpj(value: string): boolean {
  return isValidCnpjChecksum(normalizeCnpj(value));
}
