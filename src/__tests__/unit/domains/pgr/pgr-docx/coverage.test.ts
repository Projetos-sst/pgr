import { readFileSync } from "node:fs";
import path from "node:path";

import {
  PGR_DOCX_COVERAGE,
  PGR_DOCX_COVERAGE_AREAS,
  missingCoverage,
} from "@/shared/domains/pgr/pgr-docx/coverage";
import { PGR_DOCX_TEMPLATE_FILE } from "@/shared/domains/pgr/pgr-docx/template-file";
import { listTemplateTags } from "@/shared/integrations/docx/template-engine";

const templateTags = listTemplateTags(
  readFileSync(path.join(process.cwd(), PGR_DOCX_TEMPLATE_FILE)),
);

describe("cobertura do modelo do PGR em relação ao conteúdo de referência", () => {
  it("cobre as seis áreas do aceite, cada uma com blocos exigidos", () => {
    expect(PGR_DOCX_COVERAGE_AREAS).toEqual([
      "identification",
      "inventory",
      "assessments",
      "controls",
      "actionPlan",
      "annexes",
    ]);
    for (const area of PGR_DOCX_COVERAGE_AREAS) {
      const blocks = PGR_DOCX_COVERAGE.filter((block) => block.area === area);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.every((block) => block.tags.length > 0)).toBe(true);
    }
  });

  it("o modelo versionado mantém todos os blocos da matriz", () => {
    expect(missingCoverage(templateTags)).toEqual([]);
  });

  it("aponta o bloco e as tags que sumirem do modelo", () => {
    const withoutActionPlan = templateTags.filter(
      (tag) => tag !== "#actions" && tag !== "#annexActions",
    );
    expect(missingCoverage(withoutActionPlan)).toEqual([
      { area: "actionPlan", block: "Plano de ação por GES", tags: ["#actions"] },
      {
        area: "actionPlan",
        block: "Cronograma consolidado de ações",
        tags: ["#annexActions"],
      },
      {
        area: "annexes",
        block: "Anexo I: cronograma de implementação",
        tags: ["#annexActions"],
      },
    ]);
  });
});
