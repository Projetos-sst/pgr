/**
 * Rótulo curto e estável exibido nas listagens de inspeção. `inspections` não
 * tem número sequencial, então o valor é derivado do uuid: 6 dígitos hex
 * (~16,7 milhões de combinações) mantêm o formato compacto do design sem que
 * dois registros apareçam com o mesmo "Nº" numa base realista.
 *
 * É só para leitura humana — links, rotas e chamadas usam o uuid completo.
 */
export function inspectionNumber(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
