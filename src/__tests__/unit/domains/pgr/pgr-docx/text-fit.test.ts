/** @jest-environment node */
import {
  TEXT_FIT_SAFETY,
  textWidth,
  fitFontSize,
  balancedLines,
} from "@/shared/domains/pgr/pgr-docx/text-fit";
import { campaignsXml } from "@/shared/domains/pgr/pgr-docx/blocks";

describe("text-fit", () => {
  it("margem de segurança de 1%", () => {
    expect(TEXT_FIT_SAFETY).toBe(1.01);
  });

  it("negrito é mais largo que regular", () => {
    expect(textWidth("TRABALHO", 15, true)).toBeGreaterThan(textWidth("TRABALHO", 15));
  });

  it("hífen não separável mede igual ao hífen comum", () => {
    expect(textWidth("porta\u2011a\u2011porta", 8)).toBe(textWidth("porta-a-porta", 8));
    expect(textWidth("porta\u2011a\u2011porta", 8, true)).toBe(
      textWidth("porta-a-porta", 8, true),
    );
  });

  it("fitFontSize devolve o tamanho base quando cabe e null quando nem o mínimo cabe", () => {
    const options = { size: 24, minSize: 18, width: 7400 };
    expect(fitFontSize("PGR", options)).toBe(24);
    expect(fitFontSize("x".repeat(500), options)).toBeNull();
  });

  it("balancedLines cumpre a largura", () => {
    const lines = balancedLines(
      "Realizar inspeção semanal dos extintores de incêndio do setor de produção",
      { size: 13, width: 2000 },
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 13)).toBeLessThanOrEqual(2000);
  });

  it("item de campanha que cabia no baseline não quebra", () => {
    const campaign = {
      month: "Julho",
      theme: "Julho Amarelo",
      actions: "Campanha educativa sobre segurança",
    };
    const xml = campaignsXml([campaign], { actions: "AÇÕES RECOMENDADAS" });
    const pattern = /<w:p>(?:(?!<\/w:p>).)*Campanha educativa(?:(?!<\/w:p>).)*<\/w:p>/;
    const item = xml.match(pattern)?.[0] ?? "";
    expect(item).not.toBe("");
    expect(item).not.toContain("<w:br/>");
  });

  describe("balancedLines por programação dinâmica", () => {
    const greedy = (words: string[], width: number) => {
      const lines: string[] = [];
      for (const word of words) {
        const last = lines[lines.length - 1];
        if (last !== undefined && textWidth(`${last} ${word}`, 15) <= width) {
          lines[lines.length - 1] = `${last} ${word}`;
        } else {
          lines.push(word);
        }
      }
      return lines;
    };

    const hasGoodPartition = (words: string[], k: number, width: number): boolean => {
      const gaps = words.length - 1;
      for (let mask = 0; mask < 1 << gaps; mask += 1) {
        const bounds = [0];
        for (let gap = 0; gap < gaps; gap += 1) {
          if (mask & (1 << gap)) bounds.push(gap + 1);
        }
        bounds.push(words.length);
        if (bounds.length !== k + 1) continue;
        const groups = bounds
          .slice(1)
          .map((end, index) => words.slice(bounds[index], end));
        const lineTexts = groups.map((group) => group.join(" "));
        const fits = groups.every(
          (group, index) =>
            group.length === 1 || textWidth(lineTexts[index], 15) <= width,
        );
        const lastHasTwoWords = groups[groups.length - 1].length >= 2;
        const noHyphenStart = lineTexts.slice(1).every((line) => !/^[-–/]/.test(line));
        if (fits && lastHasTwoWords && noHyphenStart) return true;
      }
      return false;
    };

    const samples = [
      "Queda de materiais sobre os trabalhadores durante a montagem",
      "Exposição a ruído contínuo ou intermitente acima do limite",
      "Trabalho em altura - montagem de andaimes e plataformas",
      "Choque elétrico / arco elétrico em painéis energizados",
    ];
    const widths = [1360, 1760, 2160];

    for (const sample of samples) {
      for (const width of widths) {
        it(`quebra "${sample}" em ${width} dxa sem linha órfã nem hífen no início`, () => {
          const words = sample.split(/ +/).filter(Boolean);
          const lines = balancedLines(sample, { size: 15, width });
          expect(lines).toHaveLength(greedy(words, width).length);
          expect(lines.join(" ")).toBe(sample);
          for (const line of lines) {
            if (line.includes(" ")) {
              expect(textWidth(line, 15)).toBeLessThanOrEqual(width + 1e-6);
            }
          }
          if (hasGoodPartition(words, lines.length, width)) {
            expect(lines[lines.length - 1]).toContain(" ");
            for (const line of lines.slice(1)) expect(line).not.toMatch(/^[-–/]/);
          }
        });
      }
    }

    it("não deixa 'trabalhadores.' sozinho na última linha quando dá para evitar", () => {
      const text = "Risco de queda de materiais sobre os trabalhadores.";
      const width = Math.ceil(textWidth("Risco de queda de materiais sobre os", 15));
      const lines = balancedLines(text, { size: 15, width });
      expect(lines).toHaveLength(2);
      expect(lines[lines.length - 1]).not.toBe("trabalhadores.");
    });

    it("palavra maior que a largura não lança e vira linha própria", () => {
      const lines = balancedLines("Supercalifragilisticexpialidocious curto", {
        size: 15,
        width: 300,
      });
      expect(lines).toHaveLength(2);
    });
  });
});
