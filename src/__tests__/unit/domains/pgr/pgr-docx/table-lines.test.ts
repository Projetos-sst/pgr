import {
  jobRoleParts,
  wrapLines,
  type JobRolePart,
} from "@/shared/domains/pgr/pgr-docx/table-lines";
import { textWidth } from "@/shared/domains/pgr/pgr-docx/text-fit";

const role = {
  name: "PEDREIRO",
  description: "Executa alvenaria e reboco.",
  workload: "Segunda-feira a Sexta-feira: 07h00min - 17h00min",
  employeeCount: "4",
};

const DESCRIPTION_WIDTH = 4260;

describe("wrapLines", () => {
  it("respeita as quebras de parágrafo", () => {
    expect(wrapLines("a b\nc", 10000)).toEqual(["a b", "c"]);
  });

  it("quebra por palavra dentro da largura sem perder texto", () => {
    const sentence =
      "Executa atividades de montagem de formas, armação e concretagem de estruturas em obras de edificação";
    const text = [sentence, sentence, sentence].join(" ");
    const lines = wrapLines(text, 2000);
    const multiWord = lines.filter((line) => line.includes(" "));
    expect(multiWord.length).toBeGreaterThan(0);
    for (const line of multiWord) {
      expect(textWidth(line, 15)).toBeLessThanOrEqual(2000);
    }
    expect(lines.join(" ")).toBe(text);
  });
});

describe("jobRoleParts", () => {
  it("mantém a função inteira quando keepWhole", () => {
    expect(
      jobRoleParts(role, {
        keepWhole: true,
        descriptionWidth: DESCRIPTION_WIDTH,
        firstMinLines: 1,
      }),
    ).toEqual([
      { ...role, last: true, whole: true, head: false, body: false, tail: false },
    ]);
  });

  it("descrição longa vira partes: a primeira leva o nome e as demais não repetem nada", () => {
    const description = "palavra ".repeat(200).trim();
    const parts = jobRoleParts(
      { ...role, description },
      { keepWhole: false, descriptionWidth: DESCRIPTION_WIDTH, firstMinLines: 9 },
    );
    expect(parts.length).toBeGreaterThan(1);
    expect(wrapLines(parts[0].description, DESCRIPTION_WIDTH)).toHaveLength(9);
    for (const part of parts.slice(1)) {
      const lines = wrapLines(part.description, DESCRIPTION_WIDTH);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(7);
    }
    expect(parts.map((part) => part.last)).toEqual(
      parts.map((_, index) => index === parts.length - 1),
    );
    for (const part of parts.slice(1)) {
      expect(part.name).toBe("");
      expect(part.workload).toBe("");
      expect(part.employeeCount).toBe("");
    }
    expect(
      parts
        .map((part) => part.description)
        .join(" ")
        .replace(/\n/g, " "),
    ).toBe(description);
    expect(parts[0].head).toBe(true);
    expect(parts[parts.length - 1].tail).toBe(true);
    for (const part of parts.slice(1, -1)) expect(part.body).toBe(true);
    for (const part of parts) {
      expect([part.whole, part.head, part.body, part.tail].filter(Boolean)).toHaveLength(
        1,
      );
    }
  });

  it("descrição curta, de poucas linhas, continua numa parte só", () => {
    const description = "palavra ".repeat(20).trim();
    expect(wrapLines(description, DESCRIPTION_WIDTH).length).toBeLessThan(8);
    const parts = jobRoleParts(
      { ...role, description },
      { keepWhole: false, descriptionWidth: DESCRIPTION_WIDTH, firstMinLines: 1 },
    );
    expect(parts).toEqual([
      {
        ...role,
        description,
        last: true,
        whole: true,
        head: false,
        body: false,
        tail: false,
      },
    ]);
  });

  it("parágrafos não criam espaço nas bordas das partes e nenhuma palavra se perde", () => {
    const description = `${"alfa ".repeat(80).trim()}\n${"beta ".repeat(80).trim()}`;
    const parts: JobRolePart[] = jobRoleParts(
      { ...role, description },
      { keepWhole: false, descriptionWidth: DESCRIPTION_WIDTH, firstMinLines: 1 },
    );
    for (const part of parts) {
      expect(part.description).not.toMatch(/^[ \n]|[ \n]$/);
    }
    const joined = parts.map((part) => part.description).join(" ");
    expect(joined.match(/alfa/g)).toHaveLength(80);
    expect(joined.match(/beta/g)).toHaveLength(80);
  });

  it("cada parte fixa as linhas estimadas com quebra de linha", () => {
    const description =
      "Executa atividades de montagem de formas, armação e concretagem de estruturas em obras de edificação "
        .repeat(12)
        .trim();
    const parts = jobRoleParts(
      { ...role, description },
      { keepWhole: false, descriptionWidth: DESCRIPTION_WIDTH, firstMinLines: 1 },
    );
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      const lines = part.description.split("\n");
      expect(wrapLines(part.description, DESCRIPTION_WIDTH)).toEqual(lines);
      for (const line of lines) {
        expect(textWidth(line, 15)).toBeLessThanOrEqual(DESCRIPTION_WIDTH);
      }
    }
    expect(parts.map((part) => part.description).join("\n")).toBe(
      wrapLines(description, DESCRIPTION_WIDTH).join("\n"),
    );
  });
});
