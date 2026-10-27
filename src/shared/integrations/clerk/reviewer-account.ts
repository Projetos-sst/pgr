import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
/** Read-only lookup. Never sends invitations, changes roles, or grants Pro. */
export async function findVerifiedReviewerAccount(email: string): Promise<string | null> {
  const client = await clerkClient();
  const result = await client.users.getUserList({ emailAddress: [email], limit: 2 });
  const verified = result.data.filter((user) =>
    user.emailAddresses.some(
      (address) =>
        address.emailAddress.trim().toLowerCase() === email &&
        address.verification?.status === "verified",
    ),
  );
  return verified.length === 1 ? verified[0].id : null;
}
