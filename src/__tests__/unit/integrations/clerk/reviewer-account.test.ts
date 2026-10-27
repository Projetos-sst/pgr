/** @jest-environment node */
import { clerkClient } from "@clerk/nextjs/server";
import { findVerifiedReviewerAccount } from "@/shared/integrations/clerk/reviewer-account";
const getUserList = jest.fn();
const sendInvitation = jest.fn();
beforeEach(() => {
  getUserList.mockReset();
  sendInvitation.mockReset();
  jest.mocked(clerkClient).mockResolvedValue({
    users: { getUserList },
    organizations: { createOrganizationInvitation: sendInvitation },
  } as never);
});
it("binds the account only to an exact verified email and performs no invitation or billing mutation", async () => {
  getUserList.mockResolvedValue({
    data: [
      {
        id: "reviewer",
        emailAddresses: [
          {
            emailAddress: "Reviewer@Example.invalid",
            verification: { status: "verified" },
          },
        ],
      },
    ],
  });
  expect(await findVerifiedReviewerAccount("reviewer@example.invalid")).toBe("reviewer");
  expect(getUserList).toHaveBeenCalledWith({
    emailAddress: ["reviewer@example.invalid"],
    limit: 2,
  });
  expect(sendInvitation).not.toHaveBeenCalled();
});
it("rejects unverified, mismatched and ambiguous accounts", async () => {
  for (const data of [
    [],
    [
      {
        id: "a",
        emailAddresses: [
          {
            emailAddress: "reviewer@example.invalid",
            verification: { status: "unverified" },
          },
        ],
      },
    ],
    [
      {
        id: "a",
        emailAddresses: [
          { emailAddress: "other@example.invalid", verification: { status: "verified" } },
        ],
      },
    ],
    ["a", "b"].map((id) => ({
      id,
      emailAddresses: [
        {
          emailAddress: "reviewer@example.invalid",
          verification: { status: "verified" },
        },
      ],
    })),
  ]) {
    getUserList.mockResolvedValue({ data });
    expect(await findVerifiedReviewerAccount("reviewer@example.invalid")).toBeNull();
  }
});
