import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { seedPgrBase } from "../_helpers/pgr-seed";
import { seedMedicine } from "../_helpers/medicine-seed";

const enabled = !!process.env.INTEGRATION_DATABASE_URL_ADMIN;
const folder = path.resolve("src/shared/db/migrations");
const journal = JSON.parse(
  fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"),
) as {
  entries: { idx: number; tag: string; when: number }[];
};
const newTables = [
  "machine_installations",
  "machine_installation_events",
  "pgr_basic_offer_versions",
  "pgr_basic_offer_publication",
  "pgr_basic_offer_events",
  "pgr_review_samples",
  "pgr_review_decisions",
  "health_exam_clinical_notes",
  "health_exam_work_restrictions",
  "clinical_record_access_events",
  "medical_risk_absence_declarations",
  "medico_link_invitations",
  "medico_link_invitation_events",
];

(enabled ? describe : describe.skip)(
  "PGR integration official Drizzle migration chain",
  () => {
    async function isolated(run: (db: ReturnType<typeof postgres>) => Promise<void>) {
      const url = new URL(process.env.INTEGRATION_DATABASE_URL_ADMIN!);
      // This test must never create or seed a database on an application server.
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.pathname !== "/sst_test"
      )
        throw new Error(
          "Migration rehearsal requires an isolated local /sst_test cluster.",
        );
      const name = `pgr_migration_${randomUUID().replaceAll("-", "")}`;
      const control = postgres(url.toString(), {
        max: 1,
        prepare: false,
        onnotice: () => {},
      });
      let db: ReturnType<typeof postgres> | undefined;
      let created = false;
      try {
        await control.unsafe(`create database "${name}"`);
        created = true;
        url.pathname = `/${name}`;
        db = postgres(url.toString(), { max: 1, prepare: false, onnotice: () => {} });
        await db.unsafe(fs.readFileSync("scripts/ci-integration-bootstrap.sql", "utf8"));
        await run(db);
      } finally {
        await db?.end({ timeout: 5 });
        try {
          if (created) await control.unsafe(`drop database "${name}"`);
        } finally {
          await control.end({ timeout: 5 });
        }
      }
    }

    async function assertFinal(db: ReturnType<typeof postgres>) {
      const rows =
        await db`select hash, created_at from drizzle.__drizzle_migrations order by id`;
      expect(rows).toHaveLength(journal.entries.length);
      expect(Number(rows.at(-1)!.created_at)).toBe(journal.entries.at(-1)!.when);
      const tables = await db<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class
      where relnamespace='public'::regnamespace and relname in ${db(newTables)}`;
      expect(tables.map((t) => t.relname).sort()).toEqual([...newTables].sort());
      expect(tables.every((t) => t.relrowsecurity)).toBe(true);
      for (const table of newTables) {
        const [privileges] = await db`
        select has_table_privilege('app_runtime',${`public.${table}`},'SELECT') as readable,
          has_table_privilege('app_runtime',${`public.${table}`},'INSERT') as insertable,
          has_table_privilege('app_runtime',${`public.${table}`},'DELETE') as deletable`;
        expect(privileges).toEqual({
          readable: true,
          insertable: true,
          deletable: false,
        });
        const [{ count }] =
          await db`select count(*)::int as count from pg_policies where schemaname='public' and tablename=${table}`;
        expect(count).toBeGreaterThan(0);
      }
      const [{ invalid }] = await db`select count(*)::int as invalid from pg_constraint
      where contype='f' and conrelid in (select oid from pg_class where relname in ${db(newTables)}) and not convalidated`;
      expect(invalid).toBe(0);
    }

    it("applies the official journal from an empty database and is idempotent", async () => {
      await isolated(async (db) => {
        await migrate(drizzle(db), { migrationsFolder: folder });
        await assertFinal(db);
        await migrate(drizzle(db), { migrationsFolder: folder });
        await assertFinal(db);
      });
    }, 120_000);

    it("upgrades 0056 to 0059 preserving NOB-98 and Medicine Lote 01 records", async () => {
      const baseline = fs.mkdtempSync(path.join(os.tmpdir(), "pgr-0056-"));
      try {
        fs.mkdirSync(path.join(baseline, "meta"));
        const entries = journal.entries.filter((e) => e.idx <= 56);
        fs.writeFileSync(
          path.join(baseline, "meta/_journal.json"),
          JSON.stringify({ ...journal, entries }),
        );
        for (const entry of entries)
          fs.copyFileSync(
            path.join(folder, `${entry.tag}.sql`),
            path.join(baseline, `${entry.tag}.sql`),
          );
        await isolated(async (db) => {
          await migrate(drizzle(db), { migrationsFolder: baseline });
          await seedPgrBase(db);
          await seedMedicine(db);
          await db`insert into medical_risk_sources (org_id,company_id,kind,title,version,reference,fingerprint,registered_by)
          select org_id,id,'external','Migration fixture','1','Fictitious reference','migration-fixture','fixture'
          from companies where org_id='org_a' limit 1`;
          const oldTables = [
            "companies",
            "employees",
            "company_modules",
            "pgr",
            "risks",
            "risk_assessments",
            "health_exams",
            "medical_risk_sources",
          ];
          // Colunas acrescentadas ou esvaziadas depois da 0056 ficam fora da comparação e são
          // conferidas à parte (`notes` vai para o prontuário segregado na 0067, NOB-155).
          const addedColumns: Record<string, string[]> = {
            health_exams: [
              "notes",
              "company_id",
              "company_origin",
              "company_origin_confirmed_by",
              "company_origin_confirmed_at",
              "company_origin_note",
            ],
          };
          const read = async () => {
            const records: Record<string, unknown> = {};
            for (const table of oldTables) {
              const row = (addedColumns[table] ?? []).reduce(
                (expr, column) => `${expr} - '${column}'`,
                "to_jsonb(t)",
              );
              records[table] = await db.unsafe(
                `select ${row} as data from public."${table}" t order by (${row})::text`,
              );
            }
            return records;
          };
          const before = await read();
          const notesBefore = await db<
            { id: string; org_id: string; notes: string; updated_at: Date }[]
          >`select id, org_id, notes, updated_at from health_exams where notes is not null order by id`;
          await migrate(drizzle(db), { migrationsFolder: folder });
          await assertFinal(db);
          expect(await read()).toEqual(before);
          // NOB-152 (MED-07): exames antigos ficam sem empresa de origem (não comprovada); nada é
          // presumido a partir do vínculo atual do funcionário.
          const [{ unverified, total }] =
            await db`select count(*) filter (where company_id is null and company_origin is null)::int as unverified, count(*)::int as total from health_exams`;
          expect(total).toBeGreaterThan(0);
          expect(unverified).toBe(total);
          // NOB-155: cada observação antiga está no prontuário do mesmo exame e tenant, sem perda,
          // sem autoria presumida, com a data da última alteração do exame; o campo antigo ficou vazio.
          expect(notesBefore.length).toBeGreaterThan(0);
          const moved = await db<
            {
              health_exam_id: string;
              org_id: string;
              content: string;
              recorded_at: Date;
              authored_by_medico_id: string | null;
              recorded_by: string | null;
            }[]
          >`select health_exam_id, org_id, content, recorded_at, authored_by_medico_id, recorded_by
            from health_exam_clinical_notes where origin = 'legacy_exam_notes' order by health_exam_id`;
          expect(
            moved.map((m) => ({
              id: m.health_exam_id,
              org_id: m.org_id,
              notes: m.content,
              updated_at: m.recorded_at,
            })),
          ).toEqual(notesBefore);
          expect(
            moved.every(
              (m) => m.authored_by_medico_id === null && m.recorded_by === null,
            ),
          ).toBe(true);
          const [{ residual }] =
            await db`select count(*)::int as residual from health_exams where notes is not null`;
          expect(residual).toBe(0);
          await expect(
            db`update health_exams set notes = 'x' where id = ${notesBefore[0].id}`,
          ).rejects.toMatchObject({ code: "23514" });
          // O papel do app, mesmo no tenant certo e sem vínculo médico, não lê o prontuário.
          const [{ visible }] = await db.begin(async (tx) => {
            await tx`set local role app_runtime`;
            await tx`select set_config('app.current_org', ${notesBefore[0].org_id}, true)`;
            return tx`select count(*)::int as visible from health_exam_clinical_notes`;
          });
          expect(visible).toBe(0);
        });
      } finally {
        // Only remove the exact temporary folder created by this test.
        const resolved = path.resolve(baseline);
        if (
          !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
          !path.basename(resolved).startsWith("pgr-0056-")
        )
          throw new Error("Invalid migration rehearsal cleanup path.");
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    }, 120_000);
  },
);
