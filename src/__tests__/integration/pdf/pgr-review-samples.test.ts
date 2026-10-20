/** Representative fictional cases for technical review; automatic assertions are not a technical opinion. */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));

import type postgres from "postgres";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import {
  extractDocxText,
  findLeftoverMarkers,
} from "@/shared/integrations/docx/template-engine";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
// The document uses nonbreaking spaces and split OOXML runs for layout.
const visible = (text: string) => text.replace(/\s/g, "").toLocaleLowerCase("pt-BR");
(enabled ? describe : describe.skip)("NOB-107 fictional review samples", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  it.each([
    ["physical", "Físico", "Agente físico fictício para revisão"],
    ["chemical", "Químico", "Agente químico fictício para revisão"],
    ["ergonomic", "Ergonômico", "Situação ergonômica fictícia para revisão"],
  ])(
    "maps a %s sample without mixing another company's inventory",
    async (agentType, label, description) => {
      await admin`update risks set agent_type = ${agentType}, description = ${description}, sources = 'Fonte fictícia registrada' where id = ${I.riskA}`;
      await admin`update risks set description = 'CONTEÚDO RESTRITO DA EMPRESA B' where id = ${I.riskB}`;
      const generated = await generatePgrDocx("org_a", I.pgrA);
      const text = extractDocxText(generated.file);
      expect(visible(text)).toContain(visible(label));
      expect(visible(text)).toContain(visible(description));
      expect(visible(text)).toContain(visible("Fonte fictícia registrada"));
      expect(visible(text)).not.toContain(visible("CONTEÚDO RESTRITO DA EMPRESA B"));
      expect(findLeftoverMarkers(text)).toEqual([]);
      await expect(generatePgrDocx("org_b", I.pgrA)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    },
  );

  it("keeps missing assessment explicit rather than representing it as approval", async () => {
    await admin`delete from risk_assessments where risk_id = ${I.riskA}`;
    const generated = await generatePgrDocx("org_a", I.pgrA);
    expect(extractDocxText(generated.file)).toContain("Não avaliado");
  });

  it("regenerates a corrected description while preserving the previous exported bytes", async () => {
    await admin`update risks set description = 'Texto fictício antes da revisão' where id = ${I.riskA}`;
    const before = await generatePgrDocx("org_a", I.pgrA);
    const savedBytes = Buffer.from(before.file);
    await admin`update risks set description = 'Texto fictício corrigido para revalidação' where id = ${I.riskA}`;
    const after = await generatePgrDocx("org_a", I.pgrA);
    expect(visible(extractDocxText(after.file))).toContain(
      visible("Texto fictício corrigido para revalidação"),
    );
    expect(visible(extractDocxText(after.file))).not.toContain(
      visible("Texto fictício antes da revisão"),
    );
    expect(before.file.equals(savedBytes)).toBe(true);
    expect(visible(extractDocxText(before.file))).toContain(
      visible("Texto fictício antes da revisão"),
    );
  });
});
