/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: jest.fn() }));
jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));
jest.mock("@/shared/db/repositories/users", () => ({
  replaceUser: jest.fn(async () => ({})),
  upsertUser: jest.fn(async () => ({})),
  deleteUser: jest.fn(async () => undefined),
}));
jest.mock("@/shared/db/repositories/orgs", () => ({
  upsertOrg: jest.fn(async () => ({})),
  replaceOrg: jest.fn(async () => ({})),
  deleteOrg: jest.fn(async () => undefined),
}));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  upsertOrgMembership: jest.fn(async () => ({})),
  deleteOrgMembership: jest.fn(async () => undefined),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(async () => ({ tenantId: "tenant_x", created: true })),
}));

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { POST } from "@/app/api/webhooks/clerk/route";
import * as usersRepo from "@/shared/db/repositories/users";
import { provisionPersonalTenant } from "@/shared/tenant/provision-personal-tenant";

const userCreatedData = {
  id: "user_x",
  first_name: "Ada",
  last_name: "Lovelace",
  primary_email_address_id: "idn_1",
  email_addresses: [{ id: "idn_1", email_address: "ada@example.com" }],
};

function fakeReq() {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body: "{}",
  });
}

describe("clerk webhook — provisionamento de tenant pessoal (US1)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("user.created → replaceUser + provisiona tenant pessoal (owner) [FR-001/003]", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "user.created",
      data: userCreatedData,
    });

    const res = await POST(fakeReq());

    expect(res.status).toBe(200);
    expect(usersRepo.replaceUser).toHaveBeenCalledTimes(1);
    expect(provisionPersonalTenant).toHaveBeenCalledWith({
      userId: "user_x",
      name: "Ada Lovelace",
    });
  });

  it("reentrega de user.created → provisiona a cada entrega (idempotência no nível da função)", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValue({
      type: "user.created",
      data: userCreatedData,
    });

    await POST(fakeReq());
    await POST(fakeReq());

    expect(provisionPersonalTenant).toHaveBeenCalledTimes(2);
  });

  it("user.updated → sincroniza mas NÃO provisiona", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "user.updated",
      data: userCreatedData,
    });

    const res = await POST(fakeReq());

    expect(res.status).toBe(200);
    expect(usersRepo.replaceUser).toHaveBeenCalledTimes(1);
    expect(provisionPersonalTenant).not.toHaveBeenCalled();
  });

  // Regressão (self-signup): sem first/last name — comum em cadastro aberto via
  // magic link/OAuth mínimo — o nome do tenant nunca pode ir null; deriva do
  // local-part do e-mail primário.
  it("user.created sem first/last name → provisiona com nome derivado do e-mail (nunca null)", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "user.created",
      data: {
        id: "user_y",
        first_name: null,
        last_name: null,
        primary_email_address_id: "idn_2",
        email_addresses: [{ id: "idn_2", email_address: "grace.hopper@example.com" }],
      },
    });

    const res = await POST(fakeReq());

    expect(res.status).toBe(200);
    expect(provisionPersonalTenant).toHaveBeenCalledWith({
      userId: "user_y",
      name: "grace.hopper",
    });
  });

  it("payload inválido (sem id) → 400 e NENHUM provisionamento [FR-025]", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "user.created",
      data: { first_name: "x" },
    });

    const res = await POST(fakeReq());

    expect(res.status).toBe(400);
    expect(usersRepo.replaceUser).not.toHaveBeenCalled();
    expect(provisionPersonalTenant).not.toHaveBeenCalled();
  });
});
