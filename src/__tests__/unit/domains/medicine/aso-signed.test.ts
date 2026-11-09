/**
 * ASO assinado (NOB-163): entrada do registro, conferência do PDF, data da assinatura e documento
 * vigente na cadeia de substituição. Fictício.
 */
import {
  ASO_SIGNED_MAX_BYTES,
  asoSignedInputSchema,
  checkSignedPdf,
  currentSignedAso,
  signedCurrentRows,
  signedAsoOutdated,
  signedOnProblem,
} from "@/shared/domains/medicine/aso-signed";

const PREVIEW = "11111111-1111-4111-8111-111111111111";
const OLD = "22222222-2222-4222-8222-222222222222";
const base = {
  origin: "examiner",
  previewDocumentId: PREVIEW,
  signatureMethod: "icp_brasil",
  verificationReference: "Verificador ITI, relatório 001",
  signerName: "Dr. Fictício",
  signerRegistration: "12345",
  signerUf: "ma",
  conclusion: "fit",
  signedOn: "2026-10-21",
};
const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe("asoSignedInputSchema", () => {
  it("aceita o fluxo do examinador, normaliza a UF e zera substituição ausente", () => {
    expect(asoSignedInputSchema.parse(base)).toMatchObject({
      signerUf: "MA",
      previewDocumentId: PREVIEW,
      replacesId: null,
      replaceReason: null,
    });
  });
  it("fluxo do examinador exige prévia; clínica externa não usa prévia", () => {
    expect(() => asoSignedInputSchema.parse({ ...base, previewDocumentId: "" })).toThrow(
      /prévia/,
    );
    expect(() =>
      asoSignedInputSchema.parse({ ...base, origin: "external_clinic" }),
    ).toThrow(/não usa prévia/);
    expect(
      asoSignedInputSchema.parse({
        ...base,
        origin: "external_clinic",
        previewDocumentId: undefined,
      }).previewDocumentId,
    ).toBeNull();
  });
  it("conferência obrigatória; só apto ou inapto; método conhecido", () => {
    expect(() =>
      asoSignedInputSchema.parse({ ...base, verificationReference: " " }),
    ).toThrow();
    expect(() =>
      asoSignedInputSchema.parse({ ...base, conclusion: "fit_with_restrictions" }),
    ).toThrow();
    expect(() =>
      asoSignedInputSchema.parse({ ...base, signatureMethod: "none" }),
    ).toThrow();
  });
  it("substituição exige motivo; motivo sem substituição é recusado", () => {
    expect(() => asoSignedInputSchema.parse({ ...base, replacesId: OLD })).toThrow(
      /10 caracteres/,
    );
    expect(() =>
      asoSignedInputSchema.parse({ ...base, replaceReason: "Motivo sem documento." }),
    ).toThrow(/substituição/);
    expect(
      asoSignedInputSchema.parse({
        ...base,
        replacesId: OLD,
        replaceReason: "Data corrigida pela clínica.",
      }),
    ).toMatchObject({ replacesId: OLD, replaceReason: "Data corrigida pela clínica." });
  });
});

describe("asoSignedInputSchema — CRM do signatário (NOB-110)", () => {
  it("aceita separadores (ponto, hífen, barra, espaço) e guarda o valor aparado", () => {
    expect(
      asoSignedInputSchema.parse({ ...base, signerRegistration: " 12.345 " })
        .signerRegistration,
    ).toBe("12.345");
  });
  it("recusa letras no CRM (a UF vai no campo próprio)", () => {
    expect(() =>
      asoSignedInputSchema.parse({ ...base, signerRegistration: "12345-MA" }),
    ).toThrow(/só números/);
  });
});

describe("checkSignedPdf", () => {
  it("exige cabeçalho de PDF, conteúdo e o limite de tamanho", () => {
    expect(checkSignedPdf(enc("%PDF-1.7 ..."))).toEqual({ ok: true });
    expect(checkSignedPdf(enc("PK zip"))).toMatchObject({ ok: false });
    expect(checkSignedPdf(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(ASO_SIGNED_MAX_BYTES + 1);
    big.set(enc("%PDF-"));
    expect(checkSignedPdf(big)).toMatchObject({ ok: false, message: /25 MB/ });
  });
});

describe("signedOnProblem", () => {
  it("não futura e não anterior ao exame (limites inclusivos)", () => {
    expect(signedOnProblem("2026-10-20", "2026-10-20", "2026-10-20")).toBeNull();
    expect(signedOnProblem("2026-10-21", "2026-10-20", "2026-10-20")).toMatch(/futura/);
    expect(signedOnProblem("2026-10-19", "2026-10-20", "2026-10-21")).toMatch(/anterior/);
  });
});

describe("currentSignedAso", () => {
  it("o vigente é o que ninguém substituiu", () => {
    expect(currentSignedAso([])).toBeNull();
    const chain = [
      { id: "a", replacesId: null },
      { id: "b", replacesId: "a" },
      { id: "c", replacesId: "b" },
    ];
    expect(currentSignedAso(chain)?.id).toBe("c");
  });
});

describe("signedAsoOutdated (MED-11)", () => {
  const current = { currentSha256: "a".repeat(64), conclusion: "fit" as const };
  it("fluxo A: diverge quando a prévia assinada não é mais a composição atual", () => {
    const signed = { origin: "examiner" as const, conclusion: "fit" as const };
    expect(signedAsoOutdated(signed, { ...current, previewSha256: "a".repeat(64) })).toBe(
      false,
    );
    expect(signedAsoOutdated(signed, { ...current, previewSha256: "b".repeat(64) })).toBe(
      true,
    );
    // Conferência com bloqueio hoje: não há composição igual à assinada.
    expect(
      signedAsoOutdated(signed, {
        ...current,
        currentSha256: null,
        previewSha256: "a".repeat(64),
      }),
    ).toBe(true);
    expect(signedAsoOutdated(signed, { ...current, previewSha256: null })).toBe(true);
  });

  it("fluxo B: só a conclusão é comparada; sem conclusão efetiva nada é inferido", () => {
    const signed = { origin: "external_clinic" as const, conclusion: "fit" as const };
    const now = { previewSha256: null, currentSha256: null };
    expect(signedAsoOutdated(signed, { ...now, conclusion: "fit" })).toBe(false);
    expect(signedAsoOutdated(signed, { ...now, conclusion: "unfit" })).toBe(true);
    expect(signedAsoOutdated(signed, { ...now, conclusion: null })).toBe(false);
  });
});

describe("vigência única (lote 4)", () => {
  const doc = (id: string, replacesId: string | null = null) => ({ id, replacesId });
  it("cadeia íntegra: a vigente é a única não substituída", () => {
    expect(currentSignedAso([doc("a"), doc("b", "a"), doc("c", "b")])?.id).toBe("c");
  });

  it("legado com duas vigentes: nenhuma é escolhida (falha fechada)", () => {
    const legacy = [doc("a"), doc("b")];
    expect(signedCurrentRows(legacy).map((d) => d.id)).toEqual(["a", "b"]);
    expect(currentSignedAso(legacy)).toBeNull();
    expect(currentSignedAso([...legacy, doc("c", "a")])).toBeNull();
  });
});
