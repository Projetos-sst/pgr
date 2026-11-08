/**
 * PCMSO assinado (NOB-166): entrada, tipo de mudança na substituição (MED-14), datas coerentes e
 * alertas de desatualização. Fictício.
 */
import {
  PCMSO_VERIFICATION_LABEL,
  previewRisks,
  riskBasisProblems,
  snapshotSources,
  pcmsoSignedInputSchema,
  pcmsoSignedOnProblem,
  pcmsoSignedWarnings,
} from "@/shared/domains/medicine/pcmso-signed";

const PREVIEW = "11111111-1111-4111-8111-111111111111";
const OLD = "22222222-2222-4222-8222-222222222222";
const base = {
  origin: "coordinator",
  previewDocumentId: PREVIEW,
  signatureMethod: "icp_brasil",
  verificationReference: "Verificador ITI, relatório 1",
  signerName: "Dra. Fictícia",
  signerRegistration: "61001",
  signerUf: "ma",
  signedOn: "2026-11-03",
};

describe("pcmsoSignedInputSchema", () => {
  it("exige prévia, conferência e método; sem substituição, zera tipo e motivo", () => {
    expect(pcmsoSignedInputSchema.parse(base)).toMatchObject({
      signerUf: "MA",
      replacesId: null,
      changeKind: null,
      replaceReason: null,
    });
    expect(() =>
      pcmsoSignedInputSchema.parse({ ...base, previewDocumentId: "" }),
    ).toThrow();
    expect(() =>
      pcmsoSignedInputSchema.parse({ ...base, verificationReference: "" }),
    ).toThrow();
    expect(() =>
      pcmsoSignedInputSchema.parse({ ...base, signatureMethod: "x" }),
    ).toThrow();
  });
  it("substituição exige tipo de mudança e motivo; tipo sem substituição é recusado", () => {
    expect(() => pcmsoSignedInputSchema.parse({ ...base, replacesId: OLD })).toThrow(
      /tipo de mudança/,
    );
    expect(() =>
      pcmsoSignedInputSchema.parse({ ...base, changeKind: "administrative" }),
    ).toThrow(/só valem para substituição/);
    expect(
      pcmsoSignedInputSchema.parse({
        ...base,
        replacesId: OLD,
        changeKind: "administrative",
        replaceReason: "Troca do médico responsável.",
      }),
    ).toMatchObject({ replacesId: OLD, changeKind: "administrative" });
  });
  it("o rótulo nunca promete validação criptográfica", () => {
    expect(PCMSO_VERIFICATION_LABEL).toMatch(/documental/);
    expect(PCMSO_VERIFICATION_LABEL).toMatch(/sem validação criptográfica/);
  });
});

describe("pcmsoSignedOnProblem", () => {
  const facts = {
    previewGeneratedOn: "2026-11-01",
    coordinatorStartsOn: "2026-01-01",
    cycleEnd: "2027-10-31",
    today: "2026-11-03",
  };
  it("não futura, não anterior à prévia nem à designação, dentro do ciclo", () => {
    expect(pcmsoSignedOnProblem({ ...facts, signedOn: "2026-11-01" })).toBeNull();
    expect(pcmsoSignedOnProblem({ ...facts, signedOn: "2026-11-04" })).toMatch(/futura/);
    expect(pcmsoSignedOnProblem({ ...facts, signedOn: "2026-10-31" })).toMatch(/prévia/);
    expect(
      pcmsoSignedOnProblem({
        ...facts,
        coordinatorStartsOn: "2026-11-02",
        signedOn: "2026-11-01",
      }),
    ).toMatch(/designação/);
    expect(
      pcmsoSignedOnProblem({ ...facts, today: "2028-01-01", signedOn: "2027-11-01" }),
    ).toMatch(/ciclo/);
  });
});

describe("pcmsoSignedWarnings", () => {
  const current = {
    previewVersion: 2,
    examPlanId: "p1",
    signerRegistration: "61001",
    signerUf: "MA",
    cycleEnd: "2027-10-31",
  };
  const ctx = {
    current,
    latestPreviewVersion: 2,
    approvedPlanId: "p1",
    coordinator: { crm: "61001", uf: "MA" },
    today: "2026-11-03",
  };
  it("sem documento vigente, nada; vigente coerente, nada", () => {
    expect(pcmsoSignedWarnings({ ...ctx, current: null })).toEqual([]);
    expect(pcmsoSignedWarnings(ctx)).toEqual([]);
  });
  it("prévia mais nova, plano trocado, coordenador trocado e ciclo encerrado", () => {
    expect(
      pcmsoSignedWarnings({
        ...ctx,
        latestPreviewVersion: 3,
        approvedPlanId: "p2",
        coordinator: { crm: "61002", uf: "MA" },
        today: "2027-11-01",
      }),
    ).toEqual(["newer_preview", "plan_changed", "coordinator_changed", "cycle_ended"]);
  });
  it("CRM do cadastro só reformatado não é troca de coordenador (NOB-110)", () => {
    expect(
      pcmsoSignedWarnings({ ...ctx, coordinator: { crm: "61.001", uf: "ma" } }),
    ).toEqual([]);
    expect(
      pcmsoSignedWarnings({ ...ctx, coordinator: { crm: "061001", uf: "MA" } }),
    ).toEqual(["coordinator_changed"]);
  });
});

