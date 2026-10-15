import { textWidth } from "./text-fit";
import { PGR_DOCX_SIZES } from "./theme";

export type JobRolePart = {
  name: string;
  description: string;
  workload: string;
  employeeCount: string;
  last: boolean;
  whole: boolean;
  head: boolean;
  body: boolean;
  tail: boolean;
};

type JobRoleFields = Pick<
  JobRolePart,
  "name" | "description" | "workload" | "employeeCount"
>;

const PART_LINES = 6;
const MIN_PART_LINES = 2;

function wrapParagraph(paragraph: string, width: number, bold: boolean): string[] {
  const lines: string[] = [];
  for (const word of paragraph.split(/ +/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (
      last !== undefined &&
      textWidth(`${last} ${word}`, PGR_DOCX_SIZES.table, bold) <= width
    ) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines.length > 0 ? lines : [""];
}

export function wrapLines(text: string, width: number, bold = false): string[] {
  return text.split("\n").flatMap((paragraph) => wrapParagraph(paragraph, width, bold));
}

export function jobRoleParts(
  role: JobRoleFields,
  options: { keepWhole: boolean; descriptionWidth: number; firstMinLines: number },
): JobRolePart[] {
  const whole = [
    { ...role, last: true, whole: true, head: false, body: false, tail: false },
  ];
  if (options.keepWhole) return whole;
  const lines = role.description
    .split("\n")
    .flatMap((paragraph) =>
      wrapParagraph(paragraph, options.descriptionWidth, false).map((text) => ({ text })),
    );
  const firstSize = Math.max(options.firstMinLines, PART_LINES);
  if (lines.length < firstSize + MIN_PART_LINES) return whole;
  const sizes = [firstSize];
  let rest = lines.length - firstSize;
  while (rest > 0) {
    const size = rest - PART_LINES < MIN_PART_LINES ? rest : PART_LINES;
    sizes.push(size);
    rest -= size;
  }
  let start = 0;
  return sizes.map((size, index) => {
    const chunk = lines.slice(start, start + size);
    start += size;
    const description = chunk.map((line) => line.text).join("\n");
    const first = index === 0;
    const final = index === sizes.length - 1;
    return {
      name: first ? role.name : "",
      description,
      workload: first ? role.workload : "",
      employeeCount: first ? role.employeeCount : "",
      last: final,
      whole: false,
      head: first,
      body: !first && !final,
      tail: final,
    };
  });
}
