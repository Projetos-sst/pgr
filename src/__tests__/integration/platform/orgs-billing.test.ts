import postgres from "postgres";

import { adminClient, applyMigrations, truncateAll } from "../_helpers/db";

// Billing / planos (#86): `orgs` é o espelho local da assinatura do Stripe
// (fonte da verdade é o webhook → updateOrgBilling). Esta suíte cobre o backstop
// de banco das colunas de billing que o webhook grava: unicidade do customer do
// Stripe, nullability de trial e o round-trip do plano (free ⇄ pro) preservando os
// ids do Stripe. O CHECK de `plan` já é coberto por shared/db/orgs-plan-constraint.
const shouldRun = !!process.env.INTEGRATION_DATABASE_URL;

(shouldRun ? describe : describe.skip)("orgs — colunas de billing (#86)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await truncateAll(admin);
  });

  it("stripe_customer_id é UNIQUE (dois tenants não compartilham o mesmo customer)", async () => {
    await admin`insert into public.orgs (id, stripe_customer_id) values ('org_a','cus_1')`;
    await expect(
      admin`insert into public.orgs (id, stripe_customer_id) values ('org_b','cus_1')`,
    ).rejects.toThrow();
  });

  it("colunas de billing são nullable (org recém-criada não tem assinatura)", async () => {
    const [row] = await admin<
      {
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        trial_ends_at: Date | null;
      }[]
    >`
      insert into public.orgs (id) values ('org_new')
      returning stripe_customer_id, stripe_subscription_id, trial_ends_at`;
    expect(row.stripe_customer_id).toBeNull();
    expect(row.stripe_subscription_id).toBeNull();
    expect(row.trial_ends_at).toBeNull();
  });

  it("round-trip do webhook: free → pro grava customer/subscription/trial; deleted → free", async () => {
    await admin`insert into public.orgs (id, plan) values ('org_a','free')`;

    // checkout.session.completed / subscription.updated (trialing|active) → pro
    await admin`
      update public.orgs set
        plan = 'pro',
        stripe_customer_id = 'cus_9',
        stripe_subscription_id = 'sub_9',
        trial_ends_at = now() + interval '7 days'
      where id = 'org_a'`;
    const [pro] = await admin<{ plan: string; sub: string | null; trial: Date | null }[]>`
      select plan, stripe_subscription_id as sub, trial_ends_at as trial
      from public.orgs where id = 'org_a'`;
    expect(pro.plan).toBe("pro");
    expect(pro.sub).toBe("sub_9");
    expect(pro.trial).not.toBeNull();

    // customer.subscription.deleted → free (espelho volta ao gratuito)
    await admin`update public.orgs set plan = 'free' where id = 'org_a'`;
    const [free] = await admin<{ plan: string; cus: string | null }[]>`
      select plan, stripe_customer_id as cus from public.orgs where id = 'org_a'`;
    expect(free.plan).toBe("free");
    // o customer permanece (o cliente do Stripe não some ao cancelar)
    expect(free.cus).toBe("cus_9");
  });
});
