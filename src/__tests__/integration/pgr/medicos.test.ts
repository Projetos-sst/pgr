import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  listMedicosAction,
  listMedicoClinicsAction,
  getMedicoAction,
  createMedicoAction,
  updateMedicoAction,
  deleteMedicoAction,
} from "@/shared/server/actions/pgr/medicos";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — medicos CRUD", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("cria, lista, detalha, edita e exclui (escopado ao tenant)", async () => {
    const created = await createMedicoAction({
      name: "Dra. Helena Marques",
      crm: "CRM 12.345/MA",
      registrationUf: "SP",
      specialty: "Medicina do Trabalho",
      clinic: "Clínica SanaVida",
      phone: "(98) 3232-1010",
      status: "active",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const list = await listMedicosAction({});
    expect(list.ok && list.data.total).toBe(1);

    const got = await getMedicoAction(created.data.id);
    expect(got.ok && got.data.name).toBe("Dra. Helena Marques");

    const updated = await updateMedicoAction(created.data.id, {
      name: "Dra. Helena M. Marques",
      crm: "CRM 12.345/MA",
      registrationUf: "SP",
      status: "inactive",
    });
    expect(updated.ok && updated.data.status).toBe("inactive");

    const del = await deleteMedicoAction(created.data.id);
    expect(del.ok).toBe(true);

    const after = await listMedicosAction({});
    expect(after.ok && after.data.total).toBe(0);
  });

  it("busca por nome ou CRM e filtra por status", async () => {
    await createMedicoAction({
      name: "Dr. Ricardo Antunes",
      crm: "CRM 09.881/MA",
      registrationUf: "SP",
    });
    await createMedicoAction({
      name: "Dr. Paulo Nogueira",
      crm: "CRM 07.660/MA",
      registrationUf: "SP",
      status: "inactive",
    });

    const byName = await listMedicosAction({ search: "Ricardo" });
    expect(byName.ok && byName.data.total).toBe(1);

    const byCrm = await listMedicosAction({ search: "07.660" });
    expect(byCrm.ok && byCrm.data.total).toBe(1);

    const active = await listMedicosAction({ status: "active" });
    expect(active.ok && active.data.rows.every((r) => r.status === "active")).toBe(true);
  });

  it("filtra por empresa/clínica e lista clínicas distintas do tenant", async () => {
    await createMedicoAction({
      name: "Dra. Ana",
      crm: "CRM 20.001/MA",
      registrationUf: "SP",
      clinic: "Clínica SanaVida",
    });
    await createMedicoAction({
      name: "Dr. Bruno",
      crm: "CRM 20.002/MA",
      registrationUf: "SP",
      clinic: "Clínica SanaVida",
    });
    await createMedicoAction({
      name: "Dr. Caio",
      crm: "CRM 20.003/MA",
      registrationUf: "SP",
      clinic: "Autônomo",
    });
    await createMedicoAction({
      name: "Dr. Davi",
      crm: "CRM 20.004/MA",
      registrationUf: "SP",
    }); // sem clínica

    const byClinic = await listMedicosAction({ clinic: "Clínica SanaVida" });
    expect(byClinic.ok && byClinic.data.total).toBe(2);
    expect(
      byClinic.ok && byClinic.data.rows.every((r) => r.clinic === "Clínica SanaVida"),
    ).toBe(true);

    const clinics = await listMedicoClinicsAction();
    // distintas, não-nulas, ordenadas — não inclui o médico sem clínica
    expect(clinics.ok && clinics.data).toEqual(["Autônomo", "Clínica SanaVida"]);
  });

  it("clínicas não vazam entre tenants", async () => {
    await createMedicoAction({
      name: "Dra. Ana",
      crm: "CRM 21.001/MA",
      registrationUf: "SP",
      clinic: "Clínica A",
    });
    asOwner("org_b");
    const clinics = await listMedicoClinicsAction();
    expect(clinics.ok && clinics.data).toEqual([]);
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await listMedicosAction({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
    const clinics = await listMedicoClinicsAction();
    expect(clinics.ok).toBe(false);
    if (!clinics.ok) expect(clinics.error.code).toBe("FORBIDDEN");
  });

  it("CRM duplicado no mesmo tenant → DUPLICATE", async () => {
    await createMedicoAction({ name: "A", crm: "CRM 01.111/MA", registrationUf: "SP" });
    const dup = await createMedicoAction({
      name: "B",
      crm: "CRM 01.111/MA",
      registrationUf: "SP",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("DUPLICATE");
  });

  it("nome/CRM vazio → VALIDATION", async () => {
    const noName = await createMedicoAction({
      name: "  ",
      crm: "CRM 1",
      registrationUf: "SP",
    });
    expect(noName.ok).toBe(false);
    if (!noName.ok) expect(noName.error.code).toBe("VALIDATION");
  });

  it("não vaza entre tenants (cross-tenant → NOT_FOUND)", async () => {
    const created = await createMedicoAction({
      name: "Dra. Larissa",
      crm: "CRM 18/MA",
      registrationUf: "SP",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    asOwner("org_b");
    const got = await getMedicoAction(created.data.id);
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("NOT_FOUND");

    const list = await listMedicosAction({});
    expect(list.ok && list.data.total).toBe(0);
  });
});
