import {
  CommercialCatalogError,
  parseCatalogCommand,
} from "@/shared/domains/commercial/catalog-admin";

const ID = "44444444-4444-4444-8444-444444444444";

describe("comandos de administração do catálogo", () => {
  it("interpreta semear, listar, criar, publicar e desativar", () => {
    expect(parseCatalogCommand(["seed-fictitious"])).toEqual({ kind: "seed-fictitious" });
    expect(parseCatalogCommand(["list"])).toEqual({ kind: "list" });
    expect(parseCatalogCommand(["create", "oferta.json"])).toEqual({
      kind: "create",
      file: "oferta.json",
    });
    expect(parseCatalogCommand(["publish", ID])).toEqual({ kind: "publish", id: ID });
    expect(
      parseCatalogCommand(["deactivate", ID, "Preço", "publicado", "errado"]),
    ).toEqual({ kind: "deactivate", id: ID, reason: "Preço publicado errado" });
  });

  it("interpreta o mapeamento de preço do provedor e recusa posição ou preço inválidos", () => {
    expect(parseCatalogCommand(["map-price", ID, "2", "price_1AbCdEf"])).toEqual({
      kind: "map-price",
      id: ID,
      position: 2,
      providerPriceId: "price_1AbCdEf",
    });
    expect(parseCatalogCommand(["map-price", ID, "0", "price_1AbCdEf"])).toBeNull();
    expect(parseCatalogCommand(["map-price", ID, "2", "prod_1AbCdEf"])).toBeNull();
    expect(parseCatalogCommand(["map-price", ID, "2"])).toBeNull();
    expect(parseCatalogCommand(["map-price", "abc", "2", "price_1AbCdEf"])).toBeNull();
    expect(parseCatalogCommand(["map-price", ID, "2", "price_1AbCdEf", "x"])).toBeNull();
  });

  it("recusa comando desconhecido, id inválido, argumento sobrando e desativação sem motivo", () => {
    expect(parseCatalogCommand([])).toBeNull();
    expect(parseCatalogCommand(["drop"])).toBeNull();
    expect(parseCatalogCommand(["publish", "abc"])).toBeNull();
    expect(parseCatalogCommand(["publish", ID, "extra"])).toBeNull();
    expect(parseCatalogCommand(["list", "extra"])).toBeNull();
    expect(parseCatalogCommand(["create"])).toBeNull();
    expect(parseCatalogCommand(["deactivate", ID])).toBeNull();
    expect(parseCatalogCommand(["deactivate"])).toBeNull();
  });

  it("o erro do catálogo carrega o motivo e a mensagem em português", () => {
    const error = new CommercialCatalogError("fictitious_not_allowed");
    expect(error.reason).toBe("fictitious_not_allowed");
    expect(error.message).toContain("production");
  });
});
