import {
  CRITICAL_OCCURRENCE_THRESHOLD,
  classifySafetyInspection,
  safetyInspectionNumber,
} from "@/shared/domains/inspections/safety-inspections";
import { vehicularInspectionNumber } from "@/shared/domains/inspections/vehicular-inspections";

describe("classifySafetyInspection", () => {
  it("inspeção em andamento não tem desfecho, mesmo com ocorrências", () => {
    expect(classifySafetyInspection({ status: "in_progress", occurrenceCount: 0 })).toBe(
      "in_progress",
    );
    expect(classifySafetyInspection({ status: "in_progress", occurrenceCount: 9 })).toBe(
      "in_progress",
    );
  });

  it("sem ocorrências é conforme", () => {
    expect(classifySafetyInspection({ status: "completed", occurrenceCount: 0 })).toBe(
      "compliant",
    );
  });

  it("abaixo do limite é pendência; a partir dele é crítica", () => {
    expect(
      classifySafetyInspection({
        status: "completed",
        occurrenceCount: CRITICAL_OCCURRENCE_THRESHOLD - 1,
      }),
    ).toBe("pending_items");
    expect(
      classifySafetyInspection({
        status: "completed",
        occurrenceCount: CRITICAL_OCCURRENCE_THRESHOLD,
      }),
    ).toBe("critical");
  });
});

describe("número curto das inspeções", () => {
  const ID = "3f9k2d7q-1111-4111-8111-111111111111";

  it("usa o prefixo de cada módulo sobre o mesmo formato", () => {
    expect(safetyInspectionNumber(ID)).toBe("IS-3F9K2D");
    expect(vehicularInspectionNumber(ID)).toBe("IV-3F9K2D");
  });

  it("ids que só divergem depois do 4º dígito deixam de colidir", () => {
    expect(safetyInspectionNumber("aaaabbbb-1111-4111-8111-111111111111")).not.toBe(
      safetyInspectionNumber("aaaacccc-1111-4111-8111-111111111111"),
    );
  });
});