describe("pcmsoSignedInputSchema — CRM do signatário (NOB-110)", () => {
  it("aceita o CRM do cadastro com separadores; recusa letras", () => {
    expect(
      pcmsoSignedInputSchema.parse({ ...base, signerRegistration: "61.001" })
        .signerRegistration,
    ).toBe("61.001");
    expect(() =>
      pcmsoSignedInputSchema.parse({ ...base, signerRegistration: "61001-MA" }),
    ).toThrow(/só números/);
  });
});

describe("riskBasisProblems (base de riscos do documento × vigente)", () => {
  const risk = {
    exposureGroup: "GES A",
    jobRole: "",
    description: "Ruído",
    agentType: "physical",
    possibleInjuries: null,
  };
  const ok = {
    live: [{ id: "s1", version: "Revisão 1" }],
    liveFresh: true,
    liveRisks: [risk],
    previewSources: [{ id: "s1", version: "Revisão 1" }],
    planSources: [{ id: "s1", version: "Revisão 1" }],
    previewRisks: [risk],
  };
  it("base coerente: nenhum problema (ordem não importa)", () => {
    expect(riskBasisProblems(ok)).toEqual([]);
    expect(
      riskBasisProblems({
        ...ok,
        live: [ok.live[0], { id: "s2", version: "2026.1" }],
        previewSources: [{ id: "s2", version: "2026.1" }, ok.live[0]],
        planSources: [{ id: "s2", version: "2026.1" }, ok.live[0]],
      }),
    ).toEqual([]);
  });
  it("falha fechada: sem fonte vigente, fonte não conferível e snapshot ilegível", () => {
    expect(riskBasisProblems({ ...ok, live: [], liveRisks: [] })).toEqual(
      expect.arrayContaining(["no_live_source", "preview_sources_mismatch"]),
    );
    expect(riskBasisProblems({ ...ok, liveFresh: false })).toContain("source_changed");
    expect(riskBasisProblems({ ...ok, previewSources: null, planSources: null })).toEqual(
      expect.arrayContaining(["preview_sources_mismatch", "plan_sources_mismatch"]),
    );
  });
  it("versão, fonte e riscos divergentes são problemas distintos", () => {
    expect(
      riskBasisProblems({ ...ok, previewSources: [{ id: "s1", version: "Revisão 0" }] }),
    ).toEqual(["preview_sources_mismatch"]);
    expect(
      riskBasisProblems({ ...ok, planSources: [{ id: "s0", version: "Revisão 1" }] }),
    ).toEqual(["plan_sources_mismatch"]);
    expect(
      riskBasisProblems({ ...ok, liveRisks: [risk, { ...risk, description: "Calor" }] }),
    ).toEqual(["preview_risks_mismatch"]);
  });
  it("resumo do banco: igual passa; diferente ou ausente na prévia falha fechado", () => {
    expect(
      riskBasisProblems({ ...ok, previewDigest: "d1", currentDigest: "d1" }),
    ).toEqual([]);
    expect(
      riskBasisProblems({ ...ok, previewDigest: "d1", currentDigest: "d2" }),
    ).toEqual(["basis_changed_since_preview"]);
    expect(
      riskBasisProblems({ ...ok, previewDigest: null, currentDigest: "d1" }),
    ).toEqual(["basis_changed_since_preview"]);
  });
  it("lê fontes e riscos dos snapshots; formato inesperado vira null", () => {
    expect(snapshotSources([{ id: "s1", version: "v", title: "x" }])).toEqual([
      { id: "s1", version: "v" },
    ]);
    expect(snapshotSources([{ id: 1 }])).toBeNull();
    expect(snapshotSources(undefined)).toBeNull();
    expect(
      previewRisks({
        groups: [
          {
            exposureGroup: "GES A",
            jobRole: "",
            risks: [
              { description: "Ruído", agentType: "physical", possibleInjuries: null },
            ],
          },
        ],
      }),
    ).toEqual([risk]);
    expect(previewRisks({})).toBeNull();
  });
});
