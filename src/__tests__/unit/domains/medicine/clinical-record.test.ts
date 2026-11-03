/**
 * Prontuário segregado (NOB-155): validação das entradas do médico e guarda contra diagnóstico/CID
 * na comunicação ao RH. Textos fictícios.
 */
import {
  CLINICAL_NOTE_MAX,
  DIAGNOSIS_IN_RESTRICTION_MESSAGE,
  WORK_RESTRICTION_MAX,
  clinicalNoteInputSchema,
  containsDiagnosisCode,
  workRestrictionInputSchema,
} from "@/shared/domains/medicine/clinical-record";

describe("containsDiagnosisCode", () => {
  it.each([
    "M54.5",
    "lombalgia m54",
    "F32.1 em acompanhamento",
    "CID: J45",
    "cid informado",
  ])("detecta código ou menção a CID: %s", (text) =>
    expect(containsDiagnosisCode(text)).toBe(true),
  );

  it.each([
    "Não levantar cargas acima de 10 kg por 30 dias.",
    "Evitar trabalho em altura (NR35) e uso de PFF2 por 15 dias.",
    "Jornada 12x36 sem horas extras.",
    "Afastar de ruído acima de 85 dB(A).",
  ])("aceita restrição funcional: %s", (text) =>
    expect(containsDiagnosisCode(text)).toBe(false),
  );
});

describe("clinicalNoteInputSchema", () => {
  it("exige texto, faz trim e limita o tamanho", () => {
    expect(clinicalNoteInputSchema.parse({ content: "  Nota fictícia.  " })).toEqual({
      content: "Nota fictícia.",
    });
    expect(clinicalNoteInputSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(
      clinicalNoteInputSchema.safeParse({ content: "a".repeat(CLINICAL_NOTE_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      clinicalNoteInputSchema.safeParse({ content: "a".repeat(CLINICAL_NOTE_MAX) })
        .success,
    ).toBe(true);
  });

  it("recusa campos extras (autoria vem do servidor, nunca do cliente)", () => {
    expect(
      clinicalNoteInputSchema.safeParse({ content: "x", authoredByMedicoId: "m" })
        .success,
    ).toBe(false);
  });
});

describe("workRestrictionInputSchema", () => {
  it("aceita restrição funcional e a retirada", () => {
    expect(
      workRestrictionInputSchema.parse({
        kind: "restriction",
        restriction: " Não levantar cargas acima de 10 kg. ",
      }),
    ).toEqual({
      kind: "restriction",
      restriction: "Não levantar cargas acima de 10 kg.",
    });
    expect(workRestrictionInputSchema.parse({ kind: "withdrawal" })).toEqual({
      kind: "withdrawal",
    });
  });

  it("recusa diagnóstico/CID com mensagem própria, sem ecoar o texto", () => {
    const result = workRestrictionInputSchema.safeParse({
      kind: "restriction",
      restriction: "EXEMPLO-SIGILO M54.5",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(DIAGNOSIS_IN_RESTRICTION_MESSAGE);
      expect(JSON.stringify(result.error.issues)).not.toContain("EXEMPLO-SIGILO");
    }
  });

  it("recusa vazio, tamanho excessivo, tipo desconhecido e texto na retirada", () => {
    expect(
      workRestrictionInputSchema.safeParse({ kind: "restriction", restriction: " " })
        .success,
    ).toBe(false);
    expect(
      workRestrictionInputSchema.safeParse({
        kind: "restriction",
        restriction: "a".repeat(WORK_RESTRICTION_MAX + 1),
      }).success,
    ).toBe(false);
    expect(workRestrictionInputSchema.safeParse({ kind: "diagnosis" }).success).toBe(
      false,
    );
    expect(
      workRestrictionInputSchema.safeParse({ kind: "withdrawal", restriction: "x" })
        .success,
    ).toBe(false);
  });
});
