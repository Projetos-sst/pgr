import { buildPgrDocxData } from "@/shared/domains/pgr/pgr-docx/build-data";
import { PGR_DOCX_EXAMPLE_CONTENT as content } from "@/shared/domains/pgr/pgr-docx/example-content";
import { wrapLines } from "@/shared/domains/pgr/pgr-docx/table-lines";
import { textWidth } from "@/shared/domains/pgr/pgr-docx/text-fit";
import { PGR_DOCX_SIZES } from "@/shared/domains/pgr/pgr-docx/theme";

const USABLE = 2341 - 140;
const WIDE = Math.floor(USABLE * 1.03);
const RANGE = Array.from({ length: WIDE - USABLE + 1 }, (_, index) => USABLE + index);

function glue(field: "action" | "measurement", text: string): string {
  const [ges] = content.ges;
  const [action] = ges.actions;
  return buildPgrDocxData({
    ...content,
    ges: [{ ...ges, actions: [{ ...action, [field]: text }] }],
  }).ges[0].actions[0][field];
}

const words = (line: string) => line.split(/[ \u00A0]+/).filter(Boolean).length;

describe("cola das últimas palavras", () => {
  it("não encadeia quando a penúltima linha já tinha uma palavra só", () => {
    expect(
      glue("action", "Elaborar procedimento com acompanhamento especializado do SESMT."),
    ).toBe("Elaborar procedimento com acompanhamento especializado do\u00A0SESMT.");
    expect(
      glue("action", "Implantar programa de acompanhamento especializado de saúde."),
    ).toBe("Implantar programa de acompanhamento especializado de\u00A0saúde.");
  });

  it("nenhum trecho colado passa da largura útil da coluna", () => {
    const texts = [
      "Elaborar procedimento com acompanhamento especializado do SESMT.",
      "Implantar programa de acompanhamento especializado de saúde.",
      "Monitorar a tensão no corpo conforme NR-35 com acompanhamento especializado do serviço médico.",
      "Realizar treinamento periódico com acompanhamento especializado da equipe técnica.",
    ];
    for (const text of texts) {
      for (const token of glue("action", text).split(" ")) {
        expect(textWidth(token, PGR_DOCX_SIZES.table)).toBeLessThanOrEqual(USABLE);
      }
    }
  });

  it("encadeia quando, com a folga do LibreOffice, a penúltima linha ficaria com uma palavra", () => {
    const text =
      "Controle periódico da exposição com registros mensais das medições e conferência dos equipamentos novos, além de inspeções ergonômicas regulares.";
    const out = glue("measurement", text);
    expect(out).toBe(
      "Controle periódico da exposição com registros mensais das medições e conferência dos equipamentos novos, além de\u00A0inspeções ergonômicas\u00A0regulares.",
    );
    for (const width of RANGE) {
      const lines = wrapLines(out, width);
      expect(words(lines[lines.length - 2])).toBeGreaterThanOrEqual(2);
    }
  });

  it("cola o par final quando, com a folga do LibreOffice, ainda cabe na linha", () => {
    const pair = textWidth("monitorados adequadamente.", PGR_DOCX_SIZES.table);
    expect(pair).toBeGreaterThan(0.95 * USABLE);
    expect(pair * 1.03).toBeLessThanOrEqual(USABLE);
    const head =
      "Realizar inspeções periódicas nos postos de trabalho e registrar as medições feitas pelos técnicos responsáveis, mantendo os registros";
    const out = glue("action", `${head} monitorados adequadamente.`);
    expect(out).toBe(`${head} monitorados\u00A0adequadamente.`);
    for (const width of RANGE) {
      const lines = wrapLines(out, width);
      expect(words(lines[lines.length - 2])).toBeGreaterThanOrEqual(2);
    }
  });

  it("encadeia o par anterior quando uma largura intermediária da folga deixaria a penúltima linha sozinha", () => {
    const text =
      "Realizar inspeções mensais nos setores e conferir os registros de campo de modo que as áreas de risco da obra estejam sendo monitoradas adequadamente.";
    const pair = textWidth("monitoradas adequadamente.", PGR_DOCX_SIZES.table);
    expect(pair).toBeGreaterThan(0.95 * USABLE);
    expect(pair * 1.03).toBeLessThanOrEqual(USABLE);
    const simple = text.replace(/ adequadamente\.$/, "\u00A0adequadamente.");
    expect(
      RANGE.some((width) => {
        const lines = wrapLines(simple, width);
        return words(lines[lines.length - 2]) < 2;
      }),
    ).toBe(true);
    const out = glue("action", text);
    expect(out).toBe(
      "Realizar inspeções mensais nos setores e conferir os registros de campo de modo que as áreas de risco da obra estejam\u00A0sendo monitoradas\u00A0adequadamente.",
    );
    for (const width of RANGE) {
      const lines = wrapLines(out, width);
      expect(words(lines[lines.length - 2])).toBeGreaterThanOrEqual(2);
      expect(words(lines[lines.length - 1])).toBeGreaterThanOrEqual(2);
    }
  });

  it("cola a última palavra mesmo quando a penúltima já tem espaço não separável", () => {
    const out = glue(
      "action",
      "Realizar a manutenção preventiva das máquinas conforme a NR\u00A012 rigorosamente.",
    );
    expect(out).toBe(
      "Realizar a manutenção preventiva das máquinas conforme a NR\u00A012\u00A0rigorosamente.",
    );
    for (const width of RANGE) {
      const lines = wrapLines(out, width);
      expect(words(lines[lines.length - 2])).toBeGreaterThanOrEqual(2);
    }
  });

  it("hífen das palavras coladas não quebra a linha", () => {
    expect(glue("action", "Instalar coxins de borracha e manoplas anti-vibração")).toBe(
      "Instalar coxins de borracha e manoplas\u00A0anti\u2011vibração",
    );
  });

  it("troca todos os hífens das palavras coladas por hífen não separável", () => {
    const result = glue(
      "action",
      "Realizar campanhas educativas de conscientização com visitas porta-a-porta",
    );
    expect(result).toContain("porta\u2011a\u2011porta");
    expect(result).not.toMatch(/porta-a|a-porta/);
  });

  it("traço colado à palavra seguinte nunca abre linha: fica preso à palavra anterior", () => {
    const [revision] = content.revisions;
    const description =
      "Revisão do efetivo da obra, inclusão do GES 07 -Pintor de Fachada e GES 08 de Pintura Interna.";
    const out = buildPgrDocxData({
      ...content,
      revisions: [{ ...revision, description }],
    }).revisions[0].description;
    expect(out).toContain("07\u00a0-Pintor");
    const usable = 3700 - 140;
    for (let width = usable; width <= Math.floor(usable * 1.03); width += 1) {
      for (const line of wrapLines(out, width)) {
        expect(line.startsWith("-")).toBe(false);
      }
    }
  });

  it("barra colada à palavra seguinte nunca abre linha: fica presa à palavra anterior", () => {
    const [role] = content.jobRoles;
    const description =
      "Acompanha os pedidos de compra, confere as entregas de materiais e organiza o cadastro de compradores /fornecedores/ prestadores, além de manter os registros atualizados no sistema.";
    const out = buildPgrDocxData({
      ...content,
      jobRoles: [{ ...role, description }],
    }).jobRoles[0].description;
    expect(out).toContain("compradores /fornecedores/");
    const usable = 4400 - 140;
    for (let width = usable; width <= Math.floor(usable * 1.03); width += 1) {
      for (const line of wrapLines(out, width)) {
        expect(line.startsWith("/")).toBe(false);
      }
    }
  });
});
