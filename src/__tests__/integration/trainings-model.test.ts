import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "./_helpers/db";
import { seedPgrBase, PGR_IDS } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const T = {
  catalogA: "31111111-1111-1111-1111-1111111111a1",
  catalogB: "32222222-2222-2222-2222-2222222222b1",
  recordA: "31111111-1111-1111-1111-1111111111a2",
  recordB: "32222222-2222-2222-2222-2222222222b2",
  linkA: "31111111-1111-1111-1111-1111111111a3",
  linkB: "32222222-2222-2222-2222-2222222222b3",
} as const;

const I = PGR_IDS;

async function seedTrainings(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.training_catalog (id, org_id, number, name, workload_hours, periodicity) values
      ('${T.catalogA}','org_a',1,'NR-35 Trabalho em Altura',8,'biennial'),
      ('${T.catalogB}','org_b',1,'NR-10 Segurança em Eletricidade',40,'biennial');

    insert into public.training_records
      (id, org_id, employee_id, training_id, completed_at, valid_until) values
      ('${T.recordA}','org_a','${I.employeeA}','${T.catalogA}','2026-01-10','2028-01-10'),
      ('${T.recordB}','org_b','${I.employeeB}','${T.catalogB}','2026-01-10','2028-01-10');

    insert into public.job_role_required_trainings (id, org_id, job_role_id, training_id) values
      ('${T.linkA}','org_a','${I.jobRoleA}','${T.catalogA}'),
      ('${T.linkB}','org_b','${I.jobRoleB}','${T.catalogB}');
  `);
}

const TRAINING_TABLES = [
  "training_catalog",
  "training_records",
  "job_role_required_trainings",
] as const;

(shouldRun ? describe : describe.skip)("Fundação — modelo 0015 (training module)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await seedTrainings(admin);
  });

  describe("RLS/isolamento por tenant (app_runtime)", () => {
    it.each(TRAINING_TABLES)("%s: tenant A fixado → só linhas de A", async (table) => {
      const rows = await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<{ org_id: string }[]>`select org_id from public.${tx(table)}`,
      );
      expect(rows).toHaveLength(1);
      expect(rows.every((r) => r.org_id === "org_a")).toBe(true);
    });

    it.each(TRAINING_TABLES)("%s: sem tenant fixado → 0 linhas", async (table) => {
      const rows = await runtime<
        { org_id: string }[]
      >`select org_id from public.${runtime(table)}`;
      expect(rows).toHaveLength(0);
    });

    it("escrita cross-tenant (org_id ≠ ativo) é rejeitada pelo WITH CHECK", async () => {
      await expect(
        withOrgTx(runtime, "org_a", (tx) =>
          tx.unsafe(
            `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
             values ('org_b',3,'Invasor',4,'annual')`,
          ),
        ),
      ).rejects.toThrow();
    });
  });

  describe("Constraints de integridade", () => {
    it("CHECK workload_hours > 0: zero e negativo são rejeitados", async () => {
      await expect(
        admin.unsafe(
          `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
           values ('org_a',91,'Carga zero',0,'annual')`,
        ),
      ).rejects.toThrow(/workload_hours/);
      await expect(
        admin.unsafe(
          `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
           values ('org_a',92,'Carga negativa',-4,'annual')`,
        ),
      ).rejects.toThrow(/workload_hours/);
    });

    it("periodicidade fora do enum é rejeitada", async () => {
      await expect(
        admin.unsafe(
          `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
           values ('org_a',93,'Enum inválido',4,'monthly')`,
        ),
      ).rejects.toThrow();
    });

    it("UNIQUE (org_id, name): duplica no mesmo org → 23505; mesmo nome em outro org → ok", async () => {
      await expect(
        admin.unsafe(
          `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
           values ('org_a',94,'NR-35 Trabalho em Altura',8,'biennial')`,
        ),
      ).rejects.toThrow(/uq_training_catalog_org_name/);

      await expect(
        admin.unsafe(
          `insert into public.training_catalog (org_id, number, name, workload_hours, periodicity)
           values ('org_b',2,'NR-35 Trabalho em Altura',8,'biennial')`,
        ),
      ).resolves.toBeDefined();
    });

    it("UNIQUE (org_id, job_role_id, training_id): vínculo duplicado → 23505", async () => {
      await expect(
        admin.unsafe(
          `insert into public.job_role_required_trainings (org_id, job_role_id, training_id)
           values ('org_a','${I.jobRoleA}','${T.catalogA}')`,
        ),
      ).rejects.toThrow(/uq_job_role_required_trainings_org_role_training/);
    });
  });

  describe("ON DELETE", () => {
    it("excluir funcionário CASCADE remove suas realizações", async () => {
      await admin.unsafe(`delete from public.employees where id = '${I.employeeA}'`);
      const rows = await admin.unsafe(
        `select id from public.training_records where id = '${T.recordA}'`,
      );
      expect(rows).toHaveLength(0);
    });

    it("excluir função CASCADE remove seus vínculos de obrigatórios", async () => {
      await admin.unsafe(`delete from public.job_roles where id = '${I.jobRoleA}'`);
      const rows = await admin.unsafe(
        `select id from public.job_role_required_trainings where id = '${T.linkA}'`,
      );
      expect(rows).toHaveLength(0);
    });

    it("excluir item do catálogo EM USO (realização ou vínculo) → RESTRICT (23503)", async () => {
      await expect(
        admin.unsafe(`delete from public.training_catalog where id = '${T.catalogA}'`),
      ).rejects.toThrow();
    });

    it("excluir item do catálogo sem dependentes → ok", async () => {
      await admin.unsafe(`
        delete from public.training_records where training_id = '${T.catalogA}';
        delete from public.job_role_required_trainings where training_id = '${T.catalogA}';
      `);
      await expect(
        admin.unsafe(`delete from public.training_catalog where id = '${T.catalogA}'`),
      ).resolves.toBeDefined();
    });

    it("trigger set_updated_at atualiza updated_at no UPDATE", async () => {
      await admin.unsafe(
        `update public.training_catalog set name = 'NR-35 (rev.)' where id = '${T.catalogA}'`,
      );
      const [row] = await admin.unsafe(
        `select created_at, updated_at from public.training_catalog where id = '${T.catalogA}'`,
      );
      expect(new Date(row.updated_at as string).getTime()).toBeGreaterThan(
        new Date(row.created_at as string).getTime(),
      );
    });
  });
});
