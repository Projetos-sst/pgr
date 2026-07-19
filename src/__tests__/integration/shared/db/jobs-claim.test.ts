import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

/** Contrato de claim da #39 (contracts/schema-and-migrations.md §2). */
const CLAIM_SQL = `
  update public.jobs
  set status = 'processing', locked_at = now(), attempts = attempts + 1
  where id = (
    select id from public.jobs
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
`;

const RECOVER_STALE_SQL = `
  update public.jobs
  set status = 'pending', locked_at = null
  where status = 'processing' and locked_at < now() - '1 hour'::interval
  returning id;
`;

type JobRow = {
  id: string;
  status: string;
  attempts: number;
  locked_at: string | null;
};

(shouldRun ? describe : describe.skip)(
  "US2 — jobs: claim atômico, recuperação de claim travado e falha registrada",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
    });

    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await admin.unsafe(`truncate table public.orgs restart identity cascade;`);
      await admin.unsafe(`insert into public.orgs (id, plan) values ('org_a','free');`);
    });

    it("dois claims concorrentes sobre 1 job pendente → exatamente um vence (SKIP LOCKED)", async () => {
      await admin.unsafe(
        `insert into public.jobs (org_id, job_type) values ('org_a','pdf_batch')`,
      );
      const second = postgres(ADMIN_URL!, { max: 1, prepare: false });
      try {
        let claimedInTx1: JobRow[] = [];
        let releaseTx1!: () => void;
        const tx1Held = new Promise<void>((resolve) => (releaseTx1 = resolve));
        let signalClaimDone!: () => void;
        const tx1ClaimDone = new Promise<void>((resolve) => (signalClaimDone = resolve));

        const tx1 = admin.begin(async (tx) => {
          claimedInTx1 = (await tx.unsafe(CLAIM_SQL)) as unknown as JobRow[];
          signalClaimDone();
          await tx1Held;
        });

        await tx1ClaimDone;
        const claimedInTx2 = (await second.unsafe(CLAIM_SQL)) as unknown as JobRow[];
        releaseTx1();
        await tx1;

        expect(claimedInTx1).toHaveLength(1);
        expect(claimedInTx2).toHaveLength(0);
        expect(claimedInTx1[0].status).toBe("processing");
        expect(claimedInTx1[0].attempts).toBe(1);
        expect(claimedInTx1[0].locked_at).not.toBeNull();
      } finally {
        await second.end({ timeout: 5 });
      }
    });

    it("attempts acumula a cada claim (re-claim após voltar à fila)", async () => {
      await admin.unsafe(
        `insert into public.jobs (org_id, job_type) values ('org_a','pdf_batch')`,
      );
      await admin.unsafe(CLAIM_SQL);
      await admin.unsafe(`update public.jobs set status = 'pending', locked_at = null`);
      const rows = (await admin.unsafe(CLAIM_SQL)) as unknown as JobRow[];
      expect(rows[0].attempts).toBe(2);
    });

    it("claim travado (locked_at antigo) volta a pending; claim recente NÃO volta", async () => {
      await admin.unsafe(`
        insert into public.jobs (id, org_id, job_type, status, locked_at, attempts) values
          ('66666666-6666-6666-6666-6666666666a1','org_a','pdf_batch','processing', now() - interval '2 hours', 1),
          ('66666666-6666-6666-6666-6666666666a2','org_a','pdf_batch','processing', now(), 1);
      `);
      const recovered = (await admin.unsafe(RECOVER_STALE_SQL)) as unknown as {
        id: string;
      }[];
      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe("66666666-6666-6666-6666-6666666666a1");

      const rows = await admin<JobRow[]>`
        select id, status, locked_at from public.jobs order by id
      `;
      expect(rows[0].status).toBe("pending");
      expect(rows[0].locked_at).toBeNull();
      expect(rows[1].status).toBe("processing");
      expect(rows[1].locked_at).not.toBeNull();
    });

    it("processing → failed com erro estruturado em result (nunca silencioso)", async () => {
      await admin.unsafe(
        `insert into public.jobs (org_id, job_type) values ('org_a','pdf_batch')`,
      );
      await admin.unsafe(CLAIM_SQL);
      await admin.unsafe(`
        update public.jobs
        set status = 'failed',
            result = '{"error":{"code":"MALFORMED_PAYLOAD","message":"payload sem pgrId"}}'::jsonb,
            locked_at = null
        where status = 'processing'
      `);
      const [row] = await admin<
        { status: string; result: { error: { code: string } } }[]
      >`select status, result from public.jobs`;
      expect(row.status).toBe("failed");
      expect(row.result.error.code).toBe("MALFORMED_PAYLOAD");
    });

    it("defaults e CHECKs: payload '{}', status pending, attempts >= 0", async () => {
      await admin.unsafe(
        `insert into public.jobs (org_id, job_type) values ('org_a','pdf_batch')`,
      );
      const [row] = await admin<
        { status: string; payload: Record<string, never>; attempts: number }[]
      >`select status, payload, attempts from public.jobs`;
      expect(row.status).toBe("pending");
      expect(row.payload).toEqual({});
      expect(row.attempts).toBe(0);

      await expect(
        admin.unsafe(
          `insert into public.jobs (org_id, job_type, attempts) values ('org_a','pdf_batch',-1)`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  },
);
