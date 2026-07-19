/**
 * Integração das Server Actions de Equipe (`/team`) contra Postgres efêmero —
 * regressão do bug de QA (Onda 3): `org_memberships.role` guarda o papel CRU do
 * Clerk (`org:admin`/`org:member`) para orgs Clerk-backed, não o vocabulário de
 * domínio (`owner`/`collaborator`/`client`). Cobre:
 *   1. papel exibido corretamente (Administrador, não "Membro") para `org:admin`;
 *   2. proteção de "último administrador" disparando com o dado real `org:admin`;
 *   3. isolamento multi-tenant (membros de outra org nunca aparecem/afetam).
 *
 * `org_memberships`/`orgs`/`users` são servidos via Supabase-JS (PostgREST), não
 * Drizzle/postgres.js direto — mesma camada de `clerk-membership.test.ts`, com o
 * mesmo gate de env (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` de um projeto Supabase
 * real, além de `INTEGRATION_DATABASE_URL` para o `truncateAll` via postgres.js).
 */
import postgres from "postgres";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/clerk/organizations", () => ({
  createOrgInvitation: jest.fn(),
  updateOrgMembershipRole: jest.fn(),
  removeOrgMembership: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import * as clerkOrg from "@/shared/integrations/clerk/organizations";
import {
  changeMemberRole,
  listTeamMembers,
  removeMember,
} from "@/shared/server/actions/platform/team";
import { upsertOrg } from "@/shared/db/repositories/orgs";
import { upsertUser } from "@/shared/db/repositories/users";
import { upsertOrgMembership } from "@/shared/db/repositories/org-memberships";

import { adminClient, truncateAll } from "../_helpers/db";

const shouldRun =
  !!process.env.INTEGRATION_DATABASE_URL &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SECRET_KEY;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asMember = (tenantId: string, userId: string, role = "owner", plan = "pro") =>
  mockedGate.mockResolvedValue({ userId, tenantId, plan: plan as "free" | "pro", role });

(shouldRun ? describe : describe.skip)(
  "Server Actions — /team (Onda 3 regressão)",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(() => {
      admin = adminClient();
    });
    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });
    beforeEach(async () => {
      await truncateAll(admin);
      mockedGate.mockReset();
      (clerkOrg.updateOrgMembershipRole as jest.Mock).mockReset();
      (clerkOrg.removeOrgMembership as jest.Mock).mockReset();
    });

    async function seedClerkBackedOrg(orgId: string, clerkOrgId: string) {
      await upsertOrg({ id: orgId, name: `Org ${orgId}`, plan: "pro", clerkOrgId });
    }

    it("papel cru do Clerk (org:admin) é exibido como 'Administrador', não 'Membro'", async () => {
      await seedClerkBackedOrg("org_a", "clerk_a");
      await upsertUser({ id: "user_admin", email: "admin@a.com", firstName: "Ana" });
      await upsertUser({ id: "user_member", email: "member@a.com", firstName: "Bia" });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_admin",
        role: "org:admin",
      });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_member",
        role: "org:member",
      });

      asMember("org_a", "user_admin");
      const result = await listTeamMembers();
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const admin = result.data.rows.find((r) => r.userId === "user_admin");
      const member = result.data.rows.find((r) => r.userId === "user_member");
      expect(admin?.role).toBe("owner");
      expect(admin?.roleLabel).toBe("Administrador");
      expect(member?.role).toBe("collaborator");
      expect(member?.roleLabel).toBe("Colaborador");
    });

    it("bloqueia rebaixar/remover o último administrador real (role='org:admin')", async () => {
      await seedClerkBackedOrg("org_a", "clerk_a");
      await upsertUser({ id: "user_admin" });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_admin",
        role: "org:admin",
      });
      await upsertUser({ id: "user_other" });
      asMember("org_a", "user_other");

      const demoted = await changeMemberRole("user_admin", { role: "collaborator" });
      expect(demoted.ok).toBe(false);
      if (!demoted.ok) expect(demoted.error.code).toBe("FORBIDDEN");
      expect(clerkOrg.updateOrgMembershipRole).not.toHaveBeenCalled();

      const removed = await removeMember("user_admin");
      expect(removed.ok).toBe(false);
      if (!removed.ok) expect(removed.error.code).toBe("FORBIDDEN");
      expect(clerkOrg.removeOrgMembership).not.toHaveBeenCalled();
    });

    it("permite rebaixar/remover um administrador quando há outro (2 org:admin)", async () => {
      await seedClerkBackedOrg("org_a", "clerk_a");
      await upsertUser({ id: "user_admin_1" });
      await upsertUser({ id: "user_admin_2" });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_admin_1",
        role: "org:admin",
      });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_admin_2",
        role: "org:admin",
      });
      asMember("org_a", "user_admin_1");

      const demoted = await changeMemberRole("user_admin_2", { role: "collaborator" });
      expect(demoted.ok).toBe(true);
      expect(clerkOrg.updateOrgMembershipRole).toHaveBeenCalledWith({
        clerkOrgId: "clerk_a",
        userId: "user_admin_2",
        role: "collaborator",
      });
    });

    it("isolamento multi-tenant: membros/administradores de org_b nunca aparecem em org_a", async () => {
      await seedClerkBackedOrg("org_a", "clerk_a");
      await seedClerkBackedOrg("org_b", "clerk_b");
      await upsertUser({ id: "user_a_admin" });
      await upsertUser({ id: "user_b_admin" });
      await upsertOrgMembership({
        orgId: "org_a",
        userId: "user_a_admin",
        role: "org:admin",
      });
      await upsertOrgMembership({
        orgId: "org_b",
        userId: "user_b_admin",
        role: "org:admin",
      });

      asMember("org_a", "user_a_admin");
      const listA = await listTeamMembers();
      expect(listA.ok).toBe(true);
      if (listA.ok) {
        expect(listA.data.rows.some((r) => r.userId === "user_b_admin")).toBe(false);
        expect(listA.data.total).toBe(1);
      }

      // org_a age sobre um userId que só existe como admin em org_b: o membership
      // não é encontrado no escopo de org_a → NOT_FOUND (nunca afeta org_b).
      const crossTenantRemoval = await removeMember("user_b_admin");
      expect(crossTenantRemoval.ok).toBe(false);
      if (!crossTenantRemoval.ok) expect(crossTenantRemoval.error.code).toBe("NOT_FOUND");
      expect(clerkOrg.removeOrgMembership).not.toHaveBeenCalled();
    });
  },
);
