import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

export type CatalogErrorReason =
  | "not_found"
  | "already_published"
  | "not_published"
  | "already_deactivated"
  | "fictitious_not_allowed"
  | "item_not_found";

const CATALOG_ERROR_MESSAGES: Record<CatalogErrorReason, string> = {
  not_found: "Versão de oferta não encontrada.",
  already_published: "Esta versão já foi publicada.",
  not_published: "Só uma versão publicada pode ser desativada.",
  already_deactivated: "Esta versão já foi desativada.",
  fictitious_not_allowed:
    "O catálogo fictício só pode ser semeado com APP_ENV definido e diferente de production.",
  item_not_found: "Item não encontrado nesta versão de oferta.",
};

export class CommercialCatalogError extends Error {
  constructor(readonly reason: CatalogErrorReason) {
    super(CATALOG_ERROR_MESSAGES[reason]);
    this.name = "CommercialCatalogError";
  }
}

export const deactivationReasonSchema = z.string().trim().min(3).max(1000);
export const catalogOperatorSchema = z.string().trim().min(2).max(200);
export const providerPriceIdSchema = z
  .string()
  .trim()
  .regex(/^price_[A-Za-z0-9]{6,200}$/, "Informe o id do preço no provedor (price_...).");
const itemPositionSchema = z.coerce.number().int().positive().max(20);

export type CatalogCommand =
  | { kind: "seed-fictitious" }
  | { kind: "list" }
  | { kind: "create"; file: string }
  | { kind: "publish"; id: string }
  | { kind: "deactivate"; id: string; reason: string }
  | { kind: "map-price"; id: string; position: number; providerPriceId: string };

const versionIdSchema = requiredUuid("Informe o id da versão.");
const isVersionId = (value: string) => versionIdSchema.safeParse(value).success;

const COMMAND_PARSERS: Record<
  CatalogCommand["kind"],
  (args: string[]) => CatalogCommand | null
> = {
  "seed-fictitious": (args) => (args.length === 0 ? { kind: "seed-fictitious" } : null),
  list: (args) => (args.length === 0 ? { kind: "list" } : null),
  create: (args) => (args.length === 1 ? { kind: "create", file: args[0] } : null),
  publish: (args) =>
    args.length === 1 && isVersionId(args[0]) ? { kind: "publish", id: args[0] } : null,
  deactivate: ([id = "", ...words]) => {
    const reason = deactivationReasonSchema.safeParse(words.join(" "));
    return isVersionId(id) && reason.success
      ? { kind: "deactivate", id, reason: reason.data }
      : null;
  },
  "map-price": ([id = "", position, priceId, ...rest]) => {
    const item = itemPositionSchema.safeParse(position);
    const price = providerPriceIdSchema.safeParse(priceId);
    return rest.length === 0 && isVersionId(id) && item.success && price.success
      ? { kind: "map-price", id, position: item.data, providerPriceId: price.data }
      : null;
  },
};

export function parseCatalogCommand(argv: readonly string[]): CatalogCommand | null {
  const [name, ...args] = argv;
  const parser = Object.entries(COMMAND_PARSERS).find(([kind]) => kind === name)?.[1];
  return parser ? parser(args) : null;
}

export const CATALOG_COMMAND_USAGE = [
  "seed-fictitious",
  "list",
  "create <arquivo.json>",
  "publish <id-da-versao>",
  "deactivate <id-da-versao> <motivo>",
  "map-price <id-da-versao> <posicao-do-item> <id-do-preco-no-provedor>",
];
