/**
 * @jest-environment node
 *
 * Lista C do Anexo II do Decreto 3.048/1999 (NTEP), NOB-113: integridade do snapshot importado
 * da fonte oficial, extração verbatim, consulta CID-10/CNAE e distinção entre inválido,
 * indisponível, não validado, versão inexistente e "sem correspondência". Amostras conferidas
 * no texto oficial (Câmara e Planalto). Nunca conclui nexo individual.
 */
import listaC from "@/shared/domains/medicine/ntep/lista-c.json";
import {
  extractListaC,
  normalizedListaCHash,
  validateListaCRows,
  type ListaCRow,
} from "@/shared/domains/medicine/ntep/lista-c-parse";
import {
  NTEP_LISTA_C_SOURCE,
  loadListaC,
  lookupNtep,
  parseCid10,
  parseCnaeClass,
} from "@/shared/domains/medicine/ntep/lista-c";

const rows = listaC.rows as ListaCRow[];
const row = (interval: string) => rows.find(([i]) => i === interval)?.[1];

describe("snapshot oficial da Lista C", () => {
  it("procedência registrada: norma, anexo, ato de inclusão, versão, URL oficial, hashes e conferências", () => {
    expect(listaC.source).toMatch(/Decreto nº 3\.048\/1999.*Anexo II, Lista C/);
    expect(listaC.includedBy).toBe("Decreto nº 6.957, de 9 de setembro de 2009");
    expect(listaC.annotation).toMatch(/6\.957/);
    expect(listaC.url).toMatch(
      /^https:\/\/www2\.camara\.leg\.br\/legin\/fed\/decret\/1999\//,
    );
    expect(listaC.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(listaC.crossChecks.map((c) => new URL(c.url).hostname)).toEqual([
      "www.planalto.gov.br",
      "www.planalto.gov.br",
    ]);
    expect(listaC.note).toMatch(/subclasses cujos quatro dígitos iniciais sejam comuns/);
    expect(NTEP_LISTA_C_SOURCE?.version).toBe(listaC.version);
  });

  it("contagens e hash normalizado derivados das linhas; nenhum problema de integridade", () => {
    expect(validateListaCRows(rows)).toEqual([]);
    expect(rows).toHaveLength(listaC.counts.intervals);
    expect(rows.reduce((n, [, c]) => n + c.length, 0)).toBe(listaC.counts.relations);
    expect(new Set(rows.flatMap(([, c]) => c)).size).toBe(listaC.counts.distinctCnae);
    expect(normalizedListaCHash(rows)).toBe(listaC.normalizedSha256);
    expect(loadListaC(listaC).status).toBe("ready");
    // Valores derivados da fonte verificada em 04/11/2026 (Câmara = Planalto = Decreto 6.957).
    expect(listaC.counts).toEqual({ intervals: 34, relations: 2717, distinctCnae: 368 });
  });

  it("amostras conferidas no texto oficial, com zeros à esquerda preservados", () => {
    const a15 = row("A15-A19")!;
    expect(a15).toHaveLength(50);
    expect(a15[0]).toBe("0810");
    expect(a15.at(-1)).toBe("9601");
    expect(row("E10-E14")).toContain("1091");
    expect(row("I05-I09")).toHaveLength(1);
    expect(row("L60-L75")).toHaveLength(1);
    expect(rows[0][0]).toBe("A15-A19");
    expect(rows.at(-1)![0]).toBe("T90-T98");
  });
});

describe("extração da fonte", () => {
  // Estrutura verbatim do HTML oficial (Câmara), reduzida a duas tabelas.
  const html = `<p>LISTA C<br/><i>(Lista acrescida pelo Decreto n&ordm; 6.957, de 9/9/2009)</i></p>
    <p>Nota:</p><p>1 - S&atilde;o indicados intervalos de CID-10 ... sejam comuns. </p>
    <table><tr><td>INTERVALO CID-10</td><td>CNAE</td></tr>
    <tr><td>A15-A19</td><td>0810 1091
      1411</td></tr></table>
    <table><tr><td>INTERVALO CID-10</td><td>CNAE</td></tr>
    <tr><td>E10-E14</td><td>1091 3600</td></tr></table>
    <p>ANEXO III</p><p>RELA&Ccedil;&Atilde;O DAS SITUA&Ccedil;&Otilde;ES ... 1234</p>`;

  it("linhas par a par (intervalo × classes da própria linha), nunca produto cartesiano", () => {
    const out = extractListaC(html);
    expect(out.rows).toEqual([
      ["A15-A19", ["0810", "1091", "1411"]],
      ["E10-E14", ["1091", "3600"]],
    ]);
    expect(out.annotation).toBe("(Lista acrescida pelo Decreto nº 6.957, de 9/9/2009)");
    expect(out.note).toMatch(/^Nota:/);
  });

  it("fonte incompleta ou com formato inesperado não é importada", () => {
    expect(() => extractListaC("<p>sem a lista</p>")).toThrow(/não encontrada/);
    expect(() => extractListaC(html.replace("Nota:", ""))).toThrow(/Nota/);
    expect(() => extractListaC(html.replace("3600", "36O0"))).toThrow(/Token inesperado/);
    expect(() => extractListaC(html.replace("0810", "810"))).toThrow(/Token inesperado/);
  });

  it("validação: intervalo inválido, invertido, repetido, sobreposto, classe inválida e duplicada", () => {
    expect(validateListaCRows([])).toEqual(["Nenhum intervalo encontrado."]);
    const problems = validateListaCRows([
      ["A15-B19", ["0810"]],
      ["A19-A15", ["0810"]],
      ["E10-E14", ["1091", "1091"]],
      ["E12-E20", ["123"]],
      ["E10-E14", []],
    ]);
    expect(problems.join("\n")).toMatch(/letras diferentes/);
    expect(problems.join("\n")).toMatch(/invertido/);
    expect(problems.join("\n")).toMatch(/repetida/);
    expect(problems.join("\n")).toMatch(/Classe CNAE inválida/);
    expect(problems.join("\n")).toMatch(/Intervalo repetido/);
    expect(problems.join("\n")).toMatch(/sobrepostos/);
    expect(problems.join("\n")).toMatch(/sem classes/);
  });
});

describe("consulta CID-10 / CNAE", () => {
  it("correspondência encontrada pelo par, com fonte, versão e aviso de que não há nexo individual", () => {
    const r = lookupNtep({ cid: "A15.0", cnae: "0810" });
    expect(r).toMatchObject({
      kind: "match",
      cid: "A15.0",
      cnaeClass: "0810",
      matches: [{ interval: "A15-A19", cnaeClasses: ["0810"] }],
    });
    if (r.kind !== "match") return;
    expect(r.source.version).toBe(listaC.version);
    expect(r.notice).toMatch(/Não estabelece nexo ocupacional individual/);
    expect(JSON.stringify(r)).not.toMatch(
      /"(nexo|diagnosis|diagnostico|incapacidade|cat|apto)"\s*:/i,
    );
  });

  it("limites do intervalo: A15 e A19.9 dentro; A14, A20 e B15 fora", () => {
    expect(lookupNtep({ cid: "A15", cnae: "0810" }).kind).toBe("match");
    expect(lookupNtep({ cid: "A19.9", cnae: "0810" }).kind).toBe("match");
    for (const cid of ["A14", "A20", "B15"])
      expect(lookupNtep({ cid, cnae: "0810" }).kind).toBe("no_match");
  });

  it("CNAE divergente: CID no intervalo mas classe fora da linha → sem correspondência", () => {
    expect(row("E10-E14")).not.toContain("0810");
    expect(lookupNtep({ cid: "E11", cnae: "0810" }).kind).toBe("no_match");
    expect(lookupNtep({ cid: "E11", cnae: "1091" }).kind).toBe("match");
  });

  it("subclasse e classe com DV valem pelos 4 dígitos iniciais (Nota 1); zero à esquerda obrigatório", () => {
    expect(parseCnaeClass("1091-1/01")).toBe("1091");
    expect(parseCnaeClass("10.91-1")).toBe("1091");
    expect(parseCnaeClass("0810")).toBe("0810");
    expect(parseCnaeClass("810")).toBeNull();
    expect(lookupNtep({ cid: "E10", cnae: "1091-1/01" }).kind).toBe("match");
  });

  it("só CNAE: lista os intervalos da classe; só CID: o intervalo com as classes da linha", () => {
    const byCnae = lookupNtep({ cnae: "0810" });
    expect(byCnae.kind === "match" && byCnae.matches.map((m) => m.interval)).toContain(
      "A15-A19",
    );
    const byCid = lookupNtep({ cid: "I05" });
    expect(byCid).toMatchObject({
      kind: "match",
      matches: [{ interval: "I05-I09", cnaeClasses: row("I05-I09") }],
    });
  });

  it("código inválido não vira 'sem correspondência'", () => {
    expect(lookupNtep({})).toMatchObject({ kind: "invalid", field: "input" });
    expect(lookupNtep({ cid: "54.5" })).toMatchObject({ kind: "invalid", field: "cid" });
    expect(lookupNtep({ cid: "MM5" })).toMatchObject({ kind: "invalid", field: "cid" });
    expect(lookupNtep({ cnae: "41" })).toMatchObject({ kind: "invalid", field: "cnae" });
    expect(parseCid10("m54.5")).toEqual({ code: "M54.5", category: "M54" });
    expect(parseCid10("M545")).toEqual({ code: "M54.5", category: "M54" });
  });

  it("versão inexistente, catálogo indisponível e snapshot adulterado ou incompleto", () => {
    expect(lookupNtep({ cnae: "0810", version: "outra" })).toMatchObject({
      kind: "version_not_available",
      available: listaC.version,
    });
    expect(lookupNtep({ cnae: "0810" }, loadListaC(null)).kind).toBe("unavailable");
    // Linha removida (contagens não conferem).
    const truncated = { ...listaC, rows: rows.slice(1) };
    expect(lookupNtep({ cnae: "0810" }, loadListaC(truncated)).kind).toBe("unvalidated");
    // Classe trocada mantendo as contagens (hash não confere).
    const swapped = {
      ...listaC,
      rows: rows.map(
        ([i, c], n): ListaCRow => (n === 0 ? [i, ["0811", ...c.slice(1)]] : [i, c]),
      ),
    };
    const loaded = loadListaC(swapped);
    expect(loaded).toMatchObject({ status: "invalid" });
    expect(lookupNtep({ cnae: "0810" }, loaded).kind).toBe("unvalidated");
  });
});
