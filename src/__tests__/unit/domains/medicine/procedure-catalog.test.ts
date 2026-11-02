/**
 * Catálogo de procedimentos = Tabela 27 do eSocial (NOB-147, MED-05). Os valores
 * esperados abaixo foram conferidos no anexo oficial (S-1.3, NT 07/2026 rev. 20/10/2026).
 */
import {
  getProcedure,
  isCatalogProcedureCode,
  normalizeForSearch,
  OTHER_PROCEDURE_CODE,
  PROCEDURE_CATALOG_SOURCE,
  procedureSelectionSchema,
  searchProcedures,
  toAsoProcedureLine,
} from "@/shared/domains/medicine/procedure-catalog";
import table27 from "@/shared/domains/medicine/procedures/esocial-table-27.json";

describe("catálogo da Tabela 27", () => {
  it("registra fonte, versão e hash do anexo oficial", () => {
    expect(PROCEDURE_CATALOG_SOURCE).toMatchObject({
      version: "S-1.3 — NT 07/2026 rev. 20/10/2026",
      count: 1450,
    });
    expect(PROCEDURE_CATALOG_SOURCE.url).toMatch(/^https:\/\/www\.gov\.br\/esocial\//);
    expect(PROCEDURE_CATALOG_SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tem códigos únicos de 4 dígitos e contagem coerente com o arquivo", () => {
    const codes = table27.procedures.map(([code]) => code);
    expect(codes).toHaveLength(table27.count);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^\d{4}$/.test(code))).toBe(true);
  });

  it("devolve a descrição oficial pelo código", () => {
    expect(getProcedure("0281")?.description).toBe("Audiometria tonal ocupacional");
    expect(getProcedure("1057")?.description).toBe(
      "Prova de função pulmonar completa (ou espirometria)",
    );
    expect(getProcedure("1078")?.description).toMatch(
      /^Radiografia de tórax \(PA\) Padrão OIT/,
    );
    expect(getProcedure(OTHER_PROCEDURE_CODE)?.description).toBe(
      "Outros procedimentos diagnósticos não descritos anteriormente",
    );
  });

  it("não reconhece código inventado", () => {
    expect(getProcedure("0000")).toBeNull();
    expect(isCatalogProcedureCode("5000")).toBe(false);
    expect(isCatalogProcedureCode("281")).toBe(false);
  });
});

describe("searchProcedures", () => {
  it("ignora acentos e caixa", () => {
    expect(normalizeForSearch("  Tórax   PA ")).toBe("torax pa");
    const result = searchProcedures("TORAX");
    expect(result.rows.some((p) => p.code === "1078")).toBe(true);
  });

  it("exige todas as palavras da busca", () => {
    const result = searchProcedures("audiometria ocupacional");
    expect(result.rows.map((p) => p.code)).toEqual(["0281"]);
  });

  it("código exato vem primeiro, depois prefixo", () => {
    const exact = searchProcedures("0281");
    expect(exact.rows[0].code).toBe("0281");
    const prefix = searchProcedures("028");
    expect(prefix.rows.slice(0, 3).map((p) => p.code)).toEqual(["0280", "0281", "0282"]);
  });

  it("pagina e informa o total", () => {
    const all = searchProcedures("");
    expect(all.total).toBe(1450);
    expect(all.rows).toHaveLength(20);
    const page2 = searchProcedures("", { page: 2, pageSize: 5 });
    expect(page2.rows.map((p) => p.code)).toEqual([
      "0006",
      "0007",
      "0008",
      "0009",
      "0010",
    ]);
  });

  it("sem resultado devolve lista vazia, não erro", () => {
    expect(searchProcedures("xyzinexistente")).toEqual({ rows: [], total: 0 });
  });
});

describe("procedureSelectionSchema", () => {
  it("aceita código oficial", () => {
    expect(procedureSelectionSchema.parse({ code: "0281" })).toEqual({ code: "0281" });
  });

  it("recusa código fora da tabela e formato inválido", () => {
    expect(procedureSelectionSchema.safeParse({ code: "0000" }).success).toBe(false);
    expect(procedureSelectionSchema.safeParse({ code: "28" }).success).toBe(false);
  });

  it("9999 exige descrição; outros códigos não aceitam descrição livre", () => {
    expect(procedureSelectionSchema.safeParse({ code: "9999" }).success).toBe(false);
    expect(
      procedureSelectionSchema.parse({
        code: "9999",
        otherDescription: "Teste fictício",
      }),
    ).toEqual({ code: "9999", otherDescription: "Teste fictício" });
    expect(
      procedureSelectionSchema.safeParse({ code: "0281", otherDescription: "x" }).success,
    ).toBe(false);
  });

  it("recusa campos desconhecidos, como resultado clínico", () => {
    expect(
      procedureSelectionSchema.safeParse({ code: "0281", result: "alterado" }).success,
    ).toBe(false);
  });
});

describe("toAsoProcedureLine", () => {
  it("leva só indicação e data, sem resultado", () => {
    const line = toAsoProcedureLine({ code: "0281" }, "2026-10-01");
    expect(line).toEqual({
      code: "0281",
      label: "Audiometria tonal ocupacional",
      performedOn: "2026-10-01",
    });
    expect(Object.keys(line)).not.toContain("result");
  });

  it("no 9999 usa a descrição informada", () => {
    expect(
      toAsoProcedureLine(
        { code: "9999", otherDescription: "Exame fictício" },
        "2026-10-01",
      ).label,
    ).toBe("Exame fictício");
  });
});
