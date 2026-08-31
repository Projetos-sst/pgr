import { AVATAR_PALETTE, avatarColor, initialsOf } from "../avatar-color";

describe("initialsOf", () => {
  it("usa as duas primeiras palavras", () => {
    expect(initialsOf("Construtora Alfa Beta")).toBe("CA");
  });
  it("usa uma única inicial quando há um nome só", () => {
    expect(initialsOf("Solda")).toBe("S");
  });
  it("colapsa espaços múltiplos e normaliza caixa", () => {
    expect(initialsOf("  joão   silva ")).toBe("JS");
  });
  it("devolve '?' para string vazia", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("é determinística (mesmo nome → mesma cor)", () => {
    expect(avatarColor("Construtora Alfa")).toEqual(avatarColor("Construtora Alfa"));
  });
  it("sempre devolve uma cor da paleta", () => {
    for (const name of ["Alfa", "Beta", "Gama", "Delta", "Epsilon", "Zeta", ""]) {
      expect(AVATAR_PALETTE).toContainEqual(avatarColor(name));
    }
  });
  it("distribui nomes diferentes por mais de uma cor", () => {
    const names = ["Alfa", "Beta", "Gama", "Delta", "Epsilon", "Omega", "Sigma", "Theta"];
    const distinct = new Set(names.map((n) => avatarColor(n).fg));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
